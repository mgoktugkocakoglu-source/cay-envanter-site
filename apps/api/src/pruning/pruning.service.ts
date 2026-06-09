import {
    Injectable,
    Logger,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PruningMeasurement, PruningTask, PruningStatus } from '@/pruning/entities';
import {
    CreatePruningMeasurementDto,
    UpdatePruningApprovalDto,
    AssignPruningTaskDto,
    PruningQueryDto,
} from '@/pruning/dto';
import { FieldsService } from '@/fields/fields.service';
import { Field } from '@/fields/entities';
import { Role, CaykurRole } from '@/auth/enums';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

/** The authenticated caller, projected from req.user (see jwt.strategy). */
export interface PruningActor {
    id: string;
    role: Role;
    caykurRole: CaykurRole | null;
}

@Injectable()
export class PruningService {
    private readonly logger = new Logger(PruningService.name);

    constructor(
        @InjectRepository(PruningMeasurement)
        private readonly measurementRepository: Repository<PruningMeasurement>,
        @InjectRepository(PruningTask)
        private readonly taskRepository: Repository<PruningTask>,
        private readonly fieldsService: FieldsService,
    ) { }

    // ── Measurements ──

    async create(actor: PruningActor, dto: CreatePruningMeasurementDto): Promise<PruningMeasurement> {
        if (this.isReadOnly(actor)) {
            throw new ForbiddenException('Denetçi rolü ölçüm oluşturamaz');
        }
        // Resolves with an access check (producer: own parcel; staff/admin: any).
        const field = await this.resolveField(dto.fieldId, actor);

        const measurement = this.measurementRepository.create({
            fieldId: dto.fieldId,
            userId: actor.id,
            method: dto.method,
            geometry: dto.geometry,
            prunedAreaM2: dto.prunedAreaM2,
            fieldAreaM2: dto.fieldAreaM2,
            ratioPercent: dto.ratioPercent,
            accuracyLevel: dto.accuracyLevel ?? null,
            fieldCheckDone: dto.fieldCheckDone ?? false,
            gpsAccuracyMeters: dto.gpsAccuracyMeters ?? null,
            photoUrl: dto.photoUrl ?? null,
            producerApproved: dto.producerApproved ?? false,
            staffApproved: dto.staffApproved ?? false,
            producerName: dto.producerName ?? this.resolveProducerName(field),
            parcelNo: dto.parcelNo ?? field.parcelNo ?? null,
            notes: dto.notes ?? null,
            measuredAt: dto.measuredAt ? new Date(dto.measuredAt) : new Date(),
            rejectionReason: null,
        });
        measurement.status = this.deriveStatus(measurement);

        const saved = await this.measurementRepository.save(measurement);

        if (dto.taskId) {
            await this.linkMeasurementToTask(dto.taskId, saved.id);
        }

        this.logger.log(`Pruning measurement created: ${saved.id} for field ${dto.fieldId} by ${actor.id}`);
        return saved;
    }

    async findByField(fieldId: string, actor: PruningActor): Promise<PruningMeasurement[]> {
        await this.resolveField(fieldId, actor);
        return this.measurementRepository.find({
            where: { fieldId },
            order: { measuredAt: 'DESC', createdAt: 'DESC' },
        });
    }

    async findOne(id: string, actor: PruningActor): Promise<PruningMeasurement> {
        const measurement = await this.measurementRepository.findOne({ where: { id } });
        if (!measurement) {
            throw new NotFoundException('Pruning measurement not found');
        }
        await this.resolveField(measurement.fieldId, actor);
        return measurement;
    }

    async updateApproval(
        id: string,
        actor: PruningActor,
        dto: UpdatePruningApprovalDto,
    ): Promise<PruningMeasurement> {
        const measurement = await this.findOne(id, actor);

        if (this.isReadOnly(actor)) {
            throw new ForbiddenException('Denetçi rolü onay değiştiremez');
        }

        // Rejection short-circuits the lifecycle.
        if (dto.rejectionReason) {
            measurement.rejectionReason = dto.rejectionReason;
            measurement.status = 'rejected';
            await this.measurementRepository.save(measurement);
            this.logger.log(`Pruning measurement rejected: ${id}`);
            return measurement;
        }

        if (dto.producerApproved !== undefined) {
            if (actor.role !== Role.ADMIN && !this.isProducer(actor)) {
                throw new ForbiddenException('Müstahsil onayını yalnızca parsel sahibi verebilir');
            }
            measurement.producerApproved = dto.producerApproved;
        }

        if (dto.staffApproved !== undefined) {
            if (!this.isStaffApprover(actor)) {
                throw new ForbiddenException('Personel onayını yalnızca Çaykur personeli verebilir');
            }
            measurement.staffApproved = dto.staffApproved;
        }

        // Re-approving clears a prior rejection.
        if (measurement.status === 'rejected') {
            measurement.rejectionReason = null;
        }
        measurement.status = this.deriveStatus(measurement);

        await this.measurementRepository.save(measurement);
        this.logger.log(`Pruning measurement approvals updated: ${id} → ${measurement.status}`);
        return measurement;
    }

