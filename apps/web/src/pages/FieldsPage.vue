<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useFieldsStore } from '@/stores/fieldsStore';
import { useToast } from '@/composables/useToast';
import type { Field } from '@/services/api';
import AppLayout from '@/layouts/AppLayout.vue';

const router = useRouter();
const fieldsStore = useFieldsStore();
const toast = useToast();

const searchQuery = ref('');
const provinceFilter = ref('');

// Delete modal state
const showDeleteModal = ref(false);
const fieldToDelete = ref<Field | null>(null);
const isDeleting = ref(false);

const provinces = ['Rize', 'Trabzon', 'Artvin', 'Giresun', 'Ordu'];

const filteredFields = computed(() => {
    let result = fieldsStore.fields;
    if (provinceFilter.value) {
        result = result.filter(f => f.province === provinceFilter.value);
    }
    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        result = result.filter(f => f.name.toLowerCase().includes(query));
    }
    return result;
});

onMounted(() => {
    fieldsStore.fetchFields();
});

function navigateToField(id: string) {
    router.push(`/fields/${id}`);
}

function navigateToCreateParams() {
    router.push('/fields/create');
}

function navigateToEdit(id: string, event: Event) {
    event.stopPropagation();
    router.push(`/fields/${id}/edit`);
}

function openDeleteModal(field: Field, event: Event) {
    event.stopPropagation();
    fieldToDelete.value = field;
    showDeleteModal.value = true;
}

function closeDeleteModal() {
    showDeleteModal.value = false;
    fieldToDelete.value = null;
}

async function confirmDelete() {
    if (!fieldToDelete.value) return;

    isDeleting.value = true;
    try {
        const success = await fieldsStore.deleteField(fieldToDelete.value.id);
        if (success) {
            toast.success('Tarla başarıyla silindi');
            closeDeleteModal();
        } else {
            toast.error('Tarla silinirken bir hata oluştu');
        }
    } finally {
        isDeleting.value = false;
    }
}

function formatArea(area: number, unit: string) {
    const formatted = area.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
    const unitLabels: Record<string, string> = {
        'donum': 'dönüm',
        'dekar': 'dekar',
        'm2': 'm²'
    };
    return `${formatted} ${unitLabels[unit] || unit}`;
}
</script>

<template>
    <AppLayout>
        <div class="fields-page">
            <header class="page-header">
                <div class="header-content">
                    <h1>Tarlalarım</h1>
                    <p class="subtitle">{{ fieldsStore.fieldCount }} tarla kayıtlı</p>
                </div>
                <button class="btn-primary" @click="navigateToCreateParams">
                    <span class="icon">+</span>
                    Yeni Tarla Ekle
                </button>
            </header>

            <div class="filters">
            <div class="search-box">
                <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="Tarla adı ara..."
                    class="search-input"
                />
            </div>
            <select v-model="provinceFilter" class="filter-select">
                <option value="">Tüm İller</option>
                <option v-for="p in provinces" :key="p" :value="p">{{ p }}</option>
            </select>
        </div>

        <div v-if="fieldsStore.isLoading" class="loading">
            <div class="spinner"></div>
            <p>Tarlalar yükleniyor...</p>
        </div>

        <div v-else-if="fieldsStore.error" class="error-message">
            {{ fieldsStore.error }}
        </div>

        <div v-else-if="filteredFields.length === 0" class="empty-state">
            <div class="empty-icon">🌿</div>
            <h3>Henüz tarla eklenmedi</h3>
            <p>İlk tarlanızı ekleyerek başlayın</p>
            <button class="btn-primary" @click="navigateToCreateParams">
                Tarla Ekle
            </button>
        </div>

        <div v-else class="fields-grid">
            <div
                v-for="field in filteredFields"
                :key="field.id"
                class="field-card"
                @click="navigateToField(field.id)"
            >
                <div class="card-header">
                    <h3 class="field-name">{{ field.name }}</h3>
                    <span class="area-badge">{{ formatArea(field.area, field.areaUnit) }}</span>
                </div>

                <div class="card-body">
                    <div class="location">
                        <span class="icon">📍</span>
                        {{ field.province }} / {{ field.district }}
                    </div>
                    <div class="neighborhood">
                        {{ field.neighborhood }}
                    </div>
                </div>

                <div class="card-footer">
                    <div class="partners" v-if="field.partnerCount > 1">
                        <span class="icon">👥</span>
                        {{ field.partnerCount }} ortak
                    </div>
                    <div class="actions">
                        <button 
                            class="btn-icon" 
                            title="Düzenle"
                            @click="navigateToEdit(field.id, $event)"
                        >
                            ✏️
                        </button>
                        <button 
                            class="btn-icon btn-icon-danger" 
                            title="Sil"
                            @click="openDeleteModal(field, $event)"
                        >
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Delete Confirmation Modal -->
        <div v-if="showDeleteModal" class="modal-overlay" @click.self="closeDeleteModal">
            <div class="modal-content">
                <div class="modal-icon">⚠️</div>
                <h2>Tarlayı Sil</h2>
                <p>
                    <strong>{{ fieldToDelete?.name }}</strong> tarlanızı silmek istediğinize emin misiniz?
                </p>
                <p class="warning-text">
                    Bu işlem geri alınamaz. Tarlaya ait tüm hasat kayıtları da etkilenebilir.
                </p>
                
                <div v-if="fieldsStore.error" class="error-message">
                    {{ fieldsStore.error }}
                </div>

                <div class="modal-actions">
                    <button 
                        class="btn-secondary" 
                        @click="closeDeleteModal"
                        :disabled="isDeleting"
                    >
                        İptal
                    </button>
                    <button 
                        class="btn-danger" 
                        @click="confirmDelete"
                        :disabled="isDeleting"
                    >
                        {{ isDeleting ? 'Siliniyor...' : 'Evet, Sil' }}
                    </button>
                </div>
            </div>
        </div>
        </div>
    </AppLayout>
