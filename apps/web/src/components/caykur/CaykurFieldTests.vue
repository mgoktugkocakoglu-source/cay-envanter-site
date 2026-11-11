<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { ClipboardCheck, Eye, EyeOff, FileText, Grid3x3, ScanSearch } from '@lucide/vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EmptyState, LoadingState } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toneVariant, type Tone } from '@/components/caykur/tone';
import { useToast } from '@/composables/useToast';
import {
    api,
    saveBlob,
    type FieldTestCase,
    type FieldTestCluster,
    type FieldTestConfidence,
    type FieldTestMatch,
    type FieldTestPass,
    type FieldTestPixel,
    type FieldTestVerdict,
    type FieldTestsBlock,
    type InventoryMap,
} from '@/services/api';
import { formatM2 } from '@/services/caykur/teaInventory';
import { geometryLon, pixelGridLines, utmZone } from '@/services/caykur/sentinelGrid';

/**
 * Blind field tests (Saha testi): the satellite gets only a parcel and the day the field says it was
 * cut. It lays its own 10 m lattice over the parcel, reads every pixel against the surrounding tea
 * cover (Sentinel-2 NDVI/NBR, Sentinel-1 VH/VV), delineates the changed pixels, sizes the cut and
 * brackets its date from its own scenes — and only then is the result compared with what the field
 * marked. Computed apart from the pruning detection chain.
 */
const props = defineProps<{ areaId: string; mapData: InventoryMap }>();

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const VERDICT_META: Record<FieldTestVerdict, { label: string; tone: Tone }> = {
    detected: { label: 'Uydu kesimi tespit etti', tone: 'success' },
    not_detected: { label: 'Uydu kesim görmedi', tone: 'danger' },
    pending: { label: 'Gözlem bekleniyor', tone: 'muted' },
};
const MATCH_META: Record<FieldTestMatch, { label: string; tone: Tone }> = {
    match: { label: 'Saha ile örtüşüyor', tone: 'success' },
    partial: { label: 'Kısmi örtüşme', tone: 'warning' },
    miss: { label: 'Saha ile örtüşmüyor', tone: 'danger' },
    no_detection: { label: 'Kıyaslanacak tespit yok', tone: 'muted' },
};
const CONF_META: Record<FieldTestConfidence, { label: string; tone: Tone; color: string }> = {
    high: { label: 'yüksek', tone: 'success', color: '#15803d' },
    medium: { label: 'orta', tone: 'warning', color: '#b45309' },
    low: { label: 'düşük', tone: 'muted', color: '#64748b' },
};
const PASS_LABEL: Record<FieldTestPass, string> = { ASCENDING: 'çıkış yörüngesi', DESCENDING: 'iniş yörüngesi' };

const toast = useToast();
const block = ref<FieldTestsBlock | null>(null);
const isLoading = ref(true);
const showGrid = ref(true);
const showGroundTruth = ref(false);
const pdfBusy = ref<string | null>(null);
const mapEls = new Map<string, HTMLElement>();
interface MapEntry {
    map: L.Map;
    grid: L.LayerGroup | null;
    truth: L.LayerGroup | null;
}
const maps = new Map<string, MapEntry>();

function fmtDate(d: string | null | undefined): string {
    if (!d) return '—';
    return `${Number(d.slice(8, 10))} ${MONTHS_TR[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
}
const fmtNum = (v: number | null | undefined, digits = 2) => (v === null || v === undefined ? '—' : v.toFixed(digits));
const signed = (v: number | null | undefined, digits = 3) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(digits)}`);

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
    for (const c of res.data.cases) {
        renderMap(c);
        renderUndatedMap(c);
    }
}

function setMapEl(id: string, el: unknown): void {
    if (el instanceof HTMLElement) mapEls.set(id, el);
}

/** Colour of a pixel's relative NDVI change (deep pruning: strong drop; debris-covered rows: weaker). */
function deltaColor(d: number | null): string | null {
    if (d === null) return null;
    if (d <= -0.15) return '#7f1d1d';
    if (d <= -0.1) return '#b91c1c';
    if (d <= -0.05) return '#f97316';
    if (d <= -0.025) return '#fde68a';
    if (d >= 0.05) return '#60a5fa';
    return null;
}

function pixelTooltip(p: FieldTestPixel): string {
    const t = p.optical.ndvi;
    const vh = (pass: FieldTestPass) => (p.radar[pass] ? signed(p.radar[pass]!.vh.delta, 2) : '—');
    return `${p.flagged ? (p.strong ? 'Budanmış (güçlü)' : 'Budanmış') : 'Değişim yok'} · göreli NDVI ${signed(t.delta)} (z ${fmtNum(t.z, 1)}, ${t.nBefore}/${t.nAfter} gözlem) · NDVI önce ${fmtNum(p.optical.ndviBeforeAbs)}${p.fraction !== null ? ` · pay %${Math.round(p.fraction * 100)} ≈ ${p.prunedM2} m²` : ''} · VH çıkış ${vh('ASCENDING')} / iniş ${vh('DESCENDING')} dB · parsel içi ${p.insideM2} m²${p.edgeNonTea ? ' · sınır (dışı çay değil)' : ''}`;
}

