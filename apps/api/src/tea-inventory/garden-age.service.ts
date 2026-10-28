import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryParcel } from '@/tea-inventory/entities/tea-inventory-parcel.entity';
import { AgeBlock, ParcelAge } from '@/tea-inventory/entities/garden-age.types';
import { GardenAgeLayerQueryDto, GardenAgeParcelQueryDto } from '@/tea-inventory/dto';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

export interface GardenAgeParcelRow {
    id: string;
    key: string;
    block: string;
    parcel: string;
    nature: string;
    locality: string;
    areaM2: number;
    teaShare: number | null;
    establishmentYear: number | null;
    preRecord: boolean;
    confidence: ParcelAge['establishment']['confidence'];
    ageYears: number | null;
    ageClass: ParcelAge['ageClass'];
    renewals: number;
    lastRenewalYear: number | null;
    trendPerDecade: number | null;
    recentMean: number | null;
    declinePct: number | null;
    activity: ParcelAge['activity']['class'];
    dipsPerYear: number | null;
    abandonment: ParcelAge['abandonment']['class'];
    abandonmentScore: number;
    priority: ParcelAge['priority']['class'];
    priorityScore: number;
    priorityReasons: string[];
}

export interface GardenAgeParcelDetail extends GardenAgeParcelRow {
    geometry: Record<string, unknown>;
    age: ParcelAge;
}

/** Garden age module: read access to the engine's per-parcel age / renewal / abandonment evaluation. */
@Injectable()
export class GardenAgeService {
    constructor(
        @InjectRepository(TeaInventoryArea)
        private readonly areaRepo: Repository<TeaInventoryArea>,
        @InjectRepository(TeaInventoryParcel)
        private readonly parcelRepo: Repository<TeaInventoryParcel>,
    ) { }

    private async findArea(areaId: string): Promise<TeaInventoryArea & { age: AgeBlock }> {
        const area = await this.areaRepo.findOne({ where: { id: areaId } });
        if (!area) throw new NotFoundException('Area not found');
        if (!area.age) throw new NotFoundException('No garden-age evaluation for this area');
        return area as TeaInventoryArea & { age: AgeBlock };
    }

    async summary(areaId: string): Promise<AgeBlock> {
        const area = await this.findArea(areaId);
        return area.age;
    }

    private toRow(p: TeaInventoryParcel, a: ParcelAge): GardenAgeParcelRow {
        return {
            id: p.id,
            key: a.key,
            block: a.block,
            parcel: a.parcel,
            nature: a.nature,
            locality: p.locality ?? '',
            areaM2: a.areaM2,
            teaShare: a.teaShare,
            establishmentYear: a.establishment.year,
            preRecord: a.establishment.preRecord,
            confidence: a.establishment.confidence,
            ageYears: a.ageYears,
            ageClass: a.ageClass,
            renewals: a.renewals.length,
            lastRenewalYear: a.lastRenewalYear,
            trendPerDecade: a.vigour.trendPerDecade,
            recentMean: a.vigour.recentMean,
            declinePct: a.vigour.declinePct,
            activity: a.activity.class,
            dipsPerYear: a.activity.dipsPerYear,
            abandonment: a.abandonment.class,
            abandonmentScore: a.abandonment.score,
            priority: a.priority.class,
            priorityScore: a.priority.score,
            priorityReasons: a.priority.reasons,
        };
    }

    async parcels(areaId: string, query: GardenAgeParcelQueryDto): Promise<Paginated<GardenAgeParcelRow>> {
        await this.findArea(areaId);
        const all = await this.parcelRepo.find({ where: { areaId }, select: ['id', 'locality', 'age'] });
        const search = query.search?.trim().toLocaleLowerCase('tr-TR');
        let rows = all.filter((p): p is TeaInventoryParcel & { age: ParcelAge } => !!p.age).map((p) => this.toRow(p, p.age));
        rows = rows.filter((r) => {
            if (query.ageClass && r.ageClass !== query.ageClass) return false;
            if (query.activity && r.activity !== query.activity) return false;
            if (query.abandonment && r.abandonment !== query.abandonment) return false;
            if (query.priority && r.priority !== query.priority) return false;
            if (search && !`${r.block}/${r.parcel} ${r.nature} ${r.locality}`.toLocaleLowerCase('tr-TR').includes(search)) return false;
            return true;
        });
        const sort = query.sort ?? 'priority';
        rows.sort((a, b) => {
            if (sort === 'age') return (b.ageYears ?? -1) - (a.ageYears ?? -1);
            if (sort === 'abandonment') return b.abandonmentScore - a.abandonmentScore;
            if (sort === 'parcel') return Number(a.block) - Number(b.block) || Number(a.parcel) - Number(b.parcel);
            return b.priorityScore - a.priorityScore || (b.ageYears ?? 0) - (a.ageYears ?? 0);
        });
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        return paginate(rows.slice((page - 1) * limit, page * limit), rows.length, page, limit);
    }

    async parcel(areaId: string, parcelId: string): Promise<GardenAgeParcelDetail> {
        await this.findArea(areaId);
        const p = await this.parcelRepo.findOne({ where: { id: parcelId, areaId } });
        if (!p?.age) throw new NotFoundException('Parcel has no garden-age evaluation');
        return { ...this.toRow(p, p.age), geometry: p.geometry, age: p.age };
    }

    /** Map layer: every evaluated parcel with the fields the client colours by. */
    async layers(areaId: string, query: GardenAgeLayerQueryDto): Promise<unknown> {
        await this.findArea(areaId);
        void query;
        const all = await this.parcelRepo.find({ where: { areaId }, select: ['id', 'geometry', 'age'] });
        return {
            type: 'FeatureCollection',
            features: all
                .filter((p): p is TeaInventoryParcel & { age: ParcelAge } => !!p.age)
                .map((p) => ({
                    type: 'Feature',
                    geometry: p.geometry,
                    properties: {
                        id: p.id,
                        block: p.age.block,
                        parcel: p.age.parcel,
                        ageClass: p.age.ageClass,
                        ageYears: p.age.ageYears,
                        establishmentYear: p.age.establishment.year,
                        activity: p.age.activity.class,
                        abandonment: p.age.abandonment.class,
                        priority: p.age.priority.class,
                        priorityScore: p.age.priority.score,
                        lastRenewalYear: p.age.lastRenewalYear,
                    },
                })),
        };
    }
}
