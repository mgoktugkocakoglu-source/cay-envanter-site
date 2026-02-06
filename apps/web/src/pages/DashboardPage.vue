<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';
import AppLayout from '@/layouts/AppLayout.vue';

const authStore = useAuthStore();
const router = useRouter();
const fieldCount = ref<number>(0);
const isLoadingFields = ref(true);

const fetchFieldCount = async () => {
  try {
    isLoadingFields.value = true;
    const response = await api.getFields();
    if (response.data) {
      fieldCount.value = response.data.length;
    }
  } catch (error) {
    console.error('Failed to fetch fields:', error);
    fieldCount.value = 0;
  } finally {
    isLoadingFields.value = false;
  }
};

const navigateToFields = () => {
  router.push('/fields');
};

const navigateToCreateField = (event: Event) => {
  event.stopPropagation();
  router.push('/fields/create');
};

const navigateToForum = () => {
  router.push('/forum');
};

onMounted(() => {
  fetchFieldCount();
});
</script>

<template>
  <AppLayout>
    <div class="dashboard-page">
    
    <main class="dashboard-content">
      <div class="welcome-section">
        <h1>Hoş Geldiniz{{ authStore.user ? ', ' + authStore.user.fullName : '' }}!</h1>
        <p>Çay Üreticisi Platformu'na başarıyla giriş yaptınız.</p>
      </div>
      
      <div class="dashboard-grid">
        <div class="dashboard-card clickable-card" @click="navigateToFields">
          <div class="card-icon">🌿</div>
          <h3>Tarlalarım</h3>
          <p v-if="isLoadingFields">Yükleniyor...</p>
          <p v-else-if="fieldCount === 0">Henüz tarla eklenmedi</p>
          <p v-else>{{ fieldCount }} adet tarla kayıtlı</p>
          <button class="btn btn-primary" @click="navigateToCreateField">Tarla Ekle</button>
        </div>
        
        <div class="dashboard-card">
          <div class="card-icon">📊</div>
          <h3>Hasatlarım</h3>
          <p>Henüz hasat kaydı yok</p>
          <button class="btn btn-primary">Hasat Ekle</button>
        </div>
        
        <div class="dashboard-card">
          <div class="card-icon">💬</div>
          <h3>Forum</h3>
          <p>Topluluk ile etkileşim</p>
          <button class="btn btn-secondary" @click="navigateToForum">Foruma Git</button>
        </div>
        
        <div class="dashboard-card">
          <div class="card-icon">⚙️</div>
          <h3>Hesap Ayarları</h3>
          <p>Profil ve güvenlik</p>
          <RouterLink to="/settings" class="btn btn-secondary">Ayarlara Git</RouterLink>
        </div>
      </div>
    </main>
  </div>
  </AppLayout>
</template>

<style scoped>
.dashboard-page {
  min-height: 100vh;
  background: var(--color-bg-primary);
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-8);
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
}

.dashboard-nav {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.nav-link {
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.nav-link:hover {
  color: var(--color-text-primary);
}

.dashboard-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-8);
}

.welcome-section {
  margin-bottom: var(--space-8);
}

.welcome-section h1 {
  font-size: var(--font-size-2xl);
  margin-bottom: var(--space-2);
}

.welcome-section p {
  color: var(--color-text-secondary);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-6);
}

.dashboard-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  text-align: center;
}

.clickable-card {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.clickable-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-icon {
  font-size: 48px;
  margin-bottom: var(--space-4);
}

.dashboard-card h3 {
  font-size: var(--font-size-lg);
  margin-bottom: var(--space-2);
}

.dashboard-card p {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-4);
}
</style>
