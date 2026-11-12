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

export interface PruningCombinedBlock {
    seasons: CombinedSeason[];
}
