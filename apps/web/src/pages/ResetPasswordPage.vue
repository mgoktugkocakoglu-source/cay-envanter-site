<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { api } from '@/services/api';

const route = useRoute();
const router = useRouter();

const status = ref<'loading' | 'valid' | 'invalid' | 'success'>('loading');
const errorMessage = ref('');

// Form
const password = ref('');
const confirmPassword = ref('');
const errors = ref<Record<string, string>>({});
const isLoading = ref(false);
const showPassword = ref(false);
const showConfirmPassword = ref(false);

// Password strength
const passwordStrength = computed(() => {
  const pwd = password.value;
  if (!pwd) return { level: 0, label: '', class: '' };
  
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;
  
  if (score <= 2) return { level: 1, label: 'Zayıf', class: 'password-strength-weak' };
  if (score <= 3) return { level: 2, label: 'Orta', class: 'password-strength-medium' };
  return { level: 3, label: 'Güçlü', class: 'password-strength-strong' };
});

onMounted(async () => {
  const token = route.query.token as string;
  
  if (!token) {
    status.value = 'invalid';
    errorMessage.value = 'Geçersiz link';
    return;
  }
  
  const result = await api.validateResetToken(token);
  
  if (result.error || !result.data?.valid) {
    status.value = 'invalid';
    errorMessage.value = 'Şifre sıfırlama linkinin süresi dolmuş veya geçersiz';
    return;
  }
  
  status.value = 'valid';
});

function validateField(field: string): boolean {
  errors.value[field] = '';
  
  switch (field) {
    case 'password':
      if (!password.value) {
        errors.value[field] = 'Şifre gereklidir';
      } else if (password.value.length < 8) {
        errors.value[field] = 'Şifre en az 8 karakter olmalıdır';
      } else if (!/[a-z]/.test(password.value)) {
        errors.value[field] = 'Şifre en az bir küçük harf içermelidir';
      } else if (!/[A-Z]/.test(password.value)) {
        errors.value[field] = 'Şifre en az bir büyük harf içermelidir';
      } else if (!/[0-9]/.test(password.value)) {
        errors.value[field] = 'Şifre en az bir rakam içermelidir';
      }
      break;
      
    case 'confirmPassword':
      if (!confirmPassword.value) {
        errors.value[field] = 'Şifre tekrarı gereklidir';
      } else if (password.value !== confirmPassword.value) {
        errors.value[field] = 'Şifreler eşleşmiyor';
      }
      break;
  }
  
  return !errors.value[field];
}

async function handleSubmit() {
  if (!validateField('password') || !validateField('confirmPassword')) {
    return;
  }
  
  const token = route.query.token as string;
  isLoading.value = true;
  
  const result = await api.resetPassword(token, password.value);
  
  isLoading.value = false;
  
  if (result.error) {
    errorMessage.value = result.error.message;
    return;
  }
  
  status.value = 'success';
  
  setTimeout(() => {
    router.push('/login');
  }, 3000);
}
</script>

<template>
  <div class="auth-page">
    <header class="auth-header">
      <RouterLink to="/" class="auth-logo">
        <span class="auth-logo-icon">🍃</span>
        <span>Çay Platformu</span>
      </RouterLink>
    </header>
    
    <main class="auth-container">
      <div class="auth-card card card-elevated">
        <!-- Loading -->
        <template v-if="status === 'loading'">
          <div class="status-center">
            <span class="spinner large"></span>
            <p>Link doğrulanıyor...</p>
          </div>
        </template>
        
        <!-- Invalid Token -->
        <template v-else-if="status === 'invalid'">
          <div class="status-center">
            <div class="status-icon error">❌</div>
            <h1 class="auth-title">Link Süresi Dolmuş</h1>
            <p class="auth-subtitle">{{ errorMessage }}</p>
            <RouterLink to="/forgot-password" class="btn btn-primary btn-lg btn-block">
              Yeni Link Talep Et
            </RouterLink>
          </div>
        </template>
        
        <!-- Success -->
        <template v-else-if="status === 'success'">
          <div class="status-center">
            <div class="status-icon success">✅</div>
            <h1 class="auth-title">Şifre Değiştirildi</h1>
            <p class="auth-subtitle">
              Şifreniz başarıyla değiştirildi.<br>
              Güvenlik nedeniyle tüm cihazlardan çıkış yapıldı.
            </p>
            <RouterLink to="/login" class="btn btn-primary btn-lg btn-block">
              Giriş Yap
            </RouterLink>
            <p class="redirect-hint">3 saniye içinde yönlendirileceksiniz...</p>
          </div>
        </template>
        
        <!-- Reset Form -->
        <template v-else>
          <h1 class="auth-title">Yeni Şifre Oluştur</h1>
          <p class="auth-subtitle">Hesabınız için yeni bir şifre belirleyin</p>
          
          <form @submit.prevent="handleSubmit" novalidate>
            <!-- New Password -->
            <div class="form-group">
              <label class="form-label" for="password">Yeni Şifre</label>
              <div class="password-wrapper">
                <input
                  id="password"
                  v-model="password"
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
              <div v-if="password" class="password-strength">
                <div class="password-strength-bar" :class="passwordStrength.class"></div>
              </div>
              <p v-if="password && passwordStrength.label" class="password-strength-label" :style="{ color: passwordStrength.level === 3 ? 'var(--color-success)' : passwordStrength.level === 2 ? 'var(--color-warning)' : 'var(--color-danger)' }">
                {{ passwordStrength.label }}
              </p>
              <p v-if="errors.password" class="form-error">{{ errors.password }}</p>
            </div>
            
            <!-- Confirm Password -->
            <div class="form-group">
              <label class="form-label" for="confirmPassword">Şifre Tekrarı</label>
              <div class="password-wrapper">
                <input
                  id="confirmPassword"
                  v-model="confirmPassword"
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
            
            <button type="submit" class="btn btn-primary btn-lg btn-block" :disabled="isLoading">
              <span v-if="isLoading" class="spinner"></span>
              {{ isLoading ? 'Şifre değiştiriliyor...' : 'Şifremi Değiştir' }}
            </button>
          </form>
        </template>
      </div>
    </main>
  </div>
</template>

<style scoped>
.status-center {
  text-align: center;
}

.status-icon {
  font-size: 64px;
  margin-bottom: var(--space-4);
}

.spinner.large {
  width: 48px;
  height: 48px;
  border-width: 4px;
  margin: 0 auto var(--space-4);
}

.redirect-hint {
  margin-top: var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
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
