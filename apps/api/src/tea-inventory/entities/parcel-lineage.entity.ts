import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';

export type ParcelChangeType = '22-a yenileme' | 'ifraz' | 'tevhit' | 'kamulaştırma';

/**
 * Old → new parcel link: licences written decades ago cite pafta/parsel numbers that cadastral
 * renewal (22-a), splits and merges have since replaced. These rows let an old reference
 * resolve to a current TKGM parcel ("historical" match).
 */
@Entity('tea_inventory_parcel_lineage')
@Index(['areaId', 'code'], { unique: true })
@Index(['areaId', 'newParcelKey'])
export class ParcelLineage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'area_id' })
    areaId: string;

    @ManyToOne(() => TeaInventoryArea, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'area_id' })
    area: TeaInventoryArea;

    @Column({ type: 'varchar', length: 40 })
    code: string;

    // As written on old records: "Pafta 4 / Parsel 112".
    @Column({ type: 'varchar', length: 120, name: 'old_ref' })
    oldRef: string;

    @Column({ type: 'varchar', length: 60, name: 'new_parcel_key' })
    newParcelKey: string;

    @Column({ type: 'varchar', length: 30, name: 'change_type' })
    changeType: ParcelChangeType;

    @Column({ type: 'varchar', length: 150 })
    source: string;

    @Column({ type: 'date', name: 'changed_at' })
    changedAt: string;
}
