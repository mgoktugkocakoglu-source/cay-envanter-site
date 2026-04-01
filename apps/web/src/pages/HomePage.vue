<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

const authStore = useAuthStore();
const themeStore = useThemeStore();
</script>

<template>
  <div class="home-page">
    <!-- Background decoration -->
    <div class="hp-bg">
      <div class="hp-bg-shape hp-bg-1"></div>
      <div class="hp-bg-shape hp-bg-2"></div>
    </div>

    <header class="home-header">
      <RouterLink to="/" class="auth-logo">
        <img v-if="themeStore.theme === 'dark'" src="@/assets/images/logo-dark.svg" alt="Çay Hesabım Logo" class="home-logo-img" />
        <img v-else src="@/assets/images/logo-light.svg" alt="Çay Hesabım Logo" class="home-logo-img" />
      </RouterLink>
      <nav class="home-nav">
        <template v-if="authStore.isAuthenticated">
          <RouterLink to="/hub" class="btn btn-primary">Panele Git</RouterLink>
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
          Tarlalarınızı yönetin, hasatlarınızı takip edin, iş bulun ve toplulukla bağlantı kurun.
        </p>
        <div class="hero-actions">
          <template v-if="authStore.isAuthenticated">
            <RouterLink to="/hub" class="btn btn-primary btn-lg">
              Panele Git
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
      
      <!-- Two Hub Showcase -->
      <div class="hub-showcase">
        <div class="hub-showcase-card tea-showcase">
          <div class="showcase-icon">🍃</div>
          <h2 class="showcase-title">Çay İşleri Hesabı</h2>
          <p class="showcase-desc">Bahçelerinizi, hasatlarınızı ve ödemelerinizi profesyonelce yönetin</p>
          <div class="showcase-features">
            <span>🌿 Tarla Yönetimi</span>
            <span>📊 Hasat Takibi</span>
            <span>💰 Ödeme Kontrolü</span>
            <span>🏭 Firma Bilgileri</span>
          </div>
        </div>
        
        <div class="hub-showcase-card social-showcase">
          <div class="showcase-icon">🤝</div>
          <h2 class="showcase-title">Sosyal İş Hesabı</h2>
          <p class="showcase-desc">İş bulun, toplulukla iletişim kurun ve ekipmanları değerlendirin</p>
          <div class="showcase-features">
            <span>💼 İş/İşçi Bulma</span>
            <span>👥 Topluluk</span>
            <span>🔧 Ekipman Değerlendirme</span>
            <span>🛒 2. El Pazar</span>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  background: var(--color-bg-primary);
  position: relative;
  overflow: hidden;
}

.hp-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.hp-bg-shape {
  position: absolute;
  border-radius: 50%;
  filter: blur(150px);
  opacity: 0.06;
}
.hp-bg-1 {
  width: 700px;
  height: 700px;
  background: #10B981;
  top: -300px;
  right: -200px;
}
.hp-bg-2 {
  width: 500px;
  height: 500px;
  background: #3B82F6;
  bottom: -200px;
  left: -100px;
}

.home-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-8);
  max-width: 1200px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

.home-logo-img {
  height: 56px;
  width: auto;
  object-fit: contain;
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
  position: relative;
  z-index: 1;
}

.hero-content {
  margin-bottom: var(--space-16);
}

.hero-title {
  font-size: var(--font-size-4xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  margin-bottom: var(--space-6);
  color: var(--color-text-primary);
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
  max-width: 650px;
  margin: 0 auto var(--space-8);
  line-height: var(--line-height-normal);
}

.hero-actions {
  display: flex;
  gap: var(--space-4);
  justify-content: center;
}

/* ── Hub Showcase ── */
.hub-showcase {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-6);
}

.hub-showcase-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-8) var(--space-6);
  text-align: left;
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.hub-showcase-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.tea-showcase:hover { border-color: rgba(16, 185, 129, 0.4); }
.social-showcase:hover { border-color: rgba(59, 130, 246, 0.4); }

.showcase-icon {
  font-size: 40px;
  margin-bottom: var(--space-4);
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
}
.tea-showcase .showcase-icon { background: rgba(16, 185, 129, 0.1); }
.social-showcase .showcase-icon { background: rgba(59, 130, 246, 0.1); }

.showcase-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.showcase-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-5);
  line-height: var(--line-height-normal);
}

.showcase-features {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.showcase-features span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

@media (max-width: 768px) {
  .hero-title {
    font-size: var(--font-size-2xl);
  }
  
  .hub-showcase {
    grid-template-columns: 1fr;
  }
  
  .hero-actions {
    flex-direction: column;
  }

  .home-header {
    padding: var(--space-3) var(--space-4);
  }

  .home-hero {
    padding: var(--space-8) var(--space-4);
  }
}
</style>
