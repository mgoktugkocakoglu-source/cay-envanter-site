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
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import { PruningService, PruningActor } from '@/pruning/pruning.service';
import {
    CreatePruningMeasurementDto,
    UpdatePruningApprovalDto,
    AssignPruningTaskDto,
    PruningQueryDto,
} from '@/pruning/dto';
import { PruningMeasurement, PruningTask } from '@/pruning/entities';

interface AuthenticatedRequest {
    user: PruningActor;
}

const STAFF_VIEW_ROLES = [
    CaykurRole.SAHA_PERSONELI,
    CaykurRole.FABRIKA_SORUMLUSU,
    CaykurRole.KURUM_ADMIN,
    CaykurRole.DENETCI,
];

@ApiTags('Pruning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pruning')
export class PruningController {
    constructor(private readonly pruningService: PruningService) { }

    // ── Tasks (Çaykur staff only) ──

    @Post('tasks')
    @UseGuards(CaykurRolesGuard)
    @CaykurRoles(CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU)
    @ApiOperation({ summary: 'Assign a pruning measurement task to a field officer' })
    @ApiResponse({ status: 201, description: 'Task assigned' })
    async assignTask(
        @Request() req: AuthenticatedRequest,
        @Body() dto: AssignPruningTaskDto,
    ): Promise<PruningTask> {
        return this.pruningService.assignTask(req.user, dto);
    }

    @Get('tasks')
    @UseGuards(CaykurRolesGuard)
    @CaykurRoles(...STAFF_VIEW_ROLES)
    @ApiOperation({ summary: 'List pruning tasks (officer queue / manager overview)' })
    @ApiResponse({ status: 200, description: 'Paginated tasks' })
    async listTasks(
        @Request() req: AuthenticatedRequest,
        @Query() query: PruningQueryDto,
    ) {
        return this.pruningService.listTasks(req.user, query);
    }

    @Get('tasks/:id')
    @UseGuards(CaykurRolesGuard)
    @CaykurRoles(...STAFF_VIEW_ROLES)
    @ApiOperation({ summary: 'Get a pruning task by ID' })
    @ApiParam({ name: 'id', description: 'Task UUID' })
    @ApiResponse({ status: 200, description: 'Task details' })
    async getTask(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<PruningTask> {
        return this.pruningService.getTask(id, req.user);
    }

    // ── Measurements (producers + staff; fine-grained authz in the service) ──

    @Post()
    @ApiOperation({ summary: 'Record a pruning measurement' })
    @ApiResponse({ status: 201, description: 'Measurement recorded' })
    async create(
        @Request() req: AuthenticatedRequest,
        @Body() dto: CreatePruningMeasurementDto,
    ): Promise<PruningMeasurement> {
        return this.pruningService.create(req.user, dto);
    }

    @Get('field/:fieldId')
    @ApiOperation({ summary: 'List pruning measurements for a parcel (newest first)' })
    @ApiParam({ name: 'fieldId', description: 'Field UUID' })
    @ApiResponse({ status: 200, description: 'Measurement history' })
    async findByField(
        @Request() req: AuthenticatedRequest,
        @Param('fieldId', ParseUUIDPipe) fieldId: string,
    ): Promise<PruningMeasurement[]> {
        return this.pruningService.findByField(fieldId, req.user);
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
        return this.pruningService.findOne(id, req.user);
    }

    @Patch(':id/approve')
    @ApiOperation({ summary: 'Update producer/staff approval (or reject) a measurement' })
    @ApiParam({ name: 'id', description: 'Measurement UUID' })
    @ApiResponse({ status: 200, description: 'Approvals updated' })
    async updateApproval(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdatePruningApprovalDto,
    ): Promise<PruningMeasurement> {
        return this.pruningService.updateApproval(id, req.user, dto);
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
        return this.pruningService.remove(id, req.user);
    }
}
