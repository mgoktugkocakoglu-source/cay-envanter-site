import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
    ForumCategory,
    ForumTopic,
    ForumReply,
    ForumReaction,
    ForumSubscription,
} from './entities';
import {
    ForumCategoryService,
    ForumTopicService,
    ForumReplyService,
    ForumReactionService,
    ForumSubscriptionService,
} from './services';
import {
    ForumCategoryController,
    ForumTopicController,
    ForumReplyController,
    ForumInteractionController,
} from './controllers';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ForumCategory,
            ForumTopic,
            ForumReply,
            ForumReaction,
            ForumSubscription,
        ]),
    ],
    controllers: [
        ForumCategoryController,
        ForumTopicController,
        ForumReplyController,
        ForumInteractionController,
    ],
    providers: [
        ForumCategoryService,
        ForumTopicService,
        ForumReplyService,
        ForumReactionService,
        ForumSubscriptionService,
    ],
    exports: [
        ForumCategoryService,
        ForumTopicService,
        ForumReplyService,
        ForumReactionService,
        ForumSubscriptionService,
    ],
})
export class ForumModule { }
