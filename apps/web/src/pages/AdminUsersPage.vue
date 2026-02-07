<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import AppLayout from '@/layouts/AppLayout.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';

const router = useRouter();
const authStore = useAuthStore();

// State
const users = ref<Array<{
    id: string;
    fullName: string;
    email: string;
    role: string;
    isActive: boolean;
    isBanned: boolean;
    createdAt: string;
    topicCount: number;
    replyCount: number;
}>>([]);

const loading = ref(false);
const searchQuery = ref('');
const filterRole = ref('all');
const filterStatus = ref('all');
const selectedUser = ref<typeof users.value[0] | null>(null);
const showUserModal = ref(false);
const showBanConfirm = ref(false);
const showRoleConfirm = ref(false);
const banTargetUser = ref<typeof users.value[0] | null>(null);
const roleTargetUser = ref<typeof users.value[0] | null>(null);
const roleTargetRole = ref('');

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

// Mock data - would come from API
onMounted(() => {
    if (!authStore.isAuthenticated) {
        router.push('/login');
        return;
    }
    fetchUsers();
});

async function fetchUsers() {
    loading.value = true;
    // Mock users - in real app, call API
    setTimeout(() => {
        users.value = [
            { id: '1', fullName: 'Ahmet Yılmaz', email: 'ahmet@example.com', role: 'user', isActive: true, isBanned: false, createdAt: '2024-01-15', topicCount: 5, replyCount: 23 },
            { id: '2', fullName: 'Mehmet Kaya', email: 'mehmet@example.com', role: 'moderator', isActive: true, isBanned: false, createdAt: '2024-01-10', topicCount: 12, replyCount: 45 },
            { id: '3', fullName: 'Ali Demir', email: 'ali@example.com', role: 'user', isActive: false, isBanned: true, createdAt: '2024-02-01', topicCount: 0, replyCount: 3 },
            { id: '4', fullName: 'Veli Şahin', email: 'veli@example.com', role: 'admin', isActive: true, isBanned: false, createdAt: '2023-12-01', topicCount: 8, replyCount: 67 },
        ];
        loading.value = false;
    }, 500);
}

const filteredUsers = computed(() => {
    return users.value.filter(user => {
        const matchesSearch = user.fullName.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                            user.email.toLowerCase().includes(searchQuery.value.toLowerCase());
        const matchesRole = filterRole.value === 'all' || user.role === filterRole.value;
        const matchesStatus = filterStatus.value === 'all' ||
                            (filterStatus.value === 'active' && user.isActive && !user.isBanned) ||
                            (filterStatus.value === 'banned' && user.isBanned);
        return matchesSearch && matchesRole && matchesStatus;
    });
});

function openUserModal(user: typeof users.value[0]) {
    selectedUser.value = user;
    showUserModal.value = true;
}

function closeUserModal() {
    selectedUser.value = null;
    showUserModal.value = false;
}

function toggleBan(user: typeof users.value[0]) {
    banTargetUser.value = user;
    showBanConfirm.value = true;
}

function confirmBan() {
    if (banTargetUser.value) {
        banTargetUser.value.isBanned = !banTargetUser.value.isBanned;
        banTargetUser.value.isActive = !banTargetUser.value.isBanned;
        banTargetUser.value = null;
    }
}

function changeRole(user: typeof users.value[0], newRole: string) {
    roleTargetUser.value = user;
    roleTargetRole.value = newRole;
    showRoleConfirm.value = true;
}

