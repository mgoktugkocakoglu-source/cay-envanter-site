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
  { value: 'gubre_tasima', label: 'Çay Gübresi Taşıma/Atma', unit: 'TL/kg', suggested: 5 },
  {
    value: 'arazi_duzenleme',
    label: 'Arazi Düzenleme İşçiliği',
    unit: 'TL/Gün',
    suggested: 6000,
    hasRateChoice: true,
    rateOptions: [
      { value: 'gunluk', label: 'Günlük Ücret', unit: 'TL/Gün', suggested: 6000 },
      { value: 'metrekare', label: 'Metrekare Ücreti', unit: 'TL/m²', suggested: 75 },
    ],
  },
  { value: 'tohum_ekimi', label: 'Çay Tohum Ekimi', unit: 'TL/Gün', suggested: 4000 },
];

const jobTypeOptions = jobTypes.map(jt => ({ value: jt.value, label: jt.label }));

// ═══════ FORM STATE ═══════
const age = ref<number | null>(null);
const location = ref('');
const selectedJobType = ref('');
const rateChoice = ref('');
const jobFee = ref<number | null>(null);
const wantsAdditionalWork = ref('');
const additionalWorkFee = ref<number | null>(null);
const foodTransportRequest = ref('');
const transportCost = ref<number | null>(null);
const mealCost = ref<number | null>(null);

const isSubmitting = ref(false);
const isSubmitted = ref(false);
const formError = ref<string | null>(null);

// ═══════ COMPUTED ═══════
const currentJobType = computed(() => jobTypes.find(jt => jt.value === selectedJobType.value));

