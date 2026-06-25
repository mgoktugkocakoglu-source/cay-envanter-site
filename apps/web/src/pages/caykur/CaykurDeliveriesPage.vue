<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import CaykurPage from '@/components/caykur/CaykurPage.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import {
    DELIVERIES,
    deliverySummary,
    dailyTotals,
    STATUS_META,
    SURGUN_LABEL,
    formatNumber,
    formatKg,
    formatTon,
    formatDate,
    type DeliveryStatus,
    type Region,
} from '@/services/caykur';

const router = useRouter();

type View = 'list' | 'pending' | 'daily';
const view = ref<View>('list');
const search = ref('');
const region = ref<'all' | Region>('all');
const status = ref<'all' | DeliveryStatus>('all');

const summary = computed(() => deliverySummary());
const daily = computed(() => dailyTotals());

const regionOptions: Array<{ value: 'all' | Region; label: string }> = [
    { value: 'all', label: 'Tüm bölgeler' },
    { value: 'Rize', label: 'Rize' },
    { value: 'Trabzon', label: 'Trabzon' },
    { value: 'Artvin', label: 'Artvin' },
    { value: 'Giresun', label: 'Giresun' },
];
const statusOptions: Array<{ value: 'all' | DeliveryStatus; label: string }> = [
    { value: 'all', label: 'Tümü' },
    { value: 'approved', label: 'Onaylandı' },
    { value: 'pending', label: 'Onay bekliyor' },
    { value: 'corrected', label: 'Düzeltildi' },
    { value: 'rejected', label: 'Reddedildi' },
];

const filtered = computed(() => {
    const q = search.value.trim().toLocaleLowerCase('tr');
    return DELIVERIES.filter((d) => {
        if (view.value === 'pending' && d.status !== 'pending') return false;
        if (view.value === 'list' && status.value !== 'all' && d.status !== status.value) return false;
        if (region.value !== 'all' && d.region !== region.value) return false;
        if (q) {
            const hay = `${d.producerName} ${d.receiptNo}`.toLocaleLowerCase('tr');
            if (!hay.includes(q)) return false;
        }
        return true;
    });
});

// ── Sorting ──
type SortKey = 'date' | 'net' | 'fire';
const sortKey = ref<SortKey>('date');
const sortDir = ref<'asc' | 'desc'>('desc');

function toggleSort(key: SortKey): void {
    if (sortKey.value === key) {
        sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey.value = key;
        sortDir.value = 'desc';
    }
    page.value = 1;
}
function sortDirOf(key: SortKey): 'asc' | 'desc' | undefined {
    return sortKey.value === key ? sortDir.value : undefined;
}
function ariaSortOf(key: SortKey): 'ascending' | 'descending' | undefined {
    if (sortKey.value !== key) return undefined;
    return sortDir.value === 'asc' ? 'ascending' : 'descending';
}

const sorted = computed(() => {
    const arr = [...filtered.value];
    const key = sortKey.value;
    const factor = sortDir.value === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
        let cmp: number;
        if (key === 'date') cmp = a.date.localeCompare(b.date);
        else if (key === 'net') cmp = a.netKg - b.netKg;
        else cmp = a.firePct - b.firePct;
        return cmp * factor;
    });
    return arr;
});

// ── Pagination ──
const PAGE_SIZE = 25;
const page = ref(1);
watch([search, region, status, view], () => {
    page.value = 1;
});
const totalPages = computed(() => Math.max(1, Math.ceil(sorted.value.length / PAGE_SIZE)));
const paged = computed(() => sorted.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE));
const rangeStart = computed(() => (sorted.value.length === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1));
const rangeEnd = computed(() => Math.min(page.value * PAGE_SIZE, sorted.value.length));

/** Compact page list with ellipsis gaps: 1 … 4 5 6 … 16. */
const pageWindow = computed<Array<number | 'gap'>>(() => {
    const total = totalPages.value;
    const cur = page.value;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const out: Array<number | 'gap'> = [1];
    if (cur > 3) out.push('gap');
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) out.push(i);
    if (cur < total - 2) out.push('gap');
    out.push(total);
    return out;
});

function openDelivery(id: string): void {
    router.push(`/caykur/deliveries/${id}`);
}
</script>

