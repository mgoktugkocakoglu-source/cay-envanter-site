<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

const authStore = useAuthStore();
const themeStore = useThemeStore();
const router = useRouter();

const isUserMenuOpen = ref(false);
const userMenuRef = ref<HTMLElement | null>(null);

const userInitial = computed(() => authStore.user?.fullName?.charAt(0)?.toUpperCase() ?? '?');
const userName = computed(() => authStore.user?.fullName ?? 'Kullanıcı');
const userAvatar = computed(() => authStore.user?.avatarUrl ?? '');
const userCuzdan = computed(() => authStore.user?.cuzdanNo ?? '');

function toggleUserMenu() {
  isUserMenuOpen.value = !isUserMenuOpen.value;
}

function closeUserMenu() {
  isUserMenuOpen.value = false;
}

function goToSettings() {
  closeUserMenu();
  router.push('/tea/settings');
}

function goToAdmin() {
  closeUserMenu();
  router.push('/admin');
}

function goToCaykur() {
  closeUserMenu();
  router.push('/caykur');
}

async function handleLogout() {
  closeUserMenu();
  await authStore.logout();
  router.push('/login');
}

function handleClickOutside(event: MouseEvent) {
  if (userMenuRef.value && !userMenuRef.value.contains(event.target as Node)) {
    closeUserMenu();
  }
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') closeUserMenu();
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside);
  document.addEventListener('keydown', handleEscape);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside);
  document.removeEventListener('keydown', handleEscape);
});
</script>

