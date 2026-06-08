<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CaykurLayout from '@/layouts/CaykurLayout.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import {
    deliveryById,
    STATUS_META,
    SURGUN_LABEL,
    unitPrice,
    getProducer,
    formatNumber,
    formatKg,
    formatTRY,
    formatDate,
    type DeliveryStatus,
} from '@/services/caykur';

const route = useRoute();
const router = useRouter();

const base = computed(() => deliveryById(String(route.params.id)));
const localStatus = ref<DeliveryStatus | null>(null);
const delivery = computed(() => {
    const d = base.value;
    if (!d) return undefined;
    return { ...d, status: localStatus.value ?? d.status };
});

const estValue = computed(() => {
    const d = delivery.value;
    if (!d) return 0;
    const producer = getProducer(d.producerId);
    const price = producer ? unitPrice(producer) : 16.5;
    return Math.round(d.netKg * price);
});

function decide(next: DeliveryStatus): void {
    localStatus.value = next;
}
</script>

<template>
    <CaykurLayout>
        <button type="button" class="ck-back-link" @click="router.push('/caykur/deliveries')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Yaş Çay Alımı
        </button>

        <template v-if="delivery">
            <header class="ck-page-head">
                <div>
                    <h1 class="ck-page-title">Alım Fişi</h1>
                    <p class="ck-page-sub">{{ delivery.receiptNo }}</p>
                </div>
                <div class="ck-page-actions">
                    <StatusPill :label="STATUS_META[delivery.status].label" :tone="STATUS_META[delivery.status].tone" />
                </div>
            </header>

            <div class="receipt">
                <div class="receipt-head">
                    <div class="receipt-brand">
                        <span class="receipt-brand-name">Çaykur</span>
                        <span class="receipt-brand-sub">Yaş Çay Alım Fişi</span>
                    </div>
                    <div class="receipt-no">
                        <span class="ck-dl-term">Fiş no</span>
                        <span class="receipt-no-val">{{ delivery.receiptNo }}</span>
                    </div>
                </div>

                <dl class="ck-dl receipt-grid">
                    <div class="ck-dl-item"><span class="ck-dl-term">Müstahsil</span><span class="ck-dl-val">{{ delivery.producerName }}</span></div>
                    <div class="ck-dl-item"><span class="ck-dl-term">Ruhsat no</span><span class="ck-dl-val">{{ delivery.ruhsatNo }}</span></div>
                    <div class="ck-dl-item"><span class="ck-dl-term">Alım yeri</span><span class="ck-dl-val">{{ delivery.purchasePointName }}</span></div>
                    <div class="ck-dl-item"><span class="ck-dl-term">Fabrika</span><span class="ck-dl-val">{{ delivery.factory }}</span></div>
                    <div class="ck-dl-item"><span class="ck-dl-term">Tarih</span><span class="ck-dl-val">{{ formatDate(delivery.date) }}</span></div>
                    <div class="ck-dl-item"><span class="ck-dl-term">Sürgün</span><span class="ck-dl-val">{{ SURGUN_LABEL[delivery.surgun] }}</span></div>
                    <div class="ck-dl-item"><span class="ck-dl-term">Kalite</span><span class="ck-dl-val">{{ delivery.grade }}</span></div>
                    <div class="ck-dl-item"><span class="ck-dl-term">Kaydeden</span><span class="ck-dl-val">{{ delivery.recordedBy }}</span></div>
                </dl>

                <div class="weigh">
                    <div class="weigh-cell">
                        <span class="weigh-label">Brüt</span>
                        <span class="weigh-val">{{ formatKg(delivery.grossKg) }}</span>
                    </div>
                    <div class="weigh-op">−</div>
                    <div class="weigh-cell">
                        <span class="weigh-label">Fire (%{{ formatNumber(delivery.firePct, 1) }})</span>
                        <span class="weigh-val">{{ formatKg(delivery.grossKg - delivery.netKg) }}</span>
                    </div>
                    <div class="weigh-op">=</div>
                    <div class="weigh-cell is-net">
                        <span class="weigh-label">Net</span>
                        <span class="weigh-val">{{ formatKg(delivery.netKg) }}</span>
                    </div>
                </div>

                <div class="receipt-foot">
                    <span class="ck-dl-term">Tahmini hakediş tutarı</span>
                    <span class="receipt-amount">{{ formatTRY(estValue) }}</span>
                </div>
            </div>

            <div v-if="delivery.status === 'pending'" class="decide-bar">
                <p class="decide-note">Bu fiş fabrika sorumlusu onayı bekliyor.</p>
                <div class="decide-actions">
                    <button type="button" class="ck-btn" @click="decide('rejected')">Reddet</button>
                    <button type="button" class="ck-btn ck-btn-primary" @click="decide('approved')">Onayla</button>
                </div>
            </div>
        </template>

        <div v-else class="ck-empty">
            <p class="ck-empty-title">Fiş bulunamadı</p>
            <button type="button" class="ck-btn" @click="router.push('/caykur/deliveries')">Listeye dön</button>
        </div>
    </CaykurLayout>
</template>

<style scoped>
.receipt {
    max-width: 760px;
    background: var(--color-card-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
}
.receipt-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-5);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-primary);
}
.receipt-brand {
    display: flex;
    flex-direction: column;
}
.receipt-brand-name {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-secondary);
}
.receipt-brand-sub {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
}
.receipt-no {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
}
.receipt-no-val {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
}
.receipt-grid {
    border-bottom: 1px solid var(--color-border);
}
.weigh {
    display: flex;
    align-items: stretch;
    gap: var(--space-3);
    padding: var(--space-5);
    flex-wrap: wrap;
}
.weigh-cell {
    flex: 1 1 140px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--space-4);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
}
.weigh-cell.is-net {
    background: var(--color-primary-light);
    border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
}
.weigh-label {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-muted);
}
.weigh-val {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
}
.weigh-op {
    display: flex;
    align-items: center;
    font-size: var(--font-size-2xl);
    color: var(--color-text-muted);
    font-weight: var(--font-weight-bold);
}
.receipt-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-5);
    border-top: 1px solid var(--color-border);
    background: var(--color-bg-primary);
}
.receipt-amount {
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
}
.decide-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
    max-width: 760px;
    margin-top: var(--space-4);
    padding: var(--space-4) var(--space-5);
    background: color-mix(in srgb, var(--color-warning) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-warning) 26%, transparent);
    border-radius: var(--radius-md);
}
.decide-note {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-warning);
}
.decide-actions {
    display: flex;
    gap: var(--space-2);
}
</style>
