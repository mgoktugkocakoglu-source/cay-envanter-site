import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import { RemoteEvidenceService } from '@/tea-inventory/remote-evidence.service';

@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI, CaykurRole.DENETCI)
@Controller('caykur/tea-inventory/areas/:id/remote-evidence')
export class RemoteEvidenceController {
    constructor(private readonly service: RemoteEvidenceService) { }

    @Get('terrain')
    @ApiOperation({ summary: 'Existing relative terrain metadata; no orthophoto and no new reconstruction' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    terrain(@Param('id', ParseUUIDPipe) id: string) { return this.service.terrain(id); }

    @Get('timeline')
    @ApiOperation({ summary: 'Locally imported satellite scenes and approximate drone coverage' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    timeline(@Param('id', ParseUUIDPipe) id: string) { return this.service.timeline(id); }

    @Get('parcels/:block/:parcel')
    @ApiOperation({ summary: 'Existing vegetation time series; no licence inference' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'block', description: 'Cadastral block' })
    @ApiParam({ name: 'parcel', description: 'Cadastral parcel' })
    parcel(@Param('id', ParseUUIDPipe) id: string, @Param('block') block: string, @Param('parcel') parcel: string) {
        return this.service.parcel(id, block, parcel);
    }
}
