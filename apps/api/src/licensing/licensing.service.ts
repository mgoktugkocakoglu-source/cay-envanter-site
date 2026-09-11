import {
    Injectable,
    Logger,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LicensingMeasurement, LicensingApproval } from '@/licensing/entities';
import {
    CreateLicensingMeasurementDto,
    DecideLicensingApprovalDto,
    LicensingMeasurementQueryDto,
    LicensingApprovalQueryDto,
} from '@/licensing/dto';
import { PruningRequest } from '@/pruning/entities';
import { PruningActor } from '@/pruning/pruning.service';
import { User } from '@/users/entities/user.entity';
import { ParcelOwnersService, ParcelOwner } from '@/fields/parcel-owners.service';
import { MailService } from '@/mail/mail.service';
import { Role, CaykurRole } from '@/auth/enums';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

/**
 * Ruhsatlandırma (licensing) workflow. On a hisseli parcel the authorized
 * person measures one registered owner's slice; the other registrants are
 * notified (e-mail + in-app) and each must approve before the measurement is
 * final. Saving a measurement therefore never means "approved".
 */
@Injectable()
export class LicensingService {
    private readonly logger = new Logger(LicensingService.name);

    constructor(
        @InjectRepository(LicensingMeasurement)
        private readonly measurementRepository: Repository<LicensingMeasurement>,
        @InjectRepository(LicensingApproval)
        private readonly approvalRepository: Repository<LicensingApproval>,
        @InjectRepository(PruningRequest)
        private readonly requestRepository: Repository<PruningRequest>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly parcelOwners: ParcelOwnersService,
        private readonly mailService: MailService,
    ) {}

    // ── Staff: capture ──

    async create(actor: PruningActor, dto: CreateLicensingMeasurementDto): Promise<LicensingMeasurement> {
        if (!this.isStaffApprover(actor)) {
            throw new ForbiddenException('Ruhsatlandırma ölçümünü yalnızca Çaykur yetkili personeli yapabilir');
        }
        const request = await this.requestRepository.findOne({ where: { id: dto.pruningRequestId } });
        if (!request) {
            throw new NotFoundException('Budama talebi bulunamadı');
        }
        if (dto.points.length < 3) {
            throw new BadRequestException('Alan oluşturmak için en az 3 köşe gereklidir');
        }

        const owners = await this.parcelOwners.findOwners({
            province: request.il,
            adaNo: request.ada,
            parcelNo: request.parsel,
        });
        const owner = await this.resolveOwner(dto.ownerId, owners);
        const approvers = owners.filter((o) => o.userId !== owner.id);
        const measuredBy = await this.userRepository.findOne({ where: { id: actor.id } });

        const measurement = this.measurementRepository.create({
            pruningRequestId: request.id,
            il: request.il,
            ilce: request.ilce,
            ada: request.ada,
            parsel: request.parsel,
            ownerId: owner.id,
            ownerName: owner.fullName,
            ownerCuzdanNo: owner.cuzdanNo ?? null,
            measuredAreaM2: dto.measuredAreaM2,
            measurementPoints: dto.points,
            method: dto.method,
            accuracyLevel: dto.accuracyLevel ?? null,
            fixQuality: dto.fixQuality ?? null,
            measuredById: actor.id,
            measuredByName: measuredBy?.fullName ?? 'Çaykur personeli',
            measuredAt: new Date(),
            notes: dto.notes ?? null,
            // No other registrant to ask ⇒ nothing to wait for.
            status: approvers.length === 0 ? 'approved' : 'pending_approval',
            resolvedAt: approvers.length === 0 ? new Date() : null,
            approvals: approvers.map((a) =>
                this.approvalRepository.create({
                    approverId: a.userId,
                    approverName: a.fullName,
                    status: 'pending',
                }),
            ),
        });
        const saved = await this.measurementRepository.save(measurement);
        this.logger.log(
            `Licensing measurement ${saved.id} created for owner ${owner.id} on request ${request.id} ` +
            `(${dto.measuredAreaM2} m², ${approvers.length} approver(s))`,
        );

        await this.notifyApprovers(saved, approvers);
        return this.findOne(saved.id, actor);
    }

    /** The measured owner is normally one of the parcel's registrants; any platform user is accepted. */
    private async resolveOwner(ownerId: string, owners: ParcelOwner[]): Promise<User> {
        const user = await this.userRepository.findOne({ where: { id: ownerId, deleted: false } });
        if (!user) {
            throw new NotFoundException('Seçilen sahip sistemde bulunamadı');
        }
        if (!owners.some((o) => o.userId === ownerId)) {
            this.logger.warn(`Licensing owner ${ownerId} is not a registrant of the parcel; accepted by staff choice`);
        }
        return user;
    }

