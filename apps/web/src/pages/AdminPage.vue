<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import AppLayout from '@/layouts/AppLayout.vue';

const router = useRouter();
const authStore = useAuthStore();

// Redirect if not admin/moderator
onMounted(() => {
    if (!authStore.isAuthenticated) {
        router.push('/login');
        return;
    }
});

// Stats (mock data - would come from API)
const stats = ref({
    totalUsers: 0,
    totalTopics: 0,
    totalReplies: 0,
    pendingReports: 0,
    activeUsers: 0,
    todayTopics: 0,
});

// Recent activity
const recentActivity = ref([
    { id: 1, type: 'topic', action: 'Yeni konu oluşturuldu', user: 'Ahmet Y.', time: '5 dk önce' },
    { id: 2, type: 'reply', action: 'Cevap eklendi', user: 'Mehmet K.', time: '12 dk önce' },
    { id: 3, type: 'user', action: 'Yeni kullanıcı kaydı', user: 'Ali T.', time: '1 sa önce' },
    { id: 4, type: 'report', action: 'İçerik rapor edildi', user: 'Veli B.', time: '2 sa önce' },
]);

// Navigation items
const navItems = [
    { name: 'Gösterge Paneli', icon: '📊', route: '/admin', active: true },
    { name: 'Kullanıcılar', icon: '👥', route: '/admin/users', active: false },
    { name: 'Firmalar', icon: '🏢', route: '/admin/firms', active: false },
];

function navigateTo(route: string) {
    router.push(route);
}

function getActivityIcon(type: string) {
    const icons: Record<string, string> = {
        topic: '📝',
        reply: '💬',
        user: '👤',
        report: '🚨',
    };
    return icons[type] || '📌';
}
</script>

<template>
    <AppLayout>
        <div class="admin-page">
            <!-- Admin Header -->
            <div class="admin-header">
                <div class="header-content">
                    <h1>🛡️ Admin Panel</h1>
                    <p class="subtitle">Topluluk yönetimi ve moderasyon</p>
                </div>
            </div>

            <div class="admin-layout">
                <!-- Sidebar Navigation -->
                <aside class="admin-sidebar">
                    <nav class="sidebar-nav">
                        <button
                            v-for="item in navItems"
                            :key="item.name"
                            :class="{ active: item.active }"
                            class="nav-item"
                            @click="navigateTo(item.route)"
                        >
                            <span class="nav-icon">{{ item.icon }}</span>
                            <span class="nav-text">{{ item.name }}</span>
                        </button>
                    </nav>
                </aside>

                <!-- Main Content -->
                <main class="admin-content">
                    <!-- Stats Grid -->
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon">👥</div>
                            <div class="stat-info">
                                <span class="stat-value">{{ stats.totalUsers }}</span>
                                <span class="stat-label">Toplam Kullanıcı</span>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">💬</div>
                            <div class="stat-info">
                                <span class="stat-value">{{ stats.totalTopics }}</span>
                                <span class="stat-label">Toplam Konu</span>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">📝</div>
                            <div class="stat-info">
                                <span class="stat-value">{{ stats.totalReplies }}</span>
                                <span class="stat-label">Toplam Cevap</span>
                            </div>
                        </div>
                        <div class="stat-card warning">
                            <div class="stat-icon">🚨</div>
                            <div class="stat-info">
                                <span class="stat-value">{{ stats.pendingReports }}</span>
                                <span class="stat-label">Bekleyen Rapor</span>
                            </div>
                        </div>
                    </div>

                    <!-- Quick Actions -->
                    <div class="section">
                        <h2 class="section-title">Hızlı İşlemler</h2>
                        <div class="quick-actions">
                            <button class="action-btn" @click="navigateTo('/admin/categories')">
                                <span class="action-icon">➕</span>
                                <span>Yeni Kategori</span>
                            </button>
                            <button class="action-btn" @click="navigateTo('/admin/users')">
                                <span class="action-icon">👤</span>
                                <span>Kullanıcı Yönet</span>
                            </button>
                            <button class="action-btn" @click="navigateTo('/admin/firms')">
                                <span class="action-icon">🏢</span>
                                <span>Firma Yönet</span>
                            </button>
                            <button class="action-btn" @click="navigateTo('/admin/reports')">
                                <span class="action-icon">📋</span>
                                <span>Raporları Gör</span>
                            </button>
                        </div>
                    </div>

                    <!-- Recent Activity -->
                    <div class="section">
                        <h2 class="section-title">Son Aktiviteler</h2>
                        <div class="activity-list">
                            <div v-for="activity in recentActivity" :key="activity.id" class="activity-item">
                                <span class="activity-icon">{{ getActivityIcon(activity.type) }}</span>
                                <div class="activity-info">
                                    <span class="activity-action">{{ activity.action }}</span>
                                    <span class="activity-user">{{ activity.user }}</span>
                                </div>
                                <span class="activity-time">{{ activity.time }}</span>
                            </div>
                        </div>
                    </div>


                </main>
            </div>
        </div>
    </AppLayout>
