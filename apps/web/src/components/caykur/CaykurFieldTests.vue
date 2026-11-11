<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { ClipboardCheck, Grid3x3 } from '@lucide/vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EmptyState, LoadingState } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toneVariant, type Tone } from '@/components/caykur/tone';
import { api, type FieldTestCase, type FieldTestClaim, type FieldTestsBlock, type FieldTestVerdict, type InventoryMap } from '@/services/api';
import { formatM2 } from '@/services/caykur/teaInventory';
import { countPixelCentres, fromUtm, geometryLon, pixelGridLines, toUtm, utmZone } from '@/services/caykur/sentinelGrid';

/**
 * Independent field tests (Saha testi): what an inspector saw on the ground — ada/parsel, the marked spot,
 * dated claims — against a satellite step test computed for that spot alone, apart from the pruning
 * detection chain. The spot's NDVI/NBR and VH are read relative to the tea cover around it, so the
 * season's weather drops out and only a change at the spot remains.
 */
const props = defineProps<{ areaId: string; mapData: InventoryMap }>();

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const VERDICT_META: Record<FieldTestVerdict, { label: string; tone: Tone }> = {
    supports: { label: 'Uydu destekliyor', tone: 'success' },
    likely: { label: 'Uydu büyük olasılıkla destekliyor', tone: 'info' },
    contradicts: { label: 'Uydu çelişiyor', tone: 'danger' },
    unclear: { label: 'Belirsiz', tone: 'warning' },
    pending: { label: 'Gözlem bekleniyor', tone: 'muted' },
};
const TEST_LABEL: Record<string, string> = {
    spotNdvi: 'İşaretli alan · NDVI (komşulara göreli)',
    spotNbr: 'İşaretli alan · NBR (komşulara göreli)',
    restNdvi: 'Parselin kalanı · NDVI (kontrol)',
    spotVh_ASCENDING: 'İşaretli alan · radar VH, çıkış yörüngesi (dB)',
    spotVh_DESCENDING: 'İşaretli alan · radar VH, iniş yörüngesi (dB)',
    restVh_ASCENDING: 'Parselin kalanı · radar VH, çıkış yörüngesi (kontrol)',
    restVh_DESCENDING: 'Parselin kalanı · radar VH, iniş yörüngesi (kontrol)',
};

const block = ref<FieldTestsBlock | null>(null);
const isLoading = ref(true);
const showGrid = ref(true);
const showPixels = ref(true);
const mapEls = new Map<string, HTMLElement>();
const maps = new Map<string, { map: L.Map; grid: L.LayerGroup | null; pixels: L.LayerGroup | null }>();

/** Colour of a pixel's relative NDVI change: deep pruning shows as a strong drop, debris-covered rows as a weaker one. */
function deltaColor(d: number | null): string | null {
    if (d === null) return null;
    if (d <= -0.15) return '#7f1d1d';
    if (d <= -0.1) return '#b91c1c';
    if (d <= -0.05) return '#f97316';
    if (d <= -0.025) return '#fde68a';
    if (d >= 0.05) return '#60a5fa';
    return null;
}
/** The pixel map as 10 m squares on Sentinel-2's own UTM grid. */
function pixelLayer(c: FieldTestCase): L.LayerGroup {
    const pc = c.pixelChange;
    if (!pc) return L.layerGroup();
    const zone = Number(pc.epsg.slice(-2));
    const squares = pc.pixels.map((px) => {
        const u = toUtm(px.lat, px.lon, zone);
        const e0 = Math.floor(u.e / 10) * 10;
        const n0 = Math.floor(u.n / 10) * 10;
        const ring: Array<[number, number]> = [fromUtm(e0, n0, zone), fromUtm(e0 + 10, n0, zone), fromUtm(e0 + 10, n0 + 10, zone), fromUtm(e0, n0 + 10, zone)];
        const color = deltaColor(px.delta);
        const poly = L.polygon(ring, { color: color ?? '#ffffff', weight: color ? 1 : 0, opacity: 0.9, fillColor: color ?? '#000000', fillOpacity: color ? 0.55 : 0, interactive: true });
        poly.bindTooltip(px.delta === null ? 'Temiz gözlem yok' : `Göreli NDVI değişimi ${px.delta > 0 ? '+' : ''}${px.delta.toFixed(3)} · önce ${fmtNum(px.before)} (${px.nBefore} sahne) → sonra ${fmtNum(px.after)} (${px.nAfter} sahne)`, { sticky: true });
        return poly;
    });
    return L.layerGroup(squares);
}

