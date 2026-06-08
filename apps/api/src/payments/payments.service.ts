import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    ConflictException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, DataSource } from 'typeorm';
import { Payment, PaymentHarvest, BrokerFirm } from '@/payments/entities';
import { Harvest } from '@/harvests/entities';
import { Field } from '@/fields/entities';
import {
    CreatePaymentDto,
    UpdatePaymentDto,
    PaymentQueryDto,
    CreateBrokerFirmDto,
    PaymentWithDetails,
} from '@/payments/dto';
import { UsersService } from '@/users/users.service';

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);

    constructor(
        @InjectRepository(Payment)
        private readonly paymentRepository: Repository<Payment>,
        @InjectRepository(PaymentHarvest)
        private readonly paymentHarvestRepository: Repository<PaymentHarvest>,
        @InjectRepository(BrokerFirm)
        private readonly brokerFirmRepository: Repository<BrokerFirm>,
        @InjectRepository(Harvest)
        private readonly harvestRepository: Repository<Harvest>,
        @InjectRepository(Field)
        private readonly fieldRepository: Repository<Field>,
        private readonly dataSource: DataSource,
        private readonly usersService: UsersService,
    ) { }

    async create(userId: string, dto: CreatePaymentDto): Promise<Payment> {
        // Start a transaction
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Validate all harvests and calculate total amount
            let totalAmountKg = 0;

            for (const allocation of dto.harvestAllocations) {
                const harvest = await queryRunner.manager.findOne(Harvest, {
                    where: { id: allocation.harvestId, deleted: false },
                    relations: ['field'],
                });

                if (!harvest) {
                    throw new NotFoundException(`Harvest ${allocation.harvestId} not found`);
                }

                if (harvest.field.userId !== userId) {
                    throw new BadRequestException(`Access denied for harvest ${allocation.harvestId}`);
                }

                // Check remaining amount
                const usedResult = await queryRunner.manager
                    .createQueryBuilder(PaymentHarvest, 'ph')
                    .where('ph.harvestId = :harvestId', { harvestId: allocation.harvestId })
                    .select('SUM(ph.usedAmountKg)', 'used')
                    .getRawOne();

                const usedAmount = parseFloat(usedResult?.used || '0');
                const remainingAmount = Number(harvest.amountKg) - usedAmount;

                if (allocation.usedAmountKg > remainingAmount + 0.01) {
                    throw new BadRequestException(
                        `Cannot use ${allocation.usedAmountKg}kg from harvest ${allocation.harvestId}. Only ${remainingAmount}kg remaining.`,
                    );
                }

                totalAmountKg += allocation.usedAmountKg;
            }

            // Validate broker firm if provided
            if (dto.brokerFirmId) {
                const brokerFirm = await queryRunner.manager.findOne(BrokerFirm, {
                    where: { id: dto.brokerFirmId },
                });
                if (!brokerFirm) {
                    throw new NotFoundException('Broker firm not found');
                }
            }

            // Create payment
            const payment = queryRunner.manager.create(Payment, {
                userId,
                totalAmountKg,
                totalPrice: dto.totalPrice,
                brokerFirmId: dto.brokerFirmId || null,
                paymentDate: new Date(dto.paymentDate),
                paymentStatus: dto.paymentStatus,
                notes: dto.notes || null,
            });

            const savedPayment = await queryRunner.manager.save(payment);

            // Create harvest allocations
            for (const allocation of dto.harvestAllocations) {
                const paymentHarvest = queryRunner.manager.create(PaymentHarvest, {
                    paymentId: savedPayment.id,
                    harvestId: allocation.harvestId,
                    usedAmountKg: allocation.usedAmountKg,
                });
                await queryRunner.manager.save(paymentHarvest);
            }

            await queryRunner.commitTransaction();
            this.logger.log(`Payment created: ${savedPayment.id} for user ${userId}`);

            return this.findOne(savedPayment.id, userId);
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async findAll(userId: string, query: PaymentQueryDto): Promise<PaymentWithDetails[]> {
        const user = await this.usersService.findById(userId);

        const qb = this.paymentRepository
            .createQueryBuilder('payment')
            .leftJoinAndSelect('payment.brokerFirm', 'brokerFirm')
            .leftJoinAndSelect('payment.firm', 'firm')
            .leftJoin('payment.harvestAllocations', 'allocations')
            .leftJoin('allocations.harvest', 'harvest')
            .leftJoin('harvest.field', 'field')
            .leftJoin('field.partners', 'partners')
            .where(new Brackets((where) => {
                where.where('payment.userId = :userId', { userId });

                if (user?.farmerIdNumber) {
                    where.orWhere('partners.partnerIdentityNumber = :identityNumber', {
                        identityNumber: user.farmerIdNumber,
                    });
                }

                if (user?.phone) {
                    where.orWhere('partners.partnerPhone = :phone', { phone: user.phone });
                }
            }))
            .groupBy('payment.id')
            .addGroupBy('brokerFirm.id')
            .addGroupBy('firm.id')
            .addSelect('COUNT(DISTINCT allocations.id)', 'harvestCount')
            // A Çaykur delivery has at most one assigned land; surface it for the box.
            .addSelect('MAX(field.id::text)', 'assignedFieldId')
            .addSelect('MAX(field.name)', 'assignedFieldName');

        if (query.brokerFirmId) {
            qb.andWhere('payment.brokerFirmId = :brokerFirmId', { brokerFirmId: query.brokerFirmId });
        }

        if (query.year) {
            qb.andWhere('EXTRACT(YEAR FROM payment.paymentDate) = :year', { year: query.year });
        }

        if (query.paymentStatus) {
            qb.andWhere('payment.paymentStatus = :status', { status: query.paymentStatus });
        }

        if (query.source) {
            qb.andWhere('payment.source = :source', { source: query.source });
        }

        const sortBy = query.sortBy || 'paymentDate';
        const sortOrder = query.sortOrder || 'DESC';
        qb.orderBy(`payment.${sortBy}`, sortOrder);

        const results = await qb.getRawAndEntities();

        return results.entities.map((payment, index) => {
            const harvestCount = parseInt(results.raw[index]?.harvestCount || '0', 10);
            const assignedFieldId = results.raw[index]?.assignedFieldId || null;
            return {
                id: payment.id,
                totalAmountKg: Number(payment.totalAmountKg),
                totalPrice: Number(payment.totalPrice),
                pricePerKg: payment.pricePerKg,
                brokerFirm: payment.brokerFirm
                    ? { id: payment.brokerFirm.id, firmName: payment.brokerFirm.firmName }
                    : null,
                firm: payment.firm
                    ? {
                        id: payment.firm.id,
                        name: payment.firm.name,
                        logoUrl: payment.firm.logoUrl,
                        isCaykur: payment.firm.isCaykur,
                    }
                    : null,
                tariffLabel: payment.tariffLabel,
                source: payment.source,
                paymentDate: payment.paymentDate,
                paymentStatus: payment.paymentStatus,
                notes: payment.notes,
                harvestCount,
                assigned: harvestCount > 0,
                assignedField: assignedFieldId
                    ? { id: assignedFieldId, name: results.raw[index]?.assignedFieldName }
                    : null,
                createdAt: payment.createdAt,
            };
        });
    }

    async findOne(id: string, userId: string): Promise<Payment> {
        const payment = await this.paymentRepository.findOne({
            where: { id },
            relations: ['brokerFirm', 'firm', 'harvestAllocations', 'harvestAllocations.harvest', 'harvestAllocations.harvest.field'],
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        if (payment.userId === userId) {
            return payment;
        }

        const hasPartnerAccess = await this.hasPartnerAccessToPayment(payment, userId);
        if (!hasPartnerAccess) {
            throw new ForbiddenException('Access denied');
        }

        return payment;
    }

    async update(id: string, userId: string, dto: UpdatePaymentDto): Promise<Payment> {
        const payment = await this.findOne(id, userId);

        if (payment.userId !== userId) {
            throw new ForbiddenException('Access denied');
        }

        if (dto.totalPrice !== undefined) payment.totalPrice = dto.totalPrice;
        if (dto.paymentDate !== undefined) payment.paymentDate = new Date(dto.paymentDate);
        if (dto.paymentStatus !== undefined) payment.paymentStatus = dto.paymentStatus;
        if (dto.notes !== undefined) payment.notes = dto.notes;

        await this.paymentRepository.save(payment);
        this.logger.log(`Payment updated: ${id}`);

        return this.findOne(id, userId);
    }

    async remove(id: string, userId: string): Promise<void> {
        const payment = await this.findOne(id, userId);

        if (payment.userId !== userId) {
            throw new ForbiddenException('Access denied');
        }

        // Delete payment (cascades to payment_harvests)
        await this.paymentRepository.remove(payment);
        this.logger.log(`Payment deleted: ${id}`);
    }

    /**
     * Attribute an auto-dropped Çaykur delivery to one of the producer's lands.
     * Creates the Harvest for the chosen field and links it to the payment.
     */
    async assignField(id: string, userId: string, fieldId: string): Promise<PaymentWithDetails> {
        const payment = await this.findOne(id, userId);

        if (payment.userId !== userId) {
            throw new ForbiddenException('Access denied');
        }

        if ((payment.harvestAllocations?.length ?? 0) > 0) {
            throw new BadRequestException('Bu teslimat zaten bir araziye atanmış');
        }

        const field = await this.fieldRepository.findOne({ where: { id: fieldId, deleted: false } });
        if (!field) {
            throw new NotFoundException('Field not found');
        }
        if (field.userId !== userId) {
            throw new ForbiddenException('Access denied');
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const harvest = queryRunner.manager.create(Harvest, {
                fieldId,
                harvestDate: payment.paymentDate,
                amountKg: payment.totalAmountKg,
            });
            const savedHarvest = await queryRunner.manager.save(harvest);

            await queryRunner.manager.save(
                queryRunner.manager.create(PaymentHarvest, {
                    paymentId: payment.id,
                    harvestId: savedHarvest.id,
                    usedAmountKg: payment.totalAmountKg,
                }),
            );

            await queryRunner.commitTransaction();
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }

        this.logger.log(`Delivery ${id} assigned to field ${fieldId}`);
        return this.toPaymentDetails(await this.findOne(id, userId));
    }

    private toPaymentDetails(payment: Payment): PaymentWithDetails {
        const allocations = payment.harvestAllocations ?? [];
        const assignedFieldEntity = allocations[0]?.harvest?.field ?? null;
        return {
            id: payment.id,
            totalAmountKg: Number(payment.totalAmountKg),
            totalPrice: Number(payment.totalPrice),
            pricePerKg: payment.pricePerKg,
            brokerFirm: payment.brokerFirm
                ? { id: payment.brokerFirm.id, firmName: payment.brokerFirm.firmName }
                : null,
            firm: payment.firm
                ? {
                    id: payment.firm.id,
                    name: payment.firm.name,
                    logoUrl: payment.firm.logoUrl,
                    isCaykur: payment.firm.isCaykur,
                }
                : null,
            tariffLabel: payment.tariffLabel,
            source: payment.source,
            paymentDate: payment.paymentDate,
            paymentStatus: payment.paymentStatus,
            notes: payment.notes,
            harvestCount: allocations.length,
            assigned: allocations.length > 0,
            assignedField: assignedFieldEntity
                ? { id: assignedFieldEntity.id, name: assignedFieldEntity.name }
                : null,
            createdAt: payment.createdAt,
        };
    }

    // Broker firms
    async getBrokerFirms(): Promise<BrokerFirm[]> {
        return this.brokerFirmRepository.find({ order: { firmName: 'ASC' } });
    }

    async createBrokerFirm(dto: CreateBrokerFirmDto): Promise<BrokerFirm> {
        const existing = await this.brokerFirmRepository.findOne({
            where: { firmName: dto.firmName },
        });

        if (existing) {
            throw new ConflictException('Broker firm already exists');
        }

        const firm = this.brokerFirmRepository.create({
            firmName: dto.firmName,
        });

        const saved = await this.brokerFirmRepository.save(firm);
        this.logger.log(`Broker firm created: ${saved.id}`);
        return saved;
    }

    private async hasPartnerAccessToPayment(payment: Payment, userId: string): Promise<boolean> {
        const user = await this.usersService.findById(userId);
        if (!user?.farmerIdNumber && !user?.phone) return false;

        const fieldIds = payment.harvestAllocations
            ?.map((allocation) => allocation.harvest?.field?.id)
            .filter((fieldId): fieldId is string => !!fieldId) || [];

        if (fieldIds.length === 0) return false;

        const count = await this.fieldRepository
            .createQueryBuilder('field')
            .leftJoin('field.partners', 'partners')
            .where('field.id IN (:...fieldIds)', { fieldIds })
            .andWhere(new Brackets((where) => {
                if (user.farmerIdNumber) {
                    where.where('partners.partnerIdentityNumber = :identityNumber', {
                        identityNumber: user.farmerIdNumber,
                    });
                }

                if (user.phone) {
                    const method = user.farmerIdNumber ? 'orWhere' : 'where';
                    where[method]('partners.partnerPhone = :phone', { phone: user.phone });
                }
            }))
            .getCount();

        return count > 0;
    }
}
