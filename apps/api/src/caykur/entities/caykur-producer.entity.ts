import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

/**
 * Çaykur müstahsil (producer) registry — the master dataset the enterprise
 * panel reads. Mirrors the frontend `Producer` shape so the panel contract is
 * unchanged; the deterministic demo population is written by CaykurSeedService.
 *
 * The primary key is the stable `mus-NNN` code (not a uuid) so the panel's
 * /caykur/producers/:id routes keep working byte-for-byte.
 */
@Entity('caykur_producers')
export class CaykurProducer {
    @PrimaryColumn({ type: 'varchar', length: 16 })
    id: string; // e.g. 'mus-001'

    @Column({ type: 'varchar', length: 150 })
    fullName: string;

    @Column({ type: 'varchar', length: 40 })
    ruhsatNo: string;

    @Index()
    @Column({ type: 'varchar', length: 20 })
    cuzdanNo: string;

    @Column({ type: 'varchar', length: 20 })
    region: string;

    @Column({ type: 'varchar', length: 60 })
    district: string;

    @Column({ type: 'varchar', length: 60 })
    factory: string;

    @Column({ type: 'double precision' })
    licensedDekar: number;

    @Column({ type: 'boolean' })
    organic: boolean;

    @Column({ type: 'int' })
    seasonKg: number;

    @Column({ type: 'int' })
    surgunS1: number;

    @Column({ type: 'int' })
    surgunS2: number;

    @Column({ type: 'int' })
    surgunS3: number;

    @Column({ type: 'int' })
    quotaKg: number;

    @Column({ type: 'int' })
    gardenM2: number;

    @Column({ type: 'int' })
    prunedThisYearM2: number;

    // 10-year pruning rotation: did the producer prune that year's slice.
    @Column({ type: 'jsonb' })
    rotationHistory: boolean[];

    @Column({ type: 'double precision' })
    outOfStandardPct: number;
}
