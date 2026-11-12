import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryGarden } from '@/tea-inventory/entities/tea-inventory-garden.entity';
import { TeaInventoryProducer } from '@/tea-inventory/entities/tea-inventory-producer.entity';
import { CombinedClass, CombinedFollowUp, CombinedGarden, CombinedHistory, CombinedHistoryProducer, CombinedHistorySeason, CombinedProducer, CombinedSeason, FollowUpStatus, RepeatedGround } from '@/tea-inventory/entities/pruning-combined.types';
import { CombinedGardenQueryDto, CombinedProducerQueryDto } from '@/tea-inventory/dto';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

/** The retrospective check of the selected season plus the multi-year roll-up; null until pruning-history has run. */
export interface CombinedHistorySummary {
    generatedAt: string;
    method: string;
    rules: Record<string, number>;
    season: CombinedHistorySeason | null;
    multiYear: CombinedHistory['multiYear'];
}
export type CombinedSummary = Omit<CombinedSeason, 'gardens' | 'producers'> & { seasons: string[]; liveSeason: string | null; history: CombinedHistorySummary | null };

export interface CombinedGardenRow extends CombinedGarden {
    code: string;
    block: string;
    parcel: string;
    locality: string;
    producerCode: string;
    producerName: string;
    followUp: CombinedFollowUp | null;
    repeatedGround: RepeatedGround[];
}

export interface CombinedProducerRow extends CombinedProducer {
    code: string;
    name: string;
    walletNo: string;
    multiYear: Omit<CombinedHistoryProducer, 'id' | 'licensedAreaM2'> | null;
}

const POSITIVE: CombinedClass[] = ['confirmed', 'probable', 'light'];
const COUNTED: CombinedClass[] = ['confirmed', 'probable'];
const CLASS_RANK: Record<CombinedClass, number> = { confirmed: 5, probable: 4, light: 3, seasonal: 2, none: 1, no_data: 0 };
/** Follow-up outcomes that do not behave like a pruning. */
const DOUBTFUL: FollowUpStatus[] = ['permanent', 'repeating', 'not_seen'];
/** "Recent" = the cut's bracket closed within this many days of the season's last image. */
const RECENT_DAYS = 35;
const DAY = 86_400_000;

/** Combined pruning verdict (Birleşik karar): read-only views of the engine's block; it never changes the fusion or pixel-scan results. */
@Injectable()
export class PruningCombinedService {
    constructor(
        @InjectRepository(TeaInventoryArea) private readonly areaRepo: Repository<TeaInventoryArea>,
        @InjectRepository(TeaInventoryGarden) private readonly gardenRepo: Repository<TeaInventoryGarden>,
        @InjectRepository(TeaInventoryProducer) private readonly producerRepo: Repository<TeaInventoryProducer>,
    ) { }

    async summary(areaId: string, requested?: string): Promise<CombinedSummary> {
        const { season, seasons, history, liveSeason } = await this.load(areaId, requested);
        const { gardens: _gardens, producers: _producers, ...rest } = season;
        const summary: CombinedHistorySummary | null = history
            ? { generatedAt: history.generatedAt, method: history.method, rules: history.rules, season: history.seasons.find((s) => s.season === season.season) ?? null, multiYear: history.multiYear }
            : null;
        return { ...rest, seasons, liveSeason, history: summary };
    }

    async gardens(areaId: string, query: CombinedGardenQueryDto): Promise<Paginated<CombinedGardenRow>> {
        const { season, history } = await this.load(areaId, query.season);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const { followUpOf, repeatedOf } = this.pastOf(season, history);
        const through = season.dataThrough ? Date.parse(season.dataThrough) : null;
        let list = season.gardens;
        if (query.class === 'positive') list = list.filter((g) => POSITIVE.includes(g.class));
        else if (query.class === 'doubtful') list = list.filter((g) => POSITIVE.includes(g.class) && (DOUBTFUL.includes(followUpOf(g.id)?.status as FollowUpStatus) || repeatedOf(g.id).length > 0));
        else if (query.class === 'counted') list = list.filter((g) => COUNTED.includes(g.class));
        else if (query.class === 'recent') list = list.filter((g) => POSITIVE.includes(g.class) && through !== null && !!g.bracket && through - Date.parse(g.bracket.to) <= RECENT_DAYS * DAY);
        else if (query.class) list = list.filter((g) => g.class === query.class);
        list = [...list].sort((a, b) => CLASS_RANK[b.class] - CLASS_RANK[a.class] || (b.area?.m2 ?? 0) - (a.area?.m2 ?? 0));
        const slice = list.slice((page - 1) * limit, page * limit);
        return paginate(await this.rows(areaId, season, history, slice), list.length, page, limit);
    }

