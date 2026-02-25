import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunityComment } from '@/community/entities';
import { CreateCommentDto } from '@/community/dto';
import { CommunityPostsService } from './community-posts.service';
import { Role } from '@/auth/enums';

@Injectable()
export class CommunityCommentsService {
    constructor(
        @InjectRepository(CommunityComment)
        private readonly commentRepository: Repository<CommunityComment>,
        private readonly postsService: CommunityPostsService,
    ) { }

    async createComment(
        postId: string,
        userId: string,
        dto: CreateCommentDto,
    ): Promise<CommunityComment> {
        /** Verify the post exists */
        await this.postsService.findOneById(postId);

        const comment = this.commentRepository.create({
            postId,
            userId,
            content: dto.content,
        });

        const savedComment = await this.commentRepository.save(comment);
        await this.postsService.incrementCommentCount(postId);

        return this.findOneById(savedComment.id);
    }

    async findByPostId(postId: string): Promise<CommunityComment[]> {
        return this.commentRepository
            .createQueryBuilder('comment')
            .leftJoinAndSelect('comment.user', 'user')
            .select([
                'comment.id', 'comment.postId', 'comment.userId',
                'comment.content', 'comment.likeCount', 'comment.dislikeCount',
                'comment.createdAt',
                'user.id', 'user.fullName', 'user.avatarUrl',
            ])
            .where('comment.postId = :postId', { postId })
            .orderBy('comment.createdAt', 'ASC')
            .getMany();
    }

    async findOneById(commentId: string): Promise<CommunityComment> {
        const comment = await this.commentRepository
            .createQueryBuilder('comment')
            .leftJoinAndSelect('comment.user', 'user')
            .select([
                'comment.id', 'comment.postId', 'comment.userId',
                'comment.content', 'comment.likeCount', 'comment.dislikeCount',
                'comment.createdAt',
                'user.id', 'user.fullName', 'user.avatarUrl',
            ])
            .where('comment.id = :commentId', { commentId })
            .getOne();

        if (!comment) {
            throw new NotFoundException('Comment not found');
        }

        return comment;
    }

    async deleteComment(
        commentId: string,
        userId: string,
        userRole: Role,
    ): Promise<void> {
        const comment = await this.commentRepository.findOne({
            where: { id: commentId },
        });

        if (!comment) {
            throw new NotFoundException('Comment not found');
        }

        if (comment.userId !== userId && userRole !== Role.ADMIN) {
            throw new ForbiddenException('You can only delete your own comments');
        }

        await this.commentRepository.softRemove(comment);
        await this.postsService.decrementCommentCount(comment.postId);
    }
}
