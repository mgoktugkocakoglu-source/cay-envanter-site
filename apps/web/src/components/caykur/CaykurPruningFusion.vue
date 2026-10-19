<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { ChevronLeft, ChevronRight, Download, Layers, Radar, Scissors, TriangleAlert, Users } from '@lucide/vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EmptyState, ListToolbar, LoadingState, SearchInput, StatCard } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PROGRESS_TONE_CLASS, toneVariant } from '@/components/caykur/tone';
import { useToast } from '@/composables/useToast';
import { useTkgmParcelLookup } from '@/composables/useTkgmParcelLookup';
import {
    api,
    type FusionClass,
    type FusionDecision,
    type FusionGardenDetail,
    type FusionGardenRow,
    type FusionProducerRow,
    type FusionSummary,
    type FusionUnassignedPatch,
    type InventoryMap,
    type ProducerFusionStatus,
} from '@/services/api';
import {
    FUSION_ANOMALY_LABEL,
    FUSION_CHANNEL_LABEL,
    FUSION_CLASS_META,
    FUSION_CLASS_ORDER,
    FUSION_DECISION_META,
    FUSION_DECISION_ORDER,
    FUSION_GROUP_LABEL,
    PRODUCER_FUSION_META,
    PRODUCER_FUSION_ORDER,
    formatDekar,
    formatM2,
    formatShare,
} from '@/services/caykur/teaInventory';
import { formatNumber } from '@/services/caykur';

/**
 * Multi-sensor pruning verdicts ("the equation"): every garden is judged on NDVI/NBR (S2), VH
 * backscatter on two orbits (S1) and, when processed, coherence — each as a step that must
 * persist, in units of the garden's own noise, pooled across sensors at the best change date.
 * The whole neighbourhood is re-judged every 2–3 days; producers are listed against their 1/7.
 */
const props = defineProps<{
    areaId: string;
    mapData: InventoryMap;
}>();

const ALL = 'all';
const PAGE_SIZE = 15;
const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const toast = useToast();
const tkgm = useTkgmParcelLookup();

const summary = ref<FusionSummary | null>(null);
const season = ref('');
const isLoading = ref(true);
const error = ref<string | null>(null);
const view = ref<'producers' | 'gardens' | 'map'>('producers');

// ── Producers ("who pruned") ──
const pSearch = ref('');
const pStatus = ref<ProducerFusionStatus | typeof ALL>(ALL);
const pDecision = ref<FusionDecision | typeof ALL>(ALL);
const pPage = ref(1);
const pRows = ref<FusionProducerRow[]>([]);
const pTotal = ref(0);
const pTotalPages = ref(1);
const isLoadingProducers = ref(false);
const isDownloading = ref(false);

// ── Gardens ──
const gSearch = ref('');
const gClass = ref<FusionClass | typeof ALL>(ALL);
const gLocality = ref<string | typeof ALL>(ALL);
const gPage = ref(1);
const gRows = ref<FusionGardenRow[]>([]);
const gTotal = ref(0);
const gTotalPages = ref(1);
const isLoadingGardens = ref(false);

// ── Garden sheet ──
const sheetOpen = ref(false);
const detail = ref<FusionGardenDetail | null>(null);
const isLoadingDetail = ref(false);
const chipContainer = ref<HTMLElement | null>(null);
let chipMap: L.Map | null = null;

// ── Map view ──
const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;

function fmtDate(d: string | null | undefined): string {
    if (!d) return '—';
    return `${Number(d.slice(8, 10))} ${MONTHS_TR[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
}
function seasonLabel(s: string | undefined): string {
    if (!s) return '';
    const [a, b] = s.split('-');
    return `${a}–20${b}`;
}
function cssVar(name: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
function classColor(c: FusionClass): string {
    if (c === 'pruned') return cssVar('--primary', '#15803d');
    if (c === 'likely') return cssVar('--info', '#1e3a8a');
    if (c === 'unclear') return cssVar('--warning', '#b45309');
    if (c === 'not_pruned') return cssVar('--muted-foreground', '#64748b');
    return cssVar('--border', '#94a3b8');
}

async function loadSummary(): Promise<void> {
    error.value = null;
    const res = await api.getFusionSummary(props.areaId, season.value || undefined);
    if (res.data) {
        summary.value = res.data;
        season.value = res.data.season;
    } else {
        error.value = res.error?.message ?? 'Çok-sensör sonuçları alınamadı';
    }
}

async function loadProducers(): Promise<void> {
    if (!season.value) return;
    isLoadingProducers.value = true;
    const res = await api.getFusionProducers(props.areaId, {
        page: pPage.value,
        limit: PAGE_SIZE,
        season: season.value,
        search: pSearch.value.trim() || undefined,
        status: pStatus.value === ALL ? undefined : pStatus.value,
        decision: pDecision.value === ALL ? undefined : pDecision.value,
    });
    if (res.data) {
        pRows.value = res.data.data;
        pTotal.value = res.data.meta.total;
        pTotalPages.value = Math.max(1, res.data.meta.totalPages);
    } else {
        toast.error(res.error?.message ?? 'Müstahsiller yüklenemedi');
    }
    isLoadingProducers.value = false;
}

async function loadGardens(): Promise<void> {
    if (!season.value) return;
    isLoadingGardens.value = true;
    const res = await api.getFusionGardens(props.areaId, {
        page: gPage.value,
        limit: PAGE_SIZE,
        season: season.value,
        search: gSearch.value.trim() || undefined,
        class: gClass.value === ALL ? undefined : gClass.value,
        locality: gLocality.value === ALL ? undefined : gLocality.value,
    });
    if (res.data) {
        gRows.value = res.data.data;
        gTotal.value = res.data.meta.total;
        gTotalPages.value = Math.max(1, res.data.meta.totalPages);
    } else {
        toast.error(res.error?.message ?? 'Bahçeler yüklenemedi');
    }
    isLoadingGardens.value = false;
}

async function openGarden(id: string): Promise<void> {
    sheetOpen.value = true;
    isLoadingDetail.value = true;
    detail.value = null;
    const res = await api.getFusionGarden(id);
    isLoadingDetail.value = false;
    if (!res.data) {
        toast.error(res.error?.message ?? 'Bahçe yüklenemedi');
        sheetOpen.value = false;
        return;
    }
    detail.value = res.data;
    await nextTick();
    renderChip();
}

async function downloadCsv(): Promise<void> {
    isDownloading.value = true;
    try {
        const { blob, error: message } = await api.downloadFusionProducersCsv(props.areaId, season.value);
        if (!blob) {
            toast.error(message ?? 'Liste indirilemedi');
            return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `budama-yapan-mustahsiller-${season.value}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    } finally {
        isDownloading.value = false;
    }
}

