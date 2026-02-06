import { IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReactionTargetType, ReactionType } from '@/forum/entities';

export class CreateReactionDto {
    @ApiProperty({ enum: ReactionTargetType })
    @IsEnum(ReactionTargetType)
    targetType: ReactionTargetType;

    @ApiProperty({ description: 'Topic or Reply ID' })
    @IsUUID()
    targetId: string;

    @ApiProperty({ enum: ReactionType })
    @IsEnum(ReactionType)
    reactionType: ReactionType;
}

export class ReactionStatsDto {
    @ApiProperty()
    likeCount: number;

    @ApiProperty()
    helpfulCount: number;

    @ApiProperty()
    thanksCount: number;

    @ApiProperty({ description: 'Current user reactions', type: [String] })
    userReactions: ReactionType[];
}
