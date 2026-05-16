<template>
  <div class="app-password-wrapper">
    <label v-if="label" :for="inputId" class="app-input-label">
      {{ label }}
      <span v-if="required" class="app-input-required">*</span>
    </label>
    <div class="app-input-container" :class="{ 'has-error': !!error, 'is-disabled': disabled }">
      <input
        :id="inputId"
        ref="inputRef"
        :type="visible ? 'text' : 'password'"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        class="app-input-field"
        :aria-invalid="!!error"
        :aria-describedby="ariaDescribedBy"
        autocomplete="off"
        @input="onInput"
        @blur="$emit('blur', $event)"
      />
      <button
        type="button"
        class="app-password-toggle"
        :aria-label="visible ? 'Parolayı gizle' : 'Parolayı göster'"
        tabindex="0"
        @click="visible = !visible"
      >
        <svg v-if="!visible" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      </button>
    </div>
    <div v-if="showStrength && modelValue" class="app-password-strength">
      <div class="app-password-strength-track">
        <div
          class="app-password-strength-bar"
          :class="`app-password-strength--${strengthLevel}`"
        />
      </div>
      <span class="app-password-strength-label" :class="`app-password-strength-text--${strengthLevel}`">
        {{ strengthLabel }}
      </span>
    </div>
    <p v-if="error" :id="`${inputId}-error`" class="app-input-error" role="alert">{{ error }}</p>
    <p v-else-if="helperText" :id="`${inputId}-hint`" class="app-input-hint">{{ helperText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'

interface Props {
  modelValue?: string
  label?: string
  placeholder?: string
  error?: string
  helperText?: string
  showStrength?: boolean
  disabled?: boolean
  required?: boolean
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  disabled: false,
  required: false,
  showStrength: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  blur: [event: FocusEvent]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const visible = ref(false)
const generatedId = useId()
const inputId = computed(() => props.id || `app-password-${generatedId}`)

const ariaDescribedBy = computed(() => {
  if (props.error) return `${inputId.value}-error`
  if (props.helperText) return `${inputId.value}-hint`
  return undefined
})

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

const strengthLevel = computed(() => {
  const val = props.modelValue || ''
  if (val.length < 6) return 'weak'
  let score = 0
  if (val.length >= 8) score++
  if (/[a-z]/.test(val)) score++
  if (/[A-Z]/.test(val)) score++
  if (/\d/.test(val)) score++
  if (/[^a-zA-Z0-9]/.test(val)) score++
  if (score <= 2) return 'weak'
  if (score <= 3) return 'medium'
  return 'strong'
})

const strengthLabel = computed(() => {
  switch (strengthLevel.value) {
    case 'weak': return 'Zayıf'
    case 'medium': return 'Orta'
    case 'strong': return 'Güçlü'
    default: return ''
  }
})

function focus() {
  inputRef.value?.focus()
}

defineExpose({ focus, inputRef })
</script>

<style scoped>
.app-password-wrapper {
  display: flex;
  flex-direction: column;
}

.app-input-label {
  display: block;
  margin-bottom: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.app-input-required {
  color: var(--color-danger);
  margin-left: 2px;
}

.app-input-container {
  display: flex;
  align-items: center;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  height: var(--control-height);
}

.app-input-container:hover:not(.is-disabled) {
  border-color: var(--color-text-muted);
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

.app-password-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--space-3);
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color var(--transition-fast);
  width: var(--control-height);
  min-width: var(--control-height);
  height: var(--control-height);
}

.app-password-toggle:hover {
  color: var(--color-text-primary);
}

/* Strength indicator */
.app-password-strength {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.app-password-strength-track {
  flex: 1;
  height: 4px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.app-password-strength-bar {
  height: 100%;
  transition: width var(--transition-normal), background var(--transition-normal);
}

.app-password-strength--weak {
  width: 33.33%;
  background: var(--color-danger);
}

.app-password-strength--medium {
  width: 66.66%;
  background: var(--color-warning);
}

.app-password-strength--strong {
  width: 100%;
  background: var(--color-success);
}

.app-password-strength-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  min-width: 40px;
  text-align: right;
}

.app-password-strength-text--weak {
  color: var(--color-danger);
}

.app-password-strength-text--medium {
  color: var(--color-warning);
}

.app-password-strength-text--strong {
  color: var(--color-success);
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
