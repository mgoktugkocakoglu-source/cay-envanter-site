<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Plus, Search, Trash2, UserRound } from '@lucide/vue';
import CaykurLicensingEditor, { type EditorPiece } from '@/components/caykur/CaykurLicensingEditor.vue';
import { LoadingState } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useToast } from '@/composables/useToast';
import {
    api,
    type ApplicationDetail,
    type ApplicationType,
    type GardenEditorContext,
    type HolderSpec,
    type LicensedGarden,
    type LicensingProducerProfile,
    type LicensingProducerRow,
    type OperationCause,
    type OperationPreview,
} from '@/services/api';
import { formatM2 } from '@/services/caykur/teaInventory';

/**
 * Register operations opened from a producer profile: subdivide a garden into pieces (each with
 * its holder and licensed share), split a licence among holders, transfer a licence, correct a
 * licensed area, or redraw a boundary. Each creates a licensing file; approval applies it.
 */
export type OperationKind = 'garden_subdivision' | 'boundary_determination' | 'area_correction' | 'license_split' | 'transfer';

const props = defineProps<{
    areaId: string;
    open: boolean;
    kind: OperationKind;
    profile: LicensingProducerProfile;
    gardenCode?: string | null;
    licenseCode?: string | null;
}>();
const emit = defineEmits<{
    (e: 'update:open', v: boolean): void;
    (e: 'created', application: ApplicationDetail): void;
}>();

const TITLES: Record<OperationKind, string> = {
    garden_subdivision: 'Bahçe alt bölünmesi',
    boundary_determination: 'Sınır tespiti / düzeltme',
    area_correction: 'Ruhsat alanı düzeltme',
    license_split: 'Ruhsat ayırımı',
    transfer: 'Devir / intikal',
};
const CAUSES: Array<{ value: OperationCause; label: string }> = [
    { value: 'inheritance', label: 'İntikal (vefat, mirasçılar)' },
    { value: 'sale', label: 'Satış / devir' },
    { value: 'parcel_split', label: 'Parsel ifrazı (TKGM)' },
    { value: 'family', label: 'Aile içi paylaşım' },
    { value: 'other', label: 'Diğer' },
];
const DOCS: Record<OperationKind, Array<{ type: string; name: string }>> = {
    garden_subdivision: [{ type: 'tapu', name: 'Tapu kaydı' }, { type: 'kroki', name: 'Kroki' }, { type: 'muvafakat', name: 'Hissedar muvafakatnamesi' }, { type: 'kimlik', name: 'Kimlik' }],
    license_split: [{ type: 'veraset', name: 'Veraset ilamı' }, { type: 'satis_sozlesmesi', name: 'Satış / devir sözleşmesi' }, { type: 'tapu', name: 'Tapu kaydı' }, { type: 'muvafakat', name: 'Muvafakatname' }, { type: 'kimlik', name: 'Kimlik' }, { type: 'dilekce', name: 'Dilekçe' }],
    transfer: [{ type: 'veraset', name: 'Veraset ilamı' }, { type: 'satis_sozlesmesi', name: 'Satış / devir sözleşmesi' }, { type: 'tapu', name: 'Tapu kaydı' }, { type: 'kimlik', name: 'Kimlik' }, { type: 'cuzdan', name: 'ÇAYKUR cüzdanı' }, { type: 'dilekce', name: 'Dilekçe' }],
    area_correction: [{ type: 'dilekce', name: 'Dilekçe' }, { type: 'olcum_raporu', name: 'Eksper ölçüm raporu' }],
    boundary_determination: [{ type: 'kroki', name: 'Kroki' }, { type: 'rtk_olcum', name: 'RTK-GNSS ölçüm raporu' }, { type: 'muvafakat', name: 'Komşu muvafakatnamesi' }],
};

