import { ref } from 'vue'

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'primary'
}

const isVisible = ref(false)
const options = ref<ConfirmOptions>({
  message: '',
  title: 'Onay',
  confirmText: 'Evet',
  cancelText: 'İptal',
  variant: 'danger',
})

let resolvePromise: ((value: boolean) => void) | null = null

export function useConfirm() {
  function confirm(messageOrOptions: string | ConfirmOptions): Promise<boolean> {
    if (typeof messageOrOptions === 'string') {
      options.value = {
        message: messageOrOptions,
        title: 'Onay',
        confirmText: 'Evet',
        cancelText: 'İptal',
        variant: 'danger',
      }
    } else {
      options.value = {
        title: 'Onay',
        confirmText: 'Evet',
        cancelText: 'İptal',
        variant: 'danger',
        ...messageOrOptions,
      }
    }

    // Resolve any previous pending promise before opening new one
    if (resolvePromise) {
      resolvePromise(false)
      resolvePromise = null
    }

    isVisible.value = true

    return new Promise<boolean>((resolve) => {
      resolvePromise = resolve
    })
  }

  function handleConfirm() {
    isVisible.value = false
    resolvePromise?.(true)
    resolvePromise = null
  }

  function handleCancel() {
    isVisible.value = false
    resolvePromise?.(false)
    resolvePromise = null
  }

  return {
    isVisible,
    options,
    confirm,
    handleConfirm,
    handleCancel,
  }
}
