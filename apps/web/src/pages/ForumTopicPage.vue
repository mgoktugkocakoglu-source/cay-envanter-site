<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useForumStore } from '@/stores/forumStore';
import { useAuthStore } from '@/stores/authStore';
import AppLayout from '@/layouts/AppLayout.vue';
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
    // Fetch topic directly by slug - backend supports fetching by slug
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
    // Scroll to reply form
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
    if (!confirm('Bu cevabı silmek istediğinize emin misiniz?')) return;
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
    return date.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getReactionIcon(type: ReactionType) {
    const icons = { like: '👍', helpful: '💡', thanks: '🙏' };
    return icons[type];
}

function isReplyAuthor(authorId: string) {
    return authorId === authStore.user?.id;
}
</script>

<template>
    <AppLayout>
        <div class="topic-page">
            <!-- Loading State -->
            <div v-if="forumStore.loading && !forumStore.currentTopic" class="loading-state">
                <div class="spinner"></div>
                <p>Konu yükleniyor...</p>
            </div>

            <!-- Topic Content -->
            <div v-else-if="forumStore.currentTopic" class="topic-container">
                <!-- Breadcrumb -->
                <div class="breadcrumb">
                    <router-link to="/forum" class="breadcrumb-link">Forum</router-link>
                    <span class="breadcrumb-separator">/</span>
                    <router-link
                        v-if="forumStore.currentTopic.category"
                        :to="`/forum/category/${forumStore.currentTopic.category.slug}`"
                        class="breadcrumb-link"
                    >
                        {{ forumStore.currentTopic.category.name }}
                    </router-link>
                    <span class="breadcrumb-separator">/</span>
                    <span class="breadcrumb-current">{{ forumStore.currentTopic.title }}</span>
                </div>

                <!-- Topic Header -->
                <div class="topic-header">
                    <div class="topic-title-section">
                        <h1>{{ forumStore.currentTopic.title }}</h1>
                        <div class="topic-badges">
                            <span v-if="forumStore.currentTopic.isPinned" class="badge pinned">📌 Sabitlenmiş</span>
                            <span v-if="forumStore.currentTopic.isSolved" class="badge solved">✓ Çözüldü</span>
                            <span v-if="forumStore.currentTopic.isLocked" class="badge locked">🔒 Kilitli</span>
                        </div>
                    </div>
                    <div class="topic-meta">
                        <span>by {{ forumStore.currentTopic.author?.fullName }}</span>
                        <span>·</span>
                        <span>{{ formatDate(forumStore.currentTopic.createdAt) }}</span>
                        <span>·</span>
                        <span>{{ forumStore.currentTopic.viewCount }} görüntülenme</span>
                    </div>
                </div>

                <!-- Topic Actions -->
                <div class="topic-actions">
                    <button
                        v-if="authStore.isAuthenticated"
                        :class="{ active: forumStore.currentTopic.isSubscribed }"
                        class="action-btn"
                        @click="handleSubscribe"
                    >
                        {{ forumStore.currentTopic.isSubscribed ? '🔔 Takip Ediliyor' : '🔕 Takip Et' }}
                    </button>
                    
                    <!-- Admin Controls (placeholder for role check) -->
                    <div v-if="isTopicAuthor" class="admin-controls">
                        <button class="action-btn admin" @click="handleTogglePin">
                            {{ forumStore.currentTopic.isPinned ? 'Sabitlemeyi Kaldır' : 'Sabitle' }}
                        </button>
                        <button class="action-btn admin" @click="handleToggleLock">
                            {{ forumStore.currentTopic.isLocked ? 'Kilidi Aç' : 'Kilitle' }}
                        </button>
                        <button class="action-btn admin" @click="handleToggleSolve">
                            {{ forumStore.currentTopic.isSolved ? 'Çözüldü İşaretini Kaldır' : 'Çözüldü Olarak İşaretle' }}
                        </button>
                    </div>
                </div>

                <!-- Topic Content Card -->
                <div class="topic-content-card">
                    <div class="content-body">
                        <p class="content-text">{{ forumStore.currentTopic.content }}</p>
                    </div>
                    
                    <!-- Reactions -->
                    <div class="reactions-section">
                        <button
                            v-for="type in ['like', 'helpful', 'thanks'] as ReactionType[]"
                            :key="type"
                            :class="{ active: forumStore.currentTopic.reactions?.userReaction === type }"
                            :disabled="!authStore.isAuthenticated"
                            class="reaction-btn"
                            @click="handleReact(type)"
                        >
                            <span class="reaction-icon">{{ getReactionIcon(type) }}</span>
                            <span class="reaction-count">{{ forumStore.currentTopic.reactions?.[type] || 0 }}</span>
                        </button>
                    </div>
                </div>

                <!-- Replies Section -->
                <div class="replies-section">
                    <h2 class="section-title">
                        {{ forumStore.replies.length }} {{ forumStore.replies.length === 1 ? 'Cevap' : 'Cevap' }}
                    </h2>

                    <!-- Reply Cards -->
                    <div v-for="reply in forumStore.replies" :key="reply.id" class="reply-card">
                        <div class="reply-header">
                            <div class="reply-author">
                                <span class="author-name">{{ reply.author?.fullName }}</span>
                                <span class="reply-date">{{ formatDate(reply.createdAt) }}</span>
                            </div>
                            <div class="reply-actions">
                                <span v-if="reply.isSolution" class="solution-badge">✓ Çözüm</span>
                                <button
                                    v-if="isTopicAuthor && !reply.isSolution"
                                    class="action-link"
                                    @click="handleMarkAsSolution(reply.id)"
                                >
                                    Çözüm Olarak İşaretle
                                </button>
                                <button
                                    v-if="authStore.isAuthenticated && !forumStore.currentTopic.isLocked"
                                    class="action-link"
                                    @click="handleReplyTo(reply.id, reply.author?.fullName || 'Kullanıcı')"
                                >
                                    Cevapla
                                </button>
                                <button
                                    v-if="isReplyAuthor(reply.authorId)"
                                    class="action-link delete"
                                    @click="handleDeleteReply(reply.id)"
                                >
                                    Sil
                                </button>
                            </div>
                        </div>
                        <div class="reply-content">
                            <p>{{ reply.content }}</p>
                        </div>
                        <div class="reply-reactions">
                            <button
                                v-for="type in ['like', 'helpful', 'thanks'] as ReactionType[]"
                                :key="type"
                                :class="{ active: reply.reactions?.userReaction === type }"
                                :disabled="!authStore.isAuthenticated"
                                class="reaction-btn small"
                                @click="handleReplyReact(reply.id, type)"
                            >
                                <span class="reaction-icon">{{ getReactionIcon(type) }}</span>
                                <span class="reaction-count">{{ reply.reactions?.[type] || 0 }}</span>
                            </button>
                        </div>
                    </div>

                    <!-- Empty State -->
                    <div v-if="forumStore.replies.length === 0" class="empty-replies">
                        <span class="empty-icon">💬</span>
                        <p>Henüz cevap yok. İlk cevaplayan siz olun!</p>
                    </div>
                </div>

                <!-- Reply Form -->
                <div v-if="authStore.isAuthenticated && !forumStore.currentTopic.isLocked" class="reply-form">
                    <h3>Cevap Yaz</h3>
                    
                    <!-- Reply To Indicator -->
                    <div v-if="replyToAuthor" class="reply-to-indicator">
                        <span>{{ replyToAuthor }} kullanıcısına cevap yazılıyor</span>
                        <button class="cancel-btn" @click="cancelReplyTo">✕</button>
                    </div>
                    
                    <textarea
                        v-model="replyContent"
                        class="reply-textarea"
                        placeholder="Cevabınızı yazın..."
                        rows="6"
                    ></textarea>
                    <div class="form-actions">
                        <button
                            :disabled="!replyContent.trim() || isSubmitting"
                            class="submit-btn"
                            @click="handleSubmitReply"
                        >
                            {{ isSubmitting ? 'Gönderiliyor...' : 'Cevabı Gönder' }}
                        </button>
                    </div>
                </div>

                <!-- Locked Message -->
                <div v-else-if="forumStore.currentTopic.isLocked" class="locked-message">
                    🔒 Bu konu kilitli. Yeni cevap eklenemez.
                </div>

                <!-- Login Prompt -->
                <div v-else class="login-prompt">
                    <p>Bu konuya cevap vermek için lütfen <router-link to="/login">giriş yapın</router-link>.</p>
                </div>
            </div>

            <!-- Error State -->
            <div v-else-if="forumStore.error" class="error-state">
                <span class="error-icon">⚠️</span>
                <p>{{ forumStore.error }}</p>
                <button class="retry-btn" @click="router.push('/forum')">Foruma Dön</button>
            </div>
        </div>
    </AppLayout>
