<script setup lang="ts">
defineProps<{
    label: string;
    tone?: 'success' | 'warning' | 'danger' | 'info' | 'muted';
    noDot?: boolean;
}>();
</script>

<template>
    <span class="ck-pill" :class="{ 'no-dot': noDot }" :data-tone="tone ?? 'muted'">{{ label }}</span>
</template>
