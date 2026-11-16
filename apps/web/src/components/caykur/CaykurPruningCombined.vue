<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight, Combine } from '@lucide/vue';
import { EmptyState, LoadingState, StatCard } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toneVariant, type Tone } from '@/components/caykur/tone';
import CaykurPruningWorklist from '@/components/caykur/CaykurPruningWorklist.vue';
import { useToast } from '@/composables/useToast';
import {
    api,
    type CombinedAgreement,
    type CombinedClass,
    type CombinedClassFilter,
    type CombinedFollowUp,
    type CombinedGardenRow,
    type CombinedProducerFilter,
    type CombinedProducerRow,
    type CombinedProducerStatus,
    type CombinedRate,
    type CombinedSummary,
    type FollowUpCounts,
    type FollowUpStatus,
    type MultiYearStatus,
} from '@/services/api';
import { formatM2 } from '@/services/caykur/teaInventory';
import { formatNumber } from '@/services/caykur';

/**
 * Combined verdict (Birleşik karar): a separate module that reads the multi-sensor verdict and the pixel scan
 * and gives one verdict per garden. Confirmed = both saw the same cut; probable = one of them did; light = a
 * quickly recovering cut only the pixel scan saw (not credited toward the 1/7). Radar is a witness, never a judge.
 * It changes neither module, and purchase decisions stay with the multi-sensor module.
 */
const props = defineProps<{ areaId: string }>();

const PAGE_SIZE = 15;
const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const CLASS_META: Record<CombinedClass, { label: string; tone: Tone }> = {
    confirmed: { label: 'Yöntemler uyumlu', tone: 'success' },
    probable: { label: 'Muhtemel', tone: 'info' },
    light: { label: 'Hafif budama', tone: 'warning' },
    seasonal: { label: 'Mevsimsel desen', tone: 'muted' },
    none: { label: 'Budama yok', tone: 'muted' },
    no_data: { label: 'Veri yok', tone: 'muted' },
};
const AGREEMENT_LABEL: Record<CombinedAgreement, string> = {
    both: 'İki modül de gördü',
    both_other_dates: 'İkisi de gördü, tarihler ayrı',
    fusion_only: 'Yalnız çok-sensör',
    pixel_only: 'Yalnız piksel taraması',
    neither: 'Hiçbiri görmedi',
};
const STATUS_META: Record<CombinedProducerStatus, { label: string; tone: Tone }> = {
    met: { label: 'Desteklenen alt alan hedefe ulaşıyor', tone: 'success' },
    met_with_probable: { label: 'Muhtemel alan eklenirse hedefe ulaşır', tone: 'info' },
    partial: { label: 'Budama var, hedef dolmadı', tone: 'warning' },
    light_only: { label: 'Yalnız hafif budama', tone: 'muted' },
    none: { label: 'Budama görülmedi', tone: 'muted' },
    no_license: { label: 'Ruhsatlı alan yok', tone: 'muted' },
};
const SOURCE_LABEL: Record<'pixel_scan' | 'change_patch' | 'ndvi_fraction', string> = {
    pixel_scan: 'piksel kümesi',
    change_patch: 'optik yama',
    ndvi_fraction: 'NDVI payı',
};
const FUSION_LABEL: Record<string, string> = { pruned: 'budandı', likely: 'olası', unclear: 'belirsiz', not_pruned: 'budama yok', no_data: 'veri yok' };
const PIXEL_LABEL: Record<string, string> = { deep: 'derin budama', light: 'hafif budama', pending: 'sınıf bekliyor', transient: 'geçici düşüş', weak: 'zayıf sinyal', none: 'değişim yok', no_data: 'veri yok' };
const DECISION_LABEL: Record<string, string> = { auto_open: 'alım açık', auto_pending: 'bekliyor', auto_short: 'eksik', auto_none: 'görülmedi', expert_anomaly: 'eksper', no_license: 'ruhsat yok', no_data: 'veri yok' };
const GARDEN_FILTERS: Array<{ value: CombinedClassFilter; label: string }> = [
    { value: 'positive', label: 'Budama görülen bahçeler (uyumlu + muhtemel + hafif)' },
    { value: 'counted', label: 'Hedef senaryosuna girenler (derin kesimler)' },
    { value: 'confirmed', label: 'Yöntemler uyumlu' },
    { value: 'probable', label: 'Muhtemel' },
    { value: 'light', label: 'Hafif budama' },
    { value: 'seasonal', label: 'Mevsimsel desen (önceki sezonda da aynı düşüş)' },
    { value: 'none', label: 'Budama yok' },
    { value: 'doubtful', label: 'Geriye dönük sınamada budama gibi davranmayanlar' },
    { value: 'recent', label: 'Son 35 günde görülen kesimler' },
];
const PRODUCER_FILTERS: Array<{ value: CombinedProducerFilter; label: string }> = [
    { value: 'active', label: 'Budama görülen müstahsiller' },
    { value: 'open', label: 'Hedefe ulaşan veya muhtemelle ulaşabilecekler' },
    { value: 'changed', label: 'Çok-sensör alım kararından farklı çıkanlar' },
    { value: 'partial', label: 'Budama var, hedef dolmadı' },
    { value: 'light_only', label: 'Yalnız hafif budama' },
    { value: 'none', label: 'Budama görülmedi' },
    { value: 'behind', label: 'Birikimli hedefin gerisinde kalanlar' },
];
/** Retrospective check outcomes, in the order the table shows them. */
const FOLLOW_UP_META: Record<FollowUpStatus, { label: string; tone: Tone; hint: string }> = {
    pattern: { label: 'Budama deseni', tone: 'success', hint: 'düşüş bir yıl sonra kapanmış, komşu sezonda tekrarlamıyor' },
    slow: { label: 'Yavaş kapanıyor', tone: 'info', hint: 'bir yıl sonra kısmen kapanmış' },
    permanent: { label: 'Kalıcı değişim', tone: 'danger', hint: 'bir yıl sonra hâlâ kapanmamış; söküm, yapılaşma ya da örtü değişimi olabilir' },
    repeating: { label: 'Her yıl tekrarlıyor', tone: 'warning', hint: 'aynı piksellerde, aynı dönemde komşu sezonda da benzer düşüş var' },
    not_seen: { label: 'Düz seride görülmedi', tone: 'muted', hint: 'mevsimsel taban olmadan bakıldığında düşüş ayırt edilmiyor' },
    no_followup: { label: 'Sonrası henüz yok', tone: 'muted', hint: 'bir yıl sonrası henüz gözlenmedi' },
};
const FOLLOW_UP_ORDER: FollowUpStatus[] = ['pattern', 'slow', 'permanent', 'repeating', 'not_seen', 'no_followup'];
const MULTI_YEAR_META: Record<MultiYearStatus, { label: string; tone: Tone }> = {
    on_track: { label: 'hedefinde', tone: 'success' },
    behind: { label: 'geride', tone: 'warning' },
    none: { label: 'sayılan alan yok', tone: 'muted' },
    no_license: { label: 'ruhsat yok', tone: 'muted' },
};
const VALIDATION_ROWS: Record<string, string> = {
    confirmed_low: 'Yöntemler uyumlu · alt sınır',
    confirmed_high: 'Yöntemler uyumlu · üst sınır',
    counted_low: 'Yöntemler uyumlu + muhtemel · alt sınır',
    counted_high: 'Yöntemler uyumlu + muhtemel · üst sınır',
    light: 'Hafif sınıfına düşen',
    seasonal: 'Mevsimsel desene ayrılan (kayıp)',
    any: 'Herhangi bir sınıf',
};

