import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import { ComplianceService, ComplianceSummary } from '@/tea-inventory/compliance.service';
import { ComplianceParcel } from '@/tea-inventory/entities/compliance.types';
import { ComplianceQueryDto } from '@/tea-inventory/dto';
import { Paginated } from '@/common/dto/paginated.dto';

const READ_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI, CaykurRole.DENETCI];

/** Rule-based licence compliance report: every parcel against a written rule set; read-only, preliminary. */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...READ_ROLES)
@Controller('caykur/tea-inventory/areas/:id/compliance')
export class ComplianceController {
    constructor(private readonly service: ComplianceService) { }

    @Get('summary')
    @ApiOperation({ summary: 'Rule set, sources and outcome counts per rule' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Compliance summary' })
    async summary(@Param('id', ParseUUIDPipe) id: string): Promise<ComplianceSummary> {
        return this.service.summary(id);
    }

    @Get('parcels')
    @ApiOperation({ summary: 'Parcels with the outcome of every rule (paginated; findings first)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Paginated parcel rows' })
    async parcels(@Param('id', ParseUUIDPipe) id: string, @Query() query: ComplianceQueryDto): Promise<Paginated<ComplianceParcel>> {
        return this.service.parcels(id, query);
    }
}
