<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import CaykurPage from '@/components/caykur/CaykurPage.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import {
    ACCRUALS,
    financeSummary,
    PAYMENT_BATCHES,
    PAYMENT_BATCH_META,
    PAYMENT_OBJECTIONS,
    OBJECTION_STATUS_META,
    ACCRUAL_STATUS_META,
    formatNumber,
    formatKg,
    formatTRY,
    formatTRYCompact,
    formatDate,
    type AccrualStatus,
    type Region,
} from '@/services/caykur';

const router = useRouter();

type View = 'accruals' | 'payments' | 'objections';
const view = ref<View>('accruals');
const search = ref('');
const region = ref<'all' | Region>('all');
const status = ref<'all' | AccrualStatus>('all');

const summary = computed(() => financeSummary());

const statusOptions: Array<{ value: 'all' | AccrualStatus; label: string }> = [
    { value: 'all', label: 'Tümü' },
    { value: 'pending', label: 'Ödeme bekliyor' },
    { value: 'partial', label: 'Kısmi' },
    { value: 'paid', label: 'Ödendi' },
];

const filtered = computed(() => {
    const q = search.value.trim().toLocaleLowerCase('tr');
    return ACCRUALS.filter((a) => {
        if (region.value !== 'all' && a.region !== region.value) return false;
        if (status.value !== 'all' && a.status !== status.value) return false;
        if (q && !`${a.producerName} ${a.ruhsatNo}`.toLocaleLowerCase('tr').includes(q)) return false;
        return true;
    });
});

function openCari(id: string): void {
    router.push(`/caykur/finance/${id}`);
}
</script>

