<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';
import AppSelect from '@/components/ui/AppSelect.vue';
import AppLayout from '@/layouts/AppLayout.vue';

const router = useRouter();
const authStore = useAuthStore();

// ═══════ FORM STATE ═══════
const location = ref('');
const terrainType = ref('');
const distanceRange = ref('');
const transportFee = ref<number | null>(null);
const sellingFee = ref<number | null>(null);
const foodTransportService = ref('');
const transportCost = ref<number | null>(null);
const mealCost = ref<number | null>(null);

const isSubmitting = ref(false);
const isSubmitted = ref(false);
const formError = ref<string | null>(null);

// ═══════ SELECT OPTIONS ═══════
const terrainOptions = [
  { value: 'duz_arazi', label: 'Düz Arazi' },
  { value: 'egimli_arazi', label: 'Eğimli Arazi' },
];

const distanceOptions = [
  { value: '100m-300m', label: '100m - 300m' },
  { value: '300m-600m', label: '300m - 600m' },
  { value: '600m-1000m', label: '600m - 1000m' },
];

const foodTransportOptions = [
  { value: 'karsi_taraf_saglasin', label: 'Karşı Taraf Sağlasın' },
  { value: 'evet_saglarim', label: 'Evet Sağlarım' },
];

// ═══════ SUGGESTED PRICES (employer side – lower than worker) ═══════
const suggestedPrices: Record<string, Record<string, number>> = {
  duz_arazi: {
    '100m-300m': 900,
    '300m-600m': 1200,
    '600m-1000m': 1600,
  },
  egimli_arazi: {
    '100m-300m': 1800,
    '300m-600m': 2300,
    '600m-1000m': 2800,
  },
};

watch([terrainType, distanceRange], ([terrain, distance]) => {
  if (terrain && distance && suggestedPrices[terrain]?.[distance]) {
    transportFee.value = suggestedPrices[terrain][distance];
  }
});

const suggestedPrice = computed(() => {
  if (terrainType.value && distanceRange.value) {
    return suggestedPrices[terrainType.value]?.[distanceRange.value] || null;
  }
  return null;
});

// ═══════ WIZARD STEP MANAGEMENT ═══════
const activeStep = ref(1);
const TOTAL_STEPS = 4;

type SelectValue = string | number | (string | number)[] | null;

function isStepComplete(s: number): boolean {
  switch (s) {
    case 1: return location.value.trim() !== '';
    case 2: return terrainType.value !== '' && distanceRange.value !== '' && transportFee.value !== null && transportFee.value > 0;
    case 3: return sellingFee.value !== null && sellingFee.value > 0;
    case 4: return foodTransportService.value !== '';
    default: return false;
  }
}

function stepLabel(s: number): string {
  switch (s) {
    case 1: return 'Konum';
    case 2: return 'Taşıma Teklifi';
    case 3: return 'Satma Teklifi';
    case 4: return 'Yemek/Ulaşım';
    default: return '';
  }
}

