<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useForumStore } from '@/stores/forumStore';
import { useAuthStore } from '@/stores/authStore';
import AppLayout from '@/layouts/AppLayout.vue';
import type { ForumCategory } from '@/services/api';

const router = useRouter();
const forumStore = useForumStore();
const authStore = useAuthStore();
const searchQuery = ref('');

onMounted(() => {
    forumStore.fetchCategories();
});

const filteredCategories = computed(() => {
    if (!searchQuery.value.trim()) return forumStore.activeCategories;
    const q = searchQuery.value.toLowerCase();
    return forumStore.activeCategories.filter(
        c => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
    );
});

const totalTopics = computed(() => {
    return forumStore.activeCategories.reduce((sum, c) => sum + (c.topicCount || 0), 0);
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

    if (diffMins < 1) return 'az once';
    if (diffMins < 60) return `${diffMins} dk once`;
    if (diffHours < 24) return `${diffHours} sa once`;
    if (diffDays < 30) return `${diffDays} gun once`;
    return date.toLocaleDateString('tr-TR');
}
</script>

<template>
    <AppLayout>
        <div class="forum-page">
            <!-- Header -->
            <header class="page-header">
                <div class="header-left">
                    <div class="header-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    </div>
                    <div>
                        <h1>Topluluk Forumu</h1>
                        <p>Cay ureticileriyle baglanti kurun, deneyimlerinizi paylasin</p>
                    </div>
                </div>
                <button v-if="authStore.isAuthenticated" class="btn-new" @click="handleCreateTopic">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Yeni Konu
                </button>
            </header>

            <!-- Stats Bar -->
            <div class="stats-bar" v-if="!forumStore.loading && forumStore.activeCategories.length > 0">
                <div class="stat-chip">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                    <span>{{ forumStore.activeCategories.length }} kategori</span>
                </div>
                <div class="stat-chip">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    <span>{{ totalTopics }} konu</span>
                </div>
            </div>

            <!-- Search -->
            <div class="search-bar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="Kategorilerde ara..."
                />
                <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>

            <!-- Loading -->
            <div v-if="forumStore.loading" class="state-box">
                <div class="spinner"></div>
                <p>Kategoriler yukleniyor...</p>
            </div>

            <!-- Error -->
            <div v-else-if="forumStore.error" class="state-box state-error">
                <div class="error-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                </div>
                <p>{{ forumStore.error }}</p>
                <button class="btn-ghost" @click="forumStore.fetchCategories()">Tekrar Dene</button>
            </div>

            <!-- Categories Grid -->
            <div v-else class="categories-grid">
                <div
                    v-for="(category, index) in filteredCategories"
                    :key="category.id"
                    class="cat-card"
                    :style="{ animationDelay: `${index * 50}ms` }"
                    @click="handleCategoryClick(category)"
                >
                    <div class="cat-icon">{{ category.icon || '📁' }}</div>
                    <div class="cat-info">
                        <div class="cat-top">
                            <h3>{{ category.name }}</h3>
                            <span class="cat-badge" :title="`${category.topicCount || 0} konu`">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                                {{ category.topicCount || 0 }}
                            </span>
                        </div>
                        <p v-if="category.description" class="cat-desc">{{ category.description }}</p>
                    </div>
                    <div v-if="category.latestTopic" class="cat-latest">
                        <div class="latest-dot"></div>
                        <span class="latest-title">{{ category.latestTopic.title }}</span>
                        <span class="latest-sep">·</span>
                        <span class="latest-meta">{{ category.latestTopic.author.fullName }} · {{ formatDate(category.latestTopic.createdAt) }}</span>
                    </div>
                    <div class="cat-arrow">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                    </div>
                </div>

                <!-- Empty -->
                <div v-if="filteredCategories.length === 0" class="state-box">
                    <div class="empty-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                    </div>
                    <h3>{{ searchQuery ? 'Sonuc bulunamadi' : 'Kategori Yok' }}</h3>
                    <p>{{ searchQuery ? 'Farkli bir arama deneyin' : 'Forum kategorileri olusturuldugunda burada gorunecektir.' }}</p>
                </div>
            </div>
        </div>
    </AppLayout>
</template>

<style scoped>
.forum-page {
    padding: 24px;
    max-width: 900px;
    margin: 0 auto;
}

/* Header */
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;
}

.header-left {
    display: flex;
    align-items: flex-start;
    gap: 14px;
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

.header-left h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    color: var(--color-text-primary);
    letter-spacing: -0.5px;
}

.header-left p {
    margin: 4px 0 0;
    font-size: 14px;
    color: var(--color-text-muted);
}

