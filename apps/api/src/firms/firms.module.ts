import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FirmsController } from '@/firms/firms.controller';
import { FirmsService } from '@/firms/firms.service';
import { Firm, FirmTariff, FirmCollectionPoint } from '@/firms/entities';

@Module({
    imports: [TypeOrmModule.forFeature([Firm, FirmTariff, FirmCollectionPoint])],
    controllers: [FirmsController],
    providers: [FirmsService],
    exports: [FirmsService],
})
export class FirmsModule { }
