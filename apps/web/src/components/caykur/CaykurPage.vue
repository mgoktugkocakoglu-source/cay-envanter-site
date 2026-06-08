<script setup lang="ts">
import CaykurLayout from '@/layouts/CaykurLayout.vue';

defineProps<{
    title: string;
    sub?: string;
}>();
</script>

<template>
    <CaykurLayout>
        <header class="ck-page-head">
            <div>
                <h1 class="ck-page-title">{{ title }}</h1>
                <p v-if="sub" class="ck-page-sub">{{ sub }}</p>
            </div>
            <div v-if="$slots.actions" class="ck-page-actions">
                <slot name="actions" />
            </div>
        </header>
        <slot />
    </CaykurLayout>
</template>
