<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFieldsStore } from '@/stores/fieldsStore';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const route = useRoute();
const router = useRouter();
const fieldsStore = useFieldsStore();

// Map state
const mapContainer = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
let fieldLayer: L.GeoJSON | null = null;

// Get field ID from route
const fieldId = computed(() => route.params.id as string);

// Load field data
onMounted(async () => {
    await fieldsStore.fetchField(fieldId.value);
    initializeMap();
});

onUnmounted(() => {
    if (map) {
        map.remove();
        map = null;
    }
});

function initializeMap() {
    if (!mapContainer.value) return;

    map = L.map(mapContainer.value, {
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        zoomControl: false,
        boxZoom: false,
        keyboard: false,
        dragging: true
    }).setView([39.0, 35.0], 6);

    // Satellite imagery tile layer
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics',
        maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Display field coordinates if available
    const field = fieldsStore.currentField;
    if (field && field.coordinates && field.coordinates.length > 0) {
        displayFieldOnMap(field.coordinates);
    }
}



function getCssVar(name: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function displayFieldOnMap(coordinates: number[][][]) {
    if (!map) return;

    const geoJson: GeoJSON.Feature = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'Polygon',
            coordinates: coordinates
        }
    };

    fieldLayer = L.geoJSON(geoJson, {
        style: {
            color: getCssVar('--color-primary-hover', '#059669'),
            weight: 3,
            fillOpacity: 0.2,
            fillColor: getCssVar('--color-primary', '#10b981')
        }
    }).addTo(map);

    // Zoom to field bounds
    map.fitBounds(fieldLayer.getBounds(), { padding: [50, 50] });
}

function formatArea(area: number, unit: string) {
    const formatted = area.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
    const unitLabels: Record<string, string> = {
        'donum': 'dönüm',
        'dekar': 'dekar',
        'm2': 'm²'
    };
    return `${formatted} ${unitLabels[unit] || unit}`;
}

function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function goBack() {
    router.push('/fields');
}
</script>

