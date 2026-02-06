<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';

const router = useRouter();
const authStore = useAuthStore();

// Form data
const form = ref({
  email: '',
  password: '',
  rememberMe: false,
});

// Form state
const errors = ref<Record<string, string>>({});
const isLoading = ref(false);
const serverError = ref('');
const showPassword = ref(false);
const needsVerification = ref(false);
const verificationEmail = ref('');

// Validation
function validateField(field: string): boolean {
  errors.value[field] = '';
  
  switch (field) {
    case 'email':
      if (!form.value.email) {
        errors.value[field] = 'Email adresi gereklidir';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
        errors.value[field] = 'Geçerli bir email adresi giriniz';
      }
      break;
      
    case 'password':
      if (!form.value.password) {
        errors.value[field] = 'Şifre gereklidir';
      }
      break;
  }
  
  return !errors.value[field];
}

function validateAll(): boolean {
  return ['email', 'password'].every(validateField);
}

// Form submission
async function handleSubmit() {
  serverError.value = '';
  needsVerification.value = false;
  
  if (!validateAll()) return;
  
  isLoading.value = true;
  
  const result = await api.login({
    email: form.value.email,
    password: form.value.password,
    rememberMe: form.value.rememberMe,
  });
  
  isLoading.value = false;
  
  if (result.error) {
    if (result.error.message.includes('doğrulama') || result.error.message.includes('verification')) {
      needsVerification.value = true;
      verificationEmail.value = form.value.email;
    } else {
      serverError.value = result.error.message;
    }
    return;
  }
  
  if (result.data) {
    authStore.setAuth(result.data);
    router.push('/dashboard');
  }
}

// Resend verification
const resendLoading = ref(false);
const resendMessage = ref('');

async function resendVerification() {
  resendLoading.value = true;
  resendMessage.value = '';
  
  const result = await api.resendVerification(verificationEmail.value);
  
  resendLoading.value = false;
  
  if (result.error) {
    resendMessage.value = result.error.message;
    return;
  }
  
  resendMessage.value = 'Doğrulama emaili gönderildi';
}
</script>

<template>
  <div class="auth-page">
    <header class="auth-header">
      <RouterLink to="/" class="auth-logo">
        <img src="@/assets/images/logo.png" alt="Çay Hesabım Logo" class="auth-logo-img" />
      </RouterLink>
      <RouterLink to="/register" class="btn btn-secondary">
        Hesabınız yok mu? Kayıt Olun
      </RouterLink>
    </header>
    
    <main class="auth-container">
      <div class="auth-card card card-elevated">
        <h1 class="auth-title">Giriş Yap</h1>
        <p class="auth-subtitle">Hesabınıza giriş yapın</p>
        
        <!-- Server Error -->
        <div v-if="serverError" class="message-box message-box-error">
          <span>❌</span>
          <span>{{ serverError }}</span>
        </div>
        
        <!-- Verification Required -->
        <div v-if="needsVerification" class="message-box message-box-warning">
          <div class="verification-warning">
            <p><strong>⚠️ Email Doğrulaması Gerekli</strong></p>
            <p>Hesabınız henüz doğrulanmamış. Lütfen email adresinize gönderilen doğrulama linkine tıklayın.</p>
            <button 
              class="btn btn-link" 
              @click="resendVerification"
              :disabled="resendLoading"
            >
              {{ resendLoading ? 'Gönderiliyor...' : 'Doğrulama Emailini Tekrar Gönder' }}
            </button>
            <p v-if="resendMessage" class="resend-result">{{ resendMessage }}</p>
          </div>
        </div>
        
        <form @submit.prevent="handleSubmit" novalidate>
          <!-- Email -->
          <div class="form-group">
            <label class="form-label" for="email">Email Adresi</label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              class="form-input"
              :class="{ 'has-error': errors.email }"
              placeholder="ahmet@example.com"
              autocomplete="email"
              @blur="validateField('email')"
            />
            <p v-if="errors.email" class="form-error">{{ errors.email }}</p>
          </div>
          
          <!-- Password -->
          <div class="form-group">
            <div class="password-header">
              <label class="form-label" for="password">Şifre</label>
              <RouterLink to="/forgot-password" class="forgot-link">
                Şifrenizi mi unuttunuz?
              </RouterLink>
            </div>
            <div class="password-wrapper">
              <input
                id="password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                class="form-input"
                :class="{ 'has-error': errors.password }"
                placeholder="Şifrenizi giriniz"
                autocomplete="current-password"
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
            <p v-if="errors.password" class="form-error">{{ errors.password }}</p>
          </div>
          
          <!-- Remember Me -->
          <div class="form-group">
            <div class="checkbox-wrapper">
              <input
                id="rememberMe"
                v-model="form.rememberMe"
                type="checkbox"
                class="checkbox"
              />
              <label class="checkbox-label" for="rememberMe">
                Beni Hatırla
              </label>
            </div>
          </div>
          
          <!-- Submit -->
          <button type="submit" class="btn btn-primary btn-lg btn-block" :disabled="isLoading">
            <span v-if="isLoading" class="spinner"></span>
            {{ isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap' }}
          </button>
        </form>
        
        <p class="auth-footer">
          Hesabınız yok mu?
          <RouterLink to="/register">Kayıt Olun</RouterLink>
        </p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.password-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.password-header .form-label {
  margin-bottom: 0;
}

.forgot-link {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
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

.verification-warning {
  width: 100%;
}

.verification-warning p {
  margin-bottom: var(--space-2);
}

.verification-warning .btn-link {
  padding: 0;
  margin-top: var(--space-2);
}

.resend-result {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
}
</style>
