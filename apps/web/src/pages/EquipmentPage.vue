<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SocialBusinessLayout from '@/layouts/SocialBusinessLayout.vue';
import SocialWorkspaceLayout from '@/layouts/SocialWorkspaceLayout.vue';
import { useAuthStore } from '@/stores/authStore';
import {
  api,
  type EquipmentCategory,
  type EquipmentComment,
  type EquipmentItem,
  type EquipmentUsageStatus,
} from '@/services/api';

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const categories = [
  { key: 'all', label: 'Tüm Ekipmanlar' },
  { key: 'electric-motor', label: 'Elektrikli Motor' },
  { key: 'gasoline-motor', label: 'Benzinli Motor' },
  { key: 'hand-shears', label: 'El Makası' },
  { key: 'wearable', label: 'Giyilebilir' },
  { key: 'helper', label: 'Yardımcı' },
  { key: 'other', label: 'Diğer' },
] as const;

type CategoryKey = (typeof categories)[number]['key'];
type StatKey = Exclude<CategoryKey, 'all'> | 'pending';

const equipmentTypes = [
  { value: 'electric-motor' as const, label: 'Elektrikli Çay Toplama Motoru' },
  { value: 'gasoline-motor' as const, label: 'Benzinli Çay Toplama Motoru' },
  { value: 'hand-shears' as const, label: 'El Makası' },
  { value: 'wearable' as const, label: 'Giyilebilir Ekipman' },
  { value: 'helper' as const, label: 'Yardımcı Ekipman' },
  { value: 'other' as const, label: 'Diğer' },
];

const activeCategory = ref<CategoryKey>('all');
const query = ref('');
const showSubmitPanel = ref(false);
const selectedEquipmentId = ref('');
const successMessage = ref('');
const errorMessage = ref('');
const loading = ref(false);
const imageUploading = ref(false);
const quickReviewSubmitting = ref<string | null>(null);
const comparedIds = ref<string[]>([]);

const newEquipment = reactive({
  category: 'electric-motor' as EquipmentCategory,
  brand: '',
  model: '',
  typeLabel: 'Elektrikli Çay Toplama Motoru',
  price: '',
  imageUrl: '',
  rpm: '',
  motorPower: '',
  voltage: '',
  batteryCapacity: '',
  motorWeight: '',
  batteryWeight: '',
  bladeLength: '',
  material: '',
  hardness: '',
});

const reviewForm = reactive({
  rating: 4,
  usageStatus: 'using' as EquipmentUsageStatus,
  usageMonths: 12,
  text: '',
});

const equipment = ref<EquipmentItem[]>([]);
const pendingEquipment = ref<EquipmentItem[]>([]);

const approvedEquipment = computed(() => equipment.value.filter(item => item.status === 'approved'));

const filteredEquipment = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('tr-TR');
  return approvedEquipment.value.filter((item) => {
    const matchesCategory = activeCategory.value === 'all' || item.category === activeCategory.value;
    const haystack = [item.brand, item.model, item.typeLabel, ...item.specs.map(spec => `${spec.label} ${spec.value}`)].join(' ').toLocaleLowerCase('tr-TR');
    return matchesCategory && (!needle || haystack.includes(needle));
  }).sort((a, b) => fpScore(b) - fpScore(a));
});

const routeEquipmentId = computed(() => typeof route.params.id === 'string' ? route.params.id : '');
const isDetailView = computed(() => route.name === 'social-equipment-detail');
const selectedEquipment = computed(() => {
  const targetId = routeEquipmentId.value || selectedEquipmentId.value;
  return approvedEquipment.value.find(item => item.id === targetId) || null;
});

const comparedEquipment = computed(() => approvedEquipment.value.filter(item => comparedIds.value.includes(item.id)).slice(0, 3));
const selectedIsCompared = computed(() => selectedEquipment.value ? comparedIds.value.includes(selectedEquipment.value.id) : false);

const categoryStats = computed(() => {
  const totalApproved = approvedEquipment.value.length;
  const stats: { key: StatKey; label: string; count: number; totalApproved: number }[] = categories
    .filter((category): category is Extract<(typeof categories)[number], { key: Exclude<CategoryKey, 'all'> }> => category.key !== 'all')
    .map(category => ({
      key: category.key,
      label: category.label,
      count: approvedEquipment.value.filter(item => item.category === category.key).length,
      totalApproved,
    }))
    .filter(item => item.count > 0 || item.key === 'other');

  stats.push({ key: 'pending', label: 'Onay Bekleyen', count: pendingEquipment.value.length, totalApproved });
  return stats;
});

const topComments = computed(() => {
  if (!selectedEquipment.value) return [];
  return [...selectedEquipment.value.comments].sort((a, b) => b.likes - a.likes).slice(0, 3);
});

watch(filteredEquipment, (items) => {
  if (!items.some(item => item.id === selectedEquipmentId.value)) selectedEquipmentId.value = items[0]?.id || '';
});

onMounted(() => {
  fetchEquipment();
});

