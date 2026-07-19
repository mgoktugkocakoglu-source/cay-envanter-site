import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { User } from '@/users/entities/user.entity';

/**
 * Budama talebi — a producer's request to have a pruned parcel registered.
 *
 * Lifecycle (two actors, single source of truth in the DB):
 *  - pending:   producer opened the request (il/ilçe + ada/parsel)
 *  - scheduled: Çaykur authorized person set an appointment date
 *  - measured:  the authorized person captured the on-site 3D measurement
 *  - approved:  the authorized person approved → registration complete
 *  - rejected:  the request was rejected (with a reason in `notes`)
 */
export type PruningRequestStatus = 'pending' | 'scheduled' | 'measured' | 'approved' | 'rejected';

/** A single 3D measurement vertex captured by the precise receiver. */
export interface MeasurementPoint {
    lat: number;
    lng: number;
    altitudeMeters: number;
}

@Entity('pruning_requests')
@Index(['producerId', 'createdAt'])
@Index(['status'])
export class PruningRequest {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'producer_id' })
    producerId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'producer_id' })
    producer: User;

    @Column({ type: 'varchar', length: 150, name: 'producer_name' })
    producerName: string;

    @Column({ type: 'varchar', length: 100 })
    il: string;

    @Column({ type: 'varchar', length: 100 })
    ilce: string;

    @Column({ type: 'varchar', length: 50 })
    ada: string;

    @Column({ type: 'varchar', length: 50 })
    parsel: string;

    @Column({ type: 'double precision', name: 'registered_area_m2', default: 0 })
    registeredAreaM2: number;

    /** Cadastral parcel outline as a [lng, lat] ring (TKGM-style), if known. */
    @Column({ type: 'jsonb', name: 'parcel_geometry', nullable: true })
    parcelGeometry: number[][] | null;

    @Column({ type: 'varchar', length: 16, default: 'pending' })
    status: PruningRequestStatus;

    @Column({ type: 'date', name: 'appointment_date', nullable: true })
    appointmentDate: string | null;

    @Column({ type: 'uuid', name: 'appointed_by_id', nullable: true })
    appointedById: string | null;

    @Column({ type: 'varchar', length: 150, name: 'appointed_by_name', nullable: true })
    appointedByName: string | null;

    // ── Measurement result (filled by the authorized person in the panel) ──
    @Column({ type: 'double precision', name: 'measured_area_m2', nullable: true })
    measuredAreaM2: number | null;

    @Column({ type: 'jsonb', name: 'measurement_points', default: () => "'[]'" })
    measurementPoints: MeasurementPoint[];

    @Column({ type: 'varchar', length: 8, name: 'accuracy_level', nullable: true })
    accuracyLevel: string | null;

    @Column({ type: 'varchar', length: 16, name: 'fix_quality', nullable: true })
    fixQuality: string | null;

    @Column({ type: 'varchar', length: 16, nullable: true })
    method: string | null;

    @Column({ type: 'timestamp', name: 'measured_at', nullable: true })
    measuredAt: Date | null;

    @Column({ type: 'uuid', name: 'measured_by_id', nullable: true })
    measuredById: string | null;

    @Column({ type: 'varchar', length: 150, name: 'measured_by_name', nullable: true })
    measuredByName: string | null;

    @Column({ type: 'timestamp', name: 'approved_at', nullable: true })
    approvedAt: Date | null;

    @Column({ type: 'varchar', length: 150, name: 'approved_by_name', nullable: true })
    approvedByName: string | null;

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
