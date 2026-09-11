<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';
import type { NavItem } from '@/config/navigation';
import { cn } from '@/lib/utils';

const props = defineProps<{
    items: NavItem[];
}>();

const route = useRoute();

function isActive(item: NavItem): boolean {
    if (item.exact) return route.path === item.to;
    return route.path === item.to || route.path.startsWith(`${item.to}/`);
}
</script>

<template>
    <nav
        class="fixed inset-x-0 bottom-0 z-40 grid border-t bg-card md:hidden"
        :style="{
            gridTemplateColumns: `repeat(${props.items.length}, minmax(0, 1fr))`,
            paddingBottom: 'env(safe-area-inset-bottom)',
        }"
        aria-label="Alt menü"
    >
        <RouterLink
            v-for="item in props.items"
            :key="item.to"
            :to="item.to"
            :aria-current="isActive(item) ? 'page' : undefined"
            :class="
                cn(
                    'flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium text-muted-foreground! outline-none transition-colors',
                    'hover:text-foreground! focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    isActive(item) && 'text-primary!',
                )
            "
        >
            <component :is="item.icon" :size="22" aria-hidden="true" />
            <span class="truncate">{{ item.shortLabel ?? item.label }}</span>
        </RouterLink>
    </nav>
</template>
