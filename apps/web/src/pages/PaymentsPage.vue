<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { usePaymentsStore } from '@/stores/paymentsStore';
import { useHarvestsStore } from '@/stores/harvestsStore';
import { useToast } from '@/composables/useToast';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
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

function toggleHarvest(harvest: { id: string; fieldId?: string; fieldName?: string; remainingKg?: number | string }) {
    const index = selectedHarvests.value.findIndex(h => h.harvestId === harvest.id);
    if (index === -1) {
        const remaining = typeof harvest.remainingKg === 'string' ? parseFloat(harvest.remainingKg) : (harvest.remainingKg || 0);
        selectedHarvests.value.push({
            harvestId: harvest.id,
            usedAmountKg: remaining,
            fieldName: harvest.fieldName || '',
            remaining: remaining
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
    <TeaBusinessLayout>
        <div class="payments-page">
            <header class="page-header">
                <div class="header-content">
                    <h1>Ödemeler</h1>
                    <p class="subtitle">
                        Bu Yılın Geliri: {{ formatCurrency(paymentsStore.totalIncome) }}
                    </p>
                </div>
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

        <!-- Desktop Table -->
        <template v-else>
        <div class="data-table-wrapper desktop-only">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Tarih</th>
                        <th>Aracı Firma</th>
                        <th>Miktar</th>
                        <th>Tutar</th>
                        <th>Kg Fiyatı</th>
                        <th>Durum</th>
                        <th class="th-action"></th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="payment in paymentsStore.payments" :key="payment.id">
                        <td>{{ formatDate(payment.paymentDate) }}</td>
                        <td><span class="cell-primary">{{ payment.brokerFirm?.firmName || '-' }}</span></td>
                        <td>{{ formatKg(payment.totalAmountKg) }}</td>
                        <td><span class="cell-highlight">{{ formatCurrency(payment.totalPrice) }}</span></td>
                        <td>{{ formatCurrency(payment.pricePerKg) }}/kg</td>
                        <td>
                            <span
                                class="status-badge"
                                :class="payment.paymentStatus === 'received' ? 'status-received' : 'status-pending'"
                            >
                                {{ payment.paymentStatus === 'received' ? 'Alındı' : 'Bekliyor' }}
                            </span>
                        </td>
                        <td class="td-action">
                            <button class="btn-icon-delete" @click="deletePayment(payment.id)">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Mobile Card List -->
        <div class="card-list mobile-only">
            <div v-for="payment in paymentsStore.payments" :key="'card-' + payment.id" class="data-card">
                <div class="card-header">
                    <div class="card-header-left">
                        <span class="card-title">{{ formatCurrency(payment.totalPrice) }}</span>
                        <span class="card-subtitle">{{ formatDate(payment.paymentDate) }}</span>
                    </div>
                    <span
                        class="status-badge"
                        :class="payment.paymentStatus === 'received' ? 'status-received' : 'status-pending'"
                    >
                        {{ payment.paymentStatus === 'received' ? 'Alındı' : 'Bekliyor' }}
                    </span>
                </div>
                <div class="card-body">
                    <div class="card-row">
                        <span class="card-label">Aracı Firma</span>
                        <span class="card-value">{{ payment.brokerFirm?.firmName || '-' }}</span>
                    </div>
                    <div class="card-row">
                        <span class="card-label">Miktar</span>
                        <span class="card-value">{{ formatKg(payment.totalAmountKg) }}</span>
                    </div>
                    <div class="card-row">
                        <span class="card-label">Kg Fiyatı</span>
                        <span class="card-value">{{ formatCurrency(payment.pricePerKg) }}/kg</span>
                    </div>
                </div>
                <div class="card-footer">
                    <button class="btn-icon-delete" @click="deletePayment(payment.id)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        <span>Sil</span>
                    </button>
                </div>
            </div>
        </div>
        </template>

        <!-- Yaklaşan Ödemelerim -->
        <section v-if="paymentsStore.pendingPayments.length > 0" class="upcoming-payments">
            <h2 class="upcoming-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Yaklaşan Ödemelerim
                <span class="upcoming-count">{{ paymentsStore.pendingPayments.length }}</span>
            </h2>
            <div class="upcoming-grid">
                <div
                    v-for="payment in paymentsStore.pendingPayments"
                    :key="'up-' + payment.id"
                    class="upcoming-card"
                >
                    <div class="upcoming-card-left">
                        <div class="upcoming-icon">⏳</div>
                        <div>
                            <div class="upcoming-amount">{{ formatCurrency(payment.totalPrice) }}</div>
                            <div class="upcoming-firm">{{ payment.brokerFirm?.firmName || '—' }}</div>
                        </div>
                    </div>
                    <div class="upcoming-card-right">
                        <div class="upcoming-kg">{{ formatKg(payment.totalAmountKg) }}</div>
                        <div class="upcoming-date">{{ formatDate(payment.paymentDate) }}</div>
                        <button class="btn-icon-delete" @click="deletePayment(payment.id)" title="Sil">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
            </div>
        </section>

        <!-- Delete Payment Confirm Modal -->
        <ConfirmModal
            v-model="showDeleteConfirm"
            title="Ödemeyi Sil"
            message="Bu ödemeyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
            confirm-text="Sil"
            cancel-text="Vazgec"
            variant="danger"
            @confirm="confirmDeletePayment"
        />
        </div>
    </TeaBusinessLayout>
</template>

<style scoped>
.payments-page {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
}

/* ── Yaklaşan Ödemelerim Section ── */
.upcoming-payments {
    margin-top: 32px;
    padding: 24px;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(234, 88, 12, 0.06));
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: var(--radius-xl);
}

.upcoming-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0 0 16px 0;
    color: #b45309;
}

.upcoming-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 8px;
    background: rgba(245, 158, 11, 0.2);
    color: #b45309;
    border-radius: var(--radius-full);
    font-size: 13px;
    font-weight: 700;
}

.upcoming-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.upcoming-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    background: var(--color-bg-secondary);
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: var(--radius-lg);
    transition: all var(--transition-fast);
}

