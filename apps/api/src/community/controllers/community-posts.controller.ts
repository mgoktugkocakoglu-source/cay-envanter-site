import {
    Controller,
    Post,
    Get,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '@/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/auth/decorators';
import { CommunityPostsService, CommunityReactionsService } from '@/community/services';
import { CreatePostDto, PostQueryDto } from '@/community/dto';
import { CommunityReactionTargetType } from '@/community/entities';
import { UsersService } from '@/users/users.service';
import { Role } from '@/auth/enums';

@ApiTags('Community Posts')
@Controller('community/posts')
export class CommunityPostsController {
    constructor(
        private readonly postsService: CommunityPostsService,
        private readonly reactionsService: CommunityReactionsService,
        private readonly usersService: UsersService,
    ) { }

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new community post' })
    @ApiResponse({ status: 201, description: 'Post created successfully' })
    async createPost(
        @CurrentUser() authUser: AuthenticatedUser,
        @Body() dto: CreatePostDto,
    ) {
        return this.postsService.createPost(authUser.id, dto);
    }

    @Get()
    @UseGuards(OptionalJwtAuthGuard)
    @ApiOperation({ summary: 'Get community feed with pagination and filters' })
    @ApiResponse({ status: 200, description: 'Paginated list of posts' })
    async getFeed(
        @CurrentUser() authUser: AuthenticatedUser | null,
        @Query() query: PostQueryDto,
    ) {
        const result = await this.postsService.findAll(query);

        /** Attach user reactions if authenticated */
        let userReactions: Record<string, string> = {};
        if (authUser) {
            const postIds = result.items.map((post) => post.id);
            userReactions = await this.reactionsService.getUserReactionsForTargets(
                authUser.id,
                CommunityReactionTargetType.POST,
                postIds,
            );
        }

        return {
            ...result,
            userReactions,
        };
    }

    @Get(':id')
    @UseGuards(OptionalJwtAuthGuard)
    @ApiOperation({ summary: 'Get a single post by ID' })
    @ApiResponse({ status: 200, description: 'Post details' })
    async getPost(
        @CurrentUser() authUser: AuthenticatedUser | null,
        @Param('id', ParseUUIDPipe) postId: string,
    ) {
        const post = await this.postsService.findOneById(postId);

        let userReaction: string | null = null;
        if (authUser) {
            userReaction = await this.reactionsService.getUserReaction(
                authUser.id,
                CommunityReactionTargetType.POST,
                postId,
            );
        }

        return { ...post, userReaction };
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete a post (owner or admin only)' })
    @ApiResponse({ status: 200, description: 'Post deleted' })
    async deletePost(
        @CurrentUser() authUser: AuthenticatedUser,
        @Param('id', ParseUUIDPipe) postId: string,
    ) {
        const user = await this.usersService.findById(authUser.id);
        const role = user?.role ?? Role.USER;
        await this.postsService.deletePost(postId, authUser.id, role);
        return { message: 'Post deleted successfully' };
    }
}
