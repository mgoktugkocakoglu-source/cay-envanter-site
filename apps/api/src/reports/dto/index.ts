import { IsNumber, IsOptional, IsUUID, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class YearlySummaryQueryDto {
    @ApiPropertyOptional({ description: 'Year to get summary for', default: 'current year' })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    @Min(2020)
    @Max(2100)
    year?: number;
}

export class FieldProfitabilityQueryDto {
    @ApiPropertyOptional({ description: 'Year for analysis' })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    year?: number;
}

export class HarvestTrendsQueryDto {
    @ApiPropertyOptional({ description: 'Field ID filter' })
    @IsOptional()
    @IsUUID()
    fieldId?: string;

    @ApiPropertyOptional({ description: 'Years to compare (comma separated, max 5)' })
    @IsOptional()
    years?: string;
}

export interface YearlySummary {
    year: number;
    totalIncome: number;
    totalHarvestKg: number;
    averagePricePerKg: number;
    activeFieldCount: number;
    harvestCount: number;
    paymentCount: number;
}

export interface MonthlyData {
    month: number;
    monthName: string;
    income: number;
    harvestKg: number;
    harvestCount: number;
}

export interface FieldProfitability {
    fieldId: string;
    fieldName: string;
    area: number;
    areaUnit: string;
    totalHarvestKg: number;
    totalIncome: number;
    harvestPerArea: number;
    incomePerArea: number;
    performanceScore: number;
}

export interface YearComparison {
    year: number;
    totalHarvestKg: number;
    totalIncome: number;
    averagePricePerKg: number;
    changeFromPrevious: {
        harvestChange: number | null;
        incomeChange: number | null;
        priceChange: number | null;
    };
}
