<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { useFirmsStore } from '@/stores/firmsStore';
import AppLayout from '@/layouts/AppLayout.vue';
import AppSelect from '@/components/ui/AppSelect.vue';

const route = useRoute();
const firmsStore = useFirmsStore();

const activeTab = ref<'tariffs' | 'locations'>('tariffs');
const provinceFilter = ref('');
const districtFilter = ref('');

const firmId = computed(() => route.params.id as string);

const qualityLabels: Record<string, string> = {
    'shoot': 'Surgun',
    'leaf': 'Yaprak',
    'mixed': 'Karisik'
};

const qualityIcons: Record<string, string> = {
    'shoot': '🌱',
    'leaf': '🍃',
    'mixed': '🌿'
};

// Cay bolgeleri il/ilce secenekleri
const provinceOptions = computed(() => [
    { value: '', label: 'Tum Iller' },
    { value: 'Rize', label: 'Rize' },
    { value: 'Trabzon', label: 'Trabzon' },
    { value: 'Artvin', label: 'Artvin' },
    { value: 'Giresun', label: 'Giresun' },
    { value: 'Ordu', label: 'Ordu' },
]);

// Unique district listesi collection point'lerden
const districtOptions = computed(() => {
    const districts = new Set<string>();
    firmsStore.collectionPoints.forEach(p => {
        if (!provinceFilter.value || p.province === provinceFilter.value) {
            districts.add(p.district);
        }
    });
    return [
        { value: '', label: 'Tum Ilceler' },
        ...Array.from(districts).sort().map(d => ({ value: d, label: d })),
    ];
});

const filteredCollectionPoints = computed(() => {
    return firmsStore.collectionPoints.filter(p => {
        if (provinceFilter.value && p.province !== provinceFilter.value) return false;
        if (districtFilter.value && p.district !== districtFilter.value) return false;
        return true;
    });
});

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

function formatPrice(price: number) {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(price);
}

function onProvinceChange() {
    districtFilter.value = '';
}

async function loadFirmData() {
    await firmsStore.fetchFirm(firmId.value);
    await Promise.all([
        firmsStore.fetchCurrentTariffs(firmId.value),
        firmsStore.fetchCollectionPoints(firmId.value),
    ]);
}

onMounted(loadFirmData);
</script>

