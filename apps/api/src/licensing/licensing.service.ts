import {
    Injectable,
    Logger,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LicensingMeasurement, LicensingApproval, LicensingMeasurementSource } from '@/licensing/entities';
import {
    CreateLicensingMeasurementDto,
    CreateProducerBoundaryDto,
    DecideLicensingApprovalDto,
    LicensingMeasurementQueryDto,
    LicensingApprovalQueryDto,
} from '@/licensing/dto';
import { PruningRequest } from '@/pruning/entities';
import { PruningActor } from '@/pruning/pruning.service';
import { LandMeasurementRequest } from '@/measurement-requests/entities';
import { User } from '@/users/entities/user.entity';
import { ParcelOwnersService, ParcelOwner } from '@/fields/parcel-owners.service';
import { FieldsService } from '@/fields/fields.service';
import { FieldBoundaryService } from '@/fields/field-boundary.service';
import { MailService } from '@/mail/mail.service';
import { Role, CaykurRole } from '@/auth/enums';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

/** Parcel snapshot shared by both request kinds a staff measurement can start from. */
interface ParcelSnapshot {
    il: string;
    ilce: string;
    ada: string;
    parsel: string;
}

/**
 * Boundary determination (ruhsatlandırma) workflow on hisseli parcels. One
 * registered owner's slice is recorded — measured on site by Çaykur staff or
 * drawn by the owner on the satellite map — and the other registrants are
 * notified (e-mail + in-app). Each must approve before the slice is final;
 * only then is the owner's field updated (FieldBoundaryService).
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
        private readonly pruningRequestRepository: Repository<PruningRequest>,
        @InjectRepository(LandMeasurementRequest)
        private readonly measurementRequestRepository: Repository<LandMeasurementRequest>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly parcelOwners: ParcelOwnersService,
        private readonly fieldsService: FieldsService,
        private readonly fieldBoundary: FieldBoundaryService,
        private readonly mailService: MailService,
    ) {}

    // ── Staff: capture (from a budama request or a land measurement request) ──

    async create(actor: PruningActor, dto: CreateLicensingMeasurementDto): Promise<LicensingMeasurement> {
        if (!this.isStaffApprover(actor)) {
            throw new ForbiddenException('Ruhsatlandırma ölçümünü yalnızca Çaykur yetkili personeli yapabilir');
        }
        if (!!dto.pruningRequestId === !!dto.measurementRequestId) {
            throw new BadRequestException('Budama talebi ya da ölçüm talebi belirtilmelidir (yalnızca biri)');
        }
        if (dto.points.length < 3) {
            throw new BadRequestException('Alan oluşturmak için en az 3 köşe gereklidir');
        }

        const source: LicensingMeasurementSource = dto.measurementRequestId ? 'staff_request' : 'staff_pruning';
        const parcel = dto.measurementRequestId
            ? await this.loadMeasurementRequest(dto.measurementRequestId)
            : await this.loadPruningRequest(dto.pruningRequestId as string);

        const owners = await this.parcelOwners.findOwners({
            province: parcel.il,
            adaNo: parcel.ada,
            parcelNo: parcel.parsel,
        });
        const owner = await this.resolveOwner(dto.ownerId, owners);
        const approvers = owners.filter((o) => o.userId !== owner.id);
        const fieldId = owners.find((o) => o.userId === owner.id)?.fieldId ?? null;
        const measuredBy = await this.userRepository.findOne({ where: { id: actor.id } });

        await this.supersedePending(fieldId);

        const measurement = this.measurementRepository.create({
            source,
            pruningRequestId: dto.pruningRequestId ?? null,
            measurementRequestId: dto.measurementRequestId ?? null,
            fieldId,
            il: parcel.il,
            ilce: parcel.ilce,
            ada: parcel.ada,
            parsel: parcel.parsel,
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
            approvals: approvers.map((a) => this.newApproval(a)),
        });
        const saved = await this.measurementRepository.save(measurement);
        this.logger.log(
            `Licensing measurement ${saved.id} (${source}) created for owner ${owner.id} ` +
            `(${dto.measuredAreaM2} m², ${approvers.length} approver(s))`,
        );

        if (dto.measurementRequestId) {
            await this.measurementRequestRepository.update(
                { id: dto.measurementRequestId, status: In(['pending', 'scheduled']) },
                { status: 'measured' },
            );
        }
        if (saved.status === 'approved') {
            await this.onMeasurementApproved(saved);
        }

        await this.notifyApprovers(saved, approvers);
        return this.findOne(saved.id, actor);
    }

    // ── Producer: "Arazini Belirle" (drawn on the satellite map) ──

    async createProducerBoundary(actor: PruningActor, dto: CreateProducerBoundaryDto): Promise<LicensingMeasurement> {
        const field = await this.fieldsService.findOne(dto.fieldId, actor.id);
        if (field.userId !== actor.id) {
            throw new ForbiddenException('Yalnızca arazinin kayıtlı sahibi sınır belirleyebilir');
        }
        if (!field.adaNo || !field.parcelNo) {
            throw new BadRequestException('Arazinin ada/parsel bilgisi eksik');
        }
        if (dto.points.length < 3) {
            throw new BadRequestException('Alan oluşturmak için en az 3 köşe gereklidir');
        }

        const owners = await this.parcelOwners.findOwners({
            province: field.province,
            adaNo: field.adaNo,
            parcelNo: field.parcelNo,
        });
        const approvers = owners.filter((o) => o.userId !== actor.id);
        if (approvers.length === 0) {
            throw new BadRequestException('Bu arazi hisseli değil; sınır belirlemeye gerek yok');
        }
        const user = await this.userRepository.findOne({ where: { id: actor.id, deleted: false } });
        if (!user) {
            throw new NotFoundException('Kullanıcı bulunamadı');
        }

        await this.supersedePending(field.id);

        const measurement = this.measurementRepository.create({
            source: 'producer_map',
            pruningRequestId: null,
            measurementRequestId: null,
            fieldId: field.id,
            il: field.province,
            ilce: field.district,
            ada: field.adaNo,
            parsel: field.parcelNo,
            ownerId: user.id,
            ownerName: user.fullName,
            ownerCuzdanNo: user.cuzdanNo ?? null,
            measuredAreaM2: dto.measuredAreaM2,
            measurementPoints: dto.points,
            method: 'map',
            accuracyLevel: 'medium',
            fixQuality: null,
            measuredById: user.id,
            measuredByName: user.fullName,
            measuredAt: new Date(),
            notes: dto.notes?.trim() || null,
            status: 'pending_approval',
            resolvedAt: null,
            approvals: approvers.map((a) => this.newApproval(a)),
        });
        const saved = await this.measurementRepository.save(measurement);
        this.logger.log(
            `Producer boundary ${saved.id} drawn by ${user.id} for field ${field.id} ` +
            `(${dto.measuredAreaM2} m², ${approvers.length} approver(s))`,
        );

        await this.notifyApprovers(saved, approvers);
        return this.findOne(saved.id, actor);
    }

    private newApproval(owner: ParcelOwner): LicensingApproval {
        return this.approvalRepository.create({
            approverId: owner.userId,
            approverName: owner.fullName,
            status: 'pending',
        });
    }

    private async loadPruningRequest(id: string): Promise<ParcelSnapshot> {
        const request = await this.pruningRequestRepository.findOne({ where: { id } });
        if (!request) {
            throw new NotFoundException('Budama talebi bulunamadı');
        }
        return request;
    }

    private async loadMeasurementRequest(id: string): Promise<ParcelSnapshot> {
        const request = await this.measurementRequestRepository.findOne({ where: { id } });
        if (!request) {
            throw new NotFoundException('Ölçüm talebi bulunamadı');
        }
        if (request.status === 'rejected' || request.status === 'cancelled' || request.status === 'closed') {
            throw new BadRequestException('Kapanmış bir ölçüm talebi üzerine ölçüm kaydedilemez');
        }
        return request;
    }

    /**
     * A field can have at most one undecided boundary. Older pending
     * measurements are marked superseded and their still-pending approval
     * rows are dropped so the co-owners' inbox and badge stay clean.
     */
    private async supersedePending(fieldId: string | null): Promise<void> {
        if (!fieldId) return;
        const pending = await this.measurementRepository.find({ where: { fieldId, status: 'pending_approval' } });
        if (pending.length === 0) return;
        const ids = pending.map((m) => m.id);
        await this.approvalRepository.delete({ measurementId: In(ids), status: 'pending' });
        await this.measurementRepository.update(ids, { status: 'superseded', resolvedAt: new Date() });
        this.logger.log(`Superseded ${ids.length} pending measurement(s) for field ${fieldId}`);
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
                source: measurement.source === 'producer_map' ? 'producer' : 'staff',
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
        if (query.measurementRequestId) {
            qb.andWhere('m.measurementRequestId = :mrid', { mrid: query.measurementRequestId });
        }
        if (query.fieldId) {
            qb.andWhere('m.fieldId = :fid', { fid: query.fieldId });
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
        // Pending decisions first, newest first within each group. The CASE
        // must be selected under an alias: TypeORM treats a raw expression in
        // orderBy as an entity alias and throws "alias was not found".
        qb.addSelect(`CASE WHEN "a"."status" = 'pending' THEN 0 ELSE 1 END`, 'pending_first')
            .orderBy('pending_first', 'ASC')
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
        const measurement = await this.measurementRepository.findOne({ where: { id: measurementId } });
        if (!measurement || measurement.status !== 'pending_approval') return;

        const approvals = await this.approvalRepository.find({ where: { measurementId } });
        const anyRejected = approvals.some((a) => a.status === 'rejected');
        const allApproved = approvals.length > 0 && approvals.every((a) => a.status === 'approved');

        if (anyRejected || allApproved) {
            await this.measurementRepository.update(measurementId, {
                status: anyRejected ? 'rejected' : 'approved',
                resolvedAt: new Date(),
            });
            if (allApproved) {
                await this.onMeasurementApproved(measurement);
            }
        }
    }

    /**
     * Final step: the owner's field takes the approved slice, and the land
     * measurement request (if any) closes once the requesting producer's own
     * slice is settled.
     */
    private async onMeasurementApproved(measurement: LicensingMeasurement): Promise<void> {
        await this.fieldBoundary.applyApprovedBoundary(measurement);
        if (!measurement.measurementRequestId) return;
        const request = await this.measurementRequestRepository.findOne({ where: { id: measurement.measurementRequestId } });
        if (request && request.producerId === measurement.ownerId && request.status !== 'closed') {
            await this.measurementRequestRepository.update(request.id, { status: 'closed', closedAt: new Date() });
            this.logger.log(`Measurement request ${request.id} closed (owner slice approved)`);
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
