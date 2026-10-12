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

export interface ProducerScanBlock {
    rules: Record<string, unknown>;
    seasons: ProducerSeasonSchedule[];
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
