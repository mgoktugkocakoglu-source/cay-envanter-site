<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CaykurPage from '@/components/caykur/CaykurPage.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
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

const INVITE_LABEL: Record<NonNullable<CaykurFieldPerson['invitationStatus']>, string> = {
    pending: 'Davet bekliyor',
    accepted: 'Kabul etti',
    rejected: 'Reddetti',
};
</script>

<template>
    <CaykurPage
        title="Araziler"
        :sub="overview ? `${formatNumber(overview.total)} arazi · ${formatDekar(overview.totalAreaDekar)} toplam alan · ${overview.provinces.length} il` : 'Tüm müstahsillerin kayıtlı arazileri'"
    >
        <section class="ck-kpi-grid">
            <CaykurStatCard
                label="Toplam arazi"
                :value="overview ? formatNumber(overview.total) : '—'"
                :sub="overview ? `${formatDekar(overview.totalAreaDekar)} kayıtlı alan` : ' '"
            />
            <CaykurStatCard
                label="Hisseli arazi"
                :value="overview ? formatNumber(overview.shared) : '—'"
                sub="aynı ada/parsel birden fazla kişide"
            />
            <CaykurStatCard
                label="Ortaklı arazi"
                :value="overview ? formatNumber(overview.withPartners) : '—'"
                sub="sahibi ortak beyan etmiş"
            />
            <CaykurStatCard
                label="İl / ilçe"
                :value="overview ? `${overview.provinces.length} / ${overview.districts.length}` : '—'"
                sub="kayıt bulunan bölge"
            />
        </section>

        <div class="ck-seg fields-quick" role="group" aria-label="Hızlı filtre">
            <button
                v-for="opt in ownershipOptions"
                :key="opt.value"
                type="button"
                class="ck-seg-btn"
                :class="{ 'is-active': ownership === opt.value }"
                :title="opt.hint"
                :aria-pressed="ownership === opt.value"
                @click="ownership = opt.value"
            >
                {{ opt.label }}
                <span v-if="opt.value === 'shared' && overview" class="fields-seg-count">{{ formatNumber(overview.shared) }}</span>
            </button>
        </div>

        <div class="ck-toolbar">
            <div class="ck-search-wrap">
                <svg class="ck-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input v-model="search" type="search" class="ck-search-input" placeholder="Arazi, müstahsil, ortak, mahalle, ada veya parsel ara…" aria-label="Arazi ara" />
            </div>
            <select v-model="province" class="ck-select" aria-label="İl filtresi">
                <option value="">Tüm iller</option>
                <option v-for="p in overview?.provinces ?? []" :key="p.province" :value="p.province">{{ p.province }} ({{ p.count }})</option>
            </select>
            <select v-model="district" class="ck-select" aria-label="İlçe filtresi">
                <option value="">Tüm ilçeler</option>
                <option v-for="d in districtOptions" :key="`${d.province}/${d.district}`" :value="d.district">
                    {{ d.district }}<template v-if="!province"> · {{ d.province }}</template> ({{ d.count }})
                </option>
            </select>
            <input v-model="adaNo" type="text" inputmode="numeric" class="ck-search-input fields-input-narrow" placeholder="Ada" aria-label="Ada no" />
            <input v-model="parcelNo" type="text" inputmode="numeric" class="ck-search-input fields-input-narrow" placeholder="Parsel" aria-label="Parsel no" />
            <button type="button" class="ck-btn ck-btn-ghost" :aria-expanded="moreOpen" @click="moreOpen = !moreOpen">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                Diğer filtreler<span v-if="advancedCount" class="fields-seg-count">{{ advancedCount }}</span>
            </button>
            <button v-if="hasActiveFilters" type="button" class="ck-btn ck-btn-ghost" @click="resetFilters">Temizle</button>
        </div>

        <div v-if="moreOpen" class="fields-advanced">
            <label class="fields-field">
                <span class="fields-label">Mahalle / köy</span>
                <input v-model="neighborhood" type="text" class="ck-search-input fields-input-plain" placeholder="Mahalle adı" />
            </label>
            <label class="fields-field">
                <span class="fields-label">En az alan (da)</span>
                <input v-model="minArea" type="number" min="0" step="0.1" class="ck-search-input fields-input-plain" placeholder="0" />
            </label>
            <label class="fields-field">
                <span class="fields-label">En çok alan (da)</span>
                <input v-model="maxArea" type="number" min="0" step="0.1" class="ck-search-input fields-input-plain" placeholder="∞" />
            </label>
            <label class="fields-field">
                <span class="fields-label">Kayıt tarihi (başlangıç)</span>
                <input v-model="createdFrom" type="date" class="ck-search-input fields-input-plain" />
            </label>
            <label class="fields-field">
                <span class="fields-label">Kayıt tarihi (bitiş)</span>
                <input v-model="createdTo" type="date" class="ck-search-input fields-input-plain" />
            </label>
        </div>

        <CaykurPanel>
            <template #head>
                <span class="ck-panel-meta" aria-live="polite">
                    <template v-if="isLoading && rows.length === 0">Yükleniyor…</template>
                    <template v-else>{{ formatNumber(total) }} arazi</template>
                </span>
                <label class="fields-pagesize">
                    <span class="fields-label">Sayfa başına</span>
                    <select v-model.number="limit" class="ck-select fields-pagesize-select" aria-label="Sayfa başına kayıt">
                        <option v-for="n in pageSizeOptions" :key="n" :value="n">{{ n }}</option>
                    </select>
                </label>
            </template>

            <div v-if="error" class="ck-empty">
                <p class="ck-empty-title">Araziler yüklenemedi</p>
                <p class="ck-empty-sub">{{ error }}</p>
                <button type="button" class="ck-btn" @click="load">Tekrar dene</button>
            </div>

            <div v-else-if="rows.length" class="ck-table-wrap" :aria-busy="isLoading">
                <table class="ck-table fields-table">
                    <thead>
                        <tr>
                            <th :aria-sort="ariaSortOf('name')">
                                <button type="button" class="ck-th-sort" :data-dir="sortDirOf('name')" @click="toggleSort('name')">
                                    Arazi
                                    <svg class="ck-sort-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
                                </button>
                            </th>
                            <th :aria-sort="ariaSortOf('province')">
                                <button type="button" class="ck-th-sort" :data-dir="sortDirOf('province')" @click="toggleSort('province')">
                                    Konum
                                    <svg class="ck-sort-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
                                </button>
                            </th>
                            <th :aria-sort="ariaSortOf('parcel')">
                                <button type="button" class="ck-th-sort" :data-dir="sortDirOf('parcel')" @click="toggleSort('parcel')">
                                    Ada / Parsel
                                    <svg class="ck-sort-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
                                </button>
                            </th>
                            <th :aria-sort="ariaSortOf('owner')">
                                <button type="button" class="ck-th-sort" :data-dir="sortDirOf('owner')" @click="toggleSort('owner')">
                                    Kişiler
                                    <svg class="ck-sort-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
                                </button>
                            </th>
                            <th class="num" :aria-sort="ariaSortOf('area')">
                                <button type="button" class="ck-th-sort" :data-dir="sortDirOf('area')" @click="toggleSort('area')">
                                    Alan
                                    <svg class="ck-sort-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
                                </button>
                            </th>
                            <th :aria-sort="ariaSortOf('createdAt')">
                                <button type="button" class="ck-th-sort" :data-dir="sortDirOf('createdAt')" @click="toggleSort('createdAt')">
                                    Kayıt
                                    <svg class="ck-sort-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
                                </button>
                            </th>
                            <th aria-label="Detay"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <template v-for="r in rows" :key="r.id">
                            <tr
                                class="ck-row-link"
                                :class="{ 'is-expanded': expandedId === r.id }"
                                tabindex="0"
                                :aria-expanded="expandedId === r.id"
                                @click="toggleRow(r.id)"
                                @keydown="onRowKey($event, r.id)"
                            >
                                <td>
                                    <span class="strong" style="display:block">{{ r.name || 'İsimsiz arazi' }}</span>
                                    <span class="ck-name-sub">{{ r.neighborhood }}<template v-if="r.road"> · {{ r.road }}</template></span>
                                </td>
                                <td>
                                    <span style="display:block">{{ r.province }}</span>
                                    <span class="ck-name-sub">{{ r.district }}</span>
                                </td>
                                <td style="white-space:nowrap">
                                    <span style="display:block">{{ parcelLabel(r) }}</span>
                                    <StatusPill
                                        v-if="r.shared"
                                        :label="`Hisseli · ${r.sharedWith.length + 1} kayıt`"
                                        tone="warning"
                                    />
                                </td>
                                <td>
                                    <div class="fields-tags">
                                        <span
                                            v-for="(p, i) in r.people"
                                            :key="`${r.id}-p-${i}`"
                                            class="fields-tag"
                                            :data-role="p.role"
                                            :data-invite="p.invitationStatus ?? undefined"
                                            :title="personTitle(p)"
                                        >
                                            <svg v-if="p.role === 'owner'" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                            {{ p.name }}
                                            <span v-if="p.sharePercentage !== null && p.sharePercentage > 0" class="fields-tag-meta">%{{ formatNumber(p.sharePercentage, 0) }}</span>
                                        </span>
                                        <span
                                            v-for="s in r.sharedWith"
                                            :key="`${r.id}-s-${s.fieldId}`"
                                            class="fields-tag"
                                            data-role="registrant"
                                            :title="`Aynı ada/parseli ayrıca kaydetmiş: ${s.fieldName || 'isimsiz arazi'}`"
                                        >
                                            {{ s.fullName }}
                                            <span class="fields-tag-meta">ayrı kayıt</span>
                                        </span>
                                    </div>
                                </td>
                                <td class="num">
                                    <span class="ck-money">{{ formatDekar(r.areaDekar) }}</span>
                                    <span v-if="r.areaUnit === 'm2'" class="ck-name-sub" style="display:block">{{ areaOriginal(r) }}</span>
                                </td>
                                <td style="white-space:nowrap">{{ formatDate(r.createdAt) }}</td>
                                <td class="ck-chevron-cell">
                                    <svg class="fields-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
                                </td>
                            </tr>
                            <tr v-if="expandedId === r.id" class="fields-detail-row">
                                <td colspan="7">
                                    <div class="fields-detail">
                                        <div class="fields-detail-col">
                                            <h3 class="fields-detail-title">Kişiler</h3>
                                            <ul class="fields-people">
                                                <li v-for="(p, i) in r.people" :key="`${r.id}-d-${i}`">
                                                    <span class="strong">{{ p.name }}</span>
                                                    <span class="ck-name-sub">
                                                        {{ p.role === 'owner' ? 'Kayıt sahibi' : 'Ortak' }}
                                                        <template v-if="p.phone"> · {{ p.phone }}</template>
                                                        <template v-if="p.sharePercentage !== null && p.sharePercentage > 0"> · %{{ formatNumber(p.sharePercentage, 0) }} hisse</template>
                                                        <template v-if="p.invitationStatus"> · {{ INVITE_LABEL[p.invitationStatus] }}</template>
                                                    </span>
                                                </li>
                                            </ul>
                                            <template v-if="r.sharedWith.length">
                                                <h3 class="fields-detail-title" style="margin-top: var(--space-4)">Aynı ada/parseli kaydeden diğer kişiler</h3>
                                                <ul class="fields-people">
                                                    <li v-for="s in r.sharedWith" :key="`${r.id}-ds-${s.fieldId}`">
                                                        <span class="strong">{{ s.fullName }}</span>
                                                        <span class="ck-name-sub">Arazi adı: {{ s.fieldName || 'isimsiz' }}</span>
                                                    </li>
                                                </ul>
                                            </template>
                                        </div>
                                        <dl class="ck-dl fields-detail-col">
                                            <div class="ck-dl-item"><dt class="ck-dl-term">Kayıt sahibi telefon</dt><dd class="ck-dl-val">{{ r.owner.phone ?? '—' }}</dd></div>
                                            <div class="ck-dl-item"><dt class="ck-dl-term">Ruhsat / cüzdan no</dt><dd class="ck-dl-val">{{ r.owner.ruhsatNo ?? '—' }} / {{ r.owner.cuzdanNo ?? '—' }}</dd></div>
                                            <div class="ck-dl-item"><dt class="ck-dl-term">Beyan edilen alan</dt><dd class="ck-dl-val">{{ areaOriginal(r) }}</dd></div>
                                            <div class="ck-dl-item"><dt class="ck-dl-term">Sınır çizimi</dt><dd class="ck-dl-val">{{ r.hasGeometry ? 'Var' : 'Yok' }}</dd></div>
                                            <div class="ck-dl-item"><dt class="ck-dl-term">Son güncelleme</dt><dd class="ck-dl-val">{{ formatDate(r.updatedAt) }}</dd></div>
                                            <div v-if="r.notes" class="ck-dl-item"><dt class="ck-dl-term">Not</dt><dd class="ck-dl-val">{{ r.notes }}</dd></div>
                                        </dl>
                                    </div>
                                </td>
                            </tr>
                        </template>
                    </tbody>
                </table>
            </div>

            <div v-else-if="isLoading" class="ck-empty">
                <p class="ck-empty-sub">Araziler yükleniyor…</p>
            </div>

            <div v-else class="ck-empty">
                <p class="ck-empty-title">{{ hasActiveFilters ? 'Eşleşen arazi yok' : 'Kayıtlı arazi yok' }}</p>
                <p class="ck-empty-sub">{{ hasActiveFilters ? 'Arama ve filtreleri değiştirmeyi deneyin.' : 'Müstahsiller arazi ekledikçe burada listelenir.' }}</p>
                <button v-if="hasActiveFilters" type="button" class="ck-btn" @click="resetFilters">Filtreleri temizle</button>
            </div>

            <div v-if="rows.length > 0" class="ck-table-foot">
                <span class="ck-page-info">{{ rangeStart }}–{{ rangeEnd }} / {{ formatNumber(total) }} kayıt</span>
                <div v-if="totalPages > 1" class="ck-pager" role="group" aria-label="Sayfalama">
                    <button type="button" class="ck-pager-btn" :disabled="page === 1" aria-label="Önceki sayfa" @click="page--">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    <template v-for="(n, i) in pageNumbers" :key="`${n}-${i}`">
                        <span v-if="n === '…'" class="ck-pager-gap" aria-hidden="true">…</span>
                        <button
                            v-else
                            type="button"
                            class="ck-pager-btn"
                            :class="{ 'is-current': n === page }"
                            :aria-current="n === page ? 'page' : undefined"
                            @click="page = n"
                        >
                            {{ n }}
                        </button>
                    </template>
                    <button type="button" class="ck-pager-btn" :disabled="page === totalPages" aria-label="Sonraki sayfa" @click="page++">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                </div>
            </div>
        </CaykurPanel>
    </CaykurPage>