const toast = useToast();
const context = ref<GardenEditorContext | null>(null);
const isLoading = ref(false);
const isBusy = ref(false);
const preview = ref<OperationPreview | null>(null);
const provided = ref<string[]>([]);
const cause = ref<OperationCause>('family');
const reason = ref('');
// subdivision
const pieces = ref<EditorPiece[]>([]);
const pieceHolders = ref<Record<string, HolderSpec>>({});
const pieceLicensed = ref<Record<string, number | undefined>>({});
// boundary
const geometry = ref<GeoJSON.Polygon | GeoJSON.MultiPolygon | null>(null);
const boundarySource = ref<'map' | 'rtk' | 'producer'>('map');
// area correction
const newArea = ref<number | undefined>(undefined);
// split
interface Part { id: string; label: string; holder: HolderSpec; gardenCodes: string[]; recordedAreaM2?: number }
const parts = ref<Part[]>([]);
// transfer
const transferHolder = ref<HolderSpec>({});

const isOpen = computed({ get: () => props.open, set: (v) => emit('update:open', v) });
const garden = computed<LicensedGarden | null>(() => props.profile.gardens.find((g) => g.code === props.gardenCode) ?? null);
const license = computed(() => props.profile.licenses.find((l) => l.code === props.licenseCode) ?? null);
const licenseGardens = computed(() => props.profile.gardens.filter((g) => g.licenseCode === props.licenseCode && g.recordStatus === 'active'));
const title = computed(() => TITLES[props.kind]);
const subtitle = computed(() => {
    if (garden.value) return `${garden.value.block}/${garden.value.parcel} · ${garden.value.code} · ${props.profile.name}`;
    if (license.value) return `${license.value.code} · ${props.profile.name} · ruhsatta ${formatM2(license.value.recordedAreaM2)}`;
    return props.profile.name;
});
const piecePreview = computed(() => (preview.value?.type === 'garden_subdivision' ? preview.value : null));
const splitPreview = computed(() => (preview.value?.type === 'license_split' ? preview.value : null));
const boundaryPreview = computed(() => (preview.value?.type === 'boundary_determination' ? preview.value : null));

function holderOf(id: string): HolderSpec {
    if (!pieceHolders.value[id]) pieceHolders.value[id] = { producerCode: props.profile.code };
    return pieceHolders.value[id] as HolderSpec;
}
function holderLabel(h: HolderSpec): string {
    if (h.producerCode === props.profile.code) return `${props.profile.name} (mevcut sahip)`;
    if (h.producerCode) return holderNames.value[h.producerCode] ?? h.producerCode;
    return h.name ? `${h.name} (yeni)` : 'Sahip seçilmedi';
}

// ── holder picker (shared by pieces, parts and transfer) ──
const pickerFor = ref<{ target: 'piece' | 'part' | 'transfer'; id: string } | null>(null);
const pickerMode = ref<'existing' | 'new'>('existing');
const pickerSearch = ref('');
const pickerRows = ref<LicensingProducerRow[]>([]);
const pickerNew = ref({ name: '', walletNo: '' });
const holderNames = ref<Record<string, string>>({});
let pickerTimer: ReturnType<typeof setTimeout> | null = null;
function openPicker(target: 'piece' | 'part' | 'transfer', id: string): void {
    pickerFor.value = { target, id };
    pickerMode.value = 'existing';
    pickerSearch.value = '';
    pickerRows.value = [];
    pickerNew.value = { name: '', walletNo: '' };
    void searchHolders();
}
async function searchHolders(): Promise<void> {
    const res = await api.getLicensingProducers(props.areaId, { search: pickerSearch.value.trim() || undefined, limit: 8, sortBy: 'name', sortOrder: 'ASC' });
    if (res.data) {
        pickerRows.value = res.data.data;
        for (const r of res.data.data) holderNames.value[r.code] = r.name;
    }
}
watch(pickerSearch, () => {
    if (pickerTimer) clearTimeout(pickerTimer);
    pickerTimer = setTimeout(() => void searchHolders(), 250);
});
function applyHolder(h: HolderSpec): void {
    const t = pickerFor.value;
    if (!t) return;
    if (t.target === 'piece') pieceHolders.value[t.id] = h;
    else if (t.target === 'part') { const p = parts.value.find((x) => x.id === t.id); if (p) p.holder = h; }
    else transferHolder.value = h;
    pickerFor.value = null;
    preview.value = null;
}
function pickExisting(r: LicensingProducerRow): void {
    holderNames.value[r.code] = r.name;
    applyHolder({ producerCode: r.code });
}
function pickNew(): void {
    if (!pickerNew.value.name.trim()) { toast.error('Yeni sahip için ad soyad girin'); return; }
    applyHolder({ name: pickerNew.value.name.trim(), walletNo: pickerNew.value.walletNo.trim() || undefined });
}

