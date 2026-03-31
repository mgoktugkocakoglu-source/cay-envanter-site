<script setup lang="ts">
import { useRouter } from 'vue-router';
import SocialBusinessLayout from '@/layouts/SocialBusinessLayout.vue';

const router = useRouter();

interface CategoryCard {
  icon: string;
  title: string;
  description: string;
  route: string;
  enabled: boolean;
}

const categories: CategoryCard[] = [
  {
    icon: '🍃',
    title: 'Çay Toplama İşçisi İlanı Oluştur',
    description: 'Çay toplama işi için deneyim ve ücret bilgilerinizi paylaşın',
    route: '/job-listings/worker/create/tea-picking',
    enabled: true,
  },
  {
    icon: '🚛',
    title: 'Çay Taşıma/Satma İşçisi İlanı Oluştur',
    description: 'Çay taşıma ve satma işleri için ilanınızı oluşturun',
    route: '/job-listings/worker/create/tea-transport',
    enabled: true,
  },
  {
    icon: '🔨',
    title: 'Günlük İşler İşçisi İlanı Oluştur',
    description: 'Günlük işler için ilanınızı oluşturun',
    route: '/job-listings/worker/create/daily-jobs',
    enabled: true,
  },
];

function handleCategoryClick(category: CategoryCard) {
  if (category.enabled) {
    router.push(category.route);
  }
}

function goBack() {
  router.push('/social/job-listings');
}
</script>

<template>
  <SocialBusinessLayout>
    <div class="category-page">
      <header class="page-header">
        <button class="btn-back" @click="goBack">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Geri Dön
        </button>
        <div class="header-center">
          <h1>İşçi İlanı Oluştur</h1>
          <p class="header-sub">Hangi iş dalında ilan vermek istiyorsunuz?</p>
        </div>
      </header>

      <div class="category-grid">
        <button
          v-for="category in categories"
          :key="category.route"
          class="category-card"
          :class="{ 'is-disabled': !category.enabled }"
          @click="handleCategoryClick(category)"
        >
          <div class="category-icon">{{ category.icon }}</div>
          <div class="category-body">
            <h2 class="category-title">{{ category.title }}</h2>
            <p class="category-desc">{{ category.description }}</p>
          </div>
          <div v-if="!category.enabled" class="coming-soon-badge">Yakında</div>
          <svg v-else class="category-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  </SocialBusinessLayout>
</template>

<style scoped>
.category-page {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-8);
}

.page-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.btn-back:hover {
  color: var(--color-text-primary);
  border-color: var(--color-text-muted);
  background: var(--color-bg-tertiary);
}

.header-center h1 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin-bottom: 2px;
}

.header-sub {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

/* ── Category Grid ── */
.category-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.category-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-5);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  cursor: pointer;
  transition: all var(--transition-normal);
  text-align: left;
  width: 100%;
  position: relative;
}

.category-card:not(.is-disabled):hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: var(--color-primary);
  background: linear-gradient(135deg, var(--color-bg-secondary) 0%, rgba(16, 185, 129, 0.04) 100%);
}

.category-card.is-disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.category-icon {
  font-size: 36px;
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-lg);
}

.category-body {
  flex: 1;
  min-width: 0;
}

.category-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-1);
}

.category-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-normal);
}

.category-arrow {
  color: var(--color-text-muted);
  flex-shrink: 0;
  transition: transform var(--transition-fast);
}

.category-card:not(.is-disabled):hover .category-arrow {
  transform: translateX(4px);
  color: var(--color-primary);
}

.coming-soon-badge {
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-warning);
  background: rgba(245, 158, 11, 0.1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  border: 1px solid rgba(245, 158, 11, 0.2);
}

@media (max-width: 768px) {
  .category-card {
    padding: var(--space-4);
  }

  .category-icon {
    width: 44px;
    height: 44px;
    font-size: 28px;
  }
}
</style>
