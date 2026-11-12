import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryGarden } from '@/tea-inventory/entities/tea-inventory-garden.entity';
import { TeaInventoryProducer } from '@/tea-inventory/entities/tea-inventory-producer.entity';
import { PixelGarden, PixelSeason, PixelVerdict } from '@/tea-inventory/entities/pixel-scan.types';
import { PixelScanGardenQueryDto } from '@/tea-inventory/dto';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

export type PixelScanSummary = Omit<PixelSeason, 'gardens'> & { seasons: string[] };

export interface PixelGardenRow extends Omit<PixelGarden, 'px' | 'series'> {
    code: string;
    block: string;
    parcel: string;
    locality: string;
    producerCode: string;
    producerName: string;
    areaM2: number;
}

export interface PixelGardenDetail extends PixelGardenRow {
    season: string;
    epsg: string;
    px: PixelGarden['px'];
    series: PixelGarden['series'];
    geometry: Record<string, unknown>;
}

const COUNTED: PixelVerdict[] = ['deep', 'light', 'pending'];
const FOUND: PixelVerdict[] = ['deep', 'light', 'pending', 'transient', 'weak'];

/** Pixel-scan module (Piksel taraması): lattice-level, undated step detection per garden. Read-only views of the engine's block. */
@Injectable()
export class PixelScanService {
    constructor(
        @InjectRepository(TeaInventoryArea) private readonly areaRepo: Repository<TeaInventoryArea>,
        @InjectRepository(TeaInventoryGarden) private readonly gardenRepo: Repository<TeaInventoryGarden>,
        @InjectRepository(TeaInventoryProducer) private readonly producerRepo: Repository<TeaInventoryProducer>,
    ) { }

    async summary(areaId: string, requested?: string): Promise<PixelScanSummary> {
        const { season, seasons } = await this.season(areaId, requested);
        const { gardens: _gardens, ...rest } = season;
        return { ...rest, seasons };
    }

    async gardens(areaId: string, query: PixelScanGardenQueryDto): Promise<Paginated<PixelGardenRow>> {
        const { season } = await this.season(areaId, query.season);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        let list = season.gardens;
        if (query.verdict === 'found') list = list.filter((g) => FOUND.includes(g.verdict));
        else if (query.verdict === 'counted') list = list.filter((g) => COUNTED.includes(g.verdict));
        else if (query.verdict) list = list.filter((g) => g.verdict === query.verdict);
        if (query.newOnly === 'true') list = list.filter((g) => COUNTED.includes(g.verdict) && (g.fusionClass === 'unclear' || g.fusionClass === 'not_pruned'));
        list = [...list].sort((a, b) => b.prunedM2 - a.prunedM2 || (b.best?.score ?? 0) - (a.best?.score ?? 0));
        const slice = list.slice((page - 1) * limit, page * limit);
        const info = await this.gardenInfo(areaId, season.season, slice.map((g) => g.id));
        return paginate(slice.map((g) => this.toRow(g, info)), list.length, page, limit);
    }

    async garden(areaId: string, code: string, requested?: string): Promise<PixelGardenDetail> {
        const { season } = await this.season(areaId, requested);
        const g = season.gardens.find((x) => x.id === code);
        if (!g) throw new NotFoundException('No pixel scan for this garden');
        const garden = await this.gardenRepo.findOne({ where: { areaId, code }, select: ['id', 'code', 'geometry'] });
        if (!garden) throw new NotFoundException('Garden not found');
        const info = await this.gardenInfo(areaId, season.season, [code]);
        return { ...this.toRow(g, info), season: season.season, epsg: season.epsg, px: g.px, series: g.series, geometry: garden.geometry };
    }

    private toRow(g: PixelGarden, info: Map<string, Omit<PixelGardenRow, keyof PixelGarden>>): PixelGardenRow {
        const { px: _px, series: _series, ...rest } = g;
        const i = info.get(g.id);
        return { ...rest, code: g.id, block: i?.block ?? '', parcel: i?.parcel ?? '', locality: i?.locality ?? '', producerCode: i?.producerCode ?? '', producerName: i?.producerName ?? '', areaM2: i?.areaM2 ?? 0 };
    }

    private async gardenInfo(areaId: string, season: string, codes: string[]): Promise<Map<string, Omit<PixelGardenRow, keyof PixelGarden>>> {
        const out = new Map<string, Omit<PixelGardenRow, keyof PixelGarden>>();
        if (codes.length === 0) return out;
        const gardens = await this.gardenRepo
            .createQueryBuilder('g')
            .select(['g.code', 'g.block', 'g.parcel', 'g.locality', 'g.producerCode', 'g.planimetricAreaM2'])
            .where('g.areaId = :areaId AND g.code IN (:...codes)', { areaId, codes })
            .getMany();
        const producers = await this.producerRepo.find({ where: { areaId, season }, select: ['code', 'name'] });
        const names = new Map(producers.map((p) => [p.code, p.name]));
        for (const g of gardens) {
            out.set(g.code, { code: g.code, block: g.block, parcel: g.parcel, locality: g.locality, producerCode: g.producerCode, producerName: names.get(g.producerCode) ?? '', areaM2: Math.round(g.planimetricAreaM2) });
        }
        return out;
    }

    private async season(areaId: string, requested?: string): Promise<{ season: PixelSeason; seasons: string[] }> {
        const area = await this.areaRepo.findOne({ where: { id: areaId }, select: ['id', 'pixelScan'] });
        if (!area) throw new NotFoundException('Area not found');
        const list = area.pixelScan?.seasons ?? [];
        if (list.length === 0) throw new NotFoundException('No pixel scan for this area');
        const seasons = list.map((s) => s.season).sort();
        // A running season is shown only when asked for: the default stays the latest finished one.
        const finished = list.filter((s) => !s.inProgress).map((s) => s.season).sort();
        const season = list.find((s) => s.season === requested) ?? (list.find((s) => s.season === (finished.at(-1) ?? seasons.at(-1))) as PixelSeason);
        return { season, seasons };
    }
}
