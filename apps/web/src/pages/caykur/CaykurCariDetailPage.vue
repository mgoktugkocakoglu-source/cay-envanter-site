<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CaykurLayout from '@/layouts/CaykurLayout.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import {
    accrualForProducer,
    cariStatement,
    getProducer,
    ACCRUAL_STATUS_META,
    formatNumber,
    formatKg,
    formatTRY,
    formatDate,
} from '@/services/caykur';

const route = useRoute();
const router = useRouter();

const producerId = computed(() => String(route.params.id));
const producer = computed(() => getProducer(producerId.value));
const accrual = computed(() => accrualForProducer(producerId.value));
const statement = computed(() => cariStatement(producerId.value));

const deductionRows = computed(() => {
    const d = accrual.value?.deductions;
    if (!d) return [];
    return [
        { label: 'Avans', value: d.advance },
        { label: 'Stopaj (%2)', value: d.stopaj },
        { label: 'SGK prim', value: d.sgkPrim },
        { label: 'Diğer', value: d.other },
    ].filter((r) => r.value > 0);
});
</script>

<template>
    <CaykurLayout>
        <button type="button" class="ck-back-link" @click="router.push('/caykur/finance')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Ödeme & Cari
        </button>

        <template v-if="accrual && producer">
            <header class="ck-page-head">
                <div>
                    <h1 class="ck-page-title">{{ producer.fullName }}</h1>
                    <p class="ck-page-sub">Cari kartı · Ruhsat {{ producer.ruhsatNo }} · {{ producer.region }}</p>
                </div>
                <div class="ck-page-actions">
                    <StatusPill :label="ACCRUAL_STATUS_META[accrual.status].label" :tone="ACCRUAL_STATUS_META[accrual.status].tone" />
                    <button type="button" class="ck-btn" @click="router.push(`/caykur/producers/${producer.id}`)">Müstahsil profili</button>
                </div>
            </header>

            <section class="ck-kpi-grid">
                <CaykurStatCard label="Brüt hakediş" :value="formatTRY(accrual.grossAmount)" :sub="`${formatKg(accrual.accruedKg)} × ${formatTRY(accrual.unitPrice, 2)}/kg`" />
                <CaykurStatCard label="Kesintiler" :value="formatTRY(accrual.totalDeductions)" sub="toplam kesinti" />
                <CaykurStatCard label="Net hakediş" :value="formatTRY(accrual.netPayable)" sub="ödenecek tutar" />
                <CaykurStatCard label="Bakiye" :value="formatTRY(accrual.balance)" sub="kalan ödeme" />
            </section>

            <div class="ck-grid-2">
                <CaykurPanel title="Cari ekstre" meta="alacak − borç = bakiye">
                    <div class="ck-table-wrap">
                        <table class="ck-table">
                            <thead>
                                <tr>
                                    <th>Tarih</th>
                                    <th>Açıklama</th>
                                    <th class="num">Alacak</th>
                                    <th class="num">Borç</th>
                                    <th class="num">Bakiye</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(e, i) in statement.entries" :key="i">
                                    <td style="white-space:nowrap">{{ formatDate(e.date) }}</td>
                                    <td>{{ e.description }}</td>
                                    <td class="num credit">{{ e.credit ? formatTRY(e.credit) : '—' }}</td>
                                    <td class="num debit">{{ e.debit ? formatTRY(e.debit) : '—' }}</td>
                                    <td class="num ck-money">{{ formatTRY(e.balance) }}</td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr class="total-row">
                                    <td colspan="4" class="strong">Güncel bakiye</td>
                                    <td class="num ck-money">{{ formatTRY(statement.balance) }}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </CaykurPanel>

                <div>
                    <CaykurPanel title="Kesinti dökümü">
                        <div class="ck-panel-body">
                            <div v-if="deductionRows.length" class="ded-list">
                                <div v-for="d in deductionRows" :key="d.label" class="ded-row">
                                    <span class="ded-label">{{ d.label }}</span>
                                    <span class="ded-val">{{ formatTRY(d.value) }}</span>
                                </div>
                                <div class="ded-row ded-total">
                                    <span class="ded-label">Toplam kesinti</span>
                                    <span class="ded-val">{{ formatTRY(accrual.totalDeductions) }}</span>
                                </div>
                            </div>
                            <p v-else class="ck-empty-sub" style="margin:0">Bu müstahsil için kesinti bulunmuyor.</p>
                        </div>
                    </CaykurPanel>

                    <CaykurPanel title="Teslimat özeti">
                        <dl class="ck-dl">
                            <div class="ck-dl-item"><span class="ck-dl-term">Onaylı net</span><span class="ck-dl-val">{{ formatKg(accrual.accruedKg) }}</span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">Bekleyen net</span><span class="ck-dl-val">{{ formatKg(accrual.pendingKg) }}</span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">Birim fiyat</span><span class="ck-dl-val">{{ formatTRY(accrual.unitPrice, 2) }}/kg</span></div>
                            <div class="ck-dl-item"><span class="ck-dl-term">Ödenen</span><span class="ck-dl-val">{{ formatTRY(accrual.paidAmount) }}</span></div>
                        </dl>
                    </CaykurPanel>
                </div>
            </div>
        </template>

        <div v-else class="ck-empty">
            <p class="ck-empty-title">Cari kaydı bulunamadı</p>
            <button type="button" class="ck-btn" @click="router.push('/caykur/finance')">Listeye dön</button>
        </div>
    </CaykurLayout>
</template>

<style scoped>
.credit { color: var(--color-success); font-variant-numeric: tabular-nums; }
.debit { color: var(--color-text-secondary); font-variant-numeric: tabular-nums; }
.total-row td {
    border-top: 2px solid var(--color-border-strong);
    background: var(--color-bg-primary);
}
.ded-list { display: flex; flex-direction: column; gap: var(--space-3); }
.ded-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.ded-label { font-size: var(--font-size-sm); color: var(--color-text-secondary); }
.ded-val { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); font-variant-numeric: tabular-nums; }
.ded-total {
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-border);
}
.ded-total .ded-label, .ded-total .ded-val { font-weight: var(--font-weight-bold); color: var(--color-text-primary); }
</style>
