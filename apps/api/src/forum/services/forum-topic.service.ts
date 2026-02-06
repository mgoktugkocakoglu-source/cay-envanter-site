import {
    Injectable,
    Logger,
    NotFoundException,
    ForbiddenException,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { ForumTopic, ForumSubscription } from '@/forum/entities';
import {
    CreateTopicDto,
    UpdateTopicDto,
    TopicQueryDto,
    TopicSortBy,
    TopicListResponseDto,
    TopicDetailDto,
} from '@/forum/dto';
import { ForumCategoryService } from './forum-category.service';

@Injectable()
export class ForumTopicService {
    private readonly logger = new Logger(ForumTopicService.name);

    constructor(
        @InjectRepository(ForumTopic)
        private readonly topicRepository: Repository<ForumTopic>,
        @InjectRepository(ForumSubscription)
        private readonly subscriptionRepository: Repository<ForumSubscription>,
        private readonly categoryService: ForumCategoryService,
    ) { }

    async findAll(query: TopicQueryDto): Promise<TopicListResponseDto> {
        const page = query.page || 1;
        const limit = query.limit || 20;
        const skip = (page - 1) * limit;
        const sortBy = query.sortBy || TopicSortBy.LAST_ACTIVITY;
        const sortOrder = query.sortOrder || 'DESC';

        const queryBuilder = this.topicRepository
            .createQueryBuilder('topic')
            .leftJoinAndSelect('topic.user', 'user')
            .leftJoinAndSelect('topic.category', 'category')
            .where('category.isActive = :isActive', { isActive: true });

        if (query.categoryId) {
            queryBuilder.andWhere('topic.categoryId = :categoryId', {
                categoryId: query.categoryId,
            });
        }

        if (query.userId) {
            queryBuilder.andWhere('topic.userId = :userId', { userId: query.userId });
        }

        if (query.isSolved !== undefined) {
            queryBuilder.andWhere('topic.isSolved = :isSolved', {
                isSolved: query.isSolved,
            });
        }

        if (query.search) {
            queryBuilder.andWhere(
                '(topic.title ILIKE :search OR topic.content ILIKE :search)',
                { search: `%${query.search}%` },
            );
        }

        // Pinned topics first, then sort by specified field
        queryBuilder
            .orderBy('topic.isPinned', 'DESC')
            .addOrderBy(`topic.${sortBy}`, sortOrder);

        const [items, total] = await queryBuilder
            .skip(skip)
            .take(limit)
            .getManyAndCount();

        return {
            items: items.map((topic) => ({
                id: topic.id,
                title: topic.title,
                slug: topic.slug,
                viewCount: topic.viewCount,
                replyCount: topic.replyCount,
                isPinned: topic.isPinned,
                isLocked: topic.isLocked,
                isSolved: topic.isSolved,
                lastActivityAt: topic.lastActivityAt,
                createdAt: topic.createdAt,
                user: {
                    id: topic.user.id,
                    fullName: topic.user.fullName,
                },
                category: {
                    id: topic.category.id,
                    name: topic.category.name,
                    slug: topic.category.slug,
                },
            })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findBySlug(slug: string): Promise<TopicDetailDto> {
        const topic = await this.topicRepository.findOne({
            where: { slug },
            relations: ['user', 'category'],
        });

        if (!topic) {
            throw new NotFoundException('Topic not found');
        }

        return {
            id: topic.id,
            title: topic.title,
            slug: topic.slug,
            content: topic.content,
            viewCount: topic.viewCount,
            replyCount: topic.replyCount,
            isPinned: topic.isPinned,
            isLocked: topic.isLocked,
            isSolved: topic.isSolved,
            lastActivityAt: topic.lastActivityAt,
            createdAt: topic.createdAt,
            updatedAt: topic.updatedAt,
            user: {
                id: topic.user.id,
                fullName: topic.user.fullName,
            },
            category: {
                id: topic.category.id,
                name: topic.category.name,
                slug: topic.category.slug,
            },
        };
    }

    async findById(id: string): Promise<ForumTopic> {
        const topic = await this.topicRepository.findOne({
            where: { id },
            relations: ['user', 'category'],
        });

        if (!topic) {
            throw new NotFoundException('Topic not found');
        }

        return topic;
    }

    async create(userId: string, dto: CreateTopicDto): Promise<ForumTopic> {
        // Verify category exists
        await this.categoryService.findById(dto.categoryId);

        const slug = await this.generateUniqueSlug(dto.title);

        const topic = this.topicRepository.create({
            ...dto,
            userId,
            slug,
            lastActivityAt: new Date(),
        });

        const saved = await this.topicRepository.save(topic);

        // Auto-subscribe creator to their topic
        await this.subscriptionRepository.save({
            userId,
            topicId: saved.id,
            isActive: true,
        });

        this.logger.log(`Created topic: ${saved.title} by user ${userId}`);

        return this.findById(saved.id);
    }

    async update(id: string, userId: string, dto: UpdateTopicDto, isAdmin = false): Promise<ForumTopic> {
        const topic = await this.findById(id);

        if (topic.userId !== userId && !isAdmin) {
            throw new ForbiddenException('You can only edit your own topics');
        }

        if (topic.isLocked && !isAdmin) {
            throw new ForbiddenException('This topic is locked');
        }

        if (dto.title && dto.title !== topic.title) {
            topic.slug = await this.generateUniqueSlug(dto.title);
        }

        if (dto.categoryId) {
            await this.categoryService.findById(dto.categoryId);
        }

        Object.assign(topic, dto);
        return this.topicRepository.save(topic);
    }

    async delete(id: string, userId: string, isAdmin = false): Promise<void> {
        const topic = await this.findById(id);

        if (topic.userId !== userId && !isAdmin) {
            throw new ForbiddenException('You can only delete your own topics');
        }

        await this.topicRepository.remove(topic);
        this.logger.log(`Deleted topic: ${topic.title} (${id})`);
    }

    async incrementViewCount(id: string): Promise<void> {
        await this.topicRepository.increment({ id }, 'viewCount', 1);
    }

    async updateReplyCount(id: string): Promise<void> {
        const count = await this.topicRepository
            .createQueryBuilder('topic')
            .leftJoin('topic.replies', 'reply')
            .where('topic.id = :id', { id })
            .select('COUNT(reply.id)', 'count')
            .getRawOne();

        await this.topicRepository.update(id, {
            replyCount: parseInt(count?.count || '0', 10),
            lastActivityAt: new Date(),
        });
    }

    async togglePin(id: string): Promise<ForumTopic> {
        const topic = await this.findById(id);
        topic.isPinned = !topic.isPinned;
        return this.topicRepository.save(topic);
    }

    async toggleLock(id: string): Promise<ForumTopic> {
        const topic = await this.findById(id);
        topic.isLocked = !topic.isLocked;
        return this.topicRepository.save(topic);
    }

    async markSolved(id: string, userId: string): Promise<ForumTopic> {
        const topic = await this.findById(id);

        if (topic.userId !== userId) {
            throw new ForbiddenException('Only topic owner can mark as solved');
        }

        topic.isSolved = true;
        return this.topicRepository.save(topic);
    }

    private async generateUniqueSlug(title: string): Promise<string> {
        let baseSlug = title
            .toLowerCase()
            .replace(/[çÇ]/g, 'c')
            .replace(/[ğĞ]/g, 'g')
            .replace(/[ıİ]/g, 'i')
            .replace(/[öÖ]/g, 'o')
            .replace(/[şŞ]/g, 's')
            .replace(/[üÜ]/g, 'u')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 200);

        let slug = baseSlug;
        let counter = 1;

        while (await this.topicRepository.findOne({ where: { slug } })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        return slug;
    }
}
