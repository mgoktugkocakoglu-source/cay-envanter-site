import {
    IsString,
    IsNumber,
    IsOptional,
    IsDateString,
    IsEnum,
    IsBoolean,
    IsEmail,
    MaxLength,
    Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TeaQuality } from '@/firms/entities/firm-tariff.entity';

// ─── Firm DTOs ───

export class CreateFirmDto {
    @ApiProperty({ description: 'Firm name', maxLength: 150 })
    @IsString()
    @MaxLength(150)
    name: string;

    @ApiPropertyOptional({ description: 'Firm description' })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiPropertyOptional({ description: 'Logo URL' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    logoUrl?: string;

    @ApiPropertyOptional({ description: 'Phone number' })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    phone?: string;

    @ApiPropertyOptional({ description: 'Email address' })
    @IsOptional()
    @IsEmail()
    @MaxLength(255)
    email?: string;

    @ApiPropertyOptional({ description: 'Address' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    address?: string;

    @ApiPropertyOptional({ description: 'Active status', default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateFirmDto {
    @ApiPropertyOptional({ description: 'Firm name', maxLength: 150 })
    @IsOptional()
    @IsString()
    @MaxLength(150)
    name?: string;

    @ApiPropertyOptional({ description: 'Firm description' })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiPropertyOptional({ description: 'Logo URL' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    logoUrl?: string;

    @ApiPropertyOptional({ description: 'Phone number' })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    phone?: string;

    @ApiPropertyOptional({ description: 'Email address' })
    @IsOptional()
    @IsEmail()
    @MaxLength(255)
    email?: string;

    @ApiPropertyOptional({ description: 'Address' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    address?: string;

    @ApiPropertyOptional({ description: 'Active status' })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class FirmQueryDto {
    @ApiPropertyOptional({ description: 'Search by name' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ description: 'Filter by active status' })
    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    isActive?: boolean;
}

// ─── Tariff DTOs ───

export class CreateFirmTariffDto {
    @ApiProperty({ description: 'Tea quality type', enum: ['shoot', 'leaf', 'mixed'] })
    @IsEnum(['shoot', 'leaf', 'mixed'])
    quality: TeaQuality;

    @ApiProperty({ description: 'Price per kg in TL' })
    @IsNumber()
    @Min(0.01)
    pricePerKg: number;

    @ApiProperty({ description: 'Effective date (YYYY-MM-DD)' })
    @IsDateString()
    effectiveDate: string;

    @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)' })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({ description: 'Active status', default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateFirmTariffDto {
    @ApiPropertyOptional({ description: 'Tea quality type', enum: ['shoot', 'leaf', 'mixed'] })
    @IsOptional()
    @IsEnum(['shoot', 'leaf', 'mixed'])
    quality?: TeaQuality;

    @ApiPropertyOptional({ description: 'Price per kg in TL' })
    @IsOptional()
    @IsNumber()
    @Min(0.01)
    pricePerKg?: number;

    @ApiPropertyOptional({ description: 'Effective date (YYYY-MM-DD)' })
    @IsOptional()
    @IsDateString()
    effectiveDate?: string;

    @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)' })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({ description: 'Active status' })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

// ─── Collection Point DTOs ───

export class CreateFirmCollectionPointDto {
    @ApiProperty({ description: 'Collection point name', maxLength: 100 })
    @IsString()
    @MaxLength(100)
    name: string;

    @ApiProperty({ description: 'Province' })
    @IsString()
    @MaxLength(50)
    province: string;

    @ApiProperty({ description: 'District' })
    @IsString()
    @MaxLength(50)
    district: string;

    @ApiPropertyOptional({ description: 'Address' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    address?: string;

    @ApiPropertyOptional({ description: 'Latitude' })
    @IsOptional()
    @IsNumber()
    latitude?: number;

    @ApiPropertyOptional({ description: 'Longitude' })
    @IsOptional()
    @IsNumber()
    longitude?: number;

    @ApiPropertyOptional({ description: 'Collector name' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    collectorName?: string;

    @ApiPropertyOptional({ description: 'Collector phone' })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    collectorPhone?: string;

    @ApiPropertyOptional({ description: 'Active status', default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateFirmCollectionPointDto {
    @ApiPropertyOptional({ description: 'Collection point name', maxLength: 100 })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @ApiPropertyOptional({ description: 'Province' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    province?: string;

    @ApiPropertyOptional({ description: 'District' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    district?: string;

    @ApiPropertyOptional({ description: 'Address' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    address?: string;

    @ApiPropertyOptional({ description: 'Latitude' })
    @IsOptional()
    @IsNumber()
    latitude?: number;

    @ApiPropertyOptional({ description: 'Longitude' })
    @IsOptional()
    @IsNumber()
    longitude?: number;

    @ApiPropertyOptional({ description: 'Collector name' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    collectorName?: string;

    @ApiPropertyOptional({ description: 'Collector phone' })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    collectorPhone?: string;

    @ApiPropertyOptional({ description: 'Active status' })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class FirmCollectionPointQueryDto {
    @ApiPropertyOptional({ description: 'Filter by province' })
    @IsOptional()
    @IsString()
    province?: string;

    @ApiPropertyOptional({ description: 'Filter by district' })
    @IsOptional()
    @IsString()
    district?: string;
}

// ─── Response DTOs ───

export interface FirmWithCurrentTariffs {
    id: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
    isActive: boolean;
    currentTariffs: {
        quality: TeaQuality;
        pricePerKg: number;
        effectiveDate: Date;
    }[];
}
