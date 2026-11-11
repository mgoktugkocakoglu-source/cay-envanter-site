<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Info, Leaf, MapPinned, X } from '@lucide/vue';
import { TEA_INVENTORY_TABS, type TeaInventoryTab } from '@/services/caykur/nav';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import CaykurLayout from '@/layouts/CaykurLayout.vue';
import { EmptyState, ListToolbar, LoadingState, PageContainer, PageHeader, SearchInput, StatCard } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CaykurPruningMonitor from '@/components/caykur/CaykurPruningMonitor.vue';
import CaykurProducerPruning from '@/components/caykur/CaykurProducerPruning.vue';
import CaykurLicensing from '@/components/caykur/CaykurLicensing.vue';
import CaykurPruningRecords from '@/components/caykur/CaykurPruningRecords.vue';
import CaykurPruningFusion from '@/components/caykur/CaykurPruningFusion.vue';
import CaykurReports from '@/components/caykur/CaykurReports.vue';
import CaykurCalibration from '@/components/caykur/CaykurCalibration.vue';
import CaykurGardenHealth from '@/components/caykur/CaykurGardenHealth.vue';
import CaykurRegionOverview from '@/components/caykur/CaykurRegionOverview.vue';
import CaykurLandEvaluation from '@/components/caykur/CaykurLandEvaluation.vue';
import CaykurGardenAge from '@/components/caykur/CaykurGardenAge.vue';
import CaykurFieldTests from '@/components/caykur/CaykurFieldTests.vue';
import { useTkgmParcelLookup } from '@/composables/useTkgmParcelLookup';
import { toneVariant } from '@/components/caykur/tone';
import {
    api,
    type InventoryAreaDetail,
    type InventoryAreaSummary,
    type InventoryClass,
    type InventoryMap,
    type InventoryParcelDetail,
    type InventoryParcelRow,
    type InventoryParcelSortKey,
} from '@/services/api';
import {
    FLAGGED_INVENTORY_CLASSES,
    INVENTORY_CLASS_META,
    INVENTORY_CLASS_ORDER,
    formatHectare,
    formatM2,
    formatShare,
} from '@/services/caykur/teaInventory';
import { formatNumber } from '@/services/caykur';

/**
 * Tea inventory of one neighborhood: every TKGM parcel coloured by the
 * decision-matrix class (parcel × license × Sentinel tea detection), the
 * detected tea patches, and the parcels an inspector should visit first.
 * Classes are flags for an expert, not legal verdicts.
 */

const ALL = 'all';

// ── Area selection ──
const areas = ref<InventoryAreaSummary[]>([]);
const areaId = ref<string>('');
const tkgmLookup = useTkgmParcelLookup();
const area = ref<InventoryAreaDetail | null>(null);
const mapData = ref<InventoryMap | null>(null);
const isLoadingArea = ref(true);
const areaError = ref<string | null>(null);

// ── Parcel list ──
const classFilter = ref<InventoryClass | typeof ALL>(ALL);
const search = ref('');
const sortBy = ref<InventoryParcelSortKey>('gap');
const sortOrder = ref<'ASC' | 'DESC'>('DESC');
const page = ref(1);
const limit = 15;
const rows = ref<InventoryParcelRow[]>([]);
const total = ref(0);
const totalPages = ref(0);
const isLoadingRows = ref(false);

