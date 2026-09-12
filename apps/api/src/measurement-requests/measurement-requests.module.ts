import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeasurementRequestsController } from '@/measurement-requests/measurement-requests.controller';
import { MeasurementRequestsService } from '@/measurement-requests/measurement-requests.service';
import { LandMeasurementRequest } from '@/measurement-requests/entities';
import { User } from '@/users/entities/user.entity';
import { FieldsModule } from '@/fields/fields.module';

@Module({
    imports: [TypeOrmModule.forFeature([LandMeasurementRequest, User]), FieldsModule],
    controllers: [MeasurementRequestsController],
    providers: [MeasurementRequestsService],
    exports: [MeasurementRequestsService],
})
export class MeasurementRequestsModule {}