/** The garden on a faded satellite base. */
function renderChip(): void {
    chipMap?.remove();
    chipMap = null;
    const d = detail.value;
    if (!chipContainer.value || !d) return;
    chipMap = L.map(chipContainer.value, { zoomControl: false, attributionControl: false, scrollWheelZoom: false, dragging: false });
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20, maxNativeZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }).addTo(chipMap);
    L.geoJSON(props.mapData, { style: { color: cssVar('--background', '#ffffff'), weight: 0.8, opacity: 0.6, fill: false }, interactive: false }).addTo(chipMap);
    const color = classColor(d.class);
    const layer = L.geoJSON({ type: 'Feature', geometry: d.geometry, properties: {} } as GeoJSON.Feature, { style: { color, weight: 2.5, fillColor: color, fillOpacity: 0.12 }, interactive: false }).addTo(chipMap);
    // The unit that carried the verdict (a patch inside the garden when only part was cut).
    if (d.unitGeometry && d.unit === 'patch') {
        L.geoJSON({ type: 'Feature', geometry: d.unitGeometry, properties: {} } as GeoJSON.Feature, { style: { color, weight: 2, fillColor: color, fillOpacity: 0.45 }, interactive: false }).addTo(chipMap);
    }
    chipMap.fitBounds(layer.getBounds().pad(0.8), { maxZoom: 18 });
}

async function renderMap(): Promise<void> {
    if (!mapContainer.value) return;
    const res = await api.getFusionGardens(props.areaId, { season: season.value, limit: 100, page: 1 });
    // The map needs every garden: page through the list (≤ 100 per page).
    const rows: FusionGardenRow[] = [];
    if (res.data) {
        rows.push(...res.data.data);
        for (let p = 2; p <= res.data.meta.totalPages; p++) {
            const more = await api.getFusionGardens(props.areaId, { season: season.value, limit: 100, page: p });
            if (more.data) rows.push(...more.data.data);
        }
    }
    map?.remove();
    map = L.map(mapContainer.value, { zoomControl: false, attributionControl: false });
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20, maxNativeZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.geoJSON(props.mapData, { style: { color: cssVar('--background', '#ffffff'), weight: 0.7, opacity: 0.6, fill: false }, interactive: false }).addTo(map);
    // Tea outside the harvested parcels: judged on its own, dashed until its parcel arrives.
    const free = summary.value?.unassigned.patches ?? [];
    if (free.length) {
        L.geoJSON(
            { type: 'FeatureCollection', features: free.map((u) => ({ type: 'Feature', geometry: u.geometry, properties: { u } })) } as GeoJSON.FeatureCollection,
            {
                style: (f) => {
                    const u = (f?.properties as { u: FusionUnassignedPatch }).u;
                    const color = classColor(u.verdict.class);
                    return { color, weight: 1.5, dashArray: '5 4', fillColor: color, fillOpacity: u.verdict.class === 'pruned' ? 0.35 : u.verdict.class === 'likely' ? 0.2 : 0.05 };
                },
                onEachFeature: (f, l) => {
                    const u = (f.properties as { u: FusionUnassignedPatch }).u;
                    l.bindTooltip(`Parseli henüz çekilmemiş çaylık · ${formatM2(u.areaM2)} · ${FUSION_CLASS_META[u.verdict.class].label}${u.verdict.z !== null ? ` (z ${u.verdict.z})` : ''}${u.verdict.changeDate ? ` · ${fmtDate(u.verdict.changeDate)}` : ''} — tıklayınca TKGM parseli sorgulanır`, { sticky: true });
                },
                interactive: true,
            },
        ).addTo(map);
    }
    const layer = L.geoJSON(
        { type: 'FeatureCollection', features: rows.map((r) => ({ type: 'Feature', geometry: r.geometry, properties: { r } })) } as GeoJSON.FeatureCollection,
        {
            style: (f) => {
                const r = (f?.properties as { r: FusionGardenRow }).r;
                const color = classColor(r.class);
                return { color, weight: r.class === 'pruned' || r.class === 'likely' ? 2.5 : 1, fillColor: color, fillOpacity: r.class === 'pruned' ? 0.45 : r.class === 'likely' ? 0.3 : 0.08 };
            },
            onEachFeature: (f, l) => {
                const r = (f.properties as { r: FusionGardenRow }).r;
                l.bindTooltip(`${r.producerName || r.producerCode} · ${r.block}/${r.parcel} · ${FUSION_CLASS_META[r.class].label}${r.z !== null ? ` (z ${r.z})` : ''}${r.changeDate ? ` · ${fmtDate(r.changeDate)}` : ''}`, { sticky: true });
                l.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    void openGarden(r.id);
                });
            },
        },
    ).addTo(map);
    // Anywhere else: live TKGM parcel lookup (ada/parsel, nitelik, alan).
    tkgm.attach(map);
    const b = layer.getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [16, 16] });
}

