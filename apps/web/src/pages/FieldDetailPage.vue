<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFieldsStore } from '@/stores/fieldsStore';
import AppLayout from '@/layouts/AppLayout.vue';
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

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Display field coordinates if available
    const field = fieldsStore.currentField;
    if (field && field.coordinates && field.coordinates.length > 0) {
        displayFieldOnMap(field.coordinates);
    }
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
            color: '#10b981',
            weight: 3,
            fillOpacity: 0.3,
            fillColor: '#10b981'
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
    <AppLayout>
        <div class="field-detail-page">
        <!-- Loading State -->
        <div v-if="fieldsStore.isLoading" class="loading-state">
            <div class="spinner"></div>
            <p>Tarla bilgileri yükleniyor...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="fieldsStore.error" class="error-state">
            <div class="error-icon">⚠️</div>
            <h2>Bir hata oluştu</h2>
            <p>{{ fieldsStore.error }}</p>
            <button class="btn-primary" @click="goBack">Geri Dön</button>
        </div>

        <!-- Content -->
        <div v-else-if="fieldsStore.currentField" class="content">
            <!-- Map Section -->
            <div class="map-section">
                <div ref="mapContainer" class="map-container"></div>
            </div>

            <!-- Field Information -->
            <div class="info-grid">
                <!-- Location Card -->
                <div class="info-card">
                    <h3>📍 Konum Bilgileri</h3>
                    <div class="info-row">
                        <span class="label">İl</span>
                        <span class="value">{{ fieldsStore.currentField.province }}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">İlçe</span>
                        <span class="value">{{ fieldsStore.currentField.district }}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Mahalle</span>
                        <span class="value">{{ fieldsStore.currentField.neighborhood }}</span>
                    </div>
                    <div v-if="fieldsStore.currentField.parcelNo" class="info-row">
                        <span class="label">Parsel No</span>
                        <span class="value">{{ fieldsStore.currentField.parcelNo }}</span>
                    </div>
                </div>

                <!-- Area Card -->
                <div class="info-card">
                    <h3>📐 Alan Bilgileri</h3>
                    <div class="area-display">
                        {{ formatArea(fieldsStore.currentField.area, fieldsStore.currentField.areaUnit) }}
                    </div>
                </div>

                <!-- Partners Card -->
                <div v-if="fieldsStore.currentField.partners && fieldsStore.currentField.partners.length > 0" class="info-card">
                    <h3>👥 Ortaklar</h3>
                    <div 
                        v-for="partner in fieldsStore.currentField.partners" 
                        :key="partner.id"
                        class="partner-item"
                    >
                        <span class="partner-name">
                            {{ partner.partnerName }}
                            <span v-if="partner.isPrimaryOwner" class="primary-badge">Ana Sahip</span>
                        </span>
                        <span class="partner-share">%{{ partner.sharePercentage }}</span>
                    </div>
                </div>

                <!-- Notes Card -->
                <div v-if="fieldsStore.currentField.notes" class="info-card">
                    <h3>📝 Notlar</h3>
                    <p class="notes-text">{{ fieldsStore.currentField.notes }}</p>
                </div>

                <!-- Metadata Card -->
                <div class="info-card">
                    <h3>📅 Kayıt Bilgileri</h3>
                    <div class="info-row">
                        <span class="label">Oluşturulma</span>
                        <span class="value">{{ formatDate(fieldsStore.currentField.createdAt) }}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Son Güncelleme</span>
                        <span class="value">{{ formatDate(fieldsStore.currentField.updatedAt) }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
    </AppLayout>
</template>

<style scoped>
.field-detail-page {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
}

/* Loading & Error States */
.loading-state,
.error-state {
    text-align: center;
    padding: 80px 20px;
}

.spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #e5e7eb;
    border-top-color: #10b981;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.error-icon {
    font-size: 64px;
    margin-bottom: 16px;
}

.error-state h2 {
    color: #374151;
    margin: 0 0 8px 0;
}

.error-state p {
    color: #6b7280;
    margin: 0 0 24px 0;
}

/* Header */
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 16px;
}

.btn-back {
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: none;
    color: #666;
    cursor: pointer;
    font-size: 14px;
    padding: 8px 12px;
    border-radius: 8px;
    transition: background 0.2s;
}

.btn-back:hover {
    background: #f3f4f6;
    color: #1a1a2e;
}

.page-header h1 {
    font-size: 28px;
    font-weight: 700;
    color: #1a1a2e;
    margin: 0;
}

.btn-edit {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #f3f4f6;
    border: none;
    color: #374151;
    padding: 12px 20px;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}

.btn-edit:hover {
    background: #e5e7eb;
}

/* Map Section */
.map-section {
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    margin-bottom: 24px;
}

.map-container {
    height: 400px;
    width: 100%;
}

/* Info Grid */
.info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
}

.info-card {
    background: white;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.info-card-full {
    grid-column: 1 / -1;
}

.info-card h3 {
    font-size: 16px;
    font-weight: 600;
    color: #374151;
    margin: 0 0 16px 0;
}

.info-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #f3f4f6;
}

.info-row:last-child {
    border-bottom: none;
}

.info-row .label {
    color: #6b7280;
    font-size: 14px;
}

.info-row .value {
    color: #1a1a2e;
    font-weight: 500;
}

.area-display {
    font-size: 32px;
    font-weight: 700;
    color: #10b981;
    text-align: center;
    padding: 20px;
    background: #f0fdf4;
    border-radius: 12px;
}

/* Partners */
.partner-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #f3f4f6;
}

.partner-item:last-child {
    border-bottom: none;
}

.partner-name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
}

.primary-badge {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 600;
}

.partner-share {
    color: #6b7280;
    font-size: 14px;
}

/* Notes */
.notes-text {
    color: #4b5563;
    line-height: 1.6;
    margin: 0;
}

/* Button */
.btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

@media (max-width: 768px) {
    .page-header {
        flex-direction: column;
        gap: 16px;
        align-items: flex-start;
    }

    .info-grid {
        grid-template-columns: 1fr;
    }
}
</style>
