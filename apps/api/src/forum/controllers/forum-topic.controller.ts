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
import { JwtAuthGuard } from '@/auth/guards';
import { ForumTopicService } from '@/forum/services';
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
    constructor(private readonly topicService: ForumTopicService) { }

    @Get()
    @ApiOperation({ summary: 'List topics with pagination and filters' })
    @ApiResponse({ status: 200, type: TopicListResponseDto })
    async findAll(@Query() query: TopicQueryDto): Promise<TopicListResponseDto> {
        return this.topicService.findAll(query);
    }

    @Get(':slug')
    @ApiOperation({ summary: 'Get topic by slug' })
    @ApiResponse({ status: 200, type: TopicDetailDto })
    async findBySlug(@Param('slug') slug: string): Promise<TopicDetailDto> {
        // Increment view count
        const topic = await this.topicService.findBySlug(slug);
        await this.topicService.incrementViewCount(topic.id);
        return topic;
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
