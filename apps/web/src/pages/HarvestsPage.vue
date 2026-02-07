<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useHarvestsStore } from '@/stores/harvestsStore';
import { useFieldsStore } from '@/stores/fieldsStore';
import { useToast } from '@/composables/useToast';
import AppLayout from '@/layouts/AppLayout.vue';

const harvestsStore = useHarvestsStore();
const fieldsStore = useFieldsStore();
const toast = useToast();

const fieldFilter = ref('');
const yearFilter = ref(new Date().getFullYear());
const statusFilter = ref('');
const showCreateModal = ref(false);

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

async function deleteHarvest(id: string) {
    if (confirm('Bu hasatı silmek istediğinize emin misiniz?')) {
        const success = await harvestsStore.deleteHarvest(id);
        if (success) {
            toast.success('Hasat başarıyla silindi');
        } else {
            toast.error('Hasat silinirken bir hata oluştu');
        }
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
            <select v-model="yearFilter" class="filter-select" @change="applyFilters">
                <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
            </select>
            <select v-model="fieldFilter" class="filter-select" @change="applyFilters">
                <option value="">Tüm Tarlalar</option>
                <option v-for="f in fieldsStore.fields" :key="f.id" :value="f.id">{{ f.name }}</option>
            </select>
            <select v-model="statusFilter" class="filter-select" @change="applyFilters">
                <option value="">Tüm Durumlar</option>
                <option value="pending">Bekliyor</option>
                <option value="partial">Kısmi Satış</option>
                <option value="sold">Satıldı</option>
            </select>
        </div>

        <div v-if="harvestsStore.isLoading" class="loading">
            <div class="spinner"></div>
        </div>

        <div v-else-if="harvestsStore.harvests.length === 0" class="empty-state">
            <div class="empty-icon">🍃</div>
            <h3>Henüz hasat kaydı yok</h3>
            <p>İlk hasatınızı ekleyerek başlayın</p>
        </div>

        <table v-else class="harvests-table">
            <thead>
                <tr>
                    <th>Tarla</th>
                    <th>Tarih</th>
                    <th>Miktar</th>
                    <th>Kalite</th>
                    <th>Satılan</th>
                    <th>Kalan</th>
                    <th>Durum</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="harvest in harvestsStore.harvests" :key="harvest.id">
                    <td class="field-name">{{ harvest.fieldName }}</td>
                    <td>{{ formatDate(harvest.harvestDate) }}</td>
                    <td class="amount">{{ formatKg(harvest.amountKg) }}</td>
                    <td>{{ harvest.quality ? qualityLabels[harvest.quality] : '-' }}</td>
                    <td>{{ harvest.soldAmountKg ? formatKg(harvest.soldAmountKg) : '-' }}</td>
                    <td>{{ harvest.remainingKg !== undefined ? formatKg(harvest.remainingKg) : '-' }}</td>
                    <td>
                        <span class="status-badge" :class="getStatusClass(harvest.status)">
                            {{ harvest.status ? statusLabels[harvest.status] : '-' }}
                        </span>
                    </td>
                    <td>
                        <button
                            class="btn-delete"
                            @click="deleteHarvest(harvest.id)"
                            :disabled="harvest.status === 'sold' || harvest.status === 'partial'"
                            :title="harvest.status !== 'pending' ? 'Satışı olan hasat silinemez' : ''"
                        >
                            🗑️
                        </button>
                    </td>
                </tr>
            </tbody>
        </table>

        <!-- Create Modal -->
        <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
            <div class="modal-content">
                <h2>Yeni Hasat Ekle</h2>

                <form @submit.prevent="createHarvest" class="create-form">
                    <div class="form-group">
                        <label>Tarla *</label>
                        <select v-model="createForm.fieldId" required>
                            <option value="">Seçiniz</option>
                            <option v-for="f in fieldsStore.fields" :key="f.id" :value="f.id">
                                {{ f.name }}
                            </option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Hasat Tarihi *</label>
                        <input type="date" v-model="createForm.harvestDate" required :max="new Date().toISOString().split('T')[0]" />
                    </div>

                    <div class="form-group">
                        <label>Miktar (kg) *</label>
                        <input type="number" v-model.number="createForm.amountKg" min="0.1" step="0.1" required />
                    </div>

                    <div class="form-group">
                        <label>Kalite</label>
                        <select v-model="createForm.quality">
                            <option value="">Belirtilmemiş</option>
                            <option value="shoot">Sürgün</option>
                            <option value="leaf">Yaprak</option>
                            <option value="mixed">Karışık</option>
                        </select>
                    </div>

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
    font-size: 28px;
    font-weight: 700;
    color: #1a1a2e;
    margin: 0;
}

.subtitle {
    color: #666;
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

.filter-select {
    padding: 12px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 10px;
    font-size: 14px;
    background: white;
    min-width: 150px;
}

.harvests-table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.harvests-table th,
.harvests-table td {
    padding: 16px;
    text-align: left;
    border-bottom: 1px solid #f3f4f6;
}

.harvests-table th {
    background: #f9fafb;
    font-weight: 600;
    color: #374151;
    font-size: 14px;
}

.harvests-table tbody tr:hover {
    background: #f9fafb;
}

.field-name {
    font-weight: 600;
    color: #1a1a2e;
}

.amount {
    font-weight: 600;
    color: #10b981;
}

.status-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
}

.status-pending {
    background: #fef3c7;
    color: #d97706;
}

.status-partial {
    background: #dbeafe;
    color: #2563eb;
}

.status-sold {
    background: #d1fae5;
    color: #059669;
}

.btn-delete {
    background: transparent;
    border: none;
    font-size: 16px;
    cursor: pointer;
    padding: 4px;
}

.btn-delete:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.loading {
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

.empty-state {
    text-align: center;
    padding: 60px;
    background: #f9fafb;
    border-radius: 16px;
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

.modal-content {
    background: white;
    padding: 32px;
    border-radius: 16px;
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
}

.modal-content h2 {
    margin: 0 0 24px 0;
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

.form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 8px;
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

@media (max-width: 768px) {
    .page-header {
        flex-direction: column;
        gap: 16px;
        align-items: flex-start;
    }

    .filters {
        flex-direction: column;
    }

    .harvests-table {
        display: block;
        overflow-x: auto;
    }
}
</style>
