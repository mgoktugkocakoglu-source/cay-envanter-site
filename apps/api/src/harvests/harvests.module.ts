import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HarvestsController } from '@/harvests/harvests.controller';
import { HarvestsService } from '@/harvests/harvests.service';
import { Harvest } from '@/harvests/entities';
import { Field, FieldPartner } from '@/fields/entities';
import { UsersModule } from '@/users/users.module';

@Module({
    imports: [TypeOrmModule.forFeature([Harvest, Field, FieldPartner]), UsersModule],
    controllers: [HarvestsController],
    providers: [HarvestsService],
    exports: [HarvestsService],
})
export class HarvestsModule { }
