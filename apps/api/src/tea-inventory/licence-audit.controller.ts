import { Controller, Get, Param, ParseUUIDPipe, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiProduces } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import { LicenceAuditDetail, LicenceAuditRow, LicenceAuditService, LicenceAuditSummary } from '@/tea-inventory/licence-audit.service';
import { LicenceAuditKmlQueryDto, LicenceAuditQueryDto } from '@/tea-inventory/dto';
import { Paginated } from '@/common/dto/paginated.dto';

const READ_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI, CaykurRole.DENETCI];

/** Licence audit (Arazi tespit kararı): TKGM deed title × ÇAYKUR licence register × satellite detection, one decision per parcel; read-only. */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...READ_ROLES)
@Controller('caykur/tea-inventory/areas/:id/licence-audit')
export class LicenceAuditController {
    constructor(private readonly service: LicenceAuditService) { }

    @Get('summary')
    @ApiOperation({ summary: 'Decision counts, title × ground table, detection model report, rules and sources' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Licence audit summary' })
    async summary(@Param('id', ParseUUIDPipe) id: string): Promise<LicenceAuditSummary> {
        return this.service.summary(id);
    }

    @Get('parcels')
    @ApiOperation({ summary: 'Audited parcels with the three sources and the decision (paginated, findings first)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Paginated parcel rows' })
    async parcels(@Param('id', ParseUUIDPipe) id: string, @Query() query: LicenceAuditQueryDto): Promise<Paginated<LicenceAuditRow>> {
        return this.service.parcels(id, query);
    }

    @Get('parcels/:block/:parcel')
    @ApiOperation({ summary: 'One parcel with its geometry and the building footprints around it' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'block', description: 'Cadastral block (ada)' })
    @ApiParam({ name: 'parcel', description: 'Cadastral parcel (parsel)' })
    @ApiResponse({ status: 200, description: 'Parcel detail' })
    async parcel(@Param('id', ParseUUIDPipe) id: string, @Param('block') block: string, @Param('parcel') parcel: string): Promise<LicenceAuditDetail> {
        return this.service.parcel(id, block, parcel);
    }

    @Get('parcels/:block/:parcel/kml')
    @ApiOperation({ summary: 'KML of the parcel for Google Earth (WGS84 outline, nearby buildings, optional shifted copy for visual alignment)' })
    @ApiProduces('application/vnd.google-earth.kml+xml')
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'block', description: 'Cadastral block (ada)' })
    @ApiParam({ name: 'parcel', description: 'Cadastral parcel (parsel)' })
    @ApiResponse({ status: 200, description: 'KML file' })
    async kml(@Param('id', ParseUUIDPipe) id: string, @Param('block') block: string, @Param('parcel') parcel: string, @Query() query: LicenceAuditKmlQueryDto, @Res({ passthrough: true }) res: Response): Promise<string> {
        const file = await this.service.kml(id, block, parcel, query);
        res.set({ 'Content-Type': 'application/vnd.google-earth.kml+xml; charset=utf-8', 'Content-Disposition': `attachment; filename="${file.filename}"` });
        return file.body;
    }
}
