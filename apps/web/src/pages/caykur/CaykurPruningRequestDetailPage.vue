<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CaykurLayout from '@/layouts/CaykurLayout.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import CaykurPruningMeasure from '@/components/caykur/CaykurPruningMeasure.vue';
import { useCaykurStore } from '@/stores/caykurStore';
import { usePruningRequestsStore, type MeasurementResult } from '@/stores/pruningRequestsStore';
import {
    PRUNING_REQUEST_STATUS_META,
    parcelsForProducer,
    formatNumber,
    formatDate,
    formatDateTime,
} from '@/services/caykur';

const route = useRoute();
const router = useRouter();
const caykur = useCaykurStore();
const store = usePruningRequestsStore();

const staffName = computed(() => caykur.persona.name);
const req = computed(() => store.byId(String(route.params.id)));

// Parcel outline for the measurement map (match the request's ada/parsel).
const parcelPolygon = computed<number[][] | undefined>(() => {
    const r = req.value;
    if (!r) return undefined;
    const match = parcelsForProducer(r.producerId).find((p) => p.ada === r.ada && p.parsel === r.parsel);
    return match?.polygon;
});

// ── Appointment ──
const appointmentInput = ref('');
function submitAppointment(): void {
    if (!req.value || !appointmentInput.value) return;
    store.setAppointment(req.value.id, appointmentInput.value, staffName.value);
}

// ── Measurement ──
const measuring = ref(false);
function onMeasured(result: MeasurementResult): void {
    if (!req.value) return;
    store.saveMeasurement(req.value.id, result, staffName.value);
    measuring.value = false;
}

// ── Decision ──
function approve(): void {
    if (req.value) store.approve(req.value.id, staffName.value);
}
function reject(): void {
    if (req.value) store.reject(req.value.id, staffName.value, 'Ölçüm uygun bulunmadı; yeniden randevu gerekli.');
}
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
                    <p class="ck-page-sub">Budama talebi · {{ req.parcelLabel }} · {{ req.il }} / {{ req.ilce }}</p>
                </div>
                <div class="ck-page-actions">
                    <StatusPill :label="PRUNING_REQUEST_STATUS_META[req.status].label" :tone="PRUNING_REQUEST_STATUS_META[req.status].tone" />
                </div>
            </header>

            <!-- Measurement in progress takes the full width -->
            <CaykurPanel v-if="measuring" title="Hassas ölçüm (3B)">
                <div class="ck-panel-body">
                    <CaykurPruningMeasure :parcel-polygon="parcelPolygon" @complete="onMeasured" @cancel="measuring = false" />
                </div>
            </CaykurPanel>

            <div v-else class="ck-grid-2">
                <div>
                    <CaykurPanel title="Talep bilgileri">
                        <dl class="ck-dl">
                            <div class="ck-dl-item"><span class="ck-dl-term">Müstahsil</span><span class="ck-dl-val">{{ req.producerName }}</span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">İl / İlçe</span><span class="ck-dl-val">{{ req.il }} / {{ req.ilce }}</span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">Ada / Parsel</span><span class="ck-dl-val">{{ req.parcelLabel }}</span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">Kayıtlı arazi</span><span class="ck-dl-val">{{ formatNumber(req.registeredAreaM2) }} m²</span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">Talep tarihi</span><span class="ck-dl-val">{{ formatDateTime(req.createdAt) }}</span></div>
                            <div v-if="req.appointmentDate" class="ck-dl-item"><span class="ck-dl-term">Randevu tarihi</span><span class="ck-dl-val">{{ formatDate(req.appointmentDate) }}<template v-if="req.appointedBy"> · {{ req.appointedBy }}</template></span></div>
                        </dl>
                    </CaykurPanel>

                    <!-- Action card driven by status -->
                    <CaykurPanel title="İşlem">
                        <div class="ck-panel-body action-body">
                            <template v-if="req.status === 'pending'">
                                <p class="action-hint">Talebi değerlendirin ve ölçüm için bir randevu tarihi belirleyin.</p>
                                <div class="appt-row">
                                    <input v-model="appointmentInput" type="date" class="ck-search-input" style="padding-left:12px" />
                                    <button type="button" class="ck-btn ck-btn-primary" :disabled="!appointmentInput" @click="submitAppointment">Randevu ver</button>
                                </div>
                            </template>

                            <template v-else-if="req.status === 'scheduled'">
                                <p class="action-hint">Randevu tarihi: <strong>{{ formatDate(req.appointmentDate as string) }}</strong>. Sahada hassas sensörlerle ölçümü yapın.</p>
                                <button type="button" class="ck-btn ck-btn-primary" @click="measuring = true">Ölçümü başlat</button>
                            </template>

                            <template v-else-if="req.status === 'measured'">
                                <p class="action-hint">Ölçüm tamamlandı. Kayıt için onaylayın ya da reddedin.</p>
                                <div class="decide-row">
                                    <button type="button" class="ck-btn" @click="reject">Reddet</button>
                                    <button type="button" class="ck-btn ck-btn-primary" @click="approve">Onayla</button>
                                </div>
                                <button type="button" class="ck-btn ck-btn-sm remeasure" @click="measuring = true">Yeniden ölç</button>
                            </template>

                            <template v-else-if="req.status === 'approved'">
                                <p class="action-done">✓ Talep onaylandı ve kayıt tamamlandı.<template v-if="req.approvedBy"> ({{ req.approvedBy }})</template></p>
                            </template>

                            <template v-else>
                                <p class="action-rejected">Talep reddedildi.</p>
                                <p v-if="req.notes" class="action-hint">{{ req.notes }}</p>
                                <button type="button" class="ck-btn ck-btn-sm" @click="measuring = true">Yeniden ölç</button>
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
                                <div class="ck-dl-item"><span class="ck-dl-term">Yöntem</span><span class="ck-dl-val">{{ req.method === 'gps' ? 'RTK / GPS' : req.method === 'map' ? 'Harita' : '—' }}</span></div>
                                <div class="ck-dl-item"><span class="ck-dl-term">Doğruluk</span><span class="ck-dl-val">{{ req.accuracyLevel === 'high' ? 'Yüksek (RTK)' : req.accuracyLevel === 'medium' ? 'Orta' : 'Düşük' }}</span></div>
                                <div class="ck-dl-item"><span class="ck-dl-term">Köşe sayısı</span><span class="ck-dl-val">{{ formatNumber(req.measurementPoints.length) }}</span></div>
                                <div class="ck-dl-item"><span class="ck-dl-term">Ölçen</span><span class="ck-dl-val">{{ req.measuredBy ?? '—' }}</span></div>
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
