<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight, Plane } from '@lucide/vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EmptyState, LoadingState, StatCard } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toneVariant, type Tone } from '@/components/caykur/tone';
import { useToast } from '@/composables/useToast';
import { api, type DroneClassFilter, type DroneConfidence, type DroneMapClass, type DroneMapCollection, type DroneStatus, type DroneVerificationDetail, type DroneVerificationRow, type DroneVerificationSummary } from '@/services/api';
import { formatM2 } from '@/services/caykur/teaInventory';
import { formatNumber } from '@/services/caykur';

/**
 * Drone-supported land verification (Drone doğrulama), a separate module under licensing: what the record says about
 * a parcel (deed title, licence) against what drone imagery shows on it. Every result is a preliminary assessment
 * with its evidence frames; a mismatch asks for a field check and never stands for an administrative decision.
 */
const props = defineProps<{ areaId: string }>();

const ALL = 'all';
const PAGE_SIZE = 15;
/** Map colours follow the brief: green = tea supported, red = no tea found, yellow = partial / more review, grey = not analysed. */
const CLASS_META: Record<DroneMapClass, { label: string; tone: Tone; color: string; note: string }> = {
    tea_present: { label: 'Çay mevcut', tone: 'success', color: '#16a34a', note: 'Görüntüler çay bitkisi varlığını destekliyor.' },
    tea_not_found: { label: 'Çay bulunamadı', tone: 'danger', color: '#dc2626', note: 'İncelenen görüntülerde çay bitkisi tespit edilemedi.' },
    partial: { label: 'Kısmen çay mevcut', tone: 'warning', color: '#eab308', note: 'Parselin yalnız bir bölümünde çay görülüyor.' },
    uncertain: { label: 'Belirsiz / saha kontrolü gerekli', tone: 'warning', color: '#eab308', note: 'Görüntüler güvenilir bir sonuç için yeterli değil.' },
    not_analysed: { label: 'Analiz edilmedi', tone: 'muted', color: '#9ca3af', note: 'Bu parseli kapsayan drone görüntüsü yok.' },
};
const STATUS_META: Record<DroneStatus, { label: string; tone: Tone }> = {
    consistent: { label: 'Kayıtla uyumlu', tone: 'success' },
    needs_review: { label: 'İnceleme gerekli', tone: 'warning' },
    not_analysed: { label: 'Analiz edilmedi', tone: 'muted' },
};
const CONFIDENCE_META: Record<DroneConfidence, { label: string; tone: Tone }> = {
    high: { label: 'güven: yüksek', tone: 'success' },
    medium: { label: 'güven: orta', tone: 'info' },
    low: { label: 'güven: düşük', tone: 'muted' },
};
const VERDICT_META: Record<'ok' | 'limited' | 'no', { label: string; tone: Tone }> = {
    ok: { label: 'yapılabiliyor', tone: 'success' },
    limited: { label: 'sınırlı', tone: 'warning' },
    no: { label: 'yapılamıyor', tone: 'danger' },
};
const CLASS_FILTERS: Array<{ value: DroneClassFilter | typeof ALL; label: string }> = [
    { value: 'analysed', label: 'Analiz edilen parseller' },
    { value: ALL, label: 'Bütün parseller' },
    { value: 'tea_present', label: CLASS_META.tea_present.label },
    { value: 'tea_not_found', label: CLASS_META.tea_not_found.label },
    { value: 'partial', label: CLASS_META.partial.label },
    { value: 'uncertain', label: CLASS_META.uncertain.label },
    { value: 'not_analysed', label: CLASS_META.not_analysed.label },
];
const SATELLITE_LABEL: Record<string, string> = { present: 'çay var', absent: 'çay yok', inconclusive: 'kararsız', not_assessable: 'değerlendirilemiyor' };
const SHARE_LABEL: Record<string, string> = { tea: 'çay', other_vegetation: 'diğer bitki', built: 'yapı / yol', uncertain: 'kararsız piksel' };
/** What each kind of source adds; the module's records already carry these kinds. */
const ROADMAP: Array<{ source: string; gives: string; needs: string; now: boolean }> = [
    { source: 'Sıradan drone videosu', gives: 'Parselin o günkü görünümü, görsel kanıt, zaman aralığı.', needs: 'Koordinat, ölçek, kadastro sınırı, alan.', now: true },
    { source: 'RTK/PPK konumlu ortofoto', gives: 'Santimetre düzeyinde konum: kadastro sınırı görüntüye oturur, çaylık alan m² olarak ölçülür.', needs: 'Izgara planlı uçuş, %75–80 bindirme, yer kontrol / denetim noktaları.', now: false },
    { source: 'LiDAR nokta bulutu', gives: 'Zemin modeli ve bitki yüksekliği: çay çalısı (≈ 1 m) ile ağaç, yapı ve boş zemin ayrılır; eğimli yüzey alanı.', needs: 'Tür ayrımı yapmaz: “ne yetişiyor” sorusunu görüntü yanıtlar.', now: false },
    { source: 'Multispektral görüntü', gives: 'Bitki türü ve sağlık ayrımı için kırmızı kenar / yakın kızılötesi bantlar.', needs: 'Saha etiketiyle eğitilmiş ve sınanmış sınıflandırıcı.', now: false },
];

