import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Field, FieldPartner } from '@/fields/entities';
import {
    CreateFieldDto,
    UpdateFieldDto,
    CreateFieldPartnerDto,
    UpdateFieldPartnerDto,
    FieldQueryDto,
} from '@/fields/dto';
import { UsersService } from '@/users/users.service';

@Injectable()
export class FieldsService {
    private readonly logger = new Logger(FieldsService.name);

    constructor(
        @InjectRepository(Field)
        private readonly fieldRepository: Repository<Field>,
        @InjectRepository(FieldPartner)
        private readonly partnerRepository: Repository<FieldPartner>,
        private readonly usersService: UsersService,
    ) { }

    async create(userId: string, dto: CreateFieldDto): Promise<Field> {
        this.validatePartnerContacts(dto.partners);

        const field = this.fieldRepository.create({
            userId,
            name: dto.name,
            province: dto.province,
            district: dto.district,
            neighborhood: dto.neighborhood,
            road: dto.road || null,
            parcelNo: dto.parcelNo || null,
            coordinates: dto.coordinates,
            area: dto.area,
            areaUnit: dto.areaUnit,
            partnerCount: dto.partners?.length || 1,
            notes: dto.notes || null,
        });

        const savedField = await this.fieldRepository.save(field);

        // Create partners if provided
        if (dto.partners && dto.partners.length > 0) {
            const partners = dto.partners.map((p) =>
                this.partnerRepository.create({
                    fieldId: savedField.id,
                    partnerName: p.partnerName,
                    partnerPhone: p.partnerPhone || null,
                    partnerIdentityNumber: p.partnerIdentityNumber || null,
                    sharePercentage: p.sharePercentage || 0,
                    isPrimaryOwner: p.isPrimaryOwner || false,
                    invitationStatus: 'pending',
                }),
            );
            await this.partnerRepository.save(partners);
        }

        this.logger.log(`Field created: ${savedField.id} by user ${userId}`);
        return this.findOne(savedField.id, userId);
    }

    async findAll(userId: string, query: FieldQueryDto): Promise<Field[]> {
        const qb = this.fieldRepository
            .createQueryBuilder('field')
            .leftJoinAndSelect('field.partners', 'partners')
            .where('field.userId = :userId', { userId })
            .andWhere('field.deleted = :deleted', { deleted: false });

        if (query.province) {
            qb.andWhere('field.province = :province', { province: query.province });
        }

        if (query.search) {
            qb.andWhere('field.name ILIKE :search', { search: `%${query.search}%` });
        }

        const sortBy = query.sortBy || 'createdAt';
        const sortOrder = query.sortOrder || 'DESC';
        qb.orderBy(`field.${sortBy}`, sortOrder);

        return qb.getMany();
    }

    async findOne(id: string, userId: string): Promise<Field> {
        const field = await this.fieldRepository.findOne({
            where: { id, deleted: false },
            relations: ['partners'],
        });

        if (!field) {
            throw new NotFoundException('Field not found');
        }

        if (field.userId !== userId) {
            throw new ForbiddenException('Access denied');
        }

        return field;
    }

    async update(id: string, userId: string, dto: UpdateFieldDto): Promise<Field> {
        const field = await this.findOne(id, userId);

        if (dto.name !== undefined) field.name = dto.name;
        if (dto.area !== undefined) field.area = dto.area;
        if (dto.areaUnit !== undefined) field.areaUnit = dto.areaUnit;
        if (dto.notes !== undefined) field.notes = dto.notes;

        await this.fieldRepository.save(field);
        this.logger.log(`Field updated: ${id}`);

        return this.findOne(id, userId);
    }

    async softDelete(id: string, userId: string): Promise<void> {
        const field = await this.findOne(id, userId);

        field.deleted = true;
        field.deletedAt = new Date();
        await this.fieldRepository.save(field);

        this.logger.log(`Field soft deleted: ${id}`);
    }

    async restore(id: string, userId: string): Promise<Field> {
        const field = await this.fieldRepository.findOne({
            where: { id, deleted: true },
        });

        if (!field) {
            throw new NotFoundException('Deleted field not found');
        }

        if (field.userId !== userId) {
            throw new ForbiddenException('Access denied');
        }

        field.deleted = false;
        field.deletedAt = null;
        await this.fieldRepository.save(field);

        this.logger.log(`Field restored: ${id}`);
        return this.findOne(id, userId);
    }

