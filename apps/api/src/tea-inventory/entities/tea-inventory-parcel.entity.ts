import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TeaInventoryArea, InventoryLicense } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { InventoryClass } from '@/tea-inventory/enums/inventory-class.enum';

/**
 * A TKGM parcel with its satellite tea detection, the license resolved to it
 * and the decision-matrix class. The class is a flag for an expert, never a
 * legal verdict.
 */
@Entity('tea_inventory_parcels')
@Index(['areaId', 'parcelKey'], { unique: true })
@Index(['areaId', 'inventoryClass'])
export class TeaInventoryParcel {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'area_id' })
    areaId: string;

    @ManyToOne(() => TeaInventoryArea, (area) => area.parcels, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'area_id' })
    area: TeaInventoryArea;

    // TKGM "mahalleId/ada/parsel".
    @Column({ type: 'varchar', length: 60, name: 'parcel_key' })
    parcelKey: string;

    @Column({ type: 'varchar', length: 20 })
    block: string;

    @Column({ type: 'varchar', length: 20 })
    parcel: string;

    // TKGM deed title ("nitelik").
    @Column({ type: 'varchar', length: 255 })
    nature: string;

    @Column({ type: 'varchar', length: 255, default: '' })
    locality: string;

    @Column({ type: 'double precision', name: 'deed_area_m2', nullable: true })
    deedAreaM2: number | null;

    @Column({ type: 'double precision', name: 'geometry_area_m2' })
    geometryAreaM2: number;

    @Column({ type: 'double precision', name: 'tea_probability', nullable: true })
    teaProbability: number | null;

    // Share of the parcel's pixels classified as tea (0–1).
    @Column({ type: 'double precision', name: 'tea_share', nullable: true })
    teaShare: number | null;

    @Column({ type: 'double precision', name: 'tea_area_m2', nullable: true })
    teaAreaM2: number | null;

    @Column({ type: 'varchar', length: 20, name: 'inventory_class' })
    inventoryClass: InventoryClass;

    @Column({ type: 'jsonb', nullable: true })
    license: InventoryLicense | null;

    @Column({ type: 'jsonb' })
    geometry: Record<string, unknown>;
}
