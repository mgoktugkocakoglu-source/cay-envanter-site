<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';
import AppSelect from '@/components/ui/AppSelect.vue';
import SocialBusinessLayout from '@/layouts/SocialBusinessLayout.vue';

const router = useRouter();
const authStore = useAuthStore();

// ═══════ JOB TYPE DEFINITIONS ═══════
interface JobTypeConfig {
  value: string;
  label: string;
  unit: string;
  suggested: number;
  hasRateChoice?: boolean;
  rateOptions?: { value: string; label: string; unit: string; suggested: number }[];
  hasAdditionalWork?: boolean;
}

const jobTypes: JobTypeConfig[] = [
  {
    value: 'yabani_ot_temizligi',
    label: 'Çayda Yabani Ot Temizliği',
    unit: 'TL/Gün',
    suggested: 3000,
    hasAdditionalWork: true,
  },
  { value: 'arazi_temizligi', label: 'Arazi Temizliği', unit: 'TL/Gün', suggested: 3000 },
  { value: 'cay_budama', label: 'Çay Budama', unit: 'TL/m²', suggested: 150 },
  { value: 'gubre_atma', label: 'Çay Gübresi Atma', unit: 'TL/Ton', suggested: 0 },
  { value: 'gubre_tasima', label: 'Çay Gübresi Taşıma', unit: 'TL/Ton', suggested: 0 },
  {
    value: 'arazi_duzenleme',
    label: 'Arazi Düzenleme İşçiliği',
    unit: 'TL/Gün',
    suggested: 0,
  },
  { value: 'tohum_ekimi', label: 'Çay Tohum Ekimi', unit: 'TL/Gün', suggested: 4000 },
];

const jobTypeOptions = jobTypes.map(jt => ({ value: jt.value, label: jt.label }));
type PruningAmount = '1-2' | '3-4';
type PruningOffer = {
  pruningAmount: PruningAmount;
  jobFee: number | null;
};
const terrainOptions = [
  { value: 'duz', label: 'Düz' },
  { value: 'egimli', label: 'Eğimli' },
];
const landArrangementOptions = [
  { value: 'cay_seti_duzenleme', label: 'Çay seti düzenleme', unit: 'TL/Gün' },
  { value: 'arazi_yol_duzenleme', label: 'Arazi yol düzenleme', unit: 'TL/Gün' },
  { value: 'cay_fidesi_dikimi', label: 'Çay fidesi dikimi', unit: 'TL/Adet' },
];

// ═══════ FORM STATE ═══════
const location = ref('');
const selectedJobType = ref('');
const rateChoice = ref('');
const jobFee = ref<number | null>(null);
const pruningOffers = ref<PruningOffer[]>([
  { pruningAmount: '1-2', jobFee: null },
]);
const fertilizerTerrainType = ref('');
const fertilizerExtraWork = ref('');
const landArrangementDetail = ref('');
const wantsAdditionalWork = ref('');
const additionalWorkFee = ref<number | null>(null);
const foodTransportService = ref('');
const transportCost = ref<number | null>(null);
const mealCost = ref<number | null>(null);

const isSubmitting = ref(false);
const isSubmitted = ref(false);
const formError = ref<string | null>(null);

// ═══════ COMPUTED ═══════
const currentJobType = computed(() => jobTypes.find(jt => jt.value === selectedJobType.value));
const isTeaPruning = computed(() => selectedJobType.value === 'cay_budama');
const isFertilizerWork = computed(() => selectedJobType.value === 'gubre_atma' || selectedJobType.value === 'gubre_tasima');
const isLandArrangement = computed(() => selectedJobType.value === 'arazi_duzenleme');
const completePruningOffers = computed(() =>
  pruningOffers.value.filter(offer => offer.jobFee !== null && offer.jobFee > 0)
);
const selectedLandArrangement = computed(() =>
  landArrangementOptions.find(option => option.value === landArrangementDetail.value)
);
const fertilizerExtraWorkOptions = computed(() => [
  {
    value: selectedJobType.value === 'gubre_atma' ? 'gubre_tasima' : 'gubre_atma',
    label: selectedJobType.value === 'gubre_atma' ? 'Çay Gübresi Taşıma' : 'Çay Gübresi Atma',
  },
  { value: 'istemiyorum', label: 'İstemiyorum' },
]);

const currentUnit = computed(() => {
  const jt = currentJobType.value;
  if (!jt) return '';
  if (isLandArrangement.value && selectedLandArrangement.value) return selectedLandArrangement.value.unit;
  if (jt.hasRateChoice && rateChoice.value) {
    return jt.rateOptions?.find(r => r.value === rateChoice.value)?.unit || jt.unit;
  }
  return jt.unit;
});

