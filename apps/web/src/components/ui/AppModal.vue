<template>
  <Teleport to="body">
    <Transition name="app-modal">
      <div
        v-if="modelValue"
        class="app-modal-overlay"
        :class="`app-modal--${size}`"
        role="dialog"
        :aria-modal="true"
        :aria-labelledby="title ? `${modalId}-title` : undefined"
        @click.self="onOverlayClick"
        @keydown.esc="onEscKey"
      >
        <div class="app-modal-container" ref="modalRef" tabindex="-1">
          <div v-if="title || closable" class="app-modal-header">
            <h3 v-if="title" :id="`${modalId}-title`" class="app-modal-title">{{ title }}</h3>
            <button
              v-if="closable"
              type="button"
              class="app-modal-close"
              aria-label="Kapat"
              @click="close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div class="app-modal-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="app-modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, useId } from 'vue'

interface Props {
  modelValue: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg'
  closable?: boolean
  persistent?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  closable: true,
  persistent: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

const modalRef = ref<HTMLElement | null>(null)
const modalId = useId()

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function onOverlayClick() {
  if (!props.persistent) {
    close()
  }
}

function onEscKey() {
  if (!props.persistent && props.closable) {
    close()
  }
}

watch(() => props.modelValue, (val) => {
  if (val) {
    nextTick(() => {
      modalRef.value?.focus()
    })
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

// Cleanup body overflow on unmount in case modal is destroyed while open
import { onBeforeUnmount } from 'vue'
onBeforeUnmount(() => {
  if (props.modelValue) {
    document.body.style.overflow = ''
  }
})
</script>

<style scoped>
.app-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.app-modal-container {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  outline: none;
}

.app-modal--sm .app-modal-container {
  max-width: 400px;
}

.app-modal--md .app-modal-container {
  max-width: 560px;
}

.app-modal--lg .app-modal-container {
  max-width: 720px;
}

.app-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.app-modal-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.app-modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.app-modal-close:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.app-modal-close:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.app-modal-body {
  padding: var(--space-6);
  overflow-y: auto;
  flex: 1;
}

.app-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

/* Transitions */
.app-modal-enter-active,
.app-modal-leave-active {
  transition: opacity var(--transition-normal);
}

.app-modal-enter-active .app-modal-container,
.app-modal-leave-active .app-modal-container {
  transition: transform var(--transition-normal), opacity var(--transition-normal);
}

.app-modal-enter-from,
.app-modal-leave-to {
  opacity: 0;
}

.app-modal-enter-from .app-modal-container,
.app-modal-leave-to .app-modal-container {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}
</style>
