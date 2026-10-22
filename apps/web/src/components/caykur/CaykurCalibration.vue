<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Camera, ChevronLeft, ChevronRight, ClipboardCheck, Crosshair, Download, ExternalLink, MapPin, Target, Trash2 } from '@lucide/vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EmptyState, ListToolbar, LoadingState, StatCard } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toneVariant, type Tone } from '@/components/caykur/tone';
import { useToast } from '@/composables/useToast';
import { useAuthStore } from '@/stores/authStore';
import { api, saveBlob, type CalibrationLabelValue, type CalibrationMetrics, type CalibrationPlanRow, type FusionClass } from '@/services/api';
import { FUSION_CLASS_META, formatM2, formatShare } from '@/services/caykur/teaInventory';
import { formatNumber } from '@/services/caykur';

/**
 * Calibration campaign (P0): the stratified field plan, the mobile label form (status, date,
 * position, photo) and the scoring of the satellite verdicts against what the field saw —
 * recall, false-alarm rate, confusion matrix and the z threshold the labels suggest.
 */
const props = defineProps<{ areaId: string }>();

const ALL = 'all';
const PAGE_SIZE = 25;
const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const LABEL_META: Record<CalibrationLabelValue, { label: string; description: string; tone: Tone }> = {
    pruned: { label: 'Budandı', description: 'Bahçenin tamamı ya da büyük bölümü bu sezon derin budanmış', tone: 'success' },
    partial: { label: 'Kısmen', description: 'Bahçenin bir bölümü budanmış; payı tahmin edin', tone: 'info' },
    not_pruned: { label: 'Budanmadı', description: 'Bu sezon budama izi yok', tone: 'muted' },
    unsure: { label: 'Emin değilim', description: 'Ulaşılamadı / karar verilemedi (puanlamaya girmez)', tone: 'warning' },
};
const LABEL_ORDER: CalibrationLabelValue[] = ['pruned', 'partial', 'not_pruned', 'unsure'];
const CLASS_ORDER: FusionClass[] = ['pruned', 'likely', 'unclear', 'not_pruned', 'no_data'];

const toast = useToast();
const auth = useAuthStore();
const canWrite = computed(() => auth.isAdmin || ['kurum_admin', 'fabrika_sorumlusu', 'saha_personeli'].includes(auth.caykurRole ?? ''));

const metrics = ref<CalibrationMetrics | null>(null);
const isLoadingMetrics = ref(true);
const error = ref<string | null>(null);
const season = ref('');

// ── Plan ──
const rows = ref<CalibrationPlanRow[]>([]);
const total = ref(0);
const totalPages = ref(1);
const page = ref(1);
const pendingOnly = ref(true);
const locality = ref<string | typeof ALL>(ALL);
const localities = ref<string[]>([]);
const isLoadingPlan = ref(false);
const busy = ref<string | null>(null);

// ── Label sheet ──
const sheetOpen = ref(false);
const current = ref<CalibrationPlanRow | null>(null);
const form = ref<{ label: CalibrationLabelValue | ''; observedAt: string; prunedSharePct: number | undefined; note: string; lat: number | null; lng: number | null; accuracyM: number | null }>({
    label: '', observedAt: today(), prunedSharePct: undefined, note: '', lat: null, lng: null, accuracyM: null,
});
const photoFile = ref<File | null>(null);
const photoPreview = ref<string | null>(null);
const existingPhoto = ref<string | null>(null);
const isSaving = ref(false);
const isLocating = ref(false);
const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;

function today(): string {
    return new Date().toISOString().slice(0, 10);
}
function fmtDate(d: string | null | undefined): string {
    if (!d) return '—';
    const iso = d.slice(0, 10);
    return `${Number(iso.slice(8, 10))} ${MONTHS_TR[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}
function pct(v: number | null | undefined): string {
    return v == null ? '—' : `%${Math.round(v * 100)}`;
}
function mapsUrl(r: CalibrationPlanRow): string {
    return `https://www.google.com/maps?q=${r.lat.toFixed(6)},${r.lng.toFixed(6)}`;
}