async function fetchEquipment() {
  loading.value = true;
  errorMessage.value = '';

  const response = await api.getEquipment({ status: 'approved' });
  if (response.error) {
    errorMessage.value = response.error.message;
  } else {
    equipment.value = response.data || [];
    if (!selectedEquipmentId.value && equipment.value[0]) selectedEquipmentId.value = equipment.value[0].id;
    comparedIds.value = comparedIds.value.filter(id => equipment.value.some(item => item.id === id));
  }

  if (authStore.isAdmin) {
    const pendingResponse = await api.getEquipment({ status: 'pending' });
    if (!pendingResponse.error) pendingEquipment.value = pendingResponse.data || [];
  }

  loading.value = false;
}

function averageRating(item: EquipmentItem) {
  if (!item.comments.length) return 0;
  return item.comments.reduce((sum, comment) => sum + comment.rating, 0) / item.comments.length;
}

function roundedRating(item: EquipmentItem) {
  return Math.round(averageRating(item));
}

function hasUserReviewed(item: EquipmentItem) {
  return item.currentUserRating !== null && item.currentUserRating !== undefined;
}

function averageUsageMonths(item: EquipmentItem) {
  if (!item.comments.length) return 0;
  return item.comments.reduce((sum, comment) => sum + comment.usageMonths, 0) / item.comments.length;
}

function fpScore(item: EquipmentItem) {
  const ratingPart = (averageRating(item) / 5) * 45;
  const pricePart = Math.max(0, Math.min(1.35, item.segmentAverage / Math.max(item.price, 1))) * 25;
  const durabilityPart = Math.min(1, averageUsageMonths(item) / 36) * 15;
  const trustPart = Math.min(1, item.comments.length / 8) * 10;
  const socialPart = Math.min(1, item.comments.reduce((sum, comment) => sum + comment.likes, 0) / 80) * 5;
  return Math.round(Math.min(100, ratingPart + pricePart + durabilityPart + trustPart + socialPart));
}

function scoreLabel(item: EquipmentItem) {
  const score = fpScore(item);
  if (score >= 85) return 'Önerilen Ürün';
  if (score >= 75) return 'Güçlü Aday';
  if (score >= 60) return 'Dengeli Seçenek';
  return 'Yorum Bekliyor';
}

function formatPrice(value: number) {
  return `${new Intl.NumberFormat('tr-TR').format(value)} TL`;
}

function selectEquipment(id: string) {
  selectedEquipmentId.value = id;
  router.push({ name: 'social-equipment-detail', params: { id } });
}

function goToEquipmentList() {
  router.push({ name: 'social-equipment' });
}

function toggleCompare(item: EquipmentItem) {
  const alreadyCompared = comparedIds.value.includes(item.id);
  if (!alreadyCompared && comparedIds.value.length >= 3) {
    errorMessage.value = 'Karşılaştırmaya en fazla 3 ürün eklenebilir.';
    return;
  }
  comparedIds.value = alreadyCompared
    ? comparedIds.value.filter(id => id !== item.id)
    : [...comparedIds.value, item.id];
  errorMessage.value = '';
}

async function toggleFavorite(item: EquipmentItem) {
  if (!authStore.isAuthenticated) {
    errorMessage.value = 'Favoriye eklemek için giriş yapmalısınız.';
    return;
  }

  const previous = item.favorite;
  item.favorite = !item.favorite;
  const response = await api.toggleEquipmentFavorite(item.id);
  if (response.error) {
    item.favorite = previous;
    errorMessage.value = response.error.message;
    return;
  }
  item.favorite = response.data?.favorite ?? item.favorite;
}

async function toggleCommentLike(comment: EquipmentComment) {
  if (!authStore.isAuthenticated) {
    errorMessage.value = 'Yorum beğenmek için giriş yapmalısınız.';
    return;
  }

  const previousLiked = comment.liked;
  comment.liked = !comment.liked;
  comment.likes += comment.liked ? 1 : -1;

  const response = await api.toggleEquipmentReviewLike(comment.id);
  if (response.error) {
    comment.liked = previousLiked;
    comment.likes += previousLiked ? 1 : -1;
    errorMessage.value = response.error.message;
    return;
  }
  comment.liked = response.data?.liked ?? comment.liked;
}

async function submitReview() {
  if (!selectedEquipment.value) return;
  if (!authStore.isAuthenticated) {
    errorMessage.value = 'Değerlendirme yapmak için giriş yapmalısınız.';
    return;
  }
  if (hasUserReviewed(selectedEquipment.value)) {
    errorMessage.value = 'Bu ekipman için daha önce değerlendirme yaptınız.';
    return;
  }
  if (reviewForm.text.trim().length < 12) {
    errorMessage.value = 'Yorum en az 12 karakter olmalıdır.';
    return;
  }

  const response = await api.createEquipmentReview(selectedEquipment.value.id, {
    rating: Number(reviewForm.rating),
    usageStatus: reviewForm.usageStatus,
    usageMonths: Number(reviewForm.usageMonths),
    text: reviewForm.text.trim(),
  });

  if (response.error) {
    errorMessage.value = response.error.message;
    return;
  }

  reviewForm.rating = 4;
  reviewForm.usageStatus = 'using';
  reviewForm.usageMonths = 12;
  reviewForm.text = '';
  successMessage.value = 'Değerlendirmeniz eklendi.';
  errorMessage.value = '';
  await fetchEquipment();
}

