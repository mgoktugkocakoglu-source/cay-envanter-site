<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { AcceptableValue } from 'reka-ui';
import {
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleAlert,
    Info,
    Landmark,
    Map,
    MapPin,
    NotebookPen,
    Plus,
    Square,
    TriangleAlert,
    Users,
    X,
} from '@lucide/vue';
import { useGeoStore } from '@/stores/geoStore';
import { useFieldsStore } from '@/stores/fieldsStore';
import { api } from '@/services/api';
import type { GeoParcelDetail, Field } from '@/services/api';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import { PageContainer, PageHeader, Spinner } from '@/components/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const router = useRouter();
const route = useRoute();
const geoStore = useGeoStore();
const fieldsStore = useFieldsStore();

// Form state
const fieldName = ref('');
const fieldArea = ref<number | null>(null);
const fieldAreaUnit = ref<Field['areaUnit']>('m2');
const notes = ref('');
const partners = ref<Array<{ firstName: string; lastName: string; identityNumber: string; sharePercentage: number | null }>>([
    { firstName: '', lastName: '', identityNumber: '', sharePercentage: null }
]);
const isSubmitting = ref(false);
const formError = ref<string | null>(null);
const isPartnersOpen = ref(false);
const editFieldId = computed(() => typeof route.params.id === 'string' ? route.params.id : '');
const isEditMode = computed(() => route.name === 'tea-fields-edit' && !!editFieldId.value);

// Map state
const mapContainer = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
let currentLayer: L.GeoJSON | null = null;
let roadLayers: L.GeoJSON | null = null;
let clickedParcelLayer: L.GeoJSON | null = null;

const clickedParcel = ref<GeoParcelDetail | null>(null);
const isLoadingParcel = ref(false);

const TURKEY_CENTER: L.LatLngExpression = [39.0, 35.0];
const TURKEY_ZOOM = 6;
const MAP_MIN_ZOOM = 6;
const MAP_MAX_ZOOM = 20;
const TILE_MAX_NATIVE_ZOOM = 20;
const SELECTED_PARCEL_FIT_OPTIONS: L.FitBoundsOptions = {
    padding: [16, 16],
    maxZoom: MAP_MAX_ZOOM,
    animate: true,
};

// Theme-aware color helper for Leaflet
function getCssVar(name: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

// ═══════ WIZARD STEP MANAGEMENT ═══════
// activeStep is manually controlled - only changes via user action or goToStep
const activeStep = ref(1);
const TOTAL_STEPS = 6;
const STEP_NUMBERS = Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1);

// Check if a step's data is filled
function isStepComplete(s: number): boolean {
    if (isEditMode.value) {
        return fieldName.value.trim() !== '' && !!fieldArea.value && fieldArea.value > 0;
    }
    switch (s) {
        case 1: return fieldName.value.trim() !== '';
        case 2: return !!geoStore.selectedProvinceId;
        case 3: return !!geoStore.selectedDistrictId;
        case 4: return !!geoStore.selectedNeighborhoodId;
        case 5: return !!clickedParcel.value;
        case 6: return true;
        default: return false;
    }
}

// Label for each step
function stepLabel(s: number): string {
    switch (s) {
        case 1: return 'Tarla Adı';
        case 2: return 'İl';
        case 3: return 'İlçe';
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
            geoStore.selectRoad(null);
            geoStore.selectParcel(null);
            clickedParcel.value = null;
            clearClickedParcelLayer();
        } else if (s <= 3) {
            // Going back to district — clear neighborhood, parcel
            geoStore.selectNeighborhood(null);
            geoStore.selectRoad(null);
            geoStore.selectParcel(null);
            clickedParcel.value = null;
            clearClickedParcelLayer();
        } else if (s <= 4) {
            // Going back to neighborhood — clear parcel
            geoStore.selectRoad(null);
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
    return 0;
});

const isFormValid = computed(() => {
    if (isEditMode.value) {
        return fieldName.value.trim() !== '' && !!fieldArea.value && fieldArea.value > 0;
    }
    return fieldName.value.trim() !== '' &&
        geoStore.selectedProvinceId &&
        geoStore.selectedDistrictId &&
        geoStore.selectedNeighborhoodId;
});

// Steps completed before active step (for breadcrumb)
const completedSteps = computed(() => {
    const steps: number[] = [];
    for (let i = 1; i < activeStep.value; i++) {
        steps.push(i);
    }
    return steps;
});

