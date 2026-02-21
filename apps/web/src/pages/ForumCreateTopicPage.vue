<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useForumStore } from '@/stores/forumStore';
import { useAuthStore } from '@/stores/authStore';
import AppLayout from '@/layouts/AppLayout.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import RichTextEditor from '@/components/forum/RichTextEditor.vue';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';

const router = useRouter();
const route = useRoute();
const forumStore = useForumStore();
const authStore = useAuthStore();

const title = ref('');
const content = ref('');
const selectedCategoryId = ref('');
const isSubmitting = ref(false);
const errors = ref<{ title?: string; content?: string; category?: string }>({});
const showCancelConfirm = ref(false);

const preSelectedCategory = computed(() => route.query.category as string | undefined);

onMounted(async () => {
    if (!authStore.isAuthenticated) {
        router.push('/login');
        return;
    }

    await forumStore.fetchCategories();

    if (preSelectedCategory.value) {
        const category = forumStore.categories.find(c => c.slug === preSelectedCategory.value);
        if (category) {
            selectedCategoryId.value = category.id;
        }
    }
});

function validateForm(): boolean {
    errors.value = {};

    if (!title.value.trim()) {
        errors.value.title = 'Baslik gereklidir';
    } else if (title.value.trim().length < 10) {
        errors.value.title = 'Baslik en az 10 karakter olmalidir';
    } else if (title.value.trim().length > 200) {
        errors.value.title = 'Baslik 200 karakterden kisa olmalidir';
    }

    if (!content.value.trim()) {
        errors.value.content = 'Icerik gereklidir';
    } else {
        const stripped = content.value.replace(/<[^>]*>/g, '').trim();
        if (stripped.length < 20) {
            errors.value.content = 'Icerik en az 20 karakter olmalidir';
        }
    }

    if (!selectedCategoryId.value) {
        errors.value.category = 'Lutfen bir kategori secin';
    }

    return Object.keys(errors.value).length === 0;
}

async function handleSubmit() {
    if (!validateForm() || isSubmitting.value) return;

    isSubmitting.value = true;

    const result = await forumStore.createTopic({
        title: title.value.trim(),
        content: content.value.trim(),
        categoryId: selectedCategoryId.value,
    });

    if (result) {
        router.push(`/forum/topic/${result.slug}`);
    } else if (forumStore.error) {
        errors.value.category = forumStore.error;
    }

    isSubmitting.value = false;
}

function handleCancel() {
    const stripped = content.value.replace(/<[^>]*>/g, '').trim();
    if (title.value.trim() || stripped) {
        showCancelConfirm.value = true;
    } else {
        router.back();
    }
}

function confirmCancel() {
    router.back();
}

function clearError(field: 'title' | 'content' | 'category') {
    delete errors.value[field];
}

const categoryOptions = computed(() =>
    forumStore.activeCategories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))
);

const titleCharClass = computed(() => {
    if (title.value.length > 200) return 'over';
    if (title.value.length > 180) return 'warn';
    return '';
});
</script>

<template>
    <AppLayout>
        <div class="create-page">
            <!-- Breadcrumb -->
            <nav class="breadcrumb">
                <router-link to="/forum" class="bc-link">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    Forum
                </router-link>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                <span class="bc-current">Yeni Konu</span>
            </nav>

            <!-- Header -->
            <div class="page-header">
                <div class="header-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </div>
                <div>
                    <h1>Yeni Konu Olustur</h1>
                    <p class="subtitle">Sorularinizi, fikirlerinizi veya deneyimlerinizi toplulukla paylasin</p>
                </div>
            </div>

            <!-- Form -->
            <form class="topic-form" @submit.prevent="handleSubmit">
                <!-- Category -->
                <div class="form-group">
                    <AppSelect
                        v-model="selectedCategoryId"
                        :options="categoryOptions"
                        label="Kategori"
                        placeholder="Bir kategori secin"
                        :error="errors.category"
                        :required="true"
                        @blur="() => clearError('category')"
                    />
                </div>

                <!-- Title -->
                <div class="form-group">
                    <label class="form-label" for="title">
                        Baslik <span class="required">*</span>
                    </label>
                    <input
                        id="title"
                        v-model="title"
                        :class="{ error: errors.title }"
                        class="form-input"
                        placeholder="Konunuz icin aciklayici bir baslik girin..."
                        type="text"
                        @input="clearError('title')"
                    />
                    <div class="input-meta">
                        <p v-if="errors.title" class="error-message">{{ errors.title }}</p>
                        <p :class="['char-count', titleCharClass]">{{ title.length }}/200</p>
                    </div>
                </div>

                <!-- Content - Rich Text Editor -->
                <div class="form-group">
                    <label class="form-label">
                        Icerik <span class="required">*</span>
                    </label>
                    <RichTextEditor
                        v-model="content"
                        placeholder="Sorunuzu veya konunuzu detayli olarak aciklayin... Gorsel, YouTube videosu ve link ekleyebilirsiniz."
                        min-height="280px"
                    />
                    <div class="input-meta">
                        <p v-if="errors.content" class="error-message">{{ errors.content }}</p>
                    </div>
                </div>

                <!-- Guidelines -->
                <div class="guidelines">
                    <div class="guidelines-header">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        <span>Gonderi Yonergeleri</span>
                    </div>
                    <ul>
                        <li>Iletisinizde saygili ve yapici olun</li>
                        <li>Tekrarlardan kacinmak icin gonderi yapmadan once benzer konulari arayin</li>
                        <li>Baskalarin konunuzu anlamasina yardimci olmak icin acik bilgiler saglayin</li>
                        <li>Gorsel ve video ekleyerek konunuzu zenginlestirin</li>
                    </ul>
                </div>

                <!-- Actions -->
                <div class="form-actions">
                    <button type="button" class="btn-secondary" @click="handleCancel">
                        Iptal
                    </button>
                    <button :disabled="isSubmitting" class="btn-primary" type="submit">
                        <svg v-if="!isSubmitting" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        <div v-else class="spinner-sm"></div>
                        {{ isSubmitting ? 'Olusturuluyor...' : 'Konu Olustur' }}
                    </button>
                </div>
            </form>

            <!-- Cancel Confirm Modal -->
            <ConfirmModal
                v-model="showCancelConfirm"
                title="Sayfadan Ayril"
                message="Yazdiklariniz kaybolacak. Sayfadan ayrilmak istediginize emin misiniz?"
                confirm-text="Ayril"
                cancel-text="Kalmaya Devam Et"
                variant="warning"
                @confirm="confirmCancel"
            />
        </div>
    </AppLayout>
