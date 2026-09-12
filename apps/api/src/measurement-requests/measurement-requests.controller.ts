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
import {
    MeasurementRequestsService,
    MeasurementRequestView,
} from '@/measurement-requests/measurement-requests.service';
import {
    CreateMeasurementRequestDto,
    SetMeasurementAppointmentDto,
    RejectMeasurementRequestDto,
    MeasurementRequestQueryDto,
} from '@/measurement-requests/dto';
import { Paginated } from '@/common/dto/paginated.dto';

interface AuthenticatedRequest {
    user: PruningActor;
}

// Roles allowed to schedule / reject a request (same as pruning requests).
const STAFF_ACTION_ROLES = [
    CaykurRole.KURUM_ADMIN,
    CaykurRole.FABRIKA_SORUMLUSU,
    CaykurRole.SAHA_PERSONELI,
];

@ApiTags('Measurement Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('measurement-requests')
export class MeasurementRequestsController {
    constructor(private readonly service: MeasurementRequestsService) {}

    @Post()
    @ApiOperation({ summary: 'Producer asks Çaykur staff to measure their slice of a hisseli parcel on site' })
    @ApiResponse({ status: 201, description: 'Request created' })
    async create(
        @Request() req: AuthenticatedRequest,
        @Body() dto: CreateMeasurementRequestDto,
    ): Promise<MeasurementRequestView> {
        return this.service.create(req.user, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List measurement requests (producer: own; staff: all)' })
    @ApiResponse({ status: 200, description: 'Paginated requests' })
    async list(
        @Request() req: AuthenticatedRequest,
        @Query() query: MeasurementRequestQueryDto,
    ): Promise<Paginated<MeasurementRequestView>> {
        return this.service.list(req.user, query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a measurement request by ID' })
    @ApiParam({ name: 'id', description: 'Request UUID' })
    async findOne(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<MeasurementRequestView> {
        return this.service.findOne(id, req.user);
    }

    @Patch(':id/cancel')
    @ApiOperation({ summary: 'Producer withdraws a request that has not been measured yet' })
    @ApiParam({ name: 'id', description: 'Request UUID' })
    async cancel(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<MeasurementRequestView> {
        return this.service.cancel(id, req.user);
    }

    @Patch(':id/appointment')
    @UseGuards(CaykurRolesGuard)
    @CaykurRoles(...STAFF_ACTION_ROLES)
    @ApiOperation({ summary: 'Authorized person sets the on-site appointment date' })
    @ApiParam({ name: 'id', description: 'Request UUID' })
    async setAppointment(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: SetMeasurementAppointmentDto,
    ): Promise<MeasurementRequestView> {
        return this.service.setAppointment(id, req.user, dto);
    }

    @Patch(':id/reject')
    @UseGuards(CaykurRolesGuard)
    @CaykurRoles(...STAFF_ACTION_ROLES)
    @ApiOperation({ summary: 'Authorized person rejects the request' })
    @ApiParam({ name: 'id', description: 'Request UUID' })
    async reject(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: RejectMeasurementRequestDto,
    ): Promise<MeasurementRequestView> {
        return this.service.reject(id, req.user, dto);
    }
}