const progressValue = computed(() => (activeStep.value / TOTAL_STEPS) * 100);
const filledPartnerCount = computed(() => partners.value.filter(hasPartnerValue).length);

function isAllowedProvince(provinceName: string) {
    return provinceName.trim().toLocaleLowerCase('tr-TR') !== 'ordu';
}

const provinceOptions = computed(() =>
    geoStore.provinces
        .filter((province) => isAllowedProvince(province.name))
        .map((province) => ({ value: province.id.toString(), label: province.name }))
);

// ═══════ MAP ═══════
onMounted(async () => {
    if (mapContainer.value) {
        map = L.map(mapContainer.value, {
            zoomControl: false,
            attributionControl: false,
            minZoom: MAP_MIN_ZOOM,
            maxZoom: MAP_MAX_ZOOM,
        }).setView(TURKEY_CENTER, TURKEY_ZOOM);

        L.control.zoom({ position: 'topright' }).addTo(map);

        // Google Satellite — sharper than Esri in rural Turkey, free, no API key.
        L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            minZoom: MAP_MIN_ZOOM,
            maxZoom: MAP_MAX_ZOOM,
            maxNativeZoom: TILE_MAX_NATIVE_ZOOM,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        }).addTo(map);

        map.on('click', handleMapClick);
    }

    await geoStore.fetchProvinces();

    if (isEditMode.value) {
        await fieldsStore.fetchField(editFieldId.value);
        const field = fieldsStore.currentField;
        if (field) {
            fieldName.value = field.name;
            fieldArea.value = field.area;
            fieldAreaUnit.value = field.areaUnit;
            notes.value = field.notes || '';
            activeStep.value = 6;
        } else {
            formError.value = fieldsStore.error || 'Tarla bilgisi bulunamadı';
        }
    }
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

watch(() => geoStore.roads, (roads) => {
    if (map && roads.length > 0) {
        displayRoads(roads);
    }
});

watch(() => geoStore.selectedRoadId, () => {
    refreshRoadStyles();
    fitSelectedRoad();
});

watch(activeStep, async () => {
    await nextTick();
    requestAnimationFrame(() => {
        map?.invalidateSize();
        if (activeStep.value === 5) {
            fitSelectedRoad();
            if (clickedParcelLayer) {
                fitLayerBounds(clickedParcelLayer);
            }
        }
    });
});

function fitLayerBounds(layer: L.FeatureGroup | L.GeoJSON, options: L.FitBoundsOptions = SELECTED_PARCEL_FIT_OPTIONS) {
    if (!map) return;

    requestAnimationFrame(() => {
        if (!map) return;
        map.invalidateSize();
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
            map.fitBounds(bounds, options);
        }
    });
}

function zoomToBounds(coordinates: number[][][]) {
    if (!map) return;
    if (currentLayer) map.removeLayer(currentLayer);

    const geoJson: GeoJSON.Feature = {
        type: 'Feature', properties: {},
        geometry: { type: 'Polygon', coordinates }
    };

    const primary = getCssVar('--primary', '#10b981');
    currentLayer = L.geoJSON(geoJson, {
        style: { color: primary, weight: 2, fillOpacity: 0.08, fillColor: primary }
    }).addTo(map);

    fitLayerBounds(currentLayer, { padding: [24, 24], maxZoom: 15, animate: true });
}

function displayRoads(roads: typeof geoStore.roads) {
    if (!map) return;
    if (roadLayers) map.removeLayer(roadLayers);

    const features: GeoJSON.Feature[] = roads.map(road => ({
        type: 'Feature',
        properties: { id: road.id, name: road.name },
        geometry: { type: 'MultiLineString', coordinates: road.geometry }
    }));

    const primaryColor = getCssVar('--primary', '#10b981');
    const mutedColor = getCssVar('--muted-foreground', '#64748b');
    const collection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };
    roadLayers = L.geoJSON(collection, {
        style: (feature) => ({
            color: feature?.properties?.id === geoStore.selectedRoadId ? primaryColor : mutedColor,
            weight: feature?.properties?.id === geoStore.selectedRoadId ? 5 : 2,
            opacity: feature?.properties?.id === geoStore.selectedRoadId ? 0.95 : 0.55,
            dashArray: feature?.properties?.id === geoStore.selectedRoadId ? '8 6' : undefined,
        }),
        onEachFeature: (feature, layer) => {
            layer.on('click', () => {
                geoStore.selectRoad(feature.properties?.id || null);
            });
            layer.bindTooltip(`Yol: ${feature.properties?.name || 'N/A'}`, { className: 'dark-tooltip' });
        }
    }).addTo(map);

    fitSelectedRoad();
}