<template>
    <AppLayout>
        <div class="firm-detail-page">
            <!-- Loading -->
            <div v-if="firmsStore.isLoading && !firmsStore.currentFirm" class="loading">
                <div class="spinner"></div>
            </div>

            <template v-else-if="firmsStore.currentFirm">
                <!-- Breadcrumb -->
                <nav class="breadcrumb">
                    <RouterLink to="/firms" class="breadcrumb-link">Firmalar</RouterLink>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                    <span class="breadcrumb-current">{{ firmsStore.currentFirm.name }}</span>
                </nav>

                <!-- Firm Header -->
                <header class="firm-header">
                    <div class="firm-header-left">
                        <div class="firm-avatar-lg" :class="{ 'firm-avatar-lg--inactive': !firmsStore.currentFirm.isActive }">
                            {{ firmsStore.currentFirm.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) }}
                        </div>
                        <div class="firm-header-info">
                            <div class="firm-title-row">
                                <h1>{{ firmsStore.currentFirm.name }}</h1>
                                <span class="status-badge" :class="firmsStore.currentFirm.isActive ? 'status-active' : 'status-inactive'">
                                    {{ firmsStore.currentFirm.isActive ? 'Aktif' : 'Pasif' }}
                                </span>
                            </div>
                            <p v-if="firmsStore.currentFirm.description" class="firm-description">
                                {{ firmsStore.currentFirm.description }}
                            </p>
                            <div class="firm-contact-row">
                                <span v-if="firmsStore.currentFirm.phone" class="contact-item">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                    {{ firmsStore.currentFirm.phone }}
                                </span>
                                <span v-if="firmsStore.currentFirm.email" class="contact-item">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                    {{ firmsStore.currentFirm.email }}
                                </span>
                                <span v-if="firmsStore.currentFirm.address" class="contact-item">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                    {{ firmsStore.currentFirm.address }}
                                </span>
                            </div>
                        </div>
                    </div>
                </header>

                <!-- Tabs -->
                <div class="tabs">
                    <button
                        class="tab-btn"
                        :class="{ 'tab-btn--active': activeTab === 'tariffs' }"
                        @click="activeTab = 'tariffs'"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        Satis Tarifeleri
                    </button>
                    <button
                        class="tab-btn"
                        :class="{ 'tab-btn--active': activeTab === 'locations' }"
                        @click="activeTab = 'locations'"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        Toplama Noktalari
                        <span class="tab-count">{{ firmsStore.collectionPoints.length }}</span>
                    </button>
                </div>

                <!-- ─── Tariffs Tab ─── -->
                <div v-if="activeTab === 'tariffs'" class="tab-content">
                    <div v-if="firmsStore.currentTariffs.length === 0" class="empty-state">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-text-muted)"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        <h3>Guncel tarife bulunamadi</h3>
                        <p>Bu firmanin aktif tarifeleri henuz belirlenmemis</p>
                    </div>

                    <div v-else class="tariffs-grid">
                        <div
                            v-for="tariff in firmsStore.currentTariffs"
                            :key="tariff.id"
                            class="tariff-card"
                        >
                            <div class="tariff-header">
                                <span class="tariff-quality-icon">{{ qualityIcons[tariff.quality] || '🍃' }}</span>
                                <span class="tariff-quality">{{ qualityLabels[tariff.quality] || tariff.quality }}</span>
                            </div>
                            <div class="tariff-price">
                                {{ formatPrice(tariff.pricePerKg) }}
                                <span class="tariff-unit">/kg</span>
                            </div>
                            <div class="tariff-dates">
                                <span>{{ formatDate(tariff.effectiveDate) }}</span>
                                <span v-if="tariff.endDate"> - {{ formatDate(tariff.endDate) }}</span>
                                <span v-else class="tariff-ongoing"> (Devam ediyor)</span>
                            </div>
                        </div>
                    </div>

                    <!-- Desktop Table View for Tariffs -->
                    <div v-if="firmsStore.currentTariffs.length > 0" class="data-table-wrapper desktop-only" style="margin-top: 24px;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Kalite</th>
                                    <th>Fiyat (kg)</th>
                                    <th>Baslangic</th>
                                    <th>Bitis</th>
                                    <th>Durum</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="tariff in firmsStore.currentTariffs" :key="'table-' + tariff.id">
                                    <td>
                                        <span class="cell-primary">
                                            {{ qualityIcons[tariff.quality] }} {{ qualityLabels[tariff.quality] || tariff.quality }}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="cell-highlight">{{ formatPrice(tariff.pricePerKg) }}</span>
                                    </td>
                                    <td>{{ formatDate(tariff.effectiveDate) }}</td>
                                    <td>{{ tariff.endDate ? formatDate(tariff.endDate) : '-' }}</td>
                                    <td>
                                        <span class="status-badge status-active">Gecerli</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- ─── Locations Tab ─── -->
                <div v-if="activeTab === 'locations'" class="tab-content">
                    <!-- Filters -->
                    <div class="location-filters">
                        <AppSelect
                            v-model="provinceFilter"
                            :options="provinceOptions"
                            placeholder="Il Secin"
                            @update:model-value="onProvinceChange"
                        />
                        <AppSelect
                            v-model="districtFilter"
                            :options="districtOptions"
                            placeholder="Ilce Secin"
                        />
                        <span class="filter-count">{{ filteredCollectionPoints.length }} nokta</span>
                    </div>

                    <div v-if="filteredCollectionPoints.length === 0" class="empty-state">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-text-muted)"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <h3>Toplama noktasi bulunamadi</h3>
                        <p v-if="provinceFilter || districtFilter">Filtre kriterlerinize uygun sonuc yok. Filtreleri temizleyin.</p>
                        <p v-else>Bu firmanin henuz kayitli toplama noktasi yok</p>
                    </div>

                    <!-- Collection Points List -->
                    <div v-else class="collection-points-list">
                        <div
                            v-for="point in filteredCollectionPoints"
                            :key="point.id"
                            class="cp-card"
                        >
                            <div class="cp-card-header">
                                <div class="cp-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                </div>
                                <div class="cp-info">
                                    <h4 class="cp-name">{{ point.name }}</h4>
                                    <span class="cp-location">{{ point.province }} / {{ point.district }}</span>
                                </div>
                            </div>
                            <div class="cp-card-body">
                                <div v-if="point.address" class="cp-detail">
                                    <span class="cp-label">Adres</span>
                                    <span class="cp-value">{{ point.address }}</span>
                                </div>
                                <div v-if="point.collectorName" class="cp-detail">
                                    <span class="cp-label">Toplayici</span>
                                    <span class="cp-value">{{ point.collectorName }}</span>
                                </div>
                                <div v-if="point.collectorPhone" class="cp-detail">
                                    <span class="cp-label">Telefon</span>
                                    <span class="cp-value">{{ point.collectorPhone }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </template>

            <!-- Error -->
            <div v-else-if="firmsStore.error" class="error-state">
                <p class="error-message">{{ firmsStore.error }}</p>
                <RouterLink to="/firms" class="back-link">Firmalara Don</RouterLink>
            </div>
        </div>
    </AppLayout>
</template>

<style scoped>
.firm-detail-page {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
}

/* ── Breadcrumb ── */
.breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 24px;
    font-size: 14px;
}

