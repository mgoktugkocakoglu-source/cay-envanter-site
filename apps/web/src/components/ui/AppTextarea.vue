<template>
  <div class="app-textarea-wrapper">
    <label v-if="label" :for="textareaId" class="app-textarea-label">
      {{ label }}
      <span v-if="required" class="app-textarea-required">*</span>
    </label>
    <textarea
      :id="textareaId"
      ref="textareaRef"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :rows="rows"
      :maxlength="maxlength"
      class="app-textarea-field"
      :class="{ 'has-error': !!error, 'is-disabled': disabled }"
      :aria-invalid="!!error"
      :aria-describedby="error ? `${textareaId}-error` : helperText ? `${textareaId}-hint` : undefined"
      v-bind="$attrs"
      @input="onInput"
      @blur="$emit('blur', $event)"
    />
    <div class="app-textarea-footer">
      <p v-if="error" :id="`${textareaId}-error`" class="app-textarea-error" role="alert">{{ error }}</p>
      <p v-else-if="helperText" :id="`${textareaId}-hint`" class="app-textarea-hint">{{ helperText }}</p>
      <span v-else />
      <span v-if="showCount && maxlength" class="app-textarea-count" :class="{ 'is-limit': currentLength >= maxlength }">
        {{ currentLength }} / {{ maxlength }}
      </span>
    </div>
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
  rows?: number
  maxlength?: number
  showCount?: boolean
  disabled?: boolean
  required?: boolean
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  rows: 4,
  showCount: false,
  disabled: false,
  required: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  blur: [event: FocusEvent]
}>()

defineOptions({ inheritAttrs: false })

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const generatedId = useId()
const textareaId = computed(() => props.id || `app-textarea-${generatedId}`)

const currentLength = computed(() => (props.modelValue || '').length)

function onInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}

function focus() {
  textareaRef.value?.focus()
}

defineExpose({ focus, textareaRef })
</script>

<style scoped>
.app-textarea-wrapper {
  display: flex;
  flex-direction: column;
}

.app-textarea-label {
  display: block;
  margin-bottom: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.app-textarea-required {
  color: var(--color-danger);
  margin-left: 2px;
}

.app-textarea-field {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-base);
  font-family: var(--font-family);
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  resize: vertical;
  line-height: var(--line-height-normal);
}

.app-textarea-field::placeholder {
  color: var(--color-text-muted);
}

.app-textarea-field:hover:not(.is-disabled) {
  border-color: var(--color-text-muted);
}

.app-textarea-field:focus:not(.is-disabled) {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.app-textarea-field.has-error {
  border-color: var(--color-danger);
}

.app-textarea-field.has-error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.app-textarea-field.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.app-textarea-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-top: var(--space-2);
  min-height: 20px;
}

.app-textarea-error {
  font-size: var(--font-size-sm);
  color: var(--color-danger);
}

.app-textarea-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.app-textarea-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-left: auto;
}

.app-textarea-count.is-limit {
  color: var(--color-danger);
}
</style>
