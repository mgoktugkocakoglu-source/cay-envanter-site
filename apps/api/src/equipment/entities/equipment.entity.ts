import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { EquipmentCategory, EquipmentStatus } from '@/equipment/enums/equipment.enum';
import { EquipmentReview } from '@/equipment/entities/equipment-review.entity';

@Entity('equipment_items')
export class EquipmentItem {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    @Index()
    createdById: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'createdById' })
    createdBy: User;

    @Column({ type: 'uuid', nullable: true })
    approvedById: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'approvedById' })
    approvedBy: User | null;

    @Column({ type: 'enum', enum: EquipmentCategory })
    @Index()
    category: EquipmentCategory;

    @Column({ type: 'enum', enum: EquipmentStatus, default: EquipmentStatus.PENDING })
    @Index()
    status: EquipmentStatus;

    @Column({ type: 'varchar', length: 120 })
    brand: string;

    @Column({ type: 'varchar', length: 120 })
    model: string;

    @Column({ type: 'varchar', length: 180 })
    typeLabel: string;

    @Column({ type: 'int' })
    price: number;

    @Column({ type: 'int', nullable: true })
    segmentAverage: number | null;

    @Column({ type: 'varchar', length: 600, nullable: true })
    imageUrl: string | null;

    @Column({ type: 'jsonb', default: [] })
    specs: { label: string; value: string }[];

    @OneToMany(() => EquipmentReview, review => review.equipment)
    reviews: EquipmentReview[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
