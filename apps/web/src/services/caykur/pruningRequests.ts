/**
 * Budama talepleri (pruning appointment requests) — the institutional workflow
 * that ties the producer surface to the Kurum panel.
 *
 * A producer opens a request (il/ilçe + ada/parsel) to have a pruned parcel
 * registered. A Çaykur authorized person (different actor) receives it in the
 * panel, sets an appointment date, performs the precise 3D (lat/lng/altitude)
 * measurement on site, and approves it. The lifecycle round-trips back to the
 * producer's view via the shared store (stores/pruningRequestsStore).
 *
 * This module is the deterministic seed + query layer (the API-swap seam),
 * mirroring the other services/caykur modules.
 */

import { PRODUCERS, kotaUsagePct, type Producer, type Region } from '@/services/caykurData';
import { parcelsForProducer, type Parcel } from '@/services/caykur/parcels';
import type { AccuracyLevel, MeasurementMethod } from '@/services/caykur/pruning';
import { intBetween, noise, pad, pick, round, timestampDaysAgo, dateDaysAgo } from '@/services/caykur/rng';
import { polygonAreaM2 } from '@/utils/geo';

export type PruningRequestStatus = 'pending' | 'scheduled' | 'measured' | 'approved' | 'rejected';
// pending=talep alındı · scheduled=randevu verildi · measured=ölçüldü (onay bekliyor)
// approved=onaylandı · rejected=reddedildi

/** A single 3D measurement vertex captured by the precise receiver. */
export interface MeasurementPoint {
    lat: number;
    lng: number;
    altitudeMeters: number;
}

export interface PruningRequest {
    id: string;
    producerId: string;
    producerName: string;
    /** İl (province) — equals the producer's region in this dataset. */
    il: string;
    /** İlçe (district). */
    ilce: string;
    region: Region;
    ada: string;
    parsel: string;
    parcelLabel: string;
    /** Producer's total registered land (m²), shown as context. */
    registeredAreaM2: number;
    status: PruningRequestStatus;
    createdAt: string;
    appointmentDate: string | null;
    appointedBy: string | null;
    // Measurement result — filled by the authorized person in the panel.
    measuredAreaM2: number | null;
    measurementPoints: MeasurementPoint[];
    accuracyLevel: AccuracyLevel | null;
    fixQuality: string | null;
    method: MeasurementMethod | null;
    measuredAt: string | null;
    measuredBy: string | null;
    approvedAt: string | null;
    approvedBy: string | null;
    notes: string;
}

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

const FIELD_OFFICERS = ['Davut Şahin', 'Yılmaz Çelik', 'İbrahim Kaya', 'Mustafa Yılmaz'];

/** Demo "logged-in producer" — kept in sync with composables/useDemoProducer. */
const DEMO_PRODUCER: Producer =
    PRODUCERS.find((p) => {
        const u = kotaUsagePct(p);
        return u >= 70 && u <= 96;
    }) ?? PRODUCERS[0];

/** Build 3D vertices from a parcel's placeholder ring, adding plausible altitude. */
function pointsFromParcel(parcel: Parcel | undefined, seed: number): MeasurementPoint[] {
    const ring = parcel?.polygon ?? [];
    if (ring.length < 4) return [];
    return ring.slice(0, ring.length - 1).map(([lng, lat], i) => ({
        lat: round(lat, 7),
        lng: round(lng, 7),
        altitudeMeters: round(60 + noise(seed + i) * 240, 1),
    }));
}

interface SeedSpec {
    producer: Producer;
    status: PruningRequestStatus;
    /** Which of the producer's parcels to attach. */
    parcelIndex: number;
}

const others = PRODUCERS.filter((p) => p.id !== DEMO_PRODUCER.id);

