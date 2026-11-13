/**
 * Licence audit block (separate module under licensing): per cadastral parcel, the TKGM deed title, ÇAYKUR's licence
 * register and a title-independent satellite detection are set side by side and bound to one decision.
 * It reads the other modules' data and changes none of it. The result is a flag for an expert, not a legal verdict.
 */
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';

export type AuditTeaState = 'present' | 'absent' | 'inconclusive' | 'not_assessable';
export type AuditBuildingState = 'inside' | 'boundary' | 'none' | 'unknown';
export type AuditConfidence = 'high' | 'medium' | 'low';
/** T = title says tea, L = licensed, D = tea detected on the ground. */
export type AuditDecision =
    | 'tea_land' // T L D
    | 'licensing_error' // ¬T L ¬D
    | 'unlicensed_tea' // ¬T ¬L D
    | 'unlicensed_tea_titled' // T ¬L D
    | 'licence_no_tea' // T L ¬D
    | 'title_outdated' // ¬T L D
    | 'title_only' // T ¬L ¬D
    | 'out_of_scope' // ¬T ¬L ¬D
    | 'needs_review';
export const AUDIT_DECISIONS: AuditDecision[] = ['tea_land', 'licensing_error', 'unlicensed_tea', 'unlicensed_tea_titled', 'licence_no_tea', 'title_outdated', 'title_only', 'out_of_scope', 'needs_review'];
/** Findings against someone: shown first, they are what the audit exists for. */
export const AUDIT_FINDINGS: AuditDecision[] = ['licensing_error', 'unlicensed_tea', 'unlicensed_tea_titled', 'licence_no_tea'];
export type AuditFlag = 'area_over' | 'area_under' | 'building_not_in_title' | 'title_building_not_seen' | 'public_land' | 'beyond_training' | 'small_parcel' | 'detectors_disagree' | 'expert_confirmed' | 'licence_unverified' | 'large_parcel';
export const AUDIT_FLAGS: AuditFlag[] = ['area_over', 'area_under', 'building_not_in_title', 'title_building_not_seen', 'public_land', 'beyond_training', 'small_parcel', 'detectors_disagree', 'expert_confirmed', 'licence_unverified', 'large_parcel'];
export type AuditConsistency = 'match' | 'title_only' | 'ground_only' | 'unknown';

export interface AuditTitleReading {
    tea: boolean;
    building: boolean;
    publicLand: boolean;
    uses: string[];
}

export interface AuditParcel {
    key: string;
    block: string;
    parcel: string;
    /** TKGM deed title ("nitelik"), as returned by the parcel query. */
    nature: string;
    locality: string;
    areaM2: number;
    deedAreaM2: number | null;
    title: AuditTitleReading;
    detection: {
        tea: AuditTeaState;
        teaShare: number | null;
        teaAreaM2: number | null;
        teaProbability: number | null;
        inventoryShare: number | null;
        fullPixels: number;
        beyondTraining: boolean;
        ndviSummer: number | null;
        ndviLeafOff: number | null;
        evergreen: number | null;
        vhSummer: number | null;
        elevationM: number | null;
        leafOffObs: number | null;
    };
    building: { state: AuditBuildingState; count: number; insideM2: number; source: string };
    licence: { licensed: boolean; areaM2: number | null; codes: string[]; source: 'demo' | 'caykur' | 'none' };
    /** Ground observation by a person (expert confirmation or field note); a null side was not observed. */
    confirmation: { tea: boolean | null; building: boolean | null; sparse: boolean; source: string; note: string; date: string } | null;
    decision: AuditDecision;
    leaning: Exclude<AuditDecision, 'needs_review'>;
    confidence: AuditConfidence;
    flags: AuditFlag[];
    consistency: { tea: AuditConsistency; building: AuditConsistency };
    reason: string;
    geometry: Polygon | MultiPolygon;
}

export interface AuditModel {
    type: string;
    period: { start: string; end: string };
    features: number;
    threshold: number;
    trainingParcels: { tea: number; nonTea: number; neighborhoods: string[] };
    trainPixels: Record<string, number>;
    testPixels: Record<string, number>;
    heldOut: { accuracy: number; kappa: number; teaRecall: number; teaPrecision: number; confusion: number[][] };
    byElevation: Array<{ band: string; pixels: { nonTea: number; tea: number }; accuracy: number | null; teaRecall: number | null; teaPrecision: number | null }>;
    byGroup: Array<{ group: string; pixels: number; calledTea: Record<string, number | null> }>;
    maxTrainingTeaElevationM: number | null;
    topFeatures: Array<{ band: string; importance: number }>;
}

export interface AuditSummary {
    parcels: number;
    byDecision: Record<AuditDecision, number>;
    byConfidence: Record<AuditConfidence, number>;
    byLeaning: Record<string, number>;
    flags: Partial<Record<AuditFlag, number>>;
    titleVsGround: { titleTeaGroundTea: number; titleTeaGroundNone: number; titleOtherGroundTea: number; titleOtherGroundNone: number; unknown: number };
    areaM2: { unlicensedTea: number; licensedNoTea: number };
}

export interface LicenceAuditBlock {
    generatedAt: string;
    method: string;
    rules: Record<string, number>;
    evidenceRules: Record<string, unknown>;
    model: AuditModel;
    licenceSource: 'demo' | 'caykur';
    /** How the demo register was put together (null with ÇAYKUR's real list). */
    demoLicences: { rules: Record<string, unknown>; byOrigin: Record<string, number>; byScenario: Record<string, number>; note: string } | null;
    /** Field notes that say "tea" against what the satellite reads on its own. */
    fieldCheck: { notes: number; teaNoted: number; teaNotedDetected: number; teaNotedInconclusive: number; teaNotedMissed: number; titleMismatch: number } | null;
    buildingSource: string;
    summary: AuditSummary;
    parcels: AuditParcel[];
    buildings: FeatureCollection<Polygon | MultiPolygon, { areaM2: number }>;
}
