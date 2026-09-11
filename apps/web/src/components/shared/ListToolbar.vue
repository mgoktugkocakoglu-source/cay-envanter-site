<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';

/** Search + filters row above every list. Default slot = search, `filters` slot = selects/toggles. */
const props = defineProps<{ class?: HTMLAttributes['class'] }>();
</script>

<template>
    <div :class="cn('flex flex-col gap-3 md:flex-row md:items-center md:justify-between', props.class)">
        <div class="w-full md:max-w-sm">
            <slot />
        </div>
        <div v-if="$slots.filters" class="flex flex-wrap items-center gap-2">
            <slot name="filters" />
        </div>
    </div>
</template>
