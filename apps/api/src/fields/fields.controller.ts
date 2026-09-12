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
import { FieldsService } from '@/fields/fields.service';
import { FieldView } from '@/fields/field-boundary.service';
import {
    CreateFieldDto,
    UpdateFieldDto,
    CreateFieldPartnerDto,
    UpdateFieldPartnerDto,
    FieldQueryDto,
} from '@/fields/dto';
import { FieldPartner } from '@/fields/entities';

interface AuthenticatedRequest {
    user: { id: string };
}

@ApiTags('Fields')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fields')
export class FieldsController {
    constructor(private readonly fieldsService: FieldsService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new field' })
    @ApiResponse({ status: 201, description: 'Field created successfully' })
    async create(
        @Request() req: AuthenticatedRequest,
        @Body() dto: CreateFieldDto,
    ): Promise<FieldView> {
        return this.fieldsService.create(req.user.id, dto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all fields for current user' })
    @ApiResponse({ status: 200, description: 'List of fields' })
    async findAll(
        @Request() req: AuthenticatedRequest,
        @Query() query: FieldQueryDto,
    ): Promise<FieldView[]> {
        return this.fieldsService.findAll(req.user.id, query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get field by ID' })
    @ApiParam({ name: 'id', description: 'Field UUID' })
    @ApiResponse({ status: 200, description: 'Field details' })
    @ApiResponse({ status: 404, description: 'Field not found' })
    async findOne(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<FieldView> {
        return this.fieldsService.findOne(id, req.user.id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update field' })
    @ApiParam({ name: 'id', description: 'Field UUID' })
    @ApiResponse({ status: 200, description: 'Field updated' })
    async update(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateFieldDto,
    ): Promise<FieldView> {
        return this.fieldsService.update(id, req.user.id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Soft delete field' })
    @ApiParam({ name: 'id', description: 'Field UUID' })
    @ApiResponse({ status: 204, description: 'Field deleted' })
    async remove(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<void> {
        return this.fieldsService.softDelete(id, req.user.id);
    }

    @Post(':id/restore')
    @ApiOperation({ summary: 'Restore deleted field' })
    @ApiParam({ name: 'id', description: 'Field UUID' })
    @ApiResponse({ status: 200, description: 'Field restored' })
    async restore(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<FieldView> {
        return this.fieldsService.restore(id, req.user.id);
    }

    // Partner endpoints
    @Get(':id/partners')
    @ApiOperation({ summary: 'Get partners for a field' })
    @ApiParam({ name: 'id', description: 'Field UUID' })
    async getPartners(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<FieldPartner[]> {
        return this.fieldsService.getPartners(id, req.user.id);
    }

    @Post(':id/partners')
    @ApiOperation({ summary: 'Add partner to field' })
    @ApiParam({ name: 'id', description: 'Field UUID' })
    async addPartner(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: CreateFieldPartnerDto,
    ): Promise<FieldPartner> {
        return this.fieldsService.addPartner(id, req.user.id, dto);
    }

    @Patch(':id/partners/:partnerId')
    @ApiOperation({ summary: 'Update partner' })
    @ApiParam({ name: 'id', description: 'Field UUID' })
    @ApiParam({ name: 'partnerId', description: 'Partner UUID' })
    async updatePartner(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
        @Param('partnerId', ParseUUIDPipe) partnerId: string,
        @Body() dto: UpdateFieldPartnerDto,
    ): Promise<FieldPartner> {
        return this.fieldsService.updatePartner(id, partnerId, req.user.id, dto);
    }

    @Post(':id/partners/:partnerId/accept')
    @ApiOperation({ summary: 'Accept partner invitation' })
    @ApiParam({ name: 'id', description: 'Field UUID' })
    @ApiParam({ name: 'partnerId', description: 'Partner UUID' })
    async acceptPartner(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
        @Param('partnerId', ParseUUIDPipe) partnerId: string,
    ): Promise<FieldPartner> {
        return this.fieldsService.respondToPartnerInvitation(id, partnerId, req.user.id, 'accepted');
    }

    @Post(':id/partners/:partnerId/reject')
    @ApiOperation({ summary: 'Reject partner invitation' })
    @ApiParam({ name: 'id', description: 'Field UUID' })
    @ApiParam({ name: 'partnerId', description: 'Partner UUID' })
    async rejectPartner(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
        @Param('partnerId', ParseUUIDPipe) partnerId: string,
    ): Promise<FieldPartner> {
        return this.fieldsService.respondToPartnerInvitation(id, partnerId, req.user.id, 'rejected');
    }

    @Delete(':id/partners/:partnerId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Remove partner from field' })
    @ApiParam({ name: 'id', description: 'Field UUID' })
    @ApiParam({ name: 'partnerId', description: 'Partner UUID' })
    async removePartner(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
        @Param('partnerId', ParseUUIDPipe) partnerId: string,
    ): Promise<void> {
        return this.fieldsService.removePartner(id, partnerId, req.user.id);
    }
}
