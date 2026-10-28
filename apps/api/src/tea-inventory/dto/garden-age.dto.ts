import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ABANDON_CLASSES, ACTIVITY_CLASSES, AGE_CLASSES, PRIORITY_CLASSES } from '@/tea-inventory/entities/garden-age.types';

export class GardenAgeParcelQueryDto {
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

    @ApiPropertyOptional({ description: 'Block/parcel or deed title text' })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    search?: string;

    @ApiPropertyOptional({ enum: AGE_CLASSES })
    @IsOptional()
    @IsIn(AGE_CLASSES)
    ageClass?: string;

    @ApiPropertyOptional({ enum: ACTIVITY_CLASSES })
    @IsOptional()
    @IsIn(ACTIVITY_CLASSES)
    activity?: string;

    @ApiPropertyOptional({ enum: ABANDON_CLASSES })
    @IsOptional()
    @IsIn(ABANDON_CLASSES)
    abandonment?: string;

    @ApiPropertyOptional({ enum: PRIORITY_CLASSES })
    @IsOptional()
    @IsIn(PRIORITY_CLASSES)
    priority?: string;

    @ApiPropertyOptional({ enum: ['priority', 'age', 'abandonment', 'parcel'], default: 'priority' })
    @IsOptional()
    @IsIn(['priority', 'age', 'abandonment', 'parcel'])
    sort?: string = 'priority';
}

export class GardenAgeLayerQueryDto {
    @ApiPropertyOptional({ enum: ['ageClass', 'activity', 'abandonment', 'priority'], default: 'priority' })
    @IsOptional()
    @IsIn(['ageClass', 'activity', 'abandonment', 'priority'])
    by?: string = 'priority';
}
