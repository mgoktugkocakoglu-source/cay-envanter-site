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

// Step tracking
const currentStep = computed(() => {
    if (!fieldName.value.trim()) return 1;
    if (!geoStore.selectedNeighborhoodId) return 2;
    return 3;
});

// Computed
const selectedArea = computed(() => {
    if (clickedParcel.value) {
        const alanStr = clickedParcel.value.properties.alan;
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
        map = L.map(mapContainer.value, {
            zoomControl: false,
        }).setView(TURKEY_CENTER, TURKEY_ZOOM);

        L.control.zoom({ position: 'topright' }).addTo(map);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
            maxZoom: 20,
        }).addTo(map);

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

    if (currentLayer) {
        map.removeLayer(currentLayer);
    }

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
            fillOpacity: 0.08,
            fillColor: '#10b981',
        }
    }).addTo(map);

    map.fitBounds(currentLayer.getBounds(), { padding: [20, 20] });
}

function displayParcels(parcels: typeof geoStore.parcels) {
    if (!map) return;

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
            color: feature?.properties?.id === geoStore.selectedParcelId ? '#10b981' : '#64748b',
            weight: feature?.properties?.id === geoStore.selectedParcelId ? 3 : 1,
            fillOpacity: feature?.properties?.id === geoStore.selectedParcelId ? 0.25 : 0.08,
            fillColor: feature?.properties?.id === geoStore.selectedParcelId ? '#10b981' : '#64748b',
        }),
        onEachFeature: (feature, layer) => {
            layer.on('click', () => {
                geoStore.selectParcel(feature.properties?.id || null);
                if (parcelLayers) {
                    parcelLayers.setStyle((f) => ({
                        color: f?.properties?.id === geoStore.selectedParcelId ? '#10b981' : '#64748b',
                        weight: f?.properties?.id === geoStore.selectedParcelId ? 3 : 1,
                        fillOpacity: f?.properties?.id === geoStore.selectedParcelId ? 0.25 : 0.08,
                        fillColor: f?.properties?.id === geoStore.selectedParcelId ? '#10b981' : '#64748b',
                    }));
                }
            });
            layer.bindTooltip(`Parsel: ${feature.properties?.parcelNo || 'N/A'}`, {
                className: 'dark-tooltip'
            });
        }
    }).addTo(map);
}

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
            formError.value = 'Bu koordinatta parsel bulunamadi';
            clickedParcel.value = null;
            clearClickedParcelLayer();
        } else {
            formError.value = 'Bu koordinatta parsel bulunamadi';
            clickedParcel.value = null;
            clearClickedParcelLayer();
        }
    } catch (e) {
        formError.value = 'Parsel bilgisi alinamadi';
        clickedParcel.value = null;
        clearClickedParcelLayer();
    } finally {
        isLoadingParcel.value = false;
    }
}

