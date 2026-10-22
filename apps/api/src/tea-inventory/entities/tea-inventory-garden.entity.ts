import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';

/** Sentinel-1 verdict on an optical pruning event (separate radar module, mowing-detection recipe). */
export type RadarClass = 'confirmed' | 'weak' | 'neutral' | 'contradicted' | 'no_data';

export interface RadarPassResult {
    pass: 'ASCENDING' | 'DESCENDING';
    beforeObs: number;
    afterObs: number;
    vhDropDb: number | null;
    ratioDropDb: number | null;
    persistence: number | null;
    noiseDb: number | null;
    zVh?: number | null;
    // Interferometric coherence channel (present once the SNAP burst-pair step has run).
    cohBeforeObs?: number;
    cohAfterObs?: number;
    cohRise?: number | null;
    zCoh?: number | null;
    z: number | null;
}

export interface RadarResult {
    class: RadarClass;
    score: number;
    vhDropDb: number | null;
    ratioDropDb: number | null;
    cohRise?: number | null;
    persistence: number | null;
    z: number | null;
    // Coherence channel judged on its own (never pooled with backscatter).
    zCoh?: number | null;
    cohClass?: RadarClass;
    passes: RadarPassResult[];
}

/** Neighbourhood-relative VH / VH-VV series of one orbit pass (dB), for the sparkline. */
export interface RadarSeries {
    pass: 'ASCENDING' | 'DESCENDING';
    dates: string[];
    vhRel: Array<number | null>;
    ratioRel: Array<number | null>;
    // Coherence pairs, dated by the pair's second scene (unitless, neighbourhood-relative).
    cohDates?: string[];
    cohRel?: Array<number | null>;
}

/** Multi-sensor step-change verdict of a garden for a season (fusion module, uncalibrated). */
export type FusionClass = 'pruned' | 'likely' | 'unclear' | 'not_pruned' | 'no_data';
export type FusionChannelKey = 'ndvi' | 'nbr' | 'vh_asc' | 'vh_desc' | 'coh_asc' | 'coh_desc';
export type FusionGroup = 'optical' | 'backscatter' | 'coherence';

export interface FusionChannelEvidence {
    key: FusionChannelKey;
    before: number;
    after: number;
    late: number;
    delta: number | null;
    noise: number;
    z: number | null;
    persistence: number | null;
    magnitudeOk: boolean;
}

export interface FusionVerdict {
    class: FusionClass;
    z: number | null;
    p: number;
    changeDate: string | null;
    lastBeforeAt: string | null;
    firstAfterAt: string | null;
    agreeing: number;
    opticalOk: boolean;
    backscatterOk: boolean;
    groups: Array<{ group: FusionGroup; z: number | null; channels: FusionChannelEvidence[] }>;
    reason: string;
}

export interface GardenFusion {
    // The unit that carried the verdict: the whole garden or the optical change patch inside it.
    unit: 'garden' | 'patch';
    unitAreaM2: number;
    unitGeometry?: Record<string, unknown>;
    // Overlap with ground pruned in earlier seasons of the 7-season cycle (not credited again).
    repeat?: { reusedM2: number; reusedShare: number; countedM2: number; evidence: Array<{ season: string; overlapM2: number; class: FusionClass }> } | null;
    verdict: FusionVerdict;
    detectedAt: string | null;
    likelyAt: string | null;
    scans: Array<{ date: string; z: number | null; class: FusionClass }>;
    series: Array<{ key: FusionChannelKey; dates: string[]; values: Array<number | null> }>;
}

/** A pruning event inside a garden: where (polygon) and when (an observation interval, never a day). */
export interface GardenPruningEvent {
    areaM2: number;
    reusedM2: number;
    lastNoChangeAt: string | null;
    firstChangeAt: string | null;
    detectedAt: string | null;
    geometry: Record<string, unknown>;
    // Present when the radar module has run for the season.
    radar?: RadarResult | null;
}

