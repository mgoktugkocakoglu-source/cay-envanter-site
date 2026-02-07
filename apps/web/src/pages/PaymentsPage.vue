<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { usePaymentsStore } from '@/stores/paymentsStore';
import { useHarvestsStore } from '@/stores/harvestsStore';
import { useToast } from '@/composables/useToast';
import AppLayout from '@/layouts/AppLayout.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';

const paymentsStore = usePaymentsStore();
const harvestsStore = useHarvestsStore();
const toast = useToast();

const yearFilter = ref(new Date().getFullYear());
const statusFilter = ref('');
const showCreateModal = ref(false);
const showDeleteConfirm = ref(false);
const deleteTargetId = ref('');
const currentStep = ref(1);

// Create form
const selectedHarvests = ref<{ harvestId: string; usedAmountKg: number; fieldName: string; remaining: number }[]>([]);
const createForm = ref({
    totalPrice: 0,
    brokerFirmId: '',
    newBrokerFirm: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentStatus: 'received' as 'received' | 'pending',
    notes: ''
});

const years = computed(() => {
    const current = new Date().getFullYear();
    return [current, current - 1, current - 2, current - 3, current - 4];
});

// Options for AppSelect
const yearOptions = computed(() => 
    years.value.map(y => ({ value: y, label: String(y) }))
);

const statusOptions = [
    { value: '', label: 'Tüm Durumlar' },
    { value: 'received', label: 'Alındı' },
    { value: 'pending', label: 'Bekliyor' }
];

const brokerFirmOptions = computed(() => [
    { value: '', label: 'Seçiniz veya yeni ekleyin' },
    ...paymentsStore.brokerFirms.map(firm => ({ value: firm.id, label: firm.firmName }))
]);

const paymentStatusOptions = [
    { value: 'received', label: 'Alındı' },
    { value: 'pending', label: 'Bekliyor' }
];

const totalSelectedKg = computed(() => 
    selectedHarvests.value.reduce((sum, h) => sum + h.usedAmountKg, 0)
);

const pricePerKg = computed(() => 
    totalSelectedKg.value > 0 ? createForm.value.totalPrice / totalSelectedKg.value : 0
);

onMounted(() => {
    paymentsStore.fetchPayments({ year: yearFilter.value });
    paymentsStore.fetchBrokerFirms();
});

