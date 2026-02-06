<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useForumStore } from '@/stores/forumStore';
import AppLayout from '@/layouts/AppLayout.vue';

const router = useRouter();
const authStore = useAuthStore();
const forumStore = useForumStore();

// Modal state
const showCategoryModal = ref(false);
const isEditing = ref(false);
const categoryForm = ref({
    id: '',
    name: '',
    description: '',
    icon: '📁',
    displayOrder: 0,
    isActive: true,
});

const availableIcons = ['📁', '🌿', '🍃', '💬', '❓', '📢', '🛠️', '💡', '📊', '🎯', '🌱', '🏆'];

onMounted(() => {
    if (!authStore.isAuthenticated) {
        router.push('/login');
        return;
    }
    forumStore.fetchCategories();
});

function openCreateModal() {
    isEditing.value = false;
    categoryForm.value = {
        id: '',
        name: '',
        description: '',
        icon: '📁',
        displayOrder: forumStore.categories.length + 1,
        isActive: true,
    };
    showCategoryModal.value = true;
}

function openEditModal(category: typeof forumStore.categories[0]) {
    isEditing.value = true;
    categoryForm.value = {
        id: category.id,
        name: category.name,
        description: category.description || '',
        icon: category.icon || '📁',
        displayOrder: category.displayOrder || 0,
        isActive: category.isActive,
    };
    showCategoryModal.value = true;
}

function closeModal() {
    showCategoryModal.value = false;
    categoryForm.value = {
        id: '',
        name: '',
        description: '',
        icon: '📁',
        displayOrder: 0,
        isActive: true,
    };
}

async function handleSubmit() {
    if (!categoryForm.value.name.trim()) {
        alert('Kategori adı gereklidir');
        return;
    }

    if (isEditing.value) {
        // Update category - would call API
        await forumStore.updateCategory(categoryForm.value.id, {
            name: categoryForm.value.name,
            description: categoryForm.value.description,
            icon: categoryForm.value.icon,
            displayOrder: categoryForm.value.displayOrder,
            isActive: categoryForm.value.isActive,
        });
    } else {
        // Create category - would call API
        await forumStore.createCategory({
            name: categoryForm.value.name,
            description: categoryForm.value.description,
            icon: categoryForm.value.icon,
            displayOrder: categoryForm.value.displayOrder,
        });
    }

    closeModal();
    await forumStore.fetchCategories();
}

