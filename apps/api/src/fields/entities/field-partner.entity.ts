import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Field } from '@/fields/entities/field.entity';

@Entity('field_partners')
export class FieldPartner {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'field_id' })
    fieldId: string;

    @ManyToOne(() => Field, (field) => field.partners, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'field_id' })
    field: Field;

    @Column({ type: 'varchar', length: 100 })
    partnerName: string;

    @Column({ type: 'varchar', length: 10, nullable: true })
    partnerPhone: string | null;

    @Column({ type: 'varchar', length: 11, nullable: true })
    partnerIdentityNumber: string | null;

    @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
    sharePercentage: number;

    @Column({ type: 'boolean', default: false })
    isPrimaryOwner: boolean;

    @Column({ type: 'varchar', length: 20, default: 'pending' })
    invitationStatus: 'pending' | 'accepted' | 'rejected';

    @CreateDateColumn()
    createdAt: Date;
}
