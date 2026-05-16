<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import AppLayout from '@/layouts/AppLayout.vue';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';
import { useFirmsStore } from '@/stores/firmsStore';
import { api, type Firm } from '@/services/api';

const firmsStore = useFirmsStore();

const searchQuery = ref('');
const showCreateForm = ref(false);
const isSubmitting = ref(false);
const isUploadingLogo = ref(false);
const formError = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const editTarget = ref<Firm | null>(null);
const deleteTarget = ref<Firm | null>(null);
const showDeleteConfirm = ref(false);

const firmForm = ref({
    name: '',
    description: '',
    logoUrl: '',
    phone: '',
    email: '',
    address: '',
    isActive: true,
});

const filteredFirms = computed(() => {
    const query = searchQuery.value.trim().toLowerCase();
    if (!query) return firmsStore.firms;

    return firmsStore.firms.filter((firm) =>
        firm.name.toLowerCase().includes(query) ||
        firm.description?.toLowerCase().includes(query) ||
        firm.phone?.toLowerCase().includes(query) ||
        firm.email?.toLowerCase().includes(query)
    );
});

const activeFirmCount = computed(() => firmsStore.firms.filter((firm) => firm.isActive).length);

function resetForm() {
    firmForm.value = {
        name: '',
        description: '',
        logoUrl: '',
        phone: '',
        email: '',
        address: '',
        isActive: true,
    };
    formError.value = null;
}

function openCreateForm() {
    resetForm();
    showCreateForm.value = true;
}

function openEditForm(firm: Firm) {
    editTarget.value = firm;
    firmForm.value = {
        name: firm.name,
        description: firm.description || '',
        logoUrl: firm.logoUrl || '',
        phone: firm.phone || '',
        email: firm.email || '',
        address: firm.address || '',
        isActive: firm.isActive,
    };
    formError.value = null;
    showCreateForm.value = true;
}

function closeCreateForm() {
    showCreateForm.value = false;
    editTarget.value = null;
    resetForm();
}

function showSuccess(message: string) {
    successMessage.value = message;
    window.setTimeout(() => {
        successMessage.value = null;
    }, 3000);
}

async function saveFirm() {
    const name = firmForm.value.name.trim();
    if (!name) {
        formError.value = 'Firma adi zorunludur';
        return;
    }

    isSubmitting.value = true;
    formError.value = null;

    const payload: Partial<Firm> = {
        name,
        description: firmForm.value.description.trim() || null,
        logoUrl: firmForm.value.logoUrl.trim() || null,
        phone: firmForm.value.phone.trim() || null,
        email: firmForm.value.email.trim() || null,
        address: firmForm.value.address.trim() || null,
        isActive: firmForm.value.isActive,
    };

    const wasEditing = !!editTarget.value;
    const success = editTarget.value
        ? await firmsStore.updateFirm(editTarget.value.id, payload)
        : await firmsStore.createFirm(payload);
    isSubmitting.value = false;

    if (success) {
        closeCreateForm();
        showSuccess(wasEditing ? 'Firma güncellendi' : 'Firma eklendi');
        return;
    }

    formError.value = firmsStore.error || 'Firma kaydedilemedi';
}

async function uploadLogo(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        formError.value = 'Logo icin bir gorsel dosyasi secin';
        input.value = '';
        return;
    }

    isUploadingLogo.value = true;
    formError.value = null;

    const response = await api.uploadImage(file);
    isUploadingLogo.value = false;
    input.value = '';

    if (response.data?.url) {
        firmForm.value.logoUrl = response.data.url;
        return;
    }

    formError.value = response.error?.message || 'Logo yüklenemedi';
}

function clearLogo() {
    firmForm.value.logoUrl = '';
}

function confirmDeleteFirm(firm: Firm) {
    deleteTarget.value = firm;
    showDeleteConfirm.value = true;
}

async function deleteFirm() {
    if (!deleteTarget.value) return;

    const firmName = deleteTarget.value.name;
    const success = await firmsStore.deleteFirm(deleteTarget.value.id);
    deleteTarget.value = null;

    if (success) {
        showSuccess(`${firmName} kaldirildi`);
    }
}

