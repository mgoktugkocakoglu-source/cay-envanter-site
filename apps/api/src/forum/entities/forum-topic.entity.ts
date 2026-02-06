import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    Index,
    JoinColumn,
} from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { ForumCategory } from './forum-category.entity';
import { ForumReply } from './forum-reply.entity';
import { ForumSubscription } from './forum-subscription.entity';

@Entity('forum_topics')
@Index(['categoryId', 'createdAt'])
@Index(['userId', 'createdAt'])
export class ForumTopic {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    categoryId: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'varchar', length: 200 })
    title: string;

    @Index({ unique: true })
    @Column({ type: 'varchar', length: 250 })
    slug: string;

    @Column({ type: 'text' })
    content: string;

    @Column({ type: 'int', default: 0 })
    viewCount: number;

    @Column({ type: 'int', default: 0 })
    replyCount: number;

    @Column({ type: 'boolean', default: false })
    isPinned: boolean;

    @Column({ type: 'boolean', default: false })
    isLocked: boolean;

    @Column({ type: 'boolean', default: false })
    isSolved: boolean;

    @Column({ type: 'timestamp', nullable: true })
    lastActivityAt: Date | null;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToOne(() => ForumCategory, (category) => category.topics, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'categoryId' })
    category: ForumCategory;

    @OneToMany(() => ForumReply, (reply) => reply.topic)
    replies: ForumReply[];

    @OneToMany(() => ForumSubscription, (sub) => sub.topic)
    subscriptions: ForumSubscription[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
