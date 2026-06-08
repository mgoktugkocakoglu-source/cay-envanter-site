<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRouter, useRoute } from 'vue-router';
import { useCaykurStore } from '@/stores/caykurStore';
import { NAV_GROUPS } from '@/services/caykur/nav';
import { ROLE_DEFS, type ModuleKey } from '@/services/caykur/roles';

const router = useRouter();
const route = useRoute();
const caykur = useCaykurStore();

const menuOpen = ref(false);

/** Nav groups with items filtered to what the active role may access. */
const visibleGroups = computed(() =>
    NAV_GROUPS
        .map((g) => ({ ...g, items: g.items.filter((it) => caykur.can(it.module)) }))
        .filter((g) => g.items.length > 0),
);

function backToApp(): void {
    router.push('/tea/dashboard');
}

function selectRole(role: typeof ROLE_DEFS[number]['id']): void {
    caykur.setRole(role);
    menuOpen.value = false;
}

// Redirect away from a module the current persona can't access (Faz 1 gating).
watch(
    () => [route.meta.module, caykur.role] as const,
    ([moduleKey]) => {
        const key = moduleKey as ModuleKey | undefined;
        if (key && !caykur.can(key)) {
            router.replace('/caykur');
        }
    },
    { immediate: true },
);
</script>

<template>
    <div class="caykur-shell">
        <header class="ck-header">
            <div class="ck-brand">
                <span class="ck-mark" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                        <path d="M2 21c0-3 1.85-5.36 5.08-6" />
                    </svg>
                </span>
                <div class="ck-brand-text">
                    <span class="ck-brand-name">Çaykur</span>
                    <span class="ck-brand-sub">Kurumsal Müstahsil Platformu</span>
                </div>
            </div>

            <div class="ck-header-right">
                <span class="ck-season">{{ caykur.season }}</span>

                <!-- Persona / role switcher (demo) -->
                <div class="ck-persona">
                    <button
                        type="button"
                        class="ck-persona-btn"
                        :aria-expanded="menuOpen"
                        aria-haspopup="true"
                        @click="menuOpen = !menuOpen"
                    >
                        <span class="ck-persona-avatar" aria-hidden="true">{{ caykur.persona.name.charAt(0) }}</span>
                        <span class="ck-persona-id">
                            <span class="ck-persona-name">{{ caykur.persona.name }}</span>
                            <span class="ck-persona-role">{{ caykur.currentRoleDef.label }}</span>
                        </span>
                        <svg class="ck-persona-caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                    </button>

                    <div v-if="menuOpen" class="ck-menu-backdrop" @click="menuOpen = false"></div>
                    <div v-if="menuOpen" class="ck-menu" role="menu">
                        <p class="ck-menu-title">Demo · rol değiştir</p>
                        <button
                            v-for="r in ROLE_DEFS"
                            :key="r.id"
                            type="button"
                            class="ck-menu-item"
                            :class="{ 'is-active': caykur.role === r.id }"
                            role="menuitemradio"
                            :aria-checked="caykur.role === r.id"
                            @click="selectRole(r.id)"
                        >
                            <span class="ck-menu-item-main">
                                <span class="ck-menu-item-label">{{ r.label }}</span>
                                <span class="ck-menu-item-desc">{{ r.description }}</span>
                            </span>
                            <svg v-if="caykur.role === r.id" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        </button>
                    </div>
                </div>

                <button type="button" class="ck-back" @click="backToApp">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    <span>Uygulamaya dön</span>
                </button>
            </div>
        </header>

        <div class="ck-body">
            <aside class="ck-sidebar" aria-label="Çaykur paneli menüsü">
                <nav class="ck-nav">
                    <div v-for="(group, gi) in visibleGroups" :key="gi" class="ck-nav-group">
                        <span v-if="group.label" class="ck-nav-group-label">{{ group.label }}</span>
                        <RouterLink
                            v-for="item in group.items"
                            :key="item.to"
                            :to="item.to"
                            class="ck-nav-item"
                            :active-class="item.exact ? '' : 'is-active'"
                            :exact-active-class="item.exact ? 'is-active' : ''"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="item.iconSvg" />
                            <span>{{ item.label }}</span>
                        </RouterLink>
                    </div>
                </nav>
                <div class="ck-sidebar-foot">
                    <span>Çay İşletmeleri</span>
                    <span>Genel Müdürlüğü</span>
                </div>
            </aside>

            <main class="ck-content">
                <div class="ck-content-inner">
                    <slot />
                </div>
            </main>
        </div>
    </div>
</template>

