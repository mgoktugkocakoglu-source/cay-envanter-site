<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import SocialBusinessLayout from '@/layouts/SocialBusinessLayout.vue';
import SocialWorkspaceLayout from '@/layouts/SocialWorkspaceLayout.vue';
import { useAuthStore } from '@/stores/authStore';
import { api, type MarketplaceListing, type MarketplaceListingCategory } from '@/services/api';

type ProductCategory = 'all' | MarketplaceListingCategory;
type MotorUse = 'tea-harvest' | 'tea-pruning' | 'grass-cutting' | 'wood-cutting';
type MotorPower = 'electric' | 'gasoline';
type ElectricPowerType = 'battery' | 'corded';

const authStore = useAuthStore();

const activeCategory = ref<ProductCategory>('all');
const query = ref('');
const showSellPanel = ref(false);
const listings = ref<MarketplaceListing[]>([]);
const loading = ref(false);
const submitting = ref(false);
const uploading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

const sellForm = reactive({
  title: '',
  description: '',
  location: '',
  category: 'motor' as MarketplaceListingCategory,
  contactName: '',
  contactPhone: '',
  motorUse: 'tea-harvest' as MotorUse,
  motorPower: 'electric' as MotorPower,
  electricPowerType: 'battery' as ElectricPowerType,
  brand: '',
  model: '',
  modelYear: '',
  totalUse: '',
  price: '',
  motorPowerValue: '',
  batteryCapacity: '',
  rpm: '',
  motorWeight: '',
  batteryWeight: '',
  plantingDate: '',
  seedlingCount: '',
  seedlingUnitPrice: '',
  imageUrls: [] as string[],
});

const motorUses = [
  { value: 'tea-harvest' as const, label: 'Çay Toplama Motoru' },
  { value: 'tea-pruning' as const, label: 'Çay Budama Motoru' },
  { value: 'grass-cutting' as const, label: 'Ot Kesme Motoru' },
  { value: 'wood-cutting' as const, label: 'Ağaç Kesme Motoru' },
];

const categoryTabs = computed(() => [
  { key: 'all' as const, label: 'Tüm İlanlar', count: listings.value.length },
  { key: 'motor' as const, label: 'Motor Ekipmanları', count: listings.value.filter(item => item.category === 'motor').length },
  { key: 'seedling' as const, label: 'Çay Fidesi', count: listings.value.filter(item => item.category === 'seedling').length },
]);

const filteredListings = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('tr-TR');
  return listings.value.filter((listing) => {
    const matchesCategory = activeCategory.value === 'all' || listing.category === activeCategory.value;
    const matchesQuery = !needle || [
      listing.title,
      listing.location,
      listing.description,
      listing.contactName,
      listing.seller?.fullName,
      Object.values(listing.specs || {}).join(' '),
    ].join(' ').toLocaleLowerCase('tr-TR').includes(needle);

    return matchesCategory && matchesQuery;
  });
});

const previewSpecs = computed(() => {
  if (sellForm.category === 'seedling') {
    return [
      sellForm.plantingDate && `Dikim: ${sellForm.plantingDate}`,
      sellForm.seedlingCount && `${sellForm.seedlingCount} adet`,
      sellForm.seedlingUnitPrice && `${sellForm.seedlingUnitPrice} TL/adet`,
    ].filter(Boolean);
  }

  const powerText = sellForm.motorPower === 'electric'
    ? `Elektrikli - ${sellForm.electricPowerType === 'battery' ? 'Bataryalı' : 'Kablolu'}`
    : 'Benzinli';

  return [
    motorUses.find(item => item.value === sellForm.motorUse)?.label,
    powerText,
    sellForm.brand && sellForm.model ? `${sellForm.brand} ${sellForm.model}` : sellForm.brand || sellForm.model,
    sellForm.totalUse && `${sellForm.totalUse} ay kullanım`,
  ].filter(Boolean);
});

