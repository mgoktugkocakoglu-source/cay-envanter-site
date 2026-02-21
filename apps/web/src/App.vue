<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import AppToast from '@/components/ui/AppToast.vue';

const authStore = useAuthStore();
const themeStore = useThemeStore();

// Initialize theme immediately to prevent flash
themeStore.initialize();

// Initialize auth on app mount - restore session from refresh token
onMounted(async () => {
    await authStore.initialize();
});
</script>

<template>
  <RouterView />
  <AppToast />
</template>
