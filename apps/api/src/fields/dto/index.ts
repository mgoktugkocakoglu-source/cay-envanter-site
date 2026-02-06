import {
    IsString,
    IsNumber,
    IsOptional,
    IsArray,
    IsEnum,
    MaxLength,
    Min,
    Max,
    ValidateNested,
    ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AreaUnit } from '@/fields/entities/field.entity';

export class CreateFieldPartnerDto {
    @ApiProperty({ description: 'Partner name', maxLength: 100 })
    @IsString()
    @MaxLength(100)
    partnerName: string;

    @ApiProperty({ description: 'Share percentage (0-100)', minimum: 0, maximum: 100 })
    @IsNumber()
    @Min(0.01)
    @Max(100)
    sharePercentage: number;

    @ApiProperty({ description: 'Is primary owner', default: false })
    @IsOptional()
    isPrimaryOwner?: boolean;
}

export class CreateFieldDto {
    @ApiProperty({ description: 'Field name', maxLength: 50 })
    @IsString()
    @MaxLength(50)
    name: string;

    @ApiProperty({ description: 'Province name' })
    @IsString()
    @MaxLength(50)
    province: string;

    @ApiProperty({ description: 'District name' })
    @IsString()
    @MaxLength(50)
    district: string;

    @ApiProperty({ description: 'Neighborhood/road name' })
    @IsString()
    @MaxLength(100)
    neighborhood: string;

    @ApiPropertyOptional({ description: 'Parcel number from cadastre' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    parcelNo?: string;

    @ApiProperty({ description: 'Polygon coordinates in GeoJSON format' })
    @IsArray()
    coordinates: number[][][];

    @ApiProperty({ description: 'Area size' })
    @IsNumber()
    @Min(0.01)
    area: number;

    @ApiProperty({ description: 'Area unit', enum: ['donum', 'dekar', 'm2'] })
    @IsEnum(['donum', 'dekar', 'm2'])
    areaUnit: AreaUnit;

    @ApiPropertyOptional({ description: 'Notes', maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    notes?: string;

    @ApiPropertyOptional({ description: 'Partners list', type: [CreateFieldPartnerDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateFieldPartnerDto)
    partners?: CreateFieldPartnerDto[];
}

export class UpdateFieldDto {
    @ApiPropertyOptional({ description: 'Field name', maxLength: 50 })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    name?: string;

    @ApiPropertyOptional({ description: 'Area size' })
    @IsOptional()
    @IsNumber()
    @Min(0.01)
    area?: number;

    @ApiPropertyOptional({ description: 'Area unit', enum: ['donum', 'dekar', 'm2'] })
    @IsOptional()
    @IsEnum(['donum', 'dekar', 'm2'])
    areaUnit?: AreaUnit;

    @ApiPropertyOptional({ description: 'Notes', maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    notes?: string;
}

export class UpdateFieldPartnerDto {
    @ApiPropertyOptional({ description: 'Partner name', maxLength: 100 })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    partnerName?: string;

    @ApiPropertyOptional({ description: 'Share percentage (0-100)' })
    @IsOptional()
    @IsNumber()
    @Min(0.01)
    @Max(100)
    sharePercentage?: number;

    @ApiPropertyOptional({ description: 'Is primary owner' })
    @IsOptional()
    isPrimaryOwner?: boolean;
}

export class FieldQueryDto {
    @ApiPropertyOptional({ description: 'Filter by province' })
    @IsOptional()
    @IsString()
    province?: string;

    @ApiPropertyOptional({ description: 'Search by name' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ description: 'Sort field', enum: ['name', 'area', 'createdAt'] })
    @IsOptional()
    @IsString()
    sortBy?: 'name' | 'area' | 'createdAt';

    @ApiPropertyOptional({ description: 'Sort order', enum: ['ASC', 'DESC'] })
    @IsOptional()
    @IsString()
    sortOrder?: 'ASC' | 'DESC';
}
