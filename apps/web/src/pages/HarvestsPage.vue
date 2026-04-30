<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useHarvestsStore } from '@/stores/harvestsStore';
import { useFieldsStore } from '@/stores/fieldsStore';
import { useFirmsStore } from '@/stores/firmsStore';
import { usePaymentsStore } from '@/stores/paymentsStore';
import { useToast } from '@/composables/useToast';
import { api, type Harvest } from '@/services/api';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import AppCheckbox from '@/components/ui/AppCheckbox.vue';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';

const harvestsStore = useHarvestsStore();
const fieldsStore = useFieldsStore();
const firmsStore = useFirmsStore();
const paymentsStore = usePaymentsStore();
const toast = useToast();

// ─── Main Tab State ───
const activeMainTab = ref<'sell' | 'sales' | 'analysis'>('sell');

// ─── Yaş Çay Sat Form State ───
const selectedFirmId = ref('');
const saleKg = ref<number | null>(null);
const saleFieldId = ref('');
const useCustomDate = ref(false);
const saleDate = ref(new Date().toISOString().split('T')[0]);
const isSaving = ref(false);
const saleSuccess = ref(false);
const saleSummary = ref<{ firmName: string; tariffLabel: string; kg: number; fieldName: string; totalPrice: number | null; date: string } | null>(null);

// ─── Inline Tariff Panel State ───
const showTariffPanel = ref(false);
type PaymentTermType = 'cash' | 'weekly' | 'monthly';
const paymentTermLabels: Record<PaymentTermType, string> = {
    cash: 'Peşin',
    weekly: 'Haftalık',
    monthly: 'Ay Sonu',
};
const tariffEntry = ref({
    paymentTerm: 'cash' as PaymentTermType,
    pricePerKg: null as number | null,
    isSplitPayment: false,
    splits: [] as Array<{
        percentage: number | null;
        paymentTerm: PaymentTermType;
        deferredMonths: number | null;
        pricePerKg: number | null;
    }>,
});

function toggleTariffPanel() {
    showTariffPanel.value = !showTariffPanel.value;
    if (!showTariffPanel.value) {
        tariffEntry.value = { paymentTerm: 'cash', pricePerKg: null, isSplitPayment: false, splits: [] };
    }
}

function toggleSplitPayment() {
    tariffEntry.value.isSplitPayment = !tariffEntry.value.isSplitPayment;
    if (tariffEntry.value.isSplitPayment && tariffEntry.value.splits.length === 0) {
        tariffEntry.value.splits = [
            { percentage: 50, paymentTerm: 'cash', deferredMonths: null, pricePerKg: null },
            { percentage: 50, paymentTerm: 'monthly', deferredMonths: 2, pricePerKg: null },
        ];
    }
}

function addSplit() {
    tariffEntry.value.splits.push({ percentage: null, paymentTerm: 'monthly', deferredMonths: 1, pricePerKg: null });
}

function removeSplit(index: number) {
    tariffEntry.value.splits.splice(index, 1);
}

// ─── Satış Verilerim Tab State ───
const fieldFilter = ref('');
const yearFilter = ref(new Date().getFullYear());
const showDeleteConfirm = ref(false);
const deleteTargetId = ref('');
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
    { value: '', label: 'Tüm Tarlalar' },
    ...fieldsStore.fields.map(f => ({ value: f.id, label: f.name }))
]);

