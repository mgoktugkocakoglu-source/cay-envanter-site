<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useGeoStore } from '@/stores/geoStore';
import { useFieldsStore } from '@/stores/fieldsStore';
import { api } from '@/services/api';
import type { GeoParcelDetail, Field } from '@/services/api';
import AppSelect from '@/components/ui/AppSelect.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const router = useRouter();
const geoStore = useGeoStore();
const fieldsStore = useFieldsStore();

// Form state
const fieldName = ref('');
const notes = ref('');
const partners = ref<Array<{ name: string; percentage: number; isPrimary: boolean }>>([
    { name: '', percentage: 100, isPrimary: true }
]);
const isSubmitting = ref(false);
const formError = ref<string | null>(null);

// Accordion state
const isPartnersOpen = ref(false);

// Map state
const mapContainer = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
let currentLayer: L.GeoJSON | null = null;
let parcelLayers: L.GeoJSON | null = null;
let clickedParcelLayer: L.GeoJSON | null = null;

// Clicked parcel from map
const clickedParcel = ref<GeoParcelDetail | null>(null);
const isLoadingParcel = ref(false);

// Turkey center coordinates
const TURKEY_CENTER: L.LatLngExpression = [39.0, 35.0];
const TURKEY_ZOOM = 6;

// Computed
const selectedArea = computed(() => {
    // Prefer clicked parcel area, then selected parcel area
    if (clickedParcel.value) {
        const alanStr = clickedParcel.value.properties.alan;
        // Parse area string like "59.955,71" to number
        return parseFloat(alanStr.replace('.', '').replace(',', '.')) || 0;
    }
    const parcel = geoStore.selectedParcel;
    if (parcel) {
        return parcel.area;
    }
    return 0;
});

const isFormValid = computed(() => {
    return fieldName.value.trim() !== '' &&
        geoStore.selectedProvinceId &&
        geoStore.selectedDistrictId &&
        geoStore.selectedNeighborhoodId;
});

const totalPartnerPercentage = computed(() => {
    return partners.value.reduce((sum, p) => sum + (p.percentage || 0), 0);
});

// Initialize map
onMounted(async () => {
    if (mapContainer.value) {
        map = L.map(mapContainer.value).setView(TURKEY_CENTER, TURKEY_ZOOM);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Add map click handler for parcel selection
        map.on('click', handleMapClick);
    }

    await geoStore.fetchProvinces();
});

onUnmounted(() => {
    if (map) {
        map.remove();
        map = null;
    }
    geoStore.resetSelections();
});

// Watch for geo selections and update map
watch(() => geoStore.selectedProvince, (province) => {
    if (province && province.bounds && map) {
        zoomToBounds(province.bounds);
    }
});

watch(() => geoStore.selectedDistrict, (district) => {
    if (district && district.bounds && map) {
        zoomToBounds(district.bounds);
    }
});

watch(() => geoStore.selectedNeighborhood, (neighborhood) => {
    if (neighborhood && neighborhood.bounds && map) {
        zoomToBounds(neighborhood.bounds);
    }
});

watch(() => geoStore.parcels, (parcels) => {
    if (map && parcels.length > 0) {
        displayParcels(parcels);
    }
});

function zoomToBounds(coordinates: number[][][]) {
    if (!map) return;

    // Clear previous layer
    if (currentLayer) {
        map.removeLayer(currentLayer);
    }

    // Create GeoJSON from coordinates
    const geoJson: GeoJSON.Feature = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'Polygon',
            coordinates: coordinates
        }
    };

    currentLayer = L.geoJSON(geoJson, {
        style: {
            color: '#10b981',
            weight: 2,
            fillOpacity: 0.1
        }
    }).addTo(map);

    map.fitBounds(currentLayer.getBounds(), { padding: [20, 20] });
}

