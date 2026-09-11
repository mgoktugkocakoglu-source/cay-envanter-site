import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { PruningRequest, MeasurementPoint } from '@/pruning/entities';
import { LicensingApproval } from '@/licensing/entities/licensing-approval.entity';

/**
 * Ruhsatlandırma ölçümü lifecycle.
 *  - pending_approval: captured by staff; the other registrants of the parcel
 *    must confirm the slice measured for the selected owner
 *  - approved: every co-owner confirmed
 *  - rejected: at least one co-owner objected (reason on the approval row)
 */
export type LicensingMeasurementStatus = 'pending_approval' | 'approved' | 'rejected';

/**
 * Ruhsatlandırma (licensing) measurement — on a hisseli (shared-title) parcel
 * the Çaykur authorized person measures the slice that belongs to ONE of the
 * registered owners. Saving it does not settle ownership: the remaining
 * registrants receive an e-mail + in-app approval request and each must
 * confirm (see LicensingApproval).
 */
@Entity('licensing_measurements')
@Index(['pruningRequestId', 'createdAt'])
@Index(['ownerId', 'status'])
export class LicensingMeasurement {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'pruning_request_id' })
    pruningRequestId: string;

    @ManyToOne(() => PruningRequest, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'pruning_request_id' })
    pruningRequest: PruningRequest;

    // Parcel snapshot (mirrors the request so the row is self-describing).
    @Column({ type: 'varchar', length: 100 })
    il: string;

    @Column({ type: 'varchar', length: 100 })
    ilce: string;

    @Column({ type: 'varchar', length: 50 })
    ada: string;

    @Column({ type: 'varchar', length: 50 })
    parsel: string;

    // Registered owner whose slice was measured.
    @Column({ type: 'uuid', name: 'owner_id' })
    ownerId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'owner_id' })
    owner: User;

    @Column({ type: 'varchar', length: 150, name: 'owner_name' })
    ownerName: string;

    @Column({ type: 'varchar', length: 50, name: 'owner_cuzdan_no', nullable: true })
    ownerCuzdanNo: string | null;

    // ── Measurement (same capture techniques as the pruning measurement) ──
    @Column({ type: 'double precision', name: 'measured_area_m2' })
    measuredAreaM2: number;

    @Column({ type: 'jsonb', name: 'measurement_points', default: () => "'[]'" })
    measurementPoints: MeasurementPoint[];

    @Column({ type: 'varchar', length: 16 })
    method: string;

    @Column({ type: 'varchar', length: 8, name: 'accuracy_level', nullable: true })
    accuracyLevel: string | null;

    @Column({ type: 'varchar', length: 16, name: 'fix_quality', nullable: true })
    fixQuality: string | null;

    @Column({ type: 'uuid', name: 'measured_by_id' })
    measuredById: string;

    @Column({ type: 'varchar', length: 150, name: 'measured_by_name' })
    measuredByName: string;

    @Column({ type: 'timestamp', name: 'measured_at' })
    measuredAt: Date;

    @Column({ type: 'varchar', length: 24, default: 'pending_approval' })
    status: LicensingMeasurementStatus;

    @Column({ type: 'timestamp', name: 'resolved_at', nullable: true })
    resolvedAt: Date | null;

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @OneToMany(() => LicensingApproval, (approval) => approval.measurement, { cascade: true })
    approvals: LicensingApproval[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
