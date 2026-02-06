import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from '@/users/entities/user.entity';

@Entity('sessions')
export class Session {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column({ type: 'uuid' })
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ type: 'varchar', length: 500 })
    refreshToken: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    userAgent: string | null;

    @Column({ type: 'varchar', length: 45, nullable: true })
    ipAddress: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    deviceType: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    browser: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    os: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    location: string | null;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @Column({ type: 'timestamp', nullable: true })
    lastActivityAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    expiresAt: Date | null;

    @CreateDateColumn()
    createdAt: Date;
}
