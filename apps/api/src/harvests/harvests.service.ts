import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Harvest } from '@/harvests/entities';
import { Field } from '@/fields/entities';
import {
    CreateHarvestDto,
    UpdateHarvestDto,
    HarvestQueryDto,
    HarvestWithStatus,
} from '@/harvests/dto';

@Injectable()
export class HarvestsService {
    private readonly logger = new Logger(HarvestsService.name);

    constructor(
        @InjectRepository(Harvest)
        private readonly harvestRepository: Repository<Harvest>,
        @InjectRepository(Field)
        private readonly fieldRepository: Repository<Field>,
    ) { }

    async create(userId: string, dto: CreateHarvestDto): Promise<Harvest> {
        // Verify field ownership
        const field = await this.fieldRepository.findOne({
            where: { id: dto.fieldId, deleted: false },
        });

        if (!field) {
            throw new NotFoundException('Field not found');
        }

        if (field.userId !== userId) {
            throw new ForbiddenException('Access denied');
        }

        // Validate harvest date is not in the future
        const harvestDate = new Date(dto.harvestDate);
        if (harvestDate > new Date()) {
            throw new BadRequestException('Harvest date cannot be in the future');
        }

        // Check if there's already a harvest on the same day for this field (warning only, still allowed)
        const existingHarvest = await this.harvestRepository.findOne({
            where: { fieldId: dto.fieldId, harvestDate: harvestDate, deleted: false },
        });

        const harvest = this.harvestRepository.create({
            fieldId: dto.fieldId,
            harvestDate: harvestDate,
            amountKg: dto.amountKg,
            quality: dto.quality || null,
            notes: dto.notes || null,
        });

        const saved = await this.harvestRepository.save(harvest);
        this.logger.log(`Harvest created: ${saved.id} for field ${dto.fieldId}`);

        // Return with field info
        return this.findOne(saved.id, userId);
    }

    async findAll(userId: string, query: HarvestQueryDto): Promise<HarvestWithStatus[]> {
        const qb = this.harvestRepository
            .createQueryBuilder('harvest')
            .leftJoinAndSelect('harvest.field', 'field')
            .leftJoin(
                'payment_harvests',
                'ph',
                'ph.harvest_id = harvest.id',
            )
            .where('field.userId = :userId', { userId })
            .andWhere('harvest.deleted = :deleted', { deleted: false })
            .andWhere('field.deleted = :fieldDeleted', { fieldDeleted: false })
            .groupBy('harvest.id')
            .addGroupBy('field.id')
            .addSelect('COALESCE(SUM(ph.used_amount_kg), 0)', 'soldAmount');

        if (query.fieldId) {
            qb.andWhere('harvest.fieldId = :fieldId', { fieldId: query.fieldId });
        }

        if (query.year) {
            qb.andWhere('EXTRACT(YEAR FROM harvest.harvestDate) = :year', { year: query.year });
        }

        if (query.startDate && query.endDate) {
            qb.andWhere('harvest.harvestDate BETWEEN :startDate AND :endDate', {
                startDate: query.startDate,
                endDate: query.endDate,
            });
        } else if (query.startDate) {
            qb.andWhere('harvest.harvestDate >= :startDate', { startDate: query.startDate });
        } else if (query.endDate) {
            qb.andWhere('harvest.harvestDate <= :endDate', { endDate: query.endDate });
        }

        const sortBy = query.sortBy || 'harvestDate';
        const sortOrder = query.sortOrder || 'DESC';
        qb.orderBy(`harvest.${sortBy}`, sortOrder);

        const results = await qb.getRawAndEntities();

        // Combine entities with raw sold amounts
        const harvestsWithStatus: HarvestWithStatus[] = results.entities.map((harvest, index) => {
            const soldAmountKg = parseFloat(results.raw[index]?.soldAmount || '0');
            const remainingKg = harvest.amountKg - soldAmountKg;
            let status: 'sold' | 'partial' | 'pending' = 'pending';

            if (soldAmountKg >= harvest.amountKg) {
                status = 'sold';
            } else if (soldAmountKg > 0) {
                status = 'partial';
            }

            return {
                id: harvest.id,
                fieldId: harvest.fieldId,
                fieldName: harvest.field?.name || '',
                harvestDate: harvest.harvestDate,
                amountKg: harvest.amountKg,
                quality: harvest.quality,
                notes: harvest.notes,
                soldAmountKg,
                remainingKg,
                status,
                createdAt: harvest.createdAt,
                updatedAt: harvest.updatedAt,
            };
        });

        // Filter by status if specified
        if (query.status) {
            return harvestsWithStatus.filter((h) => h.status === query.status);
        }

        return harvestsWithStatus;
    }

