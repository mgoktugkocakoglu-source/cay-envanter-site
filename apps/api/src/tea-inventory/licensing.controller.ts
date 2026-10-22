import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles, CurrentUser } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import type { AuthenticatedUser } from '@/auth/decorators/current-user.decorator';
import {
    ApplicationDetail,
    ApplicationRow,
    LicensingLayers,
    LicensingProducerProfile,
    LicensingProducerRow,
    LicensingService,
    LicensingSummary,
} from '@/tea-inventory/licensing.service';
import { ApplicationDecisionDto, ApplicationQueryDto, CreateApplicationDto, LicensingProducerQueryDto, PreviewOperationDto } from '@/tea-inventory/dto';
import { GardenEditorContext, LicensingOperationsService, OperationPreview } from '@/tea-inventory/licensing-operations.service';
import { Paginated } from '@/common/dto/paginated.dto';

// Same audience as the tea inventory.
const READ_ROLES = [
    CaykurRole.KURUM_ADMIN,
    CaykurRole.FABRIKA_SORUMLUSU,
    CaykurRole.SAHA_PERSONELI,
    CaykurRole.DENETCI,
];
// Moving an application forward is an expert action: not for the read-only auditor role.
const DECIDE_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI];

/**
 * Producer-centred digital licence register: licences, licensed garden sub-polygons with three
 * area measures, lineage, boundary proposals / conflicts, application workflow and map layers.
 */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...READ_ROLES)
@Controller('caykur/tea-inventory/areas/:id/licensing')
export class LicensingController {
    constructor(
        private readonly service: LicensingService,
        private readonly operations: LicensingOperationsService,
    ) { }

    @Post('applications')
    @CaykurRoles(...DECIDE_ROLES)
    @ApiOperation({ summary: 'Open a file on the register: garden subdivision, licence split, transfer, area correction or boundary determination (validated payload)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 201, description: 'The created application' })
    async createApplication(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateApplicationDto, @CurrentUser() user: AuthenticatedUser): Promise<ApplicationDetail> {
        return this.service.createApplication(id, dto, user.id);
    }

    @Post('preview')
    @CaykurRoles(...DECIDE_ROLES)
    @ApiOperation({ summary: 'Dry run of a subdivision / split / boundary: computed areas, tea, licensed shares, overlaps and warnings' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 201, description: 'Preview' })
    async preview(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PreviewOperationDto): Promise<OperationPreview> {
        return this.operations.preview(id, dto);
    }

    @Get('gardens/:code/context')
    @ApiOperation({ summary: 'What the boundary editor needs: the garden, its parcel, neighbouring gardens in the parcel, tea patches and rules' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'code', description: 'Garden code' })
    @ApiResponse({ status: 200, description: 'Editor context' })
    async gardenContext(@Param('id', ParseUUIDPipe) id: string, @Param('code') code: string): Promise<GardenEditorContext> {
        return this.operations.gardenContext(id, code);
    }

    @Get('summary')
    @ApiOperation({ summary: 'Register totals: producers, licences by match level, gardens by boundary status, three area sums, applications, conflicts, unlicensed tea' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Licensing summary' })
    async summary(@Param('id', ParseUUIDPipe) id: string): Promise<LicensingSummary> {
        return this.service.summary(id);
    }

    @Get('producers')
    @ApiOperation({ summary: 'Producers with their licences, gardens, three areas and open issues (paginated)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Paginated producer register rows' })
    async producers(@Param('id', ParseUUIDPipe) id: string, @Query() query: LicensingProducerQueryDto): Promise<Paginated<LicensingProducerRow>> {
        return this.service.producers(id, query);
    }

    @Get('producers.csv')
    @Header('Content-Type', 'text/csv; charset=utf-8')
    @Header('Content-Disposition', 'attachment; filename="ruhsat-kaydi-mustahsiller.csv"')
    @ApiOperation({ summary: 'Producer register as CSV (Excel-compatible)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'CSV file' })
    async producersCsv(@Param('id', ParseUUIDPipe) id: string): Promise<string> {
        return this.service.producersCsv(id);
    }

    @Get('producers/:code')
    @ApiOperation({ summary: 'Producer licensing profile: licences with lineage, gardens with versions and proposals, applications, conflicts, pruning history' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'code', description: 'Producer code' })
    @ApiResponse({ status: 200, description: 'Producer profile' })
    async producer(@Param('id', ParseUUIDPipe) id: string, @Param('code') code: string): Promise<LicensingProducerProfile> {
        return this.service.producerProfile(id, code);
    }

    @Get('applications')
    @ApiOperation({ summary: 'Application queue with effective statuses (paginated)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Paginated applications' })
    async applications(@Param('id', ParseUUIDPipe) id: string, @Query() query: ApplicationQueryDto): Promise<Paginated<ApplicationRow>> {
        return this.service.applications(id, query);
    }

    @Get('applications/:code')
    @ApiOperation({ summary: 'Application file: documents, history, decisions, the garden and licence it concerns' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'code', description: 'Application code' })
    @ApiResponse({ status: 200, description: 'Application detail' })
    async application(@Param('id', ParseUUIDPipe) id: string, @Param('code') code: string): Promise<ApplicationDetail> {
        return this.service.application(id, code);
    }

    @Post('applications/:code/decision')
    @CaykurRoles(...DECIDE_ROLES)
    @ApiOperation({ summary: 'Move an application to its next status (DEMO decision; audited)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'code', description: 'Application code' })
    @ApiResponse({ status: 201, description: 'Updated application detail' })
    async decide(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('code') code: string,
        @Body() dto: ApplicationDecisionDto,
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<ApplicationDetail> {
        return this.service.decide(id, code, dto, user.id);
    }

    @Get('layers')
    @ApiOperation({ summary: 'GeoJSON layers: licensed gardens by status, boundary proposals, conflicts, unlicensed tea' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Map layers' })
    async layers(@Param('id', ParseUUIDPipe) id: string): Promise<LicensingLayers> {
        return this.service.layers(id);
    }
}
