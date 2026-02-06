<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useForumStore } from '@/stores/forumStore';
import { useAuthStore } from '@/stores/authStore';
import AppLayout from '@/layouts/AppLayout.vue';

const route = useRoute();
const router = useRouter();
const forumStore = useForumStore();
const authStore = useAuthStore();

const categorySlug = computed(() => route.params.slug as string);
const currentPage = ref(1);
const sortBy = ref<'lastActivityAt' | 'replyCount' | 'viewCount'>('lastActivityAt');

onMounted(async () => {
    // Find category by slug
    await forumStore.fetchCategories();
    const category = forumStore.categories.find((c) => c.slug === categorySlug.value);
    if (category) {
        forumStore.currentCategory = category;
        loadTopics();
    }
});

async function loadTopics() {
    await forumStore.fetchTopics({
        categoryId: forumStore.currentCategory?.id,
        page: currentPage.value,
        limit: 20,
        sortBy: sortBy.value,
    });
}

function handleTopicClick(topicSlug: string) {
    router.push(`/forum/topic/${topicSlug}`);
}

function handleCreateTopic() {
    router.push(`/forum/create?category=${forumStore.currentCategory?.slug}`);
}

function handleSortChange(newSort: 'latest' | 'popular' | 'views') {
    // Map kullanıcı dostu değerleri backend sortBy değerlerine çevir
    const sortMapping = {
        latest: 'lastActivityAt' as const,
        popular: 'replyCount' as const,
        views: 'viewCount' as const,
    };
    sortBy.value = sortMapping[newSort];
    currentPage.value = 1;
    loadTopics();
}

function handlePageChange(page: number) {
    currentPage.value = page;
    loadTopics();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'şimdi';
    if (diffMins < 60) return `${diffMins} dk önce`;
    if (diffHours < 24) return `${diffHours} sa önce`;
    if (diffDays < 30) return `${diffDays} gün önce`;
    return date.toLocaleDateString('tr-TR');
}
</script>

<template>
    <AppLayout>
        <div class="category-page">
            <!-- Breadcrumb -->
            <div class="breadcrumb">
                <router-link to="/forum" class="breadcrumb-link">Forum</router-link>
                <span class="breadcrumb-separator">/</span>
                <span class="breadcrumb-current">{{ forumStore.currentCategory?.name }}</span>
            </div>

            <!-- Category Header -->
            <div class="category-header">
                <div class="header-content">
                    <div class="category-icon-large">{{ forumStore.currentCategory?.icon || '📁' }}</div>
                    <div>
                        <h1>{{ forumStore.currentCategory?.name }}</h1>
                        <p class="category-description">{{ forumStore.currentCategory?.description }}</p>
                    </div>
                </div>
                <button v-if="authStore.isAuthenticated" class="create-btn" @click="handleCreateTopic">
                    <span class="icon">+</span>
                    Yeni Konu
                </button>
            </div>

            <!-- Toolbar -->
            <div class="toolbar">
                <div class="topic-count">
                    {{ forumStore.topicsMeta.total }} {{ forumStore.topicsMeta.total === 1 ? 'konu' : 'konu' }}
                </div>
                <div class="sort-buttons">
                    <button
                        :class="{ active: sortBy === 'lastActivityAt' }"
                        class="sort-btn"
                        @click="handleSortChange('latest')"
                    >
                        En Yeniler
                    </button>
                    <button
                        :class="{ active: sortBy === 'replyCount' }"
                        class="sort-btn"
                        @click="handleSortChange('popular')"
                    >
                        Popüler
                    </button>
                    <button
                        :class="{ active: sortBy === 'viewCount' }"
                        class="sort-btn"
                        @click="handleSortChange('views')"
                    >
                        En Çok Görüntülenen
                    </button>
                </div>
            </div>

            <!-- Loading State -->
            <div v-if="forumStore.loading" class="loading-state">
                <div class="spinner"></div>
                <p>Konular yükleniyor...</p>
            </div>

            <!-- Topics List -->
            <div v-else class="topics-list">
                <!-- Pinned Topics -->
                <div v-if="forumStore.pinnedTopics.length > 0" class="pinned-section">
                    <h3 class="section-title">📌 Sabitlenmiş Konular</h3>
                    <div
                        v-for="topic in forumStore.pinnedTopics"
                        :key="topic.id"
                        class="topic-card pinned"
                        @click="handleTopicClick(topic.slug)"
                    >
                        <div class="topic-info">
                            <div class="topic-header">
                                <h3 class="topic-title">{{ topic.title }}</h3>
                                <div class="topic-badges">
                                    <span v-if="topic.isSolved" class="badge solved">✓ Çözüldü</span>
                                    <span v-if="topic.isLocked" class="badge locked">🔒 Kilitli</span>
                                </div>
                            </div>
                            <div class="topic-meta">
                                by {{ topic.author?.fullName }} · {{ formatDate(topic.createdAt) }}
                            </div>
                        </div>
                        <div class="topic-stats">
                            <div class="stat">
                                <span class="stat-value">{{ topic.viewCount }}</span>
                                <span class="stat-label">görüntülenme</span>
                            </div>
                            <div class="stat">
                                <span class="stat-value">{{ topic.replyCount }}</span>
                                <span class="stat-label">cevap</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Regular Topics -->
                <div v-if="forumStore.regularTopics.length > 0">
                    <div
                        v-for="topic in forumStore.regularTopics"
                        :key="topic.id"
                        class="topic-card"
                        @click="handleTopicClick(topic.slug)"
                    >
                        <div class="topic-info">
                            <div class="topic-header">
                                <h3 class="topic-title">{{ topic.title }}</h3>
                                <div class="topic-badges">
                                    <span v-if="topic.isSolved" class="badge solved">✓ Çözüldü</span>
                                    <span v-if="topic.isLocked" class="badge locked">🔒 Kilitli</span>
                                </div>
                            </div>
                            <div class="topic-meta">
                                by {{ topic.author?.fullName }} · {{ formatDate(topic.createdAt) }}
                            </div>
                        </div>
                        <div class="topic-stats">
                            <div class="stat">
                                <span class="stat-value">{{ topic.viewCount }}</span>
                                <span class="stat-label">görüntülenme</span>
                            </div>
                            <div class="stat">
                                <span class="stat-value">{{ topic.replyCount }}</span>
                                <span class="stat-label">cevap</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Empty State -->
                <div v-if="forumStore.topics.length === 0" class="empty-state">
                    <span class="empty-icon">💬</span>
                    <h3>Henüz Konu Yok</h3>
                    <p>Bu kategoride ilk tartışmayı başlatan siz olun!</p>
                    <button v-if="authStore.isAuthenticated" class="create-first-btn" @click="handleCreateTopic">
                        İlk Konuyu Oluştur
                    </button>
                </div>
            </div>

            <!-- Pagination -->
            <div v-if="forumStore.topicsMeta.totalPages > 1" class="pagination">
                <button
                    :disabled="currentPage === 1"
                    class="page-btn"
                    @click="handlePageChange(currentPage - 1)"
                >
                    ← Önceki
                </button>
                <div class="page-info">
                    Sayfa {{ currentPage }} / {{ forumStore.topicsMeta.totalPages }}
                </div>
                <button
                    :disabled="currentPage === forumStore.topicsMeta.totalPages"
                    class="page-btn"
                    @click="handlePageChange(currentPage + 1)"
                >
                    Sonraki →
                </button>
            </div>
        </div>
    </AppLayout>