    async findOne(id: string, userId: string): Promise<Harvest> {
        const harvest = await this.harvestRepository.findOne({
            where: { id, deleted: false },
            relations: ['field'],
        });

        if (!harvest) {
            throw new NotFoundException('Harvest not found');
        }

        if (harvest.field.userId !== userId) {
            throw new ForbiddenException('Access denied');
        }

        return harvest;
    }

    async update(id: string, userId: string, dto: UpdateHarvestDto): Promise<Harvest> {
        const harvest = await this.findOne(id, userId);

        // Check if harvest has payments - if so, only notes can be updated
        const hasPayments = await this.checkHasPayments(id);

        if (hasPayments) {
            if (dto.harvestDate !== undefined || dto.amountKg !== undefined || dto.quality !== undefined) {
                throw new BadRequestException(
                    'This harvest has associated payments. Only notes can be updated.',
                );
            }
        }

        if (dto.harvestDate !== undefined) {
            const harvestDate = new Date(dto.harvestDate);
            if (harvestDate > new Date()) {
                throw new BadRequestException('Harvest date cannot be in the future');
            }
            harvest.harvestDate = harvestDate;
        }
        if (dto.amountKg !== undefined) harvest.amountKg = dto.amountKg;
        if (dto.quality !== undefined) harvest.quality = dto.quality;
        if (dto.notes !== undefined) harvest.notes = dto.notes;

        await this.harvestRepository.save(harvest);
        this.logger.log(`Harvest updated: ${id}`);

        return this.findOne(id, userId);
    }

    async softDelete(id: string, userId: string): Promise<void> {
        const harvest = await this.findOne(id, userId);

        // Check if harvest has payments
        const hasPayments = await this.checkHasPayments(id);
        if (hasPayments) {
            throw new BadRequestException(
                'This harvest has associated payments. Please delete the payments first.',
            );
        }

        harvest.deleted = true;
        harvest.deletedAt = new Date();
        await this.harvestRepository.save(harvest);

        this.logger.log(`Harvest soft deleted: ${id}`);
    }

    async getAvailableHarvests(userId: string): Promise<HarvestWithStatus[]> {
        // Get harvests that have remaining amount (not fully sold)
        const query: HarvestQueryDto = {};
        const all = await this.findAll(userId, query);
        return all.filter((h) => h.remainingKg > 0);
    }

    async getHarvestRemainingAmount(id: string): Promise<number> {
        const result = await this.harvestRepository
            .createQueryBuilder('harvest')
            .leftJoin('payment_harvests', 'ph', 'ph.harvest_id = harvest.id')
            .where('harvest.id = :id', { id })
            .select('harvest.amountKg', 'total')
            .addSelect('COALESCE(SUM(ph.used_amount_kg), 0)', 'used')
            .groupBy('harvest.id')
            .getRawOne();

        if (!result) {
            return 0;
        }

        return parseFloat(result.total) - parseFloat(result.used);
    }

    private async checkHasPayments(harvestId: string): Promise<boolean> {
        // This will be checked against payment_harvests table
        // For now, we do a raw query since PaymentHarvest entity is not yet created
        const result = await this.harvestRepository.manager.query(
            'SELECT COUNT(*) as count FROM payment_harvests WHERE harvest_id = $1',
            [harvestId],
        ).catch(() => [{ count: 0 }]);

        return parseInt(result[0]?.count || '0', 10) > 0;
    }
}