function confirmChangeRole() {
    if (roleTargetUser.value) {
        roleTargetUser.value.role = roleTargetRole.value;
        roleTargetUser.value = null;
        roleTargetRole.value = '';
    }
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
                    <span class="col-stats">İstatistikler</span>
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
                    <span class="col-stats">
                        <span class="stat-item">📝 {{ user.topicCount }}</span>
                        <span class="stat-item">💬 {{ user.replyCount }}</span>
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
                <div v-if="filteredUsers.length === 0" class="empty-state">
                    <span class="empty-icon">👥</span>
                    <p>Kullanıcı bulunamadı</p>
                </div>
            </div>

            <!-- User Detail Modal -->
            <div v-if="showUserModal && selectedUser" class="modal-overlay" @click.self="closeUserModal">
                <div class="modal">
                    <div class="modal-header">
                        <h2>Kullanıcı Detayı</h2>
                        <button class="close-btn" @click="closeUserModal">✕</button>
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
                            <div class="detail-item">
                                <span class="detail-label">Toplam Konu</span>
                                <span class="detail-value">{{ selectedUser.topicCount }}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Toplam Cevap</span>
                                <span class="detail-value">{{ selectedUser.replyCount }}</span>
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
            :title="banTargetUser?.isBanned ? 'Yasagi Kaldir' : 'Kullaniciyi Yasakla'"
            :message="`${banTargetUser?.fullName || ''} kullanicisini ${banTargetUser?.isBanned ? 'yasagini kaldirmak' : 'yasaklamak'} istediginize emin misiniz?`"
            :confirm-text="banTargetUser?.isBanned ? 'Yasagi Kaldir' : 'Yasakla'"
            cancel-text="Vazgec"
            :variant="banTargetUser?.isBanned ? 'info' : 'danger'"
            @confirm="confirmBan"
        />

        <!-- Change Role Confirm Modal -->
        <ConfirmModal
            v-model="showRoleConfirm"
            title="Rol Degistir"
            :message="`${roleTargetUser?.fullName || ''} kullanicisinin rolunu ${getRoleLabel(roleTargetRole)} olarak degistirmek istediginize emin misiniz?`"
            confirm-text="Degistir"
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
    color: #10b981;
    text-decoration: none;
}

.breadcrumb-link:hover {
    color: #059669;
}

.breadcrumb-separator {
    color: #64748b;
}

.breadcrumb-current {
    color: #94a3b8;
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
    padding: 12px 12px 12px 44px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: #ffffff;
    font-size: 14px;
}

.search-input:focus {
    outline: none;
    border-color: #10b981;
}

.search-input::placeholder {
    color: #64748b;
}

.filter-select {
    padding: 12px 16px;
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
    border-color: #10b981;
}

.filter-select option {
    background: #1e293b;
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
    border-top-color: #10b981;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.loading-state p {
    margin-top: 16px;
    color: #94a3b8;
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
    grid-template-columns: 2fr 120px 140px 100px 120px 120px;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
}

.table-header {
    background: rgba(0, 0, 0, 0.2);
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
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
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
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
    color: #64748b;
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
    color: #94a3b8;
}

.role-mod {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
}

.role-admin {
    background: rgba(168, 85, 247, 0.2);
    color: #a855f7;
}

/* Stats */
.col-stats {
    display: flex;
    gap: 12px;
}

.stat-item {
    font-size: 13px;
    color: #94a3b8;
}

/* Status */
.status-active {
    color: #10b981;
    font-size: 13px;
}

.status-inactive {
    color: #64748b;
    font-size: 13px;
}

.status-banned {
    color: #ef4444;
    font-size: 13px;
}

/* Date */
.col-date {
    font-size: 13px;
    color: #94a3b8;
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
    background: #1e293b;
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
    color: #e2e8f0;
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
    color: #64748b;
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
    background: #1e293b;
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
    color: #64748b;
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
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
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
    color: #64748b;
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
    color: #64748b;
    text-transform: uppercase;
}

.detail-value {
    font-size: 15px;
    color: #e2e8f0;
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
    color: #ef4444;
}

.btn-success {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
}

.btn:hover {
    transform: translateY(-2px);
}

/* Responsive */
@media (max-width: 1024px) {
    .table-header,
    .table-row {
        grid-template-columns: 1.5fr 100px 100px 80px 100px;
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
    .col-stats,
    .col-status,
    .col-date {
        display: none;
    }
}
</style>
