<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useFieldsStore } from '@/stores/fieldsStore';
import { useToast } from '@/composables/useToast';
import type { Field } from '@/services/api';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import AppSelect from '@/components/ui/AppSelect.vue';

const router = useRouter();
const fieldsStore = useFieldsStore();
const toast = useToast();

const searchQuery = ref('');
const provinceFilter = ref('');

// Delete modal state
const showDeleteModal = ref(false);
const fieldToDelete = ref<Field | null>(null);
const isDeleting = ref(false);

// View mode
const viewMode = ref<'grid' | 'list'>('grid');

const provinces = ['Rize', 'Trabzon', 'Artvin', 'Giresun', 'Ordu'];

const provinceOptions = computed(() => [
    { value: '', label: 'Tüm İller' },
    ...provinces.map(p => ({ value: p, label: p }))
]);

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

const totalArea = computed(() => {
    return fieldsStore.fields.reduce((sum, f) => {
        if (f.areaUnit === 'm2') return sum + f.area;
        return sum + f.area * 1000;
    }, 0);
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
    router.push(`/tea/fields/${id}/edit`);
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
        'donum': 'donum',
        'dekar': 'dekar',
        'm2': 'm\u00B2'
    };
    return `${formatted} ${unitLabels[unit] || unit}`;
}

function formatTotalArea(area: number) {
    if (area >= 10000) {
        return (area / 10000).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' ha';
    }
    return area.toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' m\u00B2';
}

function getFieldInitial(name: string) {
    return name.charAt(0).toUpperCase();
}
</script>