.breadcrumb-link {
    color: var(--color-primary);
    text-decoration: none;
    font-weight: 500;
}

.breadcrumb-link:hover {
    text-decoration: underline;
}

.breadcrumb svg {
    color: var(--color-text-muted);
}

.breadcrumb-current {
    color: var(--color-text-secondary);
}

/* ── Firm Header ── */
.firm-header {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: 24px;
    margin-bottom: 24px;
}

.firm-header-left {
    display: flex;
    gap: 20px;
    align-items: flex-start;
}

.firm-avatar-lg {
    width: 64px;
    height: 64px;
    border-radius: var(--radius-xl);
    background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 20px;
    flex-shrink: 0;
}

.firm-avatar-lg--inactive {
    background: var(--color-bg-tertiary);
    color: var(--color-text-muted);
}

.firm-header-info {
    flex: 1;
    min-width: 0;
}

.firm-title-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
}

.firm-title-row h1 {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
}

.firm-description {
    font-size: 14px;
    color: var(--color-text-secondary);
    margin: 0 0 12px;
    line-height: 1.5;
}

.firm-contact-row {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
}

.contact-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--color-text-muted);
}

.contact-item svg {
    flex-shrink: 0;
}

/* ── Status Badge ── */
.status-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
}

.status-active {
    background: rgba(34, 197, 94, 0.15);
    color: var(--color-success);
}

.status-inactive {
    background: rgba(245, 158, 11, 0.15);
    color: var(--color-warning);
}

/* ── Tabs ── */
.tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 24px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 4px;
}

.tab-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-secondary);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all var(--transition-fast);
    flex: 1;
    justify-content: center;
}

.tab-btn:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-tertiary);
}

.tab-btn--active {
    background: var(--color-primary);
    color: white;
}

.tab-btn--active:hover {
    background: var(--color-primary-hover);
    color: white;
}

.tab-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.2);
}

.tab-btn:not(.tab-btn--active) .tab-count {
    background: var(--color-bg-tertiary);
    color: var(--color-text-muted);
}

/* ── Tab Content ── */
.tab-content {
    animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
}

/* ── Tariffs Grid (Cards) ── */
.tariffs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
}

.tariff-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: 24px;
    text-align: center;
    transition: all var(--transition-fast);
}

.tariff-card:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-md);
}

.tariff-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 12px;
}

.tariff-quality-icon {
    font-size: 24px;
}

.tariff-quality {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
}

