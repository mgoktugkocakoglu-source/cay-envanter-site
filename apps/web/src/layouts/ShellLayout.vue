<script setup lang="ts">
import type { NavGroup, NavItem } from '@/config/navigation';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/layout/AppSidebar.vue';
import AppNavbar from '@/components/layout/AppNavbar.vue';
import MobileTabBar from '@/components/layout/MobileTabBar.vue';

/**
 * General application shell: top navbar + collapsible left sidebar.
 * On viewports under 768px the sidebar becomes an off-canvas drawer and a
 * bottom tab bar carries the primary destinations (mobile-first).
 */
const props = withDefaults(
    defineProps<{
        groups: NavGroup[];
        mobileTabs?: NavItem[];
        homeTo?: string;
        title?: string;
    }>(),
    { mobileTabs: () => [], homeTo: '/tea/dashboard', title: undefined },
);
</script>

<template>
    <SidebarProvider class="bg-background text-foreground">
        <AppSidebar :groups="props.groups" :home-to="props.homeTo">
            <template #footer>
                <slot name="sidebar-footer" />
            </template>
        </AppSidebar>

        <SidebarInset class="min-w-0">
            <AppNavbar :title="props.title">
                <template #left><slot name="navbar-left" /></template>
                <template #actions><slot name="navbar-actions" /></template>
            </AppNavbar>

            <div
                class="flex-1"
                :class="{ 'pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0': props.mobileTabs.length > 0 }"
            >
                <slot />
            </div>
        </SidebarInset>

        <MobileTabBar v-if="props.mobileTabs.length > 0" :items="props.mobileTabs" />
    </SidebarProvider>
</template>
