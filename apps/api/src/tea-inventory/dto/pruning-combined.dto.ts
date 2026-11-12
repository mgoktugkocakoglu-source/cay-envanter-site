import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** `positive` = confirmed, probable or light; `counted` = confirmed or probable (credited toward the 1/7); `doubtful` = a detection the retrospective check does not support. */
export const COMBINED_CLASS_FILTERS = ['positive', 'counted', 'confirmed', 'probable', 'light', 'seasonal', 'none', 'no_data', 'doubtful', 'recent'] as const;
/** `open` = target met (with or without probable area); `changed` = differs from the fusion purchase decision. */
export const COMBINED_PRODUCER_FILTERS = ['active', 'open', 'changed', 'met', 'met_with_probable', 'partial', 'light_only', 'none', 'no_license', 'behind'] as const;

export class CombinedQueryDto {
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

    @ApiPropertyOptional({ description: 'Pruning season, e.g. 2025-26 (default: latest combined)' })
    @IsOptional()
    @IsString()
    @MaxLength(10)
    season?: string;
}

export class CombinedGardenQueryDto extends CombinedQueryDto {
    @ApiPropertyOptional({ enum: COMBINED_CLASS_FILTERS, description: 'Combined class filter' })
    @IsOptional()
    @IsIn(COMBINED_CLASS_FILTERS)
    class?: (typeof COMBINED_CLASS_FILTERS)[number];
}

export class CombinedWorklistQueryDto extends CombinedQueryDto {
    @ApiPropertyOptional({ description: 'Only gardens without a ground label yet', enum: ['true', 'false'] })
    @IsOptional()
    @IsIn(['true', 'false'])
    pending?: string;
}

export class CombinedProducerQueryDto extends CombinedQueryDto {
    @ApiPropertyOptional({ enum: COMBINED_PRODUCER_FILTERS, description: 'Producer status filter' })
    @IsOptional()
    @IsIn(COMBINED_PRODUCER_FILTERS)
    status?: (typeof COMBINED_PRODUCER_FILTERS)[number];
}
