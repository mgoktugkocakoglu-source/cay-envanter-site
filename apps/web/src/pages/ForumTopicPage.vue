<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useForumStore } from '@/stores/forumStore';
import { useAuthStore } from '@/stores/authStore';
import AppLayout from '@/layouts/AppLayout.vue';
import RichTextEditor from '@/components/forum/RichTextEditor.vue';
import RichContent from '@/components/forum/RichContent.vue';
import type { ReactionType } from '@/services/api';

const route = useRoute();
const router = useRouter();
const forumStore = useForumStore();
const authStore = useAuthStore();

const topicSlug = computed(() => route.params.slug as string);
const replyContent = ref('');
const isSubmitting = ref(false);
const replyToId = ref<string | null>(null);
const replyToAuthor = ref<string | null>(null);

onMounted(async () => {
    await forumStore.fetchTopic(topicSlug.value);
    if (forumStore.currentTopic) {
        await forumStore.fetchReplies(forumStore.currentTopic.id);
    }
});

const isTopicAuthor = computed(() => {
    return forumStore.currentTopic?.authorId === authStore.user?.id;
});

async function handleReact(type: ReactionType) {
    if (!authStore.isAuthenticated || !forumStore.currentTopic) return;
    await forumStore.toggleReaction('topic', forumStore.currentTopic.id, type);
}

async function handleReplyReact(replyId: string, type: ReactionType) {
    if (!authStore.isAuthenticated) return;
    await forumStore.toggleReaction('reply', replyId, type);
}

async function handleSubscribe() {
    if (!authStore.isAuthenticated || !forumStore.currentTopic) return;
    if (forumStore.currentTopic.isSubscribed) {
        await forumStore.unsubscribeFromTopic(forumStore.currentTopic.id);
    } else {
        await forumStore.subscribeToTopic(forumStore.currentTopic.id);
    }
}

async function handleSubmitReply() {
    if (!replyContent.value.trim() || !forumStore.currentTopic || isSubmitting.value) return;
    // Strip empty editor content
    const stripped = replyContent.value.replace(/<[^>]*>/g, '').trim();
    if (!stripped) return;

    isSubmitting.value = true;
    const result = await forumStore.createReply({
        content: replyContent.value,
        topicId: forumStore.currentTopic.id,
        parentId: replyToId.value || undefined,
    });

    if (result) {
        replyContent.value = '';
        replyToId.value = null;
        replyToAuthor.value = null;
    }
    isSubmitting.value = false;
}