async function submitQuickReview(item: EquipmentItem, rating: number) {
  if (!authStore.isAuthenticated) {
    errorMessage.value = 'Değerlendirme yapmak için giriş yapmalısınız.';
    return;
  }
  if (hasUserReviewed(item)) {
    errorMessage.value = 'Bu ekipman için daha önce değerlendirme yaptınız.';
    return;
  }

  quickReviewSubmitting.value = `${item.id}-${rating}`;
  const response = await api.createEquipmentReview(item.id, {
    rating,
    usageStatus: 'using',
    usageMonths: 12,
    text: `Hızlı değerlendirme: ${rating}/5 puan.`,
  });
  quickReviewSubmitting.value = null;

  if (response.error) {
    errorMessage.value = response.error.message;
    return;
  }

  successMessage.value = `${item.brand} ${item.model} için ${rating}/5 değerlendirme eklendi.`;
  errorMessage.value = '';
  await fetchEquipment();
}

async function submitEquipment() {
  if (!authStore.isAuthenticated) {
    errorMessage.value = 'Ekipman eklemek için giriş yapmalısınız.';
    return;
  }
  if (!newEquipment.brand.trim() || !newEquipment.model.trim() || !Number(newEquipment.price)) {
    errorMessage.value = 'Marka, model ve fiyat alanları zorunludur.';
    return;
  }

  const specs = buildSpecs();
  const response = await api.createEquipment({
    category: newEquipment.category,
    brand: newEquipment.brand.trim(),
    model: newEquipment.model.trim(),
    typeLabel: newEquipment.typeLabel.trim() || equipmentTypes.find(type => type.value === newEquipment.category)?.label || 'Diğer',
    price: Number(newEquipment.price),
    imageUrl: newEquipment.imageUrl.trim() || null,
    specs,
  });

  if (response.error) {
    errorMessage.value = response.error.message;
    return;
  }

  showSubmitPanel.value = false;
  successMessage.value = authStore.isAdmin ? 'Ekipman yayınlandı.' : 'Ekipman öneriniz admin onayına gönderildi.';
  errorMessage.value = '';
  resetNewEquipment();
  await fetchEquipment();
}

async function handleEquipmentImage(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    errorMessage.value = 'Lütfen geçerli bir görsel dosyası seçin.';
    input.value = '';
    return;
  }

  imageUploading.value = true;
  errorMessage.value = '';

  const response = await api.uploadImage(file);
  imageUploading.value = false;
  input.value = '';

  if (response.error) {
    errorMessage.value = response.error.message;
    return;
  }

  if (response.data?.url) {
    newEquipment.imageUrl = response.data.url;
    successMessage.value = 'Görsel yüklendi.';
  }
}

function removeEquipmentImage() {
  newEquipment.imageUrl = '';
}

async function approveEquipment(item: EquipmentItem) {
  const response = await api.approveEquipment(item.id);
  if (response.error) {
    errorMessage.value = response.error.message;
    return;
  }
  successMessage.value = `${item.brand} ${item.model} onaylandı.`;
  await fetchEquipment();
}

async function rejectEquipment(id: string) {
  const response = await api.rejectEquipment(id);
  if (response.error) {
    errorMessage.value = response.error.message;
    return;
  }
  successMessage.value = 'Bekleyen ekipman reddedildi.';
  await fetchEquipment();
}

function buildSpecs() {
  const entries = [
    ['Devir Sayısı', newEquipment.rpm && `${newEquipment.rpm} rpm`],
    ['Motor Gücü', newEquipment.motorPower && `${newEquipment.motorPower} ${newEquipment.category === 'gasoline-motor' ? 'kW' : 'Watt'}`],
    ['Voltaj', newEquipment.voltage && `${newEquipment.voltage} V`],
    ['Pil Kapasitesi', newEquipment.batteryCapacity && `${newEquipment.batteryCapacity} mAh`],
    ['Motor Ağırlığı', newEquipment.motorWeight && `${newEquipment.motorWeight} kg`],
    ['Batarya Ağırlığı', newEquipment.batteryWeight && `${newEquipment.batteryWeight} kg`],
    ['Bıçak Uzunluğu', newEquipment.bladeLength && `${newEquipment.bladeLength} cm`],
    ['Malzeme', newEquipment.material],
    ['Sertlik', newEquipment.hardness],
  ];
  return entries.filter(([, value]) => Boolean(value)).map(([label, value]) => ({ label: String(label), value: String(value) }));
}

function resetNewEquipment() {
  Object.assign(newEquipment, {
    category: 'electric-motor',
    brand: '',
    model: '',
    typeLabel: 'Elektrikli Çay Toplama Motoru',
    price: '',
    imageUrl: '',
    rpm: '',
    motorPower: '',
    voltage: '',
    batteryCapacity: '',
    motorWeight: '',
    batteryWeight: '',
    bladeLength: '',
    material: '',
    hardness: '',
  });
}

