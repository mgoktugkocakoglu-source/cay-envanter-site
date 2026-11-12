<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight } from '@lucide/vue';
import { LoadingState } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toneVariant, type Tone } from '@/components/caykur/tone';
import { useToast } from '@/composables/useToast';
import { api, type CalibrationLabelValue, type CalibrationMethod, type CombinedClass, type Worklist, type WorklistRate, type WorklistReason, type WorklistRow } from '@/services/api';
import { formatM2 } from '@/services/caykur/teaInventory';

/**
 * Expert worklist of the combined verdict: which gardens to look at first and why. The ground label saved here is
 * the calibration label of the garden for that season; it never changes a verdict, it measures them.
 */
const props = defineProps<{ areaId: string; season: string }>();

const PAGE_SIZE = 15;
const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const CLASS_META: Record<CombinedClass, { label: string; tone: Tone }> = {
    confirmed: { label: 'Kesin', tone: 'success' },
    probable: { label: 'Muhtemel', tone: 'info' },
    light: { label: 'Hafif budama', tone: 'warning' },
    seasonal: { label: 'Mevsimsel desen', tone: 'muted' },
    none: { label: 'Budama yok', tone: 'muted' },
    no_data: { label: 'Veri yok', tone: 'muted' },
};
const REASON_LABEL: Record<WorklistReason, string> = {
    probable_single_module: 'Yalnız bir modül gördü',
    probable_dates_differ: 'İki modülün tarihleri ayrı',
    confirmed_check: 'Kesin sınıfın doğrulaması',
    light_check: 'Hafif budama doğrulaması',
    seasonal_check: 'Mevsimsel desen: gerçek kesim elenmiş olabilir',
    control_sample: 'Kontrol örneği (kaçırma oranı için)',
    repeated_ground: 'Aynı zemin başka sezonda da sayılmış',
    followup_permanent: 'Düşüş bir yıl sonra kapanmamış',
    followup_repeating: 'Komşu sezonda da tekrarlıyor',
    tips_target: 'Müstahsilin hedefi bu bahçeyle doluyor',
    fresh_cut: 'Kesim taze, sahada görülebilir',
};
const LABEL_META: Record<CalibrationLabelValue, { label: string; tone: Tone }> = {
    pruned: { label: 'Budandı', tone: 'success' },
    partial: { label: 'Kısmen', tone: 'info' },
    not_pruned: { label: 'Budanmadı', tone: 'muted' },
    unsure: { label: 'Emin değilim', tone: 'warning' },
};
const LABEL_ORDER: CalibrationLabelValue[] = ['pruned', 'partial', 'not_pruned', 'unsure'];
const METHOD_LABEL: Record<CalibrationMethod, string> = { field_visit: 'Saha ziyareti', photo_desk: 'Fotoğraftan (masa başı)', producer_statement: 'Müstahsil beyanı' };
const PRECISION_ROWS: Array<{ key: 'confirmed' | 'probable' | 'light' | 'seasonal'; label: string }> = [
    { key: 'confirmed', label: 'Kesin' },
    { key: 'probable', label: 'Muhtemel' },
    { key: 'light', label: 'Hafif budama' },
    { key: 'seasonal', label: 'Mevsimsel desen' },
];

const toast = useToast();
const list = ref<Worklist | null>(null);
const isLoading = ref(true);
const page = ref(1);
const pendingOnly = ref(false);
const current = ref<WorklistRow | null>(null);
const isSaving = ref(false);
const form = ref<{ label: CalibrationLabelValue; method: CalibrationMethod; observedAt: string; prunedSharePct: number | undefined; note: string }>({ label: 'pruned', method: 'field_visit', observedAt: '', prunedSharePct: undefined, note: '' });
const sheetOpen = computed({
    get: () => current.value !== null,
    set: (open: boolean) => {
        if (!open) current.value = null;
    },
});
const pages = computed(() => Math.max(1, list.value?.meta.totalPages ?? 1));

