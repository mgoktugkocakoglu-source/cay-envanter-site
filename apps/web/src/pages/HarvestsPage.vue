<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useHarvestsStore } from '@/stores/harvestsStore';
import { useFieldsStore } from '@/stores/fieldsStore';
import { usePaymentsStore } from '@/stores/paymentsStore';
import { useToast } from '@/composables/useToast';
import { api, type Harvest } from '@/services/api';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import AppEmptyState from '@/components/ui/AppEmptyState.vue';
import DeliveryBox from '@/components/harvests/DeliveryBox.vue';

const harvestsStore = useHarvestsStore();
const fieldsStore = useFieldsStore();
const paymentsStore = usePaymentsStore();
const toast = useToast();

// ─── Main Tab State ───
const activeMainTab = ref<'harvests' | 'analysis' | 'payments'>('harvests');

// ─── Arazi ekle (land assignment) modal ───
const showFieldPicker = ref(false);
const pickerDeliveryId = ref('');
const pickerFieldId = ref('');
const isAssigning = ref(false);

// ─── Shared filter / analysis state ───
const fieldFilter = ref('');
const yearFilter = ref(new Date().getFullYear());
const statusFilter = ref('');
const analysisHarvests = ref<Harvest[]>([]);
const isLoadingAnalysis = ref(false);

const monthNames = [
    'Ocak',
    'Subat',
    'Mart',
    'Nisan',
    'Mayis',
    'Haziran',
    'Temmuz',
    'Agustos',
    'Eylul',
    'Ekim',
    'Kasim',
    'Aralik',
];

const years = computed(() => {
    const current = new Date().getFullYear();
    return [current, current - 1, current - 2, current - 3, current - 4];
});

// ─── Computed Options ───
const yearOptions = computed(() =>
    years.value.map(y => ({ value: y, label: String(y) }))
);

const fieldFilterOptions = computed(() => [
    { value: '', label: 'Tüm Araziler' },
    ...fieldsStore.fields.map(f => ({ value: f.id, label: f.name?.trim() || 'İsimsiz Arazi' }))
]);

const statusOptions = [
    { value: '', label: 'Tüm Durumlar' },
    { value: 'received', label: 'Ödendi' },
    { value: 'pending', label: 'Bekliyor' },
];

const fieldPickerOptions = computed(() => [
    { value: '', label: 'Arazi seçiniz...' },
    ...fieldsStore.fields.map(f => ({
        value: f.id,
        label: f.name?.trim() || `İsimsiz Arazi (Parsel ${f.parcelNo ?? '—'})`,
    })),
]);

const analysisMonthRows = computed(() => {
    const selectedYear = Number(yearFilter.value);
    const selectedField = fieldFilter.value;
    const totals = new Map<string, { fieldId: string; fieldName: string; month: number; kg: number }>();

    analysisHarvests.value.forEach((harvest) => {
        const date = new Date(harvest.harvestDate);
        if (date.getFullYear() !== selectedYear) return;
        if (selectedField && harvest.fieldId !== selectedField) return;

        const month = date.getMonth();
        const key = `${harvest.fieldId}-${month}`;
        const current = totals.get(key) || {
            fieldId: harvest.fieldId,
            fieldName: harvest.fieldName || fieldsStore.fields.find(f => f.id === harvest.fieldId)?.name || 'Arazi',
            month,
            kg: 0,
        };
        current.kg += harvestAmount(harvest);
        totals.set(key, current);
    });

    const grouped = new Map<string, Array<{ fieldId: string; fieldName: string; month: number; kg: number }>>();
    Array.from(totals.values()).forEach((row) => {
        const fieldRows = grouped.get(row.fieldId) || [];
        fieldRows.push(row);
        grouped.set(row.fieldId, fieldRows);
    });

    return Array.from(grouped.values()).flatMap((rows) => {
        const sorted = rows.sort((a, b) => a.month - b.month);
        return sorted.map((row, index) => {
            const previous = sorted[index - 1] || null;
            const changePercent = previous && previous.kg > 0
                ? ((row.kg - previous.kg) / previous.kg) * 100
                : null;

            return {
                ...row,
                monthName: monthNames[row.month],
                previousMonthName: previous ? monthNames[previous.month] : null,
                previousKg: previous?.kg ?? null,
                changePercent,
            };
        });
    });
});

const analysisYearRows = computed(() => {
    const selectedYear = Number(yearFilter.value);
    const selectedField = fieldFilter.value;
    const totals = new Map<string, { fieldId: string; fieldName: string; currentKg: number; previousKg: number }>();

    analysisHarvests.value.forEach((harvest) => {
        if (selectedField && harvest.fieldId !== selectedField) return;

        const date = new Date(harvest.harvestDate);
        const year = date.getFullYear();
        if (year !== selectedYear && year !== selectedYear - 1) return;

        const current = totals.get(harvest.fieldId) || {
            fieldId: harvest.fieldId,
            fieldName: harvest.fieldName || fieldsStore.fields.find(f => f.id === harvest.fieldId)?.name || 'Arazi',
            currentKg: 0,
            previousKg: 0,
        };

        if (year === selectedYear) current.currentKg += harvestAmount(harvest);
        if (year === selectedYear - 1) current.previousKg += harvestAmount(harvest);
        totals.set(harvest.fieldId, current);
    });

    return Array.from(totals.values())
        .filter(row => row.currentKg > 0 || row.previousKg > 0)
        .map((row) => ({
            ...row,
            changePercent: row.previousKg > 0
                ? ((row.currentKg - row.previousKg) / row.previousKg) * 100
                : null,
        }));
});

