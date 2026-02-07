<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();
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
      <nav class="app-nav" :class="{ 'is-open': isMobileMenuOpen }">
        <RouterLink to="/dashboard" class="nav-link" @click="closeMobileMenu" exact-active-class="router-link-active">Ana Sayfa</RouterLink>
        <RouterLink to="/fields" class="nav-link" @click="closeMobileMenu" active-class="router-link-active">Tarlalarım</RouterLink>
        <RouterLink to="/harvests" class="nav-link" @click="closeMobileMenu" active-class="router-link-active">Hasatlarım</RouterLink>
        <RouterLink to="/payments" class="nav-link" @click="closeMobileMenu" active-class="router-link-active">Ödemeler</RouterLink>
        <RouterLink to="/forum" class="nav-link" @click="closeMobileMenu" active-class="router-link-active">Forum</RouterLink>
        <RouterLink to="/settings" class="nav-link" @click="closeMobileMenu" active-class="router-link-active">Ayarlar</RouterLink>
        <button class="btn btn-secondary" @click="handleLogout">
          Çıkış Yap
        </button>
      </nav>
    </header>
    
    <main class="app-content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  background: var(--color-bg-primary, #f9fafb);
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px var(--space-8, 32px);
  background: var(--color-bg-secondary, white);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.app-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 700;
  color: #10b981;
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

.app-nav {
  display: flex;
  align-items: center;
  gap: var(--space-4, 16px);
}

.nav-link {
  color: #94A3B8;
  font-weight: 500;
  text-decoration: none;
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.2s;
}

.nav-link:hover {
  color: #F8FAFC;
  background: #334155;
}

.nav-link.router-link-active {
  color: #10b981;
  background: #1E293B;
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
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
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
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.2s;
}

.mobile-menu-toggle:hover {
  background: #f3f4f6;
  color: var(--color-text-primary, #1a1a2e);
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
    border-top: 1px solid var(--color-border, #e5e7eb);
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
