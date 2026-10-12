import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryProducer } from '@/tea-inventory/entities/tea-inventory-producer.entity';

/**
 * One tea garden of a producer: a whole TKGM parcel, or the producer's slice of a shared
 * (hisseli) parcel. Carries its satellite tea area and cumulative pruned area per scan.
 */
@Entity('tea_inventory_gardens')
@Index(['producerId'])
@Index(['areaId', 'parcelKey'])
export class TeaInventoryGarden {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'area_id' })
    areaId: string;

    @ManyToOne(() => TeaInventoryArea, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'area_id' })
    area: TeaInventoryArea;

    @Column({ type: 'uuid', name: 'producer_id' })
    producerId: string;

    @ManyToOne(() => TeaInventoryProducer, (producer) => producer.gardens, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'producer_id' })
    producer: TeaInventoryProducer;

    // Engine code, e.g. "DEMO-B-0001".
    @Column({ type: 'varchar', length: 40 })
    code: string;

    // TKGM "mahalleId/ada/parsel" of the parcel the garden lies in.
    @Column({ type: 'varchar', length: 60, name: 'parcel_key' })
    parcelKey: string;

    @Column({ type: 'varchar', length: 20 })
    block: string;

    @Column({ type: 'varchar', length: 20 })
    parcel: string;

    // Shared parcel: this holder's index and the number of holders.
    @Column({ type: 'int', name: 'holder_index', default: 1 })
    holderIndex: number;

    @Column({ type: 'int', name: 'holder_count', default: 1 })
    holderCount: number;

    @Column({ type: 'double precision', name: 'geometry_area_m2' })
    geometryAreaM2: number;

    @Column({ type: 'double precision', name: 'tea_area_m2' })
    teaAreaM2: number;

    // Cumulative pruned m² at each scan date of the area's scan schedule.
    @Column({ type: 'jsonb', name: 'pruned_series' })
    prunedSeries: number[];

    @Column({ type: 'jsonb' })
    geometry: Record<string, unknown>;
}
