<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useHarvestsStore } from '@/stores/harvestsStore';
import { useFieldsStore } from '@/stores/fieldsStore';
import { useFirmsStore } from '@/stores/firmsStore';
import { usePaymentsStore } from '@/stores/paymentsStore';
import { useToast } from '@/composables/useToast';
import AppLayout from '@/layouts/AppLayout.vue';
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

// ─── Yaş Çay Sat Wizard State ───
const wizardStep = ref(1);
const selectedFirmId = ref('');
const selectedTariffId = ref('');
const saleKg = ref<number | null>(null);
const saleFieldId = ref('');
const useCustomDate = ref(false);
const saleDate = ref(new Date().toISOString().split('T')[0]);
const isSaving = ref(false);
const showAddFirmModal = ref(false);
const newFirmName = ref('');
const saleSuccess = ref(false);
const saleSummary = ref<{ firmName: string; tariffLabel: string; kg: number; fieldName: string; totalPrice: number; date: string } | null>(null);

// ─── Satış Verilerim Tab State ───
const fieldFilter = ref('');
const yearFilter = ref(new Date().getFullYear());
const statusFilter = ref('');
const showDeleteConfirm = ref(false);
const deleteTargetId = ref('');

const years = computed(() => {
    const current = new Date().getFullYear();
    return [current, current - 1, current - 2, current - 3, current - 4];
});

const statusLabels: Record<string, string> = {
    'pending': 'Bekliyor',
    'partial': 'Kısmi Satış',
    'sold': 'Satıldı'
};

const qualityLabels: Record<string, string> = {
    'shoot': 'Sürgün',
    'leaf': 'Yaprak',
    'mixed': 'Karışık'
};



// ─── Computed Options ───
const yearOptions = computed(() =>
    years.value.map(y => ({ value: y, label: String(y) }))
);

const fieldFilterOptions = computed(() => [
    { value: '', label: 'Tüm Tarlalar' },
    ...fieldsStore.fields.map(f => ({ value: f.id, label: f.name }))
]);

const statusFilterOptions = [
    { value: '', label: 'Tüm Durumlar' },
    { value: 'pending', label: 'Bekliyor' },
    { value: 'partial', label: 'Kısmi Satış' },
    { value: 'sold', label: 'Satıldı' }
];

const fieldSelectOptions = computed(() => [
    { value: '', label: 'Arazi seçiniz...' },
    ...fieldsStore.fields.map(f => ({
        value: f.id,
        label: `${f.name} (${f.area} ${f.areaUnit})`
    }))
]);

// ─── Wizard Computed ───
const selectedFirm = computed(() =>
    firmsStore.firms.find(f => f.id === selectedFirmId.value)
);

const selectedTariff = computed(() =>
    firmsStore.currentTariffs.find(t => t.id === selectedTariffId.value)
);

const selectedField = computed(() =>
    fieldsStore.fields.find(f => f.id === saleFieldId.value)
);

const estimatedTotal = computed(() => {
    if (!selectedTariff.value || !saleKg.value) return 0;
    return selectedTariff.value.pricePerKg * saleKg.value;
});

const canProceedStep3 = computed(() =>
    saleKg.value && saleKg.value > 0 && saleFieldId.value
);

// ─── Lifecycle ───
onMounted(() => {
    firmsStore.fetchFirms({ isActive: true });
    fieldsStore.fetchFields();
    harvestsStore.fetchHarvests({ year: yearFilter.value });
    paymentsStore.fetchBrokerFirms();
});

// ─── Wizard Actions ───
function selectFirm(firmId: string) {
    selectedFirmId.value = firmId;
    selectedTariffId.value = '';
    firmsStore.fetchCurrentTariffs(firmId);
    wizardStep.value = 2;
}

function selectTariff(tariffId: string) {
    selectedTariffId.value = tariffId;
    wizardStep.value = 3;
}

