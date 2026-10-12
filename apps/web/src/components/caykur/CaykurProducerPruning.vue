<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { ChevronLeft, ChevronRight, Download, ShieldCheck, TriangleAlert, Users } from '@lucide/vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EmptyState, ListToolbar, LoadingState, SearchInput, StatCard } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toneVariant } from '@/components/caykur/tone';
import ProducerProgressChart from '@/components/caykur/ProducerProgressChart.vue';
import { useToast } from '@/composables/useToast';
import { useAuthStore } from '@/stores/authStore';
import {
    api,
    type InventoryMap,
    type ProducerDetail,
    type ProducerGarden,
    type ProducerPruningStatus,
    type ProducerRow,
    type ProducerSummary,
} from '@/services/api';
import { PRODUCER_STATUS_META, PRODUCER_STATUS_ORDER, formatM2, formatShare } from '@/services/caykur/teaInventory';
import { formatNumber } from '@/services/caykur';

/**
 * Producer-centred pruning control: pick a producer, see their gardens, the season's satellite
 * findings, the individual 1/7 account (new area only, ground already credited in the 7-year
 * cycle set aside) and the year-over-year overlap, then decide. Per season, re-checked at
 * every scan (≤ 5 days). Very-high-confidence results open purchase automatically; the
 * satellite never closes purchase on its own.
 */
const props = defineProps<{
    areaId: string;
    mapData: InventoryMap;
}>();

const ALL = 'all';
const PAGE_SIZE = 15;
const DECIDE_ROLES = ['kurum_admin', 'fabrika_sorumlusu', 'saha_personeli'];
const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const toast = useToast();
const auth = useAuthStore();

const summary = ref<ProducerSummary | null>(null);
const season = ref('');
const isLoading = ref(true);
const error = ref<string | null>(null);
const view = ref<'producers' | 'purchase'>('producers');
const statusFilter = ref<ProducerPruningStatus | typeof ALL>(ALL);
const search = ref('');
const page = ref(1);
const rows = ref<ProducerRow[]>([]);
const total = ref(0);
const totalPages = ref(1);
const isLoadingRows = ref(false);
const isDownloading = ref(false);

// ── Producer sheet ──
const sheetOpen = ref(false);
const detail = ref<ProducerDetail | null>(null);
const note = ref('');
const isDeciding = ref(false);
const showPreviousEvents = ref(true);
const sceneDate = ref<string | null>(null);
const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let baseLayer: L.TileLayer | null = null;
let sceneOverlay: L.ImageOverlay | null = null;
let previousLayer: L.GeoJSON | null = null;

const schedule = computed(() => summary.value?.schedule ?? null);
const rules = computed(() => summary.value?.rules ?? null);
const canDecide = computed(() => auth.isAdmin || DECIDE_ROLES.includes(auth.caykurRole ?? ''));
const freshScans = computed(() => schedule.value?.newObservation.filter(Boolean).length ?? 0);
const scanStrip = computed(() =>
    (schedule.value?.scanDates ?? []).map((date, i) => ({
        date,
        fresh: schedule.value?.newObservation[i] ?? false,
        scenes: schedule.value?.sceneDates[i] ?? [],
    })),
);
const scenes = computed(() => detail.value?.scenes?.items ?? []);
const sceneIndex = computed(() => scenes.value.findIndex((s) => s.date === sceneDate.value));
const currentScene = computed(() => (sceneIndex.value >= 0 ? scenes.value[sceneIndex.value] ?? null : null));
/** The producer's 1/7 account for the open season, in the order an inspector reads it. */
const account = computed(() => {
    const d = detail.value;
    if (!d) return [];
    return [
        { label: 'Ruhsatlı alan', value: d.licensedAreaM2, hint: 'ÇAYKUR kaydı (demo: uydu çay alanı ±%10)' },
        { label: '1/7 hedefi', value: d.requiredM2, hint: 'ruhsatlı alan ÷ 7', strong: true },
        { label: 'Brüt görülen budama', value: d.grossPrunedM2, hint: 'sınırı belli bahçelerde biriken budama' },
        { label: 'Çakışan (geçmiş döngü)', value: d.reusedM2, hint: 'son 7 sezonda hesaba alınmış alanla üst üste', warn: d.reusedM2 > 0 },
        { label: 'Yeni budama (sayılan)', value: d.newPrunedM2, hint: 'brüt − çakışan', strong: true },
        { label: 'Atanamayan', value: d.unattributedM2, hint: 'sınırı belirsiz bahçelerde görülen', warn: d.unattributedM2 > 0 },
        { label: 'Gözlenemeyen çay', value: d.unobservedM2, hint: 'son gözlemde bulut/kar/gölge altında' },
        { label: 'Eksik kalan', value: d.remainingM2, hint: 'hedef − yeni budama', strong: true },
    ];
});

