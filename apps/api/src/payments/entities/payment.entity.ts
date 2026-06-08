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
import { BrokerFirm } from '@/payments/entities/broker-firm.entity';
import { PaymentHarvest } from '@/payments/entities/payment-harvest.entity';
import { Firm } from '@/firms/entities/firm.entity';

export type PaymentStatus = 'received' | 'pending';

// Where the payment record came from: 'caykur' = an auto-dropped delivery
// arriving from the Çaykur database (seed data for the demo); 'manual' = a
// record the producer created themselves.
export type PaymentSource = 'caykur' | 'manual';

@Entity('payments')
@Index(['userId', 'paymentDate'])
export class Payment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'user_id' })
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ type: 'decimal', precision: 10, scale: 2, name: 'total_amount_kg' })
    totalAmountKg: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, name: 'total_price' })
    totalPrice: number;

    // Computed column would be ideal, but for compatibility we calculate in code
    // pricePerKg = totalPrice / totalAmountKg

    @Column({ type: 'uuid', name: 'broker_firm_id', nullable: true })
    brokerFirmId: string | null;

    @ManyToOne(() => BrokerFirm, { nullable: true })
    @JoinColumn({ name: 'broker_firm_id' })
    brokerFirm: BrokerFirm | null;

    // Buyer firm for auto-dropped Çaykur deliveries. References the rich Firm
    // entity (which has a logo) so the delivery box can render the firm brand.
    @Column({ type: 'uuid', name: 'firm_id', nullable: true })
    firmId: string | null;

    @ManyToOne(() => Firm, { nullable: true })
    @JoinColumn({ name: 'firm_id' })
    firm: Firm | null;

    // Human-readable tariff/term for the delivery, e.g. "Peşin Ödeme - ₺33,00/kg".
    @Column({ type: 'varchar', length: 120, name: 'tariff_label', nullable: true })
    tariffLabel: string | null;

    @Column({ type: 'varchar', length: 20, default: 'manual' })
    source: PaymentSource;

    @Column({ type: 'date' })
    paymentDate: Date;

    @Column({ type: 'varchar', length: 20, name: 'payment_status' })
    paymentStatus: PaymentStatus;

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @OneToMany(() => PaymentHarvest, (ph) => ph.payment, { cascade: true })
    harvestAllocations: PaymentHarvest[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // Virtual computed property
    get pricePerKg(): number {
        if (!this.totalAmountKg || this.totalAmountKg === 0) return 0;
        return Number(this.totalPrice) / Number(this.totalAmountKg);
    }
}
