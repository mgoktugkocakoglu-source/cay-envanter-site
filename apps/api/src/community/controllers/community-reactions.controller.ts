import {
    Controller,
    Post,
    Body,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/auth/decorators';
import { CommunityReactionsService } from '@/community/services';
import { ToggleReactionDto } from '@/community/dto';

@ApiTags('Community Reactions')
@Controller('community/reactions')
export class CommunityReactionsController {
    constructor(private readonly reactionsService: CommunityReactionsService) { }

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Toggle a reaction (like/dislike) on a post or comment' })
    @ApiResponse({ status: 200, description: 'Reaction toggled' })
    async toggleReaction(
        @CurrentUser() authUser: AuthenticatedUser,
        @Body() dto: ToggleReactionDto,
    ) {
        return this.reactionsService.toggleReaction(authUser.id, dto);
    }
}
