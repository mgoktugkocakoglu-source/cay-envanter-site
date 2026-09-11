<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Bell } from '@lucide/vue';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationsStore } from '@/stores/notificationsStore';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ThemeToggle from '@/components/layout/ThemeToggle.vue';
import { Icons } from '@/lib/icons';

const props = defineProps<{
    title?: string;
}>();

const authStore = useAuthStore();
const notifications = useNotificationsStore();
const router = useRouter();

const userName = computed(() => authStore.user?.fullName ?? 'Kullanıcı');
const userInitial = computed(() => userName.value.charAt(0).toUpperCase());
const userAvatar = computed(() => authStore.user?.avatarUrl ?? '');
const userEmail = computed(() => authStore.user?.email ?? '');
const walletNo = computed(() => authStore.user?.cuzdanNo ?? '');
const pendingNotifications = computed(() => notifications.pendingCount);

// Pending ruhsatlandırma approvals feed the "Bildirimler" badge; refreshed
// whenever the signed-in user changes (login, refresh on boot).
function refreshPendingCount(): void {
    if (authStore.isAuthenticated) notifications.fetchPendingCount();
}
onMounted(refreshPendingCount);
watch(() => authStore.user?.id, refreshPendingCount);

async function handleLogout() {
    await authStore.logout();
    notifications.reset();
    router.push('/login');
}
</script>

<template>
    <header
        class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 border-b bg-card/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:px-4"
        :style="{ paddingTop: 'env(safe-area-inset-top)' }"
    >
        <SidebarTrigger class="size-11 md:size-9" aria-label="Menüyü aç/kapat" />
        <Separator orientation="vertical" class="mr-1 hidden h-5! md:block" />

        <div class="flex min-w-0 flex-1 items-center gap-2">
            <slot name="left">
                <h1 v-if="props.title" class="truncate text-base font-semibold text-foreground">
                    {{ props.title }}
                </h1>
            </slot>
        </div>

        <div class="flex items-center gap-2">
            <slot name="actions" />
            <ThemeToggle />

            <DropdownMenu>
                <DropdownMenuTrigger as-child>
                    <Button
                        variant="outline"
                        class="h-11 gap-2 rounded-full px-1.5 md:h-9"
                        aria-label="Kullanıcı menüsü"
                    >
                        <span class="relative">
                            <Avatar class="size-8 md:size-7">
                                <AvatarImage v-if="userAvatar" :src="userAvatar" :alt="userName" />
                                <AvatarFallback class="bg-primary text-xs font-bold text-primary-foreground">
                                    {{ userInitial }}
                                </AvatarFallback>
                            </Avatar>
                            <span
                                v-if="pendingNotifications > 0"
                                class="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-warning text-[10px] font-bold text-white tabular-nums"
                                aria-hidden="true"
                            >
                                {{ pendingNotifications > 9 ? '9+' : pendingNotifications }}
                            </span>
                        </span>
                        <span class="hidden max-w-40 truncate text-sm font-medium lg:inline">
                            {{ userName }}
                        </span>
                        <component
                            :is="Icons.chevronDown"
                            :size="16"
                            class="hidden text-muted-foreground lg:block"
                            aria-hidden="true"
                        />
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" class="w-64">
                    <DropdownMenuLabel class="flex items-center gap-3 font-normal">
                        <Avatar class="size-10">
                            <AvatarImage v-if="userAvatar" :src="userAvatar" :alt="userName" />
                            <AvatarFallback class="bg-primary font-bold text-primary-foreground">
                                {{ userInitial }}
                            </AvatarFallback>
                        </Avatar>
                        <div class="min-w-0">
                            <p class="truncate text-sm font-semibold text-foreground">{{ userName }}</p>
                            <p v-if="walletNo" class="truncate text-xs text-muted-foreground">
                                Çaykur Cüzdan No: {{ walletNo }}
                            </p>
                            <p v-if="userEmail" class="truncate text-xs text-muted-foreground">
                                {{ userEmail }}
                            </p>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup v-if="authStore.isAdmin">
                        <DropdownMenuItem class="min-h-11 md:min-h-9" @select="router.push('/caykur')">
                            <component :is="Icons.caykur" aria-hidden="true" />
                            <span>Çaykur Paneli</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem class="min-h-11 md:min-h-9" @select="router.push('/admin')">
                            <component :is="Icons.admin" aria-hidden="true" />
                            <span>Admin Panel</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                    </DropdownMenuGroup>
                    <DropdownMenuItem class="min-h-11 md:min-h-9" @select="router.push('/tea/notifications')">
                        <Bell aria-hidden="true" />
                        <span class="flex-1">Bildirimler</span>
                        <Badge v-if="pendingNotifications > 0" variant="warning" class="tabular-nums" :aria-label="`${pendingNotifications} bekleyen onay`">
                            {{ pendingNotifications }}
                        </Badge>
                    </DropdownMenuItem>
                    <DropdownMenuItem class="min-h-11 md:min-h-9" @select="router.push('/tea/settings')">
                        <component :is="Icons.settings" aria-hidden="true" />
                        <span>Ayarlar</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" class="min-h-11 md:min-h-9" @select="handleLogout">
                        <component :is="Icons.logout" aria-hidden="true" />
                        <span>Çıkış Yap</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    </header>
</template>