function handleReplyTo(replyId: string, authorName: string) {
    replyToId.value = replyId;
    replyToAuthor.value = authorName;
    const replyForm = document.querySelector('.reply-form');
    replyForm?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelReplyTo() {
    replyToId.value = null;
    replyToAuthor.value = null;
}

async function handleMarkAsSolution(replyId: string) {
    if (!isTopicAuthor.value) return;
    await forumStore.markAsSolution(replyId);
}

async function handleDeleteReply(replyId: string) {
    if (!confirm('Bu cevabi silmek istediginize emin misiniz?')) return;
    await forumStore.deleteReply(replyId);
}

async function handleTogglePin() {
    if (!forumStore.currentTopic) return;
    await forumStore.togglePin(forumStore.currentTopic.id);
}

async function handleToggleLock() {
    if (!forumStore.currentTopic) return;
    await forumStore.toggleLock(forumStore.currentTopic.id);
}

async function handleToggleSolve() {
    if (!forumStore.currentTopic) return;
    await forumStore.toggleSolve(forumStore.currentTopic.id);
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
    if (diffDays < 7) return `${diffDays} gun once`;
    return date.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function getReactionIcon(type: ReactionType) {
    const icons = { like: '👍', helpful: '💡', thanks: '🙏' };
    return icons[type];
}

function getReactionLabel(type: ReactionType) {
    const labels = { like: 'Begeni', helpful: 'Yardimci', thanks: 'Tesekkur' };
    return labels[type];
}

function isReplyAuthor(authorId: string) {
    return authorId === authStore.user?.id;
}

function getInitials(name?: string) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
</script>

<template>
    <AppLayout>
        <div class="topic-page">
            <!-- Loading -->
            <div v-if="forumStore.loading && !forumStore.currentTopic" class="loading-state">
                <div class="spinner"></div>
                <p>Konu yukleniyor...</p>
            </div>

            <!-- Topic Content -->
            <div v-else-if="forumStore.currentTopic" class="topic-container">
                <!-- Breadcrumb -->
                <nav class="breadcrumb">
                    <router-link to="/forum" class="bc-link">Forum</router-link>
                    <span class="bc-sep">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                    </span>
                    <router-link
                        v-if="forumStore.currentTopic.category"
                        :to="`/forum/category/${forumStore.currentTopic.category.slug}`"
                        class="bc-link"
                    >
                        {{ forumStore.currentTopic.category.name }}
                    </router-link>
                    <span class="bc-sep">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                    </span>
                    <span class="bc-current">{{ forumStore.currentTopic.title }}</span>
                </nav>

                <!-- Topic Card -->
                <article class="topic-card">
                    <div class="topic-card-header">
                        <div class="topic-title-row">
                            <div class="badges" v-if="forumStore.currentTopic.isPinned || forumStore.currentTopic.isSolved || forumStore.currentTopic.isLocked">
                                <span v-if="forumStore.currentTopic.isPinned" class="badge badge-pinned">Sabitlenmis</span>
                                <span v-if="forumStore.currentTopic.isSolved" class="badge badge-solved">Cozuldu</span>
                                <span v-if="forumStore.currentTopic.isLocked" class="badge badge-locked">Kilitli</span>
                            </div>
                            <h1 class="topic-title">{{ forumStore.currentTopic.title }}</h1>
                        </div>
                        <div class="topic-meta-row">
                            <div class="author-info">
                                <div class="avatar">{{ getInitials(forumStore.currentTopic.author?.fullName) }}</div>
                                <div class="meta-text">
                                    <span class="author-name">{{ forumStore.currentTopic.author?.fullName }}</span>
                                    <span class="meta-dot">·</span>
                                    <span class="meta-date">{{ formatDate(forumStore.currentTopic.createdAt) }}</span>
                                </div>
                            </div>
                            <div class="topic-stats-inline">
                                <span class="stat-item">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    {{ forumStore.currentTopic.viewCount }}
                                </span>
                                <span class="stat-item">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                                    {{ forumStore.currentTopic.replyCount }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="topic-card-body">
                        <RichContent :content="forumStore.currentTopic.content" />
                    </div>

                    <div class="topic-card-footer">
                        <div class="reactions">
                            <button
                                v-for="type in (['like', 'helpful', 'thanks'] as ReactionType[])"
                                :key="type"
                                :class="{ active: forumStore.currentTopic.reactions?.userReaction === type }"
                                :disabled="!authStore.isAuthenticated"
                                class="reaction-chip"
                                @click="handleReact(type)"
                            >
                                <span class="reaction-emoji">{{ getReactionIcon(type) }}</span>
                                <span class="reaction-label">{{ getReactionLabel(type) }}</span>
                                <span v-if="(forumStore.currentTopic.reactions?.[type] || 0) > 0" class="reaction-count">{{ forumStore.currentTopic.reactions?.[type] }}</span>
                            </button>
                        </div>
                        <div class="footer-actions">
                            <button
                                v-if="authStore.isAuthenticated"
                                :class="{ active: forumStore.currentTopic.isSubscribed }"
                                class="icon-btn"
                                @click="handleSubscribe"
                                :title="forumStore.currentTopic.isSubscribed ? 'Takibi Birak' : 'Takip Et'"
                            >
                                <svg v-if="forumStore.currentTopic.isSubscribed" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                            </button>
                        </div>
                    </div>

                    <!-- Admin Controls -->
                    <div v-if="isTopicAuthor" class="admin-bar">
                        <button class="admin-btn" @click="handleTogglePin">
                            {{ forumStore.currentTopic.isPinned ? 'Sabitlemeyi Kaldir' : 'Sabitle' }}
                        </button>
                        <button class="admin-btn" @click="handleToggleLock">
                            {{ forumStore.currentTopic.isLocked ? 'Kilidi Ac' : 'Kilitle' }}
                        </button>
                        <button class="admin-btn" @click="handleToggleSolve">
                            {{ forumStore.currentTopic.isSolved ? 'Cozuldu Kaldir' : 'Cozuldu Isaretle' }}
                        </button>
                    </div>
                </article>

                <!-- Replies Section -->
                <section class="replies-section">
                    <div class="section-header">
                        <h2>Cevaplar</h2>
                        <span class="reply-count-badge">{{ forumStore.replies.length }}</span>
                    </div>

                    <!-- Reply List -->
                    <div v-for="reply in forumStore.replies" :key="reply.id" class="reply-card" :class="{ 'is-solution': reply.isSolution }">
                        <div v-if="reply.isSolution" class="solution-ribbon">Cozum</div>
                        <div class="reply-top">
                            <div class="reply-author-info">
                                <div class="avatar avatar-sm">{{ getInitials(reply.author?.fullName) }}</div>
                                <span class="author-name">{{ reply.author?.fullName }}</span>
                                <span class="meta-dot">·</span>
                                <span class="meta-date">{{ formatDate(reply.createdAt) }}</span>
                            </div>
                            <div class="reply-actions-menu">
                                <button
                                    v-if="isTopicAuthor && !reply.isSolution"
                                    class="text-btn text-btn-green"
                                    @click="handleMarkAsSolution(reply.id)"
                                >
                                    Cozum Isaretle
                                </button>
                                <button
                                    v-if="authStore.isAuthenticated && !forumStore.currentTopic.isLocked"
                                    class="text-btn"
                                    @click="handleReplyTo(reply.id, reply.author?.fullName || 'Kullanici')"
                                >
                                    Cevapla
                                </button>
                                <button
                                    v-if="isReplyAuthor(reply.authorId)"
                                    class="text-btn text-btn-red"
                                    @click="handleDeleteReply(reply.id)"
                                >
                                    Sil
                                </button>
                            </div>
                        </div>
                        <div class="reply-body">
                            <RichContent :content="reply.content" />
                        </div>
                        <div class="reply-bottom">
                            <div class="reactions reactions-sm">
                                <button
                                    v-for="type in (['like', 'helpful', 'thanks'] as ReactionType[])"
                                    :key="type"
                                    :class="{ active: reply.reactions?.userReaction === type }"
                                    :disabled="!authStore.isAuthenticated"
                                    class="reaction-chip reaction-chip-sm"
                                    @click="handleReplyReact(reply.id, type)"
                                >
                                    <span class="reaction-emoji">{{ getReactionIcon(type) }}</span>
                                    <span v-if="(reply.reactions?.[type] || 0) > 0" class="reaction-count">{{ reply.reactions?.[type] }}</span>
                                </button>
                            </div>
                        </div>

                        <!-- Nested Child Replies -->
                        <div v-if="reply.replies && reply.replies.length > 0" class="nested-replies">
                            <div v-for="child in reply.replies" :key="child.id" class="reply-card reply-card-nested" :class="{ 'is-solution': child.isSolution }">
                                <div v-if="child.isSolution" class="solution-ribbon">Cozum</div>
                                <div class="reply-top">
                                    <div class="reply-author-info">
                                        <div class="avatar avatar-xs">{{ getInitials(child.author?.fullName) }}</div>
                                        <span class="author-name">{{ child.author?.fullName }}</span>
                                        <span class="meta-dot">·</span>
                                        <span class="meta-date">{{ formatDate(child.createdAt) }}</span>
                                    </div>
                                    <div class="reply-actions-menu">
                                        <button
                                            v-if="isTopicAuthor && !child.isSolution"
                                            class="text-btn text-btn-green"
                                            @click="handleMarkAsSolution(child.id)"
                                        >
                                            Cozum Isaretle
                                        </button>
                                        <button
                                            v-if="isReplyAuthor(child.authorId)"
                                            class="text-btn text-btn-red"
                                            @click="handleDeleteReply(child.id)"
                                        >
                                            Sil
                                        </button>
                                    </div>
                                </div>
                                <div class="reply-body">
                                    <RichContent :content="child.content" />
                                </div>
                                <div class="reply-bottom">
                                    <div class="reactions reactions-sm">
                                        <button
                                            v-for="type in (['like', 'helpful', 'thanks'] as ReactionType[])"
                                            :key="type"
                                            :class="{ active: child.reactions?.userReaction === type }"
                                            :disabled="!authStore.isAuthenticated"
                                            class="reaction-chip reaction-chip-sm"
                                            @click="handleReplyReact(child.id, type)"
                                        >
                                            <span class="reaction-emoji">{{ getReactionIcon(type) }}</span>
                                            <span v-if="(child.reactions?.[type] || 0) > 0" class="reaction-count">{{ child.reactions?.[type] }}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Empty Replies -->
                    <div v-if="forumStore.replies.length === 0 && !forumStore.loading" class="empty-replies">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4a5568" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                        <p>Henuz cevap yok. Ilk cevaplayan siz olun!</p>
                    </div>
                </section>

                <!-- Reply Form -->
                <section v-if="authStore.isAuthenticated && !forumStore.currentTopic.isLocked" class="reply-form">
                    <h3>Cevap Yaz</h3>

                    <div v-if="replyToAuthor" class="reply-to-bar">
                        <span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 00-4-4H4"/></svg>
                            {{ replyToAuthor }} kullanicisina cevap
                        </span>
                        <button class="close-btn" @click="cancelReplyTo">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>

                    <RichTextEditor
                        v-model="replyContent"
                        placeholder="Cevabnizi yazin..."
                        min-height="150px"
                    />

                    <div class="form-actions">
                        <button
                            :disabled="!replyContent.trim() || isSubmitting"
                            class="btn-primary"
                            @click="handleSubmitReply"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                            {{ isSubmitting ? 'Gonderiliyor...' : 'Cevabi Gonder' }}
                        </button>
                    </div>
                </section>

                <!-- Locked -->
                <div v-else-if="forumStore.currentTopic.isLocked" class="locked-msg">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    Bu konu kilitli. Yeni cevap eklenemez.
                </div>

                <!-- Login Prompt -->
                <div v-else class="login-prompt">
                    <p>Bu konuya cevap vermek icin lutfen <router-link to="/login">giris yapin</router-link>.</p>
                </div>
            </div>

            <!-- Error -->
            <div v-else-if="forumStore.error" class="error-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                <p>{{ forumStore.error }}</p>
                <button class="btn-secondary" @click="router.push('/forum')">Foruma Don</button>
            </div>
        </div>
    </AppLayout>
</template>

<style scoped>
.topic-page {
    padding: 24px;
    max-width: 960px;
    margin: 0 auto;
}

/* Loading */
.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 24px;
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

/* Breadcrumb */
.breadcrumb {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 24px;
    font-size: 14px;
    flex-wrap: wrap;
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
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 300px;
}

/* Topic Card */
.topic-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    overflow: hidden;
    margin-bottom: 32px;
}

.topic-card-header {
    padding: 24px 28px 0;
}

.topic-title-row {
    margin-bottom: 16px;
}

.badges {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
}

.badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.3px;
    text-transform: uppercase;
}

.badge-pinned {
    background: rgba(251, 191, 36, 0.15);
    color: #fbbf24;
}

.badge-solved {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
}

.badge-locked {
    background: rgba(100, 116, 139, 0.15);
    color: #94a3b8;
}

.topic-title {
    margin: 0;
    font-size: 28px;
    font-weight: 700;
    color: #f1f5f9;
    line-height: 1.3;
}

.topic-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-wrap: wrap;
    gap: 12px;
}