function updateTypeLabel() {
  newEquipment.typeLabel = equipmentTypes.find(type => type.value === newEquipment.category)?.label || 'Diğer';
}
</script>

<template>
  <SocialBusinessLayout>
    <SocialWorkspaceLayout>
      <div class="equipment-page">
        <section class="equipment-hero">
          <div class="hero-copy">
            <span class="eyebrow">Bülten Modülü</span>
            <h1>Ekipman Değerlendirme</h1>
            <p>
              Çay üreticilerinin motor, makas, giyim ve yardımcı ekipmanları fiyat, performans,
              kullanım süresi ve üretici yorumlarına göre karşılaştırabileceği çalışma alanı.
            </p>
          </div>
          <button class="primary-action" type="button" @click="showSubmitPanel = !showSubmitPanel">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Ekipman Ekle
          </button>
        </section>

        <div v-if="successMessage" class="alert success">{{ successMessage }}</div>
        <div v-if="errorMessage" class="alert error">{{ errorMessage }}</div>

        <section v-if="!isDetailView" class="stats-row" aria-label="Ekipman özeti">
          <button
            v-for="item in categoryStats"
            :key="item.key"
            type="button"
            class="stat-tile"
            :class="{ active: activeCategory === item.key }"
            @click="item.key === 'pending' ? null : activeCategory = item.key"
          >
            <span>{{ item.label }}</span>
            <strong>{{ item.count }}</strong>
          </button>
        </section>

        <section v-if="showSubmitPanel" class="submit-panel">
          <div class="panel-head">
            <div>
              <h2>Değerlendirmeye Ekipman Gönder</h2>
              <p>Kullanıcı gönderileri onaydan sonra yayınlanır. Admin kullanıcılar doğrudan yayınlayabilir.</p>
            </div>
            <button class="icon-button" type="button" aria-label="Formu kapat" @click="showSubmitPanel = false">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div class="form-grid">
            <label class="field">
              <span>Ekipman Türü</span>
              <select v-model="newEquipment.category" @change="updateTypeLabel">
                <option v-for="type in equipmentTypes" :key="type.value" :value="type.value">{{ type.label }}</option>
              </select>
            </label>
            <label class="field">
              <span>Tür Etiketi</span>
              <input v-model="newEquipment.typeLabel" type="text" placeholder="Örn. Elektrikli Çay Toplama Motoru" />
            </label>
            <label class="field">
              <span>Marka</span>
              <input v-model="newEquipment.brand" type="text" placeholder="Kewi" />
            </label>
            <label class="field">
              <span>Model</span>
              <input v-model="newEquipment.model" type="text" placeholder="T500 Pro" />
            </label>
            <label class="field">
              <span>Fiyat</span>
              <input v-model="newEquipment.price" type="number" placeholder="8500" />
            </label>
            <div class="field image-field">
              <span>Ürün Görseli</span>
              <label class="upload-box" :class="{ 'has-image': !!newEquipment.imageUrl }">
                <input type="file" accept="image/*" hidden @change="handleEquipmentImage" />
                <img v-if="newEquipment.imageUrl" :src="newEquipment.imageUrl" alt="Ekipman görseli önizlemesi" />
                <span v-else>{{ imageUploading ? 'Yükleniyor...' : 'Görsel Yükle' }}</span>
              </label>
              <button v-if="newEquipment.imageUrl" class="remove-image" type="button" @click="removeEquipmentImage">
                Görseli Kaldır
              </button>
            </div>
          </div>

          <div class="form-grid specs">
            <label class="field"><span>Devir Sayısı rpm</span><input v-model="newEquipment.rpm" type="number" /></label>
            <label class="field"><span>Motor Gücü</span><input v-model="newEquipment.motorPower" type="number" /></label>
            <label class="field"><span>Voltaj Volt</span><input v-model="newEquipment.voltage" type="number" /></label>
            <label class="field"><span>Pil Kapasitesi mAh</span><input v-model="newEquipment.batteryCapacity" type="number" /></label>
            <label class="field"><span>Motor Ağırlığı kg</span><input v-model="newEquipment.motorWeight" type="number" step="0.1" /></label>
            <label class="field"><span>Batarya Ağırlığı kg</span><input v-model="newEquipment.batteryWeight" type="number" step="0.1" /></label>
            <label class="field"><span>Bıçak Uzunluğu cm</span><input v-model="newEquipment.bladeLength" type="number" /></label>
            <label class="field"><span>Malzeme</span><input v-model="newEquipment.material" type="text" placeholder="Kumaş, kauçuk, çelik" /></label>
            <label class="field"><span>Sertlik</span><input v-model="newEquipment.hardness" type="text" placeholder="Orta sert" /></label>
          </div>

          <div class="submit-row">
            <button class="secondary-action" type="button" @click="resetNewEquipment">Temizle</button>
            <button class="primary-action" type="button" :disabled="imageUploading" @click="submitEquipment">
              {{ imageUploading ? 'Görsel Yükleniyor...' : 'Onaya Gönder' }}
            </button>
          </div>
        </section>

        <section v-if="authStore.isAdmin && pendingEquipment.length" class="approval-panel">
          <div class="panel-head compact">
            <h2>Admin Onay Kuyruğu</h2>
            <span>{{ pendingEquipment.length }} ekipman bekliyor</span>
          </div>
          <article v-for="item in pendingEquipment" :key="item.id" class="approval-item">
            <div>
              <strong>{{ item.brand }} {{ item.model }}</strong>
              <span>{{ item.typeLabel }} - {{ formatPrice(item.price) }}</span>
            </div>
            <div class="approval-actions">
              <button type="button" class="approve" @click="approveEquipment(item)">Onayla</button>
              <button type="button" class="reject" @click="rejectEquipment(item.id)">Reddet</button>
            </div>
          </article>
        </section>

        <section v-if="!isDetailView" class="toolbar" aria-label="Ekipman filtreleri">
          <div class="search-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input v-model="query" type="search" placeholder="Marka, model veya teknik özellik ara..." />
          </div>
          <div class="tabs">
            <button
              v-for="category in categories"
              :key="category.key"
              type="button"
              :class="{ active: activeCategory === category.key }"
              @click="activeCategory = category.key"
            >
              {{ category.label }}
            </button>
          </div>
        </section>

        <div v-if="loading" class="empty-state">
          <h2>Ekipmanlar yükleniyor</h2>
          <p>Backend üzerinden yayınlanmış ekipman kayıtları getiriliyor.</p>
        </div>

        <div v-else-if="filteredEquipment.length === 0" class="empty-state">
          <h2>Henüz yayınlanmış ekipman yok</h2>
          <p>İlk ekipmanı “Ekipman Ekle” ile gönderebilirsiniz. Kullanıcı gönderileri admin onayından sonra burada görünür.</p>
        </div>

        <section v-else-if="!isDetailView" class="equipment-market-grid" aria-label="Ekipman listesi">
          <div class="equipment-list" aria-label="Ekipman listesi">
            <article
              v-for="item in filteredEquipment"
              :key="item.id"
              class="equipment-card"
              @click="selectEquipment(item.id)"
            >
              <div class="card-art" :class="`theme-${item.category}`">
                <img v-if="item.imageUrl" :src="item.imageUrl" :alt="`${item.brand} ${item.model}`" />
                <div v-else class="equipment-art" aria-hidden="true">
                  <span class="blade"></span>
                  <span class="body"></span>
                  <span class="handle"></span>
                </div>
              </div>
              <div class="card-body">
                <h2 :title="`${item.brand} ${item.model}`">{{ item.brand }} {{ item.model }}</h2>
                <div class="card-meta">
                  <span>{{ formatPrice(item.price) }}</span>
                  <strong>{{ averageRating(item).toFixed(1) }}/5</strong>
                </div>
                <div class="quick-rating" aria-label="Hızlı değerlendirme" @click.stop>
                  <button
                    v-for="rating in 5"
                    :key="rating"
                    type="button"
                    :class="{ filled: rating <= roundedRating(item), own: item.currentUserRating === rating }"
                    :disabled="hasUserReviewed(item) || quickReviewSubmitting === `${item.id}-${rating}`"
                    :aria-label="`${rating} puan ver`"
                    :title="hasUserReviewed(item) ? `Oyunuz: ${item.currentUserRating}/5` : `${rating} puan ver`"
                    @click="submitQuickReview(item, rating)"
                  >
                    ★
                  </button>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section v-else-if="selectedEquipment" class="equipment-detail-shell">
          <aside class="detail-panel" aria-label="Ekipman değerlendirme kartı">
            <button class="back-link" type="button" @click="goToEquipmentList">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Listeye Dön
            </button>
            <div class="detail-head">
              <div>
                <span class="eyebrow">Değerlendirme Kartı</span>
                <h2>{{ selectedEquipment.brand }} {{ selectedEquipment.model }}</h2>
                <p>{{ selectedEquipment.typeLabel }} - Ekleyen: {{ selectedEquipment.addedBy }}</p>
              </div>
              <button class="icon-button favorite" :class="{ active: selectedEquipment.favorite }" type="button" :aria-label="selectedEquipment.favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'" @click="toggleFavorite(selectedEquipment)">
                <svg width="19" height="19" viewBox="0 0 24 24" :fill="selectedEquipment.favorite ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>
              </button>
            </div>

            <div class="detail-visual" :class="`theme-${selectedEquipment.category}`">
              <img v-if="selectedEquipment.imageUrl" :src="selectedEquipment.imageUrl" :alt="`${selectedEquipment.brand} ${selectedEquipment.model}`" />
              <div v-else class="large-art" aria-hidden="true">
                <span class="blade"></span>
                <span class="body"></span>
                <span class="handle"></span>
                <span class="battery"></span>
              </div>
            </div>

            <div class="score-board">
              <div>
                <span>Fiyat</span>
                <strong>{{ formatPrice(selectedEquipment.price) }}</strong>
              </div>
              <div>
                <span>Segment Ortalaması</span>
                <strong>{{ formatPrice(selectedEquipment.segmentAverage) }}</strong>
              </div>
              <div class="score-pill">
                <span>F/P Skoru</span>
                <strong>{{ fpScore(selectedEquipment) }}/100</strong>
              </div>
              <em>{{ scoreLabel(selectedEquipment) }}</em>
            </div>

            <section class="spec-section">
              <h3>Teknik Özellikler</h3>
              <div class="spec-grid">
                <div v-for="spec in selectedEquipment.specs" :key="`${spec.label}-${spec.value}`">
                  <span>{{ spec.label }}</span>
                  <strong>{{ spec.value }}</strong>
                </div>
              </div>
            </section>

            <section class="comment-section">
              <h3>Öne Çıkan Yorumlar</h3>
              <article v-for="comment in topComments" :key="comment.id" class="comment-card">
                <p>{{ comment.text }}</p>
                <div>
                  <span>{{ comment.author }} - {{ comment.rating }}/5 - {{ comment.usageMonths }} ay</span>
                  <button type="button" :class="{ active: comment.liked }" @click="toggleCommentLike(comment)">
                    <svg width="15" height="15" viewBox="0 0 24 24" :fill="comment.liked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                    {{ comment.likes }}
                  </button>
                </div>
              </article>
            </section>

            <section class="review-panel">
              <h3>Değerlendirme Yap</h3>
              <div class="one-click-review" aria-label="Tek tıkla değerlendir">
                <button
                  v-for="rating in 5"
                  :key="rating"
                  type="button"
                  :class="{ filled: rating <= roundedRating(selectedEquipment), own: selectedEquipment.currentUserRating === rating }"
                  :disabled="hasUserReviewed(selectedEquipment) || quickReviewSubmitting === `${selectedEquipment.id}-${rating}`"
                  :title="hasUserReviewed(selectedEquipment) ? `Oyunuz: ${selectedEquipment.currentUserRating}/5` : `${rating} puan ver`"
                  @click="submitQuickReview(selectedEquipment, rating)"
                >
                  <span>{{ rating }}</span>
                  ★
                </button>
              </div>
              <div class="review-controls">
                <label>
                  <span>Puanla</span>
                  <input v-model="reviewForm.rating" type="number" min="1" max="5" />
                </label>
                <label>
                  <span>Kullanım</span>
                  <select v-model="reviewForm.usageStatus">
                    <option value="using">Kullanıyorum</option>
                    <option value="used">Kullandım</option>
                  </select>
                </label>
                <label>
                  <span>Süre (ay)</span>
                  <input v-model="reviewForm.usageMonths" type="number" min="1" />
                </label>
              </div>
              <textarea v-model="reviewForm.text" rows="3" placeholder="Ürünle ilgili deneyiminizi yazın."></textarea>
              <button class="primary-action" type="button" @click="submitReview">Yorumu Ekle</button>
            </section>

            <div class="detail-actions">
              <button class="secondary-action" type="button" @click="toggleCompare(selectedEquipment)">
                {{ selectedIsCompared ? 'Karşılaştırmadan Çıkar' : 'Karşılaştır' }}
              </button>
            </div>
          </aside>
        </section>

        <div v-else class="empty-state">
          <h2>Ekipman bulunamadı</h2>
          <p>Aradığınız ekipman kaldırılmış veya henüz onaylanmamış olabilir.</p>
          <button class="primary-action" type="button" @click="goToEquipmentList">Listeye Dön</button>
        </div>

        <section v-if="comparedEquipment.length" class="compare-section">
          <div class="panel-head compact">
            <h2>Karşılaştırma</h2>
            <span>En fazla 3 ürün</span>
          </div>
          <div class="compare-grid">
            <article v-for="item in comparedEquipment" :key="item.id">
              <strong>{{ item.brand }} {{ item.model }}</strong>
              <span>{{ formatPrice(item.price) }}</span>
              <em>{{ fpScore(item) }}/100</em>
              <button type="button" @click="toggleCompare(item)">Çıkar</button>
            </article>
          </div>
        </section>
      </div>
    </SocialWorkspaceLayout>
  </SocialBusinessLayout>
