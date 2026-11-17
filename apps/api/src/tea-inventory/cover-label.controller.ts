import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { AuthenticatedUser, CaykurRoles, CurrentUser } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import { CoverLabelExport, CoverLabelList, CoverLabelRow, CoverLabelService } from '@/tea-inventory/cover-label.service';
import { CreateCoverLabelDto } from '@/tea-inventory/dto';

const READ_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI, CaykurRole.DENETCI];
const WRITE_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI];

/** Ground reference areas for the land-cover module: what a person knows grows on a drawn area. */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...READ_ROLES)
@Controller('caykur/tea-inventory/areas/:id/cover-labels')
export class CoverLabelController {
    constructor(private readonly service: CoverLabelService) { }

    @Get()
    @ApiOperation({ summary: 'Reference areas of the neighbourhood with counts per cover class' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Reference areas' })
    async list(@Param('id', ParseUUIDPipe) id: string): Promise<CoverLabelList> {
        return this.service.list(id);
    }

    @Get('export')
    @ApiOperation({ summary: 'Reference areas as GeoJSON, the file the engine calibrates with' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'GeoJSON FeatureCollection' })
    async export(@Param('id', ParseUUIDPipe) id: string): Promise<CoverLabelExport> {
        return this.service.export(id);
    }

    @Post()
    @CaykurRoles(...WRITE_ROLES)
    @ApiOperation({ summary: 'Save a drawn reference area with its cover class' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 201, description: 'Saved reference area' })
    async create(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateCoverLabelDto, @CurrentUser() user: AuthenticatedUser): Promise<CoverLabelRow> {
        return this.service.create(id, dto, user.id);
    }

    @Delete(':labelId')
    @HttpCode(204)
    @CaykurRoles(...WRITE_ROLES)
    @ApiOperation({ summary: 'Remove a reference area' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'labelId', description: 'Reference area id' })
    @ApiResponse({ status: 204, description: 'Removed' })
    async remove(@Param('id', ParseUUIDPipe) id: string, @Param('labelId', ParseUUIDPipe) labelId: string): Promise<void> {
        return this.service.remove(id, labelId);
    }
}
