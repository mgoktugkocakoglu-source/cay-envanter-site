import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { FERTILISER_TYPES } from '@/tea-inventory/entities/fertilisation-record.entity';

export const ANOMALY_CLASSES = ['chemical_suspect', 'defoliation', 'stress', 'none', 'no_data'] as const;
export const YIELD_FLAGS = ['ok', 'low', 'high', 'no_license', 'no_data'] as const;

class HealthPageDto {
    @ApiPropertyOptional({ default: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 200 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    limit?: number = 20;

    @ApiPropertyOptional({ description: 'Growing season (year), e.g. 2026 (default: latest scanned)' })
    @IsOptional()
    @IsString()
    @MaxLength(4)
    season?: string;

    @ApiPropertyOptional({ description: 'Producer name / codes, garden code or "ada/parsel"' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    search?: string;
}

export class HealthSeasonQueryDto {
    @ApiPropertyOptional({ description: 'Growing season (year)' })
    @IsOptional()
    @IsString()
    @MaxLength(4)
    season?: string;
}

export class HealthGardenQueryDto extends HealthPageDto {
    @ApiPropertyOptional({ enum: ANOMALY_CLASSES })
    @IsOptional()
    @IsIn(ANOMALY_CLASSES)
    anomaly?: (typeof ANOMALY_CLASSES)[number];

    @ApiPropertyOptional({ description: 'TKGM locality (mevkii)' })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    locality?: string;
}

export class HealthProducerQueryDto extends HealthPageDto {
    @ApiPropertyOptional({ enum: YIELD_FLAGS })
    @IsOptional()
    @IsIn(YIELD_FLAGS)
    flag?: (typeof YIELD_FLAGS)[number];
}

/** A fertilisation / input record entered on the site. */
export class CreateFertilisationDto {
    @ApiProperty({ description: 'Garden code' })
    @IsString()
    @MaxLength(40)
    gardenCode: string;

    @ApiProperty({ description: 'Application date (YYYY-MM-DD)' })
    @IsISO8601({ strict: true })
    appliedAt: string;

    @ApiProperty({ enum: FERTILISER_TYPES })
    @IsIn(FERTILISER_TYPES)
    type: (typeof FERTILISER_TYPES)[number];

    @ApiPropertyOptional({ maxLength: 120 })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    product?: string;

    @ApiPropertyOptional({ description: 'kg per dekar' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1000)
    amountKgPerDa?: number;

    @ApiPropertyOptional({ maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    note?: string;

    @ApiPropertyOptional({ enum: ['producer', 'staff'], default: 'staff' })
    @IsOptional()
    @IsIn(['producer', 'staff'])
    source?: 'producer' | 'staff';
}
