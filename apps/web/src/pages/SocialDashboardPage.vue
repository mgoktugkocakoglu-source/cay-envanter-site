<script setup lang="ts">
import { useRouter } from 'vue-router';
import SocialBusinessLayout from '@/layouts/SocialBusinessLayout.vue';

const router = useRouter();
</script>

<template>
  <SocialBusinessLayout>
    <div class="social-dashboard">
      <header class="sd-header">
        <h1 class="sd-title">
          <span class="sd-wave">👋</span>
          Sosyal İş Hesabı
        </h1>
        <p class="sd-subtitle">
          İş bul, toplulukla iletişim kur ve ihtiyaçlarını paylaş
        </p>
      </header>

      <!-- Quick Access Cards -->
      <div class="sd-grid">
        <!-- İş/İşçi Bul -->
        <button class="sd-card sd-card-jobs" @click="router.push('/social/job-listings')">
          <div class="sd-card-icon">💼</div>
          <div class="sd-card-body">
            <h2 class="sd-card-title">İş / İşçi Bul</h2>
            <p class="sd-card-desc">Çay toplama, taşıma ve günlük iş ilanları oluşturun veya mevcut ilanlara göz atın.</p>
          </div>
          <div class="sd-card-actions">
            <span class="sd-action-link">İlanlara Git →</span>
          </div>
        </button>

        <!-- Topluluk -->
        <button class="sd-card sd-card-community" @click="router.push('/social/community')">
          <div class="sd-card-icon">👥</div>
          <div class="sd-card-body">
            <h2 class="sd-card-title">Topluluk</h2>
            <p class="sd-card-desc">Diğer çay üreticileriyle deneyimlerinizi paylaşın, fotoğraf ve video gönderin.</p>
          </div>
          <div class="sd-card-actions">
            <span class="sd-action-link">Topluluk'a Git →</span>
          </div>
        </button>

        <!-- Ekipman Değerlendirme -->
        <button class="sd-card sd-card-equipment" @click="router.push('/social/equipment')">
          <div class="sd-card-icon">🔧</div>
          <div class="sd-card-body">
            <h2 class="sd-card-title">Ekipman Değerlendirme</h2>
            <p class="sd-card-desc">Tarım ekipmanlarını değerlendirin, diğer üreticilerin deneyimlerinden yararlanın.</p>
          </div>
          <div class="sd-card-actions">
            <span class="sd-action-link">Ekipmanları İncele →</span>
          </div>
        </button>

        <!-- 2. El Pazar -->
        <button class="sd-card sd-card-marketplace" @click="router.push('/social/marketplace')">
          <div class="sd-card-icon">🛒</div>
          <div class="sd-card-body">
            <h2 class="sd-card-title">2. El Pazar</h2>
            <p class="sd-card-desc">Kullanılmış ekipman ve tarım malzemelerini alın, satın veya takas edin.</p>
          </div>
          <div class="sd-card-actions">
            <span class="sd-action-link">Pazara Git →</span>
          </div>
        </button>
      </div>
    </div>
  </SocialBusinessLayout>
</template>

<style scoped>
.social-dashboard {
  max-width: 900px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
}

.sd-header {
  text-align: center;
  margin-bottom: var(--space-10);
}

.sd-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
}

.sd-wave {
  display: inline-block;
  animation: wave 2s ease-in-out infinite;
  transform-origin: 70% 70%;
}
@keyframes wave {
  0%, 100% { transform: rotate(0deg); }
  10% { transform: rotate(14deg); }
  20% { transform: rotate(-8deg); }
  30% { transform: rotate(14deg); }
  40% { transform: rotate(-4deg); }
  50% { transform: rotate(10deg); }
  60% { transform: rotate(0deg); }
}

.sd-subtitle {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
}

/* ── Grid ── */
.sd-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-5);
}

.sd-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  cursor: pointer;
  text-align: left;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sd-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
}

.sd-card-jobs:hover { border-color: rgba(59, 130, 246, 0.4); }
.sd-card-community:hover { border-color: rgba(16, 185, 129, 0.4); }
.sd-card-equipment:hover { border-color: rgba(245, 158, 11, 0.4); }
.sd-card-marketplace:hover { border-color: rgba(168, 85, 247, 0.4); }

.sd-card-icon {
  font-size: 36px;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  background: var(--color-bg-tertiary);
}

.sd-card-body { flex: 1; }

.sd-card-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.sd-card-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-normal);
}

.sd-card-actions {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-3);
}

.sd-action-link {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-info);
  transition: all 0.2s;
}
.sd-card:hover .sd-action-link {
  letter-spacing: 0.3px;
}

.sd-card-community:hover .sd-action-link { color: var(--color-primary); }
.sd-card-equipment:hover .sd-action-link { color: #F59E0B; }
.sd-card-marketplace:hover .sd-action-link { color: #A855F7; }

/* ── Responsive ── */
@media (max-width: 640px) {
  .sd-grid {
    grid-template-columns: 1fr;
  }
}
</style>
