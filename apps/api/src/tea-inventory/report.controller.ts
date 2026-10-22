import { Controller, Get, Param, ParseUUIDPipe, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiProduces } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import { EvidenceService } from '@/tea-inventory/evidence.service';
import { SeasonReportService } from '@/tea-inventory/season-report.service';
import { ReportQueryDto } from '@/tea-inventory/dto';

const READ_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI, CaykurRole.DENETCI];

/** Sets the download headers for a generated file and wraps it as a stream. */
export function sendFile(res: Response, buffer: Buffer, filename: string, mime: string): StreamableFile {
    res.set({
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
    });
    return new StreamableFile(buffer);
}

export const MIME = {
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    zip: 'application/zip',
    csv: 'text/csv; charset=utf-8',
} as const;

/** Evidence packs (per producer / garden) and the official season report. */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...READ_ROLES)
@Controller('caykur/tea-inventory')
export class ReportController {
    constructor(
        private readonly evidence: EvidenceService,
        private readonly report: SeasonReportService,
    ) { }

    @Get('areas/:id/pruning-fusion/producers/:code/evidence.pdf')
    @ApiOperation({ summary: 'Evidence pack of a producer: licence, decision, per-garden proof (PDF)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'code', description: 'Producer code' })
    @ApiProduces('application/pdf')
    @ApiResponse({ status: 200, description: 'PDF file' })
    async producerEvidence(@Param('id', ParseUUIDPipe) id: string, @Param('code') code: string, @Query() query: ReportQueryDto, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
        const file = await this.evidence.producerPdf(id, code, query.season);
        return sendFile(res, file.buffer, file.filename, MIME.pdf);
    }

    @Get('pruning-fusion/gardens/:gardenId/evidence.pdf')
    @ApiOperation({ summary: 'Evidence of one garden: verdict, channels, series, scenes (PDF)' })
    @ApiParam({ name: 'gardenId', description: 'Garden id' })
    @ApiProduces('application/pdf')
    @ApiResponse({ status: 200, description: 'PDF file' })
    async gardenEvidence(@Param('gardenId', ParseUUIDPipe) gardenId: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
        const file = await this.evidence.gardenPdf(gardenId);
        return sendFile(res, file.buffer, file.filename, MIME.pdf);
    }

    @Get('areas/:id/reports/season.xlsx')
    @ApiOperation({ summary: 'Season report with every producer, garden, shortfall and anomaly (Excel)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiProduces(MIME.xlsx)
    @ApiResponse({ status: 200, description: 'Excel file' })
    async seasonXlsx(@Param('id', ParseUUIDPipe) id: string, @Query() query: ReportQueryDto, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
        const file = await this.report.xlsx(id, query.season);
        return sendFile(res, file.buffer, file.filename, MIME.xlsx);
    }

    @Get('areas/:id/reports/season.pdf')
    @ApiOperation({ summary: 'Season report summary for signature (PDF)' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiProduces('application/pdf')
    @ApiResponse({ status: 200, description: 'PDF file' })
    async seasonPdf(@Param('id', ParseUUIDPipe) id: string, @Query() query: ReportQueryDto, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
        const file = await this.report.pdf(id, query.season);
        return sendFile(res, file.buffer, file.filename, MIME.pdf);
    }
}
