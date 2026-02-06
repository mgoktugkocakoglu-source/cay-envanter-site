import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from '@/reports/reports.controller';
import { ReportsService } from '@/reports/reports.service';
import { Payment, PaymentHarvest } from '@/payments/entities';
import { Harvest } from '@/harvests/entities';
import { Field } from '@/fields/entities';

@Module({
    imports: [TypeOrmModule.forFeature([Payment, PaymentHarvest, Harvest, Field])],
    controllers: [ReportsController],
    providers: [ReportsService],
})
export class ReportsModule { }
