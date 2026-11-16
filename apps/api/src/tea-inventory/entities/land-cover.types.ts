/**
 * Land-cover module (engine: sample-cover + py/cover_experiments.py + py/cover_classify.py). Every parcel's 10 m pixels
 * are classified into cover classes; the parcel's tea reading and dominant cover come from the pixel shares. The model
 * card carries the comparison of data sources it was chosen from. Preliminary assessment, never a decision.
 */
export const COVER_CLASSES = ['tea', 'hazelnut', 'forest', 'grass', 'crop', 'built', 'other'] as const;
export type CoverClass = (typeof COVER_CLASSES)[number];
export const COVER_DOMINANT = [...COVER_CLASSES, 'mixed'] as const;
export type CoverDominant = (typeof COVER_DOMINANT)[number];
export const COVER_TEA_STATES = ['present', 'partial', 'absent', 'not_assessable'] as const;
export type CoverTeaState = (typeof COVER_TEA_STATES)[number];
export type CoverConfidence = 'high' | 'medium' | 'low';

export interface CoverStat { mean: number; sd: number }
export interface CoverComparisonRow {
    features: string;
    bands: number;
    learner: string;
    /** `cover`: all classes at once; `tea_only`: tea against everything else. */
    target: 'cover' | 'tea_only';
    accuracy: CoverStat;
    teaAccuracy: CoverStat;
    teaRecall: CoverStat;
    teaPrecision: CoverStat;
    teaF1: CoverStat;
}
export interface CoverModel {
    features: string;
    learner: string;
    bands: number;
    bandNames: string[];
    trainingPixels: Record<CoverClass, number>;
    trainingGroups: number;
    crossValidation: Pick<CoverComparisonRow, 'accuracy' | 'teaAccuracy' | 'teaRecall' | 'teaPrecision' | 'teaF1'>;
    /** Rows = true class, columns = predicted class, in COVER_CLASSES order. */
    confusion: number[][];
    teaThresholds: Array<{ threshold: number; recall: number; precision: number }>;
    calledTeaByClass: Record<CoverClass, number | null>;
    /** Held-out titled parcels read as a whole (tea share at or above the "present" band): the figure closest to how the module is used. */
    parcelLevel?: { teaParcels: number; otherParcels: number; teaFound: number; teaMissed: number; otherCalledTea: number; otherRight: number; accuracy: number; teaRecall: number; teaPrecision: number; byClass: Record<string, { parcels: number; calledTea: number }> } | null;
    comparison: CoverComparisonRow[];
    folds: number;
    topFeatures: Array<{ band: string; importance: number }>;
    maxTrainingTeaElevationM: number | null;
    validationNote: string;
}
export interface CoverParcel {
    key: string;
    block: string;
    parcel: string;
    nature: string;
    locality: string;
    areaM2: number;
    pixels: number;
    tea: CoverTeaState;
    teaShare: number | null;
    teaProbability: number | null;
    dominant: CoverDominant | null;
    dominantShare: number | null;
    shares: Record<CoverClass, number> | null;
    confidence: CoverConfidence | null;
    elevationM?: number;
    beyondTraining: boolean;
}
export interface LandCoverBlock {
    generatedAt: string;
    method: string;
    rules: Record<string, number>;
    classes: CoverClass[];
    labels: Record<CoverDominant, string>;
    model: CoverModel;
    summary: { parcels: number; assessed: number; byTea: Record<CoverTeaState, number>; byDominant: Record<CoverDominant, number>; byConfidence: Record<CoverConfidence, number>; teaAreaM2: number };
    parcels: CoverParcel[];
}
