import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
    EquipmentFavorite,
    EquipmentItem,
    EquipmentReview,
    EquipmentReviewLike,
} from '@/equipment/entities';
import { EquipmentController } from '@/equipment/equipment.controller';
import { EquipmentService } from '@/equipment/equipment.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            EquipmentItem,
            EquipmentReview,
            EquipmentFavorite,
            EquipmentReviewLike,
        ]),
    ],
    controllers: [EquipmentController],
    providers: [EquipmentService],
    exports: [EquipmentService],
})
export class EquipmentModule { }
