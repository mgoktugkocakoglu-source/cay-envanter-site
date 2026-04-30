import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api, type GeoProvince, type GeoDistrict, type GeoNeighborhood, type GeoRoad, type GeoParcel } from '@/services/api';

export const useGeoStore = defineStore('geo', () => {
    const provinces = ref<GeoProvince[]>([]);
    const districts = ref<GeoDistrict[]>([]);
    const neighborhoods = ref<GeoNeighborhood[]>([]);
    const roads = ref<GeoRoad[]>([]);
    const parcels = ref<GeoParcel[]>([]);

    const selectedProvinceId = ref<string | null>(null);
    const selectedDistrictId = ref<string | null>(null);
    const selectedNeighborhoodId = ref<string | null>(null);
    const selectedRoadId = ref<string | null>(null);
    const selectedParcelId = ref<string | null>(null);

    const isLoadingProvinces = ref(false);
    const isLoadingDistricts = ref(false);
    const isLoadingNeighborhoods = ref(false);
    const isLoadingRoads = ref(false);
    const isLoadingParcels = ref(false);
    const error = ref<string | null>(null);

    const selectedProvince = computed(() =>
        provinces.value.find(p => p.id === selectedProvinceId.value) || null
    );

    const selectedDistrict = computed(() =>
        districts.value.find(d => d.id === selectedDistrictId.value) || null
    );

    const selectedNeighborhood = computed(() =>
        neighborhoods.value.find(n => n.id === selectedNeighborhoodId.value) || null
    );

    const selectedRoad = computed(() =>
        roads.value.find(r => r.id === selectedRoadId.value) || null
    );

    const selectedParcel = computed(() =>
        parcels.value.find(p => p.id === selectedParcelId.value) || null
    );

    async function fetchProvinces() {
        if (provinces.value.length > 0) return;

        isLoadingProvinces.value = true;
        error.value = null;
        try {
            const response = await api.getProvinces();
            if (response.data) {
                provinces.value = response.data;
            } else if (response.error) {
                error.value = response.error.message;
            }
        } catch (e) {
            error.value = 'Failed to fetch provinces';
        } finally {
            isLoadingProvinces.value = false;
        }
    }

    async function fetchDistricts(provinceId: string) {
        isLoadingDistricts.value = true;
        error.value = null;
        districts.value = [];
        neighborhoods.value = [];
        roads.value = [];
        parcels.value = [];
        selectedDistrictId.value = null;
        selectedNeighborhoodId.value = null;
        selectedRoadId.value = null;
        selectedParcelId.value = null;

        try {
            const response = await api.getDistricts(provinceId);
            if (response.data) {
                districts.value = response.data;
            } else if (response.error) {
                error.value = response.error.message;
            }
        } catch (e) {
            error.value = 'Failed to fetch districts';
        } finally {
            isLoadingDistricts.value = false;
        }
    }

    async function fetchNeighborhoods(districtId: string) {
        isLoadingNeighborhoods.value = true;
        error.value = null;
        neighborhoods.value = [];
        roads.value = [];
        parcels.value = [];
        selectedNeighborhoodId.value = null;
        selectedRoadId.value = null;
        selectedParcelId.value = null;

        try {
            const response = await api.getNeighborhoods(districtId);
            if (response.data) {
                neighborhoods.value = response.data;
            } else if (response.error) {
                error.value = response.error.message;
            }
        } catch (e) {
            error.value = 'Failed to fetch neighborhoods';
        } finally {
            isLoadingNeighborhoods.value = false;
        }
    }

    async function fetchParcels(neighborhoodId: string) {
        isLoadingParcels.value = true;
        error.value = null;
        parcels.value = [];
        selectedParcelId.value = null;

        try {
            const response = await api.getParcels(neighborhoodId);
            if (response.data) {
                parcels.value = response.data;
            } else if (response.error) {
                error.value = response.error.message;
            }
        } catch (e) {
            error.value = 'Failed to fetch parcels';
        } finally {
            isLoadingParcels.value = false;
        }
    }

    async function fetchRoads(neighborhoodId: string) {
        isLoadingRoads.value = true;
        error.value = null;
        roads.value = [];
        selectedRoadId.value = null;
        selectedParcelId.value = null;

        try {
            const response = await api.getRoads(neighborhoodId);
            if (response.data) {
                roads.value = response.data;
            } else if (response.error) {
                error.value = response.error.message;
            }
        } catch (e) {
            error.value = 'Failed to fetch roads';
        } finally {
            isLoadingRoads.value = false;
        }
    }

    function selectProvince(provinceId: string | null) {
        selectedProvinceId.value = provinceId;
        if (provinceId) {
            fetchDistricts(provinceId);
        } else {
            districts.value = [];
            neighborhoods.value = [];
            roads.value = [];
            parcels.value = [];
            selectedDistrictId.value = null;
            selectedNeighborhoodId.value = null;
            selectedRoadId.value = null;
            selectedParcelId.value = null;
        }
    }

    function selectDistrict(districtId: string | null) {
        selectedDistrictId.value = districtId;
        if (districtId) {
            fetchNeighborhoods(districtId);
        } else {
            neighborhoods.value = [];
            roads.value = [];
            parcels.value = [];
            selectedNeighborhoodId.value = null;
            selectedRoadId.value = null;
            selectedParcelId.value = null;
        }
    }

    function selectNeighborhood(neighborhoodId: string | null) {
        selectedNeighborhoodId.value = neighborhoodId;
        if (neighborhoodId) {
            fetchRoads(neighborhoodId);
        } else {
            roads.value = [];
            parcels.value = [];
            selectedRoadId.value = null;
            selectedParcelId.value = null;
        }
    }

    function selectRoad(roadId: string | null) {
        selectedRoadId.value = roadId;
    }

    function selectParcel(parcelId: string | null) {
        selectedParcelId.value = parcelId;
    }

    function resetSelections() {
        selectedProvinceId.value = null;
        selectedDistrictId.value = null;
        selectedNeighborhoodId.value = null;
        selectedRoadId.value = null;
        selectedParcelId.value = null;
        districts.value = [];
        neighborhoods.value = [];
        roads.value = [];
        parcels.value = [];
        error.value = null;
    }

    function clearError() {
        error.value = null;
    }

    return {
        provinces,
        districts,
        neighborhoods,
        roads,
        parcels,
        selectedProvinceId,
        selectedDistrictId,
        selectedNeighborhoodId,
        selectedRoadId,
        selectedParcelId,
        selectedProvince,
        selectedDistrict,
        selectedNeighborhood,
        selectedRoad,
        selectedParcel,
        isLoadingProvinces,
        isLoadingDistricts,
        isLoadingNeighborhoods,
        isLoadingRoads,
        isLoadingParcels,
        error,
        fetchProvinces,
        fetchDistricts,
        fetchNeighborhoods,
        fetchRoads,
        fetchParcels,
        selectProvince,
        selectDistrict,
        selectNeighborhood,
        selectRoad,
        selectParcel,
        resetSelections,
        clearError,
    };
});