const SEED_SPEC: SeedSpec[] = [
    { producer: DEMO_PRODUCER, status: 'approved', parcelIndex: 0 },
    { producer: DEMO_PRODUCER, status: 'pending', parcelIndex: 1 },
    { producer: others[2], status: 'pending', parcelIndex: 0 },
    { producer: others[5], status: 'scheduled', parcelIndex: 0 },
    { producer: others[8], status: 'measured', parcelIndex: 0 },
    { producer: others[11], status: 'approved', parcelIndex: 0 },
    { producer: others[15], status: 'scheduled', parcelIndex: 0 },
    { producer: others[19], status: 'rejected', parcelIndex: 0 },
];

function buildRequest(spec: SeedSpec, index: number): PruningRequest {
    const { producer: p, status } = spec;
    const parcels = parcelsForProducer(p.id);
    const parcel = parcels[spec.parcelIndex] ?? parcels[0];
    const seed = index * 9 + 17;

    const registeredAreaM2 = p.gardenM2;
    const createdAgo = intBetween(6, 48, seed + 1);

    const scheduled = status !== 'pending';
    const measured = status === 'measured' || status === 'approved';
    const rejected = status === 'rejected';

    const points = measured ? pointsFromParcel(parcel, seed + 5) : [];
    const measuredAreaM2 = measured
        ? round(points.length >= 3 ? polygonAreaM2(points) : registeredAreaM2 * 0.13)
        : null;

    // Appointment: past for measured/approved, near-future for scheduled/rejected.
    const appointmentDate = !scheduled
        ? null
        : measured
            ? dateDaysAgo(intBetween(1, Math.max(2, createdAgo - 4), seed + 2))
            : dateDaysAgo(-intBetween(1, 8, seed + 2));

    const officer = pick(FIELD_OFFICERS, seed + 3);

    return {
        id: `prq-${pad(index + 1, 3)}`,
        producerId: p.id,
        producerName: p.fullName,
        il: p.region,
        ilce: p.district,
        region: p.region,
        ada: parcel?.ada ?? '—',
        parsel: parcel?.parsel ?? '—',
        parcelLabel: parcel ? `Ada ${parcel.ada} / Parsel ${parcel.parsel}` : 'Bahçe geneli',
        registeredAreaM2,
        status,
        createdAt: timestampDaysAgo(createdAgo, intBetween(8, 17, seed + 4)),
        appointmentDate,
        appointedBy: scheduled ? officer : null,
        measuredAreaM2,
        measurementPoints: points,
        accuracyLevel: measured ? 'high' : null,
        fixQuality: measured ? 'rtk-fixed' : null,
        method: measured ? 'gps' : null,
        measuredAt: measured ? timestampDaysAgo(Math.max(0, createdAgo - 6), 11) : null,
        measuredBy: measured ? officer : null,
        approvedAt: status === 'approved' ? timestampDaysAgo(Math.max(0, createdAgo - 7), 14) : null,
        approvedBy: status === 'approved' ? officer : null,
        notes: rejected ? 'Ölçülen alan parsel sınırını aşıyor; yeniden ölçüm gerekiyor.' : '',
    };
}

export const PRUNING_REQUESTS: PruningRequest[] = SEED_SPEC.map(buildRequest).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
);

export function pruningRequestById(id: string): PruningRequest | undefined {
    return PRUNING_REQUESTS.find((r) => r.id === id);
}

export function pruningRequestsForProducer(producerId: string): PruningRequest[] {
    return PRUNING_REQUESTS.filter((r) => r.producerId === producerId);
}

export function pendingPruningRequests(): PruningRequest[] {
    return PRUNING_REQUESTS.filter((r) => r.status === 'pending');
}

export interface PruningRequestSummary {
    total: number;
    pending: number;
    scheduled: number;
    measured: number;
    approved: number;
    rejected: number;
}

export function pruningRequestSummary(
    list: PruningRequest[] = PRUNING_REQUESTS,
): PruningRequestSummary {
    return {
        total: list.length,
        pending: list.filter((r) => r.status === 'pending').length,
        scheduled: list.filter((r) => r.status === 'scheduled').length,
        measured: list.filter((r) => r.status === 'measured').length,
        approved: list.filter((r) => r.status === 'approved').length,
        rejected: list.filter((r) => r.status === 'rejected').length,
    };
}
