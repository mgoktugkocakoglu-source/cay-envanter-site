<script setup lang="ts">
import { computed } from 'vue';

export interface JobListing {
  id: string;
  type: 'worker' | 'job';
  category: 'tea-picking' | 'tea-transport' | 'daily-jobs';
  authorName: string;
  authorAvatar?: string;
  location: string;
  age?: number;
  rating?: number;
  commentCount?: number;
  createdAt?: string;
  phone?: string;
  customBadge?: string;
  equipment?: string[];
  rateType?: string;
  requestedFee?: number;
  offerFee?: number;
  feeUnit?: string;
  dailyTeaAmount?: number;
  foodTransportRequest?: string;
  foodTransportService?: string;
  transportCost?: number;
  mealCost?: number;
  externalService?: string;
  externalWorkRequest?: string;
  teaTransportFee?: number;
  teaSaleFee?: number;
  terrainType?: string;
  terrainTypes?: string[];
  transportOffers?: Array<{
    terrainType: string;
    distanceRange: string;
    transportFee: number;
  }>;
  distanceRange?: string;
  distanceCapacity?: number;
  transportFee?: number;
  sellingFee?: number;
  salesFee?: number;
  jobType?: string;
  jobTypeLabel?: string;
  dailyJobType?: string;
  dailyJobTypeLabel?: string;
  rateChoice?: string;
  jobFee?: number;
  fertilizerTerrainType?: string;
  fertilizerExtraWork?: string;
  landArrangementDetail?: string;
  landArrangementDetailLabel?: string;
  pruningOffers?: Array<{
    pruningAmount: string;
    jobFee: number;
  }>;
  dailyFee?: number;
  dailyFeeUnit?: string;
  hasAdditionalWork?: boolean;
  additionalWorkFee?: number;
}

const props = defineProps<{
  listing: JobListing;
}>();

const categoryMeta = {
  'tea-picking': { label: 'Çay Toplama', icon: 'leaf', tone: 'green' },
  'tea-transport': { label: 'Taşıma / Satma', icon: 'truck', tone: 'amber' },
  'daily-jobs': { label: 'Günlük İşler', icon: 'tool', tone: 'blue' },
} as const;

const equipmentLabelMap: Record<string, string> = {
  elektrikli_motor: 'Elektrikli Motor',
  elektrikli_motorlu: 'Elektrikli Motorlu',
  benzinli_motor: 'Benzinli Motor',
  benzinli_motorlu: 'Benzinli Motorlu',
  sarjli_makas: 'Şarjlı Makas',
  manuel_makas: 'Çay Makası',
  cay_makasi: 'Çay Makası',
};

const rateTypeLabelMap: Record<string, string> = {
  gunluk_ucret: 'Günlük Ücret',
  kilo_isi: 'Kilo İşi',
};

const foodRequestLabelMap: Record<string, string> = {
  evet_isterim: 'Yemek / ulaşım ister',
  kendim_karsilayabilirim: 'Yol / yemek katkısı ister',
};

const foodServiceLabelMap: Record<string, string> = {
  evet_saglarim: 'Yemek / ulaşım sağlar',
  karsi_taraf_saglasin: 'Yol / yemek katkısı verir',
};

const yesNoLabelMap: Record<string, string> = {
  evet: 'Evet',
  hayir: 'Hayır',
};

const fertilizerWorkLabelMap: Record<string, string> = {
  gubre_atma: 'Çay Gübresi Atma',
  gubre_tasima: 'Çay Gübresi Taşıma',
  istemiyorum: 'İstemiyorum',
};

const landArrangementLabelMap: Record<string, string> = {
  cay_seti_duzenleme: 'Çay seti düzenleme',
  arazi_yol_duzenleme: 'Arazi yol düzenleme',
  cay_fidesi_dikimi: 'Çay fidesi dikimi',
};

const terrainLabelMap: Record<string, string> = {
  duz: 'Düz Arazi',
  duz_arazi: 'Düz Arazi',
  egimli: 'Eğimli Arazi',
  egimli_arazi: 'Eğimli Arazi',
  uzak: 'Uzak Arazi',
  yakin: 'Yakın Mesafe',
  orta: 'Orta Mesafe',
};

const distanceLabelMap: Record<string, string> = {
  '100m-300m': '100m - 300m',
  '300m-600m': '300m - 600m',
  '600m-1000m': '600m - 1000m',
  '0-5': '0-5 km',
  '5-10': '5-10 km',
  '10-20': '10-20 km',
  '20+': '20+ km',
  il_disi: 'İl dışı',
};