function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

onMounted(() => {
    firmsStore.fetchFirms();
});
</script>

<template>
    <AppLayout>
        <div class="admin-firms-page">
            <Transition name="toast">
                <div v-if="successMessage" class="toast-success">
                    {{ successMessage }}
                </div>
            </Transition>

            <header class="page-header">
                <div>
                    <div class="breadcrumb">
                        <RouterLink to="/admin" class="breadcrumb-link">Admin Panel</RouterLink>
                        <span class="breadcrumb-separator">/</span>
                        <span class="breadcrumb-current">Firmalar</span>
                    </div>
                    <h1>Firma Yonetimi</h1>
                    <p>{{ firmsStore.firmCount }} firma, {{ activeFirmCount }} aktif</p>
                </div>
                <button class="btn-primary" type="button" @click="openCreateForm">
                    Firma Ekle
                </button>
            </header>

            <div class="toolbar">
                <div class="search-box">
                    <input
                        v-model="searchQuery"
                        class="search-input"
                        type="search"
                        placeholder="Firma ara..."
                    />
                </div>
            </div>

            <div v-if="firmsStore.isLoading && !showCreateForm" class="loading-state">
                <div class="spinner"></div>
                <p>Firmalar yükleniyor...</p>
            </div>

            <div v-else class="firms-table">
                <div class="table-header">
                    <span>Firma</span>
                    <span>Iletisim</span>
                    <span>Durum</span>
                    <span>Kayit</span>
                    <span>Islemler</span>
                </div>

                <div v-for="firm in filteredFirms" :key="firm.id" class="table-row">
                    <div class="firm-cell">
                        <div class="firm-identity">
                            <img v-if="firm.logoUrl" :src="firm.logoUrl" :alt="`${firm.name} logosu`" class="firm-logo" />
                            <div v-else class="firm-logo-placeholder">{{ firm.name.charAt(0).toUpperCase() }}</div>
                            <div class="firm-copy">
                                <strong>{{ firm.name }}</strong>
                                <span>{{ firm.description || 'Açıklama yok' }}</span>
                            </div>
                        </div>
                    </div>
                    <div class="contact-cell">
                        <span>{{ firm.phone || '-' }}</span>
                        <span>{{ firm.email || '-' }}</span>
                    </div>
                    <span :class="['status-pill', firm.isActive ? 'status-active' : 'status-passive']">
                        {{ firm.isActive ? 'Aktif' : 'Pasif' }}
                    </span>
                    <span class="date-cell">{{ formatDate(firm.createdAt) }}</span>
                    <div class="actions-cell">
                        <RouterLink class="btn-secondary" :to="`/tea/firms/${firm.id}`">
                            Detay
                        </RouterLink>
                        <button class="btn-secondary" type="button" @click="openEditForm(firm)">
                            Duzenle
                        </button>
                        <button class="btn-danger" type="button" title="Firmayı kaldır" @click="confirmDeleteFirm(firm)">
                            Kaldır
                        </button>
                    </div>
                </div>

                <div v-if="filteredFirms.length === 0" class="empty-state">
                    Firma bulunamadi
                </div>
            </div>

            <p v-if="firmsStore.error && !showCreateForm" class="error-message">
                {{ firmsStore.error }}
            </p>

            <div v-if="showCreateForm" class="modal-overlay" @click.self="closeCreateForm">
                <form class="modal" @submit.prevent="saveFirm">
                    <div class="modal-header">
                        <h2>{{ editTarget ? 'Firmayı Düzenle' : 'Yeni Firma' }}</h2>
                        <button type="button" class="close-btn" @click="closeCreateForm">Kapat</button>
                    </div>

                    <div v-if="formError" class="form-error">{{ formError }}</div>

                    <label class="form-field">
                        <span>Firma adi *</span>
                        <input v-model="firmForm.name" maxlength="150" type="text" required />
                    </label>

                    <label class="form-field">
                        <span>Açıklama</span>
                        <textarea v-model="firmForm.description" maxlength="2000" rows="3"></textarea>
                    </label>

                    <label class="form-field">
                        <span>Logo yolu</span>
                        <input v-model="firmForm.logoUrl" maxlength="255" type="text" placeholder="https://cdn.example.com/..." />
                    </label>

                    <div class="logo-upload-row">
                        <label class="btn-secondary logo-upload-btn">
                            <input type="file" accept="image/*" :disabled="isUploadingLogo" @change="uploadLogo" />
                            {{ isUploadingLogo ? 'Yukleniyor...' : 'Logo Yukle' }}
                        </label>
                        <button v-if="firmForm.logoUrl" type="button" class="btn-secondary" @click="clearLogo">
                            Logoyu Kaldır
                        </button>
                    </div>

                    <div v-if="firmForm.logoUrl" class="logo-preview">
                        <img :src="firmForm.logoUrl" alt="Logo onizleme" />
                        <span>Logo onizleme</span>
                    </div>

                    <div class="form-row">
                        <label class="form-field">
                            <span>Telefon</span>
                            <input v-model="firmForm.phone" maxlength="20" type="tel" />
                        </label>
                        <label class="form-field">
                            <span>E-posta</span>
                            <input v-model="firmForm.email" maxlength="255" type="email" />
                        </label>
                    </div>

                    <label class="form-field">
                        <span>Adres</span>
                        <input v-model="firmForm.address" maxlength="500" type="text" />
                    </label>

                    <label class="toggle-field">
                        <input v-model="firmForm.isActive" type="checkbox" />
                        <span>Aktif firma</span>
                    </label>

                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" @click="closeCreateForm">
                            Vazgec
                        </button>
                        <button type="submit" class="btn-primary" :disabled="isSubmitting">
                            {{ isSubmitting ? 'Kaydediliyor...' : 'Kaydet' }}
                        </button>
                    </div>
                </form>
            </div>

            <ConfirmModal
                v-model="showDeleteConfirm"
                title="Firmayı Kaldır"
                :message="`${deleteTarget?.name || ''} firmasini kalici olarak kaldirmak istediginize emin misiniz?`"
                confirm-text="Kaldır"
                cancel-text="Vazgec"
                variant="danger"
                @confirm="deleteFirm"
            />
        </div>
    </AppLayout>