function fmtDate(d: string | null | undefined): string {
    if (!d) return '—';
    return `${Number(d.slice(8, 10))} ${MONTHS_TR.at(Number(d.slice(5, 7)) - 1)} ${d.slice(0, 4)}`;
}
function seasonLabel(s: string | undefined): string {
    if (!s) return '';
    const [a, b] = s.split('-');
    return `${a}–20${b}`;
}
/** "10 Şub 2025 – 3 Mar 2025" style observation interval of a garden's event. */
function eventInterval(g: ProducerGarden): string {
    const s = g.season;
    if (!s || !s.firstChangeAt) return '—';
    return `${s.lastNoChangeAt ? fmtDate(s.lastNoChangeAt) : 'sezon başı'} → ${fmtDate(s.firstChangeAt)}`;
}

// ── Loading ──
async function loadSummary(): Promise<void> {
    const res = await api.getInventoryProducerSummary(props.areaId, season.value || undefined);
    if (res.data) {
        summary.value = res.data;
        season.value = res.data.season;
    } else {
        error.value = res.error?.message ?? 'Müstahsil verisi alınamadı';
    }
}

async function loadRows(): Promise<void> {
    if (!season.value) return;
    isLoadingRows.value = true;
    const res = view.value === 'purchase'
        ? await api.getInventoryPurchaseList(props.areaId, season.value, page.value, PAGE_SIZE)
        : await api.getInventoryProducers(props.areaId, {
            page: page.value,
            limit: PAGE_SIZE,
            season: season.value,
            status: statusFilter.value === ALL ? undefined : statusFilter.value,
            search: search.value.trim() || undefined,
        });
    if (res.data) {
        rows.value = res.data.data;
        total.value = res.data.meta.total;
        totalPages.value = Math.max(1, res.data.meta.totalPages);
    }
    isLoadingRows.value = false;
}

async function openProducer(id: string): Promise<void> {
    const res = await api.getInventoryProducer(id);
    if (!res.data) {
        toast.error(res.error?.message ?? 'Müstahsil açılamadı');
        return;
    }
    detail.value = res.data;
    note.value = '';
    sceneDate.value = null;
    sheetOpen.value = true;
    await nextTick();
    // The sheet animates in; draw once its box has its final size.
    setTimeout(renderGardenMap, 250);
}

async function decide(decision: 'approved' | 'rejected'): Promise<void> {
    if (!detail.value) return;
    if (decision === 'rejected' && !note.value.trim()) {
        toast.error('Reddetmek için gerekçe yazın');
        return;
    }
    isDeciding.value = true;
    const res = await api.decideInventoryProducer(detail.value.id, { decision, note: note.value.trim() || undefined });
    isDeciding.value = false;
    if (!res.data) {
        toast.error(res.error?.message ?? 'Karar kaydedilemedi');
        return;
    }
    detail.value = res.data;
    note.value = '';
    toast.success(decision === 'approved' ? 'Budama onaylandı, alım açıldı' : 'Budama reddedildi, alım kapalı');
    await Promise.all([loadSummary(), loadRows()]);
}