watch(showSellPanel, (isOpen) => {
  if (!isOpen) return;
  sellForm.contactName = sellForm.contactName || authStore.user?.fullName || '';
  sellForm.contactPhone = sellForm.contactPhone || authStore.user?.phone || '';
  sellForm.location = sellForm.location || [authStore.user?.province, authStore.user?.district].filter(Boolean).join(' / ');
});

onMounted(() => {
  fetchListings();
});

async function fetchListings() {
  loading.value = true;
  errorMessage.value = '';

  const response = await api.getMarketplaceListings({ status: 'active' });
  if (response.error) {
    errorMessage.value = response.error.message;
  } else {
    listings.value = response.data || [];
  }

  loading.value = false;
}

async function handleImages(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;

  uploading.value = true;
  errorMessage.value = '';

  const files = Array.from(input.files).slice(0, 6 - sellForm.imageUrls.length);
  for (const file of files) {
    const response = await api.uploadImage(file);
    if (response.error) {
      errorMessage.value = response.error.message;
      break;
    }
    if (response.data?.url) sellForm.imageUrls.push(response.data.url);
  }

  uploading.value = false;
  input.value = '';
}

async function publishListing() {
  if (!authStore.isAuthenticated) {
    errorMessage.value = 'İlan yayınlamak için giriş yapmalısınız.';
    return;
  }

  const price = Number(sellForm.category === 'seedling' ? sellForm.seedlingUnitPrice : sellForm.price);
  if (!sellForm.title || !sellForm.description || !sellForm.location || !sellForm.contactName || !sellForm.contactPhone || !price) {
    errorMessage.value = 'Başlık, açıklama, konum, fiyat ve iletişim bilgileri zorunludur.';
    return;
  }

  submitting.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  const response = await api.createMarketplaceListing({
    category: sellForm.category,
    title: sellForm.title.trim(),
    description: sellForm.description.trim(),
    location: sellForm.location.trim(),
    price,
    priceUnit: sellForm.category === 'seedling' ? 'adet' : null,
    contactName: sellForm.contactName.trim(),
    contactPhone: sellForm.contactPhone.trim(),
    imageUrls: sellForm.imageUrls,
    specs: buildSpecs(),
  });

  submitting.value = false;

  if (response.error) {
    errorMessage.value = response.error.message;
    return;
  }

  if (response.data) {
    listings.value = [response.data, ...listings.value];
    successMessage.value = 'İlan yayınlandı.';
    showSellPanel.value = false;
    resetForm();
  }
}

function buildSpecs() {
  if (sellForm.category === 'seedling') {
    return {
      plantingDate: sellForm.plantingDate,
      seedlingCount: numberOrNull(sellForm.seedlingCount),
    };
  }

  return {
    motorUse: sellForm.motorUse,
    motorPower: sellForm.motorPower,
    electricPowerType: sellForm.motorPower === 'electric' ? sellForm.electricPowerType : null,
    brand: sellForm.brand,
    model: sellForm.model,
    modelYear: numberOrNull(sellForm.modelYear),
    totalUseMonths: numberOrNull(sellForm.totalUse),
    motorPowerValue: numberOrNull(sellForm.motorPowerValue),
    motorPowerUnit: sellForm.motorPower === 'electric' ? 'Watt' : 'kW',
    batteryCapacityMah: sellForm.motorPower === 'electric' ? numberOrNull(sellForm.batteryCapacity) : null,
    rpm: numberOrNull(sellForm.rpm),
    motorWeightKg: numberOrNull(sellForm.motorWeight),
    batteryWeightKg: sellForm.motorPower === 'electric' ? numberOrNull(sellForm.batteryWeight) : null,
  };
}

function numberOrNull(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value !== '' ? parsed : null;
}

