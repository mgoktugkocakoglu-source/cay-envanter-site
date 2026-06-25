<script setup lang="ts">
import { ref, computed } from 'vue';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import ComplianceMeter from '@/components/caykur/ComplianceMeter.vue';
import { useDemoProducer } from '@/composables/useDemoProducer';
import {
    kotaTone,
    quotaForProducer,
    QUOTA_STATUS_META,
    deliveriesForProducer,
    STATUS_META,
    SURGUN_LABEL,
    accrualForProducer,
    cariStatement,
    requestsForProducer,
    REQUEST_TYPE_META,
    REQUEST_STATUS_META,
    ANNOUNCEMENTS,
    formatNumber,
    formatKg,
    formatTon,
    formatPct,
    formatTRY,
    formatDate,
    type RequestType,
} from '@/services/caykur';

// Demo "logged-in producer": shared with the producer pruning page so a request
// created on one surface ties to the same müstahsil everywhere.
const { producer } = useDemoProducer();

type Tab = 'deliveries' | 'quota' | 'cari' | 'docs' | 'announcements' | 'requests';
const tab = ref<Tab>('deliveries');

const quota = computed(() => quotaForProducer(producer.value.id));
const deliveries = computed(() => deliveriesForProducer(producer.value.id));
const accrual = computed(() => accrualForProducer(producer.value.id));
const statement = computed(() => cariStatement(producer.value.id));
const myRequests = ref(requestsForProducer(producer.value.id));
const announcements = computed(() =>
    ANNOUNCEMENTS.filter((a) => a.audienceKind === 'all' || a.audienceLabel.includes(producer.value.region) || (a.audienceLabel.includes('Organik') && producer.value.organic)),
);

const docs = computed(() => {
    const base = [
        { name: 'Müstahsil ruhsatı', status: 'approved' as const },
        { name: 'Müstahsil cüzdanı', status: 'approved' as const },
        { name: 'Kimlik fotokopisi', status: 'approved' as const },
        { name: 'Banka IBAN belgesi', status: 'approved' as const },
    ];
    if (producer.value.organic) base.push({ name: 'Organik üretim sertifikası', status: 'pending' as any });
    return base;
});

const docMeta: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
    approved: { label: 'Onaylı', tone: 'success' },
    pending: { label: 'Yenilenmeli', tone: 'warning' },
    missing: { label: 'Eksik', tone: 'danger' },
};

const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'deliveries', label: 'Teslimatlarım' },
    { id: 'quota', label: 'Kota Durumum' },
    { id: 'cari', label: 'Cari Ekstrem' },
    { id: 'docs', label: 'Belgelerim' },
    { id: 'announcements', label: 'Duyurular' },
    { id: 'requests', label: 'Taleplerim' },
];

// New request form (demo, session-only).
const showNewRequest = ref(false);
const newReq = ref({ type: 'genel' as RequestType, subject: '' });
function submitRequest(): void {
    if (!newReq.value.subject.trim()) return;
    myRequests.value = [
        {
            id: `tlp-new-${myRequests.value.length + 1}`,
            type: newReq.value.type,
            subject: newReq.value.subject.trim(),
            producerId: producer.value.id,
            producerName: producer.value.fullName,
            region: producer.value.region,
            status: 'open',
            priority: 'normal',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            assignee: null,
            history: [],
        },
        ...myRequests.value,
    ];
    newReq.value.subject = '';
    showNewRequest.value = false;
}
</script>

