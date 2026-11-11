import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import { FieldTestService } from '@/tea-inventory/field-test.service';
import { FieldTestsBlock } from '@/tea-inventory/entities/field-test.types';

const READ_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI, CaykurRole.DENETCI];

/** Field-test module (Saha testi): inspector ground truth with its independent satellite step test. */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...READ_ROLES)
@Controller('caykur/tea-inventory/areas/:id/field-tests')
export class FieldTestController {
    constructor(private readonly service: FieldTestService) { }

    @Get()
    @ApiOperation({ summary: 'Field tests of the area: observed cases, marked spots, claims and their satellite step tests' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Field-tests block' })
    async block(@Param('id', ParseUUIDPipe) id: string): Promise<FieldTestsBlock> {
        return this.service.block(id);
    }
}