function resetForm() {
  Object.assign(sellForm, {
    title: '',
    description: '',
    location: [authStore.user?.province, authStore.user?.district].filter(Boolean).join(' / '),
    category: 'motor',
    contactName: authStore.user?.fullName || '',
    contactPhone: authStore.user?.phone || '',
    motorUse: 'tea-harvest',
    motorPower: 'electric',
    electricPowerType: 'battery',
    brand: '',
    model: '',
    modelYear: '',
    totalUse: '',
    price: '',
    motorPowerValue: '',
    batteryCapacity: '',
    rpm: '',
    motorWeight: '',
    batteryWeight: '',
    plantingDate: '',
    seedlingCount: '',
    seedlingUnitPrice: '',
    imageUrls: [],
  });
}

function removeImage(url: string) {
  sellForm.imageUrls = sellForm.imageUrls.filter(item => item !== url);
}

function formatPrice(value: number, suffix?: string | null) {
  return `${new Intl.NumberFormat('tr-TR').format(value)} TL${suffix ? ` / ${suffix}` : ''}`;
}

function timeAgo(date: string): string {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return 'Az önce';
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

function motorUseLabel(value?: string) {
  return motorUses.find(item => item.value === value)?.label || 'Motor ekipmanı';
}

function listingHighlights(listing: MarketplaceListing) {
  if (listing.category === 'seedling') {
    return [
      listing.specs?.plantingDate && `Dikim: ${listing.specs.plantingDate}`,
      listing.specs?.seedlingCount && `${listing.specs.seedlingCount} adet`,
      'Çay fidesi',
    ].filter(Boolean);
  }

  return [
    motorUseLabel(listing.specs?.motorUse),
    listing.specs?.motorPower === 'electric' ? 'Elektrikli' : 'Benzinli',
    listing.specs?.brand && listing.specs?.model ? `${listing.specs.brand} ${listing.specs.model}` : listing.specs?.brand,
    listing.specs?.totalUseMonths && `${listing.specs.totalUseMonths} ay kullanım`,
  ].filter(Boolean);
}
</script>

<template>
  <SocialBusinessLayout>
    <SocialWorkspaceLayout>
      <div class="marketplace-page">
        <section class="market-hero">
          <div class="hero-copy">
            <span class="eyebrow">Sosyal Hesabım</span>
            <h1>2. El Pazar</h1>
            <p>
              Üreticilerin yüksek maliyetli motor ekipmanlarını ve yoğun talep gören çay fidelerini
              gerçek ilan verisiyle alıp satabileceği pazar alanı.
            </p>
          </div>
          <button class="sell-cta" type="button" @click="showSellPanel = !showSellPanel">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Ürün Sat
          </button>
        </section>

        <div v-if="errorMessage" class="alert error">{{ errorMessage }}</div>
        <div v-if="successMessage" class="alert success">{{ successMessage }}</div>

        <section class="scope-band">
          <div>
            <strong>Motor ekipmanları</strong>
            <span>Çay toplama, budama, ot ve ağaç kesme motorları</span>
          </div>
          <div>
            <strong>Çay fidesi</strong>
            <span>Adet bazlı, toplu alıma uygun poşetli fide ilanları</span>
          </div>
        </section>

        <section v-if="showSellPanel" class="sell-panel" aria-label="Ürün satış formu">
          <div class="panel-head">
            <div>
              <h2>Satış Bilgileri</h2>
              <p>İlan açmak için ürün, fiyat ve iletişim bilgilerini doldurun.</p>
            </div>
            <button class="icon-close" type="button" aria-label="Formu kapat" @click="showSellPanel = false">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div class="form-grid">
            <label class="field"><span>İlan Başlığı</span><input v-model="sellForm.title" type="text" placeholder="Rewi Pro X5 satılık" /></label>
            <label class="field"><span>Konum</span><input v-model="sellForm.location" type="text" placeholder="Rize / Pazar" /></label>
            <label class="field"><span>İletişim Adı</span><input v-model="sellForm.contactName" type="text" placeholder="Ad Soyad" /></label>
            <label class="field"><span>Telefon</span><input v-model="sellForm.contactPhone" type="tel" placeholder="05XX XXX XX XX" /></label>
          </div>

          <label class="field text-field">
            <span>Açıklama</span>
            <textarea v-model="sellForm.description" rows="3" placeholder="Ürünün durumu, kullanım geçmişi, pazarlık ve teslim bilgilerini yazın."></textarea>
          </label>

          <div class="form-grid">
            <div class="field">
              <span>Ürün Kategorisi</span>
              <div class="segmented">
                <button type="button" :class="{ active: sellForm.category === 'motor' }" @click="sellForm.category = 'motor'">Motor</button>
                <button type="button" :class="{ active: sellForm.category === 'seedling' }" @click="sellForm.category = 'seedling'">Çay Fidesi</button>
              </div>
            </div>
          </div>

          <template v-if="sellForm.category === 'motor'">
            <div class="option-grid">
              <button
                v-for="item in motorUses"
                :key="item.value"
                type="button"
                class="choice"
                :class="{ active: sellForm.motorUse === item.value }"
                @click="sellForm.motorUse = item.value"
              >
                {{ item.label }}
              </button>
            </div>

            <div class="form-grid">
              <div class="field">
                <span>Ürün Tipi</span>
                <div class="segmented">
                  <button type="button" :class="{ active: sellForm.motorPower === 'electric' }" @click="sellForm.motorPower = 'electric'">Elektrikli</button>
                  <button type="button" :class="{ active: sellForm.motorPower === 'gasoline' }" @click="sellForm.motorPower = 'gasoline'">Benzinli</button>
                </div>
              </div>

              <div v-if="sellForm.motorPower === 'electric'" class="field">
                <span>Elektrikli Tip</span>
                <div class="segmented">
                  <button type="button" :class="{ active: sellForm.electricPowerType === 'battery' }" @click="sellForm.electricPowerType = 'battery'">Bataryalı</button>
                  <button type="button" :class="{ active: sellForm.electricPowerType === 'corded' }" @click="sellForm.electricPowerType = 'corded'">Kablolu</button>
                </div>
              </div>
            </div>

            <div class="form-grid specs">
              <label class="field"><span>Marka</span><input v-model="sellForm.brand" type="text" placeholder="Rewi" /></label>
              <label class="field"><span>Model</span><input v-model="sellForm.model" type="text" placeholder="Pro X5" /></label>
              <label class="field"><span>Model Yılı</span><input v-model="sellForm.modelYear" type="number" placeholder="2026" /></label>
              <label class="field"><span>Toplam Kullanım Süresi</span><input v-model="sellForm.totalUse" type="number" placeholder="3" /></label>
              <label class="field"><span>Fiyat</span><input v-model="sellForm.price" type="number" placeholder="12500" /></label>
              <label class="field"><span>Devir Sayısı rpm</span><input v-model="sellForm.rpm" type="number" placeholder="6500" /></label>
              <label class="field"><span>Motor Ağırlığı kg</span><input v-model="sellForm.motorWeight" type="number" placeholder="7" /></label>
              <label v-if="sellForm.motorPower === 'electric'" class="field"><span>Motor Gücü Watt</span><input v-model="sellForm.motorPowerValue" type="number" placeholder="1200" /></label>
              <label v-else class="field"><span>Motor Gücü kW</span><input v-model="sellForm.motorPowerValue" type="number" placeholder="1.7" /></label>
              <label v-if="sellForm.motorPower === 'electric'" class="field"><span>Pil Kapasitesi mAh</span><input v-model="sellForm.batteryCapacity" type="number" placeholder="20000" /></label>
              <label v-if="sellForm.motorPower === 'electric'" class="field"><span>Batarya Ağırlığı kg</span><input v-model="sellForm.batteryWeight" type="number" placeholder="2" /></label>
            </div>
          </template>

          <div v-else class="form-grid specs">
            <label class="field"><span>Dikim Tarihi</span><input v-model="sellForm.plantingDate" type="text" placeholder="04/2025" /></label>
            <label class="field"><span>Satılık Adet Sayısı</span><input v-model="sellForm.seedlingCount" type="number" placeholder="2000" /></label>
            <label class="field"><span>Adet Fiyatı TL</span><input v-model="sellForm.seedlingUnitPrice" type="number" placeholder="25" /></label>
          </div>

          <div class="upload-row">
            <label class="upload-button">
              <input type="file" accept="image/*" multiple hidden @change="handleImages" />
              {{ uploading ? 'Yükleniyor...' : 'Fotoğraf Ekle' }}
            </label>
            <div v-if="sellForm.imageUrls.length" class="image-preview">
              <div v-for="url in sellForm.imageUrls" :key="url">
                <img :src="url" alt="İlan fotoğrafı" />
                <button type="button" @click="removeImage(url)">×</button>
              </div>
            </div>
          </div>

          <div class="preview-row">
            <span>İlan önizlemesi</span>
            <strong>{{ sellForm.category === 'motor' ? 'Motor ekipmanı' : 'Çay fidesi' }}</strong>
            <em v-for="spec in previewSpecs" :key="String(spec)">{{ spec }}</em>
          </div>

          <div class="publish-row">
            <button class="publish-button" type="button" :disabled="submitting || uploading" @click="publishListing">
              {{ submitting ? 'Yayınlanıyor...' : 'İlanı Yayınla' }}
            </button>
          </div>
        </section>

        <section class="toolbar" aria-label="Pazar filtreleri">
          <div class="search-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input v-model="query" type="search" placeholder="İlanlarda ara..." />
          </div>
          <div class="tabs">
            <button
              v-for="tab in categoryTabs"
              :key="tab.key"
              type="button"
              :class="{ active: activeCategory === tab.key }"
              @click="activeCategory = tab.key"
            >
              {{ tab.label }}
              <span>{{ tab.count }}</span>
            </button>
          </div>
        </section>

        <div v-if="loading" class="empty-state">
          <h2>İlanlar yükleniyor</h2>
          <p>Güncel pazar ilanları getiriliyor.</p>
        </div>

        <section v-else-if="filteredListings.length" class="listing-grid" aria-label="2. el pazar ilanları">
          <article v-for="listing in filteredListings" :key="listing.id" class="listing-card">
            <div class="listing-visual" :class="listing.category === 'seedling' ? 'theme-green' : 'theme-yellow'">
              <span class="badge">{{ listing.category === 'seedling' ? 'Çay fidesi' : motorUseLabel(listing.specs?.motorUse) }}</span>
              <img v-if="listing.imageUrls?.length" :src="listing.imageUrls[0]" :alt="listing.title" />
              <div v-else-if="listing.category === 'seedling'" class="seedling-art" aria-hidden="true">
                <span v-for="n in 12" :key="n"></span>
              </div>
              <div v-else class="motor-art" aria-hidden="true">
                <span class="blade"></span>
                <span class="body"></span>
                <span class="handle"></span>
              </div>
            </div>
            <div class="listing-body">
              <div class="listing-topline">
                <span>{{ listing.contactName || listing.seller?.fullName }}</span>
                <small>{{ timeAgo(listing.createdAt) }}</small>
              </div>
              <h2>{{ listing.title }}</h2>
              <p>{{ listing.description }}</p>
              <div class="meta-row">
                <span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  {{ listing.location }}
                </span>
                <strong>{{ formatPrice(listing.price, listing.priceUnit) }}</strong>
              </div>
              <div class="contact-row">
                <a :href="`tel:${listing.contactPhone}`">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.9.32 1.77.59 2.61a2 2 0 0 1-.45 2.11L7.91 9.73a16 16 0 0 0 6.36 6.36l1.29-1.29a2 2 0 0 1 2.11-.45c.84.27 1.71.47 2.61.59A2 2 0 0 1 22 16.92Z"/></svg>
                  {{ listing.contactPhone }}
                </a>
              </div>
              <div class="highlight-row">
                <span v-for="item in listingHighlights(listing)" :key="String(item)">{{ item }}</span>
              </div>
            </div>
          </article>
        </section>

        <div v-else class="empty-state">
          <h2>Henüz ilan yok</h2>
          <p>Bu alanda sadece backendden gelen gerçek pazar ilanları gösterilir. İlk ilanı “Ürün Sat” ile yayınlayabilirsiniz.</p>
        </div>
      </div>
    </SocialWorkspaceLayout>
  </SocialBusinessLayout>
</template>

<style scoped>
.marketplace-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
}

