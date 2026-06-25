<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { RouterLink, useRouter, useRoute } from 'vue-router';
import { useCaykurStore } from '@/stores/caykurStore';
import { usePruningRequestsStore } from '@/stores/pruningRequestsStore';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { NAV_GROUPS } from '@/services/caykur/nav';
import { ROLE_DEFS, MODULE_LABELS, type ModuleKey } from '@/services/caykur/roles';
import { ANNOUNCEMENTS } from '@/services/caykur/comms';
import CaykurCommandPalette from '@/components/caykur/CaykurCommandPalette.vue';
import caykurLogo from '@/assets/caykur-logo.svg';

const router = useRouter();
const route = useRoute();
const caykur = useCaykurStore();
const pruningRequests = usePruningRequestsStore();
const themeStore = useThemeStore();
const authStore = useAuthStore();

const menuOpen = ref(false);
const bellOpen = ref(false);
const paletteOpen = ref(false);

// ── Sidebar collapse (desktop) ──
const COLLAPSE_KEY = 'caykur_sidebar_collapsed';
const collapsed = ref(localStorage.getItem(COLLAPSE_KEY) === '1');

function toggleSidebar(): void {
    collapsed.value = !collapsed.value;
    localStorage.setItem(COLLAPSE_KEY, collapsed.value ? '1' : '0');
}

async function logout(): Promise<void> {
    menuOpen.value = false;
    await authStore.logout();
    router.push('/login');
}

/** Nav groups with items filtered to what the active role may access. */
const visibleGroups = computed(() =>
    NAV_GROUPS
        .map((g) => ({ ...g, items: g.items.filter((it) => caykur.can(it.module)) }))
        .filter((g) => g.items.length > 0),
);

/** Open work counts surfaced as quiet badges next to their module. */
const navBadges = computed<Partial<Record<ModuleKey, number>>>(() => ({
    deliveries: caykur.ops.pendingDeliveries,
    pruning: caykur.ops.pendingAudits,
    pruning_requests: pruningRequests.countByStatus('pending'),
    parcels: caykur.ops.parcelsPendingVerification,
    finance: caykur.ops.paymentsAwaitingApproval,
    requests: caykur.ops.openRequests,
    tasks: caykur.ops.overdueTasks,
}));

// ── Breadcrumbs ──
interface Crumb {
    label: string;
    to: string;
}

const crumbs = computed<Crumb[]>(() => {
    const list: Crumb[] = [{ label: 'Kurum Paneli', to: '/caykur' }];
    const moduleKey = route.meta.module as ModuleKey | undefined;
    if (moduleKey && route.path !== '/caykur') {
        const navItem = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.module === moduleKey);
        const listPath = navItem?.to ?? `/caykur/${moduleKey}`;
        list.push({ label: MODULE_LABELS[moduleKey], to: listPath });
        if (route.path !== listPath) {
            list.push({
                label: route.path.endsWith('/new') ? 'Yeni kayıt' : 'Detay',
                to: route.path,
            });
        }
    }
    return list;
});

// ── Notifications (announcements feed) ──
const notifications = computed(() =>
    [...ANNOUNCEMENTS]
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.publishedAt.localeCompare(a.publishedAt))
        .slice(0, 5),
);

const dateFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });

function formatShortDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : dateFormatter.format(d);
}

function openAnnouncements(): void {
    bellOpen.value = false;
    router.push('/caykur/announcements');
}

// ── Header actions ──
const isMac = navigator.platform.toUpperCase().includes('MAC');

function backToApp(): void {
    menuOpen.value = false;
    router.push('/tea/dashboard');
}

function selectRole(role: typeof ROLE_DEFS[number]['id']): void {
    caykur.setRole(role);
    menuOpen.value = false;
}

function onGlobalKeydown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        paletteOpen.value = !paletteOpen.value;
    }
}

