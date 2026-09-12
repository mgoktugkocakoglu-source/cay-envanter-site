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
import { LicensingService } from '@/licensing/licensing.service';
import {
    CreateLicensingMeasurementDto,
    CreateProducerBoundaryDto,
    DecideLicensingApprovalDto,
    LicensingMeasurementQueryDto,
    LicensingApprovalQueryDto,
} from '@/licensing/dto';
import { LicensingMeasurement, LicensingApproval } from '@/licensing/entities';
import { Paginated } from '@/common/dto/paginated.dto';

interface AuthenticatedRequest {
    user: PruningActor;
}

// Roles allowed to capture a licensing measurement (same as pruning requests).
const STAFF_ACTION_ROLES = [
    CaykurRole.KURUM_ADMIN,
    CaykurRole.FABRIKA_SORUMLUSU,
    CaykurRole.SAHA_PERSONELI,
];

@ApiTags('Licensing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('licensing')
export class LicensingController {
    constructor(private readonly service: LicensingService) {}

    @Post()
    @UseGuards(CaykurRolesGuard)
    @CaykurRoles(...STAFF_ACTION_ROLES)
    @ApiOperation({ summary: 'Authorized person saves a ruhsatlandırma measurement for one registered owner' })
    @ApiResponse({ status: 201, description: 'Measurement saved; co-owner approvals created and notified' })
    async create(
        @Request() req: AuthenticatedRequest,
        @Body() dto: CreateLicensingMeasurementDto,
    ): Promise<LicensingMeasurement> {
        return this.service.create(req.user, dto);
    }

    @Post('boundary')
    @ApiOperation({ summary: 'Producer submits their own slice of a hisseli parcel drawn on the satellite map' })
    @ApiResponse({ status: 201, description: 'Boundary saved; co-owner approvals created and notified' })
    async createBoundary(
        @Request() req: AuthenticatedRequest,
        @Body() dto: CreateProducerBoundaryDto,
    ): Promise<LicensingMeasurement> {
        return this.service.createProducerBoundary(req.user, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List licensing measurements (staff: all; producer: own/involved)' })
    @ApiResponse({ status: 200, description: 'Paginated measurements' })
    async list(
        @Request() req: AuthenticatedRequest,
        @Query() query: LicensingMeasurementQueryDto,
    ): Promise<Paginated<LicensingMeasurement>> {
        return this.service.list(req.user, query);
    }

    // Static "approvals" routes must be declared before the ":id" route.
    @Get('approvals')
    @ApiOperation({ summary: 'Co-owner approval requests addressed to the current user' })
    @ApiResponse({ status: 200, description: 'Paginated approvals (pending first)' })
    async myApprovals(
        @Request() req: AuthenticatedRequest,
        @Query() query: LicensingApprovalQueryDto,
    ): Promise<Paginated<LicensingApproval>> {
        return this.service.listMyApprovals(req.user, query);
    }

    @Get('approvals/pending-count')
    @ApiOperation({ summary: 'Number of approval requests awaiting the current user' })
    async pendingCount(@Request() req: AuthenticatedRequest): Promise<{ count: number }> {
        return this.service.pendingApprovalCount(req.user);
    }

    @Patch('approvals/:id/decision')
    @ApiOperation({ summary: 'Co-owner approves or rejects a licensing measurement' })
    @ApiParam({ name: 'id', description: 'Approval UUID' })
    async decide(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: DecideLicensingApprovalDto,
    ): Promise<LicensingApproval> {
        return this.service.decide(id, req.user, dto);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a licensing measurement with its approvals' })
    @ApiParam({ name: 'id', description: 'Measurement UUID' })
    async findOne(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<LicensingMeasurement> {
        return this.service.findOne(id, req.user);
    }
}
