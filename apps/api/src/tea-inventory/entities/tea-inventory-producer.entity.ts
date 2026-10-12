import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';

/** Satellite-derived pruning status of a producer at a scan (engine values). */
export type ProducerAutoStatus =
    | 'auto_approved'
    | 'expert_review'
    | 'repeat_pruning_review'
    | 'boundary_unresolved'
    | 'partial'
    | 'no_trace'
    | 'awaiting_observation'
    | 'no_license';

/** One scan of the season for this producer: cumulative pruned area against the 1/7 target. */
export interface ProducerScan {
    date: string;
    grossPrunedM2: number;
    newPrunedM2: number;
    observedShare: number;
    ratio: number;
    status: ProducerAutoStatus;
}

/**
 * A producer (müstahsil, ruhsat sahibi) for ONE season: the satellite pruning check over ALL
 * their gardens against the 1/7 rule. The same producer appears once per scanned season
 * (same `code`), so a season can be picked and the history compared. Expert decisions live in
 * pruning_decisions (keyed by codes) so a re-import keeps them.
 */
@Entity('tea_inventory_producers')
@Index(['areaId', 'code', 'season'], { unique: true })
@Index(['areaId', 'season', 'autoStatus'])
export class TeaInventoryProducer {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'area_id' })
    areaId: string;

    @ManyToOne(() => TeaInventoryArea, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'area_id' })
    area: TeaInventoryArea;

    // Engine code, e.g. "DEMO-M-0001" — stable across seasons and re-imports.
    @Column({ type: 'varchar', length: 40 })
    code: string;

    // e.g. "2025-26".
    @Column({ type: 'varchar', length: 10 })
    season: string;

    @Column({ type: 'varchar', length: 150 })
    name: string;

    @Column({ type: 'varchar', length: 40, name: 'wallet_no' })
    walletNo: string;

    @Column({ type: 'varchar', length: 40, name: 'license_no' })
    licenseNo: string;

    @Column({ type: 'double precision', name: 'licensed_area_m2' })
    licensedAreaM2: number;

    // Tea area the satellite sees inside the producer's gardens.
    @Column({ type: 'double precision', name: 'tea_area_m2' })
    teaAreaM2: number;

    // licensedAreaM2 / 7.
    @Column({ type: 'double precision', name: 'required_m2' })
    requiredM2: number;

    // Cumulative pruned area in resolved gardens at the latest scan (gross).
    @Column({ type: 'double precision', name: 'gross_pruned_m2', default: 0 })
    grossPrunedM2: number;

    // Part of the gross overlapping ground credited in an earlier season of the 7-year cycle.
    @Column({ type: 'double precision', name: 'reused_m2', default: 0 })
    reusedM2: number;

    // gross − reused: what counts towards the target.
    @Column({ type: 'double precision', name: 'new_pruned_m2', default: 0 })
    newPrunedM2: number;

    // Pruning seen in gardens whose shared-parcel boundary is unresolved (not attributable).
    @Column({ type: 'double precision', name: 'unattributed_m2', default: 0 })
    unattributedM2: number;

    // Tea not clearly observed at the last scan with observations (cloud, snow, shadow).
    @Column({ type: 'double precision', name: 'unobserved_m2', default: 0 })
    unobservedM2: number;

    // max(0, required − new).
    @Column({ type: 'double precision', name: 'remaining_m2', default: 0 })
    remainingM2: number;

    @Column({ type: 'int', name: 'garden_count' })
    gardenCount: number;

    @Column({ type: 'int', name: 'unresolved_gardens', default: 0 })
    unresolvedGardens: number;

    @Column({ type: 'varchar', length: 24, name: 'auto_status' })
    autoStatus: ProducerAutoStatus;

    // First scan date the very-high-confidence rule held (purchase opened automatically).
    @Column({ type: 'varchar', length: 10, name: 'auto_approved_at', nullable: true })
    autoApprovedAt: string | null;

    @Column({ type: 'jsonb' })
    scans: ProducerScan[];

    @Column({ type: 'boolean', default: true })
    demo: boolean;
}
