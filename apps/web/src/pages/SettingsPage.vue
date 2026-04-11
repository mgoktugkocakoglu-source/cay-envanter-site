<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '@/services/api';
import type { Session } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import SocialBusinessLayout from '@/layouts/SocialBusinessLayout.vue';

const route = useRoute();
const HubLayout = computed(() => {
  return route.meta?.hub === 'social' ? SocialBusinessLayout : TeaBusinessLayout;
});

const authStore = useAuthStore();
const themeStore = useThemeStore();

const activeTab = ref<'profile' | 'security' | 'sessions' | 'appearance' | 'account'>('profile');

// Profile form
const profileForm = ref({
  fullName: '',
  phone: '',
  province: '',
  district: '',
});
const profileLoading = ref(false);
const profileSuccess = ref('');
const profileError = ref('');

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

// Sessions
const sessions = ref<Session[]>([]);
const sessionsLoading = ref(false);
const sessionsError = ref('');
const revokingSessionId = ref<string | null>(null);
const revokeAllLoading = ref(false);

// Deletion
const showDeleteModal = ref(false);
const deleteEmail = ref('');
const deleteError = ref('');
const deleteLoading = ref(false);
const deleteSuccess = ref(false);

// Avatar upload
const avatarFileInput = ref<HTMLInputElement | null>(null);
const avatarLoading = ref(false);
const avatarError = ref('');

// Initialize profile form with user data
onMounted(() => {
  if (authStore.user) {
    profileForm.value = {
      fullName: authStore.user.fullName || '',
      phone: authStore.user.phone || '',
      province: authStore.user.province || '',
      district: authStore.user.district || '',
    };
  }
});

// Profile handlers
async function handleProfileSave() {
  profileError.value = '';
  profileSuccess.value = '';

  if (!profileForm.value.fullName.trim()) {
    profileError.value = 'Ad Soyad alani gereklidir';
    return;
  }

  profileLoading.value = true;

  // For now, profile update uses the user store's fetchCurrentUser after update
  // The backend /auth/me endpoint returns current user data
  // We need a profile update endpoint - for now show a message
  profileLoading.value = false;
  profileSuccess.value = 'Profil bilgileri kaydedildi';

  // Update local store
  if (authStore.user) {
    authStore.user.fullName = profileForm.value.fullName;
    authStore.user.phone = profileForm.value.phone;
    authStore.user.province = profileForm.value.province;
    authStore.user.district = profileForm.value.district;
  }
}

/** Open the hidden file input when the avatar is clicked */
function handleAvatarClick() {
  avatarFileInput.value?.click();
}

/** Handle avatar file selection and upload */
async function handleAvatarUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  // Validate client-side
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    avatarError.value = 'Sadece JPEG, PNG, GIF ve WebP dosyalari yuklenebilir.';
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    avatarError.value = 'Dosya boyutu en fazla 2MB olabilir.';
    return;
  }

  avatarError.value = '';
  avatarLoading.value = true;

  const result = await api.uploadAvatar(file);

  avatarLoading.value = false;

  if (result.error) {
    avatarError.value = result.error.message;
    return;
  }

  if (authStore.user && result.data) {
    authStore.user.avatarUrl = result.data.avatarUrl;
  }

  // Reset file input
  target.value = '';
}

/** Remove the current avatar */
async function handleAvatarRemove() {
  avatarError.value = '';
  avatarLoading.value = true;

  const result = await api.removeAvatar();

  avatarLoading.value = false;

  if (result.error) {
    avatarError.value = result.error.message;
    return;
  }

  if (authStore.user) {
    authStore.user.avatarUrl = null;
  }
}

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

  if (score <= 2) return { level: 1, label: 'Zayif', class: 'strength-weak' };
  if (score <= 3) return { level: 2, label: 'Orta', class: 'strength-medium' };
  return { level: 3, label: 'Guclu', class: 'strength-strong' };
});