function refreshRoadStyles() {
    if (!roadLayers) return;

    const primaryColor = getCssVar('--primary', '#10b981');
    const mutedColor = getCssVar('--muted-foreground', '#64748b');
    roadLayers.setStyle((feature) => ({
        color: feature?.properties?.id === geoStore.selectedRoadId ? primaryColor : mutedColor,
        weight: feature?.properties?.id === geoStore.selectedRoadId ? 5 : 2,
        opacity: feature?.properties?.id === geoStore.selectedRoadId ? 0.95 : 0.55,
        dashArray: feature?.properties?.id === geoStore.selectedRoadId ? '8 6' : undefined,
    }));
}

function fitSelectedRoad() {
    if (!roadLayers || !geoStore.selectedRoadId) return;

    roadLayers.eachLayer((layer) => {
        const feature = (layer as L.GeoJSON).feature as GeoJSON.Feature | undefined;
        if (feature?.properties?.id === geoStore.selectedRoadId) {
            fitLayerBounds(layer as L.FeatureGroup);
        }
    });
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

watch(() => geoStore.provinces, () => {
    const selectedProvince = geoStore.selectedProvince;
    if (selectedProvince && !isAllowedProvince(selectedProvince.name)) {
        geoStore.selectProvince(null);
    }
}, { deep: true });

function displayClickedParcel(parcel: GeoParcelDetail) {
    if (!map) return;
    clearClickedParcelLayer();

    const parcelFeature: GeoJSON.Feature = {
        type: 'Feature',
        properties: { parselNo: parcel.properties.parselNo, alan: parcel.properties.alan, ozet: parcel.properties.ozet },
        geometry: { type: 'Polygon', coordinates: parcel.polygon }
    };
    clickedParcelLayer = L.geoJSON(parcelFeature, {
        style: { color: getCssVar('--warning', '#f59e0b'), weight: 3, fillOpacity: 0.2, fillColor: getCssVar('--warning', '#f59e0b'), dashArray: '6 4' }
    }).addTo(map);

    clickedParcelLayer.bindPopup(`
        <div style="font-family: Inter, sans-serif; font-size: 13px; line-height: 1.5;">
            <strong>${parcel.properties.ozet}</strong><br>
            <span style="color: var(--muted-foreground);">Alan:</span> ${parcel.properties.alan} m&sup2;<br>
            <span style="color: var(--muted-foreground);">Nitelik:</span> ${parcel.properties.nitelik}
        </div>
    `).openPopup();

    fitLayerBounds(clickedParcelLayer);
}

function clearClickedParcelLayer() {
    if (clickedParcelLayer && map) {
        map.removeLayer(clickedParcelLayer);
        clickedParcelLayer = null;
    }
}

// ═══════ FORM HANDLERS ═══════
/** Sentinel for the optional road select — reka-ui Select cannot represent "none" with ''. */
const NO_ROAD = 'none';
type SelectValue = AcceptableValue | AcceptableValue[] | undefined;

/** Normalises a reka-ui Select payload to a store id (`null` for empty / sentinel). */
function toSelectId(value: SelectValue): string | null {
    const v = Array.isArray(value) ? value[0] : value;
    if (typeof v === 'string') return v && v !== NO_ROAD ? v : null;
    if (typeof v === 'number' || typeof v === 'bigint') return String(v);
    return null;
}

function handleProvinceChange(value: SelectValue) {
    const v = toSelectId(value);
    geoStore.selectProvince(v);
    if (v) nextStep();
}

function handleDistrictChange(value: SelectValue) {
    const v = toSelectId(value);
    geoStore.selectDistrict(v);
    if (v) nextStep();
}

function handleNeighborhoodChange(value: SelectValue) {
    const v = toSelectId(value);
    geoStore.selectNeighborhood(v);
    if (v) nextStep();
}

function handleRoadChange(value: SelectValue) {
    geoStore.selectRoad(toSelectId(value));
    fitSelectedRoad();
}

function handleAreaUnitChange(value: SelectValue) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v === 'm2' || v === 'donum' || v === 'dekar') {
        fieldAreaUnit.value = v;
    }
}

