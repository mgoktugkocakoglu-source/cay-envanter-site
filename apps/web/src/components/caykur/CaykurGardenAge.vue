<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { CalendarClock, ChevronLeft, ChevronRight, History, Sprout, TriangleAlert } from '@lucide/vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EmptyState, LoadingState, SearchInput, StatCard } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { type Tone } from '@/components/caykur/tone';
import {
    api,
    type GardenAbandonClass,
    type GardenActivityClass,
    type GardenAgeClass,
    type GardenAgeParcelDetail,
    type GardenAgeParcelRow,
    type GardenAgeSummary,
    type GardenPriorityClass,
} from '@/services/api';
import { formatHectare, formatM2 } from '@/services/caykur/teaInventory';
import { formatNumber } from '@/services/caykur';

/**
 * Garden age and renewal module (Bahçe yaşı ve yenileme): for every tea parcel, the Landsat summer NDVI
 * record since 1984 dates the garden (closed canopy after a low establishment phase; already closed at
 * the start of the record = planted before 1986), reveals rejuvenation prunings (sharp drop, recovery
 * within four summers) and the vigour trend; Sentinel-2 monthly NDVI shows whether the garden is still
 * harvested (in-season dips). Abandonment and renewal-priority scores feed ÇAYKUR's rejuvenation plan.
 */
const props = defineProps<{ areaId: string }>();

const ALL = 'all';
const PAGE_SIZE = 15;
const AGE_ORDER: GardenAgeClass[] = ['over_40', 'y25_40', 'y10_25', 'under_10', 'unknown', 'not_tea'];
const AGE_META: Record<GardenAgeClass, { label: string; color: string; tone: Tone }> = {
    over_40: { label: '40 yaş üstü (1986 öncesi)', color: '#7f1d1d', tone: 'danger' },
    y25_40: { label: '25–40 yaş', color: '#dc2626', tone: 'warning' },
    y10_25: { label: '10–25 yaş', color: '#eab308', tone: 'info' },
    under_10: { label: '10 yaş altı', color: '#15803d', tone: 'success' },
    unknown: { label: 'Belirlenemedi', color: '#94a3b8', tone: 'muted' },
    not_tea: { label: 'Çay örtüsü yok', color: '#cbd5e1', tone: 'muted' },
};
const ACTIVITY_ORDER: GardenActivityClass[] = ['harvested', 'low', 'none', 'no_data'];
const ACTIVITY_META: Record<GardenActivityClass, { label: string; color: string; tone: Tone }> = {
    harvested: { label: 'Hasat ediliyor', color: '#15803d', tone: 'success' },
    low: { label: 'Seyrek hasat', color: '#eab308', tone: 'warning' },
    none: { label: 'Hasat izi yok', color: '#dc2626', tone: 'danger' },
    no_data: { label: 'Veri yok', color: '#94a3b8', tone: 'muted' },
};
const ABANDON_ORDER: GardenAbandonClass[] = ['likely_abandoned', 'weak', 'active', 'not_tea'];
const ABANDON_META: Record<GardenAbandonClass, { label: string; color: string; tone: Tone }> = {
    likely_abandoned: { label: 'Terk edilmiş olabilir', color: '#dc2626', tone: 'danger' },
    weak: { label: 'Zayıf işletme', color: '#f59e0b', tone: 'warning' },
    active: { label: 'Aktif', color: '#15803d', tone: 'success' },
    not_tea: { label: 'Çay değil', color: '#cbd5e1', tone: 'muted' },
};
const PRIORITY_ORDER: GardenPriorityClass[] = ['high', 'medium', 'low', 'not_applicable'];
const PRIORITY_META: Record<GardenPriorityClass, { label: string; color: string; tone: Tone }> = {
    high: { label: 'Yüksek öncelik', color: '#dc2626', tone: 'danger' },
    medium: { label: 'Orta öncelik', color: '#f59e0b', tone: 'warning' },
    low: { label: 'Düşük öncelik', color: '#15803d', tone: 'success' },
    not_applicable: { label: 'Kapsam dışı', color: '#cbd5e1', tone: 'muted' },
};
const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const summary = ref<GardenAgeSummary | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);
type View = 'summary' | 'parcels' | 'map';
const view = ref<View>('summary');

const search = ref('');
const fAge = ref<GardenAgeClass | typeof ALL>(ALL);
const fActivity = ref<GardenActivityClass | typeof ALL>(ALL);
const fAbandon = ref<GardenAbandonClass | typeof ALL>(ALL);
const fPriority = ref<GardenPriorityClass | typeof ALL>(ALL);
const sort = ref<'priority' | 'age' | 'abandonment' | 'parcel'>('priority');
const page = ref(1);
const rows = ref<GardenAgeParcelRow[]>([]);
const total = ref(0);
const totalPages = ref(1);
const isLoadingRows = ref(false);
const sheetOpen = ref(false);
const detail = ref<GardenAgeParcelDetail | null>(null);
const isLoadingDetail = ref(false);
const mapBy = ref<'priority' | 'ageClass' | 'activity' | 'abandonment'>('priority');
const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let layer: L.GeoJSON | null = null;

