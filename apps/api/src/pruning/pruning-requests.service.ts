import {
    Injectable,
    Logger,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PruningRequest } from '@/pruning/entities';
import { User } from '@/users/entities/user.entity';
import { Field } from '@/fields/entities';
import {
    CreatePruningRequestDto,
    SetPruningAppointmentDto,
    SavePruningMeasurementResultDto,
    RejectPruningRequestDto,
    PruningRequestQueryDto,
} from '@/pruning/dto';
import { Role, CaykurRole, UserType } from '@/auth/enums';
import { Paginated, paginate } from '@/common/dto/paginated.dto';
import { PruningActor } from '@/pruning/pruning.service';

/**
 * Budama talepleri workflow service. Producers open requests; Çaykur authorized
 * staff set an appointment, capture the 3D measurement, and approve/reject —
 * all persisted in Postgres (single source of truth for both surfaces).
 * Platform admins (Role.ADMIN) bypass every restriction and can perform any action.
 */
@Injectable()
export class PruningRequestsService {
    private readonly logger = new Logger(PruningRequestsService.name);

    constructor(
        @InjectRepository(PruningRequest)
        private readonly requestRepository: Repository<PruningRequest>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Field)
        private readonly fieldRepository: Repository<Field>,
    ) {}

    async create(actor: PruningActor, dto: CreatePruningRequestDto): Promise<PruningRequest> {
        const user = await this.userRepository.findOne({ where: { id: actor.id } });

        // Producer account types may open a request; platform admin is always exempt.
        if (
            !this.isAdmin(actor) &&
            (this.isStaff(actor) || !user || !this.isProducerUserType(user.userType))
        ) {
            throw new ForbiddenException('Budama talebini yalnızca üretici oluşturabilir');
        }
        // When the producer has this ada/parsel registered as a field, its
        // outline and area back the request so the measure map can show them.
        let parcelGeometry = dto.parcelGeometry ?? null;
        let registeredAreaM2 = dto.registeredAreaM2 ?? 0;
        if (!parcelGeometry || !registeredAreaM2) {
            const field = await this.fieldRepository.findOne({
                where: { userId: actor.id, adaNo: dto.ada, parcelNo: dto.parsel, deleted: false },
            });
            if (field) {
                if (!parcelGeometry) parcelGeometry = field.coordinates?.[0] ?? null;
                if (!registeredAreaM2) registeredAreaM2 = this.fieldAreaM2(field);
            }
        }

        const request = this.requestRepository.create({
            producerId: actor.id,
            producerName: user?.fullName ?? 'Müstahsil',
            il: dto.il,
            ilce: dto.ilce,
            ada: dto.ada,
            parsel: dto.parsel,
            registeredAreaM2,
            parcelGeometry,
            status: 'pending',
            measurementPoints: [],
        });
        const saved = await this.requestRepository.save(request);
        this.logger.log(`Pruning request created: ${saved.id} by producer ${actor.id}`);
        return saved;
    }

    /** Field area normalized to m² (dekar/dönüm rows store 1 unit = 1000 m²). */
    private fieldAreaM2(field: Field): number {
        const area = Number(field.area) || 0;
        return field.areaUnit === 'm2' ? area : area * 1000;
    }

    async list(actor: PruningActor, query: PruningRequestQueryDto): Promise<Paginated<PruningRequest>> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 50;

        const qb = this.requestRepository.createQueryBuilder('req');

        // Producers see only their own requests; staff/admin see all.
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
        return paginate(rows, total, page, limit);
    }

    async findOne(id: string, actor: PruningActor): Promise<PruningRequest> {
        const request = await this.requestRepository.findOne({ where: { id } });
        if (!request) {
            throw new NotFoundException('Budama talebi bulunamadı');
        }
        if (this.isProducer(actor) && request.producerId !== actor.id) {
            throw new ForbiddenException('Bu talebe erişiminiz yok');
        }
        return request;
    }

    async setAppointment(
        id: string,
        actor: PruningActor,
        dto: SetPruningAppointmentDto,
    ): Promise<PruningRequest> {
        const request = await this.requireStaffAction(id, actor);
        request.appointmentDate = dto.appointmentDate;
        request.appointedById = actor.id;
        request.appointedByName = await this.actorName(actor);
        request.status = 'scheduled';
        const saved = await this.requestRepository.save(request);
        this.logger.log(`Pruning request ${id} scheduled for ${dto.appointmentDate}`);
        return saved;
    }

    async saveMeasurement(
        id: string,
        actor: PruningActor,
        dto: SavePruningMeasurementResultDto,
    ): Promise<PruningRequest> {
        const request = await this.requireStaffAction(id, actor);
        request.measuredAreaM2 = dto.measuredAreaM2;
        request.measurementPoints = dto.points;
        request.method = dto.method;
        request.accuracyLevel = dto.accuracyLevel ?? null;
        request.fixQuality = dto.fixQuality ?? null;
        request.measuredAt = new Date();
        request.measuredById = actor.id;
        request.measuredByName = await this.actorName(actor);
        request.status = 'measured';
        const saved = await this.requestRepository.save(request);
        this.logger.log(`Pruning request ${id} measured (${dto.measuredAreaM2} m²)`);
        return saved;
    }

    async approve(id: string, actor: PruningActor): Promise<PruningRequest> {
        const request = await this.requireStaffAction(id, actor);
        request.approvedAt = new Date();
        request.approvedByName = await this.actorName(actor);
        request.status = 'approved';
        const saved = await this.requestRepository.save(request);
        this.logger.log(`Pruning request ${id} approved`);
        return saved;
    }

    async reject(id: string, actor: PruningActor, dto: RejectPruningRequestDto): Promise<PruningRequest> {
        const request = await this.requireStaffAction(id, actor);
        request.approvedByName = await this.actorName(actor);
        request.notes = dto.reason ?? 'Talep reddedildi.';
        request.status = 'rejected';
        const saved = await this.requestRepository.save(request);
        this.logger.log(`Pruning request ${id} rejected`);
        return saved;
    }

    // ── Helpers ──

    private async requireStaffAction(id: string, actor: PruningActor): Promise<PruningRequest> {
        const request = await this.requestRepository.findOne({ where: { id } });
        if (!request) {
            throw new NotFoundException('Budama talebi bulunamadı');
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

    /** Platform admin — god mode, bypasses every pruning-request restriction. */
    private isAdmin(actor: PruningActor): boolean {
        return actor.role === Role.ADMIN;
    }

    private isProducerUserType(userType: UserType): boolean {
        return userType === UserType.LAND_OWNER || userType === UserType.SELF_FARMER;
    }

    private isProducer(actor: PruningActor): boolean {
        return actor.role !== Role.ADMIN && actor.caykurRole == null;
    }

    /** Roles that may schedule, measure and decide on a request. */
    private isStaffApprover(actor: PruningActor): boolean {
        return (
            actor.role === Role.ADMIN ||
            actor.caykurRole === CaykurRole.KURUM_ADMIN ||
            actor.caykurRole === CaykurRole.FABRIKA_SORUMLUSU ||
            actor.caykurRole === CaykurRole.SAHA_PERSONELI
        );
    }
}
