<script setup lang="ts">
import { ref, computed } from 'vue';
import CaykurPage from '@/components/caykur/CaykurPage.vue';
import CaykurPanel from '@/components/caykur/CaykurPanel.vue';
import CaykurStatCard from '@/components/caykur/CaykurStatCard.vue';
import StatusPill from '@/components/caykur/StatusPill.vue';
import {
    STAFF,
    ROLE_DEFS,
    ROLE_COUNTS,
    roleLabel,
    canAccess,
    MODULE_LABELS,
    ALL_MODULES,
    relativeFromNow,
    formatNumber,
    type CaykurRole,
} from '@/services/caykur';

type View = 'staff' | 'roles';
const view = ref<View>('staff');
const search = ref('');
const roleFilter = ref<'all' | CaykurRole>('all');

const roleOptions = computed<Array<{ value: 'all' | CaykurRole; label: string }>>(() => [
    { value: 'all', label: 'Tüm roller' },
    ...ROLE_DEFS.map((r) => ({ value: r.id, label: r.short })),
]);

const filtered = computed(() => {
    const q = search.value.trim().toLocaleLowerCase('tr');
    return STAFF.filter((s) => {
        if (roleFilter.value !== 'all' && s.role !== roleFilter.value) return false;
        if (q && !`${s.fullName} ${s.scope} ${s.email}`.toLocaleLowerCase('tr').includes(q)) return false;
        return true;
    });
});

const activeCount = computed(() => STAFF.filter((s) => s.active).length);
</script>

<template>
    <CaykurPage title="Kullanıcılar & Roller" :sub="`${formatNumber(STAFF.length)} personel · ${formatNumber(ROLE_DEFS.length)} rol`">
        <template #actions>
            <button type="button" class="ck-btn ck-btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Personel ekle
            </button>
        </template>

        <section class="ck-kpi-grid">
            <CaykurStatCard label="Toplam personel" :value="formatNumber(STAFF.length)" sub="kurum kullanıcısı" />
            <CaykurStatCard label="Aktif" :value="formatNumber(activeCount)" sub="erişimi açık" />
            <CaykurStatCard label="Rol sayısı" :value="formatNumber(ROLE_DEFS.length)" sub="yetki seviyesi" />
            <CaykurStatCard label="Fabrika sorumlusu" :value="formatNumber(ROLE_COUNTS.find(r => r.role === 'fabrika_sorumlusu')?.count ?? 0)" sub="atanmış" />
        </section>

        <div class="ck-seg" role="group" aria-label="Görünüm" style="margin-bottom: var(--space-4)">
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'staff' }" @click="view = 'staff'">Personel</button>
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': view === 'roles' }" @click="view = 'roles'">Roller & yetkiler</button>
        </div>

        <template v-if="view === 'staff'">
            <div class="ck-toolbar">
                <div class="ck-search-wrap">
                    <svg class="ck-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input v-model="search" type="text" class="ck-search-input" placeholder="Personel ara…" />
                </div>
                <div class="ck-seg" role="group" aria-label="Rol filtresi">
                    <button v-for="opt in roleOptions" :key="opt.value" type="button" class="ck-seg-btn" :class="{ 'is-active': roleFilter === opt.value }" @click="roleFilter = opt.value">{{ opt.label }}</button>
                </div>
            </div>

            <CaykurPanel>
                <template #head><span class="ck-panel-meta">{{ formatNumber(filtered.length) }} personel</span></template>
                <div class="ck-table-wrap">
                    <table class="ck-table">
                        <thead>
                            <tr>
                                <th>Personel</th>
                                <th>Rol</th>
                                <th>Kapsam</th>
                                <th>Son erişim</th>
                                <th>Durum</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="s in filtered" :key="s.id">
                                <td>
                                    <div class="ck-name-cell">
                                        <span class="ck-avatar">{{ s.fullName.charAt(0) }}</span>
                                        <div class="ck-name-main">
                                            <span class="ck-name-top">{{ s.fullName }}</span>
                                            <span class="ck-name-sub">{{ s.email }}</span>
                                        </div>
                                    </div>
                                </td>
                                <td>{{ roleLabel(s.role) }}</td>
                                <td>{{ s.scope }}</td>
                                <td style="white-space:nowrap">{{ relativeFromNow(s.lastActive) }}</td>
                                <td><StatusPill :label="s.active ? 'Aktif' : 'Pasif'" :tone="s.active ? 'success' : 'muted'" /></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </CaykurPanel>
        </template>

        <div v-else class="roles-grid">
            <CaykurPanel v-for="r in ROLE_DEFS" :key="r.id">
                <div class="role-card">
                    <div class="role-head">
                        <h3 class="role-name">{{ r.label }}</h3>
                        <span class="role-count">{{ formatNumber(ROLE_COUNTS.find(c => c.role === r.id)?.count ?? 0) }} kişi</span>
                    </div>
                    <p class="role-desc">{{ r.description }}</p>
                    <div class="role-access">
                        <span class="role-access-label">Erişebildiği modüller</span>
                        <div class="role-chips">
                            <span
                                v-for="m in ALL_MODULES.filter(mk => canAccess(r.id, mk))"
                                :key="m"
                                class="role-chip"
                            >{{ MODULE_LABELS[m] }}</span>
                        </div>
                    </div>
                </div>
            </CaykurPanel>
        </div>
    </CaykurPage>
</template>

<style scoped>
.roles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--space-4);
}
.role-card { padding: var(--space-5); }
.role-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.role-name { margin: 0; font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.role-count {
    font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary); background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border); padding: 2px 8px; border-radius: var(--radius-full); white-space: nowrap;
}
.role-desc { margin: var(--space-2) 0 var(--space-4); font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.5; }
.role-access-label { font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); text-transform: uppercase; letter-spacing: 0.03em; color: var(--color-text-muted); }
.role-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: var(--space-2); }
.role-chip {
    font-size: var(--font-size-xs); font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary); background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border); padding: 2px 8px; border-radius: var(--radius-sm);
}
</style>