// ── Tabs: the inventory map stays mounted (v-show) and is resized when shown again ──
// The sidebar deep-links to tabs with `?tab=`; the strip and the address bar stay in sync.
const route = useRoute();
const router = useRouter();
const TAB_KEYS = TEA_INVENTORY_TABS.map((t) => t.key);
function tabFromRoute(): TeaInventoryTab {
    const q = route.query.tab;
    return typeof q === 'string' && (TAB_KEYS as string[]).includes(q) ? (q as TeaInventoryTab) : 'inventory';
}
const activeTab = ref<TeaInventoryTab>(tabFromRoute());
watch(() => route.query.tab, () => { const t = tabFromRoute(); if (t !== activeTab.value) activeTab.value = t; });
watch(activeTab, (tab) => {
    if (route.query.tab !== tab) void router.replace({ query: { ...route.query, tab } });
});
// Always carry the tab in the address bar so the sidebar highlights the matching entry.
if (route.query.tab !== activeTab.value) void router.replace({ query: { ...route.query, tab: activeTab.value } });
/** Tabs offered for the loaded area (the region tab needs more than one area). */
const visibleTabs = computed(() => TEA_INVENTORY_TABS.filter((t) => t.key !== 'region' || areas.value.length > 1));
const regionOverview = ref<InstanceType<typeof CaykurRegionOverview> | null>(null);
/** Areas grouped by district for the selector and the region tab (the pilot grows one district at a time). */
const areaGroups = computed(() => {
    const groups = new Map<string, InventoryAreaSummary[]>();
    for (const a of areas.value) {
        const key = `${a.province} / ${a.district}`;
        groups.set(key, [...(groups.get(key) ?? []), a]);
    }
    return [...groups.entries()].map(([label, items]) => ({ label, items }));
});
function openArea(id: string): void {
    areaId.value = id;
    activeTab.value = 'inventory';
}
// Pruning is judged per producer (1/7 of all their gardens); the parcel view stays for inspection.
type PruningView = 'fusion' | 'records' | 'producers' | 'reports' | 'calibration';
const PRUNING_VIEWS: PruningView[] = ['fusion', 'records', 'producers', 'reports', 'calibration'];
/** The v1 parcel/scene browser lives under the multi-sensor view as a collapsed inspection tool. */
const showParcelTool = ref(false);
const pruningView = ref<PruningView>('fusion');
function onPruningView(v: unknown): void {
    if (typeof v === 'string' && (PRUNING_VIEWS as string[]).includes(v)) pruningView.value = v as PruningView;
}
watch(activeTab, async (tab) => {
    await nextTick();
    if (tab === 'inventory') map?.invalidateSize();
    if (tab === 'region') regionOverview.value?.invalidate();
});

// ── Selection / map ──
const selected = ref<InventoryParcelDetail | null>(null);
const showPatches = ref(true);
const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let parcelLayer: L.GeoJSON | null = null;
let patchLayer: L.GeoJSON | null = null;
let boundaryLayer: L.GeoJSON | null = null;
let selectedLayer: L.GeoJSON | null = null;

const classOptions = computed(() =>
    INVENTORY_CLASS_ORDER.filter((cls) => (area.value?.classStats[cls]?.count ?? 0) > 0),
);
const flaggedCount = computed(() =>
    FLAGGED_INVENTORY_CLASSES.reduce((sum, cls) => sum + (area.value?.classStats[cls]?.count ?? 0), 0),
);
const areaSelect = computed({
    get: () => areaId.value,
    set: (v: string) => { areaId.value = v; },
});
const disclaimer = computed(() => {
    const parts = ['Çay tespiti 10 m çözünürlüklü Sentinel uydu görüntüsünden yapılır; 300 m²\'den küçük parseller "Belirsiz" sayılır.'];
    if (area.value?.demoLicenses) {
        parts.push('Ruhsat kayıtları gerçek değildir, ÇAYKUR verisi gelene kadar örnek amaçlı üretilmiştir.');
    }
    const m = area.value?.model;
    if (m?.teaRecall !== undefined) {
        parts.push(`Bağımsız testte çay yakalama ${formatShare(m.teaRecall)}, kesinlik ${formatShare(m.teaPrecision)}.`);
    }
    return parts.join(' ');
});
const periodLine = computed(() => {
    const p = area.value?.period;
    return p?.start && p?.end ? `${p.start.slice(0, 4)}–${String(Number(p.end.slice(0, 4)) - 1)} Sentinel-1/2` : 'Sentinel-1/2';
});

