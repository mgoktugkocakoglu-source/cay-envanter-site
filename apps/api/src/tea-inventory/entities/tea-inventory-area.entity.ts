import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    Index,
} from 'typeorm';
import { TeaInventoryParcel } from '@/tea-inventory/entities/tea-inventory-parcel.entity';
import { LandBlock } from '@/tea-inventory/entities/land-evaluation.types';
import { AgeBlock } from '@/tea-inventory/entities/garden-age.types';
import { FieldTestsBlock } from '@/tea-inventory/entities/field-test.types';
import { PixelScanBlock } from '@/tea-inventory/entities/pixel-scan.types';
import { PruningCombinedBlock } from '@/tea-inventory/entities/pruning-combined.types';
import { LicenceAuditBlock } from '@/tea-inventory/entities/licence-audit.types';
import { DroneVerificationBlock } from '@/tea-inventory/entities/drone-verification.types';
import { ComplianceBlock } from '@/tea-inventory/entities/compliance.types';
import { RemoteTerrain } from '@/tea-inventory/entities/remote-terrain.types';

/** A detected tea patch (Sentinel-2, 10 m) stored with its area. */
export interface TeaPatch {
    areaM2: number;
    geometry: Record<string, unknown>;
}

/** One scanned season's schedule (producer scans every ≤ 5 days). */
export interface ProducerSeasonSchedule {
    season: string;
    calibrated: boolean;
    demo: boolean;
    everyDays: number;
    lookbackDays: number;
    reference: [string, string];
    previousSeasons: string[];
    scanDates: string[];
    newObservation: boolean[];
    sceneDates: string[][];
}

/** Radar module header (bundle `radar` block): rules and, per season, the orbit passes scanned. */
export interface RadarBlock {
    calibrated: boolean;
    method: string;
    rules: Record<string, unknown>;
    seasons: Array<{
        season: string;
        window: [string, string];
        passes: Array<{ pass: string; relativeOrbit: number; dates: string[]; cohDates?: string[] }>;
        coherence?: { cohWin: [number, number]; pairs: Record<string, number> } | null;
    }>;
}

/** Tea outside every harvested parcel, judged on its own until its parcel/owner is known. */
export interface FusionUnassignedPatch {
    id: string;
    areaM2: number;
    geometry: Record<string, unknown>;
    verdict: { class: string; z: number | null; p: number; changeDate: string | null; lastBeforeAt: string | null; firstAfterAt: string | null; agreeing: number; opticalOk?: boolean; backscatterOk?: boolean; reason: string };
    detectedAt: string | null;
    likelyAt: string | null;
}

/** An optical date the fusion screening dropped for every garden (neighbourhood-wide snow / shadow collapse, sparse coverage). */
export interface FusionExcludedDate {
    date: string;
    sensor: string | null;
    coverage: number;
    medianNdvi: number | null;
    ok: boolean;
    reason: 'snow_or_shadow' | 'sparse' | null;
}

export interface FusionRate {
    hit: number;
    n: number;
    rate: number | null;
}
export interface FusionRateBlock {
    overall: FusionRate;
    realistic: FusionRate;
    clear: FusionRate;
    deep: FusionRate;
    light: FusionRate;
    bySize: Record<string, FusionRate>;
    byDepth: Record<string, FusionRate>;
    byShare: Record<string, FusionRate>;
    table: Array<{ pixels: number; cells: FusionRate[] }>;
}
/** Measured without ground truth, on the same simulated cuts as the pixel scan (mirrored-series false alarms, detection rate). */
export interface FusionValidation {
    season: string;
    generatedAt: string;
    gardens: number;
    real: { pruned: number; likely: number; unclear: number };
    falseAlarms: { gardens: number; pruned: number; likely: number; share: number; unclear: number; note: string };
    detection: { trials: number; note: string } & Record<'fusionGarden' | 'fusionPatch' | 'fusionPatchConfirmed' | 'fusionPatchDated' | 'pixel' | 'pixelFull' | 'either', FusionRateBlock>;
}
export interface RadarStack {
    n: number;
    medianStep: number | null;
    meanZExpected: number | null;
    stoufferZ: number | null;
    beyond90: number | null;
    beyond95: number | null;
}
export interface RadarStep {
    step: number;
    z: number;
    nullSigma: number;
}
/** Block-scale radar test: noise floor by averaged area, pruned gardens and neighbouring blocks against quiet tea of the same size and dates. */
export interface RadarBlockCheck {
    season: string;
    generatedAt: string;
    windowDays: number;
    events: number;
    quietGardens: number;
    note: string;
    noiseFloor: Array<{ targetM2: number; medianAreaM2: number } & Record<string, { sigma: number | null; detectable: number | null; n: number } | number>>;
    singleStack: Record<string, Record<string, RadarStack | null>>;
    placebo: Record<string, RadarStack | null>;
    blocks: Array<{ members: string[]; gardens: number; areaM2: number; b0: string; b1: string } & Record<string, RadarStep | null | string | number | string[]>>;
    blockStack: Record<string, RadarStack | null>;
}

