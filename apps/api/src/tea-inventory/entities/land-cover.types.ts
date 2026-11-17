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
    /** Scores against areas a person marked on the site; null until such areas have been sampled by the engine. */
    fieldValidation?: { areas: number; pixels: number; byClass: Record<string, { areas: number; pixels: number }>; asIs: { teaAccuracy: number; coverAccuracy: number; teaRecall: number; teaPrecision: number; areaAccuracy: number; calledTeaByClass: Record<string, number> } | null; calibrated: { teaAccuracy: number; coverAccuracy: number; teaRecall: number; teaPrecision: number; areaAccuracy: number; calledTeaByClass: Record<string, number> } | null; note: string | null } | null;
    comparison: CoverComparisonRow[];
    folds: number;
    topFeatures: Array<{ band: string; importance: number }>;
    maxTrainingTeaElevationM: number | null;
    validationNote: string;
}
/** Reference-free cover group of a pixel or parcel (py/cover_groups.py): named from its own yearly greenness curve. */
export interface CoverGroup {
    name: string;
    label: string;
    note: string;
    pixels: number;
    share: number;
    clusters: number;
    centre: { ndvi: number; ndviLow: number; winter: number; summer: number; ratio: number; winterNir: number };
    /** Mean NDVI of the group per calendar month, January first. */
    monthly: number[];
}
export interface CoverUnsupervised {
    generatedAt: string;
    method: string;
    rules: Record<string, number>;
    pixels: number;
    groups: CoverGroup[];
    /** Where the pixels of clean deed titles fall; a plausibility note, not an accuracy measure. */
    titleConsistency: Record<string, { pixels: number; shares: Record<string, number> }> | null;
    byGroup: Record<string, number>;
    /** Parcels by trained tea reading (present / partial / absent) and reference-free group. */
    againstTrained: Record<string, Record<string, number>>;
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
    /** Dominant reference-free group and the group shares; null without the grouping or below the pixel floor. */
    group?: string | null;
    groupShares?: Record<string, number> | null;
}
export interface LandCoverBlock {
    generatedAt: string;
    method: string;
    rules: Record<string, number>;
    classes: CoverClass[];
    labels: Record<CoverDominant, string>;
    model: CoverModel;
    unsupervised?: CoverUnsupervised | null;
    summary: { parcels: number; assessed: number; byTea: Record<CoverTeaState, number>; byDominant: Record<CoverDominant, number>; byConfidence: Record<CoverConfidence, number>; teaAreaM2: number };
    parcels: CoverParcel[];
}