function displayParcels(parcels: typeof geoStore.parcels) {
    if (!map) return;

    // Clear previous parcel layers
    if (parcelLayers) {
        map.removeLayer(parcelLayers);
    }

    const features: GeoJSON.Feature[] = parcels.map(parcel => ({
        type: 'Feature',
        properties: { id: parcel.id, parcelNo: parcel.parcelNo, area: parcel.area },
        geometry: {
            type: 'Polygon',
            coordinates: parcel.polygon
        }
    }));

    const geoJson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features
    };

    parcelLayers = L.geoJSON(geoJson, {
        style: (feature) => ({
            color: feature?.properties?.id === geoStore.selectedParcelId ? '#059669' : '#6b7280',
            weight: feature?.properties?.id === geoStore.selectedParcelId ? 3 : 1,
            fillOpacity: feature?.properties?.id === geoStore.selectedParcelId ? 0.3 : 0.1
        }),
        onEachFeature: (feature, layer) => {
            layer.on('click', () => {
                geoStore.selectParcel(feature.properties?.id || null);
                // Refresh styles
                if (parcelLayers) {
                    parcelLayers.setStyle((f) => ({
                        color: f?.properties?.id === geoStore.selectedParcelId ? '#059669' : '#6b7280',
                        weight: f?.properties?.id === geoStore.selectedParcelId ? 3 : 1,
                        fillOpacity: f?.properties?.id === geoStore.selectedParcelId ? 0.3 : 0.1
                    }));
                }
            });
            layer.bindTooltip(`Parsel: ${feature.properties?.parcelNo || 'N/A'}`);
        }
    }).addTo(map);
}

// Handle map click to get parcel by coordinates
async function handleMapClick(e: L.LeafletMouseEvent) {
    if (!geoStore.selectedNeighborhoodId || isLoadingParcel.value) return;

    const { lat, lng } = e.latlng;
    isLoadingParcel.value = true;
    formError.value = null;

    try {
        const response = await api.getParcelByCoordinates(lat, lng);
        if (response.data) {
            clickedParcel.value = response.data;
            displayClickedParcel(response.data);
        } else if (response.error) {
            formError.value = 'Bu koordinatta parsel bulunamadı';
            clickedParcel.value = null;
            clearClickedParcelLayer();
        } else {
            formError.value = 'Bu koordinatta parsel bulunamadı';
            clickedParcel.value = null;
            clearClickedParcelLayer();
        }
    } catch (e) {
        formError.value = 'Parsel bilgisi alınamadı';
        clickedParcel.value = null;
        clearClickedParcelLayer();
    } finally {
        isLoadingParcel.value = false;
    }
}

// Display clicked parcel with red border on map
function displayClickedParcel(parcel: GeoParcelDetail) {
    if (!map) return;

    // Clear previous clicked parcel layer
    clearClickedParcelLayer();

    const geoJson: GeoJSON.Feature = {
        type: 'Feature',
        properties: {
            parselNo: parcel.properties.parselNo,
            alan: parcel.properties.alan,
            ozet: parcel.properties.ozet
        },
        geometry: {
            type: 'Polygon',
            coordinates: parcel.polygon
        }
    };

    clickedParcelLayer = L.geoJSON(geoJson, {
        style: {
            color: '#dc2626', // Red color
            weight: 3,
            fillOpacity: 0.3,
            fillColor: '#dc2626'
        }
    }).addTo(map);

    // Add popup with parcel info
    clickedParcelLayer.bindPopup(`
        <strong>Parsel:</strong> ${parcel.properties.ozet}<br>
        <strong>Alan:</strong> ${parcel.properties.alan} m²<br>
        <strong>Nitelik:</strong> ${parcel.properties.nitelik}
    `).openPopup();

    // Zoom to parcel bounds
    map.fitBounds(clickedParcelLayer.getBounds(), { padding: [50, 50] });
}

// Clear clicked parcel layer
function clearClickedParcelLayer() {
    if (clickedParcelLayer && map) {
        map.removeLayer(clickedParcelLayer);
        clickedParcelLayer = null;
    }
}