// ── Loading ──
async function loadMetrics(): Promise<void> {
    isLoadingMetrics.value = true;
    error.value = null;
    const res = await api.getCalibrationMetrics(props.areaId, season.value || undefined);
    isLoadingMetrics.value = false;
    if (!res.data) {
        error.value = res.error?.message ?? 'Kalibrasyon özeti yüklenemedi';
        return;
    }
    metrics.value = res.data;
    season.value = res.data.season;
}
async function loadPlan(): Promise<void> {
    isLoadingPlan.value = true;
    const res = await api.getCalibrationPlan(props.areaId, { season: season.value || undefined, pending: pendingOnly.value, locality: locality.value === ALL ? undefined : locality.value, page: page.value, limit: PAGE_SIZE });
    isLoadingPlan.value = false;
    if (!res.data) {
        toast.error(res.error?.message ?? 'Saha planı yüklenemedi');
        return;
    }
    rows.value = res.data.data;
    total.value = res.data.meta.total;
    totalPages.value = Math.max(1, res.data.meta.totalPages);
    localities.value = res.data.localities;
}
async function refresh(): Promise<void> {
    await Promise.all([loadMetrics(), loadPlan()]);
}
watch([pendingOnly, locality], () => { page.value = 1; void loadPlan(); });
watch(page, () => { void loadPlan(); });
function onLocality(v: unknown): void {
    locality.value = typeof v === 'string' && v !== '' ? v : ALL;
}

// ── Label form ──
async function openLabel(r: CalibrationPlanRow): Promise<void> {
    current.value = r;
    form.value = {
        label: r.label?.label ?? '',
        observedAt: r.label?.observedAt ?? today(),
        prunedSharePct: r.label?.prunedShare != null ? Math.round(r.label.prunedShare * 100) : undefined,
        note: r.label?.note ?? '',
        lat: r.label?.lat ?? null,
        lng: r.label?.lng ?? null,
        accuracyM: r.label?.accuracyM ?? null,
    };
    clearPhoto();
    existingPhoto.value = null;
    sheetOpen.value = true;
    if (r.label?.hasPhoto) {
        const blob = await api.getCalibrationPhoto(props.areaId, r.label.id);
        if (blob) existingPhoto.value = URL.createObjectURL(blob);
    }
    await nextTick();
    renderMap(r);
}
function onLabelPick(v: unknown): void {
    if (typeof v === 'string' && v !== '') form.value.label = v as CalibrationLabelValue;
}
function locate(): void {
    if (!navigator.geolocation) {
        toast.error('Bu cihazda konum servisi yok');
        return;
    }
    isLocating.value = true;
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            isLocating.value = false;
            form.value.lat = pos.coords.latitude;
            form.value.lng = pos.coords.longitude;
            form.value.accuracyM = pos.coords.accuracy;
            if (map && current.value) {
                L.circleMarker([pos.coords.latitude, pos.coords.longitude], { radius: 6, color: '#1d4ed8', fillColor: '#60a5fa', fillOpacity: 0.9 }).addTo(map).bindTooltip('Bulunduğunuz yer');
            }
        },
        (err) => {
            isLocating.value = false;
            toast.error(err.code === 1 ? 'Konum izni verilmedi' : 'Konum alınamadı');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
}
function onPhoto(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    clearPhoto();
    if (file) {
        photoFile.value = file;
        photoPreview.value = URL.createObjectURL(file);
    }
    input.value = '';
}
function clearPhoto(): void {
    if (photoPreview.value) URL.revokeObjectURL(photoPreview.value);
    photoFile.value = null;
    photoPreview.value = null;
}
/** Downscales the camera photo to ≤ 1280 px JPEG so a field upload stays small (EXIF orientation applied). */
async function downscale(file: File, max = 1280): Promise<Blob> {
    try {
        const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bmp.width * scale);
        canvas.height = Math.round(bmp.height * scale);
        canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
        bmp.close();
        return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.82));
    } catch {
        return file;
    }
}
async function save(): Promise<void> {
    if (!current.value || !form.value.label) {
        toast.error('Önce budama durumunu seçin');
        return;
    }
    isSaving.value = true;
    try {
        const res = await api.saveCalibrationLabel(props.areaId, {
            season: season.value,
            gardenCode: current.value.gardenCode,
            label: form.value.label,
            observedAt: form.value.observedAt,
            lat: form.value.lat ?? undefined,
            lng: form.value.lng ?? undefined,
            accuracyM: form.value.accuracyM ?? undefined,
            prunedShare: form.value.label === 'partial' && form.value.prunedSharePct != null ? Math.min(1, Math.max(0, form.value.prunedSharePct / 100)) : undefined,
            note: form.value.note.trim() || undefined,
        });
        if (!res.data) {
            toast.error(res.error?.message ?? 'Etiket kaydedilemedi');
            return;
        }
        if (photoFile.value) {
            const blob = await downscale(photoFile.value);
            const up = await api.uploadCalibrationPhoto(props.areaId, res.data.id, blob, `${current.value.gardenCode}.jpg`);
            if (up.error) toast.warning(`Etiket kaydedildi, fotoğraf yüklenemedi: ${up.error.message}`);
        }
        toast.success(`${current.value.block}/${current.value.parcel} etiketlendi: ${LABEL_META[form.value.label].label}`);
        sheetOpen.value = false;
        await refresh();
    } finally {
        isSaving.value = false;
    }
}
async function removeLabel(r: CalibrationPlanRow): Promise<void> {
    if (!r.label || !window.confirm(`${r.block}/${r.parcel} etiketi silinsin mi?`)) return;
    const res = await api.deleteCalibrationLabel(props.areaId, r.label.id);
    if (res.error) {
        toast.error(res.error);
        return;
    }
    toast.success('Etiket silindi');
    sheetOpen.value = false;
    await refresh();
}
async function downloadCsv(): Promise<void> {
    busy.value = 'csv';
    try {
        const res = await api.downloadCalibrationCsv(props.areaId, season.value);
        if (!res.blob) {
            toast.error(res.error ?? 'Etiketler indirilemedi');
            return;
        }
        saveBlob(res.blob, res.filename ?? `kalibrasyon-etiketleri-${season.value}.csv`);
    } finally {
        busy.value = null;
    }
}