.tariff-price {
    font-size: 28px;
    font-weight: 700;
    color: var(--color-primary);
    margin-bottom: 8px;
}

.tariff-unit {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-muted);
}

.tariff-dates {
    font-size: 12px;
    color: var(--color-text-muted);
}

.tariff-ongoing {
    color: var(--color-success);
    font-weight: 500;
}

/* ── Data Table (Desktop Tariffs) ── */
.data-table-wrapper {
    background: var(--color-bg-secondary);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-md);
    border: 1px solid var(--color-border);
}

.data-table {
    width: 100%;
    border-collapse: collapse;
}

.data-table thead tr {
    background: var(--color-bg-tertiary);
}

.data-table th {
    padding: 14px 20px;
    text-align: left;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    border-bottom: 1px solid var(--color-border);
    white-space: nowrap;
}

.data-table td {
    padding: 16px 20px;
    font-size: 14px;
    color: var(--color-text-secondary);
    border-bottom: 1px solid var(--color-border);
}

.data-table tbody tr:last-child td {
    border-bottom: none;
}

.data-table tbody tr:hover {
    background: var(--color-primary-light);
}

.cell-primary {
    font-weight: 600;
    color: var(--color-text-primary);
}

.cell-highlight {
    font-weight: 700;
    color: var(--color-primary);
}

/* ── Location Filters ── */
.location-filters {
    display: flex;
    gap: 16px;
    align-items: center;
    margin-bottom: 24px;
}

.filter-count {
    font-size: 13px;
    color: var(--color-text-muted);
    font-weight: 500;
    white-space: nowrap;
}

/* ── Collection Points List ── */
.collection-points-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 16px;
}

.cp-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
    transition: all var(--transition-fast);
}

.cp-card:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-md);
}

.cp-card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border);
}

.cp-icon {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    background: var(--color-primary-light);
    color: var(--color-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.cp-info {
    flex: 1;
    min-width: 0;
}

.cp-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
}

.cp-location {
    font-size: 12px;
    color: var(--color-text-muted);
    font-weight: 500;
}

.cp-card-body {
    padding: 12px 20px 16px;
}

.cp-detail {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
}

.cp-detail + .cp-detail {
    border-top: 1px solid var(--color-border);
}

.cp-label {
    font-size: 13px;
    color: var(--color-text-muted);
    font-weight: 500;
}

.cp-value {
    font-size: 13px;
    color: var(--color-text-primary);
    font-weight: 500;
    text-align: right;
}

/* ── Empty / Error / Loading ── */
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
    padding: 48px 24px;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-xl);
}

.empty-state h3 {
    color: var(--color-text-primary);
    margin: 16px 0 8px;
    font-size: 16px;
}

.empty-state p {
    color: var(--color-text-muted);
    font-size: 14px;
    margin: 0;
}

.error-state {
    text-align: center;
    padding: 60px;
}

.error-message {
    background: rgba(239, 68, 68, 0.1);
    color: var(--color-danger);
    padding: 12px;
    border-radius: 8px;
    font-size: 14px;
    display: inline-block;
}

.back-link {
    display: inline-block;
    margin-top: 16px;
    color: var(--color-primary);
    text-decoration: none;
    font-weight: 600;
}

.back-link:hover {
    text-decoration: underline;
}

/* ── Visibility ── */
.desktop-only {
    display: block;
}

/* ── Responsive ── */
@media (max-width: 768px) {
    .firm-detail-page {
        padding: 16px;
    }

    .firm-header-left {
        flex-direction: column;
        align-items: center;
        text-align: center;
    }

    .firm-title-row {
        flex-direction: column;
        gap: 8px;
    }

    .firm-title-row h1 {
        font-size: 20px;
    }

    .firm-contact-row {
        justify-content: center;
    }

    .tabs {
        flex-direction: column;
    }

    .tariffs-grid {
        grid-template-columns: 1fr;
    }

    .location-filters {
        flex-direction: column;
        align-items: stretch;
    }

    .collection-points-list {
        grid-template-columns: 1fr;
    }

    .desktop-only {
        display: none !important;
    }
}
</style>