const toast = useToast();
const summary = ref<DroneVerificationSummary | null>(null);
const mapData = ref<DroneMapCollection | null>(null);
const rows = ref<DroneVerificationRow[]>([]);
const total = ref(0);
const page = ref(1);
const pages = ref(1);
const classFilter = ref<DroneClassFilter | typeof ALL>('analysed');
const search = ref('');
const isLoading = ref(true);
const isLoadingRows = ref(false);
const detail = ref<DroneVerificationDetail | null>(null);
const isLoadingDetail = ref(false);
const frameIndex = ref(0);
/** Evidence view: the playing clip with the outline drawn over it, or one analysed frame (clean / tinted by class). */
const mode = ref<'video' | 'frame' | 'classes'>('video');
const videoEl = ref<HTMLVideoElement | null>(null);
/** Playback position in seconds of the source video. */
const videoTime = ref(0);
let ticker = 0;
const overviewContainer = ref<HTMLElement | null>(null);
const parcelContainer = ref<HTMLElement | null>(null);
let overviewMap: L.Map | null = null;
let parcelMap: L.Map | null = null;
let overviewLayer: L.GeoJSON | null = null;
/** The approximate orthophoto of the video over the base map, on both maps. */
const showOrtho = ref(true);
const orthoOverlays = new Map<L.Map, L.ImageOverlay>();
function overviewStyle(f?: { properties: { class?: string } | null }): L.PathOptions {
    const cls = (f?.properties?.class ?? 'not_analysed') as DroneMapClass;
    const done = cls !== 'not_analysed';
    // Over the drone image the fill is kept thin, so the ground stays readable under the class colour.
    const over = showOrtho.value && summary.value?.orthophoto;
    return { color: CLASS_META[cls].color, weight: done ? (over ? 2 : 3) : 1, opacity: done ? 1 : 0.7, fillColor: CLASS_META[cls].color, fillOpacity: done ? (over ? 0.08 : 0.35) : (over ? 0 : 0.05) };
}
function syncOrtho(map: L.Map): void {
    const o = summary.value?.orthophoto;
    if (!o) return;
    let overlay = orthoOverlays.get(map);
    if (!overlay) {
        const [west, south] = o.bounds.southWest;
        const [east, north] = o.bounds.northEast;
        overlay = L.imageOverlay(summary.value!.imageryBaseUrl + o.image, [[south, west], [north, east]], { alt: 'Drone videosundan yaklaşık ortofoto' });
        orthoOverlays.set(map, overlay);
    }
    if (showOrtho.value) overlay.addTo(map);
    else overlay.remove();
}
let searchTimer: ReturnType<typeof setTimeout> | null = null;
const sheetOpen = computed({
    get: () => detail.value !== null || isLoadingDetail.value,
    set: (open: boolean) => {
        if (!open) {
            detail.value = null;
            cancelAnimationFrame(ticker);
            parcelMap?.remove();
            parcelMap = null;
        }
    },
});
const source = computed(() => summary.value?.sources[0] ?? null);
const frame = computed(() => detail.value?.drone?.frames[frameIndex.value] ?? null);
const clip = computed(() => detail.value?.drone?.clip ?? null);
type OutlineKey = { t: number; polygon: number[][] };
/**
 * Outline at the playback position. Between two tracked instants that hold the same corners the outline is
 * interpolated, so it follows the picture instead of jumping; otherwise the nearest instant is shown, and nothing
 * while the parcel is not tracked.
 */
function outlineAt(track: OutlineKey[], t: number): string | null {
    let before: OutlineKey | null = null;
    let after: OutlineKey | null = null;
    for (const k of track) {
        if (k.t <= t && (!before || k.t > before.t)) before = k;
        if (k.t > t && (!after || k.t < after.t)) after = k;
    }
    const text = (polygon: number[][]) => polygon.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    if (before && after && after.t - before.t <= 1.5 && before.polygon.length === after.polygon.length) {
        const w = (t - before.t) / (after.t - before.t);
        const to = after.polygon;
        return text(before.polygon.map(([x, y], i) => [x + (to[i][0] - x) * w, y + (to[i][1] - y) * w]));
    }
    const nearest = before && after ? (t - before.t <= after.t - t ? before : after) : (before ?? after);
    return nearest && Math.abs(nearest.t - t) <= 0.4 ? text(nearest.polygon) : null;
}
const overlayPoints = computed(() => outlineAt(detail.value?.drone?.track ?? [], videoTime.value));
/** The TKGM outline as projected into the video at the playback position (approximate georeference). */
const cadastrePoints = computed(() => outlineAt(detail.value?.drone?.cadastreTrack ?? [], videoTime.value));

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `%${Math.round(v * 100)}`);
/** Video time as m:ss. */
const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const TILES = 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
const TILE_OPTIONS = { maxZoom: 21, maxNativeZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] };

