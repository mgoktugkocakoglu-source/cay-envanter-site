<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import Spinner from '@/components/shared/Spinner.vue';
import { cn } from '@/lib/utils';

/** Full-width loading block used while a page or section fetches. */
const props = defineProps<{ text?: string; class?: HTMLAttributes['class'] }>();
</script>

<template>
    <div :class="cn('flex min-h-56 flex-col items-center justify-center gap-3 text-muted-foreground', props.class)" aria-live="polite">
        <Spinner class="size-6" />
        <p class="text-sm">{{ text ?? 'Yükleniyor...' }}</p>
    </div>
</template>
