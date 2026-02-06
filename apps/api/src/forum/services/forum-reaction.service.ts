import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForumReaction, ReactionTargetType, ReactionType } from '@/forum/entities';
import { CreateReactionDto, ReactionStatsDto } from '@/forum/dto';

@Injectable()
export class ForumReactionService {
    private readonly logger = new Logger(ForumReactionService.name);

    constructor(
        @InjectRepository(ForumReaction)
        private readonly reactionRepository: Repository<ForumReaction>,
    ) { }

    async toggle(userId: string, dto: CreateReactionDto): Promise<{ added: boolean }> {
        const existing = await this.reactionRepository.findOne({
            where: {
                userId,
                targetType: dto.targetType,
                targetId: dto.targetId,
                reactionType: dto.reactionType,
            },
        });

        if (existing) {
            await this.reactionRepository.remove(existing);
            return { added: false };
        }

        await this.reactionRepository.save({
            userId,
            ...dto,
        });

        return { added: true };
    }

    async getStats(targetType: ReactionTargetType, targetId: string, userId?: string): Promise<ReactionStatsDto> {
        const counts = await this.reactionRepository
            .createQueryBuilder('reaction')
            .select('reaction.reactionType', 'type')
            .addSelect('COUNT(*)', 'count')
            .where('reaction.targetType = :targetType', { targetType })
            .andWhere('reaction.targetId = :targetId', { targetId })
            .groupBy('reaction.reactionType')
            .getRawMany();

        const stats: ReactionStatsDto = {
            likeCount: 0,
            helpfulCount: 0,
            thanksCount: 0,
            userReactions: [],
        };

        for (const row of counts) {
            switch (row.type) {
                case ReactionType.LIKE:
                    stats.likeCount = parseInt(row.count, 10);
                    break;
                case ReactionType.HELPFUL:
                    stats.helpfulCount = parseInt(row.count, 10);
                    break;
                case ReactionType.THANKS:
                    stats.thanksCount = parseInt(row.count, 10);
                    break;
            }
        }

        if (userId) {
            const userReactions = await this.reactionRepository.find({
                where: { userId, targetType, targetId },
                select: ['reactionType'],
            });

            stats.userReactions = userReactions.map((r) => r.reactionType);
        }

        return stats;
    }
}
