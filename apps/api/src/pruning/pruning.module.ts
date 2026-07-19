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
    // PruningRequestsController must register first: PruningController's
    // GET :id would otherwise capture /pruning/requests as a UUID param.
    controllers: [PruningRequestsController, PruningController],
    providers: [PruningService, PruningRequestsService],
    exports: [PruningService, PruningRequestsService],
})
export class PruningModule {}
