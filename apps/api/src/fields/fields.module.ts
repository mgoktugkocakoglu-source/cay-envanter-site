import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FieldsController } from '@/fields/fields.controller';
import { FieldsService } from '@/fields/fields.service';
import { ParcelOwnersService } from '@/fields/parcel-owners.service';
import { FieldBoundaryService } from '@/fields/field-boundary.service';
import { Field, FieldPartner } from '@/fields/entities';
import { LicensingMeasurement } from '@/licensing/entities/licensing-measurement.entity';
import { LandMeasurementRequest } from '@/measurement-requests/entities/land-measurement-request.entity';
import { UsersModule } from '@/users/users.module';

@Module({
    // Entity classes only (no module imports) — LicensingModule and
    // MeasurementRequestsModule depend on this module, not the other way round.
    imports: [
        TypeOrmModule.forFeature([Field, FieldPartner, LicensingMeasurement, LandMeasurementRequest]),
        UsersModule,
    ],
    controllers: [FieldsController],
    providers: [FieldsService, ParcelOwnersService, FieldBoundaryService],
    exports: [FieldsService, ParcelOwnersService, FieldBoundaryService],
})
export class FieldsModule { }