.market-hero,
.sell-panel,
.scope-band div,
.listing-card,
.empty-state,
.alert {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
}

.market-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  padding: 24px;
}

.hero-copy {
  max-width: 620px;
}

.eyebrow {
  display: inline-flex;
  margin-bottom: 8px;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.market-hero h1 {
  margin: 0 0 8px;
  color: var(--color-text-primary);
  font-size: 30px;
  font-weight: 800;
  line-height: 1.15;
}

.market-hero p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 15px;
  line-height: 1.6;
}

.sell-cta,
.publish-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: var(--control-height);
  padding: 0 16px;
  color: #fff;
  background: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.publish-button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.alert {
  padding: 12px 14px;
  font-size: 14px;
  font-weight: 700;
}

.alert.error {
  color: #ef4444;
  background: rgba(239, 68, 68, .08);
  border-color: rgba(239, 68, 68, .24);
}

.alert.success {
  color: var(--color-primary);
  background: rgba(34, 197, 94, .08);
  border-color: rgba(34, 197, 94, .24);
}

.scope-band {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.scope-band div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
}

.scope-band strong {
  color: var(--color-text-primary);
  font-size: 14px;
}

.scope-band span {
  color: var(--color-text-muted);
  font-size: 13px;
  line-height: 1.45;
}