.author-info {
    display: flex;
    align-items: center;
    gap: 10px;
}

.avatar {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    flex-shrink: 0;
}

.avatar-sm {
    width: 30px;
    height: 30px;
    font-size: 11px;
    border-radius: 8px;
}

.avatar-xs {
    width: 26px;
    height: 26px;
    font-size: 10px;
    border-radius: 7px;
}

.meta-text {
    display: flex;
    align-items: center;
    gap: 6px;
}

.author-name {
    color: #e2e8f0;
    font-weight: 600;
    font-size: 14px;
}

.meta-dot {
    color: #374151;
}

.meta-date {
    color: #64748b;
    font-size: 13px;
}

.topic-stats-inline {
    display: flex;
    gap: 16px;
}

.stat-item {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #64748b;
    font-size: 13px;
}

.stat-item svg {
    opacity: 0.6;
}

.topic-card-body {
    padding: 24px 28px;
}

/* Topic Footer */
.topic-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 28px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    flex-wrap: wrap;
    gap: 12px;
}

.footer-actions {
    display: flex;
    gap: 8px;
}

.icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s;
}

.icon-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #e2e8f0;
}

.icon-btn.active {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.3);
    color: #10b981;
}

/* Reactions */
.reactions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.reaction-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    color: #94a3b8;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
}

