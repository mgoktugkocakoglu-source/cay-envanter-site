<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import CaykurPage from '@/components/caykur/CaykurPage.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import ComplianceMeter from '@/components/caykur/ComplianceMeter.vue';
import {
    QUOTA_RECORDS,
    quotaSummary,
    quotaByRegion,
    QUOTA_REVISIONS,
    QUOTA_STATUS_META,
    REVISION_STATUS_META,
    kotaTone,
    formatNumber,
    formatKg,
    formatTon,
    formatPct,
    formatDate,
    type QuotaStatus,
    type Region,
} from '@/services/caykur';

const router = useRouter();

type View = 'list' | 'revisions';
const view = ref<View>('list');
const search = ref('');
const region = ref<'all' | Region>('all');
const status = ref<'all' | QuotaStatus>('all');

const summary = computed(() => quotaSummary());
const regions = computed(() => quotaByRegion());

const statusOptions: Array<{ value: 'all' | QuotaStatus; label: string }> = [
    { value: 'all', label: 'Tümü' },
    { value: 'over', label: 'Aşıldı' },
    { value: 'critical', label: 'Kritik' },
    { value: 'normal', label: 'Normal' },
];

const filtered = computed(() => {
    const q = search.value.trim().toLocaleLowerCase('tr');
    return QUOTA_RECORDS.filter((r) => {
        if (region.value !== 'all' && r.region !== region.value) return false;
        if (status.value !== 'all' && r.status !== status.value) return false;
        if (q && !`${r.producerName} ${r.ruhsatNo}`.toLocaleLowerCase('tr').includes(q)) return false;
        return true;
    });
});

function openProducer(id: string): void {
    router.push(`/caykur/producers/${id}`);
}
</script>

<template>
    <CaykurPage title="Kota Yönetimi" :sub="`${formatTon(summary.totalUsedKg)} / ${formatTon(summary.totalQuotaKg)} kullanıldı`">
        <section class="ck-kpi-grid">
            <CaykurStatCard label="Toplam kota" :value="formatTon(summary.totalQuotaKg)" sub="sezon alım kotası" />
            <CaykurStatCard label="Kullanım" :value="formatPct(summary.usagePct)" sub="kotaya göre">
                <ComplianceMeter :value="summary.usagePct" :max="120" :tone="kotaTone(summary.usagePct)" />
            </CaykurStatCard>
            <CaykurStatCard label="Kota aşan" :value="formatNumber(summary.overCount)" sub="müstahsil" />
            <CaykurStatCard label="Revizyon talebi" :value="formatNumber(summary.openRevisions)" sub="açık talep" />
        </section>

        <CaykurPanel title="Bölge bazında kota">
            <div class="ck-table-wrap">
                <table class="ck-table">
                    <thead>
                        <tr>
                            <th>Bölge</th>
                            <th class="num">Müstahsil</th>
                            <th class="num">Kota</th>
                            <th class="num">Kullanılan</th>
                            <th>Kullanım</th>
                            <th class="num">Aşan</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="r in regions" :key="r.region">
                            <td class="strong">{{ r.region }}</td>
                            <td class="num">{{ formatNumber(r.producerCount) }}</td>
                            <td class="num">{{ formatTon(r.quotaKg) }}</td>
                            <td class="num">{{ formatTon(r.usedKg) }}</td>
                            <td>
                                <div class="ck-cell-meter">
                                    <ComplianceMeter :value="r.usagePct" :max="120" :tone="kotaTone(r.usagePct)" :height="6" />
                                    <span class="ck-cell-meter-val">{{ formatPct(r.usagePct) }}</span>
                                </div>
                            </td>
                            <td class="num">{{ formatNumber(r.overCount) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </CaykurPanel>

        <div class="ck-seg" role="group" aria-label="Görünüm" style="margin: var(--space-5) 0 var(--space-4)">
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'list' }" @click="view = 'list'">Müstahsil kotaları</button>
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'revisions' }" @click="view = 'revisions'">Revizyon talepleri</button>
        </div>

        <template v-if="view === 'list'">
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
                <template #head><span class="ck-panel-meta">{{ formatNumber(filtered.length) }} müstahsil</span></template>
                <div class="ck-table-wrap">
                    <table class="ck-table">
                        <thead>
                            <tr>
                                <th>Müstahsil</th>
                                <th>Bölge</th>
                                <th class="num">Kota</th>
                                <th class="num">Kullanılan</th>
                                <th class="num">Kalan</th>
                                <th>Kullanım</th>
                                <th>Durum</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="r in filtered.slice(0, 120)" :key="r.producerId" class="ck-row-link" @click="openProducer(r.producerId)">
                                <td>
                                    <span class="strong" style="display:block">{{ r.producerName }}<span v-if="r.organic" class="ck-tag" style="margin-left:6px">Organik</span></span>
                                    <span class="ck-name-sub">{{ r.ruhsatNo }}</span>
                                </td>
                                <td>{{ r.region }}</td>
                                <td class="num">{{ formatKg(r.quotaKg) }}</td>
                                <td class="num">{{ formatKg(r.usedKg) }}</td>
                                <td class="num" :class="{ 'neg': r.remainingKg < 0 }">{{ formatKg(r.remainingKg) }}</td>
                                <td>
                                    <div class="ck-cell-meter">
                                        <ComplianceMeter :value="r.usagePct" :max="120" :tone="kotaTone(r.usagePct)" :height="6" />
                                        <span class="ck-cell-meter-val">{{ formatPct(r.usagePct) }}</span>
                                    </div>
                                </td>
                                <td><StatusPill :label="QUOTA_STATUS_META[r.status].label" :tone="QUOTA_STATUS_META[r.status].tone" /></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </CaykurPanel>
        </template>

        <CaykurPanel v-else title="Kota revizyon talepleri" :meta="`${formatNumber(QUOTA_REVISIONS.length)} talep`">
            <div class="ck-table-wrap">
                <table class="ck-table">
                    <thead>
                        <tr>
                            <th>Müstahsil</th>
                            <th>Bölge</th>
                            <th class="num">Mevcut</th>
                            <th class="num">Talep edilen</th>
                            <th>Gerekçe</th>
                            <th>Tarih</th>
                            <th>Durum</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="rev in QUOTA_REVISIONS" :key="rev.id">
                            <td class="strong">{{ rev.producerName }}</td>
                            <td>{{ rev.region }}</td>
                            <td class="num">{{ formatKg(rev.currentQuotaKg) }}</td>
                            <td class="num ck-money">{{ formatKg(rev.requestedQuotaKg) }}</td>
                            <td>{{ rev.reason }}</td>
                            <td style="white-space:nowrap">{{ formatDate(rev.createdAt) }}</td>
                            <td><StatusPill :label="REVISION_STATUS_META[rev.status].label" :tone="REVISION_STATUS_META[rev.status].tone" /></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </CaykurPanel>
    </CaykurPage>
</template>

<style scoped>
.neg {
    color: var(--color-danger);
    font-weight: var(--font-weight-semibold);
}
</style>
