<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight, Grid3x3, ScanSearch } from '@lucide/vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EmptyState, LoadingState, StatCard } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toneVariant, type Tone } from '@/components/caykur/tone';
import { useToast } from '@/composables/useToast';
import {
    api,
    type InventoryMap,
    type PixelConfidence,
    type PixelGardenDetail,
    type PixelGardenRow,
    type PixelKind,
    type PixelScanSummary,
    type PixelVerdict,
    type PixelVerdictFilter,
} from '@/services/api';
import { FUSION_CLASS_META, formatM2 } from '@/services/caykur/teaInventory';
import { formatNumber } from '@/services/caykur';
import { fromUtm, pixelGridLines } from '@/services/caykur/sentinelGrid';

/**
 * Pixel scan (Piksel taraması, experimental): the multi-sensor verdict judges a garden as one averaged
 * series, so a cut of a tenth of the garden drowns. Here every 10 m Sentinel-2 pixel of every garden is
 * read against the surrounding gardens' pixels and scanned for an undated step; clusters are seeded at
 * z ≥ 3 and grown at z ≥ 2.5, boundary pixels outside the tea cover never seed one, and each cluster is
 * classed by how it recovers (deep pruning / light pruning / transient). Shown beside the fusion verdict,
 * never replacing it.
 */
const props = defineProps<{ areaId: string; mapData: InventoryMap }>();

const PAGE_SIZE = 15;
const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const VERDICT_META: Record<PixelVerdict, { label: string; tone: Tone }> = {
    deep: { label: 'Derin budama', tone: 'success' },
    light: { label: 'Hafif budama / üst alma', tone: 'info' },
    pending: { label: 'Kesim, sınıf bekliyor', tone: 'info' },
    transient: { label: 'Geçici düşüş (budama değil)', tone: 'muted' },
    weak: { label: 'Zayıf / sınır sinyali', tone: 'warning' },
    none: { label: 'Değişim yok', tone: 'muted' },
    no_data: { label: 'Veri yok', tone: 'muted' },
};
const KIND_LABEL: Record<PixelKind, string> = { deep: 'derin budama', light: 'hafif budama / üst alma', transient: 'geçici düşüş', pending: 'sınıf bekliyor' };
const CONF_META: Record<PixelConfidence, { label: string; tone: Tone; color: string }> = {
    high: { label: 'yüksek', tone: 'success', color: '#15803d' },
    medium: { label: 'orta', tone: 'warning', color: '#b45309' },
    low: { label: 'düşük', tone: 'muted', color: '#64748b' },
};
const FILTERS: Array<{ value: PixelVerdictFilter | 'new'; label: string }> = [
    { value: 'found', label: 'Küme bulunan bahçeler' },
    { value: 'counted', label: 'Budama sayılanlar (derin + hafif + bekleyen)' },
    { value: 'new', label: 'Çok-sensörün görmediği yeni bulgular' },
    { value: 'deep', label: 'Derin budama' },
    { value: 'light', label: 'Hafif budama / üst alma' },
    { value: 'transient', label: 'Geçici düşüş' },
    { value: 'weak', label: 'Zayıf / sınır sinyali' },
    { value: 'none', label: 'Değişim yok' },
];

const toast = useToast();
const summary = ref<PixelScanSummary | null>(null);
const isLoading = ref(true);
const filter = ref<PixelVerdictFilter | 'new'>('found');
const page = ref(1);
const rows = ref<PixelGardenRow[]>([]);
const total = ref(0);
const totalPages = ref(1);
const isLoadingRows = ref(false);

const sheetOpen = ref(false);
const detail = ref<PixelGardenDetail | null>(null);
const isLoadingDetail = ref(false);
const showGrid = ref(true);
const mapEl = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let grid: L.LayerGroup | null = null;

