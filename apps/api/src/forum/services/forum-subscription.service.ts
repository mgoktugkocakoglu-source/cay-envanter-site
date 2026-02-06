import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForumSubscription } from '@/forum/entities';

@Injectable()
export class ForumSubscriptionService {
    private readonly logger = new Logger(ForumSubscriptionService.name);

    constructor(
        @InjectRepository(ForumSubscription)
        private readonly subscriptionRepository: Repository<ForumSubscription>,
    ) { }

    async subscribe(userId: string, topicId: string): Promise<ForumSubscription> {
        const existing = await this.subscriptionRepository.findOne({
            where: { userId, topicId },
        });

        if (existing) {
            existing.isActive = true;
            return this.subscriptionRepository.save(existing);
        }

        return this.subscriptionRepository.save({
            userId,
            topicId,
            isActive: true,
        });
    }

    async unsubscribe(userId: string, topicId: string): Promise<void> {
        await this.subscriptionRepository.update(
            { userId, topicId },
            { isActive: false },
        );
    }

    async isSubscribed(userId: string, topicId: string): Promise<boolean> {
        const sub = await this.subscriptionRepository.findOne({
            where: { userId, topicId, isActive: true },
        });

        return !!sub;
    }

    async getUserSubscriptions(userId: string): Promise<ForumSubscription[]> {
        return this.subscriptionRepository.find({
            where: { userId, isActive: true },
            relations: ['topic', 'topic.category'],
            order: { createdAt: 'DESC' },
        });
    }

    async getTopicSubscribers(topicId: string): Promise<string[]> {
        const subscriptions = await this.subscriptionRepository.find({
            where: { topicId, isActive: true },
            select: ['userId'],
        });

        return subscriptions.map((s) => s.userId);
    }
}
