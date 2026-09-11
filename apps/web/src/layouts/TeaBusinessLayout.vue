<script setup lang="ts">
import ShellLayout from '@/layouts/ShellLayout.vue';
import { teaMobileTabs, teaNavigation } from '@/config/navigation';

defineProps<{
    title?: string;
}>();
</script>

<template>
    <ShellLayout
        :groups="teaNavigation"
        :mobile-tabs="teaMobileTabs"
        home-to="/tea/dashboard"
        :title="title"
    >
        <template #navbar-actions><slot name="actions" /></template>
        <slot />
    </ShellLayout>
</template>