// ── split parts ──
let partCounter = 0;
function addPart(holder?: HolderSpec): void {
    partCounter++;
    parts.value.push({ id: `part${partCounter}`, label: 'ABCDEFGHJKLMNPRSTUVYZ'[parts.value.length] ?? String(parts.value.length + 1), holder: holder ?? {}, gardenCodes: [] });
    preview.value = null;
}
function removePart(id: string): void {
    parts.value = parts.value.filter((p) => p.id !== id);
    preview.value = null;
}
function togglePartGarden(part: Part, code: string, on: boolean): void {
    for (const p of parts.value) p.gardenCodes = p.gardenCodes.filter((c) => c !== code);
    if (on) part.gardenCodes = [...part.gardenCodes, code];
    preview.value = null;
}
function partLicensed(part: Part): number {
    return part.gardenCodes.reduce((t, c) => t + (licenseGardens.value.find((g) => g.code === c)?.licensedAreaM2 ?? 0), 0);
}

// ── lifecycle ──
async function load(): Promise<void> {
    preview.value = null;
    provided.value = [];
    reason.value = '';
    cause.value = props.kind === 'transfer' || props.kind === 'license_split' ? 'inheritance' : 'family';
    pieces.value = [];
    pieceHolders.value = {};
    pieceLicensed.value = {};
    geometry.value = null;
    boundarySource.value = 'map';
    newArea.value = garden.value?.licensedAreaM2 ?? undefined;
    parts.value = [];
    transferHolder.value = {};
    context.value = null;
    holderNames.value = { [props.profile.code]: props.profile.name };
    if (props.kind === 'license_split') {
        addPart({ producerCode: props.profile.code });
        addPart({});
        const mine = parts.value[0];
        if (mine) mine.gardenCodes = licenseGardens.value.map((g) => g.code);
    }
    if ((props.kind === 'garden_subdivision' || props.kind === 'boundary_determination' || props.kind === 'area_correction') && props.gardenCode) {
        isLoading.value = true;
        const res = await api.getLicensingGardenContext(props.areaId, props.gardenCode);
        isLoading.value = false;
        if (!res.data) { toast.error(res.error?.message ?? 'Bahçe bilgisi yüklenemedi'); return; }
        context.value = res.data;
    }
}
watch(() => [props.open, props.kind, props.gardenCode, props.licenseCode], ([open]) => { if (open) void load(); }, { immediate: true });
watch(pieces, () => { preview.value = null; }, { deep: true });

