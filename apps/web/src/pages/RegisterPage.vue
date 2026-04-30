<script setup lang="ts">
import { ref, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '@/services/api';
import AppSelect from '@/components/ui/AppSelect.vue';

import type { UserType } from '@/stores/authStore';

// Tea-producing provinces data
const provinces = [
  { name: 'Rize', plateCode: '53' },
  { name: 'Trabzon', plateCode: '61' },
  { name: 'Artvin', plateCode: '08' },
  { name: 'Giresun', plateCode: '28' },
  { name: 'Ordu', plateCode: '52' },
];

// User type definitions
const userTypes: Array<{ value: UserType; label: string; description: string; icon: string }> = [
  {
    value: 'land_owner',
    label: 'Arazi Sahibi',
    description: 'Arazim var fakat kendim isleyemiyorum. Isci veya yarilici ariyorum.',
    icon: '🏡',
  },
  {
    value: 'worker',
    label: 'Cay Iscisi',
    description: 'Arazim yok, baskalarinin arazilerinde cay topluyorum veya yarilici olarak calisiyorum.',
    icon: '👷',
  },
];

// Form data
const form = ref({
  userType: '' as UserType | '',
  fullName: '',
  email: '',
  phone: '',
  province: '',
  district: '',
  password: '',
  confirmPassword: '',
  farmerIdNumber: '',
  termsAccepted: false,
});

// Form state
const errors = ref<Record<string, string>>({});
const isLoading = ref(false);
const isSuccess = ref(false);
const serverError = ref('');
const registeredEmail = ref('');
const showPassword = ref(false);
const showConfirmPassword = ref(false);

// Districts (simplified - would be loaded from API in production)
const districtMap: Record<string, string[]> = {
  'Rize': ['Merkez', 'Ardeşen', 'Çamlıhemşin', 'Çayeli', 'Derepazarı', 'Fındıklı', 'Güneysu', 'Hemşin', 'İkizdere', 'İyidere', 'Kalkandere', 'Pazar'],
  'Trabzon': ['Merkez', 'Akçaabat', 'Araklı', 'Arsin', 'Beşikdüzü', 'Çarşıbaşı', 'Çaykara', 'Dernekpazarı', 'Düzköy', 'Hayrat', 'Köprübaşı', 'Maçka', 'Of', 'Sürmene', 'Şalpazarı', 'Tonya', 'Vakfıkebir', 'Yomra'],
  'Artvin': ['Merkez', 'Ardanuç', 'Arhavi', 'Borçka', 'Hopa', 'Kemalpaşa', 'Murgul', 'Şavşat', 'Yusufeli'],
  'Giresun': ['Merkez', 'Alucra', 'Bulancak', 'Çamoluk', 'Çanakçı', 'Dereli', 'Doğankent', 'Espiye', 'Eynesil', 'Görele', 'Güce', 'Keşap', 'Piraziz', 'Şebinkarahisar', 'Tirebolu', 'Yağlıdere'],
  'Ordu': ['Merkez', 'Akkuş', 'Altınordu', 'Aybastı', 'Çamaş', 'Çatalpınar', 'Çaybaşı', 'Fatsa', 'Gölköy', 'Gülyalı', 'Gürgentepe', 'İkizce', 'Kabadüz', 'Kabataş', 'Korgan', 'Kumru', 'Mesudiye', 'Perşembe', 'Ulubey', 'Ünye'],
};

// Options for AppSelect
const provinceOptions = computed(() =>
  provinces.map(p => ({ value: p.name, label: `${p.name} (${p.plateCode})` }))
);

const districtOptions = computed(() => {
  const districts = districtMap[form.value.province] || [];
  return districts.map(d => ({ value: d, label: d }));
});

// Password strength calculation
const passwordStrength = computed(() => {
  const password = form.value.password;
  if (!password) return { level: 0, label: '' };

  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) return { level: 1, label: 'Zayıf', class: 'password-strength-weak' };
  if (score <= 3) return { level: 2, label: 'Orta', class: 'password-strength-medium' };
  return { level: 3, label: 'Güçlü', class: 'password-strength-strong' };
});

// User type selection
function selectUserType(type: UserType) {
  form.value.userType = type;
  errors.value.userType = '';
}