.upcoming-card:hover {
    border-color: rgba(245, 158, 11, 0.5);
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.1);
}

.upcoming-card-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
}

.upcoming-icon {
    font-size: 20px;
    flex: 0 0 auto;
}

.upcoming-amount {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-text-primary);
    white-space: nowrap;
}

.upcoming-firm {
    font-size: 13px;
    color: var(--color-text-muted);
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.upcoming-card-right {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
}

.upcoming-kg {
    font-size: 13px;
    color: var(--color-text-secondary);
    font-weight: 500;
}

.upcoming-date {
    font-size: 13px;
    color: #b45309;
    font-weight: 600;
    background: rgba(245, 158, 11, 0.1);
    padding: 4px 10px;
    border-radius: var(--radius-full);
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
    color: var(--color-text-primary);
    margin: 0;
}

.subtitle {
    color: var(--color-primary);
    font-weight: 600;
    margin: 4px 0 0 0;
}

.btn-primary {
    display: flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
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

/* ==================== Modern Data Table ==================== */
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
    font-size: 15px;
}

.harvest-count {
    font-size: 13px;
    color: var(--color-text-muted);
    background: var(--color-bg-tertiary);
    padding: 3px 10px;
    border-radius: var(--radius-full);
}

/* ==================== Status Badges ==================== */
.status-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: var(--radius-full);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.4;
}

.status-received {
    background: rgba(34, 197, 94, 0.15);
    color: var(--color-success);
}

.status-pending {
    background: rgba(245, 158, 11, 0.15);
    color: var(--color-warning);
}

/* ==================== Delete Button ==================== */
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

.btn-icon-delete:hover {
    color: var(--color-danger);
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.2);
}

/* ==================== Mobile Card List ==================== */
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
    transition: box-shadow var(--transition-fast);
}

.data-card:active {
    box-shadow: var(--shadow-md);
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 16px 12px;
    border-bottom: 1px solid var(--color-border);
}

