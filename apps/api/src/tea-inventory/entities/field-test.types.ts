/**
 * Blind field-test block: a parcel and a known pruning date go in, the satellite delineates the pruned
 * area on its own (Sentinel-2 pixels relative to the surrounding tea, Sentinel-1 VH/VV), estimates its
 * size, brackets the change date from its own scenes, and only then is compared with the inspector's
 * ground truth. Computed apart from the pruning detection chain.
 */

export type FieldTestVerdict = 'detected' | 'not_detected' | 'pending';
export type FieldTestConfidence = 'high' | 'medium' | 'low';
export type FieldTestPass = 'ASCENDING' | 'DESCENDING';
export type FieldTestMatch = 'match' | 'partial' | 'miss' | 'no_detection';

export interface FieldStepTest {
    nBefore: number;
    nAfter: number;
    meanBefore: number | null;
    meanAfter: number | null;
    sdBefore: number | null;
    delta: number | null;
    z: number | null;
}

export interface FieldTestPixel {
    id: string;
    e: number;
    n: number;
    geometry: Record<string, unknown>;
    insideM2: number;
    insideShare: number;
    edgeNonTea: boolean;
    optical: { ndvi: FieldStepTest; nbr: FieldStepTest; ndviBeforeAbs: number | null; clearShare: number };
    radar: Partial<Record<FieldTestPass, { vh: FieldStepTest; ratio: FieldStepTest }>>;
    flagged: boolean;
    strong: boolean;
    fraction: number | null;
    prunedM2: number | null;
    cluster: number | null;
}

export interface FieldTestDateBracket {
    lastBefore: string | null;
    firstAfter: string | null;
    bestSplit: string | null;
    bestDelta: number | null;
    containsPrunedAt: boolean | null;
}

export interface FieldTestCluster {
    index: number;
    pixelIds: string[];
    areaM2: number;
    areaRange: [number, number];
    areaUpperM2: number;
    shareOfParcel: number;
    centroid: [number, number];
    position: string;
    edgeShare: number;
    meanDelta: number;
    maxZ: number;
    dateBracket: FieldTestDateBracket;
    radar: Partial<Record<FieldTestPass, { vh: FieldStepTest; ratio: FieldStepTest }>>;
    radarChange: boolean;
    confidence: FieldTestConfidence;
    note: string;
}

export interface FieldTestGroundTruthComparison {
    detectedM2: number;
    overlapM2: number;
    detectedInsideShare: number;
    groundTruthCoveredShare: number;
    centroidDistanceM: number | null;
    mainClusterInside: boolean;
    verdict: FieldTestMatch;
    text: string;
}

export interface FieldTestUndated {
    scan: { from: string; to: string; candidates: number; zThreshold: number };
    verdict: 'detected' | 'not_detected';
    bestDate: string | null;
    dateBracket: { lastBefore: string | null; firstAfter: string | null };
    candidates: Array<{ date: string; lastBefore: string | null; flagged: number; clusterPixels: number; score: number }>;
    pixels: Array<{ id: string; delta: number | null; z: number | null; nBefore: number; nAfter: number; flagged: boolean; strong: boolean; fraction: number | null; prunedM2: number | null; cluster: number | null }>;
    clusters: Array<{
        index: number;
        pixelIds: string[];
        areaM2: number;
        areaUpperM2: number;
        centroid: [number, number];
        position: string;
        meanDelta: number;
        maxZ: number;
        edgeShare: number;
        confidence: FieldTestConfidence;
        radar: Partial<Record<FieldTestPass, FieldStepTest>>;
        radarChange: boolean;
    }>;
    prunedM2: number;
    shareOfParcel: number;
    mainCluster: number | null;
    summary: string[];
    evaluation: { dateHit: boolean | null; dateErrorDays: number | null; location: FieldTestGroundTruthComparison | null; text: string } | null;
}

export interface FieldTestCase {
    id: string;
    block: string;
    parcel: string;
    prunedAt: string;
    reportedAt: string | null;
    source: string;
    note: string | null;
    parcelGeometry: Record<string, unknown>;
    deedAreaM2: number | null;
    parcelAreaM2: number;
    parcelCentroid: [number, number];
    epsg: string;
    window: [string, string];
    windows: { before: [string, string]; after: [string, string] };
    reference: { pixels: number; areaM2: number };
    excludedDates: string[];
    pixels: FieldTestPixel[];
    clusters: FieldTestCluster[];
    detection: {
        verdict: FieldTestVerdict;
        prunedM2: number;
        prunedRange: [number, number];
        shareOfParcel: number;
        mainCluster: number | null;
        dateBracket: FieldTestDateBracket | null;
        summary: string[];
    };
    series: {
        optical: { dates: string[]; clusters: Record<string, Array<number | null>>; rest: Array<number | null>; parcel: Array<number | null>; neighbours: Array<number | null> };
        radar: Array<{ pass: FieldTestPass; relativeOrbit: number; dates: string[]; clusters: Record<string, Array<number | null>>; rest: Array<number | null> }>;
    };
    groundTruth: { geometry: Record<string, unknown>; areaM2: number; approximate: boolean; note: string | null; measuredAreaM2?: number | null; comparison: FieldTestGroundTruthComparison } | null;
    calibration?: { ndviPruned: number; range: [number, number]; source: 'default' | 'field'; measuredAreaM2: number | null; note: string };
    /** The same parcel judged without the field date (season scan). */
    undated?: FieldTestUndated;
}

export interface FieldTestsBlock {
    generatedAt: string;
    method: string;
    rules: Record<string, number | number[]>;
    cases: FieldTestCase[];
}