<template>
    <TeaBusinessLayout>
        <div class="fields-page">
            <!-- Header -->
            <header class="page-header">
                <div class="header-left">
                    <h1>Tarlalarım</h1>
                    <div class="header-stats">
                        <span class="stat-chip">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            {{ fieldsStore.fieldCount }} tarla
                        </span>
                        <span v-if="totalArea > 0" class="stat-chip">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                            {{ formatTotalArea(totalArea) }}
                        </span>
                    </div>
                </div>
                <button class="btn-create" @click="navigateToCreateParams">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Yeni Tarla Ekle
                </button>
            </header>

            <!-- Toolbar -->
            <div class="toolbar">
                <div class="search-wrap">
                    <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Tarla ara..."
                        class="search-input"
                    />
                    <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="toolbar-right">
                    <AppSelect
                        v-model="provinceFilter"
                        :options="provinceOptions"
                        placeholder="İl Seçin"
                    />
                    <div class="view-toggle">
                        <button
                            class="view-btn"
                            :class="{ active: viewMode === 'grid' }"
                            @click="viewMode = 'grid'"
                            title="Izgara gorunumu"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                        </button>
                        <button
                            class="view-btn"
                            :class="{ active: viewMode === 'list' }"
                            @click="viewMode = 'list'"
                            title="Liste gorunumu"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Loading -->
            <div v-if="fieldsStore.isLoading" class="loading-state">
                <div class="spinner"></div>
                <p>Tarlalar yükleniyor...</p>
            </div>

            <!-- Error -->
            <div v-else-if="fieldsStore.error" class="error-state">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {{ fieldsStore.error }}
            </div>

            <!-- Empty -->
            <div v-else-if="filteredFields.length === 0" class="empty-state">
                <div class="empty-illustration">
                    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <h3>Henüz tarla eklenmedi</h3>
                <p>Ilk tarlanizi ekleyerek baslayin</p>
                <button class="btn-create btn-create--sm" @click="navigateToCreateParams">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Tarla Ekle
                </button>
            </div>

            <!-- Grid View -->
            <div v-else-if="viewMode === 'grid'" class="fields-grid">
                <div
                    v-for="field in filteredFields"
                    :key="field.id"
                    class="field-card"
                    @click="navigateToField(field.id)"
                >
                    <!-- Card Top Accent -->
                    <div class="card-accent"></div>

                    <div class="card-content">
                        <div class="card-top">
                            <div class="field-avatar">
                                {{ getFieldInitial(field.name) }}
                            </div>
                            <div class="field-title-wrap">
                                <h3 class="field-name">{{ field.name }}</h3>
                                <span class="field-location">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                    {{ field.province }} / {{ field.district }}
                                </span>
                            </div>
                            <span class="area-tag">{{ formatArea(field.area, field.areaUnit) }}</span>
                        </div>

                        <div class="card-meta">
                            <span class="meta-item">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/></svg>
                                {{ field.neighborhood }}
                            </span>
                            <span v-if="field.partnerCount > 1" class="meta-item">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                {{ field.partnerCount }} ortak
                            </span>
                            <span v-if="field.parcelNo" class="meta-item">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                                {{ field.parcelNo }}
                            </span>
                        </div>

                        <div class="card-actions">
                            <button
                                class="action-btn"
                                title="Duzenle"
                                @click="navigateToEdit(field.id, $event)"
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button
                                class="action-btn action-btn--danger"
                                title="Sil"
                                @click="openDeleteModal(field, $event)"
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- List View -->
            <div v-else class="fields-list">
                <div class="list-header">
                    <span class="lh-name">Tarla Adı</span>
                    <span class="lh-location">Konum</span>
                    <span class="lh-area">Alan</span>
                    <span class="lh-partners">Ortaklar</span>
                    <span class="lh-actions"></span>
                </div>
                <div
                    v-for="field in filteredFields"
                    :key="field.id"
                    class="list-row"
                    @click="navigateToField(field.id)"
                >
                    <div class="lr-name">
                        <div class="field-avatar field-avatar--sm">
                            {{ getFieldInitial(field.name) }}
                        </div>
                        <span>{{ field.name }}</span>
                    </div>
                    <div class="lr-location">
                        <span class="lr-location-main">{{ field.province }} / {{ field.district }}</span>
                        <span class="lr-location-sub">{{ field.neighborhood }}</span>
                    </div>
                    <div class="lr-area">
                        <span class="area-tag area-tag--sm">{{ formatArea(field.area, field.areaUnit) }}</span>
                    </div>
                    <div class="lr-partners">
                        <span v-if="field.partnerCount > 1">{{ field.partnerCount }} ortak</span>
                        <span v-else class="text-muted">-</span>
                    </div>
                    <div class="lr-actions">
                        <button class="action-btn" title="Duzenle" @click="navigateToEdit(field.id, $event)">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="action-btn action-btn--danger" title="Sil" @click="openDeleteModal(field, $event)">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Filter result info -->
            <div v-if="!fieldsStore.isLoading && searchQuery && filteredFields.length > 0" class="result-info">
                "{{ searchQuery }}" icin {{ filteredFields.length }} sonuc bulundu
            </div>

            <!-- Delete Modal -->
            <Teleport to="body">
                <Transition name="modal">
                    <div v-if="showDeleteModal" class="modal-overlay" @click.self="closeDeleteModal">
                        <div class="modal-card">
                            <div class="modal-icon-wrap">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            </div>
                            <h2>Tarlayı Sil</h2>
                            <p>
                                <strong>{{ fieldToDelete?.name }}</strong> tarlanizi silmek istediginize emin misiniz?
                            </p>
                            <div class="modal-warning">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                                Bu işlem geri alınamaz. Tarlaya ait tüm hasat kayıtları da etkilenebilir.
                            </div>

                            <div v-if="fieldsStore.error" class="modal-error">
                                {{ fieldsStore.error }}
                            </div>

                            <div class="modal-actions">
                                <button class="btn-modal-cancel" @click="closeDeleteModal" :disabled="isDeleting">
                                    İptal
                                </button>
                                <button class="btn-modal-danger" @click="confirmDelete" :disabled="isDeleting">
                                    <span v-if="isDeleting" class="spinner-sm"></span>
                                    {{ isDeleting ? 'Siliniyor...' : 'Evet, Sil' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </Transition>
            </Teleport>
        </div>
    </TeaBusinessLayout>
</template>

<style scoped>
.fields-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--space-6);
}

/* ── Header ── */
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--space-5);
}

.header-left h1 {
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
    margin-bottom: var(--space-2);
}

.header-stats {
    display: flex;
    gap: var(--space-3);
}

.stat-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    padding: 3px 10px;
    border-radius: var(--radius-full);
}

.btn-create {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--color-primary);
    color: white;
    border: none;
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-lg);
    font-weight: var(--font-weight-semibold);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
    flex-shrink: 0;
}

