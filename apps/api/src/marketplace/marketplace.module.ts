import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketplaceListing } from '@/marketplace/entities/marketplace-listing.entity';
import { MarketplaceController } from '@/marketplace/marketplace.controller';
import { MarketplaceService } from '@/marketplace/marketplace.service';

@Module({
    imports: [TypeOrmModule.forFeature([MarketplaceListing])],
    controllers: [MarketplaceController],
    providers: [MarketplaceService],
    exports: [MarketplaceService],
})
export class MarketplaceModule { }
