import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AKK_CLASSES, CROP_KEYS, EROSION_CLASSES, LAW5403_CLASSES, MISMATCH_FLAGS, OBSERVED_USES } from '@/tea-inventory/entities/land-evaluation.types';

export class LandParcelQueryDto {
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

    @ApiPropertyOptional({ enum: AKK_CLASSES })
    @IsOptional()
    @IsIn(AKK_CLASSES)
    akk?: string;

    @ApiPropertyOptional({ enum: LAW5403_CLASSES })
    @IsOptional()
    @IsIn(LAW5403_CLASSES)
    law5403?: string;

    @ApiPropertyOptional({ enum: OBSERVED_USES })
    @IsOptional()
    @IsIn(OBSERVED_USES)
    observed?: string;

    @ApiPropertyOptional({ enum: EROSION_CLASSES })
    @IsOptional()
    @IsIn(EROSION_CLASSES)
    erosion?: string;

    @ApiPropertyOptional({ enum: MISMATCH_FLAGS })
    @IsOptional()
    @IsIn(MISMATCH_FLAGS)
    mismatch?: string;

    @ApiPropertyOptional({ enum: CROP_KEYS, description: 'Sort by this crop’s suitability score (desc)' })
    @IsOptional()
    @IsIn(CROP_KEYS)
    crop?: string;
}

export class LandLayerQueryDto {
    @ApiPropertyOptional({ enum: ['akk', 'law5403', 'observed', 'erosion', 'mismatch', 'suitability'], default: 'akk' })
    @IsOptional()
    @IsIn(['akk', 'law5403', 'observed', 'erosion', 'mismatch', 'suitability'])
    by?: string = 'akk';

    @ApiPropertyOptional({ enum: CROP_KEYS, description: 'Crop for the suitability layer' })
    @IsOptional()
    @IsIn(CROP_KEYS)
    crop?: string;
}