</template>

<style scoped>
.topic-page {
    padding: 24px;
    max-width: 900px;
    margin: 0 auto;
}

/* Loading State */
.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 24px;
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

/* Breadcrumb */
.breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 24px;
    font-size: 14px;
    flex-wrap: wrap;
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

/* Topic Header */
.topic-header {
    margin-bottom: 24px;
}

.topic-title-section {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 12px;
}

.topic-title-section h1 {
    margin: 0;
    font-size: 32px;
    font-weight: 700;
    color: #ffffff;
}

.topic-badges {
    display: flex;
    gap: 8px;
}

.badge {
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
}

.badge.pinned {
    background: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
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
    display: flex;
    gap: 8px;
    font-size: 14px;
    color: #64748b;
}

/* Topic Actions */
.topic-actions {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
    flex-wrap: wrap;
}

.action-btn {
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

.action-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: #10b981;
}

.action-btn.active {
    background: rgba(16, 185, 129, 0.2);
    border-color: #10b981;
    color: #10b981;
}

.action-btn.admin {
    background: rgba(251, 191, 36, 0.1);
    border-color: rgba(251, 191, 36, 0.3);
    color: #fbbf24;
}

.action-btn.admin:hover {
    background: rgba(251, 191, 36, 0.15);
}

.admin-controls {
    display: flex;
    gap: 8px;
}

