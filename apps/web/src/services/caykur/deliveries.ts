/**
 * Fresh-tea intake / delivery layer (Faz 4). Each producer's season volume is
 * split into dated delivery slips (alım fişi) across the three sürgün periods,
 * each booked at the producer's assigned purchase point. Net kg per producer
 * reconciles to the producer's seasonKg, so totals match the overview.
 */

import { PRODUCERS, type Producer, type Region } from '@/services/caykurData';
import { purchasePointForProducer } from '@/services/caykur/org';
import { DEMO_TODAY, intBetween, noise, pad, round, seasonDate } from '@/services/caykur/rng';

export type DeliveryStatus = 'approved' | 'pending' | 'corrected' | 'rejected';
/** 1./2./3. flush. */
export type Surgun = 1 | 2 | 3;
/** Leaf grade. */
export type LeafGrade = '1. Kalite' | '2. Kalite' | '3. Kalite';

export interface Delivery {
    id: string;
    receiptNo: string;
    producerId: string;
    producerName: string;
    ruhsatNo: string;
    region: Region;
    factory: string;
    purchasePointId: string;
    purchasePointName: string;
    date: string;
    surgun: Surgun;
    grossKg: number;
    firePct: number;
    netKg: number;
    grade: LeafGrade;
    status: DeliveryStatus;
    recordedBy: string;
}

const SURGUN_WINDOWS: Record<Surgun, { months: [number, number]; label: string }> = {
    1: { months: [5, 6], label: '1. Sürgün' },
    2: { months: [7, 8], label: '2. Sürgün' },
    3: { months: [9, 10], label: '3. Sürgün' },
};

export const SURGUN_LABEL: Record<Surgun, string> = {
    1: '1. Sürgün',
    2: '2. Sürgün',
    3: '3. Sürgün',
};

function gradeFor(p: Producer, seed: number): LeafGrade {
    const base = p.outOfStandardPct + (noise(seed) - 0.5) * 8;
    if (base <= 6) return '1. Kalite';
    if (base <= 13) return '2. Kalite';
    return '3. Kalite';
}

/** A delivery dated on/after the frozen demo day cannot yet be approved. */
function isFutureOrToday(dateIso: string): boolean {
    return new Date(dateIso).getTime() >= DEMO_TODAY.getTime();
}

function buildDeliveriesFor(p: Producer, index: number): Delivery[] {
    const point = purchasePointForProducer(p.id);
    if (!point) return [];

    const deliveries: Delivery[] = [];
    const surgunKg: Record<Surgun, number> = { 1: p.surgun.s1, 2: p.surgun.s2, 3: p.surgun.s3 };

    (Object.keys(surgunKg) as unknown as Surgun[]).forEach((s) => {
        const sNum = Number(s) as Surgun;
        const total = surgunKg[sNum];
        if (total <= 0) return;
        const win = SURGUN_WINDOWS[sNum];
        const slips = intBetween(2, 4, index * 7 + sNum * 3);
        let remaining = total;

        for (let k = 0; k < slips; k++) {
            const last = k === slips - 1;
            const seed = index * 31 + sNum * 11 + k * 5;
            const share = last ? 1 : 0.45 + noise(seed) * 0.3;
            const netKg = last ? remaining : Math.max(0, Math.round(remaining * share));
            remaining -= netKg;
            if (netKg <= 0 && !last) continue;

            const month = win.months[k % 2];
            const day = intBetween(2, 27, seed + 1);
            const date = seasonDate(month, day);

            // 3rd sürgün near "today": some slips still awaiting approval; a few
            // earlier slips are corrected or (rarely) rejected.
            let status: DeliveryStatus;
            if (isFutureOrToday(date) || (sNum === 3 && noise(seed + 2) < 0.35)) {
                status = 'pending';
            } else {
                const r = noise(seed + 3);
                status = r < 0.06 ? 'rejected' : r < 0.16 ? 'corrected' : 'approved';
            }

            const firePct = round(2 + noise(seed + 4) * 6, 1);
            const grossKg = Math.round(netKg / (1 - firePct / 100));

            deliveries.push({
                id: `dlv-${p.id.replace('mus-', '')}-${sNum}-${k + 1}`,
                receiptNo: `${point.region.slice(0, 2).toLocaleUpperCase('tr')}-${seasonDate(month, day).replace(/-/g, '')}-${pad(intBetween(1, 999, seed + 6), 3)}`,
                producerId: p.id,
                producerName: p.fullName,
                ruhsatNo: p.ruhsatNo,
                region: p.region,
                factory: p.factory,
                purchasePointId: point.id,
                purchasePointName: point.name,
                date,
                surgun: sNum,
                grossKg,
                firePct,
                netKg,
                grade: gradeFor(p, seed + 7),
                status,
                recordedBy: point.collectorName,
            });
        }
    });

    return deliveries.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export const DELIVERIES: Delivery[] = PRODUCERS
    .flatMap((p, i) => buildDeliveriesFor(p, i))
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first

export function deliveriesForProducer(producerId: string): Delivery[] {
    return DELIVERIES.filter((d) => d.producerId === producerId);
}

export function deliveriesForPoint(pointId: string): Delivery[] {
    return DELIVERIES.filter((d) => d.purchasePointId === pointId);
}

export function deliveryById(id: string): Delivery | undefined {
    return DELIVERIES.find((d) => d.id === id);
}

export function pendingDeliveries(): Delivery[] {
    return DELIVERIES.filter((d) => d.status === 'pending');
}

export const STATUS_META: Record<DeliveryStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
    approved: { label: 'Onaylandı', tone: 'success' },
    pending: { label: 'Onay bekliyor', tone: 'warning' },
    corrected: { label: 'Düzeltildi', tone: 'info' },
    rejected: { label: 'Reddedildi', tone: 'danger' },
};

export interface DailyTotal {
    date: string;
    pointId: string;
    pointName: string;
    region: Region;
    slips: number;
    netKg: number;
    producers: number;
}

/** Per-point daily intake totals, newest day first. */
export function dailyTotals(pointId?: string): DailyTotal[] {
    const src = pointId ? deliveriesForPoint(pointId) : DELIVERIES;
    const byKey = new Map<string, Delivery[]>();
    for (const d of src) {
        const key = `${d.date}__${d.purchasePointId}`;
        const list = byKey.get(key) ?? [];
        list.push(d);
        byKey.set(key, list);
    }
    return Array.from(byKey.values())
        .map((list) => ({
            date: list[0].date,
            pointId: list[0].purchasePointId,
            pointName: list[0].purchasePointName,
            region: list[0].region,
            slips: list.length,
            netKg: list.reduce((s, d) => s + d.netKg, 0),
            producers: new Set(list.map((d) => d.producerId)).size,
        }))
        .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export interface DeliverySummary {
    totalNetKg: number;
    totalSlips: number;
    approvedKg: number;
    pendingKg: number;
    pendingSlips: number;
    avgFirePct: number;
}

export function deliverySummary(list: Delivery[] = DELIVERIES): DeliverySummary {
    const approvedKg = list.filter((d) => d.status === 'approved').reduce((s, d) => s + d.netKg, 0);
    const pending = list.filter((d) => d.status === 'pending');
    const totalFire = list.reduce((s, d) => s + d.firePct, 0);
    return {
        totalNetKg: list.reduce((s, d) => s + d.netKg, 0),
        totalSlips: list.length,
        approvedKg,
        pendingKg: pending.reduce((s, d) => s + d.netKg, 0),
        pendingSlips: pending.length,
        avgFirePct: list.length ? round(totalFire / list.length, 1) : 0,
    };
}
