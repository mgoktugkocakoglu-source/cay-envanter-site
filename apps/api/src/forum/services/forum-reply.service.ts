import {
    Injectable,
    Logger,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ForumReply, ForumTopic } from '@/forum/entities';
import { CreateReplyDto, UpdateReplyDto, ReplyQueryDto, ReplyListResponseDto, ReplyResponseDto } from '@/forum/dto';
import { ForumTopicService } from './forum-topic.service';

@Injectable()
export class ForumReplyService {
    private readonly logger = new Logger(ForumReplyService.name);

    constructor(
        @InjectRepository(ForumReply)
        private readonly replyRepository: Repository<ForumReply>,
        @InjectRepository(ForumTopic)
        private readonly topicRepository: Repository<ForumTopic>,
        private readonly topicService: ForumTopicService,
    ) { }

    async findByTopic(topicId: string, query: ReplyQueryDto): Promise<ReplyListResponseDto> {
        const page = query.page || 1;
        const limit = query.limit || 20;
        const skip = (page - 1) * limit;

        // Get top-level replies only (with pagination)
        const [items, total] = await this.replyRepository.findAndCount({
            where: { topic: { id: topicId }, parentReplyId: IsNull() },
            relations: ['user', 'childReplies', 'childReplies.user'],
            order: { createdAt: 'ASC' },
            skip,
            take: limit,
        });

        return {
            items: items.map((reply) => this.mapReplyToDto(reply)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async create(topicId: string, userId: string, dto: CreateReplyDto): Promise<ForumReply> {
        const topic = await this.topicService.findById(topicId);

        if (topic.isLocked) {
            throw new ForbiddenException('This topic is locked');
        }

        if (dto.parentReplyId) {
            const parentReply = await this.replyRepository.findOne({
                where: { id: dto.parentReplyId, topicId },
            });

            if (!parentReply) {
                throw new BadRequestException('Parent reply not found or belongs to different topic');
            }
        }

        const reply = this.replyRepository.create({
            ...dto,
            topicId,
            userId,
        });

        const saved = await this.replyRepository.save(reply);

        // Update topic reply count and last activity
        await this.topicService.updateReplyCount(topicId);

        this.logger.log(`Created reply on topic ${topicId} by user ${userId}`);

        return this.findById(saved.id);
    }

    async findById(id: string): Promise<ForumReply> {
        const reply = await this.replyRepository.findOne({
            where: { id },
            relations: ['user', 'topic'],
        });

        if (!reply) {
            throw new NotFoundException('Reply not found');
        }

        return reply;
    }

    async update(id: string, userId: string, dto: UpdateReplyDto, isAdmin = false): Promise<ForumReply> {
        const reply = await this.findById(id);

        if (reply.userId !== userId && !isAdmin) {
            throw new ForbiddenException('You can only edit your own replies');
        }

        const topic = await this.topicService.findById(reply.topicId);
        if (topic.isLocked && !isAdmin) {
            throw new ForbiddenException('This topic is locked');
        }

        reply.content = dto.content;
        return this.replyRepository.save(reply);
    }

    async delete(id: string, userId: string, isAdmin = false): Promise<void> {
        const reply = await this.findById(id);

        if (reply.userId !== userId && !isAdmin) {
            throw new ForbiddenException('You can only delete your own replies');
        }

        const topicId = reply.topicId;
        await this.replyRepository.remove(reply);

        // Update topic reply count
        await this.topicService.updateReplyCount(topicId);

        this.logger.log(`Deleted reply ${id}`);
    }

    async markAsSolution(id: string, topicOwnerId: string): Promise<ForumReply> {
        const reply = await this.findById(id);
        const topic = await this.topicService.findById(reply.topicId);

        if (topic.userId !== topicOwnerId) {
            throw new ForbiddenException('Only topic owner can mark solution');
        }

        // Unmark any existing solution
        await this.replyRepository.update(
            { topicId: reply.topicId, isSolution: true },
            { isSolution: false },
        );

        // Mark this reply as solution
        reply.isSolution = true;
        const saved = await this.replyRepository.save(reply);

        // Mark topic as solved
        await this.topicService.markSolved(reply.topicId, topicOwnerId);

        return saved;
    }

    private mapReplyToDto(reply: ForumReply): ReplyResponseDto {
        return {
            id: reply.id,
            content: reply.content,
            isSolution: reply.isSolution,
            parentReplyId: reply.parentReplyId,
            createdAt: reply.createdAt,
            updatedAt: reply.updatedAt,
            user: {
                id: reply.user.id,
                fullName: reply.user.fullName,
            },
            childReplies: reply.childReplies?.map((child) => this.mapReplyToDto(child)),
        };
    }
}
