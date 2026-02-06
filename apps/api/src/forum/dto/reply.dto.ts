import { IsString, IsOptional, IsUUID, MaxLength, MinLength, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateReplyDto {
    @ApiProperty({ description: 'Reply content' })
    @IsString()
    @MinLength(5)
    @MaxLength(5000)
    content: string;

    @ApiPropertyOptional({ description: 'Parent reply ID for nested replies' })
    @IsOptional()
    @IsUUID()
    parentReplyId?: string;
}

export class UpdateReplyDto {
    @ApiProperty({ description: 'Reply content' })
    @IsString()
    @MinLength(5)
    @MaxLength(5000)
    content: string;
}

export class ReplyQueryDto {
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

export class ReplyResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    content: string;

    @ApiProperty()
    isSolution: boolean;

    @ApiPropertyOptional()
    parentReplyId: string | null;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    @ApiProperty()
    user: {
        id: string;
        fullName: string;
    };

    @ApiPropertyOptional({ type: [ReplyResponseDto] })
    childReplies?: ReplyResponseDto[];
}

export class ReplyListResponseDto {
    @ApiProperty({ type: [ReplyResponseDto] })
    items: ReplyResponseDto[];

    @ApiProperty()
    total: number;

    @ApiProperty()
    page: number;

    @ApiProperty()
    limit: number;

    @ApiProperty()
    totalPages: number;
}
