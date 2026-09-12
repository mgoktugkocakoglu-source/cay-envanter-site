import {
    Injectable,
    Logger,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
    LandMeasurementRequest,
    OPEN_MEASUREMENT_REQUEST_STATUSES,
} from '@/measurement-requests/entities';
import {
    CreateMeasurementRequestDto,
    SetMeasurementAppointmentDto,
    RejectMeasurementRequestDto,
    MeasurementRequestQueryDto,
} from '@/measurement-requests/dto';
import { User } from '@/users/entities/user.entity';
import { Role, CaykurRole, UserType } from '@/auth/enums';
import { Paginated, paginate } from '@/common/dto/paginated.dto';
import { PruningActor } from '@/pruning/pruning.service';
import { FieldsService } from '@/fields/fields.service';
import {
    ParcelOwnersService,
    ParcelOwnerView,
    fieldAreaM2,
    parcelKeyOf,
    toParcelOwnerView,
} from '@/fields/parcel-owners.service';

/** A request as served to clients: the entity plus every registrant of the parcel. */
export type MeasurementRequestView = LandMeasurementRequest & { coOwners: ParcelOwnerView[] };

/**
 * Arazide ölçüm talepleri: a producer on a hisseli parcel asks Çaykur staff to
 * measure their slice on site. Staff schedule it and capture the boundary via
 * the licensing flow (LicensingService.create with `measurementRequestId`);
 * the request closes once the producer's slice is approved by every co-owner.
 */
@Injectable()
export class MeasurementRequestsService {
    private readonly logger = new Logger(MeasurementRequestsService.name);

    constructor(
        @InjectRepository(LandMeasurementRequest)
        private readonly requestRepository: Repository<LandMeasurementRequest>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly fieldsService: FieldsService,
        private readonly parcelOwners: ParcelOwnersService,
    ) {}

    async create(actor: PruningActor, dto: CreateMeasurementRequestDto): Promise<MeasurementRequestView> {
        const user = await this.userRepository.findOne({ where: { id: actor.id } });
        if (!this.isAdmin(actor) && (this.isStaff(actor) || !user || !this.isProducerUserType(user.userType))) {
            throw new ForbiddenException('Ölçüm talebini yalnızca üretici oluşturabilir');
        }

        const field = await this.fieldsService.findOne(dto.fieldId, actor.id);
        if (field.userId !== actor.id) {
            throw new ForbiddenException('Yalnızca arazinin kayıtlı sahibi ölçüm talebi oluşturabilir');
        }
        if (!field.adaNo || !field.parcelNo) {
            throw new BadRequestException('Arazinin ada/parsel bilgisi eksik');
        }

        const owners = await this.parcelOwners.findOwners({
            province: field.province,
            adaNo: field.adaNo,
            parcelNo: field.parcelNo,
        });
        if (!owners.some((o) => o.userId !== actor.id)) {
            throw new BadRequestException('Bu arazi hisseli değil; sınır belirlemeye gerek yok');
        }

        const open = await this.requestRepository.findOne({
            where: { fieldId: field.id, status: In(OPEN_MEASUREMENT_REQUEST_STATUSES) },
        });
        if (open) {
            throw new BadRequestException('Bu arazi için açık bir ölçüm talebi zaten var');
        }

        const request = this.requestRepository.create({
            producerId: actor.id,
            producerName: user?.fullName ?? 'Müstahsil',
            fieldId: field.id,
            il: field.province,
            ilce: field.district,
            ada: field.adaNo,
            parsel: field.parcelNo,
            registeredAreaM2: fieldAreaM2(field),
            parcelGeometry: field.coordinates?.[0] ?? null,
            producerNote: dto.producerNote?.trim() || null,
            status: 'pending',
        });
        const saved = await this.requestRepository.save(request);
        this.logger.log(`Measurement request created: ${saved.id} by producer ${actor.id} for field ${field.id}`);
        return this.withCoOwners(saved);
    }

    async list(actor: PruningActor, query: MeasurementRequestQueryDto): Promise<Paginated<MeasurementRequestView>> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 50;

        const qb = this.requestRepository.createQueryBuilder('req');
        if (this.isProducer(actor)) {
            qb.andWhere('req.producerId = :uid', { uid: actor.id });
        }
        if (query.status) {
            qb.andWhere('req.status = :status', { status: query.status });
        }
        if (query.search) {
            qb.andWhere(
                '(req.producerName ILIKE :q OR req.ilce ILIKE :q OR req.ada ILIKE :q OR req.parsel ILIKE :q)',
                { q: `%${query.search}%` },
            );
        }
        qb.orderBy('req.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);

        const [rows, total] = await qb.getManyAndCount();
        return paginate(await this.withCoOwnersMany(rows), total, page, limit);
    }

