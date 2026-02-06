import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    UseGuards,
    Req,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards';
import { ForumReactionService, ForumSubscriptionService } from '@/forum/services';
import { CreateReactionDto } from '@/forum/dto';
import { ReactionTargetType } from '@/forum/entities';

@ApiTags('Forum Interactions')
@Controller('forum')
export class ForumInteractionController {
    constructor(
        private readonly reactionService: ForumReactionService,
        private readonly subscriptionService: ForumSubscriptionService,
    ) { }

    // Reactions
    @Post('reactions')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Toggle reaction (add or remove)' })
    async toggleReaction(
        @Req() req: { user: { id: string } },
        @Body() dto: CreateReactionDto,
    ) {
        return this.reactionService.toggle(req.user.id, dto);
    }

    @Get('reactions/stats')
    @ApiOperation({ summary: 'Get reaction stats for a target' })
    async getReactionStats(
        @Query('targetType') targetType: ReactionTargetType,
        @Query('targetId') targetId: string,
        @Req() req?: { user?: { id: string } },
    ) {
        return this.reactionService.getStats(targetType, targetId, req?.user?.id);
    }

    // Subscriptions
    @Post('topics/:topicId/subscribe')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Subscribe to a topic' })
    async subscribe(
        @Req() req: { user: { id: string } },
        @Param('topicId', ParseUUIDPipe) topicId: string,
    ) {
        return this.subscriptionService.subscribe(req.user.id, topicId);
    }

    @Post('topics/:topicId/unsubscribe')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Unsubscribe from a topic' })
    async unsubscribe(
        @Req() req: { user: { id: string } },
        @Param('topicId', ParseUUIDPipe) topicId: string,
    ) {
        return this.subscriptionService.unsubscribe(req.user.id, topicId);
    }

    @Get('subscriptions')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get user subscriptions' })
    async getUserSubscriptions(@Req() req: { user: { id: string } }) {
        return this.subscriptionService.getUserSubscriptions(req.user.id);
    }
}
