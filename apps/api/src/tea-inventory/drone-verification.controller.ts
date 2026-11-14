import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import { DroneMapProperties, DroneVerificationDetail, DroneVerificationRow, DroneVerificationService, DroneVerificationSummary } from '@/tea-inventory/drone-verification.service';
import { DroneVerificationQueryDto } from '@/tea-inventory/dto';
import { Paginated } from '@/common/dto/paginated.dto';

const READ_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI, CaykurRole.DENETCI];

/** Drone-supported land verification: record (deed title, licence) against drone imagery per parcel; read-only, preliminary. */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...READ_ROLES)
@Controller('caykur/tea-inventory/areas/:id/drone-verification')
export class DroneVerificationController {
    constructor(private readonly service: DroneVerificationService) { }

    @Get('summary')
    @ApiOperation({ summary: 'Sources, what they can support, classifier test, class counts' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Drone verification summary' })
    async summary(@Param('id', ParseUUIDPipe) id: string): Promise<DroneVerificationSummary> {
        return this.service.summary(id);
    }

    @Get('parcels')
    @ApiOperation({ summary: 'Parcels with record and image class (paginated; mismatches first, not analysed last)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Paginated parcel rows' })
    async parcels(@Param('id', ParseUUIDPipe) id: string, @Query() query: DroneVerificationQueryDto): Promise<Paginated<DroneVerificationRow>> {
        return this.service.parcels(id, query);
    }

    @Get('map')
    @ApiOperation({ summary: 'All parcels as GeoJSON with their image class, for the coloured map' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'GeoJSON FeatureCollection' })
    async map(@Param('id', ParseUUIDPipe) id: string): Promise<FeatureCollection<Polygon | MultiPolygon, DroneMapProperties>> {
        return this.service.map(id);
    }

    @Get('parcels/:block/:parcel')
    @ApiOperation({ summary: 'One parcel: record, satellite reading, drone class, evidence frames, mismatch and suggested action' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'block', description: 'Cadastral block (ada)' })
    @ApiParam({ name: 'parcel', description: 'Cadastral parcel (parsel)' })
    @ApiResponse({ status: 200, description: 'Parcel detail' })
    async parcel(@Param('id', ParseUUIDPipe) id: string, @Param('block') block: string, @Param('parcel') parcel: string): Promise<DroneVerificationDetail> {
        return this.service.parcel(id, block, parcel);
    }
}