</template>

<style scoped>
.admin-page {
    min-height: 100vh;
}

/* Header */
.admin-header {
    padding: 24px;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.admin-header h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 700;
    color: var(--color-text-primary);
}

.subtitle {
    margin: 8px 0 0 0;
    font-size: 15px;
    color: var(--color-text-secondary);
}

/* Layout */
.admin-layout {
    display: flex;
    min-height: calc(100vh - 140px);
}

/* Sidebar */
.admin-sidebar {
    width: 260px;
    background: rgba(0, 0, 0, 0.2);
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    padding: 24px 16px;
}

.sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: transparent;
    border: none;
    border-radius: 10px;
    color: var(--color-text-secondary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
}

.nav-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text-primary);
}

.nav-item.active {
    background: rgba(16, 185, 129, 0.2);
    color: var(--color-primary);
}

.nav-icon {
    font-size: 18px;
}

/* Main Content */
.admin-content {
    flex: 1;
    padding: 24px;
    overflow-y: auto;
}

/* Stats Grid */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 20px;
    margin-bottom: 32px;
}

.stat-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    transition: all 0.3s ease;
}

.stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.stat-card.warning {
    border-color: rgba(251, 191, 36, 0.3);
    background: rgba(251, 191, 36, 0.05);
}

.stat-icon {
    font-size: 32px;
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 12px;
}

.stat-card.warning .stat-icon {
    background: rgba(251, 191, 36, 0.1);
}

.stat-info {
    display: flex;
    flex-direction: column;
}

.stat-value {
    font-size: 28px;
    font-weight: 700;
    color: var(--color-text-primary);
}

.stat-label {
    font-size: 13px;
    color: var(--color-text-muted);
    margin-top: 4px;
}

/* Section */
.section {
    margin-bottom: 32px;
}

.section-title {
    margin: 0 0 16px 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary);
}

/* Quick Actions */
.quick-actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
}

.action-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 20px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

.action-btn:hover {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
    transform: translateY(-2px);
}

.action-icon {
    font-size: 18px;
}

/* Activity List */
.activity-list {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    overflow: hidden;
}

.activity-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    transition: background 0.2s ease;
}

.activity-item:last-child {
    border-bottom: none;
}

.activity-item:hover {
    background: rgba(255, 255, 255, 0.02);
}

.activity-icon {
    font-size: 20px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 8px;
}

.activity-info {
    flex: 1;
    display: flex;
    flex-direction: column;
}

.activity-action {
    font-size: 14px;
    color: var(--color-border);
}

.activity-user {
    font-size: 12px;
    color: var(--color-text-muted);
    margin-top: 2px;
}

.activity-time {
    font-size: 12px;
    color: var(--color-text-muted);
}

/* Categories Table */
.categories-table {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    overflow: hidden;
}

.table-header,
.table-row {
    display: grid;
    grid-template-columns: 48px 1fr 80px 100px 100px;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
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
    font-size: 14px;
    color: var(--color-text-primary);
}

.table-row:last-child {
    border-bottom: none;
}

.table-row:hover {
    background: rgba(255, 255, 255, 0.02);
}

.col-icon {
    font-size: 20px;
    text-align: center;
}

.col-name {
    font-weight: 500;
}

.col-topics {
    text-align: center;
    color: var(--color-primary);
    font-weight: 600;
}

.col-status {
    text-align: center;
}

.status-active {
    padding: 4px 10px;
    background: rgba(16, 185, 129, 0.2);
    color: var(--color-primary);
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
}

.status-inactive {
    padding: 4px 10px;
    background: rgba(148, 163, 184, 0.2);
    color: var(--color-text-secondary);
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
}

.col-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
}

.icon-btn {
    padding: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s ease;
}

.icon-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: scale(1.1);
}

.empty-table {
    padding: 40px;
    text-align: center;
    color: var(--color-text-muted);
    font-size: 14px;
}

/* Responsive */
@media (max-width: 1024px) {
    .admin-layout {
        flex-direction: column;
    }

    .admin-sidebar {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding: 16px;
    }

    .sidebar-nav {
        flex-direction: row;
        flex-wrap: wrap;
        gap: 8px;
    }

    .nav-item {
        flex: 1;
        min-width: 140px;
        justify-content: center;
    }
}

@media (max-width: 768px) {
    .admin-content {
        padding: 16px;
    }

    .stats-grid {
        grid-template-columns: 1fr;
    }

    .table-header,
    .table-row {
        grid-template-columns: 36px 1fr 60px 80px;
    }

    .col-actions {
        display: none;
    }
}
</style>