const currentUnit = computed(() => {
  const jt = currentJobType.value;
  if (!jt) return '';
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
  { value: 'evet', label: 'Evet, İlave İş de Yaparım' },
  { value: 'hayir', label: 'Hayır' },
];

const foodTransportOptions = [
  { value: 'evet_isterim', label: 'Evet İsterim' },
  { value: 'kendim_karsilayabilirim', label: 'Kendim Karşılayabilirim' },
];

// ═══════ WIZARD ═══════
const activeStep = ref(1);
const TOTAL_STEPS = 4;

type SelectValue = string | number | (string | number)[] | null;

function isStepComplete(s: number): boolean {
  switch (s) {
    case 1: return age.value !== null && age.value > 0;
    case 2: return location.value.trim() !== '';
    case 3: {
      if (!selectedJobType.value) return false;
      const jt = currentJobType.value;
      if (jt?.hasRateChoice && !rateChoice.value) return false;
      if (!jobFee.value || jobFee.value <= 0) return false;
      if (jt?.hasAdditionalWork && !wantsAdditionalWork.value) return false;
      if (wantsAdditionalWork.value === 'evet' && (!additionalWorkFee.value || additionalWorkFee.value <= 0)) return false;
      return true;
    }
    case 4: return foodTransportRequest.value !== '';
    default: return false;
  }
}

function stepLabel(s: number): string {
  switch (s) {
    case 1: return 'Yaş';
    case 2: return 'Konum';
    case 3: return 'İş Türü';
    case 4: return 'Yemek/Ulaşım';
    default: return '';
  }
}

function stepValue(s: number): string {
  switch (s) {
    case 1: return age.value ? `${age.value} yaş` : '';
    case 2: return location.value.trim();
    case 3: {
      const jt = currentJobType.value;
      if (!jt || !jobFee.value) return '';
      return `${jt.label} · ${jobFee.value.toLocaleString('tr-TR')} ${currentUnit.value}`;
    }
    case 4: return foodTransportOptions.find(o => o.value === foodTransportRequest.value)?.label || '';
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
  wantsAdditionalWork.value = '';
  additionalWorkFee.value = null;
  const jt = jobTypes.find(j => j.value === v);
  if (jt && !jt.hasRateChoice) {
    jobFee.value = jt.suggested;
  }
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
  foodTransportRequest.value = v ? String(v) : '';
  if (v !== 'kendim_karsilayabilirim') {
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
      age: age.value,
      jobType: selectedJobType.value,
      jobTypeLabel: currentJobType.value?.label,
      rateChoice: rateChoice.value || null,
      jobFee: jobFee.value,
      feeUnit: currentUnit.value,
      hasAdditionalWork: wantsAdditionalWork.value === 'evet',
      additionalWorkFee: wantsAdditionalWork.value === 'evet' ? additionalWorkFee.value : null,
      foodTransportRequest: foodTransportRequest.value,
      transportCost: foodTransportRequest.value === 'kendim_karsilayabilirim' ? transportCost.value : null,
      mealCost: foodTransportRequest.value === 'kendim_karsilayabilirim' ? mealCost.value : null,
      fullName: authStore.user?.fullName || '',
      phone: authStore.user?.phone || '',
    };

    const payload = {
      type: 'worker',
      category: 'daily-jobs',
      location: location.value.trim(),
      metadata,
    };

    console.log('Submitting daily jobs worker listing:', payload);
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
          <h2>İlan Başarıyla Oluşturuldu!</h2>
          <p>Günlük işler işçi ilanınız yayınlandı.</p>
          <div class="preview-card">
            <div class="preview-header">
              <div class="preview-avatar">{{ (authStore.user?.fullName || 'K')[0] }}</div>
              <div class="preview-user-info">
                <span class="preview-name">{{ authStore.user?.fullName }}</span>
                <span class="preview-phone">📞 {{ authStore.user?.phone }}</span>
              </div>
              <span class="preview-badge">🔨 Günlük İşler</span>
            </div>
            <div class="preview-details">
              <div class="preview-detail"><span class="preview-detail-label">Yaş</span><span class="preview-detail-value">{{ age }}</span></div>
              <div class="preview-detail"><span class="preview-detail-label">Konum</span><span class="preview-detail-value">{{ location }}</span></div>
              <div class="preview-detail"><span class="preview-detail-label">İş Türü</span><span class="preview-detail-value">{{ currentJobType?.label }}</span></div>
              <div class="preview-detail"><span class="preview-detail-label">Ücret</span><span class="preview-detail-value highlight">{{ jobFee?.toLocaleString('tr-TR') }} {{ currentUnit }}</span></div>
              <div v-if="wantsAdditionalWork === 'evet'" class="preview-detail">
                <span class="preview-detail-label">İlave İş</span>
                <span class="preview-detail-value">El ile Çay Üzeri Temizlik · {{ additionalWorkFee?.toLocaleString('tr-TR') }} TL/Gün</span>
              </div>
              <div v-if="foodTransportRequest === 'kendim_karsilayabilirim' && (transportCost || mealCost)" class="preview-detail">
                <span class="preview-detail-label">Yol/Yemek</span>
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
            <h1>🔨 Günlük İşler İşçi İlanı</h1>
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

            <!-- Step 1: Yaş -->
            <div v-if="activeStep === 1" key="step1" class="step-card">
              <div class="step-header">
                <div class="step-badge">1</div>
                <div>
                  <h2 class="step-title">Yaş <span class="required">*</span></h2>
                  <p class="step-hint">Yaşınızı girin</p>
                </div>
              </div>
              <input v-model.number="age" type="number" class="form-input" placeholder="Örn: 35" min="16" max="80" autofocus @keyup.enter="nextStep" />
              <div class="step-actions">
                <div></div>
                <button type="button" class="btn-next" :disabled="!isStepComplete(1)" @click="nextStep">Devam <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
              </div>
            </div>

            <!-- Step 2: Konum -->
            <div v-else-if="activeStep === 2" key="step2" class="step-card">
              <div class="step-header">
                <button type="button" class="btn-step-back" @click="prevStep"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
                <div class="step-badge">2</div>
                <div>
                  <h2 class="step-title">Konum <span class="required">*</span></h2>
                  <p class="step-hint">Çalışmak istediğiniz bölgeyi yazın</p>
                </div>
              </div>
              <input v-model="location" type="text" class="form-input" placeholder="Örn: Rize / Çamlıhemşin" autofocus @keyup.enter="nextStep" />
              <div class="step-actions">
                <div></div>
                <button type="button" class="btn-next" :disabled="!isStepComplete(2)" @click="nextStep">Devam <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
              </div>
            </div>

            <!-- Step 3: İş Türü + Ücret -->
            <div v-else-if="activeStep === 3" key="step3" class="step-card">
              <div class="step-header">
                <button type="button" class="btn-step-back" @click="prevStep"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
                <div class="step-badge">3</div>
                <div>
                  <h2 class="step-title">İş Türü ve Ücret <span class="required">*</span></h2>
                  <p class="step-hint">Yapmak istediğiniz işi ve ücretinizi belirleyin</p>
                </div>
              </div>

              <div class="sub-step">
                <label class="sub-step-label">İş Türü</label>
                <AppSelect :model-value="selectedJobType" :options="jobTypeOptions" placeholder="İş türü seçin" required @update:model-value="handleJobTypeChange" />
              </div>

              <!-- Rate choice for Arazi Düzenleme -->
              <Transition name="fade">
                <div v-if="currentJobType?.hasRateChoice" class="sub-step">
                  <label class="sub-step-label">Ücret Türü</label>
                  <AppSelect :model-value="rateChoice" :options="currentJobType.rateOptions!.map(r => ({ value: r.value, label: r.label }))" placeholder="Ücret türü seçin" required @update:model-value="handleRateChoiceChange" />
                </div>
              </Transition>

              <!-- Fee input -->
              <Transition name="fade">
                <div v-if="selectedJobType && (!currentJobType?.hasRateChoice || rateChoice)" class="sub-step">
                  <label class="sub-step-label">Talep Ettiğiniz Ücret</label>
                  <div class="input-with-unit">
                    <input v-model.number="jobFee" type="number" class="form-input" :placeholder="`Örn: ${currentSuggested}`" min="0" />
                    <span class="input-unit">{{ currentUnit }}</span>
                  </div>
                  <div class="suggestion-hint">💡 Önerilen fiyat: <strong>{{ currentSuggested.toLocaleString('tr-TR') }} {{ currentUnit }}</strong></div>
                </div>
              </Transition>

              <!-- Additional work for Yabani Ot Temizliği -->
              <Transition name="fade">
                <div v-if="currentJobType?.hasAdditionalWork && jobFee && jobFee > 0" class="sub-step">
                  <label class="sub-step-label">İlave İş: El ile Çay Üzeri Temizlik</label>
                  <AppSelect :model-value="wantsAdditionalWork" :options="additionalWorkOptions" placeholder="İlave iş yapmak ister misiniz?" required @update:model-value="handleAdditionalWorkChange" />
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
                <button type="button" class="btn-next" :disabled="!isStepComplete(3)" @click="nextStep">Devam <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
              </div>
            </div>

            <!-- Step 4: Yemek/Ulaşım Talebi — Final -->
            <div v-else-if="activeStep === 4" key="step4" class="step-card step-card-final">
              <div class="step-header">
                <button type="button" class="btn-step-back" @click="prevStep"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
                <div class="step-badge">4</div>
                <div>
                  <h2 class="step-title">Yemek / Ulaşım Talebi <span class="required">*</span></h2>
                  <p class="step-hint">Yemek ve ulaşım konusundaki tercihiniz nedir?</p>
                </div>
              </div>
              <AppSelect :model-value="foodTransportRequest" :options="foodTransportOptions" placeholder="Seçiniz" required @update:model-value="handleFoodTransportChange" />

              <Transition name="fade">
                <div v-if="foodTransportRequest === 'kendim_karsilayabilirim'" class="conditional-fields">
                  <p class="conditional-hint">Yol ve yemek masraflarınız için ek ücret belirleyin (isteğe bağlı)</p>
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
                <button type="submit" class="btn-submit" :disabled="!isStepComplete(4) || isSubmitting">
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
.progress-fill { height: 100%; background: #0d9488; border-radius: 2px; transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1); }

.breadcrumb { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-4); }
.breadcrumb-item { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: var(--font-size-xs); background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-full); cursor: pointer; transition: all var(--transition-fast); color: var(--color-text-secondary); }
.breadcrumb-item:hover { border-color: #0d9488; background: rgba(13, 148, 136, 0.06); color: #0d9488; }
.breadcrumb-item svg { color: #0d9488; }
.breadcrumb-label { font-weight: var(--font-weight-medium); }
.breadcrumb-value { color: var(--color-text-primary); font-weight: var(--font-weight-semibold); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.step-card { background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: var(--space-6); box-shadow: var(--shadow-sm); }
.step-header { display: flex; align-items: flex-start; gap: var(--space-3); margin-bottom: var(--space-5); }
.step-badge { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: #0d9488; color: white; border-radius: var(--radius-full); font-weight: var(--font-weight-bold); font-size: var(--font-size-sm); flex-shrink: 0; }
.step-title { font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); margin-bottom: 2px; }
.required { color: var(--color-danger); }
.step-hint { font-size: var(--font-size-sm); color: var(--color-text-muted); }
.btn-step-back { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: var(--color-bg-tertiary); border: 1px solid var(--color-border); border-radius: var(--radius-full); color: var(--color-text-muted); cursor: pointer; transition: all var(--transition-fast); flex-shrink: 0; }
.btn-step-back:hover { color: var(--color-text-primary); border-color: var(--color-text-muted); }

.sub-step { margin-bottom: var(--space-4); }
.sub-step-label { display: block; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); margin-bottom: var(--space-2); }

.form-input { width: 100%; padding: var(--space-3) var(--space-4); background: var(--color-bg-tertiary); border: 1px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-text-primary); font-size: var(--font-size-base); font-family: var(--font-family); transition: all var(--transition-fast); min-height: 48px; }
.form-input:focus { outline: none; border-color: #0d9488; box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15); }
.form-input::placeholder { color: var(--color-text-muted); }
.form-input[type="number"]::-webkit-outer-spin-button, .form-input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.form-input[type="number"] { -moz-appearance: textfield; appearance: textfield; }

.input-with-unit { position: relative; }
.input-with-unit .form-input { padding-right: 80px; }
.input-unit { position: absolute; right: var(--space-3); top: 50%; transform: translateY(-50%); font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: #0d9488; background: rgba(13, 148, 136, 0.08); padding: 2px 8px; border-radius: var(--radius-sm); pointer-events: none; }
.input-with-unit.compact .form-input { padding-right: 80px; }
.suggestion-hint { margin-top: var(--space-2); padding: var(--space-2) var(--space-3); font-size: var(--font-size-xs); color: var(--color-text-muted); background: rgba(13, 148, 136, 0.04); border-radius: var(--radius-md); border: 1px solid rgba(13, 148, 136, 0.1); }
.suggestion-hint strong { color: #0d9488; }

.conditional-fields { margin-top: var(--space-3); padding: var(--space-4); background: var(--color-bg-tertiary); border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
.conditional-hint { font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: var(--space-3); }
.conditional-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }

.user-preview { display: flex; align-items: center; gap: var(--space-3); margin-top: var(--space-4); padding: var(--space-3) var(--space-4); background: rgba(13, 148, 136, 0.05); border: 1px solid rgba(13, 148, 136, 0.15); border-radius: var(--radius-md); font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: var(--line-height-normal); }
.user-preview svg { color: #0d9488; flex-shrink: 0; }
.user-preview strong { color: var(--color-text-primary); }

.step-actions { display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-5); gap: var(--space-3); }
.btn-next { display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-5); background: #0d9488; color: white; border: none; border-radius: var(--radius-md); font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); cursor: pointer; transition: all var(--transition-fast); }
.btn-next:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
.btn-next:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-cancel { padding: var(--space-3) var(--space-5); background: var(--color-bg-tertiary); color: var(--color-text-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-md); font-size: var(--font-size-base); cursor: pointer; transition: all var(--transition-fast); }
.btn-cancel:hover { color: var(--color-text-primary); background: var(--color-bg-secondary); }
.btn-submit { display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-6); background: #0d9488; color: white; border: none; border-radius: var(--radius-md); font-size: var(--font-size-base); font-weight: var(--font-weight-bold); cursor: pointer; transition: all var(--transition-fast); }
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
.preview-avatar { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: #0d9488; color: white; border-radius: var(--radius-full); font-weight: var(--font-weight-bold); font-size: var(--font-size-base); flex-shrink: 0; }
.preview-user-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.preview-name { font-weight: var(--font-weight-semibold); color: var(--color-text-primary); font-size: var(--font-size-base); }
.preview-phone { font-size: var(--font-size-sm); color: var(--color-text-muted); }
.preview-badge { font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: #0d9488; background: rgba(13, 148, 136, 0.08); padding: var(--space-1) var(--space-2); border-radius: var(--radius-full); flex-shrink: 0; }
.preview-details { display: flex; flex-direction: column; gap: var(--space-2); }
.preview-detail { display: flex; justify-content: space-between; align-items: center; padding: var(--space-2) 0; }
.preview-detail:not(:last-child) { border-bottom: 1px solid rgba(255, 255, 255, 0.04); }
.preview-detail-label { font-size: var(--font-size-sm); color: var(--color-text-muted); }
.preview-detail-value { font-size: var(--font-size-sm); color: var(--color-text-primary); font-weight: var(--font-weight-medium); }
.preview-detail-value.highlight { color: #0d9488; font-weight: var(--font-weight-bold); }
.btn-primary-full { width: 100%; padding: var(--space-3) var(--space-6); background: #0d9488; color: white; border: none; border-radius: var(--radius-md); font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); cursor: pointer; transition: all var(--transition-fast); }
.btn-primary-full:hover { filter: brightness(1.1); transform: translateY(-1px); }

@media (max-width: 768px) { .step-card { padding: var(--space-4); } .conditional-row { grid-template-columns: 1fr; } .breadcrumb-value { max-width: 100px; } }
</style>
