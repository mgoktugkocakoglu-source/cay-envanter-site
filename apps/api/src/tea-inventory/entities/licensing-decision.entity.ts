import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import type { ApplicationStatus } from '@/tea-inventory/entities/licensing-application.entity';

/**
 * A reviewer's step on a licensing application (status transition + note). Keyed by area and
 * application codes, not foreign keys, so a re-import of the register keeps the audit trail;
 * the latest row gives the application's effective status.
 */
@Entity('licensing_decisions')
@Index(['areaCode', 'applicationCode', 'createdAt'])
export class LicensingDecision {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 120, name: 'area_code' })
    areaCode: string;

    @Column({ type: 'varchar', length: 40, name: 'application_code' })
    applicationCode: string;

    @Column({ type: 'varchar', length: 30, name: 'from_status' })
    fromStatus: ApplicationStatus;

    @Column({ type: 'varchar', length: 30, name: 'to_status' })
    toStatus: ApplicationStatus;

    @Column({ type: 'text', nullable: true })
    note: string | null;

    @Column({ type: 'uuid', name: 'decided_by_id' })
    decidedById: string;

    @Column({ type: 'varchar', length: 150, name: 'decided_by_name' })
    decidedByName: string;

    @CreateDateColumn()
    createdAt: Date;
}
