import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PruningController } from '@/pruning/pruning.controller';
import { PruningService } from '@/pruning/pruning.service';
import { PruningMeasurement, PruningTask } from '@/pruning/entities';
import { FieldsModule } from '@/fields/fields.module';

@Module({
    imports: [TypeOrmModule.forFeature([PruningMeasurement, PruningTask]), FieldsModule],
    controllers: [PruningController],
    providers: [PruningService],
    exports: [PruningService],
})
export class PruningModule {}