    async remove(id: string, actor: PruningActor): Promise<void> {
        const measurement = await this.findOne(id, actor);
        if (this.isReadOnly(actor)) {
            throw new ForbiddenException('Denetçi rolü ölçüm silemez');
        }
        await this.measurementRepository.remove(measurement);
        this.logger.log(`Pruning measurement removed: ${id}`);
    }

    // ── Tasks (assignment + officer queue) ──

    async assignTask(actor: PruningActor, dto: AssignPruningTaskDto): Promise<PruningTask> {
        if (!this.isManager(actor)) {
            throw new ForbiddenException('Görev atama yetkiniz yok');
        }
        const field = await this.fieldsService.findOneRaw(dto.fieldId);

        const task = this.taskRepository.create({
            fieldId: dto.fieldId,
            producerId: field.userId,
            assignedTo: dto.assignedTo,
            assignedBy: actor.id,
            status: 'pending',
            measurementId: null,
            parcelNo: field.parcelNo ?? null,
            producerName: this.resolveProducerName(field),
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
            notes: dto.notes ?? null,
        });

        const saved = await this.taskRepository.save(task);
        this.logger.log(`Pruning task assigned: ${saved.id} → officer ${dto.assignedTo}`);
        return saved;
    }

    async listTasks(actor: PruningActor, query: PruningQueryDto): Promise<Paginated<PruningTask>> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;

        const qb = this.taskRepository.createQueryBuilder('task');

        // Field officers see only their own queue; managers / auditors / admin see all.
        if (actor.caykurRole === CaykurRole.SAHA_PERSONELI) {
            qb.andWhere('task.assignedTo = :uid', { uid: actor.id });
        }
        if (query.status) {
            qb.andWhere('task.status = :status', { status: query.status });
        }
        if (query.assignedTo) {
            qb.andWhere('task.assignedTo = :assignedTo', { assignedTo: query.assignedTo });
        }
        if (query.fieldId) {
            qb.andWhere('task.fieldId = :fieldId', { fieldId: query.fieldId });
        }

        qb.orderBy('task.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);

        const [tasks, total] = await qb.getManyAndCount();
        return paginate(tasks, total, page, limit);
    }

    async getTask(id: string, actor: PruningActor): Promise<PruningTask> {
        const task = await this.taskRepository.findOne({ where: { id } });
        if (!task) {
            throw new NotFoundException('Görev bulunamadı');
        }
        if (actor.caykurRole === CaykurRole.SAHA_PERSONELI && task.assignedTo !== actor.id) {
            throw new ForbiddenException('Bu görev size atanmamış');
        }
        return task;
    }

    private async linkMeasurementToTask(taskId: string, measurementId: string): Promise<void> {
        const task = await this.taskRepository.findOne({ where: { id: taskId } });
        if (!task) {
            return; // tolerate a stale/invalid task link
        }
        task.measurementId = measurementId;
        task.status = 'measured';
        await this.taskRepository.save(task);
    }

    // ── Helpers ──

    /** Owner-scoped lookup for producers; unrestricted for staff/admin. */
    private async resolveField(fieldId: string, actor: PruningActor): Promise<Field> {
        return this.isStaff(actor)
            ? this.fieldsService.findOneRaw(fieldId)
            : this.fieldsService.findOne(fieldId, actor.id);
    }

    private deriveStatus(m: PruningMeasurement): PruningStatus {
        if (m.status === 'rejected') return 'rejected';
        if (m.producerApproved && m.staffApproved) return 'completed';
        if (m.producerApproved) return 'producer_approved';
        if (m.staffApproved) return 'staff_approved';
        return 'measured';
    }

    private isStaff(actor: PruningActor): boolean {
        return actor.role === Role.ADMIN || actor.caykurRole != null;
    }

    private isProducer(actor: PruningActor): boolean {
        return actor.role !== Role.ADMIN && actor.caykurRole == null;
    }

    private isReadOnly(actor: PruningActor): boolean {
        return actor.caykurRole === CaykurRole.DENETCI;
    }

    private isStaffApprover(actor: PruningActor): boolean {
        return (
            actor.role === Role.ADMIN ||
            actor.caykurRole === CaykurRole.SAHA_PERSONELI ||
            actor.caykurRole === CaykurRole.FABRIKA_SORUMLUSU ||
            actor.caykurRole === CaykurRole.KURUM_ADMIN
        );
    }

    private isManager(actor: PruningActor): boolean {
        return (
            actor.role === Role.ADMIN ||
            actor.caykurRole === CaykurRole.KURUM_ADMIN ||
            actor.caykurRole === CaykurRole.FABRIKA_SORUMLUSU
        );
    }

    private resolveProducerName(field: Field): string | null {
        const primary = field.partners?.find((partner) => partner.isPrimaryOwner);
        return primary?.partnerName ?? field.partners?.[0]?.partnerName ?? field.name ?? null;
    }
}
