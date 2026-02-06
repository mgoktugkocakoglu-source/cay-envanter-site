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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards';
import { ForumReplyService } from '@/forum/services';
import { CreateReplyDto, UpdateReplyDto, ReplyQueryDto } from '@/forum/dto';

@ApiTags('Forum Replies')
@Controller('forum')
export class ForumReplyController {
    constructor(private readonly replyService: ForumReplyService) { }

    @Get('topics/:topicId/replies')
    @ApiOperation({ summary: 'Get replies for a topic' })
    async findByTopic(
        @Param('topicId', ParseUUIDPipe) topicId: string,
        @Query() query: ReplyQueryDto,
    ) {
        return this.replyService.findByTopic(topicId, query);
    }

    @Post('topics/:topicId/replies')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a reply' })
    async create(
        @Req() req: { user: { id: string } },
        @Param('topicId', ParseUUIDPipe) topicId: string,
        @Body() dto: CreateReplyDto,
    ) {
        return this.replyService.create(topicId, req.user.id, dto);
    }

    @Patch('replies/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update a reply' })
    async update(
        @Req() req: { user: { id: string } },
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateReplyDto,
    ) {
        return this.replyService.update(id, req.user.id, dto);
    }

    @Delete('replies/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete a reply' })
    async delete(
        @Req() req: { user: { id: string } },
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.replyService.delete(id, req.user.id);
    }

    @Post('replies/:id/solution')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Mark reply as solution (Topic owner only)' })
    async markAsSolution(
        @Req() req: { user: { id: string } },
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.replyService.markAsSolution(id, req.user.id);
    }
}
