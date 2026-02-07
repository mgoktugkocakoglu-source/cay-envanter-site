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

    if (diffMins < 1) return 'az once';
    if (diffMins < 60) return `${diffMins} dk once`;
    if (diffHours < 24) return `${diffHours} sa once`;
    if (diffDays < 30) return `${diffDays} gun once`;
    return date.toLocaleDateString('tr-TR');
}

function getInitials(name?: string) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
</script>

<template>
    <AppLayout>
        <div class="category-page">
            <!-- Breadcrumb -->
            <nav class="breadcrumb">
                <router-link to="/forum" class="bc-link">Forum</router-link>
                <span class="bc-sep">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                </span>
                <span class="bc-current">{{ forumStore.currentCategory?.name }}</span>
            </nav>

            <!-- Category Header -->
            <div class="cat-hero">
                <div class="cat-hero-left">
                    <div class="cat-icon-wrap">{{ forumStore.currentCategory?.icon || '📁' }}</div>
                    <div>
                        <h1>{{ forumStore.currentCategory?.name }}</h1>
                        <p class="cat-desc">{{ forumStore.currentCategory?.description }}</p>
                    </div>
                </div>
                <button v-if="authStore.isAuthenticated" class="btn-create" @click="handleCreateTopic">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Yeni Konu
                </button>
            </div>

            <!-- Toolbar -->
            <div class="toolbar">
                <span class="topic-total">{{ forumStore.topicsMeta.total }} konu</span>
                <div class="sort-group">
                    <button :class="{ active: sortBy === 'lastActivityAt' }" class="sort-btn" @click="handleSortChange('latest')">En Yeniler</button>
                    <button :class="{ active: sortBy === 'replyCount' }" class="sort-btn" @click="handleSortChange('popular')">Populer</button>
                    <button :class="{ active: sortBy === 'viewCount' }" class="sort-btn" @click="handleSortChange('views')">En Cok Goruntulenen</button>
                </div>
            </div>

            <!-- Loading -->
            <div v-if="forumStore.loading" class="loading-state">
                <div class="spinner"></div>
                <p>Konular yukleniyor...</p>
            </div>

            <!-- Topics -->
            <div v-else class="topic-list">
                <!-- Pinned -->
                <template v-if="forumStore.pinnedTopics.length > 0">
                    <div class="section-label">Sabitlenmis Konular</div>
                    <div
                        v-for="topic in forumStore.pinnedTopics"
                        :key="topic.id"
                        class="topic-row pinned"
                        @click="handleTopicClick(topic.slug)"
                    >
                        <div class="topic-row-left">
                            <div class="avatar avatar-sm">{{ getInitials(topic.author?.fullName) }}</div>
                            <div class="topic-info">
                                <div class="topic-title-row">
                                    <span class="pin-icon">📌</span>
                                    <h3 class="topic-title">{{ topic.title }}</h3>
                                    <span v-if="topic.isSolved" class="badge badge-solved">Cozuldu</span>
                                    <span v-if="topic.isLocked" class="badge badge-locked">Kilitli</span>
                                </div>
                                <div class="topic-meta-line">
                                    {{ topic.author?.fullName }} · {{ formatDate(topic.createdAt) }}
                                </div>
                            </div>
                        </div>
                        <div class="topic-row-stats">
                            <div class="mini-stat">
                                <span class="mini-val">{{ topic.replyCount }}</span>
                                <span class="mini-label">cevap</span>
                            </div>
                            <div class="mini-stat">
                                <span class="mini-val">{{ topic.viewCount }}</span>
                                <span class="mini-label">grnm</span>
                            </div>
                        </div>
                    </div>
                </template>

                <!-- Regular -->
                <template v-if="forumStore.regularTopics.length > 0">
                    <div v-if="forumStore.pinnedTopics.length > 0" class="section-label">Konular</div>
                    <div
                        v-for="topic in forumStore.regularTopics"
                        :key="topic.id"
                        class="topic-row"
                        @click="handleTopicClick(topic.slug)"
                    >
                        <div class="topic-row-left">
                            <div class="avatar avatar-sm">{{ getInitials(topic.author?.fullName) }}</div>
                            <div class="topic-info">
                                <div class="topic-title-row">
                                    <h3 class="topic-title">{{ topic.title }}</h3>
                                    <span v-if="topic.isSolved" class="badge badge-solved">Cozuldu</span>
                                    <span v-if="topic.isLocked" class="badge badge-locked">Kilitli</span>
                                </div>
                                <div class="topic-meta-line">
                                    {{ topic.author?.fullName }} · {{ formatDate(topic.createdAt) }}
                                </div>
                            </div>
                        </div>
                        <div class="topic-row-stats">
                            <div class="mini-stat">
                                <span class="mini-val">{{ topic.replyCount }}</span>
                                <span class="mini-label">cevap</span>
                            </div>
                            <div class="mini-stat">
                                <span class="mini-val">{{ topic.viewCount }}</span>
                                <span class="mini-label">grnm</span>
                            </div>
                        </div>
                    </div>
                </template>

                <!-- Empty -->
                <div v-if="forumStore.topics.length === 0 && !forumStore.loading" class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4a5568" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    <h3>Henuz Konu Yok</h3>
                    <p>Bu kategoride ilk tartismayi baslatan siz olun!</p>
                    <button v-if="authStore.isAuthenticated" class="btn-create-first" @click="handleCreateTopic">
                        Ilk Konuyu Olustur
                    </button>
                </div>
            </div>

            <!-- Pagination -->
            <div v-if="forumStore.topicsMeta.totalPages > 1" class="pagination">
                <button :disabled="currentPage === 1" class="page-btn" @click="handlePageChange(currentPage - 1)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
                    Onceki
                </button>
                <span class="page-info">{{ currentPage }} / {{ forumStore.topicsMeta.totalPages }}</span>
                <button :disabled="currentPage === forumStore.topicsMeta.totalPages" class="page-btn" @click="handlePageChange(currentPage + 1)">
                    Sonraki
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                </button>
            </div>
        </div>
    </AppLayout>
