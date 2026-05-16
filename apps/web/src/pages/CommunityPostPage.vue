<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCommunityStore } from '@/stores/communityStore';
import { useAuthStore } from '@/stores/authStore';
import SocialBusinessLayout from '@/layouts/SocialBusinessLayout.vue';
import type { CommunityReactionType } from '@/services/api';

const store = useCommunityStore();
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();
const commentText = ref('');
const submitting = ref(false);

const postId = route.params.id as string;

onMounted(async () => {
  await Promise.all([store.fetchPostDetail(postId), store.fetchComments(postId)]);
});

async function submitComment() {
  if (!commentText.value.trim() || submitting.value) return;
  if (!authStore.isAuthenticated) { router.push('/login'); return; }
  submitting.value = true;
  await store.addComment(postId, commentText.value.trim());
  commentText.value = '';
  submitting.value = false;
}

async function react(targetType: 'post' | 'comment', targetId: string, t: CommunityReactionType) {
  if (!authStore.isAuthenticated) { router.push('/login'); return; }
  await store.toggleReaction(targetType, targetId, t);
}

async function delComment(id: string) {
  if (confirm('Bu yorumu silmek istediğinize emin misiniz?')) {
    await store.deleteComment(id, postId);
  }
}

async function delPost() {
  if (confirm('Bu paylaşımı silmek istediğinize emin misiniz?')) {
    const ok = await store.deletePost(postId);
    if (ok) router.push('/community');
  }
}

