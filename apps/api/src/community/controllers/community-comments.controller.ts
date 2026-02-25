import {
    Controller,
    Post,
    Get,
    Delete,
    Body,
    Param,
    UseGuards,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/auth/decorators';
import { CommunityCommentsService } from '@/community/services';
import { CreateCommentDto } from '@/community/dto';
import { UsersService } from '@/users/users.service';
import { Role } from '@/auth/enums';

@ApiTags('Community Comments')
@Controller('community')
export class CommunityCommentsController {
    constructor(
        private readonly commentsService: CommunityCommentsService,
        private readonly usersService: UsersService,
    ) { }

    @Post('posts/:postId/comments')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Add a comment to a post' })
    @ApiResponse({ status: 201, description: 'Comment created' })
    async createComment(
        @CurrentUser() authUser: AuthenticatedUser,
        @Param('postId', ParseUUIDPipe) postId: string,
        @Body() dto: CreateCommentDto,
    ) {
        return this.commentsService.createComment(postId, authUser.id, dto);
    }

    @Get('posts/:postId/comments')
    @ApiOperation({ summary: 'Get comments for a post' })
    @ApiResponse({ status: 200, description: 'List of comments' })
    async getComments(
        @Param('postId', ParseUUIDPipe) postId: string,
    ) {
        return this.commentsService.findByPostId(postId);
    }

    @Delete('comments/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete a comment (owner or admin)' })
    @ApiResponse({ status: 200, description: 'Comment deleted' })
    async deleteComment(
        @CurrentUser() authUser: AuthenticatedUser,
        @Param('id', ParseUUIDPipe) commentId: string,
    ) {
        const user = await this.usersService.findById(authUser.id);
        const role = user?.role ?? Role.USER;
        await this.commentsService.deleteComment(commentId, authUser.id, role);
        return { message: 'Comment deleted successfully' };
    }
}