    // Partner management
    async addPartner(fieldId: string, userId: string, dto: CreateFieldPartnerDto): Promise<FieldPartner> {
        const field = await this.findOne(fieldId, userId);
        this.validatePartnerContacts([dto]);

        const partner = this.partnerRepository.create({
            fieldId,
            partnerName: dto.partnerName,
            partnerPhone: dto.partnerPhone || null,
            partnerIdentityNumber: dto.partnerIdentityNumber || null,
            sharePercentage: dto.sharePercentage || 0,
            isPrimaryOwner: dto.isPrimaryOwner || false,
            invitationStatus: 'pending',
        });

        const saved = await this.partnerRepository.save(partner);

        // Update partner count
        field.partnerCount = await this.partnerRepository.count({ where: { fieldId } });
        await this.fieldRepository.save(field);

        this.logger.log(`Partner added to field ${fieldId}: ${saved.id}`);
        return saved;
    }

    async updatePartner(
        fieldId: string,
        partnerId: string,
        userId: string,
        dto: UpdateFieldPartnerDto,
    ): Promise<FieldPartner> {
        await this.findOne(fieldId, userId);

        const partner = await this.partnerRepository.findOne({
            where: { id: partnerId, fieldId },
        });

        if (!partner) {
            throw new NotFoundException('Partner not found');
        }

        if (dto.partnerName !== undefined) partner.partnerName = dto.partnerName;
        if (dto.partnerPhone !== undefined) partner.partnerPhone = dto.partnerPhone;
        if (dto.partnerIdentityNumber !== undefined) partner.partnerIdentityNumber = dto.partnerIdentityNumber;
        if (dto.sharePercentage !== undefined) partner.sharePercentage = dto.sharePercentage;
        if (dto.isPrimaryOwner !== undefined) partner.isPrimaryOwner = dto.isPrimaryOwner;
        if (dto.invitationStatus !== undefined) partner.invitationStatus = dto.invitationStatus;
        this.validatePartnerContacts([partner]);

        await this.partnerRepository.save(partner);
        this.logger.log(`Partner updated: ${partnerId}`);

        return partner;
    }

    async removePartner(fieldId: string, partnerId: string, userId: string): Promise<void> {
        const field = await this.findOne(fieldId, userId);

        const partner = await this.partnerRepository.findOne({
            where: { id: partnerId, fieldId },
        });

        if (!partner) {
            throw new NotFoundException('Partner not found');
        }

        await this.partnerRepository.remove(partner);

        // Update partner count
        field.partnerCount = await this.partnerRepository.count({ where: { fieldId } });
        await this.fieldRepository.save(field);

        this.logger.log(`Partner removed from field ${fieldId}: ${partnerId}`);
    }

    async getPartners(fieldId: string, userId: string): Promise<FieldPartner[]> {
        await this.findOne(fieldId, userId);
        return this.partnerRepository.find({ where: { fieldId } });
    }

    async respondToPartnerInvitation(
        fieldId: string,
        partnerId: string,
        userId: string,
        status: 'accepted' | 'rejected',
    ): Promise<FieldPartner> {
        const partner = await this.partnerRepository.findOne({
            where: { id: partnerId, fieldId },
        });

        if (!partner) {
            throw new NotFoundException('Partner not found');
        }

        const user = await this.usersService.findById(userId);
        const phoneMatches = !!partner.partnerPhone && user?.phone === partner.partnerPhone;
        const identityMatches = !!partner.partnerIdentityNumber && user?.farmerIdNumber === partner.partnerIdentityNumber;

        if (!phoneMatches && !identityMatches) {
            throw new ForbiddenException('Partner invitation does not belong to current user');
        }

        partner.invitationStatus = status;
        await this.partnerRepository.save(partner);
        this.logger.log(`Partner invitation ${status}: ${partnerId}`);

        return partner;
    }

    private validatePartnerContacts(partners?: Array<Pick<CreateFieldPartnerDto, 'partnerName' | 'partnerPhone' | 'partnerIdentityNumber'>>): void {
        if (!partners) return;

        const invalid = partners.some((partner) =>
            partner.partnerName?.trim() && !partner.partnerPhone && !partner.partnerIdentityNumber,
        );

        if (invalid) {
            throw new BadRequestException('Partner phone or identity number is required');
        }
    }
}
