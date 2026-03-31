<script setup lang="ts">
import { ref } from 'vue';
import SocialBusinessLayout from '@/layouts/SocialBusinessLayout.vue';

// Equipment categories for the tea industry
const categories = ref([
  { id: 'motor', name: 'Çay Toplama Motorları', icon: '⚡', description: 'Elektrikli ve benzinli çay toplama motorları', count: 0 },
  { id: 'makas', name: 'Çay Makası', icon: '✂️', description: 'Manuel ve motorlu çay makasları', count: 0 },
  { id: 'tasima', name: 'Taşıma Araçları', icon: '🚛', description: 'Kamyonet, transit ve çuval taşıma ekipmanları', count: 0 },
  { id: 'gubre', name: 'Gübre & İlaçlama', icon: '🌱', description: 'Gübre makineleri ve ilaçlama ekipmanları', count: 0 },
  { id: 'sulama', name: 'Sulama Sistemleri', icon: '💧', description: 'Damla sulama ve yağmurlama sistemleri', count: 0 },
  { id: 'diger', name: 'Diğer Ekipmanlar', icon: '🔩', description: 'Bahçe bakım ve genel tarım ekipmanları', count: 0 },
]);

const selectedCategory = ref<string | null>(null);
</script>

<template>
  <SocialBusinessLayout>
    <div class="equipment-page">
      <header class="eq-header">
        <h1 class="eq-title">
          <span>🔧</span>
          Ekipman Değerlendirme
        </h1>
        <p class="eq-subtitle">
          Tarım ekipmanlarını değerlendirin, diğer üreticilerin deneyimlerinden faydalanın
        </p>
      </header>

      <!-- Coming Soon Banner -->
      <div class="eq-banner">
        <div class="eq-banner-icon">🚧</div>
        <div class="eq-banner-content">
          <h3>Bu modül aktif olarak geliştiriliyor</h3>
          <p>
            Ekipman değerlendirme, karşılaştırma ve kullanıcı yorumları gibi özellikler
            çok yakında kullanıma sunulacak. Şimdilik ekipman kategorilerimize göz atabilirsiniz.
          </p>
        </div>
      </div>

      <!-- Equipment Categories -->
      <section class="eq-categories">
        <h2 class="eq-section-title">Ekipman Kategorileri</h2>
        <div class="eq-grid">
          <button
            v-for="cat in categories"
            :key="cat.id"
            class="eq-cat-card"
            :class="{ 'is-selected': selectedCategory === cat.id }"
            @click="selectedCategory = selectedCategory === cat.id ? null : cat.id"
          >
            <div class="eq-cat-icon">{{ cat.icon }}</div>
            <div class="eq-cat-body">
              <h3 class="eq-cat-name">{{ cat.name }}</h3>
              <p class="eq-cat-desc">{{ cat.description }}</p>
            </div>
            <span class="eq-cat-count">{{ cat.count }} ürün</span>
          </button>
        </div>
      </section>

      <!-- Future Features Preview -->
      <section class="eq-features">
        <h2 class="eq-section-title">Yakında Gelecek Özellikler</h2>
        <div class="eq-features-grid">
          <div class="eq-feature">
            <span class="eq-feature-icon">⭐</span>
            <h4>Kullanıcı Değerlendirmeleri</h4>
            <p>Ekipmanları puanlayın ve deneyimlerinizi paylaşın</p>
          </div>
          <div class="eq-feature">
            <span class="eq-feature-icon">📊</span>
            <h4>Karşılaştırma</h4>
            <p>Farklı marka ve modelleri yan yana karşılaştırın</p>
          </div>
          <div class="eq-feature">
            <span class="eq-feature-icon">🎥</span>
            <h4>Video İncelemeler</h4>
            <p>Kullanım kılavuzları ve tavsiye videoları</p>
          </div>
        </div>
      </section>
    </div>
  </SocialBusinessLayout>
</template>

<style scoped>
.equipment-page {
  max-width: 900px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
}

.eq-header {
  text-align: center;
  margin-bottom: var(--space-8);
}

.eq-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.eq-subtitle {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
}

/* ── Banner ── */
.eq-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-5);
  background: rgba(245, 158, 11, 0.06);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: var(--radius-xl);
  margin-bottom: var(--space-8);
}

.eq-banner-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.eq-banner-content h3 {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: #F59E0B;
  margin-bottom: var(--space-1);
}

.eq-banner-content p {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}

/* ── Categories ── */
.eq-section-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-4);
}

.eq-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  margin-bottom: var(--space-8);
}

.eq-cat-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.eq-cat-card:hover {
  border-color: rgba(245, 158, 11, 0.3);
  background: var(--color-bg-elevated);
}

.eq-cat-card.is-selected {
  border-color: #F59E0B;
  background: rgba(245, 158, 11, 0.05);
}

.eq-cat-icon {
  font-size: 28px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.eq-cat-body { flex: 1; min-width: 0; }

.eq-cat-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 2px;
}

.eq-cat-desc {
  font-size: 12px;
  color: var(--color-text-muted);
}

.eq-cat-count {
  font-size: 12px;
  color: var(--color-text-muted);
  background: var(--color-bg-tertiary);
  padding: 3px 8px;
  border-radius: var(--radius-full);
  white-space: nowrap;
}

/* ── Features ── */
.eq-features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}

.eq-feature {
  text-align: center;
  padding: var(--space-5);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.eq-feature-icon {
  font-size: 32px;
  display: block;
  margin-bottom: var(--space-3);
}

.eq-feature h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.eq-feature p {
  font-size: 13px;
  color: var(--color-text-muted);
  line-height: var(--line-height-normal);
}

/* ── Responsive ── */
@media (max-width: 640px) {
  .eq-grid { grid-template-columns: 1fr; }
  .eq-features-grid { grid-template-columns: 1fr; }
}
</style>
