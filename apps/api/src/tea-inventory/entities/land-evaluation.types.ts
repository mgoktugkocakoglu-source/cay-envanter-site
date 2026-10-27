/**
 * Land evaluation module (Toprak Koruma ve Arazi Değerlendirme): shapes of the engine's `land` bundle block.
 * Per parcel: terrain (radar DEM), soil (OpenLandMap), land use (deed title vs satellite, yearly history,
 * Landsat NDVI since 1986), erosion index, capability class proxy (AKK), 5403 class suggestion, cited crop
 * suitability (per-factor scores with source ids, legal checks) and recommendations with sources.
 * Per area: the neighbourhood climate record (ERA5-Land / CHIRPS anchored to MGM station normals),
 * indices, the evidence registry, station normals and official district facts.
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
export type SourceType = 'mevzuat' | 'kurum' | 'akademik' | 'istatistik' | 'meteoroloji' | 'cografi-isaret' | 'veri';

export const AKK_CLASSES: AkkClass[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
export const LAW5403_CLASSES: Law5403Class[] = ['MT', 'OT', 'DT', 'TA', 'TD'];
export const OBSERVED_USES: ObservedUse[] = ['tea', 'trees', 'pasture', 'field', 'shrub', 'built', 'bare', 'water', 'wet', 'unknown'];
export const MISMATCH_FLAGS: MismatchFlag[] = ['tea_title_no_tea', 'abandoned_to_trees', 'agri_to_built', 'forest_cleared', 'pasture_to_crops', 'wet_or_water'];
export const EROSION_CLASSES: ErosionClass[] = ['very_low', 'low', 'moderate', 'high', 'very_high', 'no_data'];
export const CROP_KEYS: CropKey[] = ['tea', 'hazelnut', 'kiwi', 'chestnut', 'blueberry', 'pasture', 'vegetable', 'forestry'];

/** One entry of the evidence registry (law, ministry report, paper, GI registration, data set). */
export interface SourceRef {
    id: string;
    title: string;
    org: string;
    year: number | string;
    url: string;
    type: SourceType;
    used: string;
    caveat?: string;
}

/** MGM provincial station normals used to anchor the model climate series. */
export interface StationNormals {
    id: string;
    name: string;
    lat: number;
    lng: number;
    elevationM: number;
    period: string;
    tmean: number[];
    tmax: number[];
    tmin: number[];
    rainDays: number[];
    precipMm: number[];
    classes?: { erinc?: number; deMartonne?: number; aydeniz?: number; thornthwaite?: string };
    anchor?: boolean;
    sources: string[];
}

/** Official district facts (land-use statistics, supported products) shown next to the model results. */
export interface DistrictFacts {
    province: string;
    district: string;
    landUseDa: { agriculture: number; pasture: number; forest: number; nonAgri: number; total: number; source: string } | null;
    supportedProducts: { products: string[]; source: string } | null;
    notes: Array<{ text: string; source: string }>;
}

/** A crop requirement factor: 100 inside [lo1, hi1], 0 at lo0 / hi0 (null = open end), with its sources. */
export interface FactorRule {
    key: string;
    label: string;
    unit: string;
    digits: number;
    band: Array<number | null>;
    sources: string[];
    note: string;
}

export interface CropRule {
    key: CropKey;
    label: string;
    rationale: string;
    factors: FactorRule[];
    legal: Array<{ label: string; sources: string[]; kind: string }>;
    sources: string[];
}

export interface FactorResult {
    key: string;
    label: string;
    value: number | null;
    display: string;
    score: number;
    sources: string[];
    note: string;
}

export interface Suitability {
    crop: CropKey;
    score: number;
    limiting: string | null;
    factors: FactorResult[];
    legal: Array<{ label: string; sources: string[]; status: 'ok' | 'fail' | 'na' }>;
    supported: boolean;
}

/** Climate indicators at the parcel's own elevation (recent full years). */
export interface ParcelClimate {
    offsetC: number;
    years: number[];
    tmean: number;
    tminAbs: number;
    tmaxAbs: number;
    frostDays: number;
    hotDays: number;
    precipMm: number;
    julyMean: number;
    rhSummer: number;
    chillHours: number;
    frostFreeDays: number;
    springFrostDays: number;
    bloomRainDays: number;
}

export interface NdviPeriod {
    period: string;
    ndvi: number | null;
    denseShare: number | null;
}

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
        ndviHistory: NdviPeriod[];
    };
    erosion: { index: number | null; class: ErosionClass; factors: { R: number | null; K: number | null; LS: number | null; C: number | null }; sources: string[] };
    capability: { akk: AkkClass | null; limitations: string[]; law5403: Law5403Class | null; law5403Label: string; reasoning: string; sources: string[] };
    climate: ParcelClimate | null;
    suitability: Suitability[];
    recommendations: Array<{ text: string; sources: string[] }>;
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

export interface StationAnchor {
    stations: Array<{ id: string; name: string; distanceKm: number; weight: number; elevationM: number; period: string }>;
    normal: { tmean: number[]; tmax: number[]; tmin: number[]; precipMm: number[]; rainDays: number[]; annualPrecipMm: number; annualTmean: number };
    model: { tmean: number[]; precipEra: number[]; precipChirps: number[]; years: number[] };
    monthlyOffsetC: number[];
    monthlyPrecipRatio: number[];
}

export interface ClimateIndices {
    erinc: { value: number; class: string };
    deMartonne: { value: number; class: string };
    koppen: { code: string; label: string };
    reference: Array<{ station: string; erinc: number | null; deMartonne: number | null; thornthwaite: string | null }>;
}

type WindowAgg = Pick<ClimatePeriod, 'tmean' | 'precipMm' | 'rainDays' | 'frostDays' | 'hotDays' | 'rhMean'>;

export interface ClimateSummary {
    source: string;
    from: string;
    to: string;
    lapse: { neighbourhoodElevationM: number; cellElevationM: number; correctionC: number };
    anchor: StationAnchor;
    monthly: ClimatePeriod[];
    yearly: ClimatePeriod[];
    decades: Array<{ label: string; years: number[] } & Omit<ClimatePeriod, 'period' | 'days'>>;
    climatology: Array<{ month: number; tmean: number; tmin: number; tmax: number; precipMm: number; rainDays: number; rhMean: number }>;
    baselineYears: number[];
    recentYears: number[];
    anomaly: { tmean: number; precipMm: number; frostDays: number; hotDays: number; rainDays: number; drySpellMax: number; rhMean: number };
    trend: { tmeanPerDecade: number; precipPerDecade: number; hotDaysPerDecade: number; frostDaysPerDecade: number };
    indices: ClimateIndices;
    seasons: Array<{ year: number; lastSpringFrost: string | null; firstAutumnFrost: string | null; frostFreeDays: number; chillHours: number }>;
    windows: Array<{
        key: string;
        label: string;
        from: string;
        to: string;
        why: string;
        sources: string[];
        years: Array<{ year: number } & Omit<ClimatePeriod, 'period'>>;
        baseline: WindowAgg;
        recent: WindowAgg;
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
    cropRules: CropRule[];
    sources: SourceRef[];
    stations: StationNormals[];
    district: DistrictFacts | null;
    neighbourhood: {
        boundaryAreaM2: number;
        climate: ClimateSummary;
        landUse: { years: number[]; boundary: Record<number, ClassFractions>; worldcover: Record<string, number> };
        ndviHistory: NdviPeriod[];
        ndviPeriods: Array<{ period: string; from: number; to: number; scenes: number }>;
    };
    summary: LandSummaryCounts;
}