</template>

<style scoped>
.category-page {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
}

/* Breadcrumb */
.breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 24px;
    font-size: 14px;
}

.breadcrumb-link {
    color: #10b981;
    text-decoration: none;
    transition: color 0.2s ease;
}

.breadcrumb-link:hover {
    color: #059669;
}

.breadcrumb-separator {
    color: #64748b;
}

.breadcrumb-current {
    color: #e2e8f0;
}

/* Category Header */
.category-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
    gap: 24px;
}

.header-content {
    display: flex;
    align-items: center;
    gap: 16px;
}

.category-icon-large {
    font-size: 48px;
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 16px;
}

.category-header h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 700;
    color: #ffffff;
}

.category-description {
    margin: 4px 0 0 0;
    font-size: 15px;
    color: #94a3b8;
}

.create-btn {
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

.create-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
}

.create-btn .icon {
    font-size: 20px;
}

/* Toolbar */
.toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
}

.topic-count {
    font-size: 14px;
    color: #94a3b8;
    font-weight: 500;
}

.sort-buttons {
    display: flex;
    gap: 8px;
}

.sort-btn {
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.05);
    color: #94a3b8;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.sort-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
}

.sort-btn.active {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
    border-color: rgba(16, 185, 129, 0.5);
}

/* Loading State */
.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 24px;
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

.loading-state p {
    margin-top: 16px;
    color: #94a3b8;
}

/* Topics List */
.topics-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.pinned-section {
    margin-bottom: 8px;
}

.section-title {
    margin: 0 0 16px 0;
    font-size: 14px;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.topic-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.topic-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(16, 185, 129, 0.5);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.topic-card.pinned {
    border-color: rgba(251, 191, 36, 0.3);
    background: rgba(251, 191, 36, 0.05);
}

.topic-card.pinned:hover {
    border-color: rgba(251, 191, 36, 0.5);
    background: rgba(251, 191, 36, 0.08);
}

.topic-info {
    flex: 1;
}

.topic-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
}

.topic-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
}

.topic-badges {
    display: flex;
    gap: 8px;
}

.badge {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
}

.badge.solved {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
}

.badge.locked {
    background: rgba(148, 163, 184, 0.2);
    color: #94a3b8;
}

.topic-meta {
    font-size: 13px;
    color: #64748b;
}

.topic-stats {
    display: flex;
    gap: 24px;
}

.stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
}

.stat-value {
    font-size: 18px;
    font-weight: 700;
    color: #10b981;
}

.stat-label {
    font-size: 12px;
    color: #64748b;
    margin-top: 2px;
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
    margin: 0 0 24px 0;
    color: #64748b;
    font-size: 15px;
}

.create-first-btn {
    padding: 12px 24px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
}

.create-first-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
}

/* Pagination */
.pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    margin-top: 32px;
    padding: 16px;
}

.page-btn {
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

.page-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    border-color: #10b981;
}

.page-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.page-info {
    color: #94a3b8;
    font-size: 14px;
}

/* Responsive */
@media (max-width: 768px) {
    .category-header {
        flex-direction: column;
        align-items: stretch;
    }

    .create-btn {
        justify-content: center;
    }

    .toolbar {
        flex-direction: column;
        gap: 16px;
        align-items: stretch;
    }

    .sort-buttons {
        justify-content: center;
    }

    .topic-card {
        flex-direction: column;
        align-items: flex-start;
    }

    .topic-stats {
        width: 100%;
        justify-content: flex-start;
    }
}
</style>
