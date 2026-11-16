/**
 * Screening thresholds. Not a tea detector and not legal evidence.
 *
 * Measured with scripts/ndvi-threshold-check.mjs on the Çataldere series (824 assessable parcel-years, no field labels):
 *   drop   "decline" on mirrored series   "review" on mirrored   lasting 0.15 drop caught   lasting 0.20 drop caught
 *   0.10        0                              75 (9.1 %)              88 %                       99 %
 *   0.12        0                              32 (3.9 %)              70 %                       97 %
 *   0.15        0                               4 (0.5 %)              32 %                       87 %
 *   0.20        0                               0                       3 %                       32 %
 * 0.12 is used: still no false "decline" on the mirror, and it catches a 0.15 drop twice as often as 0.15 did, at the
 * price of a few more "review" parcels. Change `drop` only with a new run of that script.
 */
export const NDVI_RULES = {
    minPixels: 6, // Reuse the conservative spatial support floor, not an accuracy claim.
    baselineYears: 5, minBaselineYears: 3, // Same-month medians reduce seasonal bias.
    minMonths: 4, drop: 0.12, // A drop this deep in two consecutive observed months.
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
export type NdviRules = { [K in keyof typeof NDVI_RULES]: number };
/** `rules` is a parameter so that scripts/ndvi-threshold-check.mjs can sweep thresholds with the code the service runs. */
export function monthlyEvidence(series: NdviSeries | null, year: number, rules: NdviRules = NDVI_RULES): NdviMonth[] {
    return (series?.months ?? []).map((month, i) => {
        const raw = series?.ndvi[year]?.[i];
        const value = valid(raw) ? raw : null;
        const past = (series?.years ?? []).filter(y => y < year && y >= year - rules.baselineYears)
            .map(y => series?.ndvi[y]?.[i]).filter(valid);
        const baseline = past.length >= rules.minBaselineYears ? median(past) : null;
        // Avoid binary floating point changing an exact threshold comparison.
        return { month, value, baseline, delta: value !== null && baseline !== null ? Math.round((value - baseline) * 1e6) / 1e6 : null, peerDelta: null };
    });
}
export function classifyNdvi(months: NdviMonth[], fullPixels: number, rules: NdviRules = NDVI_RULES): NdviStatus {
    if (fullPixels < rules.minPixels || months.filter(m => m.delta !== null).length < rules.minMonths) return 'insufficient';
    const pairs = months.filter((m, i) => i > 0 && m.month === months[i - 1].month + 1 && m.delta !== null && months[i - 1].delta !== null);
    const low = (m: NdviMonth) => m.delta !== null && m.delta <= -rules.drop;
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
