<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Filter, MapPinned, User } from '@lucide/vue';
import CaykurLayout from '@/layouts/CaykurLayout.vue';
import { EmptyState, ListToolbar, LoadingState, PageContainer, PageHeader, SearchInput, StatCard } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    api,
    type CaykurFieldRow,
    type CaykurFieldsOverview,
    type CaykurFieldOwnership,
    type CaykurFieldSortKey,
    type CaykurFieldPerson,
} from '@/services/api';
import { formatNumber, formatDekar, formatDate } from '@/services/caykur';

/**
 * Institution-wide field (parcel) registry: every producer's fields in one
 * table with server-side filters, sorting and pagination. The "Hisseli" quick
 * filter surfaces parcels (same il + ada + parsel) registered by more than one
 * person — the shared-title gardens Çaykur has to reconcile.
 */

const route = useRoute();
const router = useRouter();

// ── Filters (mirrored to the URL so a filtered view can be shared) ──
const search = ref('');
const province = ref('');
const district = ref('');
const neighborhood = ref('');
const adaNo = ref('');
const parcelNo = ref('');
const ownership = ref<CaykurFieldOwnership>('all');
const minArea = ref('');
const maxArea = ref('');
const createdFrom = ref('');
const createdTo = ref('');
const sortBy = ref<CaykurFieldSortKey>('createdAt');
const sortOrder = ref<'ASC' | 'DESC'>('DESC');
const page = ref(1);
const limit = ref(20);
const moreOpen = ref(false);

// ── Data ──
const rows = ref<CaykurFieldRow[]>([]);
const total = ref(0);
const totalPages = ref(0);
const overview = ref<CaykurFieldsOverview | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);
const expandedId = ref<string | null>(null);

const ownershipOptions: Array<{ value: CaykurFieldOwnership; label: string; hint: string }> = [
    { value: 'all', label: 'Tümü', hint: 'Bütün kayıtlı araziler' },
    { value: 'shared', label: 'Hisseli', hint: 'Aynı ildeki aynı ada/parsel birden fazla kişide kayıtlı' },
    { value: 'partnered', label: 'Ortaklı', hint: 'Sahibi ortak beyan etmiş araziler' },
    { value: 'single', label: 'Tek kayıtlı', hint: 'Ne hisseli ne ortaklı' },
];

const pageSizeOptions = [10, 20, 50, 100];

/** Select components cannot carry an empty-string value, so "all" stands in for it. */
const ALL = 'all';
const provinceSelect = computed({
    get: () => province.value || ALL,
    set: (v: string) => { province.value = v === ALL ? '' : v; },
});
const districtSelect = computed({
    get: () => district.value || ALL,
    set: (v: string) => { district.value = v === ALL ? '' : v; },
});
const limitSelect = computed({
    get: () => String(limit.value),
    set: (v: string) => { limit.value = Number(v); },
});

function onOwnershipChange(v: unknown): void {
    if (typeof v === 'string' && ownershipOptions.some((o) => o.value === v)) ownership.value = v as CaykurFieldOwnership;
}

const districtOptions = computed(() => {
    const list = overview.value?.districts ?? [];
    return province.value ? list.filter((d) => d.province === province.value) : list;
});

const hasActiveFilters = computed(() =>
    !!(search.value || province.value || district.value || neighborhood.value || adaNo.value ||
        parcelNo.value || ownership.value !== 'all' || minArea.value || maxArea.value ||
        createdFrom.value || createdTo.value),
);

const advancedCount = computed(() =>
    [neighborhood.value, minArea.value, maxArea.value, createdFrom.value, createdTo.value].filter(Boolean).length,
);

const rangeStart = computed(() => (total.value === 0 ? 0 : (page.value - 1) * limit.value + 1));
const rangeEnd = computed(() => Math.min(page.value * limit.value, total.value));

