import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController, BrokerFirmsController } from '@/payments/payments.controller';
import { PaymentsService } from '@/payments/payments.service';
import { Payment, PaymentHarvest, BrokerFirm } from '@/payments/entities';
import { Harvest } from '@/harvests/entities';
import { Field } from '@/fields/entities';

@Module({
    imports: [TypeOrmModule.forFeature([Payment, PaymentHarvest, BrokerFirm, Harvest, Field])],
    controllers: [PaymentsController, BrokerFirmsController],
    providers: [PaymentsService],
    exports: [PaymentsService],
})
export class PaymentsModule { }
