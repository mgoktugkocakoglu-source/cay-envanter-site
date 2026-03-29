<script setup lang="ts">
import { computed } from 'vue';

export interface JobListing {
  id: string;
  type: 'worker' | 'job'; // 'worker' = I'm a worker looking for a job. 'job' = I'm an employer looking for a worker.
  category: 'tea-picking' | 'tea-transport' | 'daily-jobs';
  
  // Header / User Profile
  authorName: string;
  authorAvatar?: string;
  location: string;
  age?: number;
  rating?: number;
  reviewCount?: number;
  commentCount?: number;

  // Global / General Extensibility
  customBadge?: string; 

  // --- Category Specifics ---
  // Tea Picking
  equipment?: string[];
  pricingPreference?: string[];
  dailyRate?: number;
  perKiloRate?: number;
  pickingPerformance?: number; // kg/gün

  // Transport
  vehicleTypes?: string[];
  terrainTypes?: string[];
  distanceCapacity?: number; // km veya İl dışı (e.g. 999 = iller arası)
  transportFee?: number; // TL / Ton
  salesFee?: number;     // TL / Ton
  hasTransportService?: boolean; // Ek hizmet olarak Taşıma var mı
  hasSalesService?: boolean;     // Ek hizmet olarak Satma var mı

  // Daily Jobs
  dailyJobType?: string;
  dailyJobTypeLabel?: string;
  dailyFee?: number;
  dailyFeeUnit?: string; // e.g., 'TL/Gün' or 'TL/m²'
  hasAdditionalWork?: boolean;
  additionalWorkFee?: number; // always TL/gün for "El ile Çay Üzeri Temizlik"

  // Food & Transport Add-ons
  transportCost?: number; // TL/yol
  mealCost?: number;      // TL/gün
}

const props = defineProps<{
  listing: JobListing;
}>();

const initials = computed(() => {
  if (props.listing.authorAvatar) return null;
  const names = props.listing.authorName.split(' ');
  if (names.length >= 2) return `${names[0][0]}${names[1][0]}`.toUpperCase();
  return names[0][0].toUpperCase();
});

// Helper formatted values
const formattedDailyRate = computed(() => props.listing.dailyRate?.toLocaleString('tr-TR'));
const formattedPerKiloRate = computed(() => props.listing.perKiloRate?.toLocaleString('tr-TR'));
const formattedTransportFee = computed(() => props.listing.transportFee?.toLocaleString('tr-TR'));
const formattedSalesFee = computed(() => props.listing.salesFee?.toLocaleString('tr-TR'));
const formattedDailyFee = computed(() => props.listing.dailyFee?.toLocaleString('tr-TR'));
const formattedAdditionalWorkFee = computed(() => props.listing.additionalWorkFee?.toLocaleString('tr-TR'));
const formatUnit = (cost?: number) => cost ? cost.toLocaleString('tr-TR') : '0';

// Conditions based on design
const hasEquipment = computed(() => props.listing.equipment && props.listing.equipment.length > 0);
const hasPickingPricing = computed(() => props.listing.category === 'tea-picking' && (props.listing.dailyRate || props.listing.perKiloRate));
const hasTransportPricing = computed(() => props.listing.category === 'tea-transport' && (props.listing.transportFee || props.listing.salesFee));
const hasDailyPricing = computed(() => props.listing.category === 'daily-jobs' && props.listing.dailyFee);
const hasExtras = computed(() => props.listing.transportCost || props.listing.mealCost);

const equipmentIconMap: Record<string, string> = {
  'elektrikli_motorlu': '🔌',
  'benzinli_motorlu': '⛽',
  'sarjli_makas': '✂️',
  'manuel_makas': '✂️',
};
const equipmentLabelMap: Record<string, string> = {
  'elektrikli_motorlu': 'Elektrikli Motorlu',
  'benzinli_motorlu': 'Benzinli Motorlu',
  'sarjli_makas': 'Şarjlı Makas',
  'manuel_makas': 'Çay Makası', 
};

function getEquipmentIcon(eq: string) { return equipmentIconMap[eq] || '⚙️'; }
function getEquipmentLabel(eq: string) { return equipmentLabelMap[eq] || eq; }

</script>