function applyFilters() {
    const params: Record<string, unknown> = {};
    if (yearFilter.value) params.year = yearFilter.value;
    if (statusFilter.value) params.paymentStatus = statusFilter.value;
    paymentsStore.fetchPayments(params as { year?: number; paymentStatus?: string });
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function formatCurrency(amount: number) {
    return amount?.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
}

function formatKg(kg: number) {
    return kg.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' kg';
}

function openCreateModal() {
    harvestsStore.fetchAvailableHarvests();
    selectedHarvests.value = [];
    createForm.value = {
        totalPrice: 0,
        brokerFirmId: '',
        newBrokerFirm: '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentStatus: 'received',
        notes: ''
    };
    currentStep.value = 1;
    showCreateModal.value = true;
}

function toggleHarvest(harvest: { id: string; fieldName?: string; remainingKg?: number }) {
    const index = selectedHarvests.value.findIndex(h => h.harvestId === harvest.id);
    if (index === -1) {
        selectedHarvests.value.push({
            harvestId: harvest.id,
            usedAmountKg: harvest.remainingKg || 0,
            fieldName: harvest.fieldName || '',
            remaining: harvest.remainingKg || 0
        });
    } else {
        selectedHarvests.value.splice(index, 1);
    }
}

function isHarvestSelected(harvestId: string) {
    return selectedHarvests.value.some(h => h.harvestId === harvestId);
}

function nextStep() {
    if (currentStep.value === 1 && selectedHarvests.value.length > 0) {
        currentStep.value = 2;
    }
}

function prevStep() {
    if (currentStep.value > 1) {
        currentStep.value--;
    }
}

async function createPayment() {
    if (selectedHarvests.value.length === 0 || createForm.value.totalPrice <= 0) return;

    let brokerFirmId = createForm.value.brokerFirmId;

    // Create new broker firm if specified
    if (createForm.value.newBrokerFirm && !brokerFirmId) {
        const newFirm = await paymentsStore.createBrokerFirm(createForm.value.newBrokerFirm);
        if (newFirm) {
            brokerFirmId = newFirm.id;
        }
    }

    const result = await paymentsStore.createPayment({
        harvestAllocations: selectedHarvests.value.map(h => ({
            harvestId: h.harvestId,
            usedAmountKg: h.usedAmountKg
        })),
        totalPrice: createForm.value.totalPrice,
        brokerFirmId: brokerFirmId || undefined,
        paymentDate: createForm.value.paymentDate,
        paymentStatus: createForm.value.paymentStatus,
        notes: createForm.value.notes || undefined
    });

    if (result) {
        toast.success('Ödeme başarıyla kaydedildi');
        showCreateModal.value = false;
    } else {
        toast.error('Ödeme kaydedilirken bir hata oluştu');
    }
}

function deletePayment(id: string) {
    deleteTargetId.value = id;
    showDeleteConfirm.value = true;
}

async function confirmDeletePayment() {
    const success = await paymentsStore.deletePayment(deleteTargetId.value);
    if (success) {
        toast.success('Ödeme başarıyla silindi');
    } else {
        toast.error('Ödeme silinirken bir hata oluştu');
    }
}
</script>

<template>
    <AppLayout>
        <div class="payments-page">
            <header class="page-header">
                <div class="header-content">
                    <h1>Ödemeler</h1>
                    <p class="subtitle">
                        Toplam Gelir: {{ formatCurrency(paymentsStore.totalIncome) }}
                    </p>
                </div>
                <button class="btn-primary" @click="openCreateModal">
                    <span class="icon">+</span>
                    Ödeme Ekle
                </button>
            </header>

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
                @update:model-value="applyFilters"
            />
        </div>

        <div v-if="paymentsStore.isLoading" class="loading">
            <div class="spinner"></div>
        </div>

        <div v-else-if="paymentsStore.payments.length === 0" class="empty-state">
            <div class="empty-icon">💰</div>
            <h3>Henüz ödeme kaydı yok</h3>
            <p>İlk ödemenizi ekleyerek başlayın</p>
        </div>

        <table v-else class="payments-table">
            <thead>
                <tr>
                    <th>Tarih</th>
                    <th>Aracı Firma</th>
                    <th>Miktar</th>
                    <th>Tutar</th>
                    <th>Kg Fiyatı</th>
                    <th>Durum</th>
                    <th>Hasat</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="payment in paymentsStore.payments" :key="payment.id">
                    <td>{{ formatDate(payment.paymentDate) }}</td>
                    <td>{{ payment.brokerFirm?.firmName || '-' }}</td>
                    <td>{{ formatKg(payment.totalAmountKg) }}</td>
                    <td class="amount">{{ formatCurrency(payment.totalPrice) }}</td>
                    <td>{{ formatCurrency(payment.pricePerKg) }}/kg</td>
                    <td>
                        <span
                            class="status-badge"
                            :class="payment.paymentStatus === 'received' ? 'status-received' : 'status-pending'"
                        >
                            {{ payment.paymentStatus === 'received' ? 'Alındı' : 'Bekliyor' }}
                        </span>
                    </td>
                    <td>{{ payment.harvestCount }} hasat</td>
                    <td>
                        <button class="btn-delete" @click="deletePayment(payment.id)">🗑️</button>
                    </td>
                </tr>
            </tbody>
        </table>

        <!-- Create Modal - Wizard -->
        <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
            <div class="modal-content wizard">
                <div class="wizard-header">
                    <div class="step" :class="{ active: currentStep === 1, completed: currentStep > 1 }">
                        1. Hasat Seçimi
                    </div>
                    <div class="step" :class="{ active: currentStep === 2 }">
                        2. Ödeme Detayları
                    </div>
                </div>

                <!-- Step 1: Select Harvests -->
                <div v-if="currentStep === 1" class="wizard-step">
                    <h3>Satılacak Hasatları Seçin</h3>

                    <div v-if="harvestsStore.availableHarvests.length === 0" class="empty-state small">
                        <p>Satışa uygun hasat bulunamadı</p>
                    </div>

                    <div v-else class="harvest-list">
                        <div
                            v-for="harvest in harvestsStore.availableHarvests"
                            :key="harvest.id"
                            class="harvest-item"
                            :class="{ selected: isHarvestSelected(harvest.id) }"
                            @click="toggleHarvest(harvest)"
                        >
                            <div class="harvest-info">
                                <strong>{{ harvest.fieldName }}</strong>
                                <span class="date">{{ formatDate(harvest.harvestDate) }}</span>
                            </div>
                            <div class="harvest-amount">
                                {{ formatKg(harvest.remainingKg || 0) }} mevcut
                            </div>
                            <input
                                v-if="isHarvestSelected(harvest.id)"
                                type="number"
                                :max="harvest.remainingKg"
                                min="0.1"
                                step="0.1"
                                v-model.number="selectedHarvests.find(h => h.harvestId === harvest.id)!.usedAmountKg"
                                @click.stop
                                class="amount-input"
                            />
                        </div>
                    </div>

                    <div class="wizard-summary">
                        <strong>Toplam: {{ formatKg(totalSelectedKg) }}</strong>
                    </div>

                    <div class="wizard-actions">
                        <button class="btn-secondary" @click="showCreateModal = false">İptal</button>
                        <button class="btn-primary" @click="nextStep" :disabled="selectedHarvests.length === 0">
                            Devam
                        </button>
                    </div>
                </div>

                <!-- Step 2: Payment Details -->
                <div v-if="currentStep === 2" class="wizard-step">
                    <h3>Ödeme Bilgileri</h3>

                    <form @submit.prevent="createPayment" class="create-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Toplam Miktar</label>
                                <input type="text" :value="formatKg(totalSelectedKg)" disabled />
                            </div>
                            <div class="form-group">
                                <label>Toplam Tutar (TL) *</label>
                                <input type="number" v-model.number="createForm.totalPrice" min="1" step="0.01" required />
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Kg Başına Fiyat</label>
                            <input type="text" :value="formatCurrency(pricePerKg) + '/kg'" disabled />
                        </div>

                        <AppSelect
                            v-model="createForm.brokerFirmId"
                            :options="brokerFirmOptions"
                            label="Aracı Firma"
                            placeholder="Seçiniz veya yeni ekleyin"
                            variant="light"
                        />

                        <div class="form-group" v-if="!createForm.brokerFirmId">
                            <label>Yeni Aracı Firma</label>
                            <input type="text" v-model="createForm.newBrokerFirm" placeholder="Firma adı girin" />
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Ödeme Tarihi *</label>
                                <input type="date" v-model="createForm.paymentDate" required />
                            </div>
                            <AppSelect
                                v-model="createForm.paymentStatus"
                                :options="paymentStatusOptions"
                                label="Durum *"
                                :required="true"
                                variant="light"
                            />
                        </div>

                        <div class="form-group">
                            <label>Notlar</label>
                            <textarea v-model="createForm.notes" rows="2"></textarea>
                        </div>

                        <div class="wizard-actions">
                            <button type="button" class="btn-secondary" @click="prevStep">Geri</button>
                            <button type="submit" class="btn-primary" :disabled="paymentsStore.isLoading">
                                {{ paymentsStore.isLoading ? 'Kaydediliyor...' : 'Kaydet' }}
                            </button>
                        </div>
                    </form>

                    <p v-if="paymentsStore.error" class="error-message">{{ paymentsStore.error }}</p>
                </div>
            </div>
        </div>
        <!-- Delete Payment Confirm Modal -->
        <ConfirmModal
            v-model="showDeleteConfirm"
            title="Odemeyi Sil"
            message="Bu odemeyi silmek istediginize emin misiniz? Bu islem geri alinamaz."
            confirm-text="Sil"
            cancel-text="Vazgec"
            variant="danger"
            @confirm="confirmDeletePayment"
        />
        </div>
    </AppLayout>
</template>

<style scoped>
.payments-page {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
}

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
}

