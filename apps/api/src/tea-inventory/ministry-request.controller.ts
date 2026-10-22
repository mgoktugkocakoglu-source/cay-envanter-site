import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiProduces } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles, CurrentUser } from '@/auth/decorators';
import { AuthenticatedUser } from '@/auth/decorators/current-user.decorator';
import { CaykurRole } from '@/auth/enums';
import { MinistryRequestDetail, MinistryRequestRow, MinistryRequestService } from '@/tea-inventory/ministry-request.service';
import { CreateMinistryRequestDto, MinistryRequestQueryDto } from '@/tea-inventory/dto';
import { MIME, sendFile } from '@/tea-inventory/report.controller';

const READ_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI, CaykurRole.DENETCI];
const WRITE_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.DENETCI];

/** Ministry / inspection requests: list in, answers and evidence package out. */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...READ_ROLES)
@Controller('caykur/tea-inventory/areas/:id/ministry-requests')
export class MinistryRequestController {
    constructor(private readonly service: MinistryRequestService) { }

    @Get()
    @ApiOperation({ summary: 'Requests answered for this area (newest first)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Request rows' })
    async list(@Param('id', ParseUUIDPipe) id: string, @Query() query: MinistryRequestQueryDto): Promise<MinistryRequestRow[]> {
        return this.service.list(id, query.season);
    }

    @Post()
    @CaykurRoles(...WRITE_ROLES)
    @ApiOperation({ summary: 'Register a request and answer it: match every line to the season register and snapshot the decisions' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 201, description: 'Answered request with its items' })
    async create(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMinistryRequestDto, @CurrentUser() user: AuthenticatedUser): Promise<MinistryRequestDetail> {
        return this.service.create(id, dto, user.id);
    }

    @Get(':requestId')
    @ApiOperation({ summary: 'A request with every answered line' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'requestId', description: 'Request id' })
    @ApiResponse({ status: 200, description: 'Request detail' })
    async get(@Param('id', ParseUUIDPipe) id: string, @Param('requestId', ParseUUIDPipe) requestId: string): Promise<MinistryRequestDetail> {
        return this.service.get(id, requestId);
    }

    @Delete(':requestId')
    @HttpCode(204)
    @CaykurRoles(CaykurRole.KURUM_ADMIN)
    @ApiOperation({ summary: 'Delete a request (admin)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'requestId', description: 'Request id' })
    @ApiResponse({ status: 204, description: 'Deleted' })
    async remove(@Param('id', ParseUUIDPipe) id: string, @Param('requestId', ParseUUIDPipe) requestId: string): Promise<void> {
        await this.service.remove(id, requestId);
    }

    @Get(':requestId/answer.xlsx')
    @ApiOperation({ summary: 'The answer sheet (Excel)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'requestId', description: 'Request id' })
    @ApiProduces(MIME.xlsx)
    @ApiResponse({ status: 200, description: 'Excel file' })
    async answer(@Param('id', ParseUUIDPipe) id: string, @Param('requestId', ParseUUIDPipe) requestId: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
        const file = await this.service.answerXlsx(id, requestId);
        return sendFile(res, file.buffer, file.filename, MIME.xlsx);
    }

    @Get(':requestId/evidence.zip')
    @ApiOperation({ summary: 'Answer sheet plus one evidence PDF per matched producer (ZIP)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'requestId', description: 'Request id' })
    @ApiProduces(MIME.zip)
    @ApiResponse({ status: 200, description: 'ZIP file' })
    async evidence(@Param('id', ParseUUIDPipe) id: string, @Param('requestId', ParseUUIDPipe) requestId: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
        const file = await this.service.evidenceZip(id, requestId);
        return sendFile(res, file.buffer, file.filename, MIME.zip);
    }
}
