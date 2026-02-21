<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useFirmsStore } from '@/stores/firmsStore';
import AppLayout from '@/layouts/AppLayout.vue';

const firmsStore = useFirmsStore();
const router = useRouter();
const searchQuery = ref('');

const qualityLabels: Record<string, string> = {
    'shoot': 'Surgun',
    'leaf': 'Yaprak',
    'mixed': 'Karisik'
};

const filteredFirms = computed(() => {
    if (!searchQuery.value) return firmsStore.firms;
    const q = searchQuery.value.toLowerCase();
    return firmsStore.firms.filter(f =>
        f.name.toLowerCase().includes(q) ||
        (f.description && f.description.toLowerCase().includes(q))
    );
});

function navigateToFirm(id: string) {
    router.push(`/firms/${id}`);
}

function getInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

onMounted(() => {
    firmsStore.fetchFirms();
});
</script>

<template>
    <AppLayout>
        <div class="firms-page">
            <header class="page-header">
                <div class="header-content">
                    <h1>Firmalar</h1>
                    <p class="subtitle">
                        Anlasmali {{ firmsStore.firmCount }} firma
                    </p>
                </div>
            </header>

            <!-- Search -->
            <div class="search-wrap">
                <div class="search-box">
                    <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Firma ara..."
                        class="search-input"
                    />
                </div>
            </div>

            <!-- Loading -->
            <div v-if="firmsStore.isLoading" class="loading">
                <div class="spinner"></div>
            </div>

            <!-- Empty -->
            <div v-else-if="filteredFirms.length === 0" class="empty-state">
                <div class="empty-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-text-muted)">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                </div>
                <h3>Henuz firma kaydedilmemis</h3>
                <p>Anlasmali firmalar burada listelenecektir</p>
            </div>

            <!-- Firms Grid -->
            <div v-else class="firms-grid">
                <div
                    v-for="firm in filteredFirms"
                    :key="firm.id"
                    class="firm-card"
                    @click="navigateToFirm(firm.id)"
                >
                    <div class="firm-card-header">
                        <div class="firm-avatar" :class="{ 'firm-avatar--inactive': !firm.isActive }">
                            {{ getInitials(firm.name) }}
                        </div>
                        <div class="firm-info">
                            <h3 class="firm-name">{{ firm.name }}</h3>
                            <p v-if="firm.description" class="firm-desc">{{ firm.description }}</p>
                        </div>
                        <span class="status-badge" :class="firm.isActive ? 'status-active' : 'status-inactive'">
                            {{ firm.isActive ? 'Aktif' : 'Pasif' }}
                        </span>
                    </div>

                    <div class="firm-card-body">
                        <div v-if="firm.phone" class="firm-detail">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
                            <span>{{ firm.phone }}</span>
                        </div>
                        <div v-if="firm.address" class="firm-detail">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                <circle cx="12" cy="10" r="3"/>
                            </svg>
                            <span>{{ firm.address }}</span>
                        </div>
                    </div>

                    <div class="firm-card-footer">
                        <span class="view-link">
                            Tarifeleri Gor
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
                        </span>
                    </div>
                </div>
            </div>

            <!-- Error -->
            <p v-if="firmsStore.error" class="error-message">{{ firmsStore.error }}</p>
        </div>
    </AppLayout>
</template>

<style scoped>
.firms-page {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
}

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
}

.header-content h1 {
    font-size: 32px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
}

.subtitle {
    color: var(--color-text-muted);
    margin: 4px 0 0 0;
}

/* ── Search ── */
.search-wrap {
    margin-bottom: 24px;
}

.search-box {
    position: relative;
    max-width: 400px;
}

.search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-text-muted);
    pointer-events: none;
}

.search-input {
    width: 100%;
    padding: 12px 12px 12px 42px;
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: 14px;
    color: var(--color-text-primary);
    transition: border-color var(--transition-fast);
}

.search-input:focus {
    outline: none;
    border-color: var(--color-primary);
}

.search-input::placeholder {
    color: var(--color-text-muted);
}

/* ── Grid ── */
.firms-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 16px;
}

/* ── Card ── */
.firm-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.firm-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
    border-color: var(--color-primary);
}

.firm-card-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 20px 20px 12px;
}

.firm-avatar {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-lg);
    background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
    flex-shrink: 0;
}

.firm-avatar--inactive {
    background: var(--color-bg-tertiary);
    color: var(--color-text-muted);
}

.firm-info {
    flex: 1;
    min-width: 0;
}

.firm-name {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0 0 4px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.firm-desc {
    font-size: 13px;
    color: var(--color-text-muted);
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.status-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    flex-shrink: 0;
}

.status-active {
    background: rgba(34, 197, 94, 0.15);
    color: var(--color-success);
}

.status-inactive {
    background: rgba(245, 158, 11, 0.15);
    color: var(--color-warning);
}

.firm-card-body {
    padding: 0 20px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.firm-detail {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--color-text-secondary);
}

.firm-detail svg {
    flex-shrink: 0;
    color: var(--color-text-muted);
}

.firm-card-footer {
    padding: 12px 20px;
    border-top: 1px solid var(--color-border);
    background: var(--color-bg-tertiary);
}

.view-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-primary);
    transition: gap var(--transition-fast);
}

.firm-card:hover .view-link {
    gap: 8px;
}

/* ── Loading & Empty ── */
.loading {
    text-align: center;
    padding: 60px;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.empty-state {
    text-align: center;
    padding: 60px;
    background: var(--color-bg-tertiary);
    border-radius: 16px;
}

.empty-state h3 {
    color: var(--color-text-primary);
    margin: 16px 0 8px;
}

.empty-state p {
    color: var(--color-text-muted);
    font-size: 14px;
}

.error-message {
    background: rgba(239, 68, 68, 0.1);
    color: var(--color-danger);
    padding: 12px;
    border-radius: 8px;
    margin-top: 16px;
    font-size: 14px;
}

/* ── Responsive ── */
@media (max-width: 768px) {
    .firms-page {
        padding: 16px;
    }

    .header-content h1 {
        font-size: 24px;
    }

    .firms-grid {
        grid-template-columns: 1fr;
    }

    .search-box {
        max-width: 100%;
    }
}
</style>