</template>

<style scoped>
.equipment-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.equipment-hero,
.submit-panel,
.approval-panel,
.detail-panel,
.compare-section,
.empty-state,
.alert,
.stat-tile,
.equipment-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
}

.equipment-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  padding: 24px;
}

.hero-copy {
  max-width: 680px;
}

.eyebrow {
  display: inline-flex;
  margin-bottom: 8px;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.equipment-hero h1,
.detail-head h2 {
  margin: 0 0 8px;
  color: var(--color-text-primary);
  line-height: 1.15;
}

.equipment-hero h1 {
  font-size: 30px;
  font-weight: 850;
}

.equipment-hero p,
.detail-head p,
.panel-head p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.6;
}

.primary-action,
.secondary-action,
.icon-button,
.approve,
.reject {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 8px;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
}

.primary-action {
  color: #fff;
  background: var(--color-primary);
  border: 1px solid var(--color-primary);
}

.secondary-action,
.icon-button {
  color: var(--color-text-secondary);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
}

.icon-button {
  width: 40px;
  padding: 0;
}

.icon-button.favorite.active {
  color: #ef4444;
  background: rgba(239, 68, 68, .08);
  border-color: rgba(239, 68, 68, .22);
}

.alert {
  padding: 12px 14px;
  font-size: 14px;
  font-weight: 800;
}