function fmtDate(d: string | null | undefined): string {
    if (!d) return '—';
    return `${Number(d.slice(8, 10))} ${MONTHS_TR[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
}
const fmtNum = (v: number | null | undefined, digits = 2) => (v === null || v === undefined ? '—' : v.toFixed(digits));
const signed = (v: number | null | undefined, digits = 3) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(digits)}`);
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `%${Math.round(v * 100)}`);
function seasonLabel(s: string | undefined): string {
    if (!s) return '';
    const [a, b] = s.split('-');
    return `${a}–20${b}`;
}
function fusionLabel(cls: string | null): string {
    return cls && cls in FUSION_CLASS_META ? FUSION_CLASS_META[cls as keyof typeof FUSION_CLASS_META].label : 'Karar yok';
}

async function loadSummary(): Promise<void> {
    isLoading.value = true;
    const res = await api.getPixelScanSummary(props.areaId);
    isLoading.value = false;
    summary.value = res.data ?? null;
    if (res.data) await loadRows();
}
async function loadRows(): Promise<void> {
    isLoadingRows.value = true;
    const res = await api.getPixelScanGardens(props.areaId, {
        page: page.value,
        limit: PAGE_SIZE,
        season: summary.value?.season,
        ...(filter.value === 'new' ? { newOnly: 'true' as const } : { verdict: filter.value }),
    });
    isLoadingRows.value = false;
    if (!res.data) {
        toast.error(res.error?.message ?? 'Liste alınamadı');
        return;
    }
    rows.value = res.data.data;
    total.value = res.data.meta.total;
    totalPages.value = Math.max(1, res.data.meta.totalPages);
}
watch(filter, () => {
    page.value = 1;
    void loadRows();
});
watch(page, () => void loadRows());
watch(() => props.areaId, () => void loadSummary(), { immediate: true });
function onFilter(v: unknown): void {
    if (typeof v === 'string' && FILTERS.some((f) => f.value === v)) filter.value = v as PixelVerdictFilter | 'new';
}

// ── Garden sheet ──
function deltaColor(d: number | null): string | null {
    if (d === null) return null;
    if (d <= -0.15) return '#7f1d1d';
    if (d <= -0.1) return '#b91c1c';
    if (d <= -0.05) return '#f97316';
    if (d <= -0.025) return '#fde68a';
    if (d >= 0.05) return '#60a5fa';
    return null;
}
async function openGarden(code: string): Promise<void> {
    sheetOpen.value = true;
    isLoadingDetail.value = true;
    detail.value = null;
    const res = await api.getPixelScanGarden(props.areaId, code, summary.value?.season);
    isLoadingDetail.value = false;
    if (!res.data) {
        toast.error(res.error?.message ?? 'Bahçe yüklenemedi');
        sheetOpen.value = false;
        return;
    }
    detail.value = res.data;
    await nextTick();
    renderMap();
}
function renderMap(): void {
    map?.remove();
    map = null;
    grid = null;
    const d = detail.value;
    if (!mapEl.value || !d) return;
    const zone = Number(d.epsg.slice(-2));
    map = L.map(mapEl.value, { zoomControl: false, attributionControl: false, scrollWheelZoom: false, dragging: false });
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20, maxNativeZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }).addTo(map);
    L.geoJSON(props.mapData, { style: { color: '#ffffff', weight: 0.7, opacity: 0.5, fill: false }, interactive: false }).addTo(map);
    for (const [e, n, insideM2, delta, z, flag, cluster, edge] of d.px) {
        const ring = [fromUtm(e, n, zone), fromUtm(e + 10, n, zone), fromUtm(e + 10, n + 10, zone), fromUtm(e, n + 10, zone)];
        const color = deltaColor(delta);
        L.polygon(ring, { color: flag > 0 ? '#0f172a' : '#e2e8f0', weight: flag === 2 ? 2.4 : flag === 1 ? 1.6 : 0.5, dashArray: flag === 1 ? '4 3' : undefined, opacity: flag > 0 ? 1 : 0.6, fillColor: color ?? '#000000', fillOpacity: color ? 0.6 : 0 })
            .addTo(map)
            .bindTooltip(`${flag === 2 ? 'Çekirdek piksel' : flag === 1 ? 'Büyütülen komşu' : 'Değişim yok'}${cluster >= 0 ? ` · K${cluster + 1}` : ''} · göreli NDVI ${signed(delta)} (z ${fmtNum(z, 1)}) · bahçe içi ${insideM2} m²${edge ? ' · sınır, çay örtüsü dışı' : ''}`, { sticky: true });
    }
    const garden = L.geoJSON({ type: 'Feature', geometry: d.geometry, properties: {} } as GeoJSON.Feature, { style: { color: '#ffffff', weight: 2.5, fill: false }, interactive: false }).addTo(map);
    for (const k of d.clusters) {
        L.marker([k.centroid[1], k.centroid[0]], {
            interactive: false,
            icon: L.divIcon({ className: '', html: `<span style="display:inline-block;min-width:22px;padding:1px 5px;border-radius:999px;background:${CONF_META[k.confidence].color};color:#fff;font:600 11px Inter,sans-serif;text-align:center;box-shadow:0 0 0 1px #fff">K${k.index + 1}</span>`, iconSize: [24, 16], iconAnchor: [12, 8] }),
        }).addTo(map);
    }
    map.fitBounds(garden.getBounds().pad(0.4), { maxZoom: 19 });
    if (showGrid.value) grid = gridLayer().addTo(map);
}
function gridLayer(): L.LayerGroup {
    const d = detail.value;
    if (!map || !d) return L.layerGroup();
    const b = map.getBounds().pad(0.2);
    const lines = pixelGridLines({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }, Number(d.epsg.slice(-2)));
    return L.layerGroup(lines.map((pts) => L.polyline(pts, { color: '#ffffff', weight: 0.6, opacity: 0.45, interactive: false })));
}
watch(showGrid, (on) => {
    grid?.remove();
    grid = on && map ? gridLayer().addTo(map) : null;
});
watch(sheetOpen, (open) => {
    if (!open) {
        map?.remove();
        map = null;
        grid = null;
    }
});
onBeforeUnmount(() => map?.remove());

