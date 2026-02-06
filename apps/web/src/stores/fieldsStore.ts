import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api, type Field, type FieldPartner } from '@/services/api';

export const useFieldsStore = defineStore('fields', () => {
    const fields = ref<Field[]>([]);
    const currentField = ref<Field | null>(null);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    const fieldCount = computed(() => fields.value.length);

    async function fetchFields(params?: { province?: string; search?: string }) {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await api.getFields(params);
            if (response.data) {
                fields.value = response.data;
            } else if (response.error) {
                error.value = response.error.message;
            }
        } catch (e) {
            error.value = 'Failed to fetch fields';
        } finally {
            isLoading.value = false;
        }
    }

    async function fetchField(id: string) {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await api.getField(id);
            if (response.data) {
                currentField.value = response.data;
            } else if (response.error) {
                error.value = response.error.message;
            }
        } catch (e) {
            error.value = 'Failed to fetch field';
        } finally {
            isLoading.value = false;
        }
    }

    async function createField(data: Partial<Field> & { partners?: Partial<FieldPartner>[] }): Promise<Field | null | undefined> {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await api.createField(data);
            if (response.data) {
                fields.value.unshift(response.data);
                return response.data;
            } else if (response.error) {
                error.value = response.error.message;
                return null;
            }
            return undefined;
        } catch (e) {
            error.value = 'Failed to create field';
            return null;
        } finally {
            isLoading.value = false;
        }
    }

    async function updateField(id: string, data: Partial<Field>): Promise<Field | null | undefined> {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await api.updateField(id, data);
            if (response.data) {
                const index = fields.value.findIndex(f => f.id === id);
                if (index !== -1) {
                    fields.value[index] = response.data;
                }
                if (currentField.value?.id === id) {
                    currentField.value = response.data;
                }
                return response.data;
            } else if (response.error) {
                error.value = response.error.message;
                return null;
            }
            return undefined;
        } catch (e) {
            error.value = 'Failed to update field';
            return null;
        } finally {
            isLoading.value = false;
        }
    }

    async function deleteField(id: string) {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await api.deleteField(id);
            if (!response.error) {
                fields.value = fields.value.filter(f => f.id !== id);
                if (currentField.value?.id === id) {
                    currentField.value = null;
                }
                return true;
            } else {
                error.value = response.error.message;
                return false;
            }
        } catch (e) {
            error.value = 'Failed to delete field';
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    function clearError() {
        error.value = null;
    }

    return {
        fields,
        currentField,
        isLoading,
        error,
        fieldCount,
        fetchFields,
        fetchField,
        createField,
        updateField,
        deleteField,
        clearError,
    };
});
