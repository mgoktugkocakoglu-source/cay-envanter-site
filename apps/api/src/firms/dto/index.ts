import {
    IsString,
    IsNumber,
    IsOptional,
    IsDateString,
    IsEnum,
    IsBoolean,
    IsEmail,
    IsArray,
    ValidateNested,
    MaxLength,
    Min,
    Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaymentTerm } from '@/firms/entities/firm-tariff.entity';

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

// ─── Tariff Split Detail ───

export class TariffSplitDetailDto {
    @ApiProperty({ description: 'Percentage of this split (e.g. 50)' })
    @IsNumber()
    @Min(1)
    @Max(100)
    percentage: number;

    @ApiProperty({ description: 'Payment term for this split', enum: ['cash', 'weekly', 'monthly', 'custom'] })
    @IsEnum(['cash', 'weekly', 'monthly', 'custom'])
    paymentTerm: PaymentTerm;

    @ApiPropertyOptional({ description: 'Deferred months (e.g. 2 for "2 ay sonra")' })
    @IsOptional()
    @IsNumber()
    @Min(1)
    deferredMonths?: number;

    @ApiPropertyOptional({ description: 'Custom payment date (YYYY-MM-DD)' })
    @IsOptional()
    @IsDateString()
    customPaymentDate?: string;

    @ApiProperty({ description: 'Price per kg in TL for this split' })
    @IsNumber()
    @Min(0.01)
    pricePerKg: number;
}

// ─── Tariff DTOs ───

export class CreateFirmTariffDto {
    @ApiProperty({ description: 'Payment term', enum: ['cash', 'weekly', 'monthly', 'custom'] })
    @IsEnum(['cash', 'weekly', 'monthly', 'custom'])
    paymentTerm: PaymentTerm;

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

    @ApiPropertyOptional({ description: 'Custom payment date (YYYY-MM-DD), used when paymentTerm is custom' })
    @IsOptional()
    @IsDateString()
    customPaymentDate?: string;

    @ApiPropertyOptional({ description: 'Whether this is a split payment', default: false })
    @IsOptional()
    @IsBoolean()
    isSplitPayment?: boolean;

    @ApiPropertyOptional({ description: 'Split payment details', type: [TariffSplitDetailDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TariffSplitDetailDto)
    splitDetails?: TariffSplitDetailDto[];

    @ApiPropertyOptional({ description: 'Active status', default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateFirmTariffDto {
    @ApiPropertyOptional({ description: 'Payment term', enum: ['cash', 'weekly', 'monthly', 'custom'] })
    @IsOptional()
    @IsEnum(['cash', 'weekly', 'monthly', 'custom'])
    paymentTerm?: PaymentTerm;

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

    @ApiPropertyOptional({ description: 'Custom payment date (YYYY-MM-DD)' })
    @IsOptional()
    @IsDateString()
    customPaymentDate?: string;

    @ApiPropertyOptional({ description: 'Whether this is a split payment' })
    @IsOptional()
    @IsBoolean()
    isSplitPayment?: boolean;

    @ApiPropertyOptional({ description: 'Split payment details', type: [TariffSplitDetailDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TariffSplitDetailDto)
    splitDetails?: TariffSplitDetailDto[];

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

    @ApiPropertyOptional({ description: 'Description for users (e.g. landmark info)' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

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

    @ApiPropertyOptional({ description: 'Description for users' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

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
        paymentTerm: PaymentTerm;
        pricePerKg: number;
        effectiveDate: Date;
        isSplitPayment: boolean;
        splitDetails: {
            percentage: number;
            paymentTerm: PaymentTerm;
            deferredMonths?: number;
            pricePerKg: number;
        }[] | null;
    }[];
}
