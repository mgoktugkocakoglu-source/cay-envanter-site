import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { ReportsService } from '@/reports/reports.service';
import {
    YearlySummaryQueryDto,
    FieldProfitabilityQueryDto,
    HarvestTrendsQueryDto,
    YearlySummary,
    MonthlyData,
    FieldProfitability,
    YearComparison,
} from '@/reports/dto';

interface AuthenticatedRequest {
    user: { id: string };
}

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    @Get('yearly-summary')
    @ApiOperation({ summary: 'Get yearly income and harvest summary' })
    @ApiResponse({ status: 200, description: 'Yearly summary data' })
    async getYearlySummary(
        @Request() req: AuthenticatedRequest,
        @Query() query: YearlySummaryQueryDto,
    ): Promise<YearlySummary> {
        const year = query.year || new Date().getFullYear();
        return this.reportsService.getYearlySummary(req.user.id, year);
    }

    @Get('monthly-income')
    @ApiOperation({ summary: 'Get monthly income breakdown' })
    @ApiResponse({ status: 200, description: 'Monthly income data' })
    async getMonthlyIncome(
        @Request() req: AuthenticatedRequest,
        @Query() query: YearlySummaryQueryDto,
    ): Promise<MonthlyData[]> {
        const year = query.year || new Date().getFullYear();
        return this.reportsService.getMonthlyIncome(req.user.id, year);
    }

    @Get('monthly-harvest')
    @ApiOperation({ summary: 'Get monthly harvest breakdown' })
    @ApiResponse({ status: 200, description: 'Monthly harvest data' })
    async getMonthlyHarvest(
        @Request() req: AuthenticatedRequest,
        @Query() query: YearlySummaryQueryDto,
    ): Promise<MonthlyData[]> {
        const year = query.year || new Date().getFullYear();
        return this.reportsService.getMonthlyHarvest(req.user.id, year);
    }

    @Get('field-profitability')
    @ApiOperation({ summary: 'Get field profitability analysis' })
    @ApiResponse({ status: 200, description: 'Field profitability rankings' })
    async getFieldProfitability(
        @Request() req: AuthenticatedRequest,
        @Query() query: FieldProfitabilityQueryDto,
    ): Promise<FieldProfitability[]> {
        return this.reportsService.getFieldProfitability(req.user.id, query.year);
    }

    @Get('year-comparison')
    @ApiOperation({ summary: 'Get year-over-year comparison' })
    @ApiResponse({ status: 200, description: 'Year comparison data' })
    async getYearComparison(
        @Request() req: AuthenticatedRequest,
        @Query() query: HarvestTrendsQueryDto,
    ): Promise<YearComparison[]> {
        const currentYear = new Date().getFullYear();
        let years: number[];

        if (query.years) {
            years = query.years
                .split(',')
                .map((y) => parseInt(y.trim(), 10))
                .filter((y) => !isNaN(y))
                .slice(0, 5)
                .sort((a, b) => a - b);
        } else {
            // Default to last 3 years
            years = [currentYear - 2, currentYear - 1, currentYear];
        }

        return this.reportsService.getYearComparison(req.user.id, years);
    }
}
