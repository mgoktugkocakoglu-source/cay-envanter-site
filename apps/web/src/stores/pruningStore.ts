import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/services/api';
import type { PruningMeasurement, CreatePruningMeasurementPayload } from '@/services/api';

export const usePruningStore = defineStore('pruning', () => {
    const measurements = ref<PruningMeasurement[]>([]);
    const isLoading = ref(false);
    const isSaving = ref(false);
    const error = ref<string | null>(null);

    const latestMeasurement = computed<PruningMeasurement | null>(() => measurements.value[0] ?? null);

    async function fetchByField(fieldId: string) {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await api.getPruningMeasurements(fieldId);
            if (response.data) {
                measurements.value = response.data;
            } else if (response.error) {
                error.value = response.error.message;
                measurements.value = [];
            }
        } catch {
            error.value = 'Budama kayıtları alınamadı';
            measurements.value = [];
        } finally {
            isLoading.value = false;
        }
    }

    async function create(payload: CreatePruningMeasurementPayload): Promise<PruningMeasurement | null> {
        isSaving.value = true;
        error.value = null;
        try {
            const response = await api.createPruningMeasurement(payload);
            if (response.data) {
                measurements.value = [response.data, ...measurements.value];
                return response.data;
            }
            if (response.error) {
                error.value = response.error.message;
            }
            return null;
        } catch {
            error.value = 'Budama kaydı oluşturulamadı';
            return null;
        } finally {
            isSaving.value = false;
        }
    }

    async function updateApproval(
        id: string,
        data: { producerApproved?: boolean; staffApproved?: boolean },
    ): Promise<PruningMeasurement | null> {
        error.value = null;
        try {
            const response = await api.updatePruningApproval(id, data);
            if (response.data) {
                const index = measurements.value.findIndex((m) => m.id === id);
                if (index !== -1) measurements.value[index] = response.data;
                return response.data;
            }
            if (response.error) error.value = response.error.message;
            return null;
        } catch {
            error.value = 'Onay güncellenemedi';
            return null;
        }
    }

    async function remove(id: string): Promise<boolean> {
        error.value = null;
        try {
            const response = await api.deletePruningMeasurement(id);
            if (response.error) {
                error.value = response.error.message;
                return false;
            }
            measurements.value = measurements.value.filter((m) => m.id !== id);
            return true;
        } catch {
            error.value = 'Kayıt silinemedi';
            return false;
        }
    }

    function reset() {
        measurements.value = [];
        error.value = null;
    }

    return {
        measurements,
        isLoading,
        isSaving,
        error,
        latestMeasurement,
        fetchByField,
        create,
        updateApproval,
        remove,
        reset,
    };
});