/* Topic Content Card */
.topic-content-card {
    padding: 24px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    margin-bottom: 32px;
}

.content-body {
    margin-bottom: 20px;
}

.content-text {
    margin: 0;
    color: #e2e8f0;
    font-size: 16px;
    line-height: 1.7;
    white-space: pre-wrap;
}

/* Reactions */
.reactions-section {
    display: flex;
    gap: 12px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.reaction-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.reaction-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-2px);
}

.reaction-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.reaction-btn.active {
    background: rgba(16, 185, 129, 0.2);
    border-color: #10b981;
}

.reaction-btn.small {
    padding: 6px 12px;
    font-size: 13px;
}

.reaction-icon {
    font-size: 18px;
}

.reaction-btn.small .reaction-icon {
    font-size: 16px;
}

.reaction-count {
    color: #94a3b8;
    font-weight: 600;
}

/* Replies Section */
.replies-section {
    margin-bottom: 32px;
}

.section-title {
    margin: 0 0 20px 0;
    font-size: 20px;
    font-weight: 700;
    color: #ffffff;
}

.reply-card {
    padding: 20px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    margin-bottom: 16px;
}

.reply-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 12px;
}

.reply-author {
    display: flex;
    align-items: center;
    gap: 12px;
}

.author-name {
    font-weight: 600;
    color: #ffffff;
}

.reply-date {
    font-size: 13px;
    color: #64748b;
}

.reply-actions {
    display: flex;
    gap: 12px;
    align-items: center;
}

.solution-badge {
    padding: 4px 10px;
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
}

.action-link {
    background: none;
    border: none;
    color: #10b981;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: color 0.2s ease;
}

.action-link:hover {
    color: #059669;
}

.action-link.delete {
    color: #ef4444;
}

.action-link.delete:hover {
    color: #dc2626;
}

.reply-content p {
    margin: 0;
    color: #e2e8f0;
    line-height: 1.6;
    white-space: pre-wrap;
}

.reply-reactions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.empty-replies {
    text-align: center;
    padding: 60px 24px;
}

.empty-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 12px;
}

.empty-replies p {
    margin: 0;
    color: #64748b;
    font-size: 15px;
}

/* Reply Form */
.reply-form {
    padding: 24px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
}

.reply-form h3 {
    margin: 0 0 16px 0;
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
}

.reply-to-indicator {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    background: rgba(16, 185, 129, 0.1);
    border-left: 3px solid #10b981;
    border-radius: 8px;
    margin-bottom: 16px;
    font-size: 14px;
    color: #10b981;
}

.cancel-btn {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    font-size: 18px;
    padding: 0;
    transition: color 0.2s ease;
}

.cancel-btn:hover {
    color: #ffffff;
}

.reply-textarea {
    width: 100%;
    padding: 16px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: #ffffff;
    font-size: 15px;
    font-family: inherit;
    resize: vertical;
    transition: all 0.2s ease;
}

.reply-textarea:focus {
    outline: none;
    border-color: #10b981;
    background: rgba(0, 0, 0, 0.4);
}

.reply-textarea::placeholder {
    color: #64748b;
}

.form-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
}

.submit-btn {
    padding: 12px 24px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.submit-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
}

.submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
}

/* Locked Message */
.locked-message {
    padding: 24px;
    background: rgba(148, 163, 184, 0.1);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 12px;
    text-align: center;
    color: #94a3b8;
    font-size: 15px;
}

/* Login Prompt */
.login-prompt {
    padding: 24px;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 12px;
    text-align: center;
}

.login-prompt p {
    margin: 0;
    color: #e2e8f0;
    font-size: 15px;
}

.login-prompt a {
    color: #10b981;
    text-decoration: none;
    font-weight: 600;
}

.login-prompt a:hover {
    color: #059669;
}

/* Error State */
.error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 80px 24px;
    text-align: center;
}

.error-icon {
    font-size: 64px;
    margin-bottom: 16px;
}

.error-state p {
    margin: 0 0 24px 0;
    color: #94a3b8;
    font-size: 16px;
}

.retry-btn {
    padding: 12px 24px;
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

/* Responsive */
@media (max-width: 768px) {
    .topic-page {
        padding: 16px;
    }

    .topic-title-section h1 {
        font-size: 24px;
    }

    .topic-actions {
        flex-direction: column;
    }

    .action-btn {
        width: 100%;
        justify-content: center;
    }

    .reply-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .reactions-section {
        flex-wrap: wrap;
    }
}
</style>
