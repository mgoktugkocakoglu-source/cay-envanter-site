<template>
  <div class="app-input-wrapper">
    <label v-if="label" :for="inputId" class="app-input-label">
      {{ label }}
      <span v-if="required" class="app-input-required">*</span>
    </label>
    <div class="app-input-container" :class="{ 'has-error': !!error, 'is-disabled': disabled }">
      <span v-if="$slots.prefix" class="app-input-prefix">
        <slot name="prefix" />
      </span>
      <input
        :id="inputId"
        ref="inputRef"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :maxlength="maxlength"
        :min="min"
        :max="max"
        :step="step"
        class="app-input-field"
        :aria-invalid="!!error"
        :aria-describedby="error ? `${inputId}-error` : helperText ? `${inputId}-hint` : undefined"
        v-bind="$attrs"
        @input="onInput"
        @blur="$emit('blur', $event)"
        @focus="$emit('focus', $event)"
      />
      <span v-if="$slots.suffix" class="app-input-suffix">
        <slot name="suffix" />
      </span>
    </div>
    <p v-if="error" :id="`${inputId}-error`" class="app-input-error" role="alert">{{ error }}</p>
    <p v-else-if="helperText" :id="`${inputId}-hint`" class="app-input-hint">{{ helperText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'

interface Props {
  modelValue?: string | number
  label?: string
  type?: string
  placeholder?: string
  error?: string
  helperText?: string
  disabled?: boolean
  required?: boolean
  id?: string
  maxlength?: number
  min?: number | string
  max?: number | string
  step?: number | string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'text',
  disabled: false,
  required: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  blur: [event: FocusEvent]
  focus: [event: FocusEvent]
}>()

defineOptions({ inheritAttrs: false })

const inputRef = ref<HTMLInputElement | null>(null)
const generatedId = useId()
const inputId = computed(() => props.id || `app-input-${generatedId}`)

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', props.type === 'number' ? target.valueAsNumber : target.value)
}

function focus() {
  inputRef.value?.focus()
}

defineExpose({ focus, inputRef })
</script>

<style scoped>
.app-input-wrapper {
  display: flex;
  flex-direction: column;
}

.app-input-label {
  display: block;
  margin-bottom: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
}

.app-input-required {
  color: var(--color-danger);
  margin-left: 2px;
}

.app-input-container {
  display: flex;
  align-items: center;
  background: var(--color-input-bg);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  height: var(--control-height);
}

.app-input-container:hover:not(.is-disabled) {
  border-color: var(--color-border-strong);
}

.app-input-container:focus-within:not(.is-disabled) {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.app-input-container.has-error {
  border-color: var(--color-danger);
}

.app-input-container.has-error:focus-within {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.app-input-container.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.app-input-prefix,
.app-input-suffix {
  display: flex;
  align-items: center;
  padding: 0 var(--space-3);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.app-input-prefix {
  padding-right: 0;
}

.app-input-suffix {
  padding-left: 0;
}

.app-input-field {
  flex: 1;
  width: 100%;
  height: 100%;
  padding: 0 var(--space-4);
  font-size: var(--font-size-base);
  font-family: var(--font-family);
  color: var(--color-text-primary);
  background: transparent;
  border: none;
  outline: none;
}

.app-input-field::placeholder {
  color: var(--color-text-muted);
}

.app-input-field:disabled {
  cursor: not-allowed;
}

.app-input-error {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-danger);
}

.app-input-hint {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
</style>
