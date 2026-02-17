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

const paginationPages = computed(() => {
    const total = forumStore.topicsMeta.totalPages;
    const current = currentPage.value;
    const pages: (number | string)[] = [];

    if (total <= 5) {
        for (let i = 1; i <= total; i++) pages.push(i);
    } else {
        pages.push(1);
        if (current > 3) pages.push('...');
        for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
            pages.push(i);
        }
        if (current < total - 2) pages.push('...');
        pages.push(total);
    }
    return pages;
});
</script>

<template>
    <AppLayout>
        <div class="category-page">
            <!-- Breadcrumb -->
            <nav class="breadcrumb">
                <router-link to="/forum" class="bc-link">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    Forum
                </router-link>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                <span class="bc-current">{{ forumStore.currentCategory?.name }}</span>
            </nav>

            <!-- Category Header -->
            <header class="cat-header">
                <div class="cat-header-left">
                    <span class="cat-icon">{{ forumStore.currentCategory?.icon || '📁' }}</span>
                    <div>
                        <h1>{{ forumStore.currentCategory?.name }}</h1>
                        <p v-if="forumStore.currentCategory?.description">{{ forumStore.currentCategory.description }}</p>
                    </div>
                </div>
                <button v-if="authStore.isAuthenticated" class="btn-new" @click="handleCreateTopic">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Yeni Konu
                </button>
            </header>

            <!-- Toolbar -->
            <div class="toolbar">
                <span class="topic-count">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    {{ forumStore.topicsMeta.total }} konu
                </span>
                <div class="sort-tabs">
                    <button :class="{ active: sortBy === 'lastActivityAt' }" @click="handleSortChange('latest')">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        En Yeni
                    </button>
                    <button :class="{ active: sortBy === 'replyCount' }" @click="handleSortChange('popular')">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                        Populer
                    </button>
                    <button :class="{ active: sortBy === 'viewCount' }" @click="handleSortChange('views')">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        Goruntulenen
                    </button>
                </div>
            </div>

            <!-- Loading -->
            <div v-if="forumStore.loading" class="state-box">
                <div class="spinner"></div>
                <p>Konular yukleniyor...</p>
            </div>

            <!-- Topics -->
            <div v-else class="topic-list">
                <!-- Pinned -->
                <template v-if="forumStore.pinnedTopics.length > 0">
                    <div class="section-tag">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2l0 20"/><path d="M5 12l14 0"/></svg>
                        Sabitlenmis
                    </div>
                    <div
                        v-for="(topic, index) in forumStore.pinnedTopics"
                        :key="topic.id"
                        class="topic-row pinned"
                        :style="{ animationDelay: `${index * 40}ms` }"
                        @click="handleTopicClick(topic.slug)"
                    >
                        <div class="topic-left">
                            <div class="avatar">{{ getInitials(topic.author?.fullName) }}</div>
                            <div class="topic-info">
                                <div class="topic-title-line">
                                    <span class="pin-badge">
                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>
                                        PIN
                                    </span>
                                    <h3>{{ topic.title }}</h3>
                                    <span v-if="topic.isSolved" class="tag tag-solved">Cozuldu</span>
                                    <span v-if="topic.isLocked" class="tag tag-locked">Kilitli</span>
                                </div>
                                <div class="topic-meta">
                                    <span class="meta-author">{{ topic.author?.fullName }}</span>
                                    <span class="meta-sep">·</span>
                                    <span>{{ formatDate(topic.createdAt) }}</span>
                                </div>
                            </div>
                        </div>
                        <div class="topic-stats">
                            <div class="stat" title="Cevaplar">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                                <span class="stat-val">{{ topic.replyCount }}</span>
                            </div>
                            <div class="stat" title="Goruntulenme">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                <span class="stat-val">{{ topic.viewCount }}</span>
                            </div>
                        </div>
                    </div>
                </template>

                <!-- Regular -->
                <template v-if="forumStore.regularTopics.length > 0">
                    <div v-if="forumStore.pinnedTopics.length > 0" class="section-tag">Konular</div>
                    <div
                        v-for="(topic, index) in forumStore.regularTopics"
                        :key="topic.id"
                        class="topic-row"
                        :style="{ animationDelay: `${(forumStore.pinnedTopics.length + index) * 40}ms` }"
                        @click="handleTopicClick(topic.slug)"
                    >
                        <div class="topic-left">
                            <div class="avatar">{{ getInitials(topic.author?.fullName) }}</div>
                            <div class="topic-info">
                                <div class="topic-title-line">
                                    <h3>{{ topic.title }}</h3>
                                    <span v-if="topic.isSolved" class="tag tag-solved">Cozuldu</span>
                                    <span v-if="topic.isLocked" class="tag tag-locked">Kilitli</span>
                                </div>
                                <div class="topic-meta">
                                    <span class="meta-author">{{ topic.author?.fullName }}</span>
                                    <span class="meta-sep">·</span>
                                    <span>{{ formatDate(topic.createdAt) }}</span>
                                </div>
                            </div>
                        </div>
                        <div class="topic-stats">
                            <div class="stat" title="Cevaplar">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                                <span class="stat-val">{{ topic.replyCount }}</span>
                            </div>
                            <div class="stat" title="Goruntulenme">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                <span class="stat-val">{{ topic.viewCount }}</span>
                            </div>
                        </div>
                    </div>
                </template>

                <!-- Empty -->
                <div v-if="forumStore.topics.length === 0 && !forumStore.loading" class="state-box">
                    <div class="empty-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    </div>
                    <h3>Henuz Konu Yok</h3>
                    <p>Bu kategoride ilk tartismayi baslatin!</p>
                    <button v-if="authStore.isAuthenticated" class="btn-new" style="margin-top: 16px" @click="handleCreateTopic">Ilk Konuyu Olustur</button>
                </div>
            </div>

            <!-- Pagination -->
            <div v-if="forumStore.topicsMeta.totalPages > 1" class="pagination">
                <button :disabled="currentPage === 1" class="page-btn" @click="handlePageChange(currentPage - 1)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <div class="page-numbers">
                    <template v-for="(page, idx) in paginationPages" :key="idx">
                        <span v-if="page === '...'" class="page-dots">...</span>
                        <button
                            v-else
                            :class="['page-num', { active: currentPage === page }]"
                            @click="handlePageChange(page as number)"
                        >{{ page }}</button>
                    </template>
                </div>
                <button :disabled="currentPage === forumStore.topicsMeta.totalPages" class="page-btn" @click="handlePageChange(currentPage + 1)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                </button>
            </div>
        </div>
    </AppLayout>
