<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <div class="not-found-page">
    <div class="not-found-content">
      <h1 class="not-found-code">404</h1>
      <h2 class="not-found-title">Sayfa Bulunamadı</h2>
      <p class="not-found-message">
        Aradığınız sayfa mevcut değil veya taşınmış olabilir.
      </p>
      <div class="not-found-actions">
        <button class="btn-primary" @click="router.push('/')">
          Ana Sayfaya Dön
        </button>
        <button class="btn-secondary" @click="router.back()">
          Geri Git
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.not-found-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-primary, #f9fafb);
  padding: 24px;
}

.not-found-content {
  text-align: center;
  max-width: 480px;
}

.not-found-code {
  font-size: 120px;
  font-weight: 800;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
  line-height: 1;
}

.not-found-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary, #1a1a2e);
  margin: 16px 0 8px 0;
}

.not-found-message {
  color: var(--color-text-secondary, #6b7280);
  font-size: 16px;
  margin: 0 0 32px 0;
}

.not-found-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn-primary {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: none;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

@media (max-width: 480px) {
  .not-found-code {
    font-size: 80px;
  }

  .not-found-actions {
    flex-direction: column;
  }
}
</style>