/** The parcel on a satellite base, every lattice pixel coloured by its change, the detected ones outlined, clusters labelled. */
function renderMap(c: FieldTestCase): void {
    const el = mapEls.get(c.id);
    if (!el) return;
    maps.get(c.id)?.map.remove();
    const map = L.map(el, { zoomControl: false, attributionControl: false, scrollWheelZoom: false, dragging: false });
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20, maxNativeZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }).addTo(map);
    L.geoJSON(props.mapData, { style: { color: '#ffffff', weight: 0.7, opacity: 0.5, fill: false }, interactive: false }).addTo(map);
    for (const p of c.pixels) {
        const color = deltaColor(p.optical.ndvi.delta);
        const poly = L.geoJSON({ type: 'Feature', geometry: p.geometry, properties: {} } as GeoJSON.Feature, {
            style: { color: p.flagged ? '#0f172a' : '#e2e8f0', weight: p.flagged ? 2.2 : 0.5, opacity: p.flagged ? 1 : 0.6, fillColor: color ?? '#000000', fillOpacity: color ? 0.6 : 0 },
            interactive: true,
        }).addTo(map);
        poly.bindTooltip(pixelTooltip(p), { sticky: true });
    }
    const parcel = L.geoJSON({ type: 'Feature', geometry: c.parcelGeometry, properties: {} } as GeoJSON.Feature, { style: { color: '#ffffff', weight: 2.5, fill: false }, interactive: false }).addTo(map);
    for (const k of c.clusters) {
        L.marker([k.centroid[1], k.centroid[0]], {
            interactive: false,
            icon: L.divIcon({ className: '', html: `<span style="display:inline-block;min-width:22px;padding:1px 5px;border-radius:999px;background:${CONF_META[k.confidence].color};color:#fff;font:600 11px Inter,sans-serif;text-align:center;box-shadow:0 0 0 1px #fff">K${k.index + 1}</span>`, iconSize: [24, 16], iconAnchor: [12, 8] }),
        }).addTo(map);
    }
    map.fitBounds(parcel.getBounds().pad(0.45), { maxZoom: 19 });
    const entry: MapEntry = { map, grid: null, truth: null };
    maps.set(c.id, entry);
    if (showGrid.value) entry.grid = gridFor(map, c).addTo(map);
    if (showGroundTruth.value) entry.truth = truthLayer(c)?.addTo(map) ?? null;
}
/** The undated scan's own map: same lattice, coloured by the step at the date the scan chose by itself. */
const undatedKey = (c: FieldTestCase) => `${c.id}:undated`;
function renderUndatedMap(c: FieldTestCase): void {
    const u = c.undated;
    const el = mapEls.get(undatedKey(c));
    if (!u || !el) return;
    maps.get(undatedKey(c))?.map.remove();
    const map = L.map(el, { zoomControl: false, attributionControl: false, scrollWheelZoom: false, dragging: false });
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20, maxNativeZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }).addTo(map);
    L.geoJSON(props.mapData, { style: { color: '#ffffff', weight: 0.7, opacity: 0.5, fill: false }, interactive: false }).addTo(map);
    const geometryOf = new Map(c.pixels.map((p) => [p.id, p.geometry]));
    for (const p of u.pixels) {
        const geometry = geometryOf.get(p.id);
        if (!geometry) continue;
        const color = deltaColor(p.delta);
        L.geoJSON({ type: 'Feature', geometry, properties: {} } as GeoJSON.Feature, {
            style: { color: p.flagged ? '#0f172a' : '#e2e8f0', weight: p.flagged ? 2.2 : 0.5, opacity: p.flagged ? 1 : 0.6, fillColor: color ?? '#000000', fillOpacity: color ? 0.6 : 0 },
            interactive: true,
        })
            .addTo(map)
            .bindTooltip(`${p.flagged ? (p.strong ? 'Budanmış (güçlü)' : 'Budanmış') : 'Değişim yok'} · göreli NDVI ${signed(p.delta)} (z ${fmtNum(p.z, 1)}, ${p.nBefore}/${p.nAfter} gözlem)${p.fraction !== null ? ` · pay %${Math.round(p.fraction * 100)} ≈ ${p.prunedM2} m²` : ''}`, { sticky: true });
    }
    const parcel = L.geoJSON({ type: 'Feature', geometry: c.parcelGeometry, properties: {} } as GeoJSON.Feature, { style: { color: '#ffffff', weight: 2.5, fill: false }, interactive: false }).addTo(map);
    for (const k of u.clusters) {
        L.marker([k.centroid[1], k.centroid[0]], {
            interactive: false,
            icon: L.divIcon({ className: '', html: `<span style="display:inline-block;min-width:22px;padding:1px 5px;border-radius:999px;background:${CONF_META[k.confidence].color};color:#fff;font:600 11px Inter,sans-serif;text-align:center;box-shadow:0 0 0 1px #fff">T${k.index + 1}</span>`, iconSize: [24, 16], iconAnchor: [12, 8] }),
        }).addTo(map);
    }
    map.fitBounds(parcel.getBounds().pad(0.45), { maxZoom: 19 });
    const entry: MapEntry = { map, grid: null, truth: null };
    maps.set(undatedKey(c), entry);
    if (showGrid.value) entry.grid = gridFor(map, c).addTo(map);
    if (showGroundTruth.value) entry.truth = truthLayer(c)?.addTo(map) ?? null;
}
function gridFor(map: L.Map, c: FieldTestCase): L.LayerGroup {
    const b = map.getBounds().pad(0.2);
    const lines = pixelGridLines({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }, utmZone(geometryLon(c.parcelGeometry)));
    return L.layerGroup(lines.map((pts) => L.polyline(pts, { color: '#ffffff', weight: 0.6, opacity: 0.45, interactive: false })));
}
function truthLayer(c: FieldTestCase): L.LayerGroup | null {
    if (!c.groundTruth) return null;
    return L.layerGroup([L.geoJSON({ type: 'Feature', geometry: c.groundTruth.geometry, properties: {} } as GeoJSON.Feature, { style: { color: '#4ade80', weight: 3, dashArray: '6 4', fill: false }, interactive: false })]);
}
watch(showGrid, (on) => {
    for (const c of block.value?.cases ?? []) {
        for (const key of [c.id, undatedKey(c)]) {
            const e = maps.get(key);
            if (!e) continue;
            e.grid?.remove();
            e.grid = on ? gridFor(e.map, c).addTo(e.map) : null;
        }
    }
});
watch(showGroundTruth, (on) => {
    for (const c of block.value?.cases ?? []) {
        for (const key of [c.id, undatedKey(c)]) {
            const e = maps.get(key);
            if (!e) continue;
            e.truth?.remove();
            e.truth = on ? truthLayer(c)?.addTo(e.map) ?? null : null;
        }
    }
});
onBeforeUnmount(() => {
    for (const e of maps.values()) e.map.remove();
});
watch(() => props.areaId, () => void load(), { immediate: true });

