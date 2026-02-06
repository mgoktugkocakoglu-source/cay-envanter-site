<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { api } from '@/services/api';

const route = useRoute();
const router = useRouter();

const status = ref<'loading' | 'success' | 'error' | 'already-verified' | 'token-missing'>('loading');
const errorMessage = ref('');
const resendEmail = ref('');
const showResendForm = ref(false);
const resendLoading = ref(false);
const resendMessage = ref('');

onMounted(async () => {
  const token = route.query.token as string;
  
  if (!token) {
    status.value = 'token-missing';
    return;
  }
  
  const result = await api.verifyEmail(token);
  
  if (result.error) {
    if (result.error.message.includes('zaten doğrulanmış')) {
      status.value = 'already-verified';
    } else {
      status.value = 'error';
      errorMessage.value = result.error.message;
    }
    return;
  }
  
  status.value = 'success';
  
  // Auto-redirect after 3 seconds
  setTimeout(() => {
    router.push('/login');
  }, 3000);
});

async function handleResend() {
  if (!resendEmail.value) {
    resendMessage.value = 'Lütfen email adresinizi giriniz';
    return;
  }
  
  resendLoading.value = true;
  resendMessage.value = '';
  
  const result = await api.resendVerification(resendEmail.value);
  
  resendLoading.value = false;
  
  if (result.error) {
    resendMessage.value = result.error.message;
    return;
  }
  
  resendMessage.value = 'Eğer email kayıtlıysa, yeni link gönderildi';
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
      <div class="auth-card card card-elevated verify-card">
        <!-- Loading -->
        <template v-if="status === 'loading'">
          <div class="status-icon">
            <span class="spinner large"></span>
          </div>
          <h1 class="auth-title">Email Doğrulanıyor...</h1>
          <p class="auth-subtitle">Lütfen bekleyin</p>
        </template>
        
        <!-- Success -->
        <template v-else-if="status === 'success'">
          <div class="status-icon success">✅</div>
          <h1 class="auth-title">Email Doğrulandı!</h1>
          <p class="auth-subtitle">
            Email adresiniz başarıyla doğrulandı.<br>
            Artık platformu kullanmaya başlayabilirsiniz.
          </p>
          <RouterLink to="/login" class="btn btn-primary btn-lg btn-block">
            Giriş Yap
          </RouterLink>
          <p class="redirect-hint">3 saniye içinde yönlendirileceksiniz...</p>
        </template>
        
        <!-- Already Verified -->
        <template v-else-if="status === 'already-verified'">
          <div class="status-icon info">ℹ️</div>
          <h1 class="auth-title">Email Zaten Doğrulandı</h1>
          <p class="auth-subtitle">Bu email adresi daha önce doğrulanmış.</p>
          <RouterLink to="/login" class="btn btn-primary btn-lg btn-block">
            Giriş Yap
          </RouterLink>
        </template>
        
        <!-- Error -->
        <template v-else-if="status === 'error'">
          <div class="status-icon error">❌</div>
          <h1 class="auth-title">Doğrulama Başarısız</h1>
          <p class="auth-subtitle">{{ errorMessage || 'Doğrulama linki geçersiz veya süresi dolmuş.' }}</p>
          
          <button 
            v-if="!showResendForm"
            class="btn btn-primary btn-lg btn-block"
            @click="showResendForm = true"
          >
            Yeni Doğrulama Linki Gönder
          </button>
          
          <div v-else class="resend-form">
            <div class="form-group">
              <label class="form-label" for="resendEmail">Email Adresiniz</label>
              <input
                id="resendEmail"
                v-model="resendEmail"
                type="email"
                class="form-input"
                placeholder="ahmet@example.com"
              />
            </div>
            <button 
              class="btn btn-primary btn-block"
              @click="handleResend"
              :disabled="resendLoading"
            >
              {{ resendLoading ? 'Gönderiliyor...' : 'Gönder' }}
            </button>
            <p v-if="resendMessage" class="resend-message">{{ resendMessage }}</p>
          </div>
        </template>
        
        <!-- Token Missing -->
        <template v-else-if="status === 'token-missing'">
          <div class="status-icon error">❌</div>
          <h1 class="auth-title">Geçersiz Link</h1>
          <p class="auth-subtitle">Doğrulama linki bulunamadı.</p>
          <RouterLink to="/" class="btn btn-primary btn-lg btn-block">
            Ana Sayfaya Dön
          </RouterLink>
        </template>
      </div>
    </main>
  </div>
</template>

<style scoped>
.verify-card {
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
  margin: 0 auto;
}

.redirect-hint {
  margin-top: var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.resend-form {
  margin-top: var(--space-4);
  text-align: left;
}

.resend-message {
  margin-top: var(--space-3);
  text-align: center;
  color: var(--color-success);
}
</style>