onMounted(() => {
    window.addEventListener('keydown', onGlobalKeydown);
    // Populate the Budama Talepleri badge from the DB.
    pruningRequests.fetchAll();
});
onUnmounted(() => window.removeEventListener('keydown', onGlobalKeydown));

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
    <div class="caykur-shell" :data-collapsed="collapsed">
        <header class="ck-header">
            <div class="ck-header-left">
                <button
                    type="button"
                    class="ck-btn ck-btn-ghost ck-icon-btn ck-collapse-btn"
                    :aria-label="collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'"
                    :aria-expanded="!collapsed"
                    @click="toggleSidebar"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
                </button>

                <RouterLink to="/caykur" class="ck-brand" aria-label="Çaykur Kurumsal Müstahsil Platformu">
                    <img :src="caykurLogo" alt="Çaykur" class="ck-logo" />
                    <span class="ck-brand-text">
                        <span class="ck-brand-sub">Kurumsal Müstahsil Platformu</span>
                    </span>
                </RouterLink>

                <span class="ck-header-divider" aria-hidden="true"></span>

                <nav class="ck-crumbs ck-header-crumbs" aria-label="Konum">
                    <template v-for="(crumb, i) in crumbs" :key="crumb.to">
                        <svg v-if="i > 0" class="ck-crumb-sep" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
                        <RouterLink v-if="i < crumbs.length - 1" :to="crumb.to" class="ck-crumb">
                            {{ crumb.label }}
                        </RouterLink>
                        <span v-else class="ck-crumb is-current" aria-current="page">{{ crumb.label }}</span>
                    </template>
                </nav>
            </div>

            <div class="ck-header-right">
                <button type="button" class="ck-search-btn" @click="paletteOpen = true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <span class="ck-search-btn-label">Ara veya git…</span>
                    <span class="ck-kbd ck-search-kbd">{{ isMac ? '⌘K' : 'Ctrl K' }}</span>
                </button>

                <span class="ck-season">{{ caykur.season }}</span>

                <button
                    type="button"
                    class="ck-btn ck-btn-ghost ck-icon-btn"
                    :aria-label="themeStore.theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'"
                    @click="themeStore.toggleTheme()"
                >
                    <svg v-if="themeStore.theme === 'dark'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
                    <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                </button>

                <div v-if="caykur.can('announcements')" class="ck-bell">
                    <button
                        type="button"
                        class="ck-btn ck-btn-ghost ck-icon-btn"
                        aria-label="Duyurular"
                        :aria-expanded="bellOpen"
                        aria-haspopup="true"
                        @click="bellOpen = !bellOpen"
                    >
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                        <span v-if="notifications.length" class="ck-bell-dot" aria-hidden="true"></span>
                    </button>

                    <div v-if="bellOpen" class="ck-menu-backdrop" @click="bellOpen = false"></div>
                    <div v-if="bellOpen" class="ck-menu ck-bell-menu ck-pop-in" role="menu" aria-label="Son duyurular">
                        <p class="ck-menu-title">Son duyurular</p>
                        <button
                            v-for="n in notifications"
                            :key="n.id"
                            type="button"
                            class="ck-menu-item ck-bell-item"
                            role="menuitem"
                            @click="openAnnouncements"
                        >
                            <span class="ck-menu-item-main">
                                <span class="ck-menu-item-label ck-bell-title">
                                    {{ n.title }}
                                </span>
                                <span class="ck-menu-item-desc">
                                    {{ formatShortDate(n.publishedAt) }} · {{ n.audienceLabel }}
                                </span>
                            </span>
                            <span v-if="n.pinned" class="ck-pill no-dot ck-bell-pin" data-tone="info">Sabit</span>
                        </button>
                        <div class="ck-menu-sep" aria-hidden="true"></div>
                        <button type="button" class="ck-menu-item ck-menu-item-cta" role="menuitem" @click="openAnnouncements">
                            <span class="ck-menu-item-label">Tüm duyuruları aç</span>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                        </button>
                    </div>
                </div>

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
                    <div v-if="menuOpen" class="ck-menu ck-pop-in" role="menu">
                        <template v-if="caykur.canSwitchPersona">
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
                            <div style="height:1px;background:var(--color-border);margin:6px 0"></div>
                        </template>
                        <button type="button" class="ck-menu-item" role="menuitem" @click="logout">
                            <span class="ck-menu-item-main">
                                <span class="ck-menu-item-label">Çıkış yap</span>
                                <span class="ck-menu-item-desc">{{ authStore.user?.email }}</span>
                            </span>
                        </button>
                        <div class="ck-menu-sep" aria-hidden="true"></div>
                        <button type="button" class="ck-menu-item" role="menuitem" @click="backToApp">
                            <span class="ck-menu-item-main">
                                <span class="ck-menu-item-label ck-menu-item-row">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                                    Uygulamaya dön
                                </span>
                            </span>
                        </button>
                    </div>
                </div>

                <button v-if="authStore.isAdmin" type="button" class="ck-back" @click="backToApp">
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
                            :title="collapsed ? item.label : undefined"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="item.iconSvg" />
                            <span class="ck-nav-label">{{ item.label }}</span>
                            <span
                                v-if="navBadges[item.module]"
                                class="ck-nav-badge"
                                :aria-label="`${navBadges[item.module]} bekleyen kayıt`"
                            >{{ navBadges[item.module] }}</span>
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

        <CaykurCommandPalette v-model:open="paletteOpen" />
    </div>