<template>
  <div class="hub-layout tea-hub">
    <header class="hub-header">
      <!-- ─── LEFT: Logo + Context ─── -->
      <div class="hub-header-left">
        <RouterLink to="/tea/dashboard" class="hub-logo" aria-label="Çay Hesabım Ana Sayfa">
          <img v-if="themeStore.theme === 'dark'" src="@/assets/images/logo-dark.svg" alt="Çay Hesabım" class="hub-logo-img" />
          <img v-else src="@/assets/images/logo-light.svg" alt="Çay Hesabım" class="hub-logo-img" />
        </RouterLink>
      </div>

      <!-- ─── CENTER: empty for now (rail handles nav) ─── -->
      <div class="hub-spacer" aria-hidden="true"></div>

      <!-- ─── RIGHT: Actions ─── -->
      <div class="hub-header-right">
        <button
          class="icon-btn"
          type="button"
          :title="themeStore.theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'"
          :aria-label="themeStore.theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'"
          @click="themeStore.toggleTheme()"
        >
          <svg v-if="themeStore.theme === 'dark'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>

        <div ref="userMenuRef" class="user-menu">
          <button
            class="user-menu-trigger"
            type="button"
            :aria-expanded="isUserMenuOpen"
            aria-haspopup="menu"
            @click="toggleUserMenu"
          >
            <span class="user-avatar">
              <img v-if="userAvatar" :src="userAvatar" :alt="userName" />
              <span v-else>{{ userInitial }}</span>
            </span>
            <span class="user-trigger-text">
              <span class="user-name">{{ userName }}</span>
              <span v-if="userCuzdan" class="user-cuzdan">Cüzdan No: {{ userCuzdan }}</span>
            </span>
            <svg class="user-caret" :class="{ 'is-open': isUserMenuOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>

          <transition name="user-menu">
            <div v-if="isUserMenuOpen" class="user-menu-dropdown" role="menu">
              <div class="user-menu-header">
                <span class="user-avatar lg">
                  <img v-if="userAvatar" :src="userAvatar" :alt="userName" />
                  <span v-else>{{ userInitial }}</span>
                </span>
                <div class="user-menu-meta">
                  <span class="user-menu-name">{{ userName }}</span>
                  <span v-if="userCuzdan" class="user-menu-cuzdan">Çaykur Cüzdan No: {{ userCuzdan }}</span>
                  <span v-if="authStore.user?.email" class="user-menu-email">{{ authStore.user.email }}</span>
                </div>
              </div>
              <div class="user-menu-divider"></div>
              <button v-if="authStore.isAdmin" class="user-menu-item" type="button" role="menuitem" @click="goToCaykur">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></svg>
                <span>Çaykur Paneli</span>
              </button>
              <button v-if="authStore.isAdmin" class="user-menu-item" type="button" role="menuitem" @click="goToAdmin">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
                <span>Admin Panel</span>
              </button>
              <button class="user-menu-item" type="button" role="menuitem" @click="goToSettings">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                <span>Ayarlar</span>
              </button>
              <div class="user-menu-divider"></div>
              <button class="user-menu-item user-menu-item--danger" type="button" role="menuitem" @click="handleLogout">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                <span>Çıkış Yap</span>
              </button>
            </div>
          </transition>
        </div>
      </div>
    </header>

    <div class="hub-body">
      <aside class="app-rail" aria-label="Çay işleri menüsü">
        <RouterLink to="/tea/dashboard" class="app-nav-item" exact-active-class="router-link-active">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span>Ana Sayfa</span>
        </RouterLink>
        <RouterLink to="/tea/fields" class="app-nav-item" active-class="router-link-active">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>Arazilerim</span>
        </RouterLink>
        <RouterLink to="/tea/firms" class="app-nav-item" active-class="router-link-active">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/><path d="M12 14h.01"/></svg>
          <span>Firmalar</span>
        </RouterLink>
        <RouterLink to="/tea/harvests" class="app-nav-item" active-class="router-link-active">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          <span>Hasatlarım</span>
        </RouterLink>
        <RouterLink to="/tea/pruning" class="app-nav-item" active-class="router-link-active">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14l6-6"/><path d="M8 18l6-6"/><path d="M14 6l4-4"/><path d="M16 8l4-4"/><path d="M4 20l16-16"/></svg>
          <span>Budama</span>
        </RouterLink>
        <RouterLink to="/tea/payments" class="app-nav-item" active-class="router-link-active">
          <span class="currency-nav-icon" aria-hidden="true">₺</span>
          <span>Ödemeler</span>
        </RouterLink>
        <RouterLink to="/tea/ai-agent" class="app-nav-item" active-class="router-link-active">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 0-5 5v2H6a4 4 0 0 0 0 8h1v1a4 4 0 0 0 8 0v-1h3a4 4 0 0 0 0-8h-1V7a5 5 0 0 0-5-5z"/><path d="M9 9h.01"/><path d="M15 9h.01"/><path d="M9 14h6"/></svg>
          <span>AI Agent</span>
        </RouterLink>
      </aside>

      <main class="hub-content">
        <slot />
      </main>
    </div>

    <nav class="bottom-tabs" aria-label="Çay işleri alt menüsü">
      <RouterLink to="/tea/dashboard" class="bottom-tab" exact-active-class="router-link-active">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>Ana Sayfa</span>
      </RouterLink>
      <RouterLink to="/tea/fields" class="bottom-tab" active-class="router-link-active">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>Araziler</span>
      </RouterLink>
      <RouterLink to="/tea/firms" class="bottom-tab" active-class="router-link-active">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/><path d="M12 14h.01"/></svg>
        <span>Firmalar</span>
      </RouterLink>
      <RouterLink to="/tea/harvests" class="bottom-tab" active-class="router-link-active">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        <span>Hasatlar</span>
      </RouterLink>
      <RouterLink to="/tea/pruning" class="bottom-tab" active-class="router-link-active">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14l6-6"/><path d="M8 18l6-6"/><path d="M14 6l4-4"/><path d="M16 8l4-4"/><path d="M4 20l16-16"/></svg>
        <span>Budama</span>
      </RouterLink>
      <RouterLink to="/tea/payments" class="bottom-tab" active-class="router-link-active">
        <span class="currency-nav-icon" aria-hidden="true">₺</span>
        <span>Ödemeler</span>
      </RouterLink>
      <RouterLink to="/tea/ai-agent" class="bottom-tab" active-class="router-link-active">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 0-5 5v2H6a4 4 0 0 0 0 8h1v1a4 4 0 0 0 8 0v-1h3a4 4 0 0 0 0-8h-1V7a5 5 0 0 0-5-5z"/><path d="M9 9h.01"/><path d="M15 9h.01"/><path d="M9 14h6"/></svg>
        <span>AI</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.hub-layout {
  min-height: 100vh;
  background: var(--color-bg-primary);
}

/* ── Header shell ── */
.hub-header {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  align-items: center;
  gap: var(--space-4);
  padding: 0 var(--space-6);
  padding-top: env(safe-area-inset-top);
  padding-left: max(var(--space-6), env(safe-area-inset-left));
  padding-right: max(var(--space-6), env(safe-area-inset-right));
  height: calc(64px + env(safe-area-inset-top));
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  transition: background-color 0.2s ease, border-color 0.2s ease;
  position: sticky;
  top: 0;
  z-index: 50;
}

/* ── Left cluster ── */
.hub-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.hub-logo {
  display: flex;
  align-items: center;
  text-decoration: none;
  flex-shrink: 0;
}
.hub-logo-img {
  height: 36px;
  width: auto;
  object-fit: contain;
}

.hub-spacer {
  display: block;
}

/* ── Right cluster ── */
.hub-header-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  justify-content: flex-end;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}
.icon-btn:hover {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}
.icon-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

/* ── User menu ── */
.user-menu {
  position: relative;
}

