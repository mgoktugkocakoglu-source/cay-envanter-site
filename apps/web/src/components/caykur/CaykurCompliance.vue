<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight, ListChecks } from '@lucide/vue';
import { EmptyState, LoadingState, StatCard } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toneVariant, type Tone } from '@/components/caykur/tone';
import { useToast } from '@/composables/useToast';
import { api, type ComplianceCheckStatus, type ComplianceOverall, type ComplianceParcel, type ComplianceRuleSource, type ComplianceSummary } from '@/services/api';
import { formatM2 } from '@/services/caykur/teaInventory';
import { formatNumber } from '@/services/caykur';
import CaykurComplianceMap from '@/components/caykur/CaykurComplianceMap.vue';
import { CERTAINTIES, CERTAINTY_META } from '@/services/caykur/complianceMap';
import type { ComplianceCertainty } from '@/services/api';

/**
 * Rule-based licence compliance report (Uygunluk raporu), a separate module under licensing: every parcel is tested
 * against a written rule set, and each rule shows its outcome with the evidence it was answered from. A preliminary
 * assessment: a finding suggests a field check or a record correction, it never decides.
 */
const props = defineProps<{ areaId: string }>();

const ALL = 'all';
const PAGE_SIZE = 20;
const OVERALL_META: Record<ComplianceOverall, { label: string; tone: Tone }> = {
    finding: { label: 'Aykırılık bulgusu', tone: 'danger' },
    review: { label: 'İnceleme gerekli', tone: 'warning' },
    no_evidence: { label: 'Kanıt yetersiz', tone: 'muted' },
    conforming: { label: 'Uygun', tone: 'success' },
    out_of_scope: { label: 'Kapsam dışı', tone: 'muted' },
};
const STATUS_META: Record<ComplianceCheckStatus, { label: string; tone: Tone }> = {
    pass: { label: 'uygun', tone: 'success' },
    fail: { label: 'aykırı', tone: 'danger' },
    review: { label: 'inceleme', tone: 'warning' },
    unknown: { label: 'kanıt yok', tone: 'muted' },
    na: { label: 'uygulanmaz', tone: 'muted' },
};
const SOURCE_LABEL: Record<ComplianceRuleSource, string> = { record: 'kayıt', satellite: 'uydu', drone: 'drone', field: 'saha gözlemi', buildings: 'bina verisi' };
const OVERALL_FILTERS: Array<{ value: ComplianceOverall | typeof ALL; label: string }> = [
    { value: ALL, label: 'Bütün parseller' },
    { value: 'finding', label: OVERALL_META.finding.label },
    { value: 'review', label: OVERALL_META.review.label },
    { value: 'no_evidence', label: OVERALL_META.no_evidence.label },
    { value: 'conforming', label: OVERALL_META.conforming.label },
    { value: 'out_of_scope', label: OVERALL_META.out_of_scope.label },
];

const toast = useToast();
const isLoading = ref(true);
const isLoadingRows = ref(false);
const summary = ref<ComplianceSummary | null>(null);
const rows = ref<ComplianceParcel[]>([]);
const total = ref(0);
const pages = ref(1);
const page = ref(1);
const search = ref('');
const overallFilter = ref<ComplianceOverall | typeof ALL>(ALL);
const certaintyFilter = ref<ComplianceCertainty | typeof ALL>(ALL);
const ruleFilter = ref<string>(ALL);
const selected = ref<ComplianceParcel | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let loadId = 0;
let rowsId = 0;
let detailId = 0;
const detailLoading = ref(false);
const agreedCount = computed(() => summary.value?.summary.byCertainty?.agreed.parcels ?? 0);
const undecidedCount = computed(() => (summary.value?.summary.parcels ?? 0) - agreedCount.value);
const ratio = (count: number): string => summary.value?.summary.parcels ? `%${(100 * count / summary.value.summary.parcels).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}` : '—';