const fieldSelectOptions = computed(() => [
    { value: '', label: 'Arazi seçiniz...' },
    ...fieldsStore.fields.map(f => ({
        value: f.id,
        label: `${f.name} (${f.area} ${f.areaUnit})`
    }))
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

// ─── Form Computed ───
const selectedFirm = computed(() =>
    firmsStore.firms.find(f => f.id === selectedFirmId.value)
);

const selectedField = computed(() =>
    fieldsStore.fields.find(f => f.id === saleFieldId.value)
);

const canSubmitSale = computed(() =>
    selectedFirmId.value && saleKg.value && saleKg.value > 0 && saleFieldId.value
);

// ─── Lifecycle ───
onMounted(() => {
    firmsStore.fetchFirms({ isActive: true });
    fieldsStore.fetchFields();
    harvestsStore.fetchHarvests({ year: yearFilter.value });
    paymentsStore.fetchBrokerFirms();
    loadAnalysisData();
});

// ─── Form Actions ───
async function completeSale() {
    if (!selectedFirm.value || !saleKg.value || !saleFieldId.value) return;

    isSaving.value = true;
    try {
        const harvestDate = useCustomDate.value ? saleDate.value : new Date().toISOString().split('T')[0];

        // 1. Create harvest record
        const harvest = await harvestsStore.createHarvest({
            fieldId: saleFieldId.value,
            harvestDate,
            amountKg: saleKg.value,
        });

        if (!harvest) {
            toast.error('Hasat kaydı oluşturulurken hata oluştu');
            return;
        }

        // 2. Find or create broker firm
        let brokerFirm = paymentsStore.brokerFirms.find(
            bf => bf.firmName === selectedFirm.value!.name
        );
        if (!brokerFirm) {
            brokerFirm = await paymentsStore.createBrokerFirm(selectedFirm.value.name) ?? undefined;
        }

        // 3. Build payment data — tariff is optional
        let totalPrice: number | null = null;
        let tariffLabel = 'Tarife belirtilmedi';

        if (showTariffPanel.value && !tariffEntry.value.isSplitPayment && tariffEntry.value.pricePerKg) {
            totalPrice = tariffEntry.value.pricePerKg * saleKg.value;
            tariffLabel = `${paymentTermLabels[tariffEntry.value.paymentTerm]} - ${formatPrice(tariffEntry.value.pricePerKg)}/kg`;
        } else if (showTariffPanel.value && tariffEntry.value.isSplitPayment && tariffEntry.value.splits.length > 0) {
            const firstPrice = tariffEntry.value.splits[0]?.pricePerKg;
            if (firstPrice) {
                totalPrice = firstPrice * saleKg.value;
            }
            tariffLabel = 'Bölünmüş Ödeme';
        }

        const payment = await paymentsStore.createPayment({
            harvestAllocations: [{ harvestId: harvest.id, usedAmountKg: saleKg.value }],
            totalPrice: totalPrice ?? 0,
            brokerFirmId: brokerFirm?.id,
            paymentDate: harvestDate,
            paymentStatus: 'pending',
        });

        if (payment) {
            saleSummary.value = {
                firmName: selectedFirm.value.name,
                tariffLabel,
                kg: saleKg.value,
                fieldName: selectedField.value?.name || '',
                totalPrice,
                date: harvestDate,
            };
            saleSuccess.value = true;
            toast.success('Yaş çay satışı başarıyla kaydedildi!');
        } else {
            toast.error('Satış kaydı oluşturulurken hata oluştu');
        }
    } catch {
        toast.error('Bir hata oluştu, lütfen tekrar deneyin');
    } finally {
        isSaving.value = false;
    }
}

function resetForm() {
    selectedFirmId.value = '';
    saleKg.value = null;
    saleFieldId.value = '';
    useCustomDate.value = false;
    saleDate.value = new Date().toISOString().split('T')[0];
    showTariffPanel.value = false;
    tariffEntry.value = { paymentTerm: 'cash', pricePerKg: null, isSplitPayment: false, splits: [] };
    saleSuccess.value = false;
    saleSummary.value = null;
}

// ─── Sales Tab Actions ───
function applyFilters() {
    const params: Record<string, unknown> = {};
    if (fieldFilter.value) params.fieldId = fieldFilter.value;
    if (yearFilter.value) params.year = yearFilter.value;
    harvestsStore.fetchHarvests(params as { fieldId?: string; year?: number });
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
    if (value === null) return 'Karsilastirma yok';
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

function deleteHarvest(id: string) {
    deleteTargetId.value = id;
    showDeleteConfirm.value = true;
}

async function confirmDeleteHarvest() {
    const success = await harvestsStore.deleteHarvest(deleteTargetId.value);
    if (success) {
        toast.success('Hasat başarıyla silindi');
    } else {
        toast.error('Hasat silinirken bir hata oluştu');
    }
}
</script>

<template>
    <TeaBusinessLayout>
        <div class="harvests-page">
            <!-- Page Header -->
            <header class="page-header">
                <div class="header-content">
                    <h1>Hasatlarım</h1>
                    <p class="subtitle">Yaş çay satışlarınızı yönetin ve takip edin</p>
                </div>
            </header>

            <!-- Main Tabs -->
            <div class="main-tabs">
                <button
                    class="main-tab-btn"
                    :class="{ 'main-tab-btn--active': activeMainTab === 'sell' }"
                    @click="activeMainTab = 'sell'"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                    Yaş Çay Sat
                </button>
                <button
                    class="main-tab-btn"
                    :class="{ 'main-tab-btn--active': activeMainTab === 'sales' }"
                    @click="activeMainTab = 'sales'"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    Satış Verilerim
                </button>
                <button
                    class="main-tab-btn"
                    :class="{ 'main-tab-btn--active': activeMainTab === 'analysis' }"
                    @click="activeMainTab = 'analysis'"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                    Arazi Verim Analizi
                </button>
            </div>

            <!-- ═══════════════ TAB 1: Yaş Çay Sat ═══════════════ -->
            <div v-if="activeMainTab === 'sell'" class="tab-content">

                <!-- Success State -->
                <div v-if="saleSuccess && saleSummary" class="success-state">
                    <div class="success-icon-wrap">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </div>
                    <h2>Satış Kaydedildi!</h2>
                    <p class="success-subtitle">Yaş çay satışınız başarıyla sisteme kaydedildi.</p>

                    <div class="summary-card">
                        <div class="summary-row">
                            <span class="summary-label">Firma</span>
                            <span class="summary-value">{{ saleSummary.firmName }}</span>
                        </div>
                        <div class="summary-row">
                            <span class="summary-label">Tarife</span>
                            <span class="summary-value">{{ saleSummary.tariffLabel }}</span>
                        </div>
                        <div class="summary-row">
                            <span class="summary-label">Miktar</span>
                            <span class="summary-value summary-value--highlight">{{ formatKg(saleSummary.kg) }}</span>
                        </div>
                        <div class="summary-row">
                            <span class="summary-label">Arazi</span>
                            <span class="summary-value">{{ saleSummary.fieldName }}</span>
                        </div>
                        <div class="summary-row">
                            <span class="summary-label">Tarih</span>
                            <span class="summary-value">{{ formatDate(saleSummary.date) }}</span>
                        </div>
                        <div v-if="saleSummary.totalPrice" class="summary-row summary-row--total">
                            <span class="summary-label">Tahmini Tutar</span>
                            <span class="summary-value summary-value--total">{{ formatPrice(saleSummary.totalPrice) }}</span>
                        </div>
                    </div>

                    <div class="success-actions">
                        <button class="btn-primary" @click="resetForm">
                            Yeni Satış Kaydet
                        </button>
                        <button class="btn-secondary" @click="activeMainTab = 'sales'">
                            Satış Verilerime Git
                        </button>
                    </div>
                </div>

                <!-- Single-Form Sale View -->
                <template v-else>
                    <div class="sale-form-card">
                        <div class="sale-form-header">
                            <h2>Yaş çayınızı hangi firmaya sattınız?</h2>
                            <p>Firma, miktar ve arazi bilgilerini girin. Tarife belirtmek isteğe bağlıdır.</p>
                        </div>

                        <div class="sale-form">
                            <!-- Firma Selection -->
                            <div class="form-group">
                                <label class="form-label">Firma <span class="required">*</span></label>
                                <div v-if="firmsStore.isLoading" class="loading-inline">
                                    <div class="spinner-sm"></div>
                                </div>
                                <div v-else class="firm-chips">
                                    <button
                                        v-for="firm in firmsStore.firms"
                                        :key="firm.id"
                                        type="button"
                                        class="firm-chip"
                                        :class="{ 'firm-chip--active': selectedFirmId === firm.id }"
                                        @click="selectedFirmId = firm.id"
                                    >
                                        <span class="firm-chip-avatar">{{ firm.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) }}</span>
                                        {{ firm.name }}
                                    </button>
                                </div>
                            </div>

                            <!-- Miktar -->
                            <div class="form-group">
                                <label class="form-label">Miktar (kg) <span class="required">*</span></label>
                                <div class="kg-input-wrap">
                                    <input
                                        type="number"
                                        v-model.number="saleKg"
                                        min="0.1"
                                        step="0.1"
                                        placeholder="Örn: 150"
                                        class="form-input form-input--lg"
                                    />
                                    <span class="kg-suffix">kg</span>
                                </div>
                            </div>

                            <!-- Arazi -->
                            <div class="form-group">
                                <label class="form-label">Arazi <span class="required">*</span></label>
                                <AppSelect
                                    v-model="saleFieldId"
                                    :options="fieldSelectOptions"
                                    placeholder="Arazi seçiniz..."
                                    variant="light"
                                />
                            </div>

                            <!-- Tarih -->
                            <div class="form-group">
                                <AppCheckbox
                                    v-model="useCustomDate"
                                    label="Farklı bir tarih belirtmek istiyorum"
                                />
                                <p v-if="!useCustomDate" class="date-auto-info">
                                    Bugünün tarihi kullanılacak:
                                    <strong>{{ formatDate(new Date().toISOString().split('T')[0]) }}</strong>
                                </p>
                                <div v-if="useCustomDate" class="date-input-wrap">
                                    <label class="form-label">Satış tarihi</label>
                                    <input
                                        type="date"
                                        v-model="saleDate"
                                        :max="new Date().toISOString().split('T')[0]"
                                        class="form-input"
                                    />
                                </div>
                            </div>

                            <!-- Tarife Ekle Button -->
                            <div class="tariff-panel-toggle">
                                <button
                                    type="button"
                                    class="btn-tariff-toggle"
                                    :class="{ 'btn-tariff-toggle--open': showTariffPanel }"
                                    @click="toggleTariffPanel"
                                >
                                    <span v-if="!showTariffPanel">+</span>
                                    {{ showTariffPanel ? 'Tarife Bilgisini Kaldır' : 'Tarife Ekle' }}
                                    <span class="tariff-toggle-hint">{{ showTariffPanel ? '' : '(İsteğe bağlı)' }}</span>
                                </button>
                            </div>

                            <!-- Inline Tariff Panel -->
                            <Transition name="tariff-panel">
                                <div v-if="showTariffPanel" class="tariff-panel">
                                    <div class="tariff-panel-header">
                                        <h4>Ödeme Bilgileri</h4>
                                        <p>Bu satış için ödeme zamanı ve fiyat bilgisini girin.</p>
                                    </div>

                                    <!-- Split toggle -->
                                    <div class="split-toggle-row">
                                        <label class="split-toggle-label">
                                            <input type="checkbox" :checked="tariffEntry.isSplitPayment" @change="toggleSplitPayment" />
                                            <span>Bölünmüş ödeme (%50 peşin, %50 vadeli gibi)</span>
                                        </label>
                                    </div>

                                    <!-- Simple tariff -->
                                    <template v-if="!tariffEntry.isSplitPayment">
                                        <div class="form-group">
                                            <label class="form-label">Ödeme Zamanı <span class="required">*</span></label>
                                            <div class="payment-term-options">
                                                <button
                                                    v-for="term in (['cash', 'weekly', 'monthly'] as PaymentTermType[])"
                                                    :key="term"
                                                    type="button"
                                                    class="term-btn"
                                                    :class="{ 'term-btn--active': tariffEntry.paymentTerm === term }"
                                                    @click="tariffEntry.paymentTerm = term"
                                                >
                                                    {{ paymentTermLabels[term] }}
                                                </button>
                                            </div>
                                        </div>

                                        <div class="form-group">
                                            <label class="form-label">Fiyat (TL/kg) <span class="required">*</span></label>
                                            <input
                                                type="number"
                                                v-model.number="tariffEntry.pricePerKg"
                                                min="0.01"
                                                step="0.01"
                                                placeholder="Örn: 22"
                                                class="form-input"
                                            />
                                            <p v-if="tariffEntry.pricePerKg && saleKg" class="estimated-total">
                                                Tahmini tutar: <strong>{{ formatPrice(tariffEntry.pricePerKg * saleKg) }}</strong>
                                            </p>
                                        </div>
                                    </template>

                                    <!-- Split payment -->
                                    <template v-else>
                                        <div v-for="(split, sIndex) in tariffEntry.splits" :key="sIndex" class="split-entry">
                                            <div class="split-entry-header">
                                                <span class="split-badge">Kısım {{ sIndex + 1 }}</span>
                                                <button v-if="tariffEntry.splits.length > 2" type="button" class="btn-icon-sm" @click="removeSplit(sIndex)">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                                </button>
                                            </div>
                                            <div class="form-row form-row--3">
                                                <div class="form-group">
                                                    <label class="form-label">Yüzde (%)</label>
                                                    <input type="number" v-model.number="split.percentage" min="1" max="100" placeholder="50" class="form-input" />
                                                </div>
                                                <div class="form-group">
                                                    <label class="form-label">Ödeme Zamanı</label>
                                                    <select v-model="split.paymentTerm" class="form-input">
                                                        <option value="cash">Peşin</option>
                                                        <option value="weekly">Haftalık</option>
                                                        <option value="monthly">Ay Sonu</option>
                                                    </select>
                                                </div>
                                                <div class="form-group">
                                                    <label class="form-label">Fiyat (TL/kg)</label>
                                                    <input type="number" v-model.number="split.pricePerKg" min="0.01" step="0.01" placeholder="20" class="form-input" />
                                                </div>
                                            </div>
                                            <div v-if="split.paymentTerm !== 'cash'" class="form-group">
                                                <label class="form-label">Kaç Hafta/Ay Sonra?</label>
                                                <input type="number" v-model.number="split.deferredMonths" min="1" max="24" placeholder="2" class="form-input" />
                                            </div>
                                        </div>
                                        <button type="button" class="btn-add-split" @click="addSplit">+ Kısım Ekle</button>
                                    </template>
                                </div>
                            </Transition>

                            <!-- Submit -->
                            <div class="form-actions">
                                <button
                                    class="btn-primary btn-primary--lg"
                                    :disabled="!canSubmitSale || isSaving"
                                    @click="completeSale"
                                >
                                    <span v-if="isSaving" class="btn-spinner"></span>
                                    {{ isSaving ? 'Kaydediliyor...' : 'Satışı Kaydet' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </template>
            </div>

            <!-- ═══════════════ TAB 2: Satış Verilerim ═══════════════ -->
            <div v-if="activeMainTab === 'sales'" class="tab-content">
                <div class="sales-header">
                    <p class="sales-summary">
                        {{ harvestsStore.harvestCount }} hasat, toplam {{ formatKg(harvestsStore.totalHarvestKg) }}
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
                        v-model="fieldFilter"
                        :options="fieldFilterOptions"
                        placeholder="Tarla"
                        @update:model-value="applyFilters"
                    />
                </div>

                <div v-if="harvestsStore.isLoading" class="loading">
                    <div class="spinner"></div>
                </div>

                <div v-else-if="harvestsStore.harvests.length === 0" class="empty-state">
                    <div class="empty-icon">🍃</div>
                    <h3>Henüz satış kaydı yok</h3>
                    <p>Yaş Çay Sat sekmesinden ilk satışınızı kaydedin</p>
                    <button class="btn-primary" style="margin-top: 16px;" @click="activeMainTab = 'sell'">
                        Yaş Çay Sat
                    </button>
                </div>

                <!-- Desktop Table -->
                <template v-else>
                    <div class="data-table-wrapper desktop-only">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Tarla</th>
                                    <th>Tarih</th>
                                    <th>Miktar</th>
                                    <th>Satılan</th>
                                    <th class="th-action"></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="harvest in harvestsStore.harvests" :key="harvest.id">
                                    <td>
                                        <span class="cell-primary">{{ harvest.fieldName }}</span>
                                    </td>
                                    <td>{{ formatDate(harvest.harvestDate) }}</td>
                                    <td><span class="cell-highlight">{{ formatKg(harvest.amountKg) }}</span></td>
                                    <td>{{ harvest.soldAmountKg ? formatKg(harvest.soldAmountKg) : '-' }}</td>
                                    <td class="td-action">
                                        <button
                                            class="btn-icon-delete"
                                            @click="deleteHarvest(harvest.id)"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Mobile Card List -->
                    <div class="card-list mobile-only">
                        <div v-for="harvest in harvestsStore.harvests" :key="'card-' + harvest.id" class="data-card">
                            <div class="card-header">
                                <span class="card-title">{{ harvest.fieldName }}</span>
                                <span class="card-value">{{ formatDate(harvest.harvestDate) }}</span>
                            </div>
                            <div class="card-body">
                                <div class="card-row">
                                    <span class="card-label">Miktar</span>
                                    <span class="card-value card-value--highlight">{{ formatKg(harvest.amountKg) }}</span>
                                </div>
                                <div class="card-row">
                                    <span class="card-label">Satılan</span>
                                    <span class="card-value">{{ harvest.soldAmountKg ? formatKg(harvest.soldAmountKg) : '-' }}</span>
                                </div>
                            </div>
                            <div class="card-footer">
                                <button
                                    class="btn-icon-delete"
                                    @click="deleteHarvest(harvest.id)"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                    <span>Sil</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </template>
            </div>

            <!-- ═══════════════ TAB 3: Arazi Verim Analizi ═══════════════ -->
            <div v-if="activeMainTab === 'analysis'" class="tab-content">
                <div class="analysis-header">
                    <div>
                        <h2>Arazi Verim Analizi</h2>
                        <p>Arazilerinizin aylik ve yillik yas cay verimini karsilastirin.</p>
                    </div>
                    <div class="filters analysis-filters">
                        <AppSelect
                            v-model="yearFilter"
                            :options="yearOptions"
                            placeholder="Yil"
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

                <div v-else-if="analysisMonthRows.length === 0 && analysisYearRows.length === 0" class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-text-muted)"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                    <h3>Analiz icin hasat verisi yok</h3>
                    <p>Yas Cay Sat sekmesinden hasat eklediginizde verim degisimleri burada gorunur.</p>
                </div>

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
                            <h3>Aylik Karsilastirma</h3>
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
                            <h3>Yillik Karsilastirma</h3>
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

            <!-- Delete Harvest Confirm Modal -->
            <ConfirmModal
                v-model="showDeleteConfirm"
                title="Hasatı Sil"
                message="Bu hasatı silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
                confirm-text="Sil"
                cancel-text="Vazgeç"
                variant="danger"
                @confirm="confirmDeleteHarvest"
            />
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
    gap: 4px;
    margin-bottom: 24px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 4px;
}

.main-tab-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-secondary);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all var(--transition-fast);
    flex: 1;
    justify-content: center;
    white-space: nowrap;
}