function displayClickedParcel(parcel: GeoParcelDetail) {
    if (!map) return;

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
            color: '#f59e0b',
            weight: 3,
            fillOpacity: 0.2,
            fillColor: '#f59e0b',
            dashArray: '6 4',
        }
    }).addTo(map);

    clickedParcelLayer.bindPopup(`
        <div style="font-family: Inter, sans-serif; font-size: 13px; line-height: 1.5;">
            <strong>${parcel.properties.ozet}</strong><br>
            <span style="color: #64748b;">Alan:</span> ${parcel.properties.alan} m&sup2;<br>
            <span style="color: #64748b;">Nitelik:</span> ${parcel.properties.nitelik}
        </div>
    `).openPopup();

    map.fitBounds(clickedParcelLayer.getBounds(), { padding: [50, 50] });
}

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
        formError.value = 'Ortaklarin toplam payi %100 olmalidir';
        return;
    }

    isSubmitting.value = true;
    formError.value = null;

    try {
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
            formError.value = fieldsStore.error || 'Tarla olusturulamadi';
        }
    } catch (e) {
        formError.value = 'Bir hata olustu';
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
            <!-- Page Header -->
            <header class="page-header">
                <button class="btn-back" @click="goBack">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    Geri Don
                </button>
                <div class="header-center">
                    <h1>Yeni Tarla Ekle</h1>
                    <p class="header-sub">Tarla bilgilerini girerek yeni tarla kaydi olusturun</p>
                </div>
            </header>

            <!-- Step Indicator -->
            <div class="steps-bar">
                <div class="step" :class="{ active: currentStep >= 1, done: currentStep > 1 }">
                    <div class="step-dot">
                        <svg v-if="currentStep > 1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <span v-else>1</span>
                    </div>
                    <span class="step-label">Temel Bilgi</span>
                </div>
                <div class="step-line" :class="{ filled: currentStep > 1 }"></div>
                <div class="step" :class="{ active: currentStep >= 2, done: currentStep > 2 }">
                    <div class="step-dot">
                        <svg v-if="currentStep > 2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <span v-else>2</span>
                    </div>
                    <span class="step-label">Konum</span>
                </div>
                <div class="step-line" :class="{ filled: currentStep > 2 }"></div>
                <div class="step" :class="{ active: currentStep >= 3 }">
                    <div class="step-dot"><span>3</span></div>
                    <span class="step-label">Parsel & Detay</span>
                </div>
            </div>

            <!-- Content -->
            <div class="content-layout">
                <!-- Map Column -->
                <div class="map-col">
                    <div class="map-card">
                        <div ref="mapContainer" class="map-container"></div>

                        <!-- Map Status Bar -->
                        <div class="map-status">
                            <div v-if="isLoadingParcel" class="map-status-item map-status-loading">
                                <span class="spinner"></span>
                                Parsel bilgisi yukleniyor...
                            </div>
                            <div v-else-if="clickedParcel" class="map-status-item map-status-selected">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                <div class="map-status-text">
                                    <span class="map-status-title">{{ clickedParcel.properties.ozet }}</span>
                                    <span class="map-status-meta">{{ clickedParcel.properties.alan }} m&sup2; &middot; {{ clickedParcel.properties.nitelik }}</span>
                                </div>
                                <span class="area-chip">{{ clickedParcel.properties.alan }} m&sup2;</span>
                            </div>
                            <div v-else-if="geoStore.selectedParcel" class="map-status-item map-status-selected">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                <div class="map-status-text">
                                    <span class="map-status-title">Parsel: {{ geoStore.selectedParcel.parcelNo }}</span>
                                </div>
                                <span class="area-chip">{{ geoStore.selectedParcel.area.toLocaleString('tr-TR') }} m&sup2;</span>
                            </div>
                            <div v-else-if="geoStore.selectedNeighborhoodId" class="map-status-item map-status-hint">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                                Haritaya tiklayarak parsel secebilirsiniz
                            </div>
                            <div v-else class="map-status-item map-status-default">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
                                Konum secimi icin il, ilce ve mahalle secin
                            </div>
                        </div>
                    </div>

                    <!-- Area Display (below map on large screens) -->
                    <div v-if="selectedArea > 0" class="area-display-card">
                        <div class="area-display-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                        </div>
                        <div class="area-display-info">
                            <span class="area-display-label">Tarla Alani</span>
                            <span class="area-display-value">{{ selectedArea.toLocaleString('tr-TR') }} m&sup2;</span>
                        </div>
                    </div>
                </div>

                <!-- Form Column -->
                <div class="form-col">
                    <form @submit.prevent="handleSubmit" class="form-card">
                        <!-- Section: Basic Info -->
                        <div class="form-section">
                            <div class="form-section-header">
                                <div class="section-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </div>
                                <h3>Temel Bilgiler</h3>
                            </div>

                            <div class="form-group">
                                <label for="fieldName">Tarla Adi <span class="required">*</span></label>
                                <input
                                    id="fieldName"
                                    v-model="fieldName"
                                    type="text"
                                    class="form-input"
                                    placeholder="Orn: Ust Bahce"
                                    required
                                />
                            </div>
                        </div>

                        <!-- Section: Location -->
                        <div class="form-section">
                            <div class="form-section-header">
                                <div class="section-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                </div>
                                <h3>Konum Bilgileri</h3>
                            </div>

                            <div class="select-grid">
                                <AppSelect
                                    :model-value="geoStore.selectedProvinceId?.toString() || ''"
                                    :options="geoStore.provinces.map(p => ({ value: p.id.toString(), label: p.name }))"
                                    label="Il"
                                    placeholder="Il Secin"
                                    :disabled="geoStore.isLoadingProvinces"
                                    required
                                    searchable
                                    @update:model-value="handleProvinceChange"
                                />

                                <div>
                                    <AppSelect
                                        :model-value="geoStore.selectedDistrictId?.toString() || ''"
                                        :options="geoStore.districts.map(d => ({ value: d.id.toString(), label: d.name }))"
                                        label="Ilce"
                                        placeholder="Ilce Secin"
                                        :disabled="!geoStore.selectedProvinceId || geoStore.isLoadingDistricts"
                                        required
                                        searchable
                                        @update:model-value="handleDistrictChange"
                                    />
                                    <span v-if="geoStore.isLoadingDistricts" class="loading-text">
                                        <span class="spinner-tiny"></span> Yukleniyor...
                                    </span>
                                </div>
                            </div>

                            <div class="select-grid">
                                <div>
                                    <AppSelect
                                        :model-value="geoStore.selectedNeighborhoodId?.toString() || ''"
                                        :options="geoStore.neighborhoods.map(n => ({ value: n.id.toString(), label: n.name }))"
                                        label="Mahalle"
                                        placeholder="Mahalle Secin"
                                        :disabled="!geoStore.selectedDistrictId || geoStore.isLoadingNeighborhoods"
                                        required
                                        searchable
                                        @update:model-value="handleNeighborhoodChange"
                                    />
                                    <span v-if="geoStore.isLoadingNeighborhoods" class="loading-text">
                                        <span class="spinner-tiny"></span> Yukleniyor...
                                    </span>
                                </div>

                                <div>
                                    <AppSelect
                                        :model-value="geoStore.selectedParcelId?.toString() || ''"
                                        :options="geoStore.parcels.map(p => ({ value: p.id.toString(), label: `${p.parcelNo} (${p.area.toLocaleString('tr-TR')} m²)` }))"
                                        label="Parsel"
                                        placeholder="Haritadan veya listeden"
                                        :disabled="!geoStore.selectedNeighborhoodId || geoStore.isLoadingParcels"
                                        searchable
                                        @update:model-value="handleParcelChange"
                                    />
                                    <span v-if="geoStore.isLoadingParcels" class="loading-text">
                                        <span class="spinner-tiny"></span> Parseller yukleniyor...
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Section: Notes -->
                        <div class="form-section">
                            <div class="form-section-header">
                                <div class="section-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                                </div>
                                <h3>Notlar</h3>
                            </div>

                            <div class="form-group">
                                <textarea
                                    id="notes"
                                    v-model="notes"
                                    rows="3"
                                    class="form-textarea"
                                    placeholder="Tarla hakkinda notlar..."
                                ></textarea>
                            </div>
                        </div>

                        <!-- Section: Partners -->
                        <div class="form-section">
                            <button
                                type="button"
                                class="partners-toggle"
                                @click="isPartnersOpen = !isPartnersOpen"
                            >
                                <div class="partners-toggle-left">
                                    <div class="section-icon">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                    </div>
                                    <h3>Ortaklar</h3>
                                    <span v-if="partners.filter(p => p.name.trim()).length > 0" class="partner-badge">
                                        {{ partners.filter(p => p.name.trim()).length }}
                                    </span>
                                </div>
                                <div class="partners-toggle-right">
                                    <span
                                        v-if="totalPartnerPercentage !== 100 && partners.some(p => p.name.trim())"
                                        class="pct-warn"
                                    >
                                        %{{ totalPartnerPercentage }}
                                    </span>
                                    <svg
                                        class="chevron"
                                        :class="{ open: isPartnersOpen }"
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    >
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </div>
                            </button>

                            <div class="partners-body" :class="{ open: isPartnersOpen }">
                                <div class="partners-content">
                                    <button type="button" class="btn-add-partner" @click="addPartner">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <line x1="12" y1="5" x2="12" y2="19"/>
                                            <line x1="5" y1="12" x2="19" y2="12"/>
                                        </svg>
                                        Ortak Ekle
                                    </button>

                                    <div
                                        v-for="(partner, index) in partners"
                                        :key="index"
                                        class="partner-row"
                                    >
                                        <input
                                            v-model="partner.name"
                                            type="text"
                                            placeholder="Ortak Adi"
                                            class="form-input partner-name-input"
                                        />
                                        <div class="pct-input-wrap">
                                            <input
                                                v-model.number="partner.percentage"
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="1"
                                                class="form-input pct-input"
                                            />
                                            <span class="pct-symbol">%</span>
                                        </div>
                                        <label class="radio-label">
                                            <input
                                                type="radio"
                                                name="primaryOwner"
                                                :checked="partner.isPrimary"
                                                @change="setPrimaryOwner(index)"
                                            />
                                            <span class="radio-text">Ana</span>
                                        </label>
                                        <button
                                            v-if="partners.length > 1"
                                            type="button"
                                            class="btn-remove"
                                            @click="removePartner(index)"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                        </button>
                                    </div>

                                    <div v-if="totalPartnerPercentage !== 100 && partners.some(p => p.name.trim())" class="pct-warning-bar">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                        Toplam pay: %{{ totalPartnerPercentage }} (100% olmali)
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Error -->
                        <div v-if="formError || geoStore.error" class="error-banner">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            {{ formError || geoStore.error }}
                        </div>

                        <!-- Actions -->
                        <div class="form-actions">
                            <button type="button" class="btn-cancel" @click="goBack">
                                Iptal
                            </button>
                            <button
                                type="submit"
                                class="btn-submit"
                                :disabled="!isFormValid || isSubmitting"
                            >
                                <span v-if="isSubmitting" class="spinner"></span>
                                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
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
    max-width: 1400px;
    margin: 0 auto;
    padding: var(--space-6);
}

