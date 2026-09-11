<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { RouterLink } from 'vue-router';
import { ArrowLeft } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The single page-header pattern: optional back link, title, description,
 * a `meta` slot for count badges and an `actions` slot for buttons.
 */
const props = defineProps<{
    title: string;
    description?: string;
    backTo?: string;
    backLabel?: string;
    class?: HTMLAttributes['class'];
}>();
</script>

<template>
    <header :class="cn('flex flex-col gap-4 md:flex-row md:items-start md:justify-between', props.class)">
        <div class="flex min-w-0 items-start gap-2">
            <Button
                v-if="backTo"
                as-child
                variant="ghost"
                size="icon"
                class="-ml-2 size-11 shrink-0 md:size-9"
                :aria-label="backLabel ?? 'Geri'"
            >
                <RouterLink :to="backTo">
                    <ArrowLeft class="size-5" aria-hidden="true" />
                </RouterLink>
            </Button>
            <div class="min-w-0 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                    <h1 class="text-2xl font-bold tracking-tight text-foreground">{{ title }}</h1>
                    <slot name="badge" />
                </div>
                <p v-if="description" class="text-sm text-muted-foreground">{{ description }}</p>
                <div v-if="$slots.meta" class="flex flex-wrap items-center gap-2 pt-1">
                    <slot name="meta" />
                </div>
            </div>
        </div>
        <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
            <slot name="actions" />
        </div>
    </header>
</template>