</template>

<style scoped>
.category-page { padding: 24px; max-width: 900px; margin: 0 auto; }

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
    color: #64748b;
    text-decoration: none;
    transition: color 0.15s;
}
.bc-link:hover { color: #10b981; }
.bc-current { color: #94a3b8; font-weight: 500; }

/* Category Header */
.cat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;
}

.cat-header-left {
    display: flex;
    align-items: center;
    gap: 14px;
}

.cat-icon {
    font-size: 28px;
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(16, 185, 129, 0.06);
    border-radius: 14px;
    flex-shrink: 0;
}

.cat-header h1 { margin: 0; font-size: 22px; font-weight: 700; color: #f1f5f9; }
.cat-header p { margin: 2px 0 0; font-size: 13px; color: #64748b; }

.btn-new {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
}
.btn-new:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3); }
.btn-new:active { transform: translateY(0); }

/* Toolbar */
.toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 8px;
}

.topic-count {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: #64748b;
    font-weight: 500;
}

.topic-count svg { opacity: 0.5; }

.sort-tabs { display: flex; gap: 2px; }

.sort-tabs button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    background: transparent;
    color: #64748b;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
}
.sort-tabs button:hover { color: #e2e8f0; background: rgba(255, 255, 255, 0.04); }
.sort-tabs button.active { background: rgba(16, 185, 129, 0.12); color: #10b981; }

/* Loading & States */
.state-box { display: flex; flex-direction: column; align-items: center; padding: 60px 20px; text-align: center; }
.state-box h3 { margin: 14px 0 4px; font-size: 16px; font-weight: 600; color: #94a3b8; }
.state-box p { margin: 0; color: #64748b; font-size: 14px; }

.empty-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 14px;
    color: #4a5568;
}

.spinner { width: 36px; height: 36px; border: 3px solid rgba(255, 255, 255, 0.06); border-top-color: #10b981; border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
}

/* Topic List */
.topic-list { display: flex; flex-direction: column; gap: 6px; }

.section-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    font-weight: 700;
    color: #4a5568;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    padding: 10px 0 2px;
}

.section-tag svg { opacity: 0.5; }

.topic-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    animation: fadeInUp 0.3s ease both;
}
.topic-row:hover { background: rgba(255, 255, 255, 0.04); border-color: rgba(16, 185, 129, 0.2); transform: translateX(2px); }
.topic-row.pinned { border-color: rgba(251, 191, 36, 0.12); background: rgba(251, 191, 36, 0.02); }
.topic-row.pinned:hover { border-color: rgba(251, 191, 36, 0.25); }

.topic-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }

