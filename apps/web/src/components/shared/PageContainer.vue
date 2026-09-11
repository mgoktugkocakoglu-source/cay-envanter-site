<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';

/** Standard page body: capped width, 8px-grid padding, vertical rhythm. */
const props = withDefaults(defineProps<{ class?: HTMLAttributes['class']; size?: 'default' | 'narrow' | 'wide' }>(), {
    size: 'default',
});
</script>

<template>
    <div
        :class="
            cn(
                'mx-auto flex w-full flex-col gap-6 p-4 md:p-6',
                size === 'default' && 'max-w-6xl',
                size === 'narrow' && 'max-w-3xl',
                size === 'wide' && 'max-w-screen-2xl',
                props.class,
            )
        "
    >
        <slot />
    </div>
</template>
