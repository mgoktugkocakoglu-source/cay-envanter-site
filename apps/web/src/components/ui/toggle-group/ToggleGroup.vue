<script setup lang="ts">
import type { ToggleGroupRootEmits, ToggleGroupRootProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import type { ToggleVariants } from '@/components/ui/toggle';
import { reactiveOmit } from '@vueuse/core';
import { ToggleGroupRoot, useForwardPropsEmits } from 'reka-ui';
import { provide, toRef } from 'vue';
import { cn } from '@/lib/utils';

/**
 * Shared segmented control for filters, view switchers and mode pickers.
 * Use `<Tabs>` when the selection swaps a content panel; use this when it only
 * changes a filter or a mode.
 */
const props = withDefaults(
    defineProps<ToggleGroupRootProps & { class?: HTMLAttributes['class']; variant?: ToggleVariants['variant']; size?: ToggleVariants['size'] }>(),
    { variant: 'outline', size: 'default' },
);
const emits = defineEmits<ToggleGroupRootEmits>();

provide('toggleGroup', { variant: toRef(props, 'variant'), size: toRef(props, 'size') });

const delegatedProps = reactiveOmit(props, 'class', 'size', 'variant');
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
    <ToggleGroupRoot
        data-slot="toggle-group"
        :data-variant="variant"
        :data-size="size"
        v-bind="forwarded"
        :class="
            cn(
                'group/toggle-group inline-flex w-fit max-w-full items-center overflow-x-auto rounded-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                variant === 'outline' && 'shadow-xs',
                props.class,
            )
        "
    >
        <slot />
    </ToggleGroupRoot>
</template>
