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

    // ── Çaykur producer (müstahsil) profile ──
    // Bureaucratic identifiers maintained by Çaykur. Optional: a producer can
    // exist in the platform before Çaykur supplies them; the monitoring panel
    // falls back to derived values (e.g. quota from licensed area) when unset.

    // Çaykur licence number (ruhsat no).
    @Column({ type: 'varchar', length: 50, nullable: true })
    ruhsatNo: string | null;

    // Producer booklet number (cüzdan no).
    @Column({ type: 'varchar', length: 50, nullable: true })
    cuzdanNo: string | null;

    // Whether the producer holds organic certification.
    @Column({ type: 'boolean', default: false })
    organic: boolean;

    // Affiliated Çaykur factory the producer delivers to.
    @Column({ type: 'varchar', length: 150, nullable: true })
    factory: string | null;

    // Çaykur-set annual purchase quota (kg). When null, the panel derives it
    // from licensed area (quotaPerDekar × dekar).
    @Column({ type: 'int', nullable: true })
    annualQuotaKg: number | null;

    // Çaykur per-dekar purchase quota (kg/dekar) for the current period. Çaykur
    // adjusts this periodically; the producer dashboard multiplies it by the
    // total licensed area to show the weekly delivery allowance.
    @Column({ type: 'int', nullable: true })
    quotaPerDekarKg: number | null;

    // Çaykur appointment (randevu) days the producer may deliver tea on, stored
    // as lowercase English weekday keys (e.g. ['wednesday', 'saturday']).
    @Column({ type: 'simple-array', nullable: true })
    appointmentDays: string[] | null;

    @Column({ type: 'varchar', length: 500, nullable: true })
    avatarUrl: string | null;

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

