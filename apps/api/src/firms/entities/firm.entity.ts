import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
} from 'typeorm';
import { FirmTariff } from '@/firms/entities/firm-tariff.entity';
import { FirmCollectionPoint } from '@/firms/entities/firm-collection-point.entity';

@Entity('firms')
export class Firm {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 150, unique: true })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    logoUrl: string | null;

    @Column({ type: 'varchar', length: 20, nullable: true })
    phone: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    email: string | null;

    @Column({ type: 'varchar', length: 500, nullable: true })
    address: string | null;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    // Çaykur is a state buyer with a fixed price + per-dekar quota (kontenjan)
    // instead of negotiable tariffs. This flag drives the Çaykur-specific UI
    // (quota panel instead of tariff cards, no "Brüt" suffix, etc.).
    @Column({ type: 'boolean', default: false })
    isCaykur: boolean;

    @OneToMany(() => FirmTariff, (tariff) => tariff.firm, { cascade: true })
    tariffs: FirmTariff[];

    @OneToMany(() => FirmCollectionPoint, (point) => point.firm, { cascade: true })
    collectionPoints: FirmCollectionPoint[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
