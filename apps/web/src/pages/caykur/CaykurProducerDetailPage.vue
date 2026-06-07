<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCaykurStore } from '@/stores/caykurStore';
import {
    budamaStatus,
    budamaRatioPct,
    kotaUsagePct,
    kotaTone,
    statusTone,
    qualityStatus,
    producerFlags,
    formatDekar,
    formatKg,
    formatPct,
    formatNumber,
    BUDAMA_TARGET_PCT,
} from '@/services/caykurData';
import CaykurLayout from '@/layouts/CaykurLayout.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import ComplianceBadge from '@/components/caykur/ComplianceBadge.vue';
import ComplianceMeter from '@/components/caykur/ComplianceMeter.vue';
import FlagChip from '@/components/caykur/FlagChip.vue';

const route = useRoute();
const router = useRouter();
const caykur = useCaykurStore();

const BASE_YEAR = 2025;

const producer = computed(() => caykur.producerById(String(route.params.id)));

const rotation = computed(() => {
    const p = producer.value;
    if (!p) return [];
    const len = p.rotationHistory.length;
    return p.rotationHistory.map((pruned, i) => ({
        year: BASE_YEAR - (len - 1) + i,
        pruned,
        current: BASE_YEAR - (len - 1) + i === BASE_YEAR,
    }));
});

const prunedYears = computed(() => rotation.value.filter((r) => r.pruned).length);
const budama = computed(() => (producer.value ? budamaStatus(producer.value) : 'noncompliant'));
const quality = computed(() => (producer.value ? qualityStatus(producer.value) : 'noncompliant'));
const flags = computed(() => (producer.value ? producerFlags(producer.value) : []));
const tazminatEligible = computed(() => budama.value === 'compliant' && prunedYears.value >= 5);

const surgunRows = computed(() => {
    const p = producer.value;
    if (!p) return [];
    const total = p.surgun.s1 + p.surgun.s2 + p.surgun.s3;
    return [
        { label: '1. Sürgün', kg: p.surgun.s1 },
        { label: '2. Sürgün', kg: p.surgun.s2 },
        { label: '3. Sürgün', kg: p.surgun.s3 },
    ].map((r) => ({ ...r, pct: total > 0 ? (r.kg / total) * 100 : 0 }));
});

function goBack(): void {
    router.push('/caykur/producers');
}
</script>