const currentSuggested = computed(() => {
  const jt = currentJobType.value;
  if (!jt) return 0;
  if (jt.hasRateChoice && rateChoice.value) {
    return jt.rateOptions?.find(r => r.value === rateChoice.value)?.suggested || jt.suggested;
  }
  return jt.suggested;
});

const additionalWorkOptions = [
  { value: 'evet', label: 'Evet, İlave İş de İstiyorum' },
  { value: 'hayir', label: 'Hayır' },
];

const foodTransportOptions = [
  { value: 'evet_saglarim', label: 'Evet Sağlarım' },
  { value: 'karsi_taraf_saglasin', label: 'Karşı Taraf Sağlasın' },
];

// ═══════ WIZARD ═══════
const activeStep = ref(1);
const TOTAL_STEPS = 3;

type SelectValue = string | number | (string | number)[] | null;

function isStepComplete(s: number): boolean {
  switch (s) {
    case 1: return location.value.trim() !== '';
    case 2: {
      if (!selectedJobType.value) return false;
      const jt = currentJobType.value;
      if (jt?.hasRateChoice && !rateChoice.value) return false;
      if (isTeaPruning.value) {
        if (completePruningOffers.value.length < 1) return false;
        if (!pruningOffers.value.every(isPruningOfferComplete)) return false;
      } else if (isFertilizerWork.value) {
        if (!fertilizerTerrainType.value || !fertilizerExtraWork.value) return false;
        if (!jobFee.value || jobFee.value <= 0) return false;
      } else if (isLandArrangement.value) {
        if (!landArrangementDetail.value) return false;
        if (!jobFee.value || jobFee.value <= 0) return false;
      } else if (!jobFee.value || jobFee.value <= 0) return false;
      if (jt?.hasAdditionalWork && !wantsAdditionalWork.value) return false;
      if (wantsAdditionalWork.value === 'evet' && (!additionalWorkFee.value || additionalWorkFee.value <= 0)) return false;
      return true;
    }
    case 3: return foodTransportService.value !== '';
    default: return false;
  }
}

function stepLabel(s: number): string {
  switch (s) {
    case 1: return 'Konum';
    case 2: return 'İş Türü';
    case 3: return 'Yemek/Ulaşım';
    default: return '';
  }
}

function stepValue(s: number): string {
  switch (s) {
    case 1: return location.value.trim();
    case 2: {
      const jt = currentJobType.value;
      if (!jt) return '';
      if (isTeaPruning.value) {
        return completePruningOffers.value.map(formatPruningOffer).join(' / ');
      }
      if (!jobFee.value) return '';
      if (isFertilizerWork.value) {
        const terrain = terrainOptions.find(o => o.value === fertilizerTerrainType.value)?.label || '';
        return `${jt.label} · ${terrain} · ${jobFee.value.toLocaleString('tr-TR')} ${currentUnit.value}`;
      }
      if (isLandArrangement.value) {
        return `${selectedLandArrangement.value?.label || jt.label} · ${jobFee.value.toLocaleString('tr-TR')} ${currentUnit.value}`;
      }
      return `${jt.label} · ${jobFee.value.toLocaleString('tr-TR')} ${currentUnit.value}`;
    }
    case 3: return foodTransportOptions.find(o => o.value === foodTransportService.value)?.label || '';
    default: return '';
  }
}

function nextStep() {
  if (activeStep.value < TOTAL_STEPS && isStepComplete(activeStep.value)) {
    activeStep.value++;
  }
}

function goToStep(s: number) {
  if (s < activeStep.value && s >= 1) activeStep.value = s;
}

function prevStep() {
  if (activeStep.value > 1) goToStep(activeStep.value - 1);
}

const completedSteps = computed(() => {
  const steps: number[] = [];
  for (let i = 1; i < activeStep.value; i++) steps.push(i);
  return steps;
});

// ═══════ SELECT HANDLERS ═══════
function handleJobTypeChange(value: SelectValue) {
  const v = Array.isArray(value) ? value[0] : value;
  selectedJobType.value = v ? String(v) : '';
  rateChoice.value = '';
  jobFee.value = null;
  pruningOffers.value = [{ pruningAmount: '1-2', jobFee: null }];
  fertilizerTerrainType.value = '';
  fertilizerExtraWork.value = '';
  landArrangementDetail.value = '';
  wantsAdditionalWork.value = '';
  additionalWorkFee.value = null;
  const jt = jobTypes.find(j => j.value === v);
  if (jt && !jt.hasRateChoice && jt.value !== 'cay_budama' && jt.value !== 'gubre_atma' && jt.value !== 'gubre_tasima' && jt.value !== 'arazi_duzenleme') {
    jobFee.value = jt.suggested;
  }
}

