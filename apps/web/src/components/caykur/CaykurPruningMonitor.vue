<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { ChevronLeft, ChevronRight, Scissors, TriangleAlert, X } from '@lucide/vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EmptyState, LoadingState, StatCard } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toneVariant } from '@/components/caykur/tone';
import PruningCurve from '@/components/caykur/PruningCurve.vue';
import {
    api,
    type AreaPruning,
    type InventoryMap,
    type InventoryParcelDetail,
    type PruningImageryLayer,
    type PruningSeasonResult,
    type SatellitePruningStatus,
} from '@/services/api';
import { PRUNING_STATUS_META, PRUNING_STATUS_ORDER, formatDekar, formatM2, formatShare } from '@/services/caykur/teaInventory';
import { formatNumber } from '@/services/caykur';

/**
 * Pruning monitoring tab of the tea inventory: per season, how much of each parcel's tea
 * Sentinel-2 saw being pruned against the 1/7 rule, with the parcel's NDVI curve.
 * Uncalibrated until field-labelled seasons set the drop threshold — said on screen.
 */
const props = defineProps<{
    areaId: string;
    boundary: GeoJSON.Geometry;
    mapData: InventoryMap;
}>();

const ALL = 'all';
const PAGE_SIZE = 15;

const data = ref<AreaPruning | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);
const season = ref('');
const statusFilter = ref<SatellitePruningStatus | typeof ALL>(ALL);
const page = ref(1);
const selected = ref<InventoryParcelDetail | null>(null);
const showPatches = ref(true);
const imageryLayer = ref<PruningImageryLayer | 'none'>('change');

const IMAGERY_OPTIONS: Array<{ value: PruningImageryLayer | 'none'; label: string; hint: string }> = [
    { value: 'none', label: 'Kapalı', hint: 'Yalnızca altlık harita' },
    { value: 'reference', label: 'Ekim', hint: 'Budama öncesi referans görüntüsü' },
    { value: 'winter', label: 'Aralık–Ocak', hint: 'Kasım–Aralık budaması sonrası' },
    { value: 'spring', label: 'Mart', hint: 'Mart budaması sonrası' },
    { value: 'change', label: 'Değişim', hint: 'Çay piksellerinde mahalleye göre yeşillik düşüşü (budama sinyali)' },
];

const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let parcelLayer: L.GeoJSON | null = null;
let patchLayer: L.GeoJSON | null = null;
let boundaryLayer: L.GeoJSON | null = null;
let selectedLayer: L.GeoJSON | null = null;
let imageOverlay: L.ImageOverlay | null = null;
let baseLayer: L.TileLayer | null = null;

const summary = computed(() => data.value?.summary ?? null);
const seasons = computed(() => summary.value?.seasons ?? []);
const current = computed(() => seasons.value.find((s) => s.season === season.value) ?? null);
const resultById = computed(() => {
    const out = new Map<string, PruningSeasonResult>();
    for (const p of data.value?.parcels ?? []) {
        const r = p.seasons[season.value];
        if (r) out.set(p.id, r);
    }
    return out;
});
const rows = computed(() =>
    (data.value?.parcels ?? [])
        .map((p) => ({ ...p, result: p.seasons[season.value] }))
        .filter((p): p is typeof p & { result: PruningSeasonResult } => !!p.result)
        .filter((p) => statusFilter.value === ALL || p.result.status === statusFilter.value)
        .sort((a, b) => ratio(a.result) - ratio(b.result) || b.result.teaAreaM2 - a.result.teaAreaM2),
);
const totalPages = computed(() => Math.max(1, Math.ceil(rows.value.length / PAGE_SIZE)));
const pageRows = computed(() => rows.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE));
const selectedResult = computed(() => (selected.value?.pruning?.seasons[season.value] as PruningSeasonResult | undefined) ?? null);
const selectedWindows = computed(() => current.value?.windows ?? null);
const imageryInfo = computed(() => {
    const layer = imageryLayer.value;
    const imagery = summary.value?.imagery;
    return layer === 'none' || !imagery ? null : (imagery.seasons[season.value]?.[layer] ?? null);
});

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
function formatSceneDate(d: string): string {
    return `${Number(d.slice(8))} ${MONTHS_TR.at(Number(d.slice(5, 7)) - 1)} ${d.slice(0, 4)}`;
}