/** Compact pager: first, last, and a window around the current page. */
const pageNumbers = computed<Array<number | '…'>>(() => {
    const n = totalPages.value;
    if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);
    const cur = page.value;
    const set = new Set<number>([1, n, cur - 1, cur, cur + 1]);
    const sorted = [...set].filter((x) => x >= 1 && x <= n).sort((a, b) => a - b);
    const out: Array<number | '…'> = [];
    sorted.forEach((x, i) => {
        if (i > 0 && x - (sorted[i - 1] as number) > 1) out.push('…');
        out.push(x);
    });
    return out;
});

function num(value: string): number | undefined {
    const n = Number(value.replace(',', '.'));
    return value.trim() !== '' && Number.isFinite(n) ? n : undefined;
}

async function load(): Promise<void> {
    isLoading.value = true;
    error.value = null;
    const res = await api.getCaykurFields({
        page: page.value,
        limit: limit.value,
        search: search.value.trim() || undefined,
        province: province.value || undefined,
        district: district.value || undefined,
        neighborhood: neighborhood.value.trim() || undefined,
        adaNo: adaNo.value.trim() || undefined,
        parcelNo: parcelNo.value.trim() || undefined,
        ownership: ownership.value,
        minAreaDekar: num(minArea.value),
        maxAreaDekar: num(maxArea.value),
        createdFrom: createdFrom.value || undefined,
        createdTo: createdTo.value || undefined,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value,
    });
    if (res.data) {
        rows.value = res.data.data;
        total.value = res.data.meta.total;
        totalPages.value = res.data.meta.totalPages;
        if (page.value > 1 && res.data.data.length === 0 && res.data.meta.totalPages > 0) {
            page.value = res.data.meta.totalPages;
        }
    } else {
        error.value = res.error?.message ?? 'Araziler alınamadı';
    }
    isLoading.value = false;
}

async function loadOverview(): Promise<void> {
    const res = await api.getCaykurFieldsOverview();
    if (res.data) overview.value = res.data;
}

// Debounce free-text inputs; apply selects immediately.
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleLoad(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        page.value = 1;
        void load();
    }, 300);
}

watch([search, neighborhood, adaNo, parcelNo, minArea, maxArea], scheduleLoad);
watch([province, district, ownership, createdFrom, createdTo, limit], () => {
    page.value = 1;
    void load();
});
watch(province, () => {
    // A district only makes sense inside its province.
    if (district.value && !districtOptions.value.some((d) => d.district === district.value)) {
        district.value = '';
    }
});
watch([sortBy, sortOrder, page], () => void load());

// ── URL sync ──
function readQuery(): void {
    const q = route.query;
    const str = (k: string): string => (typeof q[k] === 'string' ? (q[k] as string) : '');
    search.value = str('q');
    province.value = str('il');
    district.value = str('ilce');
    neighborhood.value = str('mahalle');
    adaNo.value = str('ada');
    parcelNo.value = str('parsel');
    const own = str('durum') as CaykurFieldOwnership;
    ownership.value = ownershipOptions.some((o) => o.value === own) ? own : 'all';
    minArea.value = str('minDa');
    maxArea.value = str('maxDa');
    createdFrom.value = str('from');
    createdTo.value = str('to');
    const sb = str('sort') as CaykurFieldSortKey;
    sortBy.value = (['createdAt', 'name', 'area', 'province', 'owner', 'parcel'] as CaykurFieldSortKey[]).includes(sb) ? sb : 'createdAt';
    sortOrder.value = str('dir') === 'ASC' ? 'ASC' : 'DESC';
    page.value = Math.max(1, Number(str('page')) || 1);
    const lim = Number(str('limit'));
    limit.value = pageSizeOptions.includes(lim) ? lim : 20;
    moreOpen.value = advancedCount.value > 0;
}

