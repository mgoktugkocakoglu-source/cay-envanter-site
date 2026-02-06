import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FieldsController } from '@/fields/fields.controller';
import { FieldsService } from '@/fields/fields.service';
import { Field, FieldPartner } from '@/fields/entities';

@Module({
    imports: [TypeOrmModule.forFeature([Field, FieldPartner])],
    controllers: [FieldsController],
    providers: [FieldsService],
    exports: [FieldsService],
})
export class FieldsModule { }
