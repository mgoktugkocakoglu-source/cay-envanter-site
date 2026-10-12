import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';

/** A pruning event inside a garden: where (polygon) and when (an observation interval, never a day). */
export interface GardenPruningEvent {
    areaM2: number;
    reusedM2: number;
    lastNoChangeAt: string | null;
    firstChangeAt: string | null;
    detectedAt: string | null;
    geometry: Record<string, unknown>;
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
}

/**
 * One tea garden of a producer: a whole TKGM parcel, or the producer's slice of a shared
 * (hisseli) parcel. Static across seasons (the ground record); per-season results and event
 * polygons hang off it so the same ground can be compared year over year.
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

    // Season → results and events ("2025-26" → …).
    @Column({ type: 'jsonb', default: () => "'{}'" })
    seasons: Record<string, GardenSeason>;

    @Column({ type: 'jsonb' })
    geometry: Record<string, unknown>;
}
