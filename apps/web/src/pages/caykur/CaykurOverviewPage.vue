<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useCaykurStore } from '@/stores/caykurStore';
import {
    formatDekar,
    formatTon,
    formatPct,
    formatNumber,
    type Region,
} from '@/services/caykurData';
import CaykurLayout from '@/layouts/CaykurLayout.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import ComplianceMeter from '@/components/caykur/ComplianceMeter.vue';
import FlagChip from '@/components/caykur/FlagChip.vue';

type Tone = 'success' | 'warning' | 'danger';

const router = useRouter();
const caykur = useCaykurStore();

const o = computed(() => caykur.overview);
const flagged = computed(() => caykur.flagged);
const ops = computed(() => caykur.ops);

function go(path: string): void {
    router.push(path);
}

const surgunRows = computed(() => {
    const s = o.value.surgun;
    const total = s.s1 + s.s2 + s.s3;
    return [
        { label: '1. Sürgün', note: 'Mayıs–Haziran', kg: s.s1 },
        { label: '2. Sürgün', note: 'Temmuz–Ağustos', kg: s.s2 },
        { label: '3. Sürgün', note: 'Eylül–Ekim', kg: s.s3 },
    ].map((r) => ({ ...r, pct: total > 0 ? (r.kg / total) * 100 : 0 }));
});

const opsItems = computed(() => [
    { count: ops.value.pendingDeliveries, label: 'Onay bekleyen alım', to: '/caykur/deliveries' },
    { count: ops.value.pendingAudits, label: 'Denetim bekleyen budama', to: '/caykur/pruning' },
    { count: ops.value.parcelsPendingVerification, label: 'Doğrulanacak parsel', to: '/caykur/parcels' },
    { count: ops.value.paymentsAwaitingApproval, label: 'Onay bekleyen ödeme', to: '/caykur/finance' },
    { count: ops.value.openRequests, label: 'Açık talep', to: '/caykur/requests' },
    { count: ops.value.overdueTasks, label: 'Geciken görev', to: '/caykur/tasks' },
]);

function kotaTone(pct: number): Tone {
    if (pct > 100) return 'danger';
    if (pct >= 90) return 'warning';
    return 'success';
}

function budamaTone(pct: number): Tone {
    if (pct >= 70) return 'success';
    if (pct >= 50) return 'warning';
    return 'danger';
}

function regionLabel(region: Region): string {
    return region;
}

function openProducer(id: string): void {
    router.push(`/caykur/producers/${id}`);
}

function openProducers(): void {
    router.push('/caykur/producers');
}
</script>

