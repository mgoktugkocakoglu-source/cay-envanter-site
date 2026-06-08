<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import CaykurPage from '@/components/caykur/CaykurPage.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import ComplianceBadge from '@/components/caykur/ComplianceBadge.vue';
import ComplianceMeter from '@/components/caykur/ComplianceMeter.vue';
import {
    MEASUREMENTS,
    pruningSummary,
    AUDIT_STATUS_META,
    METHOD_LABEL,
    statusTone,
    BUDAMA_TARGET_PCT,
    formatNumber,
    formatPct,
    formatDate,
    type AuditStatus,
    type Region,
} from '@/services/caykur';

const router = useRouter();

type View = 'all' | 'pending' | 'rejected';
const view = ref<View>('pending');
const search = ref('');
const region = ref<'all' | Region>('all');

const summary = computed(() => pruningSummary());

const filtered = computed(() => {
    const q = search.value.trim().toLocaleLowerCase('tr');
    return MEASUREMENTS.filter((m) => {
        if (view.value !== 'all' && m.auditStatus !== view.value) return false;
        if (region.value !== 'all' && m.region !== region.value) return false;
        if (q && !`${m.producerName} ${m.parcelLabel}`.toLocaleLowerCase('tr').includes(q)) return false;
        return true;
    });
});

const regionOptions: Array<{ value: 'all' | Region; label: string }> = [
    { value: 'all', label: 'Tüm bölgeler' },
    { value: 'Rize', label: 'Rize' },
    { value: 'Trabzon', label: 'Trabzon' },
    { value: 'Artvin', label: 'Artvin' },
    { value: 'Giresun', label: 'Giresun' },
];

function ratioTone(pct: number): 'success' | 'warning' | 'danger' {
    if (pct >= 11 && pct <= 20) return 'success';
    if (pct >= 6) return 'warning';
    return 'danger';
}

function openMeasurement(id: string): void {
    router.push(`/caykur/pruning/${id}`);
}
</script>

<template>
    <CaykurPage title="Budama Denetimi" :sub="`1/7 rotasyon kuralı · hedef %${formatNumber(summary.targetPct, 1)}`">
        <section class="ck-kpi-grid">
            <CaykurStatCard label="Toplam ölçüm" :value="formatNumber(summary.total)" sub="bu sezon" />
            <CaykurStatCard label="Denetim bekleyen" :value="formatNumber(summary.pending)" sub="onay sırasında" />
            <CaykurStatCard label="Uyumlu" :value="formatNumber(summary.compliant)" sub="1/7 bandında" />
            <CaykurStatCard label="Uyarılı ölçüm" :value="formatNumber(summary.warnings)" sub="taşma/çakışma" />
        </section>

        <div class="ck-seg" role="group" aria-label="Görünüm" style="margin-bottom: var(--space-4)">
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'pending' }" @click="view = 'pending'">Denetim bekleyenler</button>
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'all' }" @click="view = 'all'">Tüm ölçümler</button>
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'rejected' }" @click="view = 'rejected'">Reddedilenler</button>
        </div>

        <div class="ck-toolbar">
            <div class="ck-search-wrap">
                <svg class="ck-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input v-model="search" type="text" class="ck-search-input" placeholder="Müstahsil veya parsel ara…" />
            </div>
            <div class="ck-seg" role="group" aria-label="Bölge filtresi">
                <button v-for="opt in regionOptions" :key="opt.value" type="button" class="ck-seg-btn" :class="{ 'is-active': region === opt.value }" @click="region = opt.value">{{ opt.label }}</button>
            </div>
        </div>

        <CaykurPanel>
            <template #head><span class="ck-panel-meta">{{ formatNumber(filtered.length) }} ölçüm</span></template>
            <div v-if="filtered.length" class="ck-table-wrap">
                <table class="ck-table">
                    <thead>
                        <tr>
                            <th>Müstahsil</th>
                            <th>Parsel</th>
                            <th>Yöntem</th>
                            <th>Budama oranı</th>
                            <th>Uygunluk</th>
                            <th>Denetim</th>
                            <th>Tarih</th>
                            <th aria-label="Detay"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="m in filtered" :key="m.id" class="ck-row-link" @click="openMeasurement(m.id)">
                            <td>
                                <span class="strong" style="display:block">{{ m.producerName }}</span>
                                <span class="ck-name-sub">{{ m.region }} · {{ m.factory }}</span>
                            </td>
                            <td>{{ m.parcelLabel }}</td>
                            <td>{{ METHOD_LABEL[m.method] }}</td>
                            <td>
                                <div class="ck-cell-meter">
                                    <ComplianceMeter :value="m.ratioPercent" :max="25" :marker="BUDAMA_TARGET_PCT" :tone="ratioTone(m.ratioPercent)" :height="6" />
                                    <span class="ck-cell-meter-val">{{ formatPct(m.ratioPercent, 1) }}</span>
                                </div>
                            </td>
                            <td><ComplianceBadge :status="m.status" /></td>
                            <td>
                                <span class="warn-row">
                                    <StatusPill :label="AUDIT_STATUS_META[m.auditStatus].label" :tone="AUDIT_STATUS_META[m.auditStatus].tone" />
                                    <svg v-if="m.overflowWarning || m.overlapWarning" class="warn-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                </span>
                            </td>
                            <td style="white-space:nowrap">{{ formatDate(m.measuredAt) }}</td>
                            <td class="ck-chevron-cell"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div v-else class="ck-empty"><p class="ck-empty-title">Kayıt yok</p></div>
        </CaykurPanel>
    </CaykurPage>
</template>

<style scoped>
.warn-row { display: inline-flex; align-items: center; gap: 6px; }
.warn-ico { color: var(--color-warning); }
</style>
