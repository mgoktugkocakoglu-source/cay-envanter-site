<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useCaykurStore } from '@/stores/caykurStore';
import {
    budamaStatus,
    kotaUsagePct,
    kotaTone,
    formatDekar,
    formatKg,
    formatPct,
    formatNumber,
    type Producer,
    type Region,
    type ComplianceStatus,
} from '@/services/caykurData';
import CaykurLayout from '@/layouts/CaykurLayout.vue';
import ComplianceBadge from '@/components/caykur/ComplianceBadge.vue';
import ComplianceMeter from '@/components/caykur/ComplianceMeter.vue';

const router = useRouter();
const caykur = useCaykurStore();

const search = ref('');
const region = ref<'all' | Region>('all');
const status = ref<'all' | ComplianceStatus>('all');

const regionOptions: Array<{ value: 'all' | Region; label: string }> = [
    { value: 'all', label: 'Tüm bölgeler' },
    { value: 'Rize', label: 'Rize' },
    { value: 'Trabzon', label: 'Trabzon' },
    { value: 'Artvin', label: 'Artvin' },
    { value: 'Giresun', label: 'Giresun' },
];

const statusOptions: Array<{ value: 'all' | ComplianceStatus; label: string }> = [
    { value: 'all', label: 'Tümü' },
    { value: 'compliant', label: 'Uyumlu' },
    { value: 'partial', label: 'Kısmi' },
    { value: 'noncompliant', label: 'Uyumsuz' },
];

const filtered = computed(() => {
    const q = search.value.trim().toLocaleLowerCase('tr');
    return caykur.producers.filter((p) => {
        if (region.value !== 'all' && p.region !== region.value) return false;
        if (status.value !== 'all' && budamaStatus(p) !== status.value) return false;
        if (q) {
            const hay = `${p.fullName} ${p.ruhsatNo}`.toLocaleLowerCase('tr');
            if (!hay.includes(q)) return false;
        }
        return true;
    });
});

// ── Sorting ──
type SortKey = 'name' | 'region' | 'dekar' | 'seasonKg' | 'kota';

const sortKey = ref<SortKey | null>(null);
const sortDir = ref<'asc' | 'desc'>('asc');
const collator = new Intl.Collator('tr');

function toggleSort(key: SortKey): void {
    if (sortKey.value === key) {
        sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey.value = key;
        // Text columns start A→Z; numeric columns start with the largest values.
        sortDir.value = key === 'name' || key === 'region' ? 'asc' : 'desc';
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
    if (!key) return arr;
    const factor = sortDir.value === 'asc' ? 1 : -1;
    const valueOf = (p: Producer): number | string => {
        switch (key) {
            case 'name': return p.fullName;
            case 'region': return p.region;
            case 'dekar': return p.licensedDekar;
            case 'seasonKg': return p.seasonKg;
            case 'kota': return kotaUsagePct(p);
        }
    };
    arr.sort((a, b) => {
        const va = valueOf(a);
        const vb = valueOf(b);
        const cmp = typeof va === 'string'
            ? collator.compare(va, vb as string)
            : va - (vb as number);
        return cmp * factor;
    });
    return arr;
});

// ── Pagination ──
const PAGE_SIZE = 15;
const page = ref(1);

watch([search, region, status], () => {
    page.value = 1;
});

const totalPages = computed(() => Math.max(1, Math.ceil(sorted.value.length / PAGE_SIZE)));
const paged = computed(() => sorted.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE));
const rangeStart = computed(() => (sorted.value.length === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1));
const rangeEnd = computed(() => Math.min(page.value * PAGE_SIZE, sorted.value.length));
const pageNumbers = computed(() => Array.from({ length: totalPages.value }, (_, i) => i + 1));

// ── CSV export (all filtered rows, current sort) ──
function exportCsv(): void {
    const header = [
        'Ad Soyad', 'Ruhsat No', 'Cüzdan No', 'Bölge', 'İlçe', 'Fabrika',
        'Ruhsatlı Alan (da)', 'Sezon (kg)', 'Kota (kg)', 'Kota Kullanımı (%)',
        'Budama Durumu', 'Organik',
    ];
    const statusLabel: Record<ComplianceStatus, string> = {
        compliant: 'Uyumlu',
        partial: 'Kısmi',
        noncompliant: 'Uyumsuz',
    };
    const rows = sorted.value.map((p) => [
        p.fullName, p.ruhsatNo, p.cuzdanNo, p.region, p.district, p.factory,
        String(p.licensedDekar), String(p.seasonKg), String(p.quotaKg),
        String(Math.round(kotaUsagePct(p))),
        statusLabel[budamaStatus(p)], p.organic ? 'Evet' : 'Hayır',
    ]);
    // Semicolon + BOM so Excel (tr-TR locale) opens it correctly.
    const csv = '﻿' + [header, ...rows]
        .map((r) => r.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(';'))
        .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mustahsiller.csv';
    link.click();
    URL.revokeObjectURL(url);
}

function openProducer(id: string): void {
    router.push(`/caykur/producers/${id}`);
}

function resetFilters(): void {
    search.value = '';
    region.value = 'all';
    status.value = 'all';
}
</script>

