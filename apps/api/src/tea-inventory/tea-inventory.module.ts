import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryParcel } from '@/tea-inventory/entities/tea-inventory-parcel.entity';
import { TeaInventoryController } from '@/tea-inventory/tea-inventory.controller';
import { TeaInventoryService } from '@/tea-inventory/tea-inventory.service';
import { TeaInventorySeedService } from '@/tea-inventory/tea-inventory-seed.service';

@Module({
    imports: [TypeOrmModule.forFeature([TeaInventoryArea, TeaInventoryParcel])],
    controllers: [TeaInventoryController],
    providers: [TeaInventoryService, TeaInventorySeedService],
})
export class TeaInventoryModule { }