// ── Loading ──
async function loadAreas(): Promise<void> {
    const res = await api.getInventoryAreas();
    if (res.data) {
        areas.value = res.data.data;
        areaId.value = areas.value[0]?.id ?? '';
        if (!areaId.value) isLoadingArea.value = false;
    } else {
        areaError.value = res.error?.message ?? 'Envanter alanları alınamadı';
        isLoadingArea.value = false;
    }
}

async function loadArea(id: string): Promise<void> {
    isLoadingArea.value = true;
    areaError.value = null;
    selected.value = null;
    const [detail, layer] = await Promise.all([api.getInventoryArea(id), api.getInventoryAreaMap(id)]);
    if (detail.data && layer.data) {
        area.value = detail.data;
        mapData.value = layer.data;
    } else {
        areaError.value = detail.error?.message ?? layer.error?.message ?? 'Envanter yüklenemedi';
    }
    isLoadingArea.value = false;
    await nextTick();
    renderMap();
    void loadRows();
}

async function loadRows(): Promise<void> {
    if (!areaId.value) return;
    isLoadingRows.value = true;
    const res = await api.getInventoryParcels(areaId.value, {
        page: page.value,
        limit,
        inventoryClass: classFilter.value === ALL ? undefined : classFilter.value,
        search: search.value.trim() || undefined,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value,
    });
    if (res.data) {
        rows.value = res.data.data;
        total.value = res.data.meta.total;
        totalPages.value = res.data.meta.totalPages;
    }
    isLoadingRows.value = false;
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

function parcelStyle(cls: InventoryClass): L.PathOptions {
    const meta = INVENTORY_CLASS_META[cls];
    const color = cssVar(meta.colorVar, '#64748b');
    const dimmed = classFilter.value !== ALL && classFilter.value !== cls;
    return {
        color,
        weight: meta.hollow ? 1.5 : 1,
        dashArray: meta.hollow ? '4 3' : undefined,
        fillColor: color,
        fillOpacity: dimmed ? 0.04 : meta.hollow ? 0.06 : cls === 'uncertain' ? 0.2 : 0.45,
        opacity: dimmed ? 0.25 : 0.9,
    };
}

function initMap(): void {
    if (map || !mapContainer.value) return;
    // Wheel zoom off so scrolling the page over the map does not hijack it; buttons and pinch remain.
    map = L.map(mapContainer.value, { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        maxNativeZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    // A click outside the harvested parcels asks TKGM live for the parcel under the point.
    tkgmLookup.attach(map);
}

function renderMap(): void {
    initMap();
    if (!map || !area.value || !mapData.value) return;
    boundaryLayer?.remove();
    parcelLayer?.remove();
    patchLayer?.remove();

    boundaryLayer = L.geoJSON(area.value.boundary, {
        style: { color: cssVar('--background', '#ffffff'), weight: 2, dashArray: '6 4', fill: false },
        interactive: false,
    }).addTo(map);

    patchLayer = L.geoJSON(
        { type: 'FeatureCollection', features: area.value.teaPatches.map((p) => ({ type: 'Feature', geometry: p.geometry, properties: {} })) } as GeoJSON.FeatureCollection,
        { style: { color: cssVar('--chart-5', '#22c55e'), weight: 1.5, fill: false }, interactive: false },
    );
    if (showPatches.value) patchLayer.addTo(map);

    parcelLayer = L.geoJSON(mapData.value, {
        style: (feature) => parcelStyle(feature?.properties.inventoryClass as InventoryClass),
        onEachFeature: (feature, layer) => {
            const p = feature.properties as InventoryMap['features'][number]['properties'];
            layer.bindTooltip(`${p.block}/${p.parcel} · ${INVENTORY_CLASS_META[p.inventoryClass].label}`, { sticky: true });
            // A harvested parcel opens its inventory card; the map-level TKGM lookup must not fire too.
            layer.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                void selectParcel(p.id);
            });
        },
    }).addTo(map);

    map.fitBounds(boundaryLayer.getBounds(), { padding: [16, 16] });
}

function restyleParcels(): void {
    parcelLayer?.setStyle((feature) => parcelStyle(feature?.properties.inventoryClass as InventoryClass));
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

// ── Watchers ──
watch(areaId, (id) => { if (id) void loadArea(id); });
watch(classFilter, () => {
    page.value = 1;
    restyleParcels();
    void loadRows();
});
watch(showPatches, (on) => {
    if (!map || !patchLayer) return;
    if (on) patchLayer.addTo(map);
    else patchLayer.remove();
});
watch([sortBy, sortOrder, page], () => void loadRows());

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        page.value = 1;
        void loadRows();
    }, 300);
});

