/** Screening thresholds, not calibrated tea detection or legal evidence. */
export const NDVI_RULES = {
    minPixels: 6, // Reuse the conservative spatial support floor, not an accuracy claim.
    baselineYears: 5, minBaselineYears: 3, // Same-month medians reduce seasonal bias.
    minMonths: 4, drop: 0.15, // Require substantial change across consecutive observed months.
    minPeers: 10, // Sparse neighbourhood references are left unknown.
} as const;
export type NdviStatus = 'stable' | 'decline' | 'recovery' | 'review' | 'insufficient';
export interface NdviSeries { years: number[]; months: number[]; ndvi: Record<number, Array<number | null>> }
export interface NdviMonth { month: number; value: number | null; baseline: number | null; delta: number | null; peerDelta: number | null }
export function median(values: number[]): number | null {
    const a = [...values].sort((x, y) => x - y);
    return a.length ? (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2 : null;
}
const valid = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= -1 && v <= 1;
export function monthlyEvidence(series: NdviSeries | null, year: number): NdviMonth[] {
    return (series?.months ?? []).map((month, i) => {
        const raw = series?.ndvi[year]?.[i];
        const value = valid(raw) ? raw : null;
        const past = (series?.years ?? []).filter(y => y < year && y >= year - NDVI_RULES.baselineYears)
            .map(y => series?.ndvi[y]?.[i]).filter(valid);
        const baseline = past.length >= NDVI_RULES.minBaselineYears ? median(past) : null;
        // Avoid binary floating point changing an exact threshold comparison.
        return { month, value, baseline, delta: value !== null && baseline !== null ? Math.round((value - baseline) * 1e6) / 1e6 : null, peerDelta: null };
    });
}
export function classifyNdvi(months: NdviMonth[], fullPixels: number): NdviStatus {
    if (fullPixels < NDVI_RULES.minPixels || months.filter(m => m.delta !== null).length < NDVI_RULES.minMonths) return 'insufficient';
    const pairs = months.filter((m, i) => i > 0 && m.month === months[i - 1].month + 1 && m.delta !== null && months[i - 1].delta !== null);
    const low = (m: NdviMonth) => m.delta !== null && m.delta <= -NDVI_RULES.drop;
    const persistent = pairs.filter(m => low(m) && low(months[months.indexOf(m) - 1]));
    if (persistent.length) {
        const lastDrop = persistent[persistent.length - 1].month;
        const latest = months.filter(m => m.delta !== null).slice(-1)[0];
        // A later isolated or missing observation cannot silently confirm persistence/recovery.
        if (latest?.month === lastDrop) return 'decline';
        if (pairs.some(m => m === latest && m.month > lastDrop && !low(m) && !low(months[months.indexOf(m) - 1]))) return 'recovery';
        return 'review';
    }
    return months.some(low) ? 'review' : 'stable';
}