</template>

<style scoped>
.create-page {
    padding: 24px;
    max-width: 860px;
    margin: 0 auto;
}

/* Breadcrumb */
.breadcrumb {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 20px;
    font-size: 13px;
}

.bc-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-text-muted);
    text-decoration: none;
    transition: color 0.15s;
}

.bc-link:hover { color: var(--color-primary); }

.bc-current { color: var(--color-text-secondary); font-weight: 500; }

/* Header */
.page-header {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    margin-bottom: 24px;
}

.header-icon {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 12px;
    color: var(--color-primary);
    flex-shrink: 0;
}

.page-header h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    color: var(--color-text-primary);
    letter-spacing: -0.5px;
}

.subtitle {
    margin: 4px 0 0;
    font-size: 14px;
    color: var(--color-text-muted);
}

/* Form */
.topic-form {
    background: var(--color-card-bg);
    border: 1px solid var(--color-card-border);
    border-radius: 16px;
    padding: 28px;
}

.form-group {
    margin-bottom: 24px;
}

.form-label {
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary);
}

.required {
    color: var(--color-danger);
}

.form-input {
    width: 100%;
    padding: 12px 16px;
    background: var(--color-input-bg);
    border: 1px solid var(--color-input-border);
    border-radius: 10px;
    color: var(--color-text-primary);
    font-size: 15px;
    font-family: inherit;
    transition: all 0.2s;
}

.form-input:focus {
    outline: none;
    border-color: var(--color-primary);
    background: var(--color-input-bg-focus);
}

.form-input.error {
    border-color: var(--color-danger);
}

.form-input::placeholder {
    color: var(--color-text-muted);
}

.input-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 6px;
    min-height: 20px;
}

.error-message {
    margin: 0;
    color: var(--color-danger);
    font-size: 13px;
}

.char-count {
    margin: 0;
    font-size: 12px;
    color: var(--color-text-muted);
    margin-left: auto;
}

.char-count.warn {
    color: var(--color-warning);
}

.char-count.over {
    color: var(--color-danger);
    font-weight: 600;
}

/* Guidelines */
.guidelines {
    padding: 14px 18px;
    background: rgba(16, 185, 129, 0.03);
    border: 1px solid rgba(16, 185, 129, 0.08);
    border-radius: 10px;
    margin-bottom: 24px;
}

.guidelines-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-primary);
}

.guidelines ul {
    margin: 0;
    padding-left: 20px;
}

.guidelines li {
    color: var(--color-text-muted);
    font-size: 12px;
    line-height: 1.7;
    margin-bottom: 3px;
}

.guidelines li:last-child {
    margin-bottom: 0;
}

.guidelines li::marker {
    color: rgba(16, 185, 129, 0.4);
}

/* Actions */
.form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 22px;
    background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
}

.btn-primary:active:not(:disabled) {
    transform: translateY(0);
}

.btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
}

.btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 22px;
    background: var(--color-card-bg-hover);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-overlay-lighter);
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-secondary:hover {
    background: var(--color-overlay-lighter);
    color: var(--color-text-primary);
}

.spinner-sm {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 640px) {
    .create-page { padding: 16px; }
    .header-icon { display: none; }
    .page-header h1 { font-size: 22px; }
    .topic-form { padding: 20px 16px; }
    .form-actions { flex-direction: column-reverse; }
    .btn-primary, .btn-secondary { width: 100%; justify-content: center; }
}
</style>