</template>

<style scoped>
.category-page {
    padding: 24px;
    max-width: 960px;
    margin: 0 auto;
}

/* Breadcrumb */
.breadcrumb {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 24px;
    font-size: 14px;
}

.bc-link {
    color: #64748b;
    text-decoration: none;
    transition: color 0.2s;
}

.bc-link:hover {
    color: #10b981;
}

.bc-sep {
    color: #374151;
    display: flex;
    align-items: center;
}

.bc-current {
    color: #94a3b8;
}

/* Category Hero */
.cat-hero {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    gap: 20px;
    flex-wrap: wrap;
}

.cat-hero-left {
    display: flex;
    align-items: center;
    gap: 16px;
}

.cat-icon-wrap {
    font-size: 32px;
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(16, 185, 129, 0.08);
    border-radius: 14px;
    flex-shrink: 0;
}

.cat-hero h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    color: #f1f5f9;
}

.cat-desc {
    margin: 4px 0 0;
    font-size: 14px;
    color: #64748b;
}

.btn-create {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
}

.btn-create:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
}

/* Toolbar */
.toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    flex-wrap: wrap;
    gap: 10px;
}

.topic-total {
    font-size: 13px;
    color: #64748b;
    font-weight: 500;
}

.sort-group {
    display: flex;
    gap: 4px;
}

.sort-btn {
    padding: 6px 14px;
    background: transparent;
    color: #64748b;
    border: 1px solid transparent;
    border-radius: 8px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
}

.sort-btn:hover {
    color: #e2e8f0;
    background: rgba(255, 255, 255, 0.04);
}

.sort-btn.active {
    background: rgba(16, 185, 129, 0.12);
    color: #10b981;
    border-color: rgba(16, 185, 129, 0.2);
}

/* Loading */
.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 64px 24px;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.08);
    border-top-color: #10b981;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.loading-state p {
    margin-top: 16px;
    color: #64748b;
    font-size: 15px;
}

/* Topic List */
.topic-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.section-label {
    font-size: 11px;
    font-weight: 700;
    color: #4a5568;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    padding: 12px 0 4px;
}

.topic-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 14px 18px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
}

.topic-row:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(16, 185, 129, 0.25);
}

.topic-row.pinned {
    border-color: rgba(251, 191, 36, 0.15);
    background: rgba(251, 191, 36, 0.03);
}

.topic-row.pinned:hover {
    border-color: rgba(251, 191, 36, 0.3);
}

.topic-row-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
}

.avatar {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: linear-gradient(135deg, #10b981, #059669);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    flex-shrink: 0;
}

.avatar-sm {
    width: 32px;
    height: 32px;
    font-size: 11px;
    border-radius: 8px;
}

.topic-info {
    min-width: 0;
}

.topic-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.pin-icon {
    font-size: 14px;
    flex-shrink: 0;
}

.topic-title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 400px;
}

.badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
}

.badge-solved {
    background: rgba(16, 185, 129, 0.12);
    color: #10b981;
}

.badge-locked {
    background: rgba(100, 116, 139, 0.12);
    color: #94a3b8;
}

.topic-meta-line {
    font-size: 12px;
    color: #4a5568;
    margin-top: 3px;
}

.topic-row-stats {
    display: flex;
    gap: 16px;
    flex-shrink: 0;
}

.mini-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 40px;
}

.mini-val {
    font-size: 15px;
    font-weight: 700;
    color: #10b981;
}

.mini-label {
    font-size: 10px;
    color: #4a5568;
    margin-top: 1px;
}

/* Empty */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 64px 24px;
    text-align: center;
}

.empty-state h3 {
    margin: 16px 0 6px;
    font-size: 18px;
    font-weight: 600;
    color: #94a3b8;
}

.empty-state p {
    margin: 0 0 20px;
    color: #4a5568;
    font-size: 14px;
}

.btn-create-first {
    padding: 10px 22px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-create-first:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
}

/* Pagination */
.pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    margin-top: 24px;
    padding: 12px;
}

.page-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.05);
    color: #e2e8f0;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(16, 185, 129, 0.3);
}

.page-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.page-info {
    color: #64748b;
    font-size: 13px;
}

/* Responsive */
@media (max-width: 768px) {
    .category-page {
        padding: 16px;
    }

    .cat-hero {
        flex-direction: column;
        align-items: stretch;
    }

    .btn-create {
        justify-content: center;
    }

    .toolbar {
        flex-direction: column;
        align-items: stretch;
    }

    .sort-group {
        justify-content: center;
    }

    .topic-row {
        flex-direction: column;
        align-items: stretch;
    }

    .topic-row-stats {
        justify-content: flex-start;
        flex-direction: row;
        gap: 20px;
        padding-top: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.04);
    }

    .mini-stat {
        flex-direction: row;
        gap: 4px;
    }

    .topic-title {
        max-width: 100%;
    }
}
</style>
