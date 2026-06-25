import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    ParseUUIDPipe,
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
import { PruningActor } from '@/pruning/pruning.service';
import { PruningRequestsService } from '@/pruning/pruning-requests.service';
import {
    CreatePruningRequestDto,
    SetPruningAppointmentDto,
    SavePruningMeasurementResultDto,
    RejectPruningRequestDto,
    PruningRequestQueryDto,
} from '@/pruning/dto';
import { PruningRequest } from '@/pruning/entities';

interface AuthenticatedRequest {
    user: PruningActor;
}

// Roles allowed to advance a request (schedule / measure / decide).
const STAFF_ACTION_ROLES = [
    CaykurRole.KURUM_ADMIN,
    CaykurRole.FABRIKA_SORUMLUSU,
    CaykurRole.SAHA_PERSONELI,
];

@ApiTags('Pruning Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pruning/requests')
export class PruningRequestsController {
    constructor(private readonly service: PruningRequestsService) {}

    @Post()
    @ApiOperation({ summary: 'Producer opens a budama (pruning) request' })
    @ApiResponse({ status: 201, description: 'Request created' })
    async create(
        @Request() req: AuthenticatedRequest,
        @Body() dto: CreatePruningRequestDto,
    ): Promise<PruningRequest> {
        return this.service.create(req.user, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List budama requests (producer: own; staff: all)' })
    @ApiResponse({ status: 200, description: 'Paginated requests' })
    async list(
        @Request() req: AuthenticatedRequest,
        @Query() query: PruningRequestQueryDto,
    ) {
        return this.service.list(req.user, query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a budama request by ID' })
    @ApiParam({ name: 'id', description: 'Request UUID' })
    @ApiResponse({ status: 200, description: 'Request details' })
    async findOne(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<PruningRequest> {
        return this.service.findOne(id, req.user);
    }

    @Patch(':id/appointment')
    @UseGuards(CaykurRolesGuard)
    @CaykurRoles(...STAFF_ACTION_ROLES)
    @ApiOperation({ summary: 'Authorized person sets the appointment date' })
    @ApiParam({ name: 'id', description: 'Request UUID' })
    async setAppointment(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: SetPruningAppointmentDto,
    ): Promise<PruningRequest> {
        return this.service.setAppointment(id, req.user, dto);
    }

    @Patch(':id/measurement')
    @UseGuards(CaykurRolesGuard)
    @CaykurRoles(...STAFF_ACTION_ROLES)
    @ApiOperation({ summary: 'Authorized person saves the on-site 3D measurement' })
    @ApiParam({ name: 'id', description: 'Request UUID' })
    async saveMeasurement(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: SavePruningMeasurementResultDto,
    ): Promise<PruningRequest> {
        return this.service.saveMeasurement(id, req.user, dto);
    }

    @Patch(':id/approve')
    @UseGuards(CaykurRolesGuard)
    @CaykurRoles(...STAFF_ACTION_ROLES)
    @ApiOperation({ summary: 'Authorized person approves the request' })
    @ApiParam({ name: 'id', description: 'Request UUID' })
    async approve(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<PruningRequest> {
        return this.service.approve(id, req.user);
    }

    @Patch(':id/reject')
    @UseGuards(CaykurRolesGuard)
    @CaykurRoles(...STAFF_ACTION_ROLES)
    @ApiOperation({ summary: 'Authorized person rejects the request' })
    @ApiParam({ name: 'id', description: 'Request UUID' })
    async reject(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: RejectPruningRequestDto,
    ): Promise<PruningRequest> {
        return this.service.reject(id, req.user, dto);
    }
}
