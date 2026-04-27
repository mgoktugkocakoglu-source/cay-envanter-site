<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

const authStore = useAuthStore();
const themeStore = useThemeStore();
const router = useRouter();
const isMobileMenuOpen = ref(false);

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};

function toggleMobileMenu() {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
}

function closeMobileMenu() {
  isMobileMenuOpen.value = false;
}

function switchToSocial() {
  localStorage.setItem('cayhesabim_last_hub', 'social');
  router.push('/social/dashboard');
}
</script>

<template>
  <div class="hub-layout tea-hub">
    <header class="hub-header">
      <div class="hub-header-left">
        <RouterLink to="/tea/dashboard" class="hub-logo">
          <img v-if="themeStore.theme === 'dark'" src="@/assets/images/logo-dark.svg" alt="Çay Hesabım Logo" class="hub-logo-img" />
          <img v-else src="@/assets/images/logo-light.svg" alt="Çay Hesabım Logo" class="hub-logo-img" />
        </RouterLink>
        <div class="hub-badge tea-badge">
          <span class="hub-badge-icon">🍃</span>
          <span class="hub-badge-text">Çay İşleri Hesabı</span>
        </div>
      </div>

      <nav class="hub-nav" :class="{ 'is-open': isMobileMenuOpen }">
        <RouterLink to="/tea/dashboard" class="nav-link" @click="closeMobileMenu" exact-active-class="router-link-active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span>Ana Sayfa</span>
        </RouterLink>
        <RouterLink to="/tea/fields" class="nav-link" @click="closeMobileMenu" active-class="router-link-active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>Tarlalarım</span>
        </RouterLink>
        <RouterLink to="/tea/firms" class="nav-link" @click="closeMobileMenu" active-class="router-link-active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span>Firmalar</span>
        </RouterLink>
        <RouterLink to="/tea/harvests" class="nav-link" @click="closeMobileMenu" active-class="router-link-active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          <span>Hasatlarım</span>
        </RouterLink>
        <RouterLink to="/tea/payments" class="nav-link" @click="closeMobileMenu" active-class="router-link-active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <span>Ödemeler</span>
        </RouterLink>

        <div class="nav-divider"></div>

        <RouterLink to="/tea/settings" class="nav-link nav-link--secondary" @click="closeMobileMenu" active-class="router-link-active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <span>Ayarlar</span>
        </RouterLink>

        <button class="btn-logout" @click="handleLogout">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span>Çıkış Yap</span>
        </button>
      </nav>

      <div class="hub-header-right">
        <button class="hub-switch-btn" @click="switchToSocial" title="Sosyal İş Hesabı'na geç">
          <span class="hub-switch-icon">🤝</span>
          <span class="hub-switch-label">Sosyal İş</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button
          class="theme-toggle"
          :title="themeStore.theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'"
          @click="themeStore.toggleTheme()"
        >
          <svg v-if="themeStore.theme === 'dark'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
        <button
          class="mobile-menu-toggle"
          :aria-expanded="isMobileMenuOpen"
          aria-label="Menüyü aç/kapat"
          @click="toggleMobileMenu"
        >
          <svg v-if="!isMobileMenuOpen" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
    </header>

    <main class="hub-content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.hub-layout {
  min-height: 100vh;
  background: var(--color-bg-primary);
}

.hub-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 var(--space-6);
  height: 64px;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  transition: background-color 0.2s ease, border-color 0.2s ease;
  position: sticky;
  top: 0;
  z-index: 50;
}

.hub-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.hub-logo {
  display: flex;
  align-items: center;
  text-decoration: none;
  transition: transform 0.2s;
}
.hub-logo:hover { transform: scale(1.04); }
.hub-logo-img {
  height: 40px;
  width: auto;
  object-fit: contain;
}

.hub-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--radius-full);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.tea-badge {
  background: rgba(16, 185, 129, 0.12);
  color: var(--color-primary);
  border: 1px solid rgba(16, 185, 129, 0.25);
}
.hub-badge-icon { font-size: 15px; }

/* ── NAV ── */
.hub-nav {
  display: flex;
  align-items: center;
  gap: 2px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-secondary);
  font-weight: 500;
  font-size: 14px;
  text-decoration: none;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  transition: all 0.2s;
  white-space: nowrap;
}
.nav-link:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
}
.nav-link.router-link-active {
  color: var(--color-primary);
  background: var(--color-primary-light);
  font-weight: 600;
}
.nav-link svg { flex-shrink: 0; }
.nav-link span { display: inline; }

.nav-link--secondary {
  color: var(--color-text-muted);
  font-size: 13px;
}

.nav-divider {
  width: 1px;
  height: 24px;
  background: var(--color-border);
  margin: 0 4px;
}

.btn-logout {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  padding: 7px 14px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-logout:hover {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

/* ── Header Right ── */
.hub-header-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.hub-switch-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: var(--radius-full);
  color: var(--color-info);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.hub-switch-btn:hover {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.4);
  transform: translateX(2px);
}
.hub-switch-icon { font-size: 15px; }

.theme-toggle {
  display: flex;
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
.theme-toggle:hover {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.mobile-menu-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}
.mobile-menu-toggle:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

/* ── RESPONSIVE ── */
@media (max-width: 1024px) {
  .nav-link span { display: none; }
  .nav-link { padding: 8px; }
  .hub-badge-text { display: none; }
  .hub-switch-label { display: none; }
}

@media (max-width: 768px) {
  .hub-header {
    height: auto;
    min-height: 60px;
    padding: 8px 16px;
  }
  .mobile-menu-toggle { display: flex; }
  .hub-nav {
    display: none;
    width: 100%;
    flex-direction: column;
    gap: 4px;
    padding: 12px 0;
    border-top: 1px solid var(--color-border);
    order: 3;
    background: var(--color-bg-secondary);
  }
  .hub-nav.is-open { display: flex; }
  .nav-link {
    width: 100%;
    padding: 10px 12px;
  }
  .nav-link span { display: inline; }
  .nav-divider {
    width: 100%;
    height: 1px;
    margin: 4px 0;
  }
  .btn-logout { width: 100%; justify-content: center; }
}
</style>
