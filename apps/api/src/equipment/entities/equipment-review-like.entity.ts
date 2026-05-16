import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { EquipmentReview } from '@/equipment/entities/equipment-review.entity';

@Entity('equipment_review_likes')
@Unique(['userId', 'reviewId'])
export class EquipmentReviewLike {
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
    reviewId: string;

    @ManyToOne(() => EquipmentReview, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'reviewId' })
    review: EquipmentReview;

    @CreateDateColumn()
    createdAt: Date;
}