/** Parses a numeric Input payload; empty or non-numeric input becomes `null`. */
function toNumberOrNull(value: string | number): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}

function addPartner() {
    partners.value.push({ firstName: '', lastName: '', identityNumber: '', sharePercentage: null });
}

function removePartner(index: number) {
    if (partners.value.length > 1) {
        partners.value.splice(index, 1);
    }
}

function hasPartnerValue(partner: { firstName: string; lastName: string; identityNumber: string; sharePercentage: number | null }) {
    return !!(
        partner.firstName.trim() ||
        partner.lastName.trim() ||
        partner.identityNumber.trim() ||
        partner.sharePercentage
    );
}

async function handleSubmit() {
    if (!isFormValid.value) return;

    if (isEditMode.value) {
        isSubmitting.value = true;
        formError.value = null;
        try {
            const result = await fieldsStore.updateField(editFieldId.value, {
                name: fieldName.value.trim(),
                area: fieldArea.value || undefined,
                areaUnit: fieldAreaUnit.value,
                notes: notes.value.trim() || null,
            });

            if (result) {
                router.push('/tea/fields');
            } else {
                formError.value = fieldsStore.error || 'Tarla güncellenemedi';
            }
        } catch {
            formError.value = 'Bir hata oluştu';
        } finally {
            isSubmitting.value = false;
        }
        return;
    }

    const filledPartners = partners.value.filter(hasPartnerValue);
    const invalidPartner = filledPartners.some((partner) =>
        !partner.firstName.trim() ||
        !partner.lastName.trim() ||
        !/^[0-9]{11}$/.test(partner.identityNumber.trim()) ||
        !partner.sharePercentage ||
        partner.sharePercentage <= 0 ||
        partner.sharePercentage > 100,
    );

    if (invalidPartner) {
        formError.value = 'Ortak için ad, soyad, 11 haneli TC No ve 1-100 arası ortaklık yüzdesi gereklidir';
        return;
    }

    const totalShare = filledPartners.reduce((sum, partner) => sum + (partner.sharePercentage || 0), 0);
    if (totalShare > 100) {
        formError.value = 'Ortaklık yüzdelerinin toplamı 100 değerini aşamaz';
        return;
    }

    isSubmitting.value = true;
    formError.value = null;

    try {
        const parcelCoordinates = clickedParcel.value?.polygon || geoStore.selectedNeighborhood?.bounds || [];
        const parcelNo = clickedParcel.value?.properties.parselNo || null;

        const fieldData: Omit<Partial<Field>, 'partners'> & { partners?: Array<{ partnerName: string; partnerPhone: string | null; partnerIdentityNumber: string | null; sharePercentage: number; isPrimaryOwner: boolean }> } = {
            name: fieldName.value.trim(),
            province: clickedParcel.value?.properties.ilAd || geoStore.selectedProvince?.name || '',
            district: clickedParcel.value?.properties.ilceAd || geoStore.selectedDistrict?.name || '',
            neighborhood: clickedParcel.value?.properties.mahalleAd || geoStore.selectedNeighborhood?.name || '',
            road: geoStore.selectedRoad?.name || null,
            parcelNo, coordinates: parcelCoordinates, area: selectedArea.value, areaUnit: 'm2' as const,
            notes: notes.value.trim() || null,
            partners: filledPartners.map(p => ({
                partnerName: `${p.firstName.trim()} ${p.lastName.trim()}`,
                partnerPhone: null,
                partnerIdentityNumber: p.identityNumber.trim() || null,
                sharePercentage: p.sharePercentage || 0,
                isPrimaryOwner: false,
            }))
        };

        const result = await fieldsStore.createField(fieldData as Parameters<typeof fieldsStore.createField>[0]);
        if (result) {
            router.push('/tea/fields');
        } else {
            formError.value = fieldsStore.error || 'Tarla oluşturulamadı';
        }
    } catch {
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
    <TeaBusinessLayout>
        <PageContainer size="narrow">
            <PageHeader
                back-to="/tea/fields"
                :title="isEditMode ? 'Araziyi Düzenle' : 'Yeni Arazi'"
                :description="isEditMode ? 'Tarla bilgilerini güncelleyin' : `Adım ${activeStep} / ${TOTAL_STEPS}`"
            />

            <!-- Step indicator -->
            <div v-if="!isEditMode" class="space-y-2">
                <Progress :model-value="progressValue" :aria-label="`Adım ${activeStep} / ${TOTAL_STEPS}`" />
                <ol class="flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-label="Adımlar">
                    <li
                        v-for="s in STEP_NUMBERS"
                        :key="s"
                        class="flex items-center gap-1"
                        :class="s === activeStep ? 'font-semibold text-foreground' : 'text-muted-foreground'"
                        :aria-current="s === activeStep ? 'step' : undefined"
                    >
                        <Check v-if="s < activeStep" class="size-3 text-primary" aria-hidden="true" />
                        <span v-else class="tabular-nums">{{ s }}.</span>
                        {{ stepLabel(s) }}
                    </li>
                </ol>
            </div>

            <!-- Map (always visible while creating) -->
            <Card v-if="!isEditMode" class="gap-0 overflow-hidden py-0">
                <div ref="mapContainer" class="h-72 w-full bg-muted md:h-96"></div>
                <div class="flex items-center gap-3 border-t px-4 py-3 text-sm" aria-live="polite">
                    <template v-if="isLoadingParcel">
                        <Spinner class="shrink-0 text-warning" />
                        <span class="text-muted-foreground">Parsel bilgisi yükleniyor...</span>
                    </template>
                    <template v-else-if="clickedParcel">
                        <MapPin class="size-4 shrink-0 text-primary" aria-hidden="true" />
                        <div class="min-w-0 flex-1">
                            <span class="block truncate font-medium text-foreground">{{ clickedParcel.properties.ozet }}</span>
                            <span class="block text-xs text-muted-foreground">{{ clickedParcel.properties.alan }} m&sup2; &middot; {{ clickedParcel.properties.nitelik }}</span>
                        </div>
                        <Badge class="tabular-nums">{{ clickedParcel.properties.alan }} m&sup2;</Badge>
                    </template>
                    <template v-else-if="geoStore.selectedRoad">
                        <MapPin class="size-4 shrink-0 text-primary" aria-hidden="true" />
                        <span class="min-w-0 flex-1 truncate font-medium text-foreground">Yol: {{ geoStore.selectedRoad.name }}</span>
                    </template>
                    <template v-else-if="geoStore.selectedNeighborhoodId">
                        <Info class="size-4 shrink-0 text-info" aria-hidden="true" />
                        <span class="text-muted-foreground">Yol seçip haritaya tıklayarak parsel seçebilirsiniz</span>
                    </template>
                    <template v-else>
                        <Map class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span class="text-muted-foreground">Konum secimi icin adimlari takip edin</span>
                    </template>
                </div>
            </Card>

            <!-- Completed steps (clickable to go back) -->
            <div v-if="completedSteps.length > 0 && !isEditMode" class="flex flex-wrap gap-2" aria-label="Tamamlanan adımlar">
                <Button
                    v-for="s in completedSteps"
                    :key="s"
                    type="button"
                    variant="outline"
                    size="sm"
                    class="h-11 max-w-full rounded-full md:h-8"
                    @click="goToStep(s)"
                >
                    <Check class="text-primary" aria-hidden="true" />
                    <span class="text-muted-foreground">{{ stepLabel(s) }}:</span>
                    <span class="max-w-32 truncate font-semibold text-foreground">{{ stepValue(s) }}</span>
                </Button>
            </div>

            <form class="flex flex-col gap-6" @submit.prevent="handleSubmit">
                <!-- Step 1: Field Name -->
                <Card v-if="activeStep === 1" key="step1">
                    <CardHeader>
                        <CardTitle>Tarla Adı <span class="text-destructive" aria-hidden="true">*</span></CardTitle>
                        <CardDescription>Tarlanıza kolay hatırlanacak bir isim verin</CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-2">
                        <Label for="fieldName" class="sr-only">Tarla adı</Label>
                        <Input
                            id="fieldName"
                            v-model="fieldName"
                            type="text"
                            class="h-11 md:h-9"
                            placeholder="Örn: Üst Bahçe"
                            autofocus
                            required
                            @keyup.enter="nextStep"
                        />
                    </CardContent>
                    <CardFooter class="justify-end border-t">
                        <Button type="button" class="h-11 md:h-9" :disabled="!isStepComplete(1)" @click="nextStep">
                            Devam
                            <ChevronRight aria-hidden="true" />
                        </Button>
                    </CardFooter>
                </Card>

                <!-- Step 2: Province -->
                <Card v-else-if="activeStep === 2" key="step2">
                    <CardHeader>
                        <CardTitle>İl Seçin <span class="text-destructive" aria-hidden="true">*</span></CardTitle>
                        <CardDescription>Tarlanızın bulunduğu ili seçin</CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-2">
                        <Label for="province-select">İl</Label>
                        <Select
                            :model-value="geoStore.selectedProvinceId ?? undefined"
                            :disabled="geoStore.isLoadingProvinces"
                            required
                            @update:model-value="handleProvinceChange"
                        >
                            <SelectTrigger id="province-select" class="w-full">
                                <SelectValue placeholder="İl Seçin" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="option in provinceOptions" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <p v-if="geoStore.isLoadingProvinces" class="flex items-center gap-1 text-xs text-muted-foreground">
                            <Spinner class="size-3" /> Yükleniyor...
                        </p>
                    </CardContent>
                    <CardFooter class="justify-between border-t">
                        <Button v-if="!isEditMode" type="button" variant="ghost" class="h-11 md:h-9" @click="prevStep">
                            <ChevronLeft aria-hidden="true" />
                            Geri
                        </Button>
                    </CardFooter>
                </Card>

                <!-- Step 3: District -->
                <Card v-else-if="activeStep === 3" key="step3">
                    <CardHeader>
                        <CardTitle>İlçe Seçin <span class="text-destructive" aria-hidden="true">*</span></CardTitle>
                        <CardDescription>Tarlanızın bulunduğu ilçeyi seçin</CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-2">
                        <Label for="district-select">İlçe</Label>
                        <Select
                            :model-value="geoStore.selectedDistrictId ?? undefined"
                            :disabled="!geoStore.selectedProvinceId || geoStore.isLoadingDistricts"
                            required
                            @update:model-value="handleDistrictChange"
                        >
                            <SelectTrigger id="district-select" class="w-full">
                                <SelectValue placeholder="İlçe Seçin" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="d in geoStore.districts" :key="d.id" :value="d.id.toString()">{{ d.name }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <p v-if="geoStore.isLoadingDistricts" class="flex items-center gap-1 text-xs text-muted-foreground">
                            <Spinner class="size-3" /> Yükleniyor...
                        </p>
                    </CardContent>
                    <CardFooter class="justify-between border-t">
                        <Button type="button" variant="ghost" class="h-11 md:h-9" @click="prevStep">
                            <ChevronLeft aria-hidden="true" />
                            Geri
                        </Button>
                    </CardFooter>
                </Card>

                <!-- Step 4: Neighborhood -->
                <Card v-else-if="activeStep === 4" key="step4">
                    <CardHeader>
                        <CardTitle>Mahalle Seçin <span class="text-destructive" aria-hidden="true">*</span></CardTitle>
                        <CardDescription>Tarlanızın bulunduğu mahalleyi seçin</CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-2">
                        <Label for="neighborhood-select">Mahalle</Label>
                        <Select
                            :model-value="geoStore.selectedNeighborhoodId ?? undefined"
                            :disabled="!geoStore.selectedDistrictId || geoStore.isLoadingNeighborhoods"
                            required
                            @update:model-value="handleNeighborhoodChange"
                        >
                            <SelectTrigger id="neighborhood-select" class="w-full">
                                <SelectValue placeholder="Mahalle Seçin" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="n in geoStore.neighborhoods" :key="n.id" :value="n.id.toString()">{{ n.name }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <p v-if="geoStore.isLoadingNeighborhoods" class="flex items-center gap-1 text-xs text-muted-foreground">
                            <Spinner class="size-3" /> Yükleniyor...
                        </p>
                    </CardContent>
                    <CardFooter class="justify-between border-t">
                        <Button type="button" variant="ghost" class="h-11 md:h-9" @click="prevStep">
                            <ChevronLeft aria-hidden="true" />
                            Geri
                        </Button>
                    </CardFooter>
                </Card>

                <!-- Step 5: Parcel -->
                <Card v-else-if="activeStep === 5" key="step5">
                    <CardHeader>
                        <CardTitle>Parsel Seçin</CardTitle>
                        <CardDescription>Önce yolu seçin, sonra haritada parselin üzerine tıklayın</CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-4">
                        <div class="space-y-2">
                            <Label for="road-select">Yol</Label>
                            <Select
                                :model-value="geoStore.selectedRoadId ?? NO_ROAD"
                                :disabled="!geoStore.selectedNeighborhoodId || geoStore.isLoadingRoads"
                                @update:model-value="handleRoadChange"
                            >
                                <SelectTrigger id="road-select" class="w-full">
                                    <SelectValue placeholder="Yol Seçiniz" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="NO_ROAD">Yol seçilmedi</SelectItem>
                                    <SelectItem v-for="r in geoStore.roads" :key="r.id" :value="r.id.toString()">{{ r.name }}</SelectItem>
                                </SelectContent>
                            </Select>
                            <p v-if="geoStore.isLoadingRoads" class="flex items-center gap-1 text-xs text-muted-foreground">
                                <Spinner class="size-3" /> Yollar yükleniyor...
                            </p>
                        </div>

                        <p v-if="selectedArea > 0" class="flex items-center gap-2 text-sm text-muted-foreground">
                            <Square class="size-4 text-primary" aria-hidden="true" />
                            Tarla Alanı:
                            <span class="font-semibold text-foreground tabular-nums">{{ selectedArea.toLocaleString('tr-TR') }} m&sup2;</span>
                        </p>
                    </CardContent>
                    <CardFooter class="justify-between border-t">
                        <Button type="button" variant="ghost" class="h-11 md:h-9" @click="prevStep">
                            <ChevronLeft aria-hidden="true" />
                            Geri
                        </Button>
                        <Button type="button" variant="outline" class="h-11 md:h-9" @click="activeStep = 6">
                            Parselsiz Devam Et
                            <ChevronRight aria-hidden="true" />
                        </Button>
                    </CardFooter>
                </Card>

                <!-- Step 6: Details -->
                <Card v-else-if="activeStep === 6" key="step6">
                    <CardHeader>
                        <CardTitle>{{ isEditMode ? 'Tarla Bilgileri' : 'Son Adım: Detaylar' }}</CardTitle>
                        <CardDescription>{{ isEditMode ? 'Ad, alan ve not bilgilerini düzenleyin' : 'Notlarinizi ve ortak bilgilerinizi ekleyin' }}</CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-6">
                        <div v-if="isEditMode" class="grid gap-4 md:grid-cols-2">
                            <div class="space-y-2">
                                <Label for="editFieldName">
                                    <Landmark class="size-4 text-muted-foreground" aria-hidden="true" />
                                    Tarla Adı
                                </Label>
                                <Input id="editFieldName" v-model="fieldName" type="text" class="h-11 md:h-9" placeholder="Tarla adı" required />
                            </div>
                            <div class="space-y-2">
                                <Label for="editFieldArea">
                                    <Square class="size-4 text-muted-foreground" aria-hidden="true" />
                                    Alan
                                </Label>
                                <div class="grid grid-cols-[1fr_7.5rem] gap-2">
                                    <Input
                                        id="editFieldArea"
                                        :model-value="fieldArea ?? undefined"
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        class="h-11 tabular-nums md:h-9"
                                        placeholder="Alan"
                                        @update:model-value="fieldArea = toNumberOrNull($event)"
                                    />
                                    <Select :model-value="fieldAreaUnit" @update:model-value="handleAreaUnitChange">
                                        <SelectTrigger class="w-full" aria-label="Alan birimi">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="m2">m²</SelectItem>
                                            <SelectItem value="donum">dönüm</SelectItem>
                                            <SelectItem value="dekar">dekar</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <!-- Notes -->
                        <div class="space-y-2">
                            <Label for="notes">
                                <NotebookPen class="size-4 text-muted-foreground" aria-hidden="true" />
                                Notlar
                            </Label>
                            <Textarea id="notes" v-model="notes" rows="3" placeholder="Istege bagli" />
                        </div>

                        <!-- Partners -->
                        <div v-if="!isEditMode" class="space-y-4">
                            <Button
                                type="button"
                                variant="outline"
                                class="h-11 w-full justify-between md:h-9"
                                :aria-expanded="isPartnersOpen"
                                aria-controls="partners-panel"
                                @click="isPartnersOpen = !isPartnersOpen"
                            >
                                <span class="flex items-center gap-2">
                                    <Users class="text-muted-foreground" aria-hidden="true" />
                                    <span class="font-semibold">Ortaklar</span>
                                    <Badge v-if="filledPartnerCount > 0" variant="secondary">{{ filledPartnerCount }}</Badge>
                                </span>
                                <ChevronDown class="text-muted-foreground transition-transform" :class="{ 'rotate-180': isPartnersOpen }" aria-hidden="true" />
                            </Button>

                            <div v-show="isPartnersOpen" id="partners-panel" class="space-y-3">
                                <Button type="button" variant="outline" size="sm" class="h-11 border-dashed md:h-8" @click="addPartner">
                                    <Plus aria-hidden="true" />
                                    Ortak Ekle
                                </Button>

                                <Card v-for="(partner, index) in partners" :key="index" class="gap-3 py-4">
                                    <CardContent class="px-4">
                                        <div class="grid gap-2 sm:grid-cols-[1fr_1fr_8rem_5.5rem_auto] sm:items-end">
                                            <div class="space-y-1">
                                                <Label :for="`partner-first-${index}`" class="text-xs text-muted-foreground">Ad</Label>
                                                <Input :id="`partner-first-${index}`" v-model="partner.firstName" type="text" placeholder="Ad" class="h-11 md:h-9" />
                                            </div>
                                            <div class="space-y-1">
                                                <Label :for="`partner-last-${index}`" class="text-xs text-muted-foreground">Soyad</Label>
                                                <Input :id="`partner-last-${index}`" v-model="partner.lastName" type="text" placeholder="Soyad" class="h-11 md:h-9" />
                                            </div>
                                            <div class="space-y-1">
                                                <Label :for="`partner-tc-${index}`" class="text-xs text-muted-foreground">TC No</Label>
                                                <Input
                                                    :id="`partner-tc-${index}`"
                                                    v-model="partner.identityNumber"
                                                    type="text"
                                                    maxlength="11"
                                                    inputmode="numeric"
                                                    placeholder="TC No"
                                                    class="h-11 tabular-nums md:h-9"
                                                />
                                            </div>
                                            <div class="space-y-1">
                                                <Label :for="`partner-share-${index}`" class="text-xs text-muted-foreground">Pay (%)</Label>
                                                <Input
                                                    :id="`partner-share-${index}`"
                                                    :model-value="partner.sharePercentage ?? undefined"
                                                    type="number"
                                                    min="1"
                                                    max="100"
                                                    step="0.01"
                                                    placeholder="Pay"
                                                    class="h-11 tabular-nums md:h-9"
                                                    @update:model-value="partner.sharePercentage = toNumberOrNull($event)"
                                                />
                                            </div>
                                            <Button
                                                v-if="partners.length > 1"
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                class="size-11 justify-self-end text-muted-foreground hover:text-destructive md:size-9"
                                                :aria-label="`${index + 1}. ortağı kaldır`"
                                                @click="removePartner(index)"
                                            >
                                                <X aria-hidden="true" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Alert v-if="partners.some(hasPartnerValue)" variant="warning">
                                    <TriangleAlert aria-hidden="true" />
                                    <AlertDescription>TC No eşleşen kullanıcı bu araziye bağlı hasat ve ödeme kayıtlarını görebilir.</AlertDescription>
                                </Alert>
                            </div>
                        </div>

                        <!-- Error -->
                        <Alert v-if="formError || geoStore.error" variant="destructive">
                            <CircleAlert aria-hidden="true" />
                            <AlertDescription>{{ formError || geoStore.error }}</AlertDescription>
                        </Alert>
                    </CardContent>
                    <CardFooter class="flex-wrap justify-between gap-2 border-t">
                        <div class="flex items-center gap-2">
                            <Button v-if="!isEditMode" type="button" variant="ghost" class="h-11 md:h-9" @click="prevStep">
                                <ChevronLeft aria-hidden="true" />
                                Geri
                            </Button>
                            <Button type="button" variant="outline" class="h-11 md:h-9" @click="goBack">İptal</Button>
                        </div>
                        <Button type="submit" class="h-11 md:h-9" :disabled="!isFormValid || isSubmitting">
                            <Spinner v-if="isSubmitting" />
                            <Check v-else aria-hidden="true" />
                            {{ isSubmitting ? 'Kaydediliyor...' : (isEditMode ? 'Değişiklikleri Kaydet' : 'Tarla Ekle') }}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </PageContainer>
    </TeaBusinessLayout>
</template>
