<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';
import AppSelect from '@/components/ui/AppSelect.vue';
import AppLayout from '@/layouts/AppLayout.vue';

const router = useRouter();
const authStore = useAuthStore();

// ═══════ FORM STATE ═══════
const age = ref<number | null>(null);
const location = ref('');
const equipment = ref('');
const rateType = ref('');
const requestedFee = ref<number | null>(null);
const dailyTeaAmount = ref<number | null>(null);
const foodTransportRequest = ref('');
const transportCost = ref<number | null>(null);
const mealCost = ref<number | null>(null);
const externalService = ref('');
const teaTransportFee = ref<number | null>(null);
const teaSaleFee = ref<number | null>(null);

const isSubmitting = ref(false);
const isSubmitted = ref(false);
const formError = ref<string | null>(null);

// ═══════ SELECT OPTIONS ═══════
const equipmentOptions = [
  { value: 'elektrikli_motor', label: 'Elektrikli Motor' },
  { value: 'benzinli_motor', label: 'Benzinli Motor' },
  { value: 'cay_makasi', label: 'Çay Makası' },
];

const rateTypeOptions = [
  { value: 'gunluk_ucret', label: 'Günlük Ücret' },
  { value: 'kilo_isi', label: 'Kilo İşi (Kg/TL)' },
];

const foodTransportOptions = [
  { value: 'evet_isterim', label: 'Evet İsterim' },
  { value: 'kendim_karsilayabilirim', label: 'Kendim Karşılayabilirim' },
];

const externalServiceOptions = [
  { value: 'hayir', label: 'Hayır Yapmam' },
  { value: 'evet', label: 'Evet Yaparım' },
];

// ═══════ WIZARD STEP MANAGEMENT ═══════
const activeStep = ref(1);
const TOTAL_STEPS = 8;

type SelectValue = string | number | (string | number)[] | null;

function isStepComplete(s: number): boolean {
  switch (s) {
    case 1: return age.value !== null && age.value > 0;
    case 2: return location.value.trim() !== '';
    case 3: return equipment.value !== '';
    case 4: return rateType.value !== '';
    case 5: return requestedFee.value !== null && requestedFee.value > 0;
    case 6: return dailyTeaAmount.value !== null && dailyTeaAmount.value > 0;
    case 7: return foodTransportRequest.value !== '';
    case 8: return externalService.value !== '';
    default: return false;
  }
}

function stepLabel(s: number): string {
  switch (s) {
    case 1: return 'Yaş';
    case 2: return 'Konum';
    case 3: return 'Ekipman';
    case 4: return 'Tarife';
    case 5: return 'Ücret';
    case 6: return 'Günlük Miktar';
    case 7: return 'Yemek/Ulaşım';
    case 8: return 'Harici İş';
    default: return '';
  }
}

function stepValue(s: number): string {
  switch (s) {
    case 1: return age.value ? `${age.value} yaş` : '';
    case 2: return location.value.trim();
    case 3: return equipmentOptions.find(o => o.value === equipment.value)?.label || '';
    case 4: return rateTypeOptions.find(o => o.value === rateType.value)?.label || '';
    case 5: {
      if (!requestedFee.value) return '';
      const unit = rateType.value === 'gunluk_ucret' ? 'TL/Gün' : 'TL/1 Ton';
      return `${requestedFee.value.toLocaleString('tr-TR')} ${unit}`;
    }
    case 6: return dailyTeaAmount.value ? `${dailyTeaAmount.value.toLocaleString('tr-TR')} Kg/Gün` : '';
    case 7: return foodTransportOptions.find(o => o.value === foodTransportRequest.value)?.label || '';
    case 8: return externalServiceOptions.find(o => o.value === externalService.value)?.label || '';
    default: return '';
  }
}

function nextStep() {
  if (activeStep.value < TOTAL_STEPS && isStepComplete(activeStep.value)) {
    activeStep.value++;
  }
}

function goToStep(s: number) {
  if (s < activeStep.value && s >= 1) {
    // Reset downstream dependent steps
    if (s <= 4) {
      // Going back to rate type or before: reset fee
      requestedFee.value = null;
    }
    activeStep.value = s;
  }
}