function ratio(r: PruningSeasonResult): number {
    return r.requiredM2 > 0 ? r.prunedM2 / r.requiredM2 : 0;
}
function seasonLabel(s: string): string {
    const [a, b] = s.split('-');
    return `${a}–20${b}`;
}

// ── Loading ──
async function load(): Promise<void> {
    isLoading.value = true;
    const res = await api.getInventoryPruning(props.areaId);
    if (res.data) {
        data.value = res.data;
        season.value = res.data.summary?.seasons.at(-1)?.season ?? '';
    } else {
        error.value = res.error?.message ?? 'Budama verisi alınamadı';
    }
    isLoading.value = false;
    await nextTick();
    renderMap();
}

async function selectParcel(id: string): Promise<void> {
    const res = await api.getInventoryParcel(id);
    if (res.data) {
        selected.value = res.data;
        highlightSelected();
    }
}

// ── Map ──
function cssVar(name: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function parcelStyle(id: string): L.PathOptions {
    const r = resultById.value.get(id);
    if (!r) {
        return { color: cssVar('--muted-foreground', '#64748b'), weight: 0.5, opacity: 0.4, fill: false };
    }
    const meta = PRUNING_STATUS_META[r.status];
    const color = cssVar(meta.colorVar, '#64748b');
    const dimmed = statusFilter.value !== ALL && statusFilter.value !== r.status;
    return {
        color,
        weight: 1,
        dashArray: meta.hollow ? '4 3' : undefined,
        fillColor: color,
        fillOpacity: dimmed ? 0.04 : meta.hollow ? 0.08 : 0.45,
        opacity: dimmed ? 0.25 : 0.9,
    };
}

function renderMap(): void {
    if (!mapContainer.value || !summary.value) return;
    if (!map) {
        map = L.map(mapContainer.value, { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
        baseLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            maxNativeZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        }).addTo(map);
        L.control.zoom({ position: 'topright' }).addTo(map);
        boundaryLayer = L.geoJSON(props.boundary, {
            style: { color: cssVar('--background', '#ffffff'), weight: 2, dashArray: '6 4', fill: false },
            interactive: false,
        }).addTo(map);
        parcelLayer = L.geoJSON(props.mapData, {
            style: (f) => parcelStyle(f?.properties.id as string),
            onEachFeature: (f, layer) => {
                const p = f.properties as InventoryMap['features'][number]['properties'];
                layer.bindTooltip(() => {
                    const r = resultById.value.get(p.id);
                    return `${p.block}/${p.parcel} · ${r ? PRUNING_STATUS_META[r.status].label : 'çay yok'}`;
                }, { sticky: true });
                layer.on('click', () => {
                    if (resultById.value.has(p.id)) void selectParcel(p.id);
                });
            },
        }).addTo(map);
        map.fitBounds(boundaryLayer.getBounds(), { padding: [16, 16] });
    }
    renderImagery();
    renderPatches();
}

/** Sentinel-2 overlay of the chosen season window, drawn between the base map and the parcels. */
function renderImagery(): void {
    imageOverlay?.remove();
    imageOverlay = null;
    const imagery = summary.value?.imagery;
    // A Sentinel photo over the sharp (undated) base map is easy to mistake for the base map;
    // fade the base map whenever a dated scene is shown.
    baseLayer?.setOpacity(imageryLayer.value === 'none' || imageryLayer.value === 'change' ? 1 : 0.25);
    if (!map || !imagery || !imageryInfo.value) return;
    const { west, south, east, north } = imagery.bounds;
    imageOverlay = L.imageOverlay(`${imagery.baseUrl}${imageryInfo.value.file}`, [[south, west], [north, east]], {
        opacity: imageryLayer.value === 'change' ? 0.9 : 1,
        alt: imageryInfo.value.sceneDate ? `Sentinel-2, ${imageryInfo.value.sceneDate}` : 'Sentinel-2 değişim katmanı',
        interactive: false,
    }).addTo(map);
    // Below the parcel outlines (same pane), above the base map (tile pane).
    imageOverlay.bringToBack();
}

function renderPatches(): void {
    patchLayer?.remove();
    patchLayer = null;
    if (!map || !current.value || !showPatches.value) return;
    patchLayer = L.geoJSON(
        { type: 'FeatureCollection', features: current.value.patches.map((p) => ({ type: 'Feature', geometry: p.geometry, properties: {} })) } as GeoJSON.FeatureCollection,
        { style: { color: cssVar('--info', '#1e3a8a'), weight: 1.25, fillColor: cssVar('--info', '#1e3a8a'), fillOpacity: 0.35 }, interactive: false },
    ).addTo(map);
}

function highlightSelected(): void {
    selectedLayer?.remove();
    if (!map || !selected.value) return;
    selectedLayer = L.geoJSON(selected.value.geometry, {
        style: { color: cssVar('--background', '#ffffff'), weight: 3, fill: false },
        interactive: false,
    }).addTo(map);
    map.fitBounds(selectedLayer.getBounds(), { maxZoom: 18, padding: [80, 80] });
}

function clearSelection(): void {
    selected.value = null;
    selectedLayer?.remove();
    selectedLayer = null;
    if (map && boundaryLayer) map.fitBounds(boundaryLayer.getBounds(), { padding: [16, 16] });
}

watch([season, statusFilter], () => {
    page.value = 1;
    parcelLayer?.setStyle((f) => parcelStyle(f?.properties.id as string));
    renderImagery();
    renderPatches();
});
watch(showPatches, renderPatches);
watch(imageryLayer, renderImagery);

onMounted(() => void load());
onBeforeUnmount(() => {
    map?.remove();
    map = null;
});

function onSeason(v: unknown): void {
    if (typeof v === 'string' && v !== '') season.value = v;
}
function onImagery(v: unknown): void {
    if (typeof v === 'string' && v !== '') imageryLayer.value = v as PruningImageryLayer | 'none';
}
function onStatus(v: unknown): void {
    statusFilter.value = typeof v === 'string' && v !== '' ? (v as SatellitePruningStatus | typeof ALL) : ALL;
}
function onRowKey(e: KeyboardEvent, id: string): void {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        void selectParcel(id);
    }
}
</script>

