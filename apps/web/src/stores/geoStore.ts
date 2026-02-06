import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api, type GeoProvince, type GeoDistrict, type GeoNeighborhood, type GeoParcel } from '@/services/api';

export const useGeoStore = defineStore('geo', () => {
    const provinces = ref<GeoProvince[]>([]);
    const districts = ref<GeoDistrict[]>([]);
    const neighborhoods = ref<GeoNeighborhood[]>([]);
    const parcels = ref<GeoParcel[]>([]);

    const selectedProvinceId = ref<string | null>(null);
    const selectedDistrictId = ref<string | null>(null);
    const selectedNeighborhoodId = ref<string | null>(null);
    const selectedParcelId = ref<string | null>(null);

    const isLoadingProvinces = ref(false);
    const isLoadingDistricts = ref(false);
    const isLoadingNeighborhoods = ref(false);
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
        parcels.value = [];
        selectedDistrictId.value = null;
        selectedNeighborhoodId.value = null;
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
        parcels.value = [];
        selectedNeighborhoodId.value = null;
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

    function selectProvince(provinceId: string | null) {
        selectedProvinceId.value = provinceId;
        if (provinceId) {
            fetchDistricts(provinceId);
        } else {
            districts.value = [];
            neighborhoods.value = [];
            parcels.value = [];
            selectedDistrictId.value = null;
            selectedNeighborhoodId.value = null;
            selectedParcelId.value = null;
        }
    }

    function selectDistrict(districtId: string | null) {
        selectedDistrictId.value = districtId;
        if (districtId) {
            fetchNeighborhoods(districtId);
        } else {
            neighborhoods.value = [];
            parcels.value = [];
            selectedNeighborhoodId.value = null;
            selectedParcelId.value = null;
        }
    }

    function selectNeighborhood(neighborhoodId: string | null) {
        selectedNeighborhoodId.value = neighborhoodId;
        if (neighborhoodId) {
            fetchParcels(neighborhoodId);
        } else {
            parcels.value = [];
            selectedParcelId.value = null;
        }
    }

    function selectParcel(parcelId: string | null) {
        selectedParcelId.value = parcelId;
    }

    function resetSelections() {
        selectedProvinceId.value = null;
        selectedDistrictId.value = null;
        selectedNeighborhoodId.value = null;
        selectedParcelId.value = null;
        districts.value = [];
        neighborhoods.value = [];
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
        parcels,
        selectedProvinceId,
        selectedDistrictId,
        selectedNeighborhoodId,
        selectedParcelId,
        selectedProvince,
        selectedDistrict,
        selectedNeighborhood,
        selectedParcel,
        isLoadingProvinces,
        isLoadingDistricts,
        isLoadingNeighborhoods,
        isLoadingParcels,
        error,
        fetchProvinces,
        fetchDistricts,
        fetchNeighborhoods,
        fetchParcels,
        selectProvince,
        selectDistrict,
        selectNeighborhood,
        selectParcel,
        resetSelections,
        clearError,
    };
});