</template>

<style scoped>
.fields-quick {
    margin-bottom: var(--space-4);
}

.fields-seg-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    margin-left: 6px;
    padding: 0 6px;
    font-size: var(--font-size-xs);
    font-variant-numeric: tabular-nums;
    border-radius: var(--radius-full);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
}

.fields-input-narrow {
    width: 96px;
    padding-left: var(--space-4);
}

.fields-input-plain {
    padding-left: var(--space-4);
}

.fields-advanced {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-3);
    padding: var(--space-4);
    margin-bottom: var(--space-5);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-secondary);
}

.fields-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.fields-label {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary);
}

.fields-pagesize {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    margin-left: auto;
}

.fields-pagesize-select {
    height: 36px;
    padding: 0 var(--space-3);
}

.fields-table td {
    vertical-align: top;
}

/* ── People tags ── */
.fields-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-width: 420px;
}

.fields-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 100%;
    padding: 3px 9px;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    line-height: 1.4;
    color: var(--color-text-primary);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-strong, var(--color-border));
    border-radius: var(--radius-full);
    white-space: nowrap;
}

.fields-tag[data-role='owner'] {
    font-weight: var(--font-weight-semibold);
}

.fields-tag[data-role='partner'] {
    background: var(--color-bg-tertiary);
}