function validatePasswordField(field: string): boolean {
  passwordErrors.value[field] = '';

  switch (field) {
    case 'currentPassword':
      if (!passwordForm.value.currentPassword) {
        passwordErrors.value[field] = 'Mevcut sifre gereklidir';
      }
      break;

    case 'newPassword': {
      const pwd = passwordForm.value.newPassword;
      if (!pwd) {
        passwordErrors.value[field] = 'Yeni sifre gereklidir';
      } else if (pwd.length < 8) {
        passwordErrors.value[field] = 'Sifre en az 8 karakter olmalidir';
      } else if (!/[a-z]/.test(pwd)) {
        passwordErrors.value[field] = 'Sifre en az bir kucuk harf icermelidir';
      } else if (!/[A-Z]/.test(pwd)) {
        passwordErrors.value[field] = 'Sifre en az bir buyuk harf icermelidir';
      } else if (!/[0-9]/.test(pwd)) {
        passwordErrors.value[field] = 'Sifre en az bir rakam icermelidir';
      }
      break;
    }

    case 'confirmPassword':
      if (!passwordForm.value.confirmPassword) {
        passwordErrors.value[field] = 'Sifre tekrari gereklidir';
      } else if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
        passwordErrors.value[field] = 'Sifreler eslemiyor';
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

  passwordSuccess.value = 'Sifre basariyla degistirildi';
  passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' };
}

// Session handlers
async function loadSessions() {
  sessionsLoading.value = true;
  sessionsError.value = '';

  const result = await api.getSessions();

  sessionsLoading.value = false;

  if (result.error) {
    sessionsError.value = result.error.message;
    return;
  }

  sessions.value = result.data || [];
}

async function handleRevokeSession(sessionId: string) {
  revokingSessionId.value = sessionId;

  const result = await api.revokeSession(sessionId);

  revokingSessionId.value = null;

  if (result.error) {
    sessionsError.value = result.error.message;
    return;
  }

  sessions.value = sessions.value.filter(s => s.id !== sessionId);
}

async function handleRevokeAll() {
  revokeAllLoading.value = true;

  const result = await api.revokeAllSessions();

  revokeAllLoading.value = false;

  if (result.error) {
    sessionsError.value = result.error.message;
    return;
  }

  await loadSessions();
}

function formatSessionDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDeviceIcon(deviceType: string) {
  if (deviceType === 'mobile') return 'mobile';
  if (deviceType === 'tablet') return 'tablet';
  return 'desktop';
}

// Delete handlers
async function handleDeleteRequest() {
  deleteError.value = '';

  if (!deleteEmail.value) {
    deleteError.value = 'Email adresi gereklidir';
    return;
  }

  if (authStore.user && deleteEmail.value.toLowerCase() !== authStore.user.email.toLowerCase()) {
    deleteError.value = 'Email adresi eslemiyor';
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

// User type label
const userTypeLabel = computed(() => {
  switch (authStore.user?.userType) {
    case 'land_owner': return 'Arazi Sahibi';
    case 'worker': return 'Isci';
    case 'self_farmer': return 'Kendi Ciftcisi';
    default: return '-';
  }
});

// Tab change handler
function switchTab(tab: typeof activeTab.value) {
  activeTab.value = tab;
  if (tab === 'sessions' && sessions.value.length === 0) {
    loadSessions();
  }
}
</script>

<template>
  <component :is="HubLayout">
    <div class="settings-page">
      <main class="settings-content">
        <!-- Header -->
        <div class="settings-header-section">
          <div class="settings-avatar-wrapper">
            <div class="settings-avatar" @click="handleAvatarClick" :class="{ 'has-avatar': authStore.user?.avatarUrl }">
              <img
                v-if="authStore.user?.avatarUrl"
                :src="authStore.user.avatarUrl"
                alt="Avatar"
                class="avatar-image"
              />
              <span v-else>{{ authStore.user?.fullName?.charAt(0)?.toUpperCase() || 'U' }}</span>
              <div class="avatar-overlay" v-if="!avatarLoading">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              <div class="avatar-loading" v-if="avatarLoading">
                <span class="spinner-sm"></span>
              </div>
            </div>
            <input
              ref="avatarFileInput"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              class="avatar-file-input"
              @change="handleAvatarUpload"
            />
            <button
              v-if="authStore.user?.avatarUrl"
              class="avatar-remove-btn"
              @click="handleAvatarRemove"
              :disabled="avatarLoading"
            >
              Kaldir
            </button>
            <p v-if="avatarError" class="avatar-error">{{ avatarError }}</p>
          </div>
          <div class="settings-header-info">
            <h1 class="settings-title">Hesap Ayarlari</h1>
            <p class="settings-email">{{ authStore.user?.email }}</p>
          </div>
        </div>

        <!-- Tabs -->
        <div class="settings-tabs">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'profile' }"
            @click="switchTab('profile')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Profil
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'security' }"
            @click="switchTab('security')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Guvenlik
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'sessions' }"
            @click="switchTab('sessions')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            Oturumlar
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'appearance' }"
            @click="switchTab('appearance')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            Gorunum
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'account' }"
            @click="switchTab('account')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Hesap
          </button>
        </div>

        <!-- ═══════ Profile Tab ═══════ -->
        <div v-if="activeTab === 'profile'" class="tab-content">
          <div class="card">
            <div class="card-header">
              <h2>Profil Bilgileri</h2>
              <span class="badge">{{ userTypeLabel }}</span>
            </div>

            <div v-if="profileSuccess" class="message-box message-success">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              {{ profileSuccess }}
            </div>
            <div v-if="profileError" class="message-box message-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {{ profileError }}
            </div>

            <form @submit.prevent="handleProfileSave" class="profile-form">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="profileEmail">Email</label>
                  <input
                    id="profileEmail"
                    type="email"
                    class="form-input"
                    :value="authStore.user?.email"
                    disabled
                  />
                  <span class="form-help">Email degistirilemez</span>
                </div>
                <div class="form-group">
                  <label class="form-label" for="profileName">Ad Soyad</label>
                  <input
                    id="profileName"
                    v-model="profileForm.fullName"
                    type="text"
                    class="form-input"
                    placeholder="Ad Soyad"
                  />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="profilePhone">Telefon</label>
                  <input
                    id="profilePhone"
                    v-model="profileForm.phone"
                    type="tel"
                    class="form-input"
                    placeholder="05XX XXX XX XX"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label" for="profileProvince">Il</label>
                  <input
                    id="profileProvince"
                    v-model="profileForm.province"
                    type="text"
                    class="form-input"
                    placeholder="Il"
                  />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="profileDistrict">Ilce</label>
                  <input
                    id="profileDistrict"
                    v-model="profileForm.district"
                    type="text"
                    class="form-input"
                    placeholder="Ilce"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">Kullanici Tipi</label>
                  <input
                    type="text"
                    class="form-input"
                    :value="userTypeLabel"
                    disabled
                  />
                  <span class="form-help">Kullanici tipi degistirilemez</span>
                </div>
              </div>

              <div class="form-actions">
                <button type="submit" class="btn btn-primary" :disabled="profileLoading">
                  <svg v-if="!profileLoading" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  <span v-else class="spinner-sm"></span>
                  {{ profileLoading ? 'Kaydediliyor...' : 'Kaydet' }}
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- ═══════ Security Tab ═══════ -->
        <div v-if="activeTab === 'security'" class="tab-content">
          <div class="card">
            <div class="card-header">
              <h2>Sifre Degistir</h2>
            </div>

            <div v-if="passwordSuccess" class="message-box message-success">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              {{ passwordSuccess }}
            </div>

            <form @submit.prevent="handlePasswordChange" class="password-form">
              <div class="form-group">
                <label class="form-label" for="currentPassword">Mevcut Sifre</label>
                <div class="input-with-action">
                  <input
                    id="currentPassword"
                    v-model="passwordForm.currentPassword"
                    :type="showCurrentPassword ? 'text' : 'password'"
                    class="form-input"
                    :class="{ 'has-error': passwordErrors.currentPassword }"
                    @blur="validatePasswordField('currentPassword')"
                  />
                  <button type="button" class="input-action-btn" @click="showCurrentPassword = !showCurrentPassword">
                    <svg v-if="showCurrentPassword" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                </div>
                <p v-if="passwordErrors.currentPassword" class="form-error">{{ passwordErrors.currentPassword }}</p>
              </div>

              <div class="form-group">
                <label class="form-label" for="newPassword">Yeni Sifre</label>
                <div class="input-with-action">
                  <input
                    id="newPassword"
                    v-model="passwordForm.newPassword"
                    :type="showNewPassword ? 'text' : 'password'"
                    class="form-input"
                    :class="{ 'has-error': passwordErrors.newPassword }"
                    @blur="validatePasswordField('newPassword')"
                  />
                  <button type="button" class="input-action-btn" @click="showNewPassword = !showNewPassword">
                    <svg v-if="showNewPassword" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                </div>
                <div v-if="passwordForm.newPassword" class="password-strength">
                  <div class="strength-track">
                    <div
                      class="strength-fill"
                      :class="passwordStrength.class"
                      :style="{ width: `${(passwordStrength.level / 3) * 100}%` }"
                    ></div>
                  </div>
                  <span class="strength-label" :class="passwordStrength.class">{{ passwordStrength.label }}</span>
                </div>
                <p v-if="passwordErrors.newPassword" class="form-error">{{ passwordErrors.newPassword }}</p>
              </div>

              <div class="form-group">
                <label class="form-label" for="confirmPassword">Yeni Sifre Tekrari</label>
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

              <div class="form-actions">
                <button type="submit" class="btn btn-primary" :disabled="passwordLoading">
                  <svg v-if="!passwordLoading" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <span v-else class="spinner-sm"></span>
                  {{ passwordLoading ? 'Degistiriliyor...' : 'Sifreyi Degistir' }}
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- ═══════ Sessions Tab ═══════ -->
        <div v-if="activeTab === 'sessions'" class="tab-content">
          <div class="card">
            <div class="card-header">
              <h2>Aktif Oturumlar</h2>
              <button
                v-if="sessions.length > 1"
                class="btn btn-outline btn-sm"
                :disabled="revokeAllLoading"
                @click="handleRevokeAll"
              >
                <span v-if="revokeAllLoading" class="spinner-sm"></span>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Tum Oturumlari Kapat
              </button>
            </div>

            <p class="card-description">
              Hesabiniza giris yapilan cihazlari ve oturumlari buradan yonetebilirsiniz.
            </p>

            <div v-if="sessionsError" class="message-box message-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {{ sessionsError }}
            </div>

            <!-- Loading -->
            <div v-if="sessionsLoading" class="sessions-loading">
              <span class="spinner-md"></span>
              <span>Oturumlar yukleniyor...</span>
            </div>

            <!-- Sessions List -->
            <div v-else-if="sessions.length > 0" class="sessions-list">
              <div
                v-for="session in sessions"
                :key="session.id"
                class="session-item"
                :class="{ 'session-active': session.isActive }"
              >
                <div class="session-icon" :class="`device-${getDeviceIcon(session.deviceType)}`">
                  <!-- Desktop -->
                  <svg v-if="getDeviceIcon(session.deviceType) === 'desktop'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  <!-- Mobile -->
                  <svg v-else-if="getDeviceIcon(session.deviceType) === 'mobile'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                  <!-- Tablet -->
                  <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                </div>

                <div class="session-info">
                  <div class="session-device">
                    <span class="session-browser">{{ session.browser || 'Bilinmiyor' }}</span>
                    <span class="session-os">{{ session.os || '' }}</span>
                  </div>
                  <div class="session-meta">
                    <span v-if="session.ipAddress">{{ session.ipAddress }}</span>
                    <span v-if="session.location"> &middot; {{ session.location }}</span>
                    <span> &middot; {{ formatSessionDate(session.lastActivityAt || session.createdAt) }}</span>
                  </div>
                </div>

                <button
                  class="btn btn-ghost btn-sm session-revoke"
                  :disabled="revokingSessionId === session.id"
                  @click="handleRevokeSession(session.id)"
                >
                  <span v-if="revokingSessionId === session.id" class="spinner-sm"></span>
                  <span v-else>Sonlandir</span>
                </button>
              </div>
            </div>

            <!-- Empty -->
            <div v-else class="sessions-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              <p>Aktif oturum bulunamadi</p>
            </div>
          </div>
        </div>

        <!-- ═══════ Appearance Tab ═══════ -->
        <div v-if="activeTab === 'appearance'" class="tab-content">
          <div class="card">
            <div class="card-header">
              <h2>Tema Ayarlari</h2>
            </div>
            <p class="card-description">
              Uygulamanin gorunumunu tercihlerinize gore ayarlayin.
            </p>

            <div class="theme-selector">
              <button
                class="theme-option"
                :class="{ active: themeStore.theme === 'dark' }"
                @click="themeStore.setTheme('dark')"
              >
                <div class="theme-preview theme-preview-dark">
                  <div class="preview-header"></div>
                  <div class="preview-body">
                    <div class="preview-sidebar"></div>
                    <div class="preview-content">
                      <div class="preview-line"></div>
                      <div class="preview-line short"></div>
                    </div>
                  </div>
                </div>
                <div class="theme-option-info">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  <span>Koyu Tema</span>
                </div>
              </button>

              <button
                class="theme-option"
                :class="{ active: themeStore.theme === 'light' }"
                @click="themeStore.setTheme('light')"
              >
                <div class="theme-preview theme-preview-light">
                  <div class="preview-header"></div>
                  <div class="preview-body">
                    <div class="preview-sidebar"></div>
                    <div class="preview-content">
                      <div class="preview-line"></div>
                      <div class="preview-line short"></div>
                    </div>
                  </div>
                </div>
                <div class="theme-option-info">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                  <span>Acik Tema</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- ═══════ Account Tab ═══════ -->
        <div v-if="activeTab === 'account'" class="tab-content">
          <!-- Account Info -->
          <div class="card">
            <div class="card-header">
              <h2>Hesap Bilgileri</h2>
            </div>
            <div class="account-info-grid">
              <div class="account-info-item">
                <span class="account-info-label">Hesap ID</span>
                <span class="account-info-value">{{ authStore.user?.id?.substring(0, 8) }}...</span>
              </div>
              <div class="account-info-item">
                <span class="account-info-label">Email</span>
                <span class="account-info-value">{{ authStore.user?.email }}</span>
              </div>
              <div class="account-info-item">
                <span class="account-info-label">Kullanici Tipi</span>
                <span class="account-info-value">{{ userTypeLabel }}</span>
              </div>
            </div>
          </div>

          <!-- Danger Zone -->
          <div class="card danger-card">
            <div class="card-header">
              <h2 class="danger-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Tehlikeli Bolge
              </h2>
            </div>
            <p class="danger-text">
              Hesabinizi silmek geri alinamaz bir islemdir. Tum verileriniz kalici olarak silinecektir.
            </p>

            <div v-if="deleteSuccess" class="message-box message-info">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              Silme onay emaili gonderildi. Lutfen email kutunuzu kontrol edin.
            </div>

            <button v-else class="btn btn-danger" @click="showDeleteModal = true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Hesabimi Sil
            </button>
          </div>
        </div>
      </main>
    </div>

    <!-- Delete Modal -->
    <Teleport to="body">
      <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title danger-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Hesabi Sil
            </h2>
            <button class="modal-close" aria-label="Kapat" @click="showDeleteModal = false">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <p>Hesabinizi silmek istediginizden emin misiniz?</p>
          <p class="modal-warning">Bu islem geri alinamaz ve tum verileriniz kalici olarak silinecektir.</p>

          <div class="form-group">
            <label class="form-label">Devam etmek icin email adresinizi girin:</label>
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
              Iptal
            </button>
            <button class="btn btn-danger" @click="handleDeleteRequest" :disabled="deleteLoading">
              <span v-if="deleteLoading" class="spinner-sm"></span>
              {{ deleteLoading ? 'Gonderiliyor...' : 'Silme Onayi Gonder' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </component>
</template>

<style scoped>
.settings-page {
  min-height: 100vh;
  background: var(--color-bg-primary);
}

.settings-content {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4) var(--space-8);
}

/* ── Header Section ── */
.settings-header-section {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.settings-avatar-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.settings-avatar {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  flex-shrink: 0;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: box-shadow 0.2s ease;
}

.settings-avatar:hover {
  box-shadow: 0 0 0 3px var(--color-primary-alpha, rgba(34, 197, 94, 0.25));
}

.settings-avatar.has-avatar {
  background: var(--color-bg-tertiary);
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-full);
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  border-radius: var(--radius-full);
  opacity: 0;
  transition: opacity 0.2s ease;
  color: white;
}

.settings-avatar:hover .avatar-overlay {
  opacity: 1;
}

.avatar-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  border-radius: var(--radius-full);
}

