<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { ArrowLeft, ChevronRight, Search } from '@lucide/vue';
import type { NavGroup } from '@/config/navigation';
import ShellLayout from '@/layouts/ShellLayout.vue';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import CaykurCommandPalette from '@/components/caykur/CaykurCommandPalette.vue';
import { Icons } from '@/lib/icons';
import { useAuthStore } from '@/stores/authStore';
import { useCaykurStore } from '@/stores/caykurStore';
import { NAV_GROUPS } from '@/services/caykur/nav';
import { MODULE_LABELS, type ModuleKey } from '@/services/caykur/roles';
import caykurLogo from '@/assets/caykur-logo.svg';

/**
 * Çaykur institution panel shell: the shared `ShellLayout` fed with the
 * role-filtered Kurum navigation, the signed-in staff badge and ⌘K palette.
 */
const props = defineProps<{
    title?: string;
}>();

const router = useRouter();
const route = useRoute();
const caykur = useCaykurStore();
const auth = useAuthStore();

const paletteOpen = ref(false);

/** Nav groups with items filtered to what the active role may access. */
const visibleGroups = computed<NavGroup[]>(() =>
    NAV_GROUPS
        .map((group) => ({ ...group, items: group.items.filter((item) => caykur.can(item.module)) }))
        .filter((group) => group.items.length > 0),
);

/** First module the active role may open; where denied navigations land. */
const fallbackRoute = computed(() => visibleGroups.value[0]?.items[0]?.to ?? '/tea/dashboard');

interface Crumb {
    label: string;
    to: string;
}

const crumbs = computed<Crumb[]>(() => {
    const list: Crumb[] = [{ label: 'Kurum Paneli', to: '/caykur' }];
    const moduleKey = route.meta.module as ModuleKey | undefined;
    if (moduleKey && route.path !== '/caykur') {
        const navItem = NAV_GROUPS.flatMap((group) => group.items).find((item) => item.module === moduleKey);
        const listPath = (navItem?.to ?? `/caykur/${moduleKey}`).split('?')[0];
        list.push({ label: MODULE_LABELS[moduleKey], to: listPath });
        if (route.path !== listPath) {
            list.push({
                label: route.path.endsWith('/new') ? 'Yeni kayıt' : 'Detay',
                to: route.path,
            });
        }
    }
    return list;
});

const isMac = navigator.platform.toUpperCase().includes('MAC');
const staffName = computed(() => auth.user?.fullName?.trim() || caykur.currentRoleDef.label);
const staffInitial = computed(() => staffName.value.charAt(0).toUpperCase());

function onGlobalKeydown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        paletteOpen.value = !paletteOpen.value;
    }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown));
onUnmounted(() => window.removeEventListener('keydown', onGlobalKeydown));

// Redirect away from a module the current persona can't access (Faz 1 gating).
watch(
    () => [route.meta.module, caykur.role] as const,
    ([moduleKey]) => {
        const key = moduleKey as ModuleKey | undefined;
        if (key && !caykur.can(key)) {
            router.replace(fallbackRoute.value);
        }
    },
    { immediate: true },
);
</script>

<template>
    <ShellLayout :groups="visibleGroups" home-to="/caykur" :title="props.title">
        <template #navbar-left>
            <div class="flex min-w-0 flex-1 items-center gap-3">
                <RouterLink
                    to="/caykur"
                    class="shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    aria-label="Çaykur Kurumsal Müstahsil Platformu"
                >
                    <img :src="caykurLogo" alt="Çaykur" class="h-6 w-auto md:h-7" />
                </RouterLink>

                <h1 v-if="props.title" class="truncate text-base font-semibold text-foreground">
                    {{ props.title }}
                </h1>
                <nav v-else class="hidden min-w-0 items-center gap-1 text-sm md:flex" aria-label="Konum">
                    <template v-for="(crumb, index) in crumbs" :key="crumb.to">
                        <ChevronRight
                            v-if="index > 0"
                            class="size-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <RouterLink
                            v-if="index < crumbs.length - 1"
                            :to="crumb.to"
                            class="truncate rounded-sm text-muted-foreground! outline-none hover:text-foreground! focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                            {{ crumb.label }}
                        </RouterLink>
                        <span v-else class="truncate font-medium text-foreground" aria-current="page">
                            {{ crumb.label }}
                        </span>
                    </template>
                </nav>
            </div>
        </template>

        <template #navbar-actions>
            <slot name="actions" />

            <Badge variant="muted" class="hidden tabular-nums lg:inline-flex">{{ caykur.season }}</Badge>

            <Button
                variant="outline"
                class="size-11 p-0 text-muted-foreground md:h-9 md:w-56 md:justify-start md:px-3"
                aria-label="Ara veya git"
                :aria-keyshortcuts="isMac ? 'Meta+K' : 'Control+K'"
                @click="paletteOpen = true"
            >
                <Search aria-hidden="true" />
                <span class="hidden flex-1 text-left text-sm font-normal md:inline">Ara veya git…</span>
                <kbd
                    class="hidden h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground md:inline-flex"
                    aria-hidden="true"
                >
                    {{ isMac ? '⌘K' : 'Ctrl K' }}
                </kbd>
            </Button>

            <div
                class="flex h-11 items-center gap-2 rounded-md border px-1.5 md:h-9"
                :title="`${staffName} · ${caykur.currentRoleDef.label}`"
            >
                <Avatar class="size-8 md:size-7">
                    <AvatarFallback class="bg-secondary text-xs font-bold text-secondary-foreground">
                        {{ staffInitial }}
                    </AvatarFallback>
                </Avatar>
                <span class="hidden flex-col items-start leading-tight lg:flex">
                    <span class="text-xs font-semibold text-foreground">{{ staffName }}</span>
                    <span class="text-xs text-muted-foreground">{{ caykur.currentRoleDef.label }}</span>
                </span>
            </div>
        </template>

        <template #sidebar-footer>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton
                        as-child
                        tooltip="Uygulamaya dön"
                        class="h-11 text-sidebar-foreground! hover:text-sidebar-accent-foreground! md:h-10 [&>svg]:size-5"
                    >
                        <RouterLink to="/tea/dashboard">
                            <ArrowLeft aria-hidden="true" />
                            <span>Uygulamaya dön</span>
                        </RouterLink>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </template>

        <slot />

        <CaykurCommandPalette v-model:open="paletteOpen" />
    </ShellLayout>
</template>
