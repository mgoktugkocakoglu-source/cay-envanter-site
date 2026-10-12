import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Effective producer status: an expert decision when there is one, otherwise the satellite status. */
export const PRODUCER_STATUSES = [
    'auto_approved',
    'approved',
    'rejected',
    'expert_review',
    'partial',
    'no_trace',
    'awaiting_observation',
] as const;
export type ProducerStatus = (typeof PRODUCER_STATUSES)[number];

export const PRODUCER_SORT_KEYS = ['ratio', 'name', 'teaArea', 'gardens'] as const;
export type ProducerSortKey = (typeof PRODUCER_SORT_KEYS)[number];

/** Query params for the producers of an inventoried area. */
export class ProducerQueryDto {
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

    @ApiPropertyOptional({ enum: PRODUCER_STATUSES })
    @IsOptional()
    @IsIn(PRODUCER_STATUSES)
    status?: ProducerStatus;

    @ApiPropertyOptional({ description: 'Name, wallet no or license no' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    search?: string;

    @ApiPropertyOptional({ enum: PRODUCER_SORT_KEYS, default: 'ratio' })
    @IsOptional()
    @IsIn(PRODUCER_SORT_KEYS)
    sortBy?: ProducerSortKey = 'ratio';

    @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'ASC' })
    @IsOptional()
    @IsIn(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC' = 'ASC';
}

/** Query params for the purchase list (producers ÇAYKUR may buy from this season). */
export class PurchaseListQueryDto {
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
}

/** An expert's pruning decision for a producer. */
export class PruningDecisionDto {
    @ApiProperty({ enum: ['approved', 'rejected'] })
    @IsIn(['approved', 'rejected'])
    decision: 'approved' | 'rejected';

    @ApiPropertyOptional({ description: 'Reason or field note (required in practice for a rejection)', maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    note?: string;
}
