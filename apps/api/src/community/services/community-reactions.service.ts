import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
    CommunityReaction,
    CommunityReactionTargetType,
    CommunityReactionType,
    CommunityPost,
    CommunityComment,
} from '@/community/entities';
import { ToggleReactionDto } from '@/community/dto';

export interface ReactionResult {
    action: 'added' | 'removed' | 'switched';
    reactionType: CommunityReactionType;
}

@Injectable()
export class CommunityReactionsService {
    private readonly logger = new Logger(CommunityReactionsService.name);

    constructor(
        @InjectRepository(CommunityReaction)
        private readonly reactionRepository: Repository<CommunityReaction>,
        @InjectRepository(CommunityPost)
        private readonly postRepository: Repository<CommunityPost>,
        @InjectRepository(CommunityComment)
        private readonly commentRepository: Repository<CommunityComment>,
    ) { }

    /**
     * Toggles a reaction on a post or comment.
     * - If no existing reaction: adds the reaction.
     * - If same reaction exists: removes it (toggle off).
     * - If opposite reaction exists: switches it.
     */
    async toggleReaction(userId: string, dto: ToggleReactionDto): Promise<ReactionResult> {
        const existing = await this.reactionRepository.findOne({
            where: {
                userId,
                targetType: dto.targetType,
                targetId: dto.targetId,
            },
        });

        if (!existing) {
            /** Add new reaction */
            const reaction = this.reactionRepository.create({
                userId,
                targetType: dto.targetType,
                targetId: dto.targetId,
                reactionType: dto.reactionType,
            });
            await this.reactionRepository.save(reaction);
            await this.updateCounter(dto.targetType, dto.targetId, dto.reactionType, 1);
            return { action: 'added', reactionType: dto.reactionType };
        }

        if (existing.reactionType === dto.reactionType) {
            /** Toggle off: same reaction clicked again */
            await this.reactionRepository.remove(existing);
            await this.updateCounter(dto.targetType, dto.targetId, dto.reactionType, -1);
            return { action: 'removed', reactionType: dto.reactionType };
        }

        /** Switch: opposite reaction */
        const oldType = existing.reactionType;
        existing.reactionType = dto.reactionType;
        await this.reactionRepository.save(existing);
        await this.updateCounter(dto.targetType, dto.targetId, oldType, -1);
        await this.updateCounter(dto.targetType, dto.targetId, dto.reactionType, 1);
        return { action: 'switched', reactionType: dto.reactionType };
    }

    /**
     * Returns the current user's reaction on a specific target, if any.
     */
    async getUserReaction(
        userId: string,
        targetType: CommunityReactionTargetType,
        targetId: string,
    ): Promise<CommunityReactionType | null> {
        const reaction = await this.reactionRepository.findOne({
            where: { userId, targetType, targetId },
        });
        return reaction?.reactionType ?? null;
    }

    /**
     * Returns a map of user reactions for multiple targets (for feed rendering).
     */
    async getUserReactionsForTargets(
        userId: string,
        targetType: CommunityReactionTargetType,
        targetIds: string[],
    ): Promise<Record<string, CommunityReactionType>> {
        if (!targetIds.length) return {};

        const reactions = await this.reactionRepository
            .createQueryBuilder('reaction')
            .where('reaction.userId = :userId', { userId })
            .andWhere('reaction.targetType = :targetType', { targetType })
            .andWhere('reaction.targetId IN (:...targetIds)', { targetIds })
            .getMany();

        const reactionMap: Record<string, CommunityReactionType> = {};
        for (const reaction of reactions) {
            reactionMap[reaction.targetId] = reaction.reactionType;
        }

        return reactionMap;
    }

    private async updateCounter(
        targetType: CommunityReactionTargetType,
        targetId: string,
        reactionType: CommunityReactionType,
        delta: number,
    ): Promise<void> {
        const column = reactionType === CommunityReactionType.LIKE ? 'likeCount' : 'dislikeCount';

        if (targetType === CommunityReactionTargetType.POST) {
            if (delta > 0) {
                await this.postRepository.increment({ id: targetId }, column, delta);
            } else {
                await this.postRepository.decrement({ id: targetId }, column, Math.abs(delta));
            }
        } else {
            if (delta > 0) {
                await this.commentRepository.increment({ id: targetId }, column, delta);
            } else {
                await this.commentRepository.decrement({ id: targetId }, column, Math.abs(delta));
            }
        }
    }
}
