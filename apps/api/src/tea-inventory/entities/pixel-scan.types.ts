/**
 * Pixel-scan block (separate module): Sentinel-2's own 10 m lattice over every garden, each pixel read
 * against the surrounding gardens' pixels and scanned for an undated step; clusters are classed by how
 * they recover (deep pruning / light pruning / transient). It never changes the multi-sensor verdict.
 */

export type PixelKind = 'deep' | 'light' | 'transient' | 'pending';
export type PixelConfidence = 'high' | 'medium' | 'low';
export type PixelVerdict = 'deep' | 'light' | 'pending' | 'transient' | 'weak' | 'none' | 'no_data';

export interface PixelCluster {
    index: number;
    pixels: number;
    corePixels: number;
    edgePixels: number;
    areaM2: number;
    areaLowM2: number;
    areaUpperM2: number;
    centroid: [number, number];
    meanDelta: number;
    maxZ: number;
    nbrDelta: number | null;
    crossIndexOk: boolean;
    kind: PixelKind;
    depth: number | null;
    recoveryDays: number | null;
    summerRecovery: number | null;
    lastObsDays: number;
    confidence: PixelConfidence;
    note: string;
}

/** [e, n, insideM2, delta, z, flag (0 none · 1 grown · 2 core), cluster (−1 none), edge (0/1)]. */
export type PixelTuple = [number, number, number, number | null, number | null, number, number, number];

export interface PixelGarden {
    id: string;
    pixels: number;
    evaluatedPixels: number;
    verdict: PixelVerdict;
    fusionClass: string | null;
    fusionKind: string | null;
    best: { date: string; lastBefore: string | null; score: number } | null;
    candidates: Array<{ date: string; lastBefore: string | null; pixels: number; score: number }>;
    prunedM2: number;
    prunedLowM2: number;
    prunedUpperM2: number;
    mainCluster: number | null;
    clusters: PixelCluster[];
    px: PixelTuple[];
    series: { dates: string[]; cluster: Array<number | null>; rest: Array<number | null> } | null;
}

export interface PixelSeasonSummary {
    gardens: number;
    pixels: number;
    flaggedPixels: number;
    byVerdict: Record<PixelVerdict, number>;
    areaM2: { deep: number; light: number; pending: number };
    vsFusion: Record<string, Partial<Record<PixelVerdict, number>>>;
    newFinds: number;
}

export interface PixelSeason {
    season: string;
    generatedAt: string;
    method: string;
    rules: Record<string, number | string | number[] | string[]>;
    epsg: string;
    window: [string, string];
    scan: { from: string; to: string; candidates: number };
    dates: number;
    excludedDates: string[];
    summary: PixelSeasonSummary;
    gardens: PixelGarden[];
}

export interface PixelScanBlock {
    seasons: PixelSeason[];
}
