<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Ban, CheckCircle2, Eye, MoreHorizontal, ShieldCheck, UserRound, Users } from '@lucide/vue';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/composables/useToast';
import { api, type AdminUser } from '@/services/api';
import AdminLayout from '@/layouts/AdminLayout.vue';
import { ConfirmDialog, EmptyState, ListToolbar, LoadingState, PageContainer, PageHeader, SearchInput, StatCard } from '@/components/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge, type BadgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type UserRole = AdminUser['role'];
type RoleFilter = 'all' | UserRole;
type StatusFilter = 'all' | 'active' | 'banned';

const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

// State
const users = ref<AdminUser[]>([]);

const loading = ref(false);
const errorMessage = ref<string | null>(null);
const searchQuery = ref('');
const filterRole = ref<RoleFilter>('all');
const filterStatus = ref<StatusFilter>('all');
const selectedUser = ref<AdminUser | null>(null);
const showUserModal = ref(false);
const showBanConfirm = ref(false);
const showRoleConfirm = ref(false);
const banTargetUser = ref<AdminUser | null>(null);
const roleTargetUser = ref<AdminUser | null>(null);
const roleTargetRole = ref<UserRole | ''>('');
const actionLoading = ref(false);

const roleFilterOptions: { value: RoleFilter; label: string }[] = [
    { value: 'all', label: 'Tüm Roller' },
    { value: 'user', label: 'Kullanıcı' },
    { value: 'moderator', label: 'Moderatör' },
    { value: 'admin', label: 'Admin' },
];

const statusFilterOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Tüm Durumlar' },
    { value: 'active', label: 'Aktif' },
    { value: 'banned', label: 'Yasaklı' },
];

const roleOptions: { value: UserRole; label: string }[] = [
    { value: 'user', label: 'Kullanıcı' },
    { value: 'moderator', label: 'Moderatör' },
    { value: 'admin', label: 'Admin' },
];

onMounted(() => {
    if (!authStore.isAuthenticated) {
        router.push('/login');
        return;
    }
    fetchUsers();
});

let searchDebounce: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, () => {
    if (searchDebounce) clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => fetchUsers(), 300);
});
watch([filterRole, filterStatus], () => fetchUsers());

async function fetchUsers() {
    loading.value = true;
    errorMessage.value = null;
    const { data, error } = await api.listAdminUsers({
        search: searchQuery.value || undefined,
        role: filterRole.value,
        status: filterStatus.value,
    });
    if (error) {
        errorMessage.value = error.message;
        users.value = [];
    } else {
        users.value = data ?? [];
    }
    loading.value = false;
}

const filteredUsers = computed(() => users.value);
const hasActiveFilters = computed(() => searchQuery.value !== '' || filterRole.value !== 'all' || filterStatus.value !== 'all');

const staffCount = computed(() => users.value.filter((u) => u.role === 'admin' || u.role === 'moderator').length);
const bannedCount = computed(() => users.value.filter((u) => u.isBanned).length);
const activeCount = computed(() => users.value.filter((u) => u.isActive && !u.isBanned).length);

function clearFilters() {
    searchQuery.value = '';
    filterRole.value = 'all';
    filterStatus.value = 'all';
}

function openUserModal(user: AdminUser) {
    selectedUser.value = user;
    showUserModal.value = true;
}

function closeUserModal() {
    selectedUser.value = null;
    showUserModal.value = false;
}

function toggleBan(user: AdminUser) {
    banTargetUser.value = user;
    showBanConfirm.value = true;
}

async function confirmBan() {
    if (!banTargetUser.value) return;
    const target = banTargetUser.value;
    actionLoading.value = true;
    const { data, error } = await api.setAdminUserBan(target.id, !target.isBanned);
    actionLoading.value = false;
    if (error) {
        errorMessage.value = error.message;
        toast.error(error.message);
    } else if (data) {
        const idx = users.value.findIndex((u) => u.id === data.id);
        if (idx !== -1) users.value[idx] = data;
        if (selectedUser.value?.id === data.id) selectedUser.value = data;
        toast.success(data.isBanned ? 'Kullanıcı yasaklandı' : 'Yasak kaldırıldı');
    }
    banTargetUser.value = null;
    showBanConfirm.value = false;
}

function changeRole(user: AdminUser, newRole: UserRole) {
    roleTargetUser.value = user;
    roleTargetRole.value = newRole;
    showRoleConfirm.value = true;
}

async function confirmChangeRole() {
    if (!roleTargetUser.value || !roleTargetRole.value) return;
    const targetId = roleTargetUser.value.id;
    const newRole = roleTargetRole.value;
    actionLoading.value = true;
    const { data, error } = await api.setAdminUserRole(targetId, newRole);
    actionLoading.value = false;
    if (error) {
        errorMessage.value = error.message;
        toast.error(error.message);
    } else if (data) {
        const idx = users.value.findIndex((u) => u.id === data.id);
        if (idx !== -1) users.value[idx] = data;
        if (selectedUser.value?.id === data.id) selectedUser.value = data;
        toast.success(`Rol ${getRoleLabel(data.role)} olarak güncellendi`);
    }
    roleTargetUser.value = null;
    roleTargetRole.value = '';
    showRoleConfirm.value = false;
}