// Validation
function validateField(field: string): boolean {
  errors.value[field] = '';

  switch (field) {
    case 'userType':
      if (!form.value.userType) {
        errors.value[field] = 'Kullanıcı tipi seçiniz';
      }
      break;

    case 'fullName':
      if (!form.value.fullName) {
        errors.value[field] = 'Ad Soyad gereklidir';
      } else if (form.value.fullName.length < 3) {
        errors.value[field] = 'Ad Soyad en az 3 karakter olmalıdır';
      } else if (!/^[a-zA-ZğüşıöçĞÜŞİÖÇ\s]+$/.test(form.value.fullName)) {
        errors.value[field] = 'Sadece harf ve boşluk kullanabilirsiniz';
      }
      break;

    case 'email':
      if (!form.value.email) {
        errors.value[field] = 'Email adresi gereklidir';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
        errors.value[field] = 'Geçerli bir email adresi giriniz';
      }
      break;

    case 'phone':
      const cleanPhone = form.value.phone.replace(/\D/g, '');
      if (!cleanPhone) {
        errors.value[field] = 'Telefon numarası gereklidir';
      } else if (!/^5[0-9]{9}$/.test(cleanPhone)) {
        errors.value[field] = 'Geçerli bir telefon numarası giriniz (5XXXXXXXXX)';
      }
      break;

    case 'province':
      if (!form.value.province) {
        errors.value[field] = 'Lütfen il seçiniz';
      }
      break;

    case 'district':
      if (!form.value.district) {
        errors.value[field] = 'Lütfen ilçe seçiniz';
      }
      break;

    case 'password':
      if (!form.value.password) {
        errors.value[field] = 'Şifre gereklidir';
      } else if (form.value.password.length < 8) {
        errors.value[field] = 'Şifre en az 8 karakter olmalıdır';
      } else if (!/[a-z]/.test(form.value.password)) {
        errors.value[field] = 'Şifre en az bir küçük harf içermelidir';
      } else if (!/[A-Z]/.test(form.value.password)) {
        errors.value[field] = 'Şifre en az bir büyük harf içermelidir';
      } else if (!/[0-9]/.test(form.value.password)) {
        errors.value[field] = 'Şifre en az bir rakam içermelidir';
      }
      break;

    case 'confirmPassword':
      if (!form.value.confirmPassword) {
        errors.value[field] = 'Şifre tekrarı gereklidir';
      } else if (form.value.password !== form.value.confirmPassword) {
        errors.value[field] = 'Şifreler eşleşmiyor';
      }
      break;

    case 'farmerIdNumber':
      if (!form.value.farmerIdNumber) {
        errors.value[field] = 'TC Kimlik No gereklidir';
      } else if (!/^[0-9]{11}$/.test(form.value.farmerIdNumber)) {
        errors.value[field] = 'TC Kimlik No 11 haneli olmalıdır';
      }
      break;

    case 'termsAccepted':
      if (!form.value.termsAccepted) {
        errors.value[field] = 'Kullanım koşullarını kabul etmelisiniz';
      }
      break;
  }

  return !errors.value[field];
}

function validateAll(): boolean {
  const fields = ['userType', 'fullName', 'email', 'phone', 'province', 'district', 'password', 'confirmPassword', 'farmerIdNumber', 'termsAccepted'];
  return fields.every(validateField);
}

// Province change handler
function onProvinceChange() {
  form.value.district = '';
  validateField('province');
}

// Form submission
async function handleSubmit() {
  serverError.value = '';

  if (!validateAll()) return;

  isLoading.value = true;

  const cleanPhone = form.value.phone.replace(/\D/g, '');

  const result = await api.register({
    userType: form.value.userType as UserType,
    fullName: form.value.fullName,
    email: form.value.email,
    phone: cleanPhone,
    province: form.value.province,
    district: form.value.district,
    password: form.value.password,
    farmerIdNumber: form.value.farmerIdNumber,
  });

  isLoading.value = false;

  if (result.error) {
    serverError.value = result.error.message;
    return;
  }

  registeredEmail.value = result.data?.email || form.value.email;
  isSuccess.value = true;
}

// Resend verification
const resendCooldown = ref(0);
const resendMessage = ref('');

async function resendVerification() {
  if (resendCooldown.value > 0) return;

  const result = await api.resendVerification(registeredEmail.value);

  if (result.error) {
    resendMessage.value = result.error.message;
    return;
  }

  resendMessage.value = 'Doğrulama emaili tekrar gönderildi';
  resendCooldown.value = 60;

  const interval = setInterval(() => {
    resendCooldown.value--;
    if (resendCooldown.value <= 0) {
      clearInterval(interval);
      resendMessage.value = '';
    }
  }, 1000);
}
</script>

