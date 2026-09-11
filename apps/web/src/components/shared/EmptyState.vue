<script setup lang="ts">
import type { Component, HTMLAttributes } from 'vue';
import { Inbox } from '@lucide/vue';
import { cn } from '@/lib/utils';

/** Single empty-state pattern: muted icon, title, description, optional actions. */
const props = defineProps<{
    title: string;
    description?: string;
    icon?: Component;
    class?: HTMLAttributes['class'];
}>();
</script>

<template>
    <div
        :class="
            cn(
                'flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card px-6 py-10 text-center',
                props.class,
            )
        "
    >
        <span class="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
            <component :is="icon ?? Inbox" class="size-6" />
        </span>
        <div class="space-y-1">
            <h3 class="text-base font-semibold text-foreground">{{ title }}</h3>
            <p v-if="description" class="max-w-sm text-sm text-muted-foreground">{{ description }}</p>
        </div>
        <div v-if="$slots.default" class="flex flex-wrap items-center justify-center gap-2 pt-1">
            <slot />
        </div>
    </div>
</template>
