<script setup lang="ts">
import { ref, computed } from 'vue';
import CaykurPage from '@/components/caykur/CaykurPage.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import {
    AUDIT_LOG,
    AUDIT_ACTION_META,
    MODULE_LABELS,
    ALL_MODULES,
    roleLabel,
    formatDateTime,
    formatNumber,
    type AuditAction,
    type ModuleKey,
} from '@/services/caykur';

const search = ref('');
const moduleFilter = ref<'all' | ModuleKey>('all');
const actionFilter = ref<'all' | AuditAction>('all');

const actionOptions: Array<{ value: 'all' | AuditAction; label: string }> = [
    { value: 'all', label: 'Tüm işlemler' },
    { value: 'create', label: 'Oluşturma' },
    { value: 'update', label: 'Güncelleme' },
    { value: 'approve', label: 'Onay' },
    { value: 'reject', label: 'Ret' },
    { value: 'export', label: 'Dışa aktarma' },
];

const filtered = computed(() => {
    const q = search.value.trim().toLocaleLowerCase('tr');
    return AUDIT_LOG.filter((e) => {
        if (moduleFilter.value !== 'all' && e.module !== moduleFilter.value) return false;
        if (actionFilter.value !== 'all' && e.action !== actionFilter.value) return false;
        if (q && !`${e.actorName} ${e.summary} ${e.entityLabel}`.toLocaleLowerCase('tr').includes(q)) return false;
        return true;
    });
});

const approvals = computed(() => AUDIT_LOG.filter((e) => e.action === 'approve' || e.action === 'reject').length);
</script>

<template>
    <CaykurPage title="İşlem Geçmişi" :sub="`${formatNumber(AUDIT_LOG.length)} kayıt · son 45 gün`">
        <template #actions>
            <button type="button" class="ck-btn ck-btn-sm">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                Dışa aktar
            </button>
        </template>

        <section class="ck-kpi-grid">
            <CaykurStatCard label="Toplam kayıt" :value="formatNumber(AUDIT_LOG.length)" sub="izlenen işlem" />
            <CaykurStatCard label="Onay/Ret" :value="formatNumber(approvals)" sub="denetim kararı" />
            <CaykurStatCard label="Modül" :value="formatNumber(ALL_MODULES.length)" sub="izlenen alan" />
        </section>

        <div class="ck-toolbar">
            <div class="ck-search-wrap">
                <svg class="ck-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input v-model="search" type="text" class="ck-search-input" placeholder="Personel veya işlem ara…" />
            </div>
            <select v-model="moduleFilter" class="ck-select" aria-label="Modül filtresi">
                <option value="all">Tüm modüller</option>
                <option v-for="m in ALL_MODULES" :key="m" :value="m">{{ MODULE_LABELS[m] }}</option>
            </select>
            <div class="ck-seg" role="group" aria-label="İşlem filtresi">
                <button v-for="opt in actionOptions" :key="opt.value" type="button" class="ck-seg-btn" :class="{ 'is-active': actionFilter === opt.value }" @click="actionFilter = opt.value">{{ opt.label }}</button>
            </div>
        </div>

        <CaykurPanel>
            <template #head><span class="ck-panel-meta">{{ formatNumber(filtered.length) }} kayıt</span></template>
            <div class="ck-table-wrap">
                <table class="ck-table">
                    <thead>
                        <tr>
                            <th>Zaman</th>
                            <th>Personel</th>
                            <th>İşlem</th>
                            <th>Modül</th>
                            <th>Açıklama</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="e in filtered.slice(0, 100)" :key="e.id">
                            <td style="white-space:nowrap">{{ formatDateTime(e.at) }}</td>
                            <td>
                                <span class="strong" style="display:block">{{ e.actorName }}</span>
                                <span class="ck-name-sub">{{ roleLabel(e.actorRole) }}</span>
                            </td>
                            <td><StatusPill :label="AUDIT_ACTION_META[e.action].label" :tone="AUDIT_ACTION_META[e.action].tone" no-dot /></td>
                            <td>{{ MODULE_LABELS[e.module] }}</td>
                            <td>{{ e.summary }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </CaykurPanel>
    </CaykurPage>
</template>