<template>
  <div class="auth-page">
    <header class="auth-header">
      <RouterLink to="/" class="auth-logo">
        <span class="auth-logo-icon">🍃</span>
        <span>Çay Platformu</span>
      </RouterLink>
      <RouterLink to="/login" class="btn btn-secondary auth-header-cta">
        <span class="auth-cta-prefix">Zaten hesabınız var mı?</span>
        <span>Giriş Yapın</span>
      </RouterLink>
    </header>

    <main class="auth-container">
      <div class="auth-card card card-elevated">
        <!-- Success State -->
        <template v-if="isSuccess">
          <div class="success-state">
            <div class="success-icon">✉️</div>
            <h1 class="auth-title">Kayıt Başarılı!</h1>
            <p class="success-message">
              <strong>{{ registeredEmail }}</strong> adresine bir doğrulama e-postası gönderdik.
            </p>
            <p class="success-hint">
              Hesabınızı aktifleştirmek için lütfen e-postanızdaki linke tıklayın.
            </p>

            <div class="resend-section">
              <p class="resend-text">E-postayı almadınız mı?</p>
              <button
                class="btn btn-link"
                @click="resendVerification"
                :disabled="resendCooldown > 0"
              >
                {{ resendCooldown > 0 ? `Tekrar Gönder (${resendCooldown}s)` : 'Tekrar Gönder' }}
              </button>
              <p v-if="resendMessage" class="resend-message">{{ resendMessage }}</p>
            </div>
          </div>
        </template>

        <!-- Registration Form -->
        <template v-else>
          <h1 class="auth-title">Hesap Oluştur</h1>
          <p class="auth-subtitle">Çay üreticisi platformuna hoş geldiniz</p>

          <div v-if="serverError" class="message-box message-box-error">
            <span>❌</span>
            <span>{{ serverError }}</span>
          </div>

          <form @submit.prevent="handleSubmit" novalidate>
            <!-- User Type Selection -->
            <div class="form-group">
              <label class="form-label">Kullanıcı Tipi *</label>
              <div class="user-type-grid">
                <button
                  v-for="ut in userTypes"
                  :key="ut.value"
                  type="button"
                  class="user-type-card"
                  :class="{ selected: form.userType === ut.value }"
                  @click="selectUserType(ut.value)"
                >
                  <span class="user-type-icon">{{ ut.icon }}</span>
                  <span class="user-type-label">{{ ut.label }}</span>
                  <span class="user-type-desc">{{ ut.description }}</span>
                  <span v-if="form.userType === ut.value" class="user-type-check">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </span>
                </button>
              </div>
              <p v-if="errors.userType" class="form-error">{{ errors.userType }}</p>
            </div>

            <!-- TC Kimlik No -->
            <div class="form-group">
              <label class="form-label" for="farmerIdNumber">TC Kimlik No *</label>
              <input
                id="farmerIdNumber"
                v-model="form.farmerIdNumber"
                type="text"
                class="form-input"
                :class="{ 'has-error': errors.farmerIdNumber }"
                placeholder="11 haneli TC kimlik numaranız"
                maxlength="11"
                @blur="validateField('farmerIdNumber')"
              />
              <p class="form-hint">TC kimlik numaranız, diger kullanıcılarla baglantı kurmak icin kullanılacaktır.</p>
              <p v-if="errors.farmerIdNumber" class="form-error">{{ errors.farmerIdNumber }}</p>
            </div>

            <!-- Full Name -->
            <div class="form-group">
              <label class="form-label" for="fullName">Ad Soyad *</label>
              <input
                id="fullName"
                v-model="form.fullName"
                type="text"
                class="form-input"
                :class="{ 'has-error': errors.fullName }"
                placeholder="Ahmet Yılmaz"
                @blur="validateField('fullName')"
              />
              <p v-if="errors.fullName" class="form-error">{{ errors.fullName }}</p>
            </div>

            <!-- Email -->
            <div class="form-group">
              <label class="form-label" for="email">Email Adresi *</label>
              <input
                id="email"
                v-model="form.email"
                type="email"
                class="form-input"
                :class="{ 'has-error': errors.email }"
                placeholder="ahmet@example.com"
                @blur="validateField('email')"
              />
              <p v-if="errors.email" class="form-error">{{ errors.email }}</p>
            </div>

            <!-- Phone -->
            <div class="form-group">
              <label class="form-label" for="phone">Telefon Numarası *</label>
              <input
                id="phone"
                v-model="form.phone"
                type="tel"
                class="form-input"
                :class="{ 'has-error': errors.phone }"
                placeholder="5XX XXX XX XX"
                @blur="validateField('phone')"
              />
              <p v-if="errors.phone" class="form-error">{{ errors.phone }}</p>
            </div>

            <!-- Province & District -->
            <div class="form-row">
              <AppSelect
                v-model="form.province"
                :options="provinceOptions"
                label="İl *"
                placeholder="İl Seçiniz"
                :error="errors.province"
                :required="true"
                @update:modelValue="onProvinceChange"
                @blur="() => validateField('province')"
              />

              <AppSelect
                v-model="form.district"
                :options="districtOptions"
                label="İlçe *"
                placeholder="İlçe Seçiniz"
                :error="errors.district"
                :disabled="!form.province"
                :required="true"
                @blur="() => validateField('district')"
              />
            </div>

            <!-- Password -->
            <div class="form-group">
              <label class="form-label" for="password">Şifre *</label>
              <div class="password-wrapper">
                <input
                  id="password"
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  class="form-input"
                  :class="{ 'has-error': errors.password }"
                  placeholder="En az 8 karakter"
                  @blur="validateField('password')"
                />
                <button
                  type="button"
                  class="password-toggle"
                  @click="showPassword = !showPassword"
                >
                  {{ showPassword ? '👁️' : '👁️‍🗨️' }}
                </button>
              </div>
              <div v-if="form.password" class="password-strength">
                <div class="password-strength-bar" :class="passwordStrength.class"></div>
              </div>
              <p v-if="form.password && passwordStrength.label" class="password-strength-label" :style="{ color: passwordStrength.level === 3 ? 'var(--color-success)' : passwordStrength.level === 2 ? 'var(--color-warning)' : 'var(--color-danger)' }">
                {{ passwordStrength.label }}
              </p>
              <p v-if="errors.password" class="form-error">{{ errors.password }}</p>
            </div>

            <!-- Confirm Password -->
            <div class="form-group">
              <label class="form-label" for="confirmPassword">Şifre Tekrarı *</label>
              <div class="password-wrapper">
                <input
                  id="confirmPassword"
                  v-model="form.confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  class="form-input"
                  :class="{ 'has-error': errors.confirmPassword }"
                  placeholder="Şifrenizi tekrar giriniz"
                  @blur="validateField('confirmPassword')"
                />
                <button
                  type="button"
                  class="password-toggle"
                  @click="showConfirmPassword = !showConfirmPassword"
                >
                  {{ showConfirmPassword ? '👁️' : '👁️‍🗨️' }}
                </button>
              </div>
              <p v-if="errors.confirmPassword" class="form-error">{{ errors.confirmPassword }}</p>
            </div>

            <!-- Terms -->
            <div class="form-group">
              <div class="checkbox-wrapper">
                <input
                  id="termsAccepted"
                  v-model="form.termsAccepted"
                  type="checkbox"
                  class="checkbox"
                  @change="validateField('termsAccepted')"
                />
                <label class="checkbox-label" for="termsAccepted">
                  <a href="/terms" target="_blank">Kullanım Koşullarını</a> ve
                  <a href="/privacy" target="_blank">Gizlilik Politikasını</a>
                  okudum, kabul ediyorum.
                </label>
              </div>
              <p v-if="errors.termsAccepted" class="form-error">{{ errors.termsAccepted }}</p>
            </div>

            <!-- Submit -->
            <button type="submit" class="btn btn-primary btn-lg btn-block" :disabled="isLoading">
              <span v-if="isLoading" class="spinner"></span>
              {{ isLoading ? 'Kaydediliyor...' : 'Hesap Oluştur' }}
            </button>
          </form>

          <p class="auth-footer">
            Zaten hesabınız var mı?
            <RouterLink to="/login">Giriş Yapın</RouterLink>
          </p>
        </template>
      </div>
    </main>
  </div>
