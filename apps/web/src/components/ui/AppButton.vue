<template>
  <button
    :type="type"
    :class="buttonClasses"
    :disabled="disabled || loading"
    v-bind="$attrs"
  >
    <span v-if="loading" class="app-btn-spinner" />
    <slot v-if="!loading" name="icon" />
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'link' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  block?: boolean
  type?: 'button' | 'submit' | 'reset'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  block: false,
  type: 'button',
})

const buttonClasses = computed(() => [
  'app-btn',
  `app-btn--${props.variant}`,
  `app-btn--${props.size}`,
  {
    'app-btn--block': props.block,
    'app-btn--loading': props.loading,
  },
])
</script>

<style scoped>
.app-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-family: var(--font-family);
  font-weight: var(--font-weight-medium);
  line-height: 1;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  user-select: none;
}

.app-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.app-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Sizes */
.app-btn--sm {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  min-height: 36px;
  min-width: 36px;
}

.app-btn--md {
  padding: var(--space-3) var(--space-6);
  font-size: var(--font-size-base);
  min-height: 44px;
  min-width: 44px;
}

.app-btn--lg {
  padding: var(--space-4) var(--space-8);
  font-size: var(--font-size-lg);
  min-height: 52px;
}

/* Variants */
.app-btn--primary {
  background: var(--color-primary);
  color: white;
  border: 1px solid var(--color-primary);
}

.app-btn--primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.app-btn--primary:active:not(:disabled) {
  transform: translateY(0);
}

.app-btn--secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.app-btn--secondary:hover:not(:disabled) {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-strong);
}

.app-btn--danger {
  background: var(--color-danger);
  color: white;
}

.app-btn--danger:hover:not(:disabled) {
  opacity: 0.9;
}

.app-btn--link {
  background: transparent;
  color: var(--color-primary);
  padding-left: var(--space-2);
  padding-right: var(--space-2);
}

.app-btn--link:hover:not(:disabled) {
  color: var(--color-primary-hover);
  text-decoration: underline;
}

.app-btn--ghost {
  background: transparent;
  color: var(--color-text-secondary);
}

.app-btn--ghost:hover:not(:disabled) {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

/* Block */
.app-btn--block {
  width: 100%;
}

/* Loading */
.app-btn--loading {
  position: relative;
}

.app-btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: app-btn-spin 0.8s linear infinite;
}

@keyframes app-btn-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