</template>

<style scoped>
.admin-firms-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
}

.page-header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    margin-bottom: 24px;
}

.breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 14px;
}

.breadcrumb-link {
    color: var(--color-primary);
    text-decoration: none;
}

.breadcrumb-separator,
.breadcrumb-current,
.page-header p {
    color: var(--color-text-muted);
}

.page-header h1 {
    margin: 0 0 6px;
    font-size: 28px;
    color: var(--color-text-primary);
}

.toolbar {
    margin-bottom: 20px;
}

.search-box {
    max-width: 420px;
}

.search-input,
.form-field input,
.form-field textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 12px 14px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-text-primary);
    font: inherit;
}

.search-input:focus,
.form-field input:focus,
.form-field textarea:focus {
    outline: none;
    border-color: var(--color-primary);
}

.firms-table {
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-secondary);
}

.table-header,
.table-row {
    display: grid;
    grid-template-columns: minmax(220px, 2fr) minmax(180px, 1.4fr) 100px 120px 160px;
    gap: 16px;
    align-items: center;
    padding: 14px 18px;
}

.table-header {
    background: var(--color-bg-tertiary);
    color: var(--color-text-muted);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
}

.table-row {
    border-top: 1px solid var(--color-border);
}

.firm-cell,
.contact-cell {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 4px;
}

.firm-identity {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 12px;
}

.firm-logo,
.firm-logo-placeholder {
    width: 42px;
    height: 42px;
    flex: 0 0 42px;
    border-radius: 8px;
}

.firm-logo {
    object-fit: contain;
    background: #fff;
    border: 1px solid var(--color-border);
}

