import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController, BrokerFirmsController } from '@/payments/payments.controller';
import { PaymentsService } from '@/payments/payments.service';
import { Payment, PaymentHarvest, BrokerFirm } from '@/payments/entities';
import { Harvest } from '@/harvests/entities';
import { Field, FieldPartner } from '@/fields/entities';
import { Firm } from '@/firms/entities/firm.entity';
import { UsersModule } from '@/users/users.module';

@Module({
    imports: [TypeOrmModule.forFeature([Payment, PaymentHarvest, BrokerFirm, Harvest, Field, FieldPartner, Firm]), UsersModule],
    controllers: [PaymentsController, BrokerFirmsController],
    providers: [PaymentsService],
    exports: [PaymentsService],
})
export class PaymentsModule { }
