import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Firm } from '@/firms/entities/firm.entity';

export type PaymentTerm = 'cash' | 'weekly' | 'monthly' | 'custom';

export interface TariffSplitDetail {
    percentage: number;
    paymentTerm: PaymentTerm;
    deferredMonths?: number;
    customPaymentDate?: string;
    // Month (1-12) the payment is made, used when paymentTerm is 'monthly'.
    // Rendered as "{MonthName} Ayı Ödeme" (e.g. "Temmuz Ayı Ödeme").
    paymentMonth?: number;
    pricePerKg: number;
}

@Entity('firm_tariffs')
@Index(['firmId', 'effectiveDate'])
export class FirmTariff {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'firm_id' })
    firmId: string;

    @ManyToOne(() => Firm, (firm) => firm.tariffs, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'firm_id' })
    firm: Firm;

    @Column({ type: 'varchar', length: 20, name: 'payment_term', default: 'cash' })
    paymentTerm: PaymentTerm;

    @Column({ type: 'decimal', precision: 8, scale: 2, name: 'price_per_kg' })
    pricePerKg: number;

    @Column({ type: 'date', name: 'effective_date' })
    effectiveDate: Date;

    @Column({ type: 'date', name: 'end_date', nullable: true })
    endDate: Date | null;

    @Column({ type: 'date', name: 'custom_payment_date', nullable: true })
    customPaymentDate: Date | null;

    // Month (1-12) the payment is made, used when paymentTerm is 'monthly'.
    // Rendered as "{MonthName} Ayı Ödeme" (e.g. "Temmuz Ayı Ödeme").
    @Column({ type: 'int', name: 'payment_month', nullable: true })
    paymentMonth: number | null;

    @Column({ type: 'boolean', name: 'is_split_payment', default: false })
    isSplitPayment: boolean;

    @Column({ type: 'jsonb', name: 'split_details', nullable: true })
    splitDetails: TariffSplitDetail[] | null;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
