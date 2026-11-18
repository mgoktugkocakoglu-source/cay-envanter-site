/**
 * Land-cover module (engine: sample-cover + py/cover_experiments.py + py/cover_classify.py). Every parcel's 10 m pixels
 * are classified into cover classes; the parcel's tea reading and dominant cover come from the pixel shares. The model
 * card carries the comparison of data sources it was chosen from. Preliminary assessment, never a decision.
 */
/** What the method can tell apart from canopy height and winter greenness. Hazelnut and forest are both tree cover. */
export const COVER_CLASSES = ['tea', 'trees', 'open', 'built'] as const;
/** What a person can mark on the site; finer than the model's classes, so the marks stay useful if the classes grow. */
export const COVER_LABEL_CLASSES = ['tea', 'hazelnut', 'forest', 'grass', 'crop', 'built', 'other'] as const;
export type CoverLabelClass = (typeof COVER_LABEL_CLASSES)[number];
export type CoverClass = (typeof COVER_CLASSES)[number];
export const COVER_DOMINANT = [...COVER_CLASSES, 'mixed'] as const;
export type CoverDominant = (typeof COVER_DOMINANT)[number];
export const COVER_TEA_STATES = ['present', 'partial', 'absent', 'not_assessable'] as const;
export type CoverTeaState = (typeof COVER_TEA_STATES)[number];
export type CoverConfidence = 'high' | 'medium' | 'low';

export interface CoverReferenceScore { teaFound: number; teaTotal: number; noTeaRight: number; noTeaTotal: number; accuracy: number; balanced: number }
/** One method scored on the independent reference parcels (people's readings, never deed titles). */
export interface CoverComparisonRow extends CoverReferenceScore {
    key: string;
    label: string;
    description: string;
    /** The same score with the disputed "no tea" readings left out. */
    undisputed: CoverReferenceScore;
}
export interface CoverModel {
    method: string;
    learner: string;
    bands: number;
    /** Consensus-labelled pixels per class the model was trained on, and pixels the two physical facts left unlabelled. */
    trainingPixels: Record<CoverClass, number>;
    unlabelledPixels: number;
    markedPixels: number;
    reference: { parcels: number; tea: number; noTea: number; drone: number; field: number; disputed: string[]; note: string };
    comparison: CoverComparisonRow[];
    used: CoverComparisonRow | null;
    /** The earlier title-trained study, scored against titles: kept to show why that figure misleads. */
    titleStudy: { features: string; learner: string; teaAccuracy: number; teaRecall: number; teaPrecision: number; note: string } | null;
    /** Scores against areas a person marked on the site; null until such areas have been sampled by the engine. */
    fieldValidation: { areas: number; pixels: number; byClass: Record<string, { areas: number; pixels: number }>; asIs: { teaAccuracy: number; coverAccuracy: number; teaRecall: number; teaPrecision: number; areaAccuracy: number; calledTeaByClass: Record<string, number> } | null; calibrated: { teaAccuracy: number; coverAccuracy: number; teaRecall: number; teaPrecision: number; areaAccuracy: number; calledTeaByClass: Record<string, number> } | null; note: string | null } | null;
    sources: Array<{ name: string; role: string }>;
    validationNote: string;
}
export type CoverFlag = 'tea_under_canopy' | 'evergreen_open_not_tea' | 'rule_disagrees' | 'high_altitude_rule';
export interface CoverEvidence { canopyHeightM: number; tallShare: number; winterRatio: number; ruleTeaShare: number; ruleState: 'present' | 'partial' | 'absent' }
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
    /** Canopy and winter evidence of the parcel, beside the model's reading. */
    evidence?: CoverEvidence | null;
    flags?: CoverFlag[];
    /** Dominant reference-free group and the group shares; null without the grouping or below the pixel floor. */
    group?: string | null;
    groupShares?: Record<string, number> | null;
}
export interface LandCoverBlock {
    generatedAt: string;
    /** 2 = consensus-labelled method. Older bundles are not shown. */
    version?: number;
    method: string;
    rules: Record<string, number>;
    classes: CoverClass[];
    labels: Record<CoverDominant, string>;
    model: CoverModel;
    unsupervised?: CoverUnsupervised | null;
    summary: { parcels: number; assessed: number; byTea: Record<CoverTeaState, number>; byDominant: Record<CoverDominant, number>; byConfidence: Record<CoverConfidence, number>; byFlag: Record<CoverFlag, number>; teaAreaM2: number; titleTea: Record<'present' | 'partial' | 'absent', number>; titleOther: Record<'present' | 'partial' | 'absent', number> };
    parcels: CoverParcel[];
}