<template>
    <CaykurLayout>
        <!-- ── Page header ── -->
        <header class="ck-page-head">
            <div>
                <h1 class="ck-page-title">Genel Bakış</h1>
                <p class="ck-page-sub">
                    {{ o.season }} · {{ formatNumber(o.producerCount) }} müstahsil ·
                    {{ o.regions.length }} bölge
                </p>
            </div>
        </header>

        <!-- ── KPI cards ── -->
        <section class="ck-kpi-grid overview-kpis" aria-label="Özet göstergeler">
            <CaykurStatCard
                label="Toplam müstahsil"
                :value="formatNumber(o.producerCount)"
                :sub="`${formatNumber(o.organicCount)} organik üretici`"
            />
            <CaykurStatCard
                label="Ruhsatlı alan"
                :value="formatNumber(o.totalDekar, 1)"
                unit="da"
                sub="toplam çaylık alanı"
            />
            <CaykurStatCard
                label="Bu sezon yaş çay"
                :value="formatNumber(o.seasonKg / 1000, 1)"
                unit="ton"
                :sub="`kota: ${formatTon(o.quotaKg)}`"
            />
            <CaykurStatCard
                label="Kota kullanımı"
                :value="formatPct(o.kotaUsagePct)"
                sub="kotaya göre"
            >
                <ComplianceMeter :value="o.kotaUsagePct" :max="120" :tone="kotaTone(o.kotaUsagePct)" />
            </CaykurStatCard>
            <CaykurStatCard
                label="Budama uyumu"
                :value="formatPct(o.budamaCompliancePct)"
                sub="1/7 rotasyon kuralı"
            >
                <ComplianceMeter :value="o.budamaCompliancePct" :tone="budamaTone(o.budamaCompliancePct)" />
            </CaykurStatCard>
            <CaykurStatCard
                label="Dikkat gerektiren"
                :value="formatNumber(flagged.length)"
                sub="müstahsil incelenmeli"
            />
        </section>

        <!-- ── Operational work queue (cross-module) ── -->
        <section aria-label="Bekleyen işler">
            <h2 class="ops-title">Bekleyen işler</h2>
            <div class="ops-strip">
                <button
                    v-for="item in opsItems"
                    :key="item.to"
                    type="button"
                    class="ops-card"
                    @click="go(item.to)"
                >
                    <span class="ops-val">
                        {{ formatNumber(item.count) }}
                        <span v-if="item.count > 0" class="ops-flag" aria-hidden="true"></span>
                    </span>
                    <span class="ops-label">{{ item.label }}</span>
                    <svg class="ops-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
            </div>
        </section>

        <!-- ── Main grid ── -->
        <div class="overview-grid">
            <div class="overview-main">
                <!-- Region rollup -->
                <section class="ck-panel">
                    <div class="ck-panel-head">
                        <h2 class="ck-panel-title">Bölge bazında dağılım</h2>
                    </div>
                    <div class="ck-table-wrap">
                        <table class="ck-table ck-table--dense">
                            <thead>
                                <tr>
                                    <th>Bölge</th>
                                    <th class="num">Müstahsil</th>
                                    <th class="num">Ruhsatlı alan</th>
                                    <th class="num">Sezon</th>
                                    <th>Kota kullanımı</th>
                                    <th>Budama uyumu</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="r in o.regions" :key="r.region">
                                    <td class="strong">{{ regionLabel(r.region) }}</td>
                                    <td class="num">{{ formatNumber(r.producerCount) }}</td>
                                    <td class="num">{{ formatDekar(r.totalDekar) }}</td>
                                    <td class="num">{{ formatTon(r.seasonKg) }}</td>
                                    <td>
                                        <div class="ck-cell-meter">
                                            <ComplianceMeter
                                                :value="r.kotaUsagePct"
                                                :max="120"
                                                :tone="kotaTone(r.kotaUsagePct)"
                                                :height="6"
                                            />
                                            <span class="ck-cell-meter-val">{{ formatPct(r.kotaUsagePct) }}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="ck-cell-meter">
                                            <ComplianceMeter
                                                :value="r.budamaCompliancePct"
                                                :tone="budamaTone(r.budamaCompliancePct)"
                                                :height="6"
                                            />
                                            <span class="ck-cell-meter-val">{{ formatPct(r.budamaCompliancePct) }}</span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <!-- Sürgün distribution -->
                <section class="ck-panel">
                    <div class="ck-panel-head">
                        <h2 class="ck-panel-title">Sürgün dağılımı</h2>
                        <span class="ck-panel-meta">{{ formatTon(o.seasonKg) }} toplam</span>
                    </div>
                    <div class="surgun-list">
                        <div v-for="row in surgunRows" :key="row.label" class="surgun-row">
                            <div class="surgun-label">
                                <span class="surgun-name">{{ row.label }}</span>
                                <span class="surgun-note">{{ row.note }}</span>
                            </div>
                            <div class="surgun-bar-track">
                                <div class="surgun-bar-fill" :style="{ width: `${row.pct}%` }"></div>
                            </div>
                            <div class="surgun-vals">
                                <span class="surgun-kg">{{ formatTon(row.kg) }}</span>
                                <span class="surgun-pct">{{ formatPct(row.pct) }}</span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            <!-- Flagged producers -->
            <aside class="ck-panel flagged-panel" aria-label="Dikkat gerektiren müstahsiller">
                <div class="ck-panel-head">
                    <h2 class="ck-panel-title">Dikkat gerektirenler</h2>
                    <span class="flagged-count">{{ formatNumber(flagged.length) }}</span>
                </div>
                <ul class="flagged-list">
                    <li
                        v-for="row in flagged.slice(0, 8)"
                        :key="row.producer.id"
                        class="flagged-item"
                        role="button"
                        tabindex="0"
                        @click="openProducer(row.producer.id)"
                        @keydown.enter="openProducer(row.producer.id)"
                    >
                        <div class="flagged-top">
                            <span class="flagged-name">{{ row.producer.fullName }}</span>
                            <svg class="flagged-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                        </div>
                        <span class="flagged-meta">{{ row.producer.region }} · {{ row.producer.factory }}</span>
                        <div class="flagged-flags">
                            <FlagChip
                                v-for="(f, i) in row.flags"
                                :key="i"
                                :severity="f.severity"
                                :label="f.label"
                            />
                        </div>
                    </li>
                </ul>
                <button type="button" class="ck-btn flagged-all" @click="openProducers">
                    Tüm müstahsilleri gör
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                </button>
            </aside>
        </div>
    </CaykurLayout>