.firm-logo-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary);
    color: #fff;
    font-weight: 800;
}

.firm-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 4px;
}

.firm-cell strong {
    color: var(--color-text-primary);
}

.firm-cell span,
.contact-cell span,
.date-cell {
    overflow: hidden;
    color: var(--color-text-muted);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.status-pill {
    width: max-content;
    padding: 5px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
}

.status-active {
    background: rgba(16, 185, 129, 0.14);
    color: var(--color-primary);
}

.status-passive {
    background: rgba(148, 163, 184, 0.16);
    color: var(--color-text-secondary);
}

.actions-cell {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.btn-primary,
.btn-secondary,
.btn-danger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 38px;
    padding: 9px 14px;
    border: 1px solid transparent;
    border-radius: 8px;
    font-weight: 700;
    font-size: 14px;
    line-height: 1;
    text-decoration: none;
    cursor: pointer;
}

.btn-primary {
    background: var(--color-primary);
    color: #fff;
}

.btn-primary:disabled {
    cursor: not-allowed;
    opacity: 0.6;
}

.btn-secondary {
    background: var(--color-bg-tertiary);
    border-color: var(--color-border);
    color: var(--color-text-secondary);
}

.btn-danger {
    background: rgba(239, 68, 68, 0.14);
    color: var(--color-danger);
}

.loading-state,
.empty-state {
    padding: 48px;
    text-align: center;
    color: var(--color-text-muted);
}

.spinner {
    width: 36px;
    height: 36px;
    margin: 0 auto 12px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(0, 0, 0, 0.58);
}

.modal {
    width: min(620px, 100%);
    max-height: 90vh;
    overflow-y: auto;
    padding: 22px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-secondary);
}

.modal-header,
.modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.modal-header {
    margin-bottom: 20px;
}

.modal-header h2 {
    margin: 0;
    color: var(--color-text-primary);
}

.close-btn {
    border: 0;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
}

.form-field {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin-bottom: 14px;
    color: var(--color-text-secondary);
    font-size: 13px;
    font-weight: 700;
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
}

.toggle-field {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6px 0 20px;
    color: var(--color-text-secondary);
    font-weight: 700;
}

.toggle-field input {
    width: 16px;
    height: 16px;
    accent-color: var(--color-primary);
}

.logo-preview {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: -4px 0 14px;
    padding: 10px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-text-muted);
    font-size: 13px;
}

.logo-upload-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: -2px 0 14px;
}

.logo-upload-btn {
    position: relative;
    overflow: hidden;
}

.logo-upload-btn input {
    position: absolute;
    inset: 0;
    cursor: pointer;
    opacity: 0;
}

.logo-upload-btn:has(input:disabled) {
    cursor: not-allowed;
    opacity: 0.65;
}

.logo-preview img {
    width: 52px;
    height: 52px;
    object-fit: contain;
    border-radius: 8px;
    background: #fff;
}

.form-error,
.error-message {
    padding: 12px 14px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.12);
    color: var(--color-danger);
}

.form-error {
    margin-bottom: 14px;
}

.toast-success {
    position: fixed;
    top: 24px;
    right: 24px;
    z-index: 1001;
    padding: 12px 16px;
    border-radius: 8px;
    background: var(--color-success);
    color: #fff;
    font-weight: 700;
}

.toast-enter-active,
.toast-leave-active {
    transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
    opacity: 0;
    transform: translateY(-8px);
}

@media (max-width: 900px) {
    .page-header {
        flex-direction: column;
    }

    .table-header {
        display: none;
    }

    .table-row {
        grid-template-columns: 1fr;
        gap: 10px;
    }

    .actions-cell {
        flex-wrap: wrap;
    }
}

@media (max-width: 640px) {
    .admin-firms-page {
        padding: 16px;
    }

    .form-row {
        grid-template-columns: 1fr;
    }

    .modal-footer {
        flex-direction: column-reverse;
    }

    .modal-footer button {
        width: 100%;
    }
}
</style>