    async findOne(id: string, actor: PruningActor): Promise<MeasurementRequestView> {
        const request = await this.requestRepository.findOne({ where: { id } });
        if (!request) {
            throw new NotFoundException('Ölçüm talebi bulunamadı');
        }
        if (this.isProducer(actor) && request.producerId !== actor.id) {
            throw new ForbiddenException('Bu talebe erişiminiz yok');
        }
        return this.withCoOwners(request);
    }

    async cancel(id: string, actor: PruningActor): Promise<MeasurementRequestView> {
        const request = await this.requestRepository.findOne({ where: { id } });
        if (!request) {
            throw new NotFoundException('Ölçüm talebi bulunamadı');
        }
        if (request.producerId !== actor.id && !this.isAdmin(actor)) {
            throw new ForbiddenException('Bu talep size ait değil');
        }
        if (request.status !== 'pending' && request.status !== 'scheduled') {
            throw new BadRequestException('Ölçümü yapılmış bir talep iptal edilemez');
        }
        request.status = 'cancelled';
        request.closedAt = new Date();
        const saved = await this.requestRepository.save(request);
        this.logger.log(`Measurement request ${id} cancelled by ${actor.id}`);
        return this.withCoOwners(saved);
    }

    async setAppointment(
        id: string,
        actor: PruningActor,
        dto: SetMeasurementAppointmentDto,
    ): Promise<MeasurementRequestView> {
        const request = await this.requireStaffAction(id, actor);
        if (request.status !== 'pending' && request.status !== 'scheduled') {
            throw new BadRequestException('Bu talep için randevu verilemez');
        }
        request.appointmentDate = dto.appointmentDate;
        request.appointedById = actor.id;
        request.appointedByName = await this.actorName(actor);
        request.status = 'scheduled';
        const saved = await this.requestRepository.save(request);
        this.logger.log(`Measurement request ${id} scheduled for ${dto.appointmentDate}`);
        return this.withCoOwners(saved);
    }

    async reject(id: string, actor: PruningActor, dto: RejectMeasurementRequestDto): Promise<MeasurementRequestView> {
        const request = await this.requireStaffAction(id, actor);
        if (!OPEN_MEASUREMENT_REQUEST_STATUSES.includes(request.status)) {
            throw new BadRequestException('Kapanmış bir talep reddedilemez');
        }
        request.notes = dto.reason?.trim() || 'Talep reddedildi.';
        request.status = 'rejected';
        request.closedAt = new Date();
        const saved = await this.requestRepository.save(request);
        this.logger.log(`Measurement request ${id} rejected`);
        return this.withCoOwners(saved);
    }

    // ── Helpers ──

    private async withCoOwners(request: LandMeasurementRequest): Promise<MeasurementRequestView> {
        const [view] = await this.withCoOwnersMany([request]);
        return view;
    }

    private async withCoOwnersMany(requests: LandMeasurementRequest[]): Promise<MeasurementRequestView[]> {
        const owners = await this.parcelOwners.findOwnersForMany(
            requests.map((r) => ({ province: r.il, adaNo: r.ada, parcelNo: r.parsel })),
        );
        return requests.map((r) => ({
            ...r,
            coOwners: (owners.get(parcelKeyOf({ province: r.il, adaNo: r.ada, parcelNo: r.parsel })) ?? [])
                .map(toParcelOwnerView),
        }));
    }

    private async requireStaffAction(id: string, actor: PruningActor): Promise<LandMeasurementRequest> {
        const request = await this.requestRepository.findOne({ where: { id } });
        if (!request) {
            throw new NotFoundException('Ölçüm talebi bulunamadı');
        }
        if (!this.isStaffApprover(actor)) {
            throw new ForbiddenException('Bu işlem için Çaykur yetkili personeli olmanız gerekir');
        }
        return request;
    }

    private async actorName(actor: PruningActor): Promise<string> {
        const user = await this.userRepository.findOne({ where: { id: actor.id } });
        return user?.fullName ?? 'Çaykur personeli';
    }

    private isStaff(actor: PruningActor): boolean {
        return actor.role === Role.ADMIN || actor.caykurRole != null;
    }

    private isAdmin(actor: PruningActor): boolean {
        return actor.role === Role.ADMIN;
    }

    private isProducerUserType(userType: UserType): boolean {
        return userType === UserType.LAND_OWNER || userType === UserType.SELF_FARMER;
    }

    private isProducer(actor: PruningActor): boolean {
        return actor.role !== Role.ADMIN && actor.caykurRole == null;
    }

    private isStaffApprover(actor: PruningActor): boolean {
        return (
            actor.role === Role.ADMIN ||
            actor.caykurRole === CaykurRole.KURUM_ADMIN ||
            actor.caykurRole === CaykurRole.FABRIKA_SORUMLUSU ||
            actor.caykurRole === CaykurRole.SAHA_PERSONELI
        );
    }
}