function isPruningOfferComplete(offer: PruningOffer): boolean {
  return offer.jobFee !== null && offer.jobFee > 0;
}

function formatPruningOffer(offer: PruningOffer): string {
  return `${offer.pruningAmount} budama · ${offer.jobFee?.toLocaleString('tr-TR')} TL/m²`;
}

function addPruningOffer() {
  if (pruningOffers.value.length >= 2) return;
  if (!pruningOffers.value.every(isPruningOfferComplete)) return;
  pruningOffers.value.push({ pruningAmount: '3-4', jobFee: null });
}

function removePruningOffer(index: number) {
  if (pruningOffers.value.length === 1) return;
  pruningOffers.value.splice(index, 1);
}

function handleRateChoiceChange(value: SelectValue) {
  const v = Array.isArray(value) ? value[0] : value;
  rateChoice.value = v ? String(v) : '';
  const jt = currentJobType.value;
  if (jt?.hasRateChoice && v) {
    const opt = jt.rateOptions?.find(r => r.value === v);
    if (opt) jobFee.value = opt.suggested;
  }
}

function handleFertilizerTerrainChange(value: SelectValue) {
  const v = Array.isArray(value) ? value[0] : value;
  fertilizerTerrainType.value = v ? String(v) : '';
}

function handleFertilizerExtraWorkChange(value: SelectValue) {
  const v = Array.isArray(value) ? value[0] : value;
  fertilizerExtraWork.value = v ? String(v) : '';
}

function handleLandArrangementDetailChange(value: SelectValue) {
  const v = Array.isArray(value) ? value[0] : value;
  landArrangementDetail.value = v ? String(v) : '';
  jobFee.value = null;
}

function handleAdditionalWorkChange(value: SelectValue) {
  const v = Array.isArray(value) ? value[0] : value;
  wantsAdditionalWork.value = v ? String(v) : '';
  if (v === 'evet') {
    additionalWorkFee.value = 1500;
  } else {
    additionalWorkFee.value = null;
  }
}

function handleFoodTransportChange(value: SelectValue) {
  const v = Array.isArray(value) ? value[0] : value;
  foodTransportService.value = v ? String(v) : '';
  if (v !== 'karsi_taraf_saglasin') {
    transportCost.value = null;
    mealCost.value = null;
  }
}

// ═══════ SUBMISSION ═══════
async function handleSubmit() {
  formError.value = null;
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    if (!isStepComplete(i)) {
      formError.value = `Lütfen tüm zorunlu alanları doldurun (Adım ${i}: ${stepLabel(i)})`;
      return;
    }
  }
  isSubmitting.value = true;
  try {
    const metadata = {
      jobType: selectedJobType.value,
      jobTypeLabel: currentJobType.value?.label,
      rateChoice: rateChoice.value || null,
      jobFee: isTeaPruning.value ? completePruningOffers.value[0]?.jobFee : jobFee.value,
      feeUnit: currentUnit.value,
      pruningOffers: isTeaPruning.value ? completePruningOffers.value : undefined,
      fertilizerTerrainType: isFertilizerWork.value ? fertilizerTerrainType.value : undefined,
      fertilizerExtraWork: isFertilizerWork.value ? fertilizerExtraWork.value : undefined,
      landArrangementDetail: isLandArrangement.value ? landArrangementDetail.value : undefined,
      landArrangementDetailLabel: isLandArrangement.value ? selectedLandArrangement.value?.label : undefined,
      hasAdditionalWork: wantsAdditionalWork.value === 'evet',
      additionalWorkFee: wantsAdditionalWork.value === 'evet' ? additionalWorkFee.value : null,
      foodTransportService: foodTransportService.value,
      transportCost: foodTransportService.value === 'karsi_taraf_saglasin' ? transportCost.value : null,
      mealCost: foodTransportService.value === 'karsi_taraf_saglasin' ? mealCost.value : null,
      fullName: authStore.user?.fullName || '',
      phone: authStore.user?.phone || '',
    };

    const payload = {
      type: 'job',
      category: 'daily-jobs',
      location: location.value.trim(),
      metadata,
    };

    console.log('Submitting daily jobs job listing:', payload);
    await api.createJobListing(payload);
    isSubmitted.value = true;
  } catch {
    formError.value = 'Bir hata oluştu. Lütfen tekrar deneyin.';
  } finally {
    isSubmitting.value = false;
  }
}

function goBack() { router.back(); }
function goToListings() { router.push('/social/job-listings'); }
</script>