<template>
  <article class="listing-card">
    <div class="card-inner">
      
      <!-- HEADER -->
      <header class="card-header">
        <div class="avatar-wrapper">
          <img v-if="listing.authorAvatar" :src="listing.authorAvatar" :alt="listing.authorName" class="avatar-image" />
          <div v-else class="avatar-placeholder">{{ initials }}</div>
        </div>
        <div class="header-info">
          <h2 class="author-name">
            {{ listing.authorName }}
            <span v-if="listing.customBadge" class="badge-role">{{ listing.customBadge }}</span>
          </h2>
          <div class="meta-row">
            <span class="meta-item text-green">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              {{ listing.location }}
            </span>
            <span v-if="listing.age" class="meta-divider">·</span>
            <span v-if="listing.age" class="meta-item text-gray">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              {{ listing.age }} Yaş
            </span>
          </div>
        </div>
      </header>

      <div class="card-body">
        
        <!-- SECTION: Ekipman (Çay Toplama / Worker) -->
        <div v-if="hasEquipment" class="card-section">
          <h3 class="section-title">
            <span class="icon-gear">⚙️</span>
            Ekipman
          </h3>
          <ul class="equipment-list">
            <li v-for="eq in listing.equipment" :key="eq" class="equipment-item">
              <span class="eq-icon">{{ getEquipmentIcon(eq) }}</span>
              {{ getEquipmentLabel(eq) }}
            </li>
          </ul>
        </div>

        <!-- SECTION: Araç & Alan (Çay Taşıma) -->
        <div v-if="listing.category === 'tea-transport' && listing.vehicleTypes" class="card-section">
          <h3 class="section-title">
            <span>🚛</span>
            Araç & Bölge
          </h3>
          <div class="tags-group">
            <span v-for="veh in listing.vehicleTypes" :key="veh" class="tag-badge">
              {{ veh === 'kamyonet' ? 'Kamyonet' : veh === 'transit' ? 'Transit' : veh === 'panelvan' ? 'Panelvan' : 'Teleferik/İlkel' }}
            </span>
          </div>
          <p v-if="listing.distanceCapacity" class="detail-row">
            Mesafe: <strong>{{ listing.distanceCapacity === 999 ? 'İller Arası' : `Max ${listing.distanceCapacity} km` }}</strong>
          </p>
          <div v-if="listing.terrainTypes" class="tags-group" style="margin-top: 8px;">
            <span v-for="ters in listing.terrainTypes" :key="ters" class="tag-badge outline">
              {{ ters === 'duz' ? 'Düz Arazi' : ters === 'egimli' ? 'Eğimli Arazi' : 'Uzak Arazi' }}
            </span>
          </div>
        </div>

        <!-- SECTION: Çalışma Tercihi (Çay Toplama / Daily Jobs Pricing) -->
        <div v-if="hasPickingPricing || hasDailyPricing" class="card-section">
          <h3 class="section-title">
            <span class="icon-money">💰</span>
            Çalışma Tercihi <span class="title-sub" v-if="listing.category === 'daily-jobs'">({{ listing.dailyJobTypeLabel }})</span>
          </h3>
          
          <div class="pricing-group">
            <!-- Picking -->
            <template v-if="hasPickingPricing">
              <div v-if="listing.dailyRate" class="price-badge bg-green-light text-green-dark">
                Günlük: <strong>{{ formattedDailyRate }} TL</strong>
              </div>
              <span v-if="listing.dailyRate && listing.perKiloRate" class="price-or">veya</span>
              <div v-if="listing.perKiloRate" class="price-badge bg-orange-light text-orange-dark">
                Kilo Başı: <span class="icon-bag">⛑️</span> <strong>{{ formattedPerKiloRate }} TL</strong> / Ton
              </div>
            </template>
            <!-- Daily Jobs -->
            <template v-if="hasDailyPricing">
              <div class="price-badge bg-teal-light text-teal-dark">
                {{ listing.dailyJobTypeLabel }}: <strong>{{ formattedDailyFee }} {{ listing.dailyFeeUnit }}</strong>
              </div>
              <div v-if="listing.additionalWorkFee" class="price-badge bg-orange-light text-orange-dark" style="margin-top:8px;">
                + Çay Üzeri Temizlik: <strong>{{ formattedAdditionalWorkFee }} TL/Gün</strong>
              </div>
            </template>
          </div>
        </div>

        <!-- SECTION: Fiyat Tarifesi (Çay Taşıma Pricing) -->
        <div v-if="hasTransportPricing" class="card-section">
          <h3 class="section-title">
            <span>💸</span> Fiyat Tarifesi
          </h3>
          <div class="services-list">
            <div v-if="listing.transportFee" class="service-row">
              <div class="service-name">
                <span class="icon-bag2">📦</span> Çay Taşıma
              </div>
              <div class="service-price">
                <span class="price-tag orange">+{{ formattedTransportFee }} TL/Ton</span>
              </div>
            </div>
            <div v-if="listing.salesFee" class="service-row">
              <div class="service-name">
                <span class="icon-bag2">🤝</span> Alım Yeri (Satma)
              </div>
              <div class="service-price">
                <span class="price-tag blue">+{{ formattedSalesFee }} TL/Ton</span>
              </div>
            </div>
          </div>
        </div>

        <!-- SECTION: Performans (Çay Toplama / Worker) -->
        <div v-if="listing.pickingPerformance" class="card-section">
          <h3 class="section-title">
            <span class="icon-chart">📊</span>
            Performans
          </h3>
          <div class="perf-badge">
            Ortalama: <strong>{{ listing.pickingPerformance }} kg/gün</strong>
          </div>
        </div>

        <!-- SECTION: Ek Talepler / Katkı (Food/Travel) -->
        <div v-if="hasExtras" class="card-section">
          <h3 class="section-title">
            <span class="icon-fork">🍽️</span>
            {{ listing.type === 'job' ? 'Sağlanan Ek Hizmetler' : 'Ek Talepler' }}
          </h3>
          <div class="extras-group">
            <div v-if="listing.transportCost" class="extra-item">
              <span class="icon-check">✓</span> 
              <span class="extra-label">Yol:</span>
              <span class="price-tag outline-orange">+{{ formatUnit(listing.transportCost) }} TL/yol</span>
            </div>
            <div v-if="listing.mealCost" class="extra-item">
              <span class="icon-bowl">🍲</span> 
              <span class="extra-label">Yemek:</span>
              <span class="price-tag outline-red">+{{ formatUnit(listing.mealCost) }} TL/gün</span>
            </div>
          </div>
        </div>
        
        <!-- SECTION: Ek Hizmetler (Çay Toplama / Worker adding Tasıma/Satma) -->
        <!-- Only shown if this is a picking listing that also offers transport -->
        <div v-if="listing.category === 'tea-picking' && (listing.hasTransportService || listing.hasSalesService)" class="card-section">
          <h3 class="section-title">
            <span class="icon-plus">➕</span>
            Ek Hizmetler
          </h3>
          <div class="services-list">
            <div v-if="listing.hasTransportService && listing.transportFee" class="service-row">
              <div class="service-name">
                <span class="icon-bag2">💰</span> Çay Taşıma
              </div>
              <div class="service-price">
                <span class="price-tag orange">+{{ formattedTransportFee }} TL/Ton</span>
                <!-- Reference image had a double badge "+500TL/ +400TL/Ton" implying multiple variants, we simplify here based on our wizard -->
              </div>
            </div>
            <div v-if="listing.hasSalesService && listing.salesFee" class="service-row">
              <div class="service-name">
                <span class="icon-bag2">💰</span> Çay Satma
              </div>
              <div class="service-price">
                <span class="price-tag orange">+{{ formattedSalesFee }} TL/Ton</span>
              </div>
            </div>
          </div>
        </div>

      </div> <!-- /card-body -->

      <!-- FOOTER -->
      <footer class="card-footer">
        <div class="footer-stats">
          <div class="rating">
            <span class="star">⭐</span>
            <span class="rating-val">Puan: <strong class="text-black">{{ listing.rating || 'Yeni' }}</strong> <span class="rating-max" v-if="listing.rating">/ 5</span></span>
          </div>
          <div class="comments">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <strong>{{ listing.commentCount || 0 }}</strong> Yorum
          </div>
        </div>
        
        <div class="footer-actions">
          <button class="btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Teklif Ver
          </button>
          <button class="btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            Mesaj
          </button>
        </div>
      </footer>

    </div>
  </article>
