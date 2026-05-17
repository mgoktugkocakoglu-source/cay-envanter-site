import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunityPost } from '@/community/entities';
import { CommunityTag } from '@/community/entities';
import { CreatePostDto, PostQueryDto } from '@/community/dto';
import { TaggingService } from './tagging.service';
import { Role } from '@/auth/enums';

interface PaginatedResult<T> {
    items: T[];
    nextCursor: string | null;
    hasMore: boolean;
}

@Injectable()
export class CommunityPostsService {
    private readonly logger = new Logger(CommunityPostsService.name);

    constructor(
        @InjectRepository(CommunityPost)
        private readonly postRepository: Repository<CommunityPost>,
        @InjectRepository(CommunityTag)
        private readonly tagRepository: Repository<CommunityTag>,
        private readonly taggingService: TaggingService,
    ) { }

    /**
     * Creates a new community post with optional AI-powered tagging.
     * If tagNames are provided by the user, those are used.
     * Otherwise, the tagging service suggests tags from post content.
     */
    async createPost(userId: string, dto: CreatePostDto): Promise<CommunityPost> {
        const post = this.postRepository.create({
            userId,
            content: dto.content ?? null,
            type: dto.type,
            mediaUrls: dto.mediaUrls ?? [],
        });

        const savedPost = await this.postRepository.save(post);

        /** Resolve tags: use user-provided or AI-suggested */
        try {
            let tagNames = dto.tagNames ?? [];

            if (tagNames.length === 0 && dto.content) {
                tagNames = await this.taggingService.suggestTags(dto.content);
            }

            if (tagNames.length > 0) {
                const tags = await this.taggingService.resolveTagEntities(tagNames);
                savedPost.tags = tags;
                await this.postRepository.save(savedPost);

                /** Keep denormalized tag totals in sync for all-tags sorting. */
                for (const tag of tags) {
                    await this.tagRepository.increment({ id: tag.id }, 'usageCount', 1);
                }
            }
        } catch (error) {
            this.logger.warn(`Tagging failed for post ${savedPost.id}: ${error}`);
        }

        return this.findOneById(savedPost.id);
    }

    /**
     * Retrieves a paginated feed of community posts with cursor-based pagination.
     * Supports filtering by type, tag, userId, and full-text search.
     */
    async findAll(query: PostQueryDto): Promise<PaginatedResult<CommunityPost>> {
        const limit = query.limit ?? 20;

        const qb = this.postRepository
            .createQueryBuilder('post')
            .leftJoinAndSelect('post.user', 'user')
            .leftJoinAndSelect('post.tags', 'tag')
            .select([
                'post.id', 'post.userId', 'post.content', 'post.type',
                'post.mediaUrls', 'post.likeCount', 'post.dislikeCount',
                'post.commentCount', 'post.createdAt', 'post.updatedAt',
                'user.id', 'user.fullName', 'user.avatarUrl', 'user.userType',
                'tag.id', 'tag.name', 'tag.displayName',
            ])
            .orderBy('post.createdAt', 'DESC')
            .take(limit + 1);

        if (query.cursor) {
            const cursorPost = await this.postRepository.findOne({ where: { id: query.cursor } });
            if (cursorPost) {
                qb.andWhere('post.createdAt < :cursorDate', { cursorDate: cursorPost.createdAt });
            }
        }

        if (query.type) {
            qb.andWhere('post.type = :type', { type: query.type });
        }

        if (query.userId) {
            qb.andWhere('post.userId = :userId', { userId: query.userId });
        }

        if (query.tag) {
            qb.andWhere('tag.name = :tagName', { tagName: query.tag });
        }

        if (query.search) {
            qb.andWhere('post.content ILIKE :search', { search: `%${query.search}%` });
        }

        const items = await qb.getMany();
        const hasMore = items.length > limit;

        if (hasMore) {
            items.pop();
        }

        return {
            items,
            nextCursor: hasMore ? items[items.length - 1].id : null,
            hasMore,
        };
    }

    async findOneById(postId: string): Promise<CommunityPost> {
        const post = await this.postRepository
            .createQueryBuilder('post')
            .leftJoinAndSelect('post.user', 'user')
            .leftJoinAndSelect('post.tags', 'tag')
            .select([
                'post.id', 'post.userId', 'post.content', 'post.type',
                'post.mediaUrls', 'post.likeCount', 'post.dislikeCount',
                'post.commentCount', 'post.createdAt', 'post.updatedAt',
                'user.id', 'user.fullName', 'user.avatarUrl', 'user.userType',
                'tag.id', 'tag.name', 'tag.displayName',
            ])
            .where('post.id = :postId', { postId })
            .getOne();

        if (!post) {
            throw new NotFoundException('Post not found');
        }

        return post;
    }

    async deletePost(postId: string, userId: string, userRole: Role): Promise<void> {
        const post = await this.postRepository.findOne({
            where: { id: postId },
            relations: { tags: true },
        });

        if (!post) {
            throw new NotFoundException('Post not found');
        }

        if (post.userId !== userId && userRole !== Role.ADMIN) {
            throw new ForbiddenException('You can only delete your own posts');
        }

        await this.postRepository.softRemove(post);

        for (const tag of post.tags ?? []) {
            await this.tagRepository.decrement({ id: tag.id }, 'usageCount', 1);
        }
    }

    async incrementCommentCount(postId: string): Promise<void> {
        await this.postRepository.increment({ id: postId }, 'commentCount', 1);
    }

    async decrementCommentCount(postId: string): Promise<void> {
        await this.postRepository.decrement({ id: postId }, 'commentCount', 1);
    }
}
