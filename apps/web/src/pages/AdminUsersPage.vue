<script setup lang="ts">
import { onMounted, ref, computed, watch, nextTick } from 'vue';
import { useFocusTrap } from '@/composables/useFocusTrap';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { api, type AdminUser } from '@/services/api';
import AppLayout from '@/layouts/AppLayout.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import AppEmptyState from '@/components/ui/AppEmptyState.vue';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';

const router = useRouter();
const authStore = useAuthStore();

// State
const users = ref<AdminUser[]>([]);

const loading = ref(false);
const errorMessage = ref<string | null>(null);
const searchQuery = ref('');
const filterRole = ref<'all' | 'user' | 'moderator' | 'admin'>('all');
const filterStatus = ref<'all' | 'active' | 'banned'>('all');
const selectedUser = ref<AdminUser | null>(null);
const showUserModal = ref(false);
const userModalRef = ref<HTMLElement | null>(null);
watch(showUserModal, (v) => { if (v) nextTick(() => userModalRef.value?.focus()); });
useFocusTrap(showUserModal, userModalRef);
const showBanConfirm = ref(false);
const showRoleConfirm = ref(false);
const banTargetUser = ref<AdminUser | null>(null);
const roleTargetUser = ref<AdminUser | null>(null);
const roleTargetRole = ref<'user' | 'moderator' | 'admin' | ''>('');
const actionLoading = ref(false);

// Options for AppSelect
const roleFilterOptions = [
    { value: 'all', label: 'Tüm Roller' },
    { value: 'user', label: 'Kullanıcı' },
    { value: 'moderator', label: 'Moderatör' },
    { value: 'admin', label: 'Admin' }
];

const statusFilterOptions = [
    { value: 'all', label: 'Tüm Durumlar' },
    { value: 'active', label: 'Aktif' },
    { value: 'banned', label: 'Yasaklı' }
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
    } else if (data) {
        const idx = users.value.findIndex(u => u.id === data.id);
        if (idx !== -1) users.value[idx] = data;
        if (selectedUser.value?.id === data.id) selectedUser.value = data;
    }
    banTargetUser.value = null;
}

function changeRole(user: AdminUser, newRole: 'user' | 'moderator' | 'admin') {
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
    } else if (data) {
        const idx = users.value.findIndex(u => u.id === data.id);
        if (idx !== -1) users.value[idx] = data;
        if (selectedUser.value?.id === data.id) selectedUser.value = data;
    }
    roleTargetUser.value = null;
    roleTargetRole.value = '';
}

function getRoleLabel(role: string) {
    const labels: Record<string, string> = {
        user: 'Kullanıcı',
        moderator: 'Moderatör',
        admin: 'Admin',
    };
    return labels[role] || role;
}