</template>

<style scoped>
/* Six headline figures on one row once there's room; orderly halves below. */
.overview-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
}
@media (min-width: 700px) {
    .overview-kpis {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}
@media (min-width: 1240px) {
    .overview-kpis {
        grid-template-columns: repeat(6, minmax(0, 1fr));
    }
}

/* ── Operational work queue ── */
.ops-title {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    margin: 0 0 var(--space-3);
}
.ops-strip {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: var(--space-3);
    margin-bottom: var(--space-6);
}
@media (max-width: 1100px) {
    .ops-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 560px) {
    .ops-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.ops-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-3) var(--space-4);
    background: var(--color-card-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    transition: border-color var(--transition-fast), background var(--transition-fast);
}
.ops-card:hover {
    border-color: var(--color-border-strong);
    background: var(--color-bg-primary);
}
.ops-card:hover .ops-chevron {
    opacity: 1;
    transform: none;
}
.ops-card:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
}
.ops-val {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
}
.ops-flag {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-warning);
    flex-shrink: 0;
}
.ops-label {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-muted);
}
.ops-chevron {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
    color: var(--color-text-muted);
    opacity: 0;
    transform: translateX(-3px);
    transition: opacity var(--transition-fast), transform var(--transition-fast);
}

/* ── Main grid ── */
.overview-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.9fr) minmax(280px, 0.9fr);
    gap: var(--space-4);
    align-items: start;
}
.overview-main .ck-cell-meter {
    min-width: 96px;
}
.overview-main {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
}
@media (max-width: 980px) {
    .overview-grid {
        grid-template-columns: minmax(0, 1fr);
    }
}

/* ── Sürgün bars ── */
.surgun-list {
    display: flex;
    flex-direction: column;
    padding: 0 var(--space-5) var(--space-5);
    gap: var(--space-4);
}
.surgun-row {
    display: grid;
    grid-template-columns: 150px minmax(0, 1fr) 130px;
    align-items: center;
    gap: var(--space-4);
}
@media (max-width: 560px) {
    .surgun-row {
        grid-template-columns: 110px minmax(0, 1fr) 110px;
        gap: var(--space-2);
    }
}
.surgun-label {
    display: flex;
    flex-direction: column;
}
.surgun-name {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
}
.surgun-note {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
}
.surgun-bar-track {
    height: 8px;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-full);
    overflow: hidden;
}
/* Volume is informational data, not success: Field Blue, not the working green. */
.surgun-bar-fill {
    height: 100%;
    background: var(--color-secondary);
    border-radius: var(--radius-full);
    transition: width var(--transition-normal);
}
.surgun-vals {
    display: flex;
    align-items: baseline;
    justify-content: flex-end;
    gap: var(--space-2);
}
.surgun-kg {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
}
.surgun-pct {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    min-width: 40px;
    text-align: right;
    font-variant-numeric: tabular-nums;
}

/* ── Flagged panel ── */
.flagged-panel {
    display: flex;
    flex-direction: column;
}
.flagged-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 26px;
    height: 24px;
    padding: 0 8px;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-bold);
    font-variant-numeric: tabular-nums;
    color: var(--color-danger);
    background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    border-radius: var(--radius-full);
}
.flagged-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
}
.flagged-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: var(--space-4) var(--space-5);
    border-top: 1px solid var(--color-border);
    cursor: pointer;
    transition: background var(--transition-fast);
}
.flagged-item:hover {
    background: var(--color-bg-primary);
}
.flagged-item:focus-visible {
    outline: none;
    box-shadow: inset var(--focus-ring);
}
.flagged-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
}
.flagged-name {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
}
.flagged-chevron {
    color: var(--color-text-muted);
    flex-shrink: 0;
}
.flagged-meta {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
}
.flagged-flags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 2px;
}
.flagged-all {
    margin: var(--space-4) var(--space-5) var(--space-5);
    min-height: 44px;
}

@media (prefers-reduced-motion: reduce) {
    .surgun-bar-fill,
    .ops-chevron {
        transition: none;
    }
}
</style>
