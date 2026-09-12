import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Field } from '@/fields/entities';

/** Identifies one cadastral parcel the way requests and fields store it. */
export interface ParcelKey {
    province: string;
    adaNo: string;
    parcelNo: string;
}

/**
 * A registered user who holds an active field registration on a parcel.
 * One entry per user (a user registering the same parcel twice counts once).
 */
export interface ParcelOwner {
    userId: string;
    fullName: string;
    email: string;
    cuzdanNo: string | null;
    ruhsatNo: string | null;
    phone: string | null;
    fieldId: string;
    fieldName: string;
    areaM2: number;
    /** "Alan no" once the owner's slice was approved (see FieldBoundaryService). */
    shareNo: number | null;
    boundaryDetermined: boolean;
}

/** Public projection of a ParcelOwner (no e-mail) for API responses. */
export type ParcelOwnerView = Omit<ParcelOwner, 'email'>;

export function parcelKeyOf(key: ParcelKey): string {
    return `${key.province.trim()}|${key.adaNo.trim()}|${key.parcelNo.trim()}`;
}

export function toParcelOwnerView(owner: ParcelOwner): ParcelOwnerView {
    const { email: _email, ...view } = owner;
    return view;
}

/**
 * Resolves who has registered a given province + ada + parsel. A parcel with
 * more than one registrant is a hisseli (shared-title) garden: several
 * producers, each with their own Çaykur cüzdan number, own slices of it.
 * Matching on province + ada + parsel mirrors the Çaykur field registry's
 * shared-title detection so both surfaces agree on what "hisseli" means.
 */
@Injectable()
export class ParcelOwnersService {
    constructor(
        @InjectRepository(Field)
        private readonly fieldRepository: Repository<Field>,
    ) {}

    async findOwners(key: ParcelKey): Promise<ParcelOwner[]> {
        const map = await this.findOwnersForMany([key]);
        return map.get(parcelKeyOf(key)) ?? [];
    }

    /** Batch lookup: owners per parcel key, for a page of requests in one query. */
    async findOwnersForMany(keys: ParcelKey[]): Promise<Map<string, ParcelOwner[]>> {
        const map = new Map<string, ParcelOwner[]>();
        const valid = keys.filter((k) => k.province?.trim() && k.adaNo?.trim() && k.parcelNo?.trim());
        if (valid.length === 0) return map;

        const rows = await this.fieldRepository
            .createQueryBuilder('f')
            .leftJoinAndSelect('f.user', 'u')
            .where('f.deleted = false')
            .andWhere('f.province IN (:...provinces)', { provinces: unique(valid.map((k) => k.province.trim())) })
            .andWhere('f.adaNo IN (:...adas)', { adas: unique(valid.map((k) => k.adaNo.trim())) })
            .andWhere('f.parcelNo IN (:...parcels)', { parcels: unique(valid.map((k) => k.parcelNo.trim())) })
            .orderBy('f.createdAt', 'ASC')
            .getMany();

        for (const f of rows) {
            if (!f.adaNo || !f.parcelNo || !f.user || f.user.deleted) continue;
            const key = parcelKeyOf({ province: f.province, adaNo: f.adaNo, parcelNo: f.parcelNo });
            const list = map.get(key) ?? [];
            if (list.some((o) => o.userId === f.userId)) continue;
            list.push({
                userId: f.userId,
                fullName: f.user.fullName,
                email: f.user.email,
                cuzdanNo: f.user.cuzdanNo ?? null,
                ruhsatNo: f.user.ruhsatNo ?? null,
                phone: f.user.phone ?? null,
                fieldId: f.id,
                fieldName: f.name,
                areaM2: fieldAreaM2(f),
                shareNo: f.shareNo ?? null,
                boundaryDetermined: f.boundaryMeasurementId != null,
            });
            map.set(key, list);
        }
        return map;
    }
}

function unique(values: string[]): string[] {
    return [...new Set(values)];
}

/** Field area normalized to m² (dekar/dönüm rows store 1 unit = 1000 m²). */
export function fieldAreaM2(field: Field): number {
    const area = Number(field.area) || 0;
    return field.areaUnit === 'm2' ? area : area * 1000;
}
