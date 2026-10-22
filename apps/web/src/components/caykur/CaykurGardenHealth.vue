<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Activity, ChevronLeft, ChevronRight, Download, FlaskConical, Leaf, Plus, Sprout, Trash2, Wheat } from '@lucide/vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EmptyState, ListToolbar, LoadingState, SearchInput, StatCard } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toneVariant, type Tone } from '@/components/caykur/tone';
import { useToast } from '@/composables/useToast';
import { useAuthStore } from '@/stores/authStore';
import {
    api,
    saveBlob,
    type FertilisationResponseClass,
    type FertilisationView,
    type FertiliserType,
    type HealthAnomalyClass,
    type HealthGardenDetail,
    type HealthGardenRow,
    type HealthProducerView,
    type HealthSummary,
    type YieldFlag,
} from '@/services/api';
import { formatM2 } from '@/services/caykur/teaInventory';
import { formatNumber } from '@/services/caykur';

/**
 * Garden-health module (P3, separate from pruning): growing-season anomalies that are not
 * pruning (herbicide / chemical suspicion = optical loss the radar does not see; defoliation =
 * both sensors; stress = mild), vigour against the neighbourhood, yield estimates against the
 * licence quota, and the satellite response to fertilisation records. Uncalibrated: pointers
 * for leaf sampling and purchase checks, not verdicts.
 */
const props = defineProps<{ areaId: string }>();

const ALL = 'all';
const PAGE_SIZE = 15;
const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const ANOMALY_META: Record<HealthAnomalyClass, { label: string; description: string; tone: Tone; color: string }> = {
    chemical_suspect: { label: 'Kimyasal şüphesi', description: 'Optik ani kayıp, radar yapısal değişim görmedi: herbisit yanığı / kimyasal hasar; yaprak numunesi önerilir.', tone: 'danger', color: '#b91c1c' },
    defoliation: { label: 'Yaprak kaybı', description: 'Optik ve radar birlikte kayıp gördü, budama penceresi dışında: zararlı, dolu ya da izinsiz kesim.', tone: 'warning', color: '#b45309' },
    stress: { label: 'Stres', description: 'Komşulara göre hafif canlılık kaybı: kuraklık / besin stresi olabilir.', tone: 'info', color: '#1d4ed8' },
    none: { label: 'Normal', description: 'Büyüme sezonunda komşulardan ayrışan ani kayıp yok.', tone: 'success', color: '#15803d' },
    no_data: { label: 'Veri yok', description: 'Yeterli bulutsuz gözlem yok.', tone: 'muted', color: '#94a3b8' },
};
const ANOMALY_ORDER: HealthAnomalyClass[] = ['chemical_suspect', 'defoliation', 'stress', 'none', 'no_data'];
const FLAG_META: Record<YieldFlag, { label: string; description: string; tone: Tone }> = {
    ok: { label: 'Kotayla uyumlu', description: 'Rekolte tahmini ruhsat kotasının makul aralığında.', tone: 'success' },
    low: { label: 'Tahmin düşük', description: 'Tahmin kotanın yarısından az: bahçeler zayıf ya da yeni budanmış; teslimat kotaya yaklaşırsa dışarıdan yaprak şüphesi.', tone: 'warning' },
    high: { label: 'Tahmin yüksek', description: 'Tahmin kotanın %140 üstü: çay alanı ruhsat alanından büyük görünüyor.', tone: 'danger' },
    no_license: { label: 'Ruhsat yok', description: 'Ruhsat alanı olmadığı için kota yok; tahmini yaprak ruhsatsız.', tone: 'danger' },
    no_data: { label: 'Veri yok', description: 'Büyüme sezonunda gözlem yok.', tone: 'muted' },
};
const FLAG_ORDER: YieldFlag[] = ['low', 'high', 'no_license', 'ok', 'no_data'];
const RESPONSE_META: Record<FertilisationResponseClass, { label: string; tone: Tone }> = {
    strong: { label: 'Belirgin tepki', tone: 'success' },
    weak: { label: 'Hafif tepki', tone: 'info' },
    none: { label: 'Tepki yok', tone: 'muted' },
    negative: { label: 'Geriledi', tone: 'danger' },
    pending: { label: 'Bekliyor', tone: 'warning' },
    no_data: { label: 'Veri yok', tone: 'muted' },
};
const FERT_TYPE_LABEL: Record<FertiliserType, string> = { nitrogen: 'Azotlu (üre, amonyum sülfat…)', compound: 'Kompoze (NPK)', organic: 'Organik / çiftlik gübresi', foliar: 'Yaprak gübresi', other: 'Diğer girdi' };

const toast = useToast();
const auth = useAuthStore();
const canWrite = computed(() => auth.isAdmin || ['kurum_admin', 'fabrika_sorumlusu', 'saha_personeli'].includes(auth.caykurRole ?? ''));
const summary = ref<HealthSummary | null>(null);
const season = ref('');
const isLoading = ref(true);
const error = ref<string | null>(null);
const view = ref<'gardens' | 'producers' | 'map' | 'fertilisation'>('gardens');

