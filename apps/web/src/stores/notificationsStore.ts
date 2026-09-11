import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api, type LicensingApproval, type LicensingApprovalStatus } from '@/services/api';

/**
 * Bildirimler — the producer's in-app inbox. Today it carries one kind of
 * item: ruhsatlandırma approval requests (a co-owner of a hisseli parcel is
 * asked to confirm the slice Çaykur staff measured for another owner). The
 * pending count feeds the badge in the profile dropdown.
 */
export const useNotificationsStore = defineStore('notifications', () => {
    const approvals = ref<LicensingApproval[]>([]);
    const pendingCount = ref(0);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    const pendingApprovals = computed(() => approvals.value.filter((a) => a.status === 'pending'));
    const decidedApprovals = computed(() => approvals.value.filter((a) => a.status !== 'pending'));

    function upsert(rec: LicensingApproval): void {
        const i = approvals.value.findIndex((a) => a.id === rec.id);
        if (i === -1) approvals.value = [rec, ...approvals.value];
        else approvals.value[i] = { ...approvals.value[i], ...rec };
        pendingCount.value = approvals.value.filter((a) => a.status === 'pending').length;
    }

    async function fetchPendingCount(): Promise<void> {
        const res = await api.getPendingLicensingApprovalCount();
        if (res.data) pendingCount.value = res.data.count;
    }

    async function fetchApprovals(params?: { status?: LicensingApprovalStatus }): Promise<void> {
        isLoading.value = true;
        error.value = null;
        try {
            const res = await api.getMyLicensingApprovals({ limit: 100, ...params });
            if (res.data) {
                approvals.value = res.data.data;
                if (!params?.status) pendingCount.value = pendingApprovals.value.length;
            } else if (res.error) {
                error.value = res.error.message;
            }
        } catch {
            error.value = 'Bildirimler alınamadı';
        } finally {
            isLoading.value = false;
        }
    }

    async function decide(id: string, decision: 'approved' | 'rejected', reason?: string): Promise<LicensingApproval | null> {
        const res = await api.decideLicensingApproval(id, decision, reason);
        if (res.data) {
            upsert(res.data);
            return res.data;
        }
        error.value = res.error?.message ?? 'Karar kaydedilemedi';
        return null;
    }

    function reset(): void {
        approvals.value = [];
        pendingCount.value = 0;
        error.value = null;
    }

    return {
        approvals,
        pendingCount,
        isLoading,
        error,
        pendingApprovals,
        decidedApprovals,
        fetchPendingCount,
        fetchApprovals,
        decide,
        reset,
    };
});