function payload(): Record<string, unknown> | null {
    if (props.kind === 'garden_subdivision') {
        if (!props.gardenCode || pieces.value.length < 2) { toast.error('En az iki parça gerekli'); return null; }
        return { gardenCode: props.gardenCode, pieces: pieces.value.map((p) => ({ label: p.label, geometry: p.geometry, holder: holderOf(p.id), licensedAreaM2: pieceLicensed.value[p.id] })), cause: cause.value, reason: reason.value.trim() || undefined };
    }
    if (props.kind === 'boundary_determination') {
        if (!props.gardenCode || !geometry.value) { toast.error('Yeni sınır çizilmedi'); return null; }
        return { gardenCode: props.gardenCode, geometry: geometry.value, source: boundarySource.value, reason: reason.value.trim() || undefined };
    }
    if (props.kind === 'area_correction') {
        if (!props.gardenCode || newArea.value == null || !reason.value.trim()) { toast.error('Yeni alan ve gerekçe gerekli'); return null; }
        return { gardenCode: props.gardenCode, newLicensedAreaM2: newArea.value, reason: reason.value.trim() };
    }
    if (props.kind === 'license_split') {
        if (!props.licenseCode || parts.value.length < 2) { toast.error('En az iki parça gerekli'); return null; }
        return { licenseCode: props.licenseCode, parts: parts.value.map((p) => ({ label: p.label, holder: p.holder, gardenCodes: p.gardenCodes, recordedAreaM2: p.recordedAreaM2 })), cause: cause.value, reason: reason.value.trim() || undefined };
    }
    if (!props.licenseCode || (!transferHolder.value.producerCode && !transferHolder.value.name)) { toast.error('Devralan seçilmedi'); return null; }
    return { licenseCode: props.licenseCode, holder: transferHolder.value, cause: cause.value === 'parcel_split' ? 'other' : cause.value, reason: reason.value.trim() || undefined };
}

async function runPreview(): Promise<void> {
    const body = payload();
    if (!body || (props.kind !== 'garden_subdivision' && props.kind !== 'license_split' && props.kind !== 'boundary_determination')) return;
    isBusy.value = true;
    const res = await api.previewLicensingOperation(props.areaId, { type: props.kind, payload: body as never });
    isBusy.value = false;
    if (!res.data) { toast.error(res.error?.message ?? 'Önizleme alınamadı'); return; }
    preview.value = res.data;
}

async function submit(): Promise<void> {
    const body = payload();
    if (!body) return;
    isBusy.value = true;
    const res = await api.createLicensingApplication(props.areaId, { type: props.kind as ApplicationType, payload: body as never, providedDocuments: provided.value });
    isBusy.value = false;
    if (!res.data) { toast.error(res.error?.message ?? 'Başvuru açılamadı'); return; }
    toast.success(`${res.data.code} dosyası açıldı (${title.value})`);
    emit('created', res.data);
    isOpen.value = false;
}
</script>