// gardens
const gSearch = ref('');
const gAnomaly = ref<HealthAnomalyClass | typeof ALL>(ALL);
const gLocality = ref<string | typeof ALL>(ALL);
const gPage = ref(1);
const gRows = ref<HealthGardenRow[]>([]);
const gTotal = ref(0);
const gTotalPages = ref(1);
const isLoadingGardens = ref(false);
// producers
const pSearch = ref('');
const pFlag = ref<YieldFlag | typeof ALL>(ALL);
const pPage = ref(1);
const pRows = ref<HealthProducerView[]>([]);
const pTotal = ref(0);
const pTotalPages = ref(1);
const isLoadingProducers = ref(false);
const isDownloading = ref(false);
// sheet
const sheetOpen = ref(false);
const detail = ref<HealthGardenDetail | null>(null);
const isLoadingDetail = ref(false);
// map
const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
// fertilisation
const fRows = ref<FertilisationView[]>([]);
const isLoadingFert = ref(false);
const fForm = ref<{ gardenCode: string; appliedAt: string; type: FertiliserType; product: string; amountKgPerDa: number | undefined; note: string }>({ gardenCode: '', appliedAt: new Date().toISOString().slice(0, 10), type: 'compound', product: '', amountKgPerDa: undefined, note: '' });
const isSavingFert = ref(false);