.btn-new {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
}

.btn-new:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
}

.btn-new:active {
    transform: translateY(0);
}

/* Stats Bar */
.stats-bar {
    display: flex;
    gap: 10px;
    margin-bottom: 16px;
}

.stat-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    background: var(--color-subtle-bg);
    border: 1px solid var(--color-card-border);
    border-radius: 20px;
    color: var(--color-text-muted);
    font-size: 12px;
    font-weight: 500;
}

.stat-chip svg {
    opacity: 0.6;
}

/* Search */
.search-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--color-subtle-bg);
    border: 1px solid var(--color-card-border);
    border-radius: 10px;
    margin-bottom: 20px;
    transition: all 0.2s;
}

.search-bar:focus-within {
    border-color: rgba(16, 185, 129, 0.4);
    background: var(--color-card-bg-hover);
}

.search-bar svg { color: var(--color-text-muted); flex-shrink: 0; }

.search-bar input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: var(--color-text-primary);
    font-size: 14px;
}

.search-bar input::placeholder { color: var(--color-text-muted); }

.search-clear {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 2px;
    display: flex;
    transition: color 0.15s;
}

.search-clear:hover { color: var(--color-text-primary); }

/* Loading & States */
.state-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 60px 20px;
    text-align: center;
}

.state-box h3 { margin: 14px 0 4px; font-size: 16px; font-weight: 600; color: var(--color-text-secondary); }
.state-box p { margin: 0; color: var(--color-text-muted); font-size: 14px; }
.state-error p { margin: 12px 0 16px; }

.error-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 14px;
    color: var(--color-danger);
}

.empty-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-card-bg-hover);
    border-radius: 14px;
    color: var(--color-text-muted);
}

.spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--color-spinner-track);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}

.btn-ghost {
    padding: 7px 16px;
    background: var(--color-overlay-light);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-overlay-lighter);
    border-radius: 7px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
}

.btn-ghost:hover { background: var(--color-overlay-lighter); }

/* Categories Grid */
.categories-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.cat-card {
    display: grid;
    grid-template-columns: 48px 1fr auto;
    grid-template-rows: auto auto;
    gap: 0 14px;
    padding: 16px 18px;
    background: var(--color-card-bg);
    border: 1px solid var(--color-card-border);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    animation: fadeInUp 0.3s ease both;
    position: relative;
}

.cat-card:hover {
    background: var(--color-card-bg-hover);
    border-color: rgba(16, 185, 129, 0.25);
    transform: translateX(3px);
}

.cat-card:active {
    transform: translateX(1px);
}

.cat-icon {
    grid-row: 1 / 3;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    background: rgba(16, 185, 129, 0.06);
    border-radius: 12px;
    transition: transform 0.2s;
}

.cat-card:hover .cat-icon {
    transform: scale(1.05);
}

.cat-arrow {
    grid-row: 1 / 3;
    display: flex;
    align-items: center;
    color: var(--color-text-muted);
    transition: all 0.2s;
}

.cat-card:hover .cat-arrow {
    color: var(--color-primary);
    transform: translateX(3px);
}

.cat-info {
    min-width: 0;
}

.cat-top {
    display: flex;
    align-items: center;
    gap: 8px;
}

.cat-top h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text-primary);
    transition: color 0.15s;
}

.cat-card:hover .cat-top h3 {
    color: var(--color-primary);
}

.cat-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--color-primary);
    background: rgba(16, 185, 129, 0.1);
    padding: 2px 8px;
    border-radius: 8px;
    font-weight: 600;
    white-space: nowrap;
}

.cat-desc {
    margin: 3px 0 0;
    font-size: 13px;
    color: var(--color-text-muted);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.cat-latest {
    grid-column: 2;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--color-text-muted);
    margin-top: 6px;
    overflow: hidden;
}

.latest-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--color-primary);
    flex-shrink: 0;
    opacity: 0.5;
}

.latest-title {
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
}

.latest-sep {
    color: var(--color-text-muted);
    flex-shrink: 0;
}

.latest-meta {
    white-space: nowrap;
    flex-shrink: 0;
}

/* Responsive */
@media (max-width: 640px) {
    .forum-page { padding: 16px; }

    .page-header { flex-direction: column; align-items: stretch; }
    .btn-new { justify-content: center; }

    .header-icon { display: none; }

    .stats-bar { gap: 6px; }

    .cat-card {
        grid-template-columns: 40px 1fr;
        padding: 14px;
    }

    .cat-icon { width: 40px; height: 40px; font-size: 20px; }
    .cat-latest { display: none; }
    .cat-arrow { display: none; }
}
</style>
