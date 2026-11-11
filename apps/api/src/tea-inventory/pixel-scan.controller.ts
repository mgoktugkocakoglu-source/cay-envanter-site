import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import { PixelGardenDetail, PixelGardenRow, PixelScanService, PixelScanSummary } from '@/tea-inventory/pixel-scan.service';
import { PixelScanGardenQueryDto, SeasonQueryDto } from '@/tea-inventory/dto';
import { Paginated } from '@/common/dto/paginated.dto';

const READ_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI, CaykurRole.DENETCI];

/** Pixel-scan module (Piksel taraması): lattice-level undated pruning detection per garden; separate from the fusion verdicts. */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...READ_ROLES)
@Controller('caykur/tea-inventory/areas/:id/pixel-scan')
export class PixelScanController {
    constructor(private readonly service: PixelScanService) { }

    @Get('summary')
    @ApiOperation({ summary: 'Season summary: verdict counts, areas, comparison with the multi-sensor verdicts, rules' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Pixel-scan summary' })
    async summary(@Param('id', ParseUUIDPipe) id: string, @Query() query: SeasonQueryDto): Promise<PixelScanSummary> {
        return this.service.summary(id, query.season);
    }

    @Get('gardens')
    @ApiOperation({ summary: 'Gardens with their pixel verdict, date bracket, clusters and area (paginated; filter by verdict)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Paginated garden rows' })
    async gardens(@Param('id', ParseUUIDPipe) id: string, @Query() query: PixelScanGardenQueryDto): Promise<Paginated<PixelGardenRow>> {
        return this.service.gardens(id, query);
    }

    @Get('gardens/:code')
    @ApiOperation({ summary: 'One garden: every lattice pixel with its step, the clusters, the recovery series and the geometry' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'code', description: 'Garden code' })
    @ApiResponse({ status: 200, description: 'Garden pixel detail' })
    async garden(@Param('id', ParseUUIDPipe) id: string, @Param('code') code: string, @Query() query: SeasonQueryDto): Promise<PixelGardenDetail> {
        return this.service.garden(id, code, query.season);
    }
}