/* ── Page Header ── */
.page-header {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    margin-bottom: var(--space-5);
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
}

.btn-back:hover {
    color: var(--color-text-primary);
    border-color: var(--color-text-muted);
    background: var(--color-bg-tertiary);
}

.header-center h1 {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
    margin-bottom: 2px;
}

.header-sub {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
}

/* ── Steps Bar ── */
.steps-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    margin-bottom: var(--space-6);
    padding: var(--space-4) var(--space-6);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
}

.step {
    display: flex;
    align-items: center;
    gap: var(--space-2);
}

.step-dot {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-full);
    background: var(--color-bg-tertiary);
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: var(--font-weight-semibold);
    transition: all var(--transition-normal);
    border: 2px solid transparent;
}

.step.active .step-dot {
    background: var(--color-primary-light);
    color: var(--color-primary);
    border-color: var(--color-primary);
}

.step.done .step-dot {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
}

.step-label {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    font-weight: var(--font-weight-medium);
    transition: color var(--transition-fast);
}

.step.active .step-label {
    color: var(--color-text-primary);
}

.step-line {
    width: 60px;
    height: 2px;
    background: var(--color-bg-tertiary);
    margin: 0 var(--space-3);
    border-radius: 1px;
    transition: background var(--transition-normal);
}

.step-line.filled {
    background: var(--color-primary);
}

