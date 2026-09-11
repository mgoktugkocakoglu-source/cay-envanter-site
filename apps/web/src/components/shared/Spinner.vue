<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { Loader2 } from '@lucide/vue';
import { cn } from '@/lib/utils';

const props = defineProps<{ class?: HTMLAttributes['class']; label?: string }>();
</script>

<template>
    <Loader2 :class="cn('size-4 animate-spin', props.class)" role="status" :aria-label="label ?? 'Yükleniyor'" />
</template>
