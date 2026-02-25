import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PostType } from '@/community/entities';

export class PostQueryDto {
    @ApiPropertyOptional({ description: 'Cursor for pagination (post ID)' })
    @IsOptional()
    @IsString()
    cursor?: string;

    @ApiPropertyOptional({ description: 'Number of posts per page', default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 20;

    @ApiPropertyOptional({ description: 'Filter by post type', enum: PostType })
    @IsOptional()
    @IsEnum(PostType)
    type?: PostType;

    @ApiPropertyOptional({ description: 'Filter by tag name' })
    @IsOptional()
    @IsString()
    tag?: string;

    @ApiPropertyOptional({ description: 'Filter by user ID' })
    @IsOptional()
    @IsString()
    userId?: string;

    @ApiPropertyOptional({ description: 'Search keyword in post content' })
    @IsOptional()
    @IsString()
    search?: string;
}
