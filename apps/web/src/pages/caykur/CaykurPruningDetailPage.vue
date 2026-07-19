<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CaykurLayout from '@/layouts/CaykurLayout.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import { api, type PruningMeasurement, type PruningStatus, type PruningMethod } from '@/services/api';
import {
    BUDAMA_TARGET_PCT,
    formatNumber,
    formatPct,
    formatDateTime,
} from '@/services/caykur';

const route = useRoute();
const router = useRouter();

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'muted';

const STATUS_META: Record<PruningStatus, { label: string; tone: Tone }> = {
    measured: { label: 'Ölçüldü · onay bekliyor', tone: 'info' },
    producer_approved: { label: 'Müstahsil onayladı', tone: 'info' },
    staff_approved: { label: 'Personel onayladı', tone: 'success' },
    completed: { label: 'Tamamlandı', tone: 'success' },
    rejected: { label: 'Reddedildi', tone: 'danger' },
};

const METHOD_LABEL: Record<PruningMethod, string> = {
    map: 'Harita çizimi',
    gps: 'GPS / RTK',
    assisted: 'Asistan ölçüm',
    imu: 'Lazer + IMU',
};

const loading = ref(true);
const error = ref<string | null>(null);
const saving = ref(false);
const m = ref<PruningMeasurement | null>(null);

async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
        const res = await api.getPruningMeasurement(String(route.params.id));
        if (res.data) m.value = res.data;
        else {
            error.value = res.error?.message ?? 'Ölçüm bulunamadı';
            m.value = null;
        }
    } catch (err) {
        error.value = err instanceof Error ? err.message : 'Ölçüm bulunamadı';
        m.value = null;
    } finally {
        loading.value = false;
    }
}

onMounted(load);

const ratioHeight = computed(() => Math.min(100, (m.value?.ratioPercent ?? 0) * 4)); // visual scale ×4
const targetHeight = computed(() => Math.min(100, BUDAMA_TARGET_PCT * 4));

async function approve(): Promise<void> {
    if (!m.value || saving.value) return;
    saving.value = true;
    error.value = null;
    try {
        const res = await api.updatePruningApproval(m.value.id, { staffApproved: true });
        if (res.data) m.value = res.data;
        else error.value = res.error?.message ?? 'Onay kaydedilemedi';
    } catch (err) {
        error.value = err instanceof Error ? err.message : 'Onay kaydedilemedi';
    } finally {
        saving.value = false;
    }
}

async function reject(): Promise<void> {
    if (!m.value || saving.value) return;
    const reason = window.prompt('Reddetme nedeni:')?.trim();
    if (!reason) return;
    saving.value = true;
    error.value = null;
    try {
        const res = await api.updatePruningApproval(m.value.id, { rejectionReason: reason });
        if (res.data) m.value = res.data;
        else error.value = res.error?.message ?? 'İşlem kaydedilemedi';
    } catch (err) {
        error.value = err instanceof Error ? err.message : 'İşlem kaydedilemedi';
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <CaykurLayout>
        <button type="button" class="ck-back-link" @click="router.push('/caykur/pruning')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Budama Denetimi
        </button>

        <div v-if="loading" class="ck-empty"><p class="ck-empty-title">Yükleniyor…</p></div>

        <template v-else-if="m">
            <header class="ck-page-head">
                <div>
                    <h1 class="ck-page-title">{{ m.producerName ?? 'Müstahsil' }}</h1>
                    <p class="ck-page-sub">Budama ölçümü<template v-if="m.parcelNo"> · {{ m.parcelNo }}</template></p>
                </div>
                <div class="ck-page-actions">
                    <StatusPill :label="STATUS_META[m.status].label" :tone="STATUS_META[m.status].tone" />
                </div>
            </header>

            <div v-if="m.rejectionReason" class="warn-banner">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                {{ m.rejectionReason }}
            </div>
            <div v-if="error" class="warn-banner">{{ error }}</div>

            <div class="ck-grid-2">
                <div>
                    <CaykurPanel title="Ölçüm bilgileri">
                        <dl class="ck-dl">
                            <div class="ck-dl-item"><span class="ck-dl-term">Yöntem</span><span class="ck-dl-val">{{ METHOD_LABEL[m.method] }}</span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">Tarih</span><span class="ck-dl-val">{{ formatDateTime(m.measuredAt) }}</span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">Parsel alanı</span><span class="ck-dl-val">{{ formatNumber(m.fieldAreaM2) }} m²</span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">Budanan alan</span><span class="ck-dl-val">{{ formatNumber(m.prunedAreaM2) }} m²</span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">Doğruluk</span><span class="ck-dl-val">{{ m.accuracyLevel === 'high' ? 'Yüksek' : m.accuracyLevel === 'medium' ? 'Orta' : m.accuracyLevel === 'low' ? 'Düşük' : '—' }}<template v-if="m.gpsAccuracyMeters"> · ±{{ m.gpsAccuracyMeters }}m</template></span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">Saha kontrolü</span><span class="ck-dl-val">{{ m.fieldCheckDone ? 'Yapıldı' : 'Yapılmadı' }}</span></div>
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
                        <div v-if="m.status !== 'rejected' && !m.staffApproved" class="decide-actions">
                            <button type="button" class="ck-btn" :disabled="saving" @click="reject">Reddet</button>
                            <button type="button" class="ck-btn ck-btn-primary" :disabled="saving" @click="approve">Denetimi onayla</button>
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
                            </div>
                        </div>
                        <p class="viz-note">1/7 rotasyon kuralı her yıl bahçenin yaklaşık %{{ formatNumber(BUDAMA_TARGET_PCT, 1) }}'ünün budanmasını öngörür. %11–20 bandı uyumlu sayılır.</p>
                    </div>
                </CaykurPanel>
            </div>
        </template>

        <div v-else class="ck-empty">
            <p class="ck-empty-title">{{ error ?? 'Ölçüm bulunamadı' }}</p>
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
