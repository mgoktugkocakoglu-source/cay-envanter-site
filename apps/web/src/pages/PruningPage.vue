<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import { useAuthStore } from '@/stores/authStore';
import { useFieldsStore } from '@/stores/fieldsStore';
import { usePruningRequestsStore } from '@/stores/pruningRequestsStore';
import { PRUNING_REQUEST_STATUS_META } from '@/services/caykur';
import type { Field } from '@/services/api';

const auth = useAuthStore();
const fieldsStore = useFieldsStore();
const store = usePruningRequestsStore();

type Tab = 'request' | 'record';
const tab = ref<Tab>('request');

const user = computed(() => auth.user);

// ── Producer context (real data) ──
function fieldToM2(f: Field): number {
    const a = Number(f.area) || 0;
    return f.areaUnit === 'm2' ? a : a * 1000;
}
const registeredAreaM2 = computed(() =>
    Math.round(fieldsStore.fields.reduce((s, f) => s + fieldToM2(f), 0)),
);
// 1/7 rotation rule.
const pruneTargetM2 = computed(() => Math.round(registeredAreaM2.value / 7));

const myRequests = computed(() => store.requests);
const records = computed(() =>
    myRequests.value.filter((r) => r.measuredAreaM2 !== null && (r.status === 'measured' || r.status === 'approved')),
);
const measuredTotalM2 = computed(() => records.value.reduce((s, r) => s + (r.measuredAreaM2 ?? 0), 0));

// ── New request form ──
const form = ref({ il: '', ilce: '', ada: '', parsel: '' });
const formError = ref('');
const submitting = ref(false);

function resetForm(): void {
    form.value = { il: user.value?.province ?? '', ilce: user.value?.district ?? '', ada: '', parsel: '' };
    formError.value = '';
}

async function submit(): Promise<void> {
    const { il, ilce, ada, parsel } = form.value;
    if (!il.trim() || !ilce.trim() || !ada.trim() || !parsel.trim()) {
        formError.value = 'İl, ilçe, ada ve parsel alanları zorunludur.';
        return;
    }
    submitting.value = true;
    const created = await store.createRequest({
        il: il.trim(),
        ilce: ilce.trim(),
        ada: ada.trim(),
        parsel: parsel.trim(),
        registeredAreaM2: registeredAreaM2.value,
    });
    submitting.value = false;
    if (created) resetForm();
    else formError.value = store.error ?? 'Talep oluşturulamadı.';
}

const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'request', label: 'Budama Talebi' },
    { id: 'record', label: 'Budama Kaydı' },
];

function formatNumber(n: number): string {
    return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
}
function formatDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

onMounted(() => {
    resetForm();
    fieldsStore.fetchFields();
    store.fetchAll();
});
</script>

