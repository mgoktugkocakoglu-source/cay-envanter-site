<script setup lang="ts">
import ShellLayout from '@/layouts/ShellLayout.vue';
import { adminNavigation } from '@/config/navigation';

defineProps<{
    title?: string;
}>();
</script>

<template>
    <ShellLayout :groups="adminNavigation" home-to="/admin" :title="title">
        <template #navbar-actions><slot name="actions" /></template>
        <slot />
    </ShellLayout>
</template>
