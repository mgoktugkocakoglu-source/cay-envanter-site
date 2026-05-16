import {
    ArrayMaxSize,
    IsArray,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    IsUrl,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EquipmentCategory, EquipmentStatus, EquipmentUsageStatus } from '@/equipment/enums/equipment.enum';

export class EquipmentSpecDto {
    @ApiProperty({ maxLength: 80 })
    @IsString()
    @MaxLength(80)
    label: string;

    @ApiProperty({ maxLength: 120 })
    @IsString()
    @MaxLength(120)
    value: string;
}

export class CreateEquipmentDto {
    @ApiProperty({ enum: EquipmentCategory })
    @IsEnum(EquipmentCategory)
    category: EquipmentCategory;

    @ApiProperty({ maxLength: 120 })
    @IsString()
    @MaxLength(120)
    brand: string;

    @ApiProperty({ maxLength: 120 })
    @IsString()
    @MaxLength(120)
    model: string;

    @ApiProperty({ maxLength: 180 })
    @IsString()
    @MaxLength(180)
    typeLabel: string;

    @ApiProperty({ minimum: 1 })
    @IsInt()
    @Min(1)
    price: number;

    @ApiPropertyOptional({ minimum: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    segmentAverage?: number | null;

    @ApiPropertyOptional({ maxLength: 600 })
    @IsOptional()
    @IsUrl({ require_tld: false })
    @MaxLength(600)
    imageUrl?: string | null;

    @ApiPropertyOptional({ type: [EquipmentSpecDto] })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => EquipmentSpecDto)
    specs?: EquipmentSpecDto[];
}

export class QueryEquipmentDto {
    @ApiPropertyOptional({ enum: EquipmentCategory })
    @IsOptional()
    @IsEnum(EquipmentCategory)
    category?: EquipmentCategory;

    @ApiPropertyOptional({ enum: EquipmentStatus })
    @IsOptional()
    @IsEnum(EquipmentStatus)
    status?: EquipmentStatus;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;
}

export class CreateEquipmentReviewDto {
    @ApiProperty({ minimum: 1, maximum: 5 })
    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    @ApiProperty({ enum: EquipmentUsageStatus })
    @IsEnum(EquipmentUsageStatus)
    usageStatus: EquipmentUsageStatus;

    @ApiProperty({ minimum: 1, maximum: 600 })
    @IsInt()
    @Min(1)
    @Max(600)
    usageMonths: number;

    @ApiProperty({ minLength: 12, maxLength: 1200 })
    @IsString()
    @MinLength(12)
    @MaxLength(1200)
    text: string;
}
