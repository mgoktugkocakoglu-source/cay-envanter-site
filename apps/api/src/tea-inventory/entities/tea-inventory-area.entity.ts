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

/** A license whose recorded parcel reference no longer resolves to a TKGM parcel. */
export interface InventoryLicense {
    licenseNo: string;
    walletNo: string;
    holderName: string;
    holderDeceased: boolean;
    licensedAreaM2: number;
    issuedYear: number;
    recordedParcelRef: string;
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
