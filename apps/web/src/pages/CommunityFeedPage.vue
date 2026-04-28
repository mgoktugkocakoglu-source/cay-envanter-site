<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useCommunityStore } from '@/stores/communityStore';
import { useAuthStore } from '@/stores/authStore';
import SocialBusinessLayout from '@/layouts/SocialBusinessLayout.vue';
import SocialWorkspaceLayout from '@/layouts/SocialWorkspaceLayout.vue';
import type { CommunityPostType, CommunityReactionType } from '@/services/api';

const store = useCommunityStore();
const authStore = useAuthStore();
const router = useRouter();

const showCreateForm = ref(false);
const newContent = ref('');
const newType = ref<CommunityPostType>('text');
const newMediaUrls = ref<string[]>([]);
const newTagInput = ref('');
const newTags = ref<string[]>([]);
const mediaUploading = ref(false);
const searchQuery = ref('');
const activeType = ref<CommunityPostType | ''>('');
const activeTag = ref('');
const sentinel = ref<HTMLElement | null>(null);

onMounted(async () => {
  store.resetFeed();
  await Promise.all([store.fetchFeed(), store.fetchTrendingTags()]);
  if (sentinel.value) {
    new IntersectionObserver((e) => {
      if (e[0].isIntersecting && store.hasMore && !store.feedLoading) store.loadMorePosts();
    }, { rootMargin: '200px' }).observe(sentinel.value);
  }
});

function applyType(t: CommunityPostType | '') {
  activeType.value = t;
  store.setFilter({ type: t || undefined, tag: activeTag.value || undefined, search: searchQuery.value || undefined });
}
function applyTag(n: string) {
  activeTag.value = activeTag.value === n ? '' : n;
  store.setFilter({ type: activeType.value || undefined, tag: activeTag.value || undefined, search: searchQuery.value || undefined });
}
function doSearch() {
  store.setFilter({ type: activeType.value || undefined, tag: activeTag.value || undefined, search: searchQuery.value || undefined });
}
function clearAllFilters() {
  activeType.value = '';
  activeTag.value = '';
  searchQuery.value = '';
  store.clearFilters();
}
function addTag() {
  const t = newTagInput.value.trim().toLowerCase().replace(/\s+/g, '-');
  if (t && !newTags.value.includes(t) && newTags.value.length < 5) { newTags.value.push(t); newTagInput.value = ''; }
}
function removeTag(t: string) { newTags.value = newTags.value.filter(x => x !== t); }

async function handleMedia(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files?.length) return;
  mediaUploading.value = true;
  const files = Array.from(input.files).slice(0, 4 - newMediaUrls.value.length);
  const urls = await Promise.all(files.map(f => store.uploadMedia(f)));
  newMediaUrls.value.push(...urls.filter((u): u is string => u !== null));
  mediaUploading.value = false;
  input.value = '';
}

async function submitPost() {
  if (!newContent.value.trim() && newMediaUrls.value.length === 0) return;
  const p = await store.createPost({
    content: newContent.value.trim() || undefined, type: newType.value,
    mediaUrls: newMediaUrls.value.length > 0 ? newMediaUrls.value : undefined,
    tagNames: newTags.value.length > 0 ? newTags.value : undefined,
  });
  if (p) { newContent.value = ''; newType.value = 'text'; newMediaUrls.value = []; newTags.value = []; showCreateForm.value = false; }
}

async function react(postId: string, t: CommunityReactionType) {
  if (!authStore.isAuthenticated) { router.push('/login'); return; }
  await store.toggleReaction('post', postId, t);
}

function goTo(id: string) { router.push(`/social/community/post/${id}`); }

