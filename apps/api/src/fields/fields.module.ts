import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FieldsController } from '@/fields/fields.controller';
import { FieldsService } from '@/fields/fields.service';
import { ParcelOwnersService } from '@/fields/parcel-owners.service';
import { Field, FieldPartner } from '@/fields/entities';
import { UsersModule } from '@/users/users.module';

@Module({
    imports: [TypeOrmModule.forFeature([Field, FieldPartner]), UsersModule],
    controllers: [FieldsController],
    providers: [FieldsService, ParcelOwnersService],
    exports: [FieldsService, ParcelOwnersService],
})
export class FieldsModule { }