function fmtDate(d: string | null | undefined): string {
    if (!d) return '—';
    return `${Number(d.slice(8, 10))} ${MONTHS_TR[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
}
const fmtNum = (v: number | null | undefined, digits = 2) => (v === null || v === undefined ? '—' : v.toFixed(digits));
function cssVar(name: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

async function load(): Promise<void> {
    isLoading.value = true;
    const res = await api.getFieldTests(props.areaId);
    isLoading.value = false;
    if (!res.data) {
        block.value = null;
        return;
    }
    block.value = res.data;
    await nextTick();
    for (const c of res.data.cases) renderMap(c);
}

function setMapEl(id: string, el: unknown): void {
    if (el instanceof HTMLElement) mapEls.set(id, el);
}

/** Parcel and marked spot on a satellite base, with Sentinel-2's real 10 m lattice. */
function renderMap(c: FieldTestCase): void {
    const el = mapEls.get(c.id);
    if (!el) return;
    maps.get(c.id)?.map.remove();
    const map = L.map(el, { zoomControl: false, attributionControl: false, scrollWheelZoom: false, dragging: false });
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20, maxNativeZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }).addTo(map);
    L.geoJSON(props.mapData, { style: { color: '#ffffff', weight: 0.7, opacity: 0.5, fill: false }, interactive: false }).addTo(map);
    const parcel = L.geoJSON({ type: 'Feature', geometry: c.parcelGeometry, properties: {} } as GeoJSON.Feature, { style: { color: '#ffffff', weight: 2.5, fill: false }, interactive: false }).addTo(map);
    const spotColor = cssVar('--primary', '#15803d');
    L.geoJSON({ type: 'Feature', geometry: c.spot.geometry, properties: {} } as GeoJSON.Feature, { style: { color: spotColor, weight: 2.5, fillColor: spotColor, fillOpacity: 0.35, dashArray: c.spot.approximate ? '5 4' : undefined }, interactive: false }).addTo(map);
    map.fitBounds(parcel.getBounds().pad(0.5), { maxZoom: 19 });
    const entry = { map, grid: null as L.LayerGroup | null, pixels: null as L.LayerGroup | null };
    maps.set(c.id, entry);
    if (showPixels.value && c.pixelChange) entry.pixels = pixelLayer(c).addTo(map);
    if (showGrid.value) entry.grid = gridFor(map, c).addTo(map);
}
watch(showPixels, (on) => {
    for (const c of block.value?.cases ?? []) {
        const e = maps.get(c.id);
        if (!e) continue;
        e.pixels?.remove();
        e.pixels = on && c.pixelChange ? pixelLayer(c).addTo(e.map) : null;
        // Keep the lattice above the squares.
        if (e.grid) {
            e.grid.remove();
            e.grid.addTo(e.map);
        }
    }
});
function movedPixels(c: FieldTestCase): number {
    return (c.pixelChange?.pixels ?? []).filter((px) => px.delta !== null && px.delta <= -0.05).length;
}
function gridFor(map: L.Map, c: FieldTestCase): L.LayerGroup {
    const b = map.getBounds().pad(0.2);
    const lines = pixelGridLines({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }, utmZone(geometryLon(c.parcelGeometry)));
    return L.layerGroup(lines.map((pts) => L.polyline(pts, { color: '#ffffff', weight: 0.7, opacity: 0.55, interactive: false })));
}
watch(showGrid, (on) => {
    for (const c of block.value?.cases ?? []) {
        const e = maps.get(c.id);
        if (!e) continue;
        e.grid?.remove();
        e.grid = on ? gridFor(e.map, c).addTo(e.map) : null;
    }
});
onBeforeUnmount(() => {
    for (const e of maps.values()) e.map.remove();
});
watch(() => props.areaId, () => void load(), { immediate: true });

// ── Per-case derived facts ──
function pixelCentres(c: FieldTestCase): { spot: number; parcel: number } {
    const zone = utmZone(geometryLon(c.parcelGeometry));
    return { spot: countPixelCentres(c.spot.geometry, zone), parcel: countPixelCentres(c.parcelGeometry, zone) };
}
function lastClear(c: FieldTestCase): string | null {
    const u = c.series.optical.units.spot;
    for (let i = c.series.optical.dates.length - 1; i >= 0; i--) if (u.ndvi[i] !== null) return c.series.optical.dates[i] ?? null;
    return null;
}
function clearCount(c: FieldTestCase): number {
    return c.series.optical.units.spot.ndvi.filter((v) => v !== null).length;
}
function relative(a: Array<number | null>, b: Array<number | null>): Array<number | null> {
    return a.map((v, i) => (v === null || b[i] === null || b[i] === undefined ? null : v - (b[i] as number)));
}

// ── Sparklines: the spot and the rest of the parcel relative to the surrounding tea; claim dates marked ──
const W = 600;
const H = 72;
interface Spark {
    key: string;
    label: string;
    points: string;
    zero: number;
    min: number;
    max: number;
    marks: number[];
    bands: Array<[number, number]>;
    last: string;
}
function sparkOf(key: string, label: string, dates: string[], values: Array<number | null>, c: FieldTestCase, floor: number): Spark | null {
    const vals = values.filter((v): v is number => v !== null);
    if (vals.length < 3) return null;
    const t0 = Date.parse(c.window[0]);
    const t1 = Date.parse(c.window[1]) + 86_400_000;
    const x = (d: string) => ((Date.parse(d) - t0) / (t1 - t0)) * W;
    const min = Math.min(-floor, ...vals);
    const max = Math.max(floor, ...vals);
    const y = (v: number) => H - ((v - min) / (max - min)) * H;
    const points = dates.map((d, i) => (values[i] === null ? null : `${x(d).toFixed(1)},${y(values[i] as number).toFixed(1)}`)).filter((p): p is string => !!p).join(' ');
    const marks = c.claims.flatMap((cl) => cl.dates.map(x));
    const bands = c.claims.filter((cl) => cl.windows).map((cl): [number, number] => [x(cl.windows!.after[0]), Math.min(W, x(cl.windows!.after[1]))]);
    return { key, label, points, zero: y(0), min, max, marks, bands, last: dates.filter((_, i) => values[i] !== null).at(-1) ?? '' };
}
function sparks(c: FieldTestCase): Spark[] {
    const o = c.series.optical;
    const out: Array<Spark | null> = [
        sparkOf('spotNdvi', 'İşaretli alan − komşu çaylık · NDVI', o.dates, relative(o.units.spot.ndvi, o.units.neighbours.ndvi), c, 0.2),
        sparkOf('restNdvi', 'Parselin kalanı − komşu çaylık · NDVI (kontrol)', o.dates, relative(o.units.rest.ndvi, o.units.neighbours.ndvi), c, 0.2),
        sparkOf('spotNbr', 'İşaretli alan − komşu çaylık · NBR', o.dates, relative(o.units.spot.nbr, o.units.neighbours.nbr), c, 0.2),
    ];
    for (const p of c.series.radar) {
        out.push(sparkOf(`vh_${p.pass}`, `İşaretli alan − komşu çaylık · radar VH, ${p.pass === 'ASCENDING' ? 'yükselen' : 'alçalan'} yörünge ${p.relativeOrbit} (dB)`, p.dates, relative(p.units.spot.vh, p.units.neighbours.vh), c, 3));
    }
    return out.filter((s): s is Spark => s !== null);
}
function claimTests(cl: FieldTestClaim): Array<{ key: string; label: string } & FieldTestClaim['tests'][string]> {
    return Object.entries(cl.tests).map(([key, t]) => ({ key, label: TEST_LABEL[key] ?? key, ...t }));
}
const generatedAt = computed(() => (block.value ? fmtDate(block.value.generatedAt.slice(0, 10)) : ''));
</script>

<template>
    <div class="flex flex-col gap-6">
        <LoadingState v-if="isLoading" text="Saha testleri yükleniyor…" />
        <EmptyState v-else-if="!block" :icon="ClipboardCheck" title="Bu mahalle için saha testi yok" description="Saha gözlemi girilip motor tarafında field-test çalıştırıldığında burada görünür: uydu, işaretlenen noktayı tespit zincirinden ayrı olarak sınar." />
        <template v-else>
            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Bağımsız saha testi</CardTitle>
                    <CardDescription>
                        Sahada görülen budama, uydu tarafından o nokta için ayrıca sınanır: işaretli alanın Sentinel-2 NDVI/NBR ve Sentinel-1 VH değerleri çevresindeki çay örtüsüne göre okunur, iddia edilen tarihte basamak aranır.
                        Budama tespit zincirinden (tarama, radar, çok-sensör karar) bağımsızdır; {{ block.cases.length }} vaka · son hesap {{ generatedAt }}.
                    </CardDescription>
                </CardHeader>
            </Card>

            <Card v-for="c in block.cases" :key="c.id" class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Ada {{ c.block }} / Parsel {{ c.parcel }}</CardTitle>
                    <CardDescription>Gözlem {{ fmtDate(c.observedAt) }} · {{ c.observer }}</CardDescription>
                    <p v-if="c.note" class="text-sm text-foreground">{{ c.note }}</p>
                    <div class="flex flex-wrap items-center gap-2 pt-1">
                        <Badge v-for="cl in c.claims" :key="cl.label" :variant="toneVariant(VERDICT_META[cl.verdict].tone)">{{ cl.label }}: {{ VERDICT_META[cl.verdict].label }}</Badge>
                    </div>
                </CardHeader>
                <CardContent class="flex flex-col gap-6 border-t pt-6 pb-6">
                    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div class="flex flex-col gap-2">
                            <div class="flex items-center justify-between gap-2">
                                <span class="text-sm font-medium">İşaretli alan ve Sentinel-2 piksel ağı</span>
                                <div class="flex items-center gap-2">
                                    <Button v-if="c.pixelChange" variant="outline" size="sm" class="h-11 md:h-9" :aria-pressed="showPixels" @click="showPixels = !showPixels">{{ showPixels ? 'Piksel değişimini gizle' : 'Piksel değişimini göster' }}</Button>
                                    <Button variant="outline" size="sm" class="h-11 md:h-9" :aria-pressed="showGrid" @click="showGrid = !showGrid"><Grid3x3 aria-hidden="true" />{{ showGrid ? 'Ağı gizle' : 'Ağı göster' }}</Button>
                                </div>
                            </div>
                            <div :ref="(el) => setMapEl(c.id, el)" class="h-72 w-full overflow-hidden rounded-lg border" />
                            <p class="text-xs text-muted-foreground">
                                Beyaz çizgi parsel (TKGM), yeşil alan sahada işaretlenen yer{{ c.spot.approximate ? ' (yaklaşık: ' + c.spot.description.toLocaleLowerCase('tr-TR') + ')' : '' }}.
                                Zemin Google uydu altlığı, tarihsiz. Ağ Sentinel-2'nin gerçek 10 m pikselleridir.
                            </p>
                            <p v-if="c.pixelChange" class="text-xs text-muted-foreground">
                                Piksel değişimi: her 10 m karede göreli NDVI'nin "sonra" ortancası − "önce" ortancası ({{ fmtDate(c.pixelChange.before[0]) }}–{{ fmtDate(c.pixelChange.before[1]) }} → {{ fmtDate(c.pixelChange.after[0]) }}–{{ fmtDate(c.pixelChange.after[1]) }}), komşu çay örtüsünün kendi kayması düşülmüş.
                                <span class="inline-block size-3 rounded-sm align-middle" style="background:#7f1d1d" aria-hidden="true" /> ≤ −0,15 ·
                                <span class="inline-block size-3 rounded-sm align-middle" style="background:#b91c1c" aria-hidden="true" /> ≤ −0,10 ·
                                <span class="inline-block size-3 rounded-sm align-middle" style="background:#f97316" aria-hidden="true" /> ≤ −0,05 ·
                                <span class="inline-block size-3 rounded-sm align-middle" style="background:#fde68a" aria-hidden="true" /> ≤ −0,025 ·
                                <span class="inline-block size-3 rounded-sm align-middle" style="background:#60a5fa" aria-hidden="true" /> ≥ +0,05 · boyasız: değişim yok.
                                {{ movedPixels(c) }} kare −0,05'in altına düştü. Kareye gelince sayılar görünür.
                            </p>
                        </div>
                        <div class="grid gap-3 sm:grid-cols-2">
                            <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">İşaretli alan</div><div class="font-semibold tabular-nums">{{ formatM2(c.spot.areaM2) }}</div><div class="text-xs text-muted-foreground">≈ {{ pixelCentres(c).spot }} piksel merkezi içeride · {{ c.pixels.spot }} piksele değiyor</div></div>
                            <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Parsel</div><div class="font-semibold tabular-nums">{{ c.deedAreaM2 ? formatM2(c.deedAreaM2) : '—' }}</div><div class="text-xs text-muted-foreground">tapu alanı · {{ pixelCentres(c).parcel }} piksel</div></div>
                            <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Referans çay örtüsü</div><div class="font-semibold tabular-nums">{{ c.pixels.neighbours }} piksel</div><div class="text-xs text-muted-foreground">parselin 300 m çevresi, parsel hariç</div></div>
                            <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Veri penceresi</div><div class="font-semibold tabular-nums">{{ fmtDate(c.window[0]) }} → {{ fmtDate(c.window[1]) }}</div><div class="text-xs text-muted-foreground">{{ clearCount(c) }} temiz optik gözlem · son {{ fmtDate(lastClear(c)) }}</div></div>
                            <div v-for="p in c.series.radar" :key="p.pass" class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Radar, {{ p.pass === 'ASCENDING' ? 'yükselen' : 'alçalan' }} yörünge {{ p.relativeOrbit }}</div><div class="font-semibold tabular-nums">{{ p.dates.length }} geçiş</div><div class="text-xs text-muted-foreground">son {{ fmtDate(p.dates.at(-1)) }}</div></div>
                        </div>
                    </div>

                    <section class="flex flex-col gap-2">
                        <h3 class="text-base font-semibold">İddialar ve uydu testi</h3>
                        <div v-for="cl in c.claims" :key="cl.label" class="flex flex-col gap-2 rounded-lg border bg-card p-3">
                            <div class="flex flex-wrap items-center gap-2">
                                <Badge :variant="toneVariant(VERDICT_META[cl.verdict].tone)">{{ VERDICT_META[cl.verdict].label }}</Badge>
                                <span class="font-medium">{{ cl.label }}</span>
                                <span v-if="cl.windows" class="text-xs text-muted-foreground">önce {{ fmtDate(cl.windows.before[0]) }}–{{ fmtDate(cl.windows.before[1]) }} · sonra {{ fmtDate(cl.windows.after[0]) }}–{{ fmtDate(cl.windows.after[1]) }}</span>
                            </div>
                            <p class="text-sm">{{ cl.reason }}</p>
                            <div v-if="Object.keys(cl.tests).length" class="overflow-hidden rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Seri</TableHead>
                                            <TableHead class="text-right">Önce / sonra</TableHead>
                                            <TableHead class="text-right">Basamak</TableHead>
                                            <TableHead class="text-right">Gürültü</TableHead>
                                            <TableHead class="text-right">z</TableHead>
                                            <TableHead class="text-right">Gözlem</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow v-for="t in claimTests(cl)" :key="t.key">
                                            <TableCell class="text-sm">{{ t.label }}</TableCell>
                                            <TableCell class="text-right text-xs tabular-nums">{{ fmtNum(t.meanBefore) }} / {{ fmtNum(t.meanAfter) }}</TableCell>
                                            <TableCell class="text-right text-xs tabular-nums font-semibold">{{ fmtNum(t.delta) }}</TableCell>
                                            <TableCell class="text-right text-xs tabular-nums">±{{ fmtNum(t.sdBefore) }}</TableCell>
                                            <TableCell class="text-right text-xs tabular-nums">{{ fmtNum(t.z, 1) }}</TableCell>
                                            <TableCell class="text-right text-xs tabular-nums">{{ t.nBefore }} / {{ t.nAfter }}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                        <p class="text-xs text-muted-foreground">
                            Basamak: sonra − önce ortalaması; budamada NDVI/NBR/VH düşer. z: basamak / (önce-dönem gürültüsü · √(1/n_önce + 1/n_sonra)).
                            Eşikler: göreli NDVI düşüşü {{ c.spot.areaM2 <= block.rules.smallUnitAreaM2 ? block.rules.ndviDropSmall : block.rules.ndviDrop }}{{ c.spot.areaM2 <= block.rules.smallUnitAreaM2 ? ' (küçük alan)' : '' }} ve z {{ block.rules.zStep }}; en az {{ block.rules.minObs }} gözlem sonrası, kesin karar için {{ block.rules.minObsFirm }}.
                        </p>
                    </section>

                    <section class="flex flex-col gap-3">
                        <h3 class="text-base font-semibold">Seriler (komşu çay örtüsüne göreli)</h3>
                        <div v-for="s in sparks(c)" :key="s.key" class="flex flex-col gap-1">
                            <span class="text-[11px] text-muted-foreground">{{ s.label }} · {{ s.min.toFixed(2) }}…{{ s.max.toFixed(2) }} · son {{ fmtDate(s.last) }}</span>
                            <svg :viewBox="`0 0 ${W} ${H}`" class="h-16 w-full" role="img" :aria-label="s.label">
                                <rect v-for="(b, i) in s.bands" :key="i" :x="b[0]" y="0" :width="Math.max(2, b[1] - b[0])" :height="H" class="fill-destructive/10" />
                                <line x1="0" :y1="s.zero" :x2="W" :y2="s.zero" class="stroke-muted-foreground/40" stroke-width="1" stroke-dasharray="3 3" />
                                <line v-for="(m, i) in s.marks" :key="`m${i}`" :x1="m" y1="0" :x2="m" :y2="H" class="stroke-destructive" stroke-width="1" />
                                <polyline :points="s.points" fill="none" :class="s.key.startsWith('vh') ? 'stroke-info' : 'stroke-primary'" stroke-width="1.5" stroke-linejoin="round" />
                            </svg>
                        </div>
                        <div class="flex justify-between text-[11px] text-muted-foreground"><span>{{ fmtDate(c.window[0]) }}</span><span>kırmızı çizgi: iddia tarihi · gölge: sonra penceresi</span><span>{{ fmtDate(c.window[1]) }}</span></div>
                    </section>
                </CardContent>
            </Card>
        </template>
    </div>
</template>
