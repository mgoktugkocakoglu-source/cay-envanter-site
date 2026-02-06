import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    Index,
} from 'typeorm';
import { ForumTopic } from './forum-topic.entity';

@Entity('forum_categories')
export class ForumCategory {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Index({ unique: true })
    @Column({ type: 'varchar', length: 120 })
    slug: string;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    icon: string | null;

    @Column({ type: 'int', default: 0 })
    displayOrder: number;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @OneToMany(() => ForumTopic, (topic) => topic.category)
    topics: ForumTopic[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