async function load(): Promise<void> {
    isLoading.value = true;
    const [s, m] = await Promise.all([api.getDroneVerificationSummary(props.areaId), api.getDroneVerificationMap(props.areaId)]);
    isLoading.value = false;
    summary.value = s.data ?? null;
    mapData.value = m.data ?? null;
    if (!s.data) return;
    await loadRows();
    await nextTick();
    renderOverview();
}
async function loadRows(): Promise<void> {
    isLoadingRows.value = true;
    const res = await api.getDroneVerificationParcels(props.areaId, { page: page.value, limit: PAGE_SIZE, class: classFilter.value === ALL ? undefined : classFilter.value, search: search.value.trim() || undefined });
    isLoadingRows.value = false;
    if (!res.data) {
        toast.error(res.error?.message ?? 'Parsel listesi alınamadı');
        return;
    }
    rows.value = res.data.data;
    total.value = res.data.meta.total;
    pages.value = Math.max(1, res.data.meta.totalPages);
}
function renderOverview(): void {
    if (overviewMap) orthoOverlays.delete(overviewMap);
    overviewMap?.remove();
    overviewMap = null;
    overviewLayer = null;
    if (!overviewContainer.value || !mapData.value) return;
    const map = L.map(overviewContainer.value, { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
    overviewMap = map;
    L.tileLayer(TILES, TILE_OPTIONS).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    const analysed: L.Layer[] = [];
    syncOrtho(map);
    const layer = L.geoJSON(mapData.value, {
        style: (f) => overviewStyle(f),
        onEachFeature: (f, l) => {
            const p = f.properties;
            l.bindTooltip(`${p.block}/${p.parcel} · ${p.nature} · ${CLASS_META[p.class as DroneMapClass].label}`, { sticky: true });
            l.on('click', () => void open(p.block, p.parcel));
            if (p.class !== 'not_analysed') analysed.push(l);
        },
    }).addTo(map);
    overviewLayer = layer;
    // Start on the analysed parcels: they are a handful in a neighbourhood of hundreds.
    const focus = analysed.length ? L.featureGroup(analysed).getBounds() : layer.getBounds();
    if (focus.isValid()) map.fitBounds(focus, { padding: [80, 80], maxZoom: 19 });
}
function tick(): void {
    if (videoEl.value && clip.value) videoTime.value = videoEl.value.currentTime + clip.value.start;
    ticker = requestAnimationFrame(tick);
}
/** Jumps the clip to a moment of the source video. */
function seek(t: number): void {
    if (!videoEl.value || !clip.value) return;
    videoEl.value.currentTime = Math.max(t - clip.value.start, 0);
}
function onVideoReady(): void {
    const d = detail.value?.drone;
    if (d) seek(d.video.visible[0]);
}
function pickFrame(index: number): void {
    frameIndex.value = index;
    const f = detail.value?.drone?.frames[index];
    if (mode.value === 'video' && f) {
        videoEl.value?.pause();
        seek(f.t);
    }
}
async function open(block: string, parcel: string): Promise<void> {
    isLoadingDetail.value = true;
    frameIndex.value = 0;
    cancelAnimationFrame(ticker);
    const res = await api.getDroneVerificationParcel(props.areaId, block, parcel);
    isLoadingDetail.value = false;
    if (!res.data) {
        toast.error(res.error?.message ?? 'Parsel alınamadı');
        return;
    }
    detail.value = res.data;
    const reference = res.data.drone?.frames.findIndex((f) => f.isReference) ?? -1;
    frameIndex.value = Math.max(reference, 0);
    mode.value = res.data.drone?.clip ? 'video' : 'frame';
    videoTime.value = res.data.drone?.video.visible[0] ?? 0;
    ticker = requestAnimationFrame(tick);
    await nextTick();
    // The sheet animates in: Leaflet needs the container at its final size.
    setTimeout(renderParcel, 250);
}
function renderParcel(): void {
    if (parcelMap) orthoOverlays.delete(parcelMap);
    parcelMap?.remove();
    parcelMap = null;
    const d = detail.value;
    if (!parcelContainer.value || !d) return;
    parcelMap = L.map(parcelContainer.value, { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
    L.tileLayer(TILES, TILE_OPTIONS).addTo(parcelMap);
    L.control.zoom({ position: 'topright' }).addTo(parcelMap);
    syncOrtho(parcelMap);
    const outline = L.geoJSON({ type: 'Feature', geometry: d.geometry, properties: {} } as GeoJSON.Feature, { style: { color: CLASS_META[d.class].color, weight: 3, fill: false } }).addTo(parcelMap);
    parcelMap.fitBounds(outline.getBounds(), { padding: [50, 50], maxZoom: 19 });
}
function onClass(v: unknown): void {
    if (typeof v === 'string' && CLASS_FILTERS.some((f) => f.value === v)) classFilter.value = v as DroneClassFilter | typeof ALL;
}
watch(showOrtho, () => {
    for (const map of [overviewMap, parcelMap]) if (map) syncOrtho(map);
    overviewLayer?.setStyle((f) => overviewStyle(f));
});
watch(classFilter, () => {
    page.value = 1;
    void loadRows();
});
watch(search, () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        page.value = 1;
        void loadRows();
    }, 300);
});
watch(page, () => void loadRows());
watch(() => props.areaId, () => void load(), { immediate: true });
onBeforeUnmount(() => {
    if (searchTimer) clearTimeout(searchTimer);
    cancelAnimationFrame(ticker);
    overviewMap?.remove();
    parcelMap?.remove();
});
</script>

<template>
    <div class="flex flex-col gap-6">
        <LoadingState v-if="isLoading" text="Drone doğrulama yükleniyor…" />
        <EmptyState v-else-if="!summary" :icon="Plane" title="Bu mahalle için drone doğrulaması yok" description="Bir drone çekimi analiz edildiğinde burada görünür: parselin kayıttaki niteliği ile görüntüde görülen bitki örtüsü yan yana konur." />
        <template v-else>
            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle class="flex flex-wrap items-center gap-2">
                        Drone destekli arazi doğrulama
                        <Badge variant="warning">Ön değerlendirme</Badge>
                        <Badge v-if="summary.licenceSource === 'demo'" variant="warning">DEMO ruhsat kaydı</Badge>
                        <Badge variant="outline">İdari karar üretmez</Badge>
                    </CardTitle>
                    <CardDescription>
                        Kayıt bir parselin ne olması gerektiğini söyler (tapu niteliği, ruhsat); drone görüntüsü üzerinde gerçekte ne olduğunu gösterir. Bu modül ikisini parsel bazında karşılaştırır ve her sonucun kanıtını saklar: hangi çekim, hangi kareler, videonun hangi saniyeleri.
                        Drone görüntüsü birincil kaynaktır, uydu destekleyici. Uyuşmazlık yalnız yerinde kontrol önerir.
                        <template v-if="source"><br />Kaynak: <strong>{{ source.title }}</strong> · {{ source.origin }} · {{ source.capturedAtNote }}</template>
                    </CardDescription>
                </CardHeader>
            </Card>

            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Çay mevcut" :value="formatNumber(summary.counts.byClass.tea_present)" :hint="`analiz edilen ${summary.counts.analysed} parselden`" :icon="Plane" />
                <StatCard label="Çay bulunamadı" :value="formatNumber(summary.counts.byClass.tea_not_found)" hint="kayıtta çay varsa yerinde kontrol önerilir" />
                <StatCard label="Kısmen / belirsiz" :value="formatNumber(summary.counts.byClass.partial + summary.counts.byClass.uncertain)" :hint="`inceleme gerekli: ${summary.counts.needsReview} parsel`" />
                <StatCard label="Analiz edilmedi" :value="formatNumber(summary.counts.byClass.not_analysed)" :hint="`${formatNumber(summary.counts.parcels)} parselden · drone görüntüsü yok`" />
            </div>

            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Parsel haritası</CardTitle>
                    <CardDescription>Sınırlar TKGM kadastro geometrisidir; renk, drone görüntüsünden çıkan sınıftır. Bir parsele tıklayınca kayıt, video, kanıt kareleri ve karşılaştırma açılır.</CardDescription>
                </CardHeader>
                <CardContent class="flex flex-col gap-3 pb-4">
                    <!-- isolate: Leaflet panes carry z-indexes up to 1000; without their own stacking context they sit above the parcel sheet. -->
                    <div ref="overviewContainer" class="isolate h-[28rem] w-full overflow-hidden rounded-lg border" />
                    <div v-if="summary.orthophoto" class="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button variant="outline" class="min-h-11 shrink-0 md:min-h-9" :aria-pressed="showOrtho" @click="showOrtho = !showOrtho">{{ showOrtho ? 'Drone görüntüsünü gizle' : 'Drone görüntüsünü göster' }}</Button>
                        <p class="text-xs text-muted-foreground">
                            Yaklaşık ortofoto (ön değerlendirme): videonun {{ summary.orthophoto.framesUsed }} karesinden {{ summary.orthophoto.coveredHa }} ha, {{ summary.orthophoto.resolutionM }} m/piksel. Konum hatası kontrol binalarında ortalama {{ summary.orthophoto.georefRmsM }} m (en büyük {{ summary.orthophoto.georefMaxResidualM }} m);
                            çatılar ve ağaç tepeleri yatık görünür. Sınır tespiti ve alan ölçümü için kullanılmaz.
                        </p>
                    </div>
                    <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                        <span class="flex items-center gap-1.5"><span class="size-3 rounded-sm" :style="{ background: CLASS_META.tea_present.color }" />Çay varlığı destekleniyor</span>
                        <span class="flex items-center gap-1.5"><span class="size-3 rounded-sm" :style="{ background: CLASS_META.tea_not_found.color }" />Çay bulunamadı</span>
                        <span class="flex items-center gap-1.5"><span class="size-3 rounded-sm" :style="{ background: CLASS_META.partial.color }" />Kısmen çay / ek inceleme</span>
                        <span class="flex items-center gap-1.5"><span class="size-3 rounded-sm" :style="{ background: CLASS_META.not_analysed.color }" />Analiz edilmedi / veri yok</span>
                    </div>
                </CardContent>
            </Card>

            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Parseller</CardTitle>
                    <CardDescription>Ada/parsel ile sorgulanır; uyuşmazlık ve inceleme gerektirenler üstte.</CardDescription>
                </CardHeader>
                <CardContent class="px-0 pb-0">
                    <div class="flex flex-col gap-3 border-t p-4 md:flex-row md:items-end">
                        <div class="flex flex-1 flex-col gap-1.5">
                            <Label for="drone-search">Ada/parsel, nitelik ya da mevkii</Label>
                            <Input id="drone-search" v-model="search" placeholder="örn. 106/23" class="h-11 md:h-9" />
                        </div>
                        <div class="flex flex-col gap-1.5 md:w-72">
                            <Label for="drone-class">Görüntü sınıfı</Label>
                            <Select :model-value="classFilter" @update:model-value="onClass">
                                <SelectTrigger id="drone-class" class="h-11 w-full md:h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="f in CLASS_FILTERS" :key="f.value" :value="f.value">{{ f.label }}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <LoadingState v-if="isLoadingRows" text="Parseller yükleniyor…" class="border-t p-6" />
                    <p v-else-if="!rows.length" class="border-t p-6 text-sm text-muted-foreground">Bu filtreye uyan parsel yok.</p>
                    <div v-else class="overflow-x-auto border-t">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ada/Parsel</TableHead>
                                    <TableHead>Kayıt</TableHead>
                                    <TableHead>Drone görüntüsü</TableHead>
                                    <TableHead>Doğrulama durumu</TableHead>
                                    <TableHead>Analiz tarihi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="r in rows" :key="r.key" class="cursor-pointer" tabindex="0" @click="open(r.block, r.parcel)" @keydown.enter="open(r.block, r.parcel)">
                                    <TableCell class="font-medium">
                                        {{ r.block }}/{{ r.parcel }}
                                        <div class="text-xs text-muted-foreground">{{ r.locality || '—' }} · {{ formatM2(r.areaM2) }}</div>
                                    </TableCell>
                                    <TableCell class="text-sm">
                                        {{ r.nature }}
                                        <div class="text-xs text-muted-foreground">{{ r.licensed ? 'ruhsatlı' : 'ruhsat kaydı yok' }}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge :variant="toneVariant(CLASS_META[r.class].tone)">{{ CLASS_META[r.class].label }}</Badge>
                                        <div v-if="r.confidence" class="mt-1 text-xs text-muted-foreground">{{ CONFIDENCE_META[r.confidence].label }}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge :variant="toneVariant(STATUS_META[r.status].tone)">{{ STATUS_META[r.status].label }}</Badge>
                                    </TableCell>
                                    <TableCell class="text-sm tabular-nums">{{ r.analysedAt ?? '—' }}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <div v-if="pages > 1" class="flex items-center justify-between border-t p-4">
                        <span class="text-sm text-muted-foreground">Sayfa {{ page }} / {{ pages }} · {{ formatNumber(total) }} parsel</span>
                        <div class="flex gap-2">
                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page <= 1" aria-label="Önceki sayfa" @click="page--"><ChevronLeft aria-hidden="true" /></Button>
                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page >= pages" aria-label="Sonraki sayfa" @click="page++"><ChevronRight aria-hidden="true" /></Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card v-if="summary.georeference" class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle class="flex flex-wrap items-center gap-2">
                        Videodan haritalama
                        <Badge variant="warning">yaklaşık bindirme</Badge>
                    </CardTitle>
                    <CardDescription>
                        {{ summary.georeference.method }}
                        {{ summary.georeference.model.frames }} kare · {{ formatNumber(summary.georeference.model.points) }} 3B nokta · {{ summary.georeference.controls.length }} kontrol binası · ortalama hata {{ summary.georeference.rmsM }} m (en büyük {{ summary.georeference.maxResidualM }} m) ·
                        bu karede tam görünen {{ summary.georeference.parcelsInView.length }} parsel.
                    </CardDescription>
                </CardHeader>
                <CardContent class="flex flex-col gap-2 border-t py-4">
                    <img :src="summary.imageryBaseUrl + summary.georeference.referenceImage" :alt="`Videonun ${clock(summary.georeference.referenceT)} anındaki kare üzerine bindirilmiş TKGM parsel sınırları`" class="w-full rounded-lg border" />
                    <p class="text-xs text-muted-foreground">
                        Çizgiler TKGM parsel sınırlarıdır (videoya yaklaşık bindirme). Bindirme birkaç metre kayık olabilir: bina izlerinin kendisi dik arazide metrelerce kayıktır ve zemin modeli kabadır.
                        Santimetre düzeyi için RTK/PPK konumlu çekim gerekir.
                    </p>
                </CardContent>
            </Card>

            <div class="grid gap-6 lg:grid-cols-2">
                <Card class="gap-0 py-0">
                    <CardHeader class="py-4">
                        <CardTitle>Bu çekim neyi destekliyor</CardTitle>
                        <CardDescription>
                            {{ summary.capture.width }}×{{ summary.capture.height }} piksel · {{ summary.capture.bitrateMbps }} Mb/sn · {{ clock(summary.capture.durationS) }} · incelenen bölüm {{ clock(summary.capture.shot[0]) }}–{{ clock(summary.capture.shot[1]) }} ·
                            uçuş kaydı {{ summary.capture.hasFlightLog ? 'var' : 'yok' }} · kamera kalibrasyonu {{ summary.capture.hasCameraCalibration ? 'var' : 'yok' }}
                        </CardDescription>
                    </CardHeader>
                    <CardContent class="flex flex-col gap-3 border-t py-4 text-sm">
                        <div v-for="s in summary.suitability" :key="s.topic" class="flex flex-col gap-1">
                            <div class="flex flex-wrap items-center gap-2 font-medium">
                                {{ s.topic }}
                                <Badge :variant="toneVariant(VERDICT_META[s.verdict].tone)">{{ VERDICT_META[s.verdict].label }}</Badge>
                            </div>
                            <p class="text-muted-foreground">{{ s.text }}</p>
                        </div>
                    </CardContent>
                </Card>

                <div class="flex flex-col gap-6">
                    <Card class="gap-0 py-0">
                        <CardHeader class="py-4">
                            <CardTitle class="flex flex-wrap items-center gap-2">
                                Otomatik çay sınıflandırması
                                <Badge :variant="summary.validation.usable ? 'success' : 'warning'">{{ summary.validation.usable ? 'eşiği geçti' : 'deneysel' }}</Badge>
                            </CardTitle>
                            <CardDescription>{{ summary.validation.method }}</CardDescription>
                        </CardHeader>
                        <CardContent class="flex flex-col gap-2 border-t py-4 text-sm">
                            <p>
                                Doğruluk <strong>{{ pct(summary.validation.accuracy) }}</strong> · çay yakalama <strong>{{ pct(summary.validation.teaRecall) }}</strong> · çay kesinliği <strong>{{ pct(summary.validation.teaPrecision) }}</strong>
                                ({{ formatNumber(summary.validation.pixels) }} piksel, {{ summary.validation.frames.length }} kare).
                            </p>
                            <p v-if="summary.validation.transfer" class="text-muted-foreground">
                                Videonun başka çekimlerine aktarımda doğruluk {{ pct(summary.validation.transfer.accuracy) }}, çay yakalama {{ pct(summary.validation.transfer.teaRecall) }}: model ışık ve yükseklik değişince tutmuyor.
                            </p>
                            <p v-if="summary.validation.referenceTeaRange && summary.validation.referenceOtherRange" class="text-muted-foreground">
                                Bilinen çay alanlarında “çay” denen pay {{ pct(summary.validation.referenceTeaRange[0]) }}–{{ pct(summary.validation.referenceTeaRange[2]) }} (ortanca {{ pct(summary.validation.referenceTeaRange[1]) }});
                                çay olmayan bitki alanlarında {{ pct(summary.validation.referenceOtherRange[0]) }}–{{ pct(summary.validation.referenceOtherRange[2]) }} (ortanca {{ pct(summary.validation.referenceOtherRange[1]) }}). İki aralık üst üste biniyor.
                            </p>
                            <p v-if="!summary.validation.usable">
                                Eşik: çay yakalama ve kesinlik en az {{ pct(summary.rules.usableTeaRecall) }}. Karşılanmadığı için otomatik sonuç haritayı renklendirmez; sınıf görsel incelemeden gelir ve otomatik sonuç yanında bilgi olarak gösterilir.
                            </p>
                        </CardContent>
                    </Card>

                    <Card class="gap-0 py-0">
                        <CardHeader class="py-4">
                            <CardTitle>Ölçülü haritalamaya geçiş</CardTitle>
                            <CardDescription>Modülün kayıt yapısı aşağıdaki kaynak türlerini taşır; her biri farklı bir soruyu yanıtlar.</CardDescription>
                        </CardHeader>
                        <CardContent class="flex flex-col gap-3 border-t py-4 text-sm">
                            <div v-for="r in ROADMAP" :key="r.source" class="flex flex-col gap-1">
                                <div class="flex flex-wrap items-center gap-2 font-medium">
                                    {{ r.source }}
                                    <Badge :variant="r.now ? 'info' : 'outline'">{{ r.now ? 'şu an' : 'planlanan' }}</Badge>
                                </div>
                                <p class="text-muted-foreground">{{ r.gives }} <span class="text-foreground">{{ r.now ? 'Vermediği:' : 'Koşul:' }}</span> {{ r.needs }}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </template>

        <Sheet v-model:open="sheetOpen">
            <SheetContent class="w-full overflow-y-auto sm:max-w-5xl">
                <LoadingState v-if="isLoadingDetail" text="Parsel yükleniyor…" class="p-6" />
                <template v-else-if="detail">
                    <SheetHeader class="border-b">
                        <SheetTitle>{{ summary?.neighborhood }} {{ detail.block }}/{{ detail.parcel }}</SheetTitle>
                        <SheetDescription>{{ detail.locality || 'mevkii yok' }} · tapu alanı {{ detail.deedAreaM2 === null ? '—' : formatM2(detail.deedAreaM2) }}</SheetDescription>
                        <div class="flex flex-wrap items-center gap-2">
                            <Badge :variant="toneVariant(CLASS_META[detail.class].tone)">{{ CLASS_META[detail.class].label }}</Badge>
                            <Badge :variant="toneVariant(STATUS_META[detail.status].tone)">{{ STATUS_META[detail.status].label }}</Badge>
                            <Badge v-if="detail.confidence" :variant="toneVariant(CONFIDENCE_META[detail.confidence].tone)">{{ CONFIDENCE_META[detail.confidence].label }}</Badge>
                            <Badge variant="outline">ön değerlendirme</Badge>
                        </div>
                    </SheetHeader>
                    <div class="flex flex-col gap-4 p-4 text-sm">
                        <div class="overflow-x-auto rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Kaynak</TableHead>
                                        <TableHead>Ne diyor</TableHead>
                                        <TableHead>Ayrıntı</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow>
                                        <TableCell class="font-medium">Tapu niteliği</TableCell>
                                        <TableCell>{{ detail.titleTea ? 'çay bahçesi' : 'çay yok' }}</TableCell>
                                        <TableCell class="text-xs text-muted-foreground">{{ detail.nature }}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell class="font-medium">Ruhsat kaydı</TableCell>
                                        <TableCell>{{ detail.licence.licensed ? 'ruhsatlı' : 'kayıt yok' }}</TableCell>
                                        <TableCell class="text-xs text-muted-foreground">{{ detail.licence.licensed ? `${detail.licence.codes.join(', ')}${detail.licence.areaM2 === null ? '' : ` · ${formatM2(detail.licence.areaM2)}`}` : '' }}{{ detail.licence.source === 'demo' ? ' DEMO kayıt' : '' }}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell class="font-medium">Drone görüntüsü</TableCell>
                                        <TableCell>{{ CLASS_META[detail.class].label.toLocaleLowerCase('tr') }}</TableCell>
                                        <TableCell class="text-xs text-muted-foreground">
                                            <template v-if="detail.drone">{{ detail.drone.classSource === 'review' ? 'görsel inceleme' : 'otomatik sınıflandırma' }} · {{ detail.drone.sourceTitle }} · analiz {{ detail.drone.analysedAt }}</template>
                                            <template v-else>{{ CLASS_META.not_analysed.note }}</template>
                                        </TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell class="font-medium">Uydu (destekleyici)</TableCell>
                                        <TableCell>{{ SATELLITE_LABEL[detail.satellite.tea] ?? detail.satellite.tea }}</TableCell>
                                        <TableCell class="text-xs text-muted-foreground">parselin {{ pct(detail.satellite.teaShare) }} kadarı çay · {{ detail.satellite.fullPixels }} tam piksel (10 m)</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>

                        <template v-if="detail.drone">
                            <div v-if="detail.drone.discrepancy" class="rounded-lg border border-warning/40 bg-warning/10 p-3">
                                <div class="font-medium">Uyuşmazlık</div>
                                <p>{{ detail.drone.discrepancy }}</p>
                            </div>
                            <div class="rounded-lg border p-3">
                                <div class="font-medium">Önerilen işlem</div>
                                <p>{{ detail.drone.action }}</p>
                            </div>
                            <p v-if="detail.drone.hypothesis" class="text-muted-foreground"><span class="font-medium text-foreground">Başlangıç gözlemi (saha ekibi):</span> {{ detail.drone.hypothesis }}</p>

                            <div v-if="frame" class="grid gap-4 lg:grid-cols-2">
                                <div class="flex flex-col gap-2">
                                    <div class="flex flex-wrap items-center justify-between gap-2">
                                        <div class="font-medium">Drone görüntüsü</div>
                                        <div class="flex gap-2">
                                            <Button v-if="clip" :variant="mode === 'video' ? 'default' : 'outline'" class="h-11 md:h-9" @click="mode = 'video'">Video</Button>
                                            <Button :variant="mode === 'frame' ? 'default' : 'outline'" class="h-11 md:h-9" @click="mode = 'frame'">Kare</Button>
                                            <Button :variant="mode === 'classes' ? 'default' : 'outline'" class="h-11 md:h-9" @click="mode = 'classes'">Otomatik sınıflar</Button>
                                        </div>
                                    </div>
                                    <div v-if="mode === 'video' && clip" class="relative overflow-hidden rounded-lg border bg-black">
                                        <video ref="videoEl" :src="clip.url" class="block w-full" controls muted loop playsinline preload="metadata" :aria-label="`${detail.block}/${detail.parcel} parselinin drone videosu`" @loadedmetadata="onVideoReady" />
                                        <svg :viewBox="`0 0 ${clip.width} ${clip.height}`" class="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
                                            <polygon v-if="cadastrePoints" :points="cadastrePoints" fill="none" stroke="#facc15" stroke-width="3" stroke-dasharray="12 8" stroke-linejoin="round" />
                                            <polygon v-if="overlayPoints" :points="overlayPoints" fill="none" :stroke="CLASS_META[detail.class].color" stroke-width="4" stroke-linejoin="round" />
                                        </svg>
                                    </div>
                                    <img v-else :src="mode === 'classes' ? frame.classesUrl : frame.frameUrl" :alt="`${detail.block}/${detail.parcel} parseli, videonun ${clock(frame.t)} anındaki kare`" class="w-full rounded-lg border" />
                                    <div class="flex flex-wrap gap-2">
                                        <Button v-for="(f, i) in detail.drone.frames" :key="f.t" :variant="i === frameIndex ? 'default' : 'outline'" class="h-11 tabular-nums md:h-9" @click="pickFrame(i)">{{ clock(f.t) }}{{ f.isReference ? ' ★' : '' }}</Button>
                                    </div>
                                    <p class="text-xs text-muted-foreground">
                                        <template v-if="mode === 'video'">Video konumu {{ clock(videoTime) }}. Çizim, parselin izlenebildiği {{ clock(detail.drone.video.visible[0]) }}–{{ clock(detail.drone.video.visible[1]) }} arasında videoyla birlikte hareket eder; dışında görünmez. </template>
                                        <template v-if="mode === 'video' && detail.drone.cadastreTrack.length">Kesikli sarı çizgi, videoya yaklaşık olarak bindirilen TKGM sınırıdır (ortalama hata {{ summary?.georeference?.rmsM ?? '—' }} m); sınır tespiti için kullanılmaz. </template>
                                        <template v-if="detail.drone.outline.kind === 'cadastre'">Çizgi, videoya yaklaşık olarak bindirilen TKGM sınırıdır (ortalama hata {{ summary?.georeference?.rmsM ?? '—' }} m): hangi parselin nerede olduğunu gösterir, sınır tespiti için kullanılmaz. ★ işaretli an, parselin karede en büyük göründüğü andır.</template>
                                        <template v-else>
                                            Düz çizgi elle çizilmiş yaklaşık eşleştirmedir; kadastro sınırı değildir.
                                            <template v-if="detail.drone.video.match">★ işaretli an, çizimin yapıldığı görselle eşleşen karedir ({{ detail.drone.video.match.inliers }} / {{ detail.drone.video.match.keypoints }} ortak nokta); diğer anlara çizim otomatik taşındı.</template>
                                        </template>
                                        <template v-if="mode === 'classes'">Yeşil: çay · sarı: diğer bitki · gri: yapı/yol. Bu karede çay payı {{ pct(frame.shares.tea) }}.</template>
                                    </p>
                                </div>
                                <div class="flex flex-col gap-2">
                                    <div class="flex h-11 items-center justify-between gap-2 font-medium md:h-9">
                                        <span>Kadastro sınırı, {{ summary?.orthophoto && showOrtho ? 'drone ortofotosu' : 'uydu' }}</span>
                                        <Button v-if="summary?.orthophoto" variant="outline" size="sm" class="min-h-11 md:min-h-9" :aria-pressed="showOrtho" @click="showOrtho = !showOrtho">{{ showOrtho ? 'Uyduya geç' : 'Drone ortofotosu' }}</Button>
                                    </div>
                                    <div ref="parcelContainer" class="aspect-video w-full overflow-hidden rounded-lg border" />
                                    <p v-if="summary?.orthophoto && showOrtho" class="text-xs text-muted-foreground">Drone görüntüsü videodan üretilen yaklaşık ortofotodur (konum hatası ortalama {{ summary.orthophoto.georefRmsM }} m); çizginin içi ile görüntü birkaç metre kayık olabilir.</p>
                                    <p class="text-xs text-muted-foreground">Çizgi TKGM parsel sınırıdır (WGS84). Altlık Google uydu görüntüsüdür; dik arazide birkaç metre kayık olabilir. Drone görüntüsü eğik bakışlıdır: iki görünüm yön ve ölçek olarak birebir örtüşmez.</p>
                                </div>
                            </div>

                            <div v-if="detail.drone.review" class="rounded-lg border p-3">
                                <div class="flex flex-wrap items-center gap-2 font-medium">
                                    Görsel inceleme
                                    <Badge :variant="detail.drone.review.verified ? 'success' : 'warning'">{{ detail.drone.review.verified ? 'eksper / saha doğruladı' : 'doğrulanmadı' }}</Badge>
                                </div>
                                <p>{{ detail.drone.review.note }}</p>
                                <p class="text-xs text-muted-foreground">{{ detail.drone.review.observer }} · {{ detail.drone.review.date }}</p>
                            </div>

                            <div class="rounded-lg border p-3">
                                <div class="flex flex-wrap items-center gap-2 font-medium">
                                    Otomatik sınıflandırma
                                    <Badge :variant="detail.drone.automatic.usable ? 'success' : 'warning'">{{ detail.drone.automatic.usable ? 'eşiği geçti' : 'deneysel' }}</Badge>
                                </div>
                                <p>
                                    {{ CLASS_META[detail.drone.automatic.class].label }} · çay payı ortanca {{ pct(detail.drone.automatic.teaShareMedian) }}, kareler arası fark {{ pct(detail.drone.automatic.teaShareSpread) }}
                                    <span v-for="(v, k) in detail.drone.automatic.otherShares" :key="k"> · {{ SHARE_LABEL[k] ?? k }} {{ pct(v) }}</span>
                                </p>
                            </div>

                            <ul v-if="detail.drone.notes.length" class="list-disc pl-5 text-xs text-muted-foreground">
                                <li v-for="n in detail.drone.notes" :key="n">{{ n }}</li>
                            </ul>
                        </template>
                        <template v-else>
                            <p class="text-muted-foreground">Bu parseli kapsayan drone görüntüsü henüz analiz edilmedi. Kayıt ve uydu okuması yukarıda; sınıf atanmadı.</p>
                            <div class="flex flex-col gap-2">
                                <div class="font-medium">Kadastro sınırı (TKGM)</div>
                                <div ref="parcelContainer" class="h-64 w-full overflow-hidden rounded-lg border" />
                                <p class="text-xs text-muted-foreground">Çizgi TKGM parsel sınırıdır (WGS84). Altlık Google uydu görüntüsüdür; dik arazide birkaç metre kayık olabilir.</p>
                            </div>
                        </template>
                    </div>
                </template>
            </SheetContent>
        </Sheet>
    </div>
</template>
