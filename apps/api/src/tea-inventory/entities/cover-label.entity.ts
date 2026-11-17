import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import type { Polygon } from 'geojson';
import type { CoverClass } from '@/tea-inventory/entities/land-cover.types';

/**
 * A ground reference area drawn by a person who knows what grows there: the reference the land-cover model is
 * calibrated and scored against. Keyed by the area code, not a foreign key, so labels survive a re-import of the
 * satellite results.
 */
@Entity('cover_labels')
@Index(['areaCode', 'coverClass'])
export class CoverLabel {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 120, name: 'area_code' })
    areaCode: string;

    @Column({ type: 'varchar', length: 20, name: 'cover_class' })
    coverClass: CoverClass;

    // WGS84 polygon as drawn on the map.
    @Column({ type: 'jsonb' })
    geometry: Polygon;

    @Column({ type: 'float', name: 'area_m2' })
    areaM2: number;

    @Column({ type: 'varchar', length: 300, nullable: true })
    note: string | null;

    @Column({ type: 'uuid', name: 'created_by', nullable: true })
    createdBy: string | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
