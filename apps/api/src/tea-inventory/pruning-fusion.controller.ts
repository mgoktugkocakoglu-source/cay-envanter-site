import { Controller, Get, Header, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import { FusionGardenDetail, FusionGardenRow, FusionProducerRow, FusionSummary, PruningFusionService } from '@/tea-inventory/pruning-fusion.service';
import { FusionGardenQueryDto, FusionProducerQueryDto, SeasonQueryDto } from '@/tea-inventory/dto';
import { Paginated } from '@/common/dto/paginated.dto';

const READ_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI, CaykurRole.DENETCI];

/** Multi-sensor step-change pruning verdicts (fusion module): gardens, producers ("who pruned"), evidence. */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...READ_ROLES)
@Controller('caykur/tea-inventory')
export class PruningFusionController {
    constructor(private readonly service: PruningFusionService) { }

    @Get('areas/:id/pruning-fusion/summary')
    @ApiOperation({ summary: 'Fusion verdict counts, pruning curve over the emulated scans, sensors and cadence' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Fusion summary' })
    async summary(@Param('id', ParseUUIDPipe) id: string, @Query() query: SeasonQueryDto): Promise<FusionSummary> {
        return this.service.summary(id, query.season);
    }

    @Get('areas/:id/pruning-fusion/gardens')
    @ApiOperation({ summary: 'Gardens with their multi-sensor verdict (paginated)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Paginated garden verdicts' })
    async gardens(@Param('id', ParseUUIDPipe) id: string, @Query() query: FusionGardenQueryDto): Promise<Paginated<FusionGardenRow>> {
        return this.service.gardens(id, query);
    }

    @Get('areas/:id/pruning-fusion/producers')
    @ApiOperation({ summary: 'Producers with pruned garden area against their 1/7 target (paginated)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Paginated producer verdicts' })
    async producers(@Param('id', ParseUUIDPipe) id: string, @Query() query: FusionProducerQueryDto): Promise<Paginated<FusionProducerRow>> {
        return this.service.producers(id, query);
    }

    @Get('areas/:id/pruning-fusion/producers.csv')
    @Header('Content-Type', 'text/csv; charset=utf-8')
    @Header('Content-Disposition', 'attachment; filename="budama-yapan-mustahsiller.csv"')
    @ApiOperation({ summary: 'Producer verdicts as CSV (Excel-compatible)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'CSV file' })
    async producersCsv(@Param('id', ParseUUIDPipe) id: string, @Query() query: SeasonQueryDto): Promise<string> {
        return this.service.producersCsv(id, query.season);
    }

    @Get('pruning-fusion/gardens/:id')
    @ApiOperation({ summary: 'Garden verdict with the emulated scan timeline and every channel series' })
    @ApiParam({ name: 'id', description: 'Garden id' })
    @ApiResponse({ status: 200, description: 'Garden fusion detail' })
    async garden(@Param('id', ParseUUIDPipe) id: string): Promise<FusionGardenDetail> {
        return this.service.garden(id);
    }
}
