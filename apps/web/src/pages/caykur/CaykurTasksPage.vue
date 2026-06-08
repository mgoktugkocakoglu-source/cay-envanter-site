<script setup lang="ts">
import { ref, computed } from 'vue';
import CaykurPage from '@/components/caykur/CaykurPage.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import { useCaykurStore } from '@/stores/caykurStore';
import {
    WORK_TASKS,
    TASK_TYPE_META,
    TASK_STATUS_META,
    PRIORITY_META,
    formatNumber,
    formatDate,
    type WorkTaskStatus,
} from '@/services/caykur';

const caykur = useCaykurStore();

type View = 'all' | 'mine' | 'overdue';
const view = ref<View>('all');

const summary = computed(() => ({
    total: WORK_TASKS.length,
    open: WORK_TASKS.filter((t) => t.status === 'open').length,
    overdue: WORK_TASKS.filter((t) => t.status === 'overdue').length,
    done: WORK_TASKS.filter((t) => t.status === 'done').length,
}));

const filtered = computed(() => {
    return WORK_TASKS.filter((t) => {
        if (view.value === 'overdue') return t.status === 'overdue';
        if (view.value === 'mine') return t.assignee === caykur.persona.name;
        return true;
    });
});

function statusTone(s: WorkTaskStatus) {
    return TASK_STATUS_META[s].tone;
}
</script>

<template>
    <CaykurPage title="Görevler" sub="Saha ve operasyon iş takibi">
        <template #actions>
            <button type="button" class="ck-btn ck-btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Yeni görev
            </button>
        </template>

        <section class="ck-kpi-grid">
            <CaykurStatCard label="Toplam görev" :value="formatNumber(summary.total)" sub="bu sezon" />
            <CaykurStatCard label="Açık" :value="formatNumber(summary.open)" sub="başlanmamış" />
            <CaykurStatCard label="Geciken" :value="formatNumber(summary.overdue)" sub="termin aşıldı" />
            <CaykurStatCard label="Tamamlanan" :value="formatNumber(summary.done)" sub="kapatıldı" />
        </section>

        <div class="ck-seg" role="group" aria-label="Görünüm" style="margin-bottom: var(--space-4)">
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'all' }" @click="view = 'all'">Tüm görevler</button>
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'mine' }" @click="view = 'mine'">Bana atanan</button>
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'overdue' }" @click="view = 'overdue'">Gecikenler</button>
        </div>

        <CaykurPanel>
            <template #head><span class="ck-panel-meta">{{ formatNumber(filtered.length) }} görev</span></template>
            <div v-if="filtered.length" class="ck-table-wrap">
                <table class="ck-table">
                    <thead>
                        <tr>
                            <th>Görev</th>
                            <th>Tür</th>
                            <th>Atanan</th>
                            <th>Bölge</th>
                            <th>Termin</th>
                            <th>Öncelik</th>
                            <th>Durum</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="t in filtered" :key="t.id">
                            <td class="strong">{{ t.relatedProducerName }}</td>
                            <td>{{ TASK_TYPE_META[t.type].label }}</td>
                            <td>{{ t.assignee }}</td>
                            <td>{{ t.region }}</td>
                            <td style="white-space:nowrap">{{ formatDate(t.dueDate) }}</td>
                            <td><StatusPill :label="PRIORITY_META[t.priority].label" :tone="PRIORITY_META[t.priority].tone" no-dot /></td>
                            <td><StatusPill :label="TASK_STATUS_META[t.status].label" :tone="statusTone(t.status)" /></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div v-else class="ck-empty">
                <p class="ck-empty-title">Görev yok</p>
                <p class="ck-empty-sub">Bu görünümde atanmış görev bulunmuyor.</p>
            </div>
        </CaykurPanel>
    </CaykurPage>
</template>
