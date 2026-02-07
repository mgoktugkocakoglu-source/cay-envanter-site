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
            <!-- Hero Section -->
            <div class="hero">
                <div class="hero-content">
                    <h1>Topluluk Forumu</h1>
                    <p>Cay ureticileriyle baglanti kurun, deneyimlerinizi paylasin ve yardim alin</p>
                </div>
                <button v-if="authStore.isAuthenticated" class="btn-create" @click="handleCreateTopic">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Yeni Konu
                </button>
            </div>

            <!-- Search -->
            <div class="search-wrapper">
                <div class="search-box">
                    <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Kategorilerde ara..."
                        class="search-input"
                    />
                    <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </div>

            <!-- Loading -->
            <div v-if="forumStore.loading" class="loading-state">
                <div class="spinner"></div>
                <p>Kategoriler yukleniyor...</p>
            </div>

            <!-- Error -->
            <div v-else-if="forumStore.error" class="error-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                <p>{{ forumStore.error }}</p>
                <button class="btn-retry" @click="forumStore.fetchCategories()">Tekrar Dene</button>
            </div>

            <!-- Categories -->
            <div v-else class="categories">
                <div
                    v-for="category in filteredCategories"
                    :key="category.id"
                    class="cat-card"
                    @click="handleCategoryClick(category)"
                >
                    <div class="cat-icon-wrap">
                        <span class="cat-icon">{{ category.icon || '📁' }}</span>
                    </div>
                    <div class="cat-body">
                        <div class="cat-header">
                            <h3 class="cat-name">{{ category.name }}</h3>
                            <span class="cat-count">{{ category.topicCount || 0 }} konu</span>
                        </div>
                        <p class="cat-desc">{{ category.description }}</p>
                        <div v-if="category.latestTopic" class="cat-latest">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                            <span class="latest-title">{{ category.latestTopic.title }}</span>
                            <span class="latest-meta">{{ category.latestTopic.author.fullName }} · {{ formatDate(category.latestTopic.createdAt) }}</span>
                        </div>
                    </div>
                    <svg class="cat-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                </div>

                <!-- Empty -->
                <div v-if="filteredCategories.length === 0" class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4a5568" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                    <h3>{{ searchQuery ? 'Sonuc bulunamadi' : 'Kategori Bulunamadi' }}</h3>
                    <p>{{ searchQuery ? 'Farkli bir arama deneyin' : 'Forum kategorileri olusturuldugunda burada gorunecektir.' }}</p>
                </div>
            </div>
        </div>
    </AppLayout>
</template>

<style scoped>
.forum-page {
    padding: 24px;
    max-width: 960px;
    margin: 0 auto;
}

/* Hero */
.hero {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 28px;
    gap: 20px;
    flex-wrap: wrap;
}

.hero-content h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 700;
    color: #f1f5f9;
}

.hero-content p {
    margin: 6px 0 0;
    font-size: 15px;
    color: #64748b;
}

.btn-create {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 22px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
}

.btn-create:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
}

/* Search */
.search-wrapper {
    margin-bottom: 24px;
}

.search-box {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    transition: all 0.2s;
}

.search-box:focus-within {
    border-color: rgba(16, 185, 129, 0.4);
    background: rgba(255, 255, 255, 0.06);
}

.search-icon {
    color: #4a5568;
    flex-shrink: 0;
}

.search-input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: #e2e8f0;
    font-size: 15px;
}

.search-input::placeholder {
    color: #4a5568;
}

.search-clear {
    background: none;
    border: none;
    color: #4a5568;
    cursor: pointer;
    padding: 2px;
    display: flex;
    transition: color 0.2s;
}

.search-clear:hover {
    color: #e2e8f0;
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

/* Error */
.error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 64px 24px;
    text-align: center;
}

.error-state p {
    margin: 16px 0;
    color: #94a3b8;
}

.btn-retry {
    padding: 8px 20px;
    background: rgba(255, 255, 255, 0.06);
    color: #e2e8f0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
}

.btn-retry:hover {
    background: rgba(255, 255, 255, 0.1);
}

/* Category Cards */
.categories {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.cat-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px 20px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.2s;
}

.cat-card:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(16, 185, 129, 0.3);
}

.cat-card:hover .cat-arrow {
    color: #10b981;
    transform: translateX(3px);
}

.cat-icon-wrap {
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(16, 185, 129, 0.08);
    border-radius: 12px;
    flex-shrink: 0;
}

.cat-icon {
    font-size: 26px;
}

.cat-body {
    flex: 1;
    min-width: 0;
}

.cat-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
}

.cat-name {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #f1f5f9;
}

.cat-count {
    font-size: 12px;
    color: #10b981;
    background: rgba(16, 185, 129, 0.1);
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 600;
    white-space: nowrap;
}

.cat-desc {
    margin: 0 0 6px;
    font-size: 13px;
    color: #64748b;
    line-height: 1.4;
}

.cat-latest {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #4a5568;
    overflow: hidden;
}

.cat-latest svg {
    flex-shrink: 0;
    opacity: 0.5;
}

.latest-title {
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
}

.latest-meta {
    white-space: nowrap;
    flex-shrink: 0;
}

.cat-arrow {
    color: #374151;
    flex-shrink: 0;
    transition: all 0.2s;
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
    margin: 0;
    color: #4a5568;
    font-size: 14px;
}

/* Responsive */
@media (max-width: 768px) {
    .forum-page {
        padding: 16px;
    }

    .hero {
        flex-direction: column;
        align-items: stretch;
    }

    .btn-create {
        justify-content: center;
    }

    .cat-card {
        padding: 14px 16px;
    }

    .cat-latest {
        display: none;
    }

    .cat-arrow {
        display: none;
    }
}
</style>
