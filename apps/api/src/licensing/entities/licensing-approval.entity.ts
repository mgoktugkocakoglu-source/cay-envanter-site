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
import { LicensingMeasurement } from '@/licensing/entities/licensing-measurement.entity';

export type LicensingApprovalStatus = 'pending' | 'approved' | 'rejected';

/**
 * One co-owner's decision on a licensing measurement. A row is created for
 * every registrant of the parcel other than the measured owner; the
 * measurement is approved once all rows are approved and rejected as soon as
 * one row is rejected. These rows are also what the producer's
 * "Bildirimler" page lists.
 */
@Entity('licensing_approvals')
@Index(['approverId', 'status'])
@Index(['measurementId', 'approverId'], { unique: true })
export class LicensingApproval {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'measurement_id' })
    measurementId: string;

    @ManyToOne(() => LicensingMeasurement, (m) => m.approvals, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'measurement_id' })
    measurement: LicensingMeasurement;

    @Column({ type: 'uuid', name: 'approver_id' })
    approverId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'approver_id' })
    approver: User;

    @Column({ type: 'varchar', length: 150, name: 'approver_name' })
    approverName: string;

    @Column({ type: 'varchar', length: 16, default: 'pending' })
    status: LicensingApprovalStatus;

    @Column({ type: 'timestamp', name: 'decided_at', nullable: true })
    decidedAt: Date | null;

    @Column({ type: 'text', nullable: true })
    reason: string | null;

    @Column({ type: 'boolean', name: 'email_sent', default: false })
    emailSent: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
