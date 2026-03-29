import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobListing } from './entities/job-listing.entity';
import { CreateJobListingDto } from './dto/create-job-listing.dto';
import { UpdateJobListingDto } from './dto/update-job-listing.dto';
import { QueryJobListingDto } from './dto/query-job-listing.dto';

@Injectable()
export class JobListingsService {
    constructor(
        @InjectRepository(JobListing)
        private readonly jobListingRepository: Repository<JobListing>,
    ) {}

    async create(userId: string, createJobListingDto: CreateJobListingDto): Promise<JobListing> {
        const listing = this.jobListingRepository.create({
            authorId: userId,
            ...createJobListingDto,
        });
        return await this.jobListingRepository.save(listing);
    }

    async findAll(queryDto: QueryJobListingDto): Promise<JobListing[]> {
        const query = this.jobListingRepository
            .createQueryBuilder('listing')
            .leftJoinAndSelect('listing.author', 'author')
            .orderBy('listing.createdAt', 'DESC');

        if (queryDto.type) {
            query.andWhere('listing.type = :type', { type: queryDto.type });
        }
        if (queryDto.category) {
            query.andWhere('listing.category = :category', { category: queryDto.category });
        }
        if (queryDto.status) {
            query.andWhere('listing.status = :status', { status: queryDto.status });
        }
        if (queryDto.search) {
            // Case insensitive search in location or author full name
            query.andWhere(
                '(LOWER(listing.location) LIKE LOWER(:search) OR LOWER(author.fullName) LIKE LOWER(:search))',
                { search: `%${queryDto.search}%` },
            );
        }

        return await query.getMany();
    }

    async findOne(id: string): Promise<JobListing> {
        const listing = await this.jobListingRepository.findOne({
            where: { id },
            relations: ['author'],
        });
        if (!listing) {
            throw new NotFoundException(`İlan (#${id}) bulunamadı`);
        }
        return listing;
    }

    async update(
        userId: string,
        id: string,
        updateJobListingDto: UpdateJobListingDto,
    ): Promise<JobListing> {
        const listing = await this.findOne(id);
        
        // Ensure the person updating is the author
        if (listing.authorId !== userId) {
            throw new NotFoundException('Bu ilanı düzenleme yetkiniz yok');
        }

        // Object.assign handles shallow merges.
        // For metadata, we probably want to merge deeply if needed, but for now simple overwrite is fine
        // since DTOs usually provide full updated metadata object.
        if (updateJobListingDto.metadata) {
            updateJobListingDto.metadata = {
                ...listing.metadata,
                ...updateJobListingDto.metadata,
            };
        }

        Object.assign(listing, updateJobListingDto);
        return await this.jobListingRepository.save(listing);
    }

    async remove(userId: string, id: string): Promise<void> {
        const listing = await this.findOne(id);
        if (listing.authorId !== userId) {
            throw new NotFoundException('Bu ilanı silme yetkiniz yok');
        }
        await this.jobListingRepository.remove(listing);
    }
}
