import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import { CaykurDataService, ProducerDto } from '@/caykur/caykur-data.service';

// Every Çaykur staff role may read the producer registry; admin auto-passes.
const ALL_CAYKUR_ROLES = [
    CaykurRole.KURUM_ADMIN,
    CaykurRole.FABRIKA_SORUMLUSU,
    CaykurRole.ALIM_YERI_PERSONELI,
    CaykurRole.SAHA_PERSONELI,
    CaykurRole.DENETCI,
    CaykurRole.FINANS,
];

/**
 * Çaykur enterprise panel read API. Serves the master datasets the panel used
 * to read from frontend mock modules — now backed by the database.
 */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...ALL_CAYKUR_ROLES)
@Controller('caykur')
export class CaykurDataController {
    constructor(private readonly dataService: CaykurDataService) { }

    @Get('producers')
    @ApiOperation({ summary: 'List all Çaykur producers (müstahsil registry)' })
    @ApiResponse({ status: 200, description: 'Producer list' })
    async getProducers(): Promise<ProducerDto[]> {
        return this.dataService.getProducers();
    }

    @Get('producers/:id')
    @ApiOperation({ summary: 'Get a producer by id (mus-NNN)' })
    @ApiParam({ name: 'id', description: 'Producer code, e.g. mus-001' })
    @ApiResponse({ status: 200, description: 'Producer detail' })
    @ApiResponse({ status: 404, description: 'Producer not found' })
    async getProducer(@Param('id') id: string): Promise<ProducerDto> {
        return this.dataService.getProducer(id);
    }
}
