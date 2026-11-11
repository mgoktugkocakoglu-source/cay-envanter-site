import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** `found` = every garden with a cluster of any class; `counted` = deep, light or pending. */
export const PIXEL_VERDICT_FILTERS = ['found', 'counted', 'deep', 'light', 'pending', 'transient', 'weak', 'none', 'no_data'] as const;

export class PixelScanGardenQueryDto {
    @ApiPropertyOptional({ default: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @ApiPropertyOptional({ description: 'Pruning season, e.g. 2025-26 (default: latest scanned)' })
    @IsOptional()
    @IsString()
    @MaxLength(10)
    season?: string;

    @ApiPropertyOptional({ enum: PIXEL_VERDICT_FILTERS, description: 'Pixel verdict filter' })
    @IsOptional()
    @IsIn(PIXEL_VERDICT_FILTERS)
    verdict?: (typeof PIXEL_VERDICT_FILTERS)[number];

    @ApiPropertyOptional({ description: 'Only gardens the multi-sensor verdict left at unclear / not pruned' })
    @IsOptional()
    @IsIn(['true', 'false'])
    newOnly?: 'true' | 'false';
}
