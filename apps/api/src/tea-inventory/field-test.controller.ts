import { Controller, Get, Param, ParseUUIDPipe, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard, CaykurRolesGuard } from '@/auth/guards';
import { CaykurRoles } from '@/auth/decorators';
import { CaykurRole } from '@/auth/enums';
import { FieldTestService } from '@/tea-inventory/field-test.service';
import { FieldTestReportService } from '@/tea-inventory/field-test-report.service';
import { FieldTestsBlock } from '@/tea-inventory/entities/field-test.types';
import { MIME, sendFile } from '@/tea-inventory/report.controller';

const READ_ROLES = [CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU, CaykurRole.SAHA_PERSONELI, CaykurRole.DENETCI];

/** Blind field-test module (Saha testi): the satellite's own delineation of a known cut, compared with ground truth. */
@ApiTags('Çaykur Panel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CaykurRolesGuard)
@CaykurRoles(...READ_ROLES)
@Controller('caykur/tea-inventory/areas/:id/field-tests')
export class FieldTestController {
    constructor(
        private readonly service: FieldTestService,
        private readonly report: FieldTestReportService,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Field tests of the area: cases, pixel lattice, clusters, detection summary and ground-truth comparison' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiResponse({ status: 200, description: 'Field-tests block' })
    async block(@Param('id', ParseUUIDPipe) id: string): Promise<FieldTestsBlock> {
        return this.service.block(id);
    }

    @Get(':caseId/report.pdf')
    @ApiOperation({ summary: 'Blind field-test report (PDF): inspector summary, map, clusters, pixels, series, ground-truth comparison, method' })
    @ApiParam({ name: 'id', description: 'Inventory area id' })
    @ApiParam({ name: 'caseId', description: 'Field-test case id' })
    @ApiResponse({ status: 200, description: 'PDF file' })
    async reportPdf(@Param('id', ParseUUIDPipe) id: string, @Param('caseId') caseId: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
        const file = await this.report.pdf(id, caseId);
        return sendFile(res, file.buffer, file.filename, MIME.pdf);
    }
}
