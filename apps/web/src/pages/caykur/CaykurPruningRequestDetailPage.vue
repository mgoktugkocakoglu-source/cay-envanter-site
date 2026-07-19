<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CaykurLayout from '@/layouts/CaykurLayout.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import CaykurPruningMeasure from '@/components/caykur/CaykurPruningMeasure.vue';
import { usePruningRequestsStore } from '@/stores/pruningRequestsStore';
import { PRUNING_REQUEST_STATUS_META, formatNumber, formatDate, formatDateTime } from '@/services/caykur';
import type { MeasurementPoint } from '@/services/api';
import type { AccuracyLevel, MeasurementMethod } from '@/services/caykur/pruning';

const route = useRoute();
const router = useRouter();
const store = usePruningRequestsStore();

const id = computed(() => String(route.params.id));
const req = computed(() => store.byId(id.value));
const busy = ref(false);

// ── Appointment ──
const appointmentInput = ref('');
async function submitAppointment(): Promise<void> {
    if (!req.value || !appointmentInput.value) return;
    busy.value = true;
    await store.setAppointment(req.value.id, appointmentInput.value);
    busy.value = false;
}

// ── Measurement ──
const measuring = ref(false);
async function onMeasured(result: {
    measuredAreaM2: number;
    points: MeasurementPoint[];
    accuracyLevel: AccuracyLevel | null;
    fixQuality: string | null;
    method: MeasurementMethod;
}): Promise<void> {
    if (!req.value) return;
    busy.value = true;
    await store.saveMeasurement(req.value.id, {
        measuredAreaM2: result.measuredAreaM2,
        points: result.points,
        method: result.method,
        accuracyLevel: result.accuracyLevel ?? undefined,
        fixQuality: result.fixQuality ?? undefined,
    });
    busy.value = false;
    measuring.value = false;
}

// ── Decision ──
async function approve(): Promise<void> {
    if (!req.value) return;
    busy.value = true;
    await store.approve(req.value.id);
    busy.value = false;
}
async function reject(): Promise<void> {
    if (!req.value) return;
    busy.value = true;
    await store.reject(req.value.id, 'Ölçüm uygun bulunmadı; yeniden randevu gerekli.');
    busy.value = false;
}

onMounted(() => store.fetchOne(id.value));
</script>

