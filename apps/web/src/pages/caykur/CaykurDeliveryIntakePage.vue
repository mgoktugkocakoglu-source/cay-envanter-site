<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import CaykurPage from '@/components/caykur/CaykurPage.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import {
    PRODUCERS,
    purchasePointForProducer,
    formatKg,
    formatNumber,
    type LeafGrade,
    type Surgun,
} from '@/services/caykur';

const router = useRouter();

const producerId = ref('');
const grossKg = ref<number | null>(null);
const firePct = ref(4);
const grade = ref<LeafGrade>('1. Kalite');
const surgun = ref<Surgun>(3);

interface Entry {
    receiptNo: string;
    producerName: string;
    netKg: number;
    grade: LeafGrade;
}
const todayEntries = ref<Entry[]>([]);
let counter = 1;

const selectedProducer = computed(() => PRODUCERS.find((p) => p.id === producerId.value));
const point = computed(() => (producerId.value ? purchasePointForProducer(producerId.value) : undefined));
const netKg = computed(() => {
    if (!grossKg.value || grossKg.value <= 0) return 0;
    return Math.round(grossKg.value * (1 - firePct.value / 100));
});
const canSave = computed(() => !!producerId.value && !!grossKg.value && grossKg.value > 0 && !!point.value);
const todayTotal = computed(() => todayEntries.value.reduce((s, e) => s + e.netKg, 0));

function save(): void {
    if (!canSave.value || !selectedProducer.value || !point.value) return;
    const pad = (n: number, l: number) => String(n).padStart(l, '0');
    todayEntries.value.unshift({
        receiptNo: `${point.value.region.slice(0, 2).toLocaleUpperCase('tr')}-NEW-${pad(counter++, 3)}`,
        producerName: selectedProducer.value.fullName,
        netKg: netKg.value,
        grade: grade.value,
    });
    grossKg.value = null;
    producerId.value = '';
}
</script>

<template>
    <CaykurPage title="Günlük Alım" sub="Yeni yaş çay alım kaydı oluştur">
        <template #actions>
            <button type="button" class="ck-btn" @click="router.push('/caykur/deliveries')">Tüm alımlar</button>
        </template>

        <div class="ck-grid-2">
            <CaykurPanel title="Alım bilgileri">
                <div class="ck-panel-body form">
                    <div class="field">
                        <label class="field-label" for="producer">Müstahsil</label>
                        <select id="producer" v-model="producerId" class="ck-select field-control">
                            <option value="" disabled>Müstahsil seçin…</option>
                            <option v-for="p in PRODUCERS" :key="p.id" :value="p.id">{{ p.fullName }} — {{ p.ruhsatNo }}</option>
                        </select>
                    </div>

                    <div v-if="point" class="point-info">
                        <span>Alım yeri: <strong>{{ point.name }}</strong></span>
                        <span>{{ point.region }} · {{ point.factoryName }}</span>
                    </div>

                    <div class="field-row">
                        <div class="field">
                            <label class="field-label" for="gross">Brüt (kg)</label>
                            <input id="gross" v-model.number="grossKg" type="number" min="0" step="1" class="ck-select field-control" placeholder="0" />
                        </div>
                        <div class="field">
                            <label class="field-label" for="fire">Fire (%)</label>
                            <input id="fire" v-model.number="firePct" type="number" min="0" max="20" step="0.5" class="ck-select field-control" />
                        </div>
                    </div>

                    <div class="field-row">
                        <div class="field">
                            <label class="field-label" for="grade">Kalite</label>
                            <select id="grade" v-model="grade" class="ck-select field-control">
                                <option>1. Kalite</option>
                                <option>2. Kalite</option>
                                <option>3. Kalite</option>
                            </select>
                        </div>
                        <div class="field">
                            <label class="field-label" for="surgun">Sürgün</label>
                            <select id="surgun" v-model.number="surgun" class="ck-select field-control">
                                <option :value="1">1. Sürgün</option>
                                <option :value="2">2. Sürgün</option>
                                <option :value="3">3. Sürgün</option>
                            </select>
                        </div>
                    </div>

                    <div class="net-preview">
                        <span class="net-label">Net ağırlık</span>
                        <span class="net-val">{{ formatKg(netKg) }}</span>
                    </div>

                    <button type="button" class="ck-btn ck-btn-primary save-btn" :disabled="!canSave" @click="save">
                        Alımı kaydet
                    </button>
                </div>
            </CaykurPanel>

            <CaykurPanel title="Bugün alınanlar" :meta="`${formatKg(todayTotal)} toplam`">
                <div v-if="todayEntries.length" class="ck-table-wrap">
                    <table class="ck-table">
                        <thead>
                            <tr><th>Fiş no</th><th>Müstahsil</th><th>Kalite</th><th class="num">Net</th></tr>
                        </thead>
                        <tbody>
                            <tr v-for="(e, i) in todayEntries" :key="i">
                                <td class="strong" style="font-variant-numeric: tabular-nums">{{ e.receiptNo }}</td>
                                <td>{{ e.producerName }}</td>
                                <td>{{ e.grade }}</td>
                                <td class="num ck-money">{{ formatKg(e.netKg) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div v-else class="ck-empty">
                    <p class="ck-empty-title">Henüz alım yok</p>
                    <p class="ck-empty-sub">Soldaki formdan ilk alımı kaydedin.</p>
                </div>
            </CaykurPanel>
        </div>
    </CaykurPage>
</template>

<style scoped>
.form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
}
.field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
}
.field-label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary);
}
.field-control {
    width: 100%;
}
.field-row {
    display: flex;
    gap: var(--space-3);
}
.point-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-3) var(--space-4);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
}
.net-preview {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4);
    background: var(--color-primary-light);
    border: 1px solid color-mix(in srgb, var(--color-primary) 28%, transparent);
    border-radius: var(--radius-md);
}
.net-label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary);
}
.net-val {
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
}
.save-btn {
    width: 100%;
    min-height: 44px;
}
.save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