/** Fusion module header (bundle `fusion` block): rules, channel settings, per-season scan cadence and sensors. */
export interface FusionBlock {
    calibrated: boolean;
    method: string;
    rules: Record<string, unknown>;
    channels: Record<string, { sign: 1 | -1; minEffect: number; noiseFloor: number }>;
    policy?: Record<string, unknown>;
    seasons: Array<{
        season: string;
        everyDays: number;
        scanFrom: string;
        scanTo: string;
        sensors: {
            optical: { dates: string[]; sensors?: string[]; counts?: Record<string, number>; excluded?: FusionExcludedDate[] };
            backscatter: Array<{ pass: string; relativeOrbit: number; dates: string[] }>;
            coherence: Array<{ pass: string; dates: string[] }>;
        };
        parcelCoverage?: number;
        unassigned?: FusionUnassignedPatch[];
        validation?: FusionValidation | null;
        radarCheck?: RadarBlockCheck | null;
    }>;
}

export interface ProducerScanBlock {
    rules: Record<string, unknown>;
    seasons: ProducerSeasonSchedule[];
    radar?: RadarBlock | null;
    fusion?: FusionBlock | null;
    scenes: {
        baseUrl: string;
        bounds: { west: number; south: number; east: number; north: number };
        seasons: Record<string, Array<{ date: string; file: string; teaVisible: number; teaMedianNdvi: number }>>;
    } | null;
}

/** Parcel-level licence view (derived from the producer-centred register) or an unmatched licence. */
export interface InventoryLicense {
    licenseNo: string;
    walletNo: string;
    holderName: string;
    holderDeceased: boolean;
    licensedAreaM2: number | null;
    issuedYear: number;
    recordedParcelRef: string;
    licenseCount?: number;
    producerCount?: number;
    matchLevel?: 'exact' | 'historical' | 'probable' | 'unmatched' | null;
    // True when licences exist on the parcel but none is tied to a garden yet (no area allocated).
    pendingMatch?: boolean;
}

/** Overlap of two boundary proposals / gardens inside a shared parcel. */
export interface BoundaryConflict {
    code: string;
    parcelKey: string;
    gardenCodes: [string, string];
    overlapM2: number;
    geometry: Record<string, unknown>;
    status: 'open' | 'resolved';
    openedAt: string;
}

/** Licence register block (bundle v5): rules, conflicts and the unlicensed-tea difference layer. */
/** Growing-season health block (garden-health module): rules, sensor dates and producer yield rows per year. */
export interface HealthProducerRow {
    code: string;
    gardens: number;
    teaAreaM2: number;
    licensedAreaM2: number;
    yieldKg: number;
    quotaKg: number;
    ratio: number | null;
    flag: 'ok' | 'low' | 'high' | 'no_license' | 'no_data';
    anomalies: Record<string, number>;
    meanVigour: number | null;
    reason: string;
}

export interface HealthBlock {
    calibrated: boolean;
    method: string;
    rules: Record<string, unknown>;
    seasons: Array<{
        season: string;
        window: [string, string];
        sensors: { optical: { dates: string[]; sensors?: string[]; counts?: Record<string, number> }; backscatter: Array<{ pass: string; relativeOrbit: number; dates: string[] }> };
        neighbourhood: { dates: string[]; ndviMedian: Array<number | null>; ndreMedian: Array<number | null> };
        producers: HealthProducerRow[];
    }>;
}

export interface LicensingBlock {
    demo: boolean;
    generatedAt: string;
    rules: { areaTolerance: number; minLicenseM2: number; overlapToleranceM2: number };
    conflicts: BoundaryConflict[];
    unlicensedTea: TeaPatch[];
}

/**
 * One inventoried neighborhood (the unit of a district "library"): boundary,
 * model report and detected tea patches. Produced by the cay-envanter engine
 * and imported as a bundle; parcels hang off it.
 */
@Entity('tea_inventory_areas')
export class TeaInventoryArea {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    // e.g. "trabzon-of-cataldere" — stable across re-imports.
    @Index({ unique: true })
    @Column({ type: 'varchar', length: 120 })
    code: string;

    @Column({ type: 'varchar', length: 100 })
    province: string;

    @Column({ type: 'varchar', length: 100 })
    district: string;

    @Column({ type: 'varchar', length: 100 })
    neighborhood: string;

