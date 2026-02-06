import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api, type Harvest } from '@/services/api';

export const useHarvestsStore = defineStore('harvests', () => {
    const harvests = ref<Harvest[]>([]);
    const availableHarvests = ref<Harvest[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    const harvestCount = computed(() => harvests.value.length);
    const totalHarvestKg = computed(() =>
        harvests.value.reduce((sum, h) => sum + h.amountKg, 0)
    );

    async function fetchHarvests(params?: { fieldId?: string; year?: number; status?: string }) {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await api.getHarvests(params);
            if (response.data) {
                harvests.value = response.data;
            } else if (response.error) {
                error.value = response.error.message;
            }
        } catch (e) {
            error.value = 'Failed to fetch harvests';
        } finally {
            isLoading.value = false;
        }
    }

    async function fetchAvailableHarvests() {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await api.getAvailableHarvests();
            if (response.data) {
                availableHarvests.value = response.data;
            } else if (response.error) {
                error.value = response.error.message;
            }
        } catch (e) {
            error.value = 'Failed to fetch available harvests';
        } finally {
            isLoading.value = false;
        }
    }

    async function createHarvest(data: {
        fieldId: string;
        harvestDate: string;
        amountKg: number;
        quality?: string;
        notes?: string;
    }) {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await api.createHarvest(data);
            if (response.data) {
                harvests.value.unshift(response.data);
                return response.data;
            } else if (response.error) {
                error.value = response.error.message;
                return null;
            }
        } catch (e) {
            error.value = 'Failed to create harvest';
            return null;
        } finally {
            isLoading.value = false;
        }
        return null;
    }

    async function deleteHarvest(id: string) {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await api.deleteHarvest(id);
            if (!response.error) {
                harvests.value = harvests.value.filter(h => h.id !== id);
                return true;
            } else {
                error.value = response.error.message;
                return false;
            }
        } catch (e) {
            error.value = 'Failed to delete harvest';
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    function clearError() {
        error.value = null;
    }

    return {
        harvests,
        availableHarvests,
        isLoading,
        error,
        harvestCount,
        totalHarvestKg,
        fetchHarvests,
        fetchAvailableHarvests,
        createHarvest,
        deleteHarvest,
        clearError,
    };
});
