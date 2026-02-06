<template>
  <label class="app-checkbox" :class="{ 'is-disabled': disabled }">
    <input
      :id="id"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      class="app-checkbox-input"
      @change="onChange"
    />
    <span class="app-checkbox-box" :class="{ 'is-checked': modelValue }">
      <svg v-if="modelValue" class="app-checkbox-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
    <span v-if="label || $slots.default" class="app-checkbox-label">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<script setup lang="ts">
interface Props {
  modelValue?: boolean
  label?: string
  disabled?: boolean
  id?: string
}

withDefaults(defineProps<Props>(), {
  modelValue: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.checked)
}
</script>

<style scoped>
.app-checkbox {
  display: inline-flex;
  align-items: flex-start;
  gap: var(--space-3);
  cursor: pointer;
  user-select: none;
}

.app-checkbox.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.app-checkbox-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.app-checkbox-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-tertiary);
  transition: all var(--transition-fast);
  flex-shrink: 0;
  margin-top: 2px;
}

.app-checkbox-input:focus-visible + .app-checkbox-box {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.app-checkbox-box.is-checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.app-checkbox-icon {
  color: white;
}

.app-checkbox-box:hover {
  border-color: var(--color-primary);
}

.app-checkbox-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}
</style>
