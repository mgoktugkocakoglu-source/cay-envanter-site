import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { CoverParcel, CoverTeaState, LandCoverBlock } from '@/tea-inventory/entities/land-cover.types';
import { LandCoverQueryDto } from '@/tea-inventory/dto';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

export interface LandCoverSummary extends Omit<LandCoverBlock, 'parcels'> {
    neighborhood: string;
}
export type LandCoverMapProperties = Pick<CoverParcel, 'key' | 'block' | 'parcel' | 'nature' | 'tea' | 'teaShare' | 'dominant' | 'confidence'> & { group: string | null };
export type LandCoverMap = FeatureCollection<Polygon | MultiPolygon, LandCoverMapProperties>;

/** Order of the list: tea first, then partial, then no tea, then parcels the grid cannot describe. */
const RANK: Record<CoverTeaState, number> = { present: 0, partial: 1, absent: 2, context: 3, not_assessable: 4 };

/** Land-cover module: read-only views of the engine's block. */
@Injectable()
export class LandCoverService {
    constructor(@InjectRepository(TeaInventoryArea) private readonly areaRepo: Repository<TeaInventoryArea>) { }

    async summary(areaId: string): Promise<LandCoverSummary> {
        const { block, neighborhood } = await this.load(areaId);
        const { parcels: _parcels, ...rest } = block;
        return { ...rest, unsupervised: rest.unsupervised ?? null, neighborhood };
    }

    async parcels(areaId: string, query: LandCoverQueryDto): Promise<Paginated<CoverParcel>> {
        const { block } = await this.load(areaId);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        let list = block.parcels;
        if (query.tea) list = list.filter((p) => p.tea === query.tea);
        if (query.dominant) list = list.filter((p) => p.dominant === query.dominant);
        const search = query.search?.trim().toLocaleLowerCase('tr');
        if (search) list = list.filter((p) => `${p.block}/${p.parcel}`.includes(search) || p.nature.toLocaleLowerCase('tr').includes(search) || p.locality.toLocaleLowerCase('tr').includes(search));
        const sorted = [...list].sort((a, b) => RANK[a.tea] - RANK[b.tea] || (b.teaShare ?? 0) - (a.teaShare ?? 0) || Number(a.block) - Number(b.block) || Number(a.parcel) - Number(b.parcel));
        return paginate(sorted.slice((page - 1) * limit, page * limit), sorted.length, page, limit);
    }

    /** Parcel outlines come from the licence audit block (the same cadastral geometries); parcels it lacks are left out. */
    async map(areaId: string): Promise<LandCoverMap> {
        const { block } = await this.load(areaId);
        const area = await this.areaRepo.findOne({ where: { id: areaId }, select: ['id', 'licenceAudit'] });
        const geometry = new Map((area?.licenceAudit?.parcels ?? []).map((p) => [p.key, p.geometry]));
        return {
            type: 'FeatureCollection',
            features: block.parcels.flatMap((p) => {
                const g = geometry.get(p.key);
                return g ? [{ type: 'Feature' as const, geometry: g, properties: { key: p.key, block: p.block, parcel: p.parcel, nature: p.nature, tea: p.tea, teaShare: p.teaShare, dominant: p.dominant, confidence: p.confidence, group: p.group ?? null } }] : [];
            }),
        };
    }

    private async load(areaId: string): Promise<{ block: LandCoverBlock; neighborhood: string }> {
        const area = await this.areaRepo.findOne({ where: { id: areaId }, select: ['id', 'neighborhood', 'landCover'] });
        if (!area) throw new NotFoundException('Area not found');
        // Bundles of the first, title-trained method have another shape and a misleading accuracy; they are not served.
        if (!area.landCover || area.landCover.version !== 2) throw new NotFoundException('No land-cover result for this area');
        return { block: area.landCover, neighborhood: area.neighborhood };
    }
}