    private async notifyApprovers(measurement: LicensingMeasurement, approvers: ParcelOwner[]): Promise<void> {
        const byUser = new Map(approvers.map((a) => [a.userId, a]));
        for (const approval of measurement.approvals ?? []) {
            const approver = byUser.get(approval.approverId);
            if (!approver?.email) continue;
            const sent = await this.mailService.sendLicensingApprovalRequestEmail(approver.email, approver.fullName, {
                ownerName: measurement.ownerName,
                il: measurement.il,
                ilce: measurement.ilce,
                ada: measurement.ada,
                parsel: measurement.parsel,
                measuredAreaM2: measurement.measuredAreaM2,
                measuredByName: measurement.measuredByName,
            });
            if (sent) {
                await this.approvalRepository.update(approval.id, { emailSent: true });
            }
        }
    }

    // ── Reads ──

    async list(actor: PruningActor, query: LicensingMeasurementQueryDto): Promise<Paginated<LicensingMeasurement>> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;

        const qb = this.measurementRepository
            .createQueryBuilder('m')
            .leftJoinAndSelect('m.approvals', 'approvals');

        if (!this.isStaff(actor)) {
            // Producers see measurements of their own slice or ones they must decide on.
            qb.andWhere(
                '(m.ownerId = :uid OR EXISTS (SELECT 1 FROM "licensing_approvals" "la" WHERE "la"."measurement_id" = "m"."id" AND "la"."approver_id" = :uid))',
                { uid: actor.id },
            );
        }
        if (query.pruningRequestId) {
            qb.andWhere('m.pruningRequestId = :rid', { rid: query.pruningRequestId });
        }
        if (query.status) {
            qb.andWhere('m.status = :status', { status: query.status });
        }

        qb.orderBy('m.createdAt', 'DESC')
            .addOrderBy('approvals.createdAt', 'ASC')
            .skip((page - 1) * limit)
            .take(limit);

        const [rows, total] = await qb.getManyAndCount();
        return paginate(rows, total, page, limit);
    }

    async findOne(id: string, actor: PruningActor): Promise<LicensingMeasurement> {
        const measurement = await this.measurementRepository.findOne({
            where: { id },
            relations: ['approvals'],
            order: { approvals: { createdAt: 'ASC' } },
        });
        if (!measurement) {
            throw new NotFoundException('Ruhsatlandırma ölçümü bulunamadı');
        }
        const involved =
            measurement.ownerId === actor.id ||
            (measurement.approvals ?? []).some((a) => a.approverId === actor.id);
        if (!this.isStaff(actor) && !involved) {
            throw new ForbiddenException('Bu ölçüme erişiminiz yok');
        }
        return measurement;
    }

    // ── Co-owner approvals (producer "Bildirimler") ──

    async listMyApprovals(actor: PruningActor, query: LicensingApprovalQueryDto): Promise<Paginated<LicensingApproval>> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;

        const qb = this.approvalRepository
            .createQueryBuilder('a')
            .leftJoinAndSelect('a.measurement', 'm')
            .where('a.approverId = :uid', { uid: actor.id });
        if (query.status) {
            qb.andWhere('a.status = :status', { status: query.status });
        }
        // Pending decisions first, newest first within each group.
        qb.orderBy(`CASE WHEN a.status = 'pending' THEN 0 ELSE 1 END`, 'ASC')
            .addOrderBy('a.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);

        const [rows, total] = await qb.getManyAndCount();
        return paginate(rows, total, page, limit);
    }

    async pendingApprovalCount(actor: PruningActor): Promise<{ count: number }> {
        const count = await this.approvalRepository.count({
            where: { approverId: actor.id, status: 'pending' },
        });
        return { count };
    }

    async decide(id: string, actor: PruningActor, dto: DecideLicensingApprovalDto): Promise<LicensingApproval> {
        const approval = await this.approvalRepository.findOne({ where: { id }, relations: ['measurement'] });
        if (!approval) {
            throw new NotFoundException('Onay talebi bulunamadı');
        }
        if (approval.approverId !== actor.id) {
            throw new ForbiddenException('Bu onay talebi size ait değil');
        }
        if (approval.status !== 'pending') {
            throw new BadRequestException('Bu onay talebi zaten karara bağlanmış');
        }

        approval.status = dto.decision;
        approval.decidedAt = new Date();
        approval.reason = dto.reason?.trim() || null;
        await this.approvalRepository.save(approval);
        await this.refreshMeasurementStatus(approval.measurementId);
        this.logger.log(`Licensing approval ${id} ${dto.decision} by ${actor.id}`);

        const updated = await this.approvalRepository.findOne({ where: { id }, relations: ['measurement'] });
        return updated ?? approval;
    }

    /** approved once every co-owner approved; rejected as soon as one rejects. */
    private async refreshMeasurementStatus(measurementId: string): Promise<void> {
        const approvals = await this.approvalRepository.find({ where: { measurementId } });
        const anyRejected = approvals.some((a) => a.status === 'rejected');
        const allApproved = approvals.length > 0 && approvals.every((a) => a.status === 'approved');

        if (anyRejected || allApproved) {
            await this.measurementRepository.update(measurementId, {
                status: anyRejected ? 'rejected' : 'approved',
                resolvedAt: new Date(),
            });
        }
    }

    // ── Role helpers (same matrix as the pruning-request workflow) ──

    private isStaff(actor: PruningActor): boolean {
        return actor.role === Role.ADMIN || actor.caykurRole != null;
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
