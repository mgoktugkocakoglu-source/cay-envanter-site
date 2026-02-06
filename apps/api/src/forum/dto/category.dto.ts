import { IsString, IsOptional, IsBoolean, IsInt, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
    @ApiProperty({ description: 'Category name', example: 'Genel Sohbet' })
    @IsString()
    @MaxLength(100)
    name: string;

    @ApiPropertyOptional({ description: 'Category description' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @ApiPropertyOptional({ description: 'Icon emoji or class', example: '💬' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    icon?: string;

    @ApiPropertyOptional({ description: 'Display order', default: 0 })
    @IsOptional()
    @IsInt()
    @Min(0)
    displayOrder?: number;
}

export class UpdateCategoryDto {
    @ApiPropertyOptional({ description: 'Category name' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @ApiPropertyOptional({ description: 'Category description' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @ApiPropertyOptional({ description: 'Icon emoji or class' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    icon?: string;

    @ApiPropertyOptional({ description: 'Display order' })
    @IsOptional()
    @IsInt()
    @Min(0)
    displayOrder?: number;

    @ApiPropertyOptional({ description: 'Is category active' })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class CategoryResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    slug: string;

    @ApiPropertyOptional()
    description: string | null;

    @ApiPropertyOptional()
    icon: string | null;

    @ApiProperty()
    displayOrder: number;

    @ApiProperty()
    isActive: boolean;

    @ApiProperty()
    topicCount?: number;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}
