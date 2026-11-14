import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { DRONE_CLASSES } from '@/tea-inventory/entities/drone-verification.types';

/** Image classes plus `not_analysed` (parcels no drone source covers yet) and `analysed` (any of the four classes). */
export const DRONE_CLASS_FILTERS = ['analysed', 'not_analysed', ...DRONE_CLASSES] as const;

export class DroneVerificationQueryDto {
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

    @ApiPropertyOptional({ enum: DRONE_CLASS_FILTERS, description: 'Image class filter' })
    @IsOptional()
    @IsIn(DRONE_CLASS_FILTERS)
    class?: (typeof DRONE_CLASS_FILTERS)[number];

    @ApiPropertyOptional({ description: 'Block/parcel ("106/23"), deed title or locality' })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    search?: string;
}