const rules = computed(() => summary.value?.ruleset.rules ?? []);
const ruleById = computed(() => new Map(rules.value.map((r) => [r.id, r])));
const sheetOpen = computed({
    get: () => selected.value !== null,
    set: (open: boolean) => {
        if (!open) selected.value = null;
    },
});

async function load(): Promise<void> {
    const current = ++loadId;
    rowsId++;
    detailId++;
    detailLoading.value = false;
    selected.value = null;
    rows.value = [];
    total.value = 0;
    pages.value = 1;
    if (searchTimer) clearTimeout(searchTimer);
    isLoading.value = true;
    const res = await api.getComplianceSummary(props.areaId);
    if (current !== loadId) return;
    isLoading.value = false;
    summary.value = res.data ?? null;
    if (res.data) {
        if (page.value !== 1) page.value = 1;
        else await loadRows();
    }
}
async function loadRows(): Promise<void> {
    const current = ++rowsId;
    isLoadingRows.value = true;
    const res = await api.getComplianceParcels(props.areaId, {
        page: page.value,
        limit: PAGE_SIZE,
        overall: overallFilter.value === ALL ? undefined : overallFilter.value,
        certainty: certaintyFilter.value === ALL ? undefined : certaintyFilter.value,
        rule: ruleFilter.value === ALL ? undefined : ruleFilter.value,
        search: search.value.trim() || undefined,
    });
    if (current !== rowsId) return;
    isLoadingRows.value = false;
    if (!res.data) {
        toast.error(res.error?.message ?? 'Parsel listesi alınamadı');
        return;
    }
    rows.value = res.data.data;
    total.value = res.data.meta.total;
    pages.value = Math.max(1, res.data.meta.totalPages);
}
async function openParcel(block: string, parcel: string): Promise<void> {
    const current = ++detailId;
    detailLoading.value = true;
    const result = await api.getComplianceParcel(props.areaId, block, parcel);
    if (current !== detailId) return;
    detailLoading.value = false;
    if (result.data) selected.value = result.data;
    else toast.error(result.error?.message ?? 'Parsel ayrıntısı alınamadı');
}
function selectRow(row: ComplianceParcel): void {
    detailId++;
    detailLoading.value = false;
    selected.value = row;
}
function onCertainty(value: unknown): void {
    if (value === ALL || CERTAINTIES.includes(value as ComplianceCertainty)) certaintyFilter.value = value as ComplianceCertainty | typeof ALL;
}
function onOverall(v: unknown): void {
    if (typeof v === 'string' && OVERALL_FILTERS.some((f) => f.value === v)) overallFilter.value = v as ComplianceOverall | typeof ALL;
}
function onRule(v: unknown): void {
    if (typeof v === 'string') ruleFilter.value = v;
}
/** Shows the parcels where one rule is open, from the rule table. */
function pickRule(id: string): void {
    overallFilter.value = ALL;
    certaintyFilter.value = ALL;
    ruleFilter.value = id;
}
function reload(): void {
    if (page.value === 1) void loadRows();
    else page.value = 1;
}
watch([overallFilter, ruleFilter, certaintyFilter], reload);
watch(search, () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(reload, 300);
});
watch(page, () => void loadRows());
watch(() => props.areaId, () => void load(), { immediate: true });
onBeforeUnmount(() => {
    loadId++;
    rowsId++;
    detailId++;
    if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
    <div class="flex flex-col gap-4">
        <LoadingState v-if="isLoading" text="Uygunluk raporu yükleniyor…" />
        <EmptyState v-else-if="!summary" :icon="ListChecks" title="Bu mahalle için uygunluk raporu yok" description="Arazi tespit kararı üretildikten sonra kural denetimi çalıştırıldığında burada görünür." />
        <template v-else>
            <CaykurComplianceMap :area-id="areaId" @select="openParcel" />
            <LoadingState v-if="detailLoading" text="Parsel ayrıntısı yükleniyor…" />
            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle class="flex flex-wrap items-center gap-2">
                        Kural tabanlı ruhsat uygunluk raporu
                        <Badge variant="warning">Ön değerlendirme</Badge>
                        <Badge variant="warning">Taslak kural seti v{{ summary.ruleset.version }}</Badge>
                        <Badge v-if="summary.licenceSource === 'demo'" variant="warning">DEMO ruhsat kaydı</Badge>
                        <Badge variant="outline">İdari karar üretmez</Badge>
                    </CardTitle>
                    <CardDescription>
                        {{ summary.method }}
                        <br />{{ summary.ruleset.note }}
                        <template v-if="summary.licenceSource === 'demo'"><br />Ruhsat kayıtları DEMO'dur: ruhsata dayanan bulgular gerçek ÇAYKUR listesi gelene kadar yalnız yöntemi gösterir.</template>
                    </CardDescription>
                </CardHeader>
            </Card>

            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Aykırılık bulgusu" :value="formatNumber(summary.summary.byOverall.finding)" hint="en az bir kural aykırı" :icon="ListChecks" />
                <StatCard label="İnceleme gerekli" :value="formatNumber(summary.summary.byOverall.review)" hint="kanıt bulgu için yeterli değil" />
                <StatCard label="Uygun" :value="formatNumber(summary.summary.byOverall.conforming)" :hint="`${formatNumber(summary.summary.parcels)} parselden`" />
                <StatCard label="Kanıt yetersiz" :value="formatNumber(summary.summary.byOverall.no_evidence)" :hint="`kapsam dışı: ${formatNumber(summary.summary.byOverall.out_of_scope)} parsel`" />
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
                <StatCard label="Kaynaklar uyumlu" :value="formatNumber(agreedCount)" :hint="`${ratio(agreedCount)} · karar verilen ön değerlendirme grubu; idari karar değildir`" />
                <StatCard label="Karar verilemedi" :value="formatNumber(undecidedCount)" :hint="`${ratio(undecidedCount)} · tek kaynak, çelişki veya belirsiz okuma`" />
            </div>
            <p class="text-xs text-muted-foreground">Oranlar parsel dağılımıdır, doğruluk yüzdesi değildir. Mevcut kural sonuçları kaynak uyumundan bağımsızdır; “Uygun” sonucu tek başına karar için yeterli değildir.</p>

            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Kurallar</CardTitle>
                    <CardDescription>Her kural her parsele ayrı ayrı uygulanır. Bir satıra tıklayınca o kuralın açık kaldığı (aykırı ya da inceleme) parseller listelenir.</CardDescription>
                </CardHeader>
                <CardContent class="px-0 pb-0">
                    <div class="overflow-x-auto border-t">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Kural</TableHead>
                                    <TableHead>Kaynak</TableHead>
                                    <TableHead class="text-right">Uygun</TableHead>
                                    <TableHead class="text-right">Aykırı</TableHead>
                                    <TableHead class="text-right">İnceleme</TableHead>
                                    <TableHead class="text-right">Kanıt yok</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="r in rules" :key="r.id" class="cursor-pointer" tabindex="0" @click="pickRule(r.id)" @keydown.enter="pickRule(r.id)">
                                    <TableCell class="min-w-72 whitespace-normal">
                                        <span class="font-medium">{{ r.id }} · {{ r.title }}</span>
                                        <div class="text-xs text-muted-foreground">{{ r.expects }} {{ r.findingNeeds }}</div>
                                    </TableCell>
                                    <TableCell class="text-sm">{{ r.sources.map((s) => SOURCE_LABEL[s]).join(' + ') }}</TableCell>
                                    <TableCell class="text-right tabular-nums">{{ formatNumber(summary.summary.byRule[r.id]?.pass ?? 0) }}</TableCell>
                                    <TableCell class="text-right tabular-nums">{{ formatNumber(summary.summary.byRule[r.id]?.fail ?? 0) }}</TableCell>
                                    <TableCell class="text-right tabular-nums">{{ formatNumber(summary.summary.byRule[r.id]?.review ?? 0) }}</TableCell>
                                    <TableCell class="text-right tabular-nums">{{ formatNumber(summary.summary.byRule[r.id]?.unknown ?? 0) }}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Parseller</CardTitle>
                    <CardDescription>Bulgular önce gelir. Bir parsele tıklayınca on kuralın sonucu ve dayandığı kanıt açılır.</CardDescription>
                </CardHeader>
                <CardContent class="px-0 pb-0">
                    <div class="flex flex-col gap-3 border-t p-4 md:flex-row md:items-end">
                        <div class="flex flex-1 flex-col gap-1.5">
                            <Label for="compliance-search">Ada/parsel, nitelik ya da mevkii</Label>
                            <Input id="compliance-search" v-model="search" placeholder="örn. 106/23" class="h-11 md:h-9" />
                        </div>
                        <div class="flex flex-col gap-1.5 md:w-56">
                            <Label for="compliance-certainty">Kesinlik sınıfı</Label>
                            <Select :model-value="certaintyFilter" @update:model-value="onCertainty">
                                <SelectTrigger id="compliance-certainty" class="min-h-11 w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="ALL">Bütün sınıflar</SelectItem>
                                    <SelectItem v-for="key in CERTAINTIES" :key="key" :value="key">{{ CERTAINTY_META[key].label }}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div class="flex flex-col gap-1.5 md:w-56">
                            <Label for="compliance-overall">Sonuç</Label>
                            <Select :model-value="overallFilter" @update:model-value="onOverall">
                                <SelectTrigger id="compliance-overall" class="h-11 w-full md:h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="f in OVERALL_FILTERS" :key="f.value" :value="f.value">{{ f.label }}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div class="flex flex-col gap-1.5 md:w-72">
                            <Label for="compliance-rule">Açık kalan kural</Label>
                            <Select :model-value="ruleFilter" @update:model-value="onRule">
                                <SelectTrigger id="compliance-rule" class="h-11 w-full md:h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="ALL">Bütün kurallar</SelectItem>
                                    <SelectItem v-for="r in rules" :key="r.id" :value="r.id">{{ r.id }} · {{ r.title }}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <LoadingState v-if="isLoadingRows" text="Parseller yükleniyor…" class="border-t p-6" />
                    <p v-else-if="!rows.length" class="border-t p-6 text-sm text-muted-foreground">Bu filtreye uyan parsel yok.</p>
                    <div v-else class="overflow-x-auto border-t">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ada/Parsel</TableHead>
                                    <TableHead>Kayıt</TableHead>
                                    <TableHead>Sonuç</TableHead>
                                    <TableHead>Açık kurallar</TableHead>
                                    <TableHead>Öneri</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="r in rows" :key="r.key" class="cursor-pointer" tabindex="0" @click="selectRow(r)" @keydown.enter="selectRow(r)">
                                    <TableCell class="font-medium">
                                        {{ r.block }}/{{ r.parcel }}
                                        <div class="text-xs text-muted-foreground">{{ r.locality || '—' }} · {{ formatM2(r.areaM2) }}</div>
                                    </TableCell>
                                    <TableCell class="text-sm">
                                        {{ r.nature }}
                                        <div class="text-xs text-muted-foreground">{{ r.licensed ? 'ruhsatlı' : 'ruhsat kaydı yok' }}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div class="flex flex-col items-start gap-1">
                                            <Badge :variant="toneVariant(CERTAINTY_META[r.certainty ?? 'undecidable'].tone)">{{ CERTAINTY_META[r.certainty ?? 'undecidable'].label }}</Badge>
                                            <span v-if="r.certainty !== 'agreed'" class="text-xs text-muted-foreground">Karar verilemedi</span>
                                            <Badge :variant="toneVariant(OVERALL_META[r.overall].tone)">Kural: {{ OVERALL_META[r.overall].label }}</Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div class="flex flex-wrap gap-1">
                                            <Badge v-for="c in r.checks.filter((x) => x.status === 'fail' || x.status === 'review')" :key="c.rule" :variant="toneVariant(STATUS_META[c.status].tone)">{{ c.rule }}</Badge>
                                            <span v-if="!r.open.length" class="text-sm text-muted-foreground">—</span>
                                        </div>
                                    </TableCell>
                                    <TableCell class="min-w-64 whitespace-normal text-sm">{{ r.action }}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <div v-if="pages > 1" class="flex items-center justify-between border-t p-4">
                        <span class="text-sm text-muted-foreground">Sayfa {{ page }} / {{ pages }} · {{ formatNumber(total) }} parsel</span>
                        <div class="flex gap-2">
                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page <= 1" aria-label="Önceki sayfa" @click="page--"><ChevronLeft aria-hidden="true" /></Button>
                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page >= pages" aria-label="Sonraki sayfa" @click="page++"><ChevronRight aria-hidden="true" /></Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </template>

        <Sheet v-model:open="sheetOpen">
            <SheetContent class="w-full overflow-y-auto sm:max-w-3xl">
                <template v-if="selected">
                    <SheetHeader class="border-b">
                        <SheetTitle>{{ summary?.neighborhood }} {{ selected.block }}/{{ selected.parcel }}</SheetTitle>
                        <SheetDescription>{{ selected.nature }} · {{ selected.locality || 'mevkii yok' }} · {{ formatM2(selected.areaM2) }} · {{ selected.licensed ? 'ruhsatlı' : 'ruhsat kaydı yok' }}</SheetDescription>
                        <div class="flex flex-wrap gap-2 pt-1">
                            <Badge :variant="toneVariant(CERTAINTY_META[selected.certainty ?? 'undecidable'].tone)">{{ CERTAINTY_META[selected.certainty ?? 'undecidable'].label }}</Badge>
                            <Badge :variant="toneVariant(OVERALL_META[selected.overall].tone)">{{ OVERALL_META[selected.overall].label }}</Badge>
                            <Badge variant="warning">Ön değerlendirme</Badge>
                            <Badge v-if="summary?.licenceSource === 'demo'" variant="warning">DEMO ruhsat kaydı</Badge>
                        </div>
                    </SheetHeader>
                    <div class="flex flex-col gap-4 p-4">
                        <p class="rounded-lg border p-3 text-sm">{{ selected.certaintyReason }} <span v-if="selected.certainty !== 'agreed'">Karar verilemedi.</span> Saha ve kayıt kontrolü öncesinde idari karar olarak kullanılamaz.</p>
                        <p class="text-sm"><span class="font-medium">Öneri:</span> {{ selected.action }}</p>
                        <ul class="flex flex-col gap-3">
                            <li v-for="c in selected.checks" :key="c.rule" class="flex flex-col gap-1 rounded-lg border p-3" :class="{ 'opacity-60': c.status === 'na' }">
                                <div class="flex flex-wrap items-center justify-between gap-2">
                                    <span class="font-medium">{{ c.rule }} · {{ ruleById.get(c.rule)?.title }}</span>
                                    <Badge :variant="toneVariant(STATUS_META[c.status].tone)">{{ STATUS_META[c.status].label }}</Badge>
                                </div>
                                <p class="text-sm">{{ c.evidence }}</p>
                                <p v-if="c.status === 'fail' || c.status === 'review'" class="text-xs text-muted-foreground">{{ ruleById.get(c.rule)?.findingNeeds }}</p>
                            </li>
                        </ul>
                    </div>
                </template>
            </SheetContent>
        </Sheet>
    </div>
</template>
