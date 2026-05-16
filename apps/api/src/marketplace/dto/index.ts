import {
    ArrayMaxSize,
    IsArray,
    IsEnum,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
    MaxLength,
    Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    MarketplaceListingCategory,
    MarketplaceListingStatus,
} from '@/marketplace/enums/marketplace-listing.enum';

export class CreateMarketplaceListingDto {
    @ApiProperty({ enum: MarketplaceListingCategory })
    @IsEnum(MarketplaceListingCategory)
    category: MarketplaceListingCategory;

    @ApiProperty({ maxLength: 180 })
    @IsString()
    @MaxLength(180)
    title: string;

    @ApiProperty({ maxLength: 255 })
    @IsString()
    @MaxLength(255)
    location: string;

    @ApiProperty({ maxLength: 1200 })
    @IsString()
    @MaxLength(1200)
    description: string;

    @ApiProperty({ minimum: 1 })
    @IsInt()
    @Min(1)
    price: number;

    @ApiPropertyOptional({ description: 'Example: adet' })
    @IsOptional()
    @IsString()
    @MaxLength(30)
    priceUnit?: string | null;

    @ApiProperty({ maxLength: 100 })
    @IsString()
    @MaxLength(100)
    contactName: string;

    @ApiProperty({ maxLength: 25 })
    @IsString()
    @MaxLength(25)
    contactPhone: string;

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(6)
    @IsString({ each: true })
    imageUrls?: string[];

    @ApiPropertyOptional({ type: 'object' })
    @IsOptional()
    @IsObject()
    specs?: Record<string, any>;
}

export class UpdateMarketplaceListingDto {
    @ApiPropertyOptional({ enum: MarketplaceListingStatus })
    @IsOptional()
    @IsEnum(MarketplaceListingStatus)
    status?: MarketplaceListingStatus;

    @ApiPropertyOptional({ maxLength: 180 })
    @IsOptional()
    @IsString()
    @MaxLength(180)
    title?: string;

    @ApiPropertyOptional({ maxLength: 255 })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    location?: string;

    @ApiPropertyOptional({ maxLength: 1200 })
    @IsOptional()
    @IsString()
    @MaxLength(1200)
    description?: string;

    @ApiPropertyOptional({ minimum: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    price?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(30)
    priceUnit?: string | null;

    @ApiPropertyOptional({ maxLength: 100 })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    contactName?: string;

    @ApiPropertyOptional({ maxLength: 25 })
    @IsOptional()
    @IsString()
    @MaxLength(25)
    contactPhone?: string;

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(6)
    @IsString({ each: true })
    imageUrls?: string[];

    @ApiPropertyOptional({ type: 'object' })
    @IsOptional()
    @IsObject()
    specs?: Record<string, any>;
}

export class QueryMarketplaceListingDto {
    @ApiPropertyOptional({ enum: MarketplaceListingCategory })
    @IsOptional()
    @IsEnum(MarketplaceListingCategory)
    category?: MarketplaceListingCategory;

    @ApiPropertyOptional({ enum: MarketplaceListingStatus })
    @IsOptional()
    @IsEnum(MarketplaceListingStatus)
    status?: MarketplaceListingStatus;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;
}