function filterMyPosts() {
  if (!authStore.user) { router.push('/login'); return; }
  store.setFilter({ userId: authStore.user.id });
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

const hasActiveFilter = () => activeType.value || activeTag.value || searchQuery.value;
</script>

<template>
  <SocialBusinessLayout>
    <SocialWorkspaceLayout>
      <template #sidebar>
          <!-- Navigation Menu -->
          <nav class="side-nav">
            <button class="nav-item" :class="{ active: !activeType && !activeTag && !store.activeFilters.userId }" @click="clearAllFilters">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span>Ana Sayfa</span>
            </button>
            <button v-if="authStore.isAuthenticated" class="nav-item" :class="{ active: !!store.activeFilters.userId }" @click="filterMyPosts">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span>Paylaşımlarım</span>
            </button>
            <button class="nav-item" :class="{ active: activeType === 'photo' }" @click="applyType(activeType === 'photo' ? '' : 'photo')">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>Fotoğraflar</span>
            </button>
            <button class="nav-item" :class="{ active: activeType === 'video' }" @click="applyType(activeType === 'video' ? '' : 'video')">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              <span>Videolar</span>
            </button>
            <button class="nav-item" :class="{ active: activeType === 'text' }" @click="applyType(activeType === 'text' ? '' : 'text')">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <span>Yazılar</span>
            </button>
          </nav>

          <!-- Trending Tags -->
          <div class="side-tags">
            <h4 class="st-title">Popüler Konular</h4>
            <div class="st-list">
              <button v-for="tag in store.trendingTags" :key="tag.id" class="st-item" :class="{ active: activeTag === tag.name }" @click="applyTag(tag.name)">
                <span class="st-hash">#</span>
                <div class="st-content">
                  <span class="st-name">{{ tag.displayName }}</span>
                  <span class="st-count">{{ tag.usageCount }} paylaşım</span>
                </div>
              </button>
              <p v-if="store.trendingTags.length === 0" class="st-empty">Henüz popüler konu yok</p>
            </div>
          </div>
      </template>

        <!-- Main Feed -->
        <main class="feed">
          <!-- Search Bar -->
          <div class="sbar">
            <div class="sbar-inner">
              <svg class="sbar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input v-model="searchQuery" type="text" placeholder="Toplulukta ara..." class="sinput" @keyup.enter="doSearch" />
            </div>
            <button v-if="hasActiveFilter()" class="clear-filter-btn" @click="clearAllFilters" title="Filtreleri temizle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <!-- Active Filter Badge -->
          <div v-if="hasActiveFilter()" class="filter-badge">
            <span v-if="activeType" class="fb-chip" @click="applyType('')">{{ activeType === 'text' ? 'Yazılar' : activeType === 'photo' ? 'Fotoğraflar' : 'Videolar' }} <span class="fb-x">&times;</span></span>
            <span v-if="activeTag" class="fb-chip" @click="applyTag(activeTag)">#{{ activeTag }} <span class="fb-x">&times;</span></span>
            <span v-if="searchQuery" class="fb-chip" @click="searchQuery=''; doSearch();">"{{ searchQuery }}" <span class="fb-x">&times;</span></span>
          </div>

          <!-- Create Post -->
          <div v-if="authStore.isAuthenticated" class="create-post">
            <div v-if="!showCreateForm" class="cp-trigger" @click="showCreateForm=true">
              <div class="cp-trig-avatar">
                <img v-if="authStore.user?.avatarUrl" :src="authStore.user.avatarUrl" :alt="authStore.user?.fullName" />
                <span v-else>{{ authStore.user?.fullName?.charAt(0)?.toUpperCase() || '?' }}</span>
              </div>
              <div class="cp-trig-input">Ne düşünüyorsun?</div>
            </div>
            <div v-if="!showCreateForm" class="cp-quick-actions">
              <button class="cp-qa" @click="showCreateForm=true; newType='photo';">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Fotoğraf
              </button>
              <button class="cp-qa" @click="showCreateForm=true; newType='video';">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                Video
              </button>
            </div>

            <!-- Expanded Create Form -->
            <div v-if="showCreateForm" class="cpf">
              <div class="cpf-header">
                <h3>Paylaşım Oluştur</h3>
                <button class="cpf-close" @click="showCreateForm=false">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div class="cpf-user">
                <div class="cpf-avatar">
                  <img v-if="authStore.user?.avatarUrl" :src="authStore.user.avatarUrl" :alt="authStore.user?.fullName" />
                  <span v-else>{{ authStore.user?.fullName?.charAt(0)?.toUpperCase() }}</span>
                </div>
                <span class="cpf-name">{{ authStore.user?.fullName }}</span>
              </div>
              <div class="pts">
                <button v-for="pt in (['text','photo','video'] as CommunityPostType[])" :key="pt" class="ptb" :class="{active:newType===pt}" @click="newType=pt">
                  <svg v-if="pt==='text'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <svg v-else-if="pt==='photo'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                  {{ pt==='text'?'Metin':pt==='photo'?'Fotoğraf':'Video' }}
                </button>
              </div>
              <textarea v-model="newContent" class="cpf-textarea" placeholder="Düşüncelerini paylaş..." rows="4"/>
              <div v-if="newType!=='text'" class="msec">
                <div v-if="newMediaUrls.length" class="mprev"><div v-for="(u,i) in newMediaUrls" :key="i" class="mthumb"><img v-if="newType==='photo'" :src="u" alt="media"/><video v-else :src="u"/><button class="mrem" @click="newMediaUrls.splice(i,1)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button></div></div>
                <label v-if="newMediaUrls.length<4" class="ubtn"><input type="file" :accept="newType==='photo'?'image/*':'video/*'" :multiple="newType==='photo'" hidden @change="handleMedia"/>{{ mediaUploading?'Yükleniyor...':'+ Medya Ekle' }}</label>
              </div>
              <div class="tsec">
                <div class="trow">
                  <div class="tinp-wrap">
                    <span class="tinp-hash">#</span>
                    <input v-model="newTagInput" type="text" placeholder="Etiket ekle..." class="tinp" @keyup.enter="addTag"/>
                  </div>
                  <button class="tabtn" :disabled="!newTagInput.trim()" @click="addTag">Ekle</button>
                </div>
                <div v-if="newTags.length" class="tlist">
                  <span v-for="t in newTags" :key="t" class="ptag rm">
                    #{{ t }}
                    <button @click="removeTag(t)">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </span>
                </div>
                <p class="thint">Etiketler otomatik olarak da oluşturulabilir</p>
              </div>
              <button class="spbtn" :disabled="store.createPostLoading||(!newContent.trim()&&newMediaUrls.length===0)" @click="submitPost">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                {{ store.createPostLoading?'Paylaşılıyor...':'Paylaş' }}
              </button>
            </div>
          </div>

          <!-- Skeleton Loading -->
          <div v-if="store.feedLoading && store.posts.length===0" class="skel">
            <div v-for="n in 3" :key="n" class="skelc">
              <div class="skelh"><div class="skela"/><div class="skell"><div class="skelln w60"/><div class="skelln w40"/></div></div>
              <div class="skelb"><div class="skelln w100"/><div class="skelln w80"/></div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else-if="store.posts.length===0&&!store.feedLoading" class="empty">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="1.5" style="margin-bottom:16px;opacity:.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <h3>Henüz paylaşım yok</h3>
            <p>İlk paylaşımı yapan siz olun!</p>
          </div>

          <!-- Post Cards -->
          <article v-for="post in store.posts" :key="post.id" class="pcard">
            <div class="ph">
              <div class="pav" @click.stop="goTo(post.id)">
                <img v-if="post.user.avatarUrl" :src="post.user.avatarUrl" :alt="post.user.fullName"/>
                <span v-else>{{ post.user.fullName?.charAt(0)?.toUpperCase() }}</span>
              </div>
              <div class="pm">
                <span class="pa">{{ post.user.fullName }}</span>
                <div class="pm-meta">
                  <span v-if="post.user.userType" class="put">{{ userLabel(post.user.userType) }}</span>
                  <span class="pm-dot" v-if="post.user.userType">&middot;</span>
                  <span class="ptime">{{ timeAgo(post.createdAt) }}</span>
                </div>
              </div>
            </div>

            <div v-if="post.content" class="pcont" @click="goTo(post.id)">{{ post.content }}</div>

            <div v-if="post.mediaUrls?.length" class="pmedia" :class="`mc${Math.min(post.mediaUrls.length,4)}`" @click="goTo(post.id)">
              <template v-if="post.type==='photo'"><img v-for="(u,i) in post.mediaUrls.slice(0,4)" :key="i" :src="u" alt="Görsel" class="mimg"/></template>
              <template v-else-if="post.type==='video'"><video v-for="(u,i) in post.mediaUrls.slice(0,1)" :key="i" :src="u" controls class="mvid"/></template>
            </div>

            <div v-if="post.tags?.length" class="ptags">
              <button v-for="tag in post.tags" :key="tag.id" class="ptag" @click.stop="applyTag(tag.name)">#{{ tag.displayName }}</button>
            </div>

            <div class="pact">
              <button class="react-btn like-btn" :class="{active:store.userReactions[post.id]==='like'}" @click.stop="react(post.id,'like')">
                <svg width="18" height="18" viewBox="0 0 24 24" :fill="store.userReactions[post.id]==='like' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                <span v-if="post.likeCount">{{ post.likeCount }}</span>
              </button>
              <button class="react-btn dislike-btn" :class="{active:store.userReactions[post.id]==='dislike'}" @click.stop="react(post.id,'dislike')">
                <svg width="18" height="18" viewBox="0 0 24 24" :fill="store.userReactions[post.id]==='dislike' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
                <span v-if="post.dislikeCount">{{ post.dislikeCount }}</span>
              </button>
              <button class="react-btn comment-btn" @click.stop="goTo(post.id)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span v-if="post.commentCount">{{ post.commentCount }}</span>
              </button>
            </div>
          </article>

          <div ref="sentinel" class="sent">
            <div v-if="store.feedLoading&&store.posts.length>0" class="lmore">
              <div class="spin"/><span>Yükleniyor...</span>
            </div>
          </div>
        </main>
    </SocialWorkspaceLayout>
  </SocialBusinessLayout>
</template>

<style scoped>
/* Layout */
.cp { padding: 24px 16px; max-width: 1100px; margin: 0 auto; }
.cp-grid { display: grid; grid-template-columns: 280px 1fr; gap: 24px; align-items: start; }

/* Sidebar */
.cp-side { display: flex; flex-direction: column; gap: 8px; position: sticky; top: 24px; }

/* Profile Card */
.side-profile {
  display: flex; align-items: center; gap: 12px;
  padding: 16px; background: var(--color-bg-secondary); border: 1px solid var(--color-border);
  border-radius: 12px; cursor: pointer; transition: all .2s;
}
.side-profile:hover { background: var(--color-bg-tertiary); }
.sp-avatar {
  width: 44px; height: 44px; border-radius: 50%;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 17px; flex-shrink: 0; overflow: hidden;
}
.sp-avatar img { width: 100%; height: 100%; object-fit: cover; }
.sp-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.sp-name { font-size: 15px; font-weight: 600; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp-type { font-size: 12px; color: var(--color-primary); font-weight: 500; }

/* Navigation */
.side-module-nav,
.side-nav {
  display: flex; flex-direction: column; gap: 2px;
  padding: 8px 0; background: var(--color-bg-secondary); border: 1px solid var(--color-border);
  border-radius: 12px; overflow: hidden;
}
.module-nav-item,
.nav-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px; background: transparent; border: none;
  font-size: 14px; font-weight: 500; color: var(--color-text-secondary);
  cursor: pointer; transition: all .15s; text-align: left; text-decoration: none;
}
.module-nav-item:hover,
.nav-item:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
.module-nav-item.active,
.nav-item.active { background: var(--color-primary-light); color: var(--color-primary); font-weight: 600; }
.module-nav-item svg,
.nav-item svg { flex-shrink: 0; }

/* Trending Tags */
.side-tags {
  padding: 16px; background: var(--color-bg-secondary); border: 1px solid var(--color-border);
  border-radius: 12px;
}
.st-title { font-size: 14px; font-weight: 700; color: var(--color-text-primary); margin-bottom: 12px; }
.st-list { display: flex; flex-direction: column; gap: 2px; }
.st-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; background: transparent; border: none; border-radius: 8px;
  cursor: pointer; transition: all .15s; text-align: left;
}
.st-item:hover { background: var(--color-bg-tertiary); }
.st-item.active { background: var(--color-primary-light); }
.st-hash { font-size: 18px; font-weight: 700; color: var(--color-primary); line-height: 1; }
.st-content { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.st-name { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
.st-item.active .st-name { color: var(--color-primary); }
.st-count { font-size: 11px; color: var(--color-text-muted); }
.st-empty { font-size: 13px; color: var(--color-text-muted); padding: 4px 0; }

/* Search Bar */
.sbar { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.sbar-inner {
  flex: 1; display: flex; align-items: center; gap: 8px;
  padding: 0 14px; background: var(--color-bg-secondary); border: 1px solid var(--color-border);
  border-radius: 24px; transition: all .2s;
}
.sbar-inner:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(34,197,94,.1); }
.sbar-icon { color: var(--color-text-muted); flex-shrink: 0; }
.sinput {
  flex: 1; padding: 10px 0; background: transparent; border: none;
  font-size: 14px; color: var(--color-text-primary); outline: none;
}
.sinput::placeholder { color: var(--color-text-muted); }
.clear-filter-btn {
  width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
  background: var(--color-bg-tertiary); border: 1px solid var(--color-border); border-radius: 50%;
  color: var(--color-text-muted); cursor: pointer; transition: all .2s; flex-shrink: 0;
}
.clear-filter-btn:hover { background: rgba(239,68,68,.1); color: #ef4444; border-color: #ef4444; }

/* Filter Badges */
.filter-badge { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.fb-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; background: var(--color-primary-light); color: var(--color-primary);
  border-radius: 16px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all .2s;
}
.fb-chip:hover { background: rgba(34,197,94,.2); }
.fb-x { font-size: 14px; font-weight: 700; margin-left: 2px; }

/* Create Post */
.create-post {
  background: var(--color-bg-secondary); border: 1px solid var(--color-border);
  border-radius: 12px; margin-bottom: 16px; overflow: hidden;
}
.cp-trigger {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; cursor: pointer;
}
.cp-trig-avatar {
  width: 42px; height: 42px; border-radius: 50%;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 16px; flex-shrink: 0; overflow: hidden;
}
.cp-trig-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cp-trig-input {
  flex: 1; padding: 10px 16px; background: var(--color-bg-tertiary);
  border-radius: 24px; font-size: 14px; color: var(--color-text-muted); transition: all .2s;
}
.cp-trig-input:hover { background: var(--color-bg-primary); }
.cp-quick-actions {
  display: flex; border-top: 1px solid var(--color-border);
}
.cp-qa {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 10px; background: transparent; border: none; border-right: 1px solid var(--color-border);
  font-size: 13px; font-weight: 500; color: var(--color-text-secondary); cursor: pointer; transition: all .15s;
}
.cp-qa:last-child { border-right: none; }
.cp-qa:hover { background: var(--color-bg-tertiary); }

/* Create Post Form */
.cpf { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.cpf-header { display: flex; justify-content: space-between; align-items: center; }
.cpf-header h3 { font-size: 16px; font-weight: 700; color: var(--color-text-primary); }
.cpf-close {
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  background: var(--color-bg-tertiary); border: none; border-radius: 50%;
  color: var(--color-text-secondary); cursor: pointer; transition: all .2s;
}
.cpf-close:hover { background: var(--color-bg-primary); color: var(--color-text-primary); }
.cpf-user { display: flex; align-items: center; gap: 10px; }
.cpf-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 14px; flex-shrink: 0; overflow: hidden;
}
.cpf-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cpf-name { font-size: 14px; font-weight: 600; color: var(--color-text-primary); }
.pts { display: flex; gap: 6px; }
.ptb {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; background: var(--color-bg-tertiary); border: 1px solid var(--color-border);
  border-radius: 8px; font-size: 13px; color: var(--color-text-secondary); cursor: pointer; transition: all .2s;
}
.ptb.active { background: var(--color-primary-light); border-color: var(--color-primary); color: var(--color-primary); font-weight: 600; }
.cpf-textarea {
  padding: 14px; background: var(--color-bg-tertiary); border: 1px solid var(--color-border);
  border-radius: 12px; font-size: 14px; color: var(--color-text-primary);
  resize: vertical; min-height: 100px; font-family: inherit;
}
.cpf-textarea:focus { outline: none; border-color: var(--color-primary); }

/* Media Upload */
.msec { display: flex; flex-direction: column; gap: 10px; }
.mprev { display: flex; gap: 8px; flex-wrap: wrap; }
.mthumb { position: relative; width: 80px; height: 80px; border-radius: 10px; overflow: hidden; }
.mthumb img, .mthumb video { width: 100%; height: 100%; object-fit: cover; }
.mrem {
  position: absolute; top: 4px; right: 4px; width: 22px; height: 22px;
  background: rgba(0,0,0,.6); color: #fff; border: none; border-radius: 50%;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.ubtn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 10px 16px; background: var(--color-bg-tertiary); border: 2px dashed var(--color-border);
  border-radius: 10px; font-size: 13px; color: var(--color-text-secondary); cursor: pointer; transition: all .2s;
}
.ubtn:hover { border-color: var(--color-primary); color: var(--color-primary); }

/* Tag Input */
.tsec { display: flex; flex-direction: column; gap: 8px; }
.trow { display: flex; gap: 8px; }
.tinp-wrap {
  flex: 1; display: flex; align-items: center; gap: 4px;
  padding: 0 12px; background: var(--color-bg-tertiary); border: 1px solid var(--color-border);
  border-radius: 8px; transition: all .2s;
}
.tinp-wrap:focus-within { border-color: var(--color-primary); }
.tinp-hash { color: var(--color-primary); font-weight: 700; font-size: 14px; }
.tinp {
  flex: 1; padding: 8px 0; background: transparent; border: none;
  font-size: 13px; color: var(--color-text-primary); outline: none;
}
.tabtn {
  padding: 8px 14px; background: var(--color-primary); color: #fff;
  border: none; border-radius: 8px; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all .2s;
}
.tabtn:disabled { opacity: .4; cursor: not-allowed; }
.tabtn:not(:disabled):hover { opacity: .9; }
.tlist { display: flex; flex-wrap: wrap; gap: 6px; }
.ptag {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; background: rgba(34,197,94,.1); color: var(--color-primary);
  border-radius: 16px; font-size: 12px; font-weight: 500; border: none; cursor: pointer; transition: all .2s;
}
.ptag:hover { background: rgba(34,197,94,.2); }
.ptag.rm button { background: none; border: none; color: var(--color-primary); cursor: pointer; padding: 0; margin-left: 2px; display: flex; align-items: center; }
.thint { font-size: 12px; color: var(--color-text-muted); }

/* Submit Button */
.spbtn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px; background: linear-gradient(135deg, #22c55e, #16a34a); color: #fff;
  border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all .2s;
}
.spbtn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(34,197,94,.3); }
.spbtn:disabled { opacity: .5; cursor: not-allowed; }

/* Post Card */
.pcard {
  background: var(--color-bg-secondary); border: 1px solid var(--color-border);
  border-radius: 12px; padding: 16px; margin-bottom: 12px; transition: all .2s;
}
.pcard:hover { border-color: rgba(34,197,94,.2); box-shadow: 0 2px 12px rgba(0,0,0,.04); }
.ph { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.pav {
  width: 42px; height: 42px; border-radius: 50%;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 16px; cursor: pointer; flex-shrink: 0; overflow: hidden;
}
.pav img { width: 100%; height: 100%; object-fit: cover; }
.pm { flex: 1; display: flex; flex-direction: column; gap: 1px; }
.pa { font-size: 14px; font-weight: 600; color: var(--color-text-primary); }
.pm-meta { display: flex; align-items: center; gap: 4px; }
.put { font-size: 12px; color: var(--color-primary); font-weight: 500; }
.pm-dot { font-size: 12px; color: var(--color-text-muted); }
.ptime { font-size: 12px; color: var(--color-text-muted); }
.pcont {
  font-size: 14px; line-height: 1.6; color: var(--color-text-primary);
  margin-bottom: 12px; cursor: pointer; white-space: pre-wrap; word-break: break-word;
}

/* Media Grid */
.pmedia { display: grid; gap: 4px; border-radius: 12px; overflow: hidden; margin-bottom: 12px; cursor: pointer; }
.mc1 { grid-template-columns: 1fr; }
.mc2 { grid-template-columns: 1fr 1fr; }
.mc3 { grid-template-columns: 1fr 1fr; }
.mc3 .mimg:first-child { grid-column: 1/-1; }
.mc4 { grid-template-columns: 1fr 1fr; }
.mimg { width: 100%; height: auto; max-height: 500px; object-fit: contain; background: var(--color-bg-tertiary); border-radius: 8px; transition: transform .2s; }
.mimg:hover { transform: scale(1.01); }
.mvid { width: 100%; max-height: 400px; border-radius: 12px; }
.ptags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }

/* Reaction Buttons - Unified */
.pact { display: flex; gap: 4px; padding-top: 12px; border-top: 1px solid var(--color-border); }
.react-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 14px; background: transparent; border: 1px solid transparent;
  border-radius: 8px; font-size: 13px; font-weight: 500;
  color: var(--color-text-muted); cursor: pointer; transition: all .2s;
}
.react-btn:hover { background: var(--color-bg-tertiary); color: var(--color-text-secondary); }
.react-btn.like-btn.active {
  color: #22c55e; background: rgba(34,197,94,.08); border-color: rgba(34,197,94,.2);
}
.react-btn.dislike-btn.active {
  color: #ef4444; background: rgba(239,68,68,.06); border-color: rgba(239,68,68,.15);
}
.react-btn.comment-btn:hover { color: var(--color-primary); }
.react-btn span { font-variant-numeric: tabular-nums; }

/* Skeleton */
.skel { display: flex; flex-direction: column; gap: 12px; }
.skelc { background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: 12px; padding: 16px; }
.skelh { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
.skela { width: 42px; height: 42px; border-radius: 50%; background: var(--color-bg-tertiary); animation: pulse 1.5s infinite; }
.skell { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.skelln { height: 12px; background: var(--color-bg-tertiary); border-radius: 6px; animation: pulse 1.5s infinite; }
.skelb { display: flex; flex-direction: column; gap: 8px; }
.w60 { width: 60%; } .w40 { width: 40%; } .w80 { width: 80%; } .w100 { width: 100%; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }

/* Empty State */
.empty {
  text-align: center; padding: 60px 20px;
  background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: 12px;
}
.empty h3 { font-size: 18px; font-weight: 700; color: var(--color-text-primary); margin-bottom: 6px; }
.empty p { font-size: 14px; color: var(--color-text-muted); }

/* Sentinel / Loading */
.sent { min-height: 1px; padding: 20px 0; }
.lmore { display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--color-text-muted); font-size: 14px; }
.spin { width: 24px; height: 24px; border: 3px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: sp .8s linear infinite; }
@keyframes sp { to { transform: rotate(360deg); } }

/* Responsive */
@media(max-width:900px) {
  .cp-grid { grid-template-columns: 1fr; }
  .cp-side { position: static; flex-direction: row; overflow-x: auto; gap: 8px; padding-bottom: 4px; }
  .side-profile { min-width: 200px; flex-shrink: 0; }
  .side-module-nav,
  .side-nav { flex-direction: row; min-width: max-content; flex-shrink: 0; padding: 8px; border-radius: 12px; }
  .module-nav-item,
  .nav-item { white-space: nowrap; padding: 8px 14px; border-radius: 8px; }
  .side-tags { min-width: 220px; flex-shrink: 0; }
  .st-list { flex-direction: row; flex-wrap: nowrap; overflow-x: auto; gap: 4px; }
  .st-item { white-space: nowrap; }
}
@media(max-width:480px) {
  .cp { padding: 8px; }
  .pcard { padding: 12px; border-radius: 10px; }
  .pts { flex-wrap: wrap; }
  .mimg { max-height: 300px; }
  .react-btn { padding: 6px 10px; font-size: 12px; }
  .cp-quick-actions { flex-wrap: wrap; }
}
</style>
