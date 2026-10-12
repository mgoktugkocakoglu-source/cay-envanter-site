import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';

export type ApplicationType = 'new_license' | 'area_correction' | 'transfer' | 'boundary_determination' | 'parcel_update';

export const APPLICATION_STATUSES = [
    'DRAFT',
    'DOCUMENTS_PENDING',
    'MATCHING_REQUIRED',
    'GEOMETRY_PROPOSED',
    'BOUNDARY_CONFLICT',
    'UNDER_REVIEW',
    'FIELD_CHECK_REQUIRED',
    'DEMO_APPROVED',
    'RETURNED_FOR_CORRECTION',
    'REJECTED',
    'SUPERSEDED',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface ApplicationDocument {
    type: string;
    name: string;
    status: 'provided' | 'missing';
}

export interface ApplicationHistoryEntry {
    at: string;
    from: ApplicationStatus | null;
    to: ApplicationStatus;
    by: string;
    note: string;
}

/**
 * A licensing file (başvuru): new licence, area correction, transfer, boundary determination
 * in a shared parcel, or re-linking an old parcel reference. The seeded status and history come
 * from the engine; decisions taken on the site are appended in licensing_decisions (keyed by
 * codes) and the latest one gives the effective status.
 */
@Entity('licensing_applications')
@Index(['areaId', 'code'], { unique: true })
@Index(['areaId', 'producerCode'])
export class LicensingApplication {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'area_id' })
    areaId: string;

    @ManyToOne(() => TeaInventoryArea, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'area_id' })
    area: TeaInventoryArea;

    @Column({ type: 'varchar', length: 40 })
    code: string;

    @Column({ type: 'varchar', length: 40, name: 'producer_code' })
    producerCode: string;

    @Column({ type: 'varchar', length: 40, name: 'license_code', nullable: true })
    licenseCode: string | null;

    @Column({ type: 'varchar', length: 40, name: 'garden_code', nullable: true })
    gardenCode: string | null;

    @Column({ type: 'varchar', length: 30 })
    type: ApplicationType;

    @Column({ type: 'varchar', length: 30 })
    status: ApplicationStatus;

    @Column({ type: 'date', name: 'submitted_at' })
    submittedAt: string;

    @Column({ type: 'text' })
    summary: string;

    @Column({ type: 'jsonb', default: () => "'[]'" })
    documents: ApplicationDocument[];

    @Column({ type: 'jsonb', default: () => "'[]'" })
    history: ApplicationHistoryEntry[];
}
