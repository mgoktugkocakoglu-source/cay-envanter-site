<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useGeoStore } from '@/stores/geoStore';
import { useFieldsStore } from '@/stores/fieldsStore';
import { api } from '@/services/api';
import type { GeoParcelDetail, Field } from '@/services/api';
import AppSelect from '@/components/ui/AppSelect.vue';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
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
const isPartnersOpen = ref(false);

// Map state
const mapContainer = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
let currentLayer: L.GeoJSON | null = null;
let parcelLayers: L.GeoJSON | null = null;
let clickedParcelLayer: L.GeoJSON | null = null;

const clickedParcel = ref<GeoParcelDetail | null>(null);
const isLoadingParcel = ref(false);

const TURKEY_CENTER: L.LatLngExpression = [39.0, 35.0];
const TURKEY_ZOOM = 6;

// Theme-aware color helper for Leaflet
function getCssVar(name: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}



// ═══════ WIZARD STEP MANAGEMENT ═══════
// activeStep is manually controlled - only changes via user action or goToStep
const activeStep = ref(1);
const TOTAL_STEPS = 6;

// Check if a step's data is filled
function isStepComplete(s: number): boolean {
    switch (s) {
        case 1: return fieldName.value.trim() !== '';
        case 2: return !!geoStore.selectedProvinceId;
        case 3: return !!geoStore.selectedDistrictId;
        case 4: return !!geoStore.selectedNeighborhoodId;
        case 5: return !!(clickedParcel.value || geoStore.selectedParcelId);
        case 6: return true;
        default: return false;
    }
}

// Label for each step
function stepLabel(s: number): string {
    switch (s) {
        case 1: return 'Tarla Adi';
        case 2: return 'Il';
        case 3: return 'Ilce';
        case 4: return 'Mahalle';
        case 5: return 'Parsel';
        case 6: return 'Detaylar';
        default: return '';
    }
}

// Value summary for completed steps
function stepValue(s: number): string {
    switch (s) {
        case 1: return fieldName.value.trim();
        case 2: return geoStore.selectedProvince?.name || '';
        case 3: return geoStore.selectedDistrict?.name || '';
        case 4: return geoStore.selectedNeighborhood?.name || '';
        case 5: {
            if (clickedParcel.value) return clickedParcel.value.properties.parselNo;
            if (geoStore.selectedParcel) return geoStore.selectedParcel.parcelNo;
            return '';
        }
        case 6: return '';
        default: return '';
    }
}

// Navigate to next step
function nextStep() {
    if (activeStep.value < TOTAL_STEPS && isStepComplete(activeStep.value)) {
        activeStep.value++;
    }
}

// Navigate to a previous step (for editing)
function goToStep(s: number) {
    if (s < activeStep.value && s >= 1) {
        // If going back to location steps, we need to reset downstream selections
        if (s <= 2) {
            // Going back to province — clear district, neighborhood, parcel
            geoStore.selectDistrict(null);
            geoStore.selectNeighborhood(null);
            geoStore.selectParcel(null);
            clickedParcel.value = null;
            clearClickedParcelLayer();
        } else if (s <= 3) {
            // Going back to district — clear neighborhood, parcel
            geoStore.selectNeighborhood(null);
            geoStore.selectParcel(null);
            clickedParcel.value = null;
            clearClickedParcelLayer();
        } else if (s <= 4) {
            // Going back to neighborhood — clear parcel
            geoStore.selectParcel(null);
            clickedParcel.value = null;
            clearClickedParcelLayer();
        }
        activeStep.value = s;
    }
}

// Go back one step
function prevStep() {
    if (activeStep.value > 1) {
        goToStep(activeStep.value - 1);
    }
}

