import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    ManyToOne,
    OneToMany,
    ManyToMany,
    JoinTable,
    Index,
    JoinColumn,
} from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { CommunityTag } from './community-tag.entity';
import { CommunityComment } from './community-comment.entity';

export enum PostType {
    TEXT = 'text',
    PHOTO = 'photo',
    VIDEO = 'video',
}

@Entity('community_posts')
@Index(['userId', 'createdAt'])
@Index(['type', 'createdAt'])
export class CommunityPost {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'text', nullable: true })
    content: string | null;

    @Column({
        type: 'enum',
        enum: PostType,
        default: PostType.TEXT,
    })
    type: PostType;

    @Column({ type: 'jsonb', default: [] })
    mediaUrls: string[];

    @Column({ type: 'int', default: 0 })
    likeCount: number;

    @Column({ type: 'int', default: 0 })
    dislikeCount: number;

    @Column({ type: 'int', default: 0 })
    commentCount: number;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToMany(() => CommunityTag, (tag) => tag.posts)
    @JoinTable({
        name: 'community_post_tags',
        joinColumn: { name: 'postId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'tagId', referencedColumnName: 'id' },
    })
    tags: CommunityTag[];

    @OneToMany(() => CommunityComment, (comment) => comment.post)
    comments: CommunityComment[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt: Date | null;
}