<template>
    <TeaBusinessLayout>
        <div class="field-detail-page">
        <!-- Loading State -->
        <div v-if="fieldsStore.isLoading" class="loading-state">
            <div class="loading-card">
                <div class="spinner"></div>
                <p>Tarla bilgileri yükleniyor...</p>
            </div>
        </div>

        <!-- Error State -->
        <div v-else-if="fieldsStore.error" class="error-state">
            <div class="error-card">
                <div class="error-icon-wrap">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                </div>
                <h2>Bir hata oluştu</h2>
                <p>{{ fieldsStore.error }}</p>
                <button class="btn-primary" @click="goBack">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    Geri Dön
                </button>
            </div>
        </div>

        <!-- Content -->
        <div v-else-if="fieldsStore.currentField" class="content">
            <!-- Page Header -->
            <header class="page-header">
                <button class="btn-back" @click="goBack">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    Tarlalar
                </button>
                <div class="header-info">
                    <h1>{{ fieldsStore.currentField.name }}</h1>
                    <p class="header-meta">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {{ fieldsStore.currentField.province }}, {{ fieldsStore.currentField.district }}
                    </p>
                </div>
            </header>

            <!-- Hero Map Section -->
            <div class="map-hero">
                <div ref="mapContainer" class="map-container"></div>
                <div class="map-overlay-badge" v-if="fieldsStore.currentField.area">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                    {{ formatArea(fieldsStore.currentField.area, fieldsStore.currentField.areaUnit) }}
                </div>
            </div>

            <!-- Stats Row -->
            <div class="stats-row">
                <div class="stat-card stat-area">
                    <div class="stat-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                    </div>
                    <div class="stat-content">
                        <span class="stat-label">Toplam Alan</span>
                        <span class="stat-value">{{ formatArea(fieldsStore.currentField.area, fieldsStore.currentField.areaUnit) }}</span>
                    </div>
                </div>
                <div class="stat-card stat-partners" v-if="fieldsStore.currentField.partners?.length">
                    <div class="stat-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <div class="stat-content">
                        <span class="stat-label">Ortak Sayısı</span>
                        <span class="stat-value">{{ fieldsStore.currentField.partners.length }}</span>
                    </div>
                </div>
                <div class="stat-card stat-parcel" v-if="fieldsStore.currentField.parcelNo">
                    <div class="stat-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
                    </div>
                    <div class="stat-content">
                        <span class="stat-label">Parsel No</span>
                        <span class="stat-value">{{ fieldsStore.currentField.parcelNo }}</span>
                    </div>
                </div>
                <div class="stat-card stat-date">
                    <div class="stat-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div class="stat-content">
                        <span class="stat-label">Kayıt Tarihi</span>
                        <span class="stat-value">{{ formatDate(fieldsStore.currentField.createdAt) }}</span>
                    </div>
                </div>
            </div>

            <!-- Detail Cards Grid -->
            <div class="detail-grid">
                <!-- Location Card -->
                <div class="detail-card">
                    <div class="detail-card-header">
                        <div class="detail-card-icon location-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        </div>
                        <h3>Konum Bilgileri</h3>
                    </div>
                    <div class="detail-card-body">
                        <div class="detail-row">
                            <span class="detail-label">İl</span>
                            <span class="detail-value">{{ fieldsStore.currentField.province }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">İlçe</span>
                            <span class="detail-value">{{ fieldsStore.currentField.district }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Mahalle</span>
                            <span class="detail-value">{{ fieldsStore.currentField.neighborhood }}</span>
                        </div>
                        <div v-if="fieldsStore.currentField.road" class="detail-row">
                            <span class="detail-label">Yol</span>
                            <span class="detail-value">{{ fieldsStore.currentField.road }}</span>
                        </div>
                        <div v-if="fieldsStore.currentField.parcelNo" class="detail-row">
                            <span class="detail-label">Parsel No</span>
                            <span class="detail-value highlight">{{ fieldsStore.currentField.parcelNo }}</span>
                        </div>
                    </div>
                </div>

                <!-- Partners Card -->
                <div v-if="fieldsStore.currentField.partners && fieldsStore.currentField.partners.length > 0" class="detail-card">
                    <div class="detail-card-header">
                        <div class="detail-card-icon partners-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        </div>
                        <h3>Ortaklar</h3>
                    </div>
                    <div class="detail-card-body">
                        <div
                            v-for="partner in fieldsStore.currentField.partners"
                            :key="partner.id"
                            class="partner-item"
                        >
                            <div class="partner-left">
                                <div class="partner-avatar">
                                    {{ partner.partnerName.charAt(0).toUpperCase() }}
                                </div>
                                <div class="partner-info">
                                    <span class="partner-name">{{ partner.partnerName }}</span>
                                    <span v-if="partner.partnerPhone" class="partner-contact">{{ partner.partnerPhone }}</span>
                                    <span v-if="partner.partnerIdentityNumber" class="partner-contact">TC: {{ partner.partnerIdentityNumber }}</span>
                                    <span class="primary-badge">{{ partner.invitationStatus === 'accepted' ? 'Onaylandi' : partner.invitationStatus === 'rejected' ? 'Reddedildi' : 'Onay Bekliyor' }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Notes Card -->
                <div v-if="fieldsStore.currentField.notes" class="detail-card">
                    <div class="detail-card-header">
                        <div class="detail-card-icon notes-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                        </div>
                        <h3>Notlar</h3>
                    </div>
                    <div class="detail-card-body">
                        <p class="notes-text">{{ fieldsStore.currentField.notes }}</p>
                    </div>
                </div>

                <!-- Metadata Card -->
                <div class="detail-card">
                    <div class="detail-card-header">
                        <div class="detail-card-icon meta-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </div>
                        <h3>Kayıt Bilgileri</h3>
                    </div>
                    <div class="detail-card-body">
                        <div class="detail-row">
                            <span class="detail-label">Oluşturulma</span>
                            <span class="detail-value">{{ formatDate(fieldsStore.currentField.createdAt) }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Son Güncelleme</span>
                            <span class="detail-value">{{ formatDate(fieldsStore.currentField.updatedAt) }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    </TeaBusinessLayout>
</template>

<style scoped>
.field-detail-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--space-6);
}

/* ── Loading & Error States ── */
.loading-state,
.error-state {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 400px;
}

.loading-card,
.error-card {
    text-align: center;
    padding: var(--space-10) var(--space-8);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    max-width: 400px;
    width: 100%;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto var(--space-4);
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.loading-card p {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    margin: 0;
}

.error-icon-wrap {
    width: 56px;
    height: 56px;
    border-radius: var(--radius-full);
    background: rgba(239, 68, 68, 0.1);
    color: var(--color-danger);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto var(--space-4);
}

.error-card h2 {
    color: var(--color-text-primary);
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    margin: 0 0 var(--space-2) 0;
}

.error-card p {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    margin: 0 0 var(--space-6) 0;
}

/* ── Page Header ── */
.page-header {
    display: flex;
    align-items: flex-start;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
}

.btn-back {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-lg);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
    flex-shrink: 0;
    margin-top: 2px;
}

.btn-back:hover {
    color: var(--color-text-primary);
    border-color: var(--color-text-muted);
    background: var(--color-bg-tertiary);
}

.header-info h1 {
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
    margin: 0 0 4px 0;
    line-height: var(--line-height-tight);
}

.header-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    margin: 0;
}

/* ── Hero Map ── */
.map-hero {
    position: relative;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
    margin-bottom: var(--space-5);
}

.map-container {
    height: 380px;
    width: 100%;
}

.map-overlay-badge {
    position: absolute;
    bottom: var(--space-4);
    left: var(--space-4);
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    color: var(--color-primary);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-full);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    backdrop-filter: blur(10px);
    z-index: 10;
}

/* ── Stats Row ── */
.stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-4);
    margin-bottom: var(--space-5);
}