.header-content h1 {
    font-size: 32px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
}

.subtitle {
    color: #10b981;
    font-weight: 600;
    margin: 4px 0 0 0;
}

.btn-primary {
    display: flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 12px;
    font-weight: 600;
    cursor: pointer;
}

.btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.filters {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
}

.filters .app-select-wrapper {
    min-width: 200px;
}

.filter-select {
    padding: 12px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 10px;
    font-size: 14px;
    background: white;
    min-width: 150px;
}

.payments-table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.payments-table th,
.payments-table td {
    padding: 16px;
    text-align: left;
    border-bottom: 1px solid #f3f4f6;
}

.payments-table th {
    background: #f9fafb;
    font-weight: 600;
    color: #374151;
    font-size: 14px;
}

.payments-table td {
    color: #1f2937;
    font-size: 14px;
}

.payments-table tbody tr:hover {
    background: #f9fafb;
}

.amount {
    font-weight: 700;
    color: #10b981;
    font-size: 16px;
}

.status-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
}

.status-received {
    background: #d1fae5;
    color: #059669;
}

.status-pending {
    background: #fef3c7;
    color: #d97706;
}

.btn-delete {
    background: transparent;
    border: none;
    font-size: 16px;
    cursor: pointer;
    padding: 4px;
}

