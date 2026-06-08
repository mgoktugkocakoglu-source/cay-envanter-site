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
    Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AreaUnit } from '@/fields/entities/field.entity';

export class CreateFieldPartnerDto {
    @ApiProperty({ description: 'Partner name', maxLength: 100 })
    @IsString()
    @MaxLength(100)
    partnerName: string;

    @ApiPropertyOptional({ description: 'Partner phone number' })
    @IsOptional()
    @IsString()
    @Matches(/^(5)[0-9]{9}$/, { message: 'Telefon numarası 5XXXXXXXXX formatında olmalıdır' })
    partnerPhone?: string | null;

    @ApiPropertyOptional({ description: 'Partner Turkish identity number' })
    @IsOptional()
    @IsString()
    @Matches(/^[0-9]{11}$/, { message: 'TC kimlik numarası 11 haneli olmalıdır' })
    partnerIdentityNumber?: string | null;

    @ApiPropertyOptional({ description: 'Share percentage kept for legacy records', minimum: 0, maximum: 100 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    sharePercentage?: number;

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

    @ApiPropertyOptional({ description: 'Road/street name from cadastre address data' })
    @IsOptional()
    @IsString()
    @MaxLength(150)
    road?: string;

    @ApiPropertyOptional({ description: 'Parcel number from cadastre' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    parcelNo?: string;

    @ApiPropertyOptional({ description: 'Block (ada) number from cadastre' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    adaNo?: string;

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

    @ApiPropertyOptional({ description: 'Partner phone number' })
    @IsOptional()
    @IsString()
    @Matches(/^(5)[0-9]{9}$/, { message: 'Telefon numarası 5XXXXXXXXX formatında olmalıdır' })
    partnerPhone?: string | null;

    @ApiPropertyOptional({ description: 'Partner Turkish identity number' })
    @IsOptional()
    @IsString()
    @Matches(/^[0-9]{11}$/, { message: 'TC kimlik numarası 11 haneli olmalıdır' })
    partnerIdentityNumber?: string | null;

    @ApiPropertyOptional({ description: 'Share percentage kept for legacy records' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    sharePercentage?: number;

    @ApiPropertyOptional({ description: 'Partner invitation status', enum: ['pending', 'accepted', 'rejected'] })
    @IsOptional()
    @IsEnum(['pending', 'accepted', 'rejected'])
    invitationStatus?: 'pending' | 'accepted' | 'rejected';

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
