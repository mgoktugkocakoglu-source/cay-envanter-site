import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CALIBRATION_LABEL_VALUES, CALIBRATION_METHODS } from '@/tea-inventory/entities/calibration-label.entity';

/** Query params of the calibration plan / labels / metrics endpoints. */
export class CalibrationQueryDto {
    @ApiPropertyOptional({ description: 'Pruning season, e.g. 2025-26 (default: latest scanned)' })
    @IsOptional()
    @IsString()
    @MaxLength(10)
    season?: string;

    @ApiPropertyOptional({ description: 'Target number of gardens in the field plan', default: 240, minimum: 20, maximum: 1000 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(20)
    @Max(1000)
    size?: number;

    @ApiPropertyOptional({ description: 'Only gardens not labelled yet' })
    @IsOptional()
    @IsIn(['true', 'false'])
    pending?: string;

    @ApiPropertyOptional({ description: 'TKGM locality (mevkii)' })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    locality?: string;

    @ApiPropertyOptional({ default: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 500 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(500)
    limit?: number = 50;
}

/** A ground-truth label saved from the field form (one per garden and season). */
export class SaveCalibrationLabelDto {
    @ApiProperty({ description: 'Pruning season, e.g. 2025-26' })
    @IsString()
    @MaxLength(10)
    season: string;

    @ApiProperty({ description: 'Garden code ("DEMO-B-0001") or free patch id ("free-001")' })
    @IsString()
    @MaxLength(40)
    gardenCode: string;

    @ApiProperty({ enum: CALIBRATION_LABEL_VALUES })
    @IsIn(CALIBRATION_LABEL_VALUES)
    label: (typeof CALIBRATION_LABEL_VALUES)[number];

    @ApiPropertyOptional({ enum: CALIBRATION_METHODS, default: 'field_visit' })
    @IsOptional()
    @IsIn(CALIBRATION_METHODS)
    method?: (typeof CALIBRATION_METHODS)[number];

    @ApiProperty({ description: 'Day the garden was looked at (YYYY-MM-DD)' })
    @IsISO8601({ strict: true })
    observedAt: string;

    @ApiPropertyOptional({ description: 'Observer latitude (browser geolocation)' })
    @IsOptional()
    @IsNumber()
    @Min(-90)
    @Max(90)
    lat?: number;

    @ApiPropertyOptional({ description: 'Observer longitude' })
    @IsOptional()
    @IsNumber()
    @Min(-180)
    @Max(180)
    lng?: number;

    @ApiPropertyOptional({ description: 'Geolocation accuracy in metres' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    accuracyM?: number;

    @ApiPropertyOptional({ description: 'Estimated pruned share of the garden (0–1)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    prunedShare?: number;

    @ApiPropertyOptional({ maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    note?: string;
}
