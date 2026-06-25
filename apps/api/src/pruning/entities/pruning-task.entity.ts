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
import { Field } from '@/fields/entities/field.entity';

// Work-order lifecycle: assigned (pending) → officer starts (in_progress) →
// geometry captured (measured) → approvals done (completed). 'cancelled' if dropped.
export type PruningTaskStatus =
    | 'pending'
    | 'in_progress'
    | 'measured'
    | 'completed'
    | 'cancelled';

/**
 * A pruning-measurement work order: management assigns a producer's parcel to a
 * field officer (saha personeli). The officer's queue is this table filtered by
 * assignedTo. Once a measurement is captured it is linked via measurementId.
 */
@Entity('pruning_tasks')
@Index(['assignedTo', 'status'])
export class PruningTask {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'field_id' })
    fieldId: string;

    @ManyToOne(() => Field, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'field_id' })
    field: Field;

    // Producer (field owner) snapshot.
    @Column({ type: 'uuid', name: 'producer_id' })
    producerId: string;

    // Field officer (saha personeli) the task is assigned to.
    @Column({ type: 'uuid', name: 'assigned_to' })
    assignedTo: string;

    // Manager (kurum_admin / fabrika_sorumlusu) who created the assignment.
    @Column({ type: 'uuid', name: 'assigned_by' })
    assignedBy: string;

    @Column({ type: 'varchar', length: 16, default: 'pending' })
    status: PruningTaskStatus;

    // Linked measurement once the officer captures one.
    @Column({ type: 'uuid', name: 'measurement_id', nullable: true })
    measurementId: string | null;

    // Snapshots for list display without joins.
    @Column({ type: 'varchar', length: 50, name: 'parcel_no', nullable: true })
    parcelNo: string | null;

    @Column({ type: 'varchar', length: 150, name: 'producer_name', nullable: true })
    producerName: string | null;

    @Column({ type: 'timestamp', name: 'due_date', nullable: true })
    dueDate: Date | null;

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