// ── Mini map in the sheet ──
function renderMap(r: CalibrationPlanRow): void {
    if (!mapContainer.value) return;
    if (map) {
        map.remove();
        map = null;
    }
    map = L.map(mapContainer.value, { zoomControl: true, attributionControl: false });
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20, maxNativeZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }).addTo(map);
    const layer = L.geoJSON(r.geometry as unknown as GeoJSON.GeoJsonObject, { style: { color: '#4ade80', weight: 3, fillColor: '#4ade80', fillOpacity: 0.15 } }).addTo(map);
    map.fitBounds(layer.getBounds().pad(0.6));
    if (form.value.lat != null && form.value.lng != null) {
        L.circleMarker([form.value.lat, form.value.lng], { radius: 6, color: '#1d4ed8', fillColor: '#60a5fa', fillOpacity: 0.9 }).addTo(map).bindTooltip('Etiket konumu');
    }
}
watch(sheetOpen, (open) => {
    if (!open && map) {
        map.remove();
        map = null;
    }
    if (!open) {
        clearPhoto();
        if (existingPhoto.value) URL.revokeObjectURL(existingPhoto.value);
        existingPhoto.value = null;
    }
});

// ── Threshold sweep chart (SVG) ──
const sweepPath = computed(() => {
    const m = metrics.value;
    if (!m || m.sweep.length === 0) return null;
    const W = 520, H = 160, padL = 34, padB = 22, padT = 8, padR = 10;
    const z0 = m.sweep[0].z, z1 = m.sweep[m.sweep.length - 1].z;
    const X = (z: number) => padL + ((z - z0) / (z1 - z0)) * (W - padL - padR);
    const Y = (v: number) => padT + (1 - v) * (H - padT - padB);
    const line = (key: 'recall' | 'falseAlarmRate' | 'f1') => m.sweep.map((s, i) => `${i ? 'L' : 'M'}${X(s.z).toFixed(1)} ${Y(s[key]).toFixed(1)}`).join(' ');
    return { W, H, padL, padB, padT, X, Y, recall: line('recall'), far: line('falseAlarmRate'), f1: line('f1'), ticks: [1, 2, 3, 4, 5, 6, 7, 8] };
});

onMounted(async () => {
    await loadMetrics();
    await loadPlan();
});
onBeforeUnmount(() => {
    map?.remove();
    clearPhoto();
});
</script>