.alert.success {
  color: var(--color-primary);
  background: rgba(34, 197, 94, .08);
  border-color: rgba(34, 197, 94, .24);
}

.alert.error {
  color: #ef4444;
  background: rgba(239, 68, 68, .08);
  border-color: rgba(239, 68, 68, .24);
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
  line-height: 1.5;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.stat-tile {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  color: var(--color-text-secondary);
  cursor: pointer;
  text-align: left;
}

.stat-tile.active {
  color: var(--color-primary);
  background: var(--color-primary-light);
  border-color: var(--color-primary);
}

.stat-tile span {
  font-size: 13px;
  font-weight: 700;
}

.stat-tile strong {
  color: var(--color-text-primary);
  font-size: 18px;
}

.submit-panel,
.approval-panel,
.detail-panel,
.compare-section {
  padding: 18px;
}

.panel-head,
.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.panel-head.compact {
  align-items: center;
  margin-bottom: 12px;
}

.panel-head h2,
.spec-section h3,
.comment-section h3,
.review-panel h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 18px;
}

.panel-head.compact h2 {
  font-size: 16px;
}

.panel-head.compact span {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 700;
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

.field,
.review-controls label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.field span,
.review-controls span {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 800;
}

.field input,
.field select,
.review-controls input,
.review-controls select,
.review-panel textarea {
  width: 100%;
  min-height: 40px;
  padding: 10px 12px;
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font: inherit;
}

.field input:focus,
.field select:focus,
.review-controls input:focus,
.review-controls select:focus,
.review-panel textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, .12);
}