function getRoleBadgeClass(role: string) {
    const classes: Record<string, string> = {
        user: 'role-user',
        moderator: 'role-mod',
        admin: 'role-admin',
    };
    return classes[role] || 'role-user';
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
    <AppLayout>
        <div class="admin-users-page">
            <!-- Header -->
            <div class="page-header">
                <div>
                    <div class="breadcrumb">
                        <router-link to="/admin" class="breadcrumb-link">Admin Panel</router-link>
                        <span class="breadcrumb-separator">/</span>
                        <span class="breadcrumb-current">Kullanıcılar</span>
                    </div>
                    <h1>👥 Kullanıcı Yönetimi</h1>
                </div>
            </div>

            <!-- Filters -->
            <div class="filters-bar">
                <div class="search-box">
                    <span class="search-icon">🔍</span>
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Kullanıcı ara..."
                        class="search-input"
                    />
                </div>
                <AppSelect
                    v-model="filterRole"
                    :options="roleFilterOptions"
                    placeholder="Rol filtresi"
                />
                <AppSelect
                    v-model="filterStatus"
                    :options="statusFilterOptions"
                    placeholder="Durum filtresi"
                />
            </div>

            <!-- Error -->
            <div v-if="errorMessage" class="error-banner">
                {{ errorMessage }}
            </div>

            <!-- Loading -->
            <div v-if="loading" class="loading-state">
                <div class="spinner"></div>
                <p>Kullanıcılar yükleniyor...</p>
            </div>

            <!-- Users Table -->
            <div v-else class="users-table">
                <div class="table-header">
                    <span class="col-user">Kullanıcı</span>
                    <span class="col-role">Rol</span>
                    <span class="col-status">Durum</span>
                    <span class="col-date">Kayıt Tarihi</span>
                    <span class="col-actions">İşlemler</span>
                </div>

                <div
                    v-for="user in filteredUsers"
                    :key="user.id"
                    class="table-row"
                >
                    <div class="col-user">
                        <div class="user-avatar">{{ user.fullName.charAt(0) }}</div>
                        <div class="user-info">
                            <span class="user-name">{{ user.fullName }}</span>
                            <span class="user-email">{{ user.email }}</span>
                        </div>
                    </div>
                    <span class="col-role">
                        <span :class="['role-badge', getRoleBadgeClass(user.role)]">
                            {{ getRoleLabel(user.role) }}
                        </span>
                    </span>
                    <span class="col-status">
                        <span v-if="user.isBanned" class="status-banned">🚫 Yasaklı</span>
                        <span v-else-if="user.isActive" class="status-active">✓ Aktif</span>
                        <span v-else class="status-inactive">○ Pasif</span>
                    </span>
                    <span class="col-date">{{ formatDate(user.createdAt) }}</span>
                    <span class="col-actions">
                        <button class="action-btn view" title="Detay" @click="openUserModal(user)">👁️</button>
                        <button
                            :class="['action-btn', user.isBanned ? 'unban' : 'ban']"
                            :title="user.isBanned ? 'Yasağı Kaldır' : 'Yasakla'"
                            @click="toggleBan(user)"
                        >
                            {{ user.isBanned ? '✓' : '🚫' }}
                        </button>
                        <div class="role-dropdown">
                            <button class="action-btn role" title="Rol Değiştir">👤</button>
                            <div class="dropdown-menu">
                                <button @click="changeRole(user, 'user')">Kullanıcı</button>
                                <button @click="changeRole(user, 'moderator')">Moderatör</button>
                                <button @click="changeRole(user, 'admin')">Admin</button>
                            </div>
                        </div>
                    </span>
                </div>

                <!-- Empty State -->
                <AppEmptyState
                    v-if="filteredUsers.length === 0"
                    icon="users"
                    title="Kullanıcı bulunamadı"
                />
            </div>

            <!-- User Detail Modal -->
            <div v-if="showUserModal && selectedUser" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="user-modal-title" @click.self="closeUserModal" @keydown.esc="closeUserModal">
                <div class="modal" ref="userModalRef" tabindex="-1">
                    <div class="modal-header">
                        <h2 id="user-modal-title">Kullanıcı Detayı</h2>
                        <button class="close-btn" aria-label="Kapat" @click="closeUserModal">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="user-profile">
                            <div class="profile-avatar">{{ selectedUser.fullName.charAt(0) }}</div>
                            <div class="profile-info">
                                <h3>{{ selectedUser.fullName }}</h3>
                                <p>{{ selectedUser.email }}</p>
                                <span :class="['role-badge', getRoleBadgeClass(selectedUser.role)]">
                                    {{ getRoleLabel(selectedUser.role) }}
                                </span>
                            </div>
                        </div>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">Kayıt Tarihi</span>
                                <span class="detail-value">{{ formatDate(selectedUser.createdAt) }}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Durum</span>
                                <span class="detail-value">
                                    {{ selectedUser.isBanned ? 'Yasaklı' : (selectedUser.isActive ? 'Aktif' : 'Pasif') }}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button
                            :class="['btn', selectedUser.isBanned ? 'btn-success' : 'btn-danger']"
                            @click="toggleBan(selectedUser); closeUserModal();"
                        >
                            {{ selectedUser.isBanned ? 'Yasağı Kaldır' : 'Kullanıcıyı Yasakla' }}
                        </button>
                        <button class="btn btn-secondary" @click="closeUserModal">Kapat</button>
                    </div>
                </div>
            </div>
        <!-- Ban/Unban Confirm Modal -->
        <ConfirmModal
            v-model="showBanConfirm"
            :title="banTargetUser?.isBanned ? 'Yasağı Kaldır' : 'Kullanıcıyı Yasakla'"
            :message="`${banTargetUser?.fullName || ''} kullanicisini ${banTargetUser?.isBanned ? 'yasagini kaldirmak' : 'yasaklamak'} istediginize emin misiniz?`"
            :confirm-text="banTargetUser?.isBanned ? 'Yasağı Kaldır' : 'Yasakla'"
            cancel-text="Vazgec"
            :variant="banTargetUser?.isBanned ? 'info' : 'danger'"
            @confirm="confirmBan"
        />

        <!-- Change Role Confirm Modal -->
        <ConfirmModal
            v-model="showRoleConfirm"
            title="Rol Değiştir"
            :message="`${roleTargetUser?.fullName || ''} kullanicisinin rolunu ${getRoleLabel(roleTargetRole)} olarak degistirmek istediginize emin misiniz?`"
            confirm-text="Değiştir"
            cancel-text="Vazgec"
            variant="warning"
            @confirm="confirmChangeRole"
        />
        </div>
    </AppLayout>
</template>

<style scoped>
.admin-users-page {
    padding: 24px;
    max-width: 1400px;
    margin: 0 auto;
}

/* Header */
.page-header {
    margin-bottom: 24px;
}

.breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 14px;
}

