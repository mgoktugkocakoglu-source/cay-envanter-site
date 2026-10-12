import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles, CurrentUser } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import type { AuthenticatedUser } from '@/auth/decorators/current-user.decorator';
import { ProducerPruningService, ProducerRow, ProducerDetail, ProducerSummary } from '@/tea-inventory/producer-pruning.service';
import { ProducerQueryDto, PruningDecisionDto, PurchaseListQueryDto } from '@/tea-inventory/dto';
import { Paginated } from '@/common/dto/paginated.dto';

// Same audience as the tea inventory.
const READ_ROLES = [
    CaykurRole.KURUM_ADMIN,
    CaykurRole.FABRIKA_SORUMLUSU,
    CaykurRole.SAHA_PERSONELI,
    CaykurRole.DENETCI,
];
// Deciding opens or closes a producer's purchase: not for the read-only auditor role.
const DECIDE_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI];

/**
 * Producer-level pruning compliance (1/7 over all of a producer's gardens), expert decisions
 * and the purchase list ÇAYKUR buys from.
 */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...READ_ROLES)
@Controller('caykur/tea-inventory')
export class ProducerPruningController {
    constructor(private readonly service: ProducerPruningService) { }

    @Get('areas/:id/producers')
    @ApiOperation({ summary: 'Producers with their season pruning status (paginated)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Paginated producer rows' })
    async list(@Param('id', ParseUUIDPipe) id: string, @Query() query: ProducerQueryDto): Promise<Paginated<ProducerRow>> {
        return this.service.list(id, query);
    }

    @Get('areas/:id/producers/summary')
    @ApiOperation({ summary: 'Producer counts by status, purchase-open count, scan schedule' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Producer summary' })
    async summary(@Param('id', ParseUUIDPipe) id: string): Promise<ProducerSummary> {
        return this.service.summary(id);
    }

    @Get('areas/:id/purchase-list')
    @ApiOperation({ summary: 'Producers ÇAYKUR may buy from this season (auto- or expert-approved)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Paginated purchase list' })
    async purchaseList(@Param('id', ParseUUIDPipe) id: string, @Query() query: PurchaseListQueryDto): Promise<Paginated<ProducerRow>> {
        return this.service.purchaseList(id, query);
    }

    @Get('areas/:id/purchase-list.csv')
    @Header('Content-Type', 'text/csv; charset=utf-8')
    @Header('Content-Disposition', 'attachment; filename="budama-onayli-mustahsiller.csv"')
    @ApiOperation({ summary: 'Purchase list as CSV (Excel-compatible)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'CSV file' })
    async purchaseListCsv(@Param('id', ParseUUIDPipe) id: string): Promise<string> {
        return this.service.purchaseListCsv(id);
    }

    @Get('producers/:id')
    @ApiOperation({ summary: 'Producer detail: gardens, scan history, decisions' })
    @ApiParam({ name: 'id', description: 'Producer id' })
    @ApiResponse({ status: 200, description: 'Producer detail' })
    async detail(@Param('id', ParseUUIDPipe) id: string): Promise<ProducerDetail> {
        return this.service.detail(id);
    }

    @Post('producers/:id/decision')
    @CaykurRoles(...DECIDE_ROLES)
    @ApiOperation({ summary: 'Record an expert pruning decision (approve opens purchase, reject closes it)' })
    @ApiParam({ name: 'id', description: 'Producer id' })
    @ApiResponse({ status: 201, description: 'Updated producer detail' })
    async decide(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: PruningDecisionDto,
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<ProducerDetail> {
        return this.service.decide(id, dto, user.id);
    }
}