function goToStep(step: number) {
    if (step < wizardStep.value) {
        wizardStep.value = step;
        if (step === 1) {
            selectedFirmId.value = '';
            selectedTariffId.value = '';
            saleKg.value = null;
            saleFieldId.value = '';
            useCustomDate.value = false;
            saleDate.value = new Date().toISOString().split('T')[0];
        }
        if (step <= 2) {
            selectedTariffId.value = '';
            saleKg.value = null;
            saleFieldId.value = '';
        }
    }
}

async function openAddFirmModal() {
    showAddFirmModal.value = true;
    newFirmName.value = '';
}

async function addNewFirm() {
    if (!newFirmName.value.trim()) return;
    const success = await firmsStore.createFirm({ name: newFirmName.value.trim(), isActive: true });
    if (success) {
        toast.success('Firma başarıyla eklendi');
        showAddFirmModal.value = false;
        newFirmName.value = '';
        await firmsStore.fetchFirms({ isActive: true });
    } else {
        toast.error('Firma eklenirken hata oluştu');
    }
}

async function completeSale() {
    if (!selectedFirm.value || !selectedTariff.value || !saleKg.value || !saleFieldId.value) return;

    isSaving.value = true;
    try {
        // 1. Create harvest record
        const harvestDate = useCustomDate.value ? saleDate.value : new Date().toISOString().split('T')[0];
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

        // 3. Create payment
        const totalPrice = selectedTariff.value.pricePerKg * saleKg.value;
        const payment = await paymentsStore.createPayment({
            harvestAllocations: [{ harvestId: harvest.id, usedAmountKg: saleKg.value }],
            totalPrice,
            brokerFirmId: brokerFirm?.id,
            paymentDate: harvestDate,
            paymentStatus: 'pending',
        });

        if (payment) {
            saleSummary.value = {
                firmName: selectedFirm.value.name,
                tariffLabel: `Standart Tarife - ${formatPrice(selectedTariff.value.pricePerKg)}/kg`,
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

function resetWizard() {
    wizardStep.value = 1;
    selectedFirmId.value = '';
    selectedTariffId.value = '';
    saleKg.value = null;
    saleFieldId.value = '';
    useCustomDate.value = false;
    saleDate.value = new Date().toISOString().split('T')[0];
    saleSuccess.value = false;
    saleSummary.value = null;
}

// ─── Sales Tab Actions ───
function applyFilters() {
    const params: Record<string, unknown> = {};
    if (fieldFilter.value) params.fieldId = fieldFilter.value;
    if (yearFilter.value) params.year = yearFilter.value;
    if (statusFilter.value) params.status = statusFilter.value;
    harvestsStore.fetchHarvests(params as { fieldId?: string; year?: number; status?: string });
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

function formatPrice(price: number) {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(price);
}

function getStatusClass(status?: string) {
    return {
        'status-pending': status === 'pending',
        'status-partial': status === 'partial',
        'status-sold': status === 'sold'
    };
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
    <AppLayout>
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
                        <div class="summary-row summary-row--total">
                            <span class="summary-label">Toplam Tutar</span>
                            <span class="summary-value summary-value--total">{{ formatPrice(saleSummary.totalPrice) }}</span>
                        </div>
                    </div>

                    <div class="success-actions">
                        <button class="btn-primary" @click="resetWizard">
                            Yeni Satış Kaydet
                        </button>
                        <button class="btn-secondary" @click="activeMainTab = 'sales'">
                            Satış Verilerime Git
                        </button>
                    </div>
                </div>

                <!-- Wizard Steps -->
                <template v-else>
                    <!-- Step Indicator -->
                    <div class="step-indicator">
                        <div class="step" :class="{ 'step--active': wizardStep >= 1, 'step--done': wizardStep > 1 }" @click="goToStep(1)">
                            <div class="step-circle">
                                <svg v-if="wizardStep > 1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                <span v-else>1</span>
                            </div>
                            <span class="step-label">Firma Seç</span>
                        </div>
                        <div class="step-line" :class="{ 'step-line--active': wizardStep > 1 }"></div>
                        <div class="step" :class="{ 'step--active': wizardStep >= 2, 'step--done': wizardStep > 2 }" @click="goToStep(2)">
                            <div class="step-circle">
                                <svg v-if="wizardStep > 2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                <span v-else>2</span>
                            </div>
                            <span class="step-label">Tarife Seç</span>
                        </div>
                        <div class="step-line" :class="{ 'step-line--active': wizardStep > 2 }"></div>
                        <div class="step" :class="{ 'step--active': wizardStep >= 3 }">
                            <div class="step-circle">3</div>
                            <span class="step-label">Satış Bilgileri</span>
                        </div>
                    </div>

                    <!-- STEP 1: Firma Seçimi -->
                    <div v-if="wizardStep === 1" class="wizard-step">
                        <div class="wizard-step-header">
                            <h2>Yaş çayınızı hangi firmaya sattınız?</h2>
                            <p>Firmalar modülünde kayıtlı firmalarınızdan birini seçin veya yeni firma ekleyin.</p>
                        </div>

                        <div v-if="firmsStore.isLoading" class="loading">
                            <div class="spinner"></div>
                        </div>

                        <div v-else class="firm-selection-grid">
                            <div
                                v-for="firm in firmsStore.firms"
                                :key="firm.id"
                                class="firm-selection-card"
                                @click="selectFirm(firm.id)"
                            >
                                <div class="firm-selection-avatar">
                                    {{ firm.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) }}
                                </div>
                                <div class="firm-selection-info">
                                    <h3>{{ firm.name }}</h3>
                                    <p v-if="firm.description">{{ firm.description }}</p>
                                    <p v-else class="text-muted">Firma bilgisi</p>
                                </div>
                                <div class="firm-selection-arrow">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                </div>
                            </div>

                            <!-- Add Firm Card -->
                            <div class="firm-selection-card firm-selection-card--add" @click="openAddFirmModal">
                                <div class="firm-add-icon">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                </div>
                                <div class="firm-selection-info">
                                    <h3>Firma Ekle</h3>
                                    <p>Yeni bir firma ekleyerek devam edin</p>
                                </div>
                                <div class="firm-selection-arrow">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                </div>
                            </div>
                        </div>

                        <div v-if="firmsStore.firms.length === 0 && !firmsStore.isLoading" class="empty-hint">
                            <p>Henüz kayıtlı firmanız yok. "Firma Ekle" ile başlayın.</p>
                        </div>
                    </div>

                    <!-- STEP 2: Tarife Seçimi -->
                    <div v-if="wizardStep === 2" class="wizard-step">
                        <div class="wizard-step-header">
                            <div class="step-header-with-back">
                                <button class="btn-back" @click="goToStep(1)">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                </button>
                                <div>
                                    <h2>Hangi tarife ile sattınız?</h2>
                                    <p><strong>{{ selectedFirm?.name }}</strong> firmasına ait güncel tarifeleri seçin.</p>
                                </div>
                            </div>
                        </div>

                        <div v-if="firmsStore.isLoading" class="loading">
                            <div class="spinner"></div>
                        </div>

                        <div v-else-if="firmsStore.currentTariffs.length === 0" class="empty-state">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-text-muted)"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                            <h3>Güncel tarife bulunamadı</h3>
                            <p>Bu firmanın aktif tarifeleri henüz belirlenmemiş. Firmalar modülünden tarife ekleyebilirsiniz.</p>
                            <button class="btn-secondary" @click="goToStep(1)" style="margin-top: 16px;">
                                Başka Firma Seç
                            </button>
                        </div>

                        <div v-else class="tariff-selection-grid">
                            <div
                                v-for="tariff in firmsStore.currentTariffs"
                                :key="tariff.id"
                                class="tariff-selection-card"
                                @click="selectTariff(tariff.id)"
                            >
                                <div class="tariff-sel-header">
                                    <span class="tariff-quality-icon">🍃</span>
                                    <span class="tariff-quality-name">Standart Tarife</span>
                                </div>
                                <div class="tariff-sel-price">
                                    {{ formatPrice(tariff.pricePerKg) }}
                                    <span class="tariff-sel-unit">/kg</span>
                                </div>
                                <div class="tariff-sel-date">
                                    {{ formatDate(tariff.effectiveDate) }} -
                                    <span v-if="tariff.endDate">{{ formatDate(tariff.endDate) }}</span>
                                    <span v-else class="tariff-sel-ongoing">Devam ediyor</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- STEP 3: Satış Bilgileri -->
                    <div v-if="wizardStep === 3" class="wizard-step">
                        <div class="wizard-step-header">
                            <div class="step-header-with-back">
                                <button class="btn-back" @click="goToStep(2)">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                </button>
                                <div>
                                    <h2>Satış bilgilerinizi girin</h2>
                                    <p>
                                        <strong>{{ selectedFirm?.name }}</strong> /
                                        Standart Tarife -
                                        {{ selectedTariff ? formatPrice(selectedTariff.pricePerKg) : '' }}/kg
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div class="sale-form">
                            <!-- KG Input -->
                            <div class="form-group">
                                <label class="form-label">
                                    Sattığınız yaş çay miktarı (kg) <span class="required">*</span>
                                </label>
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
                                <p v-if="saleKg && selectedTariff" class="estimated-total">
                                    Tahmini tutar: <strong>{{ formatPrice(estimatedTotal) }}</strong>
                                </p>
                            </div>

                            <!-- Field Selection -->
                            <div class="form-group">
                                <label class="form-label">
                                    Çayı topladığınız arazi <span class="required">*</span>
                                </label>
                                <AppSelect
                                    v-model="saleFieldId"
                                    :options="fieldSelectOptions"
                                    placeholder="Arazi seçiniz..."
                                    variant="light"
                                />
                            </div>

                            <!-- Date -->
                            <div class="form-group">
                                <AppCheckbox
                                    v-model="useCustomDate"
                                    label="Farklı bir tarih belirtmek istiyorum"
                                />
                                <p v-if="!useCustomDate" class="date-auto-info">
                                    Bugünün tarihi otomatik olarak kullanılacaktır:
                                    <strong>{{ formatDate(new Date().toISOString().split('T')[0]) }}</strong>
                                </p>
                                <div v-if="useCustomDate" class="date-input-wrap">
                                    <label class="form-label">Hasat tarihi</label>
                                    <input
                                        type="date"
                                        v-model="saleDate"
                                        :max="new Date().toISOString().split('T')[0]"
                                        class="form-input"
                                    />
                                </div>
                            </div>

                            <!-- Preview Card -->
                            <div v-if="canProceedStep3" class="preview-card">
                                <h4>Satış Özeti</h4>
                                <div class="preview-row">
                                    <span>Firma:</span>
                                    <span>{{ selectedFirm?.name }}</span>
                                </div>
                                <div class="preview-row">
                                    <span>Tarife:</span>
                                    <span>Standart Tarife - {{ selectedTariff ? formatPrice(selectedTariff.pricePerKg) : '' }}/kg</span>
                                </div>
                                <div class="preview-row">
                                    <span>Miktar:</span>
                                    <span>{{ saleKg ? formatKg(saleKg) : '-' }}</span>
                                </div>
                                <div class="preview-row">
                                    <span>Arazi:</span>
                                    <span>{{ selectedField?.name || '-' }}</span>
                                </div>
                                <div class="preview-row">
                                    <span>Tarih:</span>
                                    <span>{{ formatDate(useCustomDate ? saleDate : new Date().toISOString().split('T')[0]) }}</span>
                                </div>
                                <div class="preview-row preview-row--total">
                                    <span>Tahmini Tutar:</span>
                                    <span class="preview-total">{{ formatPrice(estimatedTotal) }}</span>
                                </div>
                            </div>

                            <!-- Submit -->
                            <div class="form-actions">
                                <button class="btn-secondary" @click="goToStep(2)">
                                    Geri Dön
                                </button>
                                <button
                                    class="btn-primary btn-primary--lg"
                                    :disabled="!canProceedStep3 || isSaving"
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
                    <AppSelect
                        v-model="statusFilter"
                        :options="statusFilterOptions"
                        placeholder="Durum"
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
                                    <th>Kalite</th>
                                    <th>Satılan</th>
                                    <th>Kalan</th>
                                    <th>Durum</th>
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
                                    <td>{{ harvest.quality ? qualityLabels[harvest.quality] : '-' }}</td>
                                    <td>{{ harvest.soldAmountKg ? formatKg(harvest.soldAmountKg) : '-' }}</td>
                                    <td>{{ harvest.remainingKg !== undefined ? formatKg(harvest.remainingKg) : '-' }}</td>
                                    <td>
                                        <span class="status-badge" :class="getStatusClass(harvest.status)">
                                            {{ harvest.status ? statusLabels[harvest.status] : '-' }}
                                        </span>
                                    </td>
                                    <td class="td-action">
                                        <button
                                            class="btn-icon-delete"
                                            @click="deleteHarvest(harvest.id)"
                                            :disabled="harvest.status === 'sold' || harvest.status === 'partial'"
                                            :title="harvest.status !== 'pending' ? 'Satışı olan hasat silinemez' : ''"
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
                                <span class="status-badge" :class="getStatusClass(harvest.status)">
                                    {{ harvest.status ? statusLabels[harvest.status] : '-' }}
                                </span>
                            </div>
                            <div class="card-body">
                                <div class="card-row">
                                    <span class="card-label">Tarih</span>
                                    <span class="card-value">{{ formatDate(harvest.harvestDate) }}</span>
                                </div>
                                <div class="card-row">
                                    <span class="card-label">Miktar</span>
                                    <span class="card-value card-value--highlight">{{ formatKg(harvest.amountKg) }}</span>
                                </div>
                                <div class="card-row">
                                    <span class="card-label">Kalite</span>
                                    <span class="card-value">{{ harvest.quality ? qualityLabels[harvest.quality] : '-' }}</span>
                                </div>
                                <div class="card-row">
                                    <span class="card-label">Satılan</span>
                                    <span class="card-value">{{ harvest.soldAmountKg ? formatKg(harvest.soldAmountKg) : '-' }}</span>
                                </div>
                                <div class="card-row">
                                    <span class="card-label">Kalan</span>
                                    <span class="card-value">{{ harvest.remainingKg !== undefined ? formatKg(harvest.remainingKg) : '-' }}</span>
                                </div>
                            </div>
                            <div class="card-footer">
                                <button
                                    class="btn-icon-delete"
                                    @click="deleteHarvest(harvest.id)"
                                    :disabled="harvest.status === 'sold' || harvest.status === 'partial'"
                                    :title="harvest.status !== 'pending' ? 'Satışı olan hasat silinemez' : ''"
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
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-text-muted)"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                    <h3>Arazi Verim Analizi</h3>
                    <p>Bu alan yakında aktif olacaktır. Arazilerinizin verim analizlerini buradan takip edebileceksiniz.</p>
                </div>
            </div>

            <!-- Add Firm Modal -->
            <div v-if="showAddFirmModal" class="modal-overlay" @click.self="showAddFirmModal = false">
                <div class="modal-content">
                    <h2>Yeni Firma Ekle</h2>
                    <p class="modal-subtitle">Yaş çayınızı sattığınız firmanın ismini girin.</p>

                    <form @submit.prevent="addNewFirm" class="create-form">
                        <div class="form-group">
                            <label class="form-label">Firma Adı <span class="required">*</span></label>
                            <input
                                type="text"
                                v-model="newFirmName"
                                placeholder="Örn: ÇAYKUR"
                                class="form-input"
                                required
                                autofocus
                            />
                        </div>

                        <div class="form-actions">
                            <button type="button" class="btn-secondary" @click="showAddFirmModal = false">
                                İptal
                            </button>
                            <button type="submit" class="btn-primary" :disabled="firmsStore.isLoading || !newFirmName.trim()">
                                {{ firmsStore.isLoading ? 'Ekleniyor...' : 'Firma Ekle' }}
                            </button>
                        </div>
                    </form>
                </div>
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
    </AppLayout>
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
