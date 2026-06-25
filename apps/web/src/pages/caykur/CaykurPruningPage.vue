<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import CaykurPage from '@/components/caykur/CaykurPage.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import ComplianceMeter from '@/components/caykur/ComplianceMeter.vue';
import { api, type PruningMeasurement, type PruningStatus, type PruningMethod } from '@/services/api';
import {
    BUDAMA_TARGET_PCT,
    formatNumber,
    formatPct,
    formatDate,
} from '@/services/caykur';

const router = useRouter();

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'muted';

const STATUS_META: Record<PruningStatus, { label: string; tone: Tone }> = {
    measured: { label: 'Ölçüldü · onay bekliyor', tone: 'info' },
    producer_approved: { label: 'Müstahsil onayladı', tone: 'info' },
    staff_approved: { label: 'Personel onayladı', tone: 'success' },
    completed: { label: 'Tamamlandı', tone: 'success' },
    rejected: { label: 'Reddedildi', tone: 'danger' },
};

const METHOD_LABEL: Record<PruningMethod, string> = {
    map: 'Harita çizimi',
    gps: 'GPS / RTK',
    assisted: 'Asistan ölçüm',
};

type View = 'pending' | 'all' | 'rejected';
const view = ref<View>('pending');
const search = ref('');

const loading = ref(true);
const error = ref<string | null>(null);
const measurements = ref<PruningMeasurement[]>([]);

async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
        const res = await api.getPruningMeasurementsPanel({ limit: 100 });
        if (res.data) measurements.value = res.data.data;
        else {
            error.value = res.error?.message ?? 'Ölçümler yüklenemedi';
            measurements.value = [];
        }
    } catch (err) {
        error.value = err instanceof Error ? err.message : 'Ölçümler yüklenemedi';
        measurements.value = [];
    } finally {
        loading.value = false;
    }
}

onMounted(load);

const summary = computed(() => {
    const rows = measurements.value;
    const pending = rows.filter((m) => m.status === 'measured' || m.status === 'producer_approved').length;
    const approved = rows.filter((m) => m.status === 'completed' || m.status === 'staff_approved').length;
    const rejected = rows.filter((m) => m.status === 'rejected').length;
    return { total: rows.length, pending, approved, rejected };
});

const filtered = computed(() => {
    const q = search.value.trim().toLocaleLowerCase('tr');
    return measurements.value.filter((m) => {
        if (view.value === 'pending' && !(m.status === 'measured' || m.status === 'producer_approved')) return false;
        if (view.value === 'rejected' && m.status !== 'rejected') return false;
        if (q) {
            const hay = `${m.producerName ?? ''} ${m.parcelNo ?? ''}`.toLocaleLowerCase('tr');
            if (!hay.includes(q)) return false;
        }
        return true;
    });
});

function ratioTone(pct: number): 'success' | 'warning' | 'danger' {
    if (pct >= 11 && pct <= 20) return 'success';
    if (pct >= 6) return 'warning';
    return 'danger';
}

function openMeasurement(id: string): void {
    router.push(`/caykur/pruning/${id}`);
}
</script>

<template>
    <CaykurPage title="Budama Denetimi" :sub="`1/7 rotasyon kuralı · hedef %${formatNumber(BUDAMA_TARGET_PCT, 1)}`">
        <section class="ck-kpi-grid">
            <CaykurStatCard label="Toplam ölçüm" :value="formatNumber(summary.total)" sub="kayıtlı" />
            <CaykurStatCard label="Denetim bekleyen" :value="formatNumber(summary.pending)" sub="onay sırasında" />
            <CaykurStatCard label="Onaylanan" :value="formatNumber(summary.approved)" sub="personel onaylı" />
            <CaykurStatCard label="Reddedilen" :value="formatNumber(summary.rejected)" sub="bu sezon" />
        </section>

        <div class="ck-seg" role="group" aria-label="Görünüm" style="margin-bottom: var(--space-4)">
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'pending' }" @click="view = 'pending'">Denetim bekleyenler</button>
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'all' }" @click="view = 'all'">Tüm ölçümler</button>
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'rejected' }" @click="view = 'rejected'">Reddedilenler</button>
        </div>

        <div class="ck-toolbar">
            <div class="ck-search-wrap">
                <svg class="ck-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input v-model="search" type="text" class="ck-search-input" placeholder="Müstahsil veya parsel ara…" />
            </div>
        </div>

        <CaykurPanel>
            <template #head><span class="ck-panel-meta">{{ formatNumber(filtered.length) }} ölçüm</span></template>
            <div v-if="loading" class="ck-empty"><p class="ck-empty-title">Yükleniyor…</p></div>
            <div v-else-if="error" class="ck-empty"><p class="ck-empty-title">{{ error }}</p></div>
            <div v-else-if="filtered.length" class="ck-table-wrap">
                <table class="ck-table">
                    <thead>
                        <tr>
                            <th>Müstahsil</th>
                            <th>Parsel</th>
                            <th>Yöntem</th>
                            <th>Budama oranı</th>
                            <th>Durum</th>
                            <th>Tarih</th>
                            <th aria-label="Detay"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="m in filtered" :key="m.id" class="ck-row-link" @click="openMeasurement(m.id)">
                            <td>
                                <span class="strong" style="display:block">{{ m.producerName ?? 'Müstahsil' }}</span>
                                <span class="ck-name-sub">{{ formatNumber(m.prunedAreaM2) }} / {{ formatNumber(m.fieldAreaM2) }} m²</span>
                            </td>
                            <td>{{ m.parcelNo ?? '—' }}</td>
                            <td>{{ METHOD_LABEL[m.method] }}</td>
                            <td>
                                <div class="ck-cell-meter">
                                    <ComplianceMeter :value="m.ratioPercent" :max="25" :marker="BUDAMA_TARGET_PCT" :tone="ratioTone(m.ratioPercent)" :height="6" />
                                    <span class="ck-cell-meter-val">{{ formatPct(m.ratioPercent, 1) }}</span>
                                </div>
                            </td>
                            <td><StatusPill :label="STATUS_META[m.status].label" :tone="STATUS_META[m.status].tone" /></td>
                            <td style="white-space:nowrap">{{ formatDate(m.measuredAt) }}</td>
                            <td class="ck-chevron-cell"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div v-else class="ck-empty">
                <p class="ck-empty-title">Kayıt yok</p>
                <p class="ck-empty-sub">Budama ölçümleri saha personeli tarafından kaydedildikçe burada görünür.</p>
            </div>
        </CaykurPanel>
    </CaykurPage>
</template>
