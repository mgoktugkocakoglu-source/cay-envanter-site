<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import AppLayout from '@/layouts/AppLayout.vue';

const router = useRouter();
const authStore = useAuthStore();

const activeTab = ref<'account' | 'security'>('security');

// Password change form
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});
const passwordErrors = ref<Record<string, string>>({});
const passwordLoading = ref(false);
const passwordSuccess = ref('');
const showCurrentPassword = ref(false);
const showNewPassword = ref(false);

// Deletion
const showDeleteModal = ref(false);
const deleteEmail = ref('');
const deleteError = ref('');
const deleteLoading = ref(false);
const deleteSuccess = ref(false);

// Password strength
const passwordStrength = computed(() => {
  const pwd = passwordForm.value.newPassword;
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

function validatePasswordField(field: string): boolean {
  passwordErrors.value[field] = '';
  
  switch (field) {
    case 'currentPassword':
      if (!passwordForm.value.currentPassword) {
        passwordErrors.value[field] = 'Mevcut şifre gereklidir';
      }
      break;
      
    case 'newPassword':
      const pwd = passwordForm.value.newPassword;
      if (!pwd) {
        passwordErrors.value[field] = 'Yeni şifre gereklidir';
      } else if (pwd.length < 8) {
        passwordErrors.value[field] = 'Şifre en az 8 karakter olmalıdır';
      } else if (!/[a-z]/.test(pwd)) {
        passwordErrors.value[field] = 'Şifre en az bir küçük harf içermelidir';
      } else if (!/[A-Z]/.test(pwd)) {
        passwordErrors.value[field] = 'Şifre en az bir büyük harf içermelidir';
      } else if (!/[0-9]/.test(pwd)) {
        passwordErrors.value[field] = 'Şifre en az bir rakam içermelidir';
      }
      break;
      
    case 'confirmPassword':
      if (!passwordForm.value.confirmPassword) {
        passwordErrors.value[field] = 'Şifre tekrarı gereklidir';
      } else if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
        passwordErrors.value[field] = 'Şifreler eşleşmiyor';
      }
      break;
  }
  
  return !passwordErrors.value[field];
}

async function handlePasswordChange() {
  passwordSuccess.value = '';
  
  const fields = ['currentPassword', 'newPassword', 'confirmPassword'];
  if (!fields.every(validatePasswordField)) return;
  
  passwordLoading.value = true;
  
  const result = await api.changePassword(
    passwordForm.value.currentPassword,
    passwordForm.value.newPassword
  );
  
  passwordLoading.value = false;
  
  if (result.error) {
    passwordErrors.value.currentPassword = result.error.message;
    return;
  }
  
  passwordSuccess.value = 'Şifre başarıyla değiştirildi';
  passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' };
}

async function handleDeleteRequest() {
  deleteError.value = '';
  
  if (!deleteEmail.value) {
    deleteError.value = 'Email adresi gereklidir';
    return;
  }
  
  if (authStore.user && deleteEmail.value.toLowerCase() !== authStore.user.email.toLowerCase()) {
    deleteError.value = 'Email adresi eşleşmiyor';
    return;
  }
  
  deleteLoading.value = true;
  
  const result = await api.requestDeletion(deleteEmail.value);
  
  deleteLoading.value = false;
  
  if (result.error) {
    deleteError.value = result.error.message;
    return;
  }
  
  deleteSuccess.value = true;
  showDeleteModal.value = false;
}
</script>

<template>
  <AppLayout>
    <div class="settings-page">
      <main class="settings-content">
      <h1 class="settings-title">Hesap Ayarları</h1>
      
      <!-- Tabs -->
      <div class="settings-tabs">
        <button 
          class="tab-btn"
          :class="{ active: activeTab === 'security' }"
          @click="activeTab = 'security'"
        >
          Güvenlik
        </button>
        <button 
          class="tab-btn"
          :class="{ active: activeTab === 'account' }"
          @click="activeTab = 'account'"
        >
          Hesap
        </button>
      </div>
      
      <!-- Security Tab -->
      <div v-if="activeTab === 'security'" class="settings-section">
        <div class="card">
          <h2>Şifre Değiştirme</h2>
          
          <div v-if="passwordSuccess" class="message-box message-box-success">
            ✅ {{ passwordSuccess }}
          </div>
          
          <form @submit.prevent="handlePasswordChange" class="password-form">
            <div class="form-group">
              <label class="form-label" for="currentPassword">Mevcut Şifre</label>
              <div class="password-wrapper">
                <input
                  id="currentPassword"
                  v-model="passwordForm.currentPassword"
                  :type="showCurrentPassword ? 'text' : 'password'"
                  class="form-input"
                  :class="{ 'has-error': passwordErrors.currentPassword }"
                  @blur="validatePasswordField('currentPassword')"
                />
                <button type="button" class="password-toggle" @click="showCurrentPassword = !showCurrentPassword">
                  {{ showCurrentPassword ? '👁️' : '👁️‍🗨️' }}
                </button>
              </div>
              <p v-if="passwordErrors.currentPassword" class="form-error">{{ passwordErrors.currentPassword }}</p>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="newPassword">Yeni Şifre</label>
              <div class="password-wrapper">
                <input
                  id="newPassword"
                  v-model="passwordForm.newPassword"
                  :type="showNewPassword ? 'text' : 'password'"
                  class="form-input"
                  :class="{ 'has-error': passwordErrors.newPassword }"
                  @blur="validatePasswordField('newPassword')"
                />
                <button type="button" class="password-toggle" @click="showNewPassword = !showNewPassword">
                  {{ showNewPassword ? '👁️' : '👁️‍🗨️' }}
                </button>
              </div>
              <div v-if="passwordForm.newPassword" class="password-strength">
                <div class="password-strength-bar" :class="passwordStrength.class"></div>
              </div>
              <p v-if="passwordErrors.newPassword" class="form-error">{{ passwordErrors.newPassword }}</p>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="confirmPassword">Yeni Şifre Tekrarı</label>
              <input
                id="confirmPassword"
                v-model="passwordForm.confirmPassword"
                type="password"
                class="form-input"
                :class="{ 'has-error': passwordErrors.confirmPassword }"
                @blur="validatePasswordField('confirmPassword')"
              />
              <p v-if="passwordErrors.confirmPassword" class="form-error">{{ passwordErrors.confirmPassword }}</p>
            </div>
            
            <button type="submit" class="btn btn-primary" :disabled="passwordLoading">
              {{ passwordLoading ? 'Değiştiriliyor...' : 'Şifreyi Değiştir' }}
            </button>
          </form>
        </div>
      </div>
      
      <!-- Account Tab -->
      <div v-if="activeTab === 'account'" class="settings-section">
        <div class="card danger-zone">
          <h2>⚠️ Tehlikeli Bölge</h2>
          <p class="danger-text">
            Hesabınızı silmek geri alınamaz bir işlemdir. Tüm verileriniz kalıcı olarak silinecektir.
          </p>
          
          <div v-if="deleteSuccess" class="message-box message-box-info">
            ✉️ Silme onay emaili gönderildi. Lütfen email kutunuzu kontrol edin.
          </div>
          
          <button v-else class="btn btn-danger" @click="showDeleteModal = true">
            Hesabımı Sil
          </button>
        </div>
      </div>
      </main>
    </div>
    
    <!-- Delete Modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
      <div class="modal">
        <h2>❌ Hesabı Sil</h2>
        <p>Hesabınızı silmek istediğinizden emin misiniz?</p>
        <p class="modal-warning">Bu işlem geri alınamaz ve tüm verileriniz kalıcı olarak silinecektir.</p>
        
        <div class="form-group">
          <label class="form-label">Devam etmek için email adresinizi girin:</label>
          <input
            v-model="deleteEmail"
            type="email"
            class="form-input"
            :class="{ 'has-error': deleteError }"
            placeholder="Email adresiniz"
          />
          <p v-if="deleteError" class="form-error">{{ deleteError }}</p>
        </div>
        
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showDeleteModal = false">
            İptal
          </button>
          <button class="btn btn-danger" @click="handleDeleteRequest" :disabled="deleteLoading">
            {{ deleteLoading ? 'Gönderiliyor...' : 'Silme Onayı Gönder' }}
          </button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.settings-page {
  min-height: 100vh;
  background: var(--color-bg-primary);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-8);
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
}

.settings-nav {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.nav-link {
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.settings-content {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--space-8);
}

.settings-title {
  font-size: var(--font-size-2xl);
  margin-bottom: var(--space-6);
}

.settings-tabs {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
}

.tab-btn {
  padding: var(--space-3) var(--space-5);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab-btn:hover {
  background: var(--color-bg-secondary);
}

.tab-btn.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.settings-section .card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
}

.settings-section .card h2 {
  font-size: var(--font-size-lg);
  margin-bottom: var(--space-4);
}

.password-form {
  max-width: 400px;
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
}

.danger-zone {
  border-color: var(--color-danger) !important;
}

.danger-text {
  color: var(--color-text-muted);
  margin-bottom: var(--space-4);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
}

.modal {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  max-width: 480px;
  width: 90%;
}

.modal h2 {
  font-size: var(--font-size-xl);
  margin-bottom: var(--space-4);
}

.modal-warning {
  color: var(--color-danger);
  font-weight: var(--font-weight-medium);
  margin: var(--space-4) 0;
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-6);
}

.modal-actions .btn {
  flex: 1;
}
</style>
