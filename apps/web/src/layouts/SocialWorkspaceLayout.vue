<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const moduleItems = [
  {
    label: 'İş/İşçi Bul',
    to: '/social/job-listings',
    match: '/social/job-listings',
    icon: 'briefcase',
  },
  {
    label: 'Topluluk',
    to: '/social/community',
    match: '/social/community',
    icon: 'users',
  },
  {
    label: 'Ekipman',
    to: '/social/equipment',
    match: '/social/equipment',
    icon: 'tool',
  },
  {
    label: '2. El Pazar',
    to: '/social/marketplace',
    match: '/social/marketplace',
    icon: 'cart',
  },
] as const;

const activeTitle = computed(() => moduleItems.find(item => route.path.startsWith(item.match))?.label || 'Sosyal İş');

function userLabel(t: string) {
  return t === 'land_owner' ? 'Arazi Sahibi' : t === 'worker' ? 'İşçi' : t === 'self_farmer' ? 'Çiftçi' : '';
}
</script>

<template>
  <div class="social-workspace">
    <aside class="social-sidebar">
      <div v-if="authStore.isAuthenticated" class="side-profile" @click="router.push('/social/settings')">
        <div class="sp-avatar">
          <img v-if="authStore.user?.avatarUrl" :src="authStore.user.avatarUrl" :alt="authStore.user?.fullName" />
          <span v-else>{{ authStore.user?.fullName?.charAt(0)?.toUpperCase() }}</span>
        </div>
        <div class="sp-info">
          <span class="sp-name">{{ authStore.user?.fullName }}</span>
          <span v-if="authStore.user?.userType" class="sp-type">{{ userLabel(authStore.user.userType) }}</span>
        </div>
      </div>

      <nav class="side-module-nav" aria-label="Sosyal iş menüsü">
        <RouterLink
          v-for="item in moduleItems"
          :key="item.to"
          :to="item.to"
          class="module-nav-item"
          :class="{ active: route.path.startsWith(item.match) }"
        >
          <svg v-if="item.icon === 'briefcase'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          <svg v-else-if="item.icon === 'users'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <svg v-else-if="item.icon === 'tool'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <slot name="sidebar" />
    </aside>

    <section class="workspace-content" :aria-label="activeTitle">
      <slot />
    </section>
  </div>
</template>

<style scoped>
.social-workspace {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 16px;
}

.social-sidebar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: sticky;
  top: calc(64px + env(safe-area-inset-top) + 16px);
  align-self: start;
}

.workspace-content {
  min-width: 0;
}

.side-profile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all .2s;
}

.side-profile:hover { background: var(--color-bg-tertiary); }

.sp-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 17px;
  flex-shrink: 0;
  overflow: hidden;
}

.sp-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sp-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.sp-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sp-type {
  font-size: 12px;
  color: var(--color-primary);
  font-weight: 500;
}

.side-module-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 0;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
}

.module-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: all .15s;
}

.module-nav-item:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.module-nav-item.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: 600;
}

.module-nav-item svg {
  flex-shrink: 0;
}

@media (max-width: 900px) {
  .social-workspace {
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 12px 8px;
  }

  .social-sidebar {
    position: static;
    flex-direction: row;
    overflow-x: auto;
    gap: 8px;
    padding-bottom: 4px;
  }

  .side-profile {
    min-width: 200px;
    flex-shrink: 0;
  }

  .side-module-nav {
    flex-direction: row;
    min-width: max-content;
    flex-shrink: 0;
    padding: 8px;
  }

  .module-nav-item {
    white-space: nowrap;
    padding: 8px 14px;
    border-radius: 8px;
  }
}
</style>
