import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { MarketplaceListing } from '@/marketplace/entities/marketplace-listing.entity';
import { MarketplaceService } from '@/marketplace/marketplace.service';
import {
    CreateMarketplaceListingDto,
    QueryMarketplaceListingDto,
    UpdateMarketplaceListingDto,
} from '@/marketplace/dto';

@ApiTags('2. El Pazar')
@Controller('marketplace')
export class MarketplaceController {
    constructor(private readonly marketplaceService: MarketplaceService) { }

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Yeni 2. el pazar ilanı yayınla' })
    @ApiResponse({ status: 201, description: 'İlan başarıyla yayınlandı.' })
    create(
        @CurrentUser('id') userId: string,
        @Body() dto: CreateMarketplaceListingDto,
    ): Promise<MarketplaceListing> {
        return this.marketplaceService.create(userId, dto);
    }

    @Get()
    @ApiOperation({ summary: '2. el pazar ilanlarını listele' })
    @ApiResponse({ status: 200, description: 'İlan listesi başarıyla getirildi.' })
    findAll(@Query() query: QueryMarketplaceListingDto): Promise<MarketplaceListing[]> {
        return this.marketplaceService.findAll(query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Tekil 2. el pazar ilanı getir' })
    @ApiResponse({ status: 200, description: 'İlan başarıyla getirildi.' })
    findOne(@Param('id') id: string): Promise<MarketplaceListing> {
        return this.marketplaceService.findOne(id);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '2. el pazar ilanını güncelle' })
    update(
        @CurrentUser('id') userId: string,
        @Param('id') id: string,
        @Body() dto: UpdateMarketplaceListingDto,
    ): Promise<MarketplaceListing> {
        return this.marketplaceService.update(userId, id, dto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '2. el pazar ilanını sil' })
    remove(@CurrentUser('id') userId: string, @Param('id') id: string): Promise<void> {
        return this.marketplaceService.remove(userId, id);
    }
}