<template>
    <CaykurLayout>
        <button type="button" class="back-link" @click="goBack">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Müstahsiller
        </button>

        <template v-if="producer">
            <!-- ── Header ── -->
            <header class="detail-head">
                <span class="detail-avatar" aria-hidden="true">{{ producer.fullName.charAt(0) }}</span>
                <div class="detail-id">
                    <h1 class="detail-name">
                        {{ producer.fullName }}
                        <span v-if="producer.organic" class="organic-tag">Organik</span>
                    </h1>
                    <p class="detail-meta">
                        {{ producer.region }} / {{ producer.district }} · {{ producer.factory }}
                    </p>
                    <p class="detail-ids">
                        <span>Ruhsat <strong>{{ producer.ruhsatNo }}</strong></span>
                        <span>Cüzdan <strong>{{ producer.cuzdanNo }}</strong></span>
                    </p>
                </div>
            </header>

            <!-- ── Active issues ── -->
            <div v-if="flags.length > 0" class="issues">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                <span class="issues-label">Açık uyarılar:</span>
                <div class="issues-flags">
                    <FlagChip v-for="(f, i) in flags" :key="i" :severity="f.severity" :label="f.label" />
                </div>
            </div>

            <!-- ── Summary cards ── -->
            <section class="summary-grid">
                <CaykurStatCard
                    label="Ruhsatlı alan"
                    :value="formatDekar(producer.licensedDekar)"
                    sub="ruhsatlı çaylık"
                />
                <CaykurStatCard
                    label="Bu sezon alınan"
                    :value="formatKg(producer.seasonKg)"
                    :sub="`kota: ${formatKg(producer.quotaKg)}`"
                />
                <CaykurStatCard
                    label="Kota kullanımı"
                    :value="formatPct(kotaUsagePct(producer))"
                    sub="sezon kotasına göre"
                >
                    <ComplianceMeter
                        :value="kotaUsagePct(producer)"
                        :max="120"
                        :tone="kotaTone(kotaUsagePct(producer))"
                    />
                </CaykurStatCard>
                <CaykurStatCard
                    label="Kalite"
                    :value="formatPct(producer.outOfStandardPct, 1)"
                    sub="standart dışı oranı"
                >
                    <ComplianceBadge :status="quality" />
                </CaykurStatCard>
            </section>

            <div class="detail-grid">
                <div class="detail-main">
                    <!-- ── Budama rotation (hero) ── -->
                    <section class="panel rotation-panel">
                        <div class="panel-head">
                            <div>
                                <h2 class="panel-title">Budama rotasyonu</h2>
                                <p class="panel-desc">7 yıllık döngü — her yıl bahçenin 1/7'si budanır</p>
                            </div>
                            <ComplianceBadge :status="budama" />
                        </div>

                        <div class="rotation-track">
                            <div
                                v-for="r in rotation"
                                :key="r.year"
                                class="rot-tile"
                                :data-pruned="r.pruned ? 'yes' : 'no'"
                                :data-current="r.current ? 'yes' : 'no'"
                            >
                                <span class="rot-year">{{ r.year }}</span>
                                <span class="rot-ind" aria-hidden="true">
                                    <svg v-if="r.pruned" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                </span>
                                <span class="rot-state">{{ r.pruned ? 'Budandı' : 'Yapılmadı' }}</span>
                                <span v-if="r.current" class="rot-current">Bu yıl</span>
                            </div>
                        </div>

                        <div class="rotation-foot">
                            <div class="ratio-block">
                                <div class="ratio-head">
                                    <span class="ratio-label">Bu yıl budanan oran</span>
                                    <span class="ratio-val">{{ formatPct(budamaRatioPct(producer), 1) }}</span>
                                </div>
                                <ComplianceMeter
                                    :value="budamaRatioPct(producer)"
                                    :max="25"
                                    :marker="BUDAMA_TARGET_PCT"
                                    :tone="statusTone(budama)"
                                    :height="10"
                                />
                                <span class="ratio-hint">Hedef: 1/7 ≈ %14,3 · son 7 yılda {{ prunedYears }} yıl budandı</span>
                            </div>

                            <div class="tazminat" :data-eligible="tazminatEligible ? 'yes' : 'no'">
                                <span class="tazminat-label">Budama tazminatı</span>
                                <span class="tazminat-state">{{ tazminatEligible ? 'Uygun' : 'İncelenmeli' }}</span>
                            </div>
                        </div>
                    </section>

                    <!-- ── Sürgün breakdown ── -->
                    <section class="panel">
                        <div class="panel-head">
                            <h2 class="panel-title">Sürgün dağılımı</h2>
                            <span class="panel-meta">{{ formatKg(producer.seasonKg) }}</span>
                        </div>
                        <div class="surgun-list">
                            <div v-for="row in surgunRows" :key="row.label" class="surgun-row">
                                <span class="surgun-name">{{ row.label }}</span>
                                <div class="surgun-bar-track">
                                    <div class="surgun-bar-fill" :style="{ width: `${row.pct}%` }"></div>
                                </div>
                                <span class="surgun-kg">{{ formatKg(row.kg) }}</span>
                            </div>
                        </div>
                    </section>
                </div>

                <!-- ── Ruhsat / identity ── -->
                <aside class="panel info-panel">
                    <div class="panel-head">
                        <h2 class="panel-title">Ruhsat bilgileri</h2>
                    </div>
                    <dl class="info-list">
                        <div class="info-row"><dt>Ruhsat no</dt><dd>{{ producer.ruhsatNo }}</dd></div>
                        <div class="info-row"><dt>Cüzdan no</dt><dd>{{ producer.cuzdanNo }}</dd></div>
                        <div class="info-row"><dt>Bölge</dt><dd>{{ producer.region }}</dd></div>
                        <div class="info-row"><dt>İlçe</dt><dd>{{ producer.district }}</dd></div>
                        <div class="info-row"><dt>Bağlı fabrika</dt><dd>{{ producer.factory }}</dd></div>
                        <div class="info-row"><dt>Ruhsatlı alan</dt><dd>{{ formatDekar(producer.licensedDekar) }}</dd></div>
                        <div class="info-row"><dt>Çaylık alanı</dt><dd>{{ formatNumber(producer.gardenM2) }} m²</dd></div>
                        <div class="info-row"><dt>Üretim tipi</dt><dd>{{ producer.organic ? 'Organik' : 'Konvansiyonel' }}</dd></div>
                    </dl>
                </aside>
            </div>
        </template>

        <!-- ── Not found ── -->
        <div v-else class="empty-state">
            <p class="empty-title">Müstahsil bulunamadı</p>
            <button type="button" class="empty-reset" @click="goBack">Müstahsillere dön</button>
        </div>
    </CaykurLayout>
</template>

<style scoped>
.back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: var(--space-5);
    background: none;
    border: none;
    padding: 0;
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    transition: color var(--transition-fast);
}
.back-link:hover {
    color: var(--color-primary);
}

/* ── Header ── */
.detail-head {
    display: flex;
    align-items: flex-start;
    gap: var(--space-4);
    margin-bottom: var(--space-5);
}
.detail-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: var(--radius-lg);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    flex-shrink: 0;
}
.detail-id {
    min-width: 0;
}
.detail-name {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
    letter-spacing: -0.01em;
    margin: 0;
}
.organic-tag {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-success);
    background: color-mix(in srgb, var(--color-success) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-success) 24%, transparent);
    padding: 2px 9px;
    border-radius: var(--radius-full);
}
.detail-meta {
    margin: 5px 0 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
}
.detail-ids {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin: 6px 0 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
}
.detail-ids strong {
    color: var(--color-text-secondary);
    font-weight: var(--font-weight-semibold);
}

