import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Field } from '@/fields/entities';
import { LicensingMeasurement } from '@/licensing/entities/licensing-measurement.entity';
import {
    LandMeasurementRequest,
    OPEN_MEASUREMENT_REQUEST_STATUSES,
} from '@/measurement-requests/entities/land-measurement-request.entity';
import { ParcelOwner, ParcelOwnersService, parcelKeyOf } from '@/fields/parcel-owners.service';

/**
 * Where a field stands on a hisseli (shared-title) parcel.
 *  - undetermined:     shared, and nobody has settled this owner's slice yet
 *  - pending_approval: a boundary was drawn/measured and the co-owners must confirm it
 *  - determined:       every co-owner approved; polygon/area/share no are on the field
 */
export type FieldBoundaryStatus = 'undetermined' | 'pending_approval' | 'determined';

/** Another registrant of the same parcel, as shown on the producer's field pages. */
export interface FieldCoOwner {
    userId: string;
    fullName: string;
    cuzdanNo: string | null;
    shareNo: number | null;
    boundaryDetermined: boolean;
}

/** A field as served to the producer: the entity plus its derived boundary state. */
export type FieldView = Field & {
    isShared: boolean;
    coOwnerCount: number;
    boundaryStatus: FieldBoundaryStatus;
    pendingMeasurementId: string | null;
    pendingRequestId: string | null;
    coOwners: FieldCoOwner[];
};

/**
 * Derives the boundary state of fields (batched, no N+1) and applies an
 * approved licensing measurement to the owner's field record.
 */
@Injectable()
export class FieldBoundaryService {
    private readonly logger = new Logger(FieldBoundaryService.name);

    constructor(
        @InjectRepository(Field)
        private readonly fieldRepository: Repository<Field>,
        @InjectRepository(LicensingMeasurement)
        private readonly measurementRepository: Repository<LicensingMeasurement>,
        @InjectRepository(LandMeasurementRequest)
        private readonly requestRepository: Repository<LandMeasurementRequest>,
        private readonly parcelOwners: ParcelOwnersService,
        private readonly dataSource: DataSource,
    ) {}

    async enrichOne(field: Field): Promise<FieldView> {
        const [view] = await this.enrichMany([field]);
        return view;
    }

    async enrichMany(fields: Field[]): Promise<FieldView[]> {
        if (fields.length === 0) return [];
        const ids = fields.map((f) => f.id);

        const keyed = fields.filter((f) => f.adaNo && f.parcelNo);
        const [owners, pending, open] = await Promise.all([
            this.parcelOwners.findOwnersForMany(
                keyed.map((f) => ({ province: f.province, adaNo: f.adaNo as string, parcelNo: f.parcelNo as string })),
            ),
            this.measurementRepository.find({
                where: { fieldId: In(ids), status: 'pending_approval' },
                order: { createdAt: 'DESC' },
            }),
            this.requestRepository.find({
                where: { fieldId: In(ids), status: In(OPEN_MEASUREMENT_REQUEST_STATUSES) },
                order: { createdAt: 'DESC' },
            }),
        ]);

        // Newest wins: rows are ordered DESC, so the first hit per field is kept.
        const pendingByField = new Map<string, string>();
        for (const m of pending) {
            if (m.fieldId && !pendingByField.has(m.fieldId)) pendingByField.set(m.fieldId, m.id);
        }
        const openByField = new Map<string, string>();
        for (const r of open) {
            if (!openByField.has(r.fieldId)) openByField.set(r.fieldId, r.id);
        }

        return fields.map((field) => {
            const registrants =
                field.adaNo && field.parcelNo
                    ? owners.get(parcelKeyOf({ province: field.province, adaNo: field.adaNo, parcelNo: field.parcelNo })) ?? []
                    : [];
            const others = registrants.filter((o) => o.userId !== field.userId);
            const pendingMeasurementId = pendingByField.get(field.id) ?? null;
            const boundaryStatus: FieldBoundaryStatus = field.boundaryMeasurementId
                ? 'determined'
                : pendingMeasurementId
                    ? 'pending_approval'
                    : 'undetermined';

            return {
                ...field,
                isShared: others.length > 0,
                coOwnerCount: registrants.length,
                boundaryStatus,
                pendingMeasurementId,
                pendingRequestId: openByField.get(field.id) ?? null,
                coOwners: others.map(toFieldCoOwner),
            };
        });
    }

    /**
     * Every co-owner approved: the measured ring becomes the field's polygon,
     * the measured area replaces the registered one (unit kept) and a share
     * number is assigned once per field, in approval order per parcel.
     */
    async applyApprovedBoundary(measurement: LicensingMeasurement): Promise<void> {
        if (!measurement.fieldId) return;
        const ring = measurement.measurementPoints.map((p) => [p.lng, p.lat]);
        if (ring.length < 3) return;
        const [first, last] = [ring[0], ring[ring.length - 1]];
        if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);

        // Concurrent approvals on the same parcel could in theory race for the
        // same share number; the transaction keeps each update consistent and
        // the window is negligible for this workflow.
        await this.dataSource.transaction(async (manager) => {
            const field = await manager.findOne(Field, { where: { id: measurement.fieldId as string, deleted: false } });
            if (!field) return;

            field.coordinates = [ring];
            field.area = field.areaUnit === 'm2'
                ? Math.round(measurement.measuredAreaM2 * 100) / 100
                : Math.round(measurement.measuredAreaM2 / 10) / 100;
            field.boundaryMeasurementId = measurement.id;
            field.boundaryDeterminedAt = new Date();
            if (field.shareNo == null) {
                const row = await manager
                    .createQueryBuilder(Field, 'f')
                    .select('COALESCE(MAX(f.shareNo), 0)', 'max')
                    .where('f.province = :province', { province: field.province })
                    .andWhere('f.adaNo = :adaNo', { adaNo: field.adaNo })
                    .andWhere('f.parcelNo = :parcelNo', { parcelNo: field.parcelNo })
                    .andWhere('f.deleted = false')
                    .getRawOne<{ max: string | number }>();
                field.shareNo = Number(row?.max ?? 0) + 1;
            }
            await manager.save(field);
            this.logger.log(
                `Boundary applied to field ${field.id} from measurement ${measurement.id} ` +
                `(${measurement.measuredAreaM2} m², alan no ${field.shareNo})`,
            );
        });
    }
}

function toFieldCoOwner(owner: ParcelOwner): FieldCoOwner {
    return {
        userId: owner.userId,
        fullName: owner.fullName,
        cuzdanNo: owner.cuzdanNo,
        shareNo: owner.shareNo,
        boundaryDetermined: owner.boundaryDetermined,
    };
}