function timeAgo(d: string): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'Az önce';
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd} gün önce`;
  return new Date(d).toLocaleDateString('tr-TR');
}
function userLabel(t: string) { return t === 'land_owner' ? 'Arazi Sahibi' : t === 'worker' ? 'İşçi' : t === 'self_farmer' ? 'Çiftçi' : ''; }
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeRichText(value: string | null): string {
  if (!value) return '';
  const allowedTags = new Set(['P', 'H1', 'H2', 'STRONG', 'EM', 'UL', 'OL', 'LI', 'BR', 'A', 'SPAN']);
  const richPattern = /<\/?(p|h1|h2|strong|em|ul|ol|li|br|a|span)\b/i;
  if (!richPattern.test(value)) return escapeHtml(value);

  const doc = new DOMParser().parseFromString(value, 'text/html');
  const cleanUrl = (href: string | null) => {
    if (!href) return '';
    try {
      const url = new URL(href, window.location.origin);
      if (['http:', 'https:', 'mailto:'].includes(url.protocol)) return url.href;
    } catch {
      return '';
    }
    return '';
  };
  const isSafeCssColor = (color: string) => /^#[0-9a-f]{3,8}$/i.test(color) || /^rgba?\([\d\s,%.]+\)$/i.test(color);
  const cleanNode = (node: Node): Node => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? '');
    if (node.nodeType !== Node.ELEMENT_NODE) return document.createTextNode('');

    const element = node as HTMLElement;
    if (!allowedTags.has(element.tagName)) {
      const fragment = document.createDocumentFragment();
      Array.from(element.childNodes).forEach((child) => fragment.appendChild(cleanNode(child)));
      return fragment;
    }

    const cleanElement = document.createElement(element.tagName.toLowerCase());
    if (element.tagName === 'A') {
      const href = cleanUrl(element.getAttribute('href'));
      if (href) {
        cleanElement.setAttribute('href', href);
        cleanElement.setAttribute('target', '_blank');
        cleanElement.setAttribute('rel', 'noopener noreferrer');
      }
    }
    if (element.tagName === 'SPAN') {
      const styles: string[] = [];
      if (isSafeCssColor(element.style.color)) styles.push(`color: ${element.style.color}`);
      if (isSafeCssColor(element.style.backgroundColor)) styles.push(`background-color: ${element.style.backgroundColor}`);
      if (styles.length) cleanElement.setAttribute('style', styles.join('; '));
    }
    Array.from(element.childNodes).forEach((child) => cleanElement.appendChild(cleanNode(child)));
    return cleanElement;
  };

  const fragment = document.createDocumentFragment();
  Array.from(doc.body.childNodes).forEach((node) => fragment.appendChild(cleanNode(node)));
  const wrapper = document.createElement('div');
  wrapper.appendChild(fragment);
  return wrapper.innerHTML;
}
</script>

<template>
  <SocialBusinessLayout>
    <div class="pd">
      <button class="back-btn" @click="router.push('/community')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Topluluk
      </button>

      <div v-if="store.currentPostLoading" class="loading-box">
        <div class="spin" /><span>Yükleniyor...</span>
      </div>

      <template v-else-if="store.currentPost">
        <!-- Post Detail Card -->
        <article class="detail-card">
          <div class="dh">
            <div class="dav">
              <img v-if="store.currentPost.user.avatarUrl" :src="store.currentPost.user.avatarUrl" :alt="store.currentPost.user.fullName" />
              <span v-else>{{ store.currentPost.user.fullName?.charAt(0)?.toUpperCase() }}</span>
            </div>
            <div class="dm">
              <span class="da">{{ store.currentPost.user.fullName }}</span>
              <div class="dm-meta">
                <span v-if="store.currentPost.user.userType" class="dut">{{ userLabel(store.currentPost.user.userType) }}</span>
                <span class="dm-dot" v-if="store.currentPost.user.userType">&middot;</span>
                <span class="dtime">{{ timeAgo(store.currentPost.createdAt) }}</span>
              </div>
            </div>
            <button v-if="authStore.user?.id === store.currentPost.userId" class="del-btn" @click="delPost" title="Sil">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>

          <div v-if="store.currentPost.content" class="dcont" v-html="sanitizeRichText(store.currentPost.content)"></div>

          <div v-if="store.currentPost.mediaUrls?.length" class="dmedia" :class="`mc${Math.min(store.currentPost.mediaUrls.length, 4)}`">
            <template v-if="store.currentPost.type === 'photo'">
              <img v-for="(u, i) in store.currentPost.mediaUrls" :key="i" :src="u" alt="Görsel" class="dmimg" />
            </template>
            <template v-else-if="store.currentPost.type === 'video'">
              <video v-for="(u, i) in store.currentPost.mediaUrls.slice(0, 1)" :key="i" :src="u" controls class="dmvid" />
            </template>
          </div>

          <div v-if="store.currentPost.tags?.length" class="dtags">
            <span v-for="tag in store.currentPost.tags" :key="tag.id" class="dtag">#{{ tag.displayName }}</span>
          </div>

          <!-- Post Reactions - Unified Design -->
          <div class="dact">
            <button class="react-btn like-btn" :class="{ active: store.userReactions[store.currentPost.id] === 'like' }" @click="react('post', store.currentPost.id, 'like')">
              <svg width="20" height="20" viewBox="0 0 24 24" :fill="store.userReactions[store.currentPost.id] === 'like' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" /></svg>
              <span>{{ store.currentPost.likeCount || 0 }}</span>
            </button>
            <button class="react-btn dislike-btn" :class="{ active: store.userReactions[store.currentPost.id] === 'dislike' }" @click="react('post', store.currentPost.id, 'dislike')">
              <svg width="20" height="20" viewBox="0 0 24 24" :fill="store.userReactions[store.currentPost.id] === 'dislike' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" /></svg>
              <span>{{ store.currentPost.dislikeCount || 0 }}</span>
            </button>
            <div class="react-info">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>{{ store.currentPost.commentCount }} yorum</span>
            </div>
          </div>
        </article>

        <!-- Comment Form -->
        <div v-if="authStore.isAuthenticated" class="comment-form">
          <div class="cf-avatar">
            <img v-if="authStore.user?.avatarUrl" :src="authStore.user.avatarUrl" :alt="authStore.user?.fullName" />
            <span v-else>{{ authStore.user?.fullName?.charAt(0)?.toUpperCase() || '?' }}</span>
          </div>
          <div class="cf-input-wrap">
            <textarea v-model="commentText" class="cf-input" placeholder="Yorum yaz..." rows="2" @keydown.enter.ctrl="submitComment" />
            <button class="cf-btn" :disabled="!commentText.trim() || submitting" @click="submitComment">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>

        <!-- Comments Section -->
        <div class="comments-section">
          <h3 class="cs-title">Yorumlar ({{ store.currentPost.commentCount }})</h3>

          <div v-if="store.commentsLoading" class="loading-box"><div class="spin" /></div>

          <div v-else-if="store.comments.length === 0" class="no-comments">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="1.5" style="margin-bottom:8px;opacity:.4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <p>Henüz yorum yok. İlk yorumu siz yapın!</p>
          </div>

          <!-- Comment Items -->
          <div v-for="c in store.comments" :key="c.id" class="cmt">
            <div class="cmt-av">
              <img v-if="c.user.avatarUrl" :src="c.user.avatarUrl" :alt="c.user.fullName" />
              <span v-else>{{ c.user.fullName?.charAt(0)?.toUpperCase() }}</span>
            </div>
            <div class="cmt-body">
              <div class="cmt-bubble">
                <div class="cmt-header">
                  <span class="cmt-author">{{ c.user.fullName }}</span>
                  <button v-if="authStore.user?.id === c.userId" class="cmt-del" @click="delComment(c.id)" title="Sil">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <p class="cmt-text">{{ c.content }}</p>
              </div>
              <div class="cmt-footer">
                <button class="cmt-react like-btn" :class="{ active: store.userReactions[c.id] === 'like' }" @click="react('comment', c.id, 'like')">
                  <svg width="14" height="14" viewBox="0 0 24 24" :fill="store.userReactions[c.id] === 'like' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                  <span v-if="c.likeCount">{{ c.likeCount }}</span>
                </button>
                <button class="cmt-react dislike-btn" :class="{ active: store.userReactions[c.id] === 'dislike' }" @click="react('comment', c.id, 'dislike')">
                  <svg width="14" height="14" viewBox="0 0 24 24" :fill="store.userReactions[c.id] === 'dislike' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
                  <span v-if="c.dislikeCount">{{ c.dislikeCount }}</span>
                </button>
                <span class="cmt-time">{{ timeAgo(c.createdAt) }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </SocialBusinessLayout>
</template>

<style scoped>
.pd { padding: 24px 16px; max-width: 720px; margin: 0 auto; }

/* Back Button */
.back-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; background: var(--color-bg-secondary); border: 1px solid var(--color-border);
  border-radius: 10px; font-size: 14px; color: var(--color-text-secondary);
  cursor: pointer; margin-bottom: 20px; transition: all .2s;
}
.back-btn:hover { color: var(--color-primary); border-color: var(--color-primary); }

/* Loading */
.loading-box { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 60px; color: var(--color-text-muted); }
.spin { width: 24px; height: 24px; border: 3px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: sp .8s linear infinite; }
@keyframes sp { to { transform: rotate(360deg); } }

/* Detail Card */
.detail-card {
  background: var(--color-bg-secondary); border: 1px solid var(--color-border);
  border-radius: 12px; padding: 20px; margin-bottom: 16px;
}
.dh { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.dav {
  width: 48px; height: 48px; border-radius: 50%;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 19px; flex-shrink: 0; overflow: hidden;
}
.dav img { width: 100%; height: 100%; object-fit: cover; }
.dm { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.da { font-size: 15px; font-weight: 600; color: var(--color-text-primary); }
.dm-meta { display: flex; align-items: center; gap: 4px; }
.dut { font-size: 13px; color: var(--color-primary); font-weight: 500; }
.dm-dot { font-size: 12px; color: var(--color-text-muted); }
.dtime { font-size: 12px; color: var(--color-text-muted); }
.del-btn {
  width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
  background: none; border: 1px solid transparent; border-radius: 8px;
  color: var(--color-text-muted); cursor: pointer; transition: all .2s;
}
.del-btn:hover { background: rgba(239,68,68,.08); color: #ef4444; border-color: rgba(239,68,68,.15); }

/* Content */
.dcont {
  font-size: 15px; line-height: 1.7; color: var(--color-text-primary);
  margin-bottom: 16px; white-space: pre-wrap; word-break: break-word;
}
.dcont :deep(p) { margin: 0 0 10px; }
.dcont :deep(p:last-child) { margin-bottom: 0; }
.dcont :deep(h1),
.dcont :deep(h2) { margin: 0 0 10px; line-height: 1.28; font-weight: 700; color: var(--color-text-primary); }
.dcont :deep(h1) { font-size: 24px; }
.dcont :deep(h2) { font-size: 20px; }
.dcont :deep(ul),
.dcont :deep(ol) { margin: 8px 0 10px 20px; padding: 0; }
.dcont :deep(li) { margin: 3px 0; }
.dcont :deep(a) { color: var(--color-secondary); text-decoration: underline; text-underline-offset: 2px; }

/* Media */
.dmedia { display: grid; gap: 4px; border-radius: 12px; overflow: hidden; margin-bottom: 16px; }
.mc1 { grid-template-columns: 1fr; }
.mc2 { grid-template-columns: 1fr 1fr; }
.mc3 { grid-template-columns: 1fr 1fr; }
.mc4 { grid-template-columns: 1fr 1fr; }
.mc3 .dmimg:first-child { grid-column: 1/-1; }
.dmimg { width: 100%; height: auto; max-height: 600px; object-fit: contain; border-radius: 8px; background: var(--color-bg-tertiary); }
.dmvid { width: 100%; max-height: 500px; border-radius: 12px; }

/* Tags */
.dtags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
.dtag {
  display: inline-block; padding: 5px 12px;
  background: rgba(34,197,94,.1); color: var(--color-primary);
  border-radius: 16px; font-size: 13px; font-weight: 500;
}

/* Post Reactions - Unified Design */
.dact { display: flex; align-items: center; gap: 6px; padding-top: 16px; border-top: 1px solid var(--color-border); }
.react-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; background: transparent; border: 1px solid transparent;
  border-radius: 8px; font-size: 14px; font-weight: 500;
  color: var(--color-text-muted); cursor: pointer; transition: all .2s;
}
.react-btn:hover { background: var(--color-bg-tertiary); color: var(--color-text-secondary); }
.react-btn.like-btn.active {
  color: #22c55e; background: rgba(34,197,94,.08); border-color: rgba(34,197,94,.2);
}
.react-btn.dislike-btn.active {
  color: #ef4444; background: rgba(239,68,68,.06); border-color: rgba(239,68,68,.15);
}
.react-btn span { font-variant-numeric: tabular-nums; }
.react-info {
  display: flex; align-items: center; gap: 6px; margin-left: auto;
  font-size: 14px; color: var(--color-text-muted);
}

/* Comment Form */
.comment-form {
  display: flex; align-items: flex-start; gap: 12px;
  background: var(--color-bg-secondary); border: 1px solid var(--color-border);
  border-radius: 12px; padding: 14px 16px; margin-bottom: 16px;
}
.cf-avatar {
  width: 38px; height: 38px; border-radius: 50%;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 15px; flex-shrink: 0; overflow: hidden;
}
.cf-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cf-input-wrap { flex: 1; display: flex; align-items: flex-end; gap: 8px; }
.cf-input {
  flex: 1; padding: 10px 14px; background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border); border-radius: 12px;
  font-size: 14px; color: var(--color-text-primary); resize: none; font-family: inherit;
}
.cf-input:focus { outline: none; border-color: var(--color-primary); }
.cf-btn {
  width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #22c55e, #16a34a); color: #fff;
  border: none; border-radius: 50%; cursor: pointer; transition: all .2s; flex-shrink: 0;
}
.cf-btn:hover:not(:disabled) { transform: scale(1.05); box-shadow: 0 2px 8px rgba(34,197,94,.3); }
.cf-btn:disabled { opacity: .4; cursor: not-allowed; }

/* Comments Section */
.comments-section {
  background: var(--color-bg-secondary); border: 1px solid var(--color-border);
  border-radius: 12px; padding: 16px;
}
.cs-title { font-size: 15px; font-weight: 700; color: var(--color-text-primary); margin-bottom: 16px; }
.no-comments { text-align: center; padding: 24px; color: var(--color-text-muted); font-size: 14px; }

/* Comment Items */
.cmt { display: flex; gap: 10px; margin-bottom: 16px; }
.cmt:last-child { margin-bottom: 0; }
.cmt-av {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(135deg, #64748b, #475569);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-weight: 600; font-size: 13px; flex-shrink: 0; overflow: hidden;
}
.cmt-av img { width: 100%; height: 100%; object-fit: cover; }
.cmt-body { flex: 1; min-width: 0; }
.cmt-bubble {
  background: var(--color-bg-tertiary); border-radius: 12px; padding: 10px 14px;
}
.cmt-header { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
.cmt-author { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
.cmt-del {
  margin-left: auto; background: none; border: none;
  color: var(--color-text-muted); cursor: pointer; padding: 2px;
  border-radius: 4px; transition: all .2s; display: flex; align-items: center;
}
.cmt-del:hover { color: #ef4444; background: rgba(239,68,68,.08); }
.cmt-text { font-size: 14px; line-height: 1.5; color: var(--color-text-primary); white-space: pre-wrap; margin: 0; }

/* Comment Footer - Reaction Buttons (same design as post reactions but smaller) */
.cmt-footer { display: flex; align-items: center; gap: 6px; padding: 4px 4px 0; }
.cmt-react {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; background: transparent; border: 1px solid transparent;
  border-radius: 6px; font-size: 12px; font-weight: 500;
  color: var(--color-text-muted); cursor: pointer; transition: all .2s;
}
.cmt-react:hover { background: var(--color-bg-tertiary); color: var(--color-text-secondary); }
.cmt-react.like-btn.active {
  color: #22c55e; background: rgba(34,197,94,.08); border-color: rgba(34,197,94,.2);
}
.cmt-react.dislike-btn.active {
  color: #ef4444; background: rgba(239,68,68,.06); border-color: rgba(239,68,68,.15);
}
.cmt-react span { font-variant-numeric: tabular-nums; }
.cmt-time { font-size: 11px; color: var(--color-text-muted); margin-left: 4px; }

@media(max-width:480px) {
  .pd { padding: 12px 8px; }
  .detail-card { padding: 14px; border-radius: 10px; }
  .dmimg { max-height: 300px; }
  .comment-form { flex-wrap: wrap; }
  .cf-btn { width: 100%; border-radius: 10px; height: auto; padding: 10px; }
  .cf-input-wrap { flex-direction: column; }
}
</style>