<template>
    <CaykurLayout>
        <header class="ck-page-head">
            <div>
                <h1 class="ck-page-title">Müstahsiller</h1>
                <p class="ck-page-sub">{{ formatNumber(caykur.producers.length) }} kayıtlı müstahsil</p>
            </div>
            <div class="ck-page-actions">
                <button type="button" class="ck-btn" @click="exportCsv">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                    Dışa aktar
                </button>
            </div>
        </header>

        <!-- ── Toolbar ── -->
        <div class="ck-toolbar">
            <div class="ck-search-wrap">
                <svg class="ck-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input
                    v-model="search"
                    type="text"
                    class="ck-search-input"
                    placeholder="Ad veya ruhsat no ara…"
                    aria-label="Müstahsil ara"
                />
            </div>

            <div class="ck-seg" role="group" aria-label="Bölge filtresi">
                <button
                    v-for="opt in regionOptions"
                    :key="opt.value"
                    type="button"
                    class="ck-seg-btn"
                    :class="{ 'is-active': region === opt.value }"
                    @click="region = opt.value"
                >
                    {{ opt.label }}
                </button>
            </div>

            <div class="ck-seg" role="group" aria-label="Budama durumu filtresi">
                <button
                    v-for="opt in statusOptions"
                    :key="opt.value"
                    type="button"
                    class="ck-seg-btn"
                    :class="{ 'is-active': status === opt.value }"
                    @click="status = opt.value"
                >
                    {{ opt.label }}
                </button>
            </div>
        </div>

        <!-- ── Table ── -->
        <section class="ck-panel">
            <div class="ck-panel-head">
                <span class="ck-panel-meta">{{ formatNumber(sorted.length) }} müstahsil</span>
            </div>

            <div v-if="sorted.length > 0" class="ck-table-wrap">
                <table class="ck-table">
                    <thead>
                        <tr>
                            <th :aria-sort="ariaSortOf('name')">
                                <button type="button" class="ck-th-sort" :data-dir="sortDirOf('name')" @click="toggleSort('name')">
                                    Müstahsil
                                    <svg class="ck-sort-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
                                </button>
                            </th>
                            <th :aria-sort="ariaSortOf('region')">
                                <button type="button" class="ck-th-sort" :data-dir="sortDirOf('region')" @click="toggleSort('region')">
                                    Bölge
                                    <svg class="ck-sort-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
                                </button>
                            </th>
                            <th class="num" :aria-sort="ariaSortOf('dekar')">
                                <button type="button" class="ck-th-sort" :data-dir="sortDirOf('dekar')" @click="toggleSort('dekar')">
                                    Ruhsatlı alan
                                    <svg class="ck-sort-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
                                </button>
                            </th>
                            <th class="num" :aria-sort="ariaSortOf('seasonKg')">
                                <button type="button" class="ck-th-sort" :data-dir="sortDirOf('seasonKg')" @click="toggleSort('seasonKg')">
                                    Sezon
                                    <svg class="ck-sort-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
                                </button>
                            </th>
                            <th :aria-sort="ariaSortOf('kota')">
                                <button type="button" class="ck-th-sort" :data-dir="sortDirOf('kota')" @click="toggleSort('kota')">
                                    Kota kullanımı
                                    <svg class="ck-sort-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
                                </button>
                            </th>
                            <th>Budama</th>
                            <th aria-label="Detay"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="p in paged"
                            :key="p.id"
                            class="ck-row-link"
                            tabindex="0"
                            @click="openProducer(p.id)"
                            @keydown.enter="openProducer(p.id)"
                        >
                            <td>
                                <div class="ck-name-cell">
                                    <span class="ck-avatar" aria-hidden="true">{{ p.fullName.charAt(0) }}</span>
                                    <div class="ck-name-main">
                                        <span class="ck-name-top">
                                            {{ p.fullName }}
                                            <span v-if="p.organic" class="ck-tag">Organik</span>
                                        </span>
                                        <span class="ck-name-sub">Ruhsat {{ p.ruhsatNo }}</span>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span class="region-name">{{ p.region }}</span>
                                <span class="factory-name">{{ p.factory }}</span>
                            </td>
                            <td class="num">{{ formatDekar(p.licensedDekar) }}</td>
                            <td class="num">{{ formatKg(p.seasonKg) }}</td>
                            <td>
                                <div class="ck-cell-meter wide">
                                    <ComplianceMeter
                                        :value="kotaUsagePct(p)"
                                        :max="120"
                                        :tone="kotaTone(kotaUsagePct(p))"
                                        :height="6"
                                    />
                                    <span class="ck-cell-meter-val">{{ formatPct(kotaUsagePct(p)) }}</span>
                                </div>
                            </td>
                            <td>
                                <ComplianceBadge :status="budamaStatus(p)" />
                            </td>
                            <td class="ck-chevron-cell">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div v-if="sorted.length > 0 && totalPages > 1" class="ck-table-foot">
                <span class="ck-page-info">{{ rangeStart }}–{{ rangeEnd }} / {{ formatNumber(sorted.length) }} kayıt</span>
                <div class="ck-pager" role="group" aria-label="Sayfalama">
                    <button
                        type="button"
                        class="ck-pager-btn"
                        :disabled="page === 1"
                        aria-label="Önceki sayfa"
                        @click="page--"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    <button
                        v-for="n in pageNumbers"
                        :key="n"
                        type="button"
                        class="ck-pager-btn"
                        :class="{ 'is-current': n === page }"
                        :aria-current="n === page ? 'page' : undefined"
                        @click="page = n"
                    >
                        {{ n }}
                    </button>
                    <button
                        type="button"
                        class="ck-pager-btn"
                        :disabled="page === totalPages"
                        aria-label="Sonraki sayfa"
                        @click="page++"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                </div>
            </div>

            <div v-if="sorted.length === 0" class="ck-empty">
                <p class="ck-empty-title">Eşleşen müstahsil yok</p>
                <p class="ck-empty-sub">Arama ve filtreleri değiştirmeyi deneyin.</p>
                <button type="button" class="ck-btn" @click="resetFilters">Filtreleri temizle</button>
            </div>
        </section>
    </CaykurLayout>
</template>

<style scoped>
.region-name {
    display: block;
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
}
.factory-name {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
}
.ck-cell-meter.wide {
    min-width: 150px;
}
</style>