function prevStep() {
  if (activeStep.value > 1) {
    goToStep(activeStep.value - 1);
  }
}

const completedSteps = computed(() => {
  const steps: number[] = [];
  for (let i = 1; i < activeStep.value; i++) {
    steps.push(i);
  }
  return steps;
});

const feeUnitLabel = computed(() => {
  return rateType.value === 'gunluk_ucret' ? 'TL/Gün' : 'TL/1 Ton';
});

const feeUnitPlaceholder = computed(() => {
  return rateType.value === 'gunluk_ucret' ? 'Örn: 4000' : 'Örn: 9000';
});

// ═══════ SELECT HANDLERS ═══════
function handleEquipmentChange(value: SelectValue) {
  const v = Array.isArray(value) ? value[0] : value;
  equipment.value = v ? String(v) : '';
  if (v) nextStep();
}

function handleRateTypeChange(value: SelectValue) {
  const v = Array.isArray(value) ? value[0] : value;
  rateType.value = v ? String(v) : '';
  requestedFee.value = null; // Reset fee when rate type changes
  if (v) nextStep();
}

function handleFoodTransportChange(value: SelectValue) {
  const v = Array.isArray(value) ? value[0] : value;
  foodTransportRequest.value = v ? String(v) : '';
  // Reset costs when changing selection
  if (v !== 'kendim_karsilayabilirim') {
    transportCost.value = null;
    mealCost.value = null;
  }
}

function handleExternalServiceChange(value: SelectValue) {
  const v = Array.isArray(value) ? value[0] : value;
  externalService.value = v ? String(v) : '';
  // Reset fees when changing selection
  if (v !== 'evet') {
    teaTransportFee.value = null;
    teaSaleFee.value = null;
  }
}

// ═══════ SUBMISSION ═══════
async function handleSubmit() {
  formError.value = null;

  // Validate all required fields
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    if (!isStepComplete(i)) {
      formError.value = `Lütfen tüm zorunlu alanları doldurun (Adım ${i}: ${stepLabel(i)})`;
      return;
    }
  }

  isSubmitting.value = true;

  try {
    // Build the listing data
    const metadata = {
      age: age.value,
      equipment: equipment.value,
      rateType: rateType.value,
      requestedFee: requestedFee.value,
      feeUnit: rateType.value === 'gunluk_ucret' ? 'TL/Gün' : 'TL/1 Ton',
      dailyTeaAmount: dailyTeaAmount.value,
      foodTransportRequest: foodTransportRequest.value,
      transportCost: foodTransportRequest.value === 'kendim_karsilayabilirim' ? transportCost.value : null,
      mealCost: foodTransportRequest.value === 'kendim_karsilayabilirim' ? mealCost.value : null,
      externalService: externalService.value,
      teaTransportFee: externalService.value === 'evet' ? teaTransportFee.value : null,
      teaSaleFee: externalService.value === 'evet' ? teaSaleFee.value : null,
      fullName: authStore.user?.fullName || '',
      phone: authStore.user?.phone || '',
    };

    const payload = {
      type: 'worker',
      category: 'tea-picking',
      location: location.value.trim(),
      metadata,
    };

    console.log('Submitting worker listing:', payload);
    await api.createJobListing(payload);

    isSubmitted.value = true;
  } catch {
    formError.value = 'Bir hata oluştu. Lütfen tekrar deneyin.';
  } finally {
    isSubmitting.value = false;
  }
}

function goBack() {
  router.back();
}

function goToListings() {
  router.push('/job-listings');
}
</script>