// Form handlers
type SelectValue = string | number | (string | number)[] | null;

function handleProvinceChange(value: SelectValue) {
    const v = Array.isArray(value) ? value[0] : value;
    geoStore.selectProvince(v ? String(v) : null);
}

function handleDistrictChange(value: SelectValue) {
    const v = Array.isArray(value) ? value[0] : value;
    geoStore.selectDistrict(v ? String(v) : null);
}

function handleNeighborhoodChange(value: SelectValue) {
    const v = Array.isArray(value) ? value[0] : value;
    geoStore.selectNeighborhood(v ? String(v) : null);
}

function handleParcelChange(value: SelectValue) {
    const v = Array.isArray(value) ? value[0] : value;
    geoStore.selectParcel(v ? String(v) : null);
}

function addPartner() {
    partners.value.push({ name: '', percentage: 0, isPrimary: false });
}

function removePartner(index: number) {
    if (partners.value.length > 1) {
        partners.value.splice(index, 1);
        // Ensure at least one primary owner
        if (!partners.value.some(p => p.isPrimary)) {
            partners.value[0].isPrimary = true;
        }
    }
}

function setPrimaryOwner(index: number) {
    partners.value.forEach((p, i) => {
        p.isPrimary = i === index;
    });
}

async function handleSubmit() {
    if (!isFormValid.value) return;

    if (totalPartnerPercentage.value !== 100) {
        formError.value = 'Ortakların toplam payı %100 olmalıdır';
        return;
    }

    isSubmitting.value = true;
    formError.value = null;

    try {
        // Prefer clicked parcel data, then selected parcel from dropdown
        const parcelCoordinates = clickedParcel.value?.polygon || geoStore.selectedParcel?.polygon || geoStore.selectedNeighborhood?.bounds || [];
        const parcelNo = clickedParcel.value?.properties.parselNo || geoStore.selectedParcel?.parcelNo || null;
        
        const fieldData: Omit<Partial<Field>, 'partners'> & { partners?: Array<{ partnerName: string; sharePercentage: number; isPrimaryOwner: boolean }> } = {
            name: fieldName.value.trim(),
            province: clickedParcel.value?.properties.ilAd || geoStore.selectedProvince?.name || '',
            district: clickedParcel.value?.properties.ilceAd || geoStore.selectedDistrict?.name || '',
            neighborhood: clickedParcel.value?.properties.mahalleAd || geoStore.selectedNeighborhood?.name || '',
            parcelNo: parcelNo,
            coordinates: parcelCoordinates,
            area: selectedArea.value,
            areaUnit: 'm2' as const,
            notes: notes.value.trim() || null,
            partners: partners.value
                .filter(p => p.name.trim())
                .map(p => ({
                    partnerName: p.name.trim(),
                    sharePercentage: p.percentage,
                    isPrimaryOwner: p.isPrimary
                }))
        };

        const result = await fieldsStore.createField(fieldData as Parameters<typeof fieldsStore.createField>[0]);
        if (result) {
            router.push('/fields');
        } else {
            formError.value = fieldsStore.error || 'Tarla oluşturulamadı';
        }
    } catch (e) {
        formError.value = 'Bir hata oluştu';
    } finally {
        isSubmitting.value = false;
    }
}

function goBack() {
    router.back();
}
</script>