.breadcrumb-link {
    color: var(--color-primary);
    text-decoration: none;
}

.breadcrumb-link:hover {
    color: var(--color-primary-hover);
}

.breadcrumb-separator {
    color: var(--color-text-muted);
}

.breadcrumb-current {
    color: var(--color-text-secondary);
}

.page-header h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 700;
    color: #ffffff;
}

/* Filters */
.filters-bar {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
}

.search-box {
    flex: 1;
    min-width: 250px;
    position: relative;
}

.search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 16px;
}

.search-input {
    width: 100%;
    height: var(--control-height);
    padding: 0 12px 0 44px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: #ffffff;
    font-size: 14px;
}

.search-input:focus {
    outline: none;
    border-color: var(--color-primary);
}

.search-input::placeholder {
    color: var(--color-text-muted);
}

.filter-select {
    height: var(--control-height);
    padding: 0 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: #ffffff;
    font-size: 14px;
    cursor: pointer;
    min-width: 150px;
}

.filter-select:focus {
    outline: none;
    border-color: var(--color-primary);
}

.filter-select option {
    background: var(--color-bg-secondary);
}

/* Error */
.error-banner {
    padding: 12px 16px;
    margin-bottom: 16px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: var(--color-danger);
    font-size: 14px;
}

/* Loading */
.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 60px;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.loading-state p {
    margin-top: 16px;
    color: var(--color-text-secondary);
}

/* Users Table */
.users-table {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    overflow: hidden;
}

.table-header,
.table-row {
    display: grid;
    grid-template-columns: 2fr 120px 100px 120px 120px;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
}

