<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import CaykurPage from '@/components/caykur/CaykurPage.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import {
    REQUESTS,
    REQUEST_TYPE_META,
    REQUEST_STATUS_META,
    PRIORITY_META,
    formatNumber,
    formatDate,
    type RequestStatus,
    type RequestType,
} from '@/services/caykur';

const router = useRouter();

const search = ref('');
const type = ref<'all' | RequestType>('all');
const status = ref<'all' | RequestStatus>('all');

const summary = computed(() => ({
    open: REQUESTS.filter((r) => r.status === 'open').length,
    inProgress: REQUESTS.filter((r) => r.status === 'in_progress').length,
    answered: REQUESTS.filter((r) => r.status === 'answered').length,
    high: REQUESTS.filter((r) => r.priority === 'high').length,
}));

const typeOptions: Array<{ value: 'all' | RequestType; label: string }> = [
    { value: 'all', label: 'Tüm türler' },
    { value: 'parsel', label: 'Parsel' },
    { value: 'kota', label: 'Kota' },
    { value: 'odeme', label: 'Ödeme' },
    { value: 'belge', label: 'Belge' },
    { value: 'genel', label: 'Genel' },
];
const statusOptions: Array<{ value: 'all' | RequestStatus; label: string }> = [
    { value: 'all', label: 'Tümü' },
    { value: 'open', label: 'Açık' },
    { value: 'in_progress', label: 'İşlemde' },
    { value: 'answered', label: 'Yanıtlandı' },
    { value: 'closed', label: 'Kapandı' },
];

const filtered = computed(() => {
    const q = search.value.trim().toLocaleLowerCase('tr');
    return REQUESTS.filter((r) => {
        if (type.value !== 'all' && r.type !== type.value) return false;
        if (status.value !== 'all' && r.status !== status.value) return false;
        if (q && !`${r.producerName} ${r.subject}`.toLocaleLowerCase('tr').includes(q)) return false;
        return true;
    });
});

function openRequest(id: string): void {
    router.push(`/caykur/requests/${id}`);
}
</script>

<template>
    <CaykurPage title="Talepler" sub="Müstahsil talep ve itirazları">
        <section class="ck-kpi-grid">
            <CaykurStatCard label="Açık" :value="formatNumber(summary.open)" sub="yeni talep" />
            <CaykurStatCard label="İşlemde" :value="formatNumber(summary.inProgress)" sub="incelenen" />
            <CaykurStatCard label="Yanıtlanan" :value="formatNumber(summary.answered)" sub="çözülen" />
            <CaykurStatCard label="Yüksek öncelik" :value="formatNumber(summary.high)" sub="acil talep" />
        </section>

        <div class="ck-toolbar">
            <div class="ck-search-wrap">
                <svg class="ck-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input v-model="search" type="text" class="ck-search-input" placeholder="Müstahsil veya konu ara…" />
            </div>
            <div class="ck-seg" role="group" aria-label="Tür filtresi">
                <button v-for="opt in typeOptions" :key="opt.value" type="button" class="ck-seg-btn" :class="{ 'is-active': type === opt.value }" @click="type = opt.value">{{ opt.label }}</button>
            </div>
            <div class="ck-seg" role="group" aria-label="Durum filtresi">
                <button v-for="opt in statusOptions" :key="opt.value" type="button" class="ck-seg-btn" :class="{ 'is-active': status === opt.value }" @click="status = opt.value">{{ opt.label }}</button>
            </div>
        </div>

        <CaykurPanel>
            <template #head><span class="ck-panel-meta">{{ formatNumber(filtered.length) }} talep</span></template>
            <div v-if="filtered.length" class="ck-table-wrap">
                <table class="ck-table">
                    <thead>
                        <tr>
                            <th>Konu</th>
                            <th>Müstahsil</th>
                            <th>Tür</th>
                            <th>Öncelik</th>
                            <th>Güncellenme</th>
                            <th>Durum</th>
                            <th aria-label="Detay"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="r in filtered" :key="r.id" class="ck-row-link" @click="openRequest(r.id)">
                            <td class="strong">{{ r.subject }}</td>
                            <td>{{ r.producerName }}</td>
                            <td>{{ REQUEST_TYPE_META[r.type].label }}</td>
                            <td><StatusPill :label="PRIORITY_META[r.priority].label" :tone="PRIORITY_META[r.priority].tone" no-dot /></td>
                            <td style="white-space:nowrap">{{ formatDate(r.updatedAt) }}</td>
                            <td><StatusPill :label="REQUEST_STATUS_META[r.status].label" :tone="REQUEST_STATUS_META[r.status].tone" /></td>
                            <td class="ck-chevron-cell"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div v-else class="ck-empty"><p class="ck-empty-title">Talep bulunamadı</p></div>
        </CaykurPanel>
    </CaykurPage>
</template>
