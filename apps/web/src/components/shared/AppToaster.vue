<script setup lang="ts">
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from '@lucide/vue';
import { useToast, type Toast } from '@/composables/useToast';
import { cn } from '@/lib/utils';

/** Global toast stack, mounted once in App.vue and driven by `useToast()`. */
const { toasts, remove } = useToast();

const ICONS: Record<Toast['type'], typeof Info> = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
};

const TONES: Record<Toast['type'], string> = {
    success: 'border-success/40 text-success',
    error: 'border-destructive/40 text-destructive',
    warning: 'border-warning/40 text-warning',
    info: 'border-info/40 text-info',
};
</script>

<template>
    <Teleport to="body">
        <div
            class="pointer-events-none fixed inset-x-4 top-4 z-[300] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-full sm:max-w-sm"
            :style="{ paddingTop: 'env(safe-area-inset-top)' }"
            aria-live="polite"
        >
            <TransitionGroup
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="translate-y-2 opacity-0"
                leave-active-class="transition duration-150 ease-in"
                leave-to-class="translate-y-2 opacity-0"
            >
                <div
                    v-for="toast in toasts"
                    :key="toast.id"
                    role="alert"
                    :class="cn('pointer-events-auto flex items-start gap-3 rounded-lg border bg-card p-3 pl-4 text-sm shadow-lg', TONES[toast.type])"
                >
                    <component :is="ICONS[toast.type]" class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                    <p class="flex-1 pt-0.5 text-foreground">{{ toast.message }}</p>
                    <button
                        type="button"
                        class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                        aria-label="Kapat"
                        @click="remove(toast.id)"
                    >
                        <X class="size-4" aria-hidden="true" />
                    </button>
                </div>
            </TransitionGroup>
        </div>
    </Teleport>
</template>