/* ── Content Layout ── */
.content-layout {
    display: grid;
    grid-template-columns: 1fr 420px;
    gap: var(--space-5);
    align-items: start;
}

/* ── Map Column ── */
.map-col {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    position: sticky;
    top: 80px;
}

.map-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
}

.map-container {
    height: 480px;
    width: 100%;
    background: var(--color-bg-primary);
}

/* Map Status Bar */
.map-status {
    border-top: 1px solid var(--color-border);
}

.map-status-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    font-size: var(--font-size-sm);
}

.map-status-loading {
    color: var(--color-warning);
    background: rgba(245, 158, 11, 0.06);
}

.map-status-selected {
    color: var(--color-text-primary);
    background: rgba(16, 185, 129, 0.06);
}

.map-status-hint {
    color: var(--color-info);
    background: rgba(59, 130, 246, 0.06);
}

.map-status-default {
    color: var(--color-text-muted);
}

.map-status-text {
    flex: 1;
    min-width: 0;
}

.map-status-title {
    display: block;
    font-weight: var(--font-weight-medium);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.map-status-meta {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
}

.area-chip {
    background: var(--color-primary);
    color: white;
    padding: 2px 10px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: var(--font-weight-semibold);
    white-space: nowrap;
    flex-shrink: 0;
}

/* Area Display Card */
.area-display-card {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
}

.area-display-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-lg);
    background: var(--color-primary-light);
    color: var(--color-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.area-display-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    display: block;
}

.area-display-value {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    color: var(--color-primary);
}

/* ── Form Column ── */
.form-col {
    min-width: 0;
}

.form-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
}

/* Form Sections */
.form-section {
    padding: var(--space-5);
    border-bottom: 1px solid var(--color-border);
}

.form-section:last-of-type {
    border-bottom: none;
}

.form-section-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
}

.section-icon {
    width: 34px;
    height: 34px;
    border-radius: var(--radius-md);
    background: var(--color-primary-light);
    color: var(--color-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.form-section-header h3 {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
}

/* Form Elements */
.form-group {
    margin-bottom: var(--space-4);
}

.form-group:last-child {
    margin-bottom: 0;
}

.form-group label {
    display: block;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-2);
}

.required {
    color: var(--color-danger);
}

.form-input,
.form-textarea {
    width: 100%;
    padding: var(--space-3) var(--space-4);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    font-size: var(--font-size-base);
    font-family: var(--font-family);
    transition: all var(--transition-fast);
    min-height: 44px;
    box-sizing: border-box;
}

.form-input::placeholder,
.form-textarea::placeholder {
    color: var(--color-text-muted);
}

.form-input:focus,
.form-textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-textarea {
    resize: vertical;
    min-height: 80px;
}

.select-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
}

