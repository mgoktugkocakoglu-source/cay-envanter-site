<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useForumStore } from '@/stores/forumStore';
import AppLayout from '@/layouts/AppLayout.vue';
import type { ForumCategory } from '@/services/api';

const router = useRouter();
const forumStore = useForumStore();

const searchQuery = ref('');

onMounted(() => {
    forumStore.fetchCategories();
});

function handleCategoryClick(category: ForumCategory) {
    router.push(`/forum/category/${category.slug}`);
}

function handleCreateTopic() {
    router.push('/forum/create');
}

function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}
</script>

<template>
    <AppLayout>
        <div class="forum-page">
            <!-- Header -->
            <div class="forum-header">
                <div class="header-content">
                    <h1>Topluluk Forumu</h1>
                    <p class="subtitle">Çay üreticileriyle bağlantı kurun, deneyimlerinizi paylaşın ve yardım alın</p>
                </div>
                <button class="create-topic-btn" @click="handleCreateTopic">
                    <span class="icon">+</span>
                    Yeni Konu
                </button>
            </div>

            <!-- Search Bar -->
            <div class="search-section">
                <div class="search-box">
                    <span class="search-icon">🔍</span>
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Konularda ara..."
                        class="search-input"
                    />
                </div>
            </div>

            <!-- Loading State -->
            <div v-if="forumStore.loading" class="loading-state">
                <div class="spinner"></div>
                <p>Forum kategorileri yükleniyor...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="forumStore.error" class="error-state">
                <span class="error-icon">⚠️</span>
                <p>{{ forumStore.error }}</p>
                <button class="retry-btn" @click="forumStore.fetchCategories()">Tekrar Dene</button>
            </div>

            <!-- Categories Grid -->
            <div v-else class="categories-grid">
                <div
                    v-for="category in forumStore.activeCategories"
                    :key="category.id"
                    class="category-card"
                    @click="handleCategoryClick(category)"
                >
                    <div class="category-icon">{{ category.icon || '📁' }}</div>
                    <div class="category-info">
                        <h3 class="category-name">{{ category.name }}</h3>
                        <p class="category-description">{{ category.description }}</p>
                        <div class="category-stats">
                            <span class="stat">
                                <span class="stat-value">{{ category.topicCount || 0 }}</span>
                                konu
                            </span>
                        </div>
                    </div>
                    <div v-if="category.latestTopic" class="latest-topic">
                        <div class="latest-topic-title">{{ category.latestTopic.title }}</div>
                        <div class="latest-topic-meta">
                            by {{ category.latestTopic.author.fullName }}
                            · {{ formatDate(category.latestTopic.createdAt) }}
                        </div>
                    </div>
                    <div v-else class="no-topics">Henüz konu yok</div>
                </div>

                <!-- Empty State -->
                <div v-if="forumStore.activeCategories.length === 0" class="empty-state">
                    <span class="empty-icon">📂</span>
                    <h3>Kategori Bulunamadı</h3>
                    <p>Forum kategorileri oluşturulduğunda burada görünecektir.</p>
                </div>
            </div>
        </div>
    </AppLayout>
</template>

<style scoped>
.forum-page {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
}

/* Header */
.forum-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
    gap: 24px;
}

.header-content h1 {
    margin: 0;
    font-size: 32px;
    font-weight: 700;
    color: #ffffff;
}

.subtitle {
    margin: 8px 0 0 0;
    font-size: 16px;
    color: #94a3b8;
}

.create-topic-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.create-topic-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
}

.create-topic-btn .icon {
    font-size: 20px;
    font-weight: 700;
}

/* Search */
.search-section {
    margin-bottom: 32px;
}

.search-box {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 12px 16px;
    transition: all 0.3s ease;
}

.search-box:focus-within {
    background: rgba(255, 255, 255, 0.08);
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.search-icon {
    font-size: 18px;
    opacity: 0.6;
}

.search-input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: #ffffff;
    font-size: 16px;
}

.search-input::placeholder {
    color: #64748b;
}

/* Loading & Error States */
.loading-state,
.error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 24px;
    text-align: center;
}

.spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-top-color: #10b981;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.loading-state p,
.error-state p {
    margin-top: 16px;
    color: #94a3b8;
    font-size: 16px;
}

.error-icon {
    font-size: 48px;
}

.retry-btn {
    margin-top: 16px;
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s ease;
}

.retry-btn:hover {
    background: rgba(255, 255, 255, 0.15);
}

/* Categories Grid */
.categories-grid {
    display: grid;
    gap: 16px;
}

.category-card {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 16px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.category-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(16, 185, 129, 0.5);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.category-icon {
    font-size: 32px;
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 12px;
}

.category-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.category-name {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
}

.category-description {
    margin: 0;
    font-size: 14px;
    color: #94a3b8;
    line-height: 1.5;
}

.category-stats {
    display: flex;
    gap: 16px;
    margin-top: 4px;
}

.stat {
    font-size: 13px;
    color: #64748b;
}

.stat-value {
    color: #10b981;
    font-weight: 600;
}

.latest-topic,
.no-topics {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    min-width: 250px;
}

.latest-topic-title {
    font-size: 14px;
    font-weight: 500;
    color: #ffffff;
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.latest-topic-meta {
    font-size: 12px;
    color: #64748b;
}

.no-topics {
    font-size: 13px;
    color: #64748b;
    text-align: center;
    font-style: italic;
}

/* Empty State */
.empty-state {
    text-align: center;
    padding: 80px 24px;
}

.empty-icon {
    font-size: 64px;
    display: block;
    margin-bottom: 16px;
}

.empty-state h3 {
    margin: 0 0 8px 0;
    font-size: 20px;
    font-weight: 600;
    color: #e2e8f0;
}

.empty-state p {
    margin: 0;
    color: #64748b;
    font-size: 15px;
}

/* Responsive */
@media (max-width: 768px) {
    .forum-header {
        flex-direction: column;
        align-items: stretch;
    }

    .create-topic-btn {
        justify-content: center;
    }

    .category-card {
        grid-template-columns: auto 1fr;
        grid-template-rows: auto auto;
    }

    .latest-topic,
    .no-topics {
        grid-column: 1 / -1;
        min-width: unset;
    }
}
</style>
