import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
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
import { PruningService } from '@/pruning/pruning.service';
import { CreatePruningMeasurementDto, UpdatePruningApprovalDto } from '@/pruning/dto';
import { PruningMeasurement } from '@/pruning/entities';

interface AuthenticatedRequest {
    user: { id: string };
}

@ApiTags('Pruning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pruning')
export class PruningController {
    constructor(private readonly pruningService: PruningService) {}

    @Post()
    @ApiOperation({ summary: 'Record a pruning measurement' })
    @ApiResponse({ status: 201, description: 'Measurement recorded' })
    async create(
        @Request() req: AuthenticatedRequest,
        @Body() dto: CreatePruningMeasurementDto,
    ): Promise<PruningMeasurement> {
        return this.pruningService.create(req.user.id, dto);
    }

    @Get('field/:fieldId')
    @ApiOperation({ summary: 'List pruning measurements for a parcel (newest first)' })
    @ApiParam({ name: 'fieldId', description: 'Field UUID' })
    @ApiResponse({ status: 200, description: 'Measurement history' })
    async findByField(
        @Request() req: AuthenticatedRequest,
        @Param('fieldId', ParseUUIDPipe) fieldId: string,
    ): Promise<PruningMeasurement[]> {
        return this.pruningService.findByField(fieldId, req.user.id);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a pruning measurement by ID' })
    @ApiParam({ name: 'id', description: 'Measurement UUID' })
    @ApiResponse({ status: 200, description: 'Measurement details' })
    @ApiResponse({ status: 404, description: 'Measurement not found' })
    async findOne(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<PruningMeasurement> {
        return this.pruningService.findOne(id, req.user.id);
    }

    @Patch(':id/approve')
    @ApiOperation({ summary: 'Update producer/staff approval on a measurement' })
    @ApiParam({ name: 'id', description: 'Measurement UUID' })
    @ApiResponse({ status: 200, description: 'Approvals updated' })
    async updateApproval(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdatePruningApprovalDto,
    ): Promise<PruningMeasurement> {
        return this.pruningService.updateApproval(id, req.user.id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a pruning measurement' })
    @ApiParam({ name: 'id', description: 'Measurement UUID' })
    @ApiResponse({ status: 204, description: 'Measurement deleted' })
    async remove(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<void> {
        return this.pruningService.remove(id, req.user.id);
    }
}