.select-grid:last-child {
    margin-bottom: 0;
}

.loading-text {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    margin-top: var(--space-1);
}

/* ── Partners ── */
.partners-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    color: inherit;
}

.partners-toggle-left {
    display: flex;
    align-items: center;
    gap: var(--space-3);
}

.partners-toggle-left h3 {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
}

.partner-badge {
    background: var(--color-primary);
    color: white;
    width: 22px;
    height: 22px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: var(--font-weight-semibold);
    display: flex;
    align-items: center;
    justify-content: center;
}

.partners-toggle-right {
    display: flex;
    align-items: center;
    gap: var(--space-2);
}

.pct-warn {
    color: var(--color-warning);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
}

.chevron {
    color: var(--color-text-muted);
    transition: transform var(--transition-normal);
}

.chevron.open {
    transform: rotate(180deg);
}

.partners-body {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease-out;
}

.partners-body.open {
    max-height: 600px;
}

.partners-content {
    padding-top: var(--space-4);
}

.btn-add-partner {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    background: transparent;
    border: 1.5px dashed var(--color-primary);
    color: var(--color-primary);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all var(--transition-fast);
    margin-bottom: var(--space-4);
}

.btn-add-partner:hover {
    background: var(--color-primary-light);
    border-style: solid;
}

.partner-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
}

.partner-name-input {
    flex: 1;
    min-width: 0;
}

.pct-input-wrap {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}

.pct-input {
    width: 64px;
    text-align: center;
    padding: var(--space-2) var(--space-2) !important;
    min-height: 40px !important;
}

.pct-symbol {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
}

.radio-label {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
}

.radio-label input[type="radio"] {
    accent-color: var(--color-primary);
    width: 14px;
    height: 14px;
}

.radio-text {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
}

.btn-remove {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(239, 68, 68, 0.1);
    border: none;
    border-radius: var(--radius-md);
    color: var(--color-danger);
    cursor: pointer;
    flex-shrink: 0;
    transition: all var(--transition-fast);
}

.btn-remove:hover {
    background: rgba(239, 68, 68, 0.2);
}

.pct-warning-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: rgba(245, 158, 11, 0.1);
    border-radius: var(--radius-md);
    color: var(--color-warning);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
}

/* ── Error Banner ── */
.error-banner {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin: 0 var(--space-5) var(--space-4);
    padding: var(--space-3) var(--space-4);
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: var(--radius-md);
    color: var(--color-danger);
    font-size: var(--font-size-sm);
}

/* ── Form Actions ── */
.form-actions {
    display: flex;
    gap: var(--space-3);
    justify-content: flex-end;
    padding: var(--space-4) var(--space-5);
    background: var(--color-bg-primary);
    border-top: 1px solid var(--color-border);
}

.btn-cancel {
    padding: var(--space-3) var(--space-6);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    color: var(--color-text-secondary);
    font-weight: var(--font-weight-medium);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.btn-cancel:hover {
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    border-color: var(--color-text-muted);
}

.btn-submit {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-6);
    background: var(--color-primary);
    border: none;
    border-radius: var(--radius-lg);
    color: white;
    font-weight: var(--font-weight-semibold);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.btn-submit:hover:not(:disabled) {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
}

.btn-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* ── Spinner ── */
.spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
}

.spinner-tiny {
    display: inline-block;
    width: 10px;
    height: 10px;
    border: 1.5px solid var(--color-border);
    border-top-color: var(--color-text-muted);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* ── Responsive ── */
@media (max-width: 1100px) {
    .content-layout {
        grid-template-columns: 1fr;
    }

    .map-col {
        position: static;
    }

    .map-container {
        height: 360px;
    }
}

@media (max-width: 768px) {
    .create-field-page {
        padding: var(--space-4);
    }

    .page-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .steps-bar {
        padding: var(--space-3) var(--space-4);
    }

    .step-label {
        display: none;
    }

    .step-line {
        width: 40px;
    }

    .select-grid {
        grid-template-columns: 1fr;
    }

    .partner-row {
        flex-wrap: wrap;
    }

    .partner-name-input {
        flex: 1 1 100%;
    }

    .map-container {
        height: 280px;
    }
}
</style>
