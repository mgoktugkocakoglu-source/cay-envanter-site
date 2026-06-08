<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import CaykurPage from '@/components/caykur/CaykurPage.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import {
    FACTORIES,
    PURCHASE_POINTS,
    STAFF,
    REGIONS,
    formatNumber,
    formatTon,
    formatDekar,
    type Region,
} from '@/services/caykur';

const router = useRouter();

type View = 'factories' | 'points';
const view = ref<View>('factories');
const region = ref<'all' | Region>('all');

const factories = computed(() =>
    FACTORIES.filter((f) => region.value === 'all' || f.region === region.value),
);
const points = computed(() =>
    PURCHASE_POINTS.filter((p) => region.value === 'all' || p.region === region.value),
);

const regionOptions: Array<{ value: 'all' | Region; label: string }> = [
    { value: 'all', label: 'Tüm bölgeler' },
    ...REGIONS.map((r) => ({ value: r.name, label: r.name })),
];

function openFactory(id: string): void {
    router.push(`/caykur/org/factory/${id}`);
}
</script>

<template>
    <CaykurPage title="Fabrika & Alım Yeri" sub="Bölge → fabrika → alım yeri hiyerarşisi">
        <section class="ck-kpi-grid">
            <CaykurStatCard label="Bölge" :value="formatNumber(REGIONS.length)" sub="çay üretim bölgesi" />
            <CaykurStatCard label="Fabrika" :value="formatNumber(FACTORIES.length)" sub="işleme tesisi" />
            <CaykurStatCard label="Alım yeri" :value="formatNumber(PURCHASE_POINTS.length)" sub="yaş çay alım noktası" />
            <CaykurStatCard label="Personel" :value="formatNumber(STAFF.length)" sub="kurum personeli" />
        </section>

        <div class="ck-toolbar">
            <div class="ck-seg" role="group" aria-label="Görünüm">
                <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'factories' }" @click="view = 'factories'">Fabrikalar</button>
                <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'points' }" @click="view = 'points'">Alım yerleri</button>
            </div>
            <div class="ck-seg" role="group" aria-label="Bölge filtresi">
                <button v-for="opt in regionOptions" :key="opt.value" type="button" class="ck-seg-btn" :class="{ 'is-active': region === opt.value }" @click="region = opt.value">{{ opt.label }}</button>
            </div>
        </div>

        <CaykurPanel v-if="view === 'factories'">
            <template #head><span class="ck-panel-meta">{{ formatNumber(factories.length) }} fabrika</span></template>
            <div class="ck-table-wrap">
                <table class="ck-table">
                    <thead>
                        <tr>
                            <th>Fabrika</th>
                            <th>Bölge</th>
                            <th>Sorumlu</th>
                            <th class="num">Müstahsil</th>
                            <th class="num">Ruhsatlı alan</th>
                            <th class="num">Sezon</th>
                            <th class="num">Kapasite</th>
                            <th aria-label="Detay"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="f in factories" :key="f.id" class="ck-row-link" @click="openFactory(f.id)">
                            <td class="strong">{{ f.name }}</td>
                            <td>{{ f.region }}</td>
                            <td>{{ f.manager }}</td>
                            <td class="num">{{ formatNumber(f.producerCount) }}</td>
                            <td class="num">{{ formatDekar(f.licensedDekar) }}</td>
                            <td class="num">{{ formatTon(f.seasonKg) }}</td>
                            <td class="num">{{ formatNumber(f.dailyCapacityTon) }} ton/gün</td>
                            <td class="ck-chevron-cell"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </CaykurPanel>

        <CaykurPanel v-else>
            <template #head><span class="ck-panel-meta">{{ formatNumber(points.length) }} alım yeri</span></template>
            <div class="ck-table-wrap">
                <table class="ck-table">
                    <thead>
                        <tr>
                            <th>Alım yeri</th>
                            <th>Fabrika</th>
                            <th>İlçe</th>
                            <th>Sorumlu</th>
                            <th class="num">Müstahsil</th>
                            <th class="num">Kapasite</th>
                            <th>Durum</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="p in points" :key="p.id">
                            <td class="strong">{{ p.name }}</td>
                            <td>{{ p.factoryName }}</td>
                            <td>{{ p.district }}</td>
                            <td>{{ p.collectorName }}</td>
                            <td class="num">{{ formatNumber(p.producerCount) }}</td>
                            <td class="num">{{ formatNumber(p.dailyCapacityKg / 1000) }} ton/gün</td>
                            <td><StatusPill :label="p.isActive ? 'Aktif' : 'Pasif'" :tone="p.isActive ? 'success' : 'muted'" /></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </CaykurPanel>
    </CaykurPage>
</template>
