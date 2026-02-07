<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useForumStore } from '@/stores/forumStore';
import { useAuthStore } from '@/stores/authStore';
import AppLayout from '@/layouts/AppLayout.vue';
import AppSelect from '@/components/ui/AppSelect.vue';

const router = useRouter();
const route = useRoute();
const forumStore = useForumStore();
const authStore = useAuthStore();

const title = ref('');
const content = ref('');
const selectedCategoryId = ref('');
const isSubmitting = ref(false);
const errors = ref<{ title?: string; content?: string; category?: string }>({});

// Pre-select category if provided in query params
const preSelectedCategory = computed(() => route.query.category as string | undefined);

onMounted(async () => {
    // Redirect if not authenticated
    if (!authStore.isAuthenticated) {
        router.push('/login');
        return;
    }

    await forumStore.fetchCategories();

    // Pre-select category if provided
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
        errors.value.title = 'Başlık gereklidir';
    } else if (title.value.trim().length < 10) {
        errors.value.title = 'Başlık en az 10 karakter olmalıdır';
    } else if (title.value.trim().length > 200) {
        errors.value.title = 'Başlık 200 karakterden kısa olmalıdır';
    }

    if (!content.value.trim()) {
        errors.value.content = 'İçerik gereklidir';
    } else if (content.value.trim().length < 20) {
        errors.value.content = 'İçerik en az 20 karakter olmalıdır';
    }

    if (!selectedCategoryId.value) {
        errors.value.category = 'Lütfen bir kategori seçin';
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
        // Navigate to the newly created topic
        router.push(`/forum/topic/${result.slug}`);
    } else if (forumStore.error) {
        errors.value.category = forumStore.error;
    }

    isSubmitting.value = false;
}

function handleCancel() {
    if (title.value.trim() || content.value.trim()) {
        if (confirm('Yazdıklarınız kaybolacak. Sayfadan ayrılmak istediğinize emin misiniz?')) {
            router.back();
        }
    } else {
        router.back();
    }
}

function clearError(field: 'title' | 'content' | 'category') {
    delete errors.value[field];
}

// Options for AppSelect
const categoryOptions = computed(() =>
    forumStore.activeCategories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))
);
</script>

<template>
    <AppLayout>
        <div class="create-topic-page">
            <!-- Header -->
            <div class="page-header">
                <div>
                    <h1>Yeni Konu Oluştur</h1>
                    <p class="subtitle">Sorularınızı, fikirlerinizi veya deneyimlerinizi toplulukla paylaşın</p>
                </div>
                <button class="cancel-btn" @click="handleCancel">İptal</button>
            </div>

            <!-- Form -->
            <form class="topic-form" @submit.prevent="handleSubmit">
                <!-- Category Selection -->
                <div class="form-group">
                    <AppSelect
                        v-model="selectedCategoryId"
                        :options="categoryOptions"
                        label="Kategori"
                        placeholder="Bir kategori seçin"
                        :error="errors.category"
                        :required="true"
                        @blur="() => clearError('category')"
                    />
                </div>

                <!-- Title Input -->
                <div class="form-group">
                    <label class="form-label" for="title">
                        Başlık <span class="required">*</span>
                    </label>
                    <input
                        id="title"
                        v-model="title"
                        :class="{ error: errors.title }"
                        class="form-input"
                        placeholder="Konunuz için açıklayıcı bir başlık girin..."
                        type="text"
                        @input="clearError('title')"
                    />
                    <div class="input-meta">
                        <p v-if="errors.title" class="error-message">{{ errors.title }}</p>
                        <p class="character-count">{{ title.length }}/200</p>
                    </div>
                </div>

                <!-- Content Textarea -->
                <div class="form-group">
                    <label class="form-label" for="content">
                        İçerik <span class="required">*</span>
                    </label>
                    <textarea
                        id="content"
                        v-model="content"
                        :class="{ error: errors.content }"
                        class="form-textarea"
                        placeholder="Sorunuzu veya konunuzu detaylı olarak açıklayın... Spesifik olun ve mümkün olduğunca fazla bilgi verin."
                        rows="12"
                        @input="clearError('content')"
                    ></textarea>
                    <div class="input-meta">
                        <p v-if="errors.content" class="error-message">{{ errors.content }}</p>
                        <p class="character-count">{{ content.length }} karakter</p>
                    </div>
                </div>

                <!-- Guidelines -->
                <div class="guidelines">
                    <h3>💡 Gönderi Yönergeleri</h3>
                    <ul>
                        <li>İletişiminizde saygılı ve yapıcı olun</li>
                        <li>Tekrarlardan kaçınmak için gönderi yapmadan önce benzer konuları arayın</li>
                        <li>Başkalarının konunuzu anlamasına yardımcı olmak için açık ve özgün bilgiler sağlayın</li>
                        <li>Daha iyi organizasyon için uygun kategorileri kullanın</li>
                    </ul>
                </div>

                <!-- Form Actions -->
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" @click="handleCancel">İptal</button>
                    <button :disabled="isSubmitting" class="btn btn-primary" type="submit">
                        {{ isSubmitting ? 'Oluşturuluyor...' : 'Konu Oluştur' }}
                    </button>
                </div>
            </form>
        </div>
    </AppLayout>
