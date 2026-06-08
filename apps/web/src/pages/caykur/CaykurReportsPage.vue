<script setup lang="ts">
import { ref, computed } from 'vue';
import CaykurPage from '@/components/caykur/CaykurPage.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import { REPORT_DEFS, buildReport } from '@/services/caykur';

const selectedId = ref('genel-uretim');
const selected = computed(() => REPORT_DEFS.find((r) => r.id === selectedId.value));
const report = computed(() => (selected.value?.live ? buildReport(selectedId.value) : null));

const groups = computed(() => {
    const map = new Map<string, typeof REPORT_DEFS>();
    for (const r of REPORT_DEFS) {
        const list = map.get(r.group) ?? [];
        list.push(r);
        map.set(r.group, list);
    }
    return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
});

function select(id: string, live: boolean): void {
    if (live) selectedId.value = id;
}

function exportNote(): void {
    // eslint-disable-next-line no-alert
    alert('Bu demo sürümünde dışa aktarma devre dışı. Üretimde Excel/PDF üretilir.');
}
</script>

<template>
    <CaykurPage title="Raporlar" sub="Kurumsal raporlama merkezi">
        <div class="reports-layout">
            <aside class="catalog">
                <div v-for="g in groups" :key="g.group" class="catalog-group">
                    <span class="catalog-label">{{ g.group }}</span>
                    <button
                        v-for="r in g.items"
                        :key="r.id"
                        type="button"
                        class="catalog-item"
                        :class="{ 'is-active': r.id === selectedId, 'is-disabled': !r.live }"
                        @click="select(r.id, r.live)"
                    >
                        <span class="catalog-item-title">{{ r.title }}</span>
                        <span v-if="!r.live" class="catalog-soon">Yakında</span>
                    </button>
                </div>
            </aside>

            <div class="report-view">
                <template v-if="selected && report">
                    <div class="report-head">
                        <div>
                            <h2 class="report-title">{{ selected.title }}</h2>
                            <p class="report-desc">{{ selected.description }}</p>
                        </div>
                        <div class="report-actions">
                            <button type="button" class="ck-btn ck-btn-sm" @click="exportNote">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                Excel
                            </button>
                            <button type="button" class="ck-btn ck-btn-sm" @click="exportNote">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                PDF
                            </button>
                        </div>
                    </div>

                    <section v-if="report.summary.length" class="report-kpis">
                        <CaykurStatCard v-for="(c, i) in report.summary" :key="i" :label="c.label" :value="c.value" />
                    </section>

                    <CaykurPanel>
                        <div class="ck-table-wrap">
                            <table class="ck-table">
                                <thead>
                                    <tr>
                                        <th v-for="c in report.columns" :key="c.key" :class="{ num: c.num }">{{ c.label }}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(row, ri) in report.rows" :key="ri">
                                        <td v-for="(c, ci) in report.columns" :key="c.key" :class="{ num: c.num, strong: ci === 0 }">{{ row[c.key] }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </CaykurPanel>
                </template>

                <div v-else class="ck-empty">
                    <p class="ck-empty-title">Bu rapor yakında</p>
                    <p class="ck-empty-sub">Soldan canlı bir rapor seçin.</p>
                </div>
            </div>
        </div>
    </CaykurPage>
</template>

<style scoped>
.reports-layout {
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr);
    gap: var(--space-5);
    align-items: start;
}
@media (max-width: 900px) {
    .reports-layout { grid-template-columns: minmax(0, 1fr); }
}
.catalog {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    background: var(--color-card-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    position: sticky;
    top: 80px;
}
.catalog-group { display: flex; flex-direction: column; gap: 2px; }
.catalog-label {
    padding: 0 var(--space-2) 4px;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
}
.catalog-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    width: 100%;
    padding: 9px var(--space-3);
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    text-align: left;
    cursor: pointer;
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    transition: all var(--transition-fast);
}
.catalog-item:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
.catalog-item.is-active { background: var(--color-primary-light); color: var(--color-primary); font-weight: var(--font-weight-semibold); }
.catalog-item.is-disabled { cursor: default; color: var(--color-text-muted); }
.catalog-item.is-disabled:hover { background: transparent; }
.catalog-item-title { min-width: 0; }
.catalog-soon {
    font-size: 10px;
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-muted);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    padding: 1px 6px;
    border-radius: var(--radius-full);
    white-space: nowrap;
}
.report-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
    flex-wrap: wrap;
}
.report-title { margin: 0; font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-text-primary); }
.report-desc { margin: 4px 0 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }
.report-actions { display: flex; gap: var(--space-2); }
.report-kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: var(--space-3);
    margin-bottom: var(--space-4);
}
</style>