/** One season of a garden: tea area, cumulative pruned series per scan, and its events. */
export interface GardenSeason {
    teaAreaM2: number;
    observedM2: number[];
    prunedM2: number[];
    reusedM2: number[];
    eventAreaM2: number;
    eventReusedM2: number;
    lastNoChangeAt: string | null;
    firstChangeAt: string | null;
    detectedAt: string | null;
    events: GardenPruningEvent[];
    // Present when the radar module has run for the season.
    radarSeries?: RadarSeries[];
    // A sustained radar drop with no optical event (candidate the optics may have missed).
    radarOnly?: { date: string; vhDropDb: number; persistence: number; z: number } | null;
    // Multi-sensor step-change verdict (fusion module), present when it has run for the season.
    fusion?: GardenFusion | null;
}

/** Whether the garden record is current or was replaced by a subdivision / merge on the site. */
export type GardenRecordStatus = 'active' | 'superseded';

/** Where the record (or its latest registry values) came from: the engine bundle or a site operation. */
export type RecordSource = 'engine' | 'site';

/** A non-geometry event in the garden's life (subdivision, transfer, area correction…), for the audit trail. */
export interface GardenEvent {
    at: string;
    type: string;
    note: string;
    by: string;
    applicationCode: string | null;
}

/** Garden-health module (separate from pruning): growing-season vigour, anomaly and yield per year. */
export type HealthAnomalyClass = 'chemical_suspect' | 'defoliation' | 'stress' | 'none' | 'no_data';

export interface HealthAnomaly {
    class: HealthAnomalyClass;
    date: string | null;
    dropNdvi: number | null;
    dropNdre: number | null;
    z: number | null;
    radarDb: number | null;
    radarStructural: boolean | null;
    recovery: number | null;
    nBefore: number;
    nAfter: number;
    reason: string;
}

export interface GardenHealthSeason {
    teaAreaM2: number;
    licensedAreaM2: number | null;
    ndviMean: number | null;
    ndreMean: number | null;
    nbhdNdviMean: number | null;
    vigour: number | null;
    prunedShare: number;
    anomaly: HealthAnomaly;
    yieldKg: number;
    yieldFactors: { vigour: number; pruning: number; anomaly: number };
    observations: number;
    series: { ndvi: Array<number | null>; ndre: Array<number | null>; nbr: Array<number | null>; vhAsc: Array<number | null> | null; vhDesc: Array<number | null> | null } | null;
}

/** Boundary approval state of the garden's geometry (the licensed sub-polygon). */
export type GardenApprovalStatus = 'approved' | 'proposed' | 'boundary_conflict' | 'field_check_required' | 'unresolved';

/** Record problems found between the licence, the geometry and the satellite. */
export type GardenDiscrepancy = 'area_over' | 'area_under' | 'no_tea' | 'no_license' | 'lineage_unresolved' | 'overlap' | 'outside_parcel';

/** One dated version of the garden geometry (older versions stay for the audit trail). */
export interface GardenGeometryVersion {
    version: number;
    geometry: Record<string, unknown>;
    planimetricAreaM2: number;
    reason: string;
    source: string;
    validFrom: string;
    validTo: string | null;
}

/** A boundary proposed inside a shared parcel, not yet approved. */
export interface GardenBoundaryProposal {
    geometry: Record<string, unknown>;
    planimetricAreaM2: number;
    proposedBy: 'producer' | 'staff';
    proposedAt: string;
    overlapM2: number;
    overlapsGardenCode: string | null;
}

/**
 * One tea garden of a producer: a whole TKGM parcel, or the producer's slice of a shared
 * (hisseli) parcel. Static across seasons (the ground record); per-season results and event
 * polygons hang off it so the same ground can be compared year over year. With the licence
 * register (bundle v5) the garden is also the licensed sub-polygon: it carries its licence,
 * the three area measures and its boundary approval state.
 */
