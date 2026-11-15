import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import { ExecutiveSummary, ExecutiveSummaryService } from '@/tea-inventory/executive-summary.service';

const READ_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI, CaykurRole.DENETCI];

/** Executive summary: what has been checked in every neighbourhood, by which evidence, and what is open. Read-only. */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...READ_ROLES)
@Controller('caykur/tea-inventory/executive-summary')
export class ExecutiveSummaryController {
    constructor(private readonly service: ExecutiveSummaryService) { }

    @Get()
    @ApiOperation({ summary: 'Audit, compliance and verification headline numbers over every imported neighbourhood' })
    @ApiResponse({ status: 200, description: 'Executive summary' })
    async summary(): Promise<ExecutiveSummary> {
        return this.service.summary();
    }
}