</template>

<style scoped>
.listing-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0,0,0,0.04);
  overflow: hidden;
  max-width: 440px;
  width: 100%;
  font-family: var(--font-family, system-ui, sans-serif);
  color: #333;
}

.card-inner {
  display: flex;
  flex-direction: column;
}

/* ── HEADER ── */
.card-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 20px 16px;
}

.avatar-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: #f0fdf4;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  color: #166534;
}

.header-info {
  flex: 1;
}

.author-name {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 4px 0;
  color: #111827;
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge-role {
  font-size: 11px;
  background: #f1f5f9;
  color: #475569;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  border: 1px solid #e2e8f0;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.text-green { color: #15803d; }
.text-gray { color: #6b7280; }
.meta-divider { color: #cbd5e1; }

/* ── BODY ── */
.card-body {
  display: flex;
  flex-direction: column;
}

.card-section {
  padding: 16px 20px;
  border-top: 1px solid #f1f5f9;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #334155;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.title-sub { font-weight: 500; color: #64748b; font-size: 12px; }

/* Equipment */
.equipment-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.equipment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #334155;
}

.eq-icon {
  filter: grayscale(0.5) contrast(1.2);
}

/* Tags/Badges Generic */
.tags-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tag-badge {
  font-size: 13px;
  padding: 4px 10px;
  border-radius: 6px;
  background: #f0fdf4;
  color: #166534;
  font-weight: 500;
}
.tag-badge.outline {
  background: transparent;
  border: 1px solid #d1fae5;
}
.detail-row {
  font-size: 13px; color: #475569; margin: 8px 0 0;
}


/* Pricing */
.pricing-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.price-badge {
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.price-badge strong { font-weight: 700; font-size: 15px; }
.price-or { font-size: 13px; color: #94a3b8; }

.bg-green-light { background: #f0fdf4; border: 1px solid #d1fae5; }
.text-green-dark { color: #166534; }

.bg-orange-light { background: #fff7ed; border: 1px solid #ffedd5; }
.text-orange-dark { color: #9a3412; }

.bg-teal-light { background: #f0fdfa; border: 1px solid #ccfbf1; }
.text-teal-dark { color: #0f766e; }

/* Performance */
.perf-badge {
  display: inline-flex;
  padding: 6px 12px;
  background: #f8fafc;
  color: #475569;
  border-radius: 8px;
  font-size: 14px;
  border: 1px solid #f1f5f9;
}
.perf-badge strong { color: #0f766e; font-weight: 700; margin-left: 4px; }


/* Extras */
.extras-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.extra-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.extra-label { color: #64748b; font-weight: 500; }
.icon-check { color: #16a34a; font-weight: bold; }

.price-tag {
  font-size: 13px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 6px;
}
.price-tag.orange { background: #fff7ed; color: #c2410c; }
.price-tag.blue { background: #eff6ff; color: #1d4ed8; }
.price-tag.outline-orange { background: #fff7ed; color: #b45309; }
.price-tag.outline-red { background: #fef2f2; color: #b91c1c; }

/* Services */
.services-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.service-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.service-name {
  font-size: 14px;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 6px;
}


/* ── FOOTER ── */
.card-footer {
  padding: 16px 20px;
  border-top: 1px solid #f1f5f9;
}

.footer-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-size: 14px;
  color: #64748b;
  font-weight: 500;
}

.rating { display: flex; align-items: center; gap: 4px; }
.star { font-size: 16px; color: #fbbf24; }
.text-black { color: #0f172a; font-size: 15px; }
.rating-max { color: #94a3b8; font-size: 13px; }

.comments { display: flex; align-items: center; gap: 6px; }
.comments svg { color: #10b981; }

.footer-actions {
  display: flex;
  gap: 12px;
}

.btn-primary, .btn-secondary {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #65a30d; /* Matching visual reference green */
  color: white;
  border: none;
}
.btn-primary:hover { background: #4d7c0f; }

.btn-secondary {
  background: white;
  color: #475569;
  border: 1px solid #cbd5e1;
}
.btn-secondary:hover { background: #f8fafc; border-color: #94a3b8; }

</style>
