import {
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Firm, FirmTariff, FirmCollectionPoint } from '@/firms/entities';
import {
    CreateFirmDto,
    UpdateFirmDto,
    FirmQueryDto,
    CreateFirmTariffDto,
    UpdateFirmTariffDto,
    CreateFirmCollectionPointDto,
    UpdateFirmCollectionPointDto,
    FirmCollectionPointQueryDto,
    FirmWithCurrentTariffs,
} from '@/firms/dto';

@Injectable()
export class FirmsService {
    private readonly logger = new Logger(FirmsService.name);

    constructor(
        @InjectRepository(Firm)
        private readonly firmRepository: Repository<Firm>,
        @InjectRepository(FirmTariff)
        private readonly tariffRepository: Repository<FirmTariff>,
        @InjectRepository(FirmCollectionPoint)
        private readonly collectionPointRepository: Repository<FirmCollectionPoint>,
    ) { }

    // ─── Firm CRUD ───

    async findAll(query: FirmQueryDto): Promise<Firm[]> {
        const qb = this.firmRepository
            .createQueryBuilder('firm')
            .orderBy('firm.name', 'ASC');

        if (query.search) {
            qb.andWhere('firm.name ILIKE :search', { search: `%${query.search}%` });
        }

        if (query.isActive !== undefined) {
            qb.andWhere('firm.isActive = :isActive', { isActive: query.isActive });
        }

        return qb.getMany();
    }

    async findOne(id: string): Promise<Firm> {
        const firm = await this.firmRepository.findOne({
            where: { id },
            relations: ['tariffs', 'collectionPoints'],
        });

        if (!firm) {
            throw new NotFoundException('Firm not found');
        }

        return firm;
    }

    async create(dto: CreateFirmDto): Promise<Firm> {
        const firm = this.firmRepository.create({
            name: dto.name,
            description: dto.description || null,
            logoUrl: dto.logoUrl || null,
            phone: dto.phone || null,
            email: dto.email || null,
            address: dto.address || null,
            isActive: dto.isActive ?? true,
        });

        const saved = await this.firmRepository.save(firm);
        this.logger.log(`Firm created: ${saved.id} - ${saved.name}`);
        return saved;
    }

    async update(id: string, dto: UpdateFirmDto): Promise<Firm> {
        const firm = await this.findOne(id);

        if (dto.name !== undefined) firm.name = dto.name;
        if (dto.description !== undefined) firm.description = dto.description;
        if (dto.logoUrl !== undefined) firm.logoUrl = dto.logoUrl;
        if (dto.phone !== undefined) firm.phone = dto.phone;
        if (dto.email !== undefined) firm.email = dto.email;
        if (dto.address !== undefined) firm.address = dto.address;
        if (dto.isActive !== undefined) firm.isActive = dto.isActive;

        await this.firmRepository.save(firm);
        this.logger.log(`Firm updated: ${id}`);
        return this.findOne(id);
    }

    async remove(id: string): Promise<void> {
        const firm = await this.findOne(id);
        await this.firmRepository.remove(firm);
        this.logger.log(`Firm removed: ${id}`);
    }

    // ─── Tariff Operations ───

    async getTariffs(firmId: string): Promise<FirmTariff[]> {
        await this.ensureFirmExists(firmId);
        return this.tariffRepository.find({
            where: { firmId },
            order: { effectiveDate: 'DESC', paymentTerm: 'ASC' },
        });
    }

    async getCurrentTariffs(firmId: string): Promise<FirmTariff[]> {
        await this.ensureFirmExists(firmId);
        const today = new Date().toISOString().split('T')[0];

        return this.tariffRepository
            .createQueryBuilder('tariff')
            .where('tariff.firm_id = :firmId', { firmId })
            .andWhere('tariff.effective_date <= :today', { today })
            .andWhere('(tariff.end_date IS NULL OR tariff.end_date >= :today)', { today })
            .andWhere('tariff.isActive = :isActive', { isActive: true })
            .orderBy('tariff.payment_term', 'ASC')
            .getMany();
    }

    async createTariff(firmId: string, dto: CreateFirmTariffDto): Promise<FirmTariff> {
        await this.ensureFirmExists(firmId);

        const tariff = this.tariffRepository.create({
            firmId,
            paymentTerm: dto.paymentTerm,
            pricePerKg: dto.pricePerKg,
            effectiveDate: new Date(dto.effectiveDate),
            endDate: dto.endDate ? new Date(dto.endDate) : null,
            customPaymentDate: dto.customPaymentDate ? new Date(dto.customPaymentDate) : null,
            isSplitPayment: dto.isSplitPayment ?? false,
            splitDetails: dto.splitDetails || null,
            isActive: dto.isActive ?? true,
        });

        const saved = await this.tariffRepository.save(tariff);
        this.logger.log(`Tariff created for firm ${firmId}: ${saved.id}`);
        return saved;
    }

    async updateTariff(firmId: string, tariffId: string, dto: UpdateFirmTariffDto): Promise<FirmTariff> {
        await this.ensureFirmExists(firmId);

        const tariff = await this.tariffRepository.findOne({
            where: { id: tariffId, firmId },
        });

        if (!tariff) {
            throw new NotFoundException('Tariff not found');
        }

        if (dto.paymentTerm !== undefined) tariff.paymentTerm = dto.paymentTerm;
        if (dto.pricePerKg !== undefined) tariff.pricePerKg = dto.pricePerKg;
        if (dto.effectiveDate !== undefined) tariff.effectiveDate = new Date(dto.effectiveDate);
        if (dto.endDate !== undefined) tariff.endDate = dto.endDate ? new Date(dto.endDate) : null;
        if (dto.customPaymentDate !== undefined) tariff.customPaymentDate = dto.customPaymentDate ? new Date(dto.customPaymentDate) : null;
        if (dto.isSplitPayment !== undefined) tariff.isSplitPayment = dto.isSplitPayment;
        if (dto.splitDetails !== undefined) tariff.splitDetails = dto.splitDetails || null;
        if (dto.isActive !== undefined) tariff.isActive = dto.isActive;

        await this.tariffRepository.save(tariff);
        this.logger.log(`Tariff updated: ${tariffId}`);
        return tariff;
    }