    /** Garden rows with parcel, producer and retrospective-check details (shared with the expert worklist). */
    async rows(areaId: string, season: CombinedSeason, history: CombinedHistory | null, slice: CombinedGarden[]): Promise<CombinedGardenRow[]> {
        const { followUpOf, repeatedOf } = this.pastOf(season, history);
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
        return slice.map((g) => {
            const i = byCode.get(g.id);
            return { ...g, code: g.id, block: i?.block ?? '', parcel: i?.parcel ?? '', locality: i?.locality ?? '', producerCode: g.producerId, producerName: names.get(g.producerId)?.name ?? '', followUp: followUpOf(g.id), repeatedGround: repeatedOf(g.id) };
        });
    }

    private pastOf(season: CombinedSeason, history: CombinedHistory | null) {
        const past = new Map((history?.gardens ?? []).map((g) => [g.id, g]));
        return {
            followUpOf: (id: string) => past.get(id)?.seasons[season.season]?.followUp ?? null,
            repeatedOf: (id: string) => (past.get(id)?.repeatedGround ?? []).filter((r) => r.a === season.season || r.b === season.season),
        };
    }

    async producers(areaId: string, query: CombinedProducerQueryDto): Promise<Paginated<CombinedProducerRow>> {
        const { season, history } = await this.load(areaId, query.season);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const past = new Map((history?.producers ?? []).map((p) => [p.id, p]));
        const multiYearOf = (id: string): CombinedProducerRow['multiYear'] => {
            const h = past.get(id);
            if (!h) return null;
            const { id: _id, licensedAreaM2: _licensed, ...rest } = h;
            return rest;
        };
        const open = (p: CombinedProducer) => p.status === 'met' || p.status === 'met_with_probable';
        let list = season.producers;
        if (query.status === 'active') list = list.filter((p) => p.status !== 'none' && p.status !== 'no_license');
        else if (query.status === 'open') list = list.filter(open);
        else if (query.status === 'changed') list = list.filter((p) => (p.fusionDecision === 'auto_open') !== open(p));
        else if (query.status === 'behind') list = list.filter((p) => past.get(p.id)?.status === 'behind');
        else if (query.status) list = list.filter((p) => p.status === query.status);
        list = [...list].sort((a, b) => b.countedM2 - a.countedM2 || b.lightM2 - a.lightM2);
        const names = await this.producerNames(areaId, season.season);
        const slice = list.slice((page - 1) * limit, page * limit);
        return paginate(slice.map((p) => ({ ...p, code: p.id, name: names.get(p.id)?.name ?? '', walletNo: names.get(p.id)?.walletNo ?? '', multiYear: multiYearOf(p.id) })), list.length, page, limit);
    }

    private async producerNames(areaId: string, season: string): Promise<Map<string, { name: string; walletNo: string }>> {
        let producers = await this.producerRepo.find({ where: { areaId, season }, select: ['code', 'name', 'walletNo'] });
        // A running season has no producer rows of its own yet: the names of the latest imported season stand in.
        if (producers.length === 0) {
            const all = await this.producerRepo.find({ where: { areaId }, select: ['code', 'name', 'walletNo', 'season'], order: { season: 'DESC' } });
            producers = all.filter((p) => p.season === all[0]?.season);
        }
        return new Map(producers.map((p) => [p.code, { name: p.name, walletNo: p.walletNo }]));
    }

    /** The requested season, else the latest finished one (a running season is shown only when asked for). */
    async load(areaId: string, requested?: string): Promise<{ season: CombinedSeason; seasons: string[]; liveSeason: string | null; history: CombinedHistory | null }> {
        const area = await this.areaRepo.findOne({ where: { id: areaId }, select: ['id', 'pruningCombined'] });
        if (!area) throw new NotFoundException('Area not found');
        const list = area.pruningCombined?.seasons ?? [];
        if (list.length === 0) throw new NotFoundException('No combined pruning verdict for this area');
        const seasons = list.map((s) => s.season).sort();
        const finished = list.filter((s) => !s.inProgress).map((s) => s.season).sort();
        const fallback = finished.at(-1) ?? seasons.at(-1);
        const season = list.find((s) => s.season === requested) ?? (list.find((s) => s.season === fallback) as CombinedSeason);
        const liveSeason = list.filter((s) => s.inProgress).map((s) => s.season).sort().at(-1) ?? null;
        return { season, seasons, liveSeason, history: area.pruningCombined?.history ?? null };
    }
}