<template>
  <AppLayout>
    <div class="create-listing-page">
      <!-- ═══ SUCCESS STATE ═══ -->
      <div v-if="isSubmitted" class="success-state">
        <div class="success-card">
          <div class="success-icon">✅</div>
          <h2>İlan Başarıyla Oluşturuldu!</h2>
          <p>Çay toplama işçi ilanınız yayınlandı.</p>

          <!-- Preview Card -->
          <div class="preview-card">
            <div class="preview-header">
              <div class="preview-avatar">
                {{ (authStore.user?.fullName || 'K')[0] }}
              </div>
              <div class="preview-user-info">
                <span class="preview-name">{{ authStore.user?.fullName }}</span>
                <span class="preview-phone">📞 {{ authStore.user?.phone }}</span>
              </div>
              <span class="preview-badge">🍃 Çay Toplama</span>
            </div>
            <div class="preview-details">
              <div class="preview-detail">
                <span class="preview-detail-label">Yaş</span>
                <span class="preview-detail-value">{{ age }}</span>
              </div>
              <div class="preview-detail">
                <span class="preview-detail-label">Konum</span>
                <span class="preview-detail-value">{{ location }}</span>
              </div>
              <div class="preview-detail">
                <span class="preview-detail-label">Ekipman</span>
                <span class="preview-detail-value">{{ equipmentOptions.find(o => o.value === equipment)?.label }}</span>
              </div>
              <div class="preview-detail">
                <span class="preview-detail-label">Ücret</span>
                <span class="preview-detail-value highlight">{{ requestedFee?.toLocaleString('tr-TR') }} {{ feeUnitLabel }}</span>
              </div>
              <div class="preview-detail">
                <span class="preview-detail-label">Günlük Miktar</span>
                <span class="preview-detail-value">{{ dailyTeaAmount?.toLocaleString('tr-TR') }} Kg/Gün</span>
              </div>
              <div v-if="foodTransportRequest === 'kendim_karsilayabilirim' && (transportCost || mealCost)" class="preview-detail">
                <span class="preview-detail-label">Yol/Yemek</span>
                <span class="preview-detail-value">
                  <template v-if="transportCost">+{{ transportCost?.toLocaleString('tr-TR') }} TL/Yol</template>
                  <template v-if="transportCost && mealCost"> · </template>
                  <template v-if="mealCost">+{{ mealCost?.toLocaleString('tr-TR') }} TL/Yemek</template>
                </span>
              </div>
              <div v-if="externalService === 'evet' && (teaTransportFee || teaSaleFee)" class="preview-detail">
                <span class="preview-detail-label">Harici İş</span>
                <span class="preview-detail-value">
                  <template v-if="teaTransportFee">Taşıma +{{ teaTransportFee?.toLocaleString('tr-TR') }} Ton/TL</template>
                  <template v-if="teaTransportFee && teaSaleFee"> · </template>
                  <template v-if="teaSaleFee">Satma +{{ teaSaleFee?.toLocaleString('tr-TR') }} Ton/TL</template>
                </span>
              </div>
            </div>
          </div>

          <button class="btn-primary-full" @click="goToListings">
            İlanlara Dön
          </button>
        </div>
      </div>

      <!-- ═══ FORM STATE ═══ -->
      <template v-else>
        <!-- Page Header -->
        <header class="page-header">
          <button class="btn-back" @click="goBack">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Geri Dön
          </button>
          <div class="header-center">
            <h1>🍃 Çay Toplama İşçi İlanı</h1>
            <p class="header-sub">Adım {{ activeStep }} / {{ TOTAL_STEPS }}</p>
          </div>
        </header>

        <!-- Progress Bar -->
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: `${(activeStep / TOTAL_STEPS) * 100}%` }"></div>
        </div>

        <!-- Breadcrumb -->
        <div v-if="completedSteps.length > 0" class="breadcrumb">
          <button
            v-for="s in completedSteps"
            :key="s"
            class="breadcrumb-item"
            @click="goToStep(s)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span class="breadcrumb-label">{{ stepLabel(s) }}:</span>
            <span class="breadcrumb-value">{{ stepValue(s) }}</span>
          </button>
        </div>

        <!-- Steps -->
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
              <input
                id="age"
                v-model.number="age"
                type="number"
                class="form-input"
                placeholder="Örn: 35"
                min="16"
                max="80"
                autofocus
                @keyup.enter="nextStep"
              />
              <div class="step-actions">
                <div></div>
                <button type="button" class="btn-next" :disabled="!isStepComplete(1)" @click="nextStep">
                  Devam
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>

            <!-- Step 2: Konum -->
            <div v-else-if="activeStep === 2" key="step2" class="step-card">
              <div class="step-header">
                <button type="button" class="btn-step-back" @click="prevStep">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div class="step-badge">2</div>
                <div>
                  <h2 class="step-title">Konum <span class="required">*</span></h2>
                  <p class="step-hint">Çalışmak istediğiniz bölgeyi yazın</p>
                </div>
              </div>
              <input
                id="location"
                v-model="location"
                type="text"
                class="form-input"
                placeholder="Örn: Rize / Çamlıhemşin"
                autofocus
                @keyup.enter="nextStep"
              />
              <div class="step-actions">
                <div></div>
                <button type="button" class="btn-next" :disabled="!isStepComplete(2)" @click="nextStep">
                  Devam
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>

            <!-- Step 3: Ekipman (SEÇENEK) -->
            <div v-else-if="activeStep === 3" key="step3" class="step-card">
              <div class="step-header">
                <button type="button" class="btn-step-back" @click="prevStep">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div class="step-badge">3</div>
                <div>
                  <h2 class="step-title">Çalıştığın Ekipman <span class="required">*</span></h2>
                  <p class="step-hint">Hangi ekipmanla çalışıyorsunuz?</p>
                </div>
              </div>
              <AppSelect
                :model-value="equipment"
                :options="equipmentOptions"
                placeholder="Ekipman seçin"
                required
                @update:model-value="handleEquipmentChange"
              />
            </div>

            <!-- Step 4: Tarife (SEÇENEK) -->
            <div v-else-if="activeStep === 4" key="step4" class="step-card">
              <div class="step-header">
                <button type="button" class="btn-step-back" @click="prevStep">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div class="step-badge">4</div>
                <div>
                  <h2 class="step-title">Çalışmak İstediğin Tarife <span class="required">*</span></h2>
                  <p class="step-hint">Günlük ücret mi, kilo işi mi tercih edersiniz?</p>
                </div>
              </div>
              <AppSelect
                :model-value="rateType"
                :options="rateTypeOptions"
                placeholder="Tarife seçin"
                required
                @update:model-value="handleRateTypeChange"
              />
            </div>

            <!-- Step 5: Talep Ettiğin Çalışma Ücreti (İSTER) -->
            <div v-else-if="activeStep === 5" key="step5" class="step-card">
              <div class="step-header">
                <button type="button" class="btn-step-back" @click="prevStep">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div class="step-badge">5</div>
                <div>
                  <h2 class="step-title">Talep Ettiğin Çalışma Ücreti <span class="required">*</span></h2>
                  <p class="step-hint">Ne kadar ücret talep ediyorsunuz?</p>
                </div>
              </div>
              <div class="input-with-unit">
                <input
                  id="requestedFee"
                  v-model.number="requestedFee"
                  type="number"
                  class="form-input"
                  :placeholder="feeUnitPlaceholder"
                  min="0"
                  autofocus
                  @keyup.enter="nextStep"
                />
                <span class="input-unit">{{ feeUnitLabel }}</span>
              </div>
              <div class="step-actions">
                <div></div>
                <button type="button" class="btn-next" :disabled="!isStepComplete(5)" @click="nextStep">
                  Devam
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>

            <!-- Step 6: Günlük Ortalama Çay Miktarı (İSTER) -->
            <div v-else-if="activeStep === 6" key="step6" class="step-card">
              <div class="step-header">
                <button type="button" class="btn-step-back" @click="prevStep">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div class="step-badge">6</div>
                <div>
                  <h2 class="step-title">Günlük Ortalama Çay Miktarı <span class="required">*</span></h2>
                  <p class="step-hint">Günde ortalama kaç kg çay toplayabilirsiniz?</p>
                </div>
              </div>
              <div class="input-with-unit">
                <input
                  id="dailyTeaAmount"
                  v-model.number="dailyTeaAmount"
                  type="number"
                  class="form-input"
                  placeholder="Örn: 450"
                  min="0"
                  autofocus
                  @keyup.enter="nextStep"
                />
                <span class="input-unit">Kg/Gün</span>
              </div>
              <div class="step-actions">
                <div></div>
                <button type="button" class="btn-next" :disabled="!isStepComplete(6)" @click="nextStep">
                  Devam
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>

            <!-- Step 7: Yemek/Ulaşım Talebi (SEÇENEK + conditional İSTER) -->
            <div v-else-if="activeStep === 7" key="step7" class="step-card">
              <div class="step-header">
                <button type="button" class="btn-step-back" @click="prevStep">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div class="step-badge">7</div>
                <div>
                  <h2 class="step-title">Yemek / Ulaşım Talebi <span class="required">*</span></h2>
                  <p class="step-hint">Yemek ve ulaşım konusundaki tercihiniz nedir?</p>
                </div>
              </div>
              <AppSelect
                :model-value="foodTransportRequest"
                :options="foodTransportOptions"
                placeholder="Seçiniz"
                required
                @update:model-value="handleFoodTransportChange"
              />

              <!-- Conditional: If "Kendim Karşılayabilirim" → show cost inputs -->
              <Transition name="fade">
                <div v-if="foodTransportRequest === 'kendim_karsilayabilirim'" class="conditional-fields">
                  <p class="conditional-hint">Yol ve yemek masraflarınız için ek ücret belirleyin (isteğe bağlı)</p>
                  <div class="conditional-row">
                    <div class="input-with-unit compact">
                      <input
                        v-model.number="transportCost"
                        type="number"
                        class="form-input"
                        placeholder="Örn: 300"
                        min="0"
                      />
                      <span class="input-unit">TL/Yol</span>
                    </div>
                    <div class="input-with-unit compact">
                      <input
                        v-model.number="mealCost"
                        type="number"
                        class="form-input"
                        placeholder="Örn: 400"
                        min="0"
                      />
                      <span class="input-unit">TL/Yemek</span>
                    </div>
                  </div>
                </div>
              </Transition>

              <div class="step-actions">
                <div></div>
                <button type="button" class="btn-next" :disabled="!isStepComplete(7)" @click="nextStep">
                  Devam
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>

            <!-- Step 8: Harici İş Hizmeti (SEÇENEK + conditional İSTER) — Final Step -->
            <div v-else-if="activeStep === 8" key="step8" class="step-card step-card-final">
              <div class="step-header">
                <button type="button" class="btn-step-back" @click="prevStep">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div class="step-badge">8</div>
                <div>
                  <h2 class="step-title">Harici İş Hizmeti <span class="required">*</span></h2>
                  <p class="step-hint">Çay toplama dışında ek hizmet verebilir misiniz?</p>
                </div>
              </div>
              <AppSelect
                :model-value="externalService"
                :options="externalServiceOptions"
                placeholder="Seçiniz"
                required
                @update:model-value="handleExternalServiceChange"
              />

              <!-- Conditional: If "Evet Yaparım" → show service fee inputs -->
              <Transition name="fade">
                <div v-if="externalService === 'evet'" class="conditional-fields">
                  <p class="conditional-hint">Ek hizmet ücretlerinizi belirleyin (isteğe bağlı)</p>
                  <div class="conditional-row">
                    <div class="service-field">
                      <label class="service-label">🚛 Çay Taşıma</label>
                      <div class="input-with-unit compact">
                        <input
                          v-model.number="teaTransportFee"
                          type="number"
                          class="form-input"
                          placeholder="Örn: 500"
                          min="0"
                        />
                        <span class="input-unit">Ton/TL</span>
                      </div>
                    </div>
                    <div class="service-field">
                      <label class="service-label">💰 Çay Satma</label>
                      <div class="input-with-unit compact">
                        <input
                          v-model.number="teaSaleFee"
                          type="number"
                          class="form-input"
                          placeholder="Örn: 400"
                          min="0"
                        />
                        <span class="input-unit">Ton/TL</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>

              <!-- Auto-filled user info preview -->
              <div class="user-preview">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>İlan kartınızda <strong>{{ authStore.user?.fullName }}</strong> ve <strong>{{ authStore.user?.phone }}</strong> bilgileri otomatik eklenecektir.</span>
              </div>

              <!-- Error -->
              <div v-if="formError" class="error-banner">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {{ formError }}
              </div>

              <!-- Submit -->
              <div class="step-actions">
                <button type="button" class="btn-cancel" @click="goBack">İptal</button>
                <button type="submit" class="btn-submit" :disabled="!isStepComplete(8) || isSubmitting">
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
  </AppLayout>
