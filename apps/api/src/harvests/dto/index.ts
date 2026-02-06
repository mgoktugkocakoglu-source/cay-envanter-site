import {
    IsString,
    IsNumber,
    IsOptional,
    IsDateString,
    IsEnum,
    IsUUID,
    MaxLength,
    Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HarvestQuality } from '@/harvests/entities/harvest.entity';

export class CreateHarvestDto {
    @ApiProperty({ description: 'Field ID' })
    @IsUUID()
    fieldId: string;

    @ApiProperty({ description: 'Harvest date (YYYY-MM-DD)' })
    @IsDateString()
    harvestDate: string;

    @ApiProperty({ description: 'Amount in kg', minimum: 0.1 })
    @IsNumber()
    @Min(0.1)
    amountKg: number;

    @ApiPropertyOptional({ description: 'Harvest quality', enum: ['shoot', 'leaf', 'mixed'] })
    @IsOptional()
    @IsEnum(['shoot', 'leaf', 'mixed'])
    quality?: HarvestQuality;

    @ApiPropertyOptional({ description: 'Notes', maxLength: 300 })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    notes?: string;
}

export class UpdateHarvestDto {
    @ApiPropertyOptional({ description: 'Harvest date (YYYY-MM-DD)' })
    @IsOptional()
    @IsDateString()
    harvestDate?: string;

    @ApiPropertyOptional({ description: 'Amount in kg' })
    @IsOptional()
    @IsNumber()
    @Min(0.1)
    amountKg?: number;

    @ApiPropertyOptional({ description: 'Harvest quality', enum: ['shoot', 'leaf', 'mixed'] })
    @IsOptional()
    @IsEnum(['shoot', 'leaf', 'mixed'])
    quality?: HarvestQuality;

    @ApiPropertyOptional({ description: 'Notes', maxLength: 300 })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    notes?: string;
}

export class HarvestQueryDto {
    @ApiPropertyOptional({ description: 'Filter by field ID' })
    @IsOptional()
    @IsUUID()
    fieldId?: string;

    @ApiPropertyOptional({ description: 'Filter by year' })
    @IsOptional()
    @IsNumber()
    year?: number;

    @ApiPropertyOptional({ description: 'Start date filter' })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({ description: 'End date filter' })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({ description: 'Filter by status', enum: ['sold', 'partial', 'pending'] })
    @IsOptional()
    @IsString()
    status?: 'sold' | 'partial' | 'pending';

    @ApiPropertyOptional({ description: 'Sort field', enum: ['harvestDate', 'amountKg'] })
    @IsOptional()
    @IsString()
    sortBy?: 'harvestDate' | 'amountKg';

    @ApiPropertyOptional({ description: 'Sort order', enum: ['ASC', 'DESC'] })
    @IsOptional()
    @IsString()
    sortOrder?: 'ASC' | 'DESC';
}

export interface HarvestWithStatus {
    id: string;
    fieldId: string;
    fieldName: string;
    harvestDate: Date;
    amountKg: number;
    quality: HarvestQuality | null;
    notes: string | null;
    soldAmountKg: number;
    remainingKg: number;
    status: 'sold' | 'partial' | 'pending';
    createdAt: Date;
    updatedAt: Date;
}
