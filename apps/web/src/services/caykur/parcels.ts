/**
 * Parcel / cadastre layer (Faz 3). Each producer's licensed garden is split
 * into 1–3 parcels whose areas sum to the producer's gardenM2. Carries
 * ada/parsel identifiers, a verification state, a small yield history and a
 * tiny polygon for the map placeholder.
 */

import { PRODUCERS, type Producer, type Region } from '@/services/caykurData';
import { regionInfo } from '@/services/caykur/org';
import { dateDaysAgo, intBetween, noise, pad, round } from '@/services/caykur/rng';

export type ParcelVerification = 'verified' | 'pending' | 'rejected' | 'unverified';

export interface Parcel {
    id: string;
    producerId: string;
    producerName: string;
    region: Region;
    district: string;
    neighborhood: string;
    ada: string;
    parsel: string;
    areaM2: number;
    organic: boolean;
    verification: ParcelVerification;
    verifiedAt: string | null;
    /** Last seasons' fresh-leaf yield from this parcel (kg), newest last. */
    yieldHistory: Array<{ year: number; kg: number }>;
    photoCount: number;
    hasOpenCorrection: boolean;
    /** [lng, lat] ring for the map placeholder. */
    polygon: number[][];
}

const NEIGHBORHOODS = [
    'Merkez Mah.', 'Yeniköy', 'Çukurlu', 'Aşağı Mah.', 'Yukarı Mah.', 'Dereiçi',
    'Taşlıdere', 'Çamlık', 'Gündoğdu', 'Yalı Mah.', 'Bağlık', 'Kestane Mah.',
];

const VERIFY_STATES: ParcelVerification[] = ['verified', 'pending', 'rejected', 'unverified'];

function squareAround(lat: number, lng: number, areaM2: number, seed: number): number[][] {
    // Rough square; size scales gently with area. ~0.00001 deg ≈ 1.1 m.
    const half = Math.sqrt(Math.max(areaM2, 200)) * 0.0000065;
    const jx = (noise(seed) - 0.5) * 0.02;
    const jy = (noise(seed + 1) - 0.5) * 0.02;
    const cx = lng + jx;
    const cy = lat + jy;
    return [
        [round(cx - half, 6), round(cy - half, 6)],
        [round(cx + half, 6), round(cy - half, 6)],
        [round(cx + half, 6), round(cy + half, 6)],
        [round(cx - half, 6), round(cy + half, 6)],
        [round(cx - half, 6), round(cy - half, 6)],
    ];
}

function buildParcelsFor(p: Producer, index: number): Parcel[] {
    const count = 1 + (noise(index * 2.1 + 3) < 0.45 ? 1 : 0) + (noise(index * 3.3 + 7) < 0.2 ? 1 : 0);
    const region = regionInfo(p.region);
    const parcels: Parcel[] = [];
    let remaining = p.gardenM2;

    for (let k = 0; k < count; k++) {
        const last = k === count - 1;
        const share = last ? 1 : 0.35 + noise(index * 5 + k * 2 + 1) * 0.3;
        const areaM2 = last ? remaining : Math.round(remaining * share);
        remaining -= areaM2;

        const seed = index * 13 + k * 4;
        // Most parcels verified; a credible minority pending/rejected/unverified.
        const vSeed = noise(seed + 2);
        const verification: ParcelVerification =
            vSeed < 0.64 ? 'verified' : vSeed < 0.82 ? 'pending' : vSeed < 0.92 ? 'unverified' : 'rejected';

        const baseYield = areaM2 * (0.85 + noise(seed + 5) * 0.5); // ~kg/m² band
        const yieldHistory = Array.from({ length: 5 }, (_, y) => ({
            year: 2021 + y,
            kg: Math.round(baseYield * (0.8 + noise(seed + y * 1.7 + 9) * 0.45)),
        }));

        parcels.push({
            id: `prc-${p.id.replace('mus-', '')}-${k + 1}`,
            producerId: p.id,
            producerName: p.fullName,
            region: p.region,
            district: p.district,
            neighborhood: NEIGHBORHOODS[(index + k) % NEIGHBORHOODS.length],
            ada: String(intBetween(100, 480, seed + 1)),
            parsel: String(intBetween(1, 240, seed + 3)),
            areaM2,
            organic: p.organic,
            verification,
            verifiedAt: verification === 'verified' ? dateDaysAgo(intBetween(20, 320, seed + 6)) : null,
            yieldHistory,
            photoCount: verification === 'unverified' ? 0 : intBetween(1, 6, seed + 8),
            hasOpenCorrection: noise(seed + 11) < 0.12,
            polygon: squareAround(region.lat, region.lng, areaM2, seed),
        });
    }
    return parcels;
}

export const PARCELS: Parcel[] = PRODUCERS.flatMap((p, i) => buildParcelsFor(p, i));

export function parcelsForProducer(producerId: string): Parcel[] {
    return PARCELS.filter((pc) => pc.producerId === producerId);
}

export function parcelById(id: string): Parcel | undefined {
    return PARCELS.find((pc) => pc.id === id);
}

export const VERIFICATION_META: Record<ParcelVerification, { label: string; tone: 'success' | 'warning' | 'danger' | 'muted' }> = {
    verified: { label: 'Doğrulandı', tone: 'success' },
    pending: { label: 'Onay bekliyor', tone: 'warning' },
    rejected: { label: 'Reddedildi', tone: 'danger' },
    unverified: { label: 'Doğrulanmadı', tone: 'muted' },
};

export interface ParcelSummary {
    total: number;
    verified: number;
    pending: number;
    rejected: number;
    unverified: number;
    totalAreaM2: number;
    openCorrections: number;
}

export function parcelSummary(list: Parcel[] = PARCELS): ParcelSummary {
    return {
        total: list.length,
        verified: list.filter((p) => p.verification === 'verified').length,
        pending: list.filter((p) => p.verification === 'pending').length,
        rejected: list.filter((p) => p.verification === 'rejected').length,
        unverified: list.filter((p) => p.verification === 'unverified').length,
        totalAreaM2: list.reduce((s, p) => s + p.areaM2, 0),
        openCorrections: list.filter((p) => p.hasOpenCorrection).length,
    };
}

export { VERIFY_STATES };
