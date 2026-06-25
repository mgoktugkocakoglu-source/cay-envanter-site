<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import CaykurPage from '@/components/caykur/CaykurPage.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import { usePruningRequestsStore } from '@/stores/pruningRequestsStore';
import {
    PRUNING_REQUEST_STATUS_META,
    formatNumber,
    formatDate,
    type PruningRequestStatus,
    type Region,
} from '@/services/caykur';

const router = useRouter();
const store = usePruningRequestsStore();

type View = 'all' | PruningRequestStatus;
const view = ref<View>('pending');
const search = ref('');
const region = ref<'all' | Region>('all');

const summary = computed(() => store.summary);

const filtered = computed(() => {
    const q = search.value.trim().toLocaleLowerCase('tr');
    return store.requests.filter((r) => {
        if (view.value !== 'all' && r.status !== view.value) return false;
        if (region.value !== 'all' && r.region !== region.value) return false;
        if (q && !`${r.producerName} ${r.parcelLabel} ${r.ilce}`.toLocaleLowerCase('tr').includes(q)) return false;
        return true;
    });
});

const viewOptions: Array<{ value: View; label: string }> = [
    { value: 'pending', label: 'Bekleyenler' },
    { value: 'scheduled', label: 'Randevulu' },
    { value: 'measured', label: 'Ölçülenler' },
    { value: 'approved', label: 'Onaylı' },
    { value: 'all', label: 'Tümü' },
];

const regionOptions: Array<{ value: 'all' | Region; label: string }> = [
    { value: 'all', label: 'Tüm bölgeler' },
    { value: 'Rize', label: 'Rize' },
    { value: 'Trabzon', label: 'Trabzon' },
    { value: 'Artvin', label: 'Artvin' },
    { value: 'Giresun', label: 'Giresun' },
];

function openRequest(id: string): void {
    router.push(`/caykur/pruning-requests/${id}`);
}
</script>

<template>
    <CaykurPage title="Budama Talepleri" sub="Üreticiden gelen budama kayıt talepleri · randevu, ölçüm ve onay akışı">
        <section class="ck-kpi-grid">
            <CaykurStatCard label="Toplam talep" :value="formatNumber(summary.total)" sub="bu sezon" />
            <CaykurStatCard label="Bekleyen" :value="formatNumber(summary.pending)" sub="randevu verilecek" />
            <CaykurStatCard label="Randevulu" :value="formatNumber(summary.scheduled)" sub="ölçüm planlandı" />
            <CaykurStatCard label="Onaylı" :value="formatNumber(summary.approved)" sub="kayıt tamamlandı" />
        </section>

        <div class="ck-seg" role="group" aria-label="Görünüm" style="margin-bottom: var(--space-4)">
            <button v-for="opt in viewOptions" :key="opt.value" type="button" class="ck-seg-btn" :class="{ 'is-active': view === opt.value }" @click="view = opt.value">{{ opt.label }}</button>
        </div>

        <div class="ck-toolbar">
            <div class="ck-search-wrap">
                <svg class="ck-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input v-model="search" type="text" class="ck-search-input" placeholder="Müstahsil, parsel veya ilçe ara…" />
            </div>
            <div class="ck-seg" role="group" aria-label="Bölge filtresi">
                <button v-for="opt in regionOptions" :key="opt.value" type="button" class="ck-seg-btn" :class="{ 'is-active': region === opt.value }" @click="region = opt.value">{{ opt.label }}</button>
            </div>
        </div>

        <CaykurPanel>
            <template #head><span class="ck-panel-meta">{{ formatNumber(filtered.length) }} talep</span></template>
            <div v-if="filtered.length" class="ck-table-wrap">
                <table class="ck-table">
                    <thead>
                        <tr>
                            <th>Müstahsil</th>
                            <th>İl / İlçe</th>
                            <th>Ada / Parsel</th>
                            <th>Talep tarihi</th>
                            <th>Randevu</th>
                            <th>Durum</th>
                            <th aria-label="Detay"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="r in filtered" :key="r.id" class="ck-row-link" @click="openRequest(r.id)">
                            <td>
                                <span class="strong" style="display:block">{{ r.producerName }}</span>
                                <span class="ck-name-sub">{{ formatNumber(r.registeredAreaM2) }} m² kayıtlı</span>
                            </td>
                            <td>{{ r.il }} · {{ r.ilce }}</td>
                            <td>{{ r.parcelLabel }}</td>
                            <td style="white-space:nowrap">{{ formatDate(r.createdAt) }}</td>
                            <td style="white-space:nowrap">{{ r.appointmentDate ? formatDate(r.appointmentDate) : '—' }}</td>
                            <td><StatusPill :label="PRUNING_REQUEST_STATUS_META[r.status].label" :tone="PRUNING_REQUEST_STATUS_META[r.status].tone" /></td>
                            <td class="ck-chevron-cell"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div v-else class="ck-empty"><p class="ck-empty-title">Talep yok</p></div>
        </CaykurPanel>
    </CaykurPage>
</template>
