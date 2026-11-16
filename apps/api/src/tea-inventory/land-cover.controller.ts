import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import { LandCoverMap, LandCoverService, LandCoverSummary } from '@/tea-inventory/land-cover.service';
import { CoverParcel } from '@/tea-inventory/entities/land-cover.types';
import { LandCoverQueryDto } from '@/tea-inventory/dto';
import { Paginated } from '@/common/dto/paginated.dto';

const READ_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI, CaykurRole.DENETCI];

/** Land cover per parcel (tea or not, and what else grows there) with the model's measured numbers; read-only, preliminary. */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...READ_ROLES)
@Controller('caykur/tea-inventory/areas/:id/land-cover')
export class LandCoverController {
    constructor(private readonly service: LandCoverService) { }

    @Get('summary')
    @ApiOperation({ summary: 'Model card (data-source comparison, cross-validation) and class counts' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Land-cover summary' })
    async summary(@Param('id', ParseUUIDPipe) id: string): Promise<LandCoverSummary> {
        return this.service.summary(id);
    }

    @Get('parcels')
    @ApiOperation({ summary: 'Parcels with tea reading and cover shares (paginated; tea first)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Paginated parcel rows' })
    async parcels(@Param('id', ParseUUIDPipe) id: string, @Query() query: LandCoverQueryDto): Promise<Paginated<CoverParcel>> {
        return this.service.parcels(id, query);
    }

    @Get('map')
    @ApiOperation({ summary: 'Parcels as GeoJSON with tea reading and dominant cover' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'GeoJSON FeatureCollection' })
    async map(@Param('id', ParseUUIDPipe) id: string): Promise<LandCoverMap> {
        return this.service.map(id);
    }
}