.table-header {
    background: rgba(0, 0, 0, 0.2);
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.table-row {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.table-row:last-child {
    border-bottom: none;
}

.table-row:hover {
    background: rgba(255, 255, 255, 0.02);
}

/* User Column */
.col-user {
    display: flex;
    align-items: center;
    gap: 12px;
}

.user-avatar {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 16px;
    color: white;
}

.user-info {
    display: flex;
    flex-direction: column;
}

.user-name {
    font-weight: 600;
    color: #ffffff;
    font-size: 14px;
}

.user-email {
    font-size: 12px;
    color: var(--color-text-muted);
}

/* Role Badge */
.role-badge {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
}

.role-user {
    background: rgba(148, 163, 184, 0.2);
    color: var(--color-text-secondary);
}

.role-mod {
    background: rgba(59, 130, 246, 0.2);
    color: var(--color-info);
}

.role-admin {
    background: rgba(168, 85, 247, 0.2);
    color: #a855f7;
}

/* Status */
.status-active {
    color: var(--color-primary);
    font-size: 13px;
}

.status-inactive {
    color: var(--color-text-muted);
    font-size: 13px;
}

.status-banned {
    color: var(--color-danger);
    font-size: 13px;
}

/* Date */
.col-date {
    font-size: 13px;
    color: var(--color-text-secondary);
}

/* Actions */
.col-actions {
    display: flex;
    gap: 8px;
}

.action-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
}

.action-btn.view {
    background: rgba(59, 130, 246, 0.2);
}

.action-btn.ban {
    background: rgba(239, 68, 68, 0.2);
}

.action-btn.unban {
    background: rgba(16, 185, 129, 0.2);
}

.action-btn.role {
    background: rgba(168, 85, 247, 0.2);
}

.action-btn:hover {
    transform: scale(1.1);
}

/* Role Dropdown */
.role-dropdown {
    position: relative;
}

.dropdown-menu {
    position: absolute;
    top: 100%;
    right: 0;
    background: var(--color-bg-secondary);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 4px;
    display: none;
    z-index: 100;
    min-width: 120px;
}

.role-dropdown:hover .dropdown-menu {
    display: block;
}

.dropdown-menu button {
    display: block;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    color: var(--color-text-primary);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    border-radius: 4px;
}

.dropdown-menu button:hover {
    background: rgba(255, 255, 255, 0.1);
}

/* Empty State */
.empty-state {
    padding: 60px;
    text-align: center;
}

.empty-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 12px;
}

.empty-state p {
    margin: 0;
    color: var(--color-text-muted);
}

/* Modal */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
}

.modal {
    background: var(--color-bg-secondary);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    width: 100%;
    max-width: 500px;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h2 {
    margin: 0;
    font-size: 18px;
    color: #ffffff;
}

.close-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 20px;
    cursor: pointer;
}

.close-btn:hover {
    color: #ffffff;
}

.modal-body {
    padding: 24px;
}

.user-profile {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
}

.profile-avatar {
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 24px;
    color: white;
}

.profile-info h3 {
    margin: 0;
    font-size: 18px;
    color: #ffffff;
}

.profile-info p {
    margin: 4px 0 8px;
    font-size: 14px;
    color: var(--color-text-muted);
}

.detail-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
}

.detail-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.detail-label {
    font-size: 12px;
    color: var(--color-text-muted);
    text-transform: uppercase;
}

.detail-value {
    font-size: 15px;
    color: var(--color-text-primary);
    font-weight: 500;
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

.btn-secondary {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
}

.btn-danger {
    background: rgba(239, 68, 68, 0.2);
    color: var(--color-danger);
}

.btn-success {
    background: rgba(16, 185, 129, 0.2);
    color: var(--color-primary);
}

.btn:hover {
    transform: translateY(-2px);
}

/* Responsive */
@media (max-width: 1024px) {
    .table-header,
    .table-row {
        grid-template-columns: 1.5fr 100px 80px 100px;
    }

    .col-date {
        display: none;
    }
}

@media (max-width: 768px) {
    .admin-users-page {
        padding: 16px;
    }

    .filters-bar {
        flex-direction: column;
    }

    .filter-select {
        width: 100%;
    }

    .table-header,
    .table-row {
        grid-template-columns: 1fr 100px;
    }

    .col-role,
    .col-status,
    .col-date {
        display: none;
    }
}
</style>
