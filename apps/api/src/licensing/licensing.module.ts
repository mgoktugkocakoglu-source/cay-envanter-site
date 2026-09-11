import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LicensingController } from '@/licensing/licensing.controller';
import { LicensingService } from '@/licensing/licensing.service';
import { LicensingMeasurement, LicensingApproval } from '@/licensing/entities';
import { PruningRequest } from '@/pruning/entities';
import { User } from '@/users/entities/user.entity';
import { FieldsModule } from '@/fields/fields.module';
import { MailModule } from '@/mail/mail.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([LicensingMeasurement, LicensingApproval, PruningRequest, User]),
        FieldsModule,
        MailModule,
    ],
    controllers: [LicensingController],
    providers: [LicensingService],
    exports: [LicensingService],
})
export class LicensingModule {}
