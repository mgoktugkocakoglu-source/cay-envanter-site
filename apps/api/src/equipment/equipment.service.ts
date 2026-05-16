import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Role } from '@/auth/enums';
import {
    EquipmentFavorite,
    EquipmentItem,
    EquipmentReview,
    EquipmentReviewLike,
} from '@/equipment/entities';
import { CreateEquipmentDto, CreateEquipmentReviewDto, QueryEquipmentDto } from '@/equipment/dto';
import { EquipmentStatus } from '@/equipment/enums/equipment.enum';

@Injectable()
export class EquipmentService {
    constructor(
        @InjectRepository(EquipmentItem)
        private readonly equipmentRepository: Repository<EquipmentItem>,
        @InjectRepository(EquipmentReview)
        private readonly reviewRepository: Repository<EquipmentReview>,
        @InjectRepository(EquipmentFavorite)
        private readonly favoriteRepository: Repository<EquipmentFavorite>,
        @InjectRepository(EquipmentReviewLike)
        private readonly reviewLikeRepository: Repository<EquipmentReviewLike>,
    ) { }

    async create(userId: string, role: Role, dto: CreateEquipmentDto): Promise<EquipmentItem> {
        const status = role === Role.ADMIN ? EquipmentStatus.APPROVED : EquipmentStatus.PENDING;
        const item = this.equipmentRepository.create({
            ...dto,
            createdById: userId,
            approvedById: status === EquipmentStatus.APPROVED ? userId : null,
            status,
            imageUrl: dto.imageUrl || null,
            segmentAverage: dto.segmentAverage || null,
            specs: dto.specs || [],
        });

        return this.equipmentRepository.save(item);
    }

    async findAll(queryDto: QueryEquipmentDto, userId?: string | null, role: Role = Role.USER) {
        const status = queryDto.status || EquipmentStatus.APPROVED;
        if (status !== EquipmentStatus.APPROVED && role !== Role.ADMIN) {
            throw new ForbiddenException('Onay bekleyen ekipmanları sadece admin görebilir');
        }

        const query = this.equipmentRepository
            .createQueryBuilder('equipment')
            .leftJoinAndSelect('equipment.createdBy', 'createdBy')
            .leftJoinAndSelect('equipment.reviews', 'reviews')
            .leftJoinAndSelect('reviews.user', 'reviewUser')
            .where('equipment.status = :status', { status })
            .orderBy('equipment.createdAt', 'DESC')
            .addOrderBy('reviews.likeCount', 'DESC');

        if (queryDto.category) {
            query.andWhere('equipment.category = :category', { category: queryDto.category });
        }

        if (queryDto.search) {
            query.andWhere(
                `(
                    LOWER(equipment.brand) LIKE LOWER(:search)
                    OR LOWER(equipment.model) LIKE LOWER(:search)
                    OR LOWER(equipment.typeLabel) LIKE LOWER(:search)
                )`,
                { search: `%${queryDto.search}%` },
            );
        }

        const items = await query.getMany();
        return this.decorateItems(items, userId);
    }

    async approve(id: string, adminId: string): Promise<EquipmentItem> {
        const item = await this.findEntity(id);
        item.status = EquipmentStatus.APPROVED;
        item.approvedById = adminId;
        return this.equipmentRepository.save(item);
    }

    async reject(id: string, adminId: string): Promise<EquipmentItem> {
        const item = await this.findEntity(id);
        item.status = EquipmentStatus.REJECTED;
        item.approvedById = adminId;
        return this.equipmentRepository.save(item);
    }

    async createReview(userId: string, equipmentId: string, dto: CreateEquipmentReviewDto): Promise<EquipmentReview> {
        await this.findApprovedEntity(equipmentId);
        const existing = await this.reviewRepository.findOne({ where: { userId, equipmentId } });
        if (existing) {
            throw new ConflictException('Bu ekipman için daha önce değerlendirme yaptınız');
        }

        const review = this.reviewRepository.create({
            ...dto,
            equipmentId,
            userId,
        });

        return this.reviewRepository.save(review);
    }

    async toggleFavorite(userId: string, equipmentId: string) {
        await this.findApprovedEntity(equipmentId);

        const existing = await this.favoriteRepository.findOne({ where: { userId, equipmentId } });
        if (existing) {
            await this.favoriteRepository.remove(existing);
            return { favorite: false };
        }

        await this.favoriteRepository.save(this.favoriteRepository.create({ userId, equipmentId }));
        return { favorite: true };
    }

