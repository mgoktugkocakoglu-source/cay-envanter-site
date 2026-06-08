/**
 * Çaykur enterprise data layer — single entry point.
 *
 * Re-exports every seed module so pages/stores import from one place
 * (`@/services/caykur`). This is the seam the codebase intends to swap for real
 * API aggregation endpoints: each export here maps to a future endpoint, and
 * the page/store contracts stay identical.
 */

export * from '@/services/caykur/rng';
export * from '@/services/caykur/roles';
export * from '@/services/caykur/org';
export * from '@/services/caykur/parcels';
export * from '@/services/caykur/deliveries';
export * from '@/services/caykur/quota';
export * from '@/services/caykur/finance';
export * from '@/services/caykur/pruning';
export * from '@/services/caykur/comms';
export * from '@/services/caykur/audit';
export * from '@/services/caykur/reports';

// Core producer registry + compliance model (kept at its original path so the
// existing Çaykur pages keep working).
export {
    PRODUCERS,
    SEASON_LABEL,
    buildOverview,
    flaggedProducers,
    getProducer,
    producerFlags,
    kotaUsagePct,
    kotaTone,
    budamaStatus,
    budamaRatioPct,
    qualityStatus,
    statusTone,
    BUDAMA_TARGET_PCT,
    formatNumber,
    formatKg,
    formatTon,
    formatDekar,
    formatPct,
    type Producer,
    type Region,
    type ComplianceStatus,
    type Tone,
    type ProducerFlag,
    type Overview,
} from '@/services/caykurData';

import { parcelSummary } from '@/services/caykur/parcels';
import { deliverySummary, pendingDeliveries } from '@/services/caykur/deliveries';
import { quotaSummary } from '@/services/caykur/quota';
import { financeSummary } from '@/services/caykur/finance';
import { pruningSummary, pendingAudits } from '@/services/caykur/pruning';
import { REQUESTS, WORK_TASKS } from '@/services/caykur/comms';

/** Cross-module operational counters for the command-center overview header. */
export interface OpsSnapshot {
    pendingDeliveries: number;
    pendingAudits: number;
    openRequests: number;
    overdueTasks: number;
    parcelsPendingVerification: number;
    paymentsAwaitingApproval: number;
    outstandingBalance: number;
    quotaUsagePct: number;
}

export function opsSnapshot(): OpsSnapshot {
    const fin = financeSummary();
    return {
        pendingDeliveries: pendingDeliveries().length,
        pendingAudits: pendingAudits().length,
        openRequests: REQUESTS.filter((r) => r.status === 'open' || r.status === 'in_progress').length,
        overdueTasks: WORK_TASKS.filter((t) => t.status === 'overdue').length,
        parcelsPendingVerification: parcelSummary().pending,
        paymentsAwaitingApproval: fin.pendingApprovalCount,
        outstandingBalance: fin.outstanding,
        quotaUsagePct: quotaSummary().usagePct,
    };
}

export { parcelSummary, deliverySummary, quotaSummary, financeSummary, pruningSummary };
