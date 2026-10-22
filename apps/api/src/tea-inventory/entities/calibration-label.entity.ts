import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/** What the field team saw on the ground: the truth the satellite verdict is scored against. */
export type CalibrationLabelValue = 'pruned' | 'partial' | 'not_pruned' | 'unsure';
export const CALIBRATION_LABEL_VALUES: CalibrationLabelValue[] = ['pruned', 'partial', 'not_pruned', 'unsure'];

/** How the label was collected. */
export type CalibrationMethod = 'field_visit' | 'photo_desk' | 'producer_statement';
export const CALIBRATION_METHODS: CalibrationMethod[] = ['field_visit', 'photo_desk', 'producer_statement'];

/**
 * One ground-truth label of a garden for a pruning season (calibration campaign). Keyed by
 * area / garden codes, not foreign keys, so labels survive a re-import of the satellite
 * results. One label per garden and season: a later save replaces the earlier one (the
 * earlier values stay in the audit columns).
 */
@Entity('calibration_labels')
@Index(['areaCode', 'season', 'gardenCode'], { unique: true })
@Index(['areaCode', 'season', 'label'])
export class CalibrationLabel {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 120, name: 'area_code' })
    areaCode: string;

    @Column({ type: 'varchar', length: 10 })
    season: string;

    // Engine garden code ("DEMO-B-0001") or a free tea patch id ("free-001").
    @Column({ type: 'varchar', length: 40, name: 'garden_code' })
    gardenCode: string;

    @Column({ type: 'varchar', length: 20 })
    label: CalibrationLabelValue;

    @Column({ type: 'varchar', length: 30, default: 'field_visit' })
    method: CalibrationMethod;

    // Day the ground was looked at (ISO date).
    @Column({ type: 'date', name: 'observed_at' })
    observedAt: string;

    // Where the observer stood when saving (browser geolocation), if granted.
    @Column({ type: 'double precision', nullable: true })
    lat: number | null;

    @Column({ type: 'double precision', nullable: true })
    lng: number | null;

    @Column({ type: 'double precision', name: 'accuracy_m', nullable: true })
    accuracyM: number | null;

    // Share of the garden that was pruned, when the observer could estimate it (0–1).
    @Column({ type: 'double precision', name: 'pruned_share', nullable: true })
    prunedShare: number | null;

    @Column({ type: 'text', nullable: true })
    note: string | null;

    // The geotagged photo, downscaled by the client; kept in the row so it survives without R2.
    @Column({ type: 'bytea', nullable: true, select: false })
    photo: Buffer | null;

    @Column({ type: 'varchar', length: 60, name: 'photo_mime', nullable: true })
    photoMime: string | null;

    @Column({ type: 'int', name: 'photo_bytes', default: 0 })
    photoBytes: number;

    // The satellite verdict at the moment of labelling, so a re-run can be compared with what the field saw then.
    @Column({ type: 'varchar', length: 20, name: 'system_class_at_label', nullable: true })
    systemClassAtLabel: string | null;

    @Column({ type: 'double precision', name: 'system_z_at_label', nullable: true })
    systemZAtLabel: number | null;

    @Column({ type: 'uuid', name: 'created_by_id' })
    createdById: string;

    @Column({ type: 'varchar', length: 150, name: 'created_by_name' })
    createdByName: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
