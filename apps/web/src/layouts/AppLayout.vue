<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();
const router = useRouter();

const handleLogout = () => {
  authStore.logout();
  router.push('/login');
};
</script>

<template>
  <div class="app-layout">
    <header class="app-header">
      <RouterLink to="/dashboard" class="app-logo">
        <img src="@/assets/images/logo.png" alt="Çay Hesabım Logo" class="app-logo-img" />
      </RouterLink>
      <nav class="app-nav">
        <RouterLink to="/dashboard" class="nav-link">Ana Sayfa</RouterLink>
        <RouterLink to="/fields" class="nav-link">Tarlalarım</RouterLink>
        <RouterLink to="/harvests" class="nav-link">Hasatlarım</RouterLink>
        <RouterLink to="/payments" class="nav-link">Ödemeler</RouterLink>
        <RouterLink to="/forum" class="nav-link">Forum</RouterLink>
        <RouterLink to="/settings" class="nav-link">Ayarlar</RouterLink>
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
  color: var(--color-text-secondary, #6b7280);
  font-weight: var(--font-weight-medium, 500);
  text-decoration: none;
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.2s;
}

.nav-link:hover {
  color: var(--color-text-primary, #1a1a2e);
  background: #f3f4f6;
}

.nav-link.router-link-active {
  color: #10b981;
  background: #ecfdf5;
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

@media (max-width: 768px) {
  .app-header {
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }

  .app-nav {
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  .nav-link {
    font-size: 14px;
    padding: 6px 10px;
  }
}
</style>
