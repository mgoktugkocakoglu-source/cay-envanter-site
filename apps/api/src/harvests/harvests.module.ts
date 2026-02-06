import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HarvestsController } from '@/harvests/harvests.controller';
import { HarvestsService } from '@/harvests/harvests.service';
import { Harvest } from '@/harvests/entities';
import { Field } from '@/fields/entities';

@Module({
    imports: [TypeOrmModule.forFeature([Harvest, Field])],
    controllers: [HarvestsController],
    providers: [HarvestsService],
    exports: [HarvestsService],
})
export class HarvestsModule { }