async function downloadReport(c: FieldTestCase): Promise<void> {
    pdfBusy.value = c.id;
    try {
        const res = await api.downloadFieldTestReport(props.areaId, c.id);
        if (!res.blob) {
            toast.error(res.error ?? 'Rapor üretilemedi');
            return;
        }
        saveBlob(res.blob, res.filename ?? `saha-testi-${c.block}-${c.parcel}.pdf`);
    } finally {
        pdfBusy.value = null;
    }
}

// ── Derived views ──
function mainCluster(c: FieldTestCase): FieldTestCluster | null {
    return c.detection.mainCluster === null ? null : (c.clusters[c.detection.mainCluster] ?? null);
}
function flaggedPixels(c: FieldTestCase): FieldTestPixel[] {
    return c.pixels.filter((p) => p.flagged).sort((a, b) => (a.cluster ?? 0) - (b.cluster ?? 0) || (a.optical.ndvi.delta ?? 0) - (b.optical.ndvi.delta ?? 0));
}
function lastClear(c: FieldTestCase): string | null {
    const o = c.series.optical;
    for (let i = o.dates.length - 1; i >= 0; i--) if (o.neighbours[i] !== null) return o.dates[i] ?? null;
    return null;
}
function radarCell(k: FieldTestCluster, pass: FieldTestPass): string {
    const t = k.radar[pass];
    return t ? `${signed(t.vh.delta, 2)} dB (z ${fmtNum(t.vh.z, 1)})` : '—';
}

// ── Sparklines: detected cluster vs the rest of the parcel, the field date marked, the "after" window shaded ──
const W = 600;
const H = 72;
interface Spark {
    key: string;
    label: string;
    lines: Array<{ points: string; cls: string }>;
    zero: number;
    min: number;
    max: number;
    mark: number;
    band: [number, number];
}
function sparkOf(key: string, label: string, dates: string[], rows: Array<{ values: Array<number | null>; cls: string }>, c: FieldTestCase, floor: number): Spark | null {
    const all = rows.flatMap((r) => r.values).filter((v): v is number => v !== null);
    if (all.length < 3) return null;
    const t0 = Date.parse(c.window[0]);
    const t1 = Date.parse(c.window[1]) + 86_400_000;
    const x = (d: string) => ((Date.parse(d) - t0) / (t1 - t0)) * W;
    const min = Math.min(-floor, ...all);
    const max = Math.max(floor, ...all);
    const y = (v: number) => H - ((v - min) / (max - min)) * H;
    const lines = rows.map((r) => ({ cls: r.cls, points: dates.map((d, i) => (r.values[i] === null || r.values[i] === undefined ? null : `${x(d).toFixed(1)},${y(r.values[i] as number).toFixed(1)}`)).filter((p): p is string => !!p).join(' ') }));
    return { key, label, lines, zero: y(0), min, max, mark: x(c.prunedAt), band: [x(c.windows.after[0]), Math.min(W, x(c.windows.after[1]))] };
}
function sparks(c: FieldTestCase): Spark[] {
    const o = c.series.optical;
    const main = c.detection.mainCluster;
    const out: Array<Spark | null> = [];
    const optRows = [{ values: o.rest, cls: 'stroke-muted-foreground' }, { values: o.parcel, cls: 'stroke-info' }];
    if (main !== null && o.clusters[String(main)]) optRows.unshift({ values: o.clusters[String(main)] as Array<number | null>, cls: 'stroke-destructive' });
    out.push(sparkOf('ndvi', `Sentinel-2 NDVI, göreli · ${main !== null ? `kırmızı K${main + 1} (tespit), ` : ''}gri parselin kalanı, mavi parsel`, o.dates, optRows, c, 0.2));
    for (const p of c.series.radar) {
        const rows = [{ values: p.rest, cls: 'stroke-muted-foreground' }];
        if (main !== null && p.clusters[String(main)]) rows.unshift({ values: p.clusters[String(main)] as Array<number | null>, cls: 'stroke-destructive' });
        out.push(sparkOf(`vh_${p.pass}`, `Sentinel-1 VH (dB), göreli · ${PASS_LABEL[p.pass]} ${p.relativeOrbit} · ${main !== null ? `kırmızı K${main + 1}, ` : ''}gri parselin kalanı`, p.dates, rows, c, 3));
    }
    return out.filter((s): s is Spark => s !== null);
}
const generatedAt = computed(() => (block.value ? fmtDate(block.value.generatedAt.slice(0, 10)) : ''));
</script>

