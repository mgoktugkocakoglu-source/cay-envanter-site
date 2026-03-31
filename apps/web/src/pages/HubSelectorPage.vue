<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();

function goToHub(hub: 'tea' | 'social') {
  localStorage.setItem('cayhesabim_last_hub', hub);
  if (hub === 'tea') {
    router.push('/tea/dashboard');
  } else {
    router.push('/social/dashboard');
  }
}

onMounted(() => {
  // If user has a saved preference, redirect immediately
  const lastHub = localStorage.getItem('cayhesabim_last_hub');
  if (lastHub === 'tea') {
    router.replace('/tea/dashboard');
  } else if (lastHub === 'social') {
    router.replace('/social/dashboard');
  }
});
</script>

<template>
  <div class="hub-selector-page">
    <!-- Background decoration -->
    <div class="bg-decoration">
      <div class="bg-shape bg-shape-1"></div>
      <div class="bg-shape bg-shape-2"></div>
      <div class="bg-shape bg-shape-3"></div>
    </div>

    <!-- Header -->
    <header class="hs-header">
      <div class="hs-logo">
        <img src="@/assets/images/logo.png" alt="Çay Hesabım Logo" class="hs-logo-img" />
      </div>
      <div class="hs-header-right">
        <button
          class="theme-toggle"
          :title="themeStore.theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'"
          @click="themeStore.toggleTheme()"
        >
          <svg v-if="themeStore.theme === 'dark'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
      </div>
    </header>

    <main class="hs-main">
      <div class="hs-greeting">
        <h1 class="hs-title">
          Hoş geldin<span v-if="authStore.user?.fullName">, {{ authStore.user.fullName.split(' ')[0] }}</span> 👋
        </h1>
        <p class="hs-subtitle">Bugün ne yapmak istersin?</p>
      </div>

      <div class="hub-cards">
        <!-- Çay İşleri Hesabı -->
        <button class="hub-card hub-card-tea" @click="goToHub('tea')">
          <div class="hub-card-glow tea-glow"></div>
          <div class="hub-card-icon">🍃</div>
          <div class="hub-card-content">
            <h2 class="hub-card-title">Çay İşleri Hesabı</h2>
            <p class="hub-card-desc">
              Tarlalarını yönet, hasatlarını takip et, ödemelerini kontrol et.
            </p>
            <div class="hub-card-modules">
              <span class="module-chip">🌿 Tarlalarım</span>
              <span class="module-chip">🏭 Firmalar</span>
              <span class="module-chip">📊 Hasatlarım</span>
              <span class="module-chip">💰 Ödemeler</span>
            </div>
          </div>
          <div class="hub-card-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </button>

        <!-- Sosyal İş Hesabı -->
        <button class="hub-card hub-card-social" @click="goToHub('social')">
          <div class="hub-card-glow social-glow"></div>
          <div class="hub-card-icon">🤝</div>
          <div class="hub-card-content">
            <h2 class="hub-card-title">Sosyal İş Hesabı</h2>
            <p class="hub-card-desc">
              İş bul, işçi bul, toplulukla iletişim kur, ekipman değerlendir.
            </p>
            <div class="hub-card-modules">
              <span class="module-chip">💼 İş/İşçi Bul</span>
              <span class="module-chip">👥 Topluluk</span>
              <span class="module-chip">🔧 Ekipman</span>
              <span class="module-chip">🛒 2. El Pazar</span>
            </div>
          </div>
          <div class="hub-card-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.hub-selector-page {
  min-height: 100vh;
  background: var(--color-bg-primary);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

/* ── Background Decoration ── */
.bg-decoration {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.bg-shape {
  position: absolute;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.08;
}
.bg-shape-1 {
  width: 600px;
  height: 600px;
  background: #10B981;
  top: -200px;
  left: -100px;
}
.bg-shape-2 {
  width: 500px;
  height: 500px;
  background: #3B82F6;
  bottom: -200px;
  right: -100px;
}
.bg-shape-3 {
  width: 300px;
  height: 300px;
  background: #F59E0B;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* ── Header ── */
.hs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-8);
  position: relative;
  z-index: 1;
}

.hs-logo-img {
  height: 60px;
  width: auto;
  object-fit: contain;
}

.hs-header-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}
.theme-toggle:hover {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* ── Main Content ── */
.hs-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  position: relative;
  z-index: 1;
}

.hs-greeting {
  text-align: center;
  margin-bottom: var(--space-12);
}

.hs-title {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-3);
  line-height: var(--line-height-tight);
}

.hs-subtitle {
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
}

/* ── Hub Cards ── */
.hub-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-8);
  max-width: 900px;
  width: 100%;
}

.hub-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-5);
  padding: var(--space-8);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  cursor: pointer;
  text-align: left;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.hub-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
}

.hub-card-glow {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.4s;
  pointer-events: none;
}
.tea-glow { background: radial-gradient(circle, rgba(16, 185, 129, 0.06) 0%, transparent 70%); }
.social-glow { background: radial-gradient(circle, rgba(59, 130, 246, 0.06) 0%, transparent 70%); }
.hub-card:hover .hub-card-glow { opacity: 1; }

.hub-card-tea:hover {
  border-color: rgba(16, 185, 129, 0.4);
}
.hub-card-social:hover {
  border-color: rgba(59, 130, 246, 0.4);
}

.hub-card-icon {
  font-size: 48px;
  flex-shrink: 0;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
}
.hub-card-tea .hub-card-icon { background: rgba(16, 185, 129, 0.1); }
.hub-card-social .hub-card-icon { background: rgba(59, 130, 246, 0.1); }

.hub-card-content {
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.hub-card-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.hub-card-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-normal);
  margin-bottom: var(--space-4);
}

.hub-card-modules {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.module-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.hub-card-arrow {
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: all 0.3s;
  position: relative;
  z-index: 1;
}
.hub-card:hover .hub-card-arrow {
  transform: translateX(4px);
}
.hub-card-tea:hover .hub-card-arrow { color: var(--color-primary); }
.hub-card-social:hover .hub-card-arrow { color: var(--color-info); }

/* ── Responsive ── */
@media (max-width: 768px) {
  .hub-cards {
    grid-template-columns: 1fr;
    gap: var(--space-4);
  }

  .hub-card {
    flex-direction: column;
    text-align: center;
    padding: var(--space-6);
  }

  .hub-card-arrow {
    transform: rotate(90deg);
  }
  .hub-card:hover .hub-card-arrow {
    transform: rotate(90deg) translateX(4px);
  }

  .hub-card-modules {
    justify-content: center;
  }

  .hs-title {
    font-size: var(--font-size-2xl);
  }
}
</style>
