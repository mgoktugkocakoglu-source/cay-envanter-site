import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDateString,
    IsIn,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

export const FIELD_OWNERSHIP_FILTERS = ['all', 'shared', 'partnered', 'single'] as const;
export type FieldOwnershipFilter = (typeof FIELD_OWNERSHIP_FILTERS)[number];

export const FIELD_SORT_KEYS = ['createdAt', 'name', 'area', 'province', 'owner', 'parcel'] as const;
export type FieldSortKey = (typeof FIELD_SORT_KEYS)[number];

/** Query params for the Çaykur panel field (parcel) registry. */
export class CaykurFieldQueryDto {
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

    @ApiPropertyOptional({ description: 'Free text: field name, owner, partner, ada/parcel, neighborhood' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    search?: string;

    @ApiPropertyOptional({ description: 'Exact province name' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    province?: string;

    @ApiPropertyOptional({ description: 'Exact district name' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    district?: string;

    @ApiPropertyOptional({ description: 'Neighborhood (case-insensitive contains)' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    neighborhood?: string;

    @ApiPropertyOptional({ description: 'Exact cadastral block (ada) number' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    adaNo?: string;

    @ApiPropertyOptional({ description: 'Exact cadastral parcel number' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    parcelNo?: string;

    @ApiPropertyOptional({
        enum: FIELD_OWNERSHIP_FILTERS,
        default: 'all',
        description:
            'shared: same province + ada + parcel registered by more than one user; ' +
            'partnered: field has declared partners; single: neither',
    })
    @IsOptional()
    @IsIn(FIELD_OWNERSHIP_FILTERS)
    ownership?: FieldOwnershipFilter = 'all';

    @ApiPropertyOptional({ description: 'Minimum area in dekar (inclusive)' })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    minAreaDekar?: number;

    @ApiPropertyOptional({ description: 'Maximum area in dekar (inclusive)' })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    maxAreaDekar?: number;

    @ApiPropertyOptional({ description: 'Registered on or after (ISO date)' })
    @IsOptional()
    @IsDateString()
    createdFrom?: string;

    @ApiPropertyOptional({ description: 'Registered on or before (ISO date)' })
    @IsOptional()
    @IsDateString()
    createdTo?: string;

    @ApiPropertyOptional({ enum: FIELD_SORT_KEYS, default: 'createdAt' })
    @IsOptional()
    @IsIn(FIELD_SORT_KEYS)
    sortBy?: FieldSortKey = 'createdAt';

    @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
    @IsOptional()
    @IsIn(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
