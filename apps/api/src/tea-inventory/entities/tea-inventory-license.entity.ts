import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';

/** How the parcel reference written on the licence was tied to a current TKGM parcel. */
export type LicenseMatchLevel = 'exact' | 'historical' | 'probable' | 'unmatched';
export type LicenseStatus = 'active' | 'transfer_pending' | 'inactive' | 'split' | 'transferred';

/** An event in the licence's life (split, transfer, area correction…), for the audit trail. */
export interface LicenseEvent {
    at: string;
    type: string;
    note: string;
    by: string;
    applicationCode: string | null;
}

/**
 * A tea licence (çay ruhsatnamesi) of a producer. The licence is the production/quota right;
 * it is NOT the deed: the holder may be a tenant or sharecropper, and one licence may cover
 * gardens in several parcels while one parcel may carry several licences.
 */
@Entity('tea_inventory_licenses')
@Index(['areaId', 'code'], { unique: true })
@Index(['areaId', 'producerCode'])
export class TeaInventoryLicense {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'area_id' })
    areaId: string;

    @ManyToOne(() => TeaInventoryArea, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'area_id' })
    area: TeaInventoryArea;

    // Licence number, e.g. "DEMO-R-9001".
    @Column({ type: 'varchar', length: 40 })
    code: string;

    @Column({ type: 'varchar', length: 40, name: 'producer_code' })
    producerCode: string;

    @Column({ type: 'varchar', length: 40, name: 'wallet_no' })
    walletNo: string;

    @Column({ type: 'varchar', length: 20, default: 'active' })
    status: LicenseStatus;

    @Column({ type: 'int', name: 'issued_year' })
    issuedYear: number;

    // Area written on the licence (m²).
    @Column({ type: 'double precision', name: 'recorded_area_m2' })
    recordedAreaM2: number;

    // Parcel reference(s) as written on the licence (old pafta/parsel, locality description…).
    @Column({ type: 'jsonb', name: 'recorded_parcel_refs', default: () => "'[]'" })
    recordedParcelRefs: string[];

    @Column({ type: 'varchar', length: 20, name: 'match_level', default: 'exact' })
    matchLevel: LicenseMatchLevel;

    @Column({ type: 'jsonb', name: 'matched_parcel_keys', default: () => "'[]'" })
    matchedParcelKeys: string[];

    // Lineage records that resolved an old reference (historical matches).
    @Column({ type: 'jsonb', name: 'lineage_codes', default: () => "'[]'" })
    lineageCodes: string[];

    // Candidate parcels when only locality / area context is available (probable matches).
    @Column({ type: 'jsonb', name: 'candidate_parcel_keys', default: () => "'[]'" })
    candidateParcelKeys: string[];

    @Column({ type: 'boolean', name: 'holder_deceased', default: false })
    holderDeceased: boolean;

    @Column({ type: 'date', name: 'valid_from' })
    validFrom: string;

    @Column({ type: 'date', name: 'valid_to', nullable: true })
    validTo: string | null;

    @Column({ type: 'jsonb', name: 'garden_codes', default: () => "'[]'" })
    gardenCodes: string[];

    // Licence this one was split or transferred from, and the licences carved out of this one.
    @Column({ type: 'varchar', length: 40, name: 'parent_code', nullable: true })
    parentCode: string | null;

    @Column({ type: 'jsonb', name: 'child_codes', default: () => "'[]'" })
    childCodes: string[];

    @Column({ type: 'jsonb', default: () => "'[]'" })
    history: LicenseEvent[];

    // 'site' when created or changed by a site operation (survives re-imports).
    @Column({ type: 'varchar', length: 10, default: 'engine' })
    source: 'engine' | 'site';
}
