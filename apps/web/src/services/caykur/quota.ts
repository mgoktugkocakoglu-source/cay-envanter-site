/**
 * Quota layer (Faz 5). Annual purchase quota per producer (kota), derived from
 * licensed area, with season usage, remaining headroom and revision requests.
 * Usage mirrors the producer registry's kota model exactly.
 */

import { PRODUCERS, type Producer, type Region, kotaUsagePct } from '@/services/caykurData';
import { dateDaysAgo, intBetween, noise, round } from '@/services/caykur/rng';

export type QuotaStatus = 'normal' | 'critical' | 'over';

export interface QuotaRecord {
    producerId: string;
    producerName: string;
    ruhsatNo: string;
    region: Region;
    factory: string;
    organic: boolean;
    licensedDekar: number;
    quotaPerDekar: number;
    quotaKg: number;
    usedKg: number;
    remainingKg: number;
    usagePct: number;
    status: QuotaStatus;
}

export function quotaStatus(usagePct: number): QuotaStatus {
    if (usagePct > 100) return 'over';
    if (usagePct >= 90) return 'critical';
    return 'normal';
}

export const QUOTA_STATUS_META: Record<QuotaStatus, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
    normal: { label: 'Normal', tone: 'success' },
    critical: { label: 'Kritik', tone: 'warning' },
    over: { label: 'Aşıldı', tone: 'danger' },
};

function buildRecord(p: Producer): QuotaRecord {
    const quotaPerDekar = p.organic ? 1500 : 2000;
    const usagePct = kotaUsagePct(p);
    return {
        producerId: p.id,
        producerName: p.fullName,
        ruhsatNo: p.ruhsatNo,
        region: p.region,
        factory: p.factory,
        organic: p.organic,
        licensedDekar: p.licensedDekar,
        quotaPerDekar,
        quotaKg: p.quotaKg,
        usedKg: p.seasonKg,
        remainingKg: p.quotaKg - p.seasonKg,
        usagePct,
        status: quotaStatus(usagePct),
    };
}

export const QUOTA_RECORDS: QuotaRecord[] = PRODUCERS.map(buildRecord)
    .sort((a, b) => b.usagePct - a.usagePct);

export function quotaForProducer(producerId: string): QuotaRecord | undefined {
    return QUOTA_RECORDS.find((q) => q.producerId === producerId);
}

// ── Revision requests (kota revizyon talepleri) ─────────────────────────────

export type RevisionStatus = 'open' | 'approved' | 'rejected';

export interface QuotaRevision {
    id: string;
    producerId: string;
    producerName: string;
    region: Region;
    currentQuotaKg: number;
    requestedQuotaKg: number;
    reason: string;
    status: RevisionStatus;
    createdAt: string;
    decidedAt: string | null;
}

const REVISION_REASONS = [
    'Yeni ruhsatlı alan ilavesi',
    'Budama sonrası verim artışı',
    'Komşu parsel devralındı',
    'Ölçüm hatası düzeltmesi',
    'Organik geçiş tamamlandı',
];

export const REVISION_STATUS_META: Record<RevisionStatus, { label: string; tone: 'warning' | 'success' | 'danger' }> = {
    open: { label: 'İnceleniyor', tone: 'warning' },
    approved: { label: 'Onaylandı', tone: 'success' },
    rejected: { label: 'Reddedildi', tone: 'danger' },
};

function buildRevisions(): QuotaRevision[] {
    // Producers near or over quota are the credible revision requesters.
    const candidates = QUOTA_RECORDS.filter((q) => q.usagePct >= 88).slice(0, 11);
    return candidates.map((q, i) => {
        const seed = i * 5 + 3;
        const uplift = 1 + (0.1 + noise(seed) * 0.25);
        const r = noise(seed + 2);
        const status: RevisionStatus = r < 0.45 ? 'open' : r < 0.78 ? 'approved' : 'rejected';
        const createdAgo = intBetween(5, 60, seed + 4);
        return {
            id: `kvr-${String(i + 1).padStart(3, '0')}`,
            producerId: q.producerId,
            producerName: q.producerName,
            region: q.region,
            currentQuotaKg: q.quotaKg,
            requestedQuotaKg: Math.round((q.quotaKg * uplift) / 50) * 50,
            reason: REVISION_REASONS[(i + Math.floor(noise(seed + 6) * 5)) % REVISION_REASONS.length],
            status,
            createdAt: dateDaysAgo(createdAgo),
            decidedAt: status === 'open' ? null : dateDaysAgo(Math.max(1, createdAgo - intBetween(2, 8, seed + 7))),
        };
    });
}

export const QUOTA_REVISIONS: QuotaRevision[] = buildRevisions();

export interface QuotaSummary {
    totalQuotaKg: number;
    totalUsedKg: number;
    usagePct: number;
    overCount: number;
    criticalCount: number;
    openRevisions: number;
}

export function quotaSummary(list: QuotaRecord[] = QUOTA_RECORDS): QuotaSummary {
    const totalQuotaKg = list.reduce((s, q) => s + q.quotaKg, 0);
    const totalUsedKg = list.reduce((s, q) => s + q.usedKg, 0);
    return {
        totalQuotaKg,
        totalUsedKg,
        usagePct: totalQuotaKg > 0 ? round((totalUsedKg / totalQuotaKg) * 100, 1) : 0,
        overCount: list.filter((q) => q.status === 'over').length,
        criticalCount: list.filter((q) => q.status === 'critical').length,
        openRevisions: QUOTA_REVISIONS.filter((r) => r.status === 'open').length,
    };
}

/** Region rollup for the quota dashboard. */
export interface QuotaRegionRollup {
    region: Region;
    producerCount: number;
    quotaKg: number;
    usedKg: number;
    usagePct: number;
    overCount: number;
}

export function quotaByRegion(list: QuotaRecord[] = QUOTA_RECORDS): QuotaRegionRollup[] {
    const regions: Region[] = ['Rize', 'Trabzon', 'Artvin', 'Giresun'];
    return regions
        .map((region) => {
            const rl = list.filter((q) => q.region === region);
            const quotaKg = rl.reduce((s, q) => s + q.quotaKg, 0);
            const usedKg = rl.reduce((s, q) => s + q.usedKg, 0);
            return {
                region,
                producerCount: rl.length,
                quotaKg,
                usedKg,
                usagePct: quotaKg > 0 ? round((usedKg / quotaKg) * 100, 1) : 0,
                overCount: rl.filter((q) => q.status === 'over').length,
            };
        })
        .filter((r) => r.producerCount > 0);
}
