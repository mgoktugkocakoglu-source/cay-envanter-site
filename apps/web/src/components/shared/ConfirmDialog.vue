<script setup lang="ts">
import { useVModel } from '@vueuse/core';
import { AlertTriangle } from '@lucide/vue';
import Spinner from '@/components/shared/Spinner.vue';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * The single confirmation dialog. Destructive by default; pass
 * `variant="primary"` for non-destructive confirmations.
 */
const props = withDefaults(
    defineProps<{
        open: boolean;
        title: string;
        description?: string;
        confirmText?: string;
        cancelText?: string;
        variant?: 'danger' | 'primary';
        loading?: boolean;
    }>(),
    { confirmText: 'Evet', cancelText: 'İptal', variant: 'danger', loading: false },
);
const emits = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (e: 'confirm'): void;
    (e: 'cancel'): void;
}>();

const open = useVModel(props, 'open', emits, { passive: true });

function onCancel() {
    emits('cancel');
    open.value = false;
}
</script>

<template>
    <AlertDialog v-model:open="open">
        <AlertDialogContent>
            <AlertDialogHeader>
                <div class="flex items-start gap-3">
                    <span
                        v-if="variant === 'danger'"
                        class="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
                        aria-hidden="true"
                    >
                        <AlertTriangle class="size-5" />
                    </span>
                    <div class="space-y-2 text-left">
                        <AlertDialogTitle>{{ title }}</AlertDialogTitle>
                        <AlertDialogDescription v-if="description || $slots.default">
                            <slot>{{ description }}</slot>
                        </AlertDialogDescription>
                    </div>
                </div>
            </AlertDialogHeader>
            <slot name="body" />
            <AlertDialogFooter>
                <AlertDialogCancel :disabled="loading" @click.prevent="onCancel">{{ cancelText }}</AlertDialogCancel>
                <AlertDialogAction :destructive="variant === 'danger'" :disabled="loading" @click.prevent="emits('confirm')">
                    <Spinner v-if="loading" />
                    {{ confirmText }}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
</template>
