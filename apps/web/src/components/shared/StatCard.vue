<script setup lang="ts">
import type { Component, HTMLAttributes } from 'vue';
import { RouterLink } from 'vue-router';
import { cn } from '@/lib/utils';

/** KPI tile: label, prominent value, optional hint and icon. Links when `to` is set. */
const props = defineProps<{
    label: string;
    value: string | number;
    hint?: string;
    icon?: Component;
    to?: string;
    class?: HTMLAttributes['class'];
}>();
</script>

<template>
    <component
        :is="to ? RouterLink : 'div'"
        :to="to"
        :class="
            cn(
                'flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground outline-none md:p-5',
                to && 'transition-colors hover:border-input focus-visible:ring-3 focus-visible:ring-ring/50',
                props.class,
            )
        "
    >
        <div class="flex items-center justify-between gap-3">
            <span class="text-sm font-medium text-muted-foreground">{{ label }}</span>
            <span v-if="icon" class="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden="true">
                <component :is="icon" class="size-4" />
            </span>
        </div>
        <div class="space-y-1">
            <p class="text-2xl font-bold tracking-tight text-foreground tabular-nums">{{ value }}</p>
            <p v-if="hint || $slots.hint" class="text-xs text-muted-foreground">
                <slot name="hint">{{ hint }}</slot>
            </p>
        </div>
    </component>
</template>