@Entity('tea_inventory_gardens')
@Index(['areaId', 'code'], { unique: true })
@Index(['areaId', 'producerCode'])
@Index(['areaId', 'parcelKey'])
export class TeaInventoryGarden {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'area_id' })
    areaId: string;

    @ManyToOne(() => TeaInventoryArea, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'area_id' })
    area: TeaInventoryArea;

    // Engine code, e.g. "DEMO-B-0001".
    @Column({ type: 'varchar', length: 40 })
    code: string;

    // Holder's engine code, e.g. "DEMO-M-0001".
    @Column({ type: 'varchar', length: 40, name: 'producer_code', default: '' })
    producerCode: string;

    // TKGM "mahalleId/ada/parsel" of the parcel the garden lies in.
    @Column({ type: 'varchar', length: 60, name: 'parcel_key' })
    parcelKey: string;

    @Column({ type: 'varchar', length: 20 })
    block: string;

    @Column({ type: 'varchar', length: 20 })
    parcel: string;

    // TKGM locality (mevkii) of the parcel, e.g. "Terzili": the level below the neighbourhood.
    @Column({ type: 'varchar', length: 120, default: '' })
    locality: string;

    // Shared parcel: this holder's index and the number of holders.
    @Column({ type: 'int', name: 'holder_index', default: 1 })
    holderIndex: number;

    @Column({ type: 'int', name: 'holder_count', default: 1 })
    holderCount: number;

    // False: the holder's slice is not surveyed; pruning here cannot be attributed to them.
    @Column({ type: 'boolean', name: 'boundary_resolved', default: true })
    boundaryResolved: boolean;

    @Column({ type: 'double precision', name: 'geometry_area_m2' })
    geometryAreaM2: number;

    // ── Licence register (bundle v5) ──
    @Column({ type: 'varchar', length: 40, name: 'license_code', nullable: true })
    licenseCode: string | null;

    @Column({ type: 'varchar', length: 30, name: 'approval_status', default: 'approved' })
    approvalStatus: GardenApprovalStatus;

    // Licence area allocated to this garden; null when no licence or the match is unresolved.
    @Column({ type: 'double precision', name: 'licensed_area_m2', nullable: true })
    licensedAreaM2: number | null;

    // Horizontal (map) area of the current geometry.
    @Column({ type: 'double precision', name: 'planimetric_area_m2', default: 0 })
    planimetricAreaM2: number;

    // DEM slope-corrected surface area: a technical estimate, never a legal area.
    @Column({ type: 'double precision', name: 'surface_area_m2', default: 0 })
    surfaceAreaM2: number;

    @Column({ type: 'double precision', name: 'mean_slope_deg', default: 0 })
    meanSlopeDeg: number;

    // Satellite tea area inside the garden.
    @Column({ type: 'double precision', name: 'measured_tea_area_m2', default: 0 })
    measuredTeaAreaM2: number;

    @Column({ type: 'jsonb', default: () => "'[]'" })
    discrepancies: GardenDiscrepancy[];

    @Column({ type: 'jsonb', default: () => "'[]'" })
    versions: GardenGeometryVersion[];

    @Column({ type: 'jsonb', nullable: true })
    proposal: GardenBoundaryProposal | null;

    // 'superseded' once a subdivision replaced this record with its pieces (kept for history and pruning evidence).
    @Column({ type: 'varchar', length: 20, name: 'record_status', default: 'active' })
    recordStatus: GardenRecordStatus;

    // Codes of the pieces that replaced this garden / the garden this piece was cut from.
    @Column({ type: 'jsonb', name: 'superseded_by', default: () => "'[]'" })
    supersededBy: string[];

    @Column({ type: 'varchar', length: 40, name: 'parent_code', nullable: true })
    parentCode: string | null;

    @Column({ type: 'jsonb', default: () => "'[]'" })
    events: GardenEvent[];

    // 'site' when the registry values were created or changed by a site operation (survives re-imports).
    @Column({ type: 'varchar', length: 10, default: 'engine' })
    source: RecordSource;

    // Season → results and events ("2025-26" → …).
    @Column({ type: 'jsonb', default: () => "'{}'" })
    seasons: Record<string, GardenSeason>;

    // Garden-health results keyed by growing season (year), from the engine's scan-health step.
    @Column({ type: 'jsonb', default: () => "'{}'" })
    health: Record<string, GardenHealthSeason>;

    @Column({ type: 'jsonb' })
    geometry: Record<string, unknown>;
}