onMounted(() => void loadAreas());
onBeforeUnmount(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    map?.remove();
    map = null;
});

// ── Table helpers ──
const SORT_COLUMNS: Array<{ key: InventoryParcelSortKey; label: string; class?: string }> = [
    { key: 'parcel', label: 'Ada / Parsel' },
    { key: 'teaArea', label: 'Uydu çay alanı', class: 'text-right' },
    { key: 'licensedArea', label: 'Ruhsat alanı', class: 'hidden text-right md:table-cell' },
    { key: 'gap', label: 'Fark', class: 'hidden text-right lg:table-cell' },
];

function toggleSort(key: InventoryParcelSortKey): void {
    if (sortBy.value === key) {
        sortOrder.value = sortOrder.value === 'ASC' ? 'DESC' : 'ASC';
    } else {
        sortBy.value = key;
        sortOrder.value = key === 'parcel' ? 'ASC' : 'DESC';
    }
}
function sortDirOf(key: InventoryParcelSortKey): 'asc' | 'desc' | undefined {
    return sortBy.value === key ? (sortOrder.value === 'ASC' ? 'asc' : 'desc') : undefined;
}

function gapOf(r: InventoryParcelRow): number | null {
    // No gap can be judged while the licence's parcel match is still pending.
    if (!r.license || r.license.licensedAreaM2 === null) return null;
    return Math.round((r.teaAreaM2 ?? 0) - r.license.licensedAreaM2);
}
function formatGap(value: number | null): string {
    if (value === null) return '—';
    return `${value > 0 ? '+' : ''}${formatNumber(value)} m²`;
}
function onClassFilter(v: unknown): void {
    classFilter.value = typeof v === 'string' && v !== '' ? (v as InventoryClass | typeof ALL) : ALL;
}
function onRowKey(e: KeyboardEvent, id: string): void {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        void selectParcel(id);
    }
}
</script>

