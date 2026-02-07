import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Req,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '@/auth/guards';
import { ForumTopicService, ForumSubscriptionService, ForumReactionService } from '@/forum/services';
import { ReactionTargetType } from '@/forum/entities';
import {
    CreateTopicDto,
    UpdateTopicDto,
    TopicQueryDto,
    TopicListResponseDto,
    TopicDetailDto,
} from '@/forum/dto';

@ApiTags('Forum Topics')
@Controller('forum/topics')
export class ForumTopicController {
    constructor(
        private readonly topicService: ForumTopicService,
        private readonly subscriptionService: ForumSubscriptionService,
        private readonly reactionService: ForumReactionService,
    ) { }

    @Get()
    @ApiOperation({ summary: 'List topics with pagination and filters' })
    @ApiResponse({ status: 200, type: TopicListResponseDto })
    async findAll(@Query() query: TopicQueryDto): Promise<TopicListResponseDto> {
        return this.topicService.findAll(query);
    }

    @Get(':slug')
    @UseGuards(OptionalJwtAuthGuard)
    @ApiOperation({ summary: 'Get topic by slug' })
    @ApiResponse({ status: 200, type: TopicDetailDto })
    async findBySlug(
        @Param('slug') slug: string,
        @Req() req?: { user?: { id: string } },
    ): Promise<TopicDetailDto> {
        // Increment view count
        const topic = await this.topicService.findBySlug(slug);
        await this.topicService.incrementViewCount(topic.id);

        // Enrich with subscription and reaction data if user is authenticated
        const userId = req?.user?.id;
        const enrichedTopic: any = { ...topic };

        if (userId) {
            enrichedTopic.isSubscribed = await this.subscriptionService.isSubscribed(userId, topic.id);
        }

        const reactionStats = await this.reactionService.getStats(ReactionTargetType.TOPIC, topic.id, userId);
        enrichedTopic.reactions = {
            like: reactionStats.likeCount,
            helpful: reactionStats.helpfulCount,
            thanks: reactionStats.thanksCount,
            userReaction: reactionStats.userReactions.length > 0 ? reactionStats.userReactions[0] : null,
        };

        return enrichedTopic;
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new topic' })
    async create(@Req() req: { user: { id: string } }, @Body() dto: CreateTopicDto) {
        return this.topicService.create(req.user.id, dto);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update topic' })
    async update(
        @Req() req: { user: { id: string } },
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateTopicDto,
    ) {
        return this.topicService.update(id, req.user.id, dto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete topic' })
    async delete(
        @Req() req: { user: { id: string } },
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.topicService.delete(id, req.user.id);
    }

    @Post(':id/pin')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Toggle pin status (Admin only)' })
    async togglePin(@Param('id', ParseUUIDPipe) id: string) {
        // TODO: Add admin guard
        return this.topicService.togglePin(id);
    }

    @Post(':id/lock')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Toggle lock status (Admin only)' })
    async toggleLock(@Param('id', ParseUUIDPipe) id: string) {
        // TODO: Add admin guard
        return this.topicService.toggleLock(id);
    }

    @Post(':id/solve')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Mark topic as solved (Owner only)' })
    async markSolved(
        @Req() req: { user: { id: string } },
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.topicService.markSolved(id, req.user.id);
    }
}
