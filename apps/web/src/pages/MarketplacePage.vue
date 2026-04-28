<script setup lang="ts">
import { ref } from 'vue';
import SocialBusinessLayout from '@/layouts/SocialBusinessLayout.vue';
import SocialWorkspaceLayout from '@/layouts/SocialWorkspaceLayout.vue';

const activeTab = ref<'all' | 'sell' | 'buy' | 'trade'>('all');

const tabs = [
  { key: 'all' as const, label: 'Tümü', icon: '📋' },
  { key: 'sell' as const, label: 'Satılık', icon: '💰' },
  { key: 'buy' as const, label: 'Aranıyor', icon: '🔍' },
  { key: 'trade' as const, label: 'Takas', icon: '🔄' },
];

const categories = [
  { value: 'motor', label: '⚡ Çay Motorları' },
  { value: 'makas', label: '✂️ Çay Makası' },
  { value: 'tasima', label: '🚛 Taşıma Araçları' },
  { value: 'gubre', label: '🌱 Gübre & İlaçlama' },
  { value: 'diger', label: '🔩 Diğer' },
];
</script>

<template>
  <SocialBusinessLayout>
    <SocialWorkspaceLayout>
      <div class="marketplace-page">
      <header class="mp-header">
        <h1 class="mp-title">
          <span>🛒</span>
          2. El Pazar
        </h1>
        <p class="mp-subtitle">
          Kullanılmış ekipman ve tarım malzemelerini alın, satın veya takas edin
        </p>
      </header>

      <!-- Coming Soon Banner -->
      <div class="mp-banner">
        <div class="mp-banner-icon">🚧</div>
        <div class="mp-banner-content">
          <h3>Bu modül aktif olarak geliştiriliyor</h3>
          <p>
            İlan verme, fotoğraf yükleme, fiyat belirleme ve mesajlaşma gibi
            özellikler çok yakında kullanıma sunulacak.
          </p>
        </div>
      </div>

      <!-- Tabs Preview -->
      <div class="mp-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="mp-tab"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <span class="mp-tab-icon">{{ tab.icon }}</span>
          {{ tab.label }}
        </button>
      </div>

      <!-- Category Filters -->
      <div class="mp-categories">
        <span
          v-for="cat in categories"
          :key="cat.value"
          class="mp-category"
        >
          {{ cat.label }}
        </span>
      </div>

      <!-- Empty State -->
      <div class="mp-empty">
        <div class="mp-empty-icon">📦</div>
        <h3>Henüz İlan Yok</h3>
        <p>2. El Pazar modülü hazırlanıyor. İlk ilanları çok yakında burada göreceksiniz!</p>
        <div class="mp-empty-features">
          <div class="mp-ef">
            <span>📸</span>
            <span>Fotoğraflı İlan</span>
          </div>
          <div class="mp-ef">
            <span>💬</span>
            <span>Mesajlaşma</span>
          </div>
          <div class="mp-ef">
            <span>📍</span>
            <span>Konum Bazlı</span>
          </div>
          <div class="mp-ef">
            <span>🔔</span>
            <span>Bildirimler</span>
          </div>
        </div>
      </div>
      </div>
    </SocialWorkspaceLayout>
  </SocialBusinessLayout>
</template>

<style scoped>
.marketplace-page {
  width: 100%;
}

.mp-header {
  text-align: center;
  margin-bottom: var(--space-8);
}

.mp-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.mp-subtitle {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
}

/* ── Banner ── */
.mp-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-5);
  background: rgba(168, 85, 247, 0.06);
  border: 1px solid rgba(168, 85, 247, 0.2);
  border-radius: var(--radius-xl);
  margin-bottom: var(--space-6);
}

.mp-banner-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.mp-banner-content h3 {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: #A855F7;
  margin-bottom: var(--space-1);
}

.mp-banner-content p {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}

/* ── Tabs ── */
.mp-tabs {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.mp-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.mp-tab:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.mp-tab.active {
  background: rgba(168, 85, 247, 0.1);
  border-color: rgba(168, 85, 247, 0.3);
  color: #A855F7;
  font-weight: 600;
}

/* ── Categories ── */
.mp-categories {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
}

.mp-category {
  padding: 6px 14px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.mp-category:hover {
  border-color: rgba(168, 85, 247, 0.3);
  color: var(--color-text-primary);
}

/* ── Empty State ── */
.mp-empty {
  text-align: center;
  padding: var(--space-16) var(--space-8);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
}

.mp-empty-icon {
  font-size: 56px;
  margin-bottom: var(--space-4);
  opacity: 0.6;
}

.mp-empty h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.mp-empty p {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  max-width: 400px;
  margin: 0 auto var(--space-6);
  line-height: var(--line-height-normal);
}

.mp-empty-features {
  display: flex;
  justify-content: center;
  gap: var(--space-6);
  flex-wrap: wrap;
}

.mp-ef {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  font-size: 13px;
  color: var(--color-text-muted);
}

.mp-ef span:first-child {
  font-size: 24px;
}

/* ── Responsive ── */
@media (max-width: 640px) {
  .mp-tabs { flex-wrap: wrap; }
  .mp-empty-features { gap: var(--space-4); }
}
</style>