.user-menu-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 4px 4px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-text-primary);
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
}
.user-menu-trigger:hover {
  background: var(--color-bg-primary);
  border-color: var(--color-text-muted);
}
.user-menu-trigger[aria-expanded="true"] {
  background: var(--color-bg-primary);
  border-color: var(--color-primary);
}
.user-menu-trigger:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  flex-shrink: 0;
}
.user-avatar img { width: 100%; height: 100%; object-fit: cover; }
.user-avatar.lg { width: 42px; height: 42px; font-size: 16px; }

.user-trigger-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-width: 0;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  max-width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-cuzdan {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-muted);
  max-width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-menu-cuzdan {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-caret {
  color: var(--color-text-muted);
  transition: transform 0.2s ease;
}
.user-caret.is-open { transform: rotate(180deg); }

.user-menu-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 260px;
  padding: 6px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: var(--z-dropdown);
}

.user-menu-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
}
.user-menu-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.user-menu-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-menu-email {
  font-size: 12px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-menu-divider {
  height: 1px;
  background: var(--color-border);
  margin: 4px 0;
}

.user-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}
.user-menu-item:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}
.user-menu-item:focus-visible {
  outline: none;
  box-shadow: inset var(--focus-ring);
}
.user-menu-item svg { flex-shrink: 0; }
.user-menu-item--danger { color: var(--color-text-muted); }
.user-menu-item--danger:hover {
  background: color-mix(in srgb, var(--color-danger) 8%, transparent);
  color: var(--color-danger);
}

/* Dropdown transition */
.user-menu-enter-active,
.user-menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.user-menu-enter-from,
.user-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

/* ── Body / Rail ── */
.hub-body {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  min-height: calc(100vh - 64px - env(safe-area-inset-top));
}

.app-rail {
  position: sticky;
  top: calc(64px + env(safe-area-inset-top));
  align-self: start;
  height: calc(100vh - 64px - env(safe-area-inset-top));
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-3);
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
}

.app-nav-item {
  min-height: 76px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: var(--space-3) var(--space-2);
  border-radius: var(--radius-lg);
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  text-align: center;
  transition: color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.app-nav-item:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
}

.app-nav-item:focus-visible {
  outline: none;
  box-shadow: inset var(--focus-ring);
}

.app-nav-item.router-link-active {
  color: var(--color-primary);
  background: var(--color-primary-light);
}

.app-nav-item svg {
  flex-shrink: 0;
}

.currency-nav-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  flex-shrink: 0;
}

.bottom-tabs {
  display: none;
}

/* ── RESPONSIVE ── */
@media (max-width: 1024px) {
  .user-trigger-text { display: none; }
  .user-menu-trigger { padding: 4px; }
}

@media (max-width: 768px) {
  .hub-layout {
    padding-bottom: calc(72px + env(safe-area-inset-bottom));
  }

  .hub-header {
    grid-template-columns: 1fr auto;
    gap: var(--space-2);
    height: calc(60px + env(safe-area-inset-top));
    padding: 0 12px;
    padding-top: env(safe-area-inset-top);
    padding-left: max(12px, env(safe-area-inset-left));
    padding-right: max(12px, env(safe-area-inset-right));
  }
  .hub-spacer { display: none; }
  .hub-divider-v { display: none; }
  .hub-context-icon { display: none; }
  .hub-logo-img { height: 32px; }
  .hub-switch-btn .hub-switch-label,
  .hub-switch-btn svg:last-child { display: none; }
  .hub-switch-btn {
    width: 38px;
    height: 38px;
    padding: 0;
    justify-content: center;
    border-radius: var(--radius-md);
  }
  .hub-switch-icon {
    margin-left: 0;
  }

  .hub-body {
    display: block;
    min-height: auto;
  }
  .app-rail {
    display: none;
  }
  .bottom-tabs {
    position: fixed;
    left: max(10px, env(safe-area-inset-left));
    right: max(10px, env(safe-area-inset-right));
    bottom: max(10px, env(safe-area-inset-bottom));
    z-index: 70;
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 3px;
    padding: 6px;
    background: color-mix(in srgb, var(--color-bg-secondary) 94%, transparent);
    border: 1px solid var(--color-border);
    border-radius: 22px;
    box-shadow: var(--shadow-md);
    backdrop-filter: blur(16px);
  }
  .bottom-tab {
    min-width: 0;
    min-height: 54px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    border-radius: 16px;
    color: var(--color-text-muted);
    text-decoration: none;
    font-size: 10px;
    font-weight: var(--font-weight-semibold);
    line-height: 1.1;
  }
  .bottom-tab.router-link-active {
    color: var(--color-primary);
    background: var(--color-primary-light);
  }
  .bottom-tab:focus-visible {
    outline: none;
    box-shadow: inset var(--focus-ring);
  }
  .bottom-tab svg {
    flex-shrink: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .user-menu-enter-active,
  .user-menu-leave-active,
  .user-caret,
  .app-nav-item,
  .icon-btn,
  .user-menu-trigger,
  .user-menu-item {
    transition: none;
  }
}
</style>
