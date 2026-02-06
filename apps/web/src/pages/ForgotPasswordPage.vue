<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '@/services/api';

const email = ref('');
const isLoading = ref(false);
const isSuccess = ref(false);
const error = ref('');

async function handleSubmit() {
  if (!email.value) {
    error.value = 'Email adresi gereklidir';
    return;
  }
  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    error.value = 'Geçerli bir email adresi giriniz';
    return;
  }
  
  error.value = '';
  isLoading.value = true;
  
  const result = await api.forgotPassword(email.value);
  
  isLoading.value = false;
  
  if (result.error) {
    error.value = result.error.message;
    return;
  }
  
  isSuccess.value = true;
}
</script>

<template>
  <div class="auth-page">
    <header class="auth-header">
      <RouterLink to="/" class="auth-logo">
        <span class="auth-logo-icon">🍃</span>
        <span>Çay Platformu</span>
      </RouterLink>
      <RouterLink to="/login" class="btn btn-secondary">
        Giriş Sayfasına Dön
      </RouterLink>
    </header>
    
    <main class="auth-container">
      <div class="auth-card card card-elevated">
        <!-- Success State -->
        <template v-if="isSuccess">
          <div class="success-state">
            <div class="status-icon">✉️</div>
            <h1 class="auth-title">Email Gönderildi</h1>
            <p class="auth-subtitle">
              Eğer <strong>{{ email }}</strong> adresi kayıtlı ise, şifre sıfırlama linki gönderildi.
            </p>
            <p class="hint-text">Lütfen email kutunuzu kontrol edin.</p>
            <p class="hint-text">Link 1 saat geçerlidir.</p>
            <RouterLink to="/login" class="btn btn-primary btn-lg btn-block">
              Giriş Sayfasına Dön
            </RouterLink>
          </div>
        </template>
        
        <!-- Form -->
        <template v-else>
          <h1 class="auth-title">Şifre Sıfırlama</h1>
          <p class="auth-subtitle">Kayıtlı email adresinizi girin, size şifre sıfırlama linki gönderelim.</p>
          
          <form @submit.prevent="handleSubmit" novalidate>
            <div class="form-group">
              <label class="form-label" for="email">Email Adresi</label>
              <input
                id="email"
                v-model="email"
                type="email"
                class="form-input"
                :class="{ 'has-error': error }"
                placeholder="ahmet@example.com"
                autocomplete="email"
              />
              <p v-if="error" class="form-error">{{ error }}</p>
            </div>
            
            <button type="submit" class="btn btn-primary btn-lg btn-block" :disabled="isLoading">
              <span v-if="isLoading" class="spinner"></span>
              {{ isLoading ? 'Gönderiliyor...' : 'Sıfırlama Linki Gönder' }}
            </button>
          </form>
          
          <p class="auth-footer">
            Şifrenizi hatırladınız mı?
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
}

.status-icon {
  font-size: 64px;
  margin-bottom: var(--space-4);
}

.hint-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-2);
}

.btn-block {
  margin-top: var(--space-6);
}
</style>
