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

@Entity('firm_collection_points')
@Index(['firmId', 'province', 'district'])
export class FirmCollectionPoint {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'firm_id' })
    firmId: string;

    @ManyToOne(() => Firm, (firm) => firm.collectionPoints, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'firm_id' })
    firm: Firm;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({ type: 'varchar', length: 50 })
    province: string;

    @Column({ type: 'varchar', length: 50 })
    district: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    address: string | null;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    latitude: number | null;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    longitude: number | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    collectorName: string | null;

    @Column({ type: 'varchar', length: 20, nullable: true })
    collectorPhone: string | null;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