    async toggleReviewLike(userId: string, reviewId: string) {
        const review = await this.reviewRepository.findOne({ where: { id: reviewId } });
        if (!review) throw new NotFoundException('Yorum bulunamadı');

        const existing = await this.reviewLikeRepository.findOne({ where: { userId, reviewId } });
        if (existing) {
            await this.reviewLikeRepository.remove(existing);
            await this.reviewRepository.decrement({ id: reviewId }, 'likeCount', 1);
            return { liked: false };
        }

        await this.reviewLikeRepository.save(this.reviewLikeRepository.create({ userId, reviewId }));
        await this.reviewRepository.increment({ id: reviewId }, 'likeCount', 1);
        return { liked: true };
    }

    private async findEntity(id: string): Promise<EquipmentItem> {
        const item = await this.equipmentRepository.findOne({ where: { id } });
        if (!item) throw new NotFoundException('Ekipman bulunamadı');
        return item;
    }

    private async findApprovedEntity(id: string): Promise<EquipmentItem> {
        const item = await this.equipmentRepository.findOne({ where: { id, status: EquipmentStatus.APPROVED } });
        if (!item) throw new NotFoundException('Yayınlanmış ekipman bulunamadı');
        return item;
    }

    private async decorateItems(items: EquipmentItem[], userId?: string | null) {
        const equipmentIds = items.map(item => item.id);
        const reviewIds = items.flatMap(item => item.reviews?.map(review => review.id) || []);

        const categoryAverages = await this.loadCategoryAverages();
        const favoriteIds = new Set<string>();
        const likedReviewIds = new Set<string>();

        if (userId && equipmentIds.length) {
            const favorites = await this.favoriteRepository.find({ where: { userId, equipmentId: In(equipmentIds) } });
            favorites.forEach(favorite => favoriteIds.add(favorite.equipmentId));
        }

        if (userId && reviewIds.length) {
            const likes = await this.reviewLikeRepository.find({ where: { userId, reviewId: In(reviewIds) } });
            likes.forEach(like => likedReviewIds.add(like.reviewId));
        }

        return items.map(item => this.toResponse(item, favoriteIds, likedReviewIds, categoryAverages[item.category], userId));
    }

    private async loadCategoryAverages(): Promise<Record<string, number>> {
        const rows = await this.equipmentRepository
            .createQueryBuilder('equipment')
            .select('equipment.category', 'category')
            .addSelect('ROUND(AVG(equipment.price))', 'average')
            .where('equipment.status = :status', { status: EquipmentStatus.APPROVED })
            .groupBy('equipment.category')
            .getRawMany<{ category: string; average: string }>();

        return rows.reduce<Record<string, number>>((acc, row) => {
            acc[row.category] = Number(row.average);
            return acc;
        }, {});
    }

    private toResponse(
        item: EquipmentItem,
        favoriteIds: Set<string>,
        likedReviewIds: Set<string>,
        categoryAverage?: number,
        userId?: string | null,
    ) {
        const createdBy = item.createdBy;
        const uniqueReviews = this.getLatestReviewPerUser(item.reviews || []);
        const currentUserReview = userId
            ? uniqueReviews.find(review => review.userId === userId)
            : null;
        const reviews = uniqueReviews.map(review => ({
            id: review.id,
            author: review.user?.fullName || 'Üretici',
            text: review.text,
            rating: review.rating,
            usageStatus: review.usageStatus,
            usageMonths: review.usageMonths,
            likes: review.likeCount,
            liked: likedReviewIds.has(review.id),
            createdAt: review.createdAt,
        }));

        return {
            id: item.id,
            category: item.category,
            brand: item.brand,
            model: item.model,
            typeLabel: item.typeLabel,
            price: item.price,
            segmentAverage: item.segmentAverage || categoryAverage || item.price,
            status: item.status,
            addedBy: createdBy?.role === Role.ADMIN ? 'Admin' : 'Kullanıcı',
            createdBy: createdBy ? {
                id: createdBy.id,
                fullName: createdBy.fullName,
                avatarUrl: createdBy.avatarUrl,
                userType: createdBy.userType,
            } : null,
            imageUrl: item.imageUrl || '',
            specs: item.specs || [],
            comments: reviews,
            currentUserRating: currentUserReview?.rating ?? null,
            favorite: favoriteIds.has(item.id),
            compared: false,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
        };
    }

    private getLatestReviewPerUser(reviews: EquipmentReview[]): EquipmentReview[] {
        const byUser = new Map<string, EquipmentReview>();

        reviews.forEach(review => {
            const current = byUser.get(review.userId);
            if (!current || review.updatedAt > current.updatedAt) {
                byUser.set(review.userId, review);
            }
        });

        return [...byUser.values()].sort((a, b) => {
            if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
            return b.createdAt.getTime() - a.createdAt.getTime();
        });
    }
}