function fmtDate(d: string | null | undefined): string {
    if (!d) return '—';
    return `${Number(d.slice(8, 10))} ${MONTHS_TR[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
}
const rateText = (r: WorklistRate) => (r.n ? `${r.hit} / ${r.n} (%${Math.round((r.hit / r.n) * 100)})` : 'henüz kayıt yok');

async function load(): Promise<void> {
    isLoading.value = true;
    const res = await api.getCombinedWorklist(props.areaId, { season: props.season, page: page.value, limit: PAGE_SIZE, pending: pendingOnly.value ? 'true' : undefined });
    isLoading.value = false;
    if (!res.data) {
        toast.error(res.error?.message ?? 'İş listesi alınamadı');
        return;
    }
    list.value = res.data;
}
function open(row: WorklistRow): void {
    current.value = row;
    form.value = {
        label: row.label?.label ?? 'pruned',
        method: (row.label?.method as CalibrationMethod | undefined) ?? 'field_visit',
        observedAt: row.label?.observedAt ?? new Date().toISOString().slice(0, 10),
        prunedSharePct: row.label?.prunedShare === null || row.label?.prunedShare === undefined ? undefined : Math.round(row.label.prunedShare * 100),
        note: row.label?.note ?? '',
    };
}
async function save(): Promise<void> {
    if (!current.value || !form.value.observedAt) return;
    isSaving.value = true;
    const share = form.value.label === 'partial' && typeof form.value.prunedSharePct === 'number' ? Math.min(1, Math.max(0, form.value.prunedSharePct / 100)) : undefined;
    const res = await api.saveCombinedLabel(props.areaId, {
        season: props.season,
        gardenCode: current.value.code,
        label: form.value.label,
        method: form.value.method,
        observedAt: form.value.observedAt,
        prunedShare: share,
        note: form.value.note.trim() || undefined,
    });
    isSaving.value = false;
    if (!res.data) {
        toast.error(res.error?.message ?? 'Kayıt saklanamadı');
        return;
    }
    toast.success(`${current.value.block}/${current.value.parcel} kaydedildi: ${LABEL_META[form.value.label].label}`);
    current.value = null;
    await load();
}
function onLabel(v: unknown): void {
    if (typeof v === 'string' && LABEL_ORDER.includes(v as CalibrationLabelValue)) form.value.label = v as CalibrationLabelValue;
}
function onMethod(v: unknown): void {
    if (typeof v === 'string' && v in METHOD_LABEL) form.value.method = v as CalibrationMethod;
}
watch(page, () => void load());
watch(pendingOnly, () => {
    page.value = 1;
    void load();
});
watch(
    () => [props.areaId, props.season],
    () => {
        page.value = 1;
        void load();
    },
    { immediate: true },
);
</script>

<template>
    <Card class="gap-0 py-0">
        <CardHeader class="py-4">
            <CardTitle>Eksper iş listesi</CardTitle>
            <CardDescription>
                Önce hangi bahçeye bakılmalı ve neden. Sıra, bahçenin kararı ne kadar şüpheli ve sonucu ne kadar etkiliyor olduğuna göre kurulur; listeye budama görülmeyen bahçelerden küçük bir kontrol örneği de girer, çünkü kaçırma oranı ancak böyle ölçülür.
                Girilen saha kaydı kararı değiştirmez; her sınıfın sahada ne kadar tuttuğunu ölçer.
                <template v-if="list">{{ list.listed }} bahçe listede, {{ list.pending }} bahçe kayıt bekliyor.</template>
            </CardDescription>
            <div class="flex items-center gap-2 pt-2"><Switch id="worklist-pending" v-model="pendingOnly" /><Label for="worklist-pending">Yalnız kayıt bekleyenler</Label></div>
        </CardHeader>
        <CardContent v-if="list" class="flex flex-col gap-2 border-t pt-4 pb-4">
            <div class="text-sm font-medium">Saha kayıtlarına göre doğruluk · {{ list.field.labelled }} kayıt</div>
            <div class="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
                <div v-for="r in PRECISION_ROWS" :key="r.key" class="rounded-lg border p-3">
                    <div class="text-xs text-muted-foreground">{{ r.label }} · sahada budama çıktı</div>
                    <div class="tabular-nums">{{ rateText(list.field.precision[r.key]) }}</div>
                </div>
                <div class="rounded-lg border p-3">
                    <div class="text-xs text-muted-foreground">Budama yok denen · sahada budama çıktı</div>
                    <div class="tabular-nums">{{ rateText(list.field.missed) }}</div>
                </div>
            </div>
            <p class="text-xs text-muted-foreground">“Emin değilim” kayıtları oranlara girmez. Mevsimsel desen satırında yüksek oran, sınamanın gerçek kesimleri elediğini gösterir.</p>
        </CardContent>
        <CardContent class="border-t px-0 pb-0">
            <LoadingState v-if="isLoading && !list" text="İş listesi yükleniyor…" class="p-6" />
            <p v-else-if="!list || list.data.length === 0" class="p-6 text-sm text-muted-foreground">Listede bahçe yok.</p>
            <div v-else class="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead class="text-right">Öncelik</TableHead>
                            <TableHead>Bahçe</TableHead>
                            <TableHead>Müstahsil</TableHead>
                            <TableHead>Karar</TableHead>
                            <TableHead>Neden bakılmalı</TableHead>
                            <TableHead>Saha kaydı</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow v-for="r in list.data" :key="r.code" class="cursor-pointer" tabindex="0" role="button" :aria-label="`${r.block}/${r.parcel} için saha kaydı gir`" @click="open(r)" @keydown.enter="open(r)">
                            <TableCell class="text-right font-semibold tabular-nums">{{ r.priority }}</TableCell>
                            <TableCell>
                                <div class="font-medium">{{ r.block }}/{{ r.parcel }}</div>
                                <div class="text-xs text-muted-foreground">{{ r.code }} · {{ r.locality || 'mevkii yok' }} · {{ formatM2(r.areaM2) }}</div>
                            </TableCell>
                            <TableCell class="text-sm">{{ r.producerName || r.producerCode || '—' }}</TableCell>
                            <TableCell>
                                <Badge :variant="toneVariant(CLASS_META[r.class].tone)">{{ CLASS_META[r.class].label }}</Badge>
                                <div v-if="r.bracket" class="mt-1 text-xs tabular-nums text-muted-foreground">{{ fmtDate(r.bracket.from) }} → {{ fmtDate(r.bracket.to) }}<template v-if="r.area"> · {{ formatM2(r.area.m2) }}</template></div>
                            </TableCell>
                            <TableCell>
                                <ul class="list-disc pl-4 text-sm">
                                    <li v-for="reason in r.reasons" :key="reason">{{ REASON_LABEL[reason] }}</li>
                                </ul>
                            </TableCell>
                            <TableCell>
                                <template v-if="r.label">
                                    <Badge :variant="toneVariant(LABEL_META[r.label.label].tone)">{{ LABEL_META[r.label.label].label }}</Badge>
                                    <div class="mt-1 text-xs text-muted-foreground">{{ fmtDate(r.label.observedAt) }} · {{ r.label.labelledBy }}</div>
                                </template>
                                <span v-else class="text-sm text-muted-foreground">bekliyor</span>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
            <div v-if="pages > 1" class="flex items-center justify-between border-t p-4">
                <span class="text-sm text-muted-foreground">Sayfa {{ page }} / {{ pages }}</span>
                <div class="flex gap-2">
                    <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page <= 1" aria-label="Önceki sayfa" @click="page--"><ChevronLeft aria-hidden="true" /></Button>
                    <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page >= pages" aria-label="Sonraki sayfa" @click="page++"><ChevronRight aria-hidden="true" /></Button>
                </div>
            </div>
        </CardContent>

        <Sheet v-model:open="sheetOpen">
            <SheetContent class="w-full overflow-y-auto sm:max-w-lg">
                <template v-if="current">
                    <SheetHeader class="border-b">
                        <SheetTitle>{{ current.block }}/{{ current.parcel }} · saha kaydı</SheetTitle>
                        <SheetDescription>{{ current.code }} · {{ current.producerName || current.producerCode }} · {{ formatM2(current.areaM2) }}</SheetDescription>
                        <div class="flex flex-wrap items-center gap-2"><Badge :variant="toneVariant(CLASS_META[current.class].tone)">{{ CLASS_META[current.class].label }}</Badge></div>
                    </SheetHeader>
                    <div class="flex flex-col gap-4 p-4 text-sm">
                        <p>{{ current.reason }}.</p>
                        <ul class="list-disc pl-4">
                            <li v-for="reason in current.reasons" :key="reason">{{ REASON_LABEL[reason] }}</li>
                        </ul>
                        <div class="flex flex-col gap-2">
                            <Label>Sahada ne gördünüz?</Label>
                            <Select :model-value="form.label" @update:model-value="onLabel">
                                <SelectTrigger class="h-11 w-full md:h-9" aria-label="Saha gözlemi"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="l in LABEL_ORDER" :key="l" :value="l">{{ LABEL_META[l].label }}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div class="grid gap-4 sm:grid-cols-2">
                            <div class="flex flex-col gap-2">
                                <Label for="worklist-date">Gözlem tarihi</Label>
                                <Input id="worklist-date" v-model="form.observedAt" type="date" class="h-11 md:h-9" />
                            </div>
                            <div v-if="form.label === 'partial'" class="flex flex-col gap-2">
                                <Label for="worklist-share">Budanan pay (%)</Label>
                                <Input id="worklist-share" v-model.number="form.prunedSharePct" type="number" min="0" max="100" step="5" class="h-11 md:h-9" placeholder="örn. 40" />
                            </div>
                        </div>
                        <div class="flex flex-col gap-2">
                            <Label>Nasıl bakıldı?</Label>
                            <Select :model-value="form.method" @update:model-value="onMethod">
                                <SelectTrigger class="h-11 w-full md:h-9" aria-label="Gözlem yöntemi"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="(label, key) in METHOD_LABEL" :key="key" :value="key">{{ label }}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div class="flex flex-col gap-2">
                            <Label for="worklist-note">Not</Label>
                            <Textarea id="worklist-note" v-model="form.note" rows="3" placeholder="Kesim yüksekliği, hangi bölüm, erişim durumu…" />
                        </div>
                        <Button class="h-11 md:h-9" :disabled="isSaving || !form.observedAt" @click="save">{{ isSaving ? 'Kaydediliyor…' : current.label ? 'Kaydı güncelle' : 'Kaydet' }}</Button>
                        <p class="text-xs text-muted-foreground">Fotoğraf ve konumla kayıt için aynı bahçeyi Kalibrasyon ekranından açabilirsiniz; kayıt aynı yerde tutulur.</p>
                    </div>
                </template>
            </SheetContent>
        </Sheet>
    </Card>
</template>
