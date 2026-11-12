import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryGarden } from '@/tea-inventory/entities/tea-inventory-garden.entity';
import { TeaInventoryProducer } from '@/tea-inventory/entities/tea-inventory-producer.entity';
import { CombinedClass, CombinedGarden, CombinedProducer, CombinedSeason } from '@/tea-inventory/entities/pruning-combined.types';
import { CombinedGardenQueryDto, CombinedProducerQueryDto } from '@/tea-inventory/dto';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

export type CombinedSummary = Omit<CombinedSeason, 'gardens' | 'producers'> & { seasons: string[] };

export interface CombinedGardenRow extends CombinedGarden {
    code: string;
    block: string;
    parcel: string;
    locality: string;
    producerCode: string;
    producerName: string;
}

export interface CombinedProducerRow extends CombinedProducer {
    code: string;
    name: string;
    walletNo: string;
}

const POSITIVE: CombinedClass[] = ['confirmed', 'probable', 'light'];
const COUNTED: CombinedClass[] = ['confirmed', 'probable'];
const CLASS_RANK: Record<CombinedClass, number> = { confirmed: 4, probable: 3, light: 2, none: 1, no_data: 0 };

/** Combined pruning verdict (Birleşik karar): read-only views of the engine's block; it never changes the fusion or pixel-scan results. */
@Injectable()
export class PruningCombinedService {
    constructor(
        @InjectRepository(TeaInventoryArea) private readonly areaRepo: Repository<TeaInventoryArea>,
        @InjectRepository(TeaInventoryGarden) private readonly gardenRepo: Repository<TeaInventoryGarden>,
        @InjectRepository(TeaInventoryProducer) private readonly producerRepo: Repository<TeaInventoryProducer>,
    ) { }

    async summary(areaId: string, requested?: string): Promise<CombinedSummary> {
        const { season, seasons } = await this.season(areaId, requested);
        const { gardens: _gardens, producers: _producers, ...rest } = season;
        return { ...rest, seasons };
    }

    async gardens(areaId: string, query: CombinedGardenQueryDto): Promise<Paginated<CombinedGardenRow>> {
        const { season } = await this.season(areaId, query.season);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        let list = season.gardens;
        if (query.class === 'positive') list = list.filter((g) => POSITIVE.includes(g.class));
        else if (query.class === 'counted') list = list.filter((g) => COUNTED.includes(g.class));
        else if (query.class) list = list.filter((g) => g.class === query.class);
        list = [...list].sort((a, b) => CLASS_RANK[b.class] - CLASS_RANK[a.class] || (b.area?.m2 ?? 0) - (a.area?.m2 ?? 0));
        const slice = list.slice((page - 1) * limit, page * limit);
        const codes = slice.map((g) => g.id);
        const info = codes.length
            ? await this.gardenRepo
                .createQueryBuilder('g')
                .select(['g.code', 'g.block', 'g.parcel', 'g.locality', 'g.producerCode'])
                .where('g.areaId = :areaId AND g.code IN (:...codes)', { areaId, codes })
                .getMany()
            : [];
        const byCode = new Map(info.map((g) => [g.code, g]));
        const names = await this.producerNames(areaId, season.season);
        return paginate(
            slice.map((g) => {
                const i = byCode.get(g.id);
                return { ...g, code: g.id, block: i?.block ?? '', parcel: i?.parcel ?? '', locality: i?.locality ?? '', producerCode: g.producerId, producerName: names.get(g.producerId)?.name ?? '' };
            }),
            list.length,
            page,
            limit,
        );
    }

    async producers(areaId: string, query: CombinedProducerQueryDto): Promise<Paginated<CombinedProducerRow>> {
        const { season } = await this.season(areaId, query.season);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const open = (p: CombinedProducer) => p.status === 'met' || p.status === 'met_with_probable';
        let list = season.producers;
        if (query.status === 'active') list = list.filter((p) => p.status !== 'none' && p.status !== 'no_license');
        else if (query.status === 'open') list = list.filter(open);
        else if (query.status === 'changed') list = list.filter((p) => (p.fusionDecision === 'auto_open') !== open(p));
        else if (query.status) list = list.filter((p) => p.status === query.status);
        list = [...list].sort((a, b) => b.countedM2 - a.countedM2 || b.lightM2 - a.lightM2);
        const names = await this.producerNames(areaId, season.season);
        const slice = list.slice((page - 1) * limit, page * limit);
        return paginate(slice.map((p) => ({ ...p, code: p.id, name: names.get(p.id)?.name ?? '', walletNo: names.get(p.id)?.walletNo ?? '' })), list.length, page, limit);
    }

    private async producerNames(areaId: string, season: string): Promise<Map<string, { name: string; walletNo: string }>> {
        const producers = await this.producerRepo.find({ where: { areaId, season }, select: ['code', 'name', 'walletNo'] });
        return new Map(producers.map((p) => [p.code, { name: p.name, walletNo: p.walletNo }]));
    }

    private async season(areaId: string, requested?: string): Promise<{ season: CombinedSeason; seasons: string[] }> {
        const area = await this.areaRepo.findOne({ where: { id: areaId }, select: ['id', 'pruningCombined'] });
        if (!area) throw new NotFoundException('Area not found');
        const list = area.pruningCombined?.seasons ?? [];
        if (list.length === 0) throw new NotFoundException('No combined pruning verdict for this area');
        const seasons = list.map((s) => s.season).sort();
        const season = list.find((s) => s.season === requested) ?? (list.find((s) => s.season === seasons.at(-1)) as CombinedSeason);
        return { season, seasons };
    }
}