<template>
    <div class="flex flex-col gap-6">
        <LoadingState v-if="isLoading" text="Saha testleri yükleniyor…" />
        <EmptyState v-else-if="!block" :icon="ClipboardCheck" title="Bu mahalle için saha testi yok" description="Bir parsel ve kesim tarihi girilip motor tarafında field-test çalıştırıldığında burada görünür: uydu budanan yeri kendisi çizer, sonuç saha bilgisiyle kıyaslanır." />
        <template v-else>
            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Kör saha testi</CardTitle>
                    <CardDescription>
                        Uyduya yalnız ada/parsel ve sahadan bildirilen kesim tarihi verilir. Parselin üzerine Sentinel-2'nin 10 m piksel ağı serilir; her piksel çevresindeki çay örtüsüne göre okunur (NDVI/NBR ve Sentinel-1 VH/VV), tarihten önce/sonra basamak aranır,
                        değişen pikseller kümelenir, budanan alan hesaplanır ve değişim tarihi uydunun kendi sahnelerinden daraltılır. Sahada işaretlenen yer tespite verilmez, yalnız sonunda kıyaslanır. {{ block.cases.length }} vaka · son hesap {{ generatedAt }}.
                    </CardDescription>
                </CardHeader>
            </Card>

            <template v-for="c in block.cases" :key="c.id">
            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Ada {{ c.block }} / Parsel {{ c.parcel }} · tarihli kör test</CardTitle>
                    <CardDescription>Saha bilgisi: {{ fmtDate(c.prunedAt) }} tarihinde kesim · {{ c.source }}</CardDescription>
                    <div class="flex flex-wrap items-center gap-2 pt-1">
                        <Badge :variant="toneVariant(VERDICT_META[c.detection.verdict].tone)">{{ VERDICT_META[c.detection.verdict].label }}</Badge>
                        <Badge v-if="c.groundTruth" :variant="toneVariant(MATCH_META[c.groundTruth.comparison.verdict].tone)">{{ MATCH_META[c.groundTruth.comparison.verdict].label }}</Badge>
                        <Badge v-if="mainCluster(c)" variant="outline">Güven {{ CONF_META[mainCluster(c)!.confidence].label }}</Badge>
                    </div>
                    <div class="flex flex-wrap gap-2 pt-2">
                        <Button variant="outline" size="sm" class="h-11 md:h-9" :disabled="pdfBusy === c.id" @click="downloadReport(c)"><FileText aria-hidden="true" />Rapor (PDF)</Button>
                    </div>
                </CardHeader>
                <CardContent class="flex flex-col gap-6 border-t pt-6 pb-6">
                    <section class="flex flex-col gap-2 rounded-lg border bg-card p-4">
                        <h3 class="text-base font-semibold">Sonuç</h3>
                        <p v-for="(line, i) in c.detection.summary" :key="i" :class="i === 0 ? 'text-base font-medium text-foreground' : 'text-sm text-muted-foreground'">{{ line }}</p>
                    </section>

                    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Tespit edilen alan</div><div class="font-semibold tabular-nums">{{ c.detection.verdict === 'detected' ? formatM2(c.detection.prunedM2) : '—' }}</div><div class="text-xs text-muted-foreground">{{ c.detection.verdict === 'detected' ? `aralık ${c.detection.prunedRange[0]}–${c.detection.prunedRange[1]} m² · parselin %${Math.round(c.detection.shareOfParcel * 100)}'i` : 'kesim büyüklüğünde değişim yok' }}</div></div>
                        <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Uydunun gördüğü değişim aralığı</div><div class="font-semibold tabular-nums">{{ c.detection.dateBracket?.lastBefore ? `${fmtDate(c.detection.dateBracket.lastBefore)} – ${fmtDate(c.detection.dateBracket.firstAfter)}` : '—' }}</div><div class="text-xs text-muted-foreground">saha tarihi {{ fmtDate(c.prunedAt) }}{{ c.detection.dateBracket?.containsPrunedAt === true ? ' · aralıkta' : c.detection.dateBracket?.containsPrunedAt === false ? ' · aralığın dışında' : '' }}</div></div>
                        <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Konum</div><div class="font-semibold">{{ mainCluster(c) ? `parselin ${mainCluster(c)!.position}` : '—' }}</div><div class="text-xs text-muted-foreground">{{ mainCluster(c) ? `${mainCluster(c)!.pixelIds.length} piksel · NDVI ${signed(mainCluster(c)!.meanDelta)} · z ${fmtNum(mainCluster(c)!.maxZ, 1)}` : '' }}</div></div>
                        <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Veri</div><div class="font-semibold tabular-nums">{{ fmtDate(c.window[0]) }} → {{ fmtDate(c.window[1]) }}</div><div class="text-xs text-muted-foreground">son temiz optik {{ fmtDate(lastClear(c)) }} · radar {{ c.series.radar.map((p) => `${p.dates.length} ${PASS_LABEL[p.pass].split(' ')[0]}`).join(' / ') }} geçiş{{ c.excludedDates.length ? ` · ${c.excludedDates.length} tarih dışlandı` : '' }}</div></div>
                    </div>

                    <section class="flex flex-col gap-2">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <h3 class="text-base font-semibold">Uydunun çizdiği alan</h3>
                            <div class="flex flex-wrap items-center gap-2">
                                <Button v-if="c.groundTruth" variant="outline" size="sm" class="h-11 md:h-9" :aria-pressed="showGroundTruth" @click="showGroundTruth = !showGroundTruth">
                                    <component :is="showGroundTruth ? EyeOff : Eye" aria-hidden="true" />{{ showGroundTruth ? 'Saha işaretini gizle' : 'Saha işaretini göster' }}
                                </Button>
                                <Button variant="outline" size="sm" class="h-11 md:h-9" :aria-pressed="showGrid" @click="showGrid = !showGrid"><Grid3x3 aria-hidden="true" />{{ showGrid ? 'Ağı gizle' : 'Ağı göster' }}</Button>
                            </div>
                        </div>
                        <div :ref="(el) => setMapEl(c.id, el)" class="h-80 w-full overflow-hidden rounded-lg border" />
                        <p class="text-xs text-muted-foreground">
                            Kareler Sentinel-2'nin gerçek 10 m pikselleri; renk, kesim tarihinden önce/sonra komşu çay örtüsüne göreli NDVI değişimi
                            (<span class="inline-block size-3 rounded-sm align-middle" style="background:#7f1d1d" aria-hidden="true" /> ≤ −0,15 ·
                            <span class="inline-block size-3 rounded-sm align-middle" style="background:#b91c1c" aria-hidden="true" /> ≤ −0,10 ·
                            <span class="inline-block size-3 rounded-sm align-middle" style="background:#f97316" aria-hidden="true" /> ≤ −0,05 ·
                            <span class="inline-block size-3 rounded-sm align-middle" style="background:#fde68a" aria-hidden="true" /> ≤ −0,025 ·
                            <span class="inline-block size-3 rounded-sm align-middle" style="background:#60a5fa" aria-hidden="true" /> ≥ +0,05 · boyasız: değişim yok).
                            Koyu çerçeve: uydunun budanmış saydığı pikseller; K1, K2…: kümeler. Beyaz çizgi parsel (TKGM). Yeşil kesikli çizgi sahada işaretlenen yer: tespite verilmedi, yalnız kıyas için. Zemin Google uydu altlığı, tarihsiz. Kareye gelince sayılar görünür.
                        </p>
                    </section>

                    <section v-if="c.groundTruth" class="flex flex-col gap-2 rounded-lg border bg-card p-4">
                        <div class="flex flex-wrap items-center gap-2">
                            <h3 class="text-base font-semibold">Saha gerçeğiyle kıyas</h3>
                            <Badge :variant="toneVariant(MATCH_META[c.groundTruth.comparison.verdict].tone)">{{ MATCH_META[c.groundTruth.comparison.verdict].label }}</Badge>
                        </div>
                        <p class="text-sm">{{ c.groundTruth.comparison.text }}</p>
                        <p class="text-xs text-muted-foreground">
                            İşaretli alan {{ formatM2(c.groundTruth.areaM2) }}{{ c.groundTruth.approximate ? ' (yaklaşık)' : '' }} · tespit (tam piksel) {{ formatM2(c.groundTruth.comparison.detectedM2) }} · örtüşme {{ formatM2(c.groundTruth.comparison.overlapM2) }}
                            · merkezler arası {{ c.groundTruth.comparison.centroidDistanceM ?? '—' }} m{{ c.groundTruth.note ? ` · ${c.groundTruth.note}` : '' }}.
                            Saha işareti tespit hesabına girmez; örtüşme bir doğrulama ölçüsüdür.
                        </p>
                    </section>

                    <section v-if="c.clusters.length" class="flex flex-col gap-2">
                        <h3 class="text-base font-semibold">Tespit edilen kümeler</h3>
                        <div class="overflow-x-auto rounded-lg border bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Küme</TableHead>
                                        <TableHead>Konum</TableHead>
                                        <TableHead class="text-right">Piksel</TableHead>
                                        <TableHead class="text-right">Tahmini alan</TableHead>
                                        <TableHead class="text-right">Üst sınır</TableHead>
                                        <TableHead class="text-right">NDVI Δ / z</TableHead>
                                        <TableHead>Değişim aralığı</TableHead>
                                        <TableHead class="text-right">VH çıkış</TableHead>
                                        <TableHead class="text-right">VH iniş</TableHead>
                                        <TableHead>Güven</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow v-for="k in c.clusters" :key="k.index">
                                        <TableCell class="font-medium">K{{ k.index + 1 }}</TableCell>
                                        <TableCell class="text-sm">parselin {{ k.position }}</TableCell>
                                        <TableCell class="text-right text-xs tabular-nums">{{ k.pixelIds.length }}</TableCell>
                                        <TableCell class="text-right text-xs tabular-nums font-semibold">{{ k.areaM2 }} m² <span class="font-normal text-muted-foreground">({{ k.areaRange[0] }}–{{ k.areaRange[1] }})</span></TableCell>
                                        <TableCell class="text-right text-xs tabular-nums">{{ k.areaUpperM2 }} m²</TableCell>
                                        <TableCell class="text-right text-xs tabular-nums">{{ signed(k.meanDelta) }} / {{ fmtNum(k.maxZ, 1) }}</TableCell>
                                        <TableCell class="text-xs">{{ k.dateBracket.lastBefore ? `${fmtDate(k.dateBracket.lastBefore)} – ${fmtDate(k.dateBracket.firstAfter)}` : '—' }}<span v-if="k.dateBracket.containsPrunedAt === false" class="text-warning"> (saha tarihi dışında)</span></TableCell>
                                        <TableCell class="text-right text-xs tabular-nums">{{ radarCell(k, 'ASCENDING') }}</TableCell>
                                        <TableCell class="text-right text-xs tabular-nums">{{ radarCell(k, 'DESCENDING') }}</TableCell>
                                        <TableCell><Badge :variant="toneVariant(CONF_META[k.confidence].tone)">{{ CONF_META[k.confidence].label }}</Badge></TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                        <p v-for="k in c.clusters.filter((x) => x.note)" :key="`n${k.index}`" class="text-xs text-muted-foreground">K{{ k.index + 1 }}: {{ k.note }}.</p>
                    </section>

                    <section v-if="flaggedPixels(c).length" class="flex flex-col gap-2">
                        <h3 class="text-base font-semibold">Budanmış sayılan pikseller</h3>
                        <div class="overflow-x-auto rounded-lg border bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Piksel (UTM E / N)</TableHead>
                                        <TableHead>Küme</TableHead>
                                        <TableHead class="text-right">Parsel içi</TableHead>
                                        <TableHead class="text-right">NDVI önce</TableHead>
                                        <TableHead class="text-right">Göreli Δ</TableHead>
                                        <TableHead class="text-right">z</TableHead>
                                        <TableHead class="text-right">Gözlem</TableHead>
                                        <TableHead class="text-right">Pay</TableHead>
                                        <TableHead class="text-right">Alan</TableHead>
                                        <TableHead class="text-right">VH çıkış / iniş</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow v-for="p in flaggedPixels(c)" :key="p.id">
                                        <TableCell class="text-xs tabular-nums">{{ p.e }} / {{ p.n }}{{ p.edgeNonTea ? ' · sınır' : '' }}</TableCell>
                                        <TableCell class="text-xs">{{ p.cluster === null ? '—' : `K${p.cluster + 1}` }}</TableCell>
                                        <TableCell class="text-right text-xs tabular-nums">{{ p.insideM2 }} m²</TableCell>
                                        <TableCell class="text-right text-xs tabular-nums">{{ fmtNum(p.optical.ndviBeforeAbs) }}</TableCell>
                                        <TableCell class="text-right text-xs tabular-nums" :class="p.strong ? 'font-semibold' : ''">{{ signed(p.optical.ndvi.delta) }}</TableCell>
                                        <TableCell class="text-right text-xs tabular-nums">{{ fmtNum(p.optical.ndvi.z, 1) }}</TableCell>
                                        <TableCell class="text-right text-xs tabular-nums">{{ p.optical.ndvi.nBefore }} / {{ p.optical.ndvi.nAfter }}</TableCell>
                                        <TableCell class="text-right text-xs tabular-nums">{{ p.fraction === null ? '—' : `%${Math.round(p.fraction * 100)}` }}</TableCell>
                                        <TableCell class="text-right text-xs tabular-nums">{{ p.prunedM2 === null ? '—' : `${p.prunedM2} m²` }}</TableCell>
                                        <TableCell class="text-right text-xs tabular-nums">{{ p.radar.ASCENDING ? signed(p.radar.ASCENDING.vh.delta, 2) : '—' }} / {{ p.radar.DESCENDING ? signed(p.radar.DESCENDING.vh.delta, 2) : '—' }}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                        <p class="text-xs text-muted-foreground">
                            Göreli Δ: kesim sonrası − öncesi ortalaması (piksel − komşu çay örtüsü); z: basamak / (öncesi gürültü · √(1/n_önce + 1/n_sonra)). Pay: −Δ / (NDVI_önce − {{ c.calibration?.ndviPruned ?? block.rules.ndviPruned }}); alan = pay × parsel içi m².{{ c.calibration ? ` ${c.calibration.note}` : '' }}
                            Eşik: düşüş ≥ {{ block.rules.pixelDrop }} ve z ≥ {{ block.rules.pixelZ }}; ≥ {{ block.rules.pixelDropStrong }} güçlü.
                        </p>
                    </section>

                    <section class="flex flex-col gap-3">
                        <h3 class="text-base font-semibold">Seriler (komşu çay örtüsüne göreli)</h3>
                        <div v-for="s in sparks(c)" :key="s.key" class="flex flex-col gap-1">
                            <span class="text-[11px] text-muted-foreground">{{ s.label }} · {{ s.min.toFixed(2) }}…{{ s.max.toFixed(2) }}</span>
                            <svg :viewBox="`0 0 ${W} ${H}`" class="h-16 w-full" role="img" :aria-label="s.label">
                                <rect :x="s.band[0]" y="0" :width="Math.max(2, s.band[1] - s.band[0])" :height="H" class="fill-destructive/10" />
                                <line x1="0" :y1="s.zero" :x2="W" :y2="s.zero" class="stroke-muted-foreground/40" stroke-width="1" stroke-dasharray="3 3" />
                                <line :x1="s.mark" y1="0" :x2="s.mark" :y2="H" class="stroke-destructive" stroke-width="1" />
                                <polyline v-for="(l, i) in s.lines" :key="i" :points="l.points" fill="none" :class="l.cls" stroke-width="1.5" stroke-linejoin="round" />
                            </svg>
                        </div>
                        <div class="flex justify-between text-[11px] text-muted-foreground"><span>{{ fmtDate(c.window[0]) }}</span><span>kırmızı çizgi: saha tarihi · gölge: sonra penceresi</span><span>{{ fmtDate(c.window[1]) }}</span></div>
                    </section>

                    <p class="text-xs text-muted-foreground">
                        {{ block.method }} Dışlanan optik tarihler (referans NDVI &lt; {{ block.rules.collapseNdvi }}: kar/don/gölge): {{ c.excludedDates.length ? c.excludedDates.map((d) => fmtDate(d)).join(', ') : 'yok' }}.
                        Sınırlar: 10 m piksel; parsel sınırındaki piksellerde komşu örtü karışır; kesimden hemen sonra yerde kalan yeşil artıklar NDVI düşüşünü birkaç gün geciktirir; radar tek piksel ölçeğinde gürültülüdür, geçiş ortalaması alınır.
                    </p>
                </CardContent>
            </Card>

            <!-- ── Undated blind test: same parcel, no field date given ── -->
            <Card v-if="c.undated" class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle class="flex items-center gap-2"><ScanSearch aria-hidden="true" class="size-5" />Ada {{ c.block }} / Parsel {{ c.parcel }} · tarihsiz kör test</CardTitle>
                    <CardDescription>
                        Uyduya yalnız ada/parsel verilir, tarih verilmez. Sezonun her temiz sahnesi ({{ fmtDate(c.undated.scan.from) }} → {{ fmtDate(c.undated.scan.to) }}, {{ c.undated.scan.candidates }} sahne) aday değişim tarihi olarak denenir; en güçlü, kümelenmiş basamağı veren sahne seçilir.
                        Çok tarih denendiği için eşik daha sıkıdır (z ≥ {{ c.undated.scan.zThreshold }}; tek zayıf piksel olay sayılmaz). Saha tarihi ve işareti yalnız en sondaki kıyasta kullanılır. Yukarıdaki tarihli testten bağımsız değerlendirilir.
                    </CardDescription>
                    <div class="flex flex-wrap items-center gap-2 pt-1">
                        <Badge :variant="toneVariant(c.undated.verdict === 'detected' ? 'success' : 'danger')">{{ c.undated.verdict === 'detected' ? 'Tarihsiz taramada kesim bulundu' : 'Tarihsiz taramada kesim bulunamadı' }}</Badge>
                        <Badge v-if="c.undated.evaluation && c.undated.evaluation.dateHit !== null" :variant="toneVariant(c.undated.evaluation.dateHit ? 'success' : 'danger')">{{ c.undated.evaluation.dateHit ? 'Tarih tuttu' : 'Tarih tutmadı' }}</Badge>
                        <Badge v-if="c.undated.evaluation?.location" :variant="toneVariant(MATCH_META[c.undated.evaluation.location.verdict].tone)">Konum: {{ MATCH_META[c.undated.evaluation.location.verdict].label.toLocaleLowerCase('tr-TR') }}</Badge>
                    </div>
                </CardHeader>
                <CardContent class="flex flex-col gap-6 border-t pt-6 pb-6">
                    <section class="flex flex-col gap-2 rounded-lg border bg-card p-4">
                        <h3 class="text-base font-semibold">Sonuç</h3>
                        <p v-for="(line, i) in c.undated.summary" :key="i" :class="i === 0 ? 'text-base font-medium text-foreground' : 'text-sm text-muted-foreground'">{{ line }}</p>
                    </section>

                    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Uydunun bulduğu aralık</div><div class="font-semibold tabular-nums">{{ c.undated.dateBracket.firstAfter ? `${fmtDate(c.undated.dateBracket.lastBefore)} – ${fmtDate(c.undated.dateBracket.firstAfter)}` : '—' }}</div><div class="text-xs text-muted-foreground">tarih verilmeden</div></div>
                        <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Tespit edilen alan</div><div class="font-semibold tabular-nums">{{ c.undated.verdict === 'detected' ? formatM2(c.undated.prunedM2) : '—' }}</div><div class="text-xs text-muted-foreground">{{ c.undated.verdict === 'detected' ? `parselin %${Math.round(c.undated.shareOfParcel * 100)}'i · tarihli test ${formatM2(c.detection.prunedM2)}` : '' }}</div></div>
                        <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Saha tarihi (kıyas)</div><div class="font-semibold tabular-nums">{{ fmtDate(c.prunedAt) }}</div><div class="text-xs text-muted-foreground">{{ c.undated.evaluation?.dateHit === true ? 'bulunan aralığın içinde' : c.undated.evaluation?.dateHit === false ? (c.undated.evaluation.dateErrorDays !== null ? `${c.undated.evaluation.dateErrorDays} gün sapma` : 'kaçırıldı') : '' }}</div></div>
                        <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Konum (kıyas)</div><div class="font-semibold">{{ c.undated.evaluation?.location ? MATCH_META[c.undated.evaluation.location.verdict].label : '—' }}</div><div class="text-xs text-muted-foreground">{{ c.undated.evaluation?.location ? `merkezler arası ${c.undated.evaluation.location.centroidDistanceM} m · tespitin %${Math.round(c.undated.evaluation.location.detectedInsideShare * 100)}'i işaret içinde` : '' }}</div></div>
                    </div>

                    <section class="flex flex-col gap-2">
                        <h3 class="text-base font-semibold">Tarihsiz taramanın çizdiği alan</h3>
                        <div :ref="(el) => setMapEl(undatedKey(c), el)" class="h-80 w-full overflow-hidden rounded-lg border" />
                        <p class="text-xs text-muted-foreground">Renkler, taramanın kendi seçtiği sahnedeki ({{ fmtDate(c.undated.bestDate) }}) önce/sonra göreli NDVI değişimidir; koyu çerçeve budanmış sayılan pikseller, T1, T2…: kümeler. "Saha işaretini göster" ve "Ağı gizle" düğmeleri yukarıdaki kartta; iki haritayı birlikte yönetir.</p>
                    </section>

                    <section v-if="c.undated.evaluation" class="flex flex-col gap-2 rounded-lg border bg-card p-4">
                        <h3 class="text-base font-semibold">Saha gerçeğiyle kıyas (tarihsiz)</h3>
                        <p class="text-sm">{{ c.undated.evaluation.text }}</p>
                    </section>

                    <section v-if="c.undated.candidates.length" class="flex flex-col gap-2">
                        <h3 class="text-base font-semibold">Aday değişim tarihleri</h3>
                        <div class="overflow-x-auto rounded-lg border bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Sıra</TableHead>
                                        <TableHead>Değişim aralığı</TableHead>
                                        <TableHead class="text-right">Eşiği geçen piksel</TableHead>
                                        <TableHead class="text-right">Öndeki küme</TableHead>
                                        <TableHead class="text-right">Skor (Σz)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow v-for="(k, i) in c.undated.candidates" :key="k.date">
                                        <TableCell class="font-medium">{{ i + 1 }}{{ i === 0 ? ' · seçilen' : '' }}</TableCell>
                                        <TableCell class="text-sm tabular-nums">{{ fmtDate(k.lastBefore) }} – {{ fmtDate(k.date) }}</TableCell>
                                        <TableCell class="text-right text-xs tabular-nums">{{ k.flagged }}</TableCell>
                                        <TableCell class="text-right text-xs tabular-nums">{{ k.clusterPixels }} piksel</TableCell>
                                        <TableCell class="text-right text-xs tabular-nums font-semibold">{{ k.score.toFixed(1) }}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                        <p class="text-xs text-muted-foreground">Skor: öndeki kümenin piksel z değerleri toplamı. Birinci ile ikinci aday arasındaki fark, tarihin ne kadar kesin olduğunu gösterir.</p>
                    </section>

                    <section v-if="c.undated.clusters.length" class="flex flex-col gap-2">
                        <h3 class="text-base font-semibold">Kümeler</h3>
                        <div class="overflow-x-auto rounded-lg border bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Küme</TableHead>
                                        <TableHead>Konum</TableHead>
                                        <TableHead class="text-right">Piksel</TableHead>
                                        <TableHead class="text-right">Tahmini alan</TableHead>
                                        <TableHead class="text-right">Üst sınır</TableHead>
                                        <TableHead class="text-right">NDVI Δ / z</TableHead>
                                        <TableHead class="text-right">VH çıkış / iniş (dB)</TableHead>
                                        <TableHead>Güven</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow v-for="k in c.undated.clusters" :key="k.index">
                                        <TableCell class="font-medium">T{{ k.index + 1 }}</TableCell>
                                        <TableCell class="text-sm">parselin {{ k.position }}</TableCell>
                                        <TableCell class="text-right text-xs tabular-nums">{{ k.pixelIds.length }}</TableCell>
                                        <TableCell class="text-right text-xs tabular-nums font-semibold">{{ k.areaM2 }} m²</TableCell>
                                        <TableCell class="text-right text-xs tabular-nums">{{ k.areaUpperM2 }} m²</TableCell>
                                        <TableCell class="text-right text-xs tabular-nums">{{ signed(k.meanDelta) }} / {{ fmtNum(k.maxZ, 1) }}</TableCell>
                                        <TableCell class="text-right text-xs tabular-nums">{{ k.radar.ASCENDING ? signed(k.radar.ASCENDING.delta, 2) : '—' }} / {{ k.radar.DESCENDING ? signed(k.radar.DESCENDING.delta, 2) : '—' }}</TableCell>
                                        <TableCell><Badge :variant="toneVariant(CONF_META[k.confidence].tone)">{{ CONF_META[k.confidence].label }}</Badge></TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                        <p class="text-xs text-muted-foreground">Alan, tarihli testle aynı uç değerle ({{ c.calibration?.ndviPruned ?? block.rules.ndviPruned }}) hesaplanır{{ c.calibration?.source === 'field' ? '; bu değer bu vakanın saha ölçümünden kalibre edildiği için alan kıyası bağımsız değildir, tarih ve konum bağımsızdır' : '' }}.</p>
                    </section>
                </CardContent>
            </Card>
            </template>
        </template>
    </div>
</template>
