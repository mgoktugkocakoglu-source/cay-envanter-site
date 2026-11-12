import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AUDIT_DECISIONS, AUDIT_FLAGS } from '@/tea-inventory/entities/licence-audit.types';

/** `findings` = decisions against someone (licensing error, unlicensed tea, licence without tea); `attention` = findings plus review. */
export const AUDIT_DECISION_FILTERS = ['findings', 'attention', ...AUDIT_DECISIONS] as const;
export const AUDIT_CONFIDENCES = ['high', 'medium', 'low'] as const;

export class LicenceAuditQueryDto {
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

    @ApiPropertyOptional({ enum: AUDIT_DECISION_FILTERS, description: 'Decision filter' })
    @IsOptional()
    @IsIn(AUDIT_DECISION_FILTERS)
    decision?: (typeof AUDIT_DECISION_FILTERS)[number];

    @ApiPropertyOptional({ enum: AUDIT_CONFIDENCES })
    @IsOptional()
    @IsIn(AUDIT_CONFIDENCES)
    confidence?: (typeof AUDIT_CONFIDENCES)[number];

    @ApiPropertyOptional({ enum: AUDIT_FLAGS, description: 'Only parcels carrying this flag' })
    @IsOptional()
    @IsIn(AUDIT_FLAGS)
    flag?: (typeof AUDIT_FLAGS)[number];

    @ApiPropertyOptional({ description: 'Block/parcel ("227/5"), deed title or locality' })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    search?: string;
}

/** Visual alignment of the KML outline with the imagery under it; the cadastral geometry itself never moves. */
export class LicenceAuditKmlQueryDto {
    @ApiPropertyOptional({ description: 'Shift of the aligned copy to the east, metres', minimum: -50, maximum: 50 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(-50)
    @Max(50)
    east?: number;

    @ApiPropertyOptional({ description: 'Shift of the aligned copy to the north, metres', minimum: -50, maximum: 50 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(-50)
    @Max(50)
    north?: number;
}
