import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { Role, UserType } from '@/auth/enums';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 100 })
    fullName: string;

    @Index({ unique: true })
    @Column({ type: 'varchar', length: 255 })
    email: string;

    @Column({ type: 'varchar', length: 255 })
    password: string;

    @Index({ unique: true })
    @Column({ type: 'varchar', length: 20 })
    phone: string;

    @Column({ type: 'varchar', length: 100 })
    province: string;

    @Column({ type: 'varchar', length: 100 })
    district: string;

    @Index({ unique: true })
    @Column({ type: 'varchar', length: 11, nullable: true })
    farmerIdNumber: string | null;

    @Column({
        type: 'enum',
        enum: UserType,
        default: UserType.SELF_FARMER,
    })
    userType: UserType;

    @Column({
        type: 'enum',
        enum: Role,
        default: Role.USER,
    })
    role: Role;

    @Column({ type: 'boolean', default: false })
    emailVerified: boolean;

    @Column({ type: 'timestamp', nullable: true })
    verifiedAt: Date | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    verificationToken: string | null;

    @Column({ type: 'timestamp', nullable: true })
    verificationTokenExpiry: Date | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    resetPasswordToken: string | null;

    @Column({ type: 'timestamp', nullable: true })
    resetPasswordTokenExpiry: Date | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    deletionToken: string | null;

    @Column({ type: 'timestamp', nullable: true })
    deletionTokenExpiry: Date | null;

    @Column({ type: 'boolean', default: false })
    deleted: boolean;

    @Column({ type: 'timestamp', nullable: true })
    deletedAt: Date | null;

    @Column({ type: 'boolean', default: false })
    suspended: boolean;

    @Column({ type: 'varchar', length: 500, nullable: true })
    refreshToken: string | null;

    @Column({ type: 'timestamp', nullable: true })
    lastLogin: Date | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

