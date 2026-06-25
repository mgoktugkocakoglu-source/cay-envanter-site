/**
 * Budama talepleri — UI metadata only. The data itself is DB-backed and flows
 * through the real API (services/api `/pruning/requests`) + the shared store
 * (stores/pruningRequestsStore). This module just carries the status labels/tones
 * and a pure summary helper used by both surfaces. No mock data.
 */

import type { PruningRequest, PruningRequestStatus, MeasurementPoint } from '@/services/api';

export type { PruningRequest, PruningRequestStatus, MeasurementPoint };

export const PRUNING_REQUEST_STATUS_META: Record<
    PruningRequestStatus,
    { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'muted' }
> = {
    pending: { label: 'Talep alındı', tone: 'warning' },
    scheduled: { label: 'Randevu verildi', tone: 'info' },
    measured: { label: 'Ölçüldü · onay bekliyor', tone: 'info' },
    approved: { label: 'Onaylandı', tone: 'success' },
    rejected: { label: 'Reddedildi', tone: 'danger' },
};

export interface PruningRequestSummary {
    total: number;
    pending: number;
    scheduled: number;
    measured: number;
    approved: number;
    rejected: number;
}

export function pruningRequestSummary(list: PruningRequest[]): PruningRequestSummary {
    return {
        total: list.length,
        pending: list.filter((r) => r.status === 'pending').length,
        scheduled: list.filter((r) => r.status === 'scheduled').length,
        measured: list.filter((r) => r.status === 'measured').length,
        approved: list.filter((r) => r.status === 'approved').length,
        rejected: list.filter((r) => r.status === 'rejected').length,
    };
}
