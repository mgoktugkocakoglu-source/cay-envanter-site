import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import { LandEvaluationService, LandEvidence, LandParcelDetail, LandParcelRow, LandSummary } from '@/tea-inventory/land-evaluation.service';
import { LandLayerQueryDto, LandParcelQueryDto } from '@/tea-inventory/dto';
import { ClimateSummary } from '@/tea-inventory/entities/land-evaluation.types';
import { Paginated } from '@/common/dto/paginated.dto';

const READ_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI, CaykurRole.DENETCI];

/** Land evaluation module (Toprak Koruma ve Arazi Değerlendirme): terrain, soil, land use, capability, suitability, climate. */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...READ_ROLES)
@Controller('caykur/tea-inventory/areas/:id/land')
export class LandEvaluationController {
    constructor(private readonly service: LandEvaluationService) { }

    @Get('summary')
    @ApiOperation({ summary: 'Area summary: capability / 5403 / land-use / erosion counts, suitability means, climate anomalies' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Land summary' })
    async summary(@Param('id', ParseUUIDPipe) id: string): Promise<LandSummary> {
        return this.service.summary(id);
    }

    @Get('evidence')
    @ApiOperation({ summary: 'Evidence behind the evaluation: source registry, cited crop requirement rules, MGM station normals, district facts' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Land evidence' })
    async evidence(@Param('id', ParseUUIDPipe) id: string): Promise<LandEvidence> {
        return this.service.evidence(id);
    }

    @Get('climate')
    @ApiOperation({ summary: 'Neighbourhood climate record (MGM-anchored): monthly/yearly/decade series, climatology, indices, phenology seasons, anomalies, crop-calendar windows' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Climate summary' })
    async climate(@Param('id', ParseUUIDPipe) id: string): Promise<ClimateSummary> {
        return this.service.climate(id);
    }

    @Get('parcels')
    @ApiOperation({ summary: 'Evaluated parcels (paginated, filterable by class, use, erosion, mismatch; sortable by crop suitability)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Paginated parcel rows' })
    async parcels(@Param('id', ParseUUIDPipe) id: string, @Query() query: LandParcelQueryDto): Promise<Paginated<LandParcelRow>> {
        return this.service.parcels(id, query);
    }

    @Get('parcels/:parcelId')
    @ApiOperation({ summary: 'One parcel: full evaluation (terrain, soil, land-use history, erosion factors, suitability, recommendations)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'parcelId', description: 'Parcel id' })
    @ApiResponse({ status: 200, description: 'Parcel land detail' })
    async parcel(@Param('id', ParseUUIDPipe) id: string, @Param('parcelId', ParseUUIDPipe) parcelId: string): Promise<LandParcelDetail> {
        return this.service.parcel(id, parcelId);
    }

    @Get('layers')
    @ApiOperation({ summary: 'Map layer: parcels with capability, 5403 class, observed use, erosion, mismatch and suitability' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'GeoJSON FeatureCollection' })
    async layers(@Param('id', ParseUUIDPipe) id: string, @Query() query: LandLayerQueryDto): Promise<unknown> {
        return this.service.layers(id, query);
    }
}