const analysisNotifications = computed(() =>
    analysisMonthRows.value
        .filter(row => row.changePercent !== null && Math.abs(row.changePercent) >= 10)
        .slice(0, 4)
);

// ─── Deliveries (auto-dropped Çaykur sales) ───
const deliveries = computed(() => paymentsStore.payments);
const unassignedCount = computed(() => paymentsStore.unassignedDeliveries.length);

// Payments tab list honours the status filter (year is applied server-side).
const filteredPayments = computed(() => {
    if (!statusFilter.value) return paymentsStore.payments;
    return paymentsStore.payments.filter(p => p.paymentStatus === statusFilter.value);
});

// ─── Lifecycle ───
onMounted(() => {
    fieldsStore.fetchFields();
    harvestsStore.fetchHarvests({ year: yearFilter.value });
    paymentsStore.fetchPayments({ year: yearFilter.value });
    loadAnalysisData();
});

// ─── Arazi ekle (assign land to a delivery) ───
function openFieldPicker(deliveryId: string) {
    pickerDeliveryId.value = deliveryId;
    pickerFieldId.value = '';
    showFieldPicker.value = true;
}

async function confirmAssignField() {
    if (!pickerFieldId.value) {
        toast.error('Lütfen bir arazi seçin');
        return;
    }
    isAssigning.value = true;
    const ok = await paymentsStore.assignField(pickerDeliveryId.value, pickerFieldId.value);
    isAssigning.value = false;
    if (ok) {
        toast.success('Teslimat araziye atandı');
        showFieldPicker.value = false;
        // Refresh harvest-backed analysis now that a new harvest exists.
        harvestsStore.fetchHarvests({ year: yearFilter.value });
        loadAnalysisData();
    } else {
        toast.error(paymentsStore.error || 'Arazi atanırken hata oluştu');
    }
}

// ─── Filters ───
function applyFilters() {
    const params: Record<string, unknown> = {};
    if (fieldFilter.value) params.fieldId = fieldFilter.value;
    if (yearFilter.value) params.year = yearFilter.value;
    harvestsStore.fetchHarvests(params as { fieldId?: string; year?: number });
    paymentsStore.fetchPayments({ year: yearFilter.value });
    loadAnalysisData();
}

