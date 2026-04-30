import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
    Index,
} from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { FieldPartner } from '@/fields/entities/field-partner.entity';

export type AreaUnit = 'donum' | 'dekar' | 'm2';

@Entity('fields')
@Index(['userId', 'deleted'])
export class Field {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'user_id' })
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ type: 'varchar', length: 50 })
    name: string;

    @Column({ type: 'varchar', length: 50 })
    province: string;

    @Column({ type: 'varchar', length: 50 })
    district: string;

    @Column({ type: 'varchar', length: 100 })
    neighborhood: string;

    @Column({ type: 'varchar', length: 150, nullable: true })
    road: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    parcelNo: string | null;

    // Store coordinates as JSON array (GeoJSON polygon format)
    // For PostGIS, you would use: @Column('geometry', { spatialFeatureType: 'Polygon', srid: 4326 })
    @Column({ type: 'jsonb' })
    coordinates: number[][][];

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    area: number;

    @Column({ type: 'varchar', length: 10 })
    areaUnit: AreaUnit;

    @Column({ type: 'int', default: 1 })
    partnerCount: number;

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @Column({ type: 'boolean', default: false })
    deleted: boolean;

    @Column({ type: 'timestamp', nullable: true })
    deletedAt: Date | null;

    @OneToMany(() => FieldPartner, (partner) => partner.field, { cascade: true })
    partners: FieldPartner[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
