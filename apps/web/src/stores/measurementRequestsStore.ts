import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
    api,
    type MeasurementRequest,
    type MeasurementRequestStatus,
    type CreateMeasurementRequestPayload,
} from '@/services/api';

/**
 * Arazide ölçüm talepleri store — DB-backed. The producer's field detail page
 * opens and cancels requests; the Kurum panel (Ölçüm Talepleri) schedules,
 * measures (via the licensing flow) and rejects them. The backend scopes the
 * list by role (producer sees own, staff sees all).
 */
export const useMeasurementRequestsStore = defineStore('measurementRequests', () => {
    const requests = ref<MeasurementRequest[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    function countByStatus(status: MeasurementRequestStatus): number {
        return requests.value.filter((r) => r.status === status).length;
    }

    const summary = computed(() => ({
        total: requests.value.length,
        pending: countByStatus('pending'),
        scheduled: countByStatus('scheduled'),
        measured: countByStatus('measured'),
        closed: countByStatus('closed'),
        rejected: countByStatus('rejected'),
        cancelled: countByStatus('cancelled'),
    }));

    function byId(id: string): MeasurementRequest | undefined {
        return requests.value.find((r) => r.id === id);
    }

    function upsert(rec: MeasurementRequest): void {
        const i = requests.value.findIndex((r) => r.id === rec.id);
        if (i === -1) requests.value = [rec, ...requests.value];
        else requests.value[i] = rec;
    }

    async function fetchAll(params?: { status?: MeasurementRequestStatus; search?: string }): Promise<void> {
        isLoading.value = true;
        error.value = null;
        try {
            const res = await api.getMeasurementRequests({ limit: 100, ...params });
            if (res.data) requests.value = res.data.data;
            else if (res.error) error.value = res.error.message;
        } catch {
            error.value = 'Ölçüm talepleri alınamadı';
        } finally {
            isLoading.value = false;
        }
    }

    async function fetchOne(id: string): Promise<MeasurementRequest | undefined> {
        const res = await api.getMeasurementRequest(id);
        if (res.data) {
            upsert(res.data);
            return res.data;
        }
        if (res.error) error.value = res.error.message;
        return undefined;
    }

    async function createRequest(payload: CreateMeasurementRequestPayload): Promise<MeasurementRequest | null> {
        const res = await api.createMeasurementRequest(payload);
        if (res.data) {
            upsert(res.data);
            return res.data;
        }
        error.value = res.error?.message ?? 'Talep oluşturulamadı';
        return null;
    }

    async function cancel(id: string): Promise<MeasurementRequest | null> {
        const res = await api.cancelMeasurementRequest(id);
        if (res.data) upsert(res.data);
        else error.value = res.error?.message ?? null;
        return res.data ?? null;
    }

    async function setAppointment(id: string, appointmentDate: string): Promise<MeasurementRequest | null> {
        const res = await api.setMeasurementRequestAppointment(id, appointmentDate);
        if (res.data) upsert(res.data);
        else error.value = res.error?.message ?? null;
        return res.data ?? null;
    }

    async function reject(id: string, reason?: string): Promise<MeasurementRequest | null> {
        const res = await api.rejectMeasurementRequest(id, reason);
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
        upsert,
        fetchAll,
        fetchOne,
        createRequest,
        cancel,
        setAppointment,
        reject,
    };
});