function stepValue(s: number): string {
  switch (s) {
    case 1: return location.value.trim();
    case 2: {
      if (!transportFee.value) return '';
      const terrain = terrainOptions.find(o => o.value === terrainType.value)?.label || '';
      return `${terrain} · ${distanceRange.value} · ${transportFee.value.toLocaleString('tr-TR')} TL/Ton`;
    }
    case 3: return sellingFee.value ? `${sellingFee.value.toLocaleString('tr-TR')} TL/Ton` : '';
    case 4: return foodTransportOptions.find(o => o.value === foodTransportService.value)?.label || '';
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

// ═══════ SELECT HANDLERS ═══════
function handleTerrainChange(value: SelectValue) {
  const v = Array.isArray(value) ? value[0] : value;
  terrainType.value = v ? String(v) : '';
  distanceRange.value = '';
  transportFee.value = null;
}

function handleDistanceChange(value: SelectValue) {
  const v = Array.isArray(value) ? value[0] : value;
  distanceRange.value = v ? String(v) : '';
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
      terrainType: terrainType.value,
      distanceRange: distanceRange.value,
      transportFee: transportFee.value,
      sellingFee: sellingFee.value,
      foodTransportService: foodTransportService.value,
      transportCost: foodTransportService.value === 'karsi_taraf_saglasin' ? transportCost.value : null,
      mealCost: foodTransportService.value === 'karsi_taraf_saglasin' ? mealCost.value : null,
      fullName: authStore.user?.fullName || '',
      phone: authStore.user?.phone || '',
    };

    const payload = {
      type: 'job',
      category: 'tea-transport',
      location: location.value.trim(),
      metadata,
    };

    console.log('Submitting tea transport job listing:', payload);
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
          <h2>İş İlanı Başarıyla Oluşturuldu!</h2>
          <p>Çay taşıma/satma iş ilanınız yayınlandı.</p>

          <div class="preview-card">
            <div class="preview-header">
              <div class="preview-avatar">
                {{ (authStore.user?.fullName || 'K')[0] }}
              </div>
              <div class="preview-user-info">
                <span class="preview-name">{{ authStore.user?.fullName }}</span>
                <span class="preview-phone">📞 {{ authStore.user?.phone }}</span>
              </div>
              <span class="preview-badge">🚛 Çay Taşıma/Satma İş İlanı</span>
            </div>
            <div class="preview-details">
              <div class="preview-detail">
                <span class="preview-detail-label">Konum</span>
                <span class="preview-detail-value">{{ location }}</span>
              </div>
              <div class="preview-detail">
                <span class="preview-detail-label">Arazi Tipi</span>
                <span class="preview-detail-value">{{ terrainOptions.find(o => o.value === terrainType)?.label }}</span>
              </div>
              <div class="preview-detail">
                <span class="preview-detail-label">Mesafe</span>
                <span class="preview-detail-value">{{ distanceRange }}</span>
              </div>
              <div class="preview-detail">
                <span class="preview-detail-label">Taşıma Teklifi</span>
                <span class="preview-detail-value highlight">{{ transportFee?.toLocaleString('tr-TR') }} TL/Ton</span>
              </div>
              <div class="preview-detail">
                <span class="preview-detail-label">Satma Teklifi</span>
                <span class="preview-detail-value highlight">{{ sellingFee?.toLocaleString('tr-TR') }} TL/Ton</span>
              </div>
              <div class="preview-detail">
                <span class="preview-detail-label">Yemek/Ulaşım</span>
                <span class="preview-detail-value">{{ foodTransportOptions.find(o => o.value === foodTransportService)?.label }}</span>
              </div>
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

          <button class="btn-primary-full" @click="goToListings">
            İlanlara Dön
          </button>
        </div>
      </div>

      <!-- ═══ FORM STATE ═══ -->
      <template v-else>
        <header class="page-header">
          <button class="btn-back" @click="goBack">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Geri Dön
          </button>
          <div class="header-center">
            <h1>🚛 Çay Taşıma/Satma İş İlanı</h1>
            <p class="header-sub">Adım {{ activeStep }} / {{ TOTAL_STEPS }}</p>
          </div>
        </header>

        <div class="progress-track">
          <div class="progress-fill" :style="{ width: `${(activeStep / TOTAL_STEPS) * 100}%` }"></div>
        </div>

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
                <button type="button" class="btn-next" :disabled="!isStepComplete(1)" @click="nextStep">
                  Devam
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>

            <!-- Step 2: Taşıma İşi Teklifin (Terrain → Distance → Fee) -->
            <div v-else-if="activeStep === 2" key="step2" class="step-card">
              <div class="step-header">
                <button type="button" class="btn-step-back" @click="prevStep">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div class="step-badge">2</div>
                <div>
                  <h2 class="step-title">Taşıma İşi Teklifin <span class="required">*</span></h2>
                  <p class="step-hint">Arazi tipini ve mesafeyi seçip ücret teklifinizi belirleyin</p>
                </div>
              </div>

              <div class="sub-step">
                <label class="sub-step-label">Arazi Tipi</label>
                <AppSelect
                  :model-value="terrainType"
                  :options="terrainOptions"
                  placeholder="Arazi tipi seçin"
                  required
                  @update:model-value="handleTerrainChange"
                />
              </div>

              <Transition name="fade">
                <div v-if="terrainType" class="sub-step">
                  <label class="sub-step-label">Mesafe Aralığı</label>
                  <AppSelect
                    :model-value="distanceRange"
                    :options="distanceOptions"
                    placeholder="Mesafe seçin"
                    required
                    @update:model-value="handleDistanceChange"
                  />
                </div>
              </Transition>

              <Transition name="fade">
                <div v-if="terrainType && distanceRange" class="sub-step">
                  <label class="sub-step-label">Taşıma Ücret Teklifiniz</label>
                  <div class="input-with-unit">
                    <input
                      v-model.number="transportFee"
                      type="number"
                      class="form-input"
                      :placeholder="suggestedPrice ? `Önerilen: ${suggestedPrice}` : 'Ücret'"
                      min="0"
                    />
                    <span class="input-unit">TL/Ton</span>
                  </div>
                  <div v-if="suggestedPrice" class="suggestion-hint">
                    💡 {{ terrainOptions.find(o => o.value === terrainType)?.label }} · {{ distanceRange }} için önerilen teklif: <strong>{{ suggestedPrice.toLocaleString('tr-TR') }} TL/Ton</strong>
                  </div>
                </div>
              </Transition>

              <div class="step-actions">
                <div></div>
                <button type="button" class="btn-next" :disabled="!isStepComplete(2)" @click="nextStep">
                  Devam
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>

            <!-- Step 3: Satma İşi Teklifin -->
            <div v-else-if="activeStep === 3" key="step3" class="step-card">
              <div class="step-header">
                <button type="button" class="btn-step-back" @click="prevStep">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div class="step-badge">3</div>
                <div>
                  <h2 class="step-title">Satma İşi Teklifin <span class="required">*</span></h2>
                  <p class="step-hint">Çay satma işi için ücret teklifinizi belirleyin</p>
                </div>
              </div>
              <div class="input-with-unit">
                <input
                  id="sellingFee"
                  v-model.number="sellingFee"
                  type="number"
                  class="form-input"
                  placeholder="Örn: 1300"
                  min="0"
                  autofocus
                  @keyup.enter="nextStep"
                />
                <span class="input-unit">TL/Ton</span>
              </div>
              <div class="suggestion-hint">
                💡 Önerilen teklif: <strong>1.300 TL/Ton</strong>
              </div>
              <div class="step-actions">
                <div></div>
                <button type="button" class="btn-next" :disabled="!isStepComplete(3)" @click="nextStep">
                  Devam
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>

            <!-- Step 4: Yemek/Ulaşım Hizmeti — Final Step -->
            <div v-else-if="activeStep === 4" key="step4" class="step-card step-card-final">
              <div class="step-header">
                <button type="button" class="btn-step-back" @click="prevStep">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div class="step-badge">4</div>
                <div>
                  <h2 class="step-title">Yemek / Ulaşım Hizmeti <span class="required">*</span></h2>
                  <p class="step-hint">İşçiye yemek ve ulaşım sağlayacak mısınız?</p>
                </div>
              </div>
              <AppSelect
                :model-value="foodTransportService"
                :options="foodTransportOptions"
                placeholder="Seçiniz"
                required
                @update:model-value="handleFoodTransportChange"
              />

              <Transition name="fade">
                <div v-if="foodTransportService === 'karsi_taraf_saglasin'" class="conditional-fields">
                  <p class="conditional-hint">İşçiye yol ve yemek katkısı olarak ek ücret belirleyin (isteğe bağlı)</p>
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
  background: #7c3aed;
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
  border-color: #7c3aed;
  background: rgba(124, 58, 237, 0.06);
  color: #7c3aed;
}

.breadcrumb-item svg {
  color: #7c3aed;
}

.breadcrumb-label {
  font-weight: var(--font-weight-medium);
}

.breadcrumb-value {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
  max-width: 180px;
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
  background: #7c3aed;
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

/* ── Sub-steps ── */
.sub-step {
  margin-bottom: var(--space-4);
}

.sub-step-label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-2);
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
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
}