<template>
    <CaykurPage title="Yaş Çay Alımı" :sub="`${formatTon(summary.totalNetKg)} · ${formatNumber(summary.totalSlips)} alım fişi`">
        <template #actions>
            <button type="button" class="ck-btn ck-btn-primary" @click="router.push('/caykur/deliveries/new')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Yeni alım
            </button>
        </template>

        <section class="ck-kpi-grid">
            <CaykurStatCard label="Toplam alım" :value="formatTon(summary.totalNetKg)" sub="net yaş çay (sezon)" />
            <CaykurStatCard label="Onaylanan" :value="formatTon(summary.approvedKg)" sub="hakedişe esas" />
            <CaykurStatCard label="Onay bekleyen" :value="formatNumber(summary.pendingSlips)" :sub="`${formatKg(summary.pendingKg)} fiş`" />
            <CaykurStatCard label="Ortalama fire" :value="`%${formatNumber(summary.avgFirePct, 1)}`" sub="alım fişlerinde" />
        </section>

        <div class="ck-seg" role="group" aria-label="Görünüm" style="margin-bottom: var(--space-4)">
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'list' }" @click="view = 'list'">Tüm teslimatlar</button>
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'pending' }" @click="view = 'pending'">Onay bekleyenler</button>
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'daily' }" @click="view = 'daily'">Günlük özet</button>
        </div>

        <!-- List / pending views -->
        <template v-if="view !== 'daily'">
            <div class="ck-toolbar">
                <div class="ck-search-wrap">
                    <svg class="ck-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input v-model="search" type="text" class="ck-search-input" placeholder="Müstahsil veya fiş no ara…" aria-label="Alım ara" />
                </div>
                <div class="ck-seg" role="group" aria-label="Bölge filtresi">
                    <button v-for="opt in regionOptions" :key="opt.value" type="button" class="ck-seg-btn" :class="{ 'is-active': region === opt.value }" @click="region = opt.value">{{ opt.label }}</button>
                </div>
                <div v-if="view === 'list'" class="ck-seg" role="group" aria-label="Durum filtresi">
                    <button v-for="opt in statusOptions" :key="opt.value" type="button" class="ck-seg-btn" :class="{ 'is-active': status === opt.value }" @click="status = opt.value">{{ opt.label }}</button>
                </div>
            </div>

            <CaykurPanel>
                <template #head>
                    <span class="ck-panel-meta">{{ formatNumber(sorted.length) }} fiş</span>
                </template>
                <div v-if="sorted.length" class="ck-table-wrap">
                    <table class="ck-table">
                        <thead>
                            <tr>
                                <th>Fiş no</th>
                                <th>Müstahsil</th>
                                <th>Alım yeri</th>
                                <th :aria-sort="ariaSortOf('date')">
                                    <button type="button" class="ck-th-sort" :data-dir="sortDirOf('date')" @click="toggleSort('date')">
                                        Tarih
                                        <svg class="ck-sort-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
                                    </button>
                                </th>
                                <th>Sürgün</th>
                                <th class="num" :aria-sort="ariaSortOf('net')">
                                    <button type="button" class="ck-th-sort" :data-dir="sortDirOf('net')" @click="toggleSort('net')">
                                        Net
                                        <svg class="ck-sort-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
                                    </button>
                                </th>
                                <th class="num" :aria-sort="ariaSortOf('fire')">
                                    <button type="button" class="ck-th-sort" :data-dir="sortDirOf('fire')" @click="toggleSort('fire')">
                                        Fire
                                        <svg class="ck-sort-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
                                    </button>
                                </th>
                                <th>Kalite</th>
                                <th>Durum</th>
                                <th aria-label="Detay"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="d in paged" :key="d.id" class="ck-row-link" tabindex="0" @click="openDelivery(d.id)" @keydown.enter="openDelivery(d.id)">
                                <td class="strong" style="font-variant-numeric: tabular-nums">{{ d.receiptNo }}</td>
                                <td>{{ d.producerName }}</td>
                                <td>
                                    <span style="display:block">{{ d.purchasePointName }}</span>
                                    <span class="ck-name-sub">{{ d.region }}</span>
                                </td>
                                <td style="white-space:nowrap">{{ formatDate(d.date) }}</td>
                                <td>{{ SURGUN_LABEL[d.surgun] }}</td>
                                <td class="num ck-money">{{ formatKg(d.netKg) }}</td>
                                <td class="num">%{{ formatNumber(d.firePct, 1) }}</td>
                                <td>{{ d.grade }}</td>
                                <td><StatusPill :label="STATUS_META[d.status].label" :tone="STATUS_META[d.status].tone" /></td>
                                <td class="ck-chevron-cell"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div v-else class="ck-empty"><p class="ck-empty-title">Kayıt bulunamadı</p></div>

                <div v-if="sorted.length && totalPages > 1" class="ck-table-foot">
                    <span class="ck-page-info">{{ rangeStart }}–{{ rangeEnd }} / {{ formatNumber(sorted.length) }} fiş</span>
                    <div class="ck-pager" role="group" aria-label="Sayfalama">
                        <button type="button" class="ck-pager-btn" :disabled="page === 1" aria-label="Önceki sayfa" @click="page--">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                        </button>
                        <template v-for="(n, i) in pageWindow" :key="i">
                            <span v-if="n === 'gap'" class="ck-pager-gap">…</span>
                            <button
                                v-else
                                type="button"
                                class="ck-pager-btn"
                                :class="{ 'is-current': n === page }"
                                :aria-current="n === page ? 'page' : undefined"
                                @click="page = n"
                            >{{ n }}</button>
                        </template>
                        <button type="button" class="ck-pager-btn" :disabled="page === totalPages" aria-label="Sonraki sayfa" @click="page++">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                        </button>
                    </div>
                </div>
            </CaykurPanel>
        </template>

        <!-- Daily summary view -->
        <CaykurPanel v-else title="Alım yeri günlük özeti" :meta="`${formatNumber(daily.length)} gün/yer`">
            <div class="ck-table-wrap">
                <table class="ck-table">
                    <thead>
                        <tr>
                            <th>Tarih</th>
                            <th>Alım yeri</th>
                            <th>Bölge</th>
                            <th class="num">Müstahsil</th>
                            <th class="num">Fiş</th>
                            <th class="num">Toplam net</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(d, i) in daily.slice(0, 60)" :key="i">
                            <td style="white-space:nowrap">{{ formatDate(d.date) }}</td>
                            <td class="strong">{{ d.pointName }}</td>
                            <td>{{ d.region }}</td>
                            <td class="num">{{ formatNumber(d.producers) }}</td>
                            <td class="num">{{ formatNumber(d.slips) }}</td>
                            <td class="num ck-money">{{ formatKg(d.netKg) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </CaykurPanel>
    </CaykurPage>
</template>

