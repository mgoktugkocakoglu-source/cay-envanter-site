import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import {
    TeaInventoryService,
    InventoryAreaSummary,
    InventoryAreaDetail,
    InventoryMap,
    InventoryParcelRow,
    InventoryParcelDetail,
} from '@/tea-inventory/tea-inventory.service';
import { InventoryAreaQueryDto, InventoryParcelQueryDto } from '@/tea-inventory/dto';
import { Paginated } from '@/common/dto/paginated.dto';

// Inspection-facing roles; purchase-point and finance staff do not see license audit flags.
const INVENTORY_ROLES = [
    CaykurRole.KURUM_ADMIN,
    CaykurRole.FABRIKA_SORUMLUSU,
    CaykurRole.SAHA_PERSONELI,
    CaykurRole.DENETCI,
];

/**
 * Çaykur panel read API for the tea inventory: per-neighborhood TKGM parcels
 * with satellite tea detection and the license decision-matrix class.
 */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...INVENTORY_ROLES)
@Controller('caykur/tea-inventory')
export class TeaInventoryController {
    constructor(private readonly inventoryService: TeaInventoryService) { }

    @Get('areas')
    @ApiOperation({ summary: 'List inventoried areas (neighborhood libraries)' })
    @ApiResponse({ status: 200, description: 'Paginated area summaries' })
    async listAreas(@Query() query: InventoryAreaQueryDto): Promise<Paginated<InventoryAreaSummary>> {
        return this.inventoryService.listAreas(query);
    }

    @Get('areas/:id')
    @ApiOperation({ summary: 'Area detail: boundary, model report, class statistics, tea patches' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Area detail' })
    async getArea(@Param('id', ParseUUIDPipe) id: string): Promise<InventoryAreaDetail> {
        return this.inventoryService.getArea(id);
    }

    @Get('areas/:id/map')
    @ApiOperation({ summary: 'All parcels of an area as a GeoJSON map layer' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'GeoJSON FeatureCollection' })
    async getAreaMap(@Param('id', ParseUUIDPipe) id: string): Promise<InventoryMap> {
        return this.inventoryService.getAreaMap(id);
    }

    @Get('areas/:id/parcels')
    @ApiOperation({ summary: 'Parcels of an area (paginated, filterable by class)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Paginated parcel rows' })
    async listParcels(
        @Param('id', ParseUUIDPipe) id: string,
        @Query() query: InventoryParcelQueryDto,
    ): Promise<Paginated<InventoryParcelRow>> {
        return this.inventoryService.listParcels(id, query);
    }

    @Get('parcels/:id')
    @ApiOperation({ summary: 'Parcel detail with geometry and license' })
    @ApiParam({ name: 'id', description: 'Inventory parcel id' })
    @ApiResponse({ status: 200, description: 'Parcel detail' })
    async getParcel(@Param('id', ParseUUIDPipe) id: string): Promise<InventoryParcelDetail> {
        return this.inventoryService.getParcel(id);
    }
}