.reaction-chip:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
}

.reaction-chip:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.reaction-chip.active {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.4);
    color: #10b981;
}

.reaction-chip-sm {
    padding: 4px 10px;
    font-size: 12px;
    gap: 4px;
}

.reaction-emoji {
    font-size: 15px;
}

.reaction-chip-sm .reaction-emoji {
    font-size: 13px;
}

.reaction-label {
    font-size: 13px;
}

.reaction-count {
    font-weight: 600;
    font-size: 12px;
    min-width: 14px;
    text-align: center;
}

/* Admin Bar */
.admin-bar {
    display: flex;
    gap: 8px;
    padding: 12px 28px;
    background: rgba(251, 191, 36, 0.04);
    border-top: 1px solid rgba(251, 191, 36, 0.1);
    flex-wrap: wrap;
}

.admin-btn {
    padding: 6px 14px;
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid rgba(251, 191, 36, 0.2);
    border-radius: 8px;
    color: #fbbf24;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.admin-btn:hover {
    background: rgba(251, 191, 36, 0.15);
}

/* Replies Section */
.replies-section {
    margin-bottom: 32px;
}

.section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
}

.section-header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #f1f5f9;
}

.reply-count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 8px;
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 700;
}

/* Reply Card */
.reply-card {
    position: relative;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 20px 24px;
    margin-bottom: 12px;
    transition: border-color 0.2s;
}