    // TKGM mahalleId.
    @Column({ type: 'int', name: 'neighborhood_id', nullable: true })
    neighborhoodId: number | null;

    @Column({ type: 'jsonb' })
    boundary: Record<string, unknown>;

    @Column({ type: 'double precision', name: 'boundary_area_m2' })
    boundaryAreaM2: number;

    // Share of the boundary covered by harvested TKGM parcels (0–1).
    @Column({ type: 'double precision', name: 'covered_ratio' })
    coveredRatio: number;

    // Imagery window used by the detector, e.g. { start, end }.
    @Column({ type: 'jsonb' })
    period: Record<string, unknown>;

    // Detector description and held-out accuracy figures.
    @Column({ type: 'jsonb' })
    model: Record<string, unknown>;

    // True while the license register is the engine's generated demo data.
    @Column({ type: 'boolean', name: 'demo_licenses', default: true })
    demoLicenses: boolean;

    @Column({ type: 'jsonb', name: 'tea_patches', default: () => "'[]'" })
    teaPatches: TeaPatch[];

    @Column({ type: 'jsonb', name: 'unmatched_licenses', default: () => "'[]'" })
    unmatchedLicenses: InventoryLicense[];

    // Pruning monitoring (bundle v2): season summaries, pruned patches, NDVI date axis. Null when not run.
    @Column({ type: 'jsonb', nullable: true })
    pruning: Record<string, unknown> | null;

    // Producer scanning (bundle v4): rules, one schedule per scanned season (scan dates every
    // ≤ 5 days, which scans had new clear scenes) and the per-scene imagery timeline. Null when
    // producer scanning has not run for this area.
    @Column({ type: 'jsonb', name: 'producer_scan', nullable: true })
    producerScan: ProducerScanBlock | null;

    // Licence register (bundle v5): rules, boundary conflicts, unlicensed tea. Null before v5.
    @Column({ type: 'jsonb', nullable: true })
    licensing: LicensingBlock | null;

    // Garden-health module block (growing-season scans), absent until scan-health has run.
    @Column({ type: 'jsonb', nullable: true })
    health: HealthBlock | null;

    // Land evaluation module block (terrain/soil/land-use rules, climate record, summary), absent until evaluate-land has run.
    @Column({ type: 'jsonb', nullable: true })
    land: LandBlock | null;

    // Garden age / renewal module block (rules, sources, summary), absent until garden-age has run.
    @Column({ type: 'jsonb', nullable: true })
    age: AgeBlock | null;

    // Independent field tests (inspector ground truth + satellite step test per claim), absent until field-test has run.
    @Column({ type: 'jsonb', nullable: true, name: 'field_tests' })
    fieldTests: FieldTestsBlock | null;

    // Pixel-scan module block (lattice-level undated pruning scan per garden and season), absent until scan-pixels has run.
    // Not selected by default: it is large and only the pixel-scan service reads it.
    @Column({ type: 'jsonb', nullable: true, name: 'pixel_scan', select: false })
    pixelScan: PixelScanBlock | null;

    // Combined pruning verdict block (fusion + pixel scan as one verdict per garden), absent until combine-pruning has run.
    // Not selected by default: only the combined-verdict service reads it.
    @Column({ type: 'jsonb', nullable: true, name: 'pruning_combined', select: false })
    pruningCombined: PruningCombinedBlock | null;

    // Licence audit block (deed title × licence register × satellite detection, one decision per parcel), absent until audit-licensing has run.
    // Not selected by default: only the licence-audit service reads it.
    @Column({ type: 'jsonb', nullable: true, name: 'licence_audit', select: false })
    licenceAudit: LicenceAuditBlock | null;

    // Drone-supported land verification block (record × drone imagery per parcel), absent until verify-drone has run.
    // Not selected by default: only the drone-verification service reads it.
    @Column({ type: 'jsonb', nullable: true, name: 'drone_verification', select: false })
    droneVerification: DroneVerificationBlock | null;

    // Rule-based licence compliance report (every parcel against a written rule set), absent until check-compliance has run.
    // Not selected by default: only the compliance service reads it.
    @Column({ type: 'jsonb', nullable: true, name: 'compliance', select: false })
    compliance: ComplianceBlock | null;

    @Column({ type: 'jsonb', nullable: true, name: 'remote_terrain', select: false })
    remoteTerrain: RemoteTerrain | null;

    // Bundle timestamp; a re-import is skipped when it has not changed.
    @Column({ type: 'timestamp', name: 'bundle_generated_at' })
    bundleGeneratedAt: Date;

    @OneToMany(() => TeaInventoryParcel, (parcel) => parcel.area)
    parcels: TeaInventoryParcel[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
