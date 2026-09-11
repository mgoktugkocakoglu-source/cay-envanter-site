<script setup lang="ts">
import type { RadioGroupItemProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { reactiveOmit } from '@vueuse/core';
import { Circle } from '@lucide/vue';
import { RadioGroupIndicator, RadioGroupItem } from 'reka-ui';
import { cn } from '@/lib/utils';

const props = defineProps<RadioGroupItemProps & { class?: HTMLAttributes['class'] }>();
const delegatedProps = reactiveOmit(props, 'class');
</script>

<template>
    <RadioGroupItem
        data-slot="radio-group-item"
        v-bind="delegatedProps"
        :class="
            cn(
                'aspect-square size-5 shrink-0 cursor-pointer rounded-full border border-input text-primary shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30',
                'data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive',
                props.class,
            )
        "
    >
        <RadioGroupIndicator data-slot="radio-group-indicator" class="relative flex items-center justify-center">
            <Circle class="absolute top-1/2 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 fill-primary" aria-hidden="true" />
        </RadioGroupIndicator>
    </RadioGroupItem>
</template>