.stat-card {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    transition: border-color var(--transition-fast);
}

.stat-card:hover {
    border-color: var(--color-text-muted);
}

.stat-icon {
    width: 42px;
    height: 42px;
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.stat-area .stat-icon {
    background: var(--color-primary-light);
    color: var(--color-primary);
}

.stat-partners .stat-icon {
    background: rgba(99, 102, 241, 0.1);
    color: var(--color-secondary);
}

.stat-parcel .stat-icon {
    background: rgba(59, 130, 246, 0.1);
    color: var(--color-info);
}

.stat-date .stat-icon {
    background: rgba(245, 158, 11, 0.1);
    color: var(--color-warning);
}

.stat-content {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.stat-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    margin-bottom: 2px;
}

.stat-value {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* ── Detail Cards Grid ── */
.detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--space-4);
}

.detail-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
    transition: border-color var(--transition-fast);
}

.detail-card:hover {
    border-color: var(--color-text-muted);
}

.detail-card-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--color-border);
}

.detail-card-icon {
    width: 34px;
    height: 34px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.location-icon {
    background: var(--color-primary-light);
    color: var(--color-primary);
}

.partners-icon {
    background: rgba(99, 102, 241, 0.1);
    color: var(--color-secondary);
}

.notes-icon {
    background: rgba(245, 158, 11, 0.1);
    color: var(--color-warning);
}

.meta-icon {
    background: rgba(59, 130, 246, 0.1);
    color: var(--color-info);
}

.detail-card-header h3 {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    margin: 0;
}

.detail-card-body {
    padding: var(--space-4) var(--space-5);
}

/* ── Detail Rows ── */
.detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--color-border);
}

.detail-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
}

.detail-row:first-child {
    padding-top: 0;
}

.detail-label {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
}

.detail-value {
    color: var(--color-text-primary);
    font-weight: var(--font-weight-medium);
    font-size: var(--font-size-sm);
}

.detail-value.highlight {
    color: var(--color-primary);
    font-weight: var(--font-weight-semibold);
}

/* ── Partners ── */
.partner-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--color-border);
}

.partner-item:last-child {
    border-bottom: none;
    padding-bottom: 0;
}

.partner-item:first-child {
    padding-top: 0;
}

.partner-left {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
}

.partner-avatar {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-full);
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    flex-shrink: 0;
}

.partner-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.partner-name {
    font-weight: var(--font-weight-medium);
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.partner-contact {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
}

.primary-badge {
    display: inline-flex;
    align-items: center;
    background: var(--color-primary-light);
    color: var(--color-primary);
    font-size: 10px;
    padding: 1px 8px;
    border-radius: var(--radius-full);
    font-weight: var(--font-weight-semibold);
    width: fit-content;
    border: 1px solid var(--color-primary-light);
}

.partner-share-wrap {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-shrink: 0;
}

.partner-share-bar {
    width: 60px;
    height: 4px;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-full);
    overflow: hidden;
}

.partner-share-fill {
    height: 100%;
    background: var(--color-primary);
    border-radius: var(--radius-full);
    transition: width var(--transition-normal);
}

.partner-share-text {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    min-width: 36px;
    text-align: right;
}

/* ── Notes ── */
.notes-text {
    color: var(--color-text-secondary);
    line-height: var(--line-height-relaxed);
    margin: 0;
    font-size: var(--font-size-sm);
}

/* ── Button ── */
.btn-primary {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--color-primary);
    color: white;
    border: none;
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-lg);
    font-weight: var(--font-weight-semibold);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.btn-primary:hover {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
}

/* ── Responsive ── */
@media (max-width: 768px) {
    .field-detail-page {
        padding: var(--space-4);
    }

    .page-header {
        flex-direction: column;
        gap: var(--space-3);
    }

    .header-info h1 {
        font-size: var(--font-size-xl);
    }

    .map-container {
        height: 280px;
    }

    .stats-row {
        grid-template-columns: 1fr 1fr;
    }

    .detail-grid {
        grid-template-columns: 1fr;
    }

    .partner-share-bar {
        display: none;
    }
}

@media (max-width: 480px) {
    .stats-row {
        grid-template-columns: 1fr;
    }
}
</style>