/* ── Issues banner ── */
.issues {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    padding: var(--space-3) var(--space-4);
    margin-bottom: var(--space-5);
    background: color-mix(in srgb, var(--color-warning) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-warning) 24%, transparent);
    border-radius: var(--radius-md);
    color: var(--color-warning);
}
.issues-label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
}
.issues-flags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

/* ── Summary cards ── */
.summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-4);
    margin-bottom: var(--space-4);
}
@media (max-width: 880px) {
    .summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

/* ── Detail grid ── */
.detail-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) minmax(280px, 1fr);
    gap: var(--space-4);
    align-items: start;
}
.detail-main {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
}
@media (max-width: 880px) {
    .detail-grid {
        grid-template-columns: minmax(0, 1fr);
    }
}

/* ── Panel ── */
.panel {
    background: var(--color-card-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
}
.panel-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-5) var(--space-5) var(--space-4);
}
.panel-title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    margin: 0;
}
.panel-desc {
    margin: 3px 0 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
}
.panel-meta {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
}

/* ── Rotation timeline ── */
.rotation-track {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: var(--space-2);
    padding: 0 var(--space-5);
}
.rot-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: var(--space-3) 4px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    background: var(--color-bg-primary);
    position: relative;
}
.rot-tile[data-pruned='yes'] {
    background: color-mix(in srgb, var(--color-success) 8%, transparent);
    border-color: color-mix(in srgb, var(--color-success) 28%, transparent);
}
.rot-tile[data-pruned='no'] {
    background: color-mix(in srgb, var(--color-danger) 6%, transparent);
    border-color: color-mix(in srgb, var(--color-danger) 20%, transparent);
}
.rot-tile[data-current='yes'] {
    box-shadow: 0 0 0 2px var(--color-text-primary);
}
.rot-year {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
}
.rot-ind {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
}
.rot-tile[data-pruned='yes'] .rot-ind {
    background: var(--color-success);
    color: var(--color-on-primary);
}
.rot-tile[data-pruned='no'] .rot-ind {
    background: color-mix(in srgb, var(--color-danger) 14%, transparent);
    color: var(--color-danger);
}
.rot-state {
    font-size: 11px;
    font-weight: var(--font-weight-medium);
    color: var(--color-text-muted);
}
.rot-current {
    position: absolute;
    top: -9px;
    font-size: 10px;
    font-weight: var(--font-weight-bold);
    color: var(--color-text-inverse);
    background: var(--color-text-primary);
    padding: 1px 7px;
    border-radius: var(--radius-full);
}

.rotation-foot {
    display: flex;
    align-items: stretch;
    gap: var(--space-4);
    padding: var(--space-5);
    flex-wrap: wrap;
}
.ratio-block {
    flex: 1 1 280px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.ratio-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
}
.ratio-label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary);
}
.ratio-val {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
}
.ratio-hint {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
}
.tazminat {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    min-width: 130px;
}
.tazminat[data-eligible='yes'] {
    background: color-mix(in srgb, var(--color-success) 8%, transparent);
    border-color: color-mix(in srgb, var(--color-success) 26%, transparent);
}
.tazminat[data-eligible='no'] {
    background: color-mix(in srgb, var(--color-warning) 8%, transparent);
    border-color: color-mix(in srgb, var(--color-warning) 26%, transparent);
}
.tazminat-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
}
.tazminat-state {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
}
.tazminat[data-eligible='yes'] .tazminat-state {
    color: var(--color-success);
}
.tazminat[data-eligible='no'] .tazminat-state {
    color: var(--color-warning);
}

/* ── Sürgün ── */
.surgun-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: 0 var(--space-5) var(--space-5);
}
.surgun-row {
    display: grid;
    grid-template-columns: 90px minmax(0, 1fr) 110px;
    align-items: center;
    gap: var(--space-3);
}
.surgun-name {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
}
.surgun-bar-track {
    height: 10px;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-full);
    overflow: hidden;
}
.surgun-bar-fill {
    height: 100%;
    background: var(--color-border-strong);
    border-radius: var(--radius-full);
}
.surgun-kg {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
    text-align: right;
}

/* ── Info list ── */
.info-list {
    margin: 0;
    padding: 0 var(--space-5) var(--space-2);
}
.info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--color-border);
}
.info-row:last-child {
    border-bottom: none;
}
.info-row dt {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
}
.info-row dd {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    text-align: right;
    font-variant-numeric: tabular-nums;
}

/* ── Empty ── */
.empty-state {
    text-align: center;
    padding: var(--space-16) var(--space-5);
}
.empty-title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
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

@media (max-width: 560px) {
    .rot-state {
        display: none;
    }
}
</style>
