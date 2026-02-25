import { IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CommunityReactionTargetType, CommunityReactionType } from '@/community/entities';

export class ToggleReactionDto {
    @ApiProperty({ description: 'Target type', enum: CommunityReactionTargetType })
    @IsEnum(CommunityReactionTargetType)
    targetType: CommunityReactionTargetType;

    @ApiProperty({ description: 'Target entity ID (post or comment UUID)' })
    @IsUUID()
    targetId: string;

    @ApiProperty({ description: 'Reaction type', enum: CommunityReactionType })
    @IsEnum(CommunityReactionType)
    reactionType: CommunityReactionType;
}
