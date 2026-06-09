import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import { CaykurStaffService } from '@/caykur/caykur-staff.service';
import { CreateStaffDto, UpdateStaffDto, StaffQueryDto } from '@/caykur/dto';

/**
 * Çaykur staff management. Restricted to platform admins and kurum_admin (the
 * CaykurRolesGuard auto-allows Role.ADMIN). This is how management onboards
 * field officials and office staff.
 */
@ApiTags('Çaykur Staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(CaykurRole.KURUM_ADMIN)
@Controller('caykur/staff')
export class CaykurStaffController {
    constructor(private readonly staffService: CaykurStaffService) { }

    @Post()
    @ApiOperation({ summary: 'Onboard a Çaykur staff member' })
    @ApiResponse({ status: 201, description: 'Staff created; invite email sent' })
    async create(@Body() dto: CreateStaffDto) {
        return this.staffService.create(dto);
    }

    @Get()
    @ApiOperation({ summary: 'List Çaykur staff (paginated)' })
    @ApiResponse({ status: 200, description: 'Paginated staff list' })
    async list(@Query() query: StaffQueryDto) {
        return this.staffService.list(query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a staff member by ID' })
    @ApiResponse({ status: 200, description: 'Staff details' })
    @ApiResponse({ status: 404, description: 'Staff not found' })
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.staffService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a staff member (role, scope, active state)' })
    @ApiResponse({ status: 200, description: 'Staff updated' })
    async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStaffDto) {
        return this.staffService.update(id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Suspend a staff member' })
    @ApiResponse({ status: 200, description: 'Staff suspended' })
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.staffService.remove(id);
    }
}