// ── Recovery sparkline of the main cluster against the garden's other pixels ──
const W = 600;
const H = 80;
const spark = computed(() => {
    const d = detail.value;
    if (!d?.series || !d.best) return null;
    const s = d.series;
    const all = [...s.cluster, ...s.rest].filter((v): v is number => v !== null);
    if (all.length < 3) return null;
    const t0 = Date.parse(s.dates[0] as string);
    const t1 = Date.parse(s.dates.at(-1) as string);
    const x = (date: string) => (t1 > t0 ? ((Date.parse(date) - t0) / (t1 - t0)) * W : 0);
    const min = Math.min(-0.2, ...all);
    const max = Math.max(0.2, ...all);
    const y = (v: number) => H - ((v - min) / (max - min)) * H;
    const line = (vals: Array<number | null>) => s.dates.map((date, i) => (vals[i] === null || vals[i] === undefined ? null : `${x(date).toFixed(1)},${y(vals[i] as number).toFixed(1)}`)).filter((p): p is string => !!p).join(' ');
    return { cluster: line(s.cluster), rest: line(s.rest), zero: y(0), mark: x(d.best.date), from: s.dates[0] as string, to: s.dates.at(-1) as string, min, max };
});
const mainCluster = computed(() => (detail.value && detail.value.mainCluster !== null ? (detail.value.clusters[detail.value.mainCluster] ?? null) : null));
const newFindRows = computed(() => {
    const m = summary.value?.summary.vsFusion ?? {};
    const sum = (cls: string) => (['deep', 'light', 'pending'] as PixelVerdict[]).reduce((t, v) => t + (m[cls]?.[v] ?? 0), 0);
    return { unclear: sum('unclear'), notPruned: sum('not_pruned'), pruned: sum('pruned'), likely: sum('likely') };
});
const fusionMissed = computed(() => {
    const m = summary.value?.summary.vsFusion ?? {};
    const none = (cls: string) => (m[cls]?.none ?? 0) + (m[cls]?.transient ?? 0) + (m[cls]?.weak ?? 0);
    return none('pruned') + none('likely');
});
</script>