.btn-create:hover {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
}

.btn-create--sm {
    padding: var(--space-2) var(--space-4);
}

/* ── Toolbar ── */
.toolbar {
    display: flex;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
    align-items: center;
}

.search-wrap {
    position: relative;
    flex: 1;
    max-width: 320px;
}

.search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-text-muted);
    pointer-events: none;
}

.search-input {
    width: 100%;
    height: var(--control-height);
    padding: 0 var(--space-4) 0 40px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
    font-family: var(--font-family);
    transition: all var(--transition-fast);
}

.search-input::placeholder {
    color: var(--color-text-muted);
}

.search-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
}

.search-clear {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: var(--color-bg-tertiary);
    border: none;
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.search-clear:hover {
    background: var(--color-border);
    color: var(--color-text-primary);
}

.toolbar-right {
    display: flex;
    gap: var(--space-3);
    align-items: center;
}

.view-toggle {
    display: flex;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
}

.view-btn {
    background: none;
    border: none;
    padding: var(--space-2) var(--space-3);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
}

.view-btn.active {
    background: var(--color-bg-tertiary);
    color: var(--color-primary);
}

.view-btn:hover:not(.active) {
    color: var(--color-text-secondary);
}

/* ── Grid View ── */
.fields-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: var(--space-4);
}

.field-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    cursor: pointer;
    transition: all var(--transition-fast);
    overflow: hidden;
    position: relative;
}

.field-card:hover {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary), var(--shadow-lg);
    transform: translateY(-2px);
}

.card-accent {
    height: 3px;
    background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));
    opacity: 0;
    transition: opacity var(--transition-fast);
}

.field-card:hover .card-accent {
    opacity: 1;
}

.card-content {
    padding: var(--space-5);
}

.card-top {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
}

.field-avatar {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-lg);
    background: var(--color-primary-light);
    color: var(--color-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: var(--font-weight-bold);
    font-size: var(--font-size-base);
    flex-shrink: 0;
}

.field-avatar--sm {
    width: 32px;
    height: 32px;
    font-size: var(--font-size-sm);
}

.field-title-wrap {
    flex: 1;
    min-width: 0;
}

.field-name {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.field-location {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
}

.area-tag {
    background: var(--color-primary);
    color: white;
    padding: 3px 10px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: var(--font-weight-semibold);
    white-space: nowrap;
    flex-shrink: 0;
}

.area-tag--sm {
    padding: 2px 8px;
    font-size: 10px;
}

.card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
    padding-bottom: var(--space-4);
    border-bottom: 1px solid var(--color-border);
}

.meta-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
}

.card-actions {
    display: flex;
    gap: var(--space-2);
}

.action-btn {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-tertiary);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.action-btn:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
    background: var(--color-primary-light);
}

.action-btn--danger:hover {
    color: var(--color-danger);
    border-color: var(--color-danger);
    background: rgba(239, 68, 68, 0.1);
}

/* ── List View ── */
.fields-list {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
}

.list-header {
    display: grid;
    grid-template-columns: 2fr 2fr 1fr 1fr 80px;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-5);
    background: var(--color-bg-primary);
    border-bottom: 1px solid var(--color-border);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.list-row {
    display: grid;
    grid-template-columns: 2fr 2fr 1fr 1fr 80px;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    align-items: center;
    border-bottom: 1px solid var(--color-border);
    cursor: pointer;
    transition: background var(--transition-fast);
}

.list-row:last-child {
    border-bottom: none;
}

.list-row:hover {
    background: rgba(16, 185, 129, 0.04);
}

.lr-name {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-primary);
    min-width: 0;
}

.lr-name span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.lr-location {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
}

.lr-location-main {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
}

.lr-location-sub {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
}

.lr-area {
    display: flex;
    align-items: center;
}

.lr-partners {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
}

.text-muted {
    color: var(--color-text-muted);
}

.lr-actions {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
}

/* ── States ── */
.loading-state {
    text-align: center;
    padding: var(--space-16);
    color: var(--color-text-muted);
}

.spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto var(--space-4);
}

.spinner-sm {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    margin-right: var(--space-2);
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.error-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-8);
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.15);
    border-radius: var(--radius-xl);
    color: var(--color-danger);
    font-size: var(--font-size-sm);
}