<template>
  <SocialBusinessLayout>
    <div class="create-listing-page">
      <!-- ═══ SUCCESS ═══ -->
      <div v-if="isSubmitted" class="success-state">
        <div class="success-card">
          <div class="success-icon">✅</div>
          <h2>İş İlanı Başarıyla Oluşturuldu!</h2>
          <p>Günlük işler iş ilanınız yayınlandı.</p>
          <div class="preview-card">
            <div class="preview-header">
              <div class="preview-avatar">{{ (authStore.user?.fullName || 'K')[0] }}</div>
              <div class="preview-user-info">
                <span class="preview-name">{{ authStore.user?.fullName }}</span>
                <span class="preview-phone">📞 {{ authStore.user?.phone }}</span>
              </div>
              <span class="preview-badge">🔨 Günlük İşler İş İlanı</span>
            </div>
            <div class="preview-details">
              <div class="preview-detail"><span class="preview-detail-label">Konum</span><span class="preview-detail-value">{{ location }}</span></div>
              <div class="preview-detail"><span class="preview-detail-label">İş Türü</span><span class="preview-detail-value">{{ currentJobType?.label }}</span></div>
              <div v-if="isTeaPruning" class="preview-detail">
                <span class="preview-detail-label">Budama Teklifleri</span>
                <span class="preview-detail-value highlight">{{ completePruningOffers.map(formatPruningOffer).join(' / ') }}</span>
              </div>
              <div v-else-if="isFertilizerWork" class="preview-detail">
                <span class="preview-detail-label">Gübre İşi</span>
                <span class="preview-detail-value highlight">
                  {{ terrainOptions.find(o => o.value === fertilizerTerrainType)?.label }} ·
                  {{ fertilizerExtraWorkOptions.find(o => o.value === fertilizerExtraWork)?.label }} ·
                  {{ jobFee?.toLocaleString('tr-TR') }} {{ currentUnit }}
                </span>
              </div>
              <div v-else-if="isLandArrangement" class="preview-detail">
                <span class="preview-detail-label">İş Detayı</span>
                <span class="preview-detail-value highlight">{{ selectedLandArrangement?.label }} · {{ jobFee?.toLocaleString('tr-TR') }} {{ currentUnit }}</span>
              </div>
              <div v-else class="preview-detail"><span class="preview-detail-label">Ücret Teklifi</span><span class="preview-detail-value highlight">{{ jobFee?.toLocaleString('tr-TR') }} {{ currentUnit }}</span></div>
              <div v-if="wantsAdditionalWork === 'evet'" class="preview-detail">
                <span class="preview-detail-label">İlave İş</span>
                <span class="preview-detail-value">El ile Çay Üzeri Temizlik · {{ additionalWorkFee?.toLocaleString('tr-TR') }} TL/Gün</span>
              </div>
              <div class="preview-detail"><span class="preview-detail-label">Yemek/Ulaşım</span><span class="preview-detail-value">{{ foodTransportOptions.find(o => o.value === foodTransportService)?.label }}</span></div>
              <div v-if="foodTransportService === 'karsi_taraf_saglasin' && (transportCost || mealCost)" class="preview-detail">
                <span class="preview-detail-label">Yol/Yemek Katkısı</span>
                <span class="preview-detail-value">
                  <template v-if="transportCost">+{{ transportCost?.toLocaleString('tr-TR') }} TL/Yol</template>
                  <template v-if="transportCost && mealCost"> · </template>
                  <template v-if="mealCost">+{{ mealCost?.toLocaleString('tr-TR') }} TL/Yemek</template>
                </span>
              </div>
            </div>
          </div>
          <button class="btn-primary-full" @click="goToListings">İlanlara Dön</button>
        </div>
      </div>

      <!-- ═══ FORM ═══ -->
      <template v-else>
        <header class="page-header">
          <button class="btn-back" @click="goBack">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Geri Dön
          </button>
          <div class="header-center">
            <h1>🔨 Günlük İşler İş İlanı</h1>
            <p class="header-sub">Adım {{ activeStep }} / {{ TOTAL_STEPS }}</p>
          </div>
        </header>

        <div class="progress-track">
          <div class="progress-fill" :style="{ width: `${(activeStep / TOTAL_STEPS) * 100}%` }"></div>
        </div>

        <div v-if="completedSteps.length > 0" class="breadcrumb">
          <button v-for="s in completedSteps" :key="s" class="breadcrumb-item" @click="goToStep(s)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span class="breadcrumb-label">{{ stepLabel(s) }}:</span>
            <span class="breadcrumb-value">{{ stepValue(s) }}</span>
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="form-flow">
          <Transition name="wizard" mode="out-in">

            <!-- Step 1: Konum -->
            <div v-if="activeStep === 1" key="step1" class="step-card">
              <div class="step-header">
                <div class="step-badge">1</div>
                <div>
                  <h2 class="step-title">Konum <span class="required">*</span></h2>
                  <p class="step-hint">İşçi aradığınız bölgeyi yazın</p>
                </div>
              </div>
              <input v-model="location" type="text" class="form-input" placeholder="Örn: Rize / Çamlıhemşin" autofocus @keyup.enter="nextStep" />
              <div class="step-actions">
                <div></div>
                <button type="button" class="btn-next" :disabled="!isStepComplete(1)" @click="nextStep">Devam <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
              </div>
            </div>

            <!-- Step 2: İş Türü + Ücret Teklifi -->
            <div v-else-if="activeStep === 2" key="step2" class="step-card">
              <div class="step-header">
                <button type="button" class="btn-step-back" aria-label="Önceki adım" @click="prevStep"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
                <div class="step-badge">2</div>
                <div>
                  <h2 class="step-title">İş Türü ve Ücret Teklifi <span class="required">*</span></h2>
                  <p class="step-hint">Yaptırmak istediğiniz işi ve ücret teklifinizi belirleyin</p>
                </div>
              </div>

              <div class="sub-step">
                <label class="sub-step-label">İş Türü</label>
                <AppSelect :model-value="selectedJobType" :options="jobTypeOptions" placeholder="İş türü seçin" required @update:model-value="handleJobTypeChange" />
                <p v-if="selectedJobType === 'arazi_temizligi'" class="job-type-helper">Diken, odun, taş vb. arazi temizliği işleri.</p>
                <p v-if="isLandArrangement" class="job-type-helper">Çay veya herhangi bir arazi üzerinde çapalama, dikim gibi hizmetleri ifade eder.</p>
              </div>

              <Transition name="fade">
                <div v-if="isLandArrangement" class="sub-step">
                  <label class="sub-step-label">İş Detayı</label>
                  <AppSelect :model-value="landArrangementDetail" :options="landArrangementOptions" placeholder="İş detayı seçin" required @update:model-value="handleLandArrangementDetailChange" />
                </div>
                <div v-else-if="currentJobType?.hasRateChoice" class="sub-step">
                  <label class="sub-step-label">Ücret Türü</label>
                  <AppSelect :model-value="rateChoice" :options="currentJobType.rateOptions!.map(r => ({ value: r.value, label: r.label }))" placeholder="Ücret türü seçin" required @update:model-value="handleRateChoiceChange" />
                </div>
              </Transition>

              <Transition name="fade">
                <div v-if="isTeaPruning" class="sub-step">
                  <p class="job-type-helper">En az 1 budama miktarı için teklif girin. İkinci budama miktarı isteğe bağlıdır.</p>
                  <div
                    v-for="(offer, index) in pruningOffers"
                    :key="offer.pruningAmount"
                    class="pruning-offer-card"
                  >
                    <div class="pruning-offer-header">
                      <strong>Budama Miktarı: {{ offer.pruningAmount }}</strong>
                      <button
                        v-if="pruningOffers.length > 1"
                        type="button"
                        class="btn-remove-offer"
                        @click="removePruningOffer(index)"
                      >
                        Kaldır
                      </button>
                    </div>
                    <label class="sub-step-label">Ücret Teklifi</label>
                    <div class="input-with-unit">
                      <input v-model.number="offer.jobFee" type="number" class="form-input" placeholder="Ücret girin" min="0" />
                      <span class="input-unit">TL/m²</span>
                    </div>
                  </div>
                  <button
                    v-if="pruningOffers.length < 2"
                    type="button"
                    class="btn-add-offer"
                    :disabled="!pruningOffers.every(isPruningOfferComplete)"
                    @click="addPruningOffer"
                  >
                    + 3-4 budama miktarı için teklif ekle
                  </button>
                </div>
                <div v-else-if="isFertilizerWork" class="sub-step">
                  <div class="sub-step">
                    <label class="sub-step-label">Arazi Tipi</label>
                    <AppSelect :model-value="fertilizerTerrainType" :options="terrainOptions" placeholder="Arazi tipi seçin" required @update:model-value="handleFertilizerTerrainChange" />
                  </div>
                  <Transition name="fade">
                    <div v-if="fertilizerTerrainType" class="sub-step">
                      <label class="sub-step-label">Ek İş</label>
                      <AppSelect :model-value="fertilizerExtraWork" :options="fertilizerExtraWorkOptions" placeholder="Ek iş seçin" required @update:model-value="handleFertilizerExtraWorkChange" />
                    </div>
                  </Transition>
                  <Transition name="fade">
                    <div v-if="fertilizerTerrainType && fertilizerExtraWork" class="sub-step">
                      <label class="sub-step-label">Ücret Teklifiniz</label>
                      <div class="input-with-unit">
                        <input v-model.number="jobFee" type="number" class="form-input" placeholder="Ücret girin" min="0" />
                        <span class="input-unit">TL/Ton</span>
                      </div>
                    </div>
                  </Transition>
                </div>
                <div v-else-if="isLandArrangement && landArrangementDetail" class="sub-step">
                  <label class="sub-step-label">Ücret Teklifiniz</label>
                  <div class="input-with-unit">
                    <input v-model.number="jobFee" type="number" class="form-input" placeholder="Ücret girin" min="0" />
                    <span class="input-unit">{{ currentUnit }}</span>
                  </div>
                </div>
                <div v-else-if="selectedJobType && (!currentJobType?.hasRateChoice || rateChoice)" class="sub-step">
                  <label class="sub-step-label">Ücret Teklifiniz</label>
                  <div class="input-with-unit">
                    <input v-model.number="jobFee" type="number" class="form-input" :placeholder="`Örn: ${currentSuggested}`" min="0" />
                    <span class="input-unit">{{ currentUnit }}</span>
                  </div>
                  <div class="suggestion-hint">💡 Önerilen teklif: <strong>{{ currentSuggested.toLocaleString('tr-TR') }} {{ currentUnit }}</strong></div>
                </div>
              </Transition>

              <Transition name="fade">
                <div v-if="currentJobType?.hasAdditionalWork && jobFee && jobFee > 0" class="sub-step">
                  <label class="sub-step-label">İlave İş: El ile Çay Üzeri Temizlik</label>
                  <AppSelect :model-value="wantsAdditionalWork" :options="additionalWorkOptions" placeholder="İlave iş ister misiniz?" required @update:model-value="handleAdditionalWorkChange" />
                  <Transition name="fade">
                    <div v-if="wantsAdditionalWork === 'evet'" class="conditional-fields">
                      <div class="input-with-unit">
                        <input v-model.number="additionalWorkFee" type="number" class="form-input" placeholder="Örn: 1500" min="0" />
                        <span class="input-unit">TL/Gün</span>
                      </div>
                      <div class="suggestion-hint">💡 Önerilen: <strong>1.500 TL/Gün</strong></div>
                    </div>
                  </Transition>
                </div>
              </Transition>

              <div class="step-actions">
                <div></div>
                <button type="button" class="btn-next" :disabled="!isStepComplete(2)" @click="nextStep">Devam <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
              </div>
            </div>

            <!-- Step 3: Yemek/Ulaşım Hizmeti — Final -->
            <div v-else-if="activeStep === 3" key="step3" class="step-card step-card-final">
              <div class="step-header">
                <button type="button" class="btn-step-back" aria-label="Önceki adım" @click="prevStep"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
                <div class="step-badge">3</div>
                <div>
                  <h2 class="step-title">Yemek / Ulaşım Hizmeti <span class="required">*</span></h2>
                  <p class="step-hint">İşçiye yemek ve ulaşım sağlayacak mısınız?</p>
                </div>
              </div>
              <AppSelect :model-value="foodTransportService" :options="foodTransportOptions" placeholder="Seçiniz" required @update:model-value="handleFoodTransportChange" />

              <Transition name="fade">
                <div v-if="foodTransportService === 'karsi_taraf_saglasin'" class="conditional-fields">
                  <p class="conditional-hint">İşçiye yol ve yemek katkısı olarak ek ücret belirleyin (isteğe bağlı)</p>
                  <div class="conditional-row">
                    <div class="input-with-unit compact">
                      <input v-model.number="transportCost" type="number" class="form-input" placeholder="Örn: 300" min="0" />
                      <span class="input-unit">TL/Yol</span>
                    </div>
                    <div class="input-with-unit compact">
                      <input v-model.number="mealCost" type="number" class="form-input" placeholder="Örn: 400" min="0" />
                      <span class="input-unit">TL/Yemek</span>
                    </div>
                  </div>
                </div>
              </Transition>

              <div class="user-preview">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>İlan kartınızda <strong>{{ authStore.user?.fullName }}</strong> ve <strong>{{ authStore.user?.phone }}</strong> bilgileri otomatik eklenecektir.</span>
              </div>

              <div v-if="formError" class="error-banner">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {{ formError }}
              </div>

              <div class="step-actions">
                <button type="button" class="btn-cancel" @click="goBack">İptal</button>
                <button type="submit" class="btn-submit" :disabled="!isStepComplete(3) || isSubmitting">
                  <span v-if="isSubmitting" class="spinner"></span>
                  <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                  {{ isSubmitting ? 'Yayınlanıyor...' : 'İlanı Yayınla' }}
                </button>
              </div>
            </div>

          </Transition>
        </form>
      </template>
    </div>
  </SocialBusinessLayout>
