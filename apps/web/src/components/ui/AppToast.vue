<template>
  <Teleport to="body">
    <div class="app-toast-container" aria-live="polite">
      <TransitionGroup name="app-toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="app-toast"
          :class="`app-toast--${toast.type}`"
          role="alert"
        >
          <svg v-if="toast.type === 'success'" class="app-toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <svg v-else-if="toast.type === 'error'" class="app-toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <svg v-else-if="toast.type === 'warning'" class="app-toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <svg v-else class="app-toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span class="app-toast-message">{{ toast.message }}</span>
          <button class="app-toast-close" aria-label="Kapat" @click="remove(toast.id)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '../../composables/useToast'

const { toasts, remove } = useToast()
</script>

<style scoped>
.app-toast-container {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 420px;
  width: 100%;
  pointer-events: none;
}

.app-toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
  backdrop-filter: blur(8px);
}

.app-toast--success {
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid var(--color-success);
  color: var(--color-success);
}

.app-toast--error {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid var(--color-danger);
  color: var(--color-danger);
}

.app-toast--warning {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid var(--color-warning);
  color: var(--color-warning);
}

.app-toast--info {
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid var(--color-info);
  color: var(--color-info);
}

.app-toast-icon {
  flex-shrink: 0;
}

.app-toast-message {
  flex: 1;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-normal);
}

.app-toast-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: currentColor;
  opacity: 0.7;
  cursor: pointer;
  transition: opacity var(--transition-fast);
  flex-shrink: 0;
}

.app-toast-close:hover {
  opacity: 1;
}

/* Transitions */
.app-toast-enter-active {
  transition: all var(--transition-normal);
}

.app-toast-leave-active {
  transition: all var(--transition-fast);
}

.app-toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.app-toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.app-toast-move {
  transition: transform var(--transition-normal);
}

@media (max-width: 480px) {
  .app-toast-container {
    left: var(--space-4);
    right: var(--space-4);
    max-width: none;
  }
}
</style>
