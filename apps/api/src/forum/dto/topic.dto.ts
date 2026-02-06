import { IsString, IsOptional, IsUUID, IsInt, MaxLength, MinLength, IsEnum, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateTopicDto {
    @ApiProperty({ description: 'Category ID' })
    @IsUUID()
    categoryId: string;

    @ApiProperty({ description: 'Topic title', example: 'Çay hasadı ne zaman yapılmalı?' })
    @IsString()
    @MinLength(5)
    @MaxLength(200)
    title: string;

    @ApiProperty({ description: 'Topic content' })
    @IsString()
    @MinLength(20)
    @MaxLength(10000)
    content: string;
}

export class UpdateTopicDto {
    @ApiPropertyOptional({ description: 'Topic title' })
    @IsOptional()
    @IsString()
    @MinLength(5)
    @MaxLength(200)
    title?: string;

    @ApiPropertyOptional({ description: 'Topic content' })
    @IsOptional()
    @IsString()
    @MinLength(20)
    @MaxLength(10000)
    content?: string;

    @ApiPropertyOptional({ description: 'Category ID' })
    @IsOptional()
    @IsUUID()
    categoryId?: string;
}

export enum TopicSortBy {
    CREATED_AT = 'createdAt',
    UPDATED_AT = 'updatedAt',
    LAST_ACTIVITY = 'lastActivityAt',
    VIEW_COUNT = 'viewCount',
    REPLY_COUNT = 'replyCount',
}

export class TopicQueryDto {
    @ApiPropertyOptional({ description: 'Category ID filter' })
    @IsOptional()
    @IsUUID()
    categoryId?: string;

    @ApiPropertyOptional({ description: 'User ID filter' })
    @IsOptional()
    @IsUUID()
    userId?: string;

    @ApiPropertyOptional({ description: 'Solved topics only' })
    @IsOptional()
    @Transform(({ value }) => value === 'true')
    isSolved?: boolean;

    @ApiPropertyOptional({ description: 'Search query' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    search?: string;

    @ApiPropertyOptional({ enum: TopicSortBy, default: TopicSortBy.LAST_ACTIVITY })
    @IsOptional()
    @IsEnum(TopicSortBy)
    sortBy?: TopicSortBy;

    @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
    @IsOptional()
    @IsEnum(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC';

    @ApiPropertyOptional({ description: 'Page number', default: 1 })
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ description: 'Items per page', default: 20 })
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @Min(1)
    @Max(50)
    limit?: number;
}

export class TopicListItemDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    slug: string;

    @ApiProperty()
    viewCount: number;

    @ApiProperty()
    replyCount: number;

    @ApiProperty()
    isPinned: boolean;

    @ApiProperty()
    isLocked: boolean;

    @ApiProperty()
    isSolved: boolean;

    @ApiProperty()
    lastActivityAt: Date | null;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    user: {
        id: string;
        fullName: string;
    };

    @ApiProperty()
    category: {
        id: string;
        name: string;
        slug: string;
    };
}

export class TopicDetailDto extends TopicListItemDto {
    @ApiProperty()
    content: string;

    @ApiProperty()
    updatedAt: Date;
}

export class TopicListResponseDto {
    @ApiProperty({ type: [TopicListItemDto] })
    items: TopicListItemDto[];

    @ApiProperty()
    total: number;

    @ApiProperty()
    page: number;

    @ApiProperty()
    limit: number;

    @ApiProperty()
    totalPages: number;
}