.primary-action:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.image-field {
  grid-row: span 2;
}

.upload-box {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 118px;
  overflow: hidden;
  color: var(--color-primary);
  background: var(--color-primary-light);
  border: 1px dashed var(--color-primary);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.upload-box.has-image {
  background: var(--color-bg-tertiary);
  border-style: solid;
}

.upload-box img {
  width: 100%;
  height: 150px;
  object-fit: cover;
}

.remove-image {
  align-self: flex-start;
  color: #ef4444;
  background: transparent;
  border: 0;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.submit-row {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
}

.approval-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--color-border);
}

.approval-item:first-of-type {
  border-top: 0;
}

.approval-item div:first-child {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.approval-item strong {
  color: var(--color-text-primary);
  font-size: 14px;
}

.approval-item span {
  color: var(--color-text-muted);
  font-size: 13px;
}

.approval-actions {
  display: flex;
  gap: 8px;
}

.approve {
  color: var(--color-primary);
  background: var(--color-primary-light);
  border: 1px solid rgba(34, 197, 94, .35);
}

.reject {
  color: #ef4444;
  background: rgba(239, 68, 68, .08);
  border: 1px solid rgba(239, 68, 68, .25);
}

.toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 0 12px;
  color: var(--color-text-muted);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 999px;
}

.search-box input {
  width: 100%;
  min-height: 42px;
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
  padding-bottom: 2px;
}

.tabs button {
  min-height: 38px;
  padding: 0 12px;
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
}

.tabs button.active {
  color: var(--color-primary);
  background: var(--color-primary-light);
  border-color: var(--color-primary);
}

.equipment-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 14px 16px;
  align-items: start;
}

.equipment-market-grid {
  width: 100%;
}

.equipment-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  overflow: hidden;
  cursor: pointer;
  transition: color .2s;
}

.equipment-card:hover h2 {
  color: var(--color-primary);
}

