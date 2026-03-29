import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { JobListingType, JobListingCategory, JobListingStatus } from '../enums/job-listing.enum';

@Entity('job_listings')
export class JobListing {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    @Index()
    authorId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'authorId' })
    author: User;

    @Column({
        type: 'enum',
        enum: JobListingType,
    })
    @Index()
    type: JobListingType;

    @Column({
        type: 'enum',
        enum: JobListingCategory,
    })
    @Index()
    category: JobListingCategory;

    @Column({
        type: 'enum',
        enum: JobListingStatus,
        default: JobListingStatus.ACTIVE,
    })
    @Index()
    status: JobListingStatus;

    @Column({ type: 'varchar', length: 255 })
    location: string;

    @Column({ type: 'jsonb', default: {} })
    metadata: Record<string, any>;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