<template>
    <CaykurLayout>
        <button type="button" class="ck-back-link" @click="router.push('/caykur/pruning-requests')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Budama Talepleri
        </button>

        <template v-if="req">
            <header class="ck-page-head">
                <div>
                    <h1 class="ck-page-title">{{ req.producerName }}</h1>
                    <p class="ck-page-sub">Budama talebi · Ada {{ req.ada }} / Parsel {{ req.parsel }} · {{ req.il }} / {{ req.ilce }}</p>
                </div>
                <div class="ck-page-actions">
                    <StatusPill :label="PRUNING_REQUEST_STATUS_META[req.status].label" :tone="PRUNING_REQUEST_STATUS_META[req.status].tone" />
                </div>
            </header>

            <CaykurPanel v-if="measuring" title="Hassas ölçüm (3B)">
                <div class="ck-panel-body">
                    <CaykurPruningMeasure @complete="onMeasured" @cancel="measuring = false" />
                </div>
            </CaykurPanel>

            <div v-else class="ck-grid-2">
                <div>
                    <CaykurPanel title="Talep bilgileri">
                        <dl class="ck-dl">
                            <div class="ck-dl-item"><span class="ck-dl-term">Müstahsil</span><span class="ck-dl-val">{{ req.producerName }}</span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">İl / İlçe</span><span class="ck-dl-val">{{ req.il }} / {{ req.ilce }}</span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">Ada / Parsel</span><span class="ck-dl-val">Ada {{ req.ada }} / Parsel {{ req.parsel }}</span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">Kayıtlı arazi</span><span class="ck-dl-val">{{ formatNumber(req.registeredAreaM2) }} m²</span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">Talep tarihi</span><span class="ck-dl-val">{{ formatDateTime(req.createdAt) }}</span></div>
                            <div v-if="req.appointmentDate" class="ck-dl-item"><span class="ck-dl-term">Randevu tarihi</span><span class="ck-dl-val">{{ formatDate(req.appointmentDate) }}<template v-if="req.appointedByName"> · {{ req.appointedByName }}</template></span></div>
                        </dl>
                    </CaykurPanel>

                    <CaykurPanel title="İşlem">
                        <div class="ck-panel-body action-body">
                            <template v-if="req.status === 'pending'">
                                <p class="action-hint">Talebi değerlendirin ve ölçüm için bir randevu tarihi belirleyin.</p>
                                <div class="appt-row">
                                    <input v-model="appointmentInput" type="date" class="ck-search-input" style="padding-left:12px" />
                                    <button type="button" class="ck-btn ck-btn-primary" :disabled="!appointmentInput || busy" @click="submitAppointment">Randevu ver</button>
                                </div>
                            </template>

                            <template v-else-if="req.status === 'scheduled'">
                                <p class="action-hint">Randevu tarihi: <strong>{{ req.appointmentDate ? formatDate(req.appointmentDate) : '—' }}</strong>. Sahada hassas sensörlerle ölçümü yapın.</p>
                                <button type="button" class="ck-btn ck-btn-primary" :disabled="busy" @click="measuring = true">Ölçümü başlat</button>
                            </template>

                            <template v-else-if="req.status === 'measured'">
                                <p class="action-hint">Ölçüm tamamlandı. Kayıt için onaylayın ya da reddedin.</p>
                                <div class="decide-row">
                                    <button type="button" class="ck-btn" :disabled="busy" @click="reject">Reddet</button>
                                    <button type="button" class="ck-btn ck-btn-primary" :disabled="busy" @click="approve">Onayla</button>
                                </div>
                                <button type="button" class="ck-btn ck-btn-sm remeasure" :disabled="busy" @click="measuring = true">Yeniden ölç</button>
                            </template>

                            <template v-else-if="req.status === 'approved'">
                                <p class="action-done">✓ Talep onaylandı ve kayıt tamamlandı.<template v-if="req.approvedByName"> ({{ req.approvedByName }})</template></p>
                            </template>

                            <template v-else>
                                <p class="action-rejected">Talep reddedildi.</p>
                                <p v-if="req.notes" class="action-hint">{{ req.notes }}</p>
                                <button type="button" class="ck-btn ck-btn-sm" :disabled="busy" @click="measuring = true">Yeniden ölç</button>
                            </template>
                        </div>
                    </CaykurPanel>
                </div>

                <CaykurPanel title="Ölçüm sonucu (3B)">
                    <div class="ck-panel-body">
                        <template v-if="req.measuredAreaM2 !== null">
                            <div class="result-area">
                                <span class="result-val">{{ formatNumber(req.measuredAreaM2) }} m²</span>
                                <span class="result-sub">otomatik hesaplanan budama alanı</span>
                            </div>
                            <dl class="ck-dl" style="padding-left:0;padding-right:0">
                                <div class="ck-dl-item"><span class="ck-dl-term">Yöntem</span><span class="ck-dl-val">{{ req.method === 'gps' ? 'RTK / GPS' : req.method === 'map' ? 'Harita' : req.method === 'imu' ? 'Lazer + IMU' : '—' }}</span></div>
                                <div class="ck-dl-item"><span class="ck-dl-term">Doğruluk</span><span class="ck-dl-val">{{ req.accuracyLevel === 'high' ? 'Yüksek (RTK)' : req.accuracyLevel === 'medium' ? 'Orta' : 'Düşük' }}</span></div>
                                <div class="ck-dl-item"><span class="ck-dl-term">Köşe sayısı</span><span class="ck-dl-val">{{ formatNumber(req.measurementPoints.length) }}</span></div>
                                <div class="ck-dl-item"><span class="ck-dl-term">Ölçen</span><span class="ck-dl-val">{{ req.measuredByName ?? '—' }}</span></div>
                                <div v-if="req.measuredAt" class="ck-dl-item"><span class="ck-dl-term">Ölçüm tarihi</span><span class="ck-dl-val">{{ formatDateTime(req.measuredAt) }}</span></div>
                            </dl>

                            <div v-if="req.measurementPoints.length" class="coords">
                                <span class="coords-head">Enlem · Boylam · Yükseklik</span>
                                <ul class="coords-list">
                                    <li v-for="(p, i) in req.measurementPoints" :key="i">
                                        <span class="cx-no">{{ i + 1 }}</span>
                                        <span>{{ p.lat.toFixed(6) }}, {{ p.lng.toFixed(6) }}</span>
                                        <span class="cx-alt">{{ p.altitudeMeters.toFixed(1) }} m</span>
                                    </li>
                                </ul>
                            </div>
                        </template>
                        <div v-else class="ck-empty"><p class="ck-empty-title">Henüz ölçüm yapılmadı</p></div>
                    </div>
                </CaykurPanel>
            </div>
        </template>

        <div v-else class="ck-empty">
            <p class="ck-empty-title">Talep bulunamadı</p>
            <button type="button" class="ck-btn" @click="router.push('/caykur/pruning-requests')">Listeye dön</button>
        </div>
    </CaykurLayout>
</template>

<style scoped>
.action-body { display: flex; flex-direction: column; gap: var(--space-3); }
.action-hint { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.5; }
.appt-row { display: flex; gap: var(--space-2); }
.appt-row .ck-search-input { flex: 1; }
.decide-row { display: flex; gap: var(--space-2); }
.decide-row .ck-btn { flex: 1; }
.remeasure { align-self: flex-start; }
.action-done { margin: 0; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-success); }
.action-rejected { margin: 0; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-danger); }

.result-area { display: flex; flex-direction: column; margin-bottom: var(--space-3); }
.result-val { font-size: var(--font-size-3xl); font-weight: var(--font-weight-bold); color: var(--color-text-primary); line-height: 1; font-variant-numeric: tabular-nums; }
.result-sub { font-size: var(--font-size-sm); color: var(--color-text-muted); margin-top: 4px; }

.coords { margin-top: var(--space-3); }
.coords-head { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-muted); }
.coords-list { list-style: none; margin: var(--space-2) 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.coords-list li { display: flex; align-items: center; gap: var(--space-2); font-size: var(--font-size-xs); color: var(--color-text-secondary); font-variant-numeric: tabular-nums; }
.cx-no { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: var(--color-subtle-bg); border: 1px solid var(--color-border); font-weight: 600; flex-shrink: 0; }
.cx-alt { margin-left: auto; color: var(--color-text-muted); }
</style>
