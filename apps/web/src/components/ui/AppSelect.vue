<template>
  <div class="app-select-wrapper" ref="wrapperRef">
    <label v-if="label" :id="`${selectId}-label`" :for="selectId" class="app-select-label">
      {{ label }}
      <span v-if="required" class="app-select-required">*</span>
    </label>
    <div
      :id="selectId"
      class="app-select-trigger"
      :class="{
        'is-open': isOpen,
        'has-error': !!error,
        'is-disabled': disabled,
        'has-value': hasValue,
      }"
      role="combobox"
      :aria-expanded="isOpen"
      :aria-haspopup="'listbox'"
      :aria-labelledby="label ? `${selectId}-label` : undefined"
      :aria-activedescendant="highlightedIndex >= 0 ? `${selectId}-option-${highlightedIndex}` : undefined"
      :aria-disabled="disabled"
      :tabindex="disabled ? -1 : 0"
      @click="toggleDropdown"
      @keydown="onTriggerKeydown"
    >
      <span v-if="!hasValue" class="app-select-placeholder">{{ placeholder || 'Seçiniz...' }}</span>
      <span v-else class="app-select-value">{{ displayValue }}</span>
      <svg class="app-select-arrow" :class="{ 'is-open': isOpen }" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>

    <Teleport to="body">
      <Transition name="app-select-dropdown">
        <div
          v-if="isOpen"
          ref="dropdownRef"
          class="app-select-dropdown"
          :style="dropdownStyle"
          role="listbox"
          :aria-labelledby="label ? `${selectId}-label` : undefined"
        >
          <div v-if="searchable" class="app-select-search">
            <input
              ref="searchRef"
              v-model="searchQuery"
              type="text"
              class="app-select-search-input"
              placeholder="Ara..."
              aria-label="Seçeneklerde ara"
              @keydown="onSearchKeydown"
            />
          </div>
          <div class="app-select-options" ref="optionsRef">
            <div
              v-if="filteredOptions.length === 0"
              class="app-select-empty"
            >
              Sonuç bulunamadı
            </div>
            <div
              v-for="(option, index) in filteredOptions"
              :key="option.value"
              :id="`${selectId}-option-${index}`"
              class="app-select-option"
              :class="{
                'is-selected': isSelected(option.value),
                'is-highlighted': highlightedIndex === index,
              }"
              role="option"
              :aria-selected="isSelected(option.value)"
              @click.stop="selectOption(option)"
              @mouseenter="highlightedIndex = index"
            >
              <span class="app-select-option-label">{{ option.label }}</span>
              <svg
                v-if="isSelected(option.value)"
                class="app-select-check"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <p v-if="error" class="app-select-error" role="alert">{{ error }}</p>
    <p v-else-if="helperText" class="app-select-hint">{{ helperText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount, useId } from 'vue'

export interface SelectOption {
  value: string | number
  label: string
  group?: string
}

interface Props {
  modelValue?: string | number | null | (string | number)[]
  options: SelectOption[]
  label?: string
  placeholder?: string
  error?: string
  helperText?: string
  disabled?: boolean
  required?: boolean
  searchable?: boolean
  multiple?: boolean
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  disabled: false,
  required: false,
  searchable: false,
  multiple: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null | (string | number)[]]
  blur: [event: Event]
}>()

const generatedId = useId()
const selectId = computed(() => props.id || `app-select-${generatedId}`)

const wrapperRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const searchRef = ref<HTMLInputElement | null>(null)
const optionsRef = ref<HTMLElement | null>(null)

const isOpen = ref(false)
const searchQuery = ref('')
const highlightedIndex = ref(-1)

const dropdownStyle = ref<Record<string, string>>({})

const hasValue = computed(() => {
  if (props.multiple) {
    return Array.isArray(props.modelValue) && props.modelValue.length > 0
  }
  return props.modelValue !== null && props.modelValue !== undefined && props.modelValue !== ''
})

const displayValue = computed(() => {
  if (props.multiple && Array.isArray(props.modelValue)) {
    const selectedLabels = props.options
      .filter(o => (props.modelValue as (string | number)[]).includes(o.value))
      .map(o => o.label)
    return selectedLabels.join(', ')
  }
  const selected = props.options.find(o => o.value === props.modelValue)
  return selected?.label || ''
})

const filteredOptions = computed(() => {
  if (!searchQuery.value) return props.options
  const q = searchQuery.value.toLowerCase()
  return props.options.filter(o => o.label.toLowerCase().includes(q))
})

function isSelected(value: string | number): boolean {
  if (props.multiple && Array.isArray(props.modelValue)) {
    return props.modelValue.includes(value)
  }
  return props.modelValue === value
}

function toggleDropdown() {
  if (props.disabled) return
  if (isOpen.value) {
    closeDropdown()
  } else {
    openDropdown()
  }
}

function openDropdown() {
  if (props.disabled) return
  isOpen.value = true
  highlightedIndex.value = -1
  searchQuery.value = ''
  nextTick(() => {
    positionDropdown()
    if (props.searchable && searchRef.value) {
      searchRef.value.focus()
    }
    scrollToSelected()
  })
}

function closeDropdown() {
  isOpen.value = false
  searchQuery.value = ''
  highlightedIndex.value = -1
  emit('blur', new Event('blur'))
}

function selectOption(option: SelectOption) {
  if (props.multiple) {
    const current = Array.isArray(props.modelValue) ? [...props.modelValue] : []
    const idx = current.indexOf(option.value)
    if (idx >= 0) {
      current.splice(idx, 1)
    } else {
      current.push(option.value)
    }
    emit('update:modelValue', current)
  } else {
    emit('update:modelValue', option.value)
    closeDropdown()
  }
}