// ── Sparklines of the garden's channels, the change window shaded and the chosen t0 marked ──
interface Spark {
    key: string;
    label: string;
    points: string;
    zero: number;
    t0: number | null;
    windowX: [number, number] | null;
    min: number;
    max: number;
}
const SPARK_W = 280;
const SPARK_H = 56;
const sparks = computed<Spark[]>(() => {
    const d = detail.value;
    if (!d) return [];
    const all = d.series.flatMap((s) => s.dates);
    const t0 = Date.parse(all.reduce((a, b) => (a < b ? a : b)));
    const t1 = Date.parse(all.reduce((a, b) => (a > b ? a : b)));
    const x = (date: string) => (t1 > t0 ? ((Date.parse(date) - t0) / (t1 - t0)) * SPARK_W : 0);
    return d.series
        .map((s): Spark | null => {
            const vals = s.values.filter((v): v is number => v !== null);
            if (vals.length < 3) return null;
            const floor = s.key.startsWith('vh') ? 3 : s.key.startsWith('coh') ? 0.2 : 0.2;
            const min = Math.min(-floor, ...vals);
            const max = Math.max(floor, ...vals);
            const y = (v: number) => SPARK_H - ((v - min) / (max - min)) * SPARK_H;
            const points = s.dates.map((date, i) => (s.values[i] === null ? null : `${x(date).toFixed(1)},${y(s.values[i] as number).toFixed(1)}`)).filter((p): p is string => !!p).join(' ');
            const from = d.lastBeforeAt ?? d.changeDate;
            return {
                key: s.key,
                label: FUSION_CHANNEL_LABEL[s.key],
                points,
                zero: y(0),
                t0: d.changeDate ? x(d.changeDate) : null,
                windowX: from && d.firstAfterAt ? [x(from), x(d.firstAfterAt)] : null,
                min,
                max,
            };
        })
        .filter((s): s is Spark => s !== null);
});

/** Timeline of the season's scans: one segment per emulated scan, coloured by the class it reached. */
const scanStrip = computed(() => {
    const d = detail.value;
    if (!d) return [];
    return d.scans.map((s) => ({ date: s.date, class: s.class, z: s.z }));
});

/** The season curve: gardens confirmed / likely as of each scan. */
const curve = computed(() => {
    const t = summary.value?.timeline ?? [];
    if (t.length < 2) return null;
    const max = Math.max(1, ...t.map((p) => p.pruned + p.likely));
    const x = (i: number) => (i / (t.length - 1)) * SPARK_W;
    const y = (v: number) => SPARK_H - (v / max) * SPARK_H;
    return {
        pruned: t.map((p, i) => `${x(i).toFixed(1)},${y(p.pruned).toFixed(1)}`).join(' '),
        total: t.map((p, i) => `${x(i).toFixed(1)},${y(p.pruned + p.likely).toFixed(1)}`).join(' '),
        max,
        first: t[0]!.date,
        last: t.at(-1)!.date,
    };
});

watch(season, async () => {
    pPage.value = 1;
    gPage.value = 1;
    await loadSummary();
    await Promise.all([loadProducers(), loadGardens()]);
    if (view.value === 'map') await renderMap();
});
watch(view, async (v) => {
    if (v === 'map') {
        await nextTick();
        await renderMap();
    } else if (map) {
        map.remove();
        map = null;
    }
});
watch([pStatus, pDecision], () => {
    pPage.value = 1;
    void loadProducers();
});
watch(pPage, () => void loadProducers());
watch([gClass, gLocality], () => {
    gPage.value = 1;
    void loadGardens();
});
watch(gPage, () => void loadGardens());
watch(sheetOpen, (open) => {
    if (!open) {
        chipMap?.remove();
        chipMap = null;
    }
});
let pTimer: ReturnType<typeof setTimeout> | null = null;
watch(pSearch, () => {
    if (pTimer) clearTimeout(pTimer);
    pTimer = setTimeout(() => {
        pPage.value = 1;
        void loadProducers();
    }, 300);
});
let gTimer: ReturnType<typeof setTimeout> | null = null;
watch(gSearch, () => {
    if (gTimer) clearTimeout(gTimer);
    gTimer = setTimeout(() => {
        gPage.value = 1;
        void loadGardens();
    }, 300);
});

onMounted(async () => {
    await loadSummary();
    if (summary.value) await Promise.all([loadProducers(), loadGardens()]);
    isLoading.value = false;
});
onBeforeUnmount(() => {
    if (pTimer) clearTimeout(pTimer);
    if (gTimer) clearTimeout(gTimer);
    map?.remove();
    chipMap?.remove();
});