watch(
    [search, province, district, neighborhood, adaNo, parcelNo, ownership, minArea, maxArea, createdFrom, createdTo, sortBy, sortOrder, page, limit],
    () => {
        const q: Record<string, string> = {};
        if (search.value) q.q = search.value;
        if (province.value) q.il = province.value;
        if (district.value) q.ilce = district.value;
        if (neighborhood.value) q.mahalle = neighborhood.value;
        if (adaNo.value) q.ada = adaNo.value;
        if (parcelNo.value) q.parsel = parcelNo.value;
        if (ownership.value !== 'all') q.durum = ownership.value;
        if (minArea.value) q.minDa = minArea.value;
        if (maxArea.value) q.maxDa = maxArea.value;
        if (createdFrom.value) q.from = createdFrom.value;
        if (createdTo.value) q.to = createdTo.value;
        if (sortBy.value !== 'createdAt') q.sort = sortBy.value;
        if (sortOrder.value !== 'DESC') q.dir = sortOrder.value;
        if (page.value > 1) q.page = String(page.value);
        if (limit.value !== 20) q.limit = String(limit.value);
        void router.replace({ query: q });
    },
);

onMounted(() => {
    readQuery();
    void loadOverview();
    void load();
});
onBeforeUnmount(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
});

// ── Sorting ──
const SORT_COLUMNS: Array<{ key: CaykurFieldSortKey; label: string; class?: string }> = [
    { key: 'name', label: 'Arazi' },
    { key: 'province', label: 'Konum', class: 'hidden md:table-cell' },
    { key: 'parcel', label: 'Ada / Parsel' },
    { key: 'owner', label: 'Kişiler', class: 'hidden lg:table-cell' },
    { key: 'area', label: 'Alan', class: 'text-right' },
    { key: 'createdAt', label: 'Kayıt', class: 'hidden md:table-cell' },
];

function toggleSort(key: CaykurFieldSortKey): void {
    if (sortBy.value === key) {
        sortOrder.value = sortOrder.value === 'ASC' ? 'DESC' : 'ASC';
    } else {
        sortBy.value = key;
        sortOrder.value = key === 'createdAt' || key === 'area' ? 'DESC' : 'ASC';
    }
}
function sortDirOf(key: CaykurFieldSortKey): 'asc' | 'desc' | undefined {
    return sortBy.value === key ? (sortOrder.value === 'ASC' ? 'asc' : 'desc') : undefined;
}
function ariaSortOf(key: CaykurFieldSortKey): 'ascending' | 'descending' | 'none' {
    return sortBy.value === key ? (sortOrder.value === 'ASC' ? 'ascending' : 'descending') : 'none';
}

function resetFilters(): void {
    search.value = '';
    province.value = '';
    district.value = '';
    neighborhood.value = '';
    adaNo.value = '';
    parcelNo.value = '';
    ownership.value = 'all';
    minArea.value = '';
    maxArea.value = '';
    createdFrom.value = '';
    createdTo.value = '';
}

function toggleRow(id: string): void {
    expandedId.value = expandedId.value === id ? null : id;
}

function onRowKey(e: KeyboardEvent, id: string): void {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleRow(id);
    }
}

// ── Presentation helpers ──
const UNIT_LABEL: Record<CaykurFieldRow['areaUnit'], string> = { donum: 'dönüm', dekar: 'da', m2: 'm²' };

function areaOriginal(r: CaykurFieldRow): string {
    return `${formatNumber(r.area, r.areaUnit === 'm2' ? 0 : 2)} ${UNIT_LABEL[r.areaUnit]}`;
}

function parcelLabel(r: CaykurFieldRow): string {
    if (!r.adaNo && !r.parcelNo) return 'Ada/parsel yok';
    return `Ada ${r.adaNo ?? '—'} / Parsel ${r.parcelNo ?? '—'}`;
}

function personTitle(p: CaykurFieldPerson): string {
    const bits = [p.role === 'owner' ? 'Kayıt sahibi' : 'Ortak'];
    if (p.phone) bits.push(p.phone);
    if (p.sharePercentage !== null && p.sharePercentage > 0) bits.push(`%${formatNumber(p.sharePercentage, 0)} hisse`);
    if (p.invitationStatus === 'pending') bits.push('davet bekliyor');
    if (p.invitationStatus === 'rejected') bits.push('daveti reddetti');
    return bits.join(' · ');
}

