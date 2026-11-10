import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FusionBlock, FusionUnassignedPatch, TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { FusionDecision, ProducerFusion, ProducerFusionStatus, TeaInventoryProducer } from '@/tea-inventory/entities/tea-inventory-producer.entity';
import { FusionClass, GardenFusion, TeaInventoryGarden } from '@/tea-inventory/entities/tea-inventory-garden.entity';
import { FUSION_CLASSES, FUSION_DECISIONS, FusionGardenQueryDto, FusionProducerQueryDto, PRODUCER_FUSION_STATUSES } from '@/tea-inventory/dto';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

export interface FusionGardenRow {
    id: string;
    code: string;
    producerCode: string;
    producerName: string;
    walletNo: string;
    licenseCode: string | null;
    parcelKey: string;
    block: string;
    parcel: string;
    locality: string;
    holderIndex: number;
    holderCount: number;
    areaM2: number;
    licensedAreaM2: number | null;
    unit: 'garden' | 'patch';
    unitAreaM2: number;
    unitGeometry: Record<string, unknown> | null;
    repeat: GardenFusion['repeat'] | null;
    class: FusionClass;
    kind: GardenFusion['verdict']['kind'] | null;
    z: number | null;
    p: number;
    opticalOk: boolean;
    backscatterOk: boolean;
    coherenceOk: boolean;
    crossIndexOk: boolean;
    radarRequired: boolean;
    review: boolean;
    shadeProne: boolean;
    observability: GardenFusion['verdict']['observability'] | null;
    inCalendar: boolean | null;
    levels: GardenFusion['verdict']['levels'] | null;
    shape: GardenFusion['verdict']['shape'] | null;
    recovery: GardenFusion['verdict']['recovery'] | null;
    populationZ: number | null;
    changeDate: string | null;
    lastBeforeAt: string | null;
    firstAfterAt: string | null;
    detectedAt: string | null;
    likelyAt: string | null;
    agreeing: number;
    reason: string;
    groups: GardenFusion['verdict']['groups'];
    geometry: Record<string, unknown>;
}

export interface FusionGardenDetail extends FusionGardenRow {
    scans: GardenFusion['scans'];
    series: GardenFusion['series'];
}

export interface FusionProducerRow extends ProducerFusion {
    id: string;
    code: string;
    name: string;
    walletNo: string;
    licenseNo: string;
    /** Share of the 1/7 target covered by confidently pruned gardens. */
    ratio: number;
}

export interface FusionSummary {
    season: string;
    seasons: string[];
    calibrated: boolean;
    method: string;
    rules: Record<string, unknown>;
    channels: FusionBlock['channels'];
    everyDays: number;
    scanFrom: string;
    scanTo: string;
    sensors: FusionBlock['seasons'][number]['sensors'];
    gardens: { total: number; byClass: Record<FusionClass, number>; prunedAreaM2: number; likelyAreaM2: number };
    producers: { total: number; byStatus: Record<ProducerFusionStatus, number>; byDecision: Record<FusionDecision, number> };
    /** Gardens confirmed pruned as of each emulated scan date (the season's pruning curve). */
    timeline: Array<{ date: string; pruned: number; likely: number }>;
    localities: Array<{ name: string; pruned: number; total: number }>;
    /** Share of the neighbourhood covered by harvested TKGM parcels; tea outside them is judged as free patches. */
    parcelCoverage: number | null;
    unassigned: { count: number; areaM2: number; byClass: Record<FusionClass, number>; prunedAreaM2: number; patches: FusionUnassignedPatch[] };
    policy: Record<string, unknown> | null;
}

/**
 * Multi-sensor step-change pruning verdicts (the fusion module): the whole neighbourhood judged
 * every 2–3 days over the pruning calendar, per garden and per licence holder, with the per-channel
 * evidence behind every verdict. Uncalibrated until field labels exist.
 */
@Injectable()
export class PruningFusionService {
    constructor(
        @InjectRepository(TeaInventoryArea)
        private readonly areaRepo: Repository<TeaInventoryArea>,
        @InjectRepository(TeaInventoryProducer)
        private readonly producerRepo: Repository<TeaInventoryProducer>,
        @InjectRepository(TeaInventoryGarden)
        private readonly gardenRepo: Repository<TeaInventoryGarden>,
    ) { }

