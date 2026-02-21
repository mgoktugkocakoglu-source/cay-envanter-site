<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useHarvestsStore } from '@/stores/harvestsStore';
import { useFieldsStore } from '@/stores/fieldsStore';
import { useToast } from '@/composables/useToast';
import AppLayout from '@/layouts/AppLayout.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';

const harvestsStore = useHarvestsStore();
const fieldsStore = useFieldsStore();
const toast = useToast();

const fieldFilter = ref('');
const yearFilter = ref(new Date().getFullYear());
const statusFilter = ref('');
const showCreateModal = ref(false);
const showDeleteConfirm = ref(false);
const deleteTargetId = ref('');

// Create form
const createForm = ref({
    fieldId: '',
    harvestDate: new Date().toISOString().split('T')[0],
    amountKg: 0,
    quality: '',
    notes: ''
});

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

// Options for AppSelect
const yearOptions = computed(() => 
    years.value.map(y => ({ value: y, label: String(y) }))
);

const fieldOptions = computed(() => [
    { value: '', label: 'Tüm Tarlalar' },
    ...fieldsStore.fields.map(f => ({ value: f.id, label: f.name }))
]);

const statusFilterOptions = [
    { value: '', label: 'Tüm Durumlar' },
    { value: 'pending', label: 'Bekliyor' },
    { value: 'partial', label: 'Kısmi Satış' },
    { value: 'sold', label: 'Satıldı' }
];

const fieldFormOptions = computed(() => [
    { value: '', label: 'Seçiniz' },
    ...fieldsStore.fields.map(f => ({ value: f.id, label: f.name }))
]);

const qualityOptions = [
    { value: '', label: 'Belirtilmemiş' },
    { value: 'shoot', label: 'Sürgün' },
    { value: 'leaf', label: 'Yaprak' },
    { value: 'mixed', label: 'Karışık' }
];

onMounted(() => {
    harvestsStore.fetchHarvests({ year: yearFilter.value });
    fieldsStore.fetchFields();
});

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

function formatKg(kg: number) {
    return kg.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' kg';
}

function getStatusClass(status?: string) {
    return {
        'status-pending': status === 'pending',
        'status-partial': status === 'partial',
        'status-sold': status === 'sold'
    };
}

async function createHarvest() {
    if (!createForm.value.fieldId || !createForm.value.amountKg) return;

    const result = await harvestsStore.createHarvest({
        fieldId: createForm.value.fieldId,
        harvestDate: createForm.value.harvestDate,
        amountKg: createForm.value.amountKg,
        quality: createForm.value.quality || undefined,
        notes: createForm.value.notes || undefined
    });

    if (result) {
        toast.success('Hasat başarıyla eklendi');
        showCreateModal.value = false;
        createForm.value = {
            fieldId: '',
            harvestDate: new Date().toISOString().split('T')[0],
            amountKg: 0,
            quality: '',
            notes: ''
        };
    } else {
        toast.error('Hasat eklenirken bir hata oluştu');
    }
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
            <header class="page-header">
                <div class="header-content">
                    <h1>Hasatlarım</h1>
                    <p class="subtitle">
                        {{ harvestsStore.harvestCount }} hasat, toplam {{ formatKg(harvestsStore.totalHarvestKg) }}
                    </p>
                </div>
                <button class="btn-primary" @click="showCreateModal = true">
                    <span class="icon">+</span>
                    Hasat Ekle
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
                v-model="fieldFilter"
                :options="fieldOptions"
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
            <h3>Henüz hasat kaydı yok</h3>
            <p>İlk hasatınızı ekleyerek başlayın</p>
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

        <!-- Create Modal -->
        <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
            <div class="modal-content">
                <h2>Yeni Hasat Ekle</h2>

                <form @submit.prevent="createHarvest" class="create-form">
                    <AppSelect
                        v-model="createForm.fieldId"
                        :options="fieldFormOptions"
                        label="Tarla *"
                        placeholder="Seçiniz"
                        :required="true"
                        variant="light"
                    />

                    <div class="form-group">
                        <label>Hasat Tarihi *</label>
                        <input type="date" v-model="createForm.harvestDate" required :max="new Date().toISOString().split('T')[0]" />
                    </div>

                    <div class="form-group">
                        <label>Miktar (kg) *</label>
                        <input type="number" v-model.number="createForm.amountKg" min="0.1" step="0.1" required />
                    </div>

                    <AppSelect
                        v-model="createForm.quality"
                        :options="qualityOptions"
                        label="Kalite"
                        placeholder="Seçiniz"
                        variant="light"
                    />

                    <div class="form-group">
                        <label>Notlar</label>
                        <textarea v-model="createForm.notes" rows="3" maxlength="300"></textarea>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn-secondary" @click="showCreateModal = false">İptal</button>
                        <button type="submit" class="btn-primary" :disabled="harvestsStore.isLoading">
                            {{ harvestsStore.isLoading ? 'Kaydediliyor...' : 'Kaydet' }}
                        </button>
                    </div>
                </form>

                <p v-if="harvestsStore.error" class="error-message">{{ harvestsStore.error }}</p>
            </div>
        </div>
        <!-- Delete Harvest Confirm Modal -->
        <ConfirmModal
            v-model="showDeleteConfirm"
            title="Hasati Sil"
            message="Bu hasati silmek istediginize emin misiniz? Bu islem geri alinamaz."
            confirm-text="Sil"
            cancel-text="Vazgec"
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
    color: var(--color-text-muted);
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

.btn-icon-delete:hover:not(:disabled) {
    color: var(--color-danger);
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.2);
}

.btn-icon-delete:disabled {
    opacity: 0.3;
    cursor: not-allowed;
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

/* ==================== Responsive Visibility ==================== */
.mobile-only {
    display: none;
}

.desktop-only {
    display: block;
}

/* ==================== Loading & Empty ==================== */
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
    padding: 60px;
    background: var(--color-bg-tertiary);
    border-radius: 16px;
}

.empty-icon {
    font-size: 64px;
    margin-bottom: 16px;
}

/* ==================== Modal ==================== */
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
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
}

.modal-content h2 {
    margin: 0 0 24px 0;
    font-size: 24px;
    font-weight: 700;
    color: var(--color-text-primary);
}

.create-form {
    display: flex;
    flex-direction: column;
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

.form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 8px;
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

/* ==================== Responsive ==================== */
@media (max-width: 768px) {
    .harvests-page {
        padding: 16px;
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

    .desktop-only {
        display: none !important;
    }

    .mobile-only {
        display: flex !important;
    }
}
</style>
