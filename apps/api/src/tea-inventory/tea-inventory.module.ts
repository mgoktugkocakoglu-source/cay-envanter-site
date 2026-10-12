import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/users/entities/user.entity';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryParcel } from '@/tea-inventory/entities/tea-inventory-parcel.entity';
import { TeaInventoryProducer } from '@/tea-inventory/entities/tea-inventory-producer.entity';
import { TeaInventoryGarden } from '@/tea-inventory/entities/tea-inventory-garden.entity';
import { PruningDecision } from '@/tea-inventory/entities/pruning-decision.entity';
import { ProducerPruningService } from '@/tea-inventory/producer-pruning.service';
import { ProducerPruningController } from '@/tea-inventory/producer-pruning.controller';
import { TeaInventoryController } from '@/tea-inventory/tea-inventory.controller';
import { TeaInventoryService } from '@/tea-inventory/tea-inventory.service';
import { TeaInventorySeedService } from '@/tea-inventory/tea-inventory-seed.service';

@Module({
    imports: [TypeOrmModule.forFeature([User, TeaInventoryArea, TeaInventoryParcel, TeaInventoryProducer, TeaInventoryGarden, PruningDecision])],
    controllers: [TeaInventoryController, ProducerPruningController],
    providers: [TeaInventoryService, TeaInventorySeedService, ProducerPruningService],
})
export class TeaInventoryModule { }
