<script setup lang="ts">
import type { ToggleGroupItemProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import type { ToggleGroupContext } from '.';
import type { ToggleVariants } from '@/components/ui/toggle';
import { reactiveOmit } from '@vueuse/core';
import { ToggleGroupItem } from 'reka-ui';
import { inject } from 'vue';
import { cn } from '@/lib/utils';
import { toggleVariants } from '@/components/ui/toggle';

const props = defineProps<ToggleGroupItemProps & { class?: HTMLAttributes['class']; variant?: ToggleVariants['variant']; size?: ToggleVariants['size'] }>();

const context = inject<ToggleGroupContext | undefined>('toggleGroup', undefined);
const delegatedProps = reactiveOmit(props, 'class', 'size', 'variant');
</script>

<template>
    <ToggleGroupItem
        data-slot="toggle-group-item"
        v-bind="delegatedProps"
        :class="
            cn(
                toggleVariants({ variant: context?.variant.value ?? variant, size: context?.size.value ?? size }),
                'shrink-0 grow rounded-none shadow-none first:rounded-l-md last:rounded-r-md focus:z-10 focus-visible:z-10',
                'group-data-[variant=outline]/toggle-group:border-l-0 group-data-[variant=outline]/toggle-group:first:border-l',
                'data-[state=on]:bg-primary/10 data-[state=on]:text-primary',
                props.class,
            )
        "
    >
        <slot />
    </ToggleGroupItem>
</template>
