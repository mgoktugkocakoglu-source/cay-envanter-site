/**
 * Combined pruning verdict block (separate module): one verdict per garden from the multi-sensor module and the
 * pixel scan together. It reads the two modules' outputs and changes neither; purchase decisions stay with fusion.
 */

export type CombinedClass = 'confirmed' | 'probable' | 'light' | 'none' | 'no_data';
export type CombinedAgreement = 'both' | 'both_other_dates' | 'fusion_only' | 'pixel_only' | 'neither';
export type CombinedProducerStatus = 'met' | 'met_with_probable' | 'partial' | 'light_only' | 'none' | 'no_license';
export type CombinedAreaSource = 'pixel_scan' | 'change_patch' | 'ndvi_fraction';

export interface CombinedGarden {
    id: string;
    producerId: string;
    areaM2: number;
    licensedAreaM2: number | null;
    class: CombinedClass;
    kind: 'deep' | 'light' | null;
    agreement: CombinedAgreement;
    bracket: { from: string; to: string } | null;
    area: { m2: number; lowM2: number; highM2: number; source: CombinedAreaSource } | null;
    countedM2: number;
    fusion: { class: string; kind: string | null; z: number | null; changeDate: string | null; lastBeforeAt: string | null; firstAfterAt: string | null; unit: string; unitAreaM2: number; reusedShare: number };
    pixel: { verdict: string; date: string | null; lastBefore: string | null; score: number | null; prunedM2: number; clusters: number; kind: string | null; confidence: string | null } | null;
    radar: { coherenceZ: number | null; vhZ: number | null; witness: boolean } | null;
    reason: string;
}

export interface CombinedProducer {
    id: string;
    licensedAreaM2: number;
    requiredM2: number;
    confirmedM2: number;
    probableM2: number;
    lightM2: number;
    countedM2: number;
    shortfallM2: number;
    gardens: number;
    confirmedGardens: string[];
    probableGardens: string[];
    lightGardens: string[];
    status: CombinedProducerStatus;
    fusionDecision: string | null;
}

export interface CombinedRate {
    hit: number;
    n: number;
    rate: number | null;
}
export interface CombinedValidation {
    season: string;
    generatedAt: string;
    gardens: number;
    falseAlarms: { confirmed: number; probable: number; light: number; note: string };
    detection: { trials: number; note: string; rows: Array<{ key: string; overall: CombinedRate; deep: CombinedRate; light: CombinedRate; clear: CombinedRate }> };
}

export interface CombinedSeason {
    season: string;
    generatedAt: string;
    method: string;
    rules: Record<string, number>;
    sources: { fusion: boolean; pixel: boolean; radarCheck: boolean };
    summary: {
        gardens: number;
        byClass: Record<CombinedClass, number>;
        byAgreement: Record<CombinedAgreement, number>;
        areaM2: { confirmed: number; probable: number; light: number; lowM2: number; highM2: number };
        radarWitness: { confirmed: number; probable: number; light: number };
        producers: Record<CombinedProducerStatus, number>;
        producersChanged: number;
    };
    validation: CombinedValidation | null;
    gardens: CombinedGarden[];
    producers: CombinedProducer[];
}

/** Retrospective check: how a detection behaves in the neighbouring seasons, which its own verdict did not use. */
export type FollowUpStatus = 'pattern' | 'slow' | 'permanent' | 'repeating' | 'no_followup' | 'not_seen';
export interface CombinedFollowUp {
    status: FollowUpStatus;
    unit: 'cluster' | 'garden';
    pixels: number;
    drop: number | null;
    recoveredShare: number | null;
    repeatPrev: boolean | null;
    repeatNext: boolean | null;
}
export type FollowUpCounts = Record<FollowUpStatus, number>;
export interface HistoryPrecision {
    evaluated: number;
    pattern: number;
    share: number | null;
}
export interface CombinedHistorySeason {
    season: string;
    hasFollowUp: boolean;
    byClass: Record<'confirmed' | 'probable' | 'light', FollowUpCounts>;
    mirror: { pixel: FollowUpCounts; fusion: FollowUpCounts } | null;
    real: Record<'confirmed' | 'probable' | 'light' | 'counted', HistoryPrecision>;
    falsePassRate: HistoryPrecision | null;
    precisionFloor: number | null;
}
export interface RepeatedGround {
    a: string;
    b: string;
    share: number;
    m2: number;
}
export interface CombinedHistoryGarden {
    id: string;
    producerId: string;
    seasons: Record<string, { class: CombinedClass; countedM2: number; followUp: CombinedFollowUp | null }>;
    repeatedGround: RepeatedGround[];
}
export type MultiYearStatus = 'on_track' | 'behind' | 'none' | 'no_license';
export interface CombinedHistoryProducer {
    id: string;
    licensedAreaM2: number;
    bySeason: Record<string, { countedM2: number; requiredM2: number; status: string }>;
    cumulativeM2: number;
    repeatedM2: number;
    netM2: number;
    requiredM2: number;
    seasonsMet: number;
    status: MultiYearStatus;
}
export interface CombinedHistory {
    generatedAt: string;
    method: string;
    rules: Record<string, number>;
    seasons: CombinedHistorySeason[];
    multiYear: { seasons: string[]; gardensRepeated: number; repeatedM2: number; producers: Record<MultiYearStatus, number> };
    gardens: CombinedHistoryGarden[];
    producers: CombinedHistoryProducer[];
}

export interface PruningCombinedBlock {
    seasons: CombinedSeason[];
    history?: CombinedHistory | null;
}