</template>

<style scoped>
.create-listing-page {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-8);
}

/* ── Header ── */
.page-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
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

/* ── Progress ── */
.progress-track {
  height: 4px;
  background: var(--color-bg-tertiary);
  border-radius: 2px;
  margin-bottom: var(--space-5);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 2px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ── Breadcrumb ── */
.breadcrumb {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.breadcrumb-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: var(--font-size-xs);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all var(--transition-fast);
  color: var(--color-text-secondary);
}

.breadcrumb-item:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.breadcrumb-item svg {
  color: var(--color-primary);
}

.breadcrumb-label {
  font-weight: var(--font-weight-medium);
}

.breadcrumb-value {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Step Card ── */
.step-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}

.step-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.step-badge {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-full);
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-sm);
  flex-shrink: 0;
}

.step-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: 2px;
}

.required {
  color: var(--color-danger);
}

.step-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.btn-step-back {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.btn-step-back:hover {
  color: var(--color-text-primary);
  border-color: var(--color-text-muted);
}

/* ── Form Inputs ── */
.form-input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  font-family: var(--font-family);
  transition: all var(--transition-fast);
  min-height: 48px;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-input::placeholder {
  color: var(--color-text-muted);
}

/* Remove number input arrows */
.form-input[type="number"]::-webkit-outer-spin-button,
.form-input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.form-input[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}

/* ── Input with Unit ── */
.input-with-unit {
  position: relative;
}

.input-with-unit .form-input {
  padding-right: 80px;
}

.input-unit {
  position: absolute;
  right: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  pointer-events: none;
}

.input-with-unit.compact .form-input {
  padding-right: 80px;
}

/* ── Conditional Fields ── */
.conditional-fields {
  margin-top: var(--space-4);
  padding: var(--space-4);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.conditional-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-3);
}

