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
    Request,
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
import { HarvestsService } from '@/harvests/harvests.service';
import { CreateHarvestDto, UpdateHarvestDto, HarvestQueryDto, HarvestWithStatus } from '@/harvests/dto';
import { Harvest } from '@/harvests/entities';

interface AuthenticatedRequest {
    user: { id: string };
}

@ApiTags('Harvests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('harvests')
export class HarvestsController {
    constructor(private readonly harvestsService: HarvestsService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new harvest' })
    @ApiResponse({ status: 201, description: 'Harvest created successfully' })
    async create(
        @Request() req: AuthenticatedRequest,
        @Body() dto: CreateHarvestDto,
    ): Promise<Harvest> {
        return this.harvestsService.create(req.user.id, dto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all harvests for current user' })
    @ApiResponse({ status: 200, description: 'List of harvests with status' })
    async findAll(
        @Request() req: AuthenticatedRequest,
        @Query() query: HarvestQueryDto,
    ): Promise<HarvestWithStatus[]> {
        return this.harvestsService.findAll(req.user.id, query);
    }

    @Get('available')
    @ApiOperation({ summary: 'Get harvests with remaining (unsold) amount' })
    @ApiResponse({ status: 200, description: 'List of available harvests' })
    async getAvailable(@Request() req: AuthenticatedRequest): Promise<HarvestWithStatus[]> {
        return this.harvestsService.getAvailableHarvests(req.user.id);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get harvest by ID' })
    @ApiParam({ name: 'id', description: 'Harvest UUID' })
    @ApiResponse({ status: 200, description: 'Harvest details' })
    @ApiResponse({ status: 404, description: 'Harvest not found' })
    async findOne(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<Harvest> {
        return this.harvestsService.findOne(id, req.user.id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update harvest' })
    @ApiParam({ name: 'id', description: 'Harvest UUID' })
    @ApiResponse({ status: 200, description: 'Harvest updated' })
    async update(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateHarvestDto,
    ): Promise<Harvest> {
        return this.harvestsService.update(id, req.user.id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Soft delete harvest' })
    @ApiParam({ name: 'id', description: 'Harvest UUID' })
    @ApiResponse({ status: 204, description: 'Harvest deleted' })
    @ApiResponse({ status: 400, description: 'Cannot delete - has payments' })
    async remove(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<void> {
        return this.harvestsService.softDelete(id, req.user.id);
    }

    @Get(':id/remaining')
    @ApiOperation({ summary: 'Get remaining (unsold) amount for a harvest' })
    @ApiParam({ name: 'id', description: 'Harvest UUID' })
    @ApiResponse({ status: 200, description: 'Remaining amount in kg' })
    async getRemainingAmount(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<{ remainingKg: number }> {
        await this.harvestsService.findOne(id, req.user.id); // Verify access
        const remainingKg = await this.harvestsService.getHarvestRemainingAmount(id);
        return { remainingKg };
    }
}
