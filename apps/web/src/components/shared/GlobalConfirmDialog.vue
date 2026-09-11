<script setup lang="ts">
import ConfirmDialog from '@/components/shared/ConfirmDialog.vue';
import { useConfirm } from '@/composables/useConfirm';

/** Mounted once in App.vue; driven by `useConfirm().confirm()`. */
const { isVisible, options, handleConfirm, handleCancel } = useConfirm();
</script>

<template>
    <ConfirmDialog
        :open="isVisible"
        :title="options.title ?? 'Onay'"
        :description="options.message"
        :confirm-text="options.confirmText"
        :cancel-text="options.cancelText"
        :variant="options.variant"
        @update:open="(value) => { if (!value) handleCancel(); }"
        @confirm="handleConfirm"
        @cancel="handleCancel"
    />
</template>