<template>
    <TeaBusinessLayout>
        <div class="pp">
            <header class="pp-head">
                <div>
                    <h1 class="pp-title">Budama</h1>
                    <p class="pp-sub">{{ user?.fullName }}<template v-if="user?.district"> · {{ user.district }} / {{ user.province }}</template></p>
                </div>
            </header>

            <div class="ck-seg pp-tabs" role="tablist">
                <button v-for="t in tabs" :key="t.id" type="button" class="ck-seg-btn" :class="{ 'is-active': tab === t.id }" role="tab" :aria-selected="tab === t.id" @click="tab = t.id">{{ t.label }}</button>
            </div>

            <!-- ══ Budama Talebi ══ -->
            <template v-if="tab === 'request'">
                <section class="ck-panel">
                    <div class="ck-panel-head">
                        <h2 class="ck-panel-title">Yeni budama talebi</h2>
                    </div>
                    <div class="ck-panel-body">
                        <p class="pp-flow">Budadığınız araziyi kaydettirmek için il/ilçe ve ada/parsel bilgisini girin. Çaykur yetkili personeli talebinizi değerlendirip bir <strong>randevu tarihi</strong> belirler; randevuda budanan çay hassas sensörlerle ölçülüp kaydedilir.</p>
                        <div class="pp-form">
                            <label class="pp-field"><span>İl</span><input v-model="form.il" type="text" class="pp-input" placeholder="İl" /></label>
                            <label class="pp-field"><span>İlçe</span><input v-model="form.ilce" type="text" class="pp-input" placeholder="İlçe" /></label>
                            <label class="pp-field"><span>Ada no</span><input v-model="form.ada" type="text" class="pp-input" placeholder="Ada" inputmode="numeric" /></label>
                            <label class="pp-field"><span>Parsel no</span><input v-model="form.parsel" type="text" class="pp-input" placeholder="Parsel" inputmode="numeric" /></label>
                        </div>
                        <p v-if="formError" class="pp-error">{{ formError }}</p>
                        <div class="pp-form-actions">
                            <button type="button" class="ck-btn ck-btn-primary" :disabled="submitting" @click="submit">{{ submitting ? 'Gönderiliyor…' : 'Talep oluştur' }}</button>
                        </div>
                    </div>
                </section>

                <section class="ck-panel">
                    <div class="ck-panel-head">
                        <h2 class="ck-panel-title">Taleplerim</h2>
                        <span class="ck-panel-meta">{{ formatNumber(myRequests.length) }} talep</span>
                    </div>
                    <div class="ck-table-wrap">
                        <table class="ck-table">
                            <thead><tr><th>Ada / Parsel</th><th>İl / İlçe</th><th>Talep tarihi</th><th>Randevu</th><th>Durum</th></tr></thead>
                            <tbody>
                                <tr v-for="r in myRequests" :key="r.id">
                                    <td class="strong">Ada {{ r.ada }} / Parsel {{ r.parsel }}</td>
                                    <td>{{ r.il }} · {{ r.ilce }}</td>
                                    <td style="white-space:nowrap">{{ formatDate(r.createdAt) }}</td>
                                    <td style="white-space:nowrap">{{ formatDate(r.appointmentDate) }}</td>
                                    <td><StatusPill :label="PRUNING_REQUEST_STATUS_META[r.status].label" :tone="PRUNING_REQUEST_STATUS_META[r.status].tone" /></td>
                                </tr>
                            </tbody>
                        </table>
                        <div v-if="!myRequests.length" class="ck-empty"><p class="ck-empty-title">Henüz talebiniz yok</p></div>
                    </div>
                </section>
            </template>

            <!-- ══ Budama Kaydı ══ -->
            <template v-else>
                <section class="ck-kpi-grid">
                    <CaykurStatCard label="Toplam kayıtlı arazi" :value="formatNumber(registeredAreaM2)" unit="m²" sub="ruhsatlı bahçeniz" />
                    <CaykurStatCard label="Budanacak miktar" :value="formatNumber(pruneTargetM2)" unit="m²" sub="1/7 hedef · %14,3" />
                    <CaykurStatCard label="Ölçülen / onaylanan" :value="formatNumber(measuredTotalM2)" unit="m²" :sub="`${formatNumber(records.length)} kayıt`" />
                </section>

                <section class="ck-panel">
                    <div class="ck-panel-head">
                        <h2 class="ck-panel-title">Budama kayıtları</h2>
                        <span class="ck-panel-meta">{{ formatNumber(records.length) }} ölçüm</span>
                    </div>
                    <div class="ck-table-wrap">
                        <table class="ck-table">
                            <thead><tr><th>Ada / Parsel</th><th class="num">Ölçülen alan</th><th>Konum (enlem, boylam, yükseklik)</th><th>Yöntem</th><th>Durum</th><th>Tarih</th></tr></thead>
                            <tbody>
                                <tr v-for="r in records" :key="r.id">
                                    <td class="strong">Ada {{ r.ada }} / Parsel {{ r.parsel }}</td>
                                    <td class="num ck-money">{{ formatNumber(r.measuredAreaM2 ?? 0) }} m²</td>
                                    <td>
                                        <template v-if="r.measurementPoints.length">
                                            {{ r.measurementPoints[0].lat.toFixed(6) }}, {{ r.measurementPoints[0].lng.toFixed(6) }}, {{ r.measurementPoints[0].altitudeMeters.toFixed(1) }} m
                                            <span class="pp-pts">+{{ r.measurementPoints.length - 1 }} köşe</span>
                                        </template>
                                        <template v-else>—</template>
                                    </td>
                                    <td>{{ r.method === 'gps' ? 'RTK / GPS' : r.method === 'map' ? 'Harita' : r.method === 'imu' ? 'Lazer + IMU' : '—' }}</td>
                                    <td><StatusPill :label="PRUNING_REQUEST_STATUS_META[r.status].label" :tone="PRUNING_REQUEST_STATUS_META[r.status].tone" /></td>
                                    <td style="white-space:nowrap">{{ formatDate(r.measuredAt) }}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div v-if="!records.length" class="ck-empty">
                            <p class="ck-empty-title">Henüz budama kaydı yok</p>
                            <p class="pp-empty-sub">Ölçüm, randevu tarihinde Çaykur yetkili personeli tarafından sahada yapılır.</p>
                        </div>
                    </div>
                </section>
            </template>
        </div>
    </TeaBusinessLayout>
</template>

<style scoped>
.pp { max-width: 1100px; margin: 0 auto; padding: var(--space-6) var(--space-6) var(--space-12); }
.pp-head { margin-bottom: var(--space-5); }
.pp-title { margin: 0; font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); color: var(--color-text-primary); letter-spacing: -0.01em; }
.pp-sub { margin: 3px 0 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }
.pp-tabs { margin-bottom: var(--space-4); align-self: flex-start; }

.pp-flow { margin: 0 0 var(--space-4); font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.6; }
.pp-form { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
@media (max-width: 640px) { .pp-form { grid-template-columns: 1fr; } }
.pp-field { display: flex; flex-direction: column; gap: 6px; }
.pp-field > span { font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); }
.pp-input {
    min-height: 44px; padding: 0 14px;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
}
.pp-input:focus { outline: none; border-color: var(--color-primary); }
.pp-error { margin: var(--space-3) 0 0; font-size: var(--font-size-xs); color: var(--color-danger); }
.pp-form-actions { margin-top: var(--space-4); display: flex; justify-content: flex-end; }
.pp-pts { color: var(--color-text-muted); font-size: var(--font-size-xs); margin-left: 6px; }
.pp-empty-sub { margin: var(--space-2) 0 0; font-size: var(--font-size-xs); color: var(--color-text-muted); }
.ck-panel + .ck-panel { margin-top: var(--space-4); }
.ck-kpi-grid + .ck-panel { margin-top: var(--space-4); }
</style>
