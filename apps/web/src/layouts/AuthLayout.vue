<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useThemeStore } from '@/stores/themeStore';
import ThemeToggle from '@/components/layout/ThemeToggle.vue';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import logoDark from '@/assets/images/logo-dark.svg';
import logoLight from '@/assets/images/logo-light.svg';
import { cn } from '@/lib/utils';

/**
 * Public / unauthenticated shell: slim top bar (logo, optional CTA, theme
 * toggle) and either a centered card (`variant="card"`, default) or a plain
 * full-width body (`variant="page"`) for landing and legal pages.
 */
const props = withDefaults(
    defineProps<{
        title?: string;
        description?: string;
        variant?: 'card' | 'page';
        size?: 'md' | 'lg';
        align?: 'start' | 'center';
    }>(),
    { title: undefined, description: undefined, variant: 'card', size: 'md', align: 'start' },
);

const themeStore = useThemeStore();
const logoSrc = computed(() => (themeStore.theme === 'dark' ? logoDark : logoLight));
</script>

<template>
    <div class="flex min-h-svh flex-col bg-background text-foreground">
        <header
            class="flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-card px-4 md:px-6"
            :style="{ paddingTop: 'env(safe-area-inset-top)' }"
        >
            <RouterLink
                to="/"
                class="flex h-10 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label="Çay Hesabım ana sayfa"
            >
                <img :src="logoSrc" alt="Çay Hesabım" class="h-8 w-auto" />
            </RouterLink>
            <div class="flex items-center gap-2">
                <slot name="cta" />
                <ThemeToggle />
            </div>
        </header>

        <main v-if="props.variant === 'page'" class="flex flex-1 flex-col">
            <slot />
        </main>

        <main v-else class="flex flex-1 items-center justify-center p-4 md:p-6">
            <Card :class="cn('w-full', props.size === 'lg' ? 'max-w-lg' : 'max-w-md')">
                <CardHeader v-if="props.title || $slots.icon" :class="cn(props.align === 'center' && 'items-center text-center')">
                    <slot name="icon" />
                    <CardTitle v-if="props.title" class="text-xl">{{ props.title }}</CardTitle>
                    <CardDescription v-if="props.description">{{ props.description }}</CardDescription>
                </CardHeader>
                <CardContent :class="cn(props.align === 'center' && 'text-center')">
                    <slot />
                </CardContent>
                <CardFooter v-if="$slots.footer" class="flex-col items-stretch gap-3 border-t text-center text-sm text-muted-foreground">
                    <slot name="footer" />
                </CardFooter>
            </Card>
        </main>
    </div>
</template>