<template>
    <LoadingState v-if="isLoading" text="Budama verisi yükleniyor…" />

    <EmptyState v-else-if="error" title="Budama verisi yüklenemedi" :description="error">
        <Button variant="outline" class="h-11 md:h-9" @click="load">Tekrar dene</Button>
    </EmptyState>

    <EmptyState
        v-else-if="!summary || seasons.length === 0"
        :icon="Scissors"
        title="Bu alan için budama analizi yok"
        description="Uydu budama analizi çalıştırılıp içe aktarıldığında burada görünür."
    />

    <div v-else class="flex flex-col gap-6">
        <Alert variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle class="flex flex-wrap items-center gap-2">
                Kalibre edilmedi
                <Badge variant="warning">Ön sonuç</Badge>
            </AlertTitle>
            <AlertDescription>
                Budama, aynı sezon içinde Ekim–Kasım, Aralık–Ocak ve Mart–Nisan Sentinel-2 görüntülerinin karşılaştırılmasıyla tahmin edilir.
                Düşüş eşiği sahada budandığı bilinen bahçelerle henüz ayarlanmadı; eşik değişince budanan alan birkaç kat değişebilir.
                10 m piksel nedeniyle küçük parsellerde karar verilemez. Sonuçlar denetim önceliğidir, yaptırım veya tazminat kararı için kullanılamaz.
            </AlertDescription>
        </Alert>

        <div class="flex flex-wrap items-center gap-3">
            <span class="text-sm text-muted-foreground">Budama sezonu</span>
            <ToggleGroup :model-value="season" type="single" aria-label="Budama sezonu" @update:model-value="onSeason">
                <ToggleGroupItem v-for="s in seasons" :key="s.season" :value="s.season" class="h-11 px-3 md:h-9">
                    {{ seasonLabel(s.season) }}
                </ToggleGroupItem>
            </ToggleGroup>
        </div>

        <section v-if="current" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Sezon özeti">
            <StatCard
                label="Uyduda görülen budama"
                :value="formatDekar(current.prunedM2)"
                :hint="`çayın ${formatShare(current.prunedShareOfTea)}'i · kurala göre beklenen ${formatShare(current.expectedShare)}`"
            />
            <StatCard
                label="Kış / Mart budaması"
                :value="`${formatDekar(current.winterPrunedM2)} / ${formatDekar(current.springPrunedM2)}`"
                hint="Kasım–Aralık ve Mart dönemleri"
            />
            <StatCard
                label="1/7 karşılanan parsel"
                :value="formatNumber(current.statusCounts.pruned)"
                :hint="`${formatNumber(current.statusCounts.partial)} kısmi · ${formatNumber(current.statusCounts.no_trace)} izi yok`"
            />
            <StatCard
                label="Kararsız parsel"
                :value="formatNumber(current.statusCounts.too_small + current.statusCounts.insufficient_observation)"
                hint="10 m için küçük veya gözlem yetersiz"
            />
        </section>

        <div class="-mx-1 overflow-x-auto px-1 pb-1">
            <ToggleGroup :model-value="statusFilter" type="single" aria-label="Budama durumu filtresi" class="w-max" @update:model-value="onStatus">
                <ToggleGroupItem :value="ALL" class="h-11 px-3 md:h-9">Tümü</ToggleGroupItem>
                <ToggleGroupItem v-for="s in PRUNING_STATUS_ORDER" :key="s" :value="s" :title="PRUNING_STATUS_META[s].description" class="h-11 px-3 md:h-9">
                    {{ PRUNING_STATUS_META[s].label }}
                    <Badge v-if="current" :variant="toneVariant(PRUNING_STATUS_META[s].tone)" class="tabular-nums">{{ formatNumber(current.statusCounts[s]) }}</Badge>
                </ToggleGroupItem>
            </ToggleGroup>
        </div>

        <div class="grid gap-4 lg:grid-cols-3">
            <Card class="gap-0 overflow-hidden py-0 lg:col-span-2">
                <CardHeader class="border-b py-4">
                    <CardTitle>Budama haritası</CardTitle>
                    <CardDescription>Parseller 1/7 durumuna göre renkli; mavi alanlar uydunun budanmış gördüğü pikseller.</CardDescription>
                    <CardAction class="flex items-center gap-2">
                        <Switch id="pruning-patches" v-model="showPatches" />
                        <Label for="pruning-patches" class="text-xs">Budanan alanlar</Label>
                    </CardAction>
                </CardHeader>
                <div v-if="summary.imagery" class="flex flex-wrap items-center gap-3 border-b px-4 py-3">
                    <span class="text-xs text-muted-foreground">Uydu görüntüsü (Sentinel-2)</span>
                    <ToggleGroup :model-value="imageryLayer" type="single" size="sm" aria-label="Uydu görüntüsü katmanı" @update:model-value="onImagery">
                        <ToggleGroupItem v-for="o in IMAGERY_OPTIONS" :key="o.value" :value="o.value" :title="o.hint" class="h-11 px-3 md:h-8">{{ o.label }}</ToggleGroupItem>
                    </ToggleGroup>
                    <span v-if="imageryInfo?.sceneDate" class="text-xs text-muted-foreground">
                        <span class="font-semibold text-foreground tabular-nums">{{ formatSceneDate(imageryInfo.sceneDate) }}</span> tarihli tek sahne
                        · dönemde {{ imageryInfo.scenes }} bulutsuz sahne · siyah: bulut/kar maskesi
                    </span>
                    <span v-else-if="imageryLayer === 'change'" class="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span class="inline-block h-2 w-16 rounded-sm bg-linear-to-r from-amber-200 via-orange-500 to-red-700" aria-hidden="true" />
                        hafif → güçlü yeşillik düşüşü
                    </span>
                </div>
                <div ref="mapContainer" class="h-105 w-full md:h-140" role="region" aria-label="Budama haritası" />
            </Card>

            <Card v-if="selected" class="gap-4">
                <CardHeader>
                    <CardTitle>Ada {{ selected.block }} / Parsel {{ selected.parcel }}</CardTitle>
                    <CardDescription>{{ selected.nature }}</CardDescription>
                    <CardAction>
                        <Button variant="ghost" size="icon" class="size-11 md:size-9" aria-label="Seçimi kapat" @click="clearSelection">
                            <X aria-hidden="true" />
                        </Button>
                    </CardAction>
                </CardHeader>
                <CardContent class="space-y-4">
                    <template v-if="selectedResult">
                        <div class="space-y-1">
                            <Badge :variant="toneVariant(PRUNING_STATUS_META[selectedResult.status].tone)">{{ PRUNING_STATUS_META[selectedResult.status].label }}</Badge>
                            <p class="text-sm text-muted-foreground">{{ PRUNING_STATUS_META[selectedResult.status].description }}</p>
                        </div>
                        <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                            <div><dt class="text-muted-foreground">Uydu çay alanı</dt><dd class="font-semibold text-foreground tabular-nums">{{ formatM2(selectedResult.teaAreaM2) }}</dd></div>
                            <div><dt class="text-muted-foreground">1/7 hedefi</dt><dd class="font-semibold text-foreground tabular-nums">{{ formatM2(selectedResult.requiredM2) }}</dd></div>
                            <div><dt class="text-muted-foreground">Görülen budama</dt><dd class="font-semibold text-foreground tabular-nums">{{ formatM2(selectedResult.prunedM2) }}</dd></div>
                            <div><dt class="text-muted-foreground">Hedefe oran</dt><dd class="font-semibold text-foreground tabular-nums">{{ formatShare(ratio(selectedResult)) }}</dd></div>
                            <div><dt class="text-muted-foreground">Kış / Mart</dt><dd class="text-foreground tabular-nums">{{ formatM2(selectedResult.winterPrunedM2) }} / {{ formatM2(selectedResult.springPrunedM2) }}</dd></div>
                            <div><dt class="text-muted-foreground">Radar VH değişimi</dt><dd class="text-foreground tabular-nums">{{ selectedResult.vhChangeDb === null ? '—' : `${selectedResult.vhChangeDb.toLocaleString('tr-TR')} dB` }}</dd></div>
                        </dl>
                    </template>
                </CardContent>
            </Card>

            <Card v-else class="gap-4">
                <CardHeader>
                    <CardTitle>Durumlar</CardTitle>
                    <CardDescription>Haritada bir parsele tıklayın; budama eğrisi burada açılır.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ul class="flex flex-col gap-3">
                        <li v-for="s in PRUNING_STATUS_ORDER" :key="s" class="flex flex-col gap-1">
                            <div class="flex items-center justify-between gap-2">
                                <Badge :variant="toneVariant(PRUNING_STATUS_META[s].tone)">{{ PRUNING_STATUS_META[s].label }}</Badge>
                                <span v-if="current" class="text-sm font-semibold text-foreground tabular-nums">{{ formatNumber(current.statusCounts[s]) }}</span>
                            </div>
                            <p class="text-xs text-muted-foreground">{{ PRUNING_STATUS_META[s].description }}</p>
                        </li>
                    </ul>
                </CardContent>
            </Card>
        </div>

        <Card v-if="selected && summary.series && selected.pruning && selectedWindows" class="gap-4">
            <CardHeader>
                <CardTitle>Budama eğrisi · Ada {{ selected.block }} / Parsel {{ selected.parcel }}</CardTitle>
                <CardDescription>
                    Parselin çay piksellerinin NDVI değeri ve mahalle ortancası. Budama, parsel çizgisinin referans döneminden sonra
                    mahalle ortancasının belirgin altına inmesiyle görülür; gölgeli bantlar {{ seasonLabel(season) }} sezonunun karşılaştırılan dönemleri.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <PruningCurve
                    :dates="summary.series.dates"
                    :values="selected.pruning.ndvi"
                    :median="summary.series.neighborhoodMedian"
                    :windows="selectedWindows"
                    :min-scene-tea-median="summary.minSceneTeaMedian"
                />
            </CardContent>
        </Card>

        <Card class="gap-0 py-0">
            <CardHeader class="border-b py-4">
                <CardTitle>Parseller</CardTitle>
                <CardDescription aria-live="polite">{{ formatNumber(rows.length) }} parsel · 1/7 hedefine oranı en düşükten başlayarak</CardDescription>
            </CardHeader>
            <CardContent class="px-0">
                <div v-if="pageRows.length" class="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow class="hover:bg-transparent">
                                <TableHead class="pl-4">Ada / Parsel</TableHead>
                                <TableHead class="text-right">Çay alanı</TableHead>
                                <TableHead class="hidden text-right md:table-cell">1/7 hedefi</TableHead>
                                <TableHead class="text-right">Görülen budama</TableHead>
                                <TableHead class="pr-4">Durum</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow
                                v-for="r in pageRows"
                                :key="r.id"
                                class="cursor-pointer"
                                :class="selected?.id === r.id && 'bg-muted/50'"
                                tabindex="0"
                                @click="selectParcel(r.id)"
                                @keydown="onRowKey($event, r.id)"
                            >
                                <TableCell class="pl-4">
                                    <span class="block font-medium text-foreground">{{ r.block }} / {{ r.parcel }}</span>
                                    <span class="block text-xs text-muted-foreground">{{ r.nature }}</span>
                                </TableCell>
                                <TableCell class="text-right font-semibold text-foreground tabular-nums">{{ formatM2(r.result.teaAreaM2) }}</TableCell>
                                <TableCell class="hidden text-right text-foreground tabular-nums md:table-cell">{{ formatM2(r.result.requiredM2) }}</TableCell>
                                <TableCell class="text-right">
                                    <span class="block font-semibold text-foreground tabular-nums">{{ formatM2(r.result.prunedM2) }}</span>
                                    <span class="block text-xs text-muted-foreground tabular-nums">hedefin {{ formatShare(ratio(r.result)) }}'i</span>
                                </TableCell>
                                <TableCell class="pr-4">
                                    <Badge :variant="toneVariant(PRUNING_STATUS_META[r.result.status].tone)">{{ PRUNING_STATUS_META[r.result.status].label }}</Badge>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
                <EmptyState v-else :icon="Scissors" title="Bu durumda parsel yok" description="Başka bir durum veya sezon seçin." class="rounded-none border-0" />
                <div v-if="totalPages > 1" class="flex items-center justify-between gap-3 border-t p-4">
                    <span class="text-xs text-muted-foreground tabular-nums">Sayfa {{ page }} / {{ totalPages }}</span>
                    <div class="flex gap-1">
                        <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page === 1" aria-label="Önceki sayfa" @click="page--">
                            <ChevronLeft aria-hidden="true" />
                        </Button>
                        <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page === totalPages" aria-label="Sonraki sayfa" @click="page++">
                            <ChevronRight aria-hidden="true" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
</template>