    async summary(areaId: string, requested?: string): Promise<FusionSummary> {
        const area = await this.findArea(areaId);
        const header = area.producerScan?.fusion;
        if (!header) throw new NotFoundException('No fusion results for this area');
        const seasons = header.seasons.map((s) => s.season).sort();
        const season = requested && seasons.includes(requested) ? requested : (seasons.at(-1) as string);
        const seasonHeader = header.seasons.find((s) => s.season === season) as FusionBlock['seasons'][number];
        const [gardens, producers] = await Promise.all([
            this.gardenRepo.find({ where: { areaId }, select: ['code', 'locality', 'planimetricAreaM2', 'geometryAreaM2', 'seasons'] }),
            this.producerRepo.find({ where: { areaId, season }, select: ['code', 'fusion'] }),
        ]);
        const byClass = Object.fromEntries(FUSION_CLASSES.map((c) => [c, 0])) as Record<FusionClass, number>;
        const byStatus = Object.fromEntries(PRODUCER_FUSION_STATUSES.map((s) => [s, 0])) as Record<ProducerFusionStatus, number>;
        let prunedArea = 0;
        let likelyArea = 0;
        const timeline = new Map<string, { pruned: number; likely: number }>();
        const localities = new Map<string, { pruned: number; total: number }>();
        for (const g of gardens) {
            const f = g.seasons[season]?.fusion;
            if (!f) continue;
            byClass[f.verdict.class]++;
            const area = f.unitAreaM2 ?? (g.planimetricAreaM2 || g.geometryAreaM2);
            if (f.verdict.class === 'pruned') prunedArea += area;
            if (f.verdict.class === 'likely') likelyArea += area;
            const loc = localities.get(g.locality || '—') ?? { pruned: 0, total: 0 };
            loc.total++;
            if (f.verdict.class === 'pruned') loc.pruned++;
            localities.set(g.locality || '—', loc);
            // A garden counts as pruned on a scan date once its final verdict is pruned and the scan reached it.
            for (const s of f.scans) {
                const t = timeline.get(s.date) ?? { pruned: 0, likely: 0 };
                if (f.verdict.class === 'pruned' && f.detectedAt && s.date >= f.detectedAt) t.pruned++;
                else if ((f.verdict.class === 'pruned' || f.verdict.class === 'likely') && f.likelyAt && s.date >= f.likelyAt) t.likely++;
                timeline.set(s.date, t);
            }
        }
        const byDecision = Object.fromEntries(FUSION_DECISIONS.map((d) => [d, 0])) as Record<FusionDecision, number>;
        for (const p of producers) {
            if (!p.fusion) continue;
            byStatus[p.fusion.status]++;
            byDecision[p.fusion.decision ?? 'no_data']++;
        }
        const patches = seasonHeader.unassigned ?? [];
        const uByClass = Object.fromEntries(FUSION_CLASSES.map((c) => [c, 0])) as Record<FusionClass, number>;
        for (const u of patches) uByClass[u.verdict.class as FusionClass] = (uByClass[u.verdict.class as FusionClass] ?? 0) + 1;
        return {
            season,
            seasons,
            calibrated: header.calibrated,
            method: header.method,
            rules: header.rules,
            channels: header.channels,
            everyDays: seasonHeader.everyDays,
            scanFrom: seasonHeader.scanFrom,
            scanTo: seasonHeader.scanTo,
            sensors: seasonHeader.sensors,
            gardens: { total: Object.values(byClass).reduce((a, b) => a + b, 0), byClass, prunedAreaM2: Math.round(prunedArea), likelyAreaM2: Math.round(likelyArea) },
            producers: { total: producers.filter((p) => p.fusion).length, byStatus, byDecision },
            timeline: [...timeline.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, t]) => ({ date, ...t })),
            localities: [...localities.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.pruned - a.pruned || b.total - a.total),
            parcelCoverage: seasonHeader.parcelCoverage ?? null,
            unassigned: {
                count: patches.length,
                areaM2: Math.round(patches.reduce((s, u) => s + u.areaM2, 0)),
                byClass: uByClass,
                prunedAreaM2: Math.round(patches.filter((u) => u.verdict.class === 'pruned').reduce((s, u) => s + u.areaM2, 0)),
                patches,
            },
            policy: header.policy ?? null,
        };
    }

    async gardens(areaId: string, query: FusionGardenQueryDto): Promise<Paginated<FusionGardenRow>> {
        const { season, rows } = await this.gardenRows(areaId, query.season);
        void season;
        const search = query.search?.trim().toLocaleLowerCase('tr-TR');
        const filtered = rows.filter((r) => {
            if (query.class && r.class !== query.class) return false;
            if (query.locality && r.locality !== query.locality) return false;
            if (search) {
                const hay = [r.producerName, r.producerCode, r.walletNo, r.licenseCode ?? '', r.code, `${r.block}/${r.parcel}`, r.locality].join(' ').toLocaleLowerCase('tr-TR');
                if (!hay.includes(search)) return false;
            }
            return true;
        });
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        return paginate(filtered.slice((page - 1) * limit, page * limit), filtered.length, page, limit);
    }

    async garden(id: string): Promise<FusionGardenDetail> {
        const g = await this.gardenRepo.findOne({ where: { id } });
        if (!g) throw new NotFoundException('Garden not found');
        const area = await this.findArea(g.areaId);
        const seasons = (area.producerScan?.fusion?.seasons ?? []).map((s) => s.season).sort();
        const season = seasons.at(-1);
        const f = season ? g.seasons[season]?.fusion : null;
        if (!season || !f) throw new NotFoundException('No fusion verdict for this garden');
        const producer = await this.producerRepo.findOne({ where: { areaId: g.areaId, code: g.producerCode, season } });
        return { ...this.toRow(g, f, season, producer), scans: f.scans, series: f.series };
    }

    async producers(areaId: string, query: FusionProducerQueryDto): Promise<Paginated<FusionProducerRow>> {
        const rows = await this.producerRows(areaId, query.season);
        const search = query.search?.trim().toLocaleLowerCase('tr-TR');
        const filtered = rows.filter((r) => {
            if (query.status && r.status !== query.status) return false;
            if (query.decision && (r.decision ?? 'no_data') !== query.decision) return false;
            if (search && ![r.name, r.code, r.walletNo, r.licenseNo].join(' ').toLocaleLowerCase('tr-TR').includes(search)) return false;
            return true;
        });
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        return paginate(filtered.slice((page - 1) * limit, page * limit), filtered.length, page, limit);
    }

    /** "Budama yapanlar" as CSV (UTF-8 BOM, Excel-compatible). */
    async producersCsv(areaId: string, requested?: string): Promise<string> {
        const rows = await this.producerRows(areaId, requested);
        const header = ['Müstahsil no', 'Ad soyad', 'Cüzdan no', 'Ruhsat no', 'Bahçe', 'Ruhsat alanı (m²)', '1/7 hedefi (m²)', 'Budanan alan (m²)', 'Olası budanan (m²)', 'Tekrar budanan, sayılmadı (m²)', 'Sayılan yeni alan (m²)', 'Eksik (m²)', 'Hedef oranı', 'Durum', 'Alım kararı', 'Anomaliler', 'İlk tespit', 'Budanan bahçeler', 'Demo'];
        const cell = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const label: Record<ProducerFusionStatus, string> = {
            pruned_full: '1/7 tamam (çok-sensör)',
            pruned_partial: 'Kısmen budadı',
            none: 'Budama görülmedi',
            unclear: 'Belirsiz',
            no_license: 'Ruhsat yok',
            no_data: 'Veri yok',
        };
        const decisionLabel: Record<FusionDecision, string> = {
            auto_open: 'Otomatik açık',
            auto_pending: 'Otomatik — bekliyor',
            auto_short: 'Otomatik — eksik',
            auto_none: 'Otomatik — budama görülmedi',
            expert_anomaly: 'Eksper (anomali)',
            no_license: 'Ruhsat yok',
            no_data: 'Veri yok',
        };
        const lines = rows.map((r) =>
            [
                r.code, r.name, r.walletNo, r.licenseNo, r.gardens, r.licensedAreaM2, r.requiredM2, r.prunedAreaM2, r.likelyAreaM2, r.reusedM2 ?? 0, r.countedM2 ?? r.prunedAreaM2, r.shortfallM2 ?? '', r.ratio, label[r.status],
                decisionLabel[r.decision ?? 'no_data'], (r.anomalies ?? []).join(' '), r.firstDetectedAt ?? '', r.prunedGardens.join(' '), 'Evet',
            ].map(cell).join(';'),
        );
        return `﻿${header.map(cell).join(';')}\n${lines.join('\n')}\n`;
    }

    // ── helpers ──

    private async findArea(id: string): Promise<TeaInventoryArea> {
        const area = await this.areaRepo.findOne({ where: { id } });
        if (!area) throw new NotFoundException('Inventory area not found');
        return area;
    }

    resolveSeason(area: TeaInventoryArea, requested?: string): string {
        const seasons = (area.producerScan?.fusion?.seasons ?? []).map((s) => s.season).sort();
        if (requested && seasons.includes(requested)) return requested;
        const latest = seasons.at(-1);
        if (!latest) throw new NotFoundException('No fusion results for this area');
        return latest;
    }

    private toRow(g: TeaInventoryGarden, f: GardenFusion, season: string, producer: TeaInventoryProducer | null): FusionGardenRow {
        void season;
        return {
            id: g.id,
            code: g.code,
            producerCode: g.producerCode,
            producerName: producer?.name ?? '',
            walletNo: producer?.walletNo ?? '',
            licenseCode: g.licenseCode,
            parcelKey: g.parcelKey,
            block: g.block,
            parcel: g.parcel,
            locality: g.locality || '—',
            holderIndex: g.holderIndex,
            holderCount: g.holderCount,
            areaM2: Math.round(g.planimetricAreaM2 || g.geometryAreaM2),
            licensedAreaM2: g.licensedAreaM2,
            unit: f.unit ?? 'garden',
            unitAreaM2: f.unitAreaM2 ?? Math.round(g.planimetricAreaM2 || g.geometryAreaM2),
            unitGeometry: f.unitGeometry ?? null,
            repeat: f.repeat ?? null,
            class: f.verdict.class,
            kind: f.verdict.kind ?? null,
            z: f.verdict.z,
            p: f.verdict.p,
            opticalOk: f.verdict.opticalOk ?? false,
            backscatterOk: f.verdict.backscatterOk ?? false,
            coherenceOk: f.verdict.coherenceOk ?? false,
            crossIndexOk: f.verdict.crossIndexOk ?? false,
            radarRequired: f.verdict.radarRequired ?? false,
            review: f.verdict.review ?? f.verdict.class === 'likely',
            shadeProne: f.verdict.shadeProne ?? false,
            observability: f.verdict.observability ?? null,
            inCalendar: f.verdict.inCalendar ?? null,
            levels: f.verdict.levels ?? null,
            shape: f.verdict.shape ?? null,
            recovery: f.verdict.recovery ?? null,
            populationZ: f.verdict.populationZ ?? null,
            changeDate: f.verdict.changeDate,
            lastBeforeAt: f.verdict.lastBeforeAt,
            firstAfterAt: f.verdict.firstAfterAt,
            detectedAt: f.detectedAt,
            likelyAt: f.likelyAt,
            agreeing: f.verdict.agreeing,
            reason: f.verdict.reason,
            groups: f.verdict.groups,
            geometry: g.geometry,
        };
    }

    async gardenRows(areaId: string, requested?: string): Promise<{ season: string; rows: FusionGardenRow[] }> {
        const area = await this.findArea(areaId);
        const season = this.resolveSeason(area, requested);
        const [gardens, producers] = await Promise.all([
            this.gardenRepo.find({ where: { areaId }, order: { parcelKey: 'ASC', holderIndex: 'ASC' } }),
            this.producerRepo.find({ where: { areaId, season } }),
        ]);
        const byCode = new Map(producers.map((p) => [p.code, p]));
        const order: Record<FusionClass, number> = { pruned: 0, likely: 1, unclear: 2, not_pruned: 3, no_data: 4 };
        const rows = gardens
            .map((g) => {
                const f = g.seasons[season]?.fusion;
                return f ? this.toRow(g, f, season, byCode.get(g.producerCode) ?? null) : null;
            })
            .filter((r): r is FusionGardenRow => !!r)
            .sort((a, b) => order[a.class] - order[b.class] || (b.z ?? 0) - (a.z ?? 0));
        return { season, rows };
    }

    async producerRows(areaId: string, requested?: string): Promise<FusionProducerRow[]> {
        const area = await this.findArea(areaId);
        const season = this.resolveSeason(area, requested);
        const producers = await this.producerRepo.find({ where: { areaId, season }, order: { name: 'ASC' } });
        const order: Record<ProducerFusionStatus, number> = { pruned_full: 0, pruned_partial: 1, unclear: 2, none: 3, no_data: 4, no_license: 5 };
        return producers
            .filter((p) => p.fusion)
            .map((p) => {
                const f = p.fusion as ProducerFusion;
                // The ratio is on the counted area (confirmed + likely minus reused), the figure the policy decides on.
                const counted = f.countedM2 ?? f.prunedAreaM2;
                return { id: p.id, code: p.code, name: p.name, walletNo: p.walletNo, licenseNo: p.licenseNo, ...f, ratio: f.requiredM2 > 0 ? Math.round((counted / f.requiredM2) * 1000) / 1000 : 0 };
            })
            .sort((a, b) => order[a.status] - order[b.status] || b.ratio - a.ratio || a.name.localeCompare(b.name, 'tr-TR'));
    }
}