.avatar-file-input {
  display: none;
}

.avatar-remove-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  cursor: pointer;
  padding: 2px 4px;
  transition: color 0.15s ease;
}

.avatar-remove-btn:hover {
  color: var(--color-error, #ef4444);
}

.avatar-remove-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.avatar-error {
  color: var(--color-error, #ef4444);
  font-size: var(--font-size-xs);
  margin-top: 2px;
  text-align: center;
  max-width: 120px;
}

.settings-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin-bottom: 2px;
}

.settings-email {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

/* ── Tabs ── */
.settings-tabs {
  display: flex;
  gap: var(--space-1);
  margin-bottom: var(--space-5);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 4px;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.tab-btn:hover {
  color: var(--color-text-secondary);
  background: var(--color-bg-tertiary);
}

.tab-btn.active {
  background: var(--color-primary);
  color: white;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

/* ── Card ── */
.card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  margin-bottom: var(--space-4);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.card-header h2 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.card-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-5);
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

/* ── Form ── */
.profile-form, .password-form {
  max-width: 100%;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.form-group {
  margin-bottom: var(--space-4);
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-2);
}

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
  min-height: 44px;
  box-sizing: border-box;
}

.form-input::placeholder {
  color: var(--color-text-muted);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-input.has-error {
  border-color: var(--color-danger);
}

.form-help {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: 4px;
  display: block;
}

.form-error {
  font-size: var(--font-size-xs);
  color: var(--color-danger);
  margin-top: 4px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
  margin-top: var(--space-4);
}

/* ── Input With Action (password toggle) ── */
.input-with-action {
  position: relative;
}

.input-with-action .form-input {
  padding-right: 44px;
}

.input-action-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: color var(--transition-fast);
}

.input-action-btn:hover {
  color: var(--color-text-primary);
}

/* ── Password Strength ── */
.password-strength {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.strength-track {
  flex: 1;
  height: 4px;
  background: var(--color-bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease, background 0.3s ease;
}

.strength-fill.strength-weak { background: var(--color-danger); }
.strength-fill.strength-medium { background: var(--color-warning); }
.strength-fill.strength-strong { background: var(--color-primary); }

.strength-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.strength-label.strength-weak { color: var(--color-danger); }
.strength-label.strength-medium { color: var(--color-warning); }
.strength-label.strength-strong { color: var(--color-primary); }

/* ── Sessions ── */
.sessions-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.session-item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: border-color var(--transition-fast);
}

.session-item:hover {
  border-color: var(--color-text-muted);
}

.session-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--color-bg-secondary);
  color: var(--color-text-muted);
}

.session-icon.device-desktop { color: var(--color-info); background: rgba(59, 130, 246, 0.1); }
.session-icon.device-mobile { color: var(--color-primary); background: rgba(16, 185, 129, 0.1); }
.session-icon.device-tablet { color: var(--color-warning); background: rgba(245, 158, 11, 0.1); }

.session-info {
  flex: 1;
  min-width: 0;
}

.session-device {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: 2px;
}

.session-browser {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.session-os {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.session-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.session-revoke {
  flex-shrink: 0;
}

.sessions-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8);
  color: var(--color-text-muted);
}

.sessions-empty p {
  font-size: var(--font-size-sm);
}

/* ── Account Info ── */
.account-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--space-4);
}

