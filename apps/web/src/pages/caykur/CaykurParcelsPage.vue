<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import CaykurPage from '@/components/caykur/CaykurPage.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import {
    PARCELS,
    parcelSummary,
    VERIFICATION_META,
    formatNumber,
    type ParcelVerification,
    type Region,
} from '@/services/caykur';

const router = useRouter();

const search = ref('');
const region = ref<'all' | Region>('all');
const status = ref<'all' | ParcelVerification>('all');

const summary = computed(() => parcelSummary());

const regionOptions: Array<{ value: 'all' | Region; label: string }> = [
    { value: 'all', label: 'Tüm bölgeler' },
    { value: 'Rize', label: 'Rize' },
    { value: 'Trabzon', label: 'Trabzon' },
    { value: 'Artvin', label: 'Artvin' },
    { value: 'Giresun', label: 'Giresun' },
];

const statusOptions: Array<{ value: 'all' | ParcelVerification; label: string }> = [
    { value: 'all', label: 'Tümü' },
    { value: 'verified', label: 'Doğrulandı' },
    { value: 'pending', label: 'Onay bekliyor' },
    { value: 'unverified', label: 'Doğrulanmadı' },
    { value: 'rejected', label: 'Reddedildi' },
];

const filtered = computed(() => {
    const q = search.value.trim().toLocaleLowerCase('tr');
    return PARCELS.filter((p) => {
        if (region.value !== 'all' && p.region !== region.value) return false;
        if (status.value !== 'all' && p.verification !== status.value) return false;
        if (q) {
            const hay = `${p.producerName} ${p.ada} ${p.parsel} ${p.neighborhood}`.toLocaleLowerCase('tr');
            if (!hay.includes(q)) return false;
        }
        return true;
    });
});

function dekar(m2: number): string {
    return `${formatNumber(m2 / 1000, 1)} da`;
}

function openParcel(id: string): void {
    router.push(`/caykur/parcels/${id}`);
}

function resetFilters(): void {
    search.value = '';
    region.value = 'all';
    status.value = 'all';
}
</script>

<template>
    <CaykurPage title="Parseller" :sub="`${formatNumber(summary.total)} parsel · ${dekar(summary.totalAreaM2)} toplam alan`">
        <section class="ck-kpi-grid">
            <CaykurStatCard label="Toplam parsel" :value="formatNumber(summary.total)" :sub="`${dekar(summary.totalAreaM2)} alan`" />
            <CaykurStatCard label="Doğrulanan" :value="formatNumber(summary.verified)" sub="kadastro doğrulaması tamam" />
            <CaykurStatCard label="Onay bekleyen" :value="formatNumber(summary.pending)" sub="saha doğrulaması gerekli" />
            <CaykurStatCard label="Düzeltme talebi" :value="formatNumber(summary.openCorrections)" sub="açık parsel düzeltmesi" />
        </section>

        <div class="ck-toolbar">
            <div class="ck-search-wrap">
                <svg class="ck-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input v-model="search" type="text" class="ck-search-input" placeholder="Müstahsil, ada veya parsel ara…" aria-label="Parsel ara" />
            </div>
            <div class="ck-seg" role="group" aria-label="Bölge filtresi">
                <button v-for="opt in regionOptions" :key="opt.value" type="button" class="ck-seg-btn" :class="{ 'is-active': region === opt.value }" @click="region = opt.value">{{ opt.label }}</button>
            </div>
            <div class="ck-seg" role="group" aria-label="Durum filtresi">
                <button v-for="opt in statusOptions" :key="opt.value" type="button" class="ck-seg-btn" :class="{ 'is-active': status === opt.value }" @click="status = opt.value">{{ opt.label }}</button>
            </div>
        </div>

        <CaykurPanel>
            <template #head>
                <span class="ck-panel-meta">{{ formatNumber(filtered.length) }} parsel</span>
            </template>
            <div v-if="filtered.length > 0" class="ck-table-wrap">
                <table class="ck-table">
                    <thead>
                        <tr>
                            <th>Parsel</th>
                            <th>Müstahsil</th>
                            <th>Konum</th>
                            <th class="num">Alan</th>
                            <th>Durum</th>
                            <th aria-label="Detay"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="p in filtered" :key="p.id" class="ck-row-link" @click="openParcel(p.id)">
                            <td class="strong">
                                Ada {{ p.ada }} / Parsel {{ p.parsel }}
                                <span v-if="p.organic" class="ck-tag" style="margin-left:6px">Organik</span>
                            </td>
                            <td>{{ p.producerName }}</td>
                            <td>
                                <span style="display:block">{{ p.district }}, {{ p.region }}</span>
                                <span class="ck-name-sub">{{ p.neighborhood }}</span>
                            </td>
                            <td class="num">{{ dekar(p.areaM2) }}</td>
                            <td><StatusPill :label="VERIFICATION_META[p.verification].label" :tone="VERIFICATION_META[p.verification].tone" /></td>
                            <td class="ck-chevron-cell">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div v-else class="ck-empty">
                <p class="ck-empty-title">Eşleşen parsel yok</p>
                <p class="ck-empty-sub">Arama ve filtreleri değiştirmeyi deneyin.</p>
                <button type="button" class="ck-btn" @click="resetFilters">Filtreleri temizle</button>
            </div>
        </CaykurPanel>
    </CaykurPage>
</template>
