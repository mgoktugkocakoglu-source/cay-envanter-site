<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useForumStore } from '@/stores/forumStore';
import { useAuthStore } from '@/stores/authStore';
import AppLayout from '@/layouts/AppLayout.vue';
import RichTextEditor from '@/components/forum/RichTextEditor.vue';
import RichContent from '@/components/forum/RichContent.vue';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';
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
const showDeleteConfirm = ref(false);
const deleteTargetId = ref<string | null>(null);

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

function handleDeleteReply(replyId: string) {
    deleteTargetId.value = replyId;
    showDeleteConfirm.value = true;
}

async function confirmDeleteReply() {
    if (deleteTargetId.value) {
        await forumStore.deleteReply(deleteTargetId.value);
        deleteTargetId.value = null;
    }
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
    return date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'short', day: 'numeric' });
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
            <div v-if="forumStore.loading && !forumStore.currentTopic" class="state-box">
                <div class="spinner"></div>
                <p>Konu yukleniyor...</p>
            </div>

            <!-- Topic Content -->
            <div v-else-if="forumStore.currentTopic" class="topic-wrap">
                <!-- Breadcrumb -->
                <nav class="breadcrumb">
                    <router-link to="/forum" class="bc-link">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                        Forum
                    </router-link>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                    <router-link
                        v-if="forumStore.currentTopic.category"
                        :to="`/forum/category/${forumStore.currentTopic.category.slug}`"
                        class="bc-link"
                    >{{ forumStore.currentTopic.category.name }}</router-link>
                    <svg v-if="forumStore.currentTopic.category" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                    <span class="bc-current">{{ forumStore.currentTopic.title }}</span>
                </nav>

                <!-- Topic Card -->
                <article class="topic-card">
                    <!-- Tags -->
                    <div class="topic-tags" v-if="forumStore.currentTopic.isPinned || forumStore.currentTopic.isSolved || forumStore.currentTopic.isLocked">
                        <span v-if="forumStore.currentTopic.isPinned" class="tag tag-pinned">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>
                            Sabitlenmis
                        </span>
                        <span v-if="forumStore.currentTopic.isSolved" class="tag tag-solved">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                            Cozuldu
                        </span>
                        <span v-if="forumStore.currentTopic.isLocked" class="tag tag-locked">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                            Kilitli
                        </span>
                    </div>

                    <h1 class="topic-title">{{ forumStore.currentTopic.title }}</h1>

                    <!-- Author Row -->
                    <div class="author-row">
                        <div class="author-left">
                            <div class="avatar">{{ getInitials(forumStore.currentTopic.author?.fullName) }}</div>
                            <div>
                                <span class="author-name">{{ forumStore.currentTopic.author?.fullName }}</span>
                                <span class="author-date">{{ formatDate(forumStore.currentTopic.createdAt) }}</span>
                            </div>
                        </div>
                        <div class="stats-row">
                            <span class="stat-item" title="Goruntulenme">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                {{ forumStore.currentTopic.viewCount }}
                            </span>
                            <span class="stat-item" title="Cevaplar">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                                {{ forumStore.currentTopic.replyCount }}
                            </span>
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="topic-body">
                        <RichContent :content="forumStore.currentTopic.content" />
                    </div>

                    <!-- Footer -->
                    <div class="topic-footer">
                        <div class="reactions">
                            <button
                                v-for="type in (['like', 'helpful', 'thanks'] as ReactionType[])"
                                :key="type"
                                :class="{ active: forumStore.currentTopic.reactions?.userReaction === type }"
                                :disabled="!authStore.isAuthenticated"
                                class="react-btn"
                                :title="getReactionLabel(type)"
                                @click="handleReact(type)"
                            >
                                <span class="react-emoji">{{ getReactionIcon(type) }}</span>
                                <span class="react-label">{{ getReactionLabel(type) }}</span>
                                <span v-if="(forumStore.currentTopic.reactions?.[type] || 0) > 0" class="react-count">{{ forumStore.currentTopic.reactions?.[type] }}</span>
                            </button>
                        </div>
                        <button
                            v-if="authStore.isAuthenticated"
                            :class="{ active: forumStore.currentTopic.isSubscribed }"
                            class="subscribe-btn"
                            @click="handleSubscribe"
                            :title="forumStore.currentTopic.isSubscribed ? 'Takibi Birak' : 'Takip Et'"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" :fill="forumStore.currentTopic.isSubscribed ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                            <span class="subscribe-text">{{ forumStore.currentTopic.isSubscribed ? 'Takipte' : 'Takip Et' }}</span>
                        </button>
                    </div>

                    <!-- Admin Controls -->
                    <div v-if="isTopicAuthor" class="admin-controls">
                        <span class="admin-label">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                            Yonetim
                        </span>
                        <button @click="handleTogglePin" :class="{ 'btn-active': forumStore.currentTopic.isPinned }">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l0 20"/><path d="M5 12l14 0"/></svg>
                            {{ forumStore.currentTopic.isPinned ? 'Sabitlemeyi Kaldir' : 'Sabitle' }}
                        </button>
                        <button @click="handleToggleLock" :class="{ 'btn-active': forumStore.currentTopic.isLocked }">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                            {{ forumStore.currentTopic.isLocked ? 'Kilidi Ac' : 'Kilitle' }}
                        </button>
                        <button @click="handleToggleSolve" :class="{ 'btn-active': forumStore.currentTopic.isSolved }">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            {{ forumStore.currentTopic.isSolved ? 'Cozuldu Kaldir' : 'Cozuldu Isaretle' }}
                        </button>
                    </div>
                </article>

                <!-- Replies -->
                <section class="replies-section">
                    <div class="replies-header">
                        <h2>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                            Cevaplar
                        </h2>
                        <span class="reply-badge">{{ forumStore.replies.length }}</span>
                    </div>

                    <div v-for="(reply, index) in forumStore.replies" :key="reply.id" class="reply-card" :class="{ solution: reply.isSolution }" :style="{ animationDelay: `${index * 50}ms` }">
                        <div v-if="reply.isSolution" class="solution-tag">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                            Cozum
                        </div>
                        <div class="reply-head">
                            <div class="reply-author">
                                <div class="avatar avatar-sm">{{ getInitials(reply.author?.fullName) }}</div>
                                <span class="author-name">{{ reply.author?.fullName }}</span>
                                <span class="author-date">{{ formatDate(reply.createdAt) }}</span>
                            </div>
                            <div class="reply-actions">
                                <button v-if="isTopicAuthor && !reply.isSolution" class="action-btn action-green" @click="handleMarkAsSolution(reply.id)" title="Cozum olarak isaretle">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                    Cozum
                                </button>
                                <button v-if="authStore.isAuthenticated && !forumStore.currentTopic.isLocked" class="action-btn" @click="handleReplyTo(reply.id, reply.author?.fullName || 'Kullanici')" title="Cevapla">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 00-4-4H4"/></svg>
                                    Cevapla
                                </button>
                                <button v-if="isReplyAuthor(reply.authorId)" class="action-btn action-red" @click="handleDeleteReply(reply.id)" title="Sil">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                                    Sil
                                </button>
                            </div>
                        </div>
                        <div class="reply-body">
                            <RichContent :content="reply.content" />
                        </div>
                        <div class="reply-foot">
                            <div class="reactions reactions-sm">
                                <button
                                    v-for="type in (['like', 'helpful', 'thanks'] as ReactionType[])"
                                    :key="type"
                                    :class="{ active: reply.reactions?.userReaction === type }"
                                    :disabled="!authStore.isAuthenticated"
                                    class="react-btn react-btn-sm"
                                    :title="getReactionLabel(type)"
                                    @click="handleReplyReact(reply.id, type)"
                                >
                                    <span>{{ getReactionIcon(type) }}</span>
                                    <span v-if="(reply.reactions?.[type] || 0) > 0" class="react-count">{{ reply.reactions?.[type] }}</span>
                                </button>
                            </div>
                        </div>

                        <!-- Nested -->
                        <div v-if="reply.replies && reply.replies.length > 0" class="nested-replies">
                            <div v-for="child in reply.replies" :key="child.id" class="reply-card reply-nested" :class="{ solution: child.isSolution }">
                                <div v-if="child.isSolution" class="solution-tag">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                                    Cozum
                                </div>
                                <div class="reply-head">
                                    <div class="reply-author">
                                        <div class="avatar avatar-xs">{{ getInitials(child.author?.fullName) }}</div>
                                        <span class="author-name">{{ child.author?.fullName }}</span>
                                        <span class="author-date">{{ formatDate(child.createdAt) }}</span>
                                    </div>
                                    <div class="reply-actions">
                                        <button v-if="isTopicAuthor && !child.isSolution" class="action-btn action-green" @click="handleMarkAsSolution(child.id)">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                            Cozum
                                        </button>
                                        <button v-if="isReplyAuthor(child.authorId)" class="action-btn action-red" @click="handleDeleteReply(child.id)">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                                            Sil
                                        </button>
                                    </div>
                                </div>
                                <div class="reply-body">
                                    <RichContent :content="child.content" />
                                </div>
                                <div class="reply-foot">
                                    <div class="reactions reactions-sm">
                                        <button
                                            v-for="type in (['like', 'helpful', 'thanks'] as ReactionType[])"
                                            :key="type"
                                            :class="{ active: child.reactions?.userReaction === type }"
                                            :disabled="!authStore.isAuthenticated"
                                            class="react-btn react-btn-sm"
                                            @click="handleReplyReact(child.id, type)"
                                        >
                                            <span>{{ getReactionIcon(type) }}</span>
                                            <span v-if="(child.reactions?.[type] || 0) > 0" class="react-count">{{ child.reactions?.[type] }}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-if="forumStore.replies.length === 0 && !forumStore.loading" class="state-box state-sm">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a5568" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                        <p>Henuz cevap yok. Ilk cevaplayan siz olun!</p>
                    </div>
                </section>

                <!-- Reply Form -->
                <section v-if="authStore.isAuthenticated && !forumStore.currentTopic.isLocked" class="reply-form">
                    <h3>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
                        Cevap Yaz
                    </h3>

                    <div v-if="replyToAuthor" class="reply-to-bar">
                        <span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 00-4-4H4"/></svg>
                            {{ replyToAuthor }} kullanicisina cevap
                        </span>
                        <button @click="cancelReplyTo" title="Iptal">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>

                    <RichTextEditor
                        v-model="replyContent"
                        placeholder="Cevabnizi yazin... Gorsel ve YouTube videosu ekleyebilirsiniz."
                        min-height="150px"
                    />

                    <div class="form-actions">
                        <button :disabled="!replyContent.trim() || isSubmitting" class="btn-submit" @click="handleSubmitReply">
                            <svg v-if="!isSubmitting" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                            <div v-else class="btn-spinner"></div>
                            {{ isSubmitting ? 'Gonderiliyor...' : 'Gonder' }}
                        </button>
                    </div>
                </section>

                <!-- Locked -->
                <div v-else-if="forumStore.currentTopic.isLocked" class="locked-bar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    Bu konu kilitli. Yeni cevap eklenemez.
                </div>

                <!-- Login Prompt -->
                <div v-else class="login-prompt">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                    Cevap yazmak icin <router-link to="/login">giris yapin</router-link>.
                </div>
            </div>

            <!-- Error -->
            <div v-else-if="forumStore.error" class="state-box">
                <div class="error-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                </div>
                <p>{{ forumStore.error }}</p>
                <button class="btn-ghost" @click="router.push('/forum')">Foruma Don</button>
            </div>

            <ConfirmModal
                v-model="showDeleteConfirm"
                title="Cevabi Sil"
                message="Bu cevabi silmek istediginize emin misiniz?"
                confirm-text="Sil"
                cancel-text="Vazgec"
                variant="danger"
                @confirm="confirmDeleteReply"
            />
        </div>
    </AppLayout>