// Computed
const selectedArea = computed(() => {
    if (clickedParcel.value) {
        const alanStr = clickedParcel.value.properties.alan;
        return parseFloat(alanStr.replace('.', '').replace(',', '.')) || 0;
    }
    const parcel = geoStore.selectedParcel;
    if (parcel) return parcel.area;
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

// Steps completed before active step (for breadcrumb)
const completedSteps = computed(() => {
    const steps: number[] = [];
    for (let i = 1; i < activeStep.value; i++) {
        steps.push(i);
    }
    return steps;
});

// ═══════ MAP ═══════
onMounted(async () => {
    if (mapContainer.value) {
        map = L.map(mapContainer.value, {
            zoomControl: false,
        }).setView(TURKEY_CENTER, TURKEY_ZOOM);

        L.control.zoom({ position: 'topright' }).addTo(map);

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics',
            maxZoom: 19,
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
    if (currentLayer) map.removeLayer(currentLayer);

    const geoJson: GeoJSON.Feature = {
        type: 'Feature', properties: {},
        geometry: { type: 'Polygon', coordinates }
    };

    const primary = getCssVar('--color-primary', '#10b981');
    currentLayer = L.geoJSON(geoJson, {
        style: { color: primary, weight: 2, fillOpacity: 0.08, fillColor: primary }
    }).addTo(map);

    map.fitBounds(currentLayer.getBounds(), { padding: [20, 20] });
}

function displayParcels(parcels: typeof geoStore.parcels) {
    if (!map) return;
    if (parcelLayers) map.removeLayer(parcelLayers);

    const features: GeoJSON.Feature[] = parcels.map(parcel => ({
        type: 'Feature',
        properties: { id: parcel.id, parcelNo: parcel.parcelNo, area: parcel.area },
        geometry: { type: 'Polygon', coordinates: parcel.polygon }
    }));

    const primaryColor = getCssVar('--color-primary', '#10b981');
    const mutedColor = getCssVar('--color-text-muted', '#64748b');
    parcelLayers = L.geoJSON(({ type: 'FeatureCollection', features } as unknown) as GeoJSON.FeatureCollection, {
        style: (feature) => ({
            color: feature?.properties?.id === geoStore.selectedParcelId ? primaryColor : mutedColor,
            weight: feature?.properties?.id === geoStore.selectedParcelId ? 3 : 1,
            fillOpacity: feature?.properties?.id === geoStore.selectedParcelId ? 0.25 : 0.08,
            fillColor: feature?.properties?.id === geoStore.selectedParcelId ? primaryColor : mutedColor,
        }),
        onEachFeature: (feature, layer) => {
            layer.on('click', () => {
                geoStore.selectParcel(feature.properties?.id || null);
                if (parcelLayers) {
                    const pc = getCssVar('--color-primary', '#10b981');
                    const mc = getCssVar('--color-text-muted', '#64748b');
                    parcelLayers.setStyle((f) => ({
                        color: f?.properties?.id === geoStore.selectedParcelId ? pc : mc,
                        weight: f?.properties?.id === geoStore.selectedParcelId ? 3 : 1,
                        fillOpacity: f?.properties?.id === geoStore.selectedParcelId ? 0.25 : 0.08,
                        fillColor: f?.properties?.id === geoStore.selectedParcelId ? pc : mc,
                    }));
                }
            });
            layer.bindTooltip(`Parsel: ${feature.properties?.parcelNo || 'N/A'}`, { className: 'dark-tooltip' });
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
        } else {
            formError.value = 'Bu koordinatta parsel bulunamadi';
            clickedParcel.value = null;
            clearClickedParcelLayer();
        }
    } catch {
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

    clickedParcelLayer = L.geoJSON(({
        type: 'Feature',
        properties: { parselNo: parcel.properties.parselNo, alan: parcel.properties.alan, ozet: parcel.properties.ozet },
        geometry: { type: 'Polygon', coordinates: parcel.polygon }
    } as unknown) as GeoJSON.Feature, {
        style: { color: getCssVar('--color-warning', '#f59e0b'), weight: 3, fillOpacity: 0.2, fillColor: getCssVar('--color-warning', '#f59e0b'), dashArray: '6 4' }
    }).addTo(map);

    clickedParcelLayer.bindPopup(`
        <div style="font-family: Inter, sans-serif; font-size: 13px; line-height: 1.5;">
            <strong>${parcel.properties.ozet}</strong><br>
            <span style="color: var(--color-text-muted);">Alan:</span> ${parcel.properties.alan} m&sup2;<br>
            <span style="color: var(--color-text-muted);">Nitelik:</span> ${parcel.properties.nitelik}
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

// ═══════ FORM HANDLERS ═══════
type SelectValue = string | number | (string | number)[] | null;

function handleProvinceChange(value: SelectValue) {
    const v = Array.isArray(value) ? value[0] : value;
    geoStore.selectProvince(v ? String(v) : null);
    if (v) nextStep();
}

function handleDistrictChange(value: SelectValue) {
    const v = Array.isArray(value) ? value[0] : value;
    geoStore.selectDistrict(v ? String(v) : null);
    if (v) nextStep();
}

function handleNeighborhoodChange(value: SelectValue) {
    const v = Array.isArray(value) ? value[0] : value;
    geoStore.selectNeighborhood(v ? String(v) : null);
    if (v) nextStep();
}

function handleParcelChange(value: SelectValue) {
    const v = Array.isArray(value) ? value[0] : value;
    geoStore.selectParcel(v ? String(v) : null);
    if (v) nextStep();
}

function addPartner() {
    partners.value.push({ name: '', percentage: 0, isPrimary: false });
}

function removePartner(index: number) {
    if (partners.value.length > 1) {
        partners.value.splice(index, 1);
        if (!partners.value.some(p => p.isPrimary)) partners.value[0].isPrimary = true;
    }
}

function setPrimaryOwner(index: number) {
    partners.value.forEach((p, i) => { p.isPrimary = i === index; });
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
            parcelNo, coordinates: parcelCoordinates, area: selectedArea.value, areaUnit: 'm2' as const,
            notes: notes.value.trim() || null,
            partners: partners.value.filter(p => p.name.trim()).map(p => ({
                partnerName: p.name.trim(), sharePercentage: p.percentage, isPrimaryOwner: p.isPrimary
            }))
        };

        const result = await fieldsStore.createField(fieldData as Parameters<typeof fieldsStore.createField>[0]);
        if (result) {
            router.push('/fields');
        } else {
            formError.value = fieldsStore.error || 'Tarla olusturulamadi';
        }
    } catch {
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
    <TeaBusinessLayout>
        <div class="create-field-page">
            <!-- Page Header -->
            <header class="page-header">
                <button class="btn-back" @click="goBack">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    Geri Don
                </button>
                <div class="header-center">
                    <h1>Yeni Tarla Ekle</h1>
                    <p class="header-sub">Adim {{ activeStep }} / {{ TOTAL_STEPS }}</p>
                </div>
            </header>

            <!-- Progress Bar -->
            <div class="progress-track">
                <div class="progress-fill" :style="{ width: `${(activeStep / TOTAL_STEPS) * 100}%` }"></div>
            </div>

            <!-- Map - Always Visible -->
            <div class="map-section">
                <div class="map-card">
                    <div ref="mapContainer" class="map-container"></div>
                    <div class="map-status">
                        <div v-if="isLoadingParcel" class="map-status-item map-status-loading">
                            <span class="spinner"></span>
                            Parsel bilgisi yukleniyor...
                        </div>
                        <div v-else-if="clickedParcel" class="map-status-item map-status-selected">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            <div class="map-status-text">
                                <span class="map-status-title">{{ clickedParcel.properties.ozet }}</span>
                                <span class="map-status-meta">{{ clickedParcel.properties.alan }} m&sup2; &middot; {{ clickedParcel.properties.nitelik }}</span>
                            </div>
                            <span class="area-chip">{{ clickedParcel.properties.alan }} m&sup2;</span>
                        </div>
                        <div v-else-if="geoStore.selectedParcel" class="map-status-item map-status-selected">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            <div class="map-status-text">
                                <span class="map-status-title">Parsel: {{ geoStore.selectedParcel.parcelNo }}</span>
                            </div>
                            <span class="area-chip">{{ geoStore.selectedParcel.area.toLocaleString('tr-TR') }} m&sup2;</span>
                        </div>
                        <div v-else-if="geoStore.selectedNeighborhoodId" class="map-status-item map-status-hint">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                            Haritaya tiklayarak parsel secebilirsiniz
                        </div>
                        <div v-else class="map-status-item map-status-default">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
                            Konum secimi icin adimlari takip edin
                        </div>
                    </div>
                </div>
            </div>

            <!-- Breadcrumb: completed steps (clickable to go back) -->
            <div v-if="completedSteps.length > 0" class="breadcrumb">
                <button
                    v-for="s in completedSteps"
                    :key="s"
                    class="breadcrumb-item"
                    @click="goToStep(s)"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span class="breadcrumb-label">{{ stepLabel(s) }}:</span>
                    <span class="breadcrumb-value">{{ stepValue(s) }}</span>
                </button>
            </div>

            <!-- Active Step Card -->
            <form @submit.prevent="handleSubmit" class="form-flow">
                <Transition name="wizard" mode="out-in">

                    <!-- Step 1: Field Name -->
                    <div v-if="activeStep === 1" key="step1" class="step-card">
                        <div class="step-header">
                            <div class="step-badge">1</div>
                            <div>
                                <h2 class="step-title">Tarla Adi <span class="required">*</span></h2>
                                <p class="step-hint">Tarlaniza kolay hatirlanacak bir isim verin</p>
                            </div>
                        </div>
                        <input
                            id="fieldName"
                            v-model="fieldName"
                            type="text"
                            class="form-input"
                            placeholder="Orn: Ust Bahce"
                            autofocus
                            @keyup.enter="nextStep"
                        />
                        <div class="step-actions">
                            <div></div>
                            <button type="button" class="btn-next" :disabled="!isStepComplete(1)" @click="nextStep">
                                Devam
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </button>
                        </div>
                    </div>

                    <!-- Step 2: Province -->
                    <div v-else-if="activeStep === 2" key="step2" class="step-card">
                        <div class="step-header">
                            <button type="button" class="btn-step-back" aria-label="Önceki adım" @click="prevStep">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                            </button>
                            <div class="step-badge">2</div>
                            <div>
                                <h2 class="step-title">Il Secin <span class="required">*</span></h2>
                                <p class="step-hint">Tarlanizin bulundugu ili secin</p>
                            </div>
                        </div>
                        <AppSelect
                            :model-value="geoStore.selectedProvinceId?.toString() || ''"
                            :options="geoStore.provinces.map(p => ({ value: p.id.toString(), label: p.name }))"
                            placeholder="Il Secin"
                            :disabled="geoStore.isLoadingProvinces"
                            required
                            searchable
                            @update:model-value="handleProvinceChange"
                        />
                    </div>

                    <!-- Step 3: District -->
                    <div v-else-if="activeStep === 3" key="step3" class="step-card">
                        <div class="step-header">
                            <button type="button" class="btn-step-back" aria-label="Önceki adım" @click="prevStep">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                            </button>
                            <div class="step-badge">3</div>
                            <div>
                                <h2 class="step-title">Ilce Secin <span class="required">*</span></h2>
                                <p class="step-hint">Tarlanizin bulundugu ilceyi secin</p>
                            </div>
                        </div>
                        <AppSelect
                            :model-value="geoStore.selectedDistrictId?.toString() || ''"
                            :options="geoStore.districts.map(d => ({ value: d.id.toString(), label: d.name }))"
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

                    <!-- Step 4: Neighborhood -->
                    <div v-else-if="activeStep === 4" key="step4" class="step-card">
                        <div class="step-header">
                            <button type="button" class="btn-step-back" aria-label="Önceki adım" @click="prevStep">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                            </button>
                            <div class="step-badge">4</div>
                            <div>
                                <h2 class="step-title">Mahalle Secin <span class="required">*</span></h2>
                                <p class="step-hint">Tarlanizin bulundugu mahalleyi secin</p>
                            </div>
                        </div>
                        <AppSelect
                            :model-value="geoStore.selectedNeighborhoodId?.toString() || ''"
                            :options="geoStore.neighborhoods.map(n => ({ value: n.id.toString(), label: n.name }))"
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

                    <!-- Step 5: Parcel -->
                    <div v-else-if="activeStep === 5" key="step5" class="step-card">
                        <div class="step-header">
                            <button type="button" class="btn-step-back" aria-label="Önceki adım" @click="prevStep">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                            </button>
                            <div class="step-badge">5</div>
                            <div>
                                <h2 class="step-title">Parsel Secin</h2>
                                <p class="step-hint">Haritaya tiklayarak veya listeden parsel secin</p>
                            </div>
                        </div>
                        <AppSelect
                            :model-value="geoStore.selectedParcelId?.toString() || ''"
                            :options="geoStore.parcels.map(p => ({ value: p.id.toString(), label: `${p.parcelNo} (${p.area.toLocaleString('tr-TR')} m²)` }))"
                            placeholder="Haritadan veya listeden"
                            :disabled="!geoStore.selectedNeighborhoodId || geoStore.isLoadingParcels"
                            searchable
                            @update:model-value="handleParcelChange"
                        />
                        <span v-if="geoStore.isLoadingParcels" class="loading-text">
                            <span class="spinner-tiny"></span> Parseller yukleniyor...
                        </span>

                        <div v-if="selectedArea > 0" class="area-inline">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                            <span>Tarla Alani: <strong>{{ selectedArea.toLocaleString('tr-TR') }} m&sup2;</strong></span>
                        </div>

                        <!-- Skip parcel button -->
                        <div class="step-actions">
                            <div></div>
                            <button type="button" class="btn-skip" @click="activeStep = 6">
                                Parselsiz Devam Et
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </button>
                        </div>
                    </div>

                    <!-- Step 6: Details -->
                    <div v-else-if="activeStep === 6" key="step6" class="step-card step-card-final">
                        <div class="step-header">
                            <button type="button" class="btn-step-back" aria-label="Önceki adım" @click="prevStep">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                            </button>
                            <div class="step-badge done">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                            <div>
                                <h2 class="step-title">Son Adim: Detaylar</h2>
                                <p class="step-hint">Notlarinizi ve ortak bilgilerinizi ekleyin</p>
                            </div>
                        </div>

                        <!-- Notes -->
                        <div class="detail-group">
                            <label for="notes" class="detail-label">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                                Notlar
                            </label>
                            <textarea id="notes" v-model="notes" rows="3" class="form-textarea" placeholder="Tarla hakkinda notlar..."></textarea>
                        </div>

                        <!-- Partners -->
                        <div class="detail-group">
                            <button type="button" class="partners-toggle" @click="isPartnersOpen = !isPartnersOpen">
                                <div class="partners-toggle-left">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                    <span class="detail-label-text">Ortaklar</span>
                                    <span v-if="partners.filter(p => p.name.trim()).length > 0" class="partner-badge">{{ partners.filter(p => p.name.trim()).length }}</span>
                                </div>
                                <svg class="chevron" :class="{ open: isPartnersOpen }" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                            </button>
                            <div class="partners-body" :class="{ open: isPartnersOpen }">
                                <div class="partners-content">
                                    <button type="button" class="btn-add-partner" @click="addPartner">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                        Ortak Ekle
                                    </button>
                                    <div v-for="(partner, index) in partners" :key="index" class="partner-row">
                                        <input v-model="partner.name" type="text" placeholder="Ortak Adi" class="form-input partner-name-input" />
                                        <div class="pct-input-wrap">
                                            <input v-model.number="partner.percentage" type="number" min="0" max="100" step="1" class="form-input pct-input" />
                                            <span class="pct-symbol">%</span>
                                        </div>
                                        <label class="radio-label">
                                            <input type="radio" name="primaryOwner" :checked="partner.isPrimary" @change="setPrimaryOwner(index)" />
                                            <span class="radio-text">Ana</span>
                                        </label>
                                        <button v-if="partners.length > 1" type="button" class="btn-remove" @click="removePartner(index)">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                        </button>
                                    </div>
                                    <div v-if="totalPartnerPercentage !== 100 && partners.some(p => p.name.trim())" class="pct-warning-bar">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                        Toplam pay: %{{ totalPartnerPercentage }} (100% olmali)
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Error -->
                        <div v-if="formError || geoStore.error" class="error-banner">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            {{ formError || geoStore.error }}
                        </div>

                        <!-- Submit -->
                        <div class="step-actions">
                            <button type="button" class="btn-cancel" @click="goBack">Iptal</button>
                            <button type="submit" class="btn-submit" :disabled="!isFormValid || isSubmitting">
                                <span v-if="isSubmitting" class="spinner"></span>
                                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                {{ isSubmitting ? 'Kaydediliyor...' : 'Tarla Ekle' }}
                            </button>
                        </div>
                    </div>

                </Transition>
            </form>
        </div>
    </TeaBusinessLayout>
</template>

<style scoped>
.create-field-page {
    max-width: 720px;
    margin: 0 auto;
    padding: var(--space-4) var(--space-4) var(--space-8);
}

/* ── Header ── */
.page-header {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
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

/* ── Progress ── */
.progress-track {
    height: 4px;
    background: var(--color-bg-tertiary);
    border-radius: 2px;
    margin-bottom: var(--space-5);
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: var(--color-primary);
    border-radius: 2px;
    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ── Map ── */
.map-section {
    margin-bottom: var(--space-4);
    position: sticky;
    top: 64px;
    z-index: 10;
}

.map-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.map-container {
    height: 280px;
    width: 100%;
    background: var(--color-bg-primary);
}

.map-status { border-top: 1px solid var(--color-border); }
.map-status-item { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); }
.map-status-loading { color: var(--color-warning); background: rgba(245, 158, 11, 0.06); }
.map-status-selected { color: var(--color-text-primary); background: rgba(16, 185, 129, 0.06); }
.map-status-hint { color: var(--color-info); background: rgba(59, 130, 246, 0.06); }
.map-status-default { color: var(--color-text-muted); }
.map-status-text { flex: 1; min-width: 0; }
.map-status-title { display: block; font-weight: var(--font-weight-medium); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.map-status-meta { font-size: var(--font-size-xs); color: var(--color-text-muted); }
.area-chip { background: var(--color-primary); color: white; padding: 2px 10px; border-radius: var(--radius-full); font-size: 11px; font-weight: var(--font-weight-semibold); white-space: nowrap; flex-shrink: 0; }

/* ── Breadcrumb ── */
.breadcrumb {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
}

.breadcrumb-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: all var(--transition-fast);
    color: var(--color-text-secondary);
}

.breadcrumb-item:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
    color: var(--color-primary);
}

.breadcrumb-item svg {
    color: var(--color-primary);
    flex-shrink: 0;
}

.breadcrumb-label {
    color: var(--color-text-muted);
    font-weight: var(--font-weight-medium);
}

.breadcrumb-value {
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.breadcrumb-item:hover .breadcrumb-value {
    color: var(--color-primary);
}

/* ── Step Card ── */
.form-flow {
    min-height: 200px;
}

.step-card {
    padding: var(--space-6);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
}

.step-card-final {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary), 0 4px 20px rgba(16, 185, 129, 0.1);
}

.step-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
}

.btn-step-back {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: all var(--transition-fast);
}

.btn-step-back:hover {
    color: var(--color-text-primary);
    border-color: var(--color-text-muted);
    background: var(--color-bg-secondary);
}

.step-badge {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-full);
    background: var(--color-primary-light);
    color: var(--color-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: var(--font-weight-bold);
    flex-shrink: 0;
    border: 2px solid var(--color-primary);
}

.step-badge.done {
    background: var(--color-primary);
    color: white;
}

.step-title {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    margin-bottom: 1px;
}

.step-hint {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
}

.required { color: var(--color-danger); }

/* ── Wizard Transition ── */
.wizard-enter-active {
    animation: wizardIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.wizard-leave-active {
    animation: wizardOut 0.2s ease-in forwards;
}

@keyframes wizardIn {
    from { opacity: 0; transform: translateX(30px); }
    to { opacity: 1; transform: translateX(0); }
}

@keyframes wizardOut {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(-20px); }
}

/* ── Step Actions ── */
.step-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--space-5);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
}

.btn-next {
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

.btn-next:hover:not(:disabled) {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
}

.btn-next:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-skip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.btn-skip:hover {
    border-color: var(--color-text-muted);
    color: var(--color-text-primary);
}

/* ── Form Elements ── */
.form-input, .form-textarea {
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

.form-input::placeholder, .form-textarea::placeholder { color: var(--color-text-muted); }
.form-input:focus, .form-textarea:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-light); }
.form-textarea { resize: vertical; min-height: 80px; }

.loading-text {
    display: flex; align-items: center; gap: var(--space-1);
    font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-1);
}

.area-inline {
    display: flex; align-items: center; gap: var(--space-2);
    margin-top: var(--space-3); padding: var(--space-3) var(--space-4);
    background: rgba(16, 185, 129, 0.08); border-radius: var(--radius-md);
    font-size: var(--font-size-sm); color: var(--color-primary);
}
.area-inline strong { font-weight: var(--font-weight-bold); }

/* ── Details ── */
.detail-group { margin-bottom: var(--space-4); }
.detail-label { display: flex; align-items: center; gap: var(--space-2); font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); color: var(--color-text-secondary); margin-bottom: var(--space-2); }
.detail-label-text { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }

/* ── Partners ── */
.partners-toggle { display: flex; align-items: center; justify-content: space-between; width: 100%; background: var(--color-bg-tertiary); border: 1px solid var(--color-border); cursor: pointer; padding: var(--space-3) var(--space-4); color: inherit; border-radius: var(--radius-md); transition: all var(--transition-fast); }
.partners-toggle:hover { border-color: var(--color-text-muted); }
.partners-toggle-left { display: flex; align-items: center; gap: var(--space-2); }
.partner-badge { background: var(--color-primary); color: white; width: 20px; height: 20px; border-radius: var(--radius-full); font-size: 11px; font-weight: var(--font-weight-semibold); display: flex; align-items: center; justify-content: center; }
.chevron { color: var(--color-text-muted); transition: transform var(--transition-normal); }
.chevron.open { transform: rotate(180deg); }
.partners-body { max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; }
.partners-body.open { max-height: 600px; }
.partners-content { padding-top: var(--space-4); }

.btn-add-partner { display: inline-flex; align-items: center; gap: var(--space-2); background: transparent; border: 1.5px dashed var(--color-primary); color: var(--color-primary); padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); cursor: pointer; transition: all var(--transition-fast); margin-bottom: var(--space-4); }
.btn-add-partner:hover { background: var(--color-primary-light); border-style: solid; }

.partner-row { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); }
.partner-name-input { flex: 1; min-width: 0; }
.pct-input-wrap { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.pct-input { width: 64px; text-align: center; padding: var(--space-2) var(--space-2) !important; min-height: 40px !important; }
.pct-symbol { color: var(--color-text-muted); font-size: var(--font-size-sm); }
.radio-label { display: flex; align-items: center; gap: 4px; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
.radio-label input[type="radio"] { accent-color: var(--color-primary); width: 14px; height: 14px; }
.radio-text { font-size: var(--font-size-xs); color: var(--color-text-muted); }
.btn-remove { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: rgba(239, 68, 68, 0.1); border: none; border-radius: var(--radius-md); color: var(--color-danger); cursor: pointer; flex-shrink: 0; transition: all var(--transition-fast); }
.btn-remove:hover { background: rgba(239, 68, 68, 0.2); }
.pct-warning-bar { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: rgba(245, 158, 11, 0.1); border-radius: var(--radius-md); color: var(--color-warning); font-size: var(--font-size-xs); font-weight: var(--font-weight-medium); }

/* ── Error ── */
.error-banner { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: var(--radius-md); color: var(--color-danger); font-size: var(--font-size-sm); margin-bottom: var(--space-4); }

/* ── Submit ── */
.btn-cancel { padding: var(--space-3) var(--space-6); background: var(--color-bg-tertiary); border: 1px solid var(--color-border); border-radius: var(--radius-lg); color: var(--color-text-secondary); font-weight: var(--font-weight-medium); font-size: var(--font-size-sm); cursor: pointer; transition: all var(--transition-fast); }
.btn-cancel:hover { background: var(--color-bg-secondary); color: var(--color-text-primary); border-color: var(--color-text-muted); }
.btn-submit { display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-6); background: var(--color-primary); border: none; border-radius: var(--radius-lg); color: white; font-weight: var(--font-weight-semibold); font-size: var(--font-size-sm); cursor: pointer; transition: all var(--transition-fast); }
.btn-submit:hover:not(:disabled) { background: var(--color-primary-hover); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35); }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Spinner ── */
.spinner { width: 16px; height: 16px; border: 2px solid rgba(255, 255, 255, 0.3); border-top-color: currentColor; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
.spinner-tiny { display: inline-block; width: 10px; height: 10px; border: 1.5px solid var(--color-border); border-top-color: var(--color-text-muted); border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Responsive ── */
@media (max-width: 768px) {
    .create-field-page { padding: var(--space-3); }
    .page-header { flex-direction: column; align-items: flex-start; }
    .map-container { height: 200px; }
    .map-section { position: static; }
    .step-card { padding: var(--space-4); }
    .partner-row { flex-wrap: wrap; }
    .partner-name-input { flex: 1 1 100%; }
    .breadcrumb { gap: var(--space-1); }
    .breadcrumb-item { padding: 4px 8px; font-size: 11px; }
    .breadcrumb-value { max-width: 80px; }
}
</style>
