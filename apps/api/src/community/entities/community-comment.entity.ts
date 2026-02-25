import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    ManyToOne,
    Index,
    JoinColumn,
} from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { CommunityPost } from './community-post.entity';

@Entity('community_comments')
@Index(['postId', 'createdAt'])
export class CommunityComment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    postId: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'varchar', length: 500 })
    content: string;

    @Column({ type: 'int', default: 0 })
    likeCount: number;

    @Column({ type: 'int', default: 0 })
    dislikeCount: number;

    @ManyToOne(() => CommunityPost, (post) => post.comments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'postId' })
    post: CommunityPost;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @CreateDateColumn()
    createdAt: Date;

    @DeleteDateColumn()
    deletedAt: Date | null;
}
