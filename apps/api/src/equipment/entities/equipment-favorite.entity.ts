import { CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, Column } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { EquipmentItem } from '@/equipment/entities/equipment.entity';

@Entity('equipment_favorites')
@Unique(['userId', 'equipmentId'])
export class EquipmentFavorite {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    @Index()
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ type: 'uuid' })
    @Index()
    equipmentId: string;

    @ManyToOne(() => EquipmentItem, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'equipmentId' })
    equipment: EquipmentItem;

    @CreateDateColumn()
    createdAt: Date;
}
