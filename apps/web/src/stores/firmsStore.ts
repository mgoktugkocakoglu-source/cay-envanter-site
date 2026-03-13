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

    async function createFirm(data: Partial<Firm>): Promise<boolean> {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await api.createFirm(data);
            if (response.data) {
                await fetchFirms();
                return true;
            } else if (response.error) {
                error.value = response.error.message;
            }
            return false;
        } catch (e) {
            error.value = 'Firma olusturulurken hata olustu';
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    async function updateFirm(id: string, data: Partial<Firm>): Promise<boolean> {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await api.updateFirm(id, data);
            if (response.data) {
                await fetchFirms();
                return true;
            } else if (response.error) {
                error.value = response.error.message;
            }
            return false;
        } catch (e) {
            error.value = 'Firma guncellenirken hata olustu';
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    async function deleteFirm(id: string): Promise<boolean> {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await api.deleteFirm(id);
            if (!response.error) {
                await fetchFirms();
                return true;
            } else {
                error.value = response.error.message;
            }
            return false;
        } catch (e) {
            error.value = 'Firma silinirken hata olustu';
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    // ─── Tariff CRUD ───
    async function createTariff(firmId: string, data: Partial<FirmTariff>): Promise<boolean> {
        error.value = null;
        try {
            const response = await api.createFirmTariff(firmId, data);
            if (response.data) {
                await fetchCurrentTariffs(firmId);
                return true;
            } else if (response.error) {
                error.value = response.error.message;
            }
            return false;
        } catch (e) {
            error.value = 'Tarife olusturulurken hata olustu';
            return false;
        }
    }

    async function updateTariff(firmId: string, tariffId: string, data: Partial<FirmTariff>): Promise<boolean> {
        error.value = null;
        try {
            const response = await api.updateFirmTariff(firmId, tariffId, data);
            if (response.data) {
                await fetchCurrentTariffs(firmId);
                return true;
            } else if (response.error) {
                error.value = response.error.message;
            }
            return false;
        } catch (e) {
            error.value = 'Tarife guncellenirken hata olustu';
            return false;
        }
    }

    async function deleteTariff(firmId: string, tariffId: string): Promise<boolean> {
        error.value = null;
        try {
            const response = await api.deleteFirmTariff(firmId, tariffId);
            if (!response.error) {
                currentTariffs.value = currentTariffs.value.filter(t => t.id !== tariffId);
                return true;
            } else {
                error.value = response.error.message;
            }
            return false;
        } catch (e) {
            error.value = 'Tarife silinirken hata olustu';
            return false;
        }
    }

    // ─── Collection Point CRUD ───
    async function createCollectionPoint(firmId: string, data: Partial<FirmCollectionPoint>): Promise<boolean> {
        error.value = null;
        try {
            const response = await api.createFirmCollectionPoint(firmId, data);
            if (response.data) {
                await fetchCollectionPoints(firmId);
                return true;
            } else if (response.error) {
                error.value = response.error.message;
            }
            return false;
        } catch (e) {
            error.value = 'Toplama noktasi olusturulurken hata olustu';
            return false;
        }
    }

    async function updateCollectionPoint(firmId: string, pointId: string, data: Partial<FirmCollectionPoint>): Promise<boolean> {
        error.value = null;
        try {
            const response = await api.updateFirmCollectionPoint(firmId, pointId, data);
            if (response.data) {
                await fetchCollectionPoints(firmId);
                return true;
            } else if (response.error) {
                error.value = response.error.message;
            }
            return false;
        } catch (e) {
            error.value = 'Toplama noktasi guncellenirken hata olustu';
            return false;
        }
    }

    async function deleteCollectionPoint(firmId: string, pointId: string): Promise<boolean> {
        error.value = null;
        try {
            const response = await api.deleteFirmCollectionPoint(firmId, pointId);
            if (!response.error) {
                collectionPoints.value = collectionPoints.value.filter(cp => cp.id !== pointId);
                return true;
            } else {
                error.value = response.error.message;
            }
            return false;
        } catch (e) {
            error.value = 'Toplama noktasi silinirken hata olustu';
            return false;
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
        createFirm,
        updateFirm,
        deleteFirm,
        createTariff,
        updateTariff,
        deleteTariff,
        createCollectionPoint,
        updateCollectionPoint,
        deleteCollectionPoint,
        clearError,
    };
});
