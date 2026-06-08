import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from '@/seed/seed.service';
import { User } from '@/users/entities/user.entity';
import { Firm } from '@/firms/entities/firm.entity';
import { FirmTariff } from '@/firms/entities/firm-tariff.entity';
import { Field } from '@/fields/entities/field.entity';
import { Payment, PaymentHarvest } from '@/payments/entities';
import { Harvest } from '@/harvests/entities';

/**
 * Demo seeder. Gated behind SEED_DEMO=true so it never runs in production.
 * Populates a demo producer with Çaykur firms, lands (as if pulled from the
 * Çaykur/TKGM database by cüzdan no) and auto-dropped tea sale deliveries.
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([
            User,
            Firm,
            FirmTariff,
            Field,
            Payment,
            PaymentHarvest,
            Harvest,
        ]),
    ],
    providers: [SeedService],
})
export class SeedModule { }
