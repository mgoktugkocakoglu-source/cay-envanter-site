import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const FUSION_CLASSES = ['pruned', 'likely', 'unclear', 'not_pruned', 'no_data'] as const;
export const PRODUCER_FUSION_STATUSES = ['pruned_full', 'pruned_partial', 'none', 'unclear', 'no_license', 'no_data'] as const;
export const FUSION_DECISIONS = ['auto_open', 'auto_pending', 'auto_short', 'auto_none', 'expert_anomaly', 'no_license', 'no_data'] as const;

class FusionPageDto {
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

    @ApiPropertyOptional({ description: 'Producer name, producer / wallet / licence code, garden code or "ada/parsel"' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    search?: string;
}

/** Query params for the fusion garden list. */
export class FusionGardenQueryDto extends FusionPageDto {
    @ApiPropertyOptional({ enum: FUSION_CLASSES })
    @IsOptional()
    @IsIn(FUSION_CLASSES)
    class?: (typeof FUSION_CLASSES)[number];

    @ApiPropertyOptional({ description: 'TKGM locality (mevkii)' })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    locality?: string;
}

/** Query params for the fusion producer list ("who pruned"). */
export class FusionProducerQueryDto extends FusionPageDto {
    @ApiPropertyOptional({ enum: PRODUCER_FUSION_STATUSES })
    @IsOptional()
    @IsIn(PRODUCER_FUSION_STATUSES)
    status?: (typeof PRODUCER_FUSION_STATUSES)[number];

    @ApiPropertyOptional({ enum: FUSION_DECISIONS, description: 'Purchase decision of the policy (auto / expert anomaly)' })
    @IsOptional()
    @IsIn(FUSION_DECISIONS)
    decision?: (typeof FUSION_DECISIONS)[number];
}