.sell-panel {
  padding: 18px;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.panel-head h2 {
  margin: 0 0 4px;
  color: var(--color-text-primary);
  font-size: 18px;
}

.panel-head p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 13px;
}

.icon-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  color: var(--color-text-muted);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.form-grid.specs {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.text-field {
  margin-bottom: 12px;
}

.field span {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.field input,
.field textarea {
  width: 100%;
  padding: 0 12px;
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font: inherit;
}

.field input {
  height: var(--control-height);
}

.field textarea {
  min-height: 96px;
  padding-top: 10px;
  padding-bottom: 10px;
  resize: vertical;
}

.field input:focus,
.field textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, .12);
}

.segmented,
.option-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.segmented button,
.choice {
  min-height: 40px;
  padding: 0 12px;
  color: var(--color-text-secondary);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.segmented button.active,
.choice.active {
  color: var(--color-primary);
  background: var(--color-primary-light);
  border-color: var(--color-primary);
}

.option-grid {
  margin-bottom: 12px;
}

.upload-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 0;
}

.upload-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  min-height: 38px;
  padding: 0 14px;
  color: var(--color-primary);
  background: var(--color-primary-light);
  border: 1px dashed var(--color-primary);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.image-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.image-preview div {
  position: relative;
  width: 76px;
  height: 76px;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-preview button {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  color: #fff;
  background: rgba(0, 0, 0, .62);
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}

.preview-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 13px;
}

