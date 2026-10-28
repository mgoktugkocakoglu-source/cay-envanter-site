import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import { GardenAgeParcelDetail, GardenAgeParcelRow, GardenAgeService } from '@/tea-inventory/garden-age.service';
import { GardenAgeLayerQueryDto, GardenAgeParcelQueryDto } from '@/tea-inventory/dto';
import { AgeBlock } from '@/tea-inventory/entities/garden-age.types';
import { Paginated } from '@/common/dto/paginated.dto';

const READ_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI, CaykurRole.DENETCI];

/** Garden age module (Bahçe yaşı ve yenileme): establishment year, renewals, vigour, activity, abandonment, priority. */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...READ_ROLES)
@Controller('caykur/tea-inventory/areas/:id/age')
export class GardenAgeController {
    constructor(private readonly service: GardenAgeService) { }

    @Get('summary')
    @ApiOperation({ summary: 'Area summary: age classes, establishment decades, renewals, activity, abandonment and priority counts' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Garden-age summary' })
    async summary(@Param('id', ParseUUIDPipe) id: string): Promise<AgeBlock> {
        return this.service.summary(id);
    }

    @Get('parcels')
    @ApiOperation({ summary: 'Evaluated tea parcels (paginated; filter by age class, activity, abandonment, priority; sort)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Paginated parcel rows' })
    async parcels(@Param('id', ParseUUIDPipe) id: string, @Query() query: GardenAgeParcelQueryDto): Promise<Paginated<GardenAgeParcelRow>> {
        return this.service.parcels(id, query);
    }

    @Get('parcels/:parcelId')
    @ApiOperation({ summary: 'One parcel: Landsat yearly series, Sentinel-2 monthly series, establishment, renewals, scores' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'parcelId', description: 'Parcel id' })
    @ApiResponse({ status: 200, description: 'Parcel garden-age detail' })
    async parcel(@Param('id', ParseUUIDPipe) id: string, @Param('parcelId', ParseUUIDPipe) parcelId: string): Promise<GardenAgeParcelDetail> {
        return this.service.parcel(id, parcelId);
    }

    @Get('layers')
    @ApiOperation({ summary: 'Map layer: parcels with age class, activity, abandonment and priority' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'GeoJSON FeatureCollection' })
    async layers(@Param('id', ParseUUIDPipe) id: string, @Query() query: GardenAgeLayerQueryDto): Promise<unknown> {
        return this.service.layers(id, query);
    }
}