.card-header-left {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.card-title {
    font-weight: 700;
    font-size: 18px;
    color: var(--color-primary);
}

.card-subtitle {
    font-size: 13px;
    color: var(--color-text-muted);
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

.card-footer {
    display: flex;
    justify-content: flex-end;
    padding: 10px 16px;
    border-top: 1px solid var(--color-border);
    background: var(--color-bg-tertiary);
}

/* ==================== Responsive Visibility ==================== */
.mobile-only {
    display: none;
}

.desktop-only {
    display: block;
}

/* ==================== Loading & Empty ==================== */
.loading, .empty-state {
    text-align: center;
    padding: 60px;
}

.empty-state {
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-xl);
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

.empty-icon {
    font-size: 64px;
    margin-bottom: 16px;
}

/* ==================== Modal / Wizard ==================== */
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
    background: var(--color-bg-secondary);
    padding: 0;
    border-radius: 16px;
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    overflow: hidden;
}

.wizard-header {
    display: flex;
    background: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-border);
}

.wizard-header .step {
    flex: 1;
    padding: 16px;
    text-align: center;
    font-weight: 600;
    color: var(--color-text-muted);
}

.wizard-header .step.active {
    color: var(--color-primary);
    background: var(--color-bg-secondary);
}

.wizard-header .step.completed {
    color: var(--color-primary-hover);
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
    color: var(--color-text-primary);
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
    border: 2px solid var(--color-border);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
}

.harvest-item:hover {
    border-color: var(--color-primary);
}

.harvest-item.selected {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
}

.harvest-info {
    flex: 1;
}

.harvest-info strong {
    display: block;
    color: var(--color-text-primary);
    font-size: 15px;
}

.harvest-info .date {
    font-size: 12px;
    color: var(--color-text-muted);
}

.harvest-amount {
    font-weight: 600;
    color: var(--color-primary);
}

.amount-input {
    width: 100px;
    padding: 8px;
    border: 2px solid var(--color-primary);
    border-radius: 6px;
    font-size: 14px;
}

.wizard-summary {
    text-align: right;
    padding: 12px;
    background: var(--color-bg-tertiary);
    border-radius: 8px;
    color: var(--color-text-primary);
}

.wizard-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--color-border);
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
    color: var(--color-text-secondary);
}

.form-group input,
.form-group select,
.form-group textarea {
    padding: 12px;
    border: 2px solid var(--color-border);
    border-radius: 10px;
    font-size: 14px;
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
    outline: none;
    border-color: var(--color-primary);
}

.form-group input:disabled {
    background: var(--color-bg-tertiary);
    color: var(--color-text-muted);
}

.btn-secondary {
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    border: none;
    padding: 12px 24px;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
}

.error-message {
    background: rgba(239, 68, 68, 0.1);
    color: var(--color-danger);
    padding: 12px;
    border-radius: 8px;
    margin-top: 16px;
    font-size: 14px;
}

.empty-state.small {
    padding: 24px;
}

/* ==================== Responsive ==================== */
@media (max-width: 768px) {
    .payments-page {
        padding: 16px;
    }

    .upcoming-payments {
        padding: 16px;
    }

    .upcoming-title {
        font-size: 18px;
        gap: 8px;
        flex-wrap: wrap;
    }

    .upcoming-card {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        padding: 12px;
    }

    .upcoming-icon {
        display: none;
    }

    .upcoming-card-left {
        gap: 0;
    }

    .upcoming-card-left > div {
        min-width: 0;
    }

    .upcoming-amount {
        font-size: clamp(15px, 4vw, 18px);
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .upcoming-firm,
    .upcoming-kg {
        font-size: 12px;
    }

    .upcoming-card-right {
        display: grid;
        grid-template-columns: auto 30px;
        align-items: center;
        gap: 6px;
    }

    .upcoming-card-right .upcoming-kg {
        grid-column: 1 / -1;
        justify-self: end;
    }

    .upcoming-date {
        max-width: 92px;
        white-space: normal;
        text-align: center;
        line-height: 1.25;
        padding: 6px 10px;
    }

    .upcoming-card .btn-icon-delete {
        width: 30px;
        height: 30px;
        justify-content: center;
        padding: 0;
    }

    .page-header {
        flex-direction: column;
        gap: 16px;
        align-items: flex-start;
    }

    .header-content h1 {
        font-size: 24px;
    }

    .filters {
        flex-direction: column;
    }

    .form-row {
        grid-template-columns: 1fr;
    }

    .desktop-only {
        display: none !important;
    }

    .mobile-only {
        display: flex !important;
    }
}
</style>