function fmtDate(d: string | null | undefined): string {
    if (!d) return '—';
    const iso = d.slice(0, 10);
    return `${Number(iso.slice(8, 10))} ${MONTHS_TR[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}
function fmtKg(v: number): string {
    return v >= 10000 ? `${(v / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} t` : `${Math.round(v).toLocaleString('tr-TR')} kg`;
}
function pct(v: number | null | undefined): string {
    return v == null ? '—' : `%${Math.round(v * 100)}`;
}
function vigourTone(v: number | null): Tone {
    if (v == null) return 'muted';
    if (v >= 0.95) return 'success';
    if (v >= 0.8) return 'info';
    if (v >= 0.65) return 'warning';
    return 'danger';
}

// ── loading ──
async function loadSummary(): Promise<void> {
    isLoading.value = true;
    error.value = null;
    const res = await api.getHealthSummary(props.areaId, season.value || undefined);
    isLoading.value = false;
    if (!res.data) {
        error.value = res.error?.message ?? 'Bahçe sağlığı sonuçları yüklenemedi';
        return;
    }
    summary.value = res.data;
    season.value = res.data.season;
}
async function loadGardens(): Promise<void> {
    isLoadingGardens.value = true;
    const res = await api.getHealthGardens(props.areaId, { season: season.value || undefined, page: gPage.value, limit: PAGE_SIZE, search: gSearch.value.trim() || undefined, anomaly: gAnomaly.value === ALL ? undefined : gAnomaly.value, locality: gLocality.value === ALL ? undefined : gLocality.value });
    isLoadingGardens.value = false;
    if (!res.data) { toast.error(res.error?.message ?? 'Bahçeler yüklenemedi'); return; }
    gRows.value = res.data.data;
    gTotal.value = res.data.meta.total;
    gTotalPages.value = Math.max(1, res.data.meta.totalPages);
}
async function loadProducers(): Promise<void> {
    isLoadingProducers.value = true;
    const res = await api.getHealthProducers(props.areaId, { season: season.value || undefined, page: pPage.value, limit: PAGE_SIZE, search: pSearch.value.trim() || undefined, flag: pFlag.value === ALL ? undefined : pFlag.value });
    isLoadingProducers.value = false;
    if (!res.data) { toast.error(res.error?.message ?? 'Müstahsiller yüklenemedi'); return; }
    pRows.value = res.data.data;
    pTotal.value = res.data.meta.total;
    pTotalPages.value = Math.max(1, res.data.meta.totalPages);
}
async function loadFert(): Promise<void> {
    isLoadingFert.value = true;
    const res = await api.getFertilisations(props.areaId, undefined, season.value || undefined);
    isLoadingFert.value = false;
    if (res.data) fRows.value = res.data;
    else toast.error(res.error?.message ?? 'Gübreleme kayıtları yüklenemedi');
}
let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch([gSearch, pSearch], () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { gPage.value = 1; pPage.value = 1; void loadGardens(); void loadProducers(); }, 300);
});
watch([gAnomaly, gLocality], () => { gPage.value = 1; void loadGardens(); });
watch(gPage, () => void loadGardens());
watch(pFlag, () => { pPage.value = 1; void loadProducers(); });
watch(pPage, () => void loadProducers());
watch(view, async (v) => {
    if (v === 'map') { await nextTick(); await renderMap(); }
    if (v === 'fertilisation') void loadFert();
});
function onSeason(v: unknown): void {
    if (typeof v === 'string' && v) { season.value = v; void Promise.all([loadSummary(), loadGardens(), loadProducers()]); }
}
function onView(v: unknown): void {
    if (v === 'gardens' || v === 'producers' || v === 'map' || v === 'fertilisation') view.value = v;
}
function onAnomaly(v: unknown): void { gAnomaly.value = typeof v === 'string' && v !== '' ? (v as HealthAnomalyClass | typeof ALL) : ALL; }
function onLocality(v: unknown): void { gLocality.value = typeof v === 'string' && v !== '' ? v : ALL; }
function onFlag(v: unknown): void { pFlag.value = typeof v === 'string' && v !== '' ? (v as YieldFlag | typeof ALL) : ALL; }

async function openGarden(code: string): Promise<void> {
    sheetOpen.value = true;
    isLoadingDetail.value = true;
    detail.value = null;
    const res = await api.getHealthGarden(props.areaId, code, season.value || undefined);
    isLoadingDetail.value = false;
    if (!res.data) { toast.error(res.error?.message ?? 'Bahçe yüklenemedi'); sheetOpen.value = false; return; }
    detail.value = res.data;
    fForm.value.gardenCode = code;
}

async function downloadCsv(): Promise<void> {
    isDownloading.value = true;
    try {
        const res = await api.downloadHealthProducersCsv(props.areaId, season.value || undefined);
        if (!res.blob) { toast.error(res.error ?? 'Liste indirilemedi'); return; }
        saveBlob(res.blob, res.filename ?? `rekolte-tahmini-${season.value}.csv`);
    } finally {
        isDownloading.value = false;
    }
}

// ── fertilisation ──
async function saveFert(): Promise<void> {
    if (!fForm.value.gardenCode.trim()) { toast.error('Bahçe kodu gerekli'); return; }
    isSavingFert.value = true;
    const res = await api.addFertilisation(props.areaId, { gardenCode: fForm.value.gardenCode.trim(), appliedAt: fForm.value.appliedAt, type: fForm.value.type, product: fForm.value.product.trim() || undefined, amountKgPerDa: fForm.value.amountKgPerDa, note: fForm.value.note.trim() || undefined });
    isSavingFert.value = false;
    if (!res.data) { toast.error(res.error?.message ?? 'Kayıt eklenemedi'); return; }
    toast.success(`Kayıt eklendi · uydu tepkisi: ${RESPONSE_META[res.data.response.class].label}`);
    fForm.value = { ...fForm.value, product: '', amountKgPerDa: undefined, note: '' };
    await Promise.all([loadFert(), loadSummary()]);
    if (detail.value?.code === res.data.gardenCode) await openGarden(res.data.gardenCode);
}
async function removeFert(r: FertilisationView): Promise<void> {
    if (!window.confirm(`${r.gardenCode} · ${fmtDate(r.appliedAt)} kaydı silinsin mi?`)) return;
    const res = await api.deleteFertilisation(props.areaId, r.id);
    if (res.error) { toast.error(res.error); return; }
    await Promise.all([loadFert(), loadSummary()]);
    if (detail.value?.code === r.gardenCode) await openGarden(r.gardenCode);
}

// ── map ──
async function renderMap(): Promise<void> {
    if (!mapContainer.value) return;
    const res = await api.getHealthLayers(props.areaId, season.value || undefined);
    if (!res.data) { toast.error(res.error?.message ?? 'Harita katmanı yüklenemedi'); return; }
    if (map) { map.remove(); map = null; }
    map = L.map(mapContainer.value, { zoomControl: true, attributionControl: false });
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20, maxNativeZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }).addTo(map);
    const layer = L.geoJSON(res.data, {
        style: (f) => {
            const cls = (f?.properties?.anomaly ?? 'no_data') as HealthAnomalyClass;
            const vig = f?.properties?.vigour as number | null;
            const base = ANOMALY_META[cls].color;
            return { color: base, weight: cls === 'none' ? 1 : 2.5, fillColor: cls === 'none' ? (vig != null && vig < 0.75 ? '#f59e0b' : '#22c55e') : base, fillOpacity: cls === 'none' ? 0.25 : 0.5 };
        },
        onEachFeature: (f, l) => {
            const p = f.properties ?? {};
            l.bindTooltip(`${p.block}/${p.parcel} · ${p.producerName} · ${ANOMALY_META[(p.anomaly as HealthAnomalyClass) ?? 'no_data'].label}${p.date ? ` (${fmtDate(p.date)})` : ''} · canlılık ${p.vigour ?? '—'} · ${Math.round(p.yieldKg ?? 0)} kg`);
            l.on('click', () => void openGarden(String(p.code)));
        },
    }).addTo(map);
    try { map.fitBounds(layer.getBounds().pad(0.05)); } catch { /* empty layer */ }
}

// ── series chart (SVG) ──
const chart = computed(() => {
    const d = detail.value;
    if (!d || !d.series || d.dates.length === 0) return null;
    const W = 760, H = 220, padL = 40, padR = 10, padT = 10, padB = 24;
    const dayOf = (s: string) => Date.parse(`${s}T00:00:00Z`) / 86400000;
    const t0 = dayOf(d.dates[0] as string), t1 = dayOf(d.dates[d.dates.length - 1] as string);
    const X = (s: string) => padL + ((dayOf(s) - t0) / Math.max(1, t1 - t0)) * (W - padL - padR);
    const all = [...d.series.ndvi, ...d.neighbourhood.ndviMedian].filter((v): v is number => v != null);
    const lo = Math.min(0.2, ...all) - 0.05, hi = Math.max(0.9, ...all) + 0.02;
    const Y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
    const path = (vals: Array<number | null>) => { let s = ''; let pen = false; vals.forEach((v, i) => { if (v == null) { pen = false; return; } s += `${pen ? 'L' : 'M'}${X(d.dates[i] as string).toFixed(1)} ${Y(v).toFixed(1)} `; pen = true; }); return s; };
    const months: Array<{ x: number; label: string }> = [];
    for (let m = new Date(`${d.dates[0]?.slice(0, 7)}-01T00:00:00Z`); dayOf(m.toISOString().slice(0, 10)) <= t1; m.setUTCMonth(m.getUTCMonth() + 1)) {
        const iso = m.toISOString().slice(0, 10);
        if (dayOf(iso) >= t0) months.push({ x: X(iso), label: MONTHS_TR[m.getUTCMonth()] as string });
    }
    return { W, H, padL, padB, padT, X, Y, garden: path(d.series.ndvi), nbhd: path(d.neighbourhood.ndviMedian), ndre: path(d.series.ndre), months, lo, hi, anomalyX: d.anomaly.date ? X(d.anomaly.date) : null, fertX: d.fertilisationRecords.map((r) => ({ x: X(r.appliedAt), cls: r.response.class })) };
});

onMounted(async () => {
    await loadSummary();
    if (summary.value) await Promise.all([loadGardens(), loadProducers()]);
});
onBeforeUnmount(() => { map?.remove(); });
</script>

<template>
    <div class="flex flex-col gap-6">
        <LoadingState v-if="isLoading && !summary" text="Bahçe sağlığı yükleniyor…" />
        <Alert v-else-if="error" variant="destructive">
            <AlertTitle>Bahçe sağlığı yüklenemedi</AlertTitle>
            <AlertDescription class="flex flex-wrap items-center gap-3">{{ error }} <Button variant="outline" class="h-11 md:h-9" @click="loadSummary">Tekrar dene</Button></AlertDescription>
        </Alert>
        <template v-else-if="summary">
            <Alert variant="warning">
                <AlertTitle class="flex flex-wrap items-center gap-2">Ayrı modül · büyüme sezonu {{ fmtDate(summary.window[0]) }} – {{ fmtDate(summary.window[1]) }} <Badge variant="warning">Kalibre edilmedi</Badge></AlertTitle>
                <AlertDescription>
                    Sentinel-2 NDVI/NDRE ({{ summary.sensors.optical.dates.length }} tarih) ve Sentinel-1 VH ({{ summary.sensors.backscatter.map((b) => b.dates.length).reduce((a, b) => a + b, 0) }} tarih), komşuluğa göre. <b>Kimyasal şüphesi</b>: optik ani kayıp, radar yapısal değişim görmüyor — herbisit yanığı / kimyasal hasar; yaprak numunesi için işaret, karar değil. <b>Yaprak kaybı</b>: iki sensör birlikte, budama penceresi dışında. Rekolte tahmini: çay alanı × {{ (summary.rules.baseYieldKgPerDa as number) ?? 1000 }} kg/da × canlılık × önceki kış budama payı; kota = ruhsat alanı × {{ (summary.rules.quotaKgPerDa as number) ?? 1000 }} kg/da (demo norm).
                </AlertDescription>
            </Alert>

            <div class="flex flex-wrap items-center gap-3">
                <span class="text-sm text-muted-foreground">Büyüme sezonu</span>
                <Select :model-value="season" @update:model-value="onSeason">
                    <SelectTrigger class="h-11 w-32 md:h-9" aria-label="Sezon"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem v-for="s in summary.seasons" :key="s" :value="s">{{ s }}</SelectItem></SelectContent>
                </Select>
            </div>

            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Kimyasal şüphesi" :value="formatNumber(summary.gardens.byAnomaly.chemical_suspect)" :hint="`bahçe · yaprak kaybı ${summary.gardens.byAnomaly.defoliation} · stres ${summary.gardens.byAnomaly.stress}`" :icon="FlaskConical" />
                <StatCard label="Ortalama canlılık" :value="summary.gardens.meanVigour != null ? summary.gardens.meanVigour.toFixed(2) : '—'" :hint="`Haz–Eyl NDVI / mahalle ortancası · ${summary.gardens.total} bahçe`" :icon="Leaf" />
                <StatCard label="Rekolte tahmini" :value="fmtKg(summary.producers.yieldKg)" :hint="`kota ${fmtKg(summary.producers.quotaKg)} · ${formatM2(summary.gardens.teaAreaM2)} çay`" :icon="Wheat" />
                <StatCard label="Kota uyumsuz" :value="formatNumber((summary.producers.byFlag.low ?? 0) + (summary.producers.byFlag.high ?? 0) + (summary.producers.byFlag.no_license ?? 0))" :hint="`düşük ${summary.producers.byFlag.low} · yüksek ${summary.producers.byFlag.high} · ruhsatsız ${summary.producers.byFlag.no_license}`" :icon="Activity" />
            </div>

            <div class="flex flex-wrap items-center gap-3">
                <span class="text-sm text-muted-foreground">Görünüm</span>
                <ToggleGroup :model-value="view" type="single" aria-label="Bahçe sağlığı görünümü" @update:model-value="onView">
                    <ToggleGroupItem value="gardens" class="h-11 px-3 md:h-9">Anomaliler (bahçe)</ToggleGroupItem>
                    <ToggleGroupItem value="producers" class="h-11 px-3 md:h-9">Rekolte ve kota (müstahsil)</ToggleGroupItem>
                    <ToggleGroupItem value="map" class="h-11 px-3 md:h-9">Harita</ToggleGroupItem>
                    <ToggleGroupItem value="fertilisation" class="h-11 px-3 md:h-9">Gübreleme geri beslemesi</ToggleGroupItem>
                </ToggleGroup>
            </div>

            <!-- ── gardens ── -->
            <Card v-if="view === 'gardens'">
                <CardHeader>
                    <CardTitle>Bahçe anomalileri ve canlılık</CardTitle>
                    <CardDescription>{{ formatNumber(gTotal) }} bahçe · satıra tıklayınca seriler, kanıt ve gübreleme kayıtları</CardDescription>
                </CardHeader>
                <CardContent class="flex flex-col gap-4">
                    <ListToolbar>
                        <SearchInput v-model="gSearch" placeholder="Ad, müstahsil / cüzdan no, ada/parsel…" />
                        <template #filters>
                            <Select :model-value="gAnomaly" @update:model-value="onAnomaly">
                                <SelectTrigger class="h-11 w-full md:h-9 md:w-52" aria-label="Anomali"><SelectValue placeholder="Anomali" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="ALL">Tüm bahçeler</SelectItem>
                                    <SelectItem v-for="a in ANOMALY_ORDER" :key="a" :value="a">{{ ANOMALY_META[a].label }} ({{ summary.gardens.byAnomaly[a] }})</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select :model-value="gLocality" @update:model-value="onLocality">
                                <SelectTrigger class="h-11 w-full md:h-9 md:w-48" aria-label="Mevkii"><SelectValue placeholder="Mevkii" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="ALL">Tüm mevkiiler</SelectItem>
                                    <SelectItem v-for="l in summary.localities" :key="l.name" :value="l.name">{{ l.name }} ({{ l.suspects }}/{{ l.gardens }})</SelectItem>
                                </SelectContent>
                            </Select>
                        </template>
                    </ListToolbar>
                    <LoadingState v-if="isLoadingGardens && gRows.length === 0" text="Yükleniyor…" />
                    <EmptyState v-else-if="gRows.length === 0" :icon="Leaf" title="Bahçe yok" description="Bu filtrede kayıt bulunmuyor." />
                    <div v-else class="overflow-hidden rounded-lg border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Bahçe</TableHead>
                                    <TableHead>Anomali</TableHead>
                                    <TableHead class="hidden md:table-cell">Canlılık</TableHead>
                                    <TableHead class="hidden text-right lg:table-cell">Rekolte tahmini</TableHead>
                                    <TableHead class="hidden xl:table-cell">Kanıt</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="r in gRows" :key="r.id" class="cursor-pointer" tabindex="0" role="button" :aria-label="`${r.block}/${r.parcel} bahçesini aç`" @click="openGarden(r.code)" @keydown.enter.prevent="openGarden(r.code)">
                                    <TableCell>
                                        <div class="font-medium text-foreground">{{ r.block }}/{{ r.parcel }}</div>
                                        <div class="text-xs text-muted-foreground">{{ r.locality }} · {{ r.producerName || r.producerCode }} · {{ formatM2(r.teaAreaM2) }}<span v-if="r.fertilisations"> · {{ r.fertilisations }} gübre kaydı</span></div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge :variant="toneVariant(ANOMALY_META[r.anomaly.class].tone)" :title="ANOMALY_META[r.anomaly.class].description">{{ ANOMALY_META[r.anomaly.class].label }}</Badge>
                                        <div v-if="r.anomaly.date && r.anomaly.class !== 'none'" class="text-xs text-muted-foreground">{{ fmtDate(r.anomaly.date) }} · NDVI −{{ r.anomaly.dropNdvi }} · z {{ r.anomaly.z }}</div>
                                    </TableCell>
                                    <TableCell class="hidden md:table-cell">
                                        <Badge :variant="toneVariant(vigourTone(r.vigour))">{{ r.vigour != null ? r.vigour.toFixed(2) : '—' }}</Badge>
                                        <div class="text-xs text-muted-foreground">NDVI {{ r.ndviMean ?? '—' }} / mahalle {{ r.nbhdNdviMean ?? '—' }}<span v-if="r.prunedShare > 0"> · kışın %{{ Math.round(r.prunedShare * 100) }} budandı</span></div>
                                    </TableCell>
                                    <TableCell class="hidden text-right tabular-nums lg:table-cell">{{ fmtKg(r.yieldKg) }}</TableCell>
                                    <TableCell class="hidden max-w-md text-xs text-muted-foreground xl:table-cell">{{ r.anomaly.reason }}</TableCell>
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

            <!-- ── producers ── -->
            <Card v-if="view === 'producers'">
                <CardHeader>
                    <CardTitle>Rekolte tahmini ve ruhsat kotası</CardTitle>
                    <CardDescription>{{ formatNumber(pTotal) }} müstahsil · tahmin kotadan belirgin sapıyorsa alım noktasında teslimat kontrolü</CardDescription>
                    <CardAction><Button variant="outline" size="sm" class="h-11 md:h-9" :disabled="isDownloading" @click="downloadCsv"><Download aria-hidden="true" />CSV</Button></CardAction>
                </CardHeader>
                <CardContent class="flex flex-col gap-4">
                    <ListToolbar>
                        <SearchInput v-model="pSearch" placeholder="Ad, müstahsil / cüzdan / ruhsat no…" />
                        <template #filters>
                            <Select :model-value="pFlag" @update:model-value="onFlag">
                                <SelectTrigger class="h-11 w-full md:h-9 md:w-52" aria-label="Bayrak"><SelectValue placeholder="Bayrak" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="ALL">Tüm müstahsiller</SelectItem>
                                    <SelectItem v-for="f in FLAG_ORDER" :key="f" :value="f">{{ FLAG_META[f].label }} ({{ summary.producers.byFlag[f] }})</SelectItem>
                                </SelectContent>
                            </Select>
                        </template>
                    </ListToolbar>
                    <LoadingState v-if="isLoadingProducers && pRows.length === 0" text="Yükleniyor…" />
                    <EmptyState v-else-if="pRows.length === 0" :icon="Wheat" title="Müstahsil yok" description="Bu filtrede kayıt bulunmuyor." />
                    <div v-else class="overflow-hidden rounded-lg border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Müstahsil</TableHead>
                                    <TableHead class="text-right">Tahmin</TableHead>
                                    <TableHead class="hidden text-right md:table-cell">Kota</TableHead>
                                    <TableHead>Oran</TableHead>
                                    <TableHead class="hidden lg:table-cell">Not</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="r in pRows" :key="r.code">
                                    <TableCell>
                                        <div class="font-medium text-foreground">{{ r.name }}</div>
                                        <div class="text-xs text-muted-foreground">{{ r.code }} · {{ r.licenseNo || 'ruhsat yok' }} · {{ r.gardens }} bahçe · çay {{ formatM2(r.teaAreaM2) }}<span v-if="r.meanVigour != null"> · canlılık {{ r.meanVigour.toFixed(2) }}</span></div>
                                        <div v-if="(r.anomalies.chemical_suspect ?? 0) + (r.anomalies.defoliation ?? 0) > 0" class="mt-1 flex flex-wrap gap-1">
                                            <Badge v-if="r.anomalies.chemical_suspect" variant="danger" class="text-[10px]">kimyasal şüphesi {{ r.anomalies.chemical_suspect }}</Badge>
                                            <Badge v-if="r.anomalies.defoliation" variant="warning" class="text-[10px]">yaprak kaybı {{ r.anomalies.defoliation }}</Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell class="text-right font-semibold tabular-nums text-foreground">{{ fmtKg(r.yieldKg) }}</TableCell>
                                    <TableCell class="hidden text-right tabular-nums md:table-cell">{{ r.quotaKg ? fmtKg(r.quotaKg) : '—' }}</TableCell>
                                    <TableCell>
                                        <Badge :variant="toneVariant(FLAG_META[r.flag].tone)" :title="FLAG_META[r.flag].description">{{ r.ratio != null ? pct(r.ratio) : FLAG_META[r.flag].label }}</Badge>
                                        <div v-if="r.ratio != null" class="text-xs text-muted-foreground">{{ FLAG_META[r.flag].label }}</div>
                                    </TableCell>
                                    <TableCell class="hidden max-w-md text-xs text-muted-foreground lg:table-cell">{{ r.reason }}</TableCell>
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

            <!-- ── map ── -->
            <Card v-if="view === 'map'">
                <CardHeader>
                    <CardTitle>Nerede sorun var</CardTitle>
                    <CardDescription>Kırmızı kimyasal şüphesi, turuncu yaprak kaybı, mavi stres; normal bahçeler yeşil (canlılık düşükse sarı). Bahçeye tıklayınca seriler açılır.</CardDescription>
                </CardHeader>
                <CardContent><div ref="mapContainer" class="h-[60vh] min-h-80 w-full overflow-hidden rounded-lg border" /></CardContent>
            </Card>

            <!-- ── fertilisation ── -->
            <template v-if="view === 'fertilisation'">
                <Card v-if="canWrite">
                    <CardHeader>
                        <CardTitle>Gübreleme / girdi kaydı ekle</CardTitle>
                        <CardDescription>Uygulamadan 10–35 gün sonra bahçenin NDRE/NDVI'si komşulara göre izlenir: tepki var mı, geriledi mi (yanık, aşırı doz, yanlış kayıt).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div class="grid gap-4 md:grid-cols-3">
                            <div class="space-y-2"><Label for="f-garden">Bahçe kodu</Label><Input id="f-garden" v-model="fForm.gardenCode" class="h-11 md:h-9" placeholder="DEMO-B-0089" /></div>
                            <div class="space-y-2"><Label for="f-date">Uygulama tarihi</Label><Input id="f-date" v-model="fForm.appliedAt" type="date" class="h-11 md:h-9" /></div>
                            <div class="space-y-2">
                                <Label>Tür</Label>
                                <Select :model-value="fForm.type" @update:model-value="(v) => { if (typeof v === 'string') fForm.type = v as FertiliserType; }">
                                    <SelectTrigger class="h-11 w-full md:h-9"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem v-for="(l, k) in FERT_TYPE_LABEL" :key="k" :value="k">{{ l }}</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div class="space-y-2"><Label for="f-product">Ürün</Label><Input id="f-product" v-model="fForm.product" class="h-11 md:h-9" placeholder="25.5.10 kompoze" /></div>
                            <div class="space-y-2"><Label for="f-amount">Miktar (kg/da)</Label><Input id="f-amount" v-model.number="fForm.amountKgPerDa" type="number" min="0" class="h-11 md:h-9" /></div>
                            <div class="space-y-2 md:col-span-3"><Label for="f-note">Not</Label><Textarea id="f-note" v-model="fForm.note" rows="2" /></div>
                        </div>
                        <div class="mt-4 flex justify-end"><Button class="h-11 md:h-9" :disabled="isSavingFert" @click="saveFert"><Plus aria-hidden="true" />{{ isSavingFert ? 'Kaydediliyor…' : 'Kaydet' }}</Button></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Kayıtlar ve uydu tepkisi</CardTitle>
                        <CardDescription>{{ summary.fertilisation.records }} kayıt · belirgin {{ summary.fertilisation.byResponse.strong }} · hafif {{ summary.fertilisation.byResponse.weak }} · tepki yok {{ summary.fertilisation.byResponse.none }} · geriledi {{ summary.fertilisation.byResponse.negative }} · bekliyor {{ summary.fertilisation.byResponse.pending }}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <LoadingState v-if="isLoadingFert && fRows.length === 0" text="Yükleniyor…" />
                        <EmptyState v-else-if="fRows.length === 0" :icon="Sprout" title="Kayıt yok" description="Müstahsil ya da saha personeli gübreleme kaydı girince uydu tepkisi burada görünür." />
                        <div v-else class="overflow-hidden rounded-lg border bg-card">
                            <Table>
                                <TableHeader><TableRow><TableHead>Bahçe</TableHead><TableHead>Uygulama</TableHead><TableHead>Uydu tepkisi</TableHead><TableHead class="hidden lg:table-cell">Açıklama</TableHead><TableHead v-if="canWrite" class="w-12"><span class="sr-only">Sil</span></TableHead></TableRow></TableHeader>
                                <TableBody>
                                    <TableRow v-for="r in fRows" :key="r.id">
                                        <TableCell><button type="button" class="font-medium text-foreground underline-offset-2 hover:underline" @click="openGarden(r.gardenCode)">{{ r.gardenCode }}</button><div class="text-xs text-muted-foreground">{{ r.producerCode }} · {{ r.createdByName }}</div></TableCell>
                                        <TableCell>{{ fmtDate(r.appliedAt) }} · {{ FERT_TYPE_LABEL[r.type] }}<div class="text-xs text-muted-foreground">{{ r.product }}<span v-if="r.amountKgPerDa != null"> · {{ r.amountKgPerDa }} kg/da</span></div></TableCell>
                                        <TableCell><Badge :variant="toneVariant(RESPONSE_META[r.response.class].tone)">{{ RESPONSE_META[r.response.class].label }}</Badge><div v-if="r.response.deltaNdre != null" class="text-xs text-muted-foreground">NDRE {{ r.response.deltaNdre >= 0 ? '+' : '' }}{{ r.response.deltaNdre }} · NDVI {{ (r.response.deltaNdvi ?? 0) >= 0 ? '+' : '' }}{{ r.response.deltaNdvi }}</div></TableCell>
                                        <TableCell class="hidden max-w-md text-xs text-muted-foreground lg:table-cell">{{ r.response.reason }}</TableCell>
                                        <TableCell v-if="canWrite"><Button variant="ghost" size="icon" class="size-11 md:size-9" aria-label="Kaydı sil" @click="removeFert(r)"><Trash2 aria-hidden="true" /></Button></TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </template>
        </template>

        <!-- ── garden sheet ── -->
        <Sheet v-model:open="sheetOpen">
            <SheetContent side="right" class="w-full gap-0 overflow-y-auto sm:max-w-3xl">
                <LoadingState v-if="isLoadingDetail || !detail" text="Bahçe yükleniyor…" class="p-6" />
                <template v-else>
                    <SheetHeader class="border-b">
                        <SheetTitle>{{ detail.block }}/{{ detail.parcel }} · {{ detail.producerName || detail.producerCode }}</SheetTitle>
                        <SheetDescription>{{ detail.code }} · {{ detail.locality }} · çay {{ formatM2(detail.teaAreaM2) }} · {{ detail.observations }} bulutsuz gözlem</SheetDescription>
                        <div class="flex flex-wrap items-center gap-2">
                            <Badge :variant="toneVariant(ANOMALY_META[detail.anomaly.class].tone)">{{ ANOMALY_META[detail.anomaly.class].label }}</Badge>
                            <Badge :variant="toneVariant(vigourTone(detail.vigour))">canlılık {{ detail.vigour != null ? detail.vigour.toFixed(2) : '—' }}</Badge>
                            <Badge variant="outline">tahmin {{ fmtKg(detail.yieldKg) }}</Badge>
                        </div>
                    </SheetHeader>
                    <div class="flex flex-col gap-5 p-4 md:p-6">
                        <p class="text-sm">{{ detail.anomaly.reason }}</p>
                        <div class="grid gap-3 sm:grid-cols-3">
                            <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Optik kayıp</div><div class="font-semibold tabular-nums">NDVI −{{ detail.anomaly.dropNdvi ?? '—' }} · NDRE −{{ detail.anomaly.dropNdre ?? '—' }}</div><div class="text-xs text-muted-foreground">z {{ detail.anomaly.z ?? '—' }} · {{ detail.anomaly.nBefore }}/{{ detail.anomaly.nAfter }} gözlem</div></div>
                            <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Radar (VH)</div><div class="font-semibold tabular-nums">{{ detail.anomaly.radarDb ?? '—' }} dB</div><div class="text-xs text-muted-foreground">{{ detail.anomaly.radarStructural == null ? 'değerlendirilemedi' : detail.anomaly.radarStructural ? 'yapısal değişim' : 'yapı korunmuş' }}</div></div>
                            <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Toparlanma / verim</div><div class="font-semibold tabular-nums">{{ detail.anomaly.recovery != null ? pct(detail.anomaly.recovery) : '—' }}</div><div class="text-xs text-muted-foreground">canlılık ×{{ detail.yieldFactors.vigour }} · budama ×{{ detail.yieldFactors.pruning }} · anomali ×{{ detail.yieldFactors.anomaly }}</div></div>
                        </div>
                        <section v-if="chart" class="flex flex-col gap-2">
                            <h3 class="text-base font-semibold">Büyüme sezonu NDVI (bahçe yeşil, mahalle ortancası gri, NDRE mor)</h3>
                            <svg :viewBox="`0 0 ${chart.W} ${chart.H}`" class="h-auto w-full rounded-lg border bg-card" role="img" aria-label="Bahçenin büyüme sezonu NDVI serisi ve mahalle ortancası" font-size="11">
                                <line v-for="m in chart.months" :key="m.label + m.x" :x1="m.x" :x2="m.x" :y1="chart.padT" :y2="chart.H - chart.padB" class="stroke-border" stroke-width="0.6" />
                                <text v-for="m in chart.months" :key="'t' + m.label + m.x" :x="m.x + 4" :y="chart.H - 8" class="fill-muted-foreground">{{ m.label }}</text>
                                <text v-for="v in [chart.lo + 0.05, (chart.lo + chart.hi) / 2, chart.hi - 0.02]" :key="v" :x="chart.padL - 4" :y="chart.Y(v) + 3" text-anchor="end" class="fill-muted-foreground">{{ v.toFixed(2) }}</text>
                                <path :d="chart.nbhd" fill="none" class="stroke-muted-foreground" stroke-width="1.5" stroke-dasharray="4 3" />
                                <path :d="chart.ndre" fill="none" stroke="#7c3aed" stroke-width="1.2" opacity="0.8" />
                                <path :d="chart.garden" fill="none" class="stroke-primary" stroke-width="2.2" />
                                <line v-if="chart.anomalyX != null && detail.anomaly.class !== 'none' && detail.anomaly.class !== 'no_data'" :x1="chart.anomalyX" :x2="chart.anomalyX" :y1="chart.padT" :y2="chart.H - chart.padB" class="stroke-destructive" stroke-width="1.5" stroke-dasharray="3 3" />
                                <g v-for="(f, i) in chart.fertX" :key="i"><line :x1="f.x" :x2="f.x" :y1="chart.padT" :y2="chart.H - chart.padB" class="stroke-info" stroke-width="1.2" /><text :x="f.x + 3" :y="chart.padT + 10" class="fill-info">gübre</text></g>
                            </svg>
                        </section>
                        <section class="flex flex-col gap-2">
                            <h3 class="text-base font-semibold">Gübreleme kayıtları</h3>
                            <p v-if="detail.fertilisationRecords.length === 0" class="text-sm text-muted-foreground">Bu bahçe için kayıt yok. "Gübreleme geri beslemesi" görünümünden eklenebilir.</p>
                            <div v-for="r in detail.fertilisationRecords" :key="r.id" class="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm">
                                <div><span class="font-medium">{{ fmtDate(r.appliedAt) }}</span> · {{ FERT_TYPE_LABEL[r.type] }}<span v-if="r.product"> · {{ r.product }}</span><span v-if="r.amountKgPerDa != null"> · {{ r.amountKgPerDa }} kg/da</span><div class="text-xs text-muted-foreground">{{ r.response.reason }}</div></div>
                                <Badge :variant="toneVariant(RESPONSE_META[r.response.class].tone)">{{ RESPONSE_META[r.response.class].label }}</Badge>
                            </div>
                        </section>
                    </div>
                </template>
            </SheetContent>
        </Sheet>
    </div>
</template>
