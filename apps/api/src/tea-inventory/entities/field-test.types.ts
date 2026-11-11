/**
 * Independent field-test block: inspector-recorded ground truth (ada/parsel, the marked spot, dated claims)
 * with the satellite step test of each claim, computed apart from the pruning detection chain.
 */

export type FieldTestUnit = 'spot' | 'rest' | 'parcel' | 'neighbours';
export type FieldTestVerdict = 'supports' | 'contradicts' | 'unclear' | 'pending';

export interface FieldStepTest {
    nBefore: number;
    nAfter: number;
    meanBefore: number | null;
    meanAfter: number | null;
    sdBefore: number | null;
    delta: number | null;
    z: number | null;
}

export interface FieldTestClaim {
    kind: 'pruned' | 'not_pruned';
    label: string;
    dates: string[];
    windows: { before: [string, string]; after: [string, string] } | null;
    tests: Record<string, FieldStepTest>;
    verdict: FieldTestVerdict;
    reason: string;
}

export interface FieldTestCase {
    id: string;
    block: string;
    parcel: string;
    observedAt: string;
    observer: string;
    note: string | null;
    parcelGeometry: Record<string, unknown>;
    deedAreaM2: number | null;
    spot: { geometry: Record<string, unknown>; areaM2: number; approximate: boolean; description: string };
    pixels: Record<FieldTestUnit, number>;
    window: [string, string];
    series: {
        optical: { dates: string[]; units: Record<FieldTestUnit, { ndvi: Array<number | null>; nbr: Array<number | null>; clearShare: Array<number | null> }> };
        radar: Array<{ pass: 'ASCENDING' | 'DESCENDING'; relativeOrbit: number; dates: string[]; units: Record<FieldTestUnit, { vh: Array<number | null>; vv: Array<number | null> }> }>;
    };
    claims: FieldTestClaim[];
}

export interface FieldTestsBlock {
    generatedAt: string;
    method: string;
    rules: Record<string, number>;
    cases: FieldTestCase[];
}
