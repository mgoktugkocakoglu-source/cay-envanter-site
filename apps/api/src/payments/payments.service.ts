import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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
        const qb = this.paymentRepository
            .createQueryBuilder('payment')
            .leftJoinAndSelect('payment.brokerFirm', 'brokerFirm')
            .leftJoin('payment.harvestAllocations', 'allocations')
            .where('payment.userId = :userId', { userId })
            .groupBy('payment.id')
            .addGroupBy('brokerFirm.id')
            .addSelect('COUNT(allocations.id)', 'harvestCount');

        if (query.brokerFirmId) {
            qb.andWhere('payment.brokerFirmId = :brokerFirmId', { brokerFirmId: query.brokerFirmId });
        }

        if (query.year) {
            qb.andWhere('EXTRACT(YEAR FROM payment.paymentDate) = :year', { year: query.year });
        }

        if (query.paymentStatus) {
            qb.andWhere('payment.paymentStatus = :status', { status: query.paymentStatus });
        }

        const sortBy = query.sortBy || 'paymentDate';
        const sortOrder = query.sortOrder || 'DESC';
        qb.orderBy(`payment.${sortBy}`, sortOrder);

        const results = await qb.getRawAndEntities();

        return results.entities.map((payment, index) => ({
            id: payment.id,
            totalAmountKg: Number(payment.totalAmountKg),
            totalPrice: Number(payment.totalPrice),
            pricePerKg: payment.pricePerKg,
            brokerFirm: payment.brokerFirm
                ? { id: payment.brokerFirm.id, firmName: payment.brokerFirm.firmName }
                : null,
            paymentDate: payment.paymentDate,
            paymentStatus: payment.paymentStatus,
            notes: payment.notes,
            harvestCount: parseInt(results.raw[index]?.harvestCount || '0', 10),
            createdAt: payment.createdAt,
        }));
    }

    async findOne(id: string, userId: string): Promise<Payment> {
        const payment = await this.paymentRepository.findOne({
            where: { id, userId },
            relations: ['brokerFirm', 'harvestAllocations', 'harvestAllocations.harvest', 'harvestAllocations.harvest.field'],
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        return payment;
    }

    async update(id: string, userId: string, dto: UpdatePaymentDto): Promise<Payment> {
        const payment = await this.findOne(id, userId);

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

        // Delete payment (cascades to payment_harvests)
        await this.paymentRepository.remove(payment);
        this.logger.log(`Payment deleted: ${id}`);
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
}
