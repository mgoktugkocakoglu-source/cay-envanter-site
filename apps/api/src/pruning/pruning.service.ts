import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PruningMeasurement } from '@/pruning/entities';
import { CreatePruningMeasurementDto, UpdatePruningApprovalDto } from '@/pruning/dto';
import { FieldsService } from '@/fields/fields.service';
import { Field } from '@/fields/entities';

@Injectable()
export class PruningService {
    private readonly logger = new Logger(PruningService.name);

    constructor(
        @InjectRepository(PruningMeasurement)
        private readonly measurementRepository: Repository<PruningMeasurement>,
        private readonly fieldsService: FieldsService,
    ) {}

    async create(userId: string, dto: CreatePruningMeasurementDto): Promise<PruningMeasurement> {
        // Throws NotFound/Forbidden if the user cannot access this parcel.
        const field = await this.fieldsService.findOne(dto.fieldId, userId);

        const measurement = this.measurementRepository.create({
            fieldId: dto.fieldId,
            userId,
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
        });

        const saved = await this.measurementRepository.save(measurement);
        this.logger.log(`Pruning measurement created: ${saved.id} for field ${dto.fieldId} by ${userId}`);
        return saved;
    }

    async findByField(fieldId: string, userId: string): Promise<PruningMeasurement[]> {
        // Access check via the field.
        await this.fieldsService.findOne(fieldId, userId);
        return this.measurementRepository.find({
            where: { fieldId },
            order: { measuredAt: 'DESC', createdAt: 'DESC' },
        });
    }

    async findOne(id: string, userId: string): Promise<PruningMeasurement> {
        const measurement = await this.measurementRepository.findOne({ where: { id } });
        if (!measurement) {
            throw new NotFoundException('Pruning measurement not found');
        }
        // Access check via the parcel.
        await this.fieldsService.findOne(measurement.fieldId, userId);
        return measurement;
    }

    async updateApproval(
        id: string,
        userId: string,
        dto: UpdatePruningApprovalDto,
    ): Promise<PruningMeasurement> {
        const measurement = await this.findOne(id, userId);

        if (dto.producerApproved !== undefined) measurement.producerApproved = dto.producerApproved;
        if (dto.staffApproved !== undefined) measurement.staffApproved = dto.staffApproved;

        await this.measurementRepository.save(measurement);
        this.logger.log(`Pruning measurement approvals updated: ${id}`);
        return measurement;
    }

    async remove(id: string, userId: string): Promise<void> {
        const measurement = await this.findOne(id, userId);
        await this.measurementRepository.remove(measurement);
        this.logger.log(`Pruning measurement removed: ${id}`);
    }

    private resolveProducerName(field: Field): string | null {
        const primary = field.partners?.find((partner) => partner.isPrimaryOwner);
        return primary?.partnerName ?? field.partners?.[0]?.partnerName ?? field.name ?? null;
    }
}