.empty-state {
    text-align: center;
    padding: var(--space-16);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
}

.empty-illustration {
    margin-bottom: var(--space-4);
    opacity: 0.5;
}

.empty-state h3 {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    margin-bottom: var(--space-2);
}

.empty-state p {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    margin-bottom: var(--space-6);
}

.result-info {
    text-align: center;
    padding: var(--space-4);
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
}

/* ── Modal ── */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal);
    backdrop-filter: blur(4px);
}

.modal-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: var(--space-8);
    max-width: 420px;
    width: 90%;
    text-align: center;
    box-shadow: var(--shadow-xl);
}

.modal-icon-wrap {
    width: 56px;
    height: 56px;
    border-radius: var(--radius-full);
    background: rgba(239, 68, 68, 0.1);
    color: var(--color-danger);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto var(--space-4);
}

.modal-card h2 {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
    margin-bottom: var(--space-3);
}

.modal-card p {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    margin-bottom: var(--space-4);
    line-height: var(--line-height-relaxed);
}

.modal-warning {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    background: rgba(245, 158, 11, 0.1);
    border-radius: var(--radius-md);
    color: var(--color-warning);
    font-size: var(--font-size-xs);
    margin-bottom: var(--space-5);
    text-align: left;
}

.modal-error {
    padding: var(--space-3);
    background: rgba(239, 68, 68, 0.1);
    border-radius: var(--radius-md);
    color: var(--color-danger);
    font-size: var(--font-size-sm);
    margin-bottom: var(--space-4);
}

.modal-actions {
    display: flex;
    gap: var(--space-3);
    justify-content: center;
}

.btn-modal-cancel {
    padding: var(--space-3) var(--space-6);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    color: var(--color-text-secondary);
    font-weight: var(--font-weight-medium);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.btn-modal-cancel:hover:not(:disabled) {
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
}

.btn-modal-danger {
    display: inline-flex;
    align-items: center;
    padding: var(--space-3) var(--space-6);
    background: var(--color-danger);
    border: none;
    border-radius: var(--radius-lg);
    color: white;
    font-weight: var(--font-weight-semibold);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.btn-modal-danger:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.35);
}

.btn-modal-danger:disabled,
.btn-modal-cancel:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Modal Transition */
.modal-enter-active {
    transition: opacity 0.2s ease;
}
.modal-enter-active .modal-card {
    transition: transform 0.2s ease, opacity 0.2s ease;
}
.modal-leave-active {
    transition: opacity 0.15s ease;
}
.modal-leave-active .modal-card {
    transition: transform 0.15s ease, opacity 0.15s ease;
}
.modal-enter-from {
    opacity: 0;
}
.modal-enter-from .modal-card {
    transform: scale(0.95);
    opacity: 0;
}
.modal-leave-to {
    opacity: 0;
}
.modal-leave-to .modal-card {
    transform: scale(0.95);
    opacity: 0;
}

/* ── Responsive ── */
@media (max-width: 1024px) {
    .list-header,
    .list-row {
        grid-template-columns: 2fr 2fr 1fr 80px;
    }
    .lh-partners,
    .lr-partners {
        display: none;
    }
}

@media (max-width: 768px) {
    .fields-page {
        padding: var(--space-4);
    }

    .page-header {
        flex-direction: column;
        gap: var(--space-4);
        align-items: flex-start;
    }

    .btn-create {
        width: 100%;
        justify-content: center;
    }

    .toolbar {
        flex-direction: row;
        gap: var(--space-3);
        align-items: stretch;
    }

    .search-wrap {
        flex: 1 1 0;
        min-width: 0;
        max-width: 100%;
    }

    .toolbar-right {
        flex: 0 0 140px;
        min-width: 0;
        justify-content: flex-end;
    }

    .fields-grid {
        grid-template-columns: 1fr;
    }

    .view-toggle {
        display: none;
    }

    .list-header {
        display: none;
    }

    .list-row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        padding: var(--space-4);
    }

    .lr-name {
        flex: 1 1 100%;
    }

    .lr-location {
        flex: 1;
    }

    .lr-area {
        flex-shrink: 0;
    }

    .lr-partners {
        display: none;
    }

    .lr-actions {
        flex: 0 0 auto;
    }
}
</style>