function personBadgeClass(p: CaykurFieldPerson): string {
    const bits: string[] = ['max-w-full'];
    if (p.role === 'owner') bits.push('font-semibold');
    if (p.invitationStatus === 'pending') bits.push('border-dashed text-muted-foreground');
    if (p.invitationStatus === 'rejected') bits.push('text-muted-foreground line-through');
    return bits.join(' ');
}

const INVITE_LABEL: Record<NonNullable<CaykurFieldPerson['invitationStatus']>, string> = {
    pending: 'Davet bekliyor',
    accepted: 'Kabul etti',
    rejected: 'Reddetti',
};
</script>

<template>
    <CaykurLayout>
        <PageContainer size="wide">
            <PageHeader
                title="Araziler"
                :description="overview ? `${formatNumber(overview.total)} arazi · ${formatDekar(overview.totalAreaDekar)} toplam alan · ${overview.provinces.length} il` : 'Tüm müstahsillerin kayıtlı arazileri'"
            />

            <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Özet">
                <StatCard
                    label="Toplam arazi"
                    :value="overview ? formatNumber(overview.total) : '—'"
                    :hint="overview ? `${formatDekar(overview.totalAreaDekar)} kayıtlı alan` : ' '"
                />
                <StatCard label="Hisseli arazi" :value="overview ? formatNumber(overview.shared) : '—'" hint="aynı ada/parsel birden fazla kişide" />
                <StatCard label="Ortaklı arazi" :value="overview ? formatNumber(overview.withPartners) : '—'" hint="sahibi ortak beyan etmiş" />
                <StatCard
                    label="İl / ilçe"
                    :value="overview ? `${overview.provinces.length} / ${overview.districts.length}` : '—'"
                    hint="kayıt bulunan bölge"
                />
            </section>

            <ToggleGroup :model-value="ownership" type="single" aria-label="Hızlı filtre" class="h-11 md:h-9" @update:model-value="onOwnershipChange">
                <ToggleGroupItem v-for="opt in ownershipOptions" :key="opt.value" :value="opt.value" :title="opt.hint" class="h-full px-3">
                    {{ opt.label }}
                    <Badge v-if="opt.value === 'shared' && overview" variant="muted" class="tabular-nums">{{ formatNumber(overview.shared) }}</Badge>
                </ToggleGroupItem>
            </ToggleGroup>

            <ListToolbar>
                <SearchInput v-model="search" placeholder="Arazi, müstahsil, ortak, mahalle, ada veya parsel ara…" aria-label="Arazi ara" />
                <template #filters>
                    <Select v-model="provinceSelect">
                        <SelectTrigger class="w-40" aria-label="İl filtresi">
                            <SelectValue placeholder="Tüm iller" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem :value="ALL">Tüm iller</SelectItem>
                            <SelectItem v-for="p in overview?.provinces ?? []" :key="p.province" :value="p.province">{{ p.province }} ({{ p.count }})</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select v-model="districtSelect">
                        <SelectTrigger class="w-44" aria-label="İlçe filtresi">
                            <SelectValue placeholder="Tüm ilçeler" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem :value="ALL">Tüm ilçeler</SelectItem>
                            <SelectItem v-for="d in districtOptions" :key="`${d.province}/${d.district}`" :value="d.district">
                                {{ d.district }}<template v-if="!province"> · {{ d.province }}</template> ({{ d.count }})
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <Input v-model="adaNo" type="text" inputmode="numeric" placeholder="Ada" aria-label="Ada no" class="h-11 w-24 md:h-9" />
                    <Input v-model="parcelNo" type="text" inputmode="numeric" placeholder="Parsel" aria-label="Parsel no" class="h-11 w-24 md:h-9" />
                    <Button variant="outline" class="h-11 md:h-9" :aria-expanded="moreOpen" @click="moreOpen = !moreOpen">
                        <Filter aria-hidden="true" />
                        Diğer filtreler
                        <Badge v-if="advancedCount" variant="muted" class="tabular-nums">{{ advancedCount }}</Badge>
                    </Button>
                    <Button v-if="hasActiveFilters" variant="ghost" class="h-11 md:h-9" @click="resetFilters">Temizle</Button>
                </template>
            </ListToolbar>

            <Card v-if="moreOpen" class="py-4">
                <CardContent class="grid gap-4 px-4 sm:grid-cols-2 lg:grid-cols-5">
                    <div class="space-y-2">
                        <Label for="fields-neighborhood">Mahalle / köy</Label>
                        <Input id="fields-neighborhood" v-model="neighborhood" type="text" placeholder="Mahalle adı" class="h-11 md:h-9" />
                    </div>
                    <div class="space-y-2">
                        <Label for="fields-min-area">En az alan (da)</Label>
                        <Input id="fields-min-area" v-model="minArea" type="number" min="0" step="0.1" placeholder="0" class="h-11 md:h-9" />
                    </div>
                    <div class="space-y-2">
                        <Label for="fields-max-area">En çok alan (da)</Label>
                        <Input id="fields-max-area" v-model="maxArea" type="number" min="0" step="0.1" placeholder="∞" class="h-11 md:h-9" />
                    </div>
                    <div class="space-y-2">
                        <Label for="fields-created-from">Kayıt tarihi (başlangıç)</Label>
                        <Input id="fields-created-from" v-model="createdFrom" type="date" class="h-11 md:h-9" />
                    </div>
                    <div class="space-y-2">
                        <Label for="fields-created-to">Kayıt tarihi (bitiş)</Label>
                        <Input id="fields-created-to" v-model="createdTo" type="date" class="h-11 md:h-9" />
                    </div>
                </CardContent>
            </Card>

            <Card class="gap-0 py-0">
                <CardHeader class="border-b py-4">
                    <CardTitle>Arazi kayıtları</CardTitle>
                    <CardDescription aria-live="polite">
                        <template v-if="isLoading && rows.length === 0">Yükleniyor…</template>
                        <template v-else>{{ formatNumber(total) }} arazi</template>
                    </CardDescription>
                    <CardAction class="flex items-center gap-2">
                        <Label for="fields-page-size" class="text-xs text-muted-foreground">Sayfa başına</Label>
                        <Select v-model="limitSelect">
                            <SelectTrigger id="fields-page-size" size="sm" class="w-20" aria-label="Sayfa başına kayıt">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="n in pageSizeOptions" :key="n" :value="String(n)">{{ n }}</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardAction>
                </CardHeader>

                <CardContent class="px-0">
                    <EmptyState v-if="error" title="Araziler yüklenemedi" :description="error" class="rounded-none border-0">
                        <Button variant="outline" class="h-11 md:h-9" @click="load">Tekrar dene</Button>
                    </EmptyState>

                    <div v-else-if="rows.length" class="overflow-x-auto" :aria-busy="isLoading">
                        <Table>
                            <TableHeader>
                                <TableRow class="hover:bg-transparent">
                                    <TableHead
                                        v-for="col in SORT_COLUMNS"
                                        :key="col.key"
                                        :class="[col.class, col.key === 'name' && 'pl-2']"
                                        :aria-sort="ariaSortOf(col.key)"
                                    >
                                        <Button variant="ghost" size="sm" class="-ml-2 h-8 gap-1 px-2" @click="toggleSort(col.key)">
                                            {{ col.label }}
                                            <ArrowUp v-if="sortDirOf(col.key) === 'asc'" class="size-3.5" aria-hidden="true" />
                                            <ArrowDown v-else-if="sortDirOf(col.key) === 'desc'" class="size-3.5" aria-hidden="true" />
                                            <ChevronsUpDown v-else class="size-3.5 text-muted-foreground" aria-hidden="true" />
                                        </Button>
                                    </TableHead>
                                    <TableHead class="w-10 pr-4"><span class="sr-only">Detay</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <template v-for="r in rows" :key="r.id">
                                    <TableRow
                                        class="cursor-pointer align-top"
                                        :class="expandedId === r.id && 'border-b-0 bg-muted/50'"
                                        tabindex="0"
                                        :aria-expanded="expandedId === r.id"
                                        @click="toggleRow(r.id)"
                                        @keydown="onRowKey($event, r.id)"
                                    >
                                        <TableCell class="pl-4">
                                            <span class="block font-medium text-foreground">{{ r.name || 'İsimsiz arazi' }}</span>
                                            <span class="block text-xs text-muted-foreground">{{ r.neighborhood }}<template v-if="r.road"> · {{ r.road }}</template></span>
                                            <span class="block text-xs text-muted-foreground md:hidden">{{ r.province }} / {{ r.district }}</span>
                                        </TableCell>
                                        <TableCell class="hidden md:table-cell">
                                            <span class="block text-foreground">{{ r.province }}</span>
                                            <span class="block text-xs text-muted-foreground">{{ r.district }}</span>
                                        </TableCell>
                                        <TableCell class="whitespace-nowrap">
                                            <span class="block text-foreground">{{ parcelLabel(r) }}</span>
                                            <Badge v-if="r.shared" variant="warning" class="mt-1">Hisseli · {{ r.sharedWith.length + 1 }} kayıt</Badge>
                                        </TableCell>
                                        <TableCell class="hidden lg:table-cell">
                                            <div class="flex max-w-105 flex-wrap gap-1.5">
                                                <Badge
                                                    v-for="(p, i) in r.people"
                                                    :key="`${r.id}-p-${i}`"
                                                    :variant="p.role === 'partner' ? 'secondary' : 'outline'"
                                                    :class="personBadgeClass(p)"
                                                    :title="personTitle(p)"
                                                >
                                                    <User v-if="p.role === 'owner'" aria-hidden="true" />
                                                    <span class="truncate">{{ p.name }}</span>
                                                    <span v-if="p.sharePercentage !== null && p.sharePercentage > 0" class="font-normal text-muted-foreground">%{{ formatNumber(p.sharePercentage, 0) }}</span>
                                                </Badge>
                                                <Badge
                                                    v-for="s in r.sharedWith"
                                                    :key="`${r.id}-s-${s.fieldId}`"
                                                    variant="warning"
                                                    class="max-w-full"
                                                    :title="`Aynı ada/parseli ayrıca kaydetmiş: ${s.fieldName || 'isimsiz arazi'}`"
                                                >
                                                    <span class="truncate">{{ s.fullName }}</span>
                                                    <span class="font-normal opacity-85">ayrı kayıt</span>
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell class="text-right">
                                            <span class="block font-semibold text-foreground tabular-nums">{{ formatDekar(r.areaDekar) }}</span>
                                            <span v-if="r.areaUnit === 'm2'" class="block text-xs text-muted-foreground tabular-nums">{{ areaOriginal(r) }}</span>
                                        </TableCell>
                                        <TableCell class="hidden whitespace-nowrap text-muted-foreground md:table-cell">{{ formatDate(r.createdAt) }}</TableCell>
                                        <TableCell class="pr-4 text-right">
                                            <ChevronDown
                                                class="size-4 text-muted-foreground transition-transform motion-reduce:transition-none"
                                                :class="expandedId === r.id && 'rotate-180'"
                                                aria-hidden="true"
                                            />
                                        </TableCell>
                                    </TableRow>
                                    <TableRow v-if="expandedId === r.id" class="hover:bg-transparent">
                                        <TableCell :colspan="SORT_COLUMNS.length + 1" class="px-4 pt-0 pb-4">
                                            <div class="grid gap-6 md:grid-cols-2">
                                                <div class="space-y-4">
                                                    <div>
                                                        <h3 class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Kişiler</h3>
                                                        <ul class="flex flex-col gap-2">
                                                            <li v-for="(p, i) in r.people" :key="`${r.id}-d-${i}`" class="flex flex-col">
                                                                <span class="font-medium text-foreground">{{ p.name }}</span>
                                                                <span class="text-xs text-muted-foreground">
                                                                    {{ p.role === 'owner' ? 'Kayıt sahibi' : 'Ortak' }}
                                                                    <template v-if="p.phone"> · {{ p.phone }}</template>
                                                                    <template v-if="p.sharePercentage !== null && p.sharePercentage > 0"> · %{{ formatNumber(p.sharePercentage, 0) }} hisse</template>
                                                                    <template v-if="p.invitationStatus"> · {{ INVITE_LABEL[p.invitationStatus] }}</template>
                                                                </span>
                                                            </li>
                                                        </ul>
                                                    </div>
                                                    <div v-if="r.sharedWith.length">
                                                        <h3 class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Aynı ada/parseli kaydeden diğer kişiler</h3>
                                                        <ul class="flex flex-col gap-2">
                                                            <li v-for="s in r.sharedWith" :key="`${r.id}-ds-${s.fieldId}`" class="flex flex-col">
                                                                <span class="font-medium text-foreground">{{ s.fullName }}</span>
                                                                <span class="text-xs text-muted-foreground">Arazi adı: {{ s.fieldName || 'isimsiz' }}</span>
                                                            </li>
                                                        </ul>
                                                    </div>
                                                </div>
                                                <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                                    <div><dt class="text-muted-foreground">Kayıt sahibi telefon</dt><dd class="text-foreground">{{ r.owner.phone ?? '—' }}</dd></div>
                                                    <div><dt class="text-muted-foreground">Ruhsat / cüzdan no</dt><dd class="text-foreground">{{ r.owner.ruhsatNo ?? '—' }} / {{ r.owner.cuzdanNo ?? '—' }}</dd></div>
                                                    <div><dt class="text-muted-foreground">Beyan edilen alan</dt><dd class="font-semibold text-foreground tabular-nums">{{ areaOriginal(r) }}</dd></div>
                                                    <div><dt class="text-muted-foreground">Sınır çizimi</dt><dd class="text-foreground">{{ r.hasGeometry ? 'Var' : 'Yok' }}</dd></div>
                                                    <div><dt class="text-muted-foreground">Son güncelleme</dt><dd class="text-foreground">{{ formatDate(r.updatedAt) }}</dd></div>
                                                    <div v-if="r.notes" class="col-span-2"><dt class="text-muted-foreground">Not</dt><dd class="whitespace-pre-line text-foreground">{{ r.notes }}</dd></div>
                                                </dl>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                </template>
                            </TableBody>
                        </Table>
                    </div>

                    <LoadingState v-else-if="isLoading" text="Araziler yükleniyor…" />

                    <EmptyState
                        v-else
                        :icon="MapPinned"
                        :title="hasActiveFilters ? 'Eşleşen arazi yok' : 'Kayıtlı arazi yok'"
                        :description="hasActiveFilters ? 'Arama ve filtreleri değiştirmeyi deneyin.' : 'Müstahsiller arazi ekledikçe burada listelenir.'"
                        class="rounded-none border-0"
                    >
                        <Button v-if="hasActiveFilters" variant="outline" class="h-11 md:h-9" @click="resetFilters">Filtreleri temizle</Button>
                    </EmptyState>

                    <div v-if="rows.length > 0" class="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
                        <span class="text-xs text-muted-foreground tabular-nums">{{ rangeStart }}–{{ rangeEnd }} / {{ formatNumber(total) }} kayıt</span>
                        <nav v-if="totalPages > 1" class="flex flex-wrap items-center gap-1" aria-label="Sayfalama">
                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page === 1" aria-label="Önceki sayfa" @click="page--">
                                <ChevronLeft aria-hidden="true" />
                            </Button>
                            <template v-for="(n, i) in pageNumbers" :key="`${n}-${i}`">
                                <span v-if="n === '…'" class="px-1 text-muted-foreground" aria-hidden="true">…</span>
                                <Button
                                    v-else
                                    :variant="n === page ? 'default' : 'outline'"
                                    size="icon"
                                    class="size-11 tabular-nums md:size-9"
                                    :aria-current="n === page ? 'page' : undefined"
                                    @click="page = n"
                                >
                                    {{ n }}
                                </Button>
                            </template>
                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page === totalPages" aria-label="Sonraki sayfa" @click="page++">
                                <ChevronRight aria-hidden="true" />
                            </Button>
                        </nav>
                    </div>
                </CardContent>
            </Card>
        </PageContainer>
    </CaykurLayout>
</template>
