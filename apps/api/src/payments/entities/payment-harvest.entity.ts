import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Unique,
} from 'typeorm';
import { Payment } from '@/payments/entities/payment.entity';
import { Harvest } from '@/harvests/entities/harvest.entity';

@Entity('payment_harvests')
@Unique(['paymentId', 'harvestId'])
export class PaymentHarvest {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'payment_id' })
    paymentId: string;

    @ManyToOne(() => Payment, (payment) => payment.harvestAllocations, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'payment_id' })
    payment: Payment;

    @Column({ type: 'uuid', name: 'harvest_id' })
    harvestId: string;

    @ManyToOne(() => Harvest, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'harvest_id' })
    harvest: Harvest;

    @Column({ type: 'decimal', precision: 10, scale: 2, name: 'used_amount_kg' })
    usedAmountKg: number;

    @CreateDateColumn()
    createdAt: Date;
}