</template>

<style scoped>
.create-listing-page { max-width: 720px; margin: 0 auto; padding: var(--space-4) var(--space-4) var(--space-8); }
.page-header { display: flex; align-items: center; gap: var(--space-4); margin-bottom: var(--space-4); }
.btn-back { display: inline-flex; align-items: center; gap: var(--space-2); background: var(--color-bg-secondary); border: 1px solid var(--color-border); color: var(--color-text-secondary); padding: var(--space-2) var(--space-3); border-radius: var(--radius-lg); font-size: var(--font-size-sm); cursor: pointer; transition: all var(--transition-fast); flex-shrink: 0; }
.btn-back:hover { color: var(--color-text-primary); border-color: var(--color-text-muted); background: var(--color-bg-tertiary); }
.header-center h1 { font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-text-primary); margin-bottom: 2px; }
.header-sub { font-size: var(--font-size-sm); color: var(--color-text-muted); }
.progress-track { height: 4px; background: var(--color-bg-tertiary); border-radius: 2px; margin-bottom: var(--space-5); overflow: hidden; }
.progress-fill { height: 100%; background: #e11d48; border-radius: 2px; transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
.breadcrumb { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-4); }
.breadcrumb-item { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: var(--font-size-xs); background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-full); cursor: pointer; transition: all var(--transition-fast); color: var(--color-text-secondary); }
.breadcrumb-item:hover { border-color: #e11d48; background: rgba(225, 29, 72, 0.06); color: #e11d48; }
.breadcrumb-item svg { color: #e11d48; }
.breadcrumb-label { font-weight: var(--font-weight-medium); }
.breadcrumb-value { color: var(--color-text-primary); font-weight: var(--font-weight-semibold); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.step-card { background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: var(--space-6); box-shadow: var(--shadow-sm); }
.step-header { display: flex; align-items: flex-start; gap: var(--space-3); margin-bottom: var(--space-5); }
.step-badge { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: #e11d48; color: white; border-radius: var(--radius-full); font-weight: var(--font-weight-bold); font-size: var(--font-size-sm); flex-shrink: 0; }
.step-title { font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); margin-bottom: 2px; }
.required { color: var(--color-danger); }
.step-hint { font-size: var(--font-size-sm); color: var(--color-text-muted); }
.btn-step-back { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: var(--color-bg-tertiary); border: 1px solid var(--color-border); border-radius: var(--radius-full); color: var(--color-text-muted); cursor: pointer; transition: all var(--transition-fast); flex-shrink: 0; }
.btn-step-back:hover { color: var(--color-text-primary); border-color: var(--color-text-muted); }
.sub-step { margin-bottom: var(--space-4); }
.sub-step-label { display: block; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); margin-bottom: var(--space-2); }
.job-type-helper { margin: var(--space-2) 0 0; color: var(--color-text-muted); font-size: var(--font-size-xs); line-height: 1.5; }
.pruning-offer-card { padding: var(--space-4); margin-bottom: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-bg-secondary); }
.pruning-offer-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-3); color: var(--color-text-primary); }
.btn-remove-offer, .btn-add-offer { border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-tertiary); color: var(--color-text-secondary); cursor: pointer; font-weight: var(--font-weight-semibold); transition: all var(--transition-fast); }
.btn-remove-offer { padding: 6px 10px; font-size: var(--font-size-xs); }
.btn-add-offer { width: 100%; min-height: 44px; margin-bottom: var(--space-4); }
.btn-remove-offer:hover, .btn-add-offer:hover:not(:disabled) { border-color: #e11d48; color: #e11d48; }
.btn-add-offer:disabled { opacity: 0.5; cursor: not-allowed; }
.form-input { width: 100%; padding: var(--space-3) var(--space-4); background: var(--color-bg-tertiary); border: 1px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-text-primary); font-size: var(--font-size-base); font-family: var(--font-family); transition: all var(--transition-fast); min-height: 48px; }
.form-input:focus { outline: none; border-color: #e11d48; box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.15); }
.form-input::placeholder { color: var(--color-text-muted); }
.form-input[type="number"]::-webkit-outer-spin-button, .form-input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.form-input[type="number"] { -moz-appearance: textfield; appearance: textfield; }
.input-with-unit { position: relative; }
.input-with-unit .form-input { padding-right: 80px; }
.input-unit { position: absolute; right: var(--space-3); top: 50%; transform: translateY(-50%); font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: #e11d48; background: rgba(225, 29, 72, 0.08); padding: 2px 8px; border-radius: var(--radius-sm); pointer-events: none; }
.input-with-unit.compact .form-input { padding-right: 80px; }
.suggestion-hint { margin-top: var(--space-2); padding: var(--space-2) var(--space-3); font-size: var(--font-size-xs); color: var(--color-text-muted); background: rgba(225, 29, 72, 0.04); border-radius: var(--radius-md); border: 1px solid rgba(225, 29, 72, 0.1); }
.suggestion-hint strong { color: #e11d48; }
.conditional-fields { margin-top: var(--space-3); padding: var(--space-4); background: var(--color-bg-tertiary); border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
.conditional-hint { font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: var(--space-3); }
.conditional-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.user-preview { display: flex; align-items: center; gap: var(--space-3); margin-top: var(--space-4); padding: var(--space-3) var(--space-4); background: rgba(225, 29, 72, 0.05); border: 1px solid rgba(225, 29, 72, 0.15); border-radius: var(--radius-md); font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: var(--line-height-normal); }
.user-preview svg { color: #e11d48; flex-shrink: 0; }
.user-preview strong { color: var(--color-text-primary); }
.step-actions { display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-5); gap: var(--space-3); }
.btn-next { display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-5); background: #e11d48; color: white; border: none; border-radius: var(--radius-md); font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); cursor: pointer; transition: all var(--transition-fast); }
.btn-next:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
.btn-next:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-cancel { padding: var(--space-3) var(--space-5); background: var(--color-bg-tertiary); color: var(--color-text-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-md); font-size: var(--font-size-base); cursor: pointer; transition: all var(--transition-fast); }
.btn-cancel:hover { color: var(--color-text-primary); background: var(--color-bg-secondary); }
.btn-submit { display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-6); background: #e11d48; color: white; border: none; border-radius: var(--radius-md); font-size: var(--font-size-base); font-weight: var(--font-weight-bold); cursor: pointer; transition: all var(--transition-fast); }
.btn-submit:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
.btn-submit:disabled { opacity: 0.4; cursor: not-allowed; }
.error-banner { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: var(--radius-md); color: var(--color-danger); font-size: var(--font-size-sm); margin-top: var(--space-4); }
.spinner { width: 18px; height: 18px; border: 2px solid rgba(255, 255, 255, 0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.wizard-enter-active, .wizard-leave-active { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.wizard-enter-from { opacity: 0; transform: translateX(20px); }
.wizard-leave-to { opacity: 0; transform: translateX(-20px); }
.fade-enter-active, .fade-leave-active { transition: all 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; max-height: 0; margin-top: 0; padding: 0; overflow: hidden; }
.fade-enter-to { max-height: 400px; }
.success-state { display: flex; justify-content: center; padding: var(--space-8) 0; }
.success-card { background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: var(--space-8) var(--space-6); text-align: center; max-width: 520px; width: 100%; box-shadow: var(--shadow-lg); }
.success-icon { font-size: 56px; margin-bottom: var(--space-4); }
.success-card h2 { font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-text-primary); margin-bottom: var(--space-2); }
.success-card > p { font-size: var(--font-size-base); color: var(--color-text-muted); margin-bottom: var(--space-6); }
.preview-card { background: var(--color-bg-tertiary); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-5); margin-bottom: var(--space-6); text-align: left; }
.preview-header { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4); padding-bottom: var(--space-4); border-bottom: 1px solid var(--color-border); }
.preview-avatar { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: #e11d48; color: white; border-radius: var(--radius-full); font-weight: var(--font-weight-bold); font-size: var(--font-size-base); flex-shrink: 0; }
.preview-user-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.preview-name { font-weight: var(--font-weight-semibold); color: var(--color-text-primary); font-size: var(--font-size-base); }
.preview-phone { font-size: var(--font-size-sm); color: var(--color-text-muted); }
.preview-badge { font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: #e11d48; background: rgba(225, 29, 72, 0.08); padding: var(--space-1) var(--space-2); border-radius: var(--radius-full); flex-shrink: 0; }
.preview-details { display: flex; flex-direction: column; gap: var(--space-2); }
.preview-detail { display: flex; justify-content: space-between; align-items: center; padding: var(--space-2) 0; }
.preview-detail:not(:last-child) { border-bottom: 1px solid rgba(255, 255, 255, 0.04); }
.preview-detail-label { font-size: var(--font-size-sm); color: var(--color-text-muted); }
.preview-detail-value { font-size: var(--font-size-sm); color: var(--color-text-primary); font-weight: var(--font-weight-medium); }
.preview-detail-value.highlight { color: #e11d48; font-weight: var(--font-weight-bold); }
.btn-primary-full { width: 100%; padding: var(--space-3) var(--space-6); background: #e11d48; color: white; border: none; border-radius: var(--radius-md); font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); cursor: pointer; transition: all var(--transition-fast); }
.btn-primary-full:hover { filter: brightness(1.1); transform: translateY(-1px); }
@media (max-width: 768px) { .step-card { padding: var(--space-4); } .conditional-row { grid-template-columns: 1fr; } .breadcrumb-value { max-width: 100px; } }
</style>
