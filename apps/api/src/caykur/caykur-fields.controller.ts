import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import {
    CaykurFieldsService,
    CaykurFieldRow,
    CaykurFieldsOverview,
} from '@/caykur/caykur-fields.service';
import { CaykurFieldQueryDto } from '@/caykur/dto';
import { Paginated } from '@/common/dto/paginated.dto';

// Every Çaykur staff role may browse the field registry; admin auto-passes.
const ALL_CAYKUR_ROLES = [
    CaykurRole.KURUM_ADMIN,
    CaykurRole.FABRIKA_SORUMLUSU,
    CaykurRole.ALIM_YERI_PERSONELI,
    CaykurRole.SAHA_PERSONELI,
    CaykurRole.DENETCI,
    CaykurRole.FINANS,
];

/**
 * Çaykur panel read API for the institution-wide field (parcel) registry —
 * every producer's fields, with owners/partners and shared-title detection.
 */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...ALL_CAYKUR_ROLES)
@Controller('caykur/fields')
export class CaykurFieldsController {
    constructor(private readonly fieldsService: CaykurFieldsService) { }

    @Get()
    @ApiOperation({ summary: "List all producers' fields (paginated, filterable)" })
    @ApiResponse({ status: 200, description: 'Paginated field rows' })
    async list(@Query() query: CaykurFieldQueryDto): Promise<Paginated<CaykurFieldRow>> {
        return this.fieldsService.list(query);
    }

    @Get('overview')
    @ApiOperation({ summary: 'Registry totals and province/district facets' })
    @ApiResponse({ status: 200, description: 'Overview counters and facets' })
    async overview(): Promise<CaykurFieldsOverview> {
        return this.fieldsService.overview();
    }
}
