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
import { Field } from '@/fields/entities/field.entity';

/**
 * Arazide ölçüm talebi — a producer on a hisseli parcel who cannot make out
 * their slice on satellite imagery asks Çaykur staff to measure it on site.
 *
 * Lifecycle:
 *  - pending:   producer opened the request from one of their fields
 *  - scheduled: Çaykur authorized person set an appointment date
 *  - measured:  staff saved a licensing measurement on this request; the
 *               co-owners' approvals are pending
 *  - closed:    the producer's slice was approved by every co-owner
 *  - rejected:  staff rejected the request (reason in `notes`)
 *  - cancelled: producer withdrew it before it was measured
 */
export type LandMeasurementRequestStatus =
    | 'pending'
    | 'scheduled'
    | 'measured'
    | 'closed'
    | 'rejected'
    | 'cancelled';

/** Statuses in which the request still occupies the field. */
export const OPEN_MEASUREMENT_REQUEST_STATUSES: LandMeasurementRequestStatus[] = ['pending', 'scheduled', 'measured'];

@Entity('land_measurement_requests')
@Index(['producerId', 'createdAt'])
@Index(['fieldId', 'status'])
@Index(['status'])
export class LandMeasurementRequest {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'producer_id' })
    producerId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'producer_id' })
    producer: User;

    @Column({ type: 'varchar', length: 150, name: 'producer_name' })
    producerName: string;

    @Column({ type: 'uuid', name: 'field_id' })
    fieldId: string;

    @ManyToOne(() => Field, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'field_id' })
    field: Field;

    // Parcel snapshot (mirrors the field so the row is self-describing).
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
    status: LandMeasurementRequestStatus;

    @Column({ type: 'date', name: 'appointment_date', nullable: true })
    appointmentDate: string | null;

    @Column({ type: 'uuid', name: 'appointed_by_id', nullable: true })
    appointedById: string | null;

    @Column({ type: 'varchar', length: 150, name: 'appointed_by_name', nullable: true })
    appointedByName: string | null;

    /** Free text from the producer when opening the request. */
    @Column({ type: 'text', name: 'producer_note', nullable: true })
    producerNote: string | null;

    /** Staff notes (rejection reason). */
    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @Column({ type: 'timestamp', name: 'closed_at', nullable: true })
    closedAt: Date | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
