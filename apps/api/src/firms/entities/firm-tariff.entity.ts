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
import { Firm } from '@/firms/entities/firm.entity';

export type TeaQuality = 'shoot' | 'leaf' | 'mixed';

@Entity('firm_tariffs')
@Index(['firmId', 'effectiveDate'])
export class FirmTariff {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'firm_id' })
    firmId: string;

    @ManyToOne(() => Firm, (firm) => firm.tariffs, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'firm_id' })
    firm: Firm;

    @Column({ type: 'varchar', length: 20 })
    quality: TeaQuality;

    @Column({ type: 'decimal', precision: 8, scale: 2, name: 'price_per_kg' })
    pricePerKg: number;

    @Column({ type: 'date', name: 'effective_date' })
    effectiveDate: Date;

    @Column({ type: 'date', name: 'end_date', nullable: true })
    endDate: Date | null;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
