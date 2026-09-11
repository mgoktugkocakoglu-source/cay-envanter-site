<script setup lang="ts">
import { computed } from 'vue';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui/button';
import { Icons } from '@/lib/icons';

const themeStore = useThemeStore();

const isDark = computed(() => themeStore.theme === 'dark');
const label = computed(() => (isDark.value ? 'Açık temaya geç' : 'Koyu temaya geç'));
</script>

<template>
    <Button
        variant="outline"
        size="icon"
        class="size-11 md:size-9"
        :title="label"
        :aria-label="label"
        :aria-pressed="isDark"
        @click="themeStore.toggleTheme()"
    >
        <component :is="isDark ? Icons.sun : Icons.moon" :size="18" aria-hidden="true" />
    </Button>
</template>
