<script setup lang="ts">
import { ref, computed } from 'vue';
import CaykurPage from '@/components/caykur/CaykurPage.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import {
    ANNOUNCEMENTS,
    formatNumber,
    formatDate,
    type Announcement,
    type AudienceKind,
} from '@/services/caykur';

const composing = ref(false);
const local = ref<Announcement[]>([]);

const draft = ref({
    title: '',
    body: '',
    audienceKind: 'all' as AudienceKind,
    audienceLabel: 'Tüm müstahsiller',
    sms: true,
    email: true,
    push: true,
});

const all = computed(() => {
    const list = [...local.value, ...ANNOUNCEMENTS];
    return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned));
});

const channelLabel: Record<string, string> = { sms: 'SMS', email: 'E-posta', push: 'Mobil' };

function publish(): void {
    if (!draft.value.title.trim()) return;
    const channels: Array<'sms' | 'email' | 'push'> = [];
    if (draft.value.sms) channels.push('sms');
    if (draft.value.email) channels.push('email');
    if (draft.value.push) channels.push('push');
    local.value.unshift({
        id: `duy-new-${local.value.length + 1}`,
        title: draft.value.title.trim(),
        body: draft.value.body.trim() || '—',
        audienceKind: draft.value.audienceKind,
        audienceLabel: draft.value.audienceLabel,
        channels,
        publishedAt: new Date().toISOString(),
        readPct: 0,
        pinned: false,
    });
    draft.value.title = '';
    draft.value.body = '';
    composing.value = false;
}
</script>

<template>
    <CaykurPage title="Duyurular" :sub="`${formatNumber(all.length)} duyuru`">
        <template #actions>
            <button type="button" class="ck-btn ck-btn-primary" @click="composing = !composing">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Yeni duyuru
            </button>
        </template>

        <CaykurPanel v-if="composing" title="Yeni duyuru oluştur">
            <div class="ck-panel-body compose">
                <div class="field">
                    <label class="field-label" for="a-title">Başlık</label>
                    <input id="a-title" v-model="draft.title" type="text" class="ck-select" placeholder="Duyuru başlığı" />
                </div>
                <div class="field">
                    <label class="field-label" for="a-body">İçerik</label>
                    <textarea id="a-body" v-model="draft.body" class="ck-textarea" rows="3" placeholder="Duyuru metni"></textarea>
                </div>
                <div class="compose-row">
                    <div class="field">
                        <label class="field-label" for="a-aud">Hedef kitle</label>
                        <select id="a-aud" v-model="draft.audienceLabel" class="ck-select">
                            <option>Tüm müstahsiller</option>
                            <option>Rize bölgesi</option>
                            <option>Trabzon bölgesi</option>
                            <option>Artvin bölgesi</option>
                            <option>Giresun bölgesi</option>
                            <option>Organik üreticiler</option>
                        </select>
                    </div>
                    <div class="field">
                        <span class="field-label">Kanallar</span>
                        <div class="channels">
                            <label class="chk"><input type="checkbox" v-model="draft.sms" /> SMS</label>
                            <label class="chk"><input type="checkbox" v-model="draft.email" /> E-posta</label>
                            <label class="chk"><input type="checkbox" v-model="draft.push" /> Mobil</label>
                        </div>
                    </div>
                </div>
                <div class="compose-actions">
                    <button type="button" class="ck-btn" @click="composing = false">Vazgeç</button>
                    <button type="button" class="ck-btn ck-btn-primary" :disabled="!draft.title.trim()" @click="publish">Yayınla</button>
                </div>
            </div>
        </CaykurPanel>

        <div class="ann-list">
            <article v-for="a in all" :key="a.id" class="ann-card" :class="{ pinned: a.pinned }">
                <div class="ann-head">
                    <div class="ann-title-wrap">
                        <svg v-if="a.pinned" class="pin" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 3l5 5-3 1-4 4 1 5-2 2-4-6-5 3v-2l3-5-6-4 2-2 5 1 4-4 1-3z"/></svg>
                        <h2 class="ann-title">{{ a.title }}</h2>
                    </div>
                    <span class="ann-date">{{ formatDate(a.publishedAt) }}</span>
                </div>
                <p class="ann-body">{{ a.body }}</p>
                <div class="ann-foot">
                    <span class="ann-audience">{{ a.audienceLabel }}</span>
                    <span class="ann-channels">
                        <span v-for="c in a.channels" :key="c" class="ann-channel">{{ channelLabel[c] }}</span>
                    </span>
                    <span class="ann-read">Okunma: %{{ formatNumber(a.readPct) }}</span>
                </div>
            </article>
        </div>
    </CaykurPage>
</template>

<style scoped>
.compose { display: flex; flex-direction: column; gap: var(--space-4); }
.field { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.field-label { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); }
.ck-textarea {
    width: 100%; padding: var(--space-3);
    background: var(--color-input-bg); border: 1px solid var(--color-input-border);
    border-radius: var(--radius-md); color: var(--color-text-primary);
    font-family: inherit; font-size: var(--font-size-sm); resize: vertical;
}
.ck-textarea:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-light); }
.compose-row { display: flex; gap: var(--space-4); flex-wrap: wrap; }
.channels { display: flex; gap: var(--space-4); align-items: center; height: var(--control-height); }
.chk { display: inline-flex; align-items: center; gap: 6px; font-size: var(--font-size-sm); color: var(--color-text-primary); cursor: pointer; }
.compose-actions { display: flex; justify-content: flex-end; gap: var(--space-2); }

.ann-list { display: flex; flex-direction: column; gap: var(--space-3); }
.ann-card {
    background: var(--color-card-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
}
.ann-card.pinned { border-color: color-mix(in srgb, var(--color-secondary) 35%, transparent); background: color-mix(in srgb, var(--color-secondary) 4%, var(--color-card-bg)); }
.ann-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); }
.ann-title-wrap { display: inline-flex; align-items: center; gap: 8px; }
.pin { color: var(--color-secondary); }
.ann-title { margin: 0; font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.ann-date { font-size: var(--font-size-xs); color: var(--color-text-muted); white-space: nowrap; }
.ann-body { margin: var(--space-2) 0 var(--space-4); font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.6; }
.ann-foot { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.ann-audience { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.ann-channels { display: inline-flex; gap: 4px; }
.ann-channel {
    font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold);
    color: var(--color-secondary);
    background: color-mix(in srgb, var(--color-secondary) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-secondary) 22%, transparent);
    padding: 1px 8px; border-radius: var(--radius-full);
}
.ann-read { font-size: var(--font-size-xs); color: var(--color-text-muted); margin-left: auto; }
</style>
