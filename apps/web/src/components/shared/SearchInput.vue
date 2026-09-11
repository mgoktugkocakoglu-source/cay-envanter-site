<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { useVModel } from '@vueuse/core';
import { Search, X } from '@lucide/vue';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Search box with leading icon and a clear button; 44px on touch, 36px on desktop. */
const props = defineProps<{
    modelValue?: string;
    placeholder?: string;
    ariaLabel?: string;
    class?: HTMLAttributes['class'];
}>();
const emits = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const value = useVModel(props, 'modelValue', emits, { passive: true, defaultValue: '' });
</script>

<template>
    <div :class="cn('relative w-full', props.class)">
        <Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
            v-model="value"
            type="search"
            :placeholder="placeholder ?? 'Ara...'"
            :aria-label="ariaLabel ?? placeholder ?? 'Ara'"
            class="h-11 bg-card pr-10 pl-9 md:h-9 [&::-webkit-search-cancel-button]:hidden"
        />
        <button
            v-if="value"
            type="button"
            class="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:size-7"
            aria-label="Aramayı temizle"
            @click="value = ''"
        >
            <X class="size-4" aria-hidden="true" />
        </button>
    </div>
</template>