function getRoleLabel(role: string) {
    const labels: Record<string, string> = {
        user: 'Kullanıcı',
        moderator: 'Moderatör',
        admin: 'Admin',
    };
    return labels[role] || role;
}

function getRoleBadgeVariant(role: string): BadgeVariants['variant'] {
    const variants: Record<string, BadgeVariants['variant']> = {
        user: 'muted',
        moderator: 'info',
        admin: 'warning',
    };
    return variants[role] ?? 'muted';
}

function getStatusLabel(user: AdminUser) {
    if (user.isBanned) return 'Yasaklı';
    return user.isActive ? 'Aktif' : 'Pasif';
}

function getStatusBadgeVariant(user: AdminUser): BadgeVariants['variant'] {
    if (user.isBanned) return 'danger';
    return user.isActive ? 'success' : 'muted';
}

function getInitial(user: AdminUser) {
    return user.fullName.charAt(0).toUpperCase();
}

function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}
</script>

<template>
    <AdminLayout>
        <PageContainer size="wide">
            <PageHeader title="Kullanıcı Yönetimi" description="Platform kullanıcılarını görüntüleyin, rollerini ve erişimlerini yönetin." back-to="/admin" back-label="Admin Panel">
                <template #meta>
                    <Badge variant="secondary">{{ users.length }} kullanıcı</Badge>
                    <Badge v-if="hasActiveFilters" variant="outline">Filtrelenmiş</Badge>
                </template>
            </PageHeader>

            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Toplam Kullanıcı" :value="users.length" :icon="Users" />
                <StatCard label="Aktif" :value="activeCount" :icon="CheckCircle2" />
                <StatCard label="Yönetici / Moderatör" :value="staffCount" :icon="ShieldCheck" />
                <StatCard label="Yasaklı" :value="bannedCount" :icon="Ban" />
            </div>

            <ListToolbar>
                <SearchInput v-model="searchQuery" placeholder="Kullanıcı ara..." aria-label="Kullanıcı ara" />
                <template #filters>
                    <Select v-model="filterRole">
                        <SelectTrigger class="w-40" aria-label="Rol filtresi">
                            <SelectValue placeholder="Rol filtresi" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="option in roleFilterOptions" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select v-model="filterStatus">
                        <SelectTrigger class="w-40" aria-label="Durum filtresi">
                            <SelectValue placeholder="Durum filtresi" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="option in statusFilterOptions" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
                        </SelectContent>
                    </Select>
                </template>
            </ListToolbar>

            <Alert v-if="errorMessage" variant="destructive">
                <AlertDescription>{{ errorMessage }}</AlertDescription>
            </Alert>

            <LoadingState v-if="loading" text="Kullanıcılar yükleniyor..." />

            <EmptyState
                v-else-if="filteredUsers.length === 0"
                :icon="Users"
                title="Kullanıcı bulunamadı"
                :description="hasActiveFilters ? 'Arama veya filtreleri değiştirerek tekrar deneyin.' : 'Henüz kayıtlı kullanıcı yok.'"
            >
                <Button v-if="hasActiveFilters" variant="outline" class="h-11 md:h-9" @click="clearFilters">Filtreleri temizle</Button>
            </EmptyState>

            <div v-else class="overflow-hidden rounded-lg border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow class="hover:bg-transparent">
                            <TableHead class="pl-4">Kullanıcı</TableHead>
                            <TableHead class="hidden md:table-cell">Rol</TableHead>
                            <TableHead class="hidden md:table-cell">Durum</TableHead>
                            <TableHead class="hidden lg:table-cell">Kayıt Tarihi</TableHead>
                            <TableHead class="pr-4 text-right"><span class="sr-only">İşlemler</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow v-for="user in filteredUsers" :key="user.id">
                            <TableCell class="pl-4">
                                <div class="flex items-center gap-3">
                                    <Avatar class="size-9 rounded-md">
                                        <AvatarFallback class="rounded-md bg-primary/10 text-sm font-bold text-primary">{{ getInitial(user) }}</AvatarFallback>
                                    </Avatar>
                                    <div class="min-w-0">
                                        <p class="truncate text-sm font-medium text-foreground">{{ user.fullName }}</p>
                                        <p class="truncate text-xs text-muted-foreground">{{ user.email }}</p>
                                        <div class="mt-1 flex flex-wrap gap-1 md:hidden">
                                            <Badge :variant="getRoleBadgeVariant(user.role)">{{ getRoleLabel(user.role) }}</Badge>
                                            <Badge :variant="getStatusBadgeVariant(user)">{{ getStatusLabel(user) }}</Badge>
                                        </div>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell class="hidden md:table-cell">
                                <Badge :variant="getRoleBadgeVariant(user.role)">{{ getRoleLabel(user.role) }}</Badge>
                            </TableCell>
                            <TableCell class="hidden md:table-cell">
                                <Badge :variant="getStatusBadgeVariant(user)">{{ getStatusLabel(user) }}</Badge>
                            </TableCell>
                            <TableCell class="hidden text-muted-foreground lg:table-cell">{{ formatDate(user.createdAt) }}</TableCell>
                            <TableCell class="pr-4 text-right">
                                <div class="flex justify-end gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        class="hidden size-9 md:inline-flex"
                                        :aria-label="`${user.fullName} detayını gör`"
                                        @click="openUserModal(user)"
                                    >
                                        <Eye aria-hidden="true" />
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger as-child>
                                            <Button variant="ghost" size="icon" class="size-11 md:size-9" :aria-label="`${user.fullName} için işlemler`">
                                                <MoreHorizontal aria-hidden="true" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" class="w-48">
                                            <DropdownMenuItem class="min-h-11 md:min-h-9" @select="openUserModal(user)">
                                                <Eye aria-hidden="true" />
                                                Detay
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                class="min-h-11 md:min-h-9"
                                                :variant="user.isBanned ? 'default' : 'destructive'"
                                                @select="toggleBan(user)"
                                            >
                                                <component :is="user.isBanned ? CheckCircle2 : Ban" aria-hidden="true" />
                                                {{ user.isBanned ? 'Yasağı Kaldır' : 'Yasakla' }}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuLabel>Rol Değiştir</DropdownMenuLabel>
                                            <DropdownMenuItem
                                                v-for="option in roleOptions"
                                                :key="option.value"
                                                class="min-h-11 md:min-h-9"
                                                :disabled="user.role === option.value"
                                                @select="changeRole(user, option.value)"
                                            >
                                                <UserRound aria-hidden="true" />
                                                {{ option.label }}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </PageContainer>

        <!-- User detail dialog -->
        <Dialog v-model:open="showUserModal">
            <DialogContent v-if="selectedUser">
                <DialogHeader>
                    <DialogTitle>Kullanıcı Detayı</DialogTitle>
                    <DialogDescription>Hesap bilgileri ve durumu</DialogDescription>
                </DialogHeader>

                <div class="flex items-center gap-4">
                    <Avatar class="size-14 rounded-lg">
                        <AvatarFallback class="rounded-lg bg-primary/10 text-xl font-bold text-primary">{{ getInitial(selectedUser) }}</AvatarFallback>
                    </Avatar>
                    <div class="min-w-0 space-y-1">
                        <h3 class="truncate text-base font-semibold text-foreground">{{ selectedUser.fullName }}</h3>
                        <p class="truncate text-sm text-muted-foreground">{{ selectedUser.email }}</p>
                        <Badge :variant="getRoleBadgeVariant(selectedUser.role)">{{ getRoleLabel(selectedUser.role) }}</Badge>
                    </div>
                </div>

                <dl class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <dt class="text-xs text-muted-foreground uppercase">Kayıt Tarihi</dt>
                        <dd class="font-medium text-foreground">{{ formatDate(selectedUser.createdAt) }}</dd>
                    </div>
                    <div>
                        <dt class="text-xs text-muted-foreground uppercase">Durum</dt>
                        <dd>
                            <Badge :variant="getStatusBadgeVariant(selectedUser)">{{ getStatusLabel(selectedUser) }}</Badge>
                        </dd>
                    </div>
                </dl>

                <DialogFooter>
                    <Button variant="outline" class="h-11 md:h-9" @click="closeUserModal">Kapat</Button>
                    <Button
                        :variant="selectedUser.isBanned ? 'default' : 'destructive'"
                        class="h-11 md:h-9"
                        @click="toggleBan(selectedUser); closeUserModal();"
                    >
                        {{ selectedUser.isBanned ? 'Yasağı Kaldır' : 'Kullanıcıyı Yasakla' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <!-- Ban/Unban confirm -->
        <ConfirmDialog
            v-model:open="showBanConfirm"
            :title="banTargetUser?.isBanned ? 'Yasağı Kaldır' : 'Kullanıcıyı Yasakla'"
            :description="`${banTargetUser?.fullName || ''} kullanıcısının ${banTargetUser?.isBanned ? 'yasağını kaldırmak' : 'yasaklanmasını'} istediğinize emin misiniz?`"
            :confirm-text="banTargetUser?.isBanned ? 'Yasağı Kaldır' : 'Yasakla'"
            cancel-text="Vazgeç"
            :variant="banTargetUser?.isBanned ? 'primary' : 'danger'"
            :loading="actionLoading"
            @confirm="confirmBan"
        />

        <!-- Change role confirm -->
        <ConfirmDialog
            v-model:open="showRoleConfirm"
            title="Rol Değiştir"
            :description="`${roleTargetUser?.fullName || ''} kullanıcısının rolünü ${getRoleLabel(roleTargetRole)} olarak değiştirmek istediğinize emin misiniz?`"
            confirm-text="Değiştir"
            cancel-text="Vazgeç"
            variant="primary"
            :loading="actionLoading"
            @confirm="confirmChangeRole"
        />
    </AdminLayout>
</template>