function onSeason(v: unknown): void {
    if (typeof v === 'string' && v !== '') season.value = v;
}
function onView(v: unknown): void {
    if (v === 'producers' || v === 'gardens' || v === 'map') view.value = v;
}
function onPStatus(v: unknown): void {
    pStatus.value = typeof v === 'string' && v !== '' ? (v as ProducerFusionStatus | typeof ALL) : ALL;
}
function onPDecision(v: unknown): void {
    pDecision.value = typeof v === 'string' && v !== '' ? (v as FusionDecision | typeof ALL) : ALL;
}
/** The expert queue is exactly the anomaly bucket; everything else decided itself. */
function showExpertQueue(): void {
    view.value = 'producers';
    pDecision.value = 'expert_anomaly';
}
function onGClass(v: unknown): void {
    gClass.value = typeof v === 'string' && v !== '' ? (v as FusionClass | typeof ALL) : ALL;
}
function onGLocality(v: unknown): void {
    gLocality.value = typeof v === 'string' && v !== '' ? v : ALL;
}
function onRowKey(e: KeyboardEvent, run: () => void): void {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        run();
    }
}
function ratioTone(r: FusionProducerRow): 'success' | 'warning' | 'danger' | 'info' {
    if (r.status === 'pruned_full') return 'success';
    if (r.status === 'pruned_partial') return 'info';
    if (r.status === 'none') return 'danger';
    return 'warning';
}
</script>