.conditional-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.service-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.service-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

/* ── User Preview ── */
.user-preview {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--color-primary-light);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}

.user-preview svg {
  color: var(--color-primary);
  flex-shrink: 0;
}

.user-preview strong {
  color: var(--color-text-primary);
}

/* ── Step Actions ── */
.step-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-5);
  gap: var(--space-3);
}

.btn-next {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-next:hover:not(:disabled) {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
}

.btn-next:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-cancel {
  padding: var(--space-3) var(--space-5);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-cancel:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
}

.btn-submit {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-submit:hover:not(:disabled) {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
}

.btn-submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Error ── */
.error-banner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--radius-md);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
  margin-top: var(--space-4);
}

/* ── Spinner ── */
.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Wizard Transition ── */
.wizard-enter-active,
.wizard-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.wizard-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.wizard-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* ── Fade Transition ── */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
  padding: 0;
  overflow: hidden;
}

.fade-enter-to {
  max-height: 300px;
}

/* ═══ SUCCESS STATE ═══ */
.success-state {
  display: flex;
  justify-content: center;
  padding: var(--space-8) 0;
}

.success-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-8) var(--space-6);
  text-align: center;
  max-width: 520px;
  width: 100%;
  box-shadow: var(--shadow-lg);
}

.success-icon {
  font-size: 56px;
  margin-bottom: var(--space-4);
}

.success-card h2 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.success-card > p {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  margin-bottom: var(--space-6);
}

/* ── Preview Card ── */
.preview-card {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  margin-bottom: var(--space-6);
  text-align: left;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.preview-avatar {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-full);
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-base);
  flex-shrink: 0;
}

.preview-user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.preview-name {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
}

.preview-phone {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.preview-badge {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.preview-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.preview-detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) 0;
}

.preview-detail:not(:last-child) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.preview-detail-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.preview-detail-value {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}

.preview-detail-value.highlight {
  color: var(--color-primary);
  font-weight: var(--font-weight-bold);
}

.btn-primary-full {
  width: 100%;
  padding: var(--space-3) var(--space-6);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary-full:hover {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
}

@media (max-width: 768px) {
  .step-card {
    padding: var(--space-4);
  }

  .conditional-row {
    grid-template-columns: 1fr;
  }

  .breadcrumb-value {
    max-width: 80px;
  }
}
</style>