</template>

<style scoped>
.fields-page {
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
    color: white;
    margin: 0;
}

.subtitle {
    color: #9ca3af;
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
    transition: transform 0.2s, box-shadow 0.2s;
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.filters {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
}

.search-input {
    flex: 1;
    padding: 12px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 10px;
    font-size: 14px;
    transition: border-color 0.2s;
}

.search-input:focus {
    outline: none;
    border-color: #10b981;
}

.filter-select {
    padding: 12px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 10px;
    font-size: 14px;
    background: white;
    min-width: 150px;
}

.fields-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
}

.field-card {
    background: white;
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    border: 2px solid transparent;
}

.field-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    border-color: #10b981;
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
}

.field-name {
    font-size: 18px;
    font-weight: 600;
    color: #1a1a2e;
    margin: 0;
}

.area-badge {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
}

.card-body {
    margin-bottom: 16px;
}

.location {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #374151;
    font-weight: 500;
    margin-bottom: 4px;
}

.neighborhood {
    color: #9ca3af;
    font-size: 14px;
    padding-left: 24px;
}

.card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 16px;
    border-top: 1px solid #f3f4f6;
}

.partners {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #6b7280;
    font-size: 14px;
}

.actions {
    display: flex;
    gap: 8px;
}

.btn-icon {
    background: transparent;
    border: none;
    font-size: 16px;
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    transition: background 0.2s;
}

.btn-icon:hover {
    background: #f3f4f6;
}

.btn-icon-danger:hover {
    background: #fef2f2;
}

.loading {
    text-align: center;
    padding: 60px;
    color: #d1d5db;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #e5e7eb;
    border-top-color: #10b981;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 16px;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.empty-state {
    text-align: center;
    padding: 60px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.empty-icon {
    font-size: 64px;
    margin-bottom: 16px;
}

.empty-state h3 {
    color: white;
    margin: 0 0 8px 0;
}

.empty-state p {
    color: #9ca3af;
    margin: 0 0 24px 0;
}

.error-message {
    background: #fef2f2;
    color: #dc2626;
    padding: 16px;
    border-radius: 12px;
    text-align: center;
}

/* Modal Styles */
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
    backdrop-filter: blur(4px);
}

.modal-content {
    background: white;
    padding: 32px;
    border-radius: 20px;
    max-width: 420px;
    width: 90%;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    animation: modalFadeIn 0.2s ease-out;
}

@keyframes modalFadeIn {
    from {
        opacity: 0;
        transform: scale(0.95);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}

.modal-icon {
    font-size: 48px;
    margin-bottom: 16px;
}

.modal-content h2 {
    margin: 0 0 16px 0;
    color: #1a1a2e;
    font-size: 20px;
}

.modal-content p {
    color: #4b5563;
    margin: 0 0 12px 0;
}

.warning-text {
    color: #92400e;
    background: #fef3c7;
    padding: 12px;
    border-radius: 8px;
    font-size: 14px;
    margin-bottom: 20px !important;
}

.modal-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-top: 20px;
}

.btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: none;
    padding: 12px 24px;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}

.btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
}

.btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-danger {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
}

.btn-danger:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

.btn-danger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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

    .fields-grid {
        grid-template-columns: 1fr;
    }
}
</style>