<style scoped>
.caykur-shell {
    min-height: 100vh;
    background: var(--color-bg-primary);
}

/* ── Header ── */
.ck-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    height: 64px;
    padding: 0 var(--space-6);
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    z-index: 50;
}

.ck-brand {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
}

.ck-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-md);
    background: var(--color-secondary);
    color: #fff;
    flex-shrink: 0;
}

.ck-brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    min-width: 0;
}
.ck-brand-name {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
    letter-spacing: -0.01em;
}
.ck-brand-sub {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-muted);
    white-space: nowrap;
}

.ck-header-right {
    display: flex;
    align-items: center;
    gap: var(--space-3);
}

.ck-season {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary);
    padding: 6px 12px;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    white-space: nowrap;
}

/* ── Persona switcher ── */
.ck-persona {
    position: relative;
}
.ck-persona-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: 44px;
    padding: 0 10px 0 6px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-family: inherit;
    transition: all var(--transition-fast);
}
.ck-persona-btn:hover {
    background: var(--color-bg-tertiary);
}
.ck-persona-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--color-secondary);
    color: #fff;
    font-weight: var(--font-weight-bold);
    font-size: var(--font-size-sm);
    flex-shrink: 0;
}
.ck-persona-id {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.2;
    min-width: 0;
}
.ck-persona-name {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    white-space: nowrap;
}
.ck-persona-role {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    white-space: nowrap;
}
.ck-persona-caret {
    color: var(--color-text-muted);
    flex-shrink: 0;
}
.ck-menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 90;
}
.ck-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 100;
    width: 320px;
    padding: var(--space-2);
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
}
.ck-menu-title {
    margin: 4px 8px 8px;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
}
.ck-menu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    width: 100%;
    padding: 10px var(--space-3);
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    text-align: left;
    cursor: pointer;
    color: var(--color-text-primary);
    font-family: inherit;
    transition: background var(--transition-fast);
}
.ck-menu-item:hover {
    background: var(--color-bg-tertiary);
}
.ck-menu-item.is-active {
    color: var(--color-primary);
}
.ck-menu-item-main {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
}
.ck-menu-item-label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
}
.ck-menu-item-desc {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    line-height: 1.35;
}

.ck-back {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 44px;
    padding: 0 14px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all var(--transition-fast);
}
.ck-back:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
}

/* ── Body ── */
.ck-body {
    display: grid;
    grid-template-columns: 256px minmax(0, 1fr);
    min-height: calc(100vh - 64px);
}

.ck-sidebar {
    position: sticky;
    top: 64px;
    align-self: start;
    height: calc(100vh - 64px);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: var(--space-4) var(--space-4) var(--space-5);
    background: var(--color-bg-secondary);
    border-right: 1px solid var(--color-border);
    overflow-y: auto;
}

.ck-nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
}
.ck-nav-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.ck-nav-group-label {
    padding: 0 var(--space-4) 4px;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
}

.ck-nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 42px;
    padding: 0 var(--space-4);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    text-decoration: none;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    transition: color var(--transition-fast), background var(--transition-fast);
}
.ck-nav-item:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
}
.ck-nav-item.is-active {
    color: var(--color-primary);
    background: var(--color-primary-light);
}
.ck-nav-item svg {
    flex-shrink: 0;
}

.ck-sidebar-foot {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: var(--space-4) var(--space-4) 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
}

/* ── Content ── */
.ck-content {
    min-width: 0;
}
.ck-content-inner {
    max-width: 1320px;
    margin: 0 auto;
    padding: var(--space-8) var(--space-8) var(--space-12);
}

/* ── Responsive ── */
@media (max-width: 980px) {
    .ck-body {
        display: block;
    }
    .ck-sidebar {
        position: static;
        height: auto;
        flex-direction: row;
        align-items: center;
        justify-content: flex-start;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-4);
        border-right: none;
        border-bottom: 1px solid var(--color-border);
        overflow-x: auto;
    }
    .ck-nav {
        flex-direction: row;
        gap: var(--space-4);
    }
    .ck-nav-group {
        flex-direction: row;
        align-items: center;
        gap: var(--space-2);
    }
    .ck-nav-group-label {
        display: none;
    }
    .ck-nav-item {
        min-height: 38px;
        white-space: nowrap;
    }
    .ck-sidebar-foot {
        display: none;
    }
    .ck-content-inner {
        padding: var(--space-5) var(--space-4) var(--space-10);
    }
    .ck-brand-sub {
        display: none;
    }
    .ck-back span {
        display: none;
    }
    .ck-back {
        padding: 0 11px;
    }
    .ck-persona-id {
        display: none;
    }
}
</style>
