import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { Field, AreaUnit } from '@/fields/entities';
import { Paginated, paginate } from '@/common/dto/paginated.dto';
import { CaykurFieldQueryDto, FieldSortKey } from '@/caykur/dto';

export type FieldPersonRole = 'owner' | 'partner';

/** A person attached to a field: the registering owner or a declared partner. */
export interface FieldPerson {
    name: string;
    role: FieldPersonRole;
    userId: string | null;
    phone: string | null;
    sharePercentage: number | null;
    invitationStatus: 'pending' | 'accepted' | 'rejected' | null;
}

/** Another user's registration of the same province + ada + parcel. */
export interface SharedRegistrant {
    fieldId: string;
    fieldName: string;
    userId: string;
    fullName: string;
}

export interface CaykurFieldRow {
    id: string;
    name: string;
    province: string;
    district: string;
    neighborhood: string;
    road: string | null;
    adaNo: string | null;
    parcelNo: string | null;
    area: number;
    areaUnit: AreaUnit;
    areaDekar: number;
    partnerCount: number;
    notes: string | null;
    hasGeometry: boolean;
    owner: {
        id: string;
        fullName: string;
        phone: string | null;
        ruhsatNo: string | null;
        cuzdanNo: string | null;
    };
    people: FieldPerson[];
    shared: boolean;
    sharedWith: SharedRegistrant[];
    createdAt: Date;
    updatedAt: Date;
}

export interface CaykurFieldsOverview {
    total: number;
    shared: number;
    withPartners: number;
    totalAreaDekar: number;
    provinces: Array<{ province: string; count: number }>;
    districts: Array<{ province: string; district: string; count: number }>;
}

/**
 * Raw SQL fragments. Column references are quoted by hand: TypeORM only
 * rewrites `alias.property` paths in specific positions, so relying on it
 * inside multi-line fragments silently produces invalid SQL.
 */

/** Area normalised to dekar (1 dönüm = 1 dekar = 1000 m²). */
const AREA_DEKAR_SQL =
    `CASE WHEN "field"."areaUnit" = 'm2' THEN "field"."area" / 1000 ELSE "field"."area" END`;

/**
 * True when at least one *other* user registered the same province + ada +
 * parcel — i.e. a hisseli (shared-title) garden entered by several people.
 */
const SHARED_EXISTS_SQL =
    'EXISTS (SELECT 1 FROM "fields" "other" WHERE "other"."deleted" = false' +
    ' AND "other"."id" <> "field"."id"' +
    ' AND "other"."user_id" <> "field"."user_id"' +
    ' AND "other"."province" = "field"."province"' +
    ' AND "other"."adaNo" = "field"."adaNo"' +
    ' AND "other"."parcelNo" = "field"."parcelNo")';

/** True when the owner declared at least one partner (ortak) on the field. */
const HAS_PARTNERS_SQL =
    'EXISTS (SELECT 1 FROM "field_partners" "fp" WHERE "fp"."field_id" = "field"."id")';

const SORT_SQL: Record<FieldSortKey, string> = {
    createdAt: 'field.createdAt',
    name: 'field.name',
    area: 'area_dekar',
    province: 'field.province',
    owner: 'owner.fullName',
    parcel: 'field.adaNo',
};

function toDekar(area: number, unit: AreaUnit): number {
    const n = Number(area) || 0;
    return unit === 'm2' ? n / 1000 : n;
}

function sharedKey(province: string, adaNo: string | null, parcelNo: string | null): string {
    return `${province}|${adaNo ?? ''}|${parcelNo ?? ''}`;
}

/**
 * Institution-wide field (parcel) registry for the Çaykur panel. Unlike the
 * producer-facing FieldsService this lists every user's fields; callers are
 * gated by CaykurRolesGuard at the controller.
 */
@Injectable()
export class CaykurFieldsService {
    constructor(
        @InjectRepository(Field)
        private readonly fieldRepository: Repository<Field>,
    ) { }

    async list(query: CaykurFieldQueryDto): Promise<Paginated<CaykurFieldRow>> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;

        const qb = this.baseQuery();
        this.applyFilters(qb, query);
        this.applySort(qb, query);

        qb.skip((page - 1) * limit).take(limit);

        const [rows, total] = await qb.getManyAndCount();
        const sharedMap = await this.sharedRegistrants(rows);