.fields-tag[data-invite='pending'] {
    border-style: dashed;
    color: var(--color-text-secondary);
}

.fields-tag[data-invite='rejected'] {
    text-decoration: line-through;
    color: var(--color-text-muted);
}

.fields-tag[data-role='registrant'] {
    color: var(--color-warning);
    background: color-mix(in srgb, var(--color-warning) 10%, transparent);
    border-color: color-mix(in srgb, var(--color-warning) 30%, transparent);
}

.fields-tag-meta {
    font-weight: var(--font-weight-regular, 400);
    color: var(--color-text-muted);
}

.fields-tag[data-role='registrant'] .fields-tag-meta {
    color: inherit;
    opacity: 0.85;
}

/* ── Expandable detail row ── */
.fields-chevron {
    transition: transform var(--transition-fast);
}

.ck-row-link.is-expanded .fields-chevron {
    transform: rotate(180deg);
}

.ck-row-link.is-expanded td {
    border-bottom-color: transparent;
}

.fields-detail-row td {
    padding-top: 0;
    background: var(--color-bg-primary);
}

.fields-detail {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: var(--space-5);
    padding: var(--space-3) 0 var(--space-2);
}

.fields-detail-title {
    margin: 0 0 var(--space-2);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
}

.fields-people {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.fields-people li {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

@media (prefers-reduced-motion: reduce) {
    .fields-chevron {
        transition: none;
    }
}

@media (max-width: 720px) {
    .fields-input-narrow {
        width: 80px;
    }
    .fields-tags {
        max-width: 280px;
    }
}
</style>
