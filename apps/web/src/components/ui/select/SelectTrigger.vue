<script setup lang="ts">
import type { SelectTriggerProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { reactiveOmit } from '@vueuse/core';
import { ChevronDown } from '@lucide/vue';
import { SelectIcon, SelectTrigger } from 'reka-ui';
import { cn } from '@/lib/utils';

const props = withDefaults(
    defineProps<SelectTriggerProps & { class?: HTMLAttributes['class']; size?: 'sm' | 'default' }>(),
    { size: 'default' },
);
const delegatedProps = reactiveOmit(props, 'class', 'size');
</script>

<template>
    <SelectTrigger
        data-slot="select-trigger"
        :data-size="size"
        v-bind="delegatedProps"
        :class="
            cn(
                'flex w-fit cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none select-none data-[placeholder]:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50',
                'data-[size=default]:h-11 data-[size=sm]:h-8 md:data-[size=default]:h-9',
                'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20',
                '*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
                props.class,
            )
        "
    >
        <slot />
        <SelectIcon as-child>
            <ChevronDown class="size-4 opacity-50" aria-hidden="true" />
        </SelectIcon>
    </SelectTrigger>
</template>
