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
import { ForumTopic } from './forum-topic.entity';

@Entity('forum_replies')
@Index(['topicId', 'createdAt'])
export class ForumReply {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    topicId: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'uuid', nullable: true })
    parentReplyId: string | null;

    @Column({ type: 'text' })
    content: string;

    @Column({ type: 'boolean', default: false })
    isSolution: boolean;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToOne(() => ForumTopic, (topic) => topic.replies, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'topicId' })
    topic: ForumTopic;

    @ManyToOne(() => ForumReply, (reply) => reply.childReplies, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'parentReplyId' })
    parentReply: ForumReply | null;

    @OneToMany(() => ForumReply, (reply) => reply.parentReply)
    childReplies: ForumReply[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
