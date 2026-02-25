import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
    CommunityPost,
    CommunityTag,
    CommunityComment,
    CommunityReaction,
} from '@/community/entities';
import {
    CommunityPostsService,
    CommunityTagsService,
    CommunityCommentsService,
    CommunityReactionsService,
    TaggingService,
} from '@/community/services';
import {
    CommunityPostsController,
    CommunityTagsController,
    CommunityCommentsController,
    CommunityReactionsController,
} from '@/community/controllers';
import { UsersModule } from '@/users/users.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            CommunityPost,
            CommunityTag,
            CommunityComment,
            CommunityReaction,
        ]),
        UsersModule,
    ],
    controllers: [
        CommunityPostsController,
        CommunityTagsController,
        CommunityCommentsController,
        CommunityReactionsController,
    ],
    providers: [
        CommunityPostsService,
        CommunityTagsService,
        CommunityCommentsService,
        CommunityReactionsService,
        TaggingService,
    ],
    exports: [CommunityPostsService],
})
export class CommunityModule { }
