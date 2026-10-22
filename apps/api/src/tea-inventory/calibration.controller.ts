import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Query, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiConsumes, ApiProduces } from '@nestjs/swagger';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles, CurrentUser } from '@/auth/decorators';
import { AuthenticatedUser } from '@/auth/decorators/current-user.decorator';
import { CaykurRole } from '@/auth/enums';
import { CalibrationLabelView, CalibrationMetrics, CalibrationPlanRow, CalibrationService } from '@/tea-inventory/calibration.service';
import { CalibrationQueryDto, SaveCalibrationLabelDto } from '@/tea-inventory/dto';
import { Paginated } from '@/common/dto/paginated.dto';

const READ_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI, CaykurRole.DENETCI];
const WRITE_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI];

/** Calibration campaign: the field plan, ground-truth labels with photo, and the scoring. */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...READ_ROLES)
@Controller('caykur/tea-inventory/areas/:id/calibration')
export class CalibrationController {
    constructor(private readonly service: CalibrationService) { }

    @Get('plan')
    @ApiOperation({ summary: 'Stratified field plan: which gardens to visit, with the satellite verdict and any label so far' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Paginated plan rows' })
    async plan(@Param('id', ParseUUIDPipe) id: string, @Query() query: CalibrationQueryDto): Promise<Paginated<CalibrationPlanRow> & { season: string; planSize: number; localities: string[] }> {
        return this.service.plan(id, query);
    }

    @Get('labels')
    @ApiOperation({ summary: 'Labels saved so far (newest first)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Paginated labelled gardens' })
    async labels(@Param('id', ParseUUIDPipe) id: string, @Query() query: CalibrationQueryDto): Promise<Paginated<CalibrationPlanRow>> {
        return this.service.labels(id, query);
    }

    @Post('labels')
    @CaykurRoles(...WRITE_ROLES)
    @ApiOperation({ summary: 'Save (or replace) the ground-truth label of a garden for the season' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 201, description: 'Saved label' })
    async save(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveCalibrationLabelDto, @CurrentUser() user: AuthenticatedUser): Promise<CalibrationLabelView> {
        return this.service.save(id, dto, user.id);
    }

    @Post('labels/:labelId/photo')
    @CaykurRoles(...WRITE_ROLES)
    @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'Attach the geotagged photo (JPEG/PNG/WebP ≤ 2 MB, downscaled by the client)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'labelId', description: 'Label id' })
    @ApiResponse({ status: 201, description: 'Label with photo' })
    async photo(@Param('id', ParseUUIDPipe) id: string, @Param('labelId', ParseUUIDPipe) labelId: string, @UploadedFile() file: Express.Multer.File): Promise<CalibrationLabelView> {
        if (!file) throw new BadRequestException('Dosya yüklenemedi.');
        return this.service.savePhoto(id, labelId, file);
    }

    @Get('labels/:labelId/photo')
    @ApiOperation({ summary: 'The label photo' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'labelId', description: 'Label id' })
    @ApiProduces('image/jpeg')
    @ApiResponse({ status: 200, description: 'Image' })
    async getPhoto(@Param('id', ParseUUIDPipe) id: string, @Param('labelId', ParseUUIDPipe) labelId: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
        const { buffer, mime } = await this.service.photo(id, labelId);
        res.set({ 'Content-Type': mime, 'Content-Length': String(buffer.length), 'Cache-Control': 'private, max-age=3600' });
        return new StreamableFile(buffer);
    }

    @Delete('labels/:labelId')
    @HttpCode(204)
    @CaykurRoles(...WRITE_ROLES)
    @ApiOperation({ summary: 'Delete a label (mistaken entry)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'labelId', description: 'Label id' })
    @ApiResponse({ status: 204, description: 'Deleted' })
    async remove(@Param('id', ParseUUIDPipe) id: string, @Param('labelId', ParseUUIDPipe) labelId: string): Promise<void> {
        await this.service.remove(id, labelId);
    }

    @Get('metrics')
    @ApiOperation({ summary: 'Recall, false-alarm rate, confusion matrix and the z-threshold sweep against the labels' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Calibration metrics' })
    async metrics(@Param('id', ParseUUIDPipe) id: string, @Query() query: CalibrationQueryDto): Promise<CalibrationMetrics> {
        return this.service.metrics(id, query.season, query.size);
    }

    @Get('labels.csv')
    @Header('Content-Type', 'text/csv; charset=utf-8')
    @Header('Content-Disposition', 'attachment; filename="kalibrasyon-etiketleri.csv"')
    @ApiOperation({ summary: 'Labels as CSV for the engine calibration step' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'CSV file' })
    async labelsCsv(@Param('id', ParseUUIDPipe) id: string, @Query() query: CalibrationQueryDto): Promise<string> {
        return this.service.labelsCsv(id, query.season);
    }
}
