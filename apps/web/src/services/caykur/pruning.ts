/**
 * Pruning measurement & audit layer (Faz 7). One field measurement per
 * producer who pruned this season, derived from the producer registry's 1/7
 * budama model. Carries the geometry-derived pruned area, the 1/7 ratio check,
 * overflow/overlap warnings and a two-sided (producer + staff) approval state
 * feeding the institutional audit queue.
 */

import {
    PRODUCERS,
    type Producer,
    type Region,
    budamaRatioPct,
    budamaStatus,
    BUDAMA_TARGET_PCT,
    type ComplianceStatus,
} from '@/services/caykurData';
import { parcelsForProducer } from '@/services/caykur/parcels';
import { intBetween, noise, round, timestampDaysAgo } from '@/services/caykur/rng';

export type MeasurementMethod = 'map' | 'gps' | 'assisted' | 'imu';
export type AccuracyLevel = 'high' | 'medium' | 'low';
export type AuditStatus = 'pending' | 'approved' | 'rejected';

export interface PruningMeasurement {
    id: string;
    producerId: string;
    producerName: string;
    region: Region;
    factory: string;
    parcelId: string | null;
    parcelLabel: string;
    method: MeasurementMethod;
    measuredAt: string;
    measuredBy: string;
    prunedAreaM2: number;
    parcelAreaM2: number;
    ratioPercent: number;
    status: ComplianceStatus;
    accuracyLevel: AccuracyLevel;
    gpsAccuracyMeters: number | null;
    photoCount: number;
    producerApproved: boolean;
    staffApproved: boolean;
    auditStatus: AuditStatus;
    overflowWarning: boolean;
    overlapWarning: boolean;
    notes: string;
}

const METHODS: MeasurementMethod[] = ['map', 'gps', 'assisted'];
export const METHOD_LABEL: Record<MeasurementMethod, string> = {
    map: 'Harita ile',
    gps: 'GPS ile',
    assisted: 'Yardımlı',
    imu: 'Lazer + IMU',
};

const FIELD_OFFICERS = ['Davut Şahin', 'Yılmaz Çelik', 'İbrahim Kaya', 'Mustafa Yılmaz', 'Hasan Demir', 'Ali Arslan'];

export const AUDIT_STATUS_META: Record<AuditStatus, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
    pending: { label: 'Denetim bekliyor', tone: 'warning' },
    approved: { label: 'Onaylandı', tone: 'success' },
    rejected: { label: 'Reddedildi', tone: 'danger' },
};

function buildMeasurement(p: Producer, index: number): PruningMeasurement | null {
    if (p.prunedThisYearM2 <= 0) return null;
    const parcels = parcelsForProducer(p.id);
    const parcel = parcels[0] ?? null;
    const parcelAreaM2 = parcel ? parcel.areaM2 : p.gardenM2;
    const ratioPercent = round(budamaRatioPct(p), 1);
    const status = budamaStatus(p);

    const seed = index * 6 + 3;
    const method = METHODS[Math.floor(noise(seed) * METHODS.length) % METHODS.length];
    const accuracyLevel: AccuracyLevel = noise(seed + 1) < 0.6 ? 'high' : noise(seed + 1) < 0.88 ? 'medium' : 'low';

    const overflowWarning = noise(seed + 2) < 0.1;
    const overlapWarning = noise(seed + 3) < 0.08;

    // Audit state: noncompliant or warning-bearing → pending/rejected; clean → approved.
    let auditStatus: AuditStatus;
    if (overflowWarning || overlapWarning) {
        auditStatus = noise(seed + 4) < 0.5 ? 'pending' : 'rejected';
    } else if (status === 'noncompliant') {
        auditStatus = 'rejected';
    } else {
        auditStatus = noise(seed + 5) < 0.25 ? 'pending' : 'approved';
    }

    return {
        id: `pmz-${p.id.replace('mus-', '')}`,
        producerId: p.id,
        producerName: p.fullName,
        region: p.region,
        factory: p.factory,
        parcelId: parcel?.id ?? null,
        parcelLabel: parcel ? `Ada ${parcel.ada} / Parsel ${parcel.parsel}` : 'Bahçe geneli',
        method,
        measuredAt: timestampDaysAgo(intBetween(3, 140, seed + 6), intBetween(8, 16, seed + 7)),
        measuredBy: FIELD_OFFICERS[index % FIELD_OFFICERS.length],
        prunedAreaM2: p.prunedThisYearM2,
        parcelAreaM2,
        ratioPercent,
        status,
        accuracyLevel,
        gpsAccuracyMeters: method === 'gps' ? round(2 + noise(seed + 8) * 6, 1) : null,
        photoCount: intBetween(1, 5, seed + 9),
        producerApproved: noise(seed + 10) > 0.2,
        staffApproved: auditStatus === 'approved',
        auditStatus,
        overflowWarning,
        overlapWarning,
        notes: overflowWarning
            ? 'Ölçülen alan parsel sınırını aşıyor; yeniden ölçüm gerekebilir.'
            : overlapWarning
                ? 'Geçen yıl budanan dilimle çakışma tespit edildi.'
                : '',
    };
}

export const MEASUREMENTS: PruningMeasurement[] = PRODUCERS
    .map(buildMeasurement)
    .filter((m): m is PruningMeasurement => m !== null)
    .sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : -1));

export function measurementsForProducer(producerId: string): PruningMeasurement[] {
    return MEASUREMENTS.filter((m) => m.producerId === producerId);
}

export function measurementById(id: string): PruningMeasurement | undefined {
    return MEASUREMENTS.find((m) => m.id === id);
}

export function pendingAudits(): PruningMeasurement[] {
    return MEASUREMENTS.filter((m) => m.auditStatus === 'pending');
}

export interface PruningSummary {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    compliant: number;
    warnings: number;
    targetPct: number;
}

export function pruningSummary(list: PruningMeasurement[] = MEASUREMENTS): PruningSummary {
    return {
        total: list.length,
        pending: list.filter((m) => m.auditStatus === 'pending').length,
        approved: list.filter((m) => m.auditStatus === 'approved').length,
        rejected: list.filter((m) => m.auditStatus === 'rejected').length,
        compliant: list.filter((m) => m.status === 'compliant').length,
        warnings: list.filter((m) => m.overflowWarning || m.overlapWarning).length,
        targetPct: round(BUDAMA_TARGET_PCT, 1),
    };
}
