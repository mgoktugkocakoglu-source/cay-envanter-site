<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import type { NavGroup, NavItem } from '@/config/navigation';
import { useThemeStore } from '@/stores/themeStore';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    useSidebar,
} from '@/components/ui/sidebar';
import logoDark from '@/assets/images/logo-dark.svg';
import logoLight from '@/assets/images/logo-light.svg';
import appIcon from '@/assets/images/app-icon.svg';

const props = defineProps<{
    groups: NavGroup[];
    homeTo?: string;
}>();

const route = useRoute();
const themeStore = useThemeStore();
const { isMobile, setOpenMobile } = useSidebar();

const logoSrc = computed(() => (themeStore.theme === 'dark' ? logoDark : logoLight));

function isActive(item: NavItem): boolean {
    const [path, query] = item.to.split('?');
    if (query) {
        // Deep link into a tabbed page: active only when every query pair matches.
        if (route.path !== path) return false;
        return [...new URLSearchParams(query)].every(([k, v]) => String(route.query[k] ?? '') === v);
    }
    if (item.exact) return route.path === item.to;
    return route.path === item.to || route.path.startsWith(`${item.to}/`);
}

/** Close the mobile drawer after a navigation so the page is visible. */
function onNavigate() {
    if (isMobile.value) setOpenMobile(false);
}
</script>

<template>
    <Sidebar collapsible="icon" aria-label="Ana menü">
        <SidebarHeader class="h-16 justify-center border-b border-sidebar-border px-3">
            <RouterLink
                :to="props.homeTo ?? '/tea/dashboard'"
                class="flex h-10 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                aria-label="Çay Hesabım ana sayfa"
                @click="onNavigate"
            >
                <img
                    :src="appIcon"
                    alt=""
                    class="hidden size-8 shrink-0 group-data-[collapsible=icon]:block"
                />
                <img
                    :src="logoSrc"
                    alt="Çay Hesabım"
                    class="h-8 w-auto group-data-[collapsible=icon]:hidden"
                />
            </RouterLink>
        </SidebarHeader>

        <SidebarContent>
            <SidebarGroup v-for="(group, index) in props.groups" :key="group.label ?? index">
                <SidebarGroupLabel v-if="group.label">{{ group.label }}</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        <SidebarMenuItem v-for="item in group.items" :key="item.to">
                            <SidebarMenuButton
                                as-child
                                :is-active="isActive(item)"
                                :tooltip="item.label"
                                class="h-11 text-sidebar-foreground! hover:text-sidebar-accent-foreground! data-[active=true]:text-sidebar-primary! md:h-10 [&>svg]:size-5"
                            >
                                <RouterLink
                                    :to="item.to"
                                    :aria-current="isActive(item) ? 'page' : undefined"
                                    @click="onNavigate"
                                >
                                    <component :is="item.icon" aria-hidden="true" />
                                    <span>{{ item.label }}</span>
                                </RouterLink>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        </SidebarContent>

        <SidebarFooter class="border-t border-sidebar-border">
            <slot name="footer" />
        </SidebarFooter>

        <SidebarRail />
    </Sidebar>
</template>