<template>
    <CaykurPage title="Ödeme & Cari" :sub="`${formatTRYCompact(summary.netPayable)} net hakediş`">
        <section class="ck-kpi-grid">
            <CaykurStatCard label="Brüt hakediş" :value="formatTRYCompact(summary.grossAmount)" sub="onaylı teslimatlardan" />
            <CaykurStatCard label="Kesintiler" :value="formatTRYCompact(summary.totalDeductions)" sub="avans, stopaj, SGK" />
            <CaykurStatCard label="Ödenen" :value="formatTRYCompact(summary.paidAmount)" sub="banka ödemeleri" />
            <CaykurStatCard label="Bakiye" :value="formatTRYCompact(summary.outstanding)" sub="ödenmemiş hakediş" />
        </section>

        <div class="ck-seg" role="group" aria-label="Görünüm" style="margin-bottom: var(--space-4)">
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'accruals' }" @click="view = 'accruals'">Hakediş</button>
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'payments' }" @click="view = 'payments'">
                Ödeme listesi
                <span v-if="summary.pendingApprovalCount" class="tab-badge">{{ summary.pendingApprovalCount }}</span>
            </button>
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'objections' }" @click="view = 'objections'">
                İtirazlar
                <span v-if="summary.openObjections" class="tab-badge">{{ summary.openObjections }}</span>
            </button>
        </div>

        <!-- Accruals -->
        <template v-if="view === 'accruals'">
            <div class="ck-toolbar">
                <div class="ck-search-wrap">
                    <svg class="ck-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input v-model="search" type="text" class="ck-search-input" placeholder="Müstahsil veya ruhsat ara…" />
                </div>
                <div class="ck-seg" role="group" aria-label="Durum filtresi">
                    <button v-for="opt in statusOptions" :key="opt.value" type="button" class="ck-seg-btn" :class="{ 'is-active': status === opt.value }" @click="status = opt.value">{{ opt.label }}</button>
                </div>
            </div>

            <CaykurPanel>
                <template #head><span class="ck-panel-meta">{{ formatNumber(filtered.length) }} müstahsil cari kartı</span></template>
                <div class="ck-table-wrap">
                    <table class="ck-table">
                        <thead>
                            <tr>
                                <th>Müstahsil</th>
                                <th>Bölge</th>
                                <th class="num">Net kg</th>
                                <th class="num">Brüt</th>
                                <th class="num">Kesinti</th>
                                <th class="num">Net hakediş</th>
                                <th class="num">Bakiye</th>
                                <th>Durum</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="a in filtered.slice(0, 120)" :key="a.producerId" class="ck-row-link" @click="openCari(a.producerId)">
                                <td>
                                    <span class="strong" style="display:block">{{ a.producerName }}</span>
                                    <span class="ck-name-sub">{{ a.ruhsatNo }}</span>
                                </td>
                                <td>{{ a.region }}</td>
                                <td class="num">{{ formatKg(a.accruedKg) }}</td>
                                <td class="num">{{ formatTRY(a.grossAmount) }}</td>
                                <td class="num">{{ formatTRY(a.totalDeductions) }}</td>
                                <td class="num ck-money">{{ formatTRY(a.netPayable) }}</td>
                                <td class="num" :class="{ 'pos': a.balance > 0 }">{{ formatTRY(a.balance) }}</td>
                                <td><StatusPill :label="ACCRUAL_STATUS_META[a.status].label" :tone="ACCRUAL_STATUS_META[a.status].tone" /></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </CaykurPanel>
        </template>

        <!-- Payment batches -->
        <CaykurPanel v-else-if="view === 'payments'" title="Ödeme partileri" :meta="`${formatNumber(PAYMENT_BATCHES.length)} parti`">
            <div class="ck-table-wrap">
                <table class="ck-table">
                    <thead>
                        <tr>
                            <th>Parti</th>
                            <th>Bölge</th>
                            <th class="num">Müstahsil</th>
                            <th class="num">Tutar</th>
                            <th>Tarih</th>
                            <th>Onaylayan</th>
                            <th>Durum</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="b in PAYMENT_BATCHES" :key="b.id">
                            <td class="strong">{{ b.title }}</td>
                            <td>{{ b.region }}</td>
                            <td class="num">{{ formatNumber(b.producerCount) }}</td>
                            <td class="num ck-money">{{ formatTRY(b.amount) }}</td>
                            <td style="white-space:nowrap">{{ formatDate(b.createdAt) }}</td>
                            <td>{{ b.approvedBy ?? '—' }}</td>
                            <td>
                                <StatusPill :label="PAYMENT_BATCH_META[b.status].label" :tone="PAYMENT_BATCH_META[b.status].tone" />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </CaykurPanel>

        <!-- Objections -->
        <CaykurPanel v-else title="Ödeme itirazları" :meta="`${formatNumber(PAYMENT_OBJECTIONS.length)} itiraz`">
            <div class="ck-table-wrap">
                <table class="ck-table">
                    <thead>
                        <tr>
                            <th>Müstahsil</th>
                            <th>Bölge</th>
                            <th>Konu</th>
                            <th class="num">İtiraz tutarı</th>
                            <th>Tarih</th>
                            <th>Durum</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="o in PAYMENT_OBJECTIONS" :key="o.id">
                            <td class="strong">{{ o.producerName }}</td>
                            <td>{{ o.region }}</td>
                            <td>{{ o.subject }}</td>
                            <td class="num">{{ formatTRY(o.amountDisputed) }}</td>
                            <td style="white-space:nowrap">{{ formatDate(o.createdAt) }}</td>
                            <td><StatusPill :label="OBJECTION_STATUS_META[o.status].label" :tone="OBJECTION_STATUS_META[o.status].tone" /></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </CaykurPanel>
    </CaykurPage>
</template>

<style scoped>
.pos {
    color: var(--color-text-primary);
    font-weight: var(--font-weight-semibold);
}
.tab-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    margin-left: 6px;
    padding: 0 5px;
    font-size: 11px;
    font-weight: var(--font-weight-bold);
    color: var(--color-on-danger);
    background: var(--color-danger);
    border-radius: var(--radius-full);
}
</style>