    async removeTariff(firmId: string, tariffId: string): Promise<void> {
        await this.ensureFirmExists(firmId);

        const tariff = await this.tariffRepository.findOne({
            where: { id: tariffId, firmId },
        });

        if (!tariff) {
            throw new NotFoundException('Tariff not found');
        }

        await this.tariffRepository.remove(tariff);
        this.logger.log(`Tariff removed: ${tariffId} from firm ${firmId}`);
    }

    // ─── Collection Point Operations ───

    async getCollectionPoints(firmId: string, query: FirmCollectionPointQueryDto): Promise<FirmCollectionPoint[]> {
        await this.ensureFirmExists(firmId);

        const qb = this.collectionPointRepository
            .createQueryBuilder('point')
            .where('point.firm_id = :firmId', { firmId })
            .andWhere('point.isActive = :isActive', { isActive: true })
            .orderBy('point.province', 'ASC')
            .addOrderBy('point.district', 'ASC')
            .addOrderBy('point.name', 'ASC');

        if (query.province) {
            qb.andWhere('point.province = :province', { province: query.province });
        }

        if (query.district) {
            qb.andWhere('point.district = :district', { district: query.district });
        }

        return qb.getMany();
    }

    async createCollectionPoint(firmId: string, dto: CreateFirmCollectionPointDto): Promise<FirmCollectionPoint> {
        await this.ensureFirmExists(firmId);

        const point = this.collectionPointRepository.create({
            firmId,
            name: dto.name,
            province: dto.province,
            district: dto.district,
            address: dto.address || null,
            description: dto.description || null,
            latitude: dto.latitude || null,
            longitude: dto.longitude || null,
            collectorName: dto.collectorName || null,
            collectorPhone: dto.collectorPhone || null,
            isActive: dto.isActive ?? true,
        });

        const saved = await this.collectionPointRepository.save(point);
        this.logger.log(`Collection point created for firm ${firmId}: ${saved.id}`);
        return saved;
    }

    async updateCollectionPoint(
        firmId: string,
        pointId: string,
        dto: UpdateFirmCollectionPointDto,
    ): Promise<FirmCollectionPoint> {
        await this.ensureFirmExists(firmId);

        const point = await this.collectionPointRepository.findOne({
            where: { id: pointId, firmId },
        });

        if (!point) {
            throw new NotFoundException('Collection point not found');
        }

        if (dto.name !== undefined) point.name = dto.name;
        if (dto.province !== undefined) point.province = dto.province;
        if (dto.district !== undefined) point.district = dto.district;
        if (dto.address !== undefined) point.address = dto.address;
        if (dto.description !== undefined) point.description = dto.description;
        if (dto.latitude !== undefined) point.latitude = dto.latitude;
        if (dto.longitude !== undefined) point.longitude = dto.longitude;
        if (dto.collectorName !== undefined) point.collectorName = dto.collectorName;
        if (dto.collectorPhone !== undefined) point.collectorPhone = dto.collectorPhone;
        if (dto.isActive !== undefined) point.isActive = dto.isActive;

        await this.collectionPointRepository.save(point);
        this.logger.log(`Collection point updated: ${pointId}`);
        return point;
    }

    async removeCollectionPoint(firmId: string, pointId: string): Promise<void> {
        await this.ensureFirmExists(firmId);

        const point = await this.collectionPointRepository.findOne({
            where: { id: pointId, firmId },
        });

        if (!point) {
            throw new NotFoundException('Collection point not found');
        }

        await this.collectionPointRepository.remove(point);
        this.logger.log(`Collection point removed: ${pointId} from firm ${firmId}`);
    }

    // ─── Integration: Active Firms with Current Tariffs ───

    async getActiveFirmsWithCurrentTariffs(): Promise<FirmWithCurrentTariffs[]> {
        const today = new Date().toISOString().split('T')[0];

        const firms = await this.firmRepository.find({
            where: { isActive: true },
            order: { name: 'ASC' },
        });

        const result: FirmWithCurrentTariffs[] = [];

        for (const firm of firms) {
            const tariffs = await this.tariffRepository
                .createQueryBuilder('tariff')
                .where('tariff.firm_id = :firmId', { firmId: firm.id })
                .andWhere('tariff.effective_date <= :today', { today })
                .andWhere('(tariff.end_date IS NULL OR tariff.end_date >= :today)', { today })
                .andWhere('tariff.isActive = :isActive', { isActive: true })
                .orderBy('tariff.payment_term', 'ASC')
                .getMany();

            result.push({
                id: firm.id,
                name: firm.name,
                description: firm.description,
                logoUrl: firm.logoUrl,
                isActive: firm.isActive,
                currentTariffs: tariffs.map((t) => ({
                    paymentTerm: t.paymentTerm,
                    pricePerKg: t.pricePerKg,
                    effectiveDate: t.effectiveDate,
                    isSplitPayment: t.isSplitPayment,
                    splitDetails: t.splitDetails,
                })),
            });
        }

        return result;
    }

    // ─── Helpers ───

    private async ensureFirmExists(firmId: string): Promise<void> {
        const exists = await this.firmRepository.findOne({ where: { id: firmId } });
        if (!exists) {
            throw new NotFoundException('Firm not found');
        }
    }
}