const signed = (v: number | null, digits = 2) => (v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(digits)}`);
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)} %`);
const num = (v: number | null | undefined, digits = 0) => (v === null || v === undefined || Number.isNaN(v) ? '—' : v.toFixed(digits));

const decades = computed(() => {
    const m = summary.value?.summary.establishmentByDecade ?? {};
    const order = (k: string) => (k === '1986 öncesi' ? 0 : k === 'belirsiz' ? 99 : Number(k.slice(0, 4)));
    return Object.entries(m).sort((a, b) => order(a[0]) - order(b[0]));
});
const renewalYears = computed(() => Object.entries(summary.value?.summary.renewalsByYear ?? {}).map(([y, n]) => ({ year: Number(y), n })).sort((a, b) => a.year - b.year));
const maxRenewal = computed(() => Math.max(1, ...renewalYears.value.map((r) => r.n)));
const teaParcels = computed(() => (summary.value ? summary.value.summary.parcels - summary.value.summary.byAgeClass.not_tea : 0));

async function loadSummary(): Promise<void> {
    isLoading.value = true;
    error.value = null;
    const res = await api.getGardenAgeSummary(props.areaId);
    if (res.data) summary.value = res.data;
    else error.value = res.error?.message ?? 'Bahçe yaşı değerlendirmesi alınamadı';
    isLoading.value = false;
    if (summary.value) void loadRows();
}
async function loadRows(): Promise<void> {
    isLoadingRows.value = true;
    const res = await api.getGardenAgeParcels(props.areaId, {
        page: page.value,
        limit: PAGE_SIZE,
        search: search.value || undefined,
        ageClass: fAge.value === ALL ? undefined : fAge.value,
        activity: fActivity.value === ALL ? undefined : fActivity.value,
        abandonment: fAbandon.value === ALL ? undefined : fAbandon.value,
        priority: fPriority.value === ALL ? undefined : fPriority.value,
        sort: sort.value,
    });
    if (res.data) {
        rows.value = res.data.data;
        total.value = res.data.meta.total;
        totalPages.value = res.data.meta.totalPages;
    }
    isLoadingRows.value = false;
}
watch([search, fAge, fActivity, fAbandon, fPriority, sort], () => { page.value = 1; void loadRows(); });
watch(page, () => void loadRows());

async function openParcel(id: string): Promise<void> {
    sheetOpen.value = true;
    isLoadingDetail.value = true;
    detail.value = null;
    const res = await api.getGardenAgeParcel(props.areaId, id);
    if (res.data) detail.value = res.data;
    isLoadingDetail.value = false;
}