</template>

<style scoped>
.create-topic-page {
    padding: 24px;
    max-width: 900px;
    margin: 0 auto;
}

/* Header */
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
    gap: 24px;
}

.page-header h1 {
    margin: 0;
    font-size: 32px;
    font-weight: 700;
    color: #ffffff;
}

.subtitle {
    margin: 8px 0 0 0;
    font-size: 15px;
    color: #94a3b8;
}

.cancel-btn {
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.05);
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
}

.cancel-btn:hover {
    background: rgba(255, 255, 255, 0.08);
}

/* Form */
.topic-form {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 32px;
}

.form-group {
    margin-bottom: 24px;
}

.form-label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #e2e8f0;
}

.required {
    color: #ef4444;
}

.form-select,
.form-input,
.form-textarea {
    width: 100%;
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: #ffffff;
    font-size: 15px;
    font-family: inherit;
    transition: all 0.2s ease;
}

.form-select:focus,
.form-input:focus,
.form-textarea:focus {
    outline: none;
    border-color: #10b981;
    background: rgba(0, 0, 0, 0.4);
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.form-select.error,
.form-input.error,
.form-textarea.error {
    border-color: #ef4444;
}

.form-select.error:focus,
.form-input.error:focus,
.form-textarea.error:focus {
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.form-select {
    cursor: pointer;
}

.form-select option {
    background: #1e293b;
    color: #ffffff;
}

.form-textarea {
    resize: vertical;
    min-height: 200px;
}

.form-input::placeholder,
.form-textarea::placeholder {
    color: #64748b;
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
    color: #ef4444;
    font-size: 13px;
}

.character-count {
    margin: 0;
    font-size: 12px;
    color: #64748b;
}

/* Guidelines */
.guidelines {
    padding: 20px;
    background: rgba(16, 185, 129, 0.05);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 12px;
    margin-bottom: 24px;
}

.guidelines h3 {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
    color: #10b981;
}

.guidelines ul {
    margin: 0;
    padding-left: 24px;
}

.guidelines li {
    color: #94a3b8;
    font-size: 14px;
    line-height: 1.6;
    margin-bottom: 6px;
}

.guidelines li:last-child {
    margin-bottom: 0;
}

/* Form Actions */
.form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
}

.btn {
    padding: 12px 24px;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
}

.btn-secondary {
    background: rgba(255, 255, 255, 0.05);
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-secondary:hover {
    background: rgba(255, 255, 255, 0.08);
}

.btn-primary {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
}

.btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
}

/* Responsive */
@media (max-width: 768px) {
    .create-topic-page {
        padding: 16px;
    }

    .page-header {
        flex-direction: column;
        align-items: stretch;
    }

    .page-header h1 {
        font-size: 24px;
    }

    .cancel-btn {
        width: 100%;
        justify-content: center;
    }

    .topic-form {
        padding: 24px 20px;
    }

    .form-actions {
        flex-direction: column-reverse;
    }

    .btn {
        width: 100%;
        justify-content: center;
    }
}
</style>
