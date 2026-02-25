<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useFirmsStore } from '@/stores/firmsStore';
import AppLayout from '@/layouts/AppLayout.vue';

const firmsStore = useFirmsStore();
const router = useRouter();
const searchQuery = ref('');

// Modal state
const showAddModal = ref(false);
const isSaving = ref(false);
const formError = ref<string | null>(null);
const successMessage = ref<string | null>(null);

const firmForm = ref({
    name: '',
    description: '',
    phone: '',
    email: '',
    address: '',
    isActive: true,
});

const qualityLabels: Record<string, string> = {
    'shoot': 'Surgun',
    'leaf': 'Yaprak',
    'mixed': 'Karisik'
};

const filteredFirms = computed(() => {
    if (!searchQuery.value) return firmsStore.firms;
    const q = searchQuery.value.toLowerCase();
    return firmsStore.firms.filter(f =>
        f.name.toLowerCase().includes(q) ||
        (f.description && f.description.toLowerCase().includes(q))
    );
});

function navigateToFirm(id: string) {
    router.push(`/firms/${id}`);
}

function getInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function openAddModal() {
    firmForm.value = {
        name: '',
        description: '',
        phone: '',
        email: '',
        address: '',
        isActive: true,
    };
    formError.value = null;
    showAddModal.value = true;
}

function closeAddModal() {
    showAddModal.value = false;
    formError.value = null;
}

async function handleCreateFirm() {
    if (!firmForm.value.name.trim()) {
        formError.value = 'Firma adi zorunludur';
        return;
    }

    isSaving.value = true;
    formError.value = null;

    const data: Record<string, unknown> = {
        name: firmForm.value.name.trim(),
        isActive: firmForm.value.isActive,
    };
    if (firmForm.value.description.trim()) data.description = firmForm.value.description.trim();
    if (firmForm.value.phone.trim()) data.phone = firmForm.value.phone.trim();
    if (firmForm.value.email.trim()) data.email = firmForm.value.email.trim();
    if (firmForm.value.address.trim()) data.address = firmForm.value.address.trim();

    const success = await firmsStore.createFirm(data);

    if (success) {
        closeAddModal();
        successMessage.value = 'Firma basariyla eklendi';
        setTimeout(() => { successMessage.value = null; }, 3000);
    } else {
        formError.value = firmsStore.error || 'Firma olusturulamadi';
    }

    isSaving.value = false;
}

onMounted(() => {
    firmsStore.fetchFirms();
});
</script>

