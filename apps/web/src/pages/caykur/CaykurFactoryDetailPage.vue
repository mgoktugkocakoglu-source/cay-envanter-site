<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CaykurLayout from '@/layouts/CaykurLayout.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import {
    factoryById,
    PURCHASE_POINTS,
    STAFF,
    formatNumber,
    formatTon,
    formatDekar,
} from '@/services/caykur';

const route = useRoute();
const router = useRouter();

const factory = computed(() => factoryById(String(route.params.id)));
const points = computed(() => PURCHASE_POINTS.filter((p) => p.factoryId === route.params.id));
const staff = computed(() => (factory.value ? STAFF.filter((s) => s.scope === factory.value!.name) : []));
</script>

<template>
    <CaykurLayout>
        <button type="button" class="ck-back-link" @click="router.push('/caykur/org')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Fabrika & Alım Yeri
        </button>

        <template v-if="factory">
            <header class="ck-page-head">
                <div>
                    <h1 class="ck-page-title">{{ factory.name }}</h1>
                    <p class="ck-page-sub">{{ factory.region }} bölgesi · Sorumlu: {{ factory.manager }}</p>
                </div>
            </header>

            <section class="ck-kpi-grid">
                <CaykurStatCard label="Müstahsil" :value="formatNumber(factory.producerCount)" sub="bağlı üretici" />
                <CaykurStatCard label="Ruhsatlı alan" :value="formatDekar(factory.licensedDekar)" sub="toplam çaylık" />
                <CaykurStatCard label="Sezon alımı" :value="formatTon(factory.seasonKg)" sub="yaş çay" />
                <CaykurStatCard label="Günlük kapasite" :value="`${formatNumber(factory.dailyCapacityTon)} ton`" sub="işleme kapasitesi" />
            </section>

            <div class="ck-grid-2">
                <CaykurPanel title="Alım yerleri" :meta="`${formatNumber(points.length)} nokta`">
                    <div class="ck-table-wrap">
                        <table class="ck-table">
                            <thead>
                                <tr><th>Alım yeri</th><th>İlçe</th><th>Sorumlu</th><th class="num">Müstahsil</th><th>Durum</th></tr>
                            </thead>
                            <tbody>
                                <tr v-for="p in points" :key="p.id">
                                    <td class="strong">{{ p.name }}</td>
                                    <td>{{ p.district }}</td>
                                    <td>{{ p.collectorName }}</td>
                                    <td class="num">{{ formatNumber(p.producerCount) }}</td>
                                    <td><StatusPill :label="p.isActive ? 'Aktif' : 'Pasif'" :tone="p.isActive ? 'success' : 'muted'" /></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </CaykurPanel>

                <CaykurPanel title="Fabrika bilgileri">
                    <dl class="ck-dl">
                        <div class="ck-dl-item"><span class="ck-dl-term">Bölge</span><span class="ck-dl-val">{{ factory.region }}</span></div>
                        <div class="ck-dl-item"><span class="ck-dl-term">Sorumlu</span><span class="ck-dl-val">{{ factory.manager }}</span></div>
                        <div class="ck-dl-item"><span class="ck-dl-term">Telefon</span><span class="ck-dl-val">{{ factory.phone }}</span></div>
                        <div class="ck-dl-item"><span class="ck-dl-term">Alım yeri</span><span class="ck-dl-val">{{ formatNumber(points.length) }}</span></div>
                    </dl>
                    <div v-if="staff.length" class="ck-panel-body">
                        <p class="staff-title">Atanan personel</p>
                        <ul class="staff-list">
                            <li v-for="s in staff" :key="s.id">{{ s.fullName }} — {{ s.title }}</li>
                        </ul>
                    </div>
                </CaykurPanel>
            </div>
        </template>

        <div v-else class="ck-empty">
            <p class="ck-empty-title">Fabrika bulunamadı</p>
            <button type="button" class="ck-btn" @click="router.push('/caykur/org')">Listeye dön</button>
        </div>
    </CaykurLayout>
</template>

<style scoped>
.staff-title {
    margin: 0 0 var(--space-2);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary);
}
.staff-list {
    margin: 0;
    padding-left: var(--space-5);
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
    line-height: 1.8;
}
</style>
