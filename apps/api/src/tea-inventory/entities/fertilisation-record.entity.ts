import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** What was applied. */
export type FertiliserType = 'nitrogen' | 'compound' | 'organic' | 'foliar' | 'other';
export const FERTILISER_TYPES: FertiliserType[] = ['nitrogen', 'compound', 'organic', 'foliar', 'other'];

/**
 * A fertilisation (or other input) record of a garden, entered by the producer or staff. Keyed
 * by area / garden codes so it survives a re-import of the satellite results. The garden-health
 * module reads the satellite response after the date (NDRE / NDVI against the neighbourhood).
 */
@Entity('fertilisation_records')
@Index(['areaCode', 'gardenCode', 'appliedAt'])
@Index(['areaCode', 'producerCode'])
export class FertilisationRecord {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 120, name: 'area_code' })
    areaCode: string;

    @Column({ type: 'varchar', length: 40, name: 'garden_code' })
    gardenCode: string;

    @Column({ type: 'varchar', length: 40, name: 'producer_code', default: '' })
    producerCode: string;

    @Column({ type: 'date', name: 'applied_at' })
    appliedAt: string;

    @Column({ type: 'varchar', length: 20 })
    type: FertiliserType;

    // Product name as written on the bag, e.g. "25.5.10 kompoze".
    @Column({ type: 'varchar', length: 120, default: '' })
    product: string;

    @Column({ type: 'double precision', name: 'amount_kg_per_da', nullable: true })
    amountKgPerDa: number | null;

    @Column({ type: 'text', nullable: true })
    note: string | null;

    @Column({ type: 'varchar', length: 20, default: 'staff' })
    source: 'producer' | 'staff';

    @Column({ type: 'uuid', name: 'created_by_id', nullable: true })
    createdById: string | null;

    @Column({ type: 'varchar', length: 150, name: 'created_by_name', default: '' })
    createdByName: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