<template>
    <AppLayout>
        <div class="firms-page">
            <!-- Toast -->
            <Transition name="toast">
                <div v-if="successMessage" class="toast-success">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {{ successMessage }}
                </div>
            </Transition>

            <header class="page-header">
                <div class="header-content">
                    <h1>Firmalar</h1>
                    <p class="subtitle">
                        Anlasmali {{ firmsStore.firmCount }} firma
                    </p>
                </div>
                <button class="btn-add" @click="openAddModal">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Firma Ekle
                </button>
            </header>

            <!-- Search -->
            <div class="search-wrap">
                <div class="search-box">
                    <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Firma ara..."
                        class="search-input"
                    />
                </div>
            </div>

            <!-- Loading -->
            <div v-if="firmsStore.isLoading && !showAddModal" class="loading">
                <div class="spinner"></div>
            </div>

            <!-- Empty -->
            <div v-else-if="filteredFirms.length === 0" class="empty-state">
                <div class="empty-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-text-muted)">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                </div>
                <h3>Henuz firma kaydedilmemis</h3>
                <p>Anlasmali firmalar burada listelenecektir</p>
                <button class="btn-add-empty" @click="openAddModal">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Ilk Firmayi Ekle
                </button>
            </div>

            <!-- Firms Grid -->
            <div v-else class="firms-grid">
                <div
                    v-for="firm in filteredFirms"
                    :key="firm.id"
                    class="firm-card"
                    @click="navigateToFirm(firm.id)"
                >
                    <div class="firm-card-header">
                        <div class="firm-avatar" :class="{ 'firm-avatar--inactive': !firm.isActive }">
                            {{ getInitials(firm.name) }}
                        </div>
                        <div class="firm-info">
                            <h3 class="firm-name">{{ firm.name }}</h3>
                            <p v-if="firm.description" class="firm-desc">{{ firm.description }}</p>
                        </div>
                        <span class="status-badge" :class="firm.isActive ? 'status-active' : 'status-inactive'">
                            {{ firm.isActive ? 'Aktif' : 'Pasif' }}
                        </span>
                    </div>

                    <div class="firm-card-body">
                        <div v-if="firm.phone" class="firm-detail">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
                            <span>{{ firm.phone }}</span>
                        </div>
                        <div v-if="firm.address" class="firm-detail">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                <circle cx="12" cy="10" r="3"/>
                            </svg>
                            <span>{{ firm.address }}</span>
                        </div>
                    </div>

                    <div class="firm-card-footer">
                        <span class="view-link">
                            Tarifeleri Gor
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
                        </span>
                    </div>
                </div>
            </div>

            <!-- Error -->
            <p v-if="firmsStore.error && !showAddModal" class="error-message">{{ firmsStore.error }}</p>

            <!-- ─── Add Firm Modal ─── -->
            <Transition name="modal">
                <div v-if="showAddModal" class="modal-overlay" @click.self="closeAddModal">
                    <div class="modal-container">
                        <div class="modal-header">
                            <h2>Yeni Firma Ekle</h2>
                            <button class="modal-close" @click="closeAddModal" aria-label="Kapat">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"/>
                                    <line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                            </button>
                        </div>

                        <form class="modal-body" @submit.prevent="handleCreateFirm">
                            <!-- Error Message -->
                            <div v-if="formError" class="form-error">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                {{ formError }}
                            </div>

                            <div class="form-group">
                                <label for="firm-name">Firma Adi <span class="required">*</span></label>
                                <input
                                    id="firm-name"
                                    v-model="firmForm.name"
                                    type="text"
                                    maxlength="150"
                                    placeholder="Ornegin: CAYKUR"
                                    class="form-input"
                                    :class="{ 'form-input--error': formError && !firmForm.name.trim() }"
                                />
                            </div>

                            <div class="form-group">
                                <label for="firm-desc">Aciklama</label>
                                <textarea
                                    id="firm-desc"
                                    v-model="firmForm.description"
                                    maxlength="2000"
                                    placeholder="Firma hakkinda kisa bilgi..."
                                    rows="3"
                                    class="form-input form-textarea"
                                ></textarea>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label for="firm-phone">Telefon</label>
                                    <input
                                        id="firm-phone"
                                        v-model="firmForm.phone"
                                        type="tel"
                                        maxlength="20"
                                        placeholder="0532 000 00 00"
                                        class="form-input"
                                    />
                                </div>
                                <div class="form-group">
                                    <label for="firm-email">E-posta</label>
                                    <input
                                        id="firm-email"
                                        v-model="firmForm.email"
                                        type="email"
                                        maxlength="255"
                                        placeholder="info@firma.com"
                                        class="form-input"
                                    />
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="firm-address">Adres</label>
                                <input
                                    id="firm-address"
                                    v-model="firmForm.address"
                                    type="text"
                                    maxlength="500"
                                    placeholder="Firma adresi"
                                    class="form-input"
                                />
                            </div>

                            <div class="form-group form-group--toggle">
                                <label for="firm-active">Durum</label>
                                <button
                                    id="firm-active"
                                    type="button"
                                    class="toggle-btn"
                                    :class="{ 'toggle-btn--active': firmForm.isActive }"
                                    @click="firmForm.isActive = !firmForm.isActive"
                                >
                                    <span class="toggle-knob"></span>
                                    <span class="toggle-label">{{ firmForm.isActive ? 'Aktif' : 'Pasif' }}</span>
                                </button>
                            </div>

                            <div class="modal-footer">
                                <button type="button" class="btn-cancel" @click="closeAddModal">Iptal</button>
                                <button type="submit" class="btn-save" :disabled="isSaving">
                                    <div v-if="isSaving" class="btn-spinner"></div>
                                    <template v-else>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                        Kaydet
                                    </template>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </Transition>
        </div>
    </AppLayout>
</template>

<style scoped>
.firms-page {
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

/* ── Add Button ── */
.btn-add {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(var(--color-primary-rgb, 0, 0, 0), 0.3);
}

.btn-add:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(var(--color-primary-rgb, 0, 0, 0), 0.4);
}

.btn-add:active {
    transform: translateY(0);
}

.btn-add-empty {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 16px;
    padding: 10px 20px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-add-empty:hover {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
}

/* ── Search ── */
.search-wrap {
    margin-bottom: 24px;
}

.search-box {
    position: relative;
    max-width: 400px;
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
    padding: 12px 12px 12px 42px;
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: 14px;
    color: var(--color-text-primary);
    transition: border-color var(--transition-fast);
}

.search-input:focus {
    outline: none;
    border-color: var(--color-primary);
}

.search-input::placeholder {
    color: var(--color-text-muted);
}

/* ── Grid ── */
.firms-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 16px;
}

/* ── Card ── */
.firm-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.firm-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
    border-color: var(--color-primary);
}

.firm-card-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 20px 20px 12px;
}

.firm-avatar {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-lg);
    background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
    flex-shrink: 0;
}

.firm-avatar--inactive {
    background: var(--color-bg-tertiary);
    color: var(--color-text-muted);
}

.firm-info {
    flex: 1;
    min-width: 0;
}

