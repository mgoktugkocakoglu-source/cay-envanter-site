/**
 * Drone-supported land verification block (separate module under licensing): what the record says about a parcel
 * (deed title, licence) against what drone imagery shows on it, with the evidence frames and the limits of the source.
 * It reads the licence audit for the record side and changes no other module. Results are preliminary assessments:
 * a mismatch only asks for a field check, it is never an administrative decision.
 */
export type DroneSourceKind = 'video' | 'orthophoto' | 'point_cloud' | 'multispectral' | 'surface_model';
/** How a source is tied to the ground: none → approximate (hand-fitted) → gnss (metres) → rtk_ppk (centimetres). */
export type DroneGeoreference = 'none' | 'approximate' | 'gnss' | 'rtk_ppk';
export type DroneClass = 'tea_present' | 'tea_not_found' | 'partial' | 'uncertain';
export const DRONE_CLASSES: DroneClass[] = ['tea_present', 'tea_not_found', 'partial', 'uncertain'];
export type DroneStatus = 'consistent' | 'needs_review' | 'not_analysed';
export type DroneConfidence = 'high' | 'medium' | 'low';

export interface DroneSource {
    id: string;
    title: string;
    kind: DroneSourceKind;
    georeference: DroneGeoreference;
    capturedAt: string;
    capturedAtNote: string;
    origin: string;
    platform: string | null;
    sensor: string | null;
    groundSampleCm: number | null;
    horizontalAccuracyCm: number | null;
}

export interface DroneFrame {
    /** Video time of the frame, seconds. */
    t: number;
    isReference: boolean;
    pixels: number;
    inliers: number | null;
    sharpness: number;
    shares: Record<string, number>;
    /** File names under `imageryBaseUrl`: the clean crop and the same crop tinted by class. */
    frame: string;
    classes: string;
}

export interface DroneCapture {
    width: number;
    height: number;
    fps: number;
    durationS: number;
    bitrateMbps: number;
    shot: [number, number];
    sharpnessMedian: number;
    shiftPerSecondShare: number | null;
    overlapAtOneSecond: number | null;
    hasFlightLog: boolean;
    hasCameraCalibration: boolean;
    georeference: DroneGeoreference;
}

export interface DroneValidation {
    method: string;
    classes: string[];
    frames: number[];
    pixels: number;
    accuracy: number;
    teaRecall: number;
    teaPrecision: number;
    confusion: number[][];
    trainingRectangles: Record<string, number>;
    referenceAreas: Array<{ t: number; label: string; rect: number[]; teaShare: number }>;
    referenceTeaRange: [number, number, number] | null;
    referenceOtherRange: [number, number, number] | null;
    transfer: { frames: number[]; pixels: number; accuracy: number; teaRecall: number; teaPrecision: number; confusion: number[][]; note: string } | null;
    topFeatures: Array<{ feature: string; importance: number }>;
    /** False when the classifier missed its own bar: its classes are shown as experimental and do not colour the map. */
    usable: boolean;
}

/**
 * Approximate orthophoto of the video (py/drone_ortho.py): each ground cell coloured from the solved frame that sees
 * it best, through the sparse ground surface. A map-aligned view for a reviewer; not a survey product.
 */
export interface DroneOrthophoto {
    image: string;
    width: number;
    height: number;
    resolutionM: number;
    /** [lon, lat] corners (WGS84). */
    bounds: { southWest: [number, number]; northEast: [number, number] };
    coveredHa: number;
    framesUsed: number;
    shot: [number, number];
    georefRmsM: number;
    georefMaxResidualM: number;
    method: string;
}
/**
 * Approximate tie of a video to the map: camera poses solved from the video itself (structure from motion), the model
 * placed on the map by matching marked buildings to mapped footprints. Metres, not centimetres; no areas.
 */
export interface DroneGeoreferenceSummary {
    method: string;
    model: { frames: number; points: number; reprojectionErrorPx: number; shot: [number, number]; meanRollDeg: number };
    controls: Array<{ building: string; target: string; residualM: number }>;
    markedBuildings: number;
    rmsM: number;
    maxResidualM: number;
    scaleMPerUnit: number;
    referenceT: number;
    referenceImage: string;
    /** Parcels whose projected outline lies fully inside the reference frame. */
    parcelsInView: string[];
}

export interface DroneReview {
    parcel: string;
    class: DroneClass;
    observer: string;
    /** True only after an expert or a field visit confirmed the reading. */
    verified: boolean;
    date: string;
    frames: number[];
    note: string;
}

export interface DroneVerificationParcel {
    key: string;
    block: string;
    parcel: string;
    nature: string;
    locality: string;
    areaM2: number;
    deedAreaM2: number | null;
    titleTea: boolean;
    licence: { licensed: boolean; areaM2: number | null; codes: string[]; source: 'demo' | 'caykur' | 'none' };
    satellite: { tea: string; teaShare: number | null; fullPixels: number } | null;
    sourceId: string;
    analysedAt: string;
    class: DroneClass;
    classSource: 'review' | 'automatic';
    confidence: DroneConfidence;
    automatic: { class: DroneClass; confidence: DroneConfidence; usable: boolean; teaShareMedian: number; teaShareSpread: number; otherShares: Record<string, number> };
    review: DroneReview | null;
    hypothesis: string | null;
    status: DroneStatus;
    discrepancy: string | null;
    action: string;
    video: { visible: [number, number]; trackedFrames: number; match: { t: number; inliers: number; keypoints: number } | null };
    /** Outline on the reference frame, in frame pixels. `hand_drawn` is a marker's drawing, not the cadastral boundary. */
    outline: { t: number; frame: [number, number]; polygon: Array<[number, number]>; reference: string; kind: 'hand_drawn' | 'cadastre' };
    frames: DroneFrame[];
    /** Outline per tracked instant (video seconds of the source), for drawing it over the playing clip. */
    track: Array<{ t: number; polygon: Array<[number, number]> }>;
    /** TKGM outline projected into the video through the approximate georeference; empty without one. */
    cadastreTrack: Array<{ t: number; polygon: Array<[number, number]> }>;
    /** Overlap of the hand-drawn outline with the projected cadastre on the reference frame (shares of pixel area). */
    handOverlap: { iou: number; handInsideCadastre: number; cadastreInsideHand: number } | null;
    notes: string[];
}

export interface DroneVerificationBlock {
    generatedAt: string;
    method: string;
    rules: Record<string, number>;
    sources: DroneSource[];
    capture: DroneCapture;
    /** The part of the video the parcels are on, re-encoded for the site; `start` is its offset in the source video. */
    clip: { file: string; start: number; end: number; width: number; height: number; bytes: number } | null;
    georeference: DroneGeoreferenceSummary | null;
    /** Absent in bundles written before the orthophoto step existed. */
    orthophoto?: DroneOrthophoto | null;
    suitability: Array<{ topic: string; verdict: 'ok' | 'limited' | 'no'; text: string }>;
    validation: DroneValidation;
    licenceSource: 'demo' | 'caykur';
    imageryBaseUrl: string;
    parcels: DroneVerificationParcel[];
}
