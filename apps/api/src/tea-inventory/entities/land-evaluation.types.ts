/**
 * Land evaluation module (Toprak Koruma ve Arazi Değerlendirme): shapes of the engine's `land` bundle block.
 * Per parcel: terrain (radar DEM), soil (SoilGrids), land use (deed title vs satellite, yearly history),
 * erosion index, capability class proxy (AKK), 5403 class suggestion, crop suitability, recommendations.
 * Per area: neighbourhood climate record (ERA5-Land / CHIRPS) and summary counts.
 */
export type SlopeCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type AkkClass = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII' | 'VIII';
export type Law5403Class = 'MT' | 'OT' | 'DT' | 'TA' | 'TD';
export type DeclaredUse = 'tea' | 'hazelnut' | 'forest' | 'pasture' | 'field' | 'orchard' | 'built' | 'other';
export type ObservedUse = 'tea' | 'trees' | 'pasture' | 'field' | 'shrub' | 'built' | 'bare' | 'water' | 'wet' | 'unknown';
export type MismatchFlag = 'tea_title_no_tea' | 'abandoned_to_trees' | 'agri_to_built' | 'forest_cleared' | 'pasture_to_crops' | 'wet_or_water';
export type ErosionClass = 'very_low' | 'low' | 'moderate' | 'high' | 'very_high' | 'no_data';
export type CropKey = 'tea' | 'hazelnut' | 'kiwi' | 'chestnut' | 'blueberry' | 'pasture' | 'vegetable' | 'forestry';
export type DwClass = 'water' | 'trees' | 'grass' | 'flooded_vegetation' | 'crops' | 'shrub_and_scrub' | 'built' | 'bare' | 'snow_and_ice';
export type ClassFractions = Partial<Record<DwClass, number>>;

export const AKK_CLASSES: AkkClass[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
export const LAW5403_CLASSES: Law5403Class[] = ['MT', 'OT', 'DT', 'TA', 'TD'];
export const OBSERVED_USES: ObservedUse[] = ['tea', 'trees', 'pasture', 'field', 'shrub', 'built', 'bare', 'water', 'wet', 'unknown'];
export const MISMATCH_FLAGS: MismatchFlag[] = ['tea_title_no_tea', 'abandoned_to_trees', 'agri_to_built', 'forest_cleared', 'pasture_to_crops', 'wet_or_water'];
export const EROSION_CLASSES: ErosionClass[] = ['very_low', 'low', 'moderate', 'high', 'very_high', 'no_data'];
export const CROP_KEYS: CropKey[] = ['tea', 'hazelnut', 'kiwi', 'chestnut', 'blueberry', 'pasture', 'vegetable', 'forestry'];

export interface ParcelLand {
    key: string;
    block: string;
    parcel: string;
    nature: string;
    areaM2: number;
    terrain: {
        elevationM: number | null;
        slopePct: number | null;
        slopeMaxPct: number | null;
        aspectDeg: number | null;
        tpiM: number | null;
        handM: number | null;
        upstreamKm2: number | null;
        streamDistM: number | null;
        waterOccurrence: number | null;
        slopeClass: SlopeCode;
        slopeLabel: string;
        aspectLabel: string | null;
    };
    soil: {
        clayPct: number | null;
        sandPct: number | null;
        siltPct: number | null;
        ph: number | null;
        socPct: number | null;
        cec: number | null;
        bulkDensity: number | null;
        textureCode: number | null;
        textureLabel: string | null;
        phLabel: string | null;
    };
    landUse: {
        declared: DeclaredUse;
        observed: ObservedUse;
        teaShare: number | null;
        latestYear: number | null;
        latest: ClassFractions;
        history: Array<{ year: number; dominant: DwClass | null; fractions: ClassFractions }>;
        worldcover: Record<string, number>;
        mismatches: MismatchFlag[];
        change: { from: DwClass; to: DwClass; fromYear: number; toYear: number } | null;
    };
    erosion: { index: number | null; class: ErosionClass; factors: { R: number | null; K: number | null; LS: number | null; C: number | null } };
    capability: { akk: AkkClass | null; limitations: string[]; law5403: Law5403Class | null; law5403Label: string };
    suitability: Array<{ crop: CropKey; score: number; limiting: string | null }>;
    recommendations: string[];
}

export interface ClimatePeriod {
    period: string;
    days: number;
    tmean: number;
    tmaxMean: number;
    tminMean: number;
    tminAbs: number;
    tmaxAbs: number;
    rhMean: number;
    precipMm: number;
    rainDays: number;
    frostDays: number;
    hotDays: number;
    gdd10: number;
    drySpellMax: number;
}

export interface ClimateSummary {
    source: string;
    from: string;
    to: string;
    monthly: ClimatePeriod[];
    yearly: ClimatePeriod[];
    climatology: Array<{ month: number; tmean: number; tmin: number; tmax: number; precipMm: number; rainDays: number; rhMean: number }>;
    baselineYears: number[];
    recentYears: number[];
    anomaly: { tmean: number; precipMm: number; frostDays: number; hotDays: number; rainDays: number; drySpellMax: number; rhMean: number };
    trend: { tmeanPerDecade: number; precipPerDecade: number; hotDaysPerDecade: number; frostDaysPerDecade: number };
    windows: Array<{
        key: string;
        label: string;
        from: string;
        to: string;
        why: string;
        years: Array<{ year: number } & Omit<ClimatePeriod, 'period'>>;
        baseline: Pick<ClimatePeriod, 'tmean' | 'precipMm' | 'rainDays' | 'frostDays' | 'hotDays'>;
        recent: Pick<ClimatePeriod, 'tmean' | 'precipMm' | 'rainDays' | 'frostDays' | 'hotDays'>;
    }>;
}

export interface LandSummaryCounts {
    parcels: number;
    evaluatedAreaM2: number;
    byAkk: Record<AkkClass, number>;
    byLaw5403: Record<Law5403Class, number>;
    byObserved: Record<ObservedUse, number>;
    byErosion: Record<ErosionClass, number>;
    mismatches: Record<MismatchFlag, number>;
    suitabilityMean: Record<CropKey, number>;
    conversionCandidates: number;
}

/** Area-level block stored on the area row (parcel rows carry their own `land`). */
export interface LandBlock {
    calibrated: boolean;
    method: string;
    generatedAt: string;
    rules: Record<string, unknown>;
    crops: Array<{ key: CropKey; label: string }>;
    neighbourhood: {
        boundaryAreaM2: number;
        climate: ClimateSummary;
        landUse: { years: number[]; boundary: Record<number, ClassFractions>; worldcover: Record<string, number> };
    };
    summary: LandSummaryCounts;
}
