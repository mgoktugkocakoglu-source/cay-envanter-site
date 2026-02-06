import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForumCategory } from '@/forum/entities';
import { CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto } from '@/forum/dto';

@Injectable()
export class ForumCategoryService {
    private readonly logger = new Logger(ForumCategoryService.name);

    constructor(
        @InjectRepository(ForumCategory)
        private readonly categoryRepository: Repository<ForumCategory>,
    ) { }

    async findAll(includeInactive = false): Promise<CategoryResponseDto[]> {
        const queryBuilder = this.categoryRepository
            .createQueryBuilder('category')
            .leftJoin('category.topics', 'topic')
            .addSelect('COUNT(topic.id)', 'topicCount')
            .groupBy('category.id')
            .orderBy('category.displayOrder', 'ASC')
            .addOrderBy('category.name', 'ASC');

        if (!includeInactive) {
            queryBuilder.where('category.isActive = :isActive', { isActive: true });
        }

        const categories = await queryBuilder.getRawAndEntities();

        return categories.entities.map((category, index) => ({
            ...category,
            topicCount: parseInt(categories.raw[index].topicCount, 10) || 0,
        }));
    }

    async findBySlug(slug: string): Promise<ForumCategory> {
        const category = await this.categoryRepository.findOne({
            where: { slug, isActive: true },
        });

        if (!category) {
            throw new NotFoundException('Category not found');
        }

        return category;
    }

    async findById(id: string): Promise<ForumCategory> {
        const category = await this.categoryRepository.findOne({
            where: { id },
        });

        if (!category) {
            throw new NotFoundException('Category not found');
        }

        return category;
    }

    async create(dto: CreateCategoryDto): Promise<ForumCategory> {
        const slug = this.generateSlug(dto.name);

        const existingCategory = await this.categoryRepository.findOne({
            where: { slug },
        });

        if (existingCategory) {
            throw new ConflictException('Category with this name already exists');
        }

        const category = this.categoryRepository.create({
            ...dto,
            slug,
        });

        const saved = await this.categoryRepository.save(category);
        this.logger.log(`Created category: ${saved.name} (${saved.id})`);

        return saved;
    }

    async update(id: string, dto: UpdateCategoryDto): Promise<ForumCategory> {
        const category = await this.findById(id);

        if (dto.name && dto.name !== category.name) {
            const newSlug = this.generateSlug(dto.name);
            const existingCategory = await this.categoryRepository.findOne({
                where: { slug: newSlug },
            });

            if (existingCategory && existingCategory.id !== id) {
                throw new ConflictException('Category with this name already exists');
            }

            category.slug = newSlug;
        }

        Object.assign(category, dto);
        return this.categoryRepository.save(category);
    }

    async delete(id: string): Promise<void> {
        const category = await this.findById(id);
        await this.categoryRepository.remove(category);
        this.logger.log(`Deleted category: ${category.name} (${id})`);
    }

    async reorder(categoryIds: string[]): Promise<void> {
        const updates = categoryIds.map((id, index) =>
            this.categoryRepository.update(id, { displayOrder: index }),
        );

        await Promise.all(updates);
        this.logger.log('Reordered categories');
    }

    private generateSlug(name: string): string {
        return name
            .toLowerCase()
            .replace(/[çÇ]/g, 'c')
            .replace(/[ğĞ]/g, 'g')
            .replace(/[ıİ]/g, 'i')
            .replace(/[öÖ]/g, 'o')
            .replace(/[şŞ]/g, 's')
            .replace(/[üÜ]/g, 'u')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }
}