.avatar {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #10b981, #059669);
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; color: #fff; flex-shrink: 0;
    transition: transform 0.15s;
}

.topic-row:hover .avatar { transform: scale(1.05); }

.topic-info { min-width: 0; }

.topic-title-line { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

.topic-title-line h3 {
    margin: 0; font-size: 14px; font-weight: 600; color: #f1f5f9;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 380px;
    transition: color 0.15s;
}

.topic-row:hover .topic-title-line h3 { color: #10b981; }

.pin-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 9px; font-weight: 800; color: #fbbf24;
    background: rgba(251, 191, 36, 0.12); padding: 2px 6px;
    border-radius: 4px; letter-spacing: 0.5px;
}

.tag { display: inline-flex; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 600; white-space: nowrap; }
.tag-solved { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.tag-locked { background: rgba(100, 116, 139, 0.1); color: #94a3b8; }

.topic-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #4a5568;
    margin-top: 3px;
}

.meta-author { color: #64748b; font-weight: 500; }
.meta-sep { opacity: 0.5; }

.topic-stats { display: flex; gap: 12px; flex-shrink: 0; }

.stat {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #4a5568;
    transition: color 0.15s;
}

.stat svg { opacity: 0.5; }
.stat-val { font-size: 13px; font-weight: 600; color: #64748b; }

.topic-row:hover .stat { color: #64748b; }
.topic-row:hover .stat-val { color: #94a3b8; }

/* Pagination */
.pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    margin-top: 24px;
}

.page-numbers {
    display: flex;
    align-items: center;
    gap: 4px;
}

.page-btn {
    display: flex; align-items: center; justify-content: center;
    width: 34px; height: 34px;
    background: rgba(255, 255, 255, 0.04); color: #e2e8f0;
    border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px;
    cursor: pointer; transition: all 0.15s;
}
.page-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.08); border-color: rgba(16, 185, 129, 0.25); }
.page-btn:disabled { opacity: 0.25; cursor: not-allowed; }

.page-num {
    display: flex; align-items: center; justify-content: center;
    min-width: 34px; height: 34px; padding: 0 8px;
    background: rgba(255, 255, 255, 0.03); color: #94a3b8;
    border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px;
    cursor: pointer; transition: all 0.15s; font-size: 13px; font-weight: 500;
}
.page-num:hover { background: rgba(255, 255, 255, 0.06); color: #e2e8f0; }
.page-num.active { background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.3); color: #10b981; font-weight: 700; }

.page-dots { color: #4a5568; font-size: 12px; padding: 0 4px; }

/* Responsive */
@media (max-width: 640px) {
    .category-page { padding: 16px; }
    .cat-header { flex-direction: column; align-items: stretch; }
    .btn-new { justify-content: center; }
    .toolbar { flex-direction: column; align-items: stretch; }
    .sort-tabs { justify-content: center; }
    .topic-row { flex-direction: column; align-items: stretch; }
    .topic-stats { flex-direction: row; gap: 16px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.04); }
    .topic-title-line h3 { max-width: 100%; }
}
</style>
