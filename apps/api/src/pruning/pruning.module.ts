import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PruningController } from '@/pruning/pruning.controller';
import { PruningService } from '@/pruning/pruning.service';
import { PruningRequestsController } from '@/pruning/pruning-requests.controller';
import { PruningRequestsService } from '@/pruning/pruning-requests.service';
import { PruningMeasurement, PruningTask, PruningRequest } from '@/pruning/entities';
import { User } from '@/users/entities/user.entity';
import { FieldsModule } from '@/fields/fields.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([PruningMeasurement, PruningTask, PruningRequest, User]),
        FieldsModule,
    ],
    controllers: [PruningController, PruningRequestsController],
    providers: [PruningService, PruningRequestsService],
    exports: [PruningService, PruningRequestsService],
})
export class PruningModule {}