<template>
    <CaykurLayout>
        <PageContainer size="wide">
            <PageHeader
                title="Çay Envanteri"
                :description="area ? `${area.province} / ${area.district} / ${area.neighborhood} · ${periodLine}` : 'Parsel, ruhsat ve uydu tespiti karşılaştırması'"
            >
                <template #meta>
                    <Badge v-if="area?.demoLicenses" variant="warning">Demo ruhsat verisi</Badge>
                </template>
                <template v-if="areas.length > 1" #actions>
                    <Select v-model="areaSelect">
                        <SelectTrigger class="w-64" aria-label="Envanter alanı">
                            <SelectValue placeholder="Alan seçin" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup v-for="g in areaGroups" :key="g.label">
                                <SelectLabel>{{ g.label }}</SelectLabel>
                                <SelectItem v-for="a in g.items" :key="a.id" :value="a.id">{{ a.neighborhood }}</SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </template>
            </PageHeader>

            <LoadingState v-if="isLoadingArea" text="Envanter yükleniyor…" />

            <EmptyState v-else-if="areaError" title="Envanter yüklenemedi" :description="areaError">
                <Button variant="outline" class="h-11 md:h-9" @click="areaId && loadArea(areaId)">Tekrar dene</Button>
            </EmptyState>

            <EmptyState
                v-else-if="!area"
                :icon="Leaf"
                title="Henüz envanter yok"
                description="Bir mahallenin uydu analizi içe aktarıldığında burada görünür."
            />

            <template v-else>
                <Tabs v-model="activeTab">
                    <TabsList variant="line" class="w-full">
                        <TabsTrigger v-for="t in visibleTabs" :key="t.key" :value="t.key"><component :is="t.icon" aria-hidden="true" />{{ t.label }}</TabsTrigger>
                    </TabsList>
                </Tabs>

                <CaykurRegionOverview v-if="activeTab === 'region'" ref="regionOverview" :selected-area-id="areaId" @select="openArea" />

                <div v-show="activeTab === 'inventory'" class="flex flex-col gap-6">
                    <Alert variant="info">
                        <Info aria-hidden="true" />
                        <AlertTitle>Sınıflar denetim önceliği içindir, hukuki karar değildir</AlertTitle>
                        <AlertDescription>{{ disclaimer }}</AlertDescription>
                    </Alert>
    
                    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Özet">
                        <StatCard
                            label="İncelenen parsel"
                            :value="formatNumber(area.parcelCount)"
                            :hint="`mahalle alanının ${formatShare(area.coveredRatio)}'i`"
                        />
                        <StatCard
                            label="Uyduda tespit edilen çay"
                            :value="formatHectare(area.teaPatchAreaM2)"
                            :hint="`mahalle geneli; kütüphanedeki parsellerde ${formatHectare(area.detectedTeaAreaM2)}`"
                        />
                        <StatCard
                            label="Denetim gerektiren"
                            :value="formatNumber(flaggedCount)"
                            :hint="`${formatNumber(area.classStats.ghost_license.count)} hayalet ruhsat · ${formatNumber(area.classStats.unlicensed.count)} ruhsatsız aday`"
                        />
                        <StatCard
                            label="Eşleşmeyen ruhsat"
                            :value="formatNumber(area.unmatchedLicenses.length)"
                            hint="eski pafta/parsel kaydı TKGM'de yok"
                        />
                    </section>
    
                    <div class="-mx-1 overflow-x-auto px-1 pb-1">
                        <ToggleGroup :model-value="classFilter" type="single" aria-label="Sınıf filtresi" class="w-max" @update:model-value="onClassFilter">
                            <ToggleGroupItem :value="ALL" class="h-11 px-3 md:h-9">
                                Tümü
                                <Badge variant="muted" class="tabular-nums">{{ formatNumber(area.parcelCount) }}</Badge>
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                v-for="cls in classOptions"
                                :key="cls"
                                :value="cls"
                                :title="INVENTORY_CLASS_META[cls].description"
                                class="h-11 px-3 md:h-9"
                            >
                                {{ INVENTORY_CLASS_META[cls].label }}
                                <Badge :variant="toneVariant(INVENTORY_CLASS_META[cls].tone)" class="tabular-nums">{{ formatNumber(area.classStats[cls].count) }}</Badge>
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>
    
                    <div class="grid gap-4 lg:grid-cols-3">
                        <Card class="gap-0 overflow-hidden py-0 lg:col-span-2">
                            <CardHeader class="border-b py-4">
                                <CardTitle>Harita</CardTitle>
                                <CardDescription>Parseller sınıfına göre renkli; yeşil çizgi uydunun bulduğu çay alanları.</CardDescription>
                                <CardAction class="flex items-center gap-2">
                                    <Switch id="inv-patches" v-model="showPatches" />
                                    <Label for="inv-patches" class="text-xs">Çay alanları</Label>
                                </CardAction>
                            </CardHeader>
                            <div ref="mapContainer" class="h-105 w-full md:h-140" role="region" aria-label="Envanter haritası" />
                        </Card>
    
                        <Card v-if="selected" class="gap-4">
                            <CardHeader>
                                <CardTitle>Ada {{ selected.block }} / Parsel {{ selected.parcel }}</CardTitle>
                                <CardDescription>{{ selected.nature }}<template v-if="selected.locality"> · {{ selected.locality }}</template></CardDescription>
                                <CardAction>
                                    <Button variant="ghost" size="icon" class="size-11 md:size-9" aria-label="Seçimi kapat" @click="clearSelection">
                                        <X aria-hidden="true" />
                                    </Button>
                                </CardAction>
                            </CardHeader>
                            <CardContent class="space-y-4">
                                <div class="space-y-1">
                                    <Badge :variant="toneVariant(INVENTORY_CLASS_META[selected.inventoryClass].tone)">{{ INVENTORY_CLASS_META[selected.inventoryClass].label }}</Badge>
                                    <p class="text-sm text-muted-foreground">{{ INVENTORY_CLASS_META[selected.inventoryClass].description }}</p>
                                </div>
                                <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                    <div><dt class="text-muted-foreground">Tapu alanı</dt><dd class="font-semibold text-foreground tabular-nums">{{ formatM2(selected.deedAreaM2) }}</dd></div>
                                    <div><dt class="text-muted-foreground">Uydu çay alanı</dt><dd class="font-semibold text-foreground tabular-nums">{{ formatM2(selected.teaAreaM2) }}</dd></div>
                                    <div><dt class="text-muted-foreground">Çay oranı</dt><dd class="text-foreground tabular-nums">{{ formatShare(selected.teaShare) }}</dd></div>
                                    <div><dt class="text-muted-foreground">Ruhsat alanı</dt><dd class="font-semibold text-foreground tabular-nums">{{ formatM2(selected.license?.licensedAreaM2) }}</dd></div>
                                </dl>
                                <div v-if="selected.license" class="space-y-2 rounded-lg border p-3 text-sm">
                                    <p class="font-medium text-foreground">{{ selected.license.holderName }}</p>
                                    <p class="text-muted-foreground">
                                        Ruhsat {{ selected.license.licenseNo }} · Cüzdan {{ selected.license.walletNo }} · {{ selected.license.issuedYear }}
                                    </p>
                                    <p class="text-muted-foreground">Kayıttaki parsel: {{ selected.license.recordedParcelRef }}</p>
                                    <p v-if="(selected.license.licenseCount ?? 1) > 1 || (selected.license.producerCount ?? 1) > 1" class="text-muted-foreground">
                                        Parselde {{ selected.license.producerCount ?? 1 }} müstahsil, {{ selected.license.licenseCount ?? 1 }} ruhsat (müstahsil bazlı kayıt için Ruhsat İşlemleri sekmesi)
                                    </p>
                                    <Badge v-if="selected.license.pendingMatch" variant="warning">Ruhsat var, parsel eşleşmesi bekliyor — alan tahsis edilmedi</Badge>
                                    <Badge v-if="selected.license.holderDeceased" variant="warning">Ruhsat sahibi vefat etmiş görünüyor</Badge>
                                </div>
                                <p v-else class="text-sm text-muted-foreground">Bu parsele bağlı ruhsat kaydı yok.</p>
                            </CardContent>
                        </Card>
    
                        <Card v-else class="gap-4">
                            <CardHeader>
                                <CardTitle>Sınıflar</CardTitle>
                                <CardDescription>Haritada bir parsele tıklayın veya listeden seçin.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ul class="flex flex-col gap-3">
                                    <li v-for="cls in classOptions" :key="cls" class="flex flex-col gap-1">
                                        <div class="flex items-center justify-between gap-2">
                                            <Badge :variant="toneVariant(INVENTORY_CLASS_META[cls].tone)">{{ INVENTORY_CLASS_META[cls].label }}</Badge>
                                            <span class="text-sm font-semibold text-foreground tabular-nums">{{ formatNumber(area.classStats[cls].count) }}</span>
                                        </div>
                                        <p class="text-xs text-muted-foreground">{{ INVENTORY_CLASS_META[cls].description }}</p>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
    
                    <Card class="gap-0 py-0">
                        <CardHeader class="border-b py-4">
                            <CardTitle>Parseller</CardTitle>
                            <CardDescription aria-live="polite">
                                {{ formatNumber(total) }} parsel<template v-if="classFilter !== ALL"> · {{ INVENTORY_CLASS_META[classFilter].label }}</template> · ruhsat–uydu farkı büyükten küçüğe
                            </CardDescription>
                        </CardHeader>
                        <CardContent class="px-0">
                            <div class="p-4">
                                <ListToolbar>
                                    <SearchInput v-model="search" placeholder="Ada/parsel, nitelik, ruhsat no veya ruhsat sahibi ara…" aria-label="Parsel ara" />
                                </ListToolbar>
                            </div>
    
                            <div v-if="rows.length" class="overflow-x-auto" :aria-busy="isLoadingRows">
                                <Table>
                                    <TableHeader>
                                        <TableRow class="hover:bg-transparent">
                                            <TableHead v-for="col in SORT_COLUMNS" :key="col.key" :class="col.class">
                                                <Button variant="ghost" size="sm" class="-ml-2 h-8 gap-1 px-2" @click="toggleSort(col.key)">
                                                    {{ col.label }}
                                                    <ArrowUp v-if="sortDirOf(col.key) === 'asc'" class="size-3.5" aria-hidden="true" />
                                                    <ArrowDown v-else-if="sortDirOf(col.key) === 'desc'" class="size-3.5" aria-hidden="true" />
                                                    <ChevronsUpDown v-else class="size-3.5 text-muted-foreground" aria-hidden="true" />
                                                </Button>
                                            </TableHead>
                                            <TableHead class="pr-4">Sınıf</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow
                                            v-for="r in rows"
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
                                                <span v-if="r.license" class="block text-xs text-muted-foreground">{{ r.license.holderName }} · {{ r.license.licenseNo }}</span>
                                            </TableCell>
                                            <TableCell class="text-right">
                                                <span class="block font-semibold text-foreground tabular-nums">{{ formatM2(r.teaAreaM2) }}</span>
                                                <span class="block text-xs text-muted-foreground tabular-nums">{{ formatShare(r.teaShare) }} çay</span>
                                            </TableCell>
                                            <TableCell class="hidden text-right font-semibold text-foreground tabular-nums md:table-cell">{{ formatM2(r.license?.licensedAreaM2) }}</TableCell>
                                            <TableCell class="hidden text-right text-foreground tabular-nums lg:table-cell">{{ formatGap(gapOf(r)) }}</TableCell>
                                            <TableCell class="pr-4">
                                                <Badge :variant="toneVariant(INVENTORY_CLASS_META[r.inventoryClass].tone)">{{ INVENTORY_CLASS_META[r.inventoryClass].label }}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
    
                            <LoadingState v-else-if="isLoadingRows" text="Parseller yükleniyor…" />
    
                            <EmptyState v-else :icon="MapPinned" title="Eşleşen parsel yok" description="Arama veya sınıf filtresini değiştirmeyi deneyin." class="rounded-none border-0" />
    
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
    
                    <Card v-if="area.unmatchedLicenses.length" class="gap-0 py-0">
                        <CardHeader class="border-b py-4">
                            <CardTitle>TKGM'de karşılığı bulunmayan ruhsatlar</CardTitle>
                            <CardDescription>Ruhsatta yazan eski pafta/parsel numarası güncel kadastroda yok; ada/parsel güncellemesi gerekir.</CardDescription>
                        </CardHeader>
                        <CardContent class="px-0">
                            <div class="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow class="hover:bg-transparent">
                                            <TableHead class="pl-4">Ruhsat sahibi</TableHead>
                                            <TableHead>Kayıttaki parsel</TableHead>
                                            <TableHead class="hidden md:table-cell">Veriliş</TableHead>
                                            <TableHead class="pr-4 text-right">Ruhsat alanı</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow v-for="l in area.unmatchedLicenses" :key="l.licenseNo">
                                            <TableCell class="pl-4">
                                                <span class="block font-medium text-foreground">{{ l.holderName }}</span>
                                                <span class="block text-xs text-muted-foreground">{{ l.licenseNo }} · {{ l.walletNo }}</span>
                                                <Badge v-if="l.holderDeceased" variant="warning" class="mt-1">Vefat etmiş görünüyor</Badge>
                                            </TableCell>
                                            <TableCell>{{ l.recordedParcelRef }}</TableCell>
                                            <TableCell class="hidden tabular-nums md:table-cell">{{ l.issuedYear }}</TableCell>
                                            <TableCell class="pr-4 text-right font-semibold text-foreground tabular-nums">{{ formatM2(l.licensedAreaM2) }}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <template v-if="activeTab === 'pruning' && mapData">
                    <div class="flex flex-wrap items-center gap-3">
                        <span class="text-sm text-muted-foreground">Değerlendirme</span>
                        <ToggleGroup :model-value="pruningView" type="single" aria-label="Budama değerlendirme birimi" @update:model-value="onPruningView">
                            <ToggleGroupItem value="fusion" class="h-11 px-3 md:h-9">Çok-sensör karar</ToggleGroupItem>
                            <ToggleGroupItem value="records" class="h-11 px-3 md:h-9">Tarama kayıtları (önce / sonra)</ToggleGroupItem>
                            <ToggleGroupItem value="producers" class="h-11 px-3 md:h-9">Müstahsil (ruhsat sahibi)</ToggleGroupItem>
                            <ToggleGroupItem value="reports" class="h-11 px-3 md:h-9">Raporlar ve Bakanlık talepleri</ToggleGroupItem>
                            <ToggleGroupItem value="calibration" class="h-11 px-3 md:h-9">Kalibrasyon (saha)</ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                    <template v-if="pruningView === 'fusion'">
                        <CaykurPruningFusion :area-id="area.id" :map-data="mapData" />
                        <Card class="gap-0 py-0">
                            <CardHeader class="py-4">
                                <CardTitle>Parsel ve uydu görüntüleri</CardTitle>
                                <CardDescription>İnceleme aracı: parsel seçip NDVI eğrisine ve sezonun ham uydu görüntülerine bakın. Karar üretmez; karar yukarıdaki çok-sensör değerlendirmedir.</CardDescription>
                                <CardAction>
                                    <Button variant="outline" size="sm" class="h-11 md:h-9" :aria-expanded="showParcelTool" @click="showParcelTool = !showParcelTool">
                                        <ChevronDown aria-hidden="true" :class="['transition-transform', showParcelTool && 'rotate-180']" />{{ showParcelTool ? 'Gizle' : 'Göster' }}
                                    </Button>
                                </CardAction>
                            </CardHeader>
                            <CardContent v-if="showParcelTool" class="border-t pt-6 pb-6">
                                <CaykurPruningMonitor :area-id="area.id" :boundary="area.boundary" :map-data="mapData" />
                            </CardContent>
                        </Card>
                    </template>
                    <CaykurPruningRecords v-else-if="pruningView === 'records'" :area-id="area.id" :map-data="mapData" />
                    <CaykurProducerPruning v-else-if="pruningView === 'producers'" :area-id="area.id" :map-data="mapData" />
                    <CaykurReports v-else-if="pruningView === 'reports'" :area-id="area.id" />
                    <CaykurCalibration v-else-if="pruningView === 'calibration'" :area-id="area.id" />
                </template>

                <CaykurFieldTests v-if="activeTab === 'field' && mapData" :area-id="area.id" :map-data="mapData" />
                <CaykurLicensing v-if="activeTab === 'licensing' && mapData" :area-id="area.id" :map-data="mapData" :tea-patches="area.teaPatches" />
                <CaykurGardenHealth v-if="activeTab === 'health'" :area-id="area.id" />
                <CaykurLandEvaluation v-if="activeTab === 'land'" :area-id="area.id" />
                <CaykurGardenAge v-if="activeTab === 'age'" :area-id="area.id" />
            </template>
        </PageContainer>
    </CaykurLayout>
</template>
