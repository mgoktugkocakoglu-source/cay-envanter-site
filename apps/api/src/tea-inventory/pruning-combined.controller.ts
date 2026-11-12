import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import { CombinedGardenRow, CombinedProducerRow, CombinedSummary, PruningCombinedService } from '@/tea-inventory/pruning-combined.service';
import { CombinedGardenQueryDto, CombinedProducerQueryDto, SeasonQueryDto } from '@/tea-inventory/dto';
import { Paginated } from '@/common/dto/paginated.dto';

const READ_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI, CaykurRole.DENETCI];

/** Combined pruning verdict (Birleşik karar): the multi-sensor module and the pixel scan as one verdict per garden; a separate, read-only module. */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...READ_ROLES)
@Controller('caykur/tea-inventory/areas/:id/pruning-combined')
export class PruningCombinedController {
    constructor(private readonly service: PruningCombinedService) { }

    @Get('summary')
    @ApiOperation({ summary: 'Season summary: class and agreement counts, areas, producer roll-up, measured accuracy, rules' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Combined verdict summary' })
    async summary(@Param('id', ParseUUIDPipe) id: string, @Query() query: SeasonQueryDto): Promise<CombinedSummary> {
        return this.service.summary(id, query.season);
    }

    @Get('gardens')
    @ApiOperation({ summary: 'Gardens with their combined class, agreement, date bracket, area and both modules\' findings (paginated)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Paginated garden rows' })
    async gardens(@Param('id', ParseUUIDPipe) id: string, @Query() query: CombinedGardenQueryDto): Promise<Paginated<CombinedGardenRow>> {
        return this.service.gardens(id, query);
    }

    @Get('producers')
    @ApiOperation({ summary: 'Producers with the combined area against the 1/7 target and the fusion purchase decision for comparison (paginated)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Paginated producer rows' })
    async producers(@Param('id', ParseUUIDPipe) id: string, @Query() query: CombinedProducerQueryDto): Promise<Paginated<CombinedProducerRow>> {
        return this.service.producers(id, query);
    }
}
