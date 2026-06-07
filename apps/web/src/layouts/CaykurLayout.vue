<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router';
import { useCaykurStore } from '@/stores/caykurStore';

const router = useRouter();
const caykur = useCaykurStore();

function backToApp() {
    router.push('/tea/dashboard');
}
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
                    <span class="ck-brand-sub">Müstahsil İzleme Paneli</span>
                </div>
            </div>

            <div class="ck-header-right">
                <span class="ck-season">{{ caykur.season }}</span>
                <button type="button" class="ck-back" @click="backToApp">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    <span>Uygulamaya dön</span>
                </button>
            </div>
        </header>

        <div class="ck-body">
            <aside class="ck-sidebar" aria-label="Çaykur paneli menüsü">
                <nav class="ck-nav">
                    <RouterLink to="/caykur" class="ck-nav-item" exact-active-class="is-active">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></svg>
                        <span>Genel Bakış</span>
                    </RouterLink>
                    <RouterLink to="/caykur/producers" class="ck-nav-item" active-class="is-active">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                        <span>Müstahsiller</span>
                    </RouterLink>
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

.ck-back {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 38px;
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
    grid-template-columns: 248px minmax(0, 1fr);
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
    padding: var(--space-5) var(--space-4);
    background: var(--color-bg-secondary);
    border-right: 1px solid var(--color-border);
}

.ck-nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
}

.ck-nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 46px;
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
    padding: 0 var(--space-4);
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
@media (max-width: 900px) {
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
    .ck-nav-item {
        min-height: 40px;
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
}
</style>
