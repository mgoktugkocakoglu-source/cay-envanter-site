import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    ParseUUIDPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/auth/enums/role.enum';
import { FirmsService } from '@/firms/firms.service';
import {
    CreateFirmDto,
    UpdateFirmDto,
    FirmQueryDto,
    CreateFirmTariffDto,
    UpdateFirmTariffDto,
    CreateFirmCollectionPointDto,
    UpdateFirmCollectionPointDto,
    FirmCollectionPointQueryDto,
    FirmWithCurrentTariffs,
} from '@/firms/dto';
import { Firm, FirmTariff, FirmCollectionPoint } from '@/firms/entities';

@ApiTags('Firms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('firms')
export class FirmsController {
    constructor(private readonly firmsService: FirmsService) { }

    // ─── Public Read Endpoints (all authenticated users) ───

    @Get()
    @ApiOperation({ summary: 'List all firms' })
    @ApiResponse({ status: 200, description: 'List of firms' })
    async findAll(@Query() query: FirmQueryDto): Promise<Firm[]> {
        return this.firmsService.findAll(query);
    }

    @Get('with-tariffs')
    @ApiOperation({ summary: 'Get active firms with current tariffs (for sell tea feature)' })
    @ApiResponse({ status: 200, description: 'Active firms with current tariffs' })
    async getActiveFirmsWithTariffs(): Promise<FirmWithCurrentTariffs[]> {
        return this.firmsService.getActiveFirmsWithCurrentTariffs();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get firm detail with tariffs and collection points' })
    @ApiParam({ name: 'id', description: 'Firm UUID' })
    @ApiResponse({ status: 200, description: 'Firm details' })
    @ApiResponse({ status: 404, description: 'Firm not found' })
    async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Firm> {
        return this.firmsService.findOne(id);
    }

    @Get(':id/tariffs')
    @ApiOperation({ summary: 'Get all tariffs for a firm' })
    @ApiParam({ name: 'id', description: 'Firm UUID' })
    @ApiResponse({ status: 200, description: 'List of tariffs' })
    async getTariffs(@Param('id', ParseUUIDPipe) id: string): Promise<FirmTariff[]> {
        return this.firmsService.getTariffs(id);
    }

    @Get(':id/tariffs/current')
    @ApiOperation({ summary: 'Get current effective tariffs for a firm' })
    @ApiParam({ name: 'id', description: 'Firm UUID' })
    @ApiResponse({ status: 200, description: 'Current tariffs' })
    async getCurrentTariffs(@Param('id', ParseUUIDPipe) id: string): Promise<FirmTariff[]> {
        return this.firmsService.getCurrentTariffs(id);
    }

    @Get(':id/collection-points')
    @ApiOperation({ summary: 'Get collection points with province/district filtering' })
    @ApiParam({ name: 'id', description: 'Firm UUID' })
    @ApiResponse({ status: 200, description: 'Collection points' })
    async getCollectionPoints(
        @Param('id', ParseUUIDPipe) id: string,
        @Query() query: FirmCollectionPointQueryDto,
    ): Promise<FirmCollectionPoint[]> {
        return this.firmsService.getCollectionPoints(id, query);
    }

    // ─── Admin Write Endpoints ───

    @Post()
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: 'Create a new firm (admin only)' })
    @ApiResponse({ status: 201, description: 'Firm created' })
    async create(@Body() dto: CreateFirmDto): Promise<Firm> {
        return this.firmsService.create(dto);
    }

    @Patch(':id')
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: 'Update firm (admin only)' })
    @ApiParam({ name: 'id', description: 'Firm UUID' })
    @ApiResponse({ status: 200, description: 'Firm updated' })
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateFirmDto,
    ): Promise<Firm> {
        return this.firmsService.update(id, dto);
    }

    @Delete(':id')
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete firm (admin only)' })
    @ApiParam({ name: 'id', description: 'Firm UUID' })
    @ApiResponse({ status: 204, description: 'Firm deleted' })
    async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
        return this.firmsService.remove(id);
    }

    // ─── Admin Tariff Endpoints ───

    @Post(':id/tariffs')
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: 'Create tariff for a firm (admin only)' })
    @ApiParam({ name: 'id', description: 'Firm UUID' })
    @ApiResponse({ status: 201, description: 'Tariff created' })
    async createTariff(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: CreateFirmTariffDto,
    ): Promise<FirmTariff> {
        return this.firmsService.createTariff(id, dto);
    }

    @Patch(':id/tariffs/:tariffId')
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: 'Update tariff (admin only)' })
    @ApiParam({ name: 'id', description: 'Firm UUID' })
    @ApiParam({ name: 'tariffId', description: 'Tariff UUID' })
    @ApiResponse({ status: 200, description: 'Tariff updated' })
    async updateTariff(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('tariffId', ParseUUIDPipe) tariffId: string,
        @Body() dto: UpdateFirmTariffDto,
    ): Promise<FirmTariff> {
        return this.firmsService.updateTariff(id, tariffId, dto);
    }

    @Delete(':id/tariffs/:tariffId')
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete tariff (admin only)' })
    @ApiParam({ name: 'id', description: 'Firm UUID' })
    @ApiParam({ name: 'tariffId', description: 'Tariff UUID' })
    @ApiResponse({ status: 204, description: 'Tariff deleted' })
    async removeTariff(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('tariffId', ParseUUIDPipe) tariffId: string,
    ): Promise<void> {
        return this.firmsService.removeTariff(id, tariffId);
    }

    // ─── Admin Collection Point Endpoints ───

    @Post(':id/collection-points')
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: 'Create collection point for a firm (admin only)' })
    @ApiParam({ name: 'id', description: 'Firm UUID' })
    @ApiResponse({ status: 201, description: 'Collection point created' })
    async createCollectionPoint(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: CreateFirmCollectionPointDto,
    ): Promise<FirmCollectionPoint> {
        return this.firmsService.createCollectionPoint(id, dto);
    }

    @Patch(':id/collection-points/:pointId')
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: 'Update collection point (admin only)' })
    @ApiParam({ name: 'id', description: 'Firm UUID' })
    @ApiParam({ name: 'pointId', description: 'Collection Point UUID' })
    @ApiResponse({ status: 200, description: 'Collection point updated' })
    async updateCollectionPoint(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('pointId', ParseUUIDPipe) pointId: string,
        @Body() dto: UpdateFirmCollectionPointDto,
    ): Promise<FirmCollectionPoint> {
        return this.firmsService.updateCollectionPoint(id, pointId, dto);
    }

    @Delete(':id/collection-points/:pointId')
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete collection point (admin only)' })
    @ApiParam({ name: 'id', description: 'Firm UUID' })
    @ApiParam({ name: 'pointId', description: 'Collection Point UUID' })
    @ApiResponse({ status: 204, description: 'Collection point deleted' })
    async removeCollectionPoint(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('pointId', ParseUUIDPipe) pointId: string,
    ): Promise<void> {
        return this.firmsService.removeCollectionPoint(id, pointId);
    }
}
