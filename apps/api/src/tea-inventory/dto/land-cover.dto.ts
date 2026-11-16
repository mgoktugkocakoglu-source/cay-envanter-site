import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { COVER_DOMINANT, COVER_TEA_STATES } from '@/tea-inventory/entities/land-cover.types';

export class LandCoverQueryDto {
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

    @ApiPropertyOptional({ enum: COVER_TEA_STATES, description: 'Tea reading of the parcel' })
    @IsOptional()
    @IsIn(COVER_TEA_STATES)
    tea?: (typeof COVER_TEA_STATES)[number];

    @ApiPropertyOptional({ enum: COVER_DOMINANT, description: 'Dominant cover of the parcel' })
    @IsOptional()
    @IsIn(COVER_DOMINANT)
    dominant?: (typeof COVER_DOMINANT)[number];

    @ApiPropertyOptional({ description: 'Block/parcel ("106/23"), deed title or locality' })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    search?: string;
}
