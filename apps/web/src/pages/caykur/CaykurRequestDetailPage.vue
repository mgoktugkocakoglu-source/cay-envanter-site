<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CaykurLayout from '@/layouts/CaykurLayout.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import { useCaykurStore } from '@/stores/caykurStore';
import {
    requestById,
    REQUEST_TYPE_META,
    REQUEST_STATUS_META,
    PRIORITY_META,
    formatDateTime,
    type RequestEvent,
} from '@/services/caykur';

const route = useRoute();
const router = useRouter();
const caykur = useCaykurStore();

const request = computed(() => requestById(String(route.params.id)));

// Local, session-only reply log layered on top of the seeded history.
const localEvents = ref<RequestEvent[]>([]);
const reply = ref('');

const timeline = computed<RequestEvent[]>(() => [
    ...(request.value?.history ?? []),
    ...localEvents.value,
]);

function submitReply(): void {
    const text = reply.value.trim();
    if (!text) return;
    localEvents.value.push({
        at: new Date().toISOString(),
        status: 'answered',
        by: caykur.persona.name,
        note: text,
    });
    reply.value = '';
}
</script>

<template>
    <CaykurLayout>
        <button type="button" class="ck-back-link" @click="router.push('/caykur/requests')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Talepler
        </button>

        <template v-if="request">
            <header class="ck-page-head">
                <div>
                    <h1 class="ck-page-title">{{ request.subject }}</h1>
                    <p class="ck-page-sub">{{ request.producerName }} · {{ REQUEST_TYPE_META[request.type].label }} · {{ request.region }}</p>
                </div>
                <div class="ck-page-actions">
                    <StatusPill :label="PRIORITY_META[request.priority].label" :tone="PRIORITY_META[request.priority].tone" no-dot />
                    <StatusPill :label="REQUEST_STATUS_META[request.status].label" :tone="REQUEST_STATUS_META[request.status].tone" />
                </div>
            </header>

            <div class="ck-grid-2">
                <CaykurPanel title="İşlem geçmişi">
                    <div class="ck-panel-body">
                        <ol class="timeline">
                            <li v-for="(e, i) in timeline" :key="i" class="tl-item">
                                <span class="tl-dot" :data-tone="REQUEST_STATUS_META[e.status].tone"></span>
                                <div class="tl-body">
                                    <div class="tl-top">
                                        <span class="tl-status">{{ REQUEST_STATUS_META[e.status].label }}</span>
                                        <span class="tl-at">{{ formatDateTime(e.at) }}</span>
                                    </div>
                                    <p class="tl-note">{{ e.note }}</p>
                                    <span class="tl-by">{{ e.by }}</span>
                                </div>
                            </li>
                        </ol>

                        <div v-if="request.status !== 'closed'" class="reply-box">
                            <textarea v-model="reply" class="reply-input" rows="3" placeholder="Talebe yanıt yazın…"></textarea>
                            <button type="button" class="ck-btn ck-btn-primary" :disabled="!reply.trim()" @click="submitReply">Yanıtla</button>
                        </div>
                    </div>
                </CaykurPanel>

                <CaykurPanel title="Talep bilgileri">
                    <dl class="ck-dl">
                        <div class="ck-dl-item"><span class="ck-dl-term">Talep no</span><span class="ck-dl-val">{{ request.id.toUpperCase() }}</span></div>
                        <div class="ck-dl-item"><span class="ck-dl-term">Müstahsil</span><span class="ck-dl-val">{{ request.producerName }}</span></div>
                        <div class="ck-dl-item"><span class="ck-dl-term">Tür</span><span class="ck-dl-val">{{ REQUEST_TYPE_META[request.type].label }}</span></div>
                        <div class="ck-dl-item"><span class="ck-dl-term">Bölge</span><span class="ck-dl-val">{{ request.region }}</span></div>
                        <div class="ck-dl-item"><span class="ck-dl-term">Atanan</span><span class="ck-dl-val">{{ request.assignee ?? 'Atanmadı' }}</span></div>
                        <div class="ck-dl-item"><span class="ck-dl-term">Oluşturulma</span><span class="ck-dl-val">{{ formatDateTime(request.createdAt) }}</span></div>
                    </dl>
                </CaykurPanel>
            </div>
        </template>

        <div v-else class="ck-empty">
            <p class="ck-empty-title">Talep bulunamadı</p>
            <button type="button" class="ck-btn" @click="router.push('/caykur/requests')">Listeye dön</button>
        </div>
    </CaykurLayout>
</template>

<style scoped>
.timeline {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
}
.tl-item {
    display: flex;
    gap: var(--space-3);
    padding-bottom: var(--space-4);
    position: relative;
}
.tl-item:not(:last-child)::before {
    content: '';
    position: absolute;
    left: 5px;
    top: 16px;
    bottom: 0;
    width: 2px;
    background: var(--color-border);
}
.tl-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-top: 3px;
    flex-shrink: 0;
    background: var(--color-text-muted);
    z-index: 1;
}
.tl-dot[data-tone='success'] { background: var(--color-success); }
.tl-dot[data-tone='warning'] { background: var(--color-warning); }
.tl-dot[data-tone='info'] { background: var(--color-info); }
.tl-dot[data-tone='muted'] { background: var(--color-text-muted); }
.tl-body { min-width: 0; }
.tl-top { display: flex; align-items: baseline; gap: var(--space-2); flex-wrap: wrap; }
.tl-status { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.tl-at { font-size: var(--font-size-xs); color: var(--color-text-muted); }
.tl-note { margin: 4px 0 2px; font-size: var(--font-size-sm); color: var(--color-text-secondary); }
.tl-by { font-size: var(--font-size-xs); color: var(--color-text-muted); }
.reply-box {
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    align-items: flex-end;
}
.reply-input {
    width: 100%;
    padding: var(--space-3);
    background: var(--color-input-bg);
    border: 1px solid var(--color-input-border);
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--font-size-sm);
    resize: vertical;
}
.reply-input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-light); }
</style>
