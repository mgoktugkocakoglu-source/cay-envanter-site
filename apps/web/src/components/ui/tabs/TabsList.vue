<script setup lang="ts">
import type { TabsListProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { reactiveOmit } from '@vueuse/core';
import { TabsList } from 'reka-ui';
import { cn } from '@/lib/utils';

/**
 * The single tab strip used across the app.
 * Default: boxed segmented strip (view switchers).
 * `variant="line"`: underline strip for page-level sections.
 */
const props = withDefaults(
    defineProps<TabsListProps & { class?: HTMLAttributes['class']; variant?: 'default' | 'line' }>(),
    { variant: 'default' },
);

const delegatedProps = reactiveOmit(props, 'class', 'variant');
</script>

<template>
    <TabsList
        data-slot="tabs-list"
        :data-variant="variant"
        v-bind="delegatedProps"
        :class="
            cn(
                'group/tabs-list inline-flex w-fit max-w-full items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                variant === 'line'
                    ? 'h-auto gap-1 rounded-none border-b bg-transparent p-0'
                    : 'h-11 gap-1 rounded-lg border bg-muted p-1 md:h-10',
                props.class,
            )
        "
    >
        <slot />
    </TabsList>
</template>