const initials = computed(() => {
  const name = props.listing.authorName?.trim() || 'İlan';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
});

const category = computed(() => categoryMeta[props.listing.category]);
const listingRole = computed(() => props.listing.type === 'worker' ? 'İş arayan' : 'İşçi arayan');
const actionLabel = computed(() => props.listing.type === 'worker' ? 'Teklif Ver' : 'Başvur');

const primaryFee = computed(() => {
  if (props.listing.pruningOffers?.length) return null;
  const value = props.listing.requestedFee ?? props.listing.offerFee ?? props.listing.jobFee ?? props.listing.dailyFee;
  if (!value) return null;
  return {
    label: props.listing.type === 'worker' ? 'Talep edilen ücret' : 'Teklif edilen ücret',
    value: formatMoney(value),
    unit: props.listing.feeUnit ?? props.listing.dailyFeeUnit ?? '',
  };
});

const detailItems = computed(() => {
  const listing = props.listing;
  const items: { label: string; value: string; tone?: 'strong' | 'muted' }[] = [];

  if (listing.category === 'tea-picking') {
    if (listing.rateType) items.push({ label: 'Tarife', value: labelFromMap(rateTypeLabelMap, listing.rateType) });
    if (listing.dailyTeaAmount) items.push({ label: 'Günlük miktar', value: `${formatNumber(listing.dailyTeaAmount)} kg/gün` });
    if (listing.equipment?.length) items.push({ label: 'Ekipman', value: listing.equipment.map(getEquipmentLabel).join(', ') });
  }

  if (listing.category === 'tea-transport') {
    if (listing.transportOffers?.length) {
      items.push({
        label: 'Arazi',
        value: listing.transportOffers
          .map(offer => `${labelFromMap(terrainLabelMap, offer.terrainType)} · ${labelFromMap(distanceLabelMap, offer.distanceRange)} · ${formatMoney(offer.transportFee)} TL/Ton`)
          .join(' / '),
      });
    } else {
      const terrains = listing.terrainTypes?.length ? listing.terrainTypes : (listing.terrainType ? [listing.terrainType] : []);
      if (terrains.length) items.push({ label: 'Arazi', value: terrains.map(value => labelFromMap(terrainLabelMap, value)).join(', ') });
      if (listing.distanceRange) items.push({ label: 'Mesafe', value: labelFromMap(distanceLabelMap, listing.distanceRange) });
    }
    if (listing.distanceCapacity) {
      items.push({ label: 'Kapasite', value: listing.distanceCapacity === 999 ? 'İl dışı' : `Max ${listing.distanceCapacity} km` });
    }
  }

  if (listing.category === 'daily-jobs') {
    if (listing.jobTypeLabel || listing.dailyJobTypeLabel) items.push({ label: 'İş türü', value: listing.jobTypeLabel ?? listing.dailyJobTypeLabel ?? '' });
    if (listing.fertilizerTerrainType) {
      items.push({ label: 'Arazi', value: labelFromMap(terrainLabelMap, listing.fertilizerTerrainType) });
    }
    if (listing.fertilizerExtraWork) {
      items.push({ label: 'Ek iş', value: labelFromMap(fertilizerWorkLabelMap, listing.fertilizerExtraWork) });
    }
    if (listing.landArrangementDetail || listing.landArrangementDetailLabel) {
      items.push({
        label: 'İş detayı',
        value: listing.landArrangementDetailLabel ?? labelFromMap(landArrangementLabelMap, listing.landArrangementDetail ?? ''),
      });
    }
    if (listing.pruningOffers?.length) {
      items.push({
        label: 'Budama',
        value: listing.pruningOffers
          .map(offer => `${offer.pruningAmount} budama · ${formatMoney(offer.jobFee)} TL/m²`)
          .join(' / '),
      });
    }
    if (listing.rateChoice) items.push({ label: 'Tarife', value: labelFromMap(rateTypeLabelMap, listing.rateChoice) });
    if (listing.hasAdditionalWork) items.push({ label: 'Ek iş', value: `Çay üzeri temizlik${listing.additionalWorkFee ? ` +${formatMoney(listing.additionalWorkFee)} TL/gün` : ''}` });
  }

  const foodValue = listing.foodTransportRequest
    ? labelFromMap(foodRequestLabelMap, listing.foodTransportRequest)
    : listing.foodTransportService
      ? labelFromMap(foodServiceLabelMap, listing.foodTransportService)
      : '';
  if (foodValue) items.push({ label: 'Yemek / yol', value: foodValue });

  return items;
});