<template>
    <LoadingState v-if="isLoading" text="Çok-sensör sonuçları yükleniyor…" />

    <EmptyState v-else-if="error || !summary" :icon="Radar" title="Bu alan için çok-sensör sonucu yok" :description="error ?? 'Füzyon modülü (fuse-pruning) çalıştırılıp paket içe aktarıldığında burada görünür.'">
        <Button variant="outline" class="h-11 md:h-9" @click="loadSummary">Tekrar dene</Button>
    </EmptyState>

    <div v-else class="flex flex-col gap-6">
        <Alert variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle class="flex flex-wrap items-center gap-2">
                Çok-sensör budama kararı
                <Badge variant="warning">Kalibre edilmedi · demo müstahsil verisi</Badge>
            </AlertTitle>
            <AlertDescription>
                Denklem: her bahçe (ve optik taramanın çizdiği değişim yaması) için Sentinel-2 <strong>NDVI ve NBR</strong>, Sentinel-1 <strong>VH geri saçılımı</strong> (çıkış + iniş yörüngesi)
                ve varsa koherans serileri komşuluğa göreli alınır. Aday her değişim tarihinde "önce/sonra" basamağı bahçenin <em>kendi</em> gürültüsüne bölünerek z-skoruna çevrilir;
                basamak fiziksel olarak derin budamaya yetecek büyüklükte olmalı (NDVI ≥ 0,12, VH ≥ 1 dB) ve <strong>≥ 25 gün sonra da sürmeli</strong> (gölge/kar/don geri döner, budama dönmez).
                Sensörler Stouffer ile birleştirilir; <strong>"Budandı"</strong> için optik ve radar birlikte görmeli (z ≥ 3,5). Mahalle her {{ summary.everyDays }} günde bir yeniden değerlendirilir
                ({{ summary.sensors.optical.dates.length }} S2 tarihi, {{ summary.sensors.backscatter.map((b) => `${b.dates.length} S1`).join(' + ') }}{{ summary.sensors.coherence.length ? `, ${summary.sensors.coherence.map((c) => c.dates.length).join('+')} koherans çifti` : '' }}).
            </AlertDescription>
        </Alert>

        <div class="flex flex-wrap items-center gap-3">
            <span class="text-sm text-muted-foreground">Budama sezonu</span>
            <ToggleGroup :model-value="season" type="single" aria-label="Budama sezonu" @update:model-value="onSeason">
                <ToggleGroupItem v-for="s in summary.seasons" :key="s" :value="s" class="h-11 px-3 md:h-9">{{ seasonLabel(s) }}</ToggleGroupItem>
            </ToggleGroup>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Budandı (kesin)" :value="formatNumber(summary.gardens.byClass.pruned)" :hint="`bahçe · ${formatM2(summary.gardens.prunedAreaM2)} · optik + radar birlikte`" :icon="Scissors" />
            <StatCard label="Olası budama" :value="formatNumber(summary.gardens.byClass.likely)" :hint="`bahçe · ${formatM2(summary.gardens.likelyAreaM2)} · tek sensör ya da kalıcılık bekleniyor`" />
            <StatCard label="Alım otomatik açıldı" :value="formatNumber(summary.producers.byDecision.auto_open)" :hint="`müstahsil · ${summary.producers.byDecision.auto_pending} bekliyor · ${summary.producers.byDecision.auto_none} görülmedi`" :icon="Users" />
            <StatCard label="Eksper kuyruğu (anomali)" :value="formatNumber(summary.producers.byDecision.expert_anomaly)" :hint="`yalnız çelişki / tekrar / sınır / ruhsat dosyaları · tarama her ${summary.everyDays} gün, ${summary.timeline.length} tarama`" :icon="Radar" />
        </div>

        <Alert v-if="summary.parcelCoverage !== null && summary.parcelCoverage < 0.95" variant="info">
            <AlertTitle>TKGM parsel kapsaması %{{ Math.round(summary.parcelCoverage * 100) }} · parseli çekilmemiş çaylık {{ formatDekar(summary.unassigned.areaM2) }} ({{ summary.unassigned.count }} alan)</AlertTitle>
            <AlertDescription>
                TKGM'nin halka açık servisi günde ~250 sorguya izin verdiği için mahallenin parselleri gün gün çekiliyor; parseli henüz gelmeyen çaylıklar yine de taranıyor
                ({{ summary.unassigned.byClass.pruned }} budandı · {{ summary.unassigned.byClass.likely }} olası · {{ summary.unassigned.byClass.unclear }} belirsiz · {{ summary.unassigned.byClass.not_pruned }} budama yok) ve parseli/ruhsatı gelince sahibine bağlanacak.
                Haritada kesikli çizgiyle gösterilir; herhangi bir noktaya tıklayınca TKGM'den ada/parsel canlı sorgulanır.
            </AlertDescription>
        </Alert>

        <Card v-if="curve">
            <CardHeader>
                <CardTitle>Sezon boyunca budama eğrisi</CardTitle>
                <CardDescription>Her taramada "budandı" (koyu) ve "budandı + olası" (açık) sayılan bahçeler · {{ fmtDate(curve.first) }} → {{ fmtDate(curve.last) }} · en çok {{ curve.max }}</CardDescription>
            </CardHeader>
            <CardContent>
                <svg :viewBox="`0 0 ${SPARK_W} ${SPARK_H}`" class="h-24 w-full" role="img" aria-label="Sezon boyunca budanan bahçe sayısı">
                    <polyline :points="curve.total" fill="none" class="stroke-info/60" stroke-width="1.5" />
                    <polyline :points="curve.pruned" fill="none" class="stroke-primary" stroke-width="2" />
                </svg>
            </CardContent>
        </Card>

        <div class="flex flex-wrap items-center gap-3">
            <span class="text-sm text-muted-foreground">Görünüm</span>
            <ToggleGroup :model-value="view" type="single" aria-label="Çok-sensör görünümü" @update:model-value="onView">
                <ToggleGroupItem value="producers" class="h-11 px-3 md:h-9">Budama yapanlar (müstahsil)</ToggleGroupItem>
                <ToggleGroupItem value="gardens" class="h-11 px-3 md:h-9">Bahçeler ve kanıt</ToggleGroupItem>
                <ToggleGroupItem value="map" class="h-11 px-3 md:h-9">Harita</ToggleGroupItem>
            </ToggleGroup>
        </div>

        <!-- ── Producers ── -->
        <Card v-if="view === 'producers'">
            <CardHeader>
                <CardTitle>Budama yapan müstahsiller ve alım kararı</CardTitle>
                <CardDescription>{{ formatNumber(pTotal) }} müstahsil · karar politikası: kanıt temizse uydu kendi karar verir, eksper yalnız anomalileri görür</CardDescription>
                <CardAction class="flex gap-2">
                    <Button variant="outline" size="sm" class="h-11 md:h-9" @click="showExpertQueue">Eksper kuyruğu ({{ summary.producers.byDecision.expert_anomaly }})</Button>
                    <Button variant="outline" size="sm" class="h-11 md:h-9" :disabled="isDownloading" @click="downloadCsv"><Download aria-hidden="true" />CSV</Button>
                </CardAction>
            </CardHeader>
            <CardContent class="flex flex-col gap-4">
                <ListToolbar>
                    <SearchInput v-model="pSearch" placeholder="Ad, müstahsil / cüzdan / ruhsat no…" />
                    <template #filters>
                        <Select :model-value="pDecision" @update:model-value="onPDecision">
                            <SelectTrigger class="h-11 w-full md:h-9 md:w-56" aria-label="Alım kararı"><SelectValue placeholder="Alım kararı" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="ALL">Tüm kararlar</SelectItem>
                                <SelectItem v-for="d in FUSION_DECISION_ORDER" :key="d" :value="d">{{ FUSION_DECISION_META[d].label }} ({{ summary.producers.byDecision[d] }})</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select :model-value="pStatus" @update:model-value="onPStatus">
                            <SelectTrigger class="h-11 w-full md:h-9 md:w-52" aria-label="Durum"><SelectValue placeholder="Durum" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="ALL">Tüm durumlar</SelectItem>
                                <SelectItem v-for="s in PRODUCER_FUSION_ORDER" :key="s" :value="s">{{ PRODUCER_FUSION_META[s].label }} ({{ summary.producers.byStatus[s] }})</SelectItem>
                            </SelectContent>
                        </Select>
                    </template>
                </ListToolbar>
                <LoadingState v-if="isLoadingProducers && pRows.length === 0" text="Yükleniyor…" />
                <EmptyState v-else-if="pRows.length === 0" :icon="Users" title="Müstahsil yok" description="Bu filtrede kayıt bulunmuyor." />
                <div v-else class="overflow-hidden rounded-lg border bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Müstahsil</TableHead>
                                <TableHead class="hidden md:table-cell">Bahçe</TableHead>
                                <TableHead>1/7 hedefi</TableHead>
                                <TableHead>Alım kararı</TableHead>
                                <TableHead class="hidden lg:table-cell">İlk kesin tespit</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow v-for="r in pRows" :key="r.id">
                                <TableCell>
                                    <div class="font-medium text-foreground">{{ r.name }}</div>
                                    <div class="text-xs text-muted-foreground">{{ r.code }} · {{ r.licenseNo || 'ruhsat yok' }}</div>
                                    <Badge :variant="toneVariant(PRODUCER_FUSION_META[r.status].tone)" class="mt-1" :title="PRODUCER_FUSION_META[r.status].description">{{ PRODUCER_FUSION_META[r.status].label }}</Badge>
                                </TableCell>
                                <TableCell class="hidden md:table-cell">{{ r.gardens }}<span class="text-xs text-muted-foreground"> · {{ r.prunedGardens.length }} kesin, {{ r.likelyGardens.length }} olası</span></TableCell>
                                <TableCell>
                                    <div class="flex items-center gap-2">
                                        <Progress :model-value="Math.min(100, Math.round(r.ratio * 100))" class="h-2 w-24" :class="PROGRESS_TONE_CLASS[ratioTone(r)]" />
                                        <span class="text-xs tabular-nums">{{ r.requiredM2 ? formatShare(r.ratio) : '—' }}</span>
                                    </div>
                                    <div class="text-xs text-muted-foreground">
                                        sayılan {{ formatM2(r.countedM2 ?? r.prunedAreaM2) }} / hedef {{ r.requiredM2 ? formatM2(r.requiredM2) : '—' }}
                                        · kesin {{ formatM2(r.prunedAreaM2) }}<span v-if="r.likelyAreaM2"> + olası {{ formatM2(r.likelyAreaM2) }}</span>
                                    </div>
                                    <div v-if="r.reusedM2" class="text-xs text-warning">tekrar budanan {{ formatM2(r.reusedM2) }} sayılmadı (7 yıl kuralı)</div>
                                    <div v-if="r.requiredM2 && (r.shortfallM2 ?? 0) > 0" class="text-xs text-destructive">eksik: {{ formatM2(r.shortfallM2 ?? 0) }} daha budanmalı</div>
                                </TableCell>
                                <TableCell>
                                    <Badge :variant="toneVariant(FUSION_DECISION_META[r.decision ?? 'no_data'].tone)" :title="r.decisionReason ?? FUSION_DECISION_META[r.decision ?? 'no_data'].description">{{ FUSION_DECISION_META[r.decision ?? 'no_data'].label }}</Badge>
                                    <div v-if="r.anomalies?.length" class="mt-1 flex flex-wrap gap-1">
                                        <Badge v-for="a in r.anomalies" :key="a" variant="outline" class="text-[10px]">{{ FUSION_ANOMALY_LABEL[a] }}</Badge>
                                    </div>
                                </TableCell>
                                <TableCell class="hidden lg:table-cell">{{ fmtDate(r.firstDetectedAt) }}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
                <div v-if="pTotalPages > 1" class="flex items-center justify-between gap-3">
                    <span class="text-sm text-muted-foreground">Sayfa {{ pPage }} / {{ pTotalPages }}</span>
                    <div class="flex gap-2">
                        <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="pPage <= 1" aria-label="Önceki sayfa" @click="pPage--"><ChevronLeft aria-hidden="true" /></Button>
                        <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="pPage >= pTotalPages" aria-label="Sonraki sayfa" @click="pPage++"><ChevronRight aria-hidden="true" /></Button>
                    </div>
                </div>
            </CardContent>
        </Card>

        <!-- ── Gardens ── -->
        <Card v-if="view === 'gardens'">
            <CardHeader>
                <CardTitle>Bahçe kararları ve kanıt</CardTitle>
                <CardDescription>{{ formatNumber(gTotal) }} bahçe · satıra tıklayınca sensör serileri, basamak kanıtı ve tarama zaman çizelgesi</CardDescription>
            </CardHeader>
            <CardContent class="flex flex-col gap-4">
                <ListToolbar>
                    <SearchInput v-model="gSearch" placeholder="Müstahsil, ada/parsel, bahçe, mevki…" />
                    <template #filters>
                        <Select :model-value="gClass" @update:model-value="onGClass">
                            <SelectTrigger class="h-11 w-full md:h-9 md:w-44" aria-label="Karar"><SelectValue placeholder="Karar" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="ALL">Tüm kararlar</SelectItem>
                                <SelectItem v-for="c in FUSION_CLASS_ORDER" :key="c" :value="c">{{ FUSION_CLASS_META[c].label }} ({{ summary.gardens.byClass[c] }})</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select :model-value="gLocality" @update:model-value="onGLocality">
                            <SelectTrigger class="h-11 w-full md:h-9 md:w-44" aria-label="Mevki"><SelectValue placeholder="Mevki" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="ALL">Tüm mevkiler</SelectItem>
                                <SelectItem v-for="l in summary.localities" :key="l.name" :value="l.name">{{ l.name }} ({{ l.pruned }}/{{ l.total }})</SelectItem>
                            </SelectContent>
                        </Select>
                    </template>
                </ListToolbar>
                <LoadingState v-if="isLoadingGardens && gRows.length === 0" text="Yükleniyor…" />
                <EmptyState v-else-if="gRows.length === 0" :icon="Layers" title="Bahçe yok" description="Bu filtrede kayıt bulunmuyor." />
                <div v-else class="overflow-hidden rounded-lg border bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Bahçe</TableHead>
                                <TableHead class="hidden md:table-cell">Müstahsil</TableHead>
                                <TableHead>Karar</TableHead>
                                <TableHead class="hidden lg:table-cell">Sensörler</TableHead>
                                <TableHead class="hidden md:table-cell">Değişim</TableHead>
                                <TableHead class="hidden text-right lg:table-cell">Kesinleşme</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow v-for="r in gRows" :key="r.id" class="cursor-pointer" tabindex="0" role="button" :aria-label="`${r.block}/${r.parcel} bahçesini aç`" @click="openGarden(r.id)" @keydown="onRowKey($event, () => openGarden(r.id))">
                                <TableCell>
                                    <div class="font-medium text-foreground">{{ r.block }}/{{ r.parcel }}<span v-if="r.holderCount > 1" class="font-normal text-muted-foreground"> · hisse {{ r.holderIndex }}/{{ r.holderCount }}</span></div>
                                    <div class="text-xs text-muted-foreground">{{ r.locality }} · {{ r.unit === 'patch' ? `yama ${formatM2(r.unitAreaM2)}` : formatM2(r.areaM2) }}</div>
                                </TableCell>
                                <TableCell class="hidden md:table-cell">{{ r.producerName || r.producerCode }}</TableCell>
                                <TableCell>
                                    <Badge :variant="toneVariant(FUSION_CLASS_META[r.class].tone)" :title="r.reason">{{ FUSION_CLASS_META[r.class].label }}</Badge>
                                    <div v-if="r.z !== null" class="text-xs text-muted-foreground">z {{ r.z }} · p {{ formatShare(r.p) }}</div>
                                </TableCell>
                                <TableCell class="hidden lg:table-cell">
                                    <div class="flex gap-1">
                                        <Badge :variant="r.opticalOk ? 'success' : 'outline'">Optik</Badge>
                                        <Badge :variant="r.backscatterOk ? 'success' : 'outline'">Radar</Badge>
                                    </div>
                                </TableCell>
                                <TableCell class="hidden text-xs md:table-cell">{{ r.lastBeforeAt ? fmtDate(r.lastBeforeAt) : '—' }} → {{ fmtDate(r.firstAfterAt) }}</TableCell>
                                <TableCell class="hidden text-right text-xs lg:table-cell">{{ r.detectedAt ? fmtDate(r.detectedAt) : r.likelyAt ? `olası ${fmtDate(r.likelyAt)}` : '—' }}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
                <div v-if="gTotalPages > 1" class="flex items-center justify-between gap-3">
                    <span class="text-sm text-muted-foreground">Sayfa {{ gPage }} / {{ gTotalPages }}</span>
                    <div class="flex gap-2">
                        <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="gPage <= 1" aria-label="Önceki sayfa" @click="gPage--"><ChevronLeft aria-hidden="true" /></Button>
                        <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="gPage >= gTotalPages" aria-label="Sonraki sayfa" @click="gPage++"><ChevronRight aria-hidden="true" /></Button>
                    </div>
                </div>
            </CardContent>
        </Card>

        <!-- ── Map ── -->
        <Card v-if="view === 'map'">
            <CardHeader>
                <CardTitle>Nerede budandı</CardTitle>
                <CardDescription>Bahçeler karara göre renkli: yeşil budandı, mavi olası, turuncu belirsiz, gri budama yok. Bahçeye tıklayınca kanıt açılır.</CardDescription>
            </CardHeader>
            <CardContent>
                <div ref="mapContainer" class="h-[60vh] min-h-80 w-full overflow-hidden rounded-lg border" />
            </CardContent>
        </Card>

        <!-- ── Garden evidence sheet ── -->
        <Sheet v-model:open="sheetOpen">
            <SheetContent side="right" class="w-full gap-0 overflow-y-auto sm:max-w-3xl">
                <LoadingState v-if="isLoadingDetail || !detail" text="Kanıt yükleniyor…" class="p-6" />
                <template v-else>
                    <SheetHeader class="border-b">
                        <SheetTitle>{{ detail.block }}/{{ detail.parcel }} · {{ detail.producerName || detail.producerCode }}</SheetTitle>
                        <SheetDescription>{{ detail.code }} · {{ detail.locality }} · {{ detail.unit === 'patch' ? `optik değişim yaması ${formatM2(detail.unitAreaM2)} (bahçe ${formatM2(detail.areaM2)})` : formatM2(detail.areaM2) }}</SheetDescription>
                        <div class="flex flex-wrap items-center gap-2">
                            <Badge :variant="toneVariant(FUSION_CLASS_META[detail.class].tone)">{{ FUSION_CLASS_META[detail.class].label }}</Badge>
                            <Badge :variant="detail.opticalOk ? 'success' : 'outline'">Optik {{ detail.opticalOk ? '✓' : '—' }}</Badge>
                            <Badge :variant="detail.backscatterOk ? 'success' : 'outline'">Radar {{ detail.backscatterOk ? '✓' : '—' }}</Badge>
                            <span class="text-xs text-muted-foreground">{{ detail.reason }}</span>
                        </div>
                    </SheetHeader>
                    <div class="flex flex-col gap-6 p-4 md:p-6">
                        <div class="grid gap-3 sm:grid-cols-3">
                            <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Birleşik z / olasılık</div><div class="font-semibold tabular-nums text-foreground">{{ detail.z ?? '—' }} · {{ formatShare(detail.p) }}</div></div>
                            <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Değişim aralığı</div><div class="text-sm">{{ detail.lastBeforeAt ? fmtDate(detail.lastBeforeAt) : '—' }} → {{ fmtDate(detail.firstAfterAt) }}</div></div>
                            <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Tarama tespiti</div><div class="text-sm">{{ detail.likelyAt ? `olası ${fmtDate(detail.likelyAt)}` : '—' }}<span v-if="detail.detectedAt"> · kesin {{ fmtDate(detail.detectedAt) }}</span></div></div>
                        </div>

                        <div ref="chipContainer" class="h-56 w-full overflow-hidden rounded-lg border" />

                        <Alert v-if="detail.repeat && detail.repeat.reusedM2 > 0" :variant="detail.repeat.reusedShare >= 0.2 ? 'warning' : 'info'">
                            <AlertTitle>7 yıl kuralı: {{ formatM2(detail.repeat.reusedM2) }} ({{ formatShare(detail.repeat.reusedShare) }}) daha önce budanmış alanla çakışıyor</AlertTitle>
                            <AlertDescription>
                                Bu kısım 1/7 hedefine sayılmadı; sayılan yeni alan {{ formatM2(detail.repeat.countedM2) }}.
                                Kanıt: <span v-for="e in detail.repeat.evidence" :key="e.season">{{ e.season }} sezonunda {{ FUSION_CLASS_META[e.class].label.toLocaleLowerCase('tr-TR') }} alanla {{ formatM2(e.overlapM2) }} çakışma; </span>
                            </AlertDescription>
                        </Alert>

                        <section class="flex flex-col gap-2">
                            <h3 class="text-base font-semibold">Basamak kanıtı (değişim tarihi {{ fmtDate(detail.changeDate) }})</h3>
                            <div class="overflow-hidden rounded-lg border bg-card">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Kanal</TableHead>
                                            <TableHead class="text-right">Önce / sonra</TableHead>
                                            <TableHead class="text-right">Basamak</TableHead>
                                            <TableHead class="text-right">Gürültü</TableHead>
                                            <TableHead class="text-right">z</TableHead>
                                            <TableHead class="text-right">Kalıcılık</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <template v-for="g in detail.groups" :key="g.group">
                                            <TableRow class="bg-muted/30">
                                                <TableCell colspan="4" class="text-xs font-medium">{{ FUSION_GROUP_LABEL[g.group] }}</TableCell>
                                                <TableCell class="text-right text-xs font-medium tabular-nums">{{ g.z ?? '—' }}</TableCell>
                                                <TableCell />
                                            </TableRow>
                                            <TableRow v-for="c in g.channels" :key="c.key">
                                                <TableCell class="text-sm">{{ FUSION_CHANNEL_LABEL[c.key] }}</TableCell>
                                                <TableCell class="text-right text-xs tabular-nums">{{ c.before }} / {{ c.after }}<span class="text-muted-foreground"> ({{ c.late }} geç)</span></TableCell>
                                                <TableCell class="text-right text-xs tabular-nums" :class="c.magnitudeOk ? 'font-semibold text-foreground' : ''">{{ c.delta ?? '—' }}{{ c.key.startsWith('vh') ? ' dB' : '' }}</TableCell>
                                                <TableCell class="text-right text-xs tabular-nums">±{{ c.noise }}</TableCell>
                                                <TableCell class="text-right text-xs tabular-nums">{{ c.z ?? '—' }}</TableCell>
                                                <TableCell class="text-right text-xs tabular-nums">{{ c.persistence === null ? 'bekleniyor' : formatShare(c.persistence) }}</TableCell>
                                            </TableRow>
                                        </template>
                                    </TableBody>
                                </Table>
                            </div>
                            <p class="text-xs text-muted-foreground">Basamak: sonra − önce ortalaması, budama yönünde pozitif (NDVI/NBR/VH düşer, koherans yükselir). z: basamak / (gürültü · √(1/n_önce + 1/n_sonra)); kalıcılık geç gözlemlerde kalan pay, z bununla çarpılır.</p>
                        </section>

                        <section class="flex flex-col gap-2">
                            <h3 class="text-base font-semibold">Tarama zaman çizelgesi (her {{ summary.everyDays }} gün)</h3>
                            <div class="flex h-6 w-full overflow-hidden rounded border" role="img" aria-label="Taramaların karar şeridi">
                                <div v-for="s in scanStrip" :key="s.date" class="h-full flex-1" :style="{ background: classColor(s.class), opacity: s.class === 'no_data' ? 0.25 : 0.85 }" :title="`${fmtDate(s.date)} · ${FUSION_CLASS_META[s.class].label}${s.z !== null ? ` · z ${s.z}` : ''}`" />
                            </div>
                            <div class="flex justify-between text-[11px] text-muted-foreground"><span>{{ fmtDate(scanStrip[0]?.date) }}</span><span>{{ fmtDate(scanStrip.at(-1)?.date) }}</span></div>
                        </section>

                        <section class="flex flex-col gap-3">
                            <h3 class="text-base font-semibold">Sensör serileri (komşuluğa göreli)</h3>
                            <div v-for="s in sparks" :key="s.key" class="flex flex-col gap-1">
                                <span class="text-[11px] text-muted-foreground">{{ s.label }} · {{ s.min.toFixed(2) }}…{{ s.max.toFixed(2) }}</span>
                                <svg :viewBox="`0 0 ${SPARK_W} ${SPARK_H}`" class="h-14 w-full" role="img" :aria-label="`${s.label} serisi`">
                                    <rect v-if="s.windowX" :x="s.windowX[0]" y="0" :width="Math.max(2, s.windowX[1] - s.windowX[0])" :height="SPARK_H" class="fill-destructive/15" />
                                    <line x1="0" :y1="s.zero" :x2="SPARK_W" :y2="s.zero" class="stroke-muted-foreground/40" stroke-width="1" stroke-dasharray="3 3" />
                                    <line v-if="s.t0 !== null" :x1="s.t0" y1="0" :x2="s.t0" :y2="SPARK_H" class="stroke-destructive" stroke-width="1" />
                                    <polyline :points="s.points" fill="none" :class="s.key.startsWith('vh') ? 'stroke-info' : s.key.startsWith('coh') ? 'stroke-success' : 'stroke-primary'" stroke-width="1.5" stroke-linejoin="round" />
                                </svg>
                            </div>
                        </section>
                    </div>
                </template>
            </SheetContent>
        </Sheet>
    </div>
</template>