</template>

<style scoped>
.caykur-shell {
    min-height: 100vh;
    background: var(--color-bg-primary);
    /* Çaykur corporate identity — scoped to the Kurum panel only, so the
       producer app keeps its working-green system. Cascades to every ck-*
       primitive (nav, buttons, badges, focus rings, KPIs) via custom props. */
    --color-primary: #e2001a;
    --color-primary-hover: #c30016;
    --color-primary-dark: #a8000f;
    --color-primary-light: rgba(226, 0, 26, 0.10);
    --color-secondary: #4f9a1e;
    --focus-ring: 0 0 0 3px rgba(226, 0, 26, 0.28);
}

/* ── Header ── */
.ck-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    height: var(--header-height);
    padding: 0 var(--space-4) 0 var(--space-3);
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    z-index: var(--z-header);
}

.ck-header-left {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
}

.ck-brand {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
    padding: 4px 6px;
    margin: -4px 0;
    border-radius: var(--radius-md);
    text-decoration: none;
}
.ck-brand:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
}

.ck-logo {
    height: 30px;
    width: auto;
    display: block;
    flex-shrink: 0;
}

.ck-brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    min-width: 0;
}
.ck-brand-name {
    font-size: var(--font-size-base);
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

.ck-header-divider {
    width: 1px;
    height: 22px;
    background: var(--color-border);
    margin: 0 var(--space-2);
    flex-shrink: 0;
}

.ck-header-crumbs {
    overflow: hidden;
}

.ck-header-right {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
}

/* ── Search (palette trigger) ── */
.ck-search-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: 38px;
    width: 230px;
    padding: 0 var(--space-2) 0 var(--space-3);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    font-family: inherit;
    cursor: pointer;
    transition: border-color var(--transition-fast), background var(--transition-fast);
}
.ck-search-btn:hover {
    border-color: var(--color-border-strong);
    background: var(--color-bg-secondary);
}
.ck-search-btn:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
}
.ck-search-btn-label {
    flex: 1;
    text-align: left;
    font-size: var(--font-size-sm);
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
    font-variant-numeric: tabular-nums;
}

/* ── Bell ── */
.ck-bell {
    position: relative;
}
.ck-bell .ck-icon-btn {
    position: relative;
}
.ck-bell-dot {
    position: absolute;
    top: 9px;
    right: 9px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-danger);
    box-shadow: 0 0 0 2px var(--color-bg-secondary);
}
.ck-bell-menu {
    width: 360px;
}
.ck-bell-item {
    align-items: flex-start;
}
.ck-bell-title {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 250px;
}
.ck-bell-pin {
    flex-shrink: 0;
    margin-top: 2px;
}

/* ── Persona switcher ── */
.ck-persona {
    position: relative;
}
.ck-persona-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: 40px;
    padding: 0 8px 0 5px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-family: inherit;
    transition: border-color var(--transition-fast), background var(--transition-fast);
}
.ck-persona-btn:hover {
    background: var(--color-bg-tertiary);
    border-color: var(--color-border-strong);
}
.ck-persona-btn:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
}
.ck-persona-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--color-secondary);
    color: #fff;
    font-weight: var(--font-weight-bold);
    font-size: var(--font-size-xs);
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
    z-index: var(--z-dropdown);
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
.ck-menu-sep {
    height: 1px;
    margin: var(--space-2) calc(var(--space-2) * -1);
    background: var(--color-border);
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
.ck-menu-item:focus-visible {
    outline: none;
    box-shadow: inset var(--focus-ring);
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
.ck-menu-item-row {
    display: inline-flex;
    align-items: center;
    gap: 8px;
}
.ck-menu-item-desc {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    line-height: 1.35;
}
.ck-menu-item-cta {
    color: var(--color-text-secondary);
}
.ck-menu-item-cta:hover {
    color: var(--color-text-primary);
}
.ck-back:focus-visible,
.ck-persona-btn:focus-visible {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
}

/* ── Body ── */
.ck-body {
    display: grid;
    grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
    min-height: calc(100vh - var(--header-height));
    transition: grid-template-columns 200ms var(--ease-out-quint);
}
.caykur-shell[data-collapsed='true'] .ck-body {
    grid-template-columns: var(--sidebar-width-collapsed) minmax(0, 1fr);
}

.ck-sidebar {
    position: sticky;
    top: var(--header-height);
    align-self: start;
    height: calc(100vh - var(--header-height));
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: var(--space-4) var(--space-3) var(--space-5);
    background: var(--color-bg-secondary);
    border-right: 1px solid var(--color-border);
    overflow-y: auto;
    overflow-x: hidden;
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
    padding: 0 var(--space-3) 4px;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    white-space: nowrap;
}

.ck-nav-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 40px;
    padding: 0 var(--space-3);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    text-decoration: none;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    transition: color var(--transition-fast), background var(--transition-fast);
}
.ck-nav-item:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
}
.ck-nav-item:focus-visible {
    outline: none;
    box-shadow: inset var(--focus-ring);
}
.ck-nav-item.is-active {
    color: var(--color-primary);
    background: var(--color-primary-light);
    font-weight: var(--font-weight-semibold);
}
.ck-nav-item:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-primary-light), 0 0 0 3px var(--color-primary);
}
.ck-nav-item svg {
    flex-shrink: 0;
}
.ck-nav-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.ck-nav-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    font-variant-numeric: tabular-nums;
    color: var(--color-text-secondary);
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-full);
    flex-shrink: 0;
}
.ck-nav-item.is-active .ck-nav-badge {
    color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 14%, transparent);
}