<template>
    <div class="flex flex-col gap-6">
        <LoadingState v-if="isLoadingMetrics && !metrics" text="Kalibrasyon yükleniyor…" />
        <Alert v-else-if="error" variant="destructive">
            <AlertTitle>Kalibrasyon yüklenemedi</AlertTitle>
            <AlertDescription class="flex flex-wrap items-center gap-3">{{ error }} <Button variant="outline" class="h-11 md:h-9" @click="refresh">Tekrar dene</Button></AlertDescription>
        </Alert>
        <template v-else-if="metrics">
            <Alert :variant="metrics.calibrated ? 'success' : 'info'">
                <AlertTitle>{{ metrics.calibrated ? 'Kalibre edildi — eşikler saha etiketleriyle doğrulanabilir' : 'Kalibrasyon kampanyası: Kasım–Aralık budama sezonunda saha etiketi toplanıyor' }}</AlertTitle>
                <AlertDescription>
                    Plan, uydu kararına göre katmanlı seçilmiş {{ metrics.planSize }} bahçeyi listeler (tüm "budandı", olası ve "budama yok"tan örnekler, belirsizlerle tamamlanır).
                    Bahçeye gidin, <b>Budandı / Kısmen / Budanmadı</b> seçin, konumlu fotoğraf çekin, kaydedin. Puanlama için en az {{ metrics.requirement.minPositives }} budanmış ve {{ metrics.requirement.minNegatives }} budanmamış etiket gerekir; "Emin değilim" puanlamaya girmez.
                    Etiketler çok-sensör kararıyla karşılaştırılır; yakalama, yanlış alarm ve önerilen z eşiği aşağıda güncellenir.
                </AlertDescription>
            </Alert>

            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Saha planı" :value="`${formatNumber(metrics.labelled)} / ${formatNumber(metrics.planSize)}`" :hint="`${metrics.pending} bahçe bekliyor · ${metrics.positives} pozitif, ${metrics.negatives} negatif etiket`" :icon="ClipboardCheck" />
                <StatCard label="Yakalama (politika)" :value="pct(metrics.recall)" :hint="`kesin + olası sayılır · yalnız kesin: ${pct(metrics.recallStrict)}`" :icon="Target" />
                <StatCard label="Yanlış alarm" :value="pct(metrics.falseAlarmRate)" :hint="`budanmamışta budandı/olası · yalnız kesin: ${pct(metrics.falseAlarmRateStrict)} · kesinlik ${pct(metrics.precision)}`" :icon="Crosshair" />
                <StatCard label="Önerilen eşik" :value="metrics.suggested ? `z ≥ ${metrics.suggested.zPruned}` : '—'" :hint="metrics.suggested ? `olası z ≥ ${metrics.suggested.zLikely} · F1 ${metrics.suggested.f1} · mevcut ${metrics.currentRules.zPruned} / ${metrics.currentRules.zLikely}` : `mevcut budandı z ≥ ${metrics.currentRules.zPruned}, olası z ≥ ${metrics.currentRules.zLikely} · yeterli etiket yok`" :icon="MapPin" />
            </div>

            <div class="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Karışıklık matrisi</CardTitle>
                        <CardDescription>Satır: uydu kararı · sütun: sahada görülen</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div class="overflow-hidden rounded-lg border bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Uydu \ Saha</TableHead>
                                        <TableHead v-for="l in LABEL_ORDER" :key="l" class="text-right">{{ LABEL_META[l].label }}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow v-for="c in CLASS_ORDER.filter((k) => metrics!.bySystemClass[k] || k !== 'no_data')" :key="c">
                                        <TableCell><Badge :variant="toneVariant(FUSION_CLASS_META[c].tone)">{{ FUSION_CLASS_META[c].label }}</Badge></TableCell>
                                        <TableCell v-for="l in LABEL_ORDER" :key="l" class="text-right tabular-nums" :class="(c === 'pruned' || c === 'likely') && (l === 'pruned' || l === 'partial') ? 'font-semibold text-success' : (c === 'pruned' || c === 'likely') && l === 'not_pruned' ? 'font-semibold text-destructive' : ''">{{ metrics.confusion[c]?.[l] ?? 0 }}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Eşik taraması</CardTitle>
                        <CardDescription>Birleşik z eşiğine göre yakalama (yeşil), yanlış alarm (kırmızı) ve F1 (mavi)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <svg v-if="sweepPath" :viewBox="`0 0 ${sweepPath.W} ${sweepPath.H}`" class="h-auto w-full" role="img" aria-label="Eşik taraması: z eşiğine göre yakalama, yanlış alarm ve F1" font-size="10">
                            <line v-for="t in sweepPath.ticks" :key="t" :x1="sweepPath.X(t)" :x2="sweepPath.X(t)" :y1="sweepPath.padT" :y2="sweepPath.H - sweepPath.padB" class="stroke-border" stroke-width="0.5" />
                            <text v-for="t in sweepPath.ticks" :key="`t${t}`" :x="sweepPath.X(t)" :y="sweepPath.H - 6" text-anchor="middle" class="fill-muted-foreground">z {{ t }}</text>
                            <text v-for="v in [0, 0.5, 1]" :key="`y${v}`" :x="sweepPath.padL - 4" :y="sweepPath.Y(v) + 3" text-anchor="end" class="fill-muted-foreground">{{ Math.round(v * 100) }}%</text>
                            <path :d="sweepPath.recall" fill="none" class="stroke-success" stroke-width="2" />
                            <path :d="sweepPath.far" fill="none" class="stroke-destructive" stroke-width="2" />
                            <path :d="sweepPath.f1" fill="none" class="stroke-info" stroke-width="1.5" stroke-dasharray="4 3" />
                            <line :x1="sweepPath.X(metrics.currentRules.zPruned)" :x2="sweepPath.X(metrics.currentRules.zPruned)" :y1="sweepPath.padT" :y2="sweepPath.H - sweepPath.padB" class="stroke-muted-foreground" stroke-width="1" stroke-dasharray="3 3" />
                            <text :x="sweepPath.X(metrics.currentRules.zPruned) + 3" :y="sweepPath.padT + 10" class="fill-muted-foreground">mevcut</text>
                            <template v-if="metrics.suggested">
                                <line :x1="sweepPath.X(metrics.suggested.zPruned)" :x2="sweepPath.X(metrics.suggested.zPruned)" :y1="sweepPath.padT" :y2="sweepPath.H - sweepPath.padB" class="stroke-primary" stroke-width="1.5" />
                                <text :x="sweepPath.X(metrics.suggested.zPruned) + 3" :y="sweepPath.padT + 22" class="fill-primary">öneri</text>
                            </template>
                        </svg>
                        <p class="mt-2 text-xs text-muted-foreground">{{ metrics.suggested ? `Öneri F1'i en yüksek eşik: budandı z ≥ ${metrics.suggested.zPruned}, olası z ≥ ${metrics.suggested.zLikely}. Motor tarafında calibrate-fusion adımı bu etiket dosyasıyla eşikleri sabitler.` : 'Yeterli etiket toplanınca öneri burada görünür.' }}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Saha planı</CardTitle>
                    <CardDescription>{{ formatNumber(total) }} bahçe · satırdaki "Etiketle" ile saha formu açılır; "Haritada aç" navigasyon içindir</CardDescription>
                    <CardAction>
                        <Button variant="outline" size="sm" class="h-11 md:h-9" :disabled="busy === 'csv'" @click="downloadCsv"><Download aria-hidden="true" />Etiketler (CSV)</Button>
                    </CardAction>
                </CardHeader>
                <CardContent class="flex flex-col gap-4">
                    <ListToolbar>
                        <div class="flex items-center gap-2"><Switch id="cal-pending" v-model="pendingOnly" /><Label for="cal-pending">Yalnız etiketlenmemişler</Label></div>
                        <template #filters>
                            <Select :model-value="locality" @update:model-value="onLocality">
                                <SelectTrigger class="h-11 w-full md:h-9 md:w-52" aria-label="Mevkii"><SelectValue placeholder="Mevkii" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="ALL">Tüm mevkiiler</SelectItem>
                                    <SelectItem v-for="l in localities" :key="l" :value="l">{{ l }}</SelectItem>
                                </SelectContent>
                            </Select>
                        </template>
                    </ListToolbar>
                    <div v-if="metrics.byLocality.length" class="flex flex-wrap gap-1">
                        <Badge v-for="l in metrics.byLocality" :key="l.name" variant="outline" class="text-[10px]">{{ l.name }} · {{ l.labelled }}/{{ l.planned }}</Badge>
                    </div>
                    <LoadingState v-if="isLoadingPlan && rows.length === 0" text="Plan yükleniyor…" />
                    <EmptyState v-else-if="rows.length === 0" :icon="ClipboardCheck" title="Bu filtrede bahçe yok" description="Tüm bahçeler etiketlenmiş olabilir; filtreyi kaldırıp kontrol edin." />
                    <div v-else class="overflow-hidden rounded-lg border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Bahçe</TableHead>
                                    <TableHead>Uydu kararı</TableHead>
                                    <TableHead class="hidden md:table-cell">Değişim</TableHead>
                                    <TableHead>Saha etiketi</TableHead>
                                    <TableHead class="text-right"><span class="sr-only">İşlem</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="r in rows" :key="r.gardenId">
                                    <TableCell>
                                        <div class="font-medium text-foreground">{{ r.block }}/{{ r.parcel }}<span v-if="r.holderCount > 1" class="text-xs text-muted-foreground"> · hisse {{ r.holderIndex }}/{{ r.holderCount }}</span></div>
                                        <div class="text-xs text-muted-foreground">{{ r.locality }} · {{ r.producerName || r.producerCode }} · {{ formatM2(r.areaM2) }}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge :variant="toneVariant(FUSION_CLASS_META[r.systemClass].tone)">{{ FUSION_CLASS_META[r.systemClass].label }}</Badge>
                                        <div class="text-xs text-muted-foreground tabular-nums">z {{ r.systemZ ?? '—' }}</div>
                                    </TableCell>
                                    <TableCell class="hidden md:table-cell text-sm">{{ fmtDate(r.changeDate) }}<div v-if="r.detectedAt" class="text-xs text-muted-foreground">tespit {{ fmtDate(r.detectedAt) }}</div></TableCell>
                                    <TableCell>
                                        <template v-if="r.label">
                                            <Badge :variant="toneVariant(LABEL_META[r.label.label].tone)">{{ LABEL_META[r.label.label].label }}</Badge>
                                            <div class="text-xs text-muted-foreground">{{ fmtDate(r.label.observedAt) }} · {{ r.label.createdByName }}<span v-if="r.label.hasPhoto"> · fotoğraf</span></div>
                                        </template>
                                        <span v-else class="text-xs text-muted-foreground">—</span>
                                    </TableCell>
                                    <TableCell class="text-right">
                                        <div class="flex justify-end gap-1">
                                            <Button as="a" :href="mapsUrl(r)" target="_blank" rel="noopener" variant="ghost" size="icon" class="size-11 md:size-9" aria-label="Haritada aç" title="Haritada aç (navigasyon)"><ExternalLink aria-hidden="true" /></Button>
                                            <Button v-if="canWrite" :variant="r.label ? 'outline' : 'default'" size="sm" class="h-11 md:h-9" @click="openLabel(r)">{{ r.label ? 'Düzenle' : 'Etiketle' }}</Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <div v-if="totalPages > 1" class="flex items-center justify-between gap-3">
                        <span class="text-sm text-muted-foreground">Sayfa {{ page }} / {{ totalPages }}</span>
                        <div class="flex gap-2">
                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page <= 1" aria-label="Önceki sayfa" @click="page--"><ChevronLeft aria-hidden="true" /></Button>
                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page >= totalPages" aria-label="Sonraki sayfa" @click="page++"><ChevronRight aria-hidden="true" /></Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </template>

        <!-- ── Field label sheet ── -->
        <Sheet v-model:open="sheetOpen">
            <SheetContent side="right" class="w-full gap-0 overflow-y-auto sm:max-w-xl">
                <template v-if="current">
                    <SheetHeader class="border-b">
                        <SheetTitle>{{ current.block }}/{{ current.parcel }} · {{ current.producerName || current.producerCode }}</SheetTitle>
                        <SheetDescription>{{ current.locality }} · {{ formatM2(current.areaM2) }} · uydu: {{ FUSION_CLASS_META[current.systemClass].label }} (z {{ current.systemZ ?? '—' }}<span v-if="current.changeDate">, değişim {{ fmtDate(current.changeDate) }}</span>)</SheetDescription>
                    </SheetHeader>
                    <div class="flex flex-col gap-5 p-4 md:p-6">
                        <div ref="mapContainer" class="h-52 w-full overflow-hidden rounded-lg border" />
                        <div class="space-y-2">
                            <Label>Sahada ne gördünüz?</Label>
                            <ToggleGroup :model-value="form.label" type="single" class="grid grid-cols-2 gap-2" aria-label="Budama durumu" @update:model-value="onLabelPick">
                                <ToggleGroupItem v-for="l in LABEL_ORDER" :key="l" :value="l" class="h-14 justify-start rounded-lg border px-3 text-left data-[state=on]:border-primary data-[state=on]:bg-primary/10">
                                    <div><div class="font-medium">{{ LABEL_META[l].label }}</div><div class="text-[11px] font-normal text-muted-foreground">{{ LABEL_META[l].description }}</div></div>
                                </ToggleGroupItem>
                            </ToggleGroup>
                        </div>
                        <div class="grid gap-4 md:grid-cols-2">
                            <div class="space-y-2">
                                <Label for="cal-date">Gözlem tarihi</Label>
                                <Input id="cal-date" v-model="form.observedAt" type="date" class="h-11 md:h-9" />
                            </div>
                            <div v-if="form.label === 'partial'" class="space-y-2">
                                <Label for="cal-share">Budanan pay (%)</Label>
                                <Input id="cal-share" v-model.number="form.prunedSharePct" type="number" min="0" max="100" step="5" class="h-11 md:h-9" placeholder="örn. 40" />
                            </div>
                        </div>
                        <div class="space-y-2">
                            <Label>Konum</Label>
                            <div class="flex flex-wrap items-center gap-2">
                                <Button variant="outline" class="h-11 md:h-9" :disabled="isLocating" @click="locate"><MapPin aria-hidden="true" />{{ isLocating ? 'Alınıyor…' : 'Konumumu al' }}</Button>
                                <span v-if="form.lat != null && form.lng != null" class="text-xs text-muted-foreground tabular-nums">{{ form.lat.toFixed(5) }}, {{ form.lng.toFixed(5) }}<span v-if="form.accuracyM != null"> · ±{{ Math.round(form.accuracyM) }} m</span></span>
                                <span v-else class="text-xs text-muted-foreground">Bahçenin yanındayken alın; raporda kanıt olarak saklanır.</span>
                            </div>
                        </div>
                        <div class="space-y-2">
                            <Label for="cal-photo">Fotoğraf</Label>
                            <div class="flex flex-wrap items-center gap-3">
                                <Button as="label" for="cal-photo" variant="outline" class="h-11 cursor-pointer md:h-9"><Camera aria-hidden="true" />{{ photoFile ? 'Fotoğrafı değiştir' : 'Fotoğraf çek / seç' }}</Button>
                                <input id="cal-photo" type="file" accept="image/*" capture="environment" class="sr-only" @change="onPhoto" />
                                <span class="text-xs text-muted-foreground">Cihazda küçültülür (≤ 1280 px)</span>
                            </div>
                            <img v-if="photoPreview" :src="photoPreview" alt="Seçilen fotoğraf" class="max-h-56 rounded-lg border object-cover" />
                            <img v-else-if="existingPhoto" :src="existingPhoto" alt="Kayıtlı fotoğraf" class="max-h-56 rounded-lg border object-cover" />
                        </div>
                        <div class="space-y-2">
                            <Label for="cal-note">Not</Label>
                            <Textarea id="cal-note" v-model="form.note" rows="2" placeholder="Örn. üst teras budanmış, alt kısım değil; sahibi ocakta budadığını söyledi" />
                        </div>
                        <div class="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                            <Button v-if="current.label" variant="ghost" class="h-11 text-destructive md:h-9" @click="removeLabel(current)"><Trash2 aria-hidden="true" />Etiketi sil</Button>
                            <span v-else />
                            <div class="flex gap-2">
                                <Button variant="outline" class="h-11 md:h-9" @click="sheetOpen = false">Vazgeç</Button>
                                <Button class="h-11 md:h-9" :disabled="isSaving || !form.label" @click="save">{{ isSaving ? 'Kaydediliyor…' : 'Kaydet' }}</Button>
                            </div>
                        </div>
                        <p class="text-xs text-muted-foreground">Etiketler uydu kararından bağımsız saklanır; kayıt anındaki uydu kararı (z {{ current.systemZ ?? '—' }}) etiketle birlikte yazılır, sonraki çalıştırmalar bununla kıyaslanır.</p>
                    </div>
                </template>
            </SheetContent>
        </Sheet>
    </div>
</template>
