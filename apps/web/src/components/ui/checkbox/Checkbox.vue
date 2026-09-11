<script setup lang="ts">
import type { CheckboxRootEmits, CheckboxRootProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { reactiveOmit } from '@vueuse/core';
import { Check } from '@lucide/vue';
import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from 'reka-ui';
import { cn } from '@/lib/utils';

const props = defineProps<CheckboxRootProps & { class?: HTMLAttributes['class'] }>();
const emits = defineEmits<CheckboxRootEmits>();

const delegatedProps = reactiveOmit(props, 'class');
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
    <CheckboxRoot
        data-slot="checkbox"
        v-bind="forwarded"
        :class="
            cn(
                'peer size-5 shrink-0 cursor-pointer rounded-[4px] border border-input bg-card shadow-xs transition-shadow outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30',
                'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
                'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20',
                props.class,
            )
        "
    >
        <CheckboxIndicator data-slot="checkbox-indicator" class="grid place-content-center text-current transition-none">
            <slot>
                <Check class="size-3.5" aria-hidden="true" />
            </slot>
        </CheckboxIndicator>
    </CheckboxRoot>
</template>
