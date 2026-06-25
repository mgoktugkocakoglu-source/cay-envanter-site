import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
    PRUNING_REQUESTS,
    pruningRequestSummary,
    type PruningRequest,
    type PruningRequestStatus,
    type MeasurementPoint,
    type PruningRequestSummary,
} from '@/services/caykur/pruningRequests';
import type { AccuracyLevel, MeasurementMethod } from '@/services/caykur/pruning';

/**
 * Shared, reactive pruning-request store — the single source both the producer
 * surface (PruningPage "Budama Talebi") and the Kurum panel (Budama Talepleri)
 * read and write. A request the producer opens shows up live in the panel; the
 * authorized person's appointment / measurement / approval round-trips back to
 * the producer's view within the demo session.
 *
 * Seeded from the deterministic demo dataset (services/caykur/pruningRequests),
 * which is the seam to swap for real API endpoints later.
 */

export interface NewRequestInput {
    producerId: string;
    producerName: string;
    il: string;
    ilce: string;
    region: PruningRequest['region'];
    ada: string;
    parsel: string;
    registeredAreaM2: number;
}

export interface MeasurementResult {
    measuredAreaM2: number;
    points: MeasurementPoint[];
    accuracyLevel: AccuracyLevel | null;
    fixQuality: string | null;
    method: MeasurementMethod;
}

export const usePruningRequestsStore = defineStore('pruningRequests', () => {
    const requests = ref<PruningRequest[]>([...PRUNING_REQUESTS]);

    let seq = requests.value.length;

    const summary = computed<PruningRequestSummary>(() => pruningRequestSummary(requests.value));

    function forProducer(producerId: string): PruningRequest[] {
        return requests.value.filter((r) => r.producerId === producerId);
    }

    function byId(id: string): PruningRequest | undefined {
        return requests.value.find((r) => r.id === id);
    }

    function countByStatus(status: PruningRequestStatus): number {
        return requests.value.filter((r) => r.status === status).length;
    }

    // ── Producer action ──
    function createRequest(input: NewRequestInput): PruningRequest {
        seq += 1;
        const req: PruningRequest = {
            id: `prq-new-${seq}`,
            producerId: input.producerId,
            producerName: input.producerName,
            il: input.il,
            ilce: input.ilce,
            region: input.region,
            ada: input.ada,
            parsel: input.parsel,
            parcelLabel: `Ada ${input.ada} / Parsel ${input.parsel}`,
            registeredAreaM2: input.registeredAreaM2,
            status: 'pending',
            createdAt: new Date().toISOString(),
            appointmentDate: null,
            appointedBy: null,
            measuredAreaM2: null,
            measurementPoints: [],
            accuracyLevel: null,
            fixQuality: null,
            method: null,
            measuredAt: null,
            measuredBy: null,
            approvedAt: null,
            approvedBy: null,
            notes: '',
        };
        requests.value = [req, ...requests.value];
        return req;
    }

    // ── Authorized-person (panel) actions ──
    function setAppointment(id: string, date: string, staffName: string): void {
        const r = byId(id);
        if (!r) return;
        r.appointmentDate = date;
        r.appointedBy = staffName;
        r.status = 'scheduled';
    }

    function saveMeasurement(id: string, result: MeasurementResult, staffName: string): void {
        const r = byId(id);
        if (!r) return;
        r.measuredAreaM2 = result.measuredAreaM2;
        r.measurementPoints = result.points;
        r.accuracyLevel = result.accuracyLevel;
        r.fixQuality = result.fixQuality;
        r.method = result.method;
        r.measuredAt = new Date().toISOString();
        r.measuredBy = staffName;
        r.status = 'measured';
    }

    function approve(id: string, staffName: string): void {
        const r = byId(id);
        if (!r) return;
        r.approvedAt = new Date().toISOString();
        r.approvedBy = staffName;
        r.status = 'approved';
    }

    function reject(id: string, staffName: string, reason: string): void {
        const r = byId(id);
        if (!r) return;
        r.approvedBy = staffName;
        r.notes = reason || r.notes;
        r.status = 'rejected';
    }

    return {
        requests,
        summary,
        forProducer,
        byId,
        countByStatus,
        createRequest,
        setAppointment,
        saveMeasurement,
        approve,
        reject,
    };
});
