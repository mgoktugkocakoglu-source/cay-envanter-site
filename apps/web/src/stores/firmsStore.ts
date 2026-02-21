import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
    api,
    type Firm,
    type FirmTariff,
    type FirmCollectionPoint,
    type FirmWithCurrentTariffs,
} from '@/services/api';

export const useFirmsStore = defineStore('firms', () => {
    const firms = ref<Firm[]>([]);
    const currentFirm = ref<Firm | null>(null);
    const currentTariffs = ref<FirmTariff[]>([]);
    const collectionPoints = ref<FirmCollectionPoint[]>([]);
    const firmsWithTariffs = ref<FirmWithCurrentTariffs[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    const firmCount = computed(() => firms.value.length);
    const activeFirms = computed(() => firms.value.filter(f => f.isActive));

    async function fetchFirms(params?: { search?: string; isActive?: boolean }) {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await api.getFirms(params);
            if (response.data) {
                firms.value = response.data;
            } else if (response.error) {
                error.value = response.error.message;
            }
        } catch (e) {
            error.value = 'Firmalar yuklenirken hata olustu';
        } finally {
            isLoading.value = false;
        }
    }

    async function fetchFirm(id: string) {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await api.getFirm(id);
            if (response.data) {
                currentFirm.value = response.data;
            } else if (response.error) {
                error.value = response.error.message;
            }
        } catch (e) {
            error.value = 'Firma detayi yuklenirken hata olustu';
        } finally {
            isLoading.value = false;
        }
    }

    async function fetchCurrentTariffs(firmId: string) {
        try {
            const response = await api.getFirmCurrentTariffs(firmId);
            if (response.data) {
                currentTariffs.value = response.data;
            } else if (response.error) {
                error.value = response.error.message;
            }
        } catch (e) {
            error.value = 'Tarifeler yuklenirken hata olustu';
        }
    }

    async function fetchCollectionPoints(firmId: string, params?: { province?: string; district?: string }) {
        try {
            const response = await api.getFirmCollectionPoints(firmId, params);
            if (response.data) {
                collectionPoints.value = response.data;
            } else if (response.error) {
                error.value = response.error.message;
            }
        } catch (e) {
            error.value = 'Toplama noktalari yuklenirken hata olustu';
        }
    }

    async function fetchFirmsWithTariffs() {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await api.getFirmsWithTariffs();
            if (response.data) {
                firmsWithTariffs.value = response.data;
            } else if (response.error) {
                error.value = response.error.message;
            }
        } catch (e) {
            error.value = 'Firma tarifeleri yuklenirken hata olustu';
        } finally {
            isLoading.value = false;
        }
    }

    function clearError() {
        error.value = null;
    }

    return {
        firms,
        currentFirm,
        currentTariffs,
        collectionPoints,
        firmsWithTariffs,
        isLoading,
        error,
        firmCount,
        activeFirms,
        fetchFirms,
        fetchFirm,
        fetchCurrentTariffs,
        fetchCollectionPoints,
        fetchFirmsWithTariffs,
        clearError,
    };
});