<template>
    <AppLayout>
        <div class="create-field-page">
            <header class="page-header">
            <button class="btn-back" @click="goBack">
                <span class="icon">←</span>
                Geri Dön
            </button>
            <h1>Yeni Tarla Ekle</h1>
        </header>

        <div class="content-grid">
            <!-- Map Section -->
            <div class="map-section">
                <div ref="mapContainer" class="map-container"></div>
                <div v-if="isLoadingParcel" class="parcel-loading">
                    <span class="spinner-small"></span>
                    Parsel bilgisi yükleniyor...
                </div>
                <div v-else-if="clickedParcel" class="parcel-info parcel-info-clicked">
                    <strong>Haritadan Seçilen Parsel:</strong> {{ clickedParcel.properties.ozet }}
                    <span class="area-badge area-badge-red">{{ clickedParcel.properties.alan }} m²</span>
                </div>
                <div v-else-if="geoStore.selectedParcel" class="parcel-info">
                    <strong>Seçili Parsel:</strong> {{ geoStore.selectedParcel.parcelNo }}
                    <span class="area-badge">{{ geoStore.selectedParcel.area.toLocaleString('tr-TR') }} m²</span>
                </div>
                <div v-else-if="geoStore.selectedNeighborhoodId" class="parcel-hint">
                    💡 Haritaya tıklayarak parsel seçebilirsiniz
                </div>
            </div>

            <!-- Form Section -->
            <div class="form-section">
                <form @submit.prevent="handleSubmit">
                    <!-- Field Name -->
                    <div class="form-group">
                        <label for="fieldName">Tarla Adı *</label>
                        <input
                            id="fieldName"
                            v-model="fieldName"
                            type="text"
                            placeholder="Örn: Üst Bahçe"
                            required
                        />
                    </div>

                    <!-- Province Select -->
                    <AppSelect
                        :model-value="geoStore.selectedProvinceId?.toString() || ''"
                        :options="geoStore.provinces.map(p => ({ value: p.id.toString(), label: p.name }))"
                        label="İl *"
                        variant="light"
                        placeholder="İl Seçin"
                        :disabled="geoStore.isLoadingProvinces"
                        @update:model-value="handleProvinceChange"
                    />

                    <!-- District Select -->
                    <AppSelect
                        :model-value="geoStore.selectedDistrictId?.toString() || ''"
                        :options="geoStore.districts.map(d => ({ value: d.id.toString(), label: d.name }))"
                        label="İlçe *"
                        placeholder="İlçe Seçin"
                        :disabled="!geoStore.selectedProvinceId || geoStore.isLoadingDistricts"
                        variant="light"
                        @update:model-value="handleDistrictChange"
                    />
                    <span v-if="geoStore.isLoadingDistricts" class="loading-text">Yükleniyor...</span>

                    <!-- Neighborhood Select -->
                    <AppSelect
                        :model-value="geoStore.selectedNeighborhoodId?.toString() || ''"
                        :options="geoStore.neighborhoods.map(n => ({ value: n.id.toString(), label: n.name }))"
                        label="Mahalle *"
                        placeholder="Mahalle Seçin"
                        :disabled="!geoStore.selectedDistrictId || geoStore.isLoadingNeighborhoods"
                        variant="light"
                        @update:model-value="handleNeighborhoodChange"
                    />
                    <span v-if="geoStore.isLoadingNeighborhoods" class="loading-text">Yükleniyor...</span>

                    <!-- Parcel Select -->
                    <AppSelect
                        :model-value="geoStore.selectedParcelId?.toString() || ''"
                        :options="geoStore.parcels.map(p => ({ value: p.id.toString(), label: `${p.parcelNo} (${p.area.toLocaleString('tr-TR')} m²)` }))"
                        label="Parsel (Opsiyonel)"
                        variant="light"
                        placeholder="Haritadan Seçin veya Listeden"
                        :disabled="!geoStore.selectedNeighborhoodId || geoStore.isLoadingParcels"
                        @update:model-value="handleParcelChange"
                    />
                    <span v-if="geoStore.isLoadingParcels" class="loading-text">Parseller yükleniyor...</span>

                    <!-- Area Display -->
                    <div v-if="selectedArea > 0" class="form-group">
                        <label>Alan</label>
                        <div class="area-display">
                            {{ selectedArea.toLocaleString('tr-TR') }} m²
                        </div>
                    </div>

                    <!-- Notes -->
                    <div class="form-group">
                        <label for="notes">Notlar</label>
                        <textarea
                            id="notes"
                            v-model="notes"
                            rows="3"
                            placeholder="Tarla hakkında notlar..."
                        ></textarea>
                    </div>

                    <!-- Partners Section (Accordion) -->
                    <div class="partners-accordion">
                        <button 
                            type="button" 
                            class="accordion-header" 
                            @click="isPartnersOpen = !isPartnersOpen"
                        >
                            <div class="accordion-title">
                                <svg 
                                    class="accordion-icon" 
                                    :class="{ 'accordion-icon-open': isPartnersOpen }"
                                    width="20" 
                                    height="20" 
                                    viewBox="0 0 24 24" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    stroke-width="2"
                                >
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                                <span>Ortaklar</span>
                                <span v-if="partners.filter(p => p.name.trim()).length > 0" class="partner-count">
                                    {{ partners.filter(p => p.name.trim()).length }} ortak
                                </span>
                            </div>
                            <span 
                                v-if="totalPartnerPercentage !== 100 && partners.some(p => p.name.trim())" 
                                class="accordion-warning"
                            >
                                ⚠️ %{{ totalPartnerPercentage }}
                            </span>
                        </button>

                        <div class="accordion-content" :class="{ 'accordion-content-open': isPartnersOpen }">
                            <div class="partners-section">
                                <div class="partners-inner">
                                    <div class="partners-actions">
                                        <button type="button" class="btn-add-partner" @click="addPartner">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                            </svg>
                                            Ortak Ekle
                                        </button>
                                    </div>

                                    <div
                                        v-for="(partner, index) in partners"
                                        :key="index"
                                        class="partner-row"
                                    >
                                        <input
                                            v-model="partner.name"
                                            type="text"
                                            placeholder="Ortak Adı"
                                            class="partner-name"
                                        />
                                        <div class="partner-percentage">
                                            <input
                                                v-model.number="partner.percentage"
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="1"
                                            />
                                            <span>%</span>
                                        </div>
                                        <label class="primary-checkbox">
                                            <input
                                                type="radio"
                                                :checked="partner.isPrimary"
                                                @change="setPrimaryOwner(index)"
                                            />
                                            Ana Sahip
                                        </label>
                                        <button
                                            v-if="partners.length > 1"
                                            type="button"
                                            class="btn-remove-partner"
                                            @click="removePartner(index)"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <div v-if="totalPartnerPercentage !== 100" class="percentage-warning">
                                        Toplam pay: %{{ totalPartnerPercentage }} (100% olmalı)
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Error Message -->
                    <div v-if="formError || geoStore.error" class="error-message">
                        {{ formError || geoStore.error }}
                    </div>

                    <!-- Actions -->
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" @click="goBack">
                            İptal
                        </button>
                        <button
                            type="submit"
                            class="btn-primary"
                            :disabled="!isFormValid || isSubmitting"
                        >
                            {{ isSubmitting ? 'Kaydediliyor...' : 'Tarla Ekle' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
        </div>
    </AppLayout>
</template>

<style scoped>
.create-field-page {
    padding: 24px;
    max-width: 1400px;
    margin: 0 auto;
}

.page-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
}

.page-header h1 {
    font-size: 24px;
    font-weight: 700;
    color: #1a1a2e;
    margin: 0;
}

.btn-back {
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: none;
    color: #666;
    cursor: pointer;
    font-size: 16px;
    padding: 8px;
    border-radius: 8px;
    transition: background 0.2s;
}

.btn-back:hover {
    background: #f3f4f6;
    color: #1a1a2e;
}

.content-grid {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 24px;
}

@media (max-width: 1024px) {
    .content-grid {
        grid-template-columns: 1fr;
    }
}

/* Map Section */
.map-section {
    background: transparent;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
}

.map-container {
    height: 500px;
    width: 100%;
    border-radius: 16px;
    overflow: hidden;
}

.parcel-info {
    padding: 16px;
    background: #f0fdf4;
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
    border-radius: 12px;
    border: 1px solid #bbf7d0;
}

.area-badge {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
}

.area-badge-red {
    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
}

.parcel-info-clicked {
    background: #fef2f2;
    border-color: #fecaca;
}

.parcel-loading {
    padding: 16px;
    background: #fefce8;
    display: flex;
    align-items: center;
    gap: 12px;
    color: #854d0e;
    margin-top: 12px;
    border-radius: 12px;
    border: 1px solid #fef08a;
}

.parcel-hint {
    padding: 16px;
    background: #f0f9ff;
    color: #0369a1;
    font-size: 14px;
    margin-top: 12px;
    border-radius: 12px;
    border: 1px solid #bae6fd;
}

.spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid #fef08a;
    border-top-color: #ca8a04;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    display: inline-block;
}

