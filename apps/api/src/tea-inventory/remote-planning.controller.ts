import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import { RemotePlanningService } from '@/tea-inventory/remote-planning.service';
import { NdviAnalysisQueryDto } from '@/tea-inventory/dto/ndvi-analysis-query.dto';
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI, CaykurRole.DENETCI)
@Controller('caykur/tea-inventory/remote-planning')
export class RemotePlanningController {
    constructor(private readonly service: RemotePlanningService) {}
    @Get('regions')
    @ApiOperation({ summary: 'Local tea density mapping priorities, not executable flight routes' })
    regions() { return this.service.regions(); }
    @Get('areas/:id/timeline')
    @ApiOperation({ summary: 'Read-only seasonal observations and change screening' })
    timeline(@Param('id', ParseUUIDPipe) id: string, @Query() query: NdviAnalysisQueryDto) { return this.service.timeline(id, query.year); }
}
