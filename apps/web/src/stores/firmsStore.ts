import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api, type Firm } from '@/services/api';

export const useFirmsStore = defineStore('firms', () => {
    const firms = ref<Firm[]>([]);
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
            error.value = 'Firmalar yüklenirken hata oluştu';
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
            error.value = 'Firma oluşturulurken hata oluştu';
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
            error.value = 'Firma güncellenirken hata oluştu';
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
            error.value = 'Firma silinirken hata oluştu';
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    function clearError() {
        error.value = null;
    }

    return {
        firms,
        isLoading,
        error,
        firmCount,
        activeFirms,
        fetchFirms,
        createFirm,
        updateFirm,
        deleteFirm,
        clearError,
    };
});
