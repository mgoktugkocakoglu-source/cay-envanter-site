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
</script>

<template>
  <div class="app-layout">
    <header class="app-header">
      <RouterLink to="/dashboard" class="app-logo">
        <img src="@/assets/images/logo.png" alt="Çay Hesabım Logo" class="app-logo-img" />
      </RouterLink>
      <nav class="app-nav" :class="{ 'is-open': isMobileMenuOpen }">
        <RouterLink to="/dashboard" class="nav-link" @click="closeMobileMenu" exact-active-class="router-link-active">Ana Sayfa</RouterLink>
        <RouterLink to="/fields" class="nav-link" @click="closeMobileMenu" active-class="router-link-active">Tarlalarım</RouterLink>
        <RouterLink to="/firms" class="nav-link" @click="closeMobileMenu" active-class="router-link-active">Firmalar</RouterLink>
        <RouterLink to="/harvests" class="nav-link" @click="closeMobileMenu" active-class="router-link-active">Hasatlarım</RouterLink>
        <RouterLink to="/payments" class="nav-link" @click="closeMobileMenu" active-class="router-link-active">Ödemeler</RouterLink>
        <RouterLink to="/community" class="nav-link" @click="closeMobileMenu" active-class="router-link-active">Topluluk</RouterLink>
        <RouterLink to="/job-listings" class="nav-link" @click="closeMobileMenu" active-class="router-link-active">İş/İşçi Bul</RouterLink>
        <RouterLink to="/settings" class="nav-link" @click="closeMobileMenu" active-class="router-link-active">Ayarlar</RouterLink>
        <button class="btn btn-secondary" @click="handleLogout">
          Çıkış Yap
        </button>
      </nav>
      <div class="header-right">
        <button
          class="theme-toggle"
          :title="themeStore.theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'"
          @click="themeStore.toggleTheme()"
        >
          <!-- Sun icon (shown in dark mode) -->
          <svg v-if="themeStore.theme === 'dark'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <!-- Moon icon (shown in light mode) -->
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>
        <button
          class="mobile-menu-toggle"
          :aria-expanded="isMobileMenuOpen"
          aria-label="Menüyü aç/kapat"
          @click="toggleMobileMenu"
        >
          <svg v-if="!isMobileMenuOpen" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </header>

    <main class="app-content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  background: var(--color-bg-primary);
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px var(--space-8);
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.app-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary);
  text-decoration: none;
  transition: transform 0.2s;
}

.app-logo:hover {
  transform: scale(1.05);
}

.app-logo-img {
  height: 80px;
  width: auto;
  object-fit: contain;
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
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

.app-nav {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.nav-link {
  color: var(--color-text-secondary);
  font-weight: 500;
  text-decoration: none;
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.2s;
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

.btn {
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  transform: translateY(-1px);
}

.mobile-menu-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.mobile-menu-toggle:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

@media (max-width: 768px) {
  .app-header {
    flex-direction: row;
    flex-wrap: wrap;
    padding: 12px 16px;
  }

  .mobile-menu-toggle {
    display: flex;
  }

  .app-nav {
    display: none;
    width: 100%;
    flex-direction: column;
    gap: 4px;
    padding-top: 12px;
    border-top: 1px solid var(--color-border);
    order: 3;
  }

  .app-nav.is-open {
    display: flex;
  }

  .nav-link {
    font-size: 15px;
    padding: 10px 12px;
    width: 100%;
  }

  .btn {
    width: 100%;
    text-align: center;
  }
}
</style>
