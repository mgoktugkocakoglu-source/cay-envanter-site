<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { api } from '@/services/api';

const route = useRoute();
const router = useRouter();

const status = ref<'loading' | 'valid' | 'invalid' | 'success'>('loading');
const userData = ref<Record<string, unknown> | null>(null);
const isDeleting = ref(false);

onMounted(async () => {
  const token = route.query.token as string;
  
  if (!token) {
    status.value = 'invalid';
    return;
  }
  
  const result = await api.validateDeletionToken(token);
  
  if (result.error || !result.data?.valid) {
    status.value = 'invalid';
    return;
  }
  
  userData.value = result.data.userData || null;
  status.value = 'valid';
});

async function confirmDeletion() {
  const token = route.query.token as string;
  isDeleting.value = true;
  
  const result = await api.deleteAccount(token);
  
  isDeleting.value = false;
  
  if (result.error) {
    status.value = 'invalid';
    return;
  }
  
  status.value = 'success';
  
  localStorage.removeItem('auth_token');
  
  setTimeout(() => {
    router.push('/');
  }, 5000);
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
        
        <!-- Invalid -->
        <template v-else-if="status === 'invalid'">
          <div class="status-center">
            <div class="status-icon">❌</div>
            <h1 class="auth-title">Link Süresi Dolmuş</h1>
            <p class="auth-subtitle">Hesap silme linkinizin süresi dolmuş.</p>
            <RouterLink to="/tea/settings" class="btn btn-primary btn-lg btn-block">
              Hesap Ayarlarına Dön
            </RouterLink>
          </div>
        </template>
        
        <!-- Success -->
        <template v-else-if="status === 'success'">
          <div class="status-center">
            <div class="status-icon">✅</div>
            <h1 class="auth-title">Hesap Silindi</h1>
            <p class="auth-subtitle">Hesabınız başarıyla silindi.</p>
            <p class="hint-text">Platformumuzu kullandığınız için teşekkür ederiz.</p>
            <RouterLink to="/" class="btn btn-primary btn-lg btn-block">
              Ana Sayfaya Dön
            </RouterLink>
            <p class="redirect-hint">5 saniye içinde yönlendirileceksiniz...</p>
          </div>
        </template>
        
        <!-- Confirmation -->
        <template v-else>
          <div class="deletion-warning">
            <div class="status-icon danger">❌</div>
            <h1 class="auth-title danger-text">SON UYARI</h1>
            <p class="auth-subtitle">Hesabınızı silmek üzeresiniz.</p>
            
            <div v-if="userData" class="user-info-card">
              <p><strong>Kullanıcı:</strong> {{ userData.fullName }}</p>
              <p><strong>Email:</strong> {{ userData.email }}</p>
              <p><strong>Kayıt Tarihi:</strong> {{ new Date(userData.createdAt as string).toLocaleDateString('tr-TR') }}</p>
            </div>
            
            <div class="danger-box">
              <p><strong>⚠️ Bu işlem GERİ ALINAMAZ!</strong></p>
              <p>Tüm verileriniz kalıcı olarak silinecektir.</p>
            </div>
            
            <div class="action-buttons">
              <RouterLink to="/hub" class="btn btn-secondary btn-lg">
                Hayır, Vazgeç
              </RouterLink>
              <button 
                class="btn btn-danger btn-lg"
                @click="confirmDeletion"
                :disabled="isDeleting"
              >
                {{ isDeleting ? 'Siliniyor...' : 'Evet, Hesabımı Sil' }}
              </button>
            </div>
          </div>
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

.deletion-warning {
  text-align: center;
}

.danger-text {
  color: var(--color-danger);
}

.user-info-card {
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin: var(--space-4) 0;
  text-align: left;
}

.user-info-card p {
  margin: var(--space-2) 0;
  color: var(--color-text-secondary);
}

.danger-box {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin: var(--space-4) 0;
  color: var(--color-danger);
}

.action-buttons {
  display: flex;
  gap: var(--space-4);
  margin-top: var(--space-6);
}

.action-buttons .btn {
  flex: 1;
}

.hint-text {
  color: var(--color-text-muted);
  margin-bottom: var(--space-4);
}

.redirect-hint {
  margin-top: var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
</style>