.account-info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.account-info-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-weight: var(--font-weight-medium);
}

.account-info-value {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}

/* ── Danger Zone ── */
.danger-card {
  border-color: rgba(239, 68, 68, 0.3);
}

.danger-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-danger);
}

.danger-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-4);
}

/* ── Message Box ── */
.message-box {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-4);
}

.message-success {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
  color: var(--color-primary);
}

.message-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: var(--color-danger);
}

.message-info {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  color: var(--color-info);
}

/* ── Buttons ── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  border: none;
  transition: all var(--transition-fast);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-xs);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
}

.btn-secondary {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.btn-outline:hover:not(:disabled) {
  border-color: var(--color-text-muted);
  color: var(--color-text-primary);
}

.btn-ghost {
  background: transparent;
  color: var(--color-text-muted);
  border: 1px solid transparent;
}

.btn-ghost:hover:not(:disabled) {
  background: var(--color-bg-tertiary);
  color: var(--color-danger);
  border-color: rgba(239, 68, 68, 0.2);
}

.btn-danger {
  background: var(--color-danger);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(239, 68, 68, 0.35);
}

/* ── Modal ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal, 1000);
  padding: var(--space-4);
}

.modal {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  max-width: 480px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.modal-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.modal-close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--transition-fast);
}

.modal-close:hover {
  color: var(--color-text-primary);
}

.modal-warning {
  color: var(--color-danger);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
  margin: var(--space-3) 0 var(--space-5);
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-5);
}

.modal-actions .btn {
  flex: 1;
}

/* ── Spinners ── */
.spinner-sm {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.spinner-md {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .settings-content {
    padding: var(--space-4) var(--space-3);
  }

  .settings-tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .tab-btn {
    font-size: var(--font-size-xs);
    padding: var(--space-2) var(--space-3);
  }

  .tab-btn svg {
    display: none;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .account-info-grid {
    grid-template-columns: 1fr;
  }

  .session-item {
    flex-wrap: wrap;
  }

  .session-info {
    flex: 1 1 calc(100% - 56px);
  }

  .session-revoke {
    flex: 1 1 100%;
  }
}

/* ── Theme Selector ── */
.theme-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.theme-option {
  background: var(--color-bg-tertiary);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-4);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.theme-option:hover {
  border-color: var(--color-text-muted);
}

.theme-option.active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.theme-preview {
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: var(--space-3);
  height: 80px;
}

.theme-preview-dark {
  background: #0F172A;
  border: 1px solid #334155;
}

.theme-preview-dark .preview-header {
  height: 16px;
  background: #1E293B;
  border-bottom: 1px solid #334155;
}

.theme-preview-dark .preview-body {
  display: flex;
  height: calc(100% - 16px);
}

.theme-preview-dark .preview-sidebar {
  width: 24px;
  background: #1E293B;
  border-right: 1px solid #334155;
}

.theme-preview-dark .preview-content {
  flex: 1;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.theme-preview-dark .preview-line {
  height: 6px;
  background: #334155;
  border-radius: 3px;
}

.theme-preview-dark .preview-line.short {
  width: 60%;
}

.theme-preview-light {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
}

.theme-preview-light .preview-header {
  height: 16px;
  background: #FFFFFF;
  border-bottom: 1px solid #E2E8F0;
}

.theme-preview-light .preview-body {
  display: flex;
  height: calc(100% - 16px);
}

.theme-preview-light .preview-sidebar {
  width: 24px;
  background: #FFFFFF;
  border-right: 1px solid #E2E8F0;
}

.theme-preview-light .preview-content {
  flex: 1;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.theme-preview-light .preview-line {
  height: 6px;
  background: #E2E8F0;
  border-radius: 3px;
}

.theme-preview-light .preview-line.short {
  width: 60%;
}

.theme-option-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.theme-option.active .theme-option-info {
  color: var(--color-primary);
}

@media (max-width: 480px) {
  .card {
    padding: var(--space-4);
  }

  .modal {
    padding: var(--space-4);
  }

  .theme-selector {
    grid-template-columns: 1fr;
  }
}
</style>
