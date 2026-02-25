import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToMany,
    Index,
} from 'typeorm';
import { CommunityPost } from './community-post.entity';

@Entity('community_tags')
export class CommunityTag {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index({ unique: true })
    @Column({ type: 'varchar', length: 50 })
    name: string;

    @Column({ type: 'varchar', length: 100 })
    displayName: string;

    @Column({ type: 'int', default: 0 })
    usageCount: number;

    @Column({ type: 'boolean', default: false })
    isSystem: boolean;

    @ManyToMany(() => CommunityPost, (post) => post.tags)
    posts: CommunityPost[];

    @CreateDateColumn()
    createdAt: Date;
}
