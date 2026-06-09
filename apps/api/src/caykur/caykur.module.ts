import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/users/entities/user.entity';
import { UsersModule } from '@/users/users.module';
import { MailModule } from '@/mail/mail.module';
import { CaykurStaffController } from '@/caykur/caykur-staff.controller';
import { CaykurStaffService } from '@/caykur/caykur-staff.service';
import { CaykurProducer } from '@/caykur/entities/caykur-producer.entity';
import { CaykurDataController } from '@/caykur/caykur-data.controller';
import { CaykurDataService } from '@/caykur/caykur-data.service';
import { CaykurSeedService } from '@/caykur/caykur-seed.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, CaykurProducer]),
        UsersModule,
        MailModule,
    ],
    controllers: [CaykurStaffController, CaykurDataController],
    providers: [CaykurStaffService, CaykurDataService, CaykurSeedService],
})
export class CaykurModule { }
