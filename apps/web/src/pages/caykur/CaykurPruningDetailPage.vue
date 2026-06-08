<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CaykurLayout from '@/layouts/CaykurLayout.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import ComplianceBadge from '@/components/caykur/ComplianceBadge.vue';
import {
    measurementById,
    AUDIT_STATUS_META,
    METHOD_LABEL,
    BUDAMA_TARGET_PCT,
    formatNumber,
    formatPct,
    formatDateTime,
    type AuditStatus,
} from '@/services/caykur';

const route = useRoute();
const router = useRouter();

const base = computed(() => measurementById(String(route.params.id)));
const localAudit = ref<AuditStatus | null>(null);
const m = computed(() => {
    const x = base.value;
    if (!x) return undefined;
    return { ...x, auditStatus: localAudit.value ?? x.auditStatus };
});

const ratioHeight = computed(() => Math.min(100, (m.value?.ratioPercent ?? 0) * 4)); // visual scale ×4
const targetHeight = computed(() => Math.min(100, BUDAMA_TARGET_PCT * 4));

function decide(next: AuditStatus): void {
    localAudit.value = next;
}
</script>

<template>
    <CaykurLayout>
        <button type="button" class="ck-back-link" @click="router.push('/caykur/pruning')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Budama Denetimi
        </button>

        <template v-if="m">
            <header class="ck-page-head">
                <div>
                    <h1 class="ck-page-title">{{ m.producerName }}</h1>
                    <p class="ck-page-sub">Budama ölçümü · {{ m.parcelLabel }} · {{ m.region }}</p>
                </div>
                <div class="ck-page-actions">
                    <ComplianceBadge :status="m.status" />
                    <StatusPill :label="AUDIT_STATUS_META[m.auditStatus].label" :tone="AUDIT_STATUS_META[m.auditStatus].tone" />
                </div>
            </header>

            <div v-if="m.overflowWarning || m.overlapWarning" class="warn-banner">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                {{ m.notes }}
            </div>

            <div class="ck-grid-2">
                <div>
                    <CaykurPanel title="Ölçüm bilgileri">
                        <dl class="ck-dl">
                            <div class="ck-dl-item"><span class="ck-dl-term">Yöntem</span><span class="ck-dl-val">{{ METHOD_LABEL[m.method] }}</span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">Ölçen personel</span><span class="ck-dl-val">{{ m.measuredBy }}</span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">Tarih</span><span class="ck-dl-val">{{ formatDateTime(m.measuredAt) }}</span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">Parsel alanı</span><span class="ck-dl-val">{{ formatNumber(m.parcelAreaM2) }} m²</span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">Budanan alan</span><span class="ck-dl-val">{{ formatNumber(m.prunedAreaM2) }} m²</span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">Doğruluk</span><span class="ck-dl-val">{{ m.accuracyLevel === 'high' ? 'Yüksek' : m.accuracyLevel === 'medium' ? 'Orta' : 'Düşük' }}<template v-if="m.gpsAccuracyMeters"> · ±{{ m.gpsAccuracyMeters }}m</template></span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">Fotoğraf</span><span class="ck-dl-val">{{ formatNumber(m.photoCount) }} adet</span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">1/7 hedef</span><span class="ck-dl-val">%{{ formatNumber(BUDAMA_TARGET_PCT, 1) }}</span></div>
                        </dl>
                    </CaykurPanel>

                    <CaykurPanel title="Onay durumu">
                        <div class="ck-panel-body approvals">
                            <div class="appr">
                                <span class="appr-label">Üretici onayı</span>
                                <StatusPill :label="m.producerApproved ? 'Onaylandı' : 'Bekliyor'" :tone="m.producerApproved ? 'success' : 'warning'" />
                            </div>
                            <div class="appr">
                                <span class="appr-label">Personel onayı</span>
                                <StatusPill :label="m.staffApproved ? 'Onaylandı' : 'Bekliyor'" :tone="m.staffApproved ? 'success' : 'warning'" />
                            </div>
                        </div>
                        <div v-if="m.auditStatus === 'pending'" class="decide-actions">
                            <button type="button" class="ck-btn" @click="decide('rejected')">Reddet</button>
                            <button type="button" class="ck-btn ck-btn-primary" @click="decide('approved')">Denetimi onayla</button>
                        </div>
                    </CaykurPanel>
                </div>

                <CaykurPanel title="Budama oranı (1/7 kuralı)">
                    <div class="ck-panel-body">
                        <div class="ratio-viz">
                            <div class="parcel-box">
                                <div class="pruned-fill" :style="{ height: `${ratioHeight}%` }">
                                    <span class="pruned-label">budanan</span>
                                </div>
                                <div class="target-line" :style="{ bottom: `${targetHeight}%` }">
                                    <span class="target-label">hedef %{{ formatNumber(BUDAMA_TARGET_PCT, 1) }}</span>
                                </div>
                            </div>
                            <div class="ratio-readout">
                                <span class="ratio-pct">{{ formatPct(m.ratioPercent, 1) }}</span>
                                <span class="ratio-sub">parselin budanan oranı</span>
                                <ComplianceBadge :status="m.status" />
                            </div>
                        </div>
                        <p class="viz-note">1/7 rotasyon kuralı her yıl bahçenin yaklaşık %{{ formatNumber(BUDAMA_TARGET_PCT, 1) }}'ünün budanmasını öngörür. %11–20 bandı uyumlu sayılır.</p>
                    </div>
                </CaykurPanel>
            </div>
        </template>

        <div v-else class="ck-empty">
            <p class="ck-empty-title">Ölçüm bulunamadı</p>
            <button type="button" class="ck-btn" @click="router.push('/caykur/pruning')">Listeye dön</button>
        </div>
    </CaykurLayout>
</template>

<style scoped>
.warn-banner {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    margin-bottom: var(--space-4);
    background: color-mix(in srgb, var(--color-warning) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-warning) 28%, transparent);
    border-radius: var(--radius-md);
    color: var(--color-warning);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
}
.approvals { display: flex; flex-direction: column; gap: var(--space-3); }
.appr { display: flex; align-items: center; justify-content: space-between; }
.appr-label { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); }
.decide-actions { display: flex; gap: var(--space-2); padding: 0 var(--space-5) var(--space-5); }
.decide-actions .ck-btn { flex: 1; }

.ratio-viz {
    display: flex;
    align-items: stretch;
    gap: var(--space-5);
}
.parcel-box {
    position: relative;
    width: 130px;
    height: 220px;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    overflow: hidden;
    flex-shrink: 0;
}
.pruned-fill {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    background: color-mix(in srgb, var(--color-primary) 26%, transparent);
    border-top: 2px solid var(--color-primary);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 4px;
}
.pruned-label {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-primary);
}
.target-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 0;
    border-top: 2px dashed var(--color-text-secondary);
}
.target-label {
    position: absolute;
    right: 4px;
    top: -16px;
    font-size: 10px;
    color: var(--color-text-secondary);
    background: var(--color-card-bg);
    padding: 0 3px;
}
.ratio-readout {
    display: flex;
    flex-direction: column;
    gap: 6px;
    justify-content: center;
}
.ratio-pct {
    font-size: var(--font-size-4xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
    line-height: 1;
    font-variant-numeric: tabular-nums;
}
.ratio-sub {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    margin-bottom: 4px;
}
.viz-note {
    margin: var(--space-4) 0 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    line-height: 1.5;
}
</style>