async function loadAnalysisData() {
    isLoadingAnalysis.value = true;
    const selectedYear = Number(yearFilter.value);

    try {
        const [currentYear, previousYear] = await Promise.all([
            api.getHarvests({ year: selectedYear }),
            api.getHarvests({ year: selectedYear - 1 }),
        ]);

        analysisHarvests.value = [
            ...(currentYear.data || []),
            ...(previousYear.data || []),
        ];
    } finally {
        isLoadingAnalysis.value = false;
    }
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

function formatKg(kg?: number | string) {
    if (kg === undefined || kg === null) return '-';
    const num = typeof kg === 'string' ? parseFloat(kg) : kg;
    return num.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' kg';
}

function harvestAmount(harvest: Harvest) {
    return Number.parseFloat(String(harvest.amountKg || 0)) || 0;
}

function formatPercent(value: number | null) {
    if (value === null) return 'Karşılaştırma yok';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}%`;
}

function getTrendLabel(value: number | null) {
    if (value === null) return 'Onceki veri yok';
    if (value > 0) return 'Verim artisi';
    if (value < 0) return 'Verim dususu';
    return 'Degisim yok';
}

function formatPrice(price: number) {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(price);
}

function statusLabel(status: string) {
    return status === 'received' ? 'Ödendi' : 'Bekliyor';
}
</script>

<template>
    <TeaBusinessLayout>
        <div class="harvests-page">
            <!-- Page Header -->
            <header class="page-header">
                <div class="header-content">
                    <h1>Hasatlarım</h1>
                    <p class="subtitle">Çaykur teslimatlarınızı görüntüleyin, arazilerinize atayın ve ödemelerinizi takip edin</p>
                </div>
            </header>

            <!-- Main Tabs -->
            <div class="main-tabs app-tabs">
                <button
                    class="main-tab-btn app-tab-btn"
                    :class="{ 'main-tab-btn--active app-tab-btn--active': activeMainTab === 'harvests' }"
                    @click="activeMainTab = 'harvests'"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    Hasat Verilerim
                    <span v-if="unassignedCount > 0" class="tab-count">{{ unassignedCount }}</span>
                </button>
                <button
                    class="main-tab-btn app-tab-btn"
                    :class="{ 'main-tab-btn--active app-tab-btn--active': activeMainTab === 'analysis' }"
                    @click="activeMainTab = 'analysis'"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                    Arazi Verim Analizi
                </button>
                <button
                    class="main-tab-btn app-tab-btn"
                    :class="{ 'main-tab-btn--active app-tab-btn--active': activeMainTab === 'payments' }"
                    @click="activeMainTab = 'payments'"
                >
                    <span class="currency-tab-icon" aria-hidden="true">₺</span>
                    Ödemeler
                </button>
            </div>

            <!-- ═══════════════ TAB: Hasat Verilerim (Çaykur teslimatları) ═══════════════ -->
            <div v-if="activeMainTab === 'harvests'" class="tab-content">
                <div class="sales-header">
                    <p class="sales-summary">
                        Çaykur veritabanından gelen çay satışlarınız. Her teslimatı, çayı topladığınız araziye atayın.
                    </p>
                </div>

                <div class="filters">
                    <AppSelect
                        v-model="yearFilter"
                        :options="yearOptions"
                        placeholder="Yıl"
                        @update:model-value="applyFilters"
                    />
                </div>

                <div v-if="paymentsStore.isLoading" class="loading">
                    <div class="spinner"></div>
                </div>

                <AppEmptyState
                    v-else-if="deliveries.length === 0"
                    icon="leaf"
                    title="Henüz teslimat yok"
                    description="Çaykur'a sattığınız çaylar bu alana otomatik olarak düşer."
                />

                <div v-else class="delivery-grid">
                    <DeliveryBox
                        v-for="delivery in deliveries"
                        :key="delivery.id"
                        :delivery="delivery"
                        @assign="openFieldPicker"
                    />
                </div>
            </div>

            <!-- ═══════════════ TAB 3: Arazi Verim Analizi ═══════════════ -->
            <div v-if="activeMainTab === 'analysis'" class="tab-content">
                <div class="analysis-header">
                    <div>
                        <h2>Arazi Verim Analizi</h2>
                        <p>Arazilerinizin aylık ve yıllık yaş çay verimini karşılaştırın.</p>
                    </div>
                    <div class="filters analysis-filters">
                        <AppSelect
                            v-model="yearFilter"
                            :options="yearOptions"
                            placeholder="Yıl"
                            @update:model-value="applyFilters"
                        />
                        <AppSelect
                            v-model="fieldFilter"
                            :options="fieldFilterOptions"
                            placeholder="Arazi"
                            @update:model-value="applyFilters"
                        />
                    </div>
                </div>

                <div v-if="isLoadingAnalysis" class="loading">
                    <div class="spinner"></div>
                </div>

                <AppEmptyState
                    v-else-if="analysisMonthRows.length === 0 && analysisYearRows.length === 0"
                    icon="bar-chart"
                    title="Analiz icin hasat verisi yok"
                    description="Hasat Verilerim sekmesinden teslimatlarınızı bir araziye atadığınızda verim değişimleri burada görünür."
                />

                <template v-else>
                    <div v-if="analysisNotifications.length > 0" class="analysis-notifications">
                        <div
                            v-for="item in analysisNotifications"
                            :key="`${item.fieldId}-${item.month}`"
                            class="analysis-notification"
                            :class="{ 'analysis-notification--down': item.changePercent !== null && item.changePercent < 0 }"
                        >
                            <strong>{{ item.fieldName }}</strong>
                            <span>
                                {{ item.previousMonthName }} ayina gore {{ item.monthName }} ayinda
                                {{ formatPercent(item.changePercent) }} {{ item.changePercent !== null && item.changePercent >= 0 ? 'verim artisi' : 'verim dususu' }} gozlemlendi.
                            </span>
                        </div>
                    </div>

                    <section class="analysis-section">
                        <div class="analysis-section-header">
                            <h3>Aylık Karşılaştırma</h3>
                            <p>Ayni arazide bir onceki hasat ayina gore degisim.</p>
                        </div>
                        <div class="analysis-grid">
                            <article
                                v-for="row in analysisMonthRows"
                                :key="`${row.fieldId}-${row.month}`"
                                class="analysis-card"
                            >
                                <div class="analysis-card-top">
                                    <div>
                                        <span class="analysis-field">{{ row.fieldName }}</span>
                                        <strong>{{ row.monthName }}</strong>
                                    </div>
                                    <span
                                        class="analysis-trend"
                                        :class="{ 'analysis-trend--down': row.changePercent !== null && row.changePercent < 0 }"
                                    >
                                        {{ formatPercent(row.changePercent) }}
                                    </span>
                                </div>
                                <div class="analysis-metric">
                                    <span>Toplanan</span>
                                    <strong>{{ formatKg(row.kg) }}</strong>
                                </div>
                                <p class="analysis-note">
                                    <template v-if="row.previousKg !== null">
                                        {{ row.previousMonthName }}: {{ formatKg(row.previousKg) }} - {{ getTrendLabel(row.changePercent) }}
                                    </template>
                                    <template v-else>
                                        Bu yil icin ilk hasat ayi.
                                    </template>
                                </p>
                            </article>
                        </div>
                    </section>

                    <section class="analysis-section">
                        <div class="analysis-section-header">
                            <h3>Yıllık Karşılaştırma</h3>
                            <p>{{ Number(yearFilter) - 1 }} yilina gore {{ yearFilter }} toplam verim degisimi.</p>
                        </div>
                        <div class="year-table">
                            <div class="year-row year-row--head">
                                <span>Arazi</span>
                                <span>{{ Number(yearFilter) - 1 }}</span>
                                <span>{{ yearFilter }}</span>
                                <span>Degisim</span>
                            </div>
                            <div v-for="row in analysisYearRows" :key="row.fieldId" class="year-row">
                                <strong>{{ row.fieldName }}</strong>
                                <span>{{ formatKg(row.previousKg) }}</span>
                                <span>{{ formatKg(row.currentKg) }}</span>
                                <span
                                    class="analysis-trend"
                                    :class="{ 'analysis-trend--down': row.changePercent !== null && row.changePercent < 0 }"
                                >
                                    {{ formatPercent(row.changePercent) }}
                                </span>
                            </div>
                        </div>
                    </section>
                </template>
            </div>

            <!-- ═══════════════ TAB: Ödemeler ═══════════════ -->
            <div v-if="activeMainTab === 'payments'" class="tab-content">
                <div class="sales-header">
                    <p class="sales-summary">
                        Toplam gelir: <strong>{{ formatPrice(paymentsStore.totalIncome) }}</strong>
                    </p>
                </div>

                <div class="filters">
                    <AppSelect
                        v-model="yearFilter"
                        :options="yearOptions"
                        placeholder="Yıl"
                        @update:model-value="applyFilters"
                    />
                    <AppSelect
                        v-model="statusFilter"
                        :options="statusOptions"
                        placeholder="Durum"
                    />
                </div>

                <div v-if="paymentsStore.isLoading" class="loading">
                    <div class="spinner"></div>
                </div>

                <AppEmptyState
                    v-else-if="filteredPayments.length === 0"
                    icon="payment"
                    title="Ödeme kaydı yok"
                    description="Çaykur teslimatlarınızın ödemeleri burada listelenir."
                />

                <template v-else>
                    <div class="data-table-wrapper desktop-only">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Tarih</th>
                                    <th>Firma</th>
                                    <th>Miktar</th>
                                    <th>Tutar</th>
                                    <th>Durum</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="p in filteredPayments" :key="p.id">
                                    <td>{{ formatDate(p.paymentDate) }}</td>
                                    <td><span class="cell-primary">{{ p.firm?.name || p.brokerFirm?.firmName || '—' }}</span></td>
                                    <td>{{ formatKg(p.totalAmountKg) }}</td>
                                    <td><span class="cell-highlight">{{ formatPrice(p.totalPrice) }}</span></td>
                                    <td>
                                        <span class="status-pill" :class="p.paymentStatus === 'received' ? 'status-pill--received' : 'status-pill--pending'">
                                            {{ statusLabel(p.paymentStatus) }}
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="card-list mobile-only">
                        <div v-for="p in filteredPayments" :key="'pay-' + p.id" class="data-card">
                            <div class="card-header">
                                <span class="card-title">{{ p.firm?.name || p.brokerFirm?.firmName || '—' }}</span>
                                <span class="card-value">{{ formatDate(p.paymentDate) }}</span>
                            </div>
                            <div class="card-body">
                                <div class="card-row">
                                    <span class="card-label">Miktar</span>
                                    <span class="card-value">{{ formatKg(p.totalAmountKg) }}</span>
                                </div>
                                <div class="card-row">
                                    <span class="card-label">Tutar</span>
                                    <span class="card-value card-value--highlight">{{ formatPrice(p.totalPrice) }}</span>
                                </div>
                                <div class="card-row">
                                    <span class="card-label">Durum</span>
                                    <span class="card-value">{{ statusLabel(p.paymentStatus) }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>
            </div>

            <!-- ═══ Arazi ekle (land assignment) modal ═══ -->
            <div v-if="showFieldPicker" class="picker-overlay" role="dialog" aria-modal="true" @click.self="showFieldPicker = false" @keydown.esc="showFieldPicker = false">
                <div class="picker-card">
                    <h2 class="picker-title">Arazi ekle</h2>
                    <p class="picker-desc">Bu çay teslimatını hangi arazinizden topladınız?</p>
                    <AppSelect
                        v-model="pickerFieldId"
                        :options="fieldPickerOptions"
                        placeholder="Arazi seçiniz..."
                        variant="light"
                    />
                    <div class="picker-actions">
                        <button class="btn-secondary" :disabled="isAssigning" @click="showFieldPicker = false">İptal</button>
                        <button class="btn-primary" :disabled="isAssigning || !pickerFieldId" @click="confirmAssignField">
                            <span v-if="isAssigning" class="btn-spinner"></span>
                            {{ isAssigning ? 'Kaydediliyor...' : 'Araziyi Ata' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </TeaBusinessLayout>
</template>

<style scoped>
.harvests-page {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
}

/* ═══════════════ Page Header ═══════════════ */
.page-header {
    margin-bottom: 24px;
}

.header-content h1 {
    font-size: 32px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
}

.subtitle {
    color: var(--color-text-muted);
    margin: 4px 0 0 0;
    font-size: 14px;
}

/* ═══════════════ Main Tabs ═══════════════ */
.main-tabs {
    display: flex;
    gap: var(--space-1);
    margin-bottom: 24px;
    background: var(--color-subtle-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-1);
    box-shadow: var(--shadow-sm);
}

.main-tab-btn {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 var(--space-5);
    border: 1px solid transparent;
    border-radius: calc(var(--radius-md) - 1px);
    background: transparent;
    color: var(--color-text-secondary);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
    flex: 1;
    justify-content: center;
    white-space: nowrap;
}

.main-tab-btn:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-secondary);
    border-color: var(--color-border);
}

.main-tab-btn--active {
    background: var(--color-bg-secondary);
    border-color: var(--color-border-strong);
    color: var(--color-primary);
    box-shadow: var(--shadow-md);
}

.main-tab-btn--active::before {
    content: '';
    position: absolute;
    left: 14px;
    right: 14px;
    bottom: 5px;
    height: 2px;
    border-radius: var(--radius-full);
    background: var(--color-primary);
}

.main-tab-btn--active:hover {
    background: var(--color-bg-secondary);
    color: var(--color-primary);
}

/* ═══════════════ Tab Content ═══════════════ */
.tab-content {
    animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
}

/* ═══════════════ Step Indicator ═══════════════ */
.step-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    margin-bottom: 32px;
    padding: 24px 0;
}

.step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    min-width: 80px;
}

.step-circle {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
    border: 2px solid var(--color-border);
    color: var(--color-text-muted);
    background: var(--color-bg-secondary);
    transition: all var(--transition-fast);
}

.step--active .step-circle {
    border-color: var(--color-primary);
    color: white;
    background: var(--color-primary);
}

.step--done .step-circle {
    border-color: var(--color-success);
    color: white;
    background: var(--color-success);
}

.step-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-muted);
    text-align: center;
}

.step--active .step-label {
    color: var(--color-primary);
}

.step--done .step-label {
    color: var(--color-success);
}

.step-line {
    height: 2px;
    width: 60px;
    background: var(--color-border);
    margin: 0 8px;
    margin-bottom: 24px;
    transition: background var(--transition-fast);
}

.step-line--active {
    background: var(--color-success);
}

/* ═══════════════ Wizard Step ═══════════════ */
.wizard-step {
    animation: fadeIn 0.25s ease;
}

.wizard-step-header {
    margin-bottom: 24px;
}

.wizard-step-header h2 {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0 0 8px;
}

.wizard-step-header p {
    color: var(--color-text-muted);
    font-size: 14px;
    margin: 0;
    line-height: 1.5;
}

.step-header-with-back {
    display: flex;
    align-items: flex-start;
    gap: 12px;
}

.btn-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    flex-shrink: 0;
    margin-top: 2px;
}

.btn-back:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: var(--color-primary-light);
}

/* ═══════════════ Firm Selection ═══════════════ */
.firm-selection-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.firm-selection-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-xl);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.firm-selection-card:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
}

.firm-selection-card--add {
    border-style: dashed;
    border-color: var(--color-text-muted);
}

.firm-selection-card--add:hover {
    border-color: var(--color-primary);
    border-style: solid;
}

.firm-selection-avatar {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-lg);
    background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 16px;
    flex-shrink: 0;
}

.firm-add-icon {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-lg);
    background: var(--color-bg-tertiary);
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.firm-selection-info {
    flex: 1;
    min-width: 0;
}

.firm-selection-info h3 {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 2px;
}

.firm-selection-info p {
    font-size: 13px;
    color: var(--color-text-muted);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.firm-selection-arrow {
    color: var(--color-text-muted);
    flex-shrink: 0;
    transition: transform var(--transition-fast);
}

.firm-selection-card:hover .firm-selection-arrow {
    color: var(--color-primary);
    transform: translateX(4px);
}

.text-muted {
    color: var(--color-text-muted);
}

.empty-hint {
    text-align: center;
    padding: 16px;
    color: var(--color-text-muted);
    font-size: 14px;
}

/* ═══════════════ Tariff Selection ═══════════════ */
.tariff-selection-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
}

.tariff-selection-card {
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: 24px;
    text-align: center;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.tariff-selection-card:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
}

.tariff-sel-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 12px;
}

.tariff-quality-icon {
    font-size: 28px;
}

.tariff-quality-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
}

.tariff-sel-price {
    font-size: 28px;
    font-weight: 700;
    color: var(--color-primary);
    margin-bottom: 8px;
}

.tariff-sel-unit {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-muted);
}

.tariff-sel-date {
    font-size: 12px;
    color: var(--color-text-muted);
}

.tariff-sel-ongoing {
    color: var(--color-success);
    font-weight: 500;
}

/* ═══════════════ Sale Form Card ═══════════════ */
.sale-form-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: 24px;
    box-shadow: var(--shadow-sm);
}

.sale-form-header {
    margin-bottom: 20px;
}

.sale-form-header h2 {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0 0 6px;
}

.sale-form-header p {
    color: var(--color-text-muted);
    font-size: 14px;
    margin: 0;
    line-height: 1.5;
}

/* ═══════════════ Firm Chips ═══════════════ */
.firm-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
}

.firm-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 46px;
    padding: 4px var(--space-4) 4px var(--space-2);
    background: var(--color-input-bg);
    border: 1px solid var(--color-input-border);
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    font-family: inherit;
    white-space: nowrap;
}

.firm-chip:hover {
    border-color: var(--color-border-strong);
    background: var(--color-card-bg-hover);
    color: var(--color-text-primary);
}

.firm-chip--active {
    background: var(--color-input-bg);
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary);
    color: var(--color-text-primary);
    font-weight: 600;
}

.firm-chip--active .firm-chip-avatar {
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
}

.firm-chip-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: var(--radius-md);
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
}

.firm-chip-avatar--logo {
    background: white;
    color: transparent;
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.35);
    padding: 3px;
}

.firm-chip-logo {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
}

.firm-chip-name {
    overflow: hidden;
    text-overflow: ellipsis;
}

.firm-chip--add {
    display: none;
}

.firm-chip--add:hover {
    display: none;
}

.loading-inline {
    display: flex;
    align-items: center;
    padding: 8px 0;
}

.spinner-sm {
    width: 18px;
    height: 18px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

/* ═══════════════ Tariff Toggle Button ═══════════════ */
.tariff-panel-toggle {
    display: flex;
}

.btn-tariff-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: var(--control-height);
    padding: 0 var(--space-4);
    background: var(--color-input-bg);
    border: 1px dashed var(--color-input-border);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    font-family: inherit;
}

.btn-tariff-toggle:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: var(--color-primary-light);
}

.btn-tariff-toggle--open {
    border-style: solid;
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: var(--color-primary-light);
}

.tariff-toggle-hint {
    color: var(--color-text-muted);
    font-weight: 400;
    font-size: 13px;
}

/* ═══════════════ Tariff Panel ═══════════════ */
.tariff-panel {
    background: var(--color-card-bg-hover);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    overflow: hidden;
}

.tariff-panel-header h4 {
    font-size: 15px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0 0 4px;
}

.tariff-panel-header p {
    color: var(--color-text-muted);
    font-size: 13px;
    margin: 0;
    line-height: 1.5;
}

.tariff-panel-enter-active,
.tariff-panel-leave-active {
    transition: opacity 0.2s ease, transform 0.2s ease, max-height 0.25s ease;
    max-height: 1000px;
}

.tariff-panel-enter-from,
.tariff-panel-leave-to {
    opacity: 0;
    transform: translateY(-6px);
    max-height: 0;
}

.split-toggle-row {
    display: flex;
}

.split-toggle-label {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    height: var(--control-height);
    padding: 0 var(--space-3);
    background: var(--color-input-bg);
    border: 1px solid var(--color-input-border);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    font-size: 14px;
    cursor: pointer;
}

.split-toggle-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--color-primary);
    cursor: pointer;
}

/* ═══════════════ Payment Term Buttons ═══════════════ */
.payment-term-options {
    display: flex;
    gap: 6px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 4px;
}

.term-btn {
    flex: 1;
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm, 6px);
    color: var(--color-text-secondary);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    font-family: inherit;
    white-space: nowrap;
}

.term-btn:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-tertiary);
}

.term-btn--active {
    background: var(--color-primary);
    color: white;
}

.term-btn--active:hover {
    background: var(--color-primary-hover);
    color: white;
}

/* ═══════════════ Split Payment Entries ═══════════════ */
.split-entry {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.split-entry-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.split-badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    background: var(--color-primary-light);
    color: var(--color-primary);
    border-radius: var(--radius-full);
    font-size: 12px;
    font-weight: 600;
}

.btn-icon-sm {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm, 6px);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.btn-icon-sm:hover {
    background: rgba(239, 68, 68, 0.1);
    color: var(--color-danger);
}

.btn-add-split {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 16px;
    background: transparent;
    border: 1.5px dashed var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    font-family: inherit;
    align-self: flex-start;
}

.btn-add-split:hover {
    border-style: solid;
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: var(--color-primary-light);
}

/* ═══════════════ Form Rows ═══════════════ */
.form-row {
    display: grid;
    gap: 12px;
}

.form-row--3 {
    grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 540px) {
    .form-row--3 {
        grid-template-columns: 1fr;
    }
}

/* ═══════════════ Sale Form (Step 3) ═══════════════ */
.sale-form {
    max-width: 560px;
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.form-label {
    font-weight: 600;
    font-size: 14px;
    color: var(--color-text-secondary);
}

.required {
    color: var(--color-danger);
}

.form-input {
    width: 100%;
    height: var(--control-height);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-input-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    background: var(--color-input-bg);
    color: var(--color-text-primary);
    transition: all var(--transition-fast);
    font-family: inherit;
    box-sizing: border-box;
}

.form-input:hover {
    border-color: var(--color-border-strong);
}

.form-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-input--lg {
    font-size: var(--font-size-base);
    font-weight: 600;
    padding: 0 var(--space-4);
}

.form-input::placeholder {
    color: var(--color-text-muted);
    font-weight: var(--font-weight-normal);
}

select.form-input {
    appearance: none;
    cursor: pointer;
    padding-right: 40px;
    background-image: linear-gradient(45deg, transparent 50%, var(--color-text-muted) 50%), linear-gradient(135deg, var(--color-text-muted) 50%, transparent 50%);
    background-position: calc(100% - 18px) 17px, calc(100% - 12px) 17px;
    background-size: 6px 6px, 6px 6px;
    background-repeat: no-repeat;
}

.kg-input-wrap {
    position: relative;
}

.kg-input-wrap input {
    width: 100%;
    padding-right: 52px;
}

.kg-suffix {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-text-muted);
    font-weight: 600;
    font-size: 14px;
    pointer-events: none;
}

.estimated-total {
    font-size: 14px;
    color: var(--color-text-secondary);
    margin: 0;
}

.estimated-total strong {
    color: var(--color-primary);
    font-weight: 700;
}

.date-auto-info {
    font-size: 13px;
    color: var(--color-text-muted);
    margin: 4px 0 0 0;
    line-height: 1.5;
}

.date-auto-info strong {
    color: var(--color-text-primary);
}

.date-input-wrap {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

/* ═══════════════ Preview Card ═══════════════ */
.preview-card {
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: 20px;
}

.preview-card h4 {
    font-size: 14px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0 0 16px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.preview-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    font-size: 14px;
}

.preview-row + .preview-row {
    border-top: 1px solid var(--color-border);
}

.preview-row span:first-child {
    color: var(--color-text-muted);
    font-weight: 500;
}

.preview-row span:last-child {
    color: var(--color-text-primary);
    font-weight: 600;
}

.preview-row--total {
    margin-top: 8px;
    padding-top: 12px;
    border-top: 2px solid var(--color-border) !important;
}

.preview-total {
    font-size: 18px !important;
    font-weight: 700 !important;
    color: var(--color-primary) !important;
}

/* ═══════════════ Success State ═══════════════ */
.success-state {
    text-align: center;
    padding: 40px 24px;
    animation: fadeIn 0.3s ease;
}

.success-icon-wrap {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: rgba(34, 197, 94, 0.15);
    color: var(--color-success);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
}

.success-state h2 {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0 0 8px;
}

.success-subtitle {
    color: var(--color-text-muted);
    margin: 0 0 24px;
    font-size: 14px;
}

.summary-card {
    max-width: 420px;
    margin: 0 auto 24px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: 20px;
    text-align: left;
}

.summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    font-size: 14px;
}

.summary-row + .summary-row {
    border-top: 1px solid var(--color-border);
}

.summary-label {
    color: var(--color-text-muted);
    font-weight: 500;
}

.summary-value {
    color: var(--color-text-primary);
    font-weight: 600;
}

.summary-value--highlight {
    color: var(--color-primary);
    font-weight: 700;
}

.summary-row--total {
    margin-top: 4px;
    padding-top: 12px;
    border-top: 2px solid var(--color-border) !important;
}

.summary-value--total {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-primary);
}

.success-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
}

/* ═══════════════ Buttons ═══════════════ */
.btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: var(--radius-md);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.btn-primary:hover:not(:disabled) {
    opacity: 0.9;
    box-shadow: var(--shadow-md);
}

.btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-primary--lg {
    padding: 14px 32px;
    font-size: 16px;
    border-radius: var(--radius-lg);
}

.btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
    padding: 12px 24px;
    border-radius: var(--radius-md);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.btn-secondary:hover {
    background: var(--color-bg-secondary);
    border-color: var(--color-text-muted);
}

.btn-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

.form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 8px;
}

/* ═══════════════ Sales Tab ═══════════════ */
.sales-header {
    margin-bottom: 16px;
}

.sales-summary {
    color: var(--color-text-muted);
    font-size: 14px;
    margin: 0;
}

.filters {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
}

.filters .app-select-wrapper {
    min-width: 200px;
}

/* ═══════════════ Data Table ═══════════════ */
.data-table-wrapper {
    background: var(--color-bg-secondary);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-md);
    border: 1px solid var(--color-border);
}

.data-table {
    width: 100%;
    border-collapse: collapse;
}

.data-table thead tr {
    background: var(--color-bg-tertiary);
}

.data-table th {
    padding: 14px 20px;
    text-align: left;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    border-bottom: 1px solid var(--color-border);
    white-space: nowrap;
}

.data-table th.th-action {
    width: 48px;
}

.data-table td {
    padding: 16px 20px;
    font-size: 14px;
    color: var(--color-text-secondary);
    border-bottom: 1px solid var(--color-border);
    transition: background var(--transition-fast);
}

.data-table tbody tr {
    transition: background var(--transition-fast);
}

.data-table tbody tr:last-child td {
    border-bottom: none;
}

.data-table tbody tr:hover {
    background: var(--color-primary-light);
}

.data-table .td-action {
    text-align: center;
}

.cell-primary {
    font-weight: 600;
    color: var(--color-text-primary);
}

.cell-highlight {
    font-weight: 700;
    color: var(--color-primary);
}

/* ═══════════════ Status Badges ═══════════════ */
.status-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: var(--radius-full);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.4;
}

.status-pending {
    background: rgba(245, 158, 11, 0.15);
    color: var(--color-warning);
}

.status-partial {
    background: rgba(59, 130, 246, 0.15);
    color: var(--color-info);
}

.status-sold {
    background: rgba(34, 197, 94, 0.15);
    color: var(--color-success);
}

/* ═══════════════ Delete Button ═══════════════ */
.analysis-header {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-start;
    margin-bottom: 24px;
}

.analysis-header h2,
.analysis-section-header h3 {
    margin: 0;
    color: var(--color-text-primary);
}

.analysis-header p,
.analysis-section-header p,
.analysis-note {
    margin: 6px 0 0;
    color: var(--color-text-secondary);
    font-size: 14px;
}

.analysis-filters {
    margin: 0;
    flex-wrap: nowrap;
}

.analysis-notifications {
    display: grid;
    gap: 12px;
    margin-bottom: 24px;
}

.analysis-notification {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 16px;
    border: 1px solid rgba(16, 185, 129, 0.22);
    border-radius: var(--radius-lg);
    background: rgba(16, 185, 129, 0.08);
    color: var(--color-text-primary);
}

.analysis-notification--down {
    border-color: rgba(239, 68, 68, 0.22);
    background: rgba(239, 68, 68, 0.08);
}

.analysis-section {
    margin-top: 24px;
}

.analysis-section-header {
    margin-bottom: 14px;
}

.analysis-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
}

.analysis-card,
.year-table {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-sm);
}

.analysis-card {
    padding: 18px;
}

.analysis-card-top,
.analysis-metric {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
}

.analysis-card-top strong,
.analysis-metric strong {
    display: block;
    color: var(--color-text-primary);
}

.analysis-field,
.analysis-metric span {
    display: block;
    color: var(--color-text-secondary);
    font-size: 13px;
    margin-bottom: 4px;
}

.analysis-trend {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 86px;
    padding: 5px 10px;
    border-radius: var(--radius-full);
    background: rgba(16, 185, 129, 0.12);
    color: var(--color-success);
    font-size: 13px;
    font-weight: 700;
}

.analysis-trend--down {
    background: rgba(239, 68, 68, 0.12);
    color: var(--color-danger);
}

.analysis-metric {
    margin-top: 18px;
}

.year-table {
    overflow: hidden;
}

.year-row {
    display: grid;
    grid-template-columns: 1.4fr repeat(3, minmax(100px, 1fr));
    gap: 12px;
    align-items: center;
    padding: 14px 18px;
    border-bottom: 1px solid var(--color-border);
}

.year-row:last-child {
    border-bottom: none;
}

.year-row--head {
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
}

.btn-icon-delete {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    padding: 6px 10px;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all var(--transition-fast);
}

.btn-icon-delete:hover:not(:disabled) {
    color: var(--color-danger);
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.2);
}

.btn-icon-delete:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

/* ═══════════════ Card List (Mobile) ═══════════════ */
.card-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.data-card {
    background: var(--color-bg-secondary);
    border-radius: var(--radius-xl);
    border: 1px solid var(--color-border);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 16px 12px;
    border-bottom: 1px solid var(--color-border);
}

.card-title {
    font-weight: 700;
    font-size: 16px;
    color: var(--color-text-primary);
}

.card-body {
    padding: 12px 16px;
}

.card-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
}

.card-row + .card-row {
    border-top: 1px solid var(--color-border);
}

.card-label {
    font-size: 13px;
    color: var(--color-text-muted);
    font-weight: 500;
}

.card-value {
    font-size: 14px;
    color: var(--color-text-primary);
    font-weight: 500;
}

.card-value--highlight {
    color: var(--color-primary);
    font-weight: 700;
}

.card-footer {
    display: flex;
    justify-content: flex-end;
    padding: 10px 16px;
    border-top: 1px solid var(--color-border);
    background: var(--color-bg-tertiary);
}

/* ═══════════════ Visibility ═══════════════ */
.mobile-only {
    display: none;
}

.desktop-only {
    display: block;
}

/* ═══════════════ Loading & Empty ═══════════════ */
.loading {
    text-align: center;
    padding: 60px;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.empty-state {
    text-align: center;
    padding: 48px 24px;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-xl);
}

.empty-state h3 {
    color: var(--color-text-primary);
    margin: 16px 0 8px;
    font-size: 16px;
}

.empty-state p {
    color: var(--color-text-muted);
    font-size: 14px;
    margin: 0;
}

.empty-icon {
    font-size: 64px;
    margin-bottom: 16px;
}

/* ═══════════════ Modal ═══════════════ */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: var(--color-bg-secondary);
    padding: 32px;
    border-radius: 16px;
    max-width: 460px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
}

.modal-content h2 {
    margin: 0 0 8px 0;
    font-size: 22px;
    font-weight: 700;
    color: var(--color-text-primary);
}

.modal-subtitle {
    color: var(--color-text-muted);
    font-size: 14px;
    margin: 0 0 24px 0;
}

.create-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

/* ═══════════════ Responsive ═══════════════ */
@media (max-width: 768px) {
    .harvests-page {
        padding: 16px;
    }

    .header-content h1 {
        font-size: 24px;
    }

    .main-tabs {
        flex-direction: column;
    }

    .main-tab-btn {
        justify-content: flex-start;
        padding: 0 var(--space-4);
    }

    .step-indicator {
        padding: 16px 0;
    }

    .step-line {
        width: 32px;
    }

    .step-label {
        font-size: 11px;
    }

    .step-circle {
        width: 36px;
        height: 36px;
        font-size: 13px;
    }

    .wizard-step-header h2 {
        font-size: 18px;
    }

    .tariff-selection-grid {
        grid-template-columns: 1fr;
    }

    .sale-form {
        max-width: 100%;
    }

    .firm-chips {
        gap: 10px;
    }

    .firm-chip {
        height: var(--control-height);
        padding: 0 var(--space-4) 0 var(--space-2);
        max-width: 100%;
    }

    .firm-chip-avatar {
        width: 28px;
        height: 28px;
        font-size: 12px;
    }

    .filters {
        flex-direction: column;
    }

    .form-actions {
        flex-direction: column-reverse;
    }

    .form-actions .btn-primary,
    .form-actions .btn-secondary {
        width: 100%;
        justify-content: center;
    }

    .success-actions {
        flex-direction: column;
    }

    .success-actions .btn-primary,
    .success-actions .btn-secondary {
        width: 100%;
        justify-content: center;
    }

    .desktop-only {
        display: none !important;
    }

    .mobile-only {
        display: flex !important;
    }
}

/* ── Çaykur delivery boxes (Hasat Verilerim) ── */
.delivery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
}

.currency-tab-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 800;
    line-height: 1;
}

.tab-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: var(--radius-full);
    background: var(--color-primary);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
}

/* ── Payments tab status pill ── */
.status-pill {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: var(--radius-full);
    font-size: 12px;
    font-weight: 700;
}
.status-pill--received { background: rgba(34, 197, 94, 0.15); color: var(--color-success); }
.status-pill--pending { background: rgba(245, 158, 11, 0.15); color: var(--color-warning); }

/* ── Arazi ekle modal ── */
.picker-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
}
.picker-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: 24px;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
}
.picker-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0 0 4px;
}
.picker-desc {
    font-size: 13px;
    color: var(--color-text-muted);
    margin: 0 0 16px;
}
.picker-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 20px;
}
</style>
