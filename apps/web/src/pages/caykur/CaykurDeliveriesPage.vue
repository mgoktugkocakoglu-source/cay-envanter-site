<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import CaykurPage from '@/components/caykur/CaykurPage.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import {
    DELIVERIES,
    deliverySummary,
    dailyTotals,
    STATUS_META,
    SURGUN_LABEL,
    formatNumber,
    formatKg,
    formatTon,
    formatDate,
    type DeliveryStatus,
    type Region,
} from '@/services/caykur';

const router = useRouter();

type View = 'list' | 'pending' | 'daily';
const view = ref<View>('list');
const search = ref('');
const region = ref<'all' | Region>('all');
const status = ref<'all' | DeliveryStatus>('all');

const summary = computed(() => deliverySummary());
const daily = computed(() => dailyTotals());

const regionOptions: Array<{ value: 'all' | Region; label: string }> = [
    { value: 'all', label: 'Tüm bölgeler' },
    { value: 'Rize', label: 'Rize' },
    { value: 'Trabzon', label: 'Trabzon' },
    { value: 'Artvin', label: 'Artvin' },
    { value: 'Giresun', label: 'Giresun' },
];
const statusOptions: Array<{ value: 'all' | DeliveryStatus; label: string }> = [
    { value: 'all', label: 'Tümü' },
    { value: 'approved', label: 'Onaylandı' },
    { value: 'pending', label: 'Onay bekliyor' },
    { value: 'corrected', label: 'Düzeltildi' },
    { value: 'rejected', label: 'Reddedildi' },
];

const filtered = computed(() => {
    const q = search.value.trim().toLocaleLowerCase('tr');
    return DELIVERIES.filter((d) => {
        if (view.value === 'pending' && d.status !== 'pending') return false;
        if (view.value === 'list' && status.value !== 'all' && d.status !== status.value) return false;
        if (region.value !== 'all' && d.region !== region.value) return false;
        if (q) {
            const hay = `${d.producerName} ${d.receiptNo}`.toLocaleLowerCase('tr');
            if (!hay.includes(q)) return false;
        }
        return true;
    });
});

function openDelivery(id: string): void {
    router.push(`/caykur/deliveries/${id}`);
}
</script>

<template>
    <CaykurPage title="Yaş Çay Alımı" :sub="`${formatTon(summary.totalNetKg)} · ${formatNumber(summary.totalSlips)} alım fişi`">
        <template #actions>
            <button type="button" class="ck-btn ck-btn-primary" @click="router.push('/caykur/deliveries/new')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Yeni alım
            </button>
        </template>

        <section class="ck-kpi-grid">
            <CaykurStatCard label="Toplam alım" :value="formatTon(summary.totalNetKg)" sub="net yaş çay (sezon)" />
            <CaykurStatCard label="Onaylanan" :value="formatTon(summary.approvedKg)" sub="hakedişe esas" />
            <CaykurStatCard label="Onay bekleyen" :value="formatNumber(summary.pendingSlips)" :sub="`${formatKg(summary.pendingKg)} fiş`" />
            <CaykurStatCard label="Ortalama fire" :value="`%${formatNumber(summary.avgFirePct, 1)}`" sub="alım fişlerinde" />
        </section>

        <div class="ck-seg" role="group" aria-label="Görünüm" style="margin-bottom: var(--space-4)">
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'list' }" @click="view = 'list'">Tüm teslimatlar</button>
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'pending' }" @click="view = 'pending'">Onay bekleyenler</button>
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'daily' }" @click="view = 'daily'">Günlük özet</button>
        </div>

        <!-- List / pending views -->
        <template v-if="view !== 'daily'">
            <div class="ck-toolbar">
                <div class="ck-search-wrap">
                    <svg class="ck-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input v-model="search" type="text" class="ck-search-input" placeholder="Müstahsil veya fiş no ara…" aria-label="Alım ara" />
                </div>
                <div class="ck-seg" role="group" aria-label="Bölge filtresi">
                    <button v-for="opt in regionOptions" :key="opt.value" type="button" class="ck-seg-btn" :class="{ 'is-active': region === opt.value }" @click="region = opt.value">{{ opt.label }}</button>
                </div>
                <div v-if="view === 'list'" class="ck-seg" role="group" aria-label="Durum filtresi">
                    <button v-for="opt in statusOptions" :key="opt.value" type="button" class="ck-seg-btn" :class="{ 'is-active': status === opt.value }" @click="status = opt.value">{{ opt.label }}</button>
                </div>
            </div>

            <CaykurPanel>
                <template #head>
                    <span class="ck-panel-meta">{{ formatNumber(filtered.length) }} fiş</span>
                </template>
                <div v-if="filtered.length" class="ck-table-wrap">
                    <table class="ck-table">
                        <thead>
                            <tr>
                                <th>Fiş no</th>
                                <th>Müstahsil</th>
                                <th>Alım yeri</th>
                                <th>Tarih</th>
                                <th>Sürgün</th>
                                <th class="num">Net</th>
                                <th class="num">Fire</th>
                                <th>Kalite</th>
                                <th>Durum</th>
                                <th aria-label="Detay"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="d in filtered.slice(0, 120)" :key="d.id" class="ck-row-link" @click="openDelivery(d.id)">
                                <td class="strong" style="font-variant-numeric: tabular-nums">{{ d.receiptNo }}</td>
                                <td>{{ d.producerName }}</td>
                                <td>
                                    <span style="display:block">{{ d.purchasePointName }}</span>
                                    <span class="ck-name-sub">{{ d.region }}</span>
                                </td>
                                <td style="white-space:nowrap">{{ formatDate(d.date) }}</td>
                                <td>{{ SURGUN_LABEL[d.surgun] }}</td>
                                <td class="num ck-money">{{ formatKg(d.netKg) }}</td>
                                <td class="num">%{{ formatNumber(d.firePct, 1) }}</td>
                                <td>{{ d.grade }}</td>
                                <td><StatusPill :label="STATUS_META[d.status].label" :tone="STATUS_META[d.status].tone" /></td>
                                <td class="ck-chevron-cell"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div v-else class="ck-empty"><p class="ck-empty-title">Kayıt bulunamadı</p></div>
                <p v-if="filtered.length > 120" class="more-note">İlk 120 kayıt gösteriliyor — filtrelerle daraltın.</p>
            </CaykurPanel>
        </template>

        <!-- Daily summary view -->
        <CaykurPanel v-else title="Alım yeri günlük özeti" :meta="`${formatNumber(daily.length)} gün/yer`">
            <div class="ck-table-wrap">
                <table class="ck-table">
                    <thead>
                        <tr>
                            <th>Tarih</th>
                            <th>Alım yeri</th>
                            <th>Bölge</th>
                            <th class="num">Müstahsil</th>
                            <th class="num">Fiş</th>
                            <th class="num">Toplam net</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(d, i) in daily.slice(0, 60)" :key="i">
                            <td style="white-space:nowrap">{{ formatDate(d.date) }}</td>
                            <td class="strong">{{ d.pointName }}</td>
                            <td>{{ d.region }}</td>
                            <td class="num">{{ formatNumber(d.producers) }}</td>
                            <td class="num">{{ formatNumber(d.slips) }}</td>
                            <td class="num ck-money">{{ formatKg(d.netKg) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </CaykurPanel>
    </CaykurPage>
</template>

<style scoped>
.more-note {
    margin: 0;
    padding: var(--space-3) var(--space-5);
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    border-top: 1px solid var(--color-border);
}
</style>