<template>
    <Sheet v-model:open="isOpen">
        <SheetContent side="right" class="w-full gap-0 overflow-y-auto sm:max-w-4xl">
            <SheetHeader class="border-b">
                <SheetTitle>{{ title }}</SheetTitle>
                <SheetDescription>{{ subtitle }}</SheetDescription>
            </SheetHeader>
            <div class="flex flex-col gap-5 p-4 md:p-6">
                <LoadingState v-if="isLoading" text="Bahçe ve parsel yükleniyor…" />

                <!-- ── subdivision ── -->
                <template v-else-if="kind === 'garden_subdivision' && context">
                    <Alert variant="info">
                        <AlertTitle>Bahçe parçalara bölünür, her parçanın sahibi ve ruhsat payı belirlenir</AlertTitle>
                        <AlertDescription>Mevcut sahipte kalan parçalar aynı ruhsatta kalır; başka sahibe giden parçalar için ruhsattan ayrılan yeni ruhsat açılır. Onayda eski bahçe kaydı "bölündü" olarak kapanır, parçalar yeni bahçe kayıtları olur.</AlertDescription>
                    </Alert>
                    <CaykurLicensingEditor :context="context" mode="subdivision" :pieces="pieces" @update:pieces="(v) => (pieces = v)" />
                    <div class="overflow-hidden rounded-lg border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Parça</TableHead>
                                    <TableHead>Sahip</TableHead>
                                    <TableHead class="text-right">İzdüşüm</TableHead>
                                    <TableHead class="text-right">Ruhsat payı (m²)</TableHead>
                                    <TableHead class="hidden text-right md:table-cell">Çay</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-if="pieces.length === 0"><TableCell colspan="5" class="text-center text-sm text-muted-foreground">Haritada bahçeyi bölün.</TableCell></TableRow>
                                <TableRow v-for="(p, i) in pieces" :key="p.id">
                                    <TableCell class="font-medium">{{ p.label }}</TableCell>
                                    <TableCell>
                                        <Button variant="outline" size="sm" class="h-11 max-w-56 justify-start truncate md:h-9" @click="openPicker('piece', p.id)"><UserRound aria-hidden="true" />{{ holderLabel(holderOf(p.id)) }}</Button>
                                    </TableCell>
                                    <TableCell class="text-right tabular-nums">{{ piecePreview?.pieces[i] ? formatM2(piecePreview.pieces[i].planimetricAreaM2) : '—' }}</TableCell>
                                    <TableCell class="text-right">
                                        <Input v-model.number="pieceLicensed[p.id]" type="number" min="0" step="1" class="h-11 w-28 text-right md:h-9" :placeholder="piecePreview?.pieces[i]?.licensedAreaM2 != null ? String(piecePreview.pieces[i].licensedAreaM2) : 'oransal'" />
                                    </TableCell>
                                    <TableCell class="hidden text-right tabular-nums md:table-cell">{{ piecePreview?.pieces[i] ? formatM2(piecePreview.pieces[i].measuredTeaAreaM2) : '—' }}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <div v-if="piecePreview" class="flex flex-col gap-2 text-sm">
                        <div class="flex flex-wrap gap-2">
                            <Badge :variant="piecePreview.ok ? 'success' : 'danger'">{{ piecePreview.ok ? 'Geçerli' : 'Hatalı' }}</Badge>
                            <Badge variant="outline">kapsama {{ Math.round(piecePreview.coveredShare * 100) }}% · dışarıda kalan {{ formatM2(piecePreview.uncoveredM2) }}</Badge>
                            <Badge v-if="piecePreview.licensedTotalM2 != null" variant="outline">ruhsat payı toplamı {{ formatM2(piecePreview.licensedTotalM2) }} / {{ formatM2(piecePreview.parent.licensedAreaM2) }}</Badge>
                        </div>
                        <p v-for="e in piecePreview.errors" :key="e" class="text-destructive">{{ e }}</p>
                        <p v-for="w in [...piecePreview.warnings, ...piecePreview.pieces.flatMap((x) => x.warnings.map((y) => `${x.label}: ${y}`))]" :key="w" class="text-warning">{{ w }}</p>
                    </div>
                </template>

                <!-- ── boundary ── -->
                <template v-else-if="kind === 'boundary_determination' && context">
                    <CaykurLicensingEditor :context="context" mode="boundary" :geometry="geometry" @update:geometry="(g) => { geometry = g; preview = null; }" />
                    <div class="grid gap-4 md:grid-cols-2">
                        <div class="space-y-2">
                            <Label>Sınırın kaynağı</Label>
                            <ToggleGroup :model-value="boundarySource" type="single" @update:model-value="(v) => { if (v) boundarySource = v as 'map' | 'rtk' | 'producer'; }">
                                <ToggleGroupItem value="map" class="h-11 px-3 md:h-9">Harita çizimi</ToggleGroupItem>
                                <ToggleGroupItem value="rtk" class="h-11 px-3 md:h-9">RTK-GNSS ölçümü</ToggleGroupItem>
                                <ToggleGroupItem value="producer" class="h-11 px-3 md:h-9">Müstahsil çizimi</ToggleGroupItem>
                            </ToggleGroup>
                        </div>
                    </div>
                    <div v-if="boundaryPreview" class="grid gap-3 text-sm sm:grid-cols-3">
                        <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">İzdüşüm</div><div class="font-semibold tabular-nums">{{ formatM2(boundaryPreview.before.planimetricAreaM2) }} → {{ formatM2(boundaryPreview.after.planimetricAreaM2) }}</div></div>
                        <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Eğimli yüzey</div><div class="font-semibold tabular-nums">{{ formatM2(boundaryPreview.before.surfaceAreaM2) }} → {{ formatM2(boundaryPreview.after.surfaceAreaM2) }}</div></div>
                        <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Uyduda çay</div><div class="font-semibold tabular-nums">{{ formatM2(boundaryPreview.before.measuredTeaAreaM2) }} → {{ formatM2(boundaryPreview.after.measuredTeaAreaM2) }}</div></div>
                        <p v-for="e in boundaryPreview.errors" :key="e" class="text-destructive sm:col-span-3">{{ e }}</p>
                        <p v-for="w in boundaryPreview.warnings" :key="w" class="text-warning sm:col-span-3">{{ w }}</p>
                    </div>
                </template>

                <!-- ── area correction ── -->
                <template v-else-if="kind === 'area_correction' && garden">
                    <div class="grid gap-3 text-sm sm:grid-cols-3">
                        <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Ruhsatta yazan (bahçe payı)</div><div class="font-semibold tabular-nums">{{ garden.licensedAreaM2 == null ? '—' : formatM2(garden.licensedAreaM2) }}</div></div>
                        <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">TKGM izdüşümü</div><div class="font-semibold tabular-nums">{{ formatM2(garden.planimetricAreaM2) }}</div></div>
                        <div class="rounded-lg border bg-card p-3"><div class="text-xs text-muted-foreground">Uyduda ölçülen çay</div><div class="font-semibold tabular-nums">{{ formatM2(garden.measuredTeaAreaM2) }}</div></div>
                    </div>
                    <div class="space-y-2">
                        <Label for="op-area">Yeni ruhsat alanı (m²)</Label>
                        <Input id="op-area" v-model.number="newArea" type="number" min="0" step="1" class="h-11 w-48 md:h-9" />
                        <p class="text-xs text-muted-foreground">Ruhsatın toplam alanı farkı kadar güncellenir; uyuşmazlık rozetleri yeniden hesaplanır.</p>
                    </div>
                </template>

                <!-- ── licence split ── -->
                <template v-else-if="kind === 'license_split' && license">
                    <Alert variant="info">
                        <AlertTitle>Ruhsat, bahçeleri üzerinden sahipler arasında ayrılır</AlertTitle>
                        <AlertDescription>Her bahçe tam olarak bir parçada olmalı. Mevcut sahipte kalan parça ruhsatın kendisi olarak devam eder; diğer parçalar için yeni ruhsat numarası açılır. Hiçbir parça mevcut sahipte kalmazsa ruhsat "ayrıldı" olarak kapanır.</AlertDescription>
                    </Alert>
                    <div class="flex flex-col gap-3">
                        <div v-for="p in parts" :key="p.id" class="rounded-lg border bg-card p-3">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <div class="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary">Parça {{ p.label }}</Badge>
                                    <Button variant="outline" size="sm" class="h-11 md:h-9" @click="openPicker('part', p.id)"><UserRound aria-hidden="true" />{{ holderLabel(p.holder) }}</Button>
                                </div>
                                <div class="flex items-center gap-2">
                                    <Label :for="`part-area-${p.id}`" class="text-xs text-muted-foreground">Ruhsatta yazacak (m²)</Label>
                                    <Input :id="`part-area-${p.id}`" v-model.number="p.recordedAreaM2" type="number" min="0" class="h-11 w-28 text-right md:h-9" :placeholder="String(Math.round(license.recordedAreaM2 * (partLicensed(p) / Math.max(1, licenseGardens.reduce((t, g) => t + (g.licensedAreaM2 ?? 0), 0)))))" />
                                    <Button variant="ghost" size="icon" class="size-11 md:size-9" aria-label="Parçayı kaldır" @click="removePart(p.id)"><Trash2 aria-hidden="true" /></Button>
                                </div>
                            </div>
                            <div class="mt-2 grid gap-1 sm:grid-cols-2">
                                <label v-for="g in licenseGardens" :key="g.code" class="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-muted/40 md:min-h-9">
                                    <Checkbox :model-value="p.gardenCodes.includes(g.code)" @update:model-value="(v) => togglePartGarden(p, g.code, v === true)" />
                                    <span>{{ g.block }}/{{ g.parcel }} <span class="text-xs text-muted-foreground">· {{ g.locality }} · ruhsat {{ g.licensedAreaM2 == null ? '—' : formatM2(g.licensedAreaM2) }} · çay {{ formatM2(g.measuredTeaAreaM2) }}</span></span>
                                </label>
                            </div>
                            <div class="mt-1 text-xs text-muted-foreground">Seçili bahçelerin ruhsat payı: {{ formatM2(partLicensed(p)) }}</div>
                        </div>
                        <Button variant="outline" class="h-11 self-start md:h-9" @click="addPart()"><Plus aria-hidden="true" />Parça ekle</Button>
                    </div>
                    <div v-if="splitPreview" class="flex flex-col gap-2 text-sm">
                        <div class="flex flex-wrap gap-2">
                            <Badge :variant="splitPreview.ok ? 'success' : 'danger'">{{ splitPreview.ok ? 'Geçerli' : 'Hatalı' }}</Badge>
                            <Badge v-for="x in splitPreview.parts" :key="x.label" variant="outline">{{ x.label }}: {{ x.holderName }} · {{ formatM2(x.recordedAreaM2) }}{{ x.keepsOriginal ? ' · ruhsat kalır' : ' · yeni ruhsat' }}</Badge>
                        </div>
                        <p v-for="e in splitPreview.errors" :key="e" class="text-destructive">{{ e }}</p>
                        <p v-for="w in splitPreview.warnings" :key="w" class="text-warning">{{ w }}</p>
                    </div>
                </template>

                <!-- ── transfer ── -->
                <template v-else-if="kind === 'transfer' && license">
                    <div class="rounded-lg border bg-card p-3 text-sm">
                        Ruhsat <span class="font-medium">{{ license.code }}</span> · {{ formatM2(license.recordedAreaM2) }} · {{ licenseGardens.length }} bahçe · mevcut sahip {{ profile.name }}
                        <Badge v-if="license.holderDeceased" variant="muted" class="ml-2">Sahibi vefat etti</Badge>
                    </div>
                    <div class="space-y-2">
                        <Label>Devralan</Label>
                        <Button variant="outline" class="h-11 md:h-9" @click="openPicker('transfer', 'transfer')"><UserRound aria-hidden="true" />{{ transferHolder.producerCode || transferHolder.name ? holderLabel(transferHolder) : 'Devralanı seçin' }}</Button>
                        <p class="text-xs text-muted-foreground">Ruhsat numarası değişmez; tüm bahçeler devralana geçer. Birden çok mirasçı varsa "Ruhsat ayırımı" kullanın.</p>
                    </div>
                </template>

                <!-- ── common: cause, reason, documents ── -->
                <div v-if="kind !== 'area_correction' && kind !== 'boundary_determination'" class="grid gap-4 md:grid-cols-2">
                    <div class="space-y-2">
                        <Label>Sebep</Label>
                        <Select :model-value="cause" @update:model-value="(v) => { if (typeof v === 'string') cause = v as OperationCause; }">
                            <SelectTrigger class="h-11 w-full md:h-9"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem v-for="c in CAUSES.filter((x) => kind !== 'transfer' || x.value !== 'parcel_split')" :key="c.value" :value="c.value">{{ c.label }}</SelectItem></SelectContent>
                        </Select>
                    </div>
                </div>
                <div class="space-y-2">
                    <Label for="op-reason">{{ kind === 'area_correction' ? 'Gerekçe (zorunlu)' : 'Açıklama' }}</Label>
                    <Textarea id="op-reason" v-model="reason" rows="2" placeholder="Örn. mirasçılar arasında noter paylaşımı; veraset ilamı 2026/123" />
                </div>
                <div class="space-y-2">
                    <Label>Dosyadaki belgeler</Label>
                    <div class="grid gap-1 sm:grid-cols-2">
                        <label v-for="d in DOCS[kind]" :key="d.type" class="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-muted/40 md:min-h-9">
                            <Checkbox :model-value="provided.includes(d.type)" @update:model-value="(v) => { provided = v === true ? [...provided, d.type] : provided.filter((x) => x !== d.type); }" />
                            <span>{{ d.name }}</span>
                        </label>
                    </div>
                    <p class="text-xs text-muted-foreground">İşaretlenmeyenler dosyada "eksik" görünür; eksper belge tamamlanmadan onaylamaz.</p>
                </div>

                <div class="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
                    <Button variant="outline" class="h-11 md:h-9" @click="isOpen = false">Vazgeç</Button>
                    <Button v-if="kind === 'garden_subdivision' || kind === 'license_split' || kind === 'boundary_determination'" variant="secondary" class="h-11 md:h-9" :disabled="isBusy" @click="runPreview">Önizle ve doğrula</Button>
                    <Button class="h-11 md:h-9" :disabled="isBusy || ((kind === 'garden_subdivision' || kind === 'license_split' || kind === 'boundary_determination') && !preview?.ok)" @click="submit">{{ isBusy ? 'Kaydediliyor…' : 'Başvuru dosyası aç' }}</Button>
                </div>
            </div>

            <!-- ── holder picker (inline panel) ── -->
            <div v-if="pickerFor" class="absolute inset-x-0 bottom-0 z-20 border-t bg-card p-4 shadow-lg md:p-6">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="font-medium">Sahip seç</div>
                    <ToggleGroup :model-value="pickerMode" type="single" @update:model-value="(v) => { if (v) pickerMode = v as 'existing' | 'new'; }">
                        <ToggleGroupItem value="existing" class="h-11 px-3 md:h-9">Kayıtlı müstahsil</ToggleGroupItem>
                        <ToggleGroupItem value="new" class="h-11 px-3 md:h-9">Yeni kişi</ToggleGroupItem>
                    </ToggleGroup>
                </div>
                <div v-if="pickerMode === 'existing'" class="mt-3 flex flex-col gap-2">
                    <div class="relative">
                        <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <Input v-model="pickerSearch" class="h-11 pl-9 md:h-9" placeholder="Ad, müstahsil / cüzdan / ruhsat no" />
                    </div>
                    <div class="max-h-56 overflow-y-auto rounded-md border">
                        <button v-for="r in pickerRows" :key="r.code" type="button" class="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/40" @click="pickExisting(r)">
                            <span><span class="font-medium text-foreground">{{ r.name }}</span> <span class="text-xs text-muted-foreground">· {{ r.code }} · {{ r.walletNo }}</span></span>
                            <span class="text-xs text-muted-foreground">{{ r.licenseCodes.join(', ') || 'ruhsat yok' }}</span>
                        </button>
                        <div v-if="pickerRows.length === 0" class="px-3 py-3 text-sm text-muted-foreground">Sonuç yok</div>
                    </div>
                </div>
                <div v-else class="mt-3 grid gap-3 md:grid-cols-3">
                    <div class="space-y-2 md:col-span-2"><Label for="new-holder-name">Ad soyad</Label><Input id="new-holder-name" v-model="pickerNew.name" class="h-11 md:h-9" /></div>
                    <div class="space-y-2"><Label for="new-holder-wallet">Cüzdan no (varsa)</Label><Input id="new-holder-wallet" v-model="pickerNew.walletNo" class="h-11 md:h-9" /></div>
                    <div class="md:col-span-3 flex justify-end gap-2"><Button variant="outline" class="h-11 md:h-9" @click="pickerFor = null">Vazgeç</Button><Button class="h-11 md:h-9" @click="pickNew">Bu kişiyi seç</Button></div>
                </div>
                <div v-if="pickerMode === 'existing'" class="mt-2 flex justify-end"><Button variant="ghost" class="h-11 md:h-9" @click="pickerFor = null">Kapat</Button></div>
            </div>
        </SheetContent>
    </Sheet>
</template>
