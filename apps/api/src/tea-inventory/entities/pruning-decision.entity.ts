import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type PruningDecisionValue = 'approved' | 'rejected';

/**
 * An expert's pruning decision for a producer and season. Keyed by area/producer codes (not
 * foreign keys) so decisions survive a re-import of the satellite results; the latest row wins
 * and earlier rows stay as the audit trail.
 */
@Entity('pruning_decisions')
@Index(['areaCode', 'producerCode', 'season', 'createdAt'])
export class PruningDecision {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 120, name: 'area_code' })
    areaCode: string;

    @Column({ type: 'varchar', length: 40, name: 'producer_code' })
    producerCode: string;

    @Column({ type: 'varchar', length: 10 })
    season: string;

    @Column({ type: 'varchar', length: 10 })
    decision: PruningDecisionValue;

    @Column({ type: 'text', nullable: true })
    note: string | null;

    @Column({ type: 'uuid', name: 'decided_by_id' })
    decidedById: string;

    @Column({ type: 'varchar', length: 150, name: 'decided_by_name' })
    decidedByName: string;

    @CreateDateColumn()
    createdAt: Date;
}