// ── chart helpers (Landsat yearly series) ──
const CH = { w: 760, h: 220, l: 40, r: 12, t: 12, b: 28 };
function xOf(years: number[], y: number): number {
    const y0 = years[0] ?? 1984;
    const y1 = years.at(-1) ?? 2026;
    return CH.l + ((y - y0) / Math.max(1, y1 - y0)) * (CH.w - CH.l - CH.r);
}
function yOf(v: number): number {
    return CH.t + (1 - Math.max(0, Math.min(1, v))) * (CH.h - CH.t - CH.b);
}
function pathOf(years: number[], values: Array<number | null>): string {
    let d = '';
    let pen = false;
    values.forEach((v, i) => {
        if (v === null) {
            pen = false;
            return;
        }
        d += `${pen ? 'L' : 'M'}${xOf(years, years[i]!).toFixed(1)},${yOf(v).toFixed(1)} `;
        pen = true;
    });
    return d;
}
const chartYears = computed(() => detail.value?.age.series.years ?? []);
const rawPath = computed(() => (detail.value ? pathOf(chartYears.value, detail.value.age.series.ndvi) : ''));
const smoothPath = computed(() => (detail.value ? pathOf(chartYears.value, detail.value.age.series.smooth) : ''));
const chartTicks = computed(() => chartYears.value.filter((y) => y % 5 === 0));
function s2Path(months: number[], values: Array<number | null>, w: number, h: number): string {
    let d = '';
    let pen = false;
    values.forEach((v, i) => {
        if (v === null) {
            pen = false;
            return;
        }
        const x = 4 + (i / Math.max(1, months.length - 1)) * (w - 8);
        const y = 4 + (1 - Math.max(0, Math.min(1, v))) * (h - 8);
        d += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `;
        pen = true;
    });
    return d;
}
const s2Recent = computed(() => (detail.value ? detail.value.age.s2.years.slice(-6) : []));

// ── map ──
function cssVar(name: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
function colourOf(p: Record<string, unknown>): string {
    switch (mapBy.value) {
        case 'priority': return PRIORITY_META[p.priority as GardenPriorityClass]?.color ?? '#94a3b8';
        case 'ageClass': return AGE_META[p.ageClass as GardenAgeClass]?.color ?? '#94a3b8';
        case 'activity': return ACTIVITY_META[p.activity as GardenActivityClass]?.color ?? '#94a3b8';
        case 'abandonment': return ABANDON_META[p.abandonment as GardenAbandonClass]?.color ?? '#94a3b8';
    }
    return '#94a3b8';
}
function labelOf(p: Record<string, unknown>): string {
    const age = p.ageYears === null || p.ageYears === undefined ? '' : ` · ${p.ageYears} yıl`;
    switch (mapBy.value) {
        case 'priority': return `${PRIORITY_META[p.priority as GardenPriorityClass]?.label ?? '—'} (${p.priorityScore})${age}`;
        case 'ageClass': return `${AGE_META[p.ageClass as GardenAgeClass]?.label ?? '—'}${p.establishmentYear ? ` · tesis ${p.establishmentYear}` : ''}`;
        case 'activity': return ACTIVITY_META[p.activity as GardenActivityClass]?.label ?? '—';
        case 'abandonment': return ABANDON_META[p.abandonment as GardenAbandonClass]?.label ?? '—';
    }
    return '';
}
const legend = computed(() => {
    switch (mapBy.value) {
        case 'priority': return PRIORITY_ORDER.map((k) => ({ label: PRIORITY_META[k].label, color: PRIORITY_META[k].color }));
        case 'ageClass': return AGE_ORDER.map((k) => ({ label: AGE_META[k].label, color: AGE_META[k].color }));
        case 'activity': return ACTIVITY_ORDER.map((k) => ({ label: ACTIVITY_META[k].label, color: ACTIVITY_META[k].color }));
        case 'abandonment': return ABANDON_ORDER.map((k) => ({ label: ABANDON_META[k].label, color: ABANDON_META[k].color }));
    }
    return [];
});
async function renderMap(): Promise<void> {
    await nextTick();
    if (!mapContainer.value) return;
    if (!map) {
        map = L.map(mapContainer.value, { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
        L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20, maxNativeZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }).addTo(map);
        L.control.zoom({ position: 'topright' }).addTo(map);
    }
    const res = await api.getGardenAgeLayers(props.areaId, mapBy.value);
    if (!res.data || !map) return;
    layer?.remove();
    layer = L.geoJSON(res.data, {
        style: (f) => ({ color: cssVar('--background', '#ffffff'), weight: 0.6, fillColor: colourOf(f?.properties ?? {}), fillOpacity: 0.65 }),
        onEachFeature: (f, l) => {
            const p = f.properties as Record<string, unknown>;
            l.bindTooltip(`${p.block}/${p.parcel} · ${labelOf(p)}`, { sticky: true });
            l.on('click', () => void openParcel(String(p.id)));
        },
    }).addTo(map);
    const b = layer.getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [16, 16] });
    map.invalidateSize();
}
watch(view, (v) => { if (v === 'map') void renderMap(); });
watch(mapBy, () => { if (view.value === 'map') void renderMap(); });
function onView(v: unknown): void { if (v === 'summary' || v === 'parcels' || v === 'map') view.value = v; }
function pick<T extends string>(v: unknown): T | typeof ALL { return typeof v === 'string' && v !== '' ? (v as T) : ALL; }

watch(() => props.areaId, () => { summary.value = null; layer?.remove(); layer = null; void loadSummary(); }, { immediate: true });
onBeforeUnmount(() => { map?.remove(); map = null; });
</script>

<template>
    <div class="flex flex-col gap-6">
        <LoadingState v-if="isLoading && !summary" text="Bahçe yaşı değerlendirmesi yükleniyor…" />
        <EmptyState v-else-if="error || !summary" :icon="History" title="Bu mahalle için bahçe yaşı değerlendirmesi yok" :description="error ?? 'Motor tarafında garden-age çalıştırıldığında burada görünür.'">
            <Button variant="outline" class="h-11 md:h-9" @click="loadSummary">Tekrar dene</Button>
        </EmptyState>
        <template v-else>
            <Alert variant="warning">
                <AlertTitle class="flex flex-wrap items-center gap-2">Ayrı modül · Bahçe yaşı, gençleştirme ve terk tespiti <Badge variant="warning">Kalibre edilmedi</Badge></AlertTitle>
                <AlertDescription>
                    Her çaylı parsel için Landsat yaz NDVI kaydı (1984 →): kapalı örtünün (NDVI ≥ 0,55) sürekli başladığı ve öncesinde düşük faz (&lt; 0,40) görülen yıl tesis yılı sayılır; kayıt başında zaten kapalı örtü "1986 öncesi tesis"tir. ≥ 0,08 düşüş ve dört yazda toparlanma gençleştirme/yenileme izi, son 12 yılın eğilimi ve mahalle ortancasına göre konum canlılık göstergesidir. Sentinel-2 aylık NDVI (2017 →) ile sezon içi hasat düşüşleri sayılır; düşüş yoksa, çay payı düşükse ve örtü düz-yüksekse terk belirtisi işaretlenir. ÇAYKUR'a göre bahçeler 60–100 yaşında ve verim ömrü 50 yıldır; her yıl bahçelerin yedide biri budanır. Tesis yılı bir tahmindir: ruhsat tarihi ve saha bilgisiyle doğrulanmalıdır.
                </AlertDescription>
            </Alert>

            <div class="-mx-1 overflow-x-auto px-1 pb-1">
                <ToggleGroup :model-value="view" type="single" aria-label="Bahçe yaşı görünümü" class="w-max" @update:model-value="onView">
                    <ToggleGroupItem value="summary" class="h-11 px-3 md:h-9">Özet</ToggleGroupItem>
                    <ToggleGroupItem value="parcels" class="h-11 px-3 md:h-9">Parseller ({{ summary.summary.parcels }})</ToggleGroupItem>
                    <ToggleGroupItem value="map" class="h-11 px-3 md:h-9">Harita</ToggleGroupItem>
                </ToggleGroup>
            </div>

            <template v-if="view === 'summary'">
                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Çaylı parsel" :value="formatNumber(teaParcels)" :hint="`${formatHectare(summary.summary.teaAreaM2)} · ${summary.summary.parcels} parsel tarandı`" :icon="Sprout" />
                    <StatCard label="Ortalama yaş (tahmin)" :value="summary.summary.meanAgeYears === null ? '—' : `${summary.summary.meanAgeYears} yıl`" :hint="`40 yaş üstü ${summary.summary.byAgeClass.over_40} · 25–40 yaş ${summary.summary.byAgeClass.y25_40} · 25 yaş altı ${summary.summary.byAgeClass.y10_25 + summary.summary.byAgeClass.under_10}`" :icon="CalendarClock" />
                    <StatCard label="Yenileme önceliği yüksek" :value="formatNumber(summary.summary.byPriority.high)" :hint="`${formatHectare(summary.summary.highPriorityAreaM2)} · orta ${summary.summary.byPriority.medium} · düşük ${summary.summary.byPriority.low}`" :icon="History" />
                    <StatCard label="Terk edilmiş olabilir" :value="formatNumber(summary.summary.byAbandonment.likely_abandoned)" :hint="`${formatHectare(summary.summary.likelyAbandonedAreaM2)} · zayıf işletme ${summary.summary.byAbandonment.weak} · aktif ${summary.summary.byAbandonment.active}`" :icon="TriangleAlert" />
                </div>
                <div class="grid gap-4 lg:grid-cols-2">
                    <Card>
                        <CardHeader><CardTitle>Tesis dönemi (Landsat)</CardTitle><CardDescription>Kapalı örtünün başladığı on yıl; "1986 öncesi" kayıt başında zaten kapalı olan bahçelerdir.</CardDescription></CardHeader>
                        <CardContent class="flex flex-col gap-2">
                            <div v-for="[k, n] in decades" :key="k" class="flex items-center gap-3 text-sm">
                                <span class="w-32">{{ k }}</span>
                                <div class="h-3 flex-1 overflow-hidden rounded bg-muted"><div class="h-full" :style="{ width: `${(n / Math.max(1, teaParcels)) * 100}%`, background: k === '1986 öncesi' ? '#7f1d1d' : k === 'belirsiz' ? '#94a3b8' : '#2E7D4F' }" /></div>
                                <span class="w-10 text-right tabular-nums">{{ n }}</span>
                            </div>
                            <p class="text-xs text-muted-foreground">Ortanca tesis yılı (kayıt içinde tarihlenenler): {{ summary.summary.medianEstablishmentYear ?? '—' }}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Yaş sınıfları ve öncelik</CardTitle><CardDescription>Öncelik: yaş, son gençleştirme, canlılık eğilimi ve aktif hasat; terk edilmiş olabilecekler kapsam dışında ayrı listelenir.</CardDescription></CardHeader>
                        <CardContent class="flex flex-col gap-3">
                            <div class="flex flex-col gap-1.5">
                                <div v-for="k in AGE_ORDER" :key="k" class="flex items-center gap-3 text-sm">
                                    <span class="w-48 truncate">{{ AGE_META[k].label }}</span>
                                    <div class="h-3 flex-1 overflow-hidden rounded bg-muted"><div class="h-full" :style="{ width: `${(summary.summary.byAgeClass[k] / Math.max(1, summary.summary.parcels)) * 100}%`, background: AGE_META[k].color }" /></div>
                                    <span class="w-10 text-right tabular-nums">{{ summary.summary.byAgeClass[k] }}</span>
                                </div>
                            </div>
                            <div class="flex flex-wrap gap-1.5">
                                <Badge v-for="k in PRIORITY_ORDER" :key="k" :variant="PRIORITY_META[k].tone">{{ PRIORITY_META[k].label }} {{ summary.summary.byPriority[k] }}</Badge>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Gençleştirme izleri yıllara göre</CardTitle><CardDescription>≥ 0,08 NDVI düşüşü ve dört yazda toparlanma gösteren parsel sayısı; ÇAYKUR budama programı dönemleriyle karşılaştırılabilir. Parsel başına yılda yedide bir budama bu eşiğin altında kalır, tüm parselin gençleştirilmesi görünür.</CardDescription></CardHeader>
                        <CardContent>
                            <div class="flex h-32 items-end gap-0.5">
                                <div v-for="r in renewalYears" :key="r.year" class="flex flex-1 flex-col items-center gap-1" :title="`${r.year}: ${r.n} parsel`">
                                    <div class="w-full rounded-t bg-[#2E7D4F]" :style="{ height: `${(r.n / maxRenewal) * 100}px` }" />
                                    <span v-if="r.year % 5 === 0" class="text-[10px] text-muted-foreground">{{ r.year }}</span>
                                </div>
                            </div>
                            <p v-if="renewalYears.length === 0" class="text-sm text-muted-foreground">Kayıtta gençleştirme izi bulunamadı.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Hasat etkinliği (Sentinel-2, son 6 yıl)</CardTitle><CardDescription>Nisan–Ekim aylık NDVI'de sezon içi düşüş sayısı: hasat edilen bahçe yılda 1–3 düşüş gösterir, terk edilen düz kalır.</CardDescription></CardHeader>
                        <CardContent class="flex flex-col gap-3">
                            <div class="flex flex-col gap-1.5">
                                <div v-for="k in ACTIVITY_ORDER" :key="k" class="flex items-center gap-3 text-sm">
                                    <span class="w-40">{{ ACTIVITY_META[k].label }}</span>
                                    <div class="h-3 flex-1 overflow-hidden rounded bg-muted"><div class="h-full" :style="{ width: `${(summary.summary.byActivity[k] / Math.max(1, summary.summary.parcels)) * 100}%`, background: ACTIVITY_META[k].color }" /></div>
                                    <span class="w-10 text-right tabular-nums">{{ summary.summary.byActivity[k] }}</span>
                                </div>
                            </div>
                            <div class="flex flex-wrap gap-1.5">
                                <Badge v-for="k in ABANDON_ORDER" :key="k" :variant="ABANDON_META[k].tone">{{ ABANDON_META[k].label }} {{ summary.summary.byAbandonment[k] }}</Badge>
                            </div>
                            <p class="text-xs text-muted-foreground">Kaynaklar: <a v-for="s in summary.sources" :key="s.id" :href="s.url" target="_blank" rel="noopener" class="mr-2 underline">{{ s.org }} {{ s.year }}</a></p>
                        </CardContent>
                    </Card>
                </div>
            </template>

            <Card v-else-if="view === 'parcels'">
                <CardHeader>
                    <CardTitle>Parsel değerlendirmeleri</CardTitle>
                    <CardDescription>{{ total }} parsel · satıra tıklayınca 1984'ten bugüne NDVI kaydı, tesis yılı, gençleştirmeler ve hasat etkinliği açılır.</CardDescription>
                </CardHeader>
                <CardContent class="flex flex-col gap-3 px-0">
                    <div class="flex flex-wrap items-center gap-2 px-6">
                        <SearchInput v-model="search" placeholder="Ada/parsel, nitelik, mevkii…" class="w-full sm:w-64" />
                        <Select :model-value="fAge" @update:model-value="(v) => (fAge = pick<GardenAgeClass>(v))"><SelectTrigger class="h-11 w-48 md:h-9" aria-label="Yaş sınıfı"><SelectValue placeholder="Yaş" /></SelectTrigger><SelectContent><SelectItem :value="ALL">Tüm yaş sınıfları</SelectItem><SelectItem v-for="k in AGE_ORDER" :key="k" :value="k">{{ AGE_META[k].label }} ({{ summary.summary.byAgeClass[k] }})</SelectItem></SelectContent></Select>
                        <Select :model-value="fActivity" @update:model-value="(v) => (fActivity = pick<GardenActivityClass>(v))"><SelectTrigger class="h-11 w-44 md:h-9" aria-label="Etkinlik"><SelectValue placeholder="Etkinlik" /></SelectTrigger><SelectContent><SelectItem :value="ALL">Tüm etkinlikler</SelectItem><SelectItem v-for="k in ACTIVITY_ORDER" :key="k" :value="k">{{ ACTIVITY_META[k].label }} ({{ summary.summary.byActivity[k] }})</SelectItem></SelectContent></Select>
                        <Select :model-value="fAbandon" @update:model-value="(v) => (fAbandon = pick<GardenAbandonClass>(v))"><SelectTrigger class="h-11 w-48 md:h-9" aria-label="Terk"><SelectValue placeholder="Terk" /></SelectTrigger><SelectContent><SelectItem :value="ALL">Terk: hepsi</SelectItem><SelectItem v-for="k in ABANDON_ORDER" :key="k" :value="k">{{ ABANDON_META[k].label }} ({{ summary.summary.byAbandonment[k] }})</SelectItem></SelectContent></Select>
                        <Select :model-value="fPriority" @update:model-value="(v) => (fPriority = pick<GardenPriorityClass>(v))"><SelectTrigger class="h-11 w-44 md:h-9" aria-label="Öncelik"><SelectValue placeholder="Öncelik" /></SelectTrigger><SelectContent><SelectItem :value="ALL">Tüm öncelikler</SelectItem><SelectItem v-for="k in PRIORITY_ORDER" :key="k" :value="k">{{ PRIORITY_META[k].label }} ({{ summary.summary.byPriority[k] }})</SelectItem></SelectContent></Select>
                        <Select :model-value="sort" @update:model-value="(v) => { if (v === 'priority' || v === 'age' || v === 'abandonment' || v === 'parcel') sort = v; }"><SelectTrigger class="h-11 w-44 md:h-9" aria-label="Sırala"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="priority">Önceliğe göre</SelectItem><SelectItem value="age">Yaşa göre</SelectItem><SelectItem value="abandonment">Terk puanına göre</SelectItem><SelectItem value="parcel">Ada/parsel sırası</SelectItem></SelectContent></Select>
                    </div>
                    <LoadingState v-if="isLoadingRows && rows.length === 0" text="Parseller yükleniyor…" />
                    <Table v-else>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Parsel · tapu niteliği</TableHead>
                                <TableHead class="text-right">Alan</TableHead>
                                <TableHead>Tesis · yaş</TableHead>
                                <TableHead>Gençleştirme</TableHead>
                                <TableHead class="text-right">Canlılık</TableHead>
                                <TableHead>Hasat etkinliği</TableHead>
                                <TableHead>Yenileme önceliği</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow v-for="r in rows" :key="r.id" class="cursor-pointer" @click="openParcel(r.id)">
                                <TableCell>
                                    <div class="font-medium">{{ r.block }}/{{ r.parcel }}</div>
                                    <div class="text-xs text-muted-foreground">{{ r.nature }}<template v-if="r.locality"> · {{ r.locality }}</template> · çay payı {{ pct(r.teaShare) }}</div>
                                    <Badge v-if="r.abandonment === 'likely_abandoned' || r.abandonment === 'weak'" :variant="ABANDON_META[r.abandonment].tone" class="mt-1 text-[10px]">{{ ABANDON_META[r.abandonment].label }}</Badge>
                                </TableCell>
                                <TableCell class="text-right tabular-nums">{{ formatM2(r.areaM2) }}</TableCell>
                                <TableCell><Badge :variant="AGE_META[r.ageClass].tone">{{ r.preRecord ? '1986 öncesi' : r.establishmentYear ?? '—' }}</Badge><div class="text-xs text-muted-foreground">{{ r.ageYears === null ? AGE_META[r.ageClass].label : `${r.ageYears} yıl${r.preRecord ? '+' : ''}` }} · güven {{ r.confidence === 'high' ? 'yüksek' : r.confidence === 'medium' ? 'orta' : 'düşük' }}</div></TableCell>
                                <TableCell>{{ r.renewals }} iz<div class="text-xs text-muted-foreground">{{ r.lastRenewalYear ? `son ${r.lastRenewalYear}` : 'kayıtta yok' }}</div></TableCell>
                                <TableCell class="text-right tabular-nums">{{ signed(r.trendPerDecade) }} / 10 yıl<div class="text-xs text-muted-foreground">zirveye göre {{ r.declinePct === null ? '—' : `−${r.declinePct} %` }}</div></TableCell>
                                <TableCell><Badge :variant="ACTIVITY_META[r.activity].tone">{{ ACTIVITY_META[r.activity].label }}</Badge><div class="text-xs text-muted-foreground">{{ num(r.dipsPerYear, 1) }} düşüş / yıl</div></TableCell>
                                <TableCell><Badge :variant="PRIORITY_META[r.priority].tone">{{ PRIORITY_META[r.priority].label }} {{ r.priorityScore }}</Badge><div class="text-xs text-muted-foreground">{{ r.priorityReasons.slice(0, 2).join(' · ') }}</div></TableCell>
                            </TableRow>
                            <TableRow v-if="rows.length === 0"><TableCell colspan="7" class="py-10 text-center text-muted-foreground">Filtreye uyan parsel yok.</TableCell></TableRow>
                        </TableBody>
                    </Table>
                    <div v-if="totalPages > 1" class="flex items-center justify-end gap-2 px-6 text-sm">
                        <span class="text-muted-foreground">{{ page }} / {{ totalPages }}</span>
                        <Button variant="outline" size="icon" class="size-9" :disabled="page <= 1" aria-label="Önceki" @click="page--"><ChevronLeft /></Button>
                        <Button variant="outline" size="icon" class="size-9" :disabled="page >= totalPages" aria-label="Sonraki" @click="page++"><ChevronRight /></Button>
                    </div>
                </CardContent>
            </Card>

            <Card v-else-if="view === 'map'">
                <CardHeader><CardTitle>Bahçe yaşı haritası</CardTitle><CardDescription>Parseller seçilen ölçüte göre renkli; tıklayınca kayıt açılır.</CardDescription></CardHeader>
                <CardContent class="flex flex-col gap-3">
                    <ToggleGroup :model-value="mapBy" type="single" aria-label="Harita ölçütü" class="w-max" @update:model-value="(v) => { if (v === 'priority' || v === 'ageClass' || v === 'activity' || v === 'abandonment') mapBy = v; }">
                        <ToggleGroupItem value="priority" class="h-9 px-3">Yenileme önceliği</ToggleGroupItem>
                        <ToggleGroupItem value="ageClass" class="h-9 px-3">Yaş sınıfı</ToggleGroupItem>
                        <ToggleGroupItem value="activity" class="h-9 px-3">Hasat etkinliği</ToggleGroupItem>
                        <ToggleGroupItem value="abandonment" class="h-9 px-3">Terk</ToggleGroupItem>
                    </ToggleGroup>
                    <div ref="mapContainer" class="h-[420px] w-full overflow-hidden rounded-md border bg-muted md:h-[520px]" role="application" aria-label="Bahçe yaşı haritası" />
                    <div class="flex flex-wrap gap-3 text-xs text-muted-foreground"><span v-for="l in legend" :key="l.label" class="flex items-center gap-1"><span class="inline-block size-2.5 rounded-sm" :style="{ background: l.color }" />{{ l.label }}</span></div>
                </CardContent>
            </Card>
        </template>

        <Sheet v-model:open="sheetOpen">
            <SheetContent side="right" class="w-full gap-0 overflow-y-auto sm:max-w-3xl">
                <LoadingState v-if="isLoadingDetail || !detail" text="Parsel yükleniyor…" class="p-6" />
                <template v-else>
                    <SheetHeader class="border-b">
                        <SheetTitle>{{ detail.block }}/{{ detail.parcel }} · {{ detail.nature }}</SheetTitle>
                        <SheetDescription>{{ formatM2(detail.areaM2) }}<template v-if="detail.locality"> · {{ detail.locality }}</template> · {{ AGE_META[detail.ageClass].label }}<template v-if="detail.ageYears !== null"> · ≈ {{ detail.ageYears }} yıl{{ detail.preRecord ? '+' : '' }}</template></SheetDescription>
                    </SheetHeader>
                    <div class="flex flex-col gap-5 p-6">
                        <div class="flex flex-wrap gap-2">
                            <Badge :variant="PRIORITY_META[detail.priority].tone">{{ PRIORITY_META[detail.priority].label }} · {{ detail.priorityScore }}/100</Badge>
                            <Badge :variant="ABANDON_META[detail.abandonment].tone">{{ ABANDON_META[detail.abandonment].label }} · {{ detail.abandonmentScore }}/100</Badge>
                            <Badge :variant="ACTIVITY_META[detail.activity].tone">{{ ACTIVITY_META[detail.activity].label }}</Badge>
                        </div>
                        <section>
                            <h3 class="mb-2 text-sm font-semibold">Landsat yaz NDVI kaydı {{ chartYears[0] }}–{{ chartYears.at(-1) }}</h3>
                            <svg :viewBox="`0 0 ${CH.w} ${CH.h}`" class="w-full" role="img" :aria-label="`Yıllık NDVI serisi, tesis ${detail.establishmentYear ?? (detail.preRecord ? '1986 öncesi' : 'belirsiz')}`">
                                <line v-for="v in [0.25, 0.5, 0.75]" :key="v" :x1="CH.l" :x2="CH.w - CH.r" :y1="yOf(v)" :y2="yOf(v)" stroke="currentColor" stroke-opacity="0.12" />
                                <line :x1="CH.l" :x2="CH.w - CH.r" :y1="yOf(0.55)" :y2="yOf(0.55)" stroke="#15803d" stroke-dasharray="4 4" stroke-opacity="0.6" />
                                <line :x1="CH.l" :x2="CH.w - CH.r" :y1="yOf(0.4)" :y2="yOf(0.4)" stroke="#dc2626" stroke-dasharray="4 4" stroke-opacity="0.5" />
                                <text v-for="v in [0.25, 0.5, 0.75]" :key="`t${v}`" :x="CH.l - 6" :y="yOf(v) + 4" text-anchor="end" font-size="10" fill="currentColor" fill-opacity="0.6">{{ v.toFixed(2) }}</text>
                                <text v-for="y in chartTicks" :key="y" :x="xOf(chartYears, y)" :y="CH.h - 8" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.6">{{ y }}</text>
                                <path :d="rawPath" fill="none" stroke="currentColor" stroke-opacity="0.3" stroke-width="1" />
                                <path :d="smoothPath" fill="none" stroke="#2E7D4F" stroke-width="2.5" />
                                <g v-if="detail.establishmentYear !== null"><line :x1="xOf(chartYears, detail.establishmentYear)" :x2="xOf(chartYears, detail.establishmentYear)" :y1="CH.t" :y2="CH.h - CH.b" stroke="#1d4ed8" stroke-width="2" /><text :x="xOf(chartYears, detail.establishmentYear) + 4" :y="CH.t + 10" font-size="10" fill="#1d4ed8">tesis {{ detail.establishmentYear }}</text></g>
                                <g v-for="r in detail.age.renewals" :key="r.year"><line :x1="xOf(chartYears, r.year)" :x2="xOf(chartYears, r.year)" :y1="CH.t" :y2="CH.h - CH.b" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="3 3" /><text :x="xOf(chartYears, r.year) + 3" :y="CH.h - CH.b - 4" font-size="10" fill="#b45309">{{ r.year }}</text></g>
                            </svg>
                            <p class="mt-1 text-xs text-muted-foreground">Yeşil: 3 yıllık ortanca; gri: ham yıllık değer; yeşil kesik 0,55 kapalı örtü eşiği, kırmızı kesik 0,40 düşük faz eşiği; mavi çizgi tesis yılı, turuncu çizgiler gençleştirme izleri. {{ detail.age.establishment.note }}</p>
                        </section>
                        <section>
                            <h3 class="mb-2 text-sm font-semibold">Canlılık ve gençleştirme</h3>
                            <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                                <div><dt class="text-xs text-muted-foreground">Son 12 yıl eğilimi</dt><dd>{{ signed(detail.age.vigour.trendPerDecade) }} NDVI / 10 yıl</dd></div>
                                <div><dt class="text-xs text-muted-foreground">Son 5 yıl ortalaması</dt><dd>{{ num(detail.age.vigour.recentMean, 2) }}</dd></div>
                                <div><dt class="text-xs text-muted-foreground">Zirve dönemi</dt><dd>{{ num(detail.age.vigour.peakMean, 2) }} ({{ detail.age.vigour.peakYears ?? '—' }})</dd></div>
                                <div><dt class="text-xs text-muted-foreground">Zirveye göre düşüş</dt><dd>{{ detail.age.vigour.declinePct === null ? '—' : `${detail.age.vigour.declinePct} %` }}</dd></div>
                            </dl>
                            <p v-if="detail.age.renewals.length" class="mt-2 text-xs text-muted-foreground">Gençleştirme izleri: {{ detail.age.renewals.map((r) => `${r.year} (−${r.drop.toFixed(2)}, ${r.recoveredIn} yılda toparlandı)`).join(' · ') }}</p>
                            <p v-else class="mt-2 text-xs text-muted-foreground">Kayıtta ≥ 0,08 NDVI düşüşü ve toparlanma gösteren bir gençleştirme izi yok.</p>
                        </section>
                        <section>
                            <h3 class="mb-2 text-sm font-semibold">Hasat etkinliği (Sentinel-2 aylık NDVI, Nis–Eki)</h3>
                            <div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
                                <div v-for="y in s2Recent" :key="y" class="rounded border p-1.5">
                                    <div class="flex items-center justify-between text-xs"><span class="font-medium">{{ y }}</span><span class="text-muted-foreground">{{ detail.age.s2.dips[y] ?? 0 }} düşüş</span></div>
                                    <svg viewBox="0 0 120 50" class="mt-1 w-full" role="img" :aria-label="`${y} aylık NDVI`">
                                        <path :d="s2Path(detail.age.s2.months, detail.age.s2.ndvi[y] ?? [], 120, 50)" fill="none" stroke="#2E7D4F" stroke-width="2" />
                                    </svg>
                                    <div class="text-[10px] text-muted-foreground">{{ detail.age.s2.months.map((m) => MONTHS_TR[m - 1]!.slice(0, 1)).join(' ') }} · genlik {{ num(detail.age.s2.amplitude[y] ?? null, 2) }}</div>
                                </div>
                            </div>
                            <p class="mt-2 text-xs text-muted-foreground">Son 6 yılda ortalama {{ num(detail.age.activity.dipsPerYear, 1) }} düşüş / yıl, genlik {{ num(detail.age.activity.amplitude, 2) }}. Hasat edilen çaylıkta Mayıs, Temmuz ve Eylül sürgün hasatları düşüş olarak görünür.</p>
                        </section>
                        <section class="grid gap-4 sm:grid-cols-2">
                            <div>
                                <h3 class="mb-2 text-sm font-semibold">Yenileme önceliği gerekçeleri</h3>
                                <ul v-if="detail.age.priority.reasons.length" class="list-disc pl-5 text-sm text-muted-foreground"><li v-for="r in detail.age.priority.reasons" :key="r">{{ r }}</li></ul>
                                <p v-else class="text-sm text-muted-foreground">Kapsam dışı ya da öncelik gerektiren bulgu yok.</p>
                            </div>
                            <div>
                                <h3 class="mb-2 text-sm font-semibold">Terk belirtileri</h3>
                                <ul v-if="detail.age.abandonment.reasons.length" class="list-disc pl-5 text-sm text-muted-foreground"><li v-for="r in detail.age.abandonment.reasons" :key="r">{{ r }}</li></ul>
                                <p v-else class="text-sm text-muted-foreground">Terk belirtisi yok.</p>
                            </div>
                        </section>
                    </div>
                </template>
            </SheetContent>
        </Sheet>
    </div>
</template>
