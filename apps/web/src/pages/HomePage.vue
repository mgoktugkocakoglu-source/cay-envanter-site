<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();
</script>

<template>
  <div class="home-page">
    <header class="home-header">
      <RouterLink to="/" class="auth-logo">
        <span class="auth-logo-icon">🍃</span>
        <span>Çay Platformu</span>
      </RouterLink>
      <nav class="home-nav">
        <!-- Show different buttons based on auth state -->
        <template v-if="authStore.isAuthenticated">
          <RouterLink to="/dashboard" class="btn btn-secondary">Panel</RouterLink>
          <RouterLink to="/settings" class="btn btn-primary">Ayarlar</RouterLink>
        </template>
        <template v-else>
          <RouterLink to="/login" class="btn btn-secondary">Giriş Yap</RouterLink>
          <RouterLink to="/register" class="btn btn-primary">Kayıt Ol</RouterLink>
        </template>
      </nav>
    </header>
    
    <main class="home-hero">
      <div class="hero-content">
        <h1 class="hero-title">
          <span class="hero-highlight">Çay Üreticileri</span> için
          <br>Dijital Platform
        </h1>
        <p class="hero-subtitle">
          Tarlalarınızı yönetin, hasatlarınızı takip edin, diğer üreticilerle bağlantı kurun.
        </p>
        <div class="hero-actions">
          <!-- Show different actions based on auth state -->
          <template v-if="authStore.isAuthenticated">
            <RouterLink to="/dashboard" class="btn btn-primary btn-lg">
              Panele Git
            </RouterLink>
            <RouterLink to="/fields" class="btn btn-secondary btn-lg">
              Tarlalarım
            </RouterLink>
          </template>
          <template v-else>
            <RouterLink to="/register" class="btn btn-primary btn-lg">
              Hemen Başla
            </RouterLink>
            <RouterLink to="/login" class="btn btn-secondary btn-lg">
              Giriş Yap
            </RouterLink>
          </template>
        </div>
      </div>
      
      <div class="hero-visual">
        <div class="visual-card">
          <div class="visual-icon">🌿</div>
          <h3>Tarla Yönetimi</h3>
          <p>Tüm tarlalarınızı tek platformda yönetin</p>
        </div>
        <div class="visual-card">
          <div class="visual-icon">📊</div>
          <h3>Hasat Takibi</h3>
          <p>Verim verilerini analiz edin</p>
        </div>
        <div class="visual-card">
          <div class="visual-icon">🤝</div>
          <h3>Topluluk</h3>
          <p>Diğer üreticilerle deneyim paylaşın</p>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  background: linear-gradient(180deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%);
}

.home-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-8);
  max-width: 1200px;
  margin: 0 auto;
}

.home-nav {
  display: flex;
  gap: var(--space-3);
}

.home-hero {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-16) var(--space-8);
  text-align: center;
}

.hero-content {
  margin-bottom: var(--space-16);
}

.hero-title {
  font-size: var(--font-size-4xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  margin-bottom: var(--space-6);
}

.hero-highlight {
  background: linear-gradient(135deg, var(--color-primary-hover) 0%, var(--color-primary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: var(--font-size-xl);
  color: var(--color-text-secondary);
  max-width: 600px;
  margin: 0 auto var(--space-8);
}

.hero-actions {
  display: flex;
  gap: var(--space-4);
  justify-content: center;
}

.hero-visual {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-6);
}

.visual-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-8) var(--space-6);
  transition: transform var(--transition-normal), box-shadow var(--transition-normal);
}

.visual-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.visual-icon {
  font-size: 48px;
  margin-bottom: var(--space-4);
}

.visual-card h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-2);
}

.visual-card p {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

@media (max-width: 768px) {
  .hero-title {
    font-size: var(--font-size-2xl);
  }
  
  .hero-visual {
    grid-template-columns: 1fr;
  }
  
  .hero-actions {
    flex-direction: column;
  }
}
</style>