/* Collapsed rail: icons only, group dividers, badges become dots. */
.caykur-shell[data-collapsed='true'] .ck-nav-label,
.caykur-shell[data-collapsed='true'] .ck-nav-group-label,
.caykur-shell[data-collapsed='true'] .ck-sidebar-foot {
    display: none;
}
.caykur-shell[data-collapsed='true'] .ck-sidebar {
    padding-left: var(--space-2);
    padding-right: var(--space-2);
}
.caykur-shell[data-collapsed='true'] .ck-nav-item {
    justify-content: center;
    padding: 0;
}
.caykur-shell[data-collapsed='true'] .ck-nav-group + .ck-nav-group {
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-2);
    margin-top: calc(var(--space-2) * -1);
}
.caykur-shell[data-collapsed='true'] .ck-nav-badge {
    position: absolute;
    top: 7px;
    right: 7px;
    min-width: 7px;
    width: 7px;
    height: 7px;
    padding: 0;
    font-size: 0;
    background: var(--color-warning);
}

.ck-sidebar-foot {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: var(--space-4) var(--space-3) 0;
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
    padding: var(--space-6) var(--space-8) var(--space-12);
}

/* ── Responsive ── */
@media (max-width: 1359px) {
    .ck-brand-sub {
        display: none;
    }
}
@media (max-width: 1199px) {
    .ck-season {
        display: none;
    }
}
@media (max-width: 1099px) {
    .ck-header-divider,
    .ck-header-crumbs {
        display: none;
    }
    .ck-search-btn {
        width: 38px;
        padding: 0;
        justify-content: center;
        background: transparent;
        border-color: transparent;
        color: var(--color-text-secondary);
    }
    .ck-search-btn:hover {
        background: var(--color-bg-tertiary);
        border-color: transparent;
    }
    .ck-search-btn-label,
    .ck-search-kbd {
        display: none;
    }
}
@media (max-width: 980px) {
    .ck-collapse-btn {
        display: none;
    }
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
        gap: var(--space-2);
    }
    .ck-nav-group {
        flex-direction: row;
        align-items: center;
        gap: 2px;
    }
    .ck-nav-group-label,
    .ck-sidebar-foot {
        display: none;
    }
    .ck-nav-item {
        min-height: 38px;
        white-space: nowrap;
    }
    /* On the horizontal rail, ignore the desktop collapse state entirely. */
    .caykur-shell[data-collapsed='true'] .ck-nav-label {
        display: inline;
    }
    .caykur-shell[data-collapsed='true'] .ck-nav-item {
        justify-content: flex-start;
        padding: 0 var(--space-3);
    }
    .caykur-shell[data-collapsed='true'] .ck-nav-group + .ck-nav-group {
        border-top: none;
        padding-top: 0;
        margin-top: 0;
    }
    .caykur-shell[data-collapsed='true'] .ck-nav-badge {
        position: static;
        min-width: 20px;
        width: auto;
        height: 20px;
        padding: 0 6px;
        font-size: var(--font-size-xs);
        background: var(--color-bg-tertiary);
    }
    .ck-content-inner {
        padding: var(--space-5) var(--space-4) var(--space-10);
    }
    .ck-persona-id {
        display: none;
    }
}

@media (prefers-reduced-motion: reduce) {
    .ck-body {
        transition: none;
    }
}
</style>