async function handleDelete(category: typeof forumStore.categories[0]) {
    if (!confirm(`"${category.name}" kategorisini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) {
        return;
    }

    await forumStore.deleteCategory(category.id);
    await forumStore.fetchCategories();
}

async function toggleCategoryStatus(category: typeof forumStore.categories[0]) {
    await forumStore.updateCategory(category.id, {
        isActive: !category.isActive,
    });
    await forumStore.fetchCategories();
}

function moveCategory(category: typeof forumStore.categories[0], direction: 'up' | 'down') {
    const index = forumStore.categories.findIndex(c => c.id === category.id);
    if (direction === 'up' && index > 0) {
        // Swap with previous
        const newOrder = forumStore.categories[index - 1].displayOrder;
        forumStore.updateCategory(category.id, { displayOrder: newOrder });
        forumStore.updateCategory(forumStore.categories[index - 1].id, { displayOrder: category.displayOrder });
    } else if (direction === 'down' && index < forumStore.categories.length - 1) {
        // Swap with next
        const newOrder = forumStore.categories[index + 1].displayOrder;
        forumStore.updateCategory(category.id, { displayOrder: newOrder });
        forumStore.updateCategory(forumStore.categories[index + 1].id, { displayOrder: category.displayOrder });
    }
    forumStore.fetchCategories();
}
</script>

<template>
    <AppLayout>
        <div class="admin-categories-page">
            <!-- Header -->
            <div class="page-header">
                <div>
                    <div class="breadcrumb">
                        <router-link to="/admin" class="breadcrumb-link">Admin Panel</router-link>
                        <span class="breadcrumb-separator">/</span>
                        <span class="breadcrumb-current">Kategoriler</span>
                    </div>
                    <h1>📂 Forum Kategorileri</h1>
                </div>
                <button class="create-btn" @click="openCreateModal">
                    <span>➕</span> Yeni Kategori
                </button>
            </div>

            <!-- Loading -->
            <div v-if="forumStore.loading" class="loading-state">
                <div class="spinner"></div>
                <p>Kategoriler yükleniyor...</p>
            </div>

            <!-- Categories List -->
            <div v-else class="categories-list">
                <div
                    v-for="(category, index) in forumStore.categories"
                    :key="category.id"
                    :class="['category-card', { inactive: !category.isActive }]"
                >
                    <div class="category-icon">{{ category.icon || '📁' }}</div>
                    <div class="category-info">
                        <h3>{{ category.name }}</h3>
                        <p>{{ category.description || 'Açıklama yok' }}</p>
                        <div class="category-meta">
                            <span class="meta-item">📝 {{ category.topicCount || 0 }} konu</span>
                            <span :class="['status-badge', category.isActive ? 'active' : 'inactive']">
                                {{ category.isActive ? 'Aktif' : 'Pasif' }}
                            </span>
                        </div>
                    </div>
                    <div class="category-actions">
                        <div class="order-buttons">
                            <button
                                :disabled="index === 0"
                                class="order-btn"
                                title="Yukarı Taşı"
                                @click="moveCategory(category, 'up')"
                            >
                                ⬆️
                            </button>
                            <button
                                :disabled="index === forumStore.categories.length - 1"
                                class="order-btn"
                                title="Aşağı Taşı"
                                @click="moveCategory(category, 'down')"
                            >
                                ⬇️
                            </button>
                        </div>
                        <button
                            :class="['action-btn', category.isActive ? 'deactivate' : 'activate']"
                            :title="category.isActive ? 'Pasifleştir' : 'Aktifleştir'"
                            @click="toggleCategoryStatus(category)"
                        >
                            {{ category.isActive ? '🔒' : '🔓' }}
                        </button>
                        <button class="action-btn edit" title="Düzenle" @click="openEditModal(category)">
                            ✏️
                        </button>
                        <button class="action-btn delete" title="Sil" @click="handleDelete(category)">
                            🗑️
                        </button>
                    </div>
                </div>

                <!-- Empty State -->
                <div v-if="forumStore.categories.length === 0" class="empty-state">
                    <span class="empty-icon">📂</span>
                    <p>Henüz kategori eklenmemiş</p>
                    <button class="create-btn" @click="openCreateModal">
                        İlk Kategoriyi Ekle
                    </button>
                </div>
            </div>

            <!-- Category Modal -->
            <div v-if="showCategoryModal" class="modal-overlay" @click.self="closeModal">
                <div class="modal">
                    <div class="modal-header">
                        <h2>{{ isEditing ? 'Kategori Düzenle' : 'Yeni Kategori' }}</h2>
                        <button class="close-btn" @click="closeModal">✕</button>
                    </div>
                    <form class="modal-body" @submit.prevent="handleSubmit">
                        <!-- Icon Selection -->
                        <div class="form-group">
                            <label class="form-label">İkon</label>
                            <div class="icon-grid">
                                <button
                                    v-for="icon in availableIcons"
                                    :key="icon"
                                    :class="['icon-option', { selected: categoryForm.icon === icon }]"
                                    type="button"
                                    @click="categoryForm.icon = icon"
                                >
                                    {{ icon }}
                                </button>
                            </div>
                        </div>

                        <!-- Name -->
                        <div class="form-group">
                            <label class="form-label" for="categoryName">Kategori Adı *</label>
                            <input
                                id="categoryName"
                                v-model="categoryForm.name"
                                type="text"
                                class="form-input"
                                placeholder="Örn: Genel Tartışmalar"
                                required
                            />
                        </div>

                        <!-- Description -->
                        <div class="form-group">
                            <label class="form-label" for="categoryDesc">Açıklama</label>
                            <textarea
                                id="categoryDesc"
                                v-model="categoryForm.description"
                                class="form-textarea"
                                placeholder="Kategori hakkında kısa bir açıklama..."
                                rows="3"
                            ></textarea>
                        </div>

                        <!-- Sort Order -->
                        <div class="form-group">
                            <label class="form-label" for="displayOrder">Sıralama</label>
                            <input
                                id="displayOrder"
                                v-model.number="categoryForm.displayOrder"
                                type="number"
                                class="form-input"
                                min="0"
                            />
                        </div>

                        <!-- Active Status -->
                        <div class="form-group">
                            <label class="toggle-label">
                                <input
                                    v-model="categoryForm.isActive"
                                    type="checkbox"
                                    class="toggle-input"
                                />
                                <span class="toggle-switch"></span>
                                <span>Aktif</span>
                            </label>
                        </div>
                    </form>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" type="button" @click="closeModal">İptal</button>
                        <button class="btn btn-primary" type="submit" @click="handleSubmit">
                            {{ isEditing ? 'Güncelle' : 'Oluştur' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </AppLayout>
</template>

<style scoped>
.admin-categories-page {
    padding: 24px;
    max-width: 1000px;
    margin: 0 auto;
}

/* Header */
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
    gap: 16px;
    flex-wrap: wrap;
}

.breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 14px;
}

.breadcrumb-link {
    color: #10b981;
    text-decoration: none;
}

.breadcrumb-link:hover {
    color: #059669;
}

.breadcrumb-separator {
    color: #64748b;
}

.breadcrumb-current {
    color: #94a3b8;
}

.page-header h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 700;
    color: #ffffff;
}

.create-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
}

.create-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
}

/* Loading */
.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 60px;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-top-color: #10b981;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.loading-state p {
    margin-top: 16px;
    color: #94a3b8;
}

/* Categories List */
.categories-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.category-card {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    transition: all 0.2s ease;
}

.category-card:hover {
    background: rgba(255, 255, 255, 0.07);
}

.category-card.inactive {
    opacity: 0.6;
}

.category-icon {
    font-size: 40px;
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 16px;
    flex-shrink: 0;
}

.category-info {
    flex: 1;
}

.category-info h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
}

.category-info p {
    margin: 6px 0 0;
    font-size: 14px;
    color: #64748b;
}

.category-meta {
    display: flex;
    gap: 16px;
    margin-top: 10px;
    align-items: center;
}

.meta-item {
    font-size: 13px;
    color: #94a3b8;
}

.status-badge {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
}

.status-badge.active {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
}

.status-badge.inactive {
    background: rgba(148, 163, 184, 0.2);
    color: #94a3b8;
}

.category-actions {
    display: flex;
    gap: 8px;
    align-items: center;
}

.order-buttons {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.order-btn {
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s ease;
}

.order-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
}

.order-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.action-btn {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
}

.action-btn.edit {
    background: rgba(59, 130, 246, 0.2);
}

.action-btn.delete {
    background: rgba(239, 68, 68, 0.2);
}

.action-btn.activate {
    background: rgba(16, 185, 129, 0.2);
}

.action-btn.deactivate {
    background: rgba(251, 191, 36, 0.2);
}

.action-btn:hover {
    transform: scale(1.1);
}

/* Empty State */
.empty-state {
    text-align: center;
    padding: 60px;
}

.empty-icon {
    font-size: 64px;
    display: block;
    margin-bottom: 16px;
}

.empty-state p {
    margin: 0 0 20px;
    color: #64748b;
    font-size: 16px;
}

/* Modal */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
}

.modal {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h2 {
    margin: 0;
    font-size: 18px;
    color: #ffffff;
}

.close-btn {
    background: none;
    border: none;
    color: #64748b;
    font-size: 20px;
    cursor: pointer;
}

.close-btn:hover {
    color: #ffffff;
}

.modal-body {
    padding: 24px;
}

.form-group {
    margin-bottom: 20px;
}

.form-label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: #e2e8f0;
}

.form-input,
.form-textarea {
    width: 100%;
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: #ffffff;
    font-size: 14px;
    font-family: inherit;
}

.form-input:focus,
.form-textarea:focus {
    outline: none;
    border-color: #10b981;
}

.form-input::placeholder,
.form-textarea::placeholder {
    color: #64748b;
}

.form-textarea {
    resize: vertical;
}

/* Icon Grid */
.icon-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 8px;
}

.icon-option {
    width: 48px;
    height: 48px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    font-size: 24px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.icon-option:hover {
    border-color: rgba(16, 185, 129, 0.5);
}

.icon-option.selected {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.2);
}

/* Toggle */
.toggle-label {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    font-size: 14px;
    color: #e2e8f0;
}

.toggle-input {
    display: none;
}

.toggle-switch {
    width: 44px;
    height: 24px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    position: relative;
    transition: all 0.3s ease;
}

.toggle-switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: #ffffff;
    border-radius: 50%;
    transition: all 0.3s ease;
}

.toggle-input:checked + .toggle-switch {
    background: #10b981;
}

.toggle-input:checked + .toggle-switch::after {
    left: 22px;
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

.btn-secondary {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
}

.btn-primary {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
}

.btn:hover {
    transform: translateY(-2px);
}

/* Responsive */
@media (max-width: 768px) {
    .admin-categories-page {
        padding: 16px;
    }

    .category-card {
        flex-direction: column;
        text-align: center;
    }

    .category-actions {
        width: 100%;
        justify-content: center;
    }

    .order-buttons {
        flex-direction: row;
    }
}
</style>