.card-art,
.detail-visual {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.card-art {
  aspect-ratio: 1 / .78;
  min-height: 0;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 2px;
}

.card-art img,
.detail-visual img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.theme-electric-motor { background: linear-gradient(135deg, #fff7d6, #f7c948); }
.theme-gasoline-motor { background: linear-gradient(135deg, #fee2e2, #f97316); }
.theme-hand-shears { background: linear-gradient(135deg, #e0f2fe, #38bdf8); }
.theme-wearable { background: linear-gradient(135deg, #dcfce7, #4ade80); }
.theme-helper { background: linear-gradient(135deg, #f5f5f4, #a8a29e); }
.theme-other { background: linear-gradient(135deg, #ede9fe, #8b5cf6); }

.score-ribbon {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 4px 8px;
  color: #172554;
  background: rgba(255, 255, 255, .9);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
}

.equipment-art,
.large-art {
  position: relative;
  width: 78px;
  height: 58px;
}

.large-art {
  width: min(72%, 360px);
  height: 150px;
}

.equipment-art .blade,
.large-art .blade {
  position: absolute;
  left: 0;
  bottom: 13px;
  width: 62%;
  height: 26px;
  background: rgba(255, 255, 255, .75);
  border: 2px solid rgba(17, 24, 39, .25);
  border-radius: 5px;
  box-shadow: inset 0 -8px 0 rgba(17, 24, 39, .08);
}

.large-art .blade {
  height: 48px;
  bottom: 24px;
}

.equipment-art .body,
.large-art .body {
  position: absolute;
  right: 30px;
  bottom: 24px;
  width: 52px;
  height: 36px;
  background: #111827;
  border-radius: 12px 12px 8px 8px;
  box-shadow: inset 0 0 0 8px rgba(255, 255, 255, .13);
}

.large-art .body {
  right: 80px;
  bottom: 46px;
  width: 120px;
  height: 70px;
}

.equipment-art .handle,
.large-art .handle {
  position: absolute;
  right: 6px;
  bottom: 36px;
  width: 52px;
  height: 12px;
  background: #111827;
  border-radius: 999px;
  transform: rotate(-24deg);
}

.large-art .handle {
  right: 18px;
  bottom: 72px;
  width: 116px;
  height: 20px;
}

.large-art .battery {
  position: absolute;
  right: 86px;
  bottom: 18px;
  width: 72px;
  height: 34px;
  background: #111827;
  border-radius: 8px;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0;
  min-width: 0;
}

.card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;
}

.card-meta span {
  color: var(--color-text-muted);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-meta strong {
  color: var(--color-primary);
  font-size: 11px;
  flex-shrink: 0;
}

.card-body h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.quick-rating,
.one-click-review {
  display: flex;
  align-items: center;
  gap: 2px;
}

.quick-rating button,
.one-click-review button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #CBD5E1;
  background: transparent;
  border: 0;
  border-radius: 4px;
  font: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.quick-rating button.filled,
.one-click-review button.filled {
  color: #B45309;
}

.quick-rating button.own,
.one-click-review button.own {
  color: var(--color-primary);
}

.quick-rating button {
  width: 18px;
  height: 18px;
}

.quick-rating button:hover,
.one-click-review button:hover {
  background: rgba(180, 83, 9, .1);
}

.quick-rating button:disabled,
.one-click-review button:disabled {
  cursor: not-allowed;
}

.equipment-detail-shell {
  display: block;
}

.detail-panel {
  max-width: 980px;
  margin: 0 auto;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  margin-bottom: 14px;
  color: var(--color-text-secondary);
  background: transparent;
  border: 0;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.detail-visual {
  min-height: 260px;
  border-radius: 12px;
  margin-bottom: 14px;
}

.score-board {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 18px;
}

.score-board div,
.score-board em {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  font-style: normal;
}

.score-board span {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 800;
}

.score-board strong {
  color: var(--color-text-primary);
  font-size: 17px;
}

.score-board .score-pill {
  color: #fff;
  background: linear-gradient(135deg, #22c55e, #eab308);
  border-color: transparent;
}

.score-pill span,
.score-pill strong {
  color: #fff;
}

.score-board em {
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  font-weight: 900;
  text-align: center;
}

.spec-section,
.comment-section,
.review-panel {
  padding-top: 16px;
  margin-top: 16px;
  border-top: 1px solid var(--color-border);
}

.spec-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.spec-grid div {
  padding: 10px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.spec-grid span {
  display: block;
  margin-bottom: 4px;
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 800;
}

.spec-grid strong {
  color: var(--color-text-primary);
  font-size: 14px;
}

.comment-card {
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);
}

.comment-card:last-child {
  border-bottom: 0;
}

.comment-card p {
  margin: 0 0 10px;
  color: var(--color-text-primary);
  font-size: 14px;
  line-height: 1.55;
}

.comment-card div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.comment-card span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.comment-card button,
.compare-grid button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--color-text-muted);
  background: transparent;
  border: 0;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.comment-card button.active {
  color: var(--color-primary);
}

.review-controls {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 12px 0;
}

.one-click-review {
  gap: 8px;
  margin-top: 12px;
  margin-bottom: 8px;
}

.one-click-review button {
  gap: 4px;
  min-height: 36px;
  padding: 0 10px;
  background: var(--color-primary-light);
  border: 1px solid rgba(21, 128, 61, .2);
  font-weight: 900;
}

.review-panel textarea {
  resize: vertical;
  margin-bottom: 10px;
}

.detail-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
}

.compare-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.compare-grid article {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 10px;
}

.compare-grid strong {
  color: var(--color-text-primary);
  font-size: 14px;
}

.compare-grid span {
  color: var(--color-text-muted);
  font-size: 13px;
}

.compare-grid em {
  color: var(--color-primary);
  font-size: 18px;
  font-style: normal;
  font-weight: 900;
}

@media (max-width: 980px) {
  .stats-row,
  .compare-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .equipment-hero,
  .panel-head,
  .approval-item {
    align-items: stretch;
    flex-direction: column;
  }

  .form-grid,
  .form-grid.specs,
  .spec-grid,
  .review-controls,
  .score-board,
  .stats-row,
  .compare-grid {
    grid-template-columns: 1fr;
  }

  .equipment-list {
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
    gap: 12px;
  }

  .primary-action,
  .secondary-action {
    width: 100%;
  }

  .submit-row,
  .approval-actions,
  .detail-actions {
    flex-direction: column;
  }
}
</style>