        return paginate(
            rows.map((f) => this.toRow(f, sharedMap)),
            total,
            page,
            limit,
        );
    }

    async overview(): Promise<CaykurFieldsOverview> {
        const active = this.fieldRepository
            .createQueryBuilder('field')
            .where('field.deleted = false');

        const totals = await active
            .clone()
            .select('COUNT(*)', 'total')
            .addSelect(`COUNT(*) FILTER (WHERE ${SHARED_EXISTS_SQL})`, 'shared')
            .addSelect(`COUNT(*) FILTER (WHERE ${HAS_PARTNERS_SQL})`, 'withPartners')
            .addSelect(`COALESCE(SUM(${AREA_DEKAR_SQL}), 0)`, 'totalAreaDekar')
            .getRawOne<{ total: string; shared: string; withPartners: string; totalAreaDekar: string }>();

        const provinces = await active
            .clone()
            .select('field.province', 'province')
            .addSelect('COUNT(*)', 'count')
            .groupBy('field.province')
            .orderBy('field.province', 'ASC')
            .getRawMany<{ province: string; count: string }>();

        const districts = await active
            .clone()
            .select('field.province', 'province')
            .addSelect('field.district', 'district')
            .addSelect('COUNT(*)', 'count')
            .groupBy('field.province')
            .addGroupBy('field.district')
            .orderBy('field.province', 'ASC')
            .addOrderBy('field.district', 'ASC')
            .getRawMany<{ province: string; district: string; count: string }>();

        return {
            total: Number(totals?.total ?? 0),
            shared: Number(totals?.shared ?? 0),
            withPartners: Number(totals?.withPartners ?? 0),
            totalAreaDekar: Number(totals?.totalAreaDekar ?? 0),
            provinces: provinces.map((p) => ({ province: p.province, count: Number(p.count) })),
            districts: districts.map((d) => ({
                province: d.province,
                district: d.district,
                count: Number(d.count),
            })),
        };
    }

    private baseQuery(): SelectQueryBuilder<Field> {
        return this.fieldRepository
            .createQueryBuilder('field')
            .leftJoinAndSelect('field.user', 'owner')
            .leftJoinAndSelect('field.partners', 'partners')
            .addSelect(AREA_DEKAR_SQL, 'area_dekar')
            .where('field.deleted = false');
    }

    private applyFilters(qb: SelectQueryBuilder<Field>, query: CaykurFieldQueryDto): void {
        const search = query.search?.trim();
        if (search) {
            qb.andWhere(new Brackets((w) => {
                w.where('field.name ILIKE :q', { q: `%${search}%` })
                    .orWhere('owner.fullName ILIKE :q')
                    .orWhere('field.neighborhood ILIKE :q')
                    .orWhere('field.district ILIKE :q')
                    .orWhere('field.adaNo ILIKE :q')
                    .orWhere('field.parcelNo ILIKE :q')
                    .orWhere('partners.partnerName ILIKE :q');
            }));
        }

        const province = query.province?.trim();
        if (province) qb.andWhere('field.province = :province', { province });

        const district = query.district?.trim();
        if (district) qb.andWhere('field.district = :district', { district });

        const neighborhood = query.neighborhood?.trim();
        if (neighborhood) {
            qb.andWhere('field.neighborhood ILIKE :neighborhood', { neighborhood: `%${neighborhood}%` });
        }

        const adaNo = query.adaNo?.trim();
        if (adaNo) qb.andWhere('field.adaNo = :adaNo', { adaNo });

        const parcelNo = query.parcelNo?.trim();
        if (parcelNo) qb.andWhere('field.parcelNo = :parcelNo', { parcelNo });

        switch (query.ownership) {
            case 'shared':
                qb.andWhere(SHARED_EXISTS_SQL);
                break;
            case 'partnered':
                qb.andWhere(HAS_PARTNERS_SQL);
                break;
            case 'single':
                qb.andWhere(`NOT ${HAS_PARTNERS_SQL}`).andWhere(`NOT ${SHARED_EXISTS_SQL}`);
                break;
            default:
                break;
        }

        if (query.minAreaDekar !== undefined) {
            qb.andWhere(`${AREA_DEKAR_SQL} >= :minArea`, { minArea: query.minAreaDekar });
        }
        if (query.maxAreaDekar !== undefined) {
            qb.andWhere(`${AREA_DEKAR_SQL} <= :maxArea`, { maxArea: query.maxAreaDekar });
        }

        if (query.createdFrom) {
            qb.andWhere('field.createdAt >= :createdFrom', { createdFrom: query.createdFrom });
        }
        if (query.createdTo) {
            // A plain date input means "through the end of that day".
            const end = new Date(query.createdTo);
            if (query.createdTo.length <= 10) end.setUTCHours(23, 59, 59, 999);
            qb.andWhere('field.createdAt <= :createdTo', { createdTo: end.toISOString() });
        }
    }

    private applySort(qb: SelectQueryBuilder<Field>, query: CaykurFieldQueryDto): void {
        const sortBy = query.sortBy ?? 'createdAt';
        const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

        qb.orderBy(SORT_SQL[sortBy], sortOrder, 'NULLS LAST');
        if (sortBy === 'parcel') {
            qb.addOrderBy('field.parcelNo', sortOrder, 'NULLS LAST');
        }
        if (sortBy !== 'createdAt') {
            qb.addOrderBy('field.createdAt', 'DESC');
        }
    }

    /**
     * For the fields on the current page, load every active registration of
     * the same province + ada + parcel (own row included), keyed by the triple.
     */
    private async sharedRegistrants(rows: Field[]): Promise<Map<string, SharedRegistrant[]>> {
        const map = new Map<string, SharedRegistrant[]>();
        const keyed = rows.filter((f) => f.adaNo && f.parcelNo);
        if (keyed.length === 0) return map;

        const others = await this.fieldRepository
            .createQueryBuilder('f')
            .leftJoinAndSelect('f.user', 'u')
            .where('f.deleted = false')
            .andWhere('f.province IN (:...provinces)', { provinces: [...new Set(keyed.map((f) => f.province))] })
            .andWhere('f.adaNo IN (:...adas)', { adas: [...new Set(keyed.map((f) => f.adaNo))] })
            .andWhere('f.parcelNo IN (:...parcels)', { parcels: [...new Set(keyed.map((f) => f.parcelNo))] })
            .getMany();

        for (const f of others) {
            const key = sharedKey(f.province, f.adaNo, f.parcelNo);
            const list = map.get(key) ?? [];
            list.push({
                fieldId: f.id,
                fieldName: f.name,
                userId: f.userId,
                fullName: f.user?.fullName ?? '—',
            });
            map.set(key, list);
        }
        return map;
    }

    private toRow(f: Field, sharedMap: Map<string, SharedRegistrant[]>): CaykurFieldRow {
        const registrants = f.adaNo && f.parcelNo
            ? (sharedMap.get(sharedKey(f.province, f.adaNo, f.parcelNo)) ?? [])
            : [];
        const sharedWith = registrants.filter((r) => r.userId !== f.userId);

        const people: FieldPerson[] = [
            {
                name: f.user?.fullName ?? '—',
                role: 'owner',
                userId: f.userId,
                phone: f.user?.phone ?? null,
                sharePercentage: null,
                invitationStatus: null,
            },
            ...(f.partners ?? []).map<FieldPerson>((p) => ({
                name: p.partnerName,
                role: 'partner',
                userId: null,
                phone: p.partnerPhone,
                sharePercentage: p.sharePercentage === null ? null : Number(p.sharePercentage),
                invitationStatus: p.invitationStatus,
            })),
        ];

        return {
            id: f.id,
            name: f.name,
            province: f.province,
            district: f.district,
            neighborhood: f.neighborhood,
            road: f.road,
            adaNo: f.adaNo,
            parcelNo: f.parcelNo,
            area: Number(f.area),
            areaUnit: f.areaUnit,
            areaDekar: toDekar(f.area, f.areaUnit),
            partnerCount: f.partnerCount,
            notes: f.notes,
            hasGeometry: Array.isArray(f.coordinates) && f.coordinates.length > 0,
            owner: {
                id: f.userId,
                fullName: f.user?.fullName ?? '—',
                phone: f.user?.phone ?? null,
                ruhsatNo: f.user?.ruhsatNo ?? null,
                cuzdanNo: f.user?.cuzdanNo ?? null,
            },
            people,
            shared: sharedWith.length > 0,
            sharedWith,
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
        };
    }
}
