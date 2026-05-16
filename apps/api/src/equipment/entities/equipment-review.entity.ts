import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { EquipmentUsageStatus } from '@/equipment/enums/equipment.enum';
import { EquipmentItem } from '@/equipment/entities/equipment.entity';

@Entity('equipment_reviews')
@Index(['equipmentId', 'createdAt'])
export class EquipmentReview {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    @Index()
    equipmentId: string;

    @ManyToOne(() => EquipmentItem, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'equipmentId' })
    equipment: EquipmentItem;

    @Column({ type: 'uuid' })
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ type: 'text' })
    text: string;

    @Column({ type: 'int' })
    rating: number;

    @Column({ type: 'enum', enum: EquipmentUsageStatus })
    usageStatus: EquipmentUsageStatus;

    @Column({ type: 'int' })
    usageMonths: number;

    @Column({ type: 'int', default: 0 })
    likeCount: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
