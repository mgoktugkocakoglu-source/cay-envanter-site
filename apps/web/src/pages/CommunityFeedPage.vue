<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useCommunityStore } from '@/stores/communityStore';
import { useAuthStore } from '@/stores/authStore';
import AppLayout from '@/layouts/AppLayout.vue';
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
  activeTag.value = n;
  store.setFilter({ type: activeType.value || undefined, tag: n || undefined, search: searchQuery.value || undefined });
}
function doSearch() {
  store.setFilter({ type: activeType.value || undefined, tag: activeTag.value || undefined, search: searchQuery.value || undefined });
}
function addTag() {
  const t = newTagInput.value.trim().toLowerCase().replace(/\s+/g, '-');
  if (t && !newTags.value.includes(t) && newTags.value.length < 5) { newTags.value.push(t); newTagInput.value = ''; }
}
function removeTag(t: string) { newTags.value = newTags.value.filter(x => x !== t); }

async function handleMedia(e: Event) {
  const input = e.target as HTMLInputElement;
  console.log('[handleMedia] files:', input.files);
  if (!input.files?.length) { console.log('[handleMedia] No files selected'); return; }
  mediaUploading.value = true;
  const files = Array.from(input.files).slice(0, 4 - newMediaUrls.value.length);
  console.log('[handleMedia] Uploading', files.length, 'files:', files.map(f => ({ name: f.name, type: f.type, size: f.size })));
  const urls = await Promise.all(
    files.map(async (f) => {
      const result = await store.uploadMedia(f);
      console.log('[handleMedia] Upload result for', f.name, ':', result);
      return result;
    })
  );
  console.log('[handleMedia] All URLs:', urls);
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

function goTo(id: string) { router.push(`/community/post/${id}`); }

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
</script>

<template>
  <AppLayout>
    <div class="cp">
      <div class="cp-grid">
        <aside class="cp-side">
          <div class="side-card">
            <h3 class="side-title">🏷️ Popüler Etiketler</h3>
            <div class="trending">
              <button v-for="tag in store.trendingTags" :key="tag.id" class="ttag" :class="{ active: activeTag === tag.name }" @click="applyTag(activeTag === tag.name ? '' : tag.name)">
                #{{ tag.displayName }} <span class="tc">{{ tag.usageCount }}</span>
              </button>
              <p v-if="store.trendingTags.length === 0" class="muted">Henüz etiket yok</p>
            </div>
          </div>
          <div class="side-card">
            <h3 class="side-title">🔍 Filtrele</h3>
            <div class="fbtns">
              <button class="fb" :class="{ active: activeType === '' }" @click="applyType('')">Tümü</button>
              <button class="fb" :class="{ active: activeType === 'text' }" @click="applyType('text')">📝 Metin</button>
              <button class="fb" :class="{ active: activeType === 'photo' }" @click="applyType('photo')">📷 Fotoğraf</button>
              <button class="fb" :class="{ active: activeType === 'video' }" @click="applyType('video')">🎥 Video</button>
            </div>
          </div>
        </aside>
        <main class="feed">
          <div class="sbar"><input v-model="searchQuery" type="text" placeholder="Paylaşım, konu veya etiket ara..." class="sinput" @keyup.enter="doSearch" /><button class="sbtn" @click="doSearch"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button></div>

          <div v-if="authStore.isAuthenticated" class="cpc">
            <div v-if="!showCreateForm" class="cpt" @click="showCreateForm=true"><div class="cpa">{{ authStore.user?.fullName?.charAt(0)?.toUpperCase() || '?' }}</div><span class="cptext">Ne düşünüyorsun? Paylaş...</span></div>
            <div v-else class="cpf">
              <div class="cpfh"><h3>Yeni Paylaşım</h3><button class="xbtn" @click="showCreateForm=false">✕</button></div>
              <div class="pts"><button v-for="pt in (['text','photo','video'] as CommunityPostType[])" :key="pt" class="ptb" :class="{active:newType===pt}" @click="newType=pt">{{ pt==='text'?'📝 Metin':pt==='photo'?'📷 Fotoğraf':'🎥 Video' }}</button></div>
              <textarea v-model="newContent" class="pta" placeholder="Düşüncelerini paylaş..." rows="4"/>
              <div v-if="newType!=='text'" class="msec">
                <div v-if="newMediaUrls.length" class="mprev"><div v-for="(u,i) in newMediaUrls" :key="i" class="mthumb"><img v-if="newType==='photo'" :src="u" alt="media"/><video v-else :src="u"/><button class="mrem" @click="newMediaUrls.splice(i,1)">✕</button></div></div>
                <label v-if="newMediaUrls.length<4" class="ubtn"><input type="file" :accept="newType==='photo'?'image/*':'video/*'" :multiple="newType==='photo'" hidden @change="handleMedia"/>{{ mediaUploading?'Yükleniyor...':'+ Medya Ekle' }}</label>
              </div>
              <div class="tsec"><div class="trow"><input v-model="newTagInput" type="text" placeholder="Etiket ekle (ör. çay-hasadı)" class="tinp" @keyup.enter="addTag"/><button class="tabtn" @click="addTag">+</button></div><div v-if="newTags.length" class="tlist"><span v-for="t in newTags" :key="t" class="ptag rm">#{{ t }} <button @click="removeTag(t)">✕</button></span></div><p class="thint">💡 AI etiketlerinizi otomatik oluşturacak</p></div>
              <button class="spbtn" :disabled="store.createPostLoading||(!newContent.trim()&&newMediaUrls.length===0)" @click="submitPost">{{ store.createPostLoading?'Paylaşılıyor...':'Paylaş' }}</button>
            </div>
          </div>

          <div v-if="store.feedLoading && store.posts.length===0" class="skel"><div v-for="n in 3" :key="n" class="skelc"><div class="skelh"><div class="skela"/><div class="skell"><div class="skelln w60"/><div class="skelln w40"/></div></div><div class="skelb"><div class="skelln w100"/><div class="skelln w80"/></div></div></div>
          <div v-else-if="store.posts.length===0&&!store.feedLoading" class="empty"><div class="emicon">🌿</div><h3>Henüz paylaşım yok</h3><p>İlk paylaşımı yapan siz olun!</p></div>

          <article v-for="post in store.posts" :key="post.id" class="pcard">
            <div class="ph"><div class="pav" @click.stop="goTo(post.id)"><img v-if="post.user.avatarUrl" :src="post.user.avatarUrl" :alt="post.user.fullName"/><span v-else>{{ post.user.fullName?.charAt(0)?.toUpperCase() }}</span></div><div class="pm"><span class="pa">{{ post.user.fullName }}</span><span v-if="post.user.userType" class="put">{{ userLabel(post.user.userType) }}</span><span class="ptime">{{ timeAgo(post.createdAt) }}</span></div><span class="pbadge" :class="post.type">{{ post.type==='text'?'📝':post.type==='photo'?'📷':'🎥' }}</span></div>
            <div v-if="post.content" class="pcont" @click="goTo(post.id)">{{ post.content }}</div>
            <div v-if="post.mediaUrls?.length" class="pmedia" :class="`mc${Math.min(post.mediaUrls.length,4)}`" @click="goTo(post.id)">
              <template v-if="post.type==='photo'"><img v-for="(u,i) in post.mediaUrls.slice(0,4)" :key="i" :src="u" alt="Görsel" class="mimg"/></template>
              <template v-else-if="post.type==='video'"><video v-for="(u,i) in post.mediaUrls.slice(0,1)" :key="i" :src="u" controls class="mvid"/></template>
            </div>
            <div v-if="post.tags?.length" class="ptags"><button v-for="tag in post.tags" :key="tag.id" class="ptag" @click.stop="applyTag(tag.name)">#{{ tag.displayName }}</button></div>
            <div class="pact">
              <button class="abtn lbtn" :class="{active:store.userReactions[post.id]==='like'}" @click.stop="react(post.id,'like')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg><span>{{ post.likeCount||'' }}</span></button>
              <button class="abtn dbtn" :class="{active:store.userReactions[post.id]==='dislike'}" @click.stop="react(post.id,'dislike')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg><span>{{ post.dislikeCount||'' }}</span></button>
              <button class="abtn cbtn" @click.stop="goTo(post.id)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>{{ post.commentCount||'' }}</span></button>
            </div>
          </article>

          <div ref="sentinel" class="sent"><div v-if="store.feedLoading&&store.posts.length>0" class="lmore"><div class="spin"/><span>Yükleniyor...</span></div></div>
        </main>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.cp{padding:24px 16px;max-width:1200px;margin:0 auto}
.cp-grid{display:grid;grid-template-columns:280px 1fr;gap:24px;align-items:start}
.cp-side{display:flex;flex-direction:column;gap:16px;position:sticky;top:24px}
.side-card{background:var(--color-bg-secondary);border:1px solid var(--color-border);border-radius:16px;padding:20px}
.side-title{font-size:15px;font-weight:700;color:var(--color-text-primary);margin-bottom:16px}
.trending{display:flex;flex-wrap:wrap;gap:8px}
.ttag{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:var(--color-bg-tertiary);border:1px solid var(--color-border);border-radius:20px;font-size:13px;color:var(--color-text-secondary);cursor:pointer;transition:all .2s}
.ttag:hover,.ttag.active{background:var(--color-primary-light);border-color:var(--color-primary);color:var(--color-primary)}
.tc{font-size:11px;background:var(--color-bg-primary);padding:1px 6px;border-radius:10px;color:var(--color-text-muted)}
.muted{font-size:13px;color:var(--color-text-muted)}
.fbtns{display:flex;flex-direction:column;gap:6px}
.fb{padding:8px 14px;background:var(--color-bg-tertiary);border:1px solid var(--color-border);border-radius:10px;font-size:13px;color:var(--color-text-secondary);cursor:pointer;text-align:left;transition:all .2s}
.fb:hover,.fb.active{background:var(--color-primary-light);border-color:var(--color-primary);color:var(--color-primary);font-weight:600}
.sbar{display:flex;gap:8px;margin-bottom:20px}
.sinput{flex:1;padding:12px 16px;background:var(--color-bg-secondary);border:1px solid var(--color-border);border-radius:12px;font-size:14px;color:var(--color-text-primary);transition:all .2s}
.sinput:focus{outline:none;border-color:var(--color-primary);box-shadow:0 0 0 3px rgba(34,197,94,.1)}
.sbtn{display:flex;align-items:center;justify-content:center;width:44px;height:44px;background:var(--color-primary);border:none;border-radius:12px;color:#fff;cursor:pointer;transition:all .2s}
.sbtn:hover{opacity:.9;transform:scale(1.05)}
.cpc{background:var(--color-bg-secondary);border:1px solid var(--color-border);border-radius:16px;padding:16px 20px;margin-bottom:20px}
.cpt{display:flex;align-items:center;gap:12px;cursor:pointer}
.cpa{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0}
.cptext{flex:1;padding:10px 16px;background:var(--color-bg-tertiary);border-radius:24px;font-size:14px;color:var(--color-text-muted);transition:all .2s}
.cptext:hover{background:var(--color-bg-primary)}
.cpf{display:flex;flex-direction:column;gap:14px}
.cpfh{display:flex;justify-content:space-between;align-items:center}
.cpfh h3{font-size:16px;font-weight:700;color:var(--color-text-primary)}
.xbtn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:var(--color-bg-tertiary);border:none;border-radius:50%;color:var(--color-text-secondary);cursor:pointer;transition:all .2s}
.xbtn:hover{background:var(--color-bg-primary);color:var(--color-text-primary)}
.pts{display:flex;gap:8px}
.ptb{padding:8px 14px;background:var(--color-bg-tertiary);border:1px solid var(--color-border);border-radius:10px;font-size:13px;color:var(--color-text-secondary);cursor:pointer;transition:all .2s}
.ptb.active{background:var(--color-primary-light);border-color:var(--color-primary);color:var(--color-primary);font-weight:600}
.pta{padding:14px;background:var(--color-bg-tertiary);border:1px solid var(--color-border);border-radius:12px;font-size:14px;color:var(--color-text-primary);resize:vertical;min-height:100px;font-family:inherit}
.pta:focus{outline:none;border-color:var(--color-primary)}
.msec{display:flex;flex-direction:column;gap:10px}
.mprev{display:flex;gap:8px;flex-wrap:wrap}
.mthumb{position:relative;width:80px;height:80px;border-radius:10px;overflow:hidden}
.mthumb img,.mthumb video{width:100%;height:100%;object-fit:cover}
.mrem{position:absolute;top:4px;right:4px;width:22px;height:22px;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:50%;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.ubtn{display:inline-flex;align-items:center;justify-content:center;padding:10px 16px;background:var(--color-bg-tertiary);border:2px dashed var(--color-border);border-radius:10px;font-size:13px;color:var(--color-text-secondary);cursor:pointer;transition:all .2s}
.ubtn:hover{border-color:var(--color-primary);color:var(--color-primary)}
.tsec{display:flex;flex-direction:column;gap:8px}
.trow{display:flex;gap:8px}
.tinp{flex:1;padding:8px 12px;background:var(--color-bg-tertiary);border:1px solid var(--color-border);border-radius:8px;font-size:13px;color:var(--color-text-primary)}
.tinp:focus{outline:none;border-color:var(--color-primary)}
.tabtn{width:36px;height:36px;background:var(--color-primary);color:#fff;border:none;border-radius:8px;font-size:18px;cursor:pointer}
.tlist{display:flex;flex-wrap:wrap;gap:6px}
.ptag{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:rgba(34,197,94,.1);color:var(--color-primary);border-radius:16px;font-size:12px;font-weight:500;border:none;cursor:pointer;transition:all .2s}
.ptag:hover{background:rgba(34,197,94,.2)}
.ptag.rm button{background:none;border:none;color:var(--color-primary);cursor:pointer;padding:0;margin-left:2px;font-size:12px}
.thint{font-size:12px;color:var(--color-text-muted)}
.spbtn{padding:12px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;transition:all .2s}
.spbtn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 12px rgba(34,197,94,.3)}
.spbtn:disabled{opacity:.5;cursor:not-allowed}
.pcard{background:var(--color-bg-secondary);border:1px solid var(--color-border);border-radius:16px;padding:20px;margin-bottom:16px;transition:all .2s}
.pcard:hover{border-color:rgba(34,197,94,.3);box-shadow:0 4px 16px rgba(0,0,0,.06)}
.ph{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.pav{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:17px;cursor:pointer;flex-shrink:0;overflow:hidden}
.pav img{width:100%;height:100%;object-fit:cover}
.pm{flex:1;display:flex;flex-direction:column;gap:2px}
.pa{font-size:14px;font-weight:600;color:var(--color-text-primary)}
.put{font-size:12px;color:var(--color-primary);font-weight:500}
.ptime{font-size:12px;color:var(--color-text-muted)}
.pbadge{padding:4px 8px;border-radius:8px;font-size:14px;background:var(--color-bg-tertiary)}
.pcont{font-size:14px;line-height:1.6;color:var(--color-text-primary);margin-bottom:12px;cursor:pointer;white-space:pre-wrap;word-break:break-word}
.pmedia{display:grid;gap:4px;border-radius:12px;overflow:hidden;margin-bottom:12px;cursor:pointer}
.mc1{grid-template-columns:1fr}.mc2{grid-template-columns:1fr 1fr}
.mc3{grid-template-columns:1fr 1fr}.mc3 .mimg:first-child{grid-column:1/-1}
.mc4{grid-template-columns:1fr 1fr}
.mimg{width:100%;height:auto;max-height:500px;object-fit:contain;background:var(--color-bg-tertiary);border-radius:8px;transition:transform .2s}.mimg:hover{transform:scale(1.02)}
.mvid{width:100%;max-height:400px;border-radius:12px}
.ptags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.pact{display:flex;gap:4px;padding-top:12px;border-top:1px solid var(--color-border)}
.abtn{display:flex;align-items:center;gap:6px;padding:8px 16px;background:transparent;border:none;border-radius:10px;font-size:13px;color:var(--color-text-secondary);cursor:pointer;transition:all .2s}
.abtn:hover{background:var(--color-bg-tertiary)}
.abtn.lbtn.active{color:#22c55e;background:rgba(34,197,94,.1)}.abtn.lbtn.active svg{fill:#22c55e}
.abtn.dbtn.active{color:#ef4444;background:rgba(239,68,68,.08)}.abtn.dbtn.active svg{fill:#ef4444}
.skel{display:flex;flex-direction:column;gap:16px}
.skelc{background:var(--color-bg-secondary);border:1px solid var(--color-border);border-radius:16px;padding:20px}
.skelh{display:flex;gap:12px;align-items:center;margin-bottom:16px}
.skela{width:44px;height:44px;border-radius:50%;background:var(--color-bg-tertiary);animation:pulse 1.5s infinite}
.skell{display:flex;flex-direction:column;gap:6px;flex:1}
.skelln{height:12px;background:var(--color-bg-tertiary);border-radius:6px;animation:pulse 1.5s infinite}
.skelb{display:flex;flex-direction:column;gap:8px}
.w60{width:60%}.w40{width:40%}.w80{width:80%}.w100{width:100%}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.empty{text-align:center;padding:60px 20px;background:var(--color-bg-secondary);border:1px solid var(--color-border);border-radius:16px}
.emicon{font-size:48px;margin-bottom:12px}
.empty h3{font-size:18px;font-weight:700;color:var(--color-text-primary);margin-bottom:6px}
.empty p{font-size:14px;color:var(--color-text-muted)}
.sent{min-height:1px;padding:20px 0}
.lmore{display:flex;align-items:center;justify-content:center;gap:10px;color:var(--color-text-muted);font-size:14px}
.spin{width:24px;height:24px;border:3px solid var(--color-border);border-top-color:var(--color-primary);border-radius:50%;animation:sp .8s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
@media(max-width:900px){.cp-grid{grid-template-columns:1fr}.cp-side{position:static;flex-direction:row;overflow-x:auto;gap:12px}.side-card{min-width:240px;flex-shrink:0}}
@media(max-width:480px){.cp{padding:12px 8px}.pcard{padding:14px;border-radius:12px}.pts{flex-wrap:wrap}.mimg{max-height:300px}.abtn{padding:8px 10px;font-size:12px}}
</style>