<template>
    <TeaBusinessLayout>
        <div class="mp">
            <header class="mp-head">
                <div class="mp-head-main">
                    <span class="mp-mark" aria-hidden="true">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6" /></svg>
                    </span>
                    <div>
                        <h1 class="mp-title">Çaykur Müstahsil Portalı</h1>
                        <p class="mp-sub">{{ producer.fullName }} · Ruhsat {{ producer.ruhsatNo }} · {{ producer.factory }}</p>
                    </div>
                </div>
                <span v-if="producer.organic" class="ck-tag">Organik üretici</span>
            </header>

            <section class="ck-kpi-grid">
                <CaykurStatCard label="Kota kullanımım" :value="formatPct(quota?.usagePct ?? 0)" :sub="`${formatKg(quota?.remainingKg ?? 0)} kalan`">
                    <ComplianceMeter :value="quota?.usagePct ?? 0" :max="120" :tone="kotaTone(quota?.usagePct ?? 0)" />
                </CaykurStatCard>
                <CaykurStatCard label="Bu sezon teslim" :value="formatTon(producer.seasonKg)" :sub="`${formatNumber(deliveries.length)} teslimat`" />
                <CaykurStatCard label="Net hakedişim" :value="formatTRY(accrual?.netPayable ?? 0)" sub="bu sezon" />
                <CaykurStatCard label="Bakiyem" :value="formatTRY(accrual?.balance ?? 0)" sub="ödenecek tutar" />
            </section>

            <div class="ck-seg mp-tabs" role="tablist">
                <button v-for="t in tabs" :key="t.id" type="button" class="ck-seg-btn" :class="{ 'is-active': tab === t.id }" role="tab" :aria-selected="tab === t.id" @click="tab = t.id">{{ t.label }}</button>
            </div>

            <!-- Teslimatlarım -->
            <section v-if="tab === 'deliveries'" class="ck-panel">
                <div class="ck-panel-head"><h2 class="ck-panel-title">Teslimatlarım</h2><span class="ck-panel-meta">{{ formatNumber(deliveries.length) }} fiş</span></div>
                <div class="ck-table-wrap">
                    <table class="ck-table">
                        <thead><tr><th>Fiş no</th><th>Tarih</th><th>Sürgün</th><th class="num">Net</th><th>Kalite</th><th>Durum</th></tr></thead>
                        <tbody>
                            <tr v-for="d in deliveries" :key="d.id">
                                <td class="strong" style="font-variant-numeric: tabular-nums">{{ d.receiptNo }}</td>
                                <td style="white-space:nowrap">{{ formatDate(d.date) }}</td>
                                <td>{{ SURGUN_LABEL[d.surgun] }}</td>
                                <td class="num ck-money">{{ formatKg(d.netKg) }}</td>
                                <td>{{ d.grade }}</td>
                                <td><StatusPill :label="STATUS_META[d.status].label" :tone="STATUS_META[d.status].tone" /></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <!-- Kota -->
            <section v-else-if="tab === 'quota'" class="ck-panel">
                <div class="ck-panel-head"><h2 class="ck-panel-title">Kota durumum</h2><StatusPill v-if="quota" :label="QUOTA_STATUS_META[quota.status].label" :tone="QUOTA_STATUS_META[quota.status].tone" /></div>
                <div class="ck-panel-body" v-if="quota">
                    <dl class="ck-dl" style="padding-left:0;padding-right:0">
                        <div class="ck-dl-item"><span class="ck-dl-term">Yıllık kotam</span><span class="ck-dl-val">{{ formatKg(quota.quotaKg) }}</span></div>
                        <div class="ck-dl-item"><span class="ck-dl-term">Kullandığım</span><span class="ck-dl-val">{{ formatKg(quota.usedKg) }}</span></div>
                        <div class="ck-dl-item"><span class="ck-dl-term">Kalan kotam</span><span class="ck-dl-val">{{ formatKg(quota.remainingKg) }}</span></div>
                        <div class="ck-dl-item"><span class="ck-dl-term">Ruhsatlı alan</span><span class="ck-dl-val">{{ formatNumber(quota.licensedDekar, 1) }} da</span></div>
                    </dl>
                    <div class="quota-bar">
                        <ComplianceMeter :value="quota.usagePct" :max="120" :tone="kotaTone(quota.usagePct)" :height="12" />
                        <span class="quota-pct">{{ formatPct(quota.usagePct) }} kullanıldı</span>
                    </div>
                </div>
            </section>

            <!-- Cari -->
            <section v-else-if="tab === 'cari'" class="ck-panel">
                <div class="ck-panel-head"><h2 class="ck-panel-title">Cari ekstrem</h2><span class="ck-panel-meta">Bakiye: {{ formatTRY(statement.balance) }}</span></div>
                <div class="ck-table-wrap">
                    <table class="ck-table">
                        <thead><tr><th>Tarih</th><th>Açıklama</th><th class="num">Alacak</th><th class="num">Borç</th><th class="num">Bakiye</th></tr></thead>
                        <tbody>
                            <tr v-for="(e, i) in statement.entries" :key="i">
                                <td style="white-space:nowrap">{{ formatDate(e.date) }}</td>
                                <td>{{ e.description }}</td>
                                <td class="num" style="color:var(--color-success)">{{ e.credit ? formatTRY(e.credit) : '—' }}</td>
                                <td class="num">{{ e.debit ? formatTRY(e.debit) : '—' }}</td>
                                <td class="num ck-money">{{ formatTRY(e.balance) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <!-- Belgeler -->
            <section v-else-if="tab === 'docs'" class="ck-panel">
                <div class="ck-panel-head"><h2 class="ck-panel-title">Belgelerim</h2><button type="button" class="ck-btn ck-btn-sm">Belge yükle</button></div>
                <div class="ck-table-wrap">
                    <table class="ck-table">
                        <thead><tr><th>Belge</th><th>Durum</th></tr></thead>
                        <tbody>
                            <tr v-for="d in docs" :key="d.name">
                                <td class="strong">{{ d.name }}</td>
                                <td><StatusPill :label="docMeta[d.status].label" :tone="docMeta[d.status].tone" /></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <!-- Duyurular -->
            <section v-else-if="tab === 'announcements'" class="ann-list">
                <article v-for="a in announcements" :key="a.id" class="ann-card">
                    <div class="ann-head"><h3 class="ann-title">{{ a.title }}</h3><span class="ann-date">{{ formatDate(a.publishedAt) }}</span></div>
                    <p class="ann-body">{{ a.body }}</p>
                </article>
            </section>

            <!-- Talepler -->
            <section v-else class="ck-panel">
                <div class="ck-panel-head">
                    <h2 class="ck-panel-title">Taleplerim</h2>
                    <button type="button" class="ck-btn ck-btn-sm ck-btn-primary" @click="showNewRequest = !showNewRequest">Yeni talep</button>
                </div>
                <div v-if="showNewRequest" class="newreq">
                    <select v-model="newReq.type" class="ck-select">
                        <option value="parsel">Parsel düzeltme</option>
                        <option value="kota">Kota itirazı</option>
                        <option value="odeme">Ödeme itirazı</option>
                        <option value="belge">Belge talebi</option>
                        <option value="genel">Genel talep</option>
                    </select>
                    <input v-model="newReq.subject" type="text" class="ck-search-input" placeholder="Talep konusu…" style="padding-left:14px" />
                    <button type="button" class="ck-btn ck-btn-primary" :disabled="!newReq.subject.trim()" @click="submitRequest">Gönder</button>
                </div>
                <div class="ck-table-wrap">
                    <table class="ck-table">
                        <thead><tr><th>Konu</th><th>Tür</th><th>Tarih</th><th>Durum</th></tr></thead>
                        <tbody>
                            <tr v-for="r in myRequests" :key="r.id">
                                <td class="strong">{{ r.subject }}</td>
                                <td>{{ REQUEST_TYPE_META[r.type].label }}</td>
                                <td style="white-space:nowrap">{{ formatDate(r.createdAt) }}</td>
                                <td><StatusPill :label="REQUEST_STATUS_META[r.status].label" :tone="REQUEST_STATUS_META[r.status].tone" /></td>
                            </tr>
                        </tbody>
                    </table>
                    <div v-if="!myRequests.length" class="ck-empty"><p class="ck-empty-title">Henüz talebiniz yok</p></div>
                </div>
            </section>
        </div>
    </TeaBusinessLayout>
</template>

<style scoped>
.mp { max-width: 1100px; margin: 0 auto; padding: var(--space-6) var(--space-6) var(--space-12); }
.mp-head {
    display: flex; align-items: center; justify-content: space-between; gap: var(--space-4);
    margin-bottom: var(--space-5); flex-wrap: wrap;
}
.mp-head-main { display: flex; align-items: center; gap: var(--space-3); }
.mp-mark {
    display: inline-flex; align-items: center; justify-content: center;
    width: 44px; height: 44px; border-radius: var(--radius-md);
    background: var(--color-secondary); color: #fff; flex-shrink: 0;
}
.mp-title { margin: 0; font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); color: var(--color-text-primary); letter-spacing: -0.01em; }
.mp-sub { margin: 3px 0 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }
.mp-tabs { margin-bottom: var(--space-4); flex-wrap: nowrap; }
.quota-bar { margin-top: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); }
.quota-pct { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); }
.newreq { display: flex; gap: var(--space-2); padding: 0 var(--space-5) var(--space-4); flex-wrap: wrap; }
.newreq .ck-search-input { flex: 1 1 240px; min-width: 200px; }
.ann-list { display: flex; flex-direction: column; gap: var(--space-3); }
.ann-card { background: var(--color-card-bg); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-5); }
.ann-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); }
.ann-title { margin: 0; font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.ann-date { font-size: var(--font-size-xs); color: var(--color-text-muted); white-space: nowrap; }
.ann-body { margin: var(--space-2) 0 0; font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.6; }
</style>
