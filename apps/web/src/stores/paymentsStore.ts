import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api, type Payment, type BrokerFirm } from '@/services/api';

export const usePaymentsStore = defineStore('payments', () => {
    const payments = ref<Payment[]>([]);
    const brokerFirms = ref<BrokerFirm[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    const totalIncome = computed(() =>
        payments.value
            .filter(p => p.paymentStatus === 'received')
            .reduce((sum, p) => sum + p.totalPrice, 0)
    );

    const pendingPayments = computed(() =>
        payments.value.filter(p => p.paymentStatus === 'pending')
    );

    async function fetchPayments(params?: { year?: number; paymentStatus?: string }) {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await api.getPayments(params);
            if (response.data) {
                payments.value = response.data;
            } else if (response.error) {
                error.value = response.error.message;
            }
        } catch (e) {
            error.value = 'Failed to fetch payments';
        } finally {
            isLoading.value = false;
        }
    }

    async function fetchBrokerFirms() {
        try {
            const response = await api.getBrokerFirms();
            if (response.data) {
                brokerFirms.value = response.data;
            }
        } catch (e) {
            console.error('Failed to fetch broker firms');
        }
    }

    async function createPayment(data: {
        harvestAllocations: { harvestId: string; usedAmountKg: number }[];
        totalPrice: number;
        brokerFirmId?: string;
        paymentDate: string;
        paymentStatus: 'received' | 'pending';
        notes?: string;
    }) {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await api.createPayment(data);
            if (response.data) {
                payments.value.unshift(response.data);
                return response.data;
            } else if (response.error) {
                error.value = response.error.message;
                return null;
            }
        } catch (e) {
            error.value = 'Failed to create payment';
            return null;
        } finally {
            isLoading.value = false;
        }
        return null;
    }

    async function createBrokerFirm(firmName: string) {
        try {
            const response = await api.createBrokerFirm(firmName);
            if (response.data) {
                brokerFirms.value.push(response.data);
                return response.data;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    async function deletePayment(id: string) {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await api.deletePayment(id);
            if (!response.error) {
                payments.value = payments.value.filter(p => p.id !== id);
                return true;
            } else {
                error.value = response.error.message;
                return false;
            }
        } catch (e) {
            error.value = 'Failed to delete payment';
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    function clearError() {
        error.value = null;
    }

    return {
        payments,
        brokerFirms,
        isLoading,
        error,
        totalIncome,
        pendingPayments,
        fetchPayments,
        fetchBrokerFirms,
        createPayment,
        createBrokerFirm,
        deletePayment,
        clearError,
    };
});
