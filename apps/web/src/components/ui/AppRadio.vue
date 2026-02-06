<template>
  <label class="app-radio" :class="{ 'is-disabled': disabled }">
    <input
      :id="id"
      type="radio"
      :name="name"
      :value="value"
      :checked="modelValue === value"
      :disabled="disabled"
      class="app-radio-input"
      @change="$emit('update:modelValue', value)"
    />
    <span class="app-radio-circle" :class="{ 'is-checked': modelValue === value }" />
    <span v-if="label || $slots.default" class="app-radio-label">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<script setup lang="ts">
interface Props {
  modelValue?: string | number | null
  value: string | number
  label?: string
  name?: string
  disabled?: boolean
  id?: string
}

withDefaults(defineProps<Props>(), {
  modelValue: null,
  disabled: false,
})

defineEmits<{
  'update:modelValue': [value: string | number]
}>()
</script>

<style scoped>
.app-radio {
  display: inline-flex;
  align-items: flex-start;
  gap: var(--space-3);
  cursor: pointer;
  user-select: none;
}

.app-radio.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.app-radio-input {
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

.app-radio-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-bg-tertiary);
  transition: all var(--transition-fast);
  flex-shrink: 0;
  margin-top: 2px;
}

.app-radio-input:focus-visible + .app-radio-circle {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.app-radio-circle:hover {
  border-color: var(--color-primary);
}

.app-radio-circle.is-checked {
  border-color: var(--color-primary);
}

.app-radio-circle.is-checked::after {
  content: '';
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-primary);
}

.app-radio-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}
</style>
