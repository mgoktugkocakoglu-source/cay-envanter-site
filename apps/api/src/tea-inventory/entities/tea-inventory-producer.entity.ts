import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryGarden } from '@/tea-inventory/entities/tea-inventory-garden.entity';

/** Satellite-derived pruning status of a producer at a scan (engine values). */
export type ProducerAutoStatus = 'auto_approved' | 'expert_review' | 'partial' | 'no_trace' | 'awaiting_observation';

/** One scan of the season for this producer: cumulative pruned area against the 1/7 target. */
export interface ProducerScan {
    date: string;
    prunedM2: number;
    observedShare: number;
    ratio: number;
    status: ProducerAutoStatus;
}

/**
 * A producer (müstahsil, ruhsat sahibi) and the satellite pruning check over ALL their gardens
 * for one season: the 1/7 rule applies to the producer's licensed tea, wherever it is pruned.
 * Expert decisions live in pruning_decisions (keyed by codes) so a re-import keeps them.
 */
@Entity('tea_inventory_producers')
@Index(['areaId', 'code'], { unique: true })
@Index(['areaId', 'autoStatus'])
export class TeaInventoryProducer {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'area_id' })
    areaId: string;

    @ManyToOne(() => TeaInventoryArea, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'area_id' })
    area: TeaInventoryArea;

    // Engine code, e.g. "DEMO-M-0001" — stable across re-imports.
    @Column({ type: 'varchar', length: 40 })
    code: string;

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

    // Cumulative pruned area at the latest scan.
    @Column({ type: 'double precision', name: 'pruned_m2' })
    prunedM2: number;

    @Column({ type: 'int', name: 'garden_count' })
    gardenCount: number;

    // e.g. "2025-26".
    @Column({ type: 'varchar', length: 10 })
    season: string;

    @Column({ type: 'varchar', length: 24, name: 'auto_status' })
    autoStatus: ProducerAutoStatus;

    // First scan date the very-high-confidence rule held (purchase opened automatically).
    @Column({ type: 'varchar', length: 10, name: 'auto_approved_at', nullable: true })
    autoApprovedAt: string | null;

    @Column({ type: 'jsonb' })
    scans: ProducerScan[];

    @Column({ type: 'boolean', default: true })
    demo: boolean;

    @OneToMany(() => TeaInventoryGarden, (garden) => garden.producer)
    gardens: TeaInventoryGarden[];
}
