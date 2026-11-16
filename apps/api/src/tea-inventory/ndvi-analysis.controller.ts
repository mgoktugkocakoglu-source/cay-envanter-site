import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import { NdviAnalysisService } from '@/tea-inventory/ndvi-analysis.service';
import { NdviAnalysisQueryDto } from '@/tea-inventory/dto/ndvi-analysis-query.dto';
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI, CaykurRole.DENETCI)
@Controller('caykur/tea-inventory/areas/:id/ndvi-analysis')
export class NdviAnalysisController {
    constructor(private readonly service: NdviAnalysisService) { }
    @Get('map')
    @ApiOperation({ summary: 'Independent local NDVI screening; never changes compliance' })
    map(@Param('id', ParseUUIDPipe) id: string, @Query() query: NdviAnalysisQueryDto) { return this.service.map(id, query.year); }
}