.reply-card:hover {
    border-color: rgba(255, 255, 255, 0.12);
}

.reply-card.is-solution {
    border-color: rgba(16, 185, 129, 0.3);
    background: rgba(16, 185, 129, 0.03);
}

.solution-ribbon {
    position: absolute;
    top: 12px;
    right: 16px;
    padding: 3px 10px;
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.reply-card-nested {
    background: rgba(255, 255, 255, 0.02);
    border-color: rgba(255, 255, 255, 0.06);
    padding: 16px 20px;
    margin-bottom: 8px;
}

.reply-card-nested:last-child {
    margin-bottom: 0;
}

.reply-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 8px;
}

.reply-author-info {
    display: flex;
    align-items: center;
    gap: 8px;
}

.reply-actions-menu {
    display: flex;
    gap: 8px;
    align-items: center;
}

.text-btn {
    background: none;
    border: none;
    color: #64748b;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: all 0.15s;
}

.text-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #e2e8f0;
}

.text-btn-green:hover {
    color: #10b981;
    background: rgba(16, 185, 129, 0.1);
}

.text-btn-red {
    color: #64748b;
}

.text-btn-red:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
}

.reply-body {
    margin-bottom: 12px;
}

.reply-bottom {
    padding-top: 8px;
}

/* Nested Replies */
.nested-replies {
    margin-top: 12px;
    padding-left: 20px;
    border-left: 2px solid rgba(16, 185, 129, 0.2);
}

/* Empty Replies */
.empty-replies {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 24px;
    text-align: center;
    color: #4a5568;
}

.empty-replies p {
    margin: 16px 0 0;
    color: #64748b;
    font-size: 15px;
}

/* Reply Form */
.reply-form {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 24px;
}

.reply-form h3 {
    margin: 0 0 16px;
    font-size: 18px;
    font-weight: 600;
    color: #f1f5f9;
}

.reply-to-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.15);
    border-radius: 10px;
    margin-bottom: 16px;
    font-size: 14px;
    color: #10b981;
}

.reply-to-bar span {
    display: flex;
    align-items: center;
    gap: 6px;
}

.close-btn {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 2px;
    display: flex;
    transition: color 0.2s;
}

.close-btn:hover {
    color: #e2e8f0;
}

.form-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
}

.btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
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

.btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
}

.btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
}

.btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 22px;
    background: rgba(255, 255, 255, 0.06);
    color: #e2e8f0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-secondary:hover {
    background: rgba(255, 255, 255, 0.1);
}

/* Locked / Login */
.locked-msg {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 20px;
    background: rgba(100, 116, 139, 0.08);
    border: 1px solid rgba(100, 116, 139, 0.15);
    border-radius: 12px;
    color: #94a3b8;
    font-size: 14px;
}

.login-prompt {
    padding: 24px;
    background: rgba(16, 185, 129, 0.05);
    border: 1px solid rgba(16, 185, 129, 0.15);
    border-radius: 12px;
    text-align: center;
}

.login-prompt p {
    margin: 0;
    color: #94a3b8;
    font-size: 15px;
}

.login-prompt a {
    color: #10b981;
    text-decoration: none;
    font-weight: 600;
}

.login-prompt a:hover {
    text-decoration: underline;
}

/* Error */
.error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 80px 24px;
    text-align: center;
}

.error-state p {
    margin: 16px 0 24px;
    color: #94a3b8;
    font-size: 15px;
}

/* Responsive */
@media (max-width: 768px) {
    .topic-page {
        padding: 16px;
    }

    .topic-title {
        font-size: 22px;
    }

    .topic-card-header,
    .topic-card-body,
    .topic-card-footer,
    .admin-bar {
        padding-left: 16px;
        padding-right: 16px;
    }

    .reply-card {
        padding: 16px;
    }

    .reply-form {
        padding: 16px;
    }

    .nested-replies {
        padding-left: 12px;
    }

    .topic-meta-row {
        flex-direction: column;
        align-items: flex-start;
    }

    .reactions {
        gap: 6px;
    }

    .reaction-chip {
        padding: 5px 10px;
    }

    .reaction-label {
        display: none;
    }
}
</style>
