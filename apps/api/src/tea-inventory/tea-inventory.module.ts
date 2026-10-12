import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/users/entities/user.entity';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryParcel } from '@/tea-inventory/entities/tea-inventory-parcel.entity';
import { TeaInventoryProducer } from '@/tea-inventory/entities/tea-inventory-producer.entity';
import { TeaInventoryGarden } from '@/tea-inventory/entities/tea-inventory-garden.entity';
import { PruningDecision } from '@/tea-inventory/entities/pruning-decision.entity';
import { TeaInventoryLicense } from '@/tea-inventory/entities/tea-inventory-license.entity';
import { ParcelLineage } from '@/tea-inventory/entities/parcel-lineage.entity';
import { LicensingApplication } from '@/tea-inventory/entities/licensing-application.entity';
import { LicensingDecision } from '@/tea-inventory/entities/licensing-decision.entity';
import { ProducerPruningService } from '@/tea-inventory/producer-pruning.service';
import { ProducerPruningController } from '@/tea-inventory/producer-pruning.controller';
import { LicensingService } from '@/tea-inventory/licensing.service';
import { LicensingController } from '@/tea-inventory/licensing.controller';
import { TeaInventoryController } from '@/tea-inventory/tea-inventory.controller';
import { TeaInventoryService } from '@/tea-inventory/tea-inventory.service';
import { TeaInventorySeedService } from '@/tea-inventory/tea-inventory-seed.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            User,
            TeaInventoryArea,
            TeaInventoryParcel,
            TeaInventoryProducer,
            TeaInventoryGarden,
            PruningDecision,
            TeaInventoryLicense,
            ParcelLineage,
            LicensingApplication,
            LicensingDecision,
        ]),
    ],
    controllers: [TeaInventoryController, ProducerPruningController, LicensingController],
    providers: [TeaInventoryService, TeaInventorySeedService, ProducerPruningService, LicensingService],
})
export class TeaInventoryModule { }
