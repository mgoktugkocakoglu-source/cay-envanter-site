import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles, CurrentUser } from '@/auth/decorators';
import type { AuthenticatedUser } from '@/auth/decorators/current-user.decorator';
import { CaykurRole } from '@/auth/enums';
import { FertilisationView, GardenHealthService, HealthGardenDetail, HealthGardenRow, HealthProducerView, HealthSummary } from '@/tea-inventory/garden-health.service';
import { CreateFertilisationDto, HealthGardenQueryDto, HealthProducerQueryDto, HealthSeasonQueryDto } from '@/tea-inventory/dto';
import { Paginated } from '@/common/dto/paginated.dto';

const READ_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI, CaykurRole.DENETCI];
const WRITE_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI];

/** Garden-health module: growing-season anomalies, vigour, yield vs quota, fertilisation feedback. */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...READ_ROLES)
@Controller('caykur/tea-inventory/areas/:id/health')
export class GardenHealthController {
    constructor(private readonly service: GardenHealthService) { }

    @Get('summary')
    @ApiOperation({ summary: 'Season totals: gardens by anomaly class, mean vigour, yield vs quota, localities, fertilisation responses' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Health summary' })
    async summary(@Param('id', ParseUUIDPipe) id: string, @Query() query: HealthSeasonQueryDto): Promise<HealthSummary> {
        return this.service.summary(id, query.season);
    }

    @Get('gardens')
    @ApiOperation({ summary: 'Gardens with vigour, anomaly verdict and yield estimate (paginated)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Paginated garden rows' })
    async gardens(@Param('id', ParseUUIDPipe) id: string, @Query() query: HealthGardenQueryDto): Promise<Paginated<HealthGardenRow>> {
        return this.service.gardens(id, query);
    }

    @Get('gardens/:code')
    @ApiOperation({ summary: 'One garden: series, neighbourhood medians, anomaly evidence, fertilisation records with response' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'code', description: 'Garden code' })
    @ApiResponse({ status: 200, description: 'Garden health detail' })
    async garden(@Param('id', ParseUUIDPipe) id: string, @Param('code') code: string, @Query() query: HealthSeasonQueryDto): Promise<HealthGardenDetail> {
        return this.service.garden(id, code, query.season);
    }

    @Get('producers')
    @ApiOperation({ summary: 'Producers: yield estimate against the licence quota (paginated)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Paginated producer rows' })
    async producers(@Param('id', ParseUUIDPipe) id: string, @Query() query: HealthProducerQueryDto): Promise<Paginated<HealthProducerView>> {
        return this.service.producers(id, query);
    }

    @Get('producers.csv')
    @Header('Content-Type', 'text/csv; charset=utf-8')
    @Header('Content-Disposition', 'attachment; filename="rekolte-tahmini.csv"')
    @ApiOperation({ summary: 'Producer yield estimates as CSV' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'CSV file' })
    async producersCsv(@Param('id', ParseUUIDPipe) id: string, @Query() query: HealthSeasonQueryDto): Promise<string> {
        return this.service.producersCsv(id, query.season);
    }

    @Get('layers')
    @ApiOperation({ summary: 'Map layer: gardens coloured by anomaly class with vigour and yield' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'GeoJSON FeatureCollection' })
    async layers(@Param('id', ParseUUIDPipe) id: string, @Query() query: HealthSeasonQueryDto): Promise<unknown> {
        return this.service.layers(id, query.season);
    }

    @Get('fertilisation')
    @ApiOperation({ summary: 'Fertilisation records with their satellite response' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Records' })
    async fertilisation(@Param('id', ParseUUIDPipe) id: string, @Query('gardenCode') gardenCode?: string, @Query('season') season?: string): Promise<FertilisationView[]> {
        return this.service.fertilisations(id, gardenCode || undefined, season || undefined);
    }

    @Post('fertilisation')
    @CaykurRoles(...WRITE_ROLES)
    @ApiOperation({ summary: 'Record a fertilisation / input application on a garden' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 201, description: 'Record with response' })
    async addFertilisation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateFertilisationDto, @CurrentUser() user: AuthenticatedUser): Promise<FertilisationView> {
        return this.service.addFertilisation(id, dto, user.id);
    }

    @Delete('fertilisation/:recordId')
    @HttpCode(204)
    @CaykurRoles(...WRITE_ROLES)
    @ApiOperation({ summary: 'Delete a fertilisation record' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'recordId', description: 'Record id' })
    @ApiResponse({ status: 204, description: 'Deleted' })
    async removeFertilisation(@Param('id', ParseUUIDPipe) id: string, @Param('recordId', ParseUUIDPipe) recordId: string): Promise<void> {
        await this.service.removeFertilisation(id, recordId);
    }
}