/* Form Section */
.form-section {
    background: white;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.form-group {
    margin-bottom: 20px;
}

.form-group label {
    display: block;
    font-weight: 600;
    color: #374151;
    margin-bottom: 8px;
    font-size: 14px;
}

.form-group input[type="text"],
.form-group textarea,
.form-group select {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 10px;
    font-size: 14px;
    transition: border-color 0.2s;
    background: white;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
    outline: none;
    border-color: #10b981;
}

.form-group select:disabled {
    background: #f3f4f6;
    cursor: not-allowed;
}

.loading-text {
    font-size: 12px;
    color: #6b7280;
    margin-top: 4px;
    display: block;
}

.area-display {
    padding: 12px 16px;
    background: #f0fdf4;
    border-radius: 10px;
    font-weight: 600;
    color: #059669;
}

/* Partners Accordion */
.partners-accordion {
    margin-top: 24px;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    transition: border-color 0.2s;
}

.partners-accordion:hover {
    border-color: #d1d5db;
}

.accordion-header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: #f9fafb;
    border: none;
    cursor: pointer;
    transition: background 0.2s;
}

.accordion-header:hover {
    background: #f3f4f6;
}

.accordion-title {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 15px;
    font-weight: 600;
    color: #374151;
}

.accordion-icon {
    color: #6b7280;
    transition: transform 0.3s ease;
}