</template>

<style scoped>
.topic-page { padding: 24px; max-width: 900px; margin: 0 auto; }

/* State */
.state-box { display: flex; flex-direction: column; align-items: center; padding: 60px 20px; text-align: center; }
.state-box p { margin: 8px 0 0; color: #64748b; font-size: 14px; }
.state-sm { padding: 40px 20px; }

.error-icon {
    width: 48px; height: 48px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(239, 68, 68, 0.1); border-radius: 14px; color: #ef4444;
}

.spinner { width: 36px; height: 36px; border: 3px solid rgba(255, 255, 255, 0.06); border-top-color: #10b981; border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
}

.btn-ghost {
    margin-top: 16px; padding: 7px 16px;
    background: rgba(255, 255, 255, 0.05); color: #e2e8f0;
    border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 7px;
    font-size: 13px; cursor: pointer; transition: all 0.15s;
}
.btn-ghost:hover { background: rgba(255, 255, 255, 0.08); }

/* Breadcrumb */
.breadcrumb { display: flex; align-items: center; gap: 6px; margin-bottom: 20px; font-size: 13px; flex-wrap: wrap; }
.bc-link {
    display: inline-flex; align-items: center; gap: 4px;
    color: #64748b; text-decoration: none; transition: color 0.15s;
}
.bc-link:hover { color: #10b981; }
.bc-current { color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 280px; font-weight: 500; }

/* Topic Card */
.topic-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 28px;
}

.topic-tags { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
.tag {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.3px;
}
.tag-pinned { background: rgba(251, 191, 36, 0.12); color: #fbbf24; }
.tag-solved { background: rgba(16, 185, 129, 0.12); color: #10b981; }
.tag-locked { background: rgba(100, 116, 139, 0.12); color: #94a3b8; }

.topic-title { margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #f1f5f9; line-height: 1.3; }

/* Author Row */
.author-row {
    display: flex; justify-content: space-between; align-items: center;
    padding-bottom: 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    margin-bottom: 20px; flex-wrap: wrap; gap: 10px;
}

.author-left { display: flex; align-items: center; gap: 10px; }

.avatar {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #10b981, #059669);
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.avatar-sm { width: 30px; height: 30px; font-size: 10px; border-radius: 8px; }
.avatar-xs { width: 26px; height: 26px; font-size: 9px; border-radius: 7px; }

.author-name { display: block; color: #e2e8f0; font-weight: 600; font-size: 13px; }
.author-date { display: block; color: #4a5568; font-size: 12px; margin-top: 1px; }

.stats-row { display: flex; gap: 12px; }
.stat-item { display: flex; align-items: center; gap: 4px; color: #4a5568; font-size: 12px; }
.stat-item svg { opacity: 0.6; }

/* Topic Body */
.topic-body { margin-bottom: 20px; }

/* Footer */
.topic-footer {
    display: flex; justify-content: space-between; align-items: center;
    padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.05);
    flex-wrap: wrap; gap: 10px;
}

.reactions { display: flex; gap: 6px; flex-wrap: wrap; }

.react-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 6px 14px; background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 20px; color: #94a3b8; font-size: 13px;
    cursor: pointer; transition: all 0.2s; white-space: nowrap;
}
.react-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.12); transform: translateY(-1px); }
.react-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.react-btn.active { background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3); color: #10b981; }

.react-btn-sm { padding: 3px 10px; font-size: 12px; gap: 4px; border-radius: 16px; }

.react-emoji { font-size: 14px; }
.react-label { font-size: 12px; }
.react-count { font-weight: 700; font-size: 11px; background: rgba(255, 255, 255, 0.06); padding: 0 5px; border-radius: 8px; }
.react-btn.active .react-count { background: rgba(16, 185, 129, 0.15); }

.subscribe-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 14px;
    background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px; color: #64748b; cursor: pointer; transition: all 0.15s;
    font-size: 12px; font-weight: 500;
}
.subscribe-btn:hover { background: rgba(255, 255, 255, 0.08); color: #e2e8f0; }
.subscribe-btn.active { background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.25); color: #10b981; }
.subscribe-text { }

/* Admin Controls */
.admin-controls {
    display: flex; align-items: center; gap: 6px; padding-top: 14px; margin-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.04); flex-wrap: wrap;
}

.admin-label {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; font-weight: 700; color: #4a5568;
    text-transform: uppercase; letter-spacing: 0.5px;
    margin-right: 4px;
}

.admin-controls button {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 5px 12px; background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 6px;
    color: #64748b; font-size: 11px; font-weight: 500; cursor: pointer; transition: all 0.15s;
}
.admin-controls button:hover { background: rgba(255, 255, 255, 0.06); color: #e2e8f0; }
.admin-controls button.btn-active { background: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.15); color: #10b981; }

/* Replies Section */
.replies-section { margin-bottom: 24px; }

.replies-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.replies-header h2 {
    display: inline-flex; align-items: center; gap: 8px;
    margin: 0; font-size: 18px; font-weight: 700; color: #f1f5f9;
}

.reply-badge {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 22px; height: 22px; padding: 0 6px;
    background: rgba(16, 185, 129, 0.12); color: #10b981;
    border-radius: 10px; font-size: 12px; font-weight: 700;
}

/* Reply Card */
.reply-card {
    position: relative;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 18px 20px;
    margin-bottom: 8px;
    transition: all 0.2s;
    animation: fadeInUp 0.3s ease both;
}
.reply-card:hover { border-color: rgba(255, 255, 255, 0.1); }
.reply-card.solution { border-color: rgba(16, 185, 129, 0.25); background: rgba(16, 185, 129, 0.02); }

.solution-tag {
    position: absolute; top: 12px; right: 14px;
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 10px; background: rgba(16, 185, 129, 0.15);
    color: #10b981; border-radius: 5px;
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
}

.reply-nested { background: rgba(255, 255, 255, 0.01); border-color: rgba(255, 255, 255, 0.04); padding: 14px 16px; margin-bottom: 6px; }
.reply-nested:last-child { margin-bottom: 0; }

.reply-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 6px; }
.reply-author { display: flex; align-items: center; gap: 8px; }

.reply-actions { display: flex; gap: 4px; }

.action-btn {
    display: inline-flex; align-items: center; gap: 4px;
    background: none; border: none; color: #4a5568;
    font-size: 12px; font-weight: 500; cursor: pointer;
    padding: 4px 8px; border-radius: 6px; transition: all 0.15s;
}
.action-btn:hover { background: rgba(255, 255, 255, 0.06); color: #e2e8f0; }
.action-green:hover { color: #10b981; background: rgba(16, 185, 129, 0.08); }
.action-red:hover { color: #ef4444; background: rgba(239, 68, 68, 0.08); }

.reply-body { margin-bottom: 10px; }
.reply-foot { padding-top: 6px; }

/* Nested */
.nested-replies { margin-top: 12px; padding-left: 18px; border-left: 2px solid rgba(16, 185, 129, 0.12); }

/* Reply Form */
.reply-form {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    padding: 22px;
}

.reply-form h3 {
    display: inline-flex; align-items: center; gap: 8px;
    margin: 0 0 14px; font-size: 16px; font-weight: 600; color: #f1f5f9;
}

.reply-to-bar {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 14px; background: rgba(16, 185, 129, 0.06);
    border: 1px solid rgba(16, 185, 129, 0.12); border-radius: 8px;
    margin-bottom: 12px; font-size: 13px; color: #10b981;
}
.reply-to-bar span { display: flex; align-items: center; gap: 6px; }
.reply-to-bar button { background: none; border: none; color: #64748b; cursor: pointer; padding: 2px; display: flex; transition: color 0.15s; }
.reply-to-bar button:hover { color: #e2e8f0; }

.form-actions { display: flex; justify-content: flex-end; margin-top: 12px; }

.btn-submit {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 10px 22px; background: linear-gradient(135deg, #10b981, #059669); color: #fff;
    border: none; border-radius: 10px; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.2s;
}
.btn-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3); }
.btn-submit:active:not(:disabled) { transform: translateY(0); }
.btn-submit:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-spinner {
    width: 14px; height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3); border-top-color: #fff;
    border-radius: 50%; animation: spin 0.7s linear infinite;
}

/* Locked / Login */
.locked-bar {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 18px; background: rgba(100, 116, 139, 0.06);
    border: 1px solid rgba(100, 116, 139, 0.1); border-radius: 12px;
    color: #94a3b8; font-size: 13px;
}

.login-prompt {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    padding: 18px; background: rgba(16, 185, 129, 0.04);
    border: 1px solid rgba(16, 185, 129, 0.1); border-radius: 12px;
    text-align: center; color: #94a3b8; font-size: 14px;
}
.login-prompt svg { opacity: 0.5; }
.login-prompt a { color: #10b981; text-decoration: none; font-weight: 600; }
.login-prompt a:hover { text-decoration: underline; }

/* Responsive */
@media (max-width: 640px) {
    .topic-page { padding: 16px; }
    .topic-card { padding: 18px; border-radius: 14px; }
    .topic-title { font-size: 20px; }
    .author-row { flex-direction: column; align-items: flex-start; }
    .reply-card { padding: 14px; }
    .reply-form { padding: 16px; }
    .nested-replies { padding-left: 10px; }
    .react-label { display: none; }
    .subscribe-text { display: none; }
    .action-btn span:not(svg) { display: none; }
}
</style>