.main-tab-btn:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-tertiary);
}

.main-tab-btn--active {
    background: var(--color-primary);
    color: white;
}

.main-tab-btn--active:hover {
    background: var(--color-primary-hover);
    color: white;
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
    gap: 8px;
}

.firm-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px 8px 8px;
    background: var(--color-bg-tertiary);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-full);
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    font-family: inherit;
    white-space: nowrap;
}

.firm-chip:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
    color: var(--color-primary);
}

.firm-chip--active {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
    color: var(--color-primary);
    font-weight: 600;
}

.firm-chip--active .firm-chip-avatar {
    background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
    color: white;
}

.firm-chip-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
}

.firm-chip--add {
    border-style: dashed;
    background: transparent;
    color: var(--color-text-muted);
    padding: 8px 14px;
}

.firm-chip--add:hover {
    border-style: solid;
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: var(--color-primary-light);
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
    padding: 10px 16px;
    background: transparent;
    border: 1.5px dashed var(--color-border);
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
    background: var(--color-bg-tertiary);
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
    color: var(--color-text-secondary);
    font-size: 14px;
    cursor: pointer;
}

.split-toggle-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
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
    padding: 12px 16px;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 14px;
    background: var(--color-bg-elevated, var(--color-bg-secondary));
    color: var(--color-text-primary);
    transition: border-color var(--transition-fast);
    font-family: inherit;
}

.form-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-input--lg {
    font-size: 20px;
    font-weight: 700;
    padding: 16px 20px;
}

.kg-input-wrap {
    position: relative;
}

.kg-input-wrap input {
    width: 100%;
    padding-right: 48px;
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
        padding: 12px 16px;
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
</style>
