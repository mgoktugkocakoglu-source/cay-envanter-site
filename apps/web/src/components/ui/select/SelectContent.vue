<script setup lang="ts">
import type { SelectContentEmits, SelectContentProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { reactiveOmit } from '@vueuse/core';
import { ChevronDown, ChevronUp } from '@lucide/vue';
import {
    SelectContent,
    SelectPortal,
    SelectScrollDownButton,
    SelectScrollUpButton,
    SelectViewport,
    useForwardPropsEmits,
} from 'reka-ui';
import { cn } from '@/lib/utils';

const props = withDefaults(defineProps<SelectContentProps & { class?: HTMLAttributes['class'] }>(), {
    position: 'popper',
});
const emits = defineEmits<SelectContentEmits>();

const delegatedProps = reactiveOmit(props, 'class');
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
    <SelectPortal>
        <SelectContent
            data-slot="select-content"
            v-bind="{ ...forwarded, ...$attrs }"
            :class="
                cn(
                    'relative z-50 max-h-(--reka-select-content-available-height) min-w-32 overflow-x-hidden overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
                    position === 'popper' &&
                        'w-full min-w-(--reka-select-trigger-width) data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
                    props.class,
                )
            "
        >
            <SelectScrollUpButton class="flex cursor-default items-center justify-center py-1">
                <ChevronUp class="size-4" aria-hidden="true" />
            </SelectScrollUpButton>
            <SelectViewport :class="cn('p-1', position === 'popper' && 'h-[var(--reka-select-trigger-height)] w-full min-w-[var(--reka-select-trigger-width)] scroll-my-1')">
                <slot />
            </SelectViewport>
            <SelectScrollDownButton class="flex cursor-default items-center justify-center py-1">
                <ChevronDown class="size-4" aria-hidden="true" />
            </SelectScrollDownButton>
        </SelectContent>
    </SelectPortal>
</template>