const toast = useToast();
const summary = ref<CombinedSummary | null>(null);
const isLoading = ref(true);
const season = ref<string | undefined>(undefined);
const view = ref<'gardens' | 'producers' | 'worklist'>('gardens');

const gardenFilter = ref<CombinedClassFilter>('positive');
const gardens = ref<CombinedGardenRow[]>([]);
const gardenPage = ref(1);
const gardenPages = ref(1);
const gardenTotal = ref(0);
const isLoadingGardens = ref(false);

const producerFilter = ref<CombinedProducerFilter>('active');
const producers = ref<CombinedProducerRow[]>([]);
const producerPage = ref(1);
const producerPages = ref(1);
const producerTotal = ref(0);
const isLoadingProducers = ref(false);

const selected = ref<CombinedGardenRow | null>(null);
const sheetOpen = computed({
    get: () => selected.value !== null,
    set: (open: boolean) => {
        if (!open) selected.value = null;
    },
});

function fmtDate(d: string | null | undefined): string {
    if (!d) return '—';
    return `${Number(d.slice(8, 10))} ${MONTHS_TR[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
}
function seasonLabel(s: string | undefined): string {
    if (!s) return '';
    const [a, b] = s.split('-');
    return `${a}–20${b}`;
}
const rateText = (r: CombinedRate) => (r.n ? `${r.hit} / ${r.n} (%${Math.round((r.hit / r.n) * 100)})` : '—');
const fmtZ = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toFixed(1));
const positives = computed(() => (summary.value ? summary.value.summary.byClass.confirmed + summary.value.summary.byClass.probable + summary.value.summary.byClass.light : 0));
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `%${Math.round(v * 100)}`);
/** Rows of the retrospective table: the three classes, then the mirrored (false) detections the same check was run on. */
const followUpRows = computed<Array<{ key: string; label: string; counts: FollowUpCounts; muted: boolean }>>(() => {
    const h = summary.value?.history?.season;
    if (!h) return [];
    const rows = [
        { key: 'confirmed', label: 'Yöntemler uyumlu', counts: h.byClass.confirmed, muted: false },
        { key: 'probable', label: 'Muhtemel', counts: h.byClass.probable, muted: false },
        { key: 'light', label: 'Hafif budama', counts: h.byClass.light, muted: false },
    ];
    if (h.byClass.seasonal) rows.push({ key: 'seasonal', label: 'Mevsimsel desen (1/7 dışında)', counts: h.byClass.seasonal, muted: true });
    if (h.mirror) {
        rows.push({ key: 'mirror-pixel', label: 'Ayna testi · piksel taramasının sahte tespitleri', counts: h.mirror.pixel, muted: true });
        rows.push({ key: 'mirror-fusion', label: 'Ayna testi · çok-sensörün sahte tespitleri', counts: h.mirror.fusion, muted: true });
    }
    return rows;
});
function followUpText(f: CombinedFollowUp): string {
    const parts = [FOLLOW_UP_META[f.status].hint];
    if (f.drop !== null) parts.push(`göreli NDVI düşüşü ${f.drop.toFixed(2)}`);
    if (f.recoveredShare !== null) parts.push(`bir yıl sonra düşüşün ${pct(Math.max(0, Math.min(1, f.recoveredShare)))} kadarı kapanmış`);
    parts.push(f.unit === 'cluster' ? `${f.pixels} piksellik küme, bahçenin kalanına göre` : `bahçenin ${f.pixels} pikseli, mahalledeki çaya göre`);
    return parts.join(' · ');
}

async function loadSummary(): Promise<void> {
    isLoading.value = true;
    const res = await api.getCombinedSummary(props.areaId, season.value);
    isLoading.value = false;
    summary.value = res.data ?? null;
    if (res.data) {
        season.value = res.data.season;
        await Promise.all([loadGardens(), loadProducers()]);
    }
}
async function loadGardens(): Promise<void> {
    isLoadingGardens.value = true;
    const res = await api.getCombinedGardens(props.areaId, { page: gardenPage.value, limit: PAGE_SIZE, season: summary.value?.season, class: gardenFilter.value });
    isLoadingGardens.value = false;
    if (!res.data) {
        toast.error(res.error?.message ?? 'Bahçe listesi alınamadı');
        return;
    }
    gardens.value = res.data.data;
    gardenTotal.value = res.data.meta.total;
    gardenPages.value = Math.max(1, res.data.meta.totalPages);
}
async function loadProducers(): Promise<void> {
    isLoadingProducers.value = true;
    const res = await api.getCombinedProducers(props.areaId, { page: producerPage.value, limit: PAGE_SIZE, season: summary.value?.season, status: producerFilter.value });
    isLoadingProducers.value = false;
    if (!res.data) {
        toast.error(res.error?.message ?? 'Müstahsil listesi alınamadı');
        return;
    }
    producers.value = res.data.data;
    producerTotal.value = res.data.meta.total;
    producerPages.value = Math.max(1, res.data.meta.totalPages);
}
watch(gardenFilter, () => {
    gardenPage.value = 1;
    void loadGardens();
});
watch(producerFilter, () => {
    producerPage.value = 1;
    void loadProducers();
});
watch(gardenPage, () => void loadGardens());
watch(producerPage, () => void loadProducers());
watch(
    () => props.areaId,
    () => {
        season.value = undefined;
        void loadSummary();
    },
    { immediate: true },
);
function onSeason(v: unknown): void {
    if (typeof v !== 'string' || v === season.value || !summary.value?.seasons.includes(v)) return;
    season.value = v;
    selected.value = null;
    gardenPage.value = 1;
    producerPage.value = 1;
    void loadSummary();
}
function onGardenFilter(v: unknown): void {
    if (typeof v === 'string' && GARDEN_FILTERS.some((f) => f.value === v)) gardenFilter.value = v as CombinedClassFilter;
}
function onProducerFilter(v: unknown): void {
    if (typeof v === 'string' && PRODUCER_FILTERS.some((f) => f.value === v)) producerFilter.value = v as CombinedProducerFilter;
}
function onView(v: unknown): void {
    if (v === 'gardens' || v === 'producers' || v === 'worklist') view.value = v;
}
</script>

<template>
    <div class="flex flex-col gap-6">
        <LoadingState v-if="isLoading" text="Birleşik karar yükleniyor…" />
        <EmptyState v-else-if="!summary" :icon="Combine" title="Bu mahalle için birleşik karar yok" description="Motor tarafında combine-pruning çalıştırıldığında burada görünür: çok-sensör karar ile piksel taraması bahçe başına tek karara indirilir." />
        <template v-else>
            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle class="flex flex-wrap items-center gap-2">Birleşik karar <Badge variant="warning">Ön değerlendirme</Badge></CardTitle>
                    <CardDescription>DEMO ruhsat kayıtları · Ön değerlendirme; idari karar değildir. Yöntemler aynı görüntüleri paylaşabilir; uyuşmaları bağımsız doğrulama değildir.</CardDescription>
                    <details class="text-sm"><summary class="min-h-11 cursor-pointer py-3">Yöntem ve hedef hesabı</summary><p>Uyumlu: çok-sensör karar ve piksel taraması aynı kesimi gördü (değişim tarihleri {{ summary.rules.sameEventDays }} gün içinde). Muhtemel: yalnız biri gördü ya da tarihleri ayrı. Yalnız piksel taramasının gördüğü hafif kesimler ve toparlanması henüz izlenemeyen kesimler hedef hesabına girmez. Mevsimsel tekrar sınaması “muhtemel” sonuçlara uygulanır. Sayılan alan piksel kümesinin alanıdır; önceki yedi sezonda sayılmış zemin düşülür. Kuralın yanlış alarm ve yakalama oranları aşağıdaki model davranış testlerinde ölçülmüştür. Alım kararı bu tablodan çıkmaz.</p></details>
                    <div v-if="summary.seasons.length > 1" class="flex flex-wrap items-center gap-3 pt-2">
                        <span class="text-sm text-muted-foreground">Sezon</span>
                        <Select :model-value="summary.season" @update:model-value="onSeason">
                            <SelectTrigger class="h-11 w-44 md:h-9" aria-label="Budama sezonu"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="s in summary.seasons" :key="s" :value="s">{{ seasonLabel(s) }}{{ s === summary.liveSeason ? ' · devam ediyor' : '' }}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <p v-else class="pt-2 text-sm text-muted-foreground">Sezon {{ seasonLabel(summary.season) }}</p>
                </CardHeader>
            </Card>

            <Card v-if="summary.inProgress" class="gap-0 border-warning py-0">
                <CardHeader class="py-4">
                    <CardTitle class="flex flex-wrap items-center gap-2">Devam eden sezon <Badge variant="warning">Ara sonuç</Badge></CardTitle>
                    <CardDescription>
                        Sezon sürüyor; son kullanılabilir görüntü {{ fmtDate(summary.dataThrough) }}. Şimdilik yalnız piksel taraması konuşuyor: çok-sensör karar sezon bitince eklenir, o yüzden “uyumlu” sınıfı henüz oluşamaz ve görülen kesimler “muhtemel” olarak listelenir.
                        Kesimin derin mi hafif mi olduğu toparlanma izlenmeden bilinemez; bu sayılar yeni görüntü geldikçe değişir.
                        <template v-if="summary.liveFalseAlarms !== null && summary.liveFalseAlarms !== undefined">Aynı görüntülerde ayna testi {{ summary.liveFalseAlarms }} sahte tespit veriyor (üst sınır); listedeki {{ positives }} tespitin bir kısmı gerçek olmayabilir, saha kontrolü bu yüzden önemli.</template>
                        Alım kararı için kullanılmaz.
                    </CardDescription>
                </CardHeader>
            </Card>

            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Yöntemler uyumlu" :value="formatNumber(summary.summary.byClass.confirmed)" :hint="`bahçe · ${formatM2(summary.summary.areaM2.confirmed)} · iki modül de gördü`" :icon="Combine" />
                <StatCard label="Muhtemel" :value="formatNumber(summary.summary.byClass.probable)" :hint="`bahçe · ${formatM2(summary.summary.areaM2.probable)} · yalnız çok-sensör ${summary.summary.byAgreement.fusion_only}, tür ve tarih uyuşmazlıkları ayrıntıda, tarihi ayrı ${summary.summary.byAgreement.both_other_dates}`" />
                <StatCard label="Hafif budama" :value="formatNumber(summary.summary.byClass.light)" :hint="`bahçe · ${formatM2(summary.summary.areaM2.light)} · 1/7 hesabına girmez · ayrıca ${summary.summary.byClass.seasonal ?? 0} bahçe mevsimsel desen`" />
                <StatCard label="Hedefe ulaşan müstahsil" :value="formatNumber(summary.summary.producers.met + summary.summary.producers.met_with_probable)" :hint="`${summary.summary.producers.met} uyumlu alanla · ${summary.summary.producers.met_with_probable} muhtemel alanla · ${summary.summary.producersChanged} müstahsilde çok-sensör alım kararından farklı`" />
            </div>

            <details v-if="summary.validation" class="rounded-lg border p-3"><summary class="min-h-11 cursor-pointer py-3 text-sm font-medium">Model davranış testleri · ayrıntılar</summary><Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Model davranış testleri (saha verisi olmadan)</CardTitle>
                    <CardDescription>
                        Yanlış alarm üst sınırı, {{ summary.validation.gardens }} bahçede: uyumlu {{ summary.validation.falseAlarms.confirmed }}, muhtemel {{ summary.validation.falseAlarms.probable }}, hafif {{ summary.validation.falseAlarms.light }}<template v-if="summary.validation.falseAlarms.seasonal !== undefined">; {{ summary.validation.falseAlarms.seasonal }} sahte tespit mevsimsel desen sınamasıyla ayıklandı</template>.
                        Gerçek çalışmada uyumlu {{ summary.summary.byClass.confirmed }}, muhtemel {{ summary.summary.byClass.probable }}, hafif {{ summary.summary.byClass.light }} bahçe var.
                        {{ summary.validation.falseAlarms.note }}
                    </CardDescription>
                </CardHeader>
                <CardContent class="flex flex-col gap-3 border-t pt-4 pb-4">
                    <div class="overflow-x-auto rounded-lg border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Yakalama oranı ({{ summary.validation.detection.trials }} sentetik kesim)</TableHead>
                                    <TableHead class="text-right">Tümü</TableHead>
                                    <TableHead class="text-right">Derin kesim</TableHead>
                                    <TableHead class="text-right">Hafif kesim</TableHead>
                                    <TableHead class="text-right">≥ 3 piksel, ≥ 0,15</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="r in summary.validation.detection.rows" :key="r.key">
                                    <TableCell class="font-medium">{{ VALIDATION_ROWS[r.key] ?? r.key }}</TableCell>
                                    <TableCell class="text-right text-sm tabular-nums">{{ rateText(r.overall) }}</TableCell>
                                    <TableCell class="text-right text-sm tabular-nums">{{ rateText(r.deep) }}</TableCell>
                                    <TableCell class="text-right text-sm tabular-nums">{{ rateText(r.light) }}</TableCell>
                                    <TableCell class="text-right text-sm tabular-nums">{{ rateText(r.clear) }}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <p class="text-xs text-muted-foreground">{{ summary.validation.detection.note }} Bu sayılar gerçek saha doğrulamasının yerini tutmaz; Saha Testi vakaları geldikçe onunla değiştirilecek.</p>
                </CardContent>
            </Card></details>

            <details v-if="summary.history?.season" class="rounded-lg border p-3"><summary class="min-h-11 cursor-pointer py-3 text-sm font-medium">Geriye dönük sınama · ayrıntılar</summary><Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Geriye dönük sınama · komşu sezonlarla</CardTitle>
                    <CardDescription>
                        Her tespit, kararında kullanılmamış olan komşu sezonların piksel serisinde izlenir: düşüş bir yıl sonra kapanmış mı, aynı pikseller aynı dönemde başka bir sezonda da düşüyor mu.
                        Aynı sınama ayna testinin sahte tespitlerine de uygulanır; sahte tespitlerin ne kadarının geçtiği bilinmeden gerçek tespitlerin geçme oranı bir şey söylemez.
                        <template v-if="!summary.history.season.hasFollowUp">Bu sezonun bir yıl sonrası henüz tam gözlenmedi; erken kesimler dışında şimdilik yalnızca önceki sezonla tekrarlama sınaması yapılabiliyor.</template>
                    </CardDescription>
                </CardHeader>
                <CardContent class="flex flex-col gap-3 border-t pt-4 pb-4">
                    <div class="overflow-x-auto rounded-lg border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tespit</TableHead>
                                    <TableHead v-for="k in FOLLOW_UP_ORDER" :key="k" class="text-right">{{ FOLLOW_UP_META[k].label }}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="r in followUpRows" :key="r.key" :class="r.muted ? 'text-muted-foreground' : ''">
                                    <TableCell :class="r.muted ? '' : 'font-medium'">{{ r.label }}</TableCell>
                                    <TableCell v-for="k in FOLLOW_UP_ORDER" :key="k" class="text-right text-sm tabular-nums">{{ r.counts[k] || '—' }}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <p v-if="summary.history.season.hasFollowUp" class="text-sm">
                        1/7 hesabına giren tespitlerin {{ summary.history.season.real.counted.pattern }} / {{ summary.history.season.real.counted.evaluated }} kadarı ({{ pct(summary.history.season.real.counted.share) }}) budama deseni gösterdi.
                        <template v-if="summary.history.season.falsePassRate">Ayna testinin sahte tespitlerinde aynı oran {{ summary.history.season.falsePassRate.pattern }} / {{ summary.history.season.falsePassRate.evaluated }} ({{ pct(summary.history.season.falsePassRate.share) }}).</template>
                        <template v-if="summary.history.season.precisionFloor !== null"> Bu iki orandan çıkan gerçek tespit payının alt sınırı {{ pct(summary.history.season.precisionFloor) }}.</template>
                        <template v-else> Sayılar bir alt sınır hesaplamaya yetmiyor.</template>
                    </p>
                    <p class="text-sm">
                        Çok yıllı tutarlılık ({{ summary.history.multiYear.seasons.map(seasonLabel).join(', ') }}): {{ summary.history.multiYear.gardensRepeated }} bahçede aynı zemin iki sezonda sayıldı ({{ formatM2(summary.history.multiYear.repeatedM2) }}); 1/7 kuralında aynı zemin üst üste derin budanmaz, bu alan birikimli hesaptan düşülür.
                        Birikimli hedefe göre müstahsil: {{ summary.history.multiYear.producers.on_track }} hedefinde, {{ summary.history.multiYear.producers.behind }} geride, {{ summary.history.multiYear.producers.none }} müstahsilde sayılan alan yok.
                    </p>
                    <p class="text-xs text-muted-foreground">Sınama kararları değiştirmez; eksperin önce bakacağı bahçeleri gösterir. “Kalıcı değişim” ve “her yıl tekrarlıyor” çıkan tespitler budama gibi davranmıyor. Saha doğrulamasının yerini tutmaz.</p>
                </CardContent>
            </Card></details>

            <div class="flex flex-wrap items-center gap-3">
                <span class="text-sm text-muted-foreground">Görünüm</span>
                <ToggleGroup :model-value="view" type="single" aria-label="Birleşik karar görünümü" @update:model-value="onView">
                    <ToggleGroupItem value="gardens" class="h-11 px-3 md:h-9">Bahçeler</ToggleGroupItem>
                    <ToggleGroupItem value="producers" class="h-11 px-3 md:h-9">Müstahsiller (1/7 karşılaştırması)</ToggleGroupItem>
                    <ToggleGroupItem value="worklist" class="h-11 px-3 md:h-9">Eksper iş listesi</ToggleGroupItem>
                </ToggleGroup>
            </div>

            <Card v-if="view === 'gardens'" class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Bahçeler</CardTitle>
                    <CardDescription>{{ formatNumber(gardenTotal) }} bahçe · toplam {{ formatNumber(positives) }} bahçede budama görüldü · satıra tıklayınca iki modülün bulguları</CardDescription>
                    <div class="pt-2">
                        <Select :model-value="gardenFilter" @update:model-value="onGardenFilter">
                            <SelectTrigger class="h-11 w-full sm:w-96 md:h-9" aria-label="Birleşik karar filtresi"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="f in GARDEN_FILTERS" :key="f.value" :value="f.value">{{ f.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent class="border-t px-0 pb-0">
                    <LoadingState v-if="isLoadingGardens && gardens.length === 0" text="Bahçeler yükleniyor…" class="p-6" />
                    <p v-else-if="gardens.length === 0" class="p-6 text-sm text-muted-foreground">Bu filtreye uyan bahçe yok.</p>
                    <div v-else class="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Bahçe</TableHead>
                                    <TableHead>Müstahsil</TableHead>
                                    <TableHead>Birleşik karar</TableHead>
                                    <TableHead>Dayanak</TableHead>
                                    <TableHead>Kesim aralığı</TableHead>
                                    <TableHead class="text-right">Budanan alan</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="r in gardens" :key="r.code" class="cursor-pointer" tabindex="0" role="button" :aria-label="`${r.block}/${r.parcel} bahçesinin dayanaklarını aç`" @click="selected = r" @keydown.enter="selected = r">
                                    <TableCell>
                                        <div class="font-medium">{{ r.block }}/{{ r.parcel }}</div>
                                        <div class="text-xs text-muted-foreground">{{ r.code }} · {{ formatM2(r.areaM2) }}</div>
                                    </TableCell>
                                    <TableCell class="text-sm">{{ r.producerName || r.producerCode || '—' }}</TableCell>
                                    <TableCell>
                                        <Badge :variant="toneVariant(CLASS_META[r.class].tone)">{{ CLASS_META[r.class].label }}</Badge>
                                        <Badge v-if="r.radar?.witness" variant="outline" class="ml-1">Radar tanığı</Badge>
                                        <div v-if="(r.followUp && r.followUp.status !== 'no_followup') || r.repeatedGround.length" class="mt-1 flex flex-wrap gap-1">
                                            <Badge v-if="r.followUp && r.followUp.status !== 'no_followup'" :variant="toneVariant(FOLLOW_UP_META[r.followUp.status].tone)">{{ FOLLOW_UP_META[r.followUp.status].label }}</Badge>
                                            <Badge v-if="r.repeatedGround.length" variant="warning">Zemin iki sezonda sayıldı</Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell class="text-sm">{{ AGREEMENT_LABEL[r.agreement] }}</TableCell>
                                    <TableCell class="text-sm tabular-nums">{{ r.bracket ? `${fmtDate(r.bracket.from)} → ${fmtDate(r.bracket.to)}` : '—' }}</TableCell>
                                    <TableCell class="text-right text-sm tabular-nums">
                                        <span class="font-semibold">{{ r.area ? formatM2(r.area.m2) : '—' }}</span>
                                        <div v-if="r.area" class="text-xs text-muted-foreground">{{ r.area.lowM2 }}–{{ r.area.highM2 }} m² · {{ SOURCE_LABEL[r.area.source] }}</div>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <div v-if="gardenPages > 1" class="flex items-center justify-between border-t p-4">
                        <span class="text-sm text-muted-foreground">Sayfa {{ gardenPage }} / {{ gardenPages }}</span>
                        <div class="flex gap-2">
                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="gardenPage <= 1" aria-label="Önceki sayfa" @click="gardenPage--"><ChevronLeft aria-hidden="true" /></Button>
                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="gardenPage >= gardenPages" aria-label="Sonraki sayfa" @click="gardenPage++"><ChevronRight aria-hidden="true" /></Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <CaykurPruningWorklist v-else-if="view === 'worklist'" :area-id="areaId" :season="summary.season" />

            <Card v-else class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Müstahsiller · 1/{{ summary.rules.pruningRatio }} karşılaştırması</CardTitle>
                    <CardDescription>{{ formatNumber(producerTotal) }} müstahsil · desteklenen alt alan ve muhtemel ilave ayrı gösterilir. Hafif ve bekleyen kesim sayılmaz. Alım kararı değildir.</CardDescription>
                    <div class="pt-2">
                        <Select :model-value="producerFilter" @update:model-value="onProducerFilter">
                            <SelectTrigger class="h-11 w-full sm:w-96 md:h-9" aria-label="Müstahsil durumu filtresi"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="f in PRODUCER_FILTERS" :key="f.value" :value="f.value">{{ f.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent class="border-t px-0 pb-0">
                    <LoadingState v-if="isLoadingProducers && producers.length === 0" text="Müstahsiller yükleniyor…" class="p-6" />
                    <p v-else-if="producers.length === 0" class="p-6 text-sm text-muted-foreground">Bu filtreye uyan müstahsil yok.</p>
                    <div v-else class="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Müstahsil</TableHead>
                                    <TableHead>Birleşik durum</TableHead>
                                    <TableHead>Çok-sensör alım kararı</TableHead>
                                    <TableHead class="text-right">Hedef</TableHead>
                                    <TableHead class="text-right">Desteklenen alt alan</TableHead>
                                    <TableHead class="text-right">Muhtemel</TableHead>
                                    <TableHead class="text-right">Hafif</TableHead>
                                    <TableHead class="text-right">Desteklenen alanla eksik</TableHead><TableHead class="text-right">Muhtemel eklenirse eksik</TableHead>
                                    <TableHead v-if="summary.history" class="text-right">Birikimli ({{ summary.history.multiYear.seasons.length }} sezon)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="p in producers" :key="p.code">
                                    <TableCell>
                                        <div class="font-medium">{{ p.name || p.code }}</div>
                                        <div class="text-xs text-muted-foreground">{{ p.code }} · {{ p.gardens }} bahçe · ruhsatlı {{ formatM2(p.licensedAreaM2) }}</div>
                                    </TableCell>
                                    <TableCell><Badge :variant="toneVariant(STATUS_META[p.status].tone)">{{ STATUS_META[p.status].label }}</Badge></TableCell>
                                    <TableCell class="text-sm">{{ p.fusionDecision ? (DECISION_LABEL[p.fusionDecision] ?? p.fusionDecision) : '—' }}</TableCell>
                                    <TableCell class="text-right text-sm tabular-nums">{{ formatM2(p.requiredM2) }}</TableCell>
                                    <TableCell class="text-right text-sm font-semibold tabular-nums">{{ p.confirmedM2 ? formatM2(p.confirmedM2) : '—' }}</TableCell>
                                    <TableCell class="text-right text-sm tabular-nums">{{ p.probableM2 ? formatM2(p.probableM2) : '—' }}</TableCell>
                                    <TableCell class="text-right text-sm tabular-nums text-muted-foreground">{{ p.lightM2 ? formatM2(p.lightM2) : '—' }}</TableCell>
                                    <TableCell class="text-right text-sm tabular-nums">{{ formatM2(Math.max(0, p.requiredM2 - p.confirmedM2)) }}</TableCell><TableCell class="text-right text-sm tabular-nums">{{ p.shortfallM2 ? formatM2(p.shortfallM2) : '—' }}</TableCell>
                                    <TableCell v-if="summary.history" class="text-right text-sm tabular-nums">
                                        <template v-if="p.multiYear">
                                            <span class="font-semibold">{{ formatM2(p.multiYear.netM2) }}</span> / {{ formatM2(p.multiYear.requiredM2) }}
                                            <div class="text-xs text-muted-foreground">
                                                <Badge :variant="toneVariant(MULTI_YEAR_META[p.multiYear.status].tone)">{{ MULTI_YEAR_META[p.multiYear.status].label }}</Badge>
                                                <span v-if="p.multiYear.repeatedM2"> · {{ formatM2(p.multiYear.repeatedM2) }} tekrar düşüldü</span>
                                            </div>
                                        </template>
                                        <template v-else>—</template>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <div v-if="producerPages > 1" class="flex items-center justify-between border-t p-4">
                        <span class="text-sm text-muted-foreground">Sayfa {{ producerPage }} / {{ producerPages }}</span>
                        <div class="flex gap-2">
                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="producerPage <= 1" aria-label="Önceki sayfa" @click="producerPage--"><ChevronLeft aria-hidden="true" /></Button>
                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="producerPage >= producerPages" aria-label="Sonraki sayfa" @click="producerPage++"><ChevronRight aria-hidden="true" /></Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </template>

        <Sheet v-model:open="sheetOpen">
            <SheetContent class="w-full overflow-y-auto sm:max-w-xl">
                <template v-if="selected">
                    <SheetHeader class="border-b">
                        <SheetTitle>{{ selected.block }}/{{ selected.parcel }} · {{ selected.producerName || selected.producerCode }}</SheetTitle>
                        <SheetDescription>{{ selected.code }} · {{ selected.locality || 'mevkii yok' }} · {{ formatM2(selected.areaM2) }}</SheetDescription>
                        <div class="flex flex-wrap items-center gap-2">
                            <Badge :variant="toneVariant(CLASS_META[selected.class].tone)">{{ CLASS_META[selected.class].label }}</Badge>
                            <Badge variant="outline">{{ AGREEMENT_LABEL[selected.agreement] }}</Badge>
                            <Badge v-if="selected.radar?.witness" variant="outline">Radar tanığı</Badge>
                        </div>
                    </SheetHeader>
                    <div class="flex flex-col gap-4 p-4 text-sm">
                        <p>{{ selected.reason }}.</p>
                        <div class="rounded-lg border bg-muted/40 p-3">
                            <div class="font-medium">Budanan alan {{ selected.area ? `≈ ${formatM2(selected.area.m2)}` : '—' }}</div>
                            <p v-if="selected.repeatExclusion?.excludedM2" class="text-sm text-warning">Kayıtlı önceki sezonlarla aynı piksel hücreleri: ek {{ formatM2(selected.repeatExclusion.excludedM2) }} hedef hesabından çıkarıldı. Hücre içindeki kesim konumu bilinmediği için ihtiyatlı sınırdır.</p>
                            <p v-if="selected.repeatExclusion && !selected.repeatExclusion.checked" class="text-xs text-muted-foreground">Piksel bazlı tekrar kontrolü yapılamadı; mevcut çok sensör tekrar bilgisi kullanıldı.</p>
                            <p v-if="selected.pixel?.verdict === 'pending'" class="text-sm text-warning">Toparlanma bekleniyor; hedef hesabına alan eklenmedi.</p>
                            <p v-if="selected.kind === 'light'" class="text-sm">Hafif kesim göstergesi; derin budama hedef alanına eklenmedi.</p>
                            <div v-if="selected.area" class="text-xs text-muted-foreground">Aralık {{ formatM2(selected.area.lowM2) }} – {{ formatM2(selected.area.highM2) }} · kaynak: {{ SOURCE_LABEL[selected.area.source] }} · hedef senaryosundaki alan {{ formatM2(selected.countedM2) }}</div>
                            <div class="text-xs text-muted-foreground">Kesim aralığı: {{ selected.bracket ? `${fmtDate(selected.bracket.from)} → ${fmtDate(selected.bracket.to)}` : '—' }}</div>
                        </div>
                        <div v-if="selected.seasonal" class="rounded-lg border p-3">
                            <div class="font-medium">Mevsimsel desen sınaması · {{ selected.seasonal.repeat === true ? 'önceki sezonda da var' : selected.seasonal.repeat === false ? 'önceki sezonda yok' : 'sınanamadı' }}</div>
                            <div class="text-xs text-muted-foreground">
                                {{ selected.seasonal.unit === 'cluster' ? 'Piksel kümesi, bahçenin kalanına göre' : 'Bahçenin tamamı, mahalledeki çaya göre' }} ·
                                bu sezonki göreli NDVI düşüşü {{ selected.seasonal.drop === null ? '—' : selected.seasonal.drop.toFixed(2) }} ·
                                bir önceki sezonun aynı dönemi {{ selected.seasonal.prevStep === null ? '—' : selected.seasonal.prevStep.toFixed(2) }}.
                                Önceki sezondaki düşüş bu sezonkinin en az %{{ Math.round((summary?.rules.seasonalRepeatShare ?? 0.6) * 100) }} kadarıysa tespit mevsimsel desen sayılır.
                            </div>
                        </div>
                        <div v-if="selected.followUp || selected.repeatedGround.length" class="rounded-lg border p-3">
                            <div class="flex flex-wrap items-center gap-2 font-medium">
                                Geriye dönük sınama
                                <Badge v-if="selected.followUp" :variant="toneVariant(FOLLOW_UP_META[selected.followUp.status].tone)">{{ FOLLOW_UP_META[selected.followUp.status].label }}</Badge>
                            </div>
                            <div v-if="selected.followUp" class="text-xs text-muted-foreground">{{ followUpText(selected.followUp) }}</div>
                            <div v-for="g in selected.repeatedGround" :key="g.a + g.b" class="text-xs text-muted-foreground">
                                Aynı zemin {{ seasonLabel(g.a) }} ve {{ seasonLabel(g.b) }} sezonlarında sayıldı: piksellerin {{ pct(g.share) }} kadarı ortak, ≈ {{ formatM2(g.m2) }}.
                            </div>
                        </div>
                        <div class="overflow-x-auto rounded-lg border bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Modül</TableHead>
                                        <TableHead>Bulgu</TableHead>
                                        <TableHead>Tarih</TableHead>
                                        <TableHead class="text-right">Alan</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow>
                                        <TableCell class="font-medium">Çok-sensör karar</TableCell>
                                        <TableCell>{{ FUSION_LABEL[selected.fusion.class] ?? selected.fusion.class }} <span class="text-xs text-muted-foreground">z {{ fmtZ(selected.fusion.z) }}</span></TableCell>
                                        <TableCell class="tabular-nums">{{ fmtDate(selected.fusion.changeDate) }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ formatM2(selected.fusion.unitAreaM2) }} <span class="text-xs text-muted-foreground">{{ selected.fusion.unit === 'patch' ? 'yama' : 'bahçe' }}</span></TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell class="font-medium">Piksel taraması</TableCell>
                                        <TableCell>{{ selected.pixel ? (PIXEL_LABEL[selected.pixel.verdict] ?? selected.pixel.verdict) : 'tarama yok' }} <span v-if="selected.pixel?.score" class="text-xs text-muted-foreground">skor {{ fmtZ(selected.pixel.score) }}</span></TableCell>
                                        <TableCell class="tabular-nums">{{ selected.pixel?.date ? `${fmtDate(selected.pixel.lastBefore)} → ${fmtDate(selected.pixel.date)}` : '—' }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ selected.pixel?.prunedM2 ? formatM2(selected.pixel.prunedM2) : '—' }}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell class="font-medium">Radar (tanık)</TableCell>
                                        <TableCell>{{ selected.radar ? (selected.radar.witness ? 'değişim gördü' : 'ayrışmadı') : 'ölçülmedi' }}</TableCell>
                                        <TableCell class="text-xs text-muted-foreground">koherans z {{ fmtZ(selected.radar?.coherenceZ) }} · VH z {{ fmtZ(selected.radar?.vhZ) }}</TableCell>
                                        <TableCell class="text-right">—</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                        <p class="text-xs text-muted-foreground">
                            Kanıt görüntüleri ve seriler için aynı bahçeyi “Çok-sensör karar” ve “Piksel taraması” görünümlerinde açın; birleşik karar yalnızca bu iki modülün çıktısını bir araya getirir.
                            Radar tanığı, bahçenin koherans yükselişi ya da VH düşüşünün aynı tarihlerdeki sessiz çayın %90 eşiğini aşması demektir; tek başına karar değiştirmez.
                        </p>
                    </div>
                </template>
            </SheetContent>
        </Sheet>
    </div>
</template>