const serviceItems = computed(() => {
  const listing = props.listing;
  const items: { label: string; value: string; tone: 'green' | 'amber' | 'blue' }[] = [];
  const transportFee = listing.transportFee ?? listing.teaTransportFee;
  const saleFee = listing.salesFee ?? listing.sellingFee ?? listing.teaSaleFee;

  if (transportFee && !listing.transportOffers?.length) items.push({ label: 'Çay taşıma', value: `+${formatMoney(transportFee)} TL/Ton`, tone: 'amber' });
  if (saleFee) items.push({ label: 'Çay satma', value: `+${formatMoney(saleFee)} TL/Ton`, tone: 'blue' });
  if (listing.transportCost) items.push({ label: 'Yol katkısı', value: `+${formatMoney(listing.transportCost)} TL/Yol`, tone: 'green' });
  if (listing.mealCost) items.push({ label: 'Yemek katkısı', value: `+${formatMoney(listing.mealCost)} TL/Gün`, tone: 'green' });

  return items;
});

const externalLabel = computed(() => {
  const value = props.listing.externalService ?? props.listing.externalWorkRequest;
  if (!value) return '';
  const label = props.listing.type === 'worker' ? 'Ek hizmet verir' : 'Ek hizmet ister';
  return `${label}: ${labelFromMap(yesNoLabelMap, value)}`;
});

function formatNumber(value: number): string {
  return value.toLocaleString('tr-TR');
}

function formatMoney(value: number): string {
  return value.toLocaleString('tr-TR');
}

function labelFromMap(map: Record<string, string>, value: string): string {
  return map[value] ?? value.replace(/_/g, ' ');
}

function getEquipmentLabel(value: string): string {
  return labelFromMap(equipmentLabelMap, value);
}
</script>

<template>
  <article class="listing-card" :class="`listing-card--${category.tone}`">
    <header class="card-header">
      <div class="avatar-shell">
        <img v-if="listing.authorAvatar" :src="listing.authorAvatar" :alt="listing.authorName" class="avatar-image" />
        <div v-else class="avatar-placeholder">{{ initials }}</div>
      </div>

      <div class="header-copy">
        <div class="eyebrow-row">
          <span class="category-pill">
            <svg v-if="category.icon === 'leaf'" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19c8 0 13-5 14-14C10 6 5 11 5 19Z"/><path d="M5 19c3-4 6-7 11-10"/></svg>
            <svg v-else-if="category.icon === 'truck'" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="m14 7 3 3"/><path d="M5 19 16 8l-3-3L2 16v3z"/><path d="m15 5 2-2 4 4-2 2"/></svg>
            {{ category.label }}
          </span>
          <span class="role-pill">{{ listingRole }}</span>
        </div>
        <h2>{{ listing.authorName }}</h2>
        <div class="meta-line">
          <span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>
            {{ listing.location }}
          </span>
          <span v-if="listing.age">{{ listing.age }} yas</span>
        </div>
      </div>
    </header>

    <section v-if="primaryFee" class="price-panel">
      <span>{{ primaryFee.label }}</span>
      <strong>{{ primaryFee.value }} {{ primaryFee.unit }}</strong>
    </section>

    <section v-if="detailItems.length" class="detail-grid">
      <div v-for="item in detailItems" :key="`${item.label}-${item.value}`" class="detail-item">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </section>

    <section v-if="serviceItems.length || externalLabel" class="services-panel">
      <div v-if="externalLabel" class="service-note">{{ externalLabel }}</div>
      <div v-if="serviceItems.length" class="service-list">
        <div v-for="item in serviceItems" :key="`${item.label}-${item.value}`" class="service-chip" :class="`service-chip--${item.tone}`">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
    </section>

    <footer class="card-footer">
      <div class="trust-row">
        <span>Puan: <strong>{{ listing.rating || 'Yeni' }}</strong></span>
        <span>{{ listing.commentCount || 0 }} Yorum</span>
      </div>
      <div class="action-row">
        <button type="button" class="btn-primary">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 6-11 11-5-5"/></svg>
          {{ actionLabel }}
        </button>
        <button type="button" class="btn-secondary">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="m4 7 8 6 8-6"/></svg>
          Mesaj
        </button>
      </div>
    </footer>
  </article>
</template>

