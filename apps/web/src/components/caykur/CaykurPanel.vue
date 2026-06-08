<script setup lang="ts">
defineProps<{
    title?: string;
    meta?: string;
}>();
</script>

<template>
    <section class="ck-panel">
        <div v-if="title || meta || $slots.head" class="ck-panel-head">
            <h2 v-if="title" class="ck-panel-title">{{ title }}</h2>
            <slot name="head" />
            <span v-if="meta" class="ck-panel-meta">{{ meta }}</span>
        </div>
        <slot />
    </section>
</template>
