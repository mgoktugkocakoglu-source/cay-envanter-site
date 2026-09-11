<script setup lang="ts">
import type { AlertDialogActionProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { reactiveOmit } from '@vueuse/core';
import { AlertDialogAction } from 'reka-ui';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

const props = defineProps<AlertDialogActionProps & { class?: HTMLAttributes['class']; destructive?: boolean }>();
const delegatedProps = reactiveOmit(props, 'class', 'destructive');
</script>

<template>
    <AlertDialogAction
        data-slot="alert-dialog-action"
        v-bind="delegatedProps"
        :class="cn(buttonVariants({ variant: destructive ? 'destructive' : 'default' }), 'h-11 md:h-9', props.class)"
    >
        <slot />
    </AlertDialogAction>
</template>