<style scoped>
.listing-card {
  --accent: #16a34a;
  --accent-soft: rgba(22, 163, 74, 0.1);
  --accent-border: rgba(22, 163, 74, 0.22);
  width: 100%;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #d9e2ef;
  border-radius: 8px;
  color: #0f172a;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.12);
}

.listing-card--amber {
  --accent: #d97706;
  --accent-soft: rgba(217, 119, 6, 0.1);
  --accent-border: rgba(217, 119, 6, 0.24);
}

.listing-card--blue {
  --accent: #2563eb;
  --accent-soft: rgba(37, 99, 235, 0.1);
  --accent-border: rgba(37, 99, 235, 0.22);
}

.card-header {
  display: flex;
  gap: 14px;
  padding: 18px 18px 16px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.avatar-shell {
  width: 62px;
  height: 62px;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 50%;
  background: var(--accent-soft);
  border: 1px solid var(--accent-border);
}

.avatar-image,
.avatar-placeholder {
  width: 100%;
  height: 100%;
}

.avatar-image {
  object-fit: cover;
}

.avatar-placeholder {
  display: grid;
  place-items: center;
  color: var(--accent);
  font-size: 22px;
  font-weight: 800;
}

.header-copy {
  min-width: 0;
  flex: 1;
}

.eyebrow-row,
.meta-line,
.category-pill,
.role-pill {
  display: flex;
  align-items: center;
}

.eyebrow-row {
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.category-pill,
.role-pill {
  min-height: 24px;
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 12px;
  font-weight: 700;
}

.category-pill {
  gap: 5px;
  color: var(--accent);
  background: var(--accent-soft);
  border: 1px solid var(--accent-border);
}

.category-pill svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.role-pill {
  color: #475569;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
}

h2 {
  margin: 0 0 6px;
  color: #0f172a;
  font-size: 20px;
  font-weight: 800;
  line-height: 1.2;
}

.meta-line {
  gap: 10px;
  flex-wrap: wrap;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
}

.meta-line span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.meta-line svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
}

.price-panel {
  margin: 0 18px 14px;
  padding: 14px;
  border: 1px solid var(--accent-border);
  border-radius: 8px;
  background: var(--accent-soft);
}

.price-panel span {
  display: block;
  margin-bottom: 3px;
  color: #475569;
  font-size: 12px;
  font-weight: 700;
}

.price-panel strong {
  color: var(--accent);
  font-size: 22px;
  line-height: 1.15;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 0 18px 16px;
}

.detail-item {
  min-width: 0;
  padding: 11px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.detail-item span {
  display: block;
  margin-bottom: 4px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.detail-item strong {
  display: block;
  overflow-wrap: anywhere;
  color: #1e293b;
  font-size: 14px;
  line-height: 1.25;
}

.services-panel {
  padding: 14px 18px 16px;
  border-top: 1px solid #eef2f7;
}

.service-note {
  margin-bottom: 10px;
  color: #334155;
  font-size: 13px;
  font-weight: 700;
}

.service-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.service-chip {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #dbeafe;
  background: #eff6ff;
}

.service-chip span {
  color: #475569;
  font-size: 11px;
  font-weight: 700;
}

.service-chip strong {
  color: #1d4ed8;
  font-size: 13px;
}

.service-chip--green {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.service-chip--green strong {
  color: #15803d;
}

.service-chip--amber {
  border-color: #fed7aa;
  background: #fff7ed;
}

.service-chip--amber strong {
  color: #c2410c;
}

.card-footer {
  padding: 14px 18px 18px;
  border-top: 1px solid #eef2f7;
}

.trust-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

.trust-row strong {
  color: #0f172a;
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
}

.btn-primary svg,
.btn-secondary svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.btn-primary {
  border: 1px solid var(--accent);
  background: var(--accent);
  color: #ffffff;
}

.btn-secondary {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
}

.btn-primary:hover,
.btn-secondary:hover {
  transform: translateY(-1px);
}

.btn-secondary:hover {
  border-color: #94a3b8;
  background: #f8fafc;
}

@media (max-width: 520px) {
  .listing-card {
    max-width: none;
    box-shadow: 0 10px 26px rgba(15, 23, 42, 0.1);
  }

  .card-header {
    padding: 16px;
  }

  .avatar-shell {
    width: 54px;
    height: 54px;
  }

  h2 {
    font-size: 18px;
  }

  .price-panel {
    margin-inline: 16px;
  }

  .detail-grid {
    grid-template-columns: 1fr;
    padding-inline: 16px;
  }

  .services-panel,
  .card-footer {
    padding-inline: 16px;
  }
}
</style>