<template>
    <div class="flex flex-col gap-6">
        <LoadingState v-if="isLoading" text="Piksel taraması yükleniyor…" />
        <EmptyState v-else-if="!summary" :icon="ScanSearch" title="Bu mahalle için piksel taraması yok" description="Motor tarafında scan-pixels çalıştırıldığında burada görünür: her bahçe 10 m piksel ağında, tarih verilmeden taranır." />
        <template v-else>
            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle class="flex flex-wrap items-center gap-2">Piksel taraması <Badge variant="warning">Deneysel · kalibre edilmedi</Badge></CardTitle>
                    <CardDescription>Değişimin yerini ve tahmini alan aralığını gösterir. DEMO ruhsat kayıtları · Ön değerlendirme; idari karar değildir.</CardDescription>
                    <details><summary class="min-h-11 cursor-pointer py-3 text-sm">Kanıt yöntemi ve sınırlamalar</summary>                    <div class="text-sm text-muted-foreground">
                        Çok-sensör karar bahçeyi tek bir ortalama seriyle yargılar; bahçenin onda biri kesildiğinde bu ortalamada kaybolur. Burada her bahçenin her 10 m Sentinel-2 pikseli, 300 m çevresindeki diğer bahçe piksellerine göre okunur ve sezonun her temiz sahnesi
                        aday tarih olarak denenir ({{ fmtDate(summary.scan.from) }} → {{ fmtDate(summary.scan.to) }}, {{ summary.scan.candidates }} aday · {{ summary.dates }} sahne, {{ summary.excludedDates.length }} tarih kar/gölge nedeniyle dışlandı).
                        Her pikselin kendi mevsimsel örüntüsü önceki iki sezonundan çıkarılır ve tarama bu örüntüden sapma üzerinde yapılır; piksel ayrıca o tarihte mahalledeki tüm piksellerin değişim dağılımından ayrışmalıdır.
                        Küme çekirdeği z ≥ {{ summary.rules.zCore }} ile kurulur, komşular z ≥ {{ summary.rules.zGrow }} ile eklenir, kümenin birleşik z'si ≥ {{ summary.rules.clusterZ }} olmalıdır. Sınır pikselleri (çay örtüsü dışı) çekirdek olamaz. Kümeler toparlanma hızına göre derin budama, hafif budama ya da geçici düşüş olarak ayrılır.
                        Çok-sensör kararını değiştirmez; yanında gösterilir. Sezon {{ seasonLabel(summary.season) }}.
                    </div><p class="text-sm">Alan dönüşümü sınırlı yerel kalibrasyona dayanır; ölçülmüş kesin alan değildir. Alt–üst sınırlar birlikte değerlendirilmelidir.</p></details>
                </CardHeader>
            </Card>

            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Derin budama" :value="formatNumber(summary.summary.byVerdict.deep)" :hint="`bahçe · ${formatM2(summary.summary.areaM2.deep)} · yaz başında hâlâ komşularının altında`" />
                <StatCard label="Hafif budama / üst alma" :value="formatNumber(summary.summary.byVerdict.light)" :hint="`bahçe · ${formatM2(summary.summary.areaM2.light)} · ${summary.rules.transientDays} günden uzun sürdü, yaza toparlandı`" />
                <StatCard label="Geçici düşüş (elendi)" :value="formatNumber(summary.summary.byVerdict.transient + summary.summary.byVerdict.weak)" :hint="`bahçe · ${summary.summary.byVerdict.transient} hızlı toparlanan + ${summary.summary.byVerdict.weak} zayıf / sınır sinyali`" />
                <StatCard label="Çok-sensörün görmediği" :value="formatNumber(summary.summary.newFinds)" hint="bahçe · çok-sensör 'belirsiz' ya da 'budama yok' demişti" />
            </div>

            <details v-if="summary.validation" class="rounded-lg border p-3"><summary class="min-h-11 cursor-pointer py-3 text-sm font-medium">Model davranış testleri · ayrıntılar</summary><Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Model davranış testleri (saha verisi olmadan)</CardTitle>
                    <CardDescription>
                        Yanlış alarm üst sınırı: {{ summary.validation.falseAlarms.gardens }} / {{ summary.validation.gardens }} bahçe ({{ pct(summary.validation.falseAlarms.share) }}). {{ summary.validation.falseAlarms.note }}
                    </CardDescription>
                </CardHeader>
                <CardContent class="flex flex-col gap-3 border-t pt-4 pb-4">
                    <p class="text-sm">
                        Yakalama oranı ({{ summary.validation.detection.trials }} sentetik kesim): belirgin kesimlerde (≥ 3 piksel, pikselde ≥ 0,15 NDVI düşüşü) {{ pct(summary.validation.detection.clear.rate) }},
                        gerçekçi kesimlerde (≥ 2 piksel, ≥ 0,10) {{ pct(summary.validation.detection.realistic.rate) }}, tümünde {{ pct(summary.validation.detection.overall.rate) }}.
                        Yakalananların {{ summary.validation.detection.kindCorrect.hit }} / {{ summary.validation.detection.kindCorrect.n }}'inde derin / hafif sınıfı doğru.
                    </p>
                    <div class="overflow-x-auto rounded-lg border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Kesilen piksel sayısı</TableHead>
                                    <TableHead v-for="d in Object.keys(summary.validation.detection.byDepth)" :key="d" class="text-right">Pikselde NDVI düşüşü {{ Number(d).toFixed(2) }}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="r in summary.validation.detection.table" :key="r.pixels">
                                    <TableCell class="font-medium">{{ r.pixels }} piksel</TableCell>
                                    <TableCell v-for="(c, i) in r.cells" :key="i" class="text-right text-sm tabular-nums">{{ c.n ? `${c.hit} / ${c.n}` : '—' }}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <p class="text-xs text-muted-foreground">
                        {{ summary.validation.detection.note }} Küçük ve sığ kesimler (tek piksel ya da pikselin küçük bir kısmı) 10 m çözünürlükte gürültüden ayrışmaz; ayrıca 22 Ara – 15 Şub arası tek temiz sahne olmadığı için o aralıkta yapılıp hızla toparlanan hafif kesimler görülemez.
                        Bu sayılar gerçek saha doğrulamasının yerini tutmaz; Saha Testi vakaları geldikçe onunla değiştirilecek.
                    </p>
                </CardContent>
            </Card></details>

            <details class="rounded-lg border p-3"><summary class="min-h-11 cursor-pointer py-3 text-sm font-medium">Çok-sensör karar ile karşılaştırma · ayrıntılar</summary><Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Çok-sensör karar ile karşılaştırma</CardTitle>
                    <CardDescription>
                        Piksel taramasının budama saydığı bahçeler çok-sensörde: {{ newFindRows.pruned }} "budandı", {{ newFindRows.likely }} "olası", {{ newFindRows.unclear }} "belirsiz", {{ newFindRows.notPruned }} "budama yok".
                        Tersine, çok-sensörün "budandı / olası" dediği {{ fusionMissed }} bahçede piksel taraması sayılır bir küme bulmadı.
                        Toplam {{ formatNumber(summary.summary.gardens) }} bahçe, {{ formatNumber(summary.summary.pixels) }} piksel; {{ formatNumber(summary.summary.flaggedPixels) }} piksel bir kümede.
                        Hangisinin doğru olduğunu yalnız saha doğrulaması söyler; Saha Testi sekmesi bunun için var.
                    </CardDescription>
                </CardHeader>
            </Card></details>

            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Bahçeler</CardTitle>
                    <CardDescription>{{ formatNumber(total) }} bahçe · satıra tıklayınca piksel haritası, kümeler ve toparlanma eğrisi</CardDescription>
                    <div class="pt-2">
                        <Select :model-value="filter" @update:model-value="onFilter">
                            <SelectTrigger class="h-11 w-full sm:w-96 md:h-9" aria-label="Piksel kararı filtresi"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="f in FILTERS" :key="f.value" :value="f.value">{{ f.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent class="border-t px-0 pb-0">
                    <LoadingState v-if="isLoadingRows && rows.length === 0" text="Bahçeler yükleniyor…" class="p-6" />
                    <p v-else-if="rows.length === 0" class="p-6 text-sm text-muted-foreground">Bu filtreye uyan bahçe yok.</p>
                    <div v-else class="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Bahçe</TableHead>
                                    <TableHead>Müstahsil</TableHead>
                                    <TableHead>Piksel kararı</TableHead>
                                    <TableHead>Çok-sensör</TableHead>
                                    <TableHead>Değişim aralığı</TableHead>
                                    <TableHead class="text-right">Alan</TableHead>
                                    <TableHead class="text-right">Piksel</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="r in rows" :key="r.code" class="cursor-pointer" tabindex="0" @click="openGarden(r.code)" @keydown.enter="openGarden(r.code)">
                                    <TableCell>
                                        <div class="font-medium">{{ r.block }}/{{ r.parcel }}</div>
                                        <div class="text-xs text-muted-foreground">{{ r.code }} · {{ formatM2(r.areaM2) }}</div>
                                    </TableCell>
                                    <TableCell class="text-sm">{{ r.producerName || r.producerCode || '—' }}</TableCell>
                                    <TableCell>
                                        <Badge :variant="toneVariant(VERDICT_META[r.verdict].tone)">{{ VERDICT_META[r.verdict].label }}</Badge>
                                        <div v-if="r.mainCluster !== null && r.clusters[r.mainCluster]" class="pt-1 text-xs text-muted-foreground">güven {{ CONF_META[r.clusters[r.mainCluster]!.confidence].label }} · z {{ fmtNum(r.clusters[r.mainCluster]!.maxZ, 1) }}</div>
                                    </TableCell>
                                    <TableCell class="text-sm">{{ fusionLabel(r.fusionClass) }}</TableCell>
                                    <TableCell class="text-sm tabular-nums">{{ r.best ? `${fmtDate(r.best.lastBefore)} → ${fmtDate(r.best.date)}` : '—' }}</TableCell>
                                    <TableCell class="text-right text-sm tabular-nums">
                                        <span class="font-semibold">{{ r.prunedM2 ? formatM2(r.prunedM2) : '—' }}</span>
                                        <div v-if="r.prunedM2" class="text-xs text-muted-foreground">{{ r.prunedLowM2 }}–{{ r.prunedUpperM2 }} m²</div>
                                    </TableCell>
                                    <TableCell class="text-right text-xs tabular-nums">{{ r.clusters.reduce((t, k) => t + k.pixels, 0) }} / {{ r.evaluatedPixels }}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <div v-if="totalPages > 1" class="flex items-center justify-between border-t p-4">
                        <span class="text-sm text-muted-foreground">Sayfa {{ page }} / {{ totalPages }}</span>
                        <div class="flex gap-2">
                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page <= 1" aria-label="Önceki sayfa" @click="page--"><ChevronLeft aria-hidden="true" /></Button>
                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page >= totalPages" aria-label="Sonraki sayfa" @click="page++"><ChevronRight aria-hidden="true" /></Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </template>

        <Sheet v-model:open="sheetOpen">
            <SheetContent side="right" class="w-full gap-0 overflow-y-auto sm:max-w-3xl">
                <LoadingState v-if="isLoadingDetail || !detail" text="Piksel haritası yükleniyor…" class="p-6" />
                <template v-else>
                    <SheetHeader class="border-b">
                        <SheetTitle>{{ detail.block }}/{{ detail.parcel }} · {{ detail.producerName || detail.producerCode || detail.code }}</SheetTitle>
                        <SheetDescription>{{ detail.code }} · {{ formatM2(detail.areaM2) }} · {{ detail.evaluatedPixels }} piksel · sezon {{ seasonLabel(detail.season) }}</SheetDescription>
                        <div class="flex flex-wrap items-center gap-2">
                            <Badge :variant="toneVariant(VERDICT_META[detail.verdict].tone)">{{ VERDICT_META[detail.verdict].label }}</Badge>
                            <Badge variant="outline">Çok-sensör: {{ fusionLabel(detail.fusionClass) }}</Badge>
                            <Badge v-if="mainCluster" :variant="toneVariant(CONF_META[mainCluster.confidence].tone)">güven {{ CONF_META[mainCluster.confidence].label }}</Badge>
                        </div>
                    </SheetHeader>
                    <div class="flex flex-col gap-6 p-4 md:p-6">
                        <div class="grid gap-3 sm:grid-cols-3">
                            <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Uydunun bulduğu aralık</div><div class="text-sm font-semibold tabular-nums">{{ detail.best ? `${fmtDate(detail.best.lastBefore)} → ${fmtDate(detail.best.date)}` : '—' }}</div></div>
                            <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Tahmini budanan alan</div><div class="font-semibold tabular-nums">{{ detail.prunedM2 ? formatM2(detail.prunedM2) : '—' }}</div><div v-if="detail.prunedM2" class="text-xs text-muted-foreground">alt {{ detail.prunedLowM2 }} m² · tam piksel üst sınırı {{ detail.prunedUpperM2 }} m²</div></div>
                            <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Toparlanma</div><div class="text-sm font-semibold">{{ mainCluster ? KIND_LABEL[mainCluster.kind] : '—' }}</div><div v-if="mainCluster" class="text-xs text-muted-foreground">{{ mainCluster.recoveryDays !== null ? `${mainCluster.recoveryDays} günde %70` : 'toparlanma görülmedi' }}{{ mainCluster.summerRecovery !== null ? ` · yaz başı ${pct(mainCluster.summerRecovery)}` : '' }}</div></div>
                        </div>

                        <section class="flex flex-col gap-2">
                            <div class="flex items-center justify-between gap-2">
                                <h3 class="text-base font-semibold">Piksel haritası</h3>
                                <Button variant="outline" size="sm" class="h-11 md:h-9" :aria-pressed="showGrid" @click="showGrid = !showGrid"><Grid3x3 aria-hidden="true" />{{ showGrid ? 'Ağı gizle' : 'Ağı göster' }}</Button>
                            </div>
                            <div ref="mapEl" class="h-72 w-full overflow-hidden rounded-lg border" />
                            <p class="text-xs text-muted-foreground">
                                Renk: seçilen tarihte önce/sonra göreli NDVI değişimi (koyu kırmızı ≤ −0,15 · kırmızı ≤ −0,10 · turuncu ≤ −0,05 · sarı ≤ −0,025 · mavi ≥ +0,05). Kalın çerçeve çekirdek piksel (z ≥ {{ summary?.rules.zCore }}), kesikli çerçeve büyütülen komşu (z ≥ {{ summary?.rules.zGrow }}); z, pikselin kendi mevsimsel örüntüsünden sapmasına göredir.
                                Beyaz çizgi bahçe sınırı. Zemin Google uydu altlığı, tarihsiz. Kareye gelince sayılar görünür.
                            </p>
                        </section>

                        <section v-if="detail.clusters.length" class="flex flex-col gap-2">
                            <h3 class="text-base font-semibold">Kümeler</h3>
                            <div class="overflow-x-auto rounded-lg border bg-card">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Küme</TableHead>
                                            <TableHead>Sınıf</TableHead>
                                            <TableHead class="text-right">Piksel</TableHead>
                                            <TableHead class="text-right">Alan</TableHead>
                                            <TableHead class="text-right">NDVI Δ / z</TableHead>
                                            <TableHead class="text-right">NBR Δ</TableHead>
                                            <TableHead class="text-right">Derinlik</TableHead>
                                            <TableHead>Güven</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow v-for="k in detail.clusters" :key="k.index">
                                            <TableCell class="font-medium">K{{ k.index + 1 }}</TableCell>
                                            <TableCell class="text-sm">{{ KIND_LABEL[k.kind] }}</TableCell>
                                            <TableCell class="text-right text-xs tabular-nums">{{ k.pixels }} ({{ k.corePixels }} çekirdek{{ k.edgePixels ? `, ${k.edgePixels} sınır` : '' }})</TableCell>
                                            <TableCell class="text-right text-xs tabular-nums"><span class="font-semibold">{{ k.areaM2 }} m²</span> ({{ k.areaLowM2 }}–{{ k.areaUpperM2 }})</TableCell>
                                            <TableCell class="text-right text-xs tabular-nums">{{ signed(k.meanDelta) }} / {{ fmtNum(k.maxZ, 1) }}</TableCell>
                                            <TableCell class="text-right text-xs tabular-nums">{{ signed(k.nbrDelta) }}</TableCell>
                                            <TableCell class="text-right text-xs tabular-nums">{{ fmtNum(k.depth) }}</TableCell>
                                            <TableCell><Badge :variant="toneVariant(CONF_META[k.confidence].tone)">{{ CONF_META[k.confidence].label }}</Badge></TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                            <p v-for="k in detail.clusters.filter((x) => x.note)" :key="`n${k.index}`" class="text-xs text-muted-foreground">K{{ k.index + 1 }}: {{ k.note }}.</p>
                        </section>

                        <section v-if="spark" class="flex flex-col gap-2">
                            <h3 class="text-base font-semibold">Toparlanma eğrisi (komşulara göreli NDVI)</h3>
                            <svg :viewBox="`0 0 ${W} ${H}`" class="h-20 w-full" role="img" aria-label="Ana kümenin ve bahçenin kalanının göreli NDVI serisi">
                                <line x1="0" :y1="spark.zero" :x2="W" :y2="spark.zero" class="stroke-muted-foreground/40" stroke-width="1" stroke-dasharray="3 3" />
                                <line :x1="spark.mark" y1="0" :x2="spark.mark" :y2="H" class="stroke-destructive" stroke-width="1" />
                                <polyline :points="spark.rest" fill="none" class="stroke-muted-foreground" stroke-width="1.5" stroke-linejoin="round" />
                                <polyline :points="spark.cluster" fill="none" class="stroke-destructive" stroke-width="1.8" stroke-linejoin="round" />
                            </svg>
                            <div class="flex justify-between text-[11px] text-muted-foreground"><span>{{ fmtDate(spark.from) }}</span><span>kırmızı: ana küme · gri: bahçenin kalanı · dikey çizgi: bulunan değişim tarihi</span><span>{{ fmtDate(spark.to) }}</span></div>
                            <p class="text-xs text-muted-foreground">
                                Sınıflama: %70 toparlanma {{ summary?.rules.transientDays }} günden kısa sürerse geçici düşüş (gölge, kar, don) sayılır ve budama yazılmaz. Yaz başında (20 May–15 Tem) toparlanma {{ pct(Number(summary?.rules.deepSummerRecovery)) }}'in altındaysa derin budama, üstündeyse hafif budama / üst almadır.
                            </p>
                        </section>

                        <section v-if="detail.candidates.length > 1" class="flex flex-col gap-1">
                            <h3 class="text-base font-semibold">Diğer aday tarihler</h3>
                            <p v-for="(k, i) in detail.candidates" :key="k.date" class="text-xs text-muted-foreground tabular-nums">{{ i + 1 }}. {{ fmtDate(k.lastBefore) }} → {{ fmtDate(k.date) }} · {{ k.pixels }} piksel · skor {{ k.score.toFixed(1) }}{{ i === 0 ? ' (seçilen)' : '' }}</p>
                        </section>
                    </div>
                </template>
            </SheetContent>
        </Sheet>
    </div>
</template>
