import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** Which field of the Ministry's line matched a producer in the register. */
export type MinistryMatchBy = 'wallet_no' | 'license_no' | 'producer_code' | 'name' | 'none';

/** One line of the Ministry's list and the system's answer for it (snapshot at answer time). */
export interface MinistryRequestItem {
    // As received from the Ministry (any of them may be blank).
    walletNo: string;
    licenseNo: string;
    producerCode: string;
    name: string;
    // Match against the season register.
    matchBy: MinistryMatchBy;
    matchedCode: string | null;
    matchedName: string | null;
    // The answer: fusion decision of the matched producer at answer time.
    decision: string | null;
    decisionLabel: string;
    status: string | null;
    licensedAreaM2: number | null;
    requiredM2: number | null;
    countedM2: number | null;
    reusedM2: number | null;
    shortfallM2: number | null;
    anomalies: string[];
    firstDetectedAt: string | null;
    gardens: number | null;
    reason: string;
}

/**
 * A request from the Ministry (or an inspector) to state, for a list of producers, whether
 * the compulsory pruning was done. Keyed by area code so it survives a re-import; the items
 * carry the matching and the answer as a snapshot, which is what gets exported.
 */
@Entity('ministry_requests')
@Index(['areaCode', 'season', 'createdAt'])
export class MinistryRequest {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 120, name: 'area_code' })
    areaCode: string;

    @Column({ type: 'varchar', length: 10 })
    season: string;

    @Column({ type: 'varchar', length: 200 })
    title: string;

    // Who asked: "Tarım ve Orman Bakanlığı İl Müdürlüğü", "ÇAYKUR Teftiş" …
    @Column({ type: 'varchar', length: 200, default: '' })
    source: string;

    // The Ministry's reference (letter number) if any.
    @Column({ type: 'varchar', length: 120, default: '' })
    reference: string;

    @Column({ type: 'date', name: 'requested_at' })
    requestedAt: string;

    @Column({ type: 'text', nullable: true })
    note: string | null;

    @Column({ type: 'jsonb', default: () => "'[]'" })
    items: MinistryRequestItem[];

    @Column({ type: 'int', name: 'matched_count', default: 0 })
    matchedCount: number;

    @Column({ type: 'int', name: 'unmatched_count', default: 0 })
    unmatchedCount: number;

    @Column({ type: 'uuid', name: 'created_by_id' })
    createdById: string;

    @Column({ type: 'varchar', length: 150, name: 'created_by_name' })
    createdByName: string;

    @Column({ type: 'timestamp', name: 'answered_at' })
    answeredAt: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
