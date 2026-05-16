import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplaceListing } from '@/marketplace/entities/marketplace-listing.entity';
import {
    CreateMarketplaceListingDto,
    QueryMarketplaceListingDto,
    UpdateMarketplaceListingDto,
} from '@/marketplace/dto';
import { MarketplaceListingStatus } from '@/marketplace/enums/marketplace-listing.enum';

@Injectable()
export class MarketplaceService {
    constructor(
        @InjectRepository(MarketplaceListing)
        private readonly marketplaceRepository: Repository<MarketplaceListing>,
    ) { }

    async create(sellerId: string, dto: CreateMarketplaceListingDto): Promise<MarketplaceListing> {
        const listing = this.marketplaceRepository.create({
            ...dto,
            sellerId,
            priceUnit: dto.priceUnit || null,
            imageUrls: dto.imageUrls || [],
            specs: dto.specs || {},
        });

        return this.marketplaceRepository.save(listing);
    }

    async findAll(queryDto: QueryMarketplaceListingDto): Promise<MarketplaceListing[]> {
        const query = this.marketplaceRepository
            .createQueryBuilder('listing')
            .leftJoinAndSelect('listing.seller', 'seller')
            .orderBy('listing.createdAt', 'DESC');

        query.andWhere('listing.status = :status', {
            status: queryDto.status || MarketplaceListingStatus.ACTIVE,
        });

        if (queryDto.category) {
            query.andWhere('listing.category = :category', { category: queryDto.category });
        }

        if (queryDto.search) {
            query.andWhere(
                `(
                    LOWER(listing.title) LIKE LOWER(:search)
                    OR LOWER(listing.description) LIKE LOWER(:search)
                    OR LOWER(listing.location) LIKE LOWER(:search)
                    OR LOWER(listing.contactName) LIKE LOWER(:search)
                    OR LOWER(seller.fullName) LIKE LOWER(:search)
                )`,
                { search: `%${queryDto.search}%` },
            );
        }

        const listings = await query.getMany();
        return listings.map(listing => this.redactSeller(listing));
    }

    async findOne(id: string): Promise<MarketplaceListing> {
        const listing = await this.marketplaceRepository.findOne({
            where: { id },
            relations: ['seller'],
        });

        if (!listing) {
            throw new NotFoundException(`Pazar ilanı (#${id}) bulunamadı`);
        }

        return this.redactSeller(listing);
    }

    async update(
        sellerId: string,
        id: string,
        dto: UpdateMarketplaceListingDto,
    ): Promise<MarketplaceListing> {
        const listing = await this.findOne(id);

        if (listing.sellerId !== sellerId) {
            throw new NotFoundException('Bu ilanı düzenleme yetkiniz yok');
        }

        Object.assign(listing, {
            ...dto,
            specs: dto.specs ? { ...listing.specs, ...dto.specs } : listing.specs,
        });

        return this.marketplaceRepository.save(listing);
    }

    async remove(sellerId: string, id: string): Promise<void> {
        const listing = await this.findOne(id);

        if (listing.sellerId !== sellerId) {
            throw new NotFoundException('Bu ilanı silme yetkiniz yok');
        }

        await this.marketplaceRepository.remove(listing);
    }

    private redactSeller(listing: MarketplaceListing): MarketplaceListing {
        if (!listing.seller) return listing;

        const { id, fullName, phone, avatarUrl, userType } = listing.seller;
        listing.seller = { id, fullName, phone, avatarUrl, userType } as any;
        return listing;
    }
}