</template>

<style scoped>
.success-state {
  text-align: center;
  padding: var(--space-4) 0;
}

.success-icon {
  font-size: 48px;
  margin-bottom: var(--space-4);
}

.success-message {
  color: var(--color-text-secondary);
  margin-bottom: var(--space-2);
}

.success-hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-6);
}

.resend-section {
  margin-top: var(--space-6);
  padding-top: var(--space-6);
  border-top: 1px solid var(--color-border);
}

.resend-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-2);
}

.resend-message {
  margin-top: var(--space-2);
  color: var(--color-success);
  font-size: var(--font-size-sm);
}

/* User Type Cards */
.user-type-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.user-type-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-4) var(--space-3);
  background: var(--color-bg-secondary);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
  gap: var(--space-2);
}

.user-type-card:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-tertiary);
}

.user-type-card.selected {
  border-color: var(--color-primary);
  background: rgba(16, 185, 129, 0.08);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.user-type-icon {
  font-size: 28px;
  line-height: 1;
}

.user-type-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.user-type-desc {
  font-size: 11px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.user-type-check {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.form-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: var(--space-1);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

@media (max-width: 640px) {
  .user-type-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}

.password-wrapper {
  position: relative;
}

.password-toggle {
  position: absolute;
  right: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: var(--font-size-lg);
  cursor: pointer;
  padding: var(--space-1);
}
</style>
