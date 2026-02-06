import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    Index,
    JoinColumn,
    Unique,
} from 'typeorm';
import { User } from '@/users/entities/user.entity';

export enum ReactionTargetType {
    TOPIC = 'topic',
    REPLY = 'reply',
}

export enum ReactionType {
    LIKE = 'like',
    HELPFUL = 'helpful',
    THANKS = 'thanks',
}

@Entity('forum_reactions')
@Unique(['userId', 'targetType', 'targetId', 'reactionType'])
@Index(['targetType', 'targetId'])
export class ForumReaction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({
        type: 'enum',
        enum: ReactionTargetType,
    })
    targetType: ReactionTargetType;

    @Column({ type: 'uuid' })
    targetId: string;

    @Column({
        type: 'enum',
        enum: ReactionType,
    })
    reactionType: ReactionType;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @CreateDateColumn()
    createdAt: Date;
}
