<script setup lang="ts">
import { ref, computed } from 'vue';
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
        <header class="page-head">
            <div>
                <h1 class="page-title">Müstahsiller</h1>
                <p class="page-sub">{{ formatNumber(caykur.producers.length) }} kayıtlı müstahsil</p>
            </div>
        </header>

        <!-- ── Toolbar ── -->
        <div class="toolbar">
            <div class="search-wrap">
                <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input
                    v-model="search"
                    type="text"
                    class="search-input"
                    placeholder="Ad veya ruhsat no ara…"
                    aria-label="Müstahsil ara"
                />
            </div>

            <div class="seg" role="group" aria-label="Bölge filtresi">
                <button
                    v-for="opt in regionOptions"
                    :key="opt.value"
                    type="button"
                    class="seg-btn"
                    :class="{ 'is-active': region === opt.value }"
                    @click="region = opt.value"
                >
                    {{ opt.label }}
                </button>
            </div>

            <div class="seg" role="group" aria-label="Budama durumu filtresi">
                <button
                    v-for="opt in statusOptions"
                    :key="opt.value"
                    type="button"
                    class="seg-btn"
                    :class="{ 'is-active': status === opt.value }"
                    @click="status = opt.value"
                >
                    {{ opt.label }}
                </button>
            </div>
        </div>

        <!-- ── Table ── -->
        <section class="panel">
            <div class="panel-head">
                <span class="result-count">{{ formatNumber(filtered.length) }} müstahsil</span>
            </div>

            <div v-if="filtered.length > 0" class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Müstahsil</th>
                            <th>Bölge</th>
                            <th class="num">Ruhsatlı alan</th>
                            <th class="num">Sezon</th>
                            <th>Kota kullanımı</th>
                            <th>Budama</th>
                            <th aria-label="Detay"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="p in filtered"
                            :key="p.id"
                            class="row-link"
                            @click="openProducer(p.id)"
                        >
                            <td>
                                <div class="producer-cell">
                                    <span class="producer-avatar" aria-hidden="true">{{ p.fullName.charAt(0) }}</span>
                                    <div class="producer-id">
                                        <span class="producer-name">
                                            {{ p.fullName }}
                                            <span v-if="p.organic" class="organic-tag">Organik</span>
                                        </span>
                                        <span class="producer-ruhsat">Ruhsat {{ p.ruhsatNo }}</span>
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
                                <div class="cell-meter">
                                    <ComplianceMeter
                                        :value="kotaUsagePct(p)"
                                        :max="120"
                                        :tone="kotaTone(kotaUsagePct(p))"
                                        :height="6"
                                    />
                                    <span class="cell-meter-val">{{ formatPct(kotaUsagePct(p)) }}</span>
                                </div>
                            </td>
                            <td>
                                <ComplianceBadge :status="budamaStatus(p)" />
                            </td>
                            <td class="chevron-cell">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div v-else class="empty-state">
                <p class="empty-title">Eşleşen müstahsil yok</p>
                <p class="empty-sub">Arama ve filtreleri değiştirmeyi deneyin.</p>
                <button type="button" class="empty-reset" @click="resetFilters">Filtreleri temizle</button>
            </div>
        </section>
    </CaykurLayout>
</template>

<style scoped>
.page-head {
    margin-bottom: var(--space-5);
}
.page-title {
    font-size: var(--font-size-3xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
    letter-spacing: -0.02em;
    margin: 0;
}
.page-sub {
    margin: 6px 0 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
}

/* ── Toolbar ── */
.toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
}
.search-wrap {
    position: relative;
    flex: 1 1 260px;
    min-width: 220px;
}
.search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-text-muted);
    pointer-events: none;
}
.search-input {
    width: 100%;
    height: var(--control-height);
    padding: 0 var(--space-4) 0 40px;
    background: var(--color-input-bg);
    border: 1px solid var(--color-input-border);
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
    font-family: var(--font-family);
    transition: all var(--transition-fast);
}
.search-input::placeholder {
    color: var(--color-text-muted);
}
.search-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
}

.seg {
    display: inline-flex;
    padding: 3px;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    gap: 2px;
}
.seg-btn {
    min-height: 36px;
    padding: 0 var(--space-3);
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    white-space: nowrap;
    transition: all var(--transition-fast);
}
.seg-btn:hover {
    color: var(--color-text-primary);
}
.seg-btn.is-active {
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    box-shadow: var(--shadow-sm);
}

/* ── Panel + table ── */
.panel {
    background: var(--color-card-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
}
.panel-head {
    padding: var(--space-4) var(--space-5);
}
.result-count {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary);
}

.table-wrap {
    overflow-x: auto;
}
.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-sm);
}
.data-table th {
    text-align: left;
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary);
    padding: 10px var(--space-5);
    border-top: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-primary);
    white-space: nowrap;
}
.data-table th.num {
    text-align: right;
}
.data-table td {
    padding: 12px var(--space-5);
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-primary);
    vertical-align: middle;
}
.data-table tbody tr:last-child td {
    border-bottom: none;
}
.data-table td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}
.row-link {
    cursor: pointer;
    transition: background var(--transition-fast);
}
.row-link:hover {
    background: var(--color-bg-primary);
}

.producer-cell {
    display: flex;
    align-items: center;
    gap: var(--space-3);
}
.producer-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    font-weight: var(--font-weight-bold);
    flex-shrink: 0;
}
.producer-id {
    display: flex;
    flex-direction: column;
    min-width: 0;
}
.producer-name {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
}
.organic-tag {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-success);
    background: color-mix(in srgb, var(--color-success) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-success) 24%, transparent);
    padding: 1px 7px;
    border-radius: var(--radius-full);
}
.producer-ruhsat {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
}
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
.cell-meter {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 150px;
}
.cell-meter-val {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
    min-width: 42px;
    text-align: right;
}
.chevron-cell {
    text-align: right;
    color: var(--color-text-muted);
    width: 40px;
}

/* ── Empty ── */
.empty-state {
    text-align: center;
    padding: var(--space-12) var(--space-5);
}
.empty-title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    margin: 0 0 6px;
}
.empty-sub {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    margin: 0 0 var(--space-4);
}
.empty-reset {
    min-height: 40px;
    padding: 0 var(--space-4);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
}
.empty-reset:hover {
    background: var(--color-bg-tertiary);
}

@media (max-width: 720px) {
    .seg {
        overflow-x: auto;
    }
}
</style>
