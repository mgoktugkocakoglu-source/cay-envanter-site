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
import { ForumTopic } from './forum-topic.entity';

@Entity('forum_subscriptions')
@Unique(['userId', 'topicId'])
@Index(['userId', 'isActive'])
export class ForumSubscription {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'uuid' })
    topicId: string;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToOne(() => ForumTopic, (topic) => topic.subscriptions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'topicId' })
    topic: ForumTopic;

    @CreateDateColumn()
    createdAt: Date;
}
