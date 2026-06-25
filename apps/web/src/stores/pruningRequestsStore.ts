import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
    api,
    type PruningRequest,
    type PruningRequestStatus,
    type CreatePruningRequestPayload,
    type SavePruningMeasurementResultPayload,
} from '@/services/api';

/**
 * Budama talepleri store — DB-backed (no mock data). Both the producer surface
 * (PruningPage "Budama Talebi") and the Kurum panel (Budama Talepleri) read and
 * write through the real `/pruning/requests` API; the backend scopes the list
 * by role (producer sees own, staff sees all) and stamps the acting user.
 */
export const usePruningRequestsStore = defineStore('pruningRequests', () => {
    const requests = ref<PruningRequest[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    function countByStatus(status: PruningRequestStatus): number {
        return requests.value.filter((r) => r.status === status).length;
    }

    const summary = computed(() => ({
        total: requests.value.length,
        pending: countByStatus('pending'),
        scheduled: countByStatus('scheduled'),
        measured: countByStatus('measured'),
        approved: countByStatus('approved'),
        rejected: countByStatus('rejected'),
    }));

    function byId(id: string): PruningRequest | undefined {
        return requests.value.find((r) => r.id === id);
    }

    function upsert(rec: PruningRequest): void {
        const i = requests.value.findIndex((r) => r.id === rec.id);
        if (i === -1) requests.value = [rec, ...requests.value];
        else requests.value[i] = rec;
    }

    async function fetchAll(params?: { status?: PruningRequestStatus; search?: string }): Promise<void> {
        isLoading.value = true;
        error.value = null;
        try {
            const res = await api.getPruningRequests({ limit: 100, ...params });
            if (res.data) requests.value = res.data.data;
            else if (res.error) error.value = res.error.message;
        } catch {
            error.value = 'Budama talepleri alınamadı';
        } finally {
            isLoading.value = false;
        }
    }

    async function fetchOne(id: string): Promise<PruningRequest | undefined> {
        const res = await api.getPruningRequest(id);
        if (res.data) {
            upsert(res.data);
            return res.data;
        }
        if (res.error) error.value = res.error.message;
        return undefined;
    }

    async function createRequest(payload: CreatePruningRequestPayload): Promise<PruningRequest | null> {
        const res = await api.createPruningRequest(payload);
        if (res.data) {
            upsert(res.data);
            return res.data;
        }
        error.value = res.error?.message ?? 'Talep oluşturulamadı';
        return null;
    }

    async function setAppointment(id: string, appointmentDate: string): Promise<PruningRequest | null> {
        const res = await api.setPruningAppointment(id, appointmentDate);
        if (res.data) upsert(res.data);
        else error.value = res.error?.message ?? null;
        return res.data ?? null;
    }

    async function saveMeasurement(id: string, result: SavePruningMeasurementResultPayload): Promise<PruningRequest | null> {
        const res = await api.savePruningRequestMeasurement(id, result);
        if (res.data) upsert(res.data);
        else error.value = res.error?.message ?? null;
        return res.data ?? null;
    }

    async function approve(id: string): Promise<PruningRequest | null> {
        const res = await api.approvePruningRequest(id);
        if (res.data) upsert(res.data);
        else error.value = res.error?.message ?? null;
        return res.data ?? null;
    }

    async function reject(id: string, reason?: string): Promise<PruningRequest | null> {
        const res = await api.rejectPruningRequest(id, reason);
        if (res.data) upsert(res.data);
        else error.value = res.error?.message ?? null;
        return res.data ?? null;
    }

    return {
        requests,
        isLoading,
        error,
        summary,
        countByStatus,
        byId,
        fetchAll,
        fetchOne,
        createRequest,
        setAppointment,
        saveMeasurement,
        approve,
        reject,
    };
});