.firm-name {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0 0 4px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.firm-desc {
    font-size: 13px;
    color: var(--color-text-muted);
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.status-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    flex-shrink: 0;
}

.status-active {
    background: rgba(34, 197, 94, 0.15);
    color: var(--color-success);
}

.status-inactive {
    background: rgba(245, 158, 11, 0.15);
    color: var(--color-warning);
}

.firm-card-body {
    padding: 0 20px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.firm-detail {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--color-text-secondary);
}

.firm-detail svg {
    flex-shrink: 0;
    color: var(--color-text-muted);
}

.firm-card-footer {
    padding: 12px 20px;
    border-top: 1px solid var(--color-border);
    background: var(--color-bg-tertiary);
}

.view-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-primary);
    transition: gap var(--transition-fast);
}

.firm-card:hover .view-link {
    gap: 8px;
}

/* ── Toast ── */
.toast-success {
    position: fixed;
    top: 24px;
    right: 24px;
    z-index: 1001;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 20px;
    background: var(--color-success);
    color: white;
    border-radius: var(--radius-lg);
    font-weight: 600;
    font-size: 14px;
    box-shadow: 0 8px 24px rgba(34, 197, 94, 0.4);
}

.toast-enter-active,
.toast-leave-active {
    transition: all 0.3s ease;
}

.toast-enter-from {
    opacity: 0;
    transform: translateX(40px);
}

.toast-leave-to {
    opacity: 0;
    transform: translateY(-20px);
}

/* ── Modal ── */
.modal-overlay {
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

.modal-container {
    background: var(--color-bg-secondary);
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 540px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
    border: 1px solid var(--color-border);
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px 24px 0;
}

.modal-header h2 {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
}

.modal-close {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s;
}

.modal-close:hover {
    background: rgba(239, 68, 68, 0.1);
    color: var(--color-danger);
    border-color: var(--color-danger);
}

.modal-body {
    padding: 24px;
}

.modal-footer {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding-top: 24px;
    border-top: 1px solid var(--color-border);
    margin-top: 24px;
}

/* ── Form ── */
.form-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: rgba(239, 68, 68, 0.1);
    color: var(--color-danger);
    border-radius: var(--radius-md);
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 16px;
}

.form-group {
    margin-bottom: 16px;
}

.form-group label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin-bottom: 6px;
}

.required {
    color: var(--color-danger);
}

.form-input {
    width: 100%;
    padding: 11px 14px;
    background: var(--color-bg-primary);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 14px;
    color: var(--color-text-primary);
    transition: border-color 0.2s;
    box-sizing: border-box;
}

.form-input:focus {
    outline: none;
    border-color: var(--color-primary);
}

.form-input::placeholder {
    color: var(--color-text-muted);
}

.form-input--error {
    border-color: var(--color-danger);
}

.form-textarea {
    resize: vertical;
    min-height: 80px;
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

/* ── Toggle ── */
.form-group--toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.toggle-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
}

.toggle-knob {
    position: relative;
    width: 44px;
    height: 24px;
    background: var(--color-bg-tertiary);
    border: 2px solid var(--color-border);
    border-radius: 12px;
    transition: all 0.2s;
}

.toggle-knob::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: var(--color-text-muted);
    border-radius: 50%;
    transition: all 0.2s;
}

.toggle-btn--active .toggle-knob {
    background: var(--color-primary);
    border-color: var(--color-primary);
}

.toggle-btn--active .toggle-knob::after {
    left: 22px;
    background: white;
}

.toggle-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-secondary);
}

/* ── Buttons ── */
.btn-cancel {
    padding: 10px 20px;
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-cancel:hover {
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
}

.btn-save {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 100px;
    justify-content: center;
}

.btn-save:hover:not(:disabled) {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
}

.btn-save:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}

.btn-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
}

/* ── Modal Transition ── */
.modal-enter-active,
.modal-leave-active {
    transition: opacity 0.25s ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
    transition: transform 0.25s ease;
}

.modal-enter-from {
    opacity: 0;
}

.modal-enter-from .modal-container {
    transform: scale(0.95) translateY(10px);
}

.modal-leave-to {
    opacity: 0;
}

.modal-leave-to .modal-container {
    transform: scale(0.95) translateY(10px);
}

/* ── Loading & Empty ── */
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

.empty-state h3 {
    color: var(--color-text-primary);
    margin: 16px 0 8px;
}

.empty-state p {
    color: var(--color-text-muted);
    font-size: 14px;
}

.error-message {
    background: rgba(239, 68, 68, 0.1);
    color: var(--color-danger);
    padding: 12px;
    border-radius: 8px;
    margin-top: 16px;
    font-size: 14px;
}

/* ── Responsive ── */
@media (max-width: 768px) {
    .firms-page {
        padding: 16px;
    }

    .page-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
    }

    .btn-add {
        width: 100%;
        justify-content: center;
    }

    .header-content h1 {
        font-size: 24px;
    }

    .firms-grid {
        grid-template-columns: 1fr;
    }

    .search-box {
        max-width: 100%;
    }

    .form-row {
        grid-template-columns: 1fr;
    }

    .modal-overlay {
        padding: 16px;
        align-items: flex-end;
    }

    .modal-container {
        max-height: 85vh;
    }
}
</style>
