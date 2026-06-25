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
import { Field } from '@/fields/entities/field.entity';

// How the pruned area was captured (mirrors the three field situations in the spec).
export type MeasurementMethod = 'map' | 'gps' | 'assisted';

// GPS / measurement confidence: high = 1-3m, medium = 3-5m, low = >5m or map estimate.
export type AccuracyLevel = 'high' | 'medium' | 'low';

// Approval lifecycle. A fresh capture is 'measured'; producer + staff approvals
// advance it; either party may 'reject'. 'completed' = both approved.
export type PruningStatus =
    | 'measured'
    | 'producer_approved'
    | 'staff_approved'
    | 'completed'
    | 'rejected';

@Entity('pruning_measurements')
@Index(['fieldId', 'createdAt'])
export class PruningMeasurement {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'field_id' })
    fieldId: string;

    @ManyToOne(() => Field, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'field_id' })
    field: Field;

    // Staff member who performed the measurement.
    @Column({ type: 'uuid', name: 'user_id' })
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ type: 'varchar', length: 16 })
    method: MeasurementMethod;

    // Pruned-area polygon as a ring of [lng, lat] pairs (GeoJSON order). Stored so the
    // shape can be redrawn and compared against future years.
    @Column({ type: 'jsonb' })
    geometry: number[][];

    @Column({ type: 'double precision', name: 'pruned_area_m2' })
    prunedAreaM2: number;

    // Snapshot of the parcel's total area (m²) at measurement time.
    @Column({ type: 'double precision', name: 'field_area_m2' })
    fieldAreaM2: number;

    @Column({ type: 'double precision', name: 'ratio_percent' })
    ratioPercent: number;

    @Column({ type: 'varchar', length: 8, name: 'accuracy_level', nullable: true })
    accuracyLevel: AccuracyLevel | null;

    @Column({ type: 'boolean', name: 'field_check_done', default: false })
    fieldCheckDone: boolean;

    @Column({ type: 'double precision', name: 'gps_accuracy_meters', nullable: true })
    gpsAccuracyMeters: number | null;

    @Column({ type: 'varchar', length: 500, name: 'photo_url', nullable: true })
    photoUrl: string | null;

    @Column({ type: 'boolean', name: 'producer_approved', default: false })
    producerApproved: boolean;

    @Column({ type: 'boolean', name: 'staff_approved', default: false })
    staffApproved: boolean;

    // Approval lifecycle stage; derived from the two approval flags. Existing
    // rows backfill to 'measured'.
    @Column({ type: 'varchar', length: 24, default: 'measured' })
    status: PruningStatus;

    // Reason captured when a producer or staff member rejects the measurement.
    @Column({ type: 'text', name: 'rejection_reason', nullable: true })
    rejectionReason: string | null;

    // Snapshot of producer/owner and parcel identifiers for audit history.
    @Column({ type: 'varchar', length: 150, name: 'producer_name', nullable: true })
    producerName: string | null;

    @Column({ type: 'varchar', length: 50, name: 'parcel_no', nullable: true })
    parcelNo: string | null;

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @Column({ type: 'timestamp', name: 'measured_at' })
    measuredAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
