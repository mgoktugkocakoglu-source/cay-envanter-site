import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Field } from '@/fields/entities/field.entity';

export type HarvestQuality = 'shoot' | 'leaf' | 'mixed';

@Entity('harvests')
@Index(['fieldId', 'harvestDate'])
export class Harvest {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'field_id' })
    fieldId: string;

    @ManyToOne(() => Field, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'field_id' })
    field: Field;

    @Column({ type: 'date' })
    harvestDate: Date;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    amountKg: number;

    @Column({ type: 'varchar', length: 20, nullable: true })
    quality: HarvestQuality | null;

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @Column({ type: 'boolean', default: false })
    deleted: boolean;

    @Column({ type: 'timestamp', nullable: true })
    deletedAt: Date | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