.loading, .empty-state {
    text-align: center;
    padding: 60px;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #e5e7eb;
    border-top-color: #10b981;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.empty-icon {
    font-size: 64px;
    margin-bottom: 16px;
}

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

.modal-content.wizard {
    background: white;
    padding: 0;
    border-radius: 16px;
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    overflow: hidden;
}

.wizard-header {
    display: flex;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
}

.wizard-header .step {
    flex: 1;
    padding: 16px;
    text-align: center;
    font-weight: 600;
    color: #9ca3af;
}

.wizard-header .step.active {
    color: #10b981;
    background: white;
}

.wizard-header .step.completed {
    color: #059669;
}

.wizard-step {
    padding: 24px;
    max-height: 60vh;
    overflow-y: auto;
}

.wizard-step h3 {
    margin: 0 0 16px 0;
    font-size: 20px;
    font-weight: 700;
    color: #1a1a2e;
}

.harvest-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
}

.harvest-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
}

.harvest-item:hover {
    border-color: #10b981;
}

.harvest-item.selected {
    border-color: #10b981;
    background: #ecfdf5;
}

.harvest-info {
    flex: 1;
}

.harvest-info strong {
    display: block;
    color: #1a1a2e;
    font-size: 15px;
}

.harvest-info .date {
    font-size: 12px;
    color: #6b7280;
}

.harvest-amount {
    font-weight: 600;
    color: #10b981;
}

.amount-input {
    width: 100px;
    padding: 8px;
    border: 2px solid #10b981;
    border-radius: 6px;
    font-size: 14px;
}

.wizard-summary {
    text-align: right;
    padding: 12px;
    background: #f9fafb;
    border-radius: 8px;
    color: #374151;
}

.wizard-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #e5e7eb;
}

.create-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.form-group label {
    font-weight: 600;
    font-size: 14px;
    color: #374151;
}

.form-group input,
.form-group select,
.form-group textarea {
    padding: 12px;
    border: 2px solid #e5e7eb;
    border-radius: 10px;
    font-size: 14px;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
    outline: none;
    border-color: #10b981;
}

.form-group input:disabled {
    background: #f3f4f6;
    color: #6b7280;
}

.btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: none;
    padding: 12px 24px;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
}

.error-message {
    background: #fef2f2;
    color: #dc2626;
    padding: 12px;
    border-radius: 8px;
    margin-top: 16px;
    font-size: 14px;
}

.empty-state.small {
    padding: 24px;
}

@media (max-width: 768px) {
    .page-header {
        flex-direction: column;
        gap: 16px;
        align-items: flex-start;
    }

    .filters {
        flex-direction: column;
    }

    .form-row {
        grid-template-columns: 1fr;
    }

    .payments-table {
        display: block;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }

    .payments-table th,
    .payments-table td {
        white-space: nowrap;
        padding: 12px 10px;
        font-size: 13px;
    }
}
</style>
