import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunityTag } from '@/community/entities';
import { CreateTagDto } from '@/community/dto';

@Injectable()
export class CommunityTagsService {
    private readonly logger = new Logger(CommunityTagsService.name);

    constructor(
        @InjectRepository(CommunityTag)
        private readonly tagRepository: Repository<CommunityTag>,
    ) { }

    async findAll(): Promise<CommunityTag[]> {
        return this.tagRepository.find({
            order: { usageCount: 'DESC', name: 'ASC' },
        });
    }

    /**
     * Returns trending tags (most used in the last 7 days by post creation).
     * Falls back to overall most-used tags.
     */
    async findTrending(limit: number = 10): Promise<CommunityTag[]> {
        return this.tagRepository
            .createQueryBuilder('tag')
            .innerJoin('community_post_tags', 'pt', 'pt."tagId" = tag.id')
            .innerJoin('community_posts', 'post', 'post.id = pt."postId"')
            .where('post."createdAt" > NOW() - INTERVAL \'7 days\'')
            .groupBy('tag.id')
            .orderBy('COUNT(pt."postId")', 'DESC')
            .limit(limit)
            .getMany();
    }

    async createTag(dto: CreateTagDto): Promise<CommunityTag> {
        const tag = this.tagRepository.create({
            name: dto.name.toLowerCase().trim(),
            displayName: dto.displayName,
            isSystem: true,
        });

        return this.tagRepository.save(tag);
    }

    async findByName(name: string): Promise<CommunityTag | null> {
        return this.tagRepository.findOne({ where: { name } });
    }
}
