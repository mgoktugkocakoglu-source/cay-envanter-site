import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { Role } from '@/auth/enums';
import { CommunityPost } from '@/community/entities/community-post.entity';
import { CommunityComment } from '@/community/entities/community-comment.entity';

export interface AdminUserListItem {
    id: string;
    fullName: string;
    email: string;
    role: Role;
    isActive: boolean;
    isBanned: boolean;
    createdAt: Date;
    topicCount: number;
    replyCount: number;
}

export interface AdminUserListQuery {
    search?: string;
    role?: 'all' | Role;
    status?: 'all' | 'active' | 'banned';
}

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(CommunityPost)
        private readonly postRepository: Repository<CommunityPost>,
        @InjectRepository(CommunityComment)
        private readonly commentRepository: Repository<CommunityComment>,
    ) { }

    async create(userData: Partial<User>): Promise<User> {
        const user = this.userRepository.create(userData);
        return this.userRepository.save(user);
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: { email: email.toLowerCase(), deleted: false },
        });
    }

    async findById(id: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: { id, deleted: false },
        });
    }

    async findByFarmerIdNumber(farmerIdNumber: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: { farmerIdNumber, deleted: false },
        });
    }

    async findByPhone(phone: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: { phone, deleted: false },
        });
    }

    async searchUser(query: string, type: 'tc' | 'phone'): Promise<{
        id: string;
        fullName: string;
        userType: string;
    } | null> {
        const user = type === 'tc'
            ? await this.findByFarmerIdNumber(query)
            : await this.findByPhone(query);

        if (!user) {
            return null;
        }

        return {
            id: user.id,
            fullName: user.fullName,
            userType: user.userType,
        };
    }

    async findByVerificationToken(token: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: { verificationToken: token, deleted: false },
        });
    }

    async findByResetToken(token: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: { resetPasswordToken: token, deleted: false },
        });
    }

    async findByDeletionToken(token: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: { deletionToken: token, deleted: false },
        });
    }

    async update(id: string, userData: Partial<User>): Promise<User | null> {
        await this.userRepository.update(id, userData);
        return this.findById(id);
    }

    async softDelete(id: string): Promise<void> {
        await this.userRepository.update(id, {
            deleted: true,
            deletedAt: new Date(),
            email: `deleted_${id}@deleted.local`,
            phone: `deleted_${id}`,
            farmerIdNumber: `DEL${id.substring(0, 8)}`,
            fullName: 'Deleted User',
            verificationToken: null,
            resetPasswordToken: null,
            deletionToken: null,
        });
    }

    async listForAdmin(query: AdminUserListQuery = {}): Promise<AdminUserListItem[]> {
        const qb = this.userRepository
            .createQueryBuilder('user')
            .where('user.deleted = :deleted', { deleted: false });

        if (query.search) {
            const term = `%${query.search.toLowerCase()}%`;
            qb.andWhere(
                '(LOWER(user.fullName) LIKE :term OR LOWER(user.email) LIKE :term)',
                { term },
            );
        }

        if (query.role && query.role !== 'all') {
            qb.andWhere('user.role = :role', { role: query.role });
        }

        if (query.status === 'active') {
            qb.andWhere('user.suspended = :suspended', { suspended: false });
        } else if (query.status === 'banned') {
            qb.andWhere('user.suspended = :suspended', { suspended: true });
        }

        qb.orderBy('user.createdAt', 'DESC');

        const users = await qb.getMany();

        if (users.length === 0) {
            return [];
        }

        const userIds = users.map((u) => u.id);

        const postCounts = await this.postRepository
            .createQueryBuilder('post')
            .select('post.userId', 'userId')
            .addSelect('COUNT(*)::int', 'count')
            .where('post.userId IN (:...userIds)', { userIds })
            .groupBy('post.userId')
            .getRawMany<{ userId: string; count: number }>();

        const commentCounts = await this.commentRepository
            .createQueryBuilder('comment')
            .select('comment.userId', 'userId')
            .addSelect('COUNT(*)::int', 'count')
            .where('comment.userId IN (:...userIds)', { userIds })
            .groupBy('comment.userId')
            .getRawMany<{ userId: string; count: number }>();

        const postCountMap = new Map(postCounts.map((p) => [p.userId, Number(p.count)]));
        const commentCountMap = new Map(commentCounts.map((c) => [c.userId, Number(c.count)]));

        return users.map((u) => ({
            id: u.id,
            fullName: u.fullName,
            email: u.email,
            role: u.role,
            isActive: !u.suspended,
            isBanned: u.suspended,
            createdAt: u.createdAt,
            topicCount: postCountMap.get(u.id) ?? 0,
            replyCount: commentCountMap.get(u.id) ?? 0,
        }));
    }

    async setBanStatus(id: string, banned: boolean): Promise<AdminUserListItem> {
        const user = await this.findById(id);
        if (!user) {
            throw new NotFoundException('Kullanıcı bulunamadı');
        }
        await this.userRepository.update(id, { suspended: banned });
        const [item] = await this.adminUserItems([id]);
        return item;
    }

    async setRole(id: string, role: Role): Promise<AdminUserListItem> {
        if (!Object.values(Role).includes(role)) {
            throw new BadRequestException('Geçersiz rol');
        }
        const user = await this.findById(id);
        if (!user) {
            throw new NotFoundException('Kullanıcı bulunamadı');
        }
        await this.userRepository.update(id, { role });
        const [item] = await this.adminUserItems([id]);
        return item;
    }

    private async adminUserItems(ids: string[]): Promise<AdminUserListItem[]> {
        const users = await this.userRepository.find({ where: { id: In(ids) } });

        const postCounts = await this.postRepository
            .createQueryBuilder('post')
            .select('post.userId', 'userId')
            .addSelect('COUNT(*)::int', 'count')
            .where('post.userId IN (:...ids)', { ids })
            .groupBy('post.userId')
            .getRawMany<{ userId: string; count: number }>();

        const commentCounts = await this.commentRepository
            .createQueryBuilder('comment')
            .select('comment.userId', 'userId')
            .addSelect('COUNT(*)::int', 'count')
            .where('comment.userId IN (:...ids)', { ids })
            .groupBy('comment.userId')
            .getRawMany<{ userId: string; count: number }>();

        const postCountMap = new Map(postCounts.map((p) => [p.userId, Number(p.count)]));
        const commentCountMap = new Map(commentCounts.map((c) => [c.userId, Number(c.count)]));

        return users.map((u) => ({
            id: u.id,
            fullName: u.fullName,
            email: u.email,
            role: u.role,
            isActive: !u.suspended,
            isBanned: u.suspended,
            createdAt: u.createdAt,
            topicCount: postCountMap.get(u.id) ?? 0,
            replyCount: commentCountMap.get(u.id) ?? 0,
        }));
    }

    async countUserData(
        _userId: string,
    ): Promise<{ parcelCount: number; harvestCount: number; postCount: number; reviewCount: number }> {
        // Placeholder - will be implemented when other modules exist
        return {
            parcelCount: 0,
            harvestCount: 0,
            postCount: 0,
            reviewCount: 0,
        };
    }
}