.form-input::placeholder {
  color: var(--color-text-muted);
}

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
  color: #7c3aed;
  background: rgba(124, 58, 237, 0.08);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  pointer-events: none;
}

.input-with-unit.compact .form-input {
  padding-right: 80px;
}

/* ── Suggestion Hint ── */
.suggestion-hint {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  background: rgba(124, 58, 237, 0.04);
  border-radius: var(--radius-md);
  border: 1px solid rgba(124, 58, 237, 0.1);
}

.suggestion-hint strong {
  color: #7c3aed;
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

/* ── User Preview ── */
.user-preview {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: rgba(124, 58, 237, 0.05);
  border: 1px solid rgba(124, 58, 237, 0.15);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}

.user-preview svg {
  color: #7c3aed;
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
  background: #7c3aed;
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-next:hover:not(:disabled) {
  filter: brightness(1.1);
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
  background: #7c3aed;
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-submit:hover:not(:disabled) {
  filter: brightness(1.1);
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
  background: #7c3aed;
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
  color: #7c3aed;
  background: rgba(124, 58, 237, 0.08);
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
  color: #7c3aed;
  font-weight: var(--font-weight-bold);
}

.btn-primary-full {
  width: 100%;
  padding: var(--space-3) var(--space-6);
  background: #7c3aed;
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary-full:hover {
  filter: brightness(1.1);
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
    max-width: 100px;
  }
}
</style>