function positionDropdown() {
  if (!wrapperRef.value) return
  const rect = wrapperRef.value.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  const openAbove = spaceBelow < 260 && rect.top > spaceBelow

  dropdownStyle.value = {
    position: 'fixed',
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    zIndex: 'var(--z-dropdown)',
    ...(openAbove
      ? { bottom: `${window.innerHeight - rect.top + 4}px` }
      : { top: `${rect.bottom + 4}px` }),
  }
}

function scrollToSelected() {
  if (!optionsRef.value) return
  const selectedEl = optionsRef.value.querySelector('.is-selected')
  if (selectedEl) {
    selectedEl.scrollIntoView({ block: 'nearest' })
  }
}

function scrollToHighlighted() {
  if (!optionsRef.value || highlightedIndex.value < 0) return
  const items = optionsRef.value.querySelectorAll('.app-select-option')
  const item = items[highlightedIndex.value]
  if (item) {
    item.scrollIntoView({ block: 'nearest' })
  }
}

function onTriggerKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'Enter':
    case ' ':
      e.preventDefault()
      if (!isOpen.value) {
        openDropdown()
      } else if (highlightedIndex.value >= 0) {
        selectOption(filteredOptions.value[highlightedIndex.value])
      }
      break
    case 'ArrowDown':
      e.preventDefault()
      if (!isOpen.value) {
        openDropdown()
      } else {
        highlightedIndex.value = Math.min(highlightedIndex.value + 1, filteredOptions.value.length - 1)
        scrollToHighlighted()
      }
      break
    case 'ArrowUp':
      e.preventDefault()
      if (isOpen.value) {
        highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
        scrollToHighlighted()
      }
      break
    case 'Escape':
      if (isOpen.value) {
        e.preventDefault()
        closeDropdown()
        wrapperRef.value?.querySelector<HTMLElement>('.app-select-trigger')?.focus()
      }
      break
    case 'Tab':
      if (isOpen.value) {
        closeDropdown()
      }
      break
  }
}

function onSearchKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      highlightedIndex.value = Math.min(highlightedIndex.value + 1, filteredOptions.value.length - 1)
      scrollToHighlighted()
      break
    case 'ArrowUp':
      e.preventDefault()
      highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
      scrollToHighlighted()
      break
    case 'Enter':
      e.preventDefault()
      if (highlightedIndex.value >= 0 && filteredOptions.value[highlightedIndex.value]) {
        selectOption(filteredOptions.value[highlightedIndex.value])
      }
      break
    case 'Escape':
      e.preventDefault()
      closeDropdown()
      wrapperRef.value?.querySelector<HTMLElement>('.app-select-trigger')?.focus()
      break
  }
}

function onClickOutside(e: MouseEvent) {
  if (!wrapperRef.value?.contains(e.target as Node) && !dropdownRef.value?.contains(e.target as Node)) {
    closeDropdown()
  }
}

watch(() => searchQuery.value, () => {
  highlightedIndex.value = filteredOptions.value.length > 0 ? 0 : -1
})

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  window.addEventListener('resize', () => {
    if (isOpen.value) positionDropdown()
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<style scoped>
.app-select-wrapper {
  display: flex;
  flex-direction: column;
  position: relative;
}

.app-select-label {
  display: block;
  margin-bottom: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.app-select-required {
  color: var(--color-danger);
  margin-left: 2px;
}

.app-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  min-height: 48px;
  user-select: none;
}

.app-select-trigger:hover:not(.is-disabled) {
  border-color: var(--color-text-muted);
}

.app-select-trigger:focus:not(.is-disabled) {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.app-select-trigger.is-open {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.app-select-trigger.has-error {
  border-color: var(--color-danger);
}

.app-select-trigger.has-error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.app-select-trigger.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.app-select-placeholder {
  color: var(--color-text-muted);
  font-size: var(--font-size-base);
}

.app-select-value {
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.app-select-arrow {
  color: var(--color-text-muted);
  transition: transform var(--transition-fast);
  flex-shrink: 0;
  margin-left: var(--space-2);
}

.app-select-arrow.is-open {
  transform: rotate(180deg);
}

/* Dropdown */
.app-select-dropdown {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: 100;
}

.app-select-dropdown-enter-active,
.app-select-dropdown-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.app-select-dropdown-enter-from,
.app-select-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Search */
.app-select-search {
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}

.app-select-search-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  font-family: var(--font-family);
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  outline: none;
}

.app-select-search-input:focus {
  border-color: var(--color-primary);
}

.app-select-search-input::placeholder {
  color: var(--color-text-muted);
}

/* Options */
.app-select-options {
  max-height: 240px;
  overflow-y: auto;
  padding: var(--space-1) 0;
}

.app-select-options::-webkit-scrollbar {
  width: 6px;
}

.app-select-options::-webkit-scrollbar-track {
  background: transparent;
}

.app-select-options::-webkit-scrollbar-thumb {
  background: var(--color-bg-tertiary);
  border-radius: 3px;
}

.app-select-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  transition: background var(--transition-fast);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
}

.app-select-option:hover,
.app-select-option.is-highlighted {
  background: var(--color-bg-tertiary);
}

.app-select-option.is-selected {
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
}

.app-select-check {
  color: var(--color-primary);
  flex-shrink: 0;
}

.app-select-empty {
  padding: var(--space-4);
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.app-select-error {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-danger);
}

.app-select-hint {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
</style>
