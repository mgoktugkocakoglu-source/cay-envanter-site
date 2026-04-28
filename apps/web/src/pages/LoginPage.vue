<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import AppInput from '@/components/ui/AppInput.vue';
import AppPasswordInput from '@/components/ui/AppPasswordInput.vue';
import AppCheckbox from '@/components/ui/AppCheckbox.vue';
import AppButton from '@/components/ui/AppButton.vue';

const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();

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
    authStore.setAuth(result.data as { accessToken: string; refreshToken: string; user: any; });
    router.push('/hub');
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
        <img v-if="themeStore.theme === 'dark'" src="@/assets/images/logo-dark.svg" alt="Çay Hesabım Logo" class="auth-logo-img" />
        <img v-else src="@/assets/images/logo-light.svg" alt="Çay Hesabım Logo" class="auth-logo-img" />
      </RouterLink>
      <RouterLink to="/register" class="btn btn-secondary auth-header-cta">
        <span class="auth-cta-prefix">Hesabınız yok mu?</span>
        <span>Kayıt Olun</span>
      </RouterLink>
    </header>

    <main class="auth-container">
      <div class="auth-card card card-elevated">
        <h1 class="auth-title">Giriş Yap</h1>
        <p class="auth-subtitle">Hesabınıza giriş yapın</p>

        <!-- Server Error -->
        <div v-if="serverError" class="message-box message-box-error">
          <span>&#10060;</span>
          <span>{{ serverError }}</span>
        </div>

        <!-- Verification Required -->
        <div v-if="needsVerification" class="message-box message-box-warning">
          <div class="verification-warning">
            <p><strong>&#9888;&#65039; Email Doğrulaması Gerekli</strong></p>
            <p>Hesabınız henüz doğrulanmamış. Lütfen email adresinize gönderilen doğrulama linkine tıklayın.</p>
            <AppButton
              variant="link"
              @click="resendVerification"
              :loading="resendLoading"
            >
              Doğrulama Emailini Tekrar Gönder
            </AppButton>
            <p v-if="resendMessage" class="resend-result">{{ resendMessage }}</p>
          </div>
        </div>

        <form @submit.prevent="handleSubmit" novalidate>
          <!-- Email -->
          <div class="form-group">
            <AppInput
              v-model="form.email"
              label="Email Adresi"
              type="email"
              placeholder="ahmet@example.com"
              :error="errors.email"
              autocomplete="email"
              @blur="validateField('email')"
            />
          </div>

          <!-- Password -->
          <div class="form-group">
            <div class="password-header">
              <span class="form-label-text">Şifre</span>
              <RouterLink to="/forgot-password" class="forgot-link">
                Şifrenizi mi unuttunuz?
              </RouterLink>
            </div>
            <AppPasswordInput
              v-model="form.password"
              placeholder="Şifrenizi giriniz"
              :error="errors.password"
              @blur="validateField('password')"
            />
          </div>

          <!-- Remember Me -->
          <div class="form-group">
            <AppCheckbox
              v-model="form.rememberMe"
              label="Beni Hatırla"
            />
          </div>

          <!-- Submit -->
          <AppButton
            type="submit"
            variant="primary"
            size="lg"
            block
            :loading="isLoading"
          >
            {{ isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap' }}
          </AppButton>
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

.form-label-text {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.forgot-link {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
}

.verification-warning {
  width: 100%;
}

.verification-warning p {
  margin-bottom: var(--space-2);
}

.resend-result {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
}
</style>
