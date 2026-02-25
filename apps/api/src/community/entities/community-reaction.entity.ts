import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    Index,
    Unique,
    JoinColumn,
} from 'typeorm';
import { User } from '@/users/entities/user.entity';

export enum CommunityReactionTargetType {
    POST = 'post',
    COMMENT = 'comment',
}

export enum CommunityReactionType {
    LIKE = 'like',
    DISLIKE = 'dislike',
}

@Entity('community_reactions')
@Unique(['userId', 'targetType', 'targetId'])
@Index(['targetType', 'targetId'])
export class CommunityReaction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({
        type: 'enum',
        enum: CommunityReactionTargetType,
    })
    targetType: CommunityReactionTargetType;

    @Column({ type: 'uuid' })
    targetId: string;

    @Column({
        type: 'enum',
        enum: CommunityReactionType,
    })
    reactionType: CommunityReactionType;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @CreateDateColumn()
    createdAt: Date;
}