.preview-row strong,
.preview-row em {
  padding: 5px 9px;
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
  border-radius: 8px;
  font-style: normal;
}

.publish-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 220px;
  padding: 0 12px;
  color: var(--color-text-muted);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 999px;
}

.search-box input {
  width: 100%;
  height: var(--control-height);
  color: var(--color-text-primary);
  background: transparent;
  border: 0;
  outline: 0;
  font: inherit;
}

.tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
}

.tabs button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: var(--control-height);
  padding: 0 12px;
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.tabs button.active {
  color: var(--color-primary);
  background: var(--color-primary-light);
  border-color: var(--color-primary);
}

.tabs span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
  border-radius: 999px;
  font-size: 12px;
}

.listing-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.listing-card {
  overflow: hidden;
}

.listing-visual {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 210px;
  overflow: hidden;
}

.listing-visual > img {
  width: 100%;
  height: 240px;
  object-fit: cover;
}

.theme-yellow { background: linear-gradient(135deg, #fff7d6, #f7c948); }
.theme-green { background: linear-gradient(135deg, #dcfce7, #4ade80); }

.badge {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 2;
  padding: 5px 9px;
  color: #172554;
  background: rgba(255, 255, 255, .86);
  border: 1px solid rgba(255, 255, 255, .6);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
}

.motor-art {
  position: relative;
  width: min(74%, 300px);
  height: 118px;
}

.motor-art .blade {
  position: absolute;
  left: 0;
  bottom: 16px;
  width: 58%;
  height: 34px;
  background: rgba(255, 255, 255, .78);
  border: 2px solid rgba(17, 24, 39, .22);
  border-radius: 4px;
  box-shadow: inset 0 -10px 0 rgba(17, 24, 39, .08);
}

.motor-art .body {
  position: absolute;
  right: 56px;
  bottom: 26px;
  width: 96px;
  height: 56px;
  background: #111827;
  border-radius: 14px 14px 8px 8px;
  box-shadow: inset 0 0 0 10px rgba(255, 255, 255, .12);
}

.motor-art .handle {
  position: absolute;
  right: 10px;
  bottom: 42px;
  width: 82px;
  height: 18px;
  background: #111827;
  border-radius: 999px;
  transform: rotate(-24deg);
}

.seedling-art {
  display: grid;
  grid-template-columns: repeat(6, 28px);
  gap: 12px 14px;
  align-items: end;
  padding-top: 28px;
}

.seedling-art span {
  position: relative;
  display: block;
  width: 24px;
  height: 86px;
  border-radius: 0 0 12px 12px;
  background: #1f2937;
}

.seedling-art span::before,
.seedling-art span::after {
  content: "";
  position: absolute;
  top: -18px;
  width: 28px;
  height: 18px;
  background: #166534;
  border-radius: 100% 0 100% 0;
}

.seedling-art span::before {
  left: -12px;
  transform: rotate(18deg);
}

.seedling-art span::after {
  right: -12px;
  transform: rotate(78deg);
}

.listing-body {
  padding: 16px;
}

.listing-topline,
.meta-row,
.highlight-row,
.contact-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.listing-topline {
  justify-content: space-between;
  margin-bottom: 8px;
}

.listing-topline span {
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 800;
}

.listing-topline small {
  color: var(--color-text-muted);
  font-size: 12px;
}

.listing-body h2 {
  margin: 0 0 8px;
  color: var(--color-text-primary);
  font-size: 17px;
  line-height: 1.3;
}

.listing-body p {
  margin: 0 0 14px;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.55;
}

.meta-row {
  justify-content: space-between;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.meta-row span,
.contact-row a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.meta-row strong {
  color: var(--color-primary);
  font-size: 17px;
}

.contact-row {
  margin-bottom: 12px;
}

.contact-row a {
  padding: 7px 10px;
  color: var(--color-primary);
  background: var(--color-primary-light);
  border-radius: 8px;
  font-weight: 800;
  text-decoration: none;
}

.highlight-row {
  flex-wrap: wrap;
}

.highlight-row span {
  padding: 5px 8px;
  color: var(--color-text-secondary);
  background: var(--color-bg-tertiary);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
}

.empty-state {
  padding: 32px;
  text-align: center;
}

.empty-state h2 {
  margin: 0 0 6px;
  color: var(--color-text-primary);
  font-size: 18px;
}

.empty-state p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 14px;
}

@media (max-width: 860px) {
  .market-hero,
  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .scope-band,
  .listing-grid,
  .form-grid,
  .form-grid.specs {
    grid-template-columns: 1fr;
  }

  .sell-cta,
  .publish-button {
    width: 100%;
  }

  .publish-row {
    justify-content: stretch;
  }
}

@media (max-width: 520px) {
  .market-hero,
  .sell-panel,
  .listing-body {
    padding: 14px;
  }

  .market-hero h1 {
    font-size: 24px;
  }

  .listing-visual {
    min-height: 180px;
  }
}
</style>
