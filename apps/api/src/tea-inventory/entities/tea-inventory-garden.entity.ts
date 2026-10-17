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

    // Season → results and events ("2025-26" → …).
    @Column({ type: 'jsonb', default: () => "'{}'" })
    seasons: Record<string, GardenSeason>;

    @Column({ type: 'jsonb' })
    geometry: Record<string, unknown>;
}
