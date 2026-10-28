/**
 * Garden age and renewal module (Bahçe yaşı ve yenileme): shapes of the engine's `age` bundle block.
 * Per tea parcel: Landsat yearly summer NDVI since 1984 (establishment year, renewal events, vigour
 * trend), Sentinel-2 monthly NDVI (harvest activity), abandonment and renewal-priority scores.
 */
export type AgeClass = 'under_10' | 'y10_25' | 'y25_40' | 'over_40' | 'not_tea' | 'unknown';
export type ActivityClass = 'harvested' | 'low' | 'none' | 'no_data';
export type AbandonClass = 'active' | 'weak' | 'likely_abandoned' | 'not_tea';
export type PriorityClass = 'high' | 'medium' | 'low' | 'not_applicable';

export const AGE_CLASSES: AgeClass[] = ['under_10', 'y10_25', 'y25_40', 'over_40', 'not_tea', 'unknown'];
export const ACTIVITY_CLASSES: ActivityClass[] = ['harvested', 'low', 'none', 'no_data'];
export const ABANDON_CLASSES: AbandonClass[] = ['active', 'weak', 'likely_abandoned', 'not_tea'];
export const PRIORITY_CLASSES: PriorityClass[] = ['high', 'medium', 'low', 'not_applicable'];

export interface ParcelAge {
    key: string;
    block: string;
    parcel: string;
    nature: string;
    areaM2: number;
    teaShare: number | null;
    series: { years: number[]; ndvi: Array<number | null>; smooth: Array<number | null>; obs: Array<number | null> };
    s2: { years: number[]; months: number[]; ndvi: Record<number, Array<number | null>>; dips: Record<number, number>; amplitude: Record<number, number | null> };
    establishment: { year: number | null; preRecord: boolean; confidence: 'high' | 'medium' | 'low'; note: string };
    ageYears: number | null;
    ageClass: AgeClass;
    renewals: Array<{ year: number; drop: number; recoveredIn: number }>;
    lastRenewalYear: number | null;
    vigour: { trendPerDecade: number | null; recentMean: number | null; peakMean: number | null; peakYears: string | null; declinePct: number | null };
    activity: { dipsPerYear: number | null; amplitude: number | null; class: ActivityClass };
    abandonment: { score: number; class: AbandonClass; reasons: string[] };
    priority: { score: number; class: PriorityClass; reasons: string[] };
}

export interface AgeSource {
    id: string;
    title: string;
    org: string;
    year: number | string;
    url: string;
    used: string;
}

export interface AgeSummaryCounts {
    parcels: number;
    teaAreaM2: number;
    byAgeClass: Record<AgeClass, number>;
    byActivity: Record<ActivityClass, number>;
    byAbandonment: Record<AbandonClass, number>;
    byPriority: Record<PriorityClass, number>;
    establishmentByDecade: Record<string, number>;
    renewalsByYear: Record<number, number>;
    meanAgeYears: number | null;
    medianEstablishmentYear: number | null;
    highPriorityAreaM2: number;
    likelyAbandonedAreaM2: number;
}

/** Area-level block stored on the area row (parcel rows carry their own `age`). */
export interface AgeBlock {
    calibrated: boolean;
    method: string;
    generatedAt: string;
    rules: Record<string, unknown>;
    sources: AgeSource[];
    summary: AgeSummaryCounts;
}
