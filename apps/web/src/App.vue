<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();

// Initialize auth on app mount - restore session from refresh token
onMounted(async () => {
    await authStore.initialize();
});
</script>

<template>
  <RouterView />
</template>
