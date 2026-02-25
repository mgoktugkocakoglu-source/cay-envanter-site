import { IsEnum, IsOptional, IsString, MaxLength, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostType } from '@/community/entities';

export class CreatePostDto {
    @ApiPropertyOptional({ description: 'Post text content', maxLength: 2000 })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    content?: string;

    @ApiProperty({ description: 'Post type', enum: PostType, default: PostType.TEXT })
    @IsEnum(PostType)
    type: PostType;

    @ApiPropertyOptional({ description: 'Array of uploaded media URLs', type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    mediaUrls?: string[];

    @ApiPropertyOptional({ description: 'Tag names to attach', type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tagNames?: string[];
}