async function downloadCsv(): Promise<void> {
    isDownloading.value = true;
    const res = await api.downloadInventoryPurchaseCsv(props.areaId, season.value);
    isDownloading.value = false;
    if (!res.blob) {
        toast.error(res.error ?? 'Liste indirilemedi');
        return;
    }
    const url = URL.createObjectURL(res.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `budama-onayli-mustahsiller-${season.value}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// ── Garden map (inside the sheet) ──
function cssVar(name: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function renderGardenMap(): void {
    map?.remove();
    map = null;
    sceneOverlay = null;
    previousLayer = null;
    if (!mapContainer.value || !detail.value) return;
    const d = detail.value;
    map = L.map(mapContainer.value, { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
    baseLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        maxNativeZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.geoJSON(props.mapData, {
        style: { color: cssVar('--background', '#ffffff'), weight: 0.6, opacity: 0.5, fill: false },
        interactive: false,
    }).addTo(map);

    const accent = cssVar('--primary', '#15803d');
    const muted = cssVar('--muted-foreground', '#64748b');
    const gardens = L.geoJSON(
        {
            type: 'FeatureCollection',
            features: d.gardens.map((g) => ({ type: 'Feature', geometry: g.geometry, properties: { label: `${g.block}/${g.parcel}`, resolved: g.boundaryResolved, tea: g.season?.teaAreaM2 ?? 0 } })),
        } as GeoJSON.FeatureCollection,
        {
            style: (f) => {
                const resolved = (f?.properties as { resolved: boolean }).resolved;
                return { color: resolved ? accent : muted, weight: 2.5, dashArray: resolved ? undefined : '6 4', fillColor: accent, fillOpacity: resolved ? 0.12 : 0.04 };
            },
            onEachFeature: (f, layer) => {
                const p = f.properties as { label: string; resolved: boolean; tea: number };
                layer.bindTooltip(`${p.label} · çay ${formatM2(p.tea)}${p.resolved ? '' : ' · sınır belirsiz'}`, { sticky: true });
            },
        },
    ).addTo(map);

    // This season's events: filled, redder the more they overlap ground credited before.
    const events = d.gardens.flatMap((g) => (g.season?.events ?? []).map((e) => ({ e, g })));
    L.geoJSON(
        {
            type: 'FeatureCollection',
            features: events.map(({ e, g }) => ({ type: 'Feature', geometry: e.geometry, properties: { label: `${g.block}/${g.parcel}`, area: e.areaM2, reused: e.reusedM2, from: e.lastNoChangeAt, to: e.firstChangeAt } })),
        } as GeoJSON.FeatureCollection,
        {
            style: (f) => {
                const p = f?.properties as { area: number; reused: number };
                const reusedShare = p.area > 0 ? p.reused / p.area : 0;
                const color = reusedShare >= 0.5 ? cssVar('--warning', '#b45309') : cssVar('--info', '#1e3a8a');
                return { color, weight: 1.5, fillColor: color, fillOpacity: 0.45 };
            },
            onEachFeature: (f, layer) => {
                const p = f.properties as { label: string; area: number; reused: number; from: string | null; to: string | null };
                layer.bindTooltip(
                    `${p.label}: budama ${formatM2(p.area)}${p.reused ? ` (çakışan ${formatM2(p.reused)})` : ''} · ${p.from ? fmtDate(p.from) : 'sezon başı'} → ${fmtDate(p.to)}`,
                    { sticky: true },
                );
            },
        },
    ).addTo(map);
    renderPreviousEvents();
    map.fitBounds(gardens.getBounds(), { padding: [32, 32], maxZoom: 18 });
}

/** Events of earlier seasons in the cycle, drawn hollow so this season's fills stay readable. */
function renderPreviousEvents(): void {
    previousLayer?.remove();
    previousLayer = null;
    const d = detail.value;
    if (!map || !d || !showPreviousEvents.value) return;
    const features = d.gardens.flatMap((g) =>
        Object.entries(g.eventsBySeason)
            .filter(([s]) => s < d.season)
            .flatMap(([s, list]) => list.map((e) => ({ type: 'Feature' as const, geometry: e.geometry, properties: { season: s, label: `${g.block}/${g.parcel}`, area: e.areaM2 } }))),
    );
    previousLayer = L.geoJSON({ type: 'FeatureCollection', features } as GeoJSON.FeatureCollection, {
        style: { color: cssVar('--warning', '#b45309'), weight: 2, dashArray: '3 3', fill: false },
        onEachFeature: (f, layer) => {
            const p = f.properties as { season: string; label: string; area: number };
            layer.bindTooltip(`${p.label}: ${seasonLabel(p.season)} sezonunda budandı (${formatM2(p.area)})`, { sticky: true });
        },
    }).addTo(map);
}

/** Sentinel-2 scene of the chosen date under the gardens; base map fades so the date is unmistakable. */
function renderScene(): void {
    sceneOverlay?.remove();
    sceneOverlay = null;
    const d = detail.value;
    const scene = currentScene.value;
    baseLayer?.setOpacity(scene ? 0.25 : 1);
    if (!map || !d?.scenes || !scene) return;
    const { west, south, east, north } = d.scenes.bounds;
    sceneOverlay = L.imageOverlay(`${d.scenes.baseUrl}${scene.file}`, [[south, west], [north, east]], { interactive: false, alt: `Sentinel-2, ${scene.date}` }).addTo(map);
    sceneOverlay.bringToBack();
}

function stepScene(delta: number): void {
    if (scenes.value.length === 0) return;
    const i = sceneIndex.value < 0 ? (delta > 0 ? 0 : scenes.value.length - 1) : Math.min(scenes.value.length - 1, Math.max(0, sceneIndex.value + delta));
    sceneDate.value = scenes.value[i]?.date ?? null;
}

/** Nearest exported scene on or before a date (the observation that showed no change / the change). */
function nearestScene(target: string | null): string | null {
    if (!target) return null;
    const onOrBefore = scenes.value.filter((s) => s.date <= target);
    return (onOrBefore.at(-1) ?? scenes.value[0])?.date ?? null;
}
function showBeforeAfter(g: ProducerGarden, which: 'before' | 'after'): void {
    const s = g.season;
    if (!s) return;
    sceneDate.value = which === 'before' ? nearestScene(s.lastNoChangeAt) ?? scenes.value[0]?.date ?? null : nearestScene(s.firstChangeAt);
    mapContainer.value?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

watch(sheetOpen, (open) => {
    if (!open) {
        map?.remove();
        map = null;
        sceneOverlay = null;
    }
});
watch(sceneDate, renderScene);
watch(showPreviousEvents, renderPreviousEvents);
watch(season, async () => {
    page.value = 1;
    await loadSummary();
    await loadRows();
});
watch([statusFilter, view], () => {
    page.value = 1;
    void loadRows();
});
watch(page, () => void loadRows());
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        page.value = 1;
        void loadRows();
    }, 300);
});

onMounted(async () => {
    await loadSummary();
    await loadRows();
    isLoading.value = false;
});
onBeforeUnmount(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    map?.remove();
});

function onSeason(v: unknown): void {
    if (typeof v === 'string' && v !== '') season.value = v;
}
function onStatus(v: unknown): void {
    statusFilter.value = typeof v === 'string' && v !== '' ? (v as ProducerPruningStatus | typeof ALL) : ALL;
}
function onView(v: unknown): void {
    if (v === 'producers' || v === 'purchase') view.value = v;
}
function onScene(v: unknown): void {
    sceneDate.value = typeof v === 'string' && v !== '' ? v : null;
}
function onRowKey(e: KeyboardEvent, id: string): void {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        void openProducer(id);
    }
}
</script>

<template>
    <LoadingState v-if="isLoading" text="Müstahsil verisi yükleniyor…" />

    <EmptyState v-else-if="error" title="Müstahsil verisi yüklenemedi" :description="error">
        <Button variant="outline" class="h-11 md:h-9" @click="loadSummary">Tekrar dene</Button>
    </EmptyState>

    <EmptyState
        v-else-if="!summary || summary.total === 0 || !schedule"
        :icon="Users"
        title="Bu alan için müstahsil taraması yok"
        description="Müstahsil–bahçe eşleşmesi ve 5 günlük taramalar içe aktarıldığında burada görünür."
    />

    <div v-else class="flex flex-col gap-6">
        <Alert variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle class="flex flex-wrap items-center gap-2">
                Kalibre edilmedi
                <Badge variant="warning">Demo müstahsil verisi</Badge>
            </AlertTitle>
            <AlertDescription>
                Taramalar geriye dönük çalıştırıldı; müstahsil–bahçe eşleşmesi ve ruhsat alanları örnek amaçlı üretildi.
                Hedefe yalnızca yeni alan sayılır: aynı 7 yıllık döngüde daha önce hesaba alınmış yerle çakışan budama "tekrar budama kontrolü"ne gider,
                sınırı belirsiz hisseli bahçelerdeki budama müstahsile atanmaz. Otomatik onay yalnızca çok yüksek güvende verilir
                <template v-if="rules">(hedefin %{{ Math.round(rules.autoApproval.minRatio * 100) }}'si, çayın %{{ Math.round(rules.autoApproval.minObservedShare * 100) }}'i gözlenmiş, art arda {{ rules.autoApproval.consecutiveScans }} tarama)</template>.
                Uydu alımı tek başına kapatamaz; gözlem yokluğu "budanmadı" demek değildir.
            </AlertDescription>
        </Alert>

        <div class="flex flex-wrap items-center gap-3">
            <span class="text-sm text-muted-foreground">Budama sezonu</span>
            <ToggleGroup :model-value="season" type="single" aria-label="Budama sezonu" @update:model-value="onSeason">
                <ToggleGroupItem v-for="s in summary.seasons" :key="s" :value="s" class="h-11 px-3 md:h-9">{{ seasonLabel(s) }}</ToggleGroupItem>
            </ToggleGroup>
        </div>

        <Card class="gap-3">
            <CardHeader>
                <CardTitle>Tarama takvimi · {{ seasonLabel(schedule.season) }}</CardTitle>
                <CardDescription>
                    {{ schedule.everyDays }} günde bir tarama · {{ schedule.scanDates.length }} tarama · {{ freshScans }} taramada yeni bulutsuz görüntü ·
                    son tarama {{ fmtDate(schedule.scanDates.at(-1)) }}
                    <template v-if="schedule.previousSeasons.length"> · çakışma için karşılaştırılan sezonlar: {{ schedule.previousSeasons.map(seasonLabel).join(', ') }}</template>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div class="flex flex-wrap items-center gap-1" role="list" aria-label="Tarama tarihleri">
                    <span
                        v-for="s in scanStrip"
                        :key="s.date"
                        role="listitem"
                        class="inline-block size-3 rounded-full border"
                        :class="s.fresh ? 'border-primary bg-primary' : 'border-muted-foreground/50 bg-transparent'"
                        :title="`${fmtDate(s.date)}: ${s.fresh ? `yeni sahne ${s.scenes.map(fmtDate).join(', ')}` : 'yeni bulutsuz sahne yok'}`"
                    />
                </div>
                <p class="mt-2 text-xs text-muted-foreground">Dolu nokta: o taramada yeni bulutsuz görüntü geldi. Boş nokta: bulut/kar nedeniyle yeni gözlem yok; sistem "budamadı" demez, bekler.</p>
            </CardContent>
        </Card>

        <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Müstahsil özeti">
            <StatCard
                label="Alım açık"
                :value="formatNumber(summary.purchaseOpen)"
                :hint="`${formatNumber(summary.counts.auto_approved)} otomatik · ${formatNumber(summary.counts.approved)} eksper onayı`"
                :icon="ShieldCheck"
            />
            <StatCard
                label="Eksper kontrolü bekliyor"
                :value="formatNumber(summary.counts.expert_review + summary.counts.repeat_pruning_review)"
                :hint="`${formatNumber(summary.counts.expert_review)} hedefe yakın · ${formatNumber(summary.counts.repeat_pruning_review)} tekrar budama`"
            />
            <StatCard
                label="Budama izi yok / kısmi"
                :value="`${formatNumber(summary.counts.no_trace)} / ${formatNumber(summary.counts.partial)}`"
                hint="eksper kontrolü gerekir"
            />
            <StatCard
                label="Karar verilemiyor"
                :value="formatNumber(summary.counts.awaiting_observation + summary.counts.boundary_unresolved)"
                :hint="`${formatNumber(summary.counts.awaiting_observation)} gözlem bekliyor · ${formatNumber(summary.counts.boundary_unresolved)} sınır belirsiz · ${formatNumber(summary.counts.rejected)} reddedildi`"
            />
        </section>

        <ToggleGroup :model-value="view" type="single" aria-label="Görünüm" class="w-max" @update:model-value="onView">
            <ToggleGroupItem value="producers" class="h-11 px-3 md:h-9">Müstahsil ara</ToggleGroupItem>
            <ToggleGroupItem value="purchase" class="h-11 px-3 md:h-9">
                Alım listesi
                <Badge variant="success" class="tabular-nums">{{ formatNumber(summary.purchaseOpen) }}</Badge>
            </ToggleGroupItem>
        </ToggleGroup>

        <template v-if="view === 'producers'">
            <ListToolbar>
                <SearchInput v-model="search" placeholder="Müstahsil no, ad soyad, cüzdan no veya ruhsat no…" aria-label="Müstahsil ara" />
            </ListToolbar>
            <div class="-mx-1 overflow-x-auto px-1 pb-1">
                <ToggleGroup :model-value="statusFilter" type="single" aria-label="Durum filtresi" class="w-max" @update:model-value="onStatus">
                    <ToggleGroupItem :value="ALL" class="h-11 px-3 md:h-9">Tümü</ToggleGroupItem>
                    <ToggleGroupItem v-for="s in PRODUCER_STATUS_ORDER" :key="s" :value="s" :title="PRODUCER_STATUS_META[s].description" class="h-11 px-3 md:h-9">
                        {{ PRODUCER_STATUS_META[s].label }}
                        <Badge :variant="toneVariant(PRODUCER_STATUS_META[s].tone)" class="tabular-nums">{{ formatNumber(summary.counts[s]) }}</Badge>
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>
        </template>

        <Card class="gap-0 py-0">
            <CardHeader class="border-b py-4">
                <CardTitle>{{ view === 'purchase' ? 'Alım listesi' : 'Müstahsiller' }} · {{ seasonLabel(season) }}</CardTitle>
                <CardDescription aria-live="polite">
                    <template v-if="view === 'purchase'">ÇAYKUR'un bu sezon yaş çay alabileceği müstahsiller (otomatik veya eksper onaylı) · {{ formatNumber(total) }} kişi</template>
                    <template v-else>{{ formatNumber(total) }} müstahsil · 1/7 hedefine oranı en düşükten başlayarak · satıra tıklayınca kişisel kontrol ekranı açılır</template>
                </CardDescription>
                <CardAction v-if="view === 'purchase'">
                    <Button variant="outline" class="h-11 md:h-9" :disabled="isDownloading || total === 0" @click="downloadCsv">
                        <Download aria-hidden="true" />
                        Excel (CSV) indir
                    </Button>
                </CardAction>
            </CardHeader>
            <CardContent class="px-0">
                <div v-if="rows.length" class="overflow-x-auto" :aria-busy="isLoadingRows">
                    <Table>
                        <TableHeader>
                            <TableRow class="hover:bg-transparent">
                                <TableHead class="pl-4">Müstahsil</TableHead>
                                <TableHead class="hidden text-right md:table-cell">Bahçe</TableHead>
                                <TableHead class="hidden text-right lg:table-cell">Ruhsat alanı</TableHead>
                                <TableHead class="text-right">Yeni budama</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead class="pr-4">Alım</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow
                                v-for="r in rows"
                                :key="r.id"
                                class="cursor-pointer"
                                tabindex="0"
                                @click="openProducer(r.id)"
                                @keydown="onRowKey($event, r.id)"
                            >
                                <TableCell class="pl-4">
                                    <span class="block font-medium text-foreground">{{ r.name }}</span>
                                    <span class="block text-xs text-muted-foreground">{{ r.code }} · Cüzdan {{ r.walletNo }} · Ruhsat {{ r.licenseNo }}</span>
                                </TableCell>
                                <TableCell class="hidden text-right tabular-nums md:table-cell">
                                    {{ r.gardenCount }}<span v-if="r.unresolvedGardens" class="text-xs text-muted-foreground"> ({{ r.unresolvedGardens }} sınır belirsiz)</span>
                                </TableCell>
                                <TableCell class="hidden text-right tabular-nums lg:table-cell">{{ formatM2(r.licensedAreaM2) }}</TableCell>
                                <TableCell class="text-right">
                                    <span class="block font-semibold text-foreground tabular-nums">{{ formatM2(r.newPrunedM2) }}</span>
                                    <span class="block text-xs text-muted-foreground tabular-nums">hedef {{ formatM2(r.requiredM2) }} · {{ formatShare(r.ratio) }}<template v-if="r.reusedM2"> · çakışan {{ formatM2(r.reusedM2) }}</template></span>
                                </TableCell>
                                <TableCell>
                                    <Badge :variant="toneVariant(PRODUCER_STATUS_META[r.status].tone)">{{ PRODUCER_STATUS_META[r.status].label }}</Badge>
                                </TableCell>
                                <TableCell class="pr-4">
                                    <Badge :variant="r.purchaseOpen ? 'success' : 'muted'">{{ r.purchaseOpen ? 'Açık' : 'Kapalı' }}</Badge>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
                <LoadingState v-else-if="isLoadingRows" text="Yükleniyor…" />
                <EmptyState v-else :icon="Users" title="Eşleşen müstahsil yok" description="Durum filtresini veya aramayı değiştirin." class="rounded-none border-0" />
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

        <Sheet v-model:open="sheetOpen">
            <SheetContent side="right" class="w-full gap-0 overflow-y-auto sm:max-w-3xl">
                <template v-if="detail">
                    <SheetHeader class="border-b">
                        <SheetTitle>{{ detail.name }}</SheetTitle>
                        <SheetDescription>{{ detail.code }} · Cüzdan {{ detail.walletNo }} · Ruhsat {{ detail.licenseNo }}</SheetDescription>
                        <div class="flex flex-wrap items-center gap-2 pt-1">
                            <Badge :variant="toneVariant(PRODUCER_STATUS_META[detail.status].tone)">{{ PRODUCER_STATUS_META[detail.status].label }}</Badge>
                            <Badge :variant="detail.purchaseOpen ? 'success' : 'muted'">Alım {{ detail.purchaseOpen ? 'açık' : 'kapalı' }}</Badge>
                            <Badge v-if="detail.demo" variant="warning">Demo</Badge>
                        </div>
                        <div v-if="detail.history.length > 1" class="flex flex-wrap items-center gap-2 pt-2">
                            <span class="text-xs text-muted-foreground">Sezon</span>
                            <ToggleGroup :model-value="detail.id" type="single" size="sm" aria-label="Müstahsilin sezonu" @update:model-value="(v) => typeof v === 'string' && v !== '' && v !== detail?.id && openProducer(v)">
                                <ToggleGroupItem v-for="h in detail.history" :key="h.id" :value="h.id" class="h-11 px-3 md:h-8">{{ seasonLabel(h.season) }}</ToggleGroupItem>
                            </ToggleGroup>
                        </div>
                    </SheetHeader>

                    <div class="flex flex-col gap-6 p-4">
                        <p class="text-sm text-muted-foreground">{{ PRODUCER_STATUS_META[detail.status].description }}</p>

                        <section class="space-y-3" aria-label="1/7 hesabı">
                            <div class="flex items-center justify-between gap-3">
                                <h3 class="text-sm font-semibold text-foreground">1/7 hesabı · {{ seasonLabel(detail.season) }}</h3>
                                <span class="text-sm font-semibold text-foreground tabular-nums">{{ formatShare(detail.ratio) }}</span>
                            </div>
                            <Progress :model-value="Math.min(100, detail.ratio * 100)" aria-label="1/7 hedefine ilerleme" />
                            <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                                <div v-for="row in account" :key="row.label">
                                    <dt class="text-muted-foreground">{{ row.label }}</dt>
                                    <dd class="tabular-nums" :class="[row.strong ? 'font-semibold text-foreground' : 'text-foreground', row.warn && 'text-warning']">{{ formatM2(row.value) }}</dd>
                                    <dd class="text-xs text-muted-foreground">{{ row.hint }}</dd>
                                </div>
                            </dl>
                            <p v-if="detail.autoApprovedAt" class="text-xs text-muted-foreground">Otomatik onay: {{ fmtDate(detail.autoApprovedAt) }} taramasında alım açıldı.</p>
                        </section>

                        <section class="space-y-3" aria-label="Bahçe haritası">
                            <div class="flex flex-wrap items-center justify-between gap-3">
                                <h3 class="text-sm font-semibold text-foreground">Bahçeler ve uydu bulguları</h3>
                                <div class="flex items-center gap-2">
                                    <Switch id="prev-events" v-model="showPreviousEvents" />
                                    <Label for="prev-events" class="text-xs">Geçmiş sezon budamaları</Label>
                                </div>
                            </div>
                            <div ref="mapContainer" class="h-72 w-full overflow-hidden rounded-lg border md:h-96" />
                            <p class="text-xs text-muted-foreground">
                                Yeşil: müstahsilin bahçeleri (kesik çizgi: hisse sınırı belirsiz). Mavi dolgu: bu sezon görülen budama; turuncu dolgu: çoğu geçmiş döngüyle çakışan.
                                Turuncu kesik çizgi: önceki sezonlarda budanmış yerler.
                            </p>
                            <div v-if="scenes.length" class="space-y-2">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="text-xs text-muted-foreground">Uydu görüntüsü (Sentinel-2, {{ scenes.length }} bulutsuz sahne)</span>
                                    <Button variant="outline" size="icon" class="size-11 md:size-8" aria-label="Önceki sahne" @click="stepScene(-1)"><ChevronLeft aria-hidden="true" /></Button>
                                    <Button variant="outline" size="icon" class="size-11 md:size-8" aria-label="Sonraki sahne" @click="stepScene(1)"><ChevronRight aria-hidden="true" /></Button>
                                    <span v-if="currentScene" class="text-xs"><span class="font-semibold text-foreground">{{ fmtDate(currentScene.date) }}</span> <span class="text-muted-foreground">· çayın %{{ Math.round(currentScene.teaVisible * 100) }}'i görünür</span></span>
                                    <Button v-if="sceneDate" variant="ghost" size="sm" class="h-11 md:h-8" @click="sceneDate = null">Kapat</Button>
                                </div>
                                <div class="-mx-1 overflow-x-auto px-1 pb-1">
                                    <ToggleGroup :model-value="sceneDate ?? ''" type="single" size="sm" aria-label="Sahne tarihi" class="w-max" @update:model-value="onScene">
                                        <ToggleGroupItem v-for="s in scenes" :key="s.date" :value="s.date" class="h-11 px-2 text-xs md:h-8" :title="`çayın %${Math.round(s.teaVisible * 100)}'i görünür`">
                                            {{ Number(s.date.slice(8)) }} {{ MONTHS_TR.at(Number(s.date.slice(5, 7)) - 1)?.slice(0, 3) }}
                                        </ToggleGroupItem>
                                    </ToggleGroup>
                                </div>
                            </div>
                        </section>

                        <section v-if="schedule && rules" class="space-y-2" aria-label="Sezon ilerlemesi">
                            <h3 class="text-sm font-semibold text-foreground">Sezon boyunca biriken budama</h3>
                            <ProducerProgressChart
                                :scans="detail.scans"
                                :new-observation="schedule.newObservation"
                                :required-m2="detail.requiredM2"
                                :auto-ratio="rules.autoApproval.minRatio"
                                :auto-approved-at="detail.autoApprovedAt"
                            />
                        </section>

                        <section class="space-y-2" aria-label="Bahçe listesi">
                            <h3 class="text-sm font-semibold text-foreground">Bahçeler ({{ detail.gardens.length }})</h3>
                            <div class="overflow-x-auto rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow class="hover:bg-transparent">
                                            <TableHead class="pl-3">Ada / Parsel</TableHead>
                                            <TableHead class="text-right">Çay</TableHead>
                                            <TableHead class="text-right">Budama</TableHead>
                                            <TableHead class="hidden md:table-cell">Gözlem aralığı</TableHead>
                                            <TableHead class="pr-3"><span class="sr-only">Önce / sonra</span></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow v-for="g in detail.gardens" :key="g.id">
                                            <TableCell class="pl-3">
                                                <span class="block font-medium text-foreground">{{ g.block }} / {{ g.parcel }}</span>
                                                <span v-if="g.holderCount > 1" class="block text-xs text-muted-foreground">Hisseli · {{ g.holderIndex }}/{{ g.holderCount }}. hissedar</span>
                                                <Badge v-if="!g.boundaryResolved" variant="muted" class="mt-1">Sınır belirsiz · atanmaz</Badge>
                                            </TableCell>
                                            <TableCell class="text-right tabular-nums">{{ formatM2(g.season?.teaAreaM2) }}</TableCell>
                                            <TableCell class="text-right">
                                                <span class="block font-semibold text-foreground tabular-nums">{{ formatM2(g.season?.prunedM2.at(-1) ?? 0) }}</span>
                                                <span v-if="g.season?.eventReusedM2" class="block text-xs text-warning tabular-nums">çakışan {{ formatM2(g.season.eventReusedM2) }}</span>
                                            </TableCell>
                                            <TableCell class="hidden text-xs text-muted-foreground md:table-cell">
                                                {{ eventInterval(g) }}
                                                <span v-if="g.season?.detectedAt" class="block">tespit: {{ fmtDate(g.season.detectedAt) }} taraması</span>
                                            </TableCell>
                                            <TableCell class="pr-3 text-right">
                                                <div v-if="g.season?.firstChangeAt && scenes.length" class="flex justify-end gap-1">
                                                    <Button variant="outline" size="sm" class="h-11 px-2 text-xs md:h-7" @click="showBeforeAfter(g, 'before')">Önce</Button>
                                                    <Button variant="outline" size="sm" class="h-11 px-2 text-xs md:h-7" @click="showBeforeAfter(g, 'after')">Sonra</Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </section>

                        <section v-if="detail.history.length > 1" class="space-y-2" aria-label="Geçmiş sezonlar">
                            <h3 class="text-sm font-semibold text-foreground">Geçmiş sezonlar</h3>
                            <div class="overflow-x-auto rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow class="hover:bg-transparent">
                                            <TableHead class="pl-3">Sezon</TableHead>
                                            <TableHead class="text-right">Yeni</TableHead>
                                            <TableHead class="hidden text-right md:table-cell">Çakışan</TableHead>
                                            <TableHead class="text-right">Hedef</TableHead>
                                            <TableHead>Durum</TableHead>
                                            <TableHead class="pr-3">Alım</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow v-for="h in detail.history" :key="h.id" :class="h.id === detail.id && 'bg-muted/50'">
                                            <TableCell class="pl-3 font-medium text-foreground">{{ seasonLabel(h.season) }}</TableCell>
                                            <TableCell class="text-right font-semibold text-foreground tabular-nums">{{ formatM2(h.newPrunedM2) }}</TableCell>
                                            <TableCell class="hidden text-right tabular-nums md:table-cell">{{ formatM2(h.reusedM2) }}</TableCell>
                                            <TableCell class="text-right tabular-nums">{{ formatM2(h.requiredM2) }} · {{ formatShare(h.ratio) }}</TableCell>
                                            <TableCell><Badge :variant="toneVariant(PRODUCER_STATUS_META[h.status].tone)">{{ PRODUCER_STATUS_META[h.status].label }}</Badge></TableCell>
                                            <TableCell class="pr-3"><Badge :variant="h.purchaseOpen ? 'success' : 'muted'">{{ h.purchaseOpen ? 'Açık' : 'Kapalı' }}</Badge></TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </section>

                        <section class="space-y-3" aria-label="Eksper kararı">
                            <h3 class="text-sm font-semibold text-foreground">Eksper kararı · {{ seasonLabel(detail.season) }}</h3>
                            <template v-if="canDecide">
                                <div class="space-y-2">
                                    <Label for="decision-note">Not (reddetmek için zorunlu)</Label>
                                    <Textarea id="decision-note" v-model="note" rows="2" placeholder="Saha kontrolü, fotoğraf kanıtı veya gerekçe…" />
                                </div>
                                <div class="flex flex-wrap gap-2">
                                    <Button class="h-11 md:h-9" :disabled="isDeciding" @click="decide('approved')">Budamayı onayla · alımı aç</Button>
                                    <Button variant="destructive" class="h-11 md:h-9" :disabled="isDeciding" @click="decide('rejected')">Reddet · alım kapalı</Button>
                                </div>
                            </template>
                            <p v-else class="text-sm text-muted-foreground">Rolünüz karar vermeye yetkili değil (yalnızca görüntüleme).</p>

                            <ul v-if="detail.decisions.length" class="flex flex-col gap-2">
                                <li v-for="(d, i) in detail.decisions" :key="i" class="rounded-lg border p-3 text-sm">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <Badge :variant="d.decision === 'approved' ? 'success' : 'danger'">{{ d.decision === 'approved' ? 'Onaylandı' : 'Reddedildi' }}</Badge>
                                        <span class="text-muted-foreground">{{ d.decidedByName }} · {{ fmtDate(d.decidedAt.slice(0, 10)) }}</span>
                                        <Badge v-if="i === 0" variant="outline">Geçerli</Badge>
                                    </div>
                                    <p v-if="d.note" class="mt-1 text-foreground">{{ d.note }}</p>
                                </li>
                            </ul>
                        </section>
                    </div>
                </template>
            </SheetContent>
        </Sheet>
    </div>
</template>