.accordion-icon-open {
    transform: rotate(180deg);
}

.partner-count {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
}

.accordion-warning {
    color: #d97706;
    font-size: 13px;
    font-weight: 500;
}

.accordion-content {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease-out;
}

.accordion-content-open {
    max-height: 500px;
}

/* Partners Section */
.partners-section {
    padding: 0;
}

.partners-inner {
    padding: 20px;
    background: white;
}

.partners-actions {
    margin-bottom: 16px;
}

.btn-add-partner {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: 2px dashed #10b981;
    color: #10b981;
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-add-partner:hover {
    background: #f0fdf4;
    border-style: solid;
}

.partner-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}

.partner-name {
    flex: 1;
    padding: 10px 12px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
}

.partner-percentage {
    display: flex;
    align-items: center;
    gap: 4px;
}

.partner-percentage input {
    width: 60px;
    padding: 10px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    text-align: center;
}

.primary-checkbox {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #6b7280;
    white-space: nowrap;
}

.btn-remove-partner {
    background: #fef2f2;
    border: none;
    color: #dc2626;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

.btn-remove-partner:hover {
    background: #fee2e2;
}

.percentage-warning {
    background: #fef3c7;
    color: #92400e;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
    margin-top: 8px;
}

/* Error Message */
.error-message {
    background: #fef2f2;
    color: #dc2626;
    padding: 12px 16px;
    border-radius: 10px;
    margin-bottom: 20px;
    font-size: 14px;
}

/* Form Actions */
.form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 24px;
}

.btn-primary {
    display: flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
}

.btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: none;
    padding: 12px 24px;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}

.btn-secondary:hover {
    background: #e5e7eb;
}
</style>
