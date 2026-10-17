import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeaInventoryArea, ProducerScanBlock, ProducerSeasonSchedule } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryProducer, ProducerAutoStatus, ProducerScan } from '@/tea-inventory/entities/tea-inventory-producer.entity';
import { TeaInventoryGarden, GardenPruningEvent, GardenSeason, RadarClass, RadarResult, RadarSeries } from '@/tea-inventory/entities/tea-inventory-garden.entity';
import { PruningDecision, PruningDecisionValue } from '@/tea-inventory/entities/pruning-decision.entity';
import { User } from '@/users/entities/user.entity';
import {
    PRODUCER_STATUSES,
    PRUNING_REGISTRATIONS,
    ProducerQueryDto,
    ProducerSortKey,
    ProducerStatus,
    PruningDecisionDto,
    PruningRecordQueryDto,
    PruningRegistration,
    PurchaseListQueryDto,
} from '@/tea-inventory/dto';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

/** Statuses under which ÇAYKUR may buy green leaf from the producer this season. */
const PURCHASE_OPEN: ProducerStatus[] = ['auto_approved', 'approved'];

const RADAR_LABEL: Record<RadarClass, string> = {
    confirmed: 'Radar teyit etti',
    weak: 'Zayıf radar sinyali',
    neutral: 'Radar nötr',
    contradicted: 'Radar çelişiyor',
    no_data: 'Radar verisi yetersiz',
};
const REGISTRATION_LABEL: Record<PruningRegistration, string> = {
    auto: 'Otomatik düştü (uydu, yüksek güven)',
    expert: 'Eksper onayıyla düştü',
    pending: 'Eksper onayı bekliyor',
    rejected: 'Eksper reddetti',
    unattributed: 'Hisse sınırı belirsiz — müstahsile atanamadı',
    no_license: 'Ruhsat yok / eşleşme bekliyor',
};

// Latest expert decision per producer/season; effective status = that decision, else the satellite one.
const LATEST_DECISION_JOIN = `
    LEFT JOIN LATERAL (
        SELECT d.decision, d.note, d.decided_by_name, d."createdAt" AS decided_at
        FROM pruning_decisions d
        WHERE d.area_code = a.code AND d.producer_code = p.code AND d.season = p.season
        ORDER BY d."createdAt" DESC
        LIMIT 1
    ) ld ON true`;
const EFFECTIVE_STATUS_SQL = `CASE ld.decision WHEN 'approved' THEN 'approved' WHEN 'rejected' THEN 'rejected' ELSE p.auto_status END`;
const RATIO_SQL = 'CASE WHEN p.required_m2 > 0 THEN p.new_pruned_m2 / p.required_m2 ELSE 0 END';
const SORT_SQL: Record<ProducerSortKey, string> = {
    ratio: RATIO_SQL,
    name: 'p.name',
    teaArea: 'p.tea_area_m2',
    gardens: 'p.garden_count',
};
const SELECT_SQL = `
    SELECT p.id, p.code, p.season, p.name, p.wallet_no, p.license_no, p.garden_count, p.unresolved_gardens,
           p.licensed_area_m2, p.tea_area_m2, p.required_m2, p.gross_pruned_m2, p.reused_m2, p.new_pruned_m2,
           p.unattributed_m2, p.unobserved_m2, p.remaining_m2, ${RATIO_SQL} AS ratio,
           p.auto_status, p.auto_approved_at, p.demo,
           ld.decision, ld.note, ld.decided_by_name, ld.decided_at,
           ${EFFECTIVE_STATUS_SQL} AS status, COUNT(*) OVER() AS total_count
    FROM tea_inventory_producers p JOIN tea_inventory_areas a ON a.id = p.area_id ${LATEST_DECISION_JOIN}`;

export interface ProducerDecisionView {
    decision: PruningDecisionValue;
    note: string | null;
    decidedByName: string;
    decidedAt: string;
}

export interface ProducerRow {
    id: string;
    code: string;
    season: string;
    name: string;
    walletNo: string;
    licenseNo: string;
    gardenCount: number;
    unresolvedGardens: number;
    licensedAreaM2: number;
    teaAreaM2: number;
    requiredM2: number;
    grossPrunedM2: number;
    reusedM2: number;
    newPrunedM2: number;
    unattributedM2: number;
    unobservedM2: number;
    remainingM2: number;
    ratio: number;
    autoStatus: ProducerAutoStatus;
    autoApprovedAt: string | null;
    decision: ProducerDecisionView | null;
    status: ProducerStatus;
    purchaseOpen: boolean;
    demo: boolean;
}

export interface ProducerGardenView {
    id: string;
    code: string;
    parcelKey: string;
    block: string;
    parcel: string;
    holderIndex: number;
    holderCount: number;
    boundaryResolved: boolean;
    geometryAreaM2: number;
    geometry: Record<string, unknown>;
    /** The selected season's result, or null when the garden was not scanned that season. */
    season: GardenSeason | null;
    /** Event polygons of every scanned season, for the year-over-year overlay. */
    eventsBySeason: Record<string, GardenPruningEvent[]>;
}

export interface ProducerSeasonHistory {
    id: string;
    season: string;
    status: ProducerStatus;
    newPrunedM2: number;
    grossPrunedM2: number;
    reusedM2: number;
    requiredM2: number;
    ratio: number;
    purchaseOpen: boolean;
}

export interface ProducerDetail extends ProducerRow {
    scans: ProducerScan[];
    gardens: ProducerGardenView[];
    history: ProducerSeasonHistory[];
    decisions: ProducerDecisionView[];
    schedule: ProducerSeasonSchedule | null;
    rules: Record<string, unknown> | null;
    scenes: { baseUrl: string; bounds: ProducerScanBlock['scenes'] extends infer S ? (S extends { bounds: infer B } ? B : never) : never; items: Array<{ date: string; file: string; teaVisible: number; teaMedianNdvi: number }> } | null;
}

export interface ProducerSummary {
    season: string;
    seasons: string[];
    total: number;
    purchaseOpen: number;
    counts: Record<ProducerStatus, number>;
    schedule: ProducerSeasonSchedule | null;
    rules: Record<string, unknown> | null;
}

/**
 * One satellite pruning record: a pruning event polygon inside a garden, split by the TKGM parcel
 * (the garden), matched to the licence holder, with the observation interval that brackets the
 * change and how the record reached ÇAYKUR's purchase system.
 */
export interface PruningRecordRow {
    id: string;
    season: string;
    gardenCode: string;
    parcelKey: string;
    block: string;
    parcel: string;
    locality: string;
    holderIndex: number;
    holderCount: number;
    boundaryResolved: boolean;
    producerId: string | null;
    producerCode: string;
    producerName: string;
    walletNo: string;
    licenseCode: string | null;
    areaM2: number;
    reusedM2: number;
    newM2: number;
    /** Last clear scene with no change, first clear scene showing it, and the scan that flagged it. */
    lastNoChangeAt: string | null;
    firstChangeAt: string | null;
    detectedAt: string | null;
    producerStatus: ProducerStatus | null;
    producerRatio: number;
    purchaseOpen: boolean;
    registration: PruningRegistration;
    geometry: Record<string, unknown>;
    /** Sentinel-1 verdict and the garden's relative backscatter series (null before the radar module ran). */
    radar: RadarResult | null;
    radarSeries: RadarSeries[] | null;
}

export interface PruningRecordSummary {
    season: string;
    seasons: string[];
    total: number;
    areaM2: number;
    newAreaM2: number;
    gardens: number;
    producers: number;
    byRegistration: Record<PruningRegistration, number>;
    /** Radar module: verdict counts over the season's records, radar-only candidates, rules. Null when it has not run. */
    radar: {
        byClass: Record<RadarClass, number>;
        radarOnly: number;
        calibrated: boolean;
        method: string;
        rules: Record<string, unknown>;
        passes: Array<{ pass: string; relativeOrbit: number; dates: string[]; cohDates?: string[] }>;
        coherence: { cohWin: [number, number]; pairs: Record<string, number> } | null;
    } | null;
    /** Records per scan date (the scan that flagged them), in scan order. */
    byScan: Array<{ date: string; newObservation: boolean; records: number; areaM2: number }>;
    localities: Array<{ name: string; records: number }>;
    schedule: ProducerSeasonSchedule | null;
    scenes: { baseUrl: string; bounds: ProducerScanBlock['scenes'] extends infer S ? (S extends { bounds: infer B } ? B : never) : never; items: Array<{ date: string; file: string; teaVisible: number; teaMedianNdvi: number }> } | null;
}

interface RawProducerRow {
    id: string;
    code: string;
    season: string;
    name: string;
    wallet_no: string;
    license_no: string;
    garden_count: number;
    unresolved_gardens: number;
    licensed_area_m2: number;
    tea_area_m2: number;
    required_m2: number;
    gross_pruned_m2: number;
    reused_m2: number;
    new_pruned_m2: number;
    unattributed_m2: number;
    unobserved_m2: number;
    remaining_m2: number;
    ratio: number;
    auto_status: ProducerAutoStatus;
    auto_approved_at: string | null;
    decision: PruningDecisionValue | null;
    note: string | null;
    decided_by_name: string | null;
    decided_at: Date | null;
    status: ProducerStatus;
    demo: boolean;
    total_count?: string;
}

/**
 * Producer-level pruning compliance: every producer's gardens together against the 1/7 rule
 * for a chosen season, the satellite scan history, year-over-year event polygons, expert
 * decisions and the resulting ÇAYKUR purchase list.
 */
@Injectable()
export class ProducerPruningService {
    constructor(
        @InjectRepository(TeaInventoryArea)
        private readonly areaRepo: Repository<TeaInventoryArea>,
        @InjectRepository(TeaInventoryProducer)
        private readonly producerRepo: Repository<TeaInventoryProducer>,
        @InjectRepository(TeaInventoryGarden)
        private readonly gardenRepo: Repository<TeaInventoryGarden>,
        @InjectRepository(PruningDecision)
        private readonly decisionRepo: Repository<PruningDecision>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) { }

    async list(areaId: string, query: ProducerQueryDto): Promise<Paginated<ProducerRow>> {
        const area = await this.findArea(areaId);
        const season = this.resolveSeason(area, query.season);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const params: unknown[] = [areaId, season];
        const where = ['p.area_id = $1', 'p.season = $2'];
        if (query.status) {
            params.push(query.status);
            where.push(`${EFFECTIVE_STATUS_SQL} = $${params.length}`);
        }
        const search = query.search?.trim();
        if (search) {
            params.push(`%${search}%`);
            where.push(`(p.name ILIKE $${params.length} OR p.wallet_no ILIKE $${params.length} OR p.license_no ILIKE $${params.length} OR p.code ILIKE $${params.length})`);
        }
        const order = `${SORT_SQL[query.sortBy ?? 'ratio']} ${query.sortOrder === 'DESC' ? 'DESC' : 'ASC'}, p.code ASC`;
        params.push(limit, (page - 1) * limit);
        const rows = await this.rawRows(`WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        return paginate(rows.map((r) => this.toRow(r)), Number(rows[0]?.total_count ?? 0), page, limit);
    }

    async summary(areaId: string, requested?: string): Promise<ProducerSummary> {
        const area = await this.findArea(areaId);
        const season = this.resolveSeason(area, requested);
        const raw: Array<{ status: ProducerStatus; count: string }> = await this.producerRepo.query(
            `SELECT ${EFFECTIVE_STATUS_SQL} AS status, COUNT(*) AS count
             FROM tea_inventory_producers p JOIN tea_inventory_areas a ON a.id = p.area_id ${LATEST_DECISION_JOIN}
             WHERE p.area_id = $1 AND p.season = $2 GROUP BY 1`,
            [areaId, season],
        );
        const counts = Object.fromEntries(PRODUCER_STATUSES.map((s) => [s, 0])) as Record<ProducerStatus, number>;
        for (const r of raw) counts[r.status] = Number(r.count);
        return {
            season,
            seasons: this.seasonsOf(area),
            total: Object.values(counts).reduce((a, b) => a + b, 0),
            purchaseOpen: PURCHASE_OPEN.reduce((sum, s) => sum + counts[s], 0),
            counts,
            schedule: this.scheduleOf(area, season),
            rules: area.producerScan?.rules ?? null,
        };
    }

    async purchaseList(areaId: string, query: PurchaseListQueryDto): Promise<Paginated<ProducerRow>> {
        const area = await this.findArea(areaId);
        const season = this.resolveSeason(area, query.season);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const rows = await this.rawRows(
            `WHERE p.area_id = $1 AND p.season = $2 AND ${EFFECTIVE_STATUS_SQL} IN ('auto_approved', 'approved') ORDER BY p.name ASC, p.code ASC LIMIT $3 OFFSET $4`,
            [areaId, season, limit, (page - 1) * limit],
        );
        return paginate(rows.map((r) => this.toRow(r)), Number(rows[0]?.total_count ?? 0), page, limit);
    }

    /** The full purchase list as CSV (UTF-8 with BOM so Excel opens Turkish characters correctly). */
    async purchaseListCsv(areaId: string, requested?: string): Promise<string> {
        const area = await this.findArea(areaId);
        const season = this.resolveSeason(area, requested);
        const rows = await this.rawRows(
            `WHERE p.area_id = $1 AND p.season = $2 AND ${EFFECTIVE_STATUS_SQL} IN ('auto_approved', 'approved') ORDER BY p.name ASC, p.code ASC`,
            [areaId, season],
        );
        const header = ['Müstahsil no', 'Cüzdan no', 'Ruhsat no', 'Ad soyad', 'Bahçe sayısı', 'Ruhsat alanı (m²)', '1/7 hedefi (m²)', 'Yeni budama (m²)', 'Çakışan budama (m²)', 'Onay türü', 'Onay tarihi', 'Onaylayan', 'Demo kayıt'];
        const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
        const lines = rows.map((r) => {
            const row = this.toRow(r);
            const byExpert = row.status === 'approved';
            return [
                row.code,
                row.walletNo,
                row.licenseNo,
                row.name,
                row.gardenCount,
                Math.round(row.licensedAreaM2),
                Math.round(row.requiredM2),
                Math.round(row.newPrunedM2),
                Math.round(row.reusedM2),
                byExpert ? 'Eksper onayı' : 'Otomatik (uydu, yüksek güven)',
                byExpert ? (row.decision?.decidedAt.slice(0, 10) ?? '') : (row.autoApprovedAt ?? ''),
                byExpert ? (row.decision?.decidedByName ?? '') : 'Sistem',
                row.demo ? 'Evet' : 'Hayır',
            ].map(cell).join(';');
        });
        const title = `${area.province} / ${area.district} / ${area.neighborhood} · ${season} budama sezonu`;
        return `﻿${cell(`Budama onaylı müstahsiller — ${title}`)}\n${header.map(cell).join(';')}\n${lines.join('\n')}\n`;
    }

    async detail(id: string): Promise<ProducerDetail> {
        const producer = await this.producerRepo.findOne({ where: { id } });
        if (!producer) throw new NotFoundException('Producer not found');
        const area = await this.findArea(producer.areaId);
        const [row] = await this.rawRows('WHERE p.id = $1', [id]);
        const [gardens, siblings, decisions] = await Promise.all([
            this.gardenRepo.find({ where: { areaId: area.id, producerCode: producer.code }, order: { parcelKey: 'ASC', holderIndex: 'ASC' } }),
            this.rawRows('WHERE p.area_id = $1 AND p.code = $2 ORDER BY p.season ASC', [area.id, producer.code]),
            this.decisionRepo.find({
                where: { areaCode: area.code, producerCode: producer.code, season: producer.season },
                order: { createdAt: 'DESC' },
            }),
        ]);
        const scenes = area.producerScan?.scenes ?? null;
        return {
            ...this.toRow(row as RawProducerRow),
            scans: producer.scans,
            schedule: this.scheduleOf(area, producer.season),
            rules: area.producerScan?.rules ?? null,
            scenes: scenes
                ? { baseUrl: scenes.baseUrl, bounds: scenes.bounds, items: scenes.seasons[producer.season] ?? [] }
                : null,
            gardens: gardens.map((g) => ({
                id: g.id,
                code: g.code,
                parcelKey: g.parcelKey,
                block: g.block,
                parcel: g.parcel,
                holderIndex: g.holderIndex,
                holderCount: g.holderCount,
                boundaryResolved: g.boundaryResolved,
                geometryAreaM2: g.geometryAreaM2,
                geometry: g.geometry,
                season: g.seasons[producer.season] ?? null,
                eventsBySeason: Object.fromEntries(Object.entries(g.seasons).map(([season, s]) => [season, s.events])),
            })),
            history: siblings.map((s) => {
                const r = this.toRow(s);
                return {
                    id: r.id,
                    season: r.season,
                    status: r.status,
                    newPrunedM2: r.newPrunedM2,
                    grossPrunedM2: r.grossPrunedM2,
                    reusedM2: r.reusedM2,
                    requiredM2: r.requiredM2,
                    ratio: r.ratio,
                    purchaseOpen: r.purchaseOpen,
                };
            }),
            decisions: decisions.map((d) => ({
                decision: d.decision,
                note: d.note,
                decidedByName: d.decidedByName,
                decidedAt: d.createdAt.toISOString(),
            })),
        };
    }

    async decide(id: string, dto: PruningDecisionDto, userId: string): Promise<ProducerDetail> {
        const producer = await this.producerRepo.findOne({ where: { id } });
        if (!producer) throw new NotFoundException('Producer not found');
        if (dto.decision === 'rejected' && !dto.note?.trim()) {
            throw new BadRequestException('A rejection needs a reason');
        }
        const area = await this.findArea(producer.areaId);
        const user = await this.userRepo.findOne({ where: { id: userId } });
        await this.decisionRepo.save(
            this.decisionRepo.create({
                areaCode: area.code,
                producerCode: producer.code,
                season: producer.season,
                decision: dto.decision,
                note: dto.note?.trim() || null,
                decidedById: userId,
                decidedByName: user?.fullName ?? 'Bilinmeyen kullanıcı',
            }),
        );
        return this.detail(id);
    }

    // ── Scan-centred record feed ──

    async records(areaId: string, query: PruningRecordQueryDto): Promise<Paginated<PruningRecordRow>> {
        const area = await this.findArea(areaId);
        const season = this.resolveSeason(area, query.season);
        const search = query.search?.trim().toLocaleLowerCase('tr-TR');
        const rows = (await this.recordRows(area, season)).filter((r) => {
            if (query.scanDate && r.detectedAt !== query.scanDate) return false;
            if (query.locality && r.locality !== query.locality) return false;
            if (query.registration && r.registration !== query.registration) return false;
            if (query.radar && (r.radar?.class ?? 'no_data') !== query.radar) return false;
            if (search) {
                const haystack = [r.producerName, r.producerCode, r.walletNo, r.licenseCode ?? '', r.gardenCode, `${r.block}/${r.parcel}`, r.locality].join(' ').toLocaleLowerCase('tr-TR');
                if (!haystack.includes(search)) return false;
            }
            return true;
        });
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        return paginate(rows.slice((page - 1) * limit, page * limit), rows.length, page, limit);
    }

    async recordsSummary(areaId: string, requested?: string): Promise<PruningRecordSummary> {
        const area = await this.findArea(areaId);
        const season = this.resolveSeason(area, requested);
        const rows = await this.recordRows(area, season);
        const schedule = this.scheduleOf(area, season);
        const byRegistration = Object.fromEntries(PRUNING_REGISTRATIONS.map((k) => [k, 0])) as Record<PruningRegistration, number>;
        const localities = new Map<string, number>();
        const byScanMap = new Map<string, { records: number; areaM2: number }>();
        for (const r of rows) {
            byRegistration[r.registration]++;
            localities.set(r.locality, (localities.get(r.locality) ?? 0) + 1);
            if (r.detectedAt) {
                const entry = byScanMap.get(r.detectedAt) ?? { records: 0, areaM2: 0 };
                entry.records++;
                entry.areaM2 += r.areaM2;
                byScanMap.set(r.detectedAt, entry);
            }
        }
        const scenes = area.producerScan?.scenes ?? null;
        const radarHeader = area.producerScan?.radar ?? null;
        const radarSeason = radarHeader?.seasons.find((s) => s.season === season) ?? null;
        let radar: PruningRecordSummary['radar'] = null;
        if (radarHeader && radarSeason) {
            const byClass: Record<RadarClass, number> = { confirmed: 0, weak: 0, neutral: 0, contradicted: 0, no_data: 0 };
            for (const r of rows) byClass[r.radar?.class ?? 'no_data']++;
            const radarOnly = await this.gardenRepo
                .createQueryBuilder('g')
                .where('g.area_id = :areaId', { areaId: area.id })
                .andWhere(`g.seasons -> :season -> 'radarOnly' IS NOT NULL AND jsonb_typeof(g.seasons -> :season -> 'radarOnly') = 'object'`, { season })
                .getCount();
            radar = { byClass, radarOnly, calibrated: radarHeader.calibrated, method: radarHeader.method, rules: radarHeader.rules, passes: radarSeason.passes, coherence: radarSeason.coherence ?? null };
        }
        return {
            season,
            seasons: this.seasonsOf(area),
            total: rows.length,
            areaM2: Math.round(rows.reduce((s, r) => s + r.areaM2, 0)),
            newAreaM2: Math.round(rows.reduce((s, r) => s + r.newM2, 0)),
            gardens: new Set(rows.map((r) => r.gardenCode)).size,
            producers: new Set(rows.map((r) => r.producerCode)).size,
            byRegistration,
            radar,
            byScan: (schedule?.scanDates ?? []).map((date, i) => ({
                date,
                newObservation: schedule?.newObservation[i] ?? false,
                records: byScanMap.get(date)?.records ?? 0,
                areaM2: Math.round(byScanMap.get(date)?.areaM2 ?? 0),
            })),
            localities: [...localities.entries()].map(([name, records]) => ({ name, records })).sort((a, b) => b.records - a.records),
            schedule,
            scenes: scenes ? { baseUrl: scenes.baseUrl, bounds: scenes.bounds, items: scenes.seasons[season] ?? [] } : null,
        };
    }

    /** The record feed as CSV (UTF-8 with BOM, Excel-compatible). */
    async recordsCsv(areaId: string, requested?: string): Promise<string> {
        const area = await this.findArea(areaId);
        const season = this.resolveSeason(area, requested);
        const rows = await this.recordRows(area, season);
        const header = ['Kayıt', 'Mevki', 'Ada/Parsel', 'Bahçe', 'Hisse', 'Müstahsil no', 'Ad soyad', 'Cüzdan no', 'Ruhsat no', 'Budanan alan (m²)', 'Çakışan (m²)', 'Yeni alan (m²)', 'Son değişimsiz gözlem', 'İlk değişimli gözlem', 'Tespit taraması', 'Müstahsil durumu', '1/7 oranı', 'ÇAYKUR kaydı', 'Radar teyidi', 'Radar z', 'Radar VH düşüşü (dB)', 'Demo'];
        const cell = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lines = rows.map((r) =>
            [
                r.id, r.locality, `${r.block}/${r.parcel}`, r.gardenCode, r.holderCount > 1 ? `${r.holderIndex}/${r.holderCount}` : '', r.producerCode, r.producerName, r.walletNo, r.licenseCode ?? '',
                r.areaM2, r.reusedM2, r.newM2, r.lastNoChangeAt ?? 'sezon başı', r.firstChangeAt ?? '', r.detectedAt ?? '', r.producerStatus ?? '', r.producerRatio, REGISTRATION_LABEL[r.registration],
                r.radar ? RADAR_LABEL[r.radar.class] : '', r.radar?.z ?? '', r.radar?.vhDropDb ?? '', 'Evet',
            ].map(cell).join(';'),
        );
        const title = `${area.province} / ${area.district} / ${area.neighborhood} · ${season} budama sezonu`;
        return `﻿${cell(`Uydu budama kayıtları — ${title}`)}\n${header.map(cell).join(';')}\n${lines.join('\n')}\n`;
    }

    /** Every event polygon of the season as a record, joined to its garden, producer and licence. */
    private async recordRows(area: TeaInventoryArea, season: string): Promise<PruningRecordRow[]> {
        const [gardens, producers] = await Promise.all([
            this.gardenRepo.find({ where: { areaId: area.id }, order: { parcelKey: 'ASC', holderIndex: 'ASC' } }),
            this.rawRows('WHERE p.area_id = $1 AND p.season = $2', [area.id, season]),
        ]);
        const producerByCode = new Map(producers.map((p) => [p.code, this.toRow(p)]));
        const rows: PruningRecordRow[] = [];
        for (const g of gardens) {
            const events = g.seasons[season]?.events ?? [];
            const producer = producerByCode.get(g.producerCode) ?? null;
            events.forEach((e, i) => {
                const status = producer?.status ?? null;
                let registration: PruningRegistration;
                if (!g.boundaryResolved) registration = 'unattributed';
                else if (status === 'auto_approved') registration = 'auto';
                else if (status === 'approved') registration = 'expert';
                else if (status === 'rejected') registration = 'rejected';
                else if (status === 'no_license' || !g.licenseCode) registration = 'no_license';
                else registration = 'pending';
                rows.push({
                    id: `${g.code}:${season}:${i + 1}`,
                    season,
                    gardenCode: g.code,
                    parcelKey: g.parcelKey,
                    block: g.block,
                    parcel: g.parcel,
                    locality: g.locality || '—',
                    holderIndex: g.holderIndex,
                    holderCount: g.holderCount,
                    boundaryResolved: g.boundaryResolved,
                    producerId: producer?.id ?? null,
                    producerCode: g.producerCode,
                    producerName: producer?.name ?? '',
                    walletNo: producer?.walletNo ?? '',
                    licenseCode: g.licenseCode,
                    areaM2: Math.round(e.areaM2),
                    reusedM2: Math.round(e.reusedM2),
                    newM2: Math.round(Math.max(0, e.areaM2 - e.reusedM2)),
                    lastNoChangeAt: e.lastNoChangeAt,
                    firstChangeAt: e.firstChangeAt,
                    detectedAt: e.detectedAt,
                    producerStatus: status,
                    producerRatio: producer?.ratio ?? 0,
                    purchaseOpen: producer?.purchaseOpen ?? false,
                    registration,
                    geometry: e.geometry,
                    radar: e.radar ?? null,
                    radarSeries: g.seasons[season]?.radarSeries ?? null,
                });
            });
        }
        // Newest detections first; inside a scan the larger pruning first.
        return rows.sort((a, b) => (b.detectedAt ?? '').localeCompare(a.detectedAt ?? '') || b.areaM2 - a.areaM2);
    }

    private async findArea(id: string): Promise<TeaInventoryArea> {
        const area = await this.areaRepo.findOne({ where: { id } });
        if (!area) throw new NotFoundException('Inventory area not found');
        return area;
    }

    private seasonsOf(area: TeaInventoryArea): string[] {
        return (area.producerScan?.seasons ?? []).map((s) => s.season).sort();
    }

    /** The requested season when scanned, else the latest scanned season. */
    private resolveSeason(area: TeaInventoryArea, requested?: string): string {
        const seasons = this.seasonsOf(area);
        if (requested && seasons.includes(requested)) return requested;
        const latest = seasons.at(-1);
        if (!latest) throw new NotFoundException('No producer scans for this area');
        return latest;
    }

    private scheduleOf(area: TeaInventoryArea, season: string): ProducerSeasonSchedule | null {
        return (area.producerScan?.seasons ?? []).find((s) => s.season === season) ?? null;
    }

    private rawRows(tail: string, params: unknown[]): Promise<RawProducerRow[]> {
        return this.producerRepo.query(`${SELECT_SQL} ${tail}`, params);
    }

    private toRow(r: RawProducerRow): ProducerRow {
        return {
            id: r.id,
            code: r.code,
            season: r.season,
            name: r.name,
            walletNo: r.wallet_no,
            licenseNo: r.license_no,
            gardenCount: Number(r.garden_count),
            unresolvedGardens: Number(r.unresolved_gardens),
            licensedAreaM2: Number(r.licensed_area_m2),
            teaAreaM2: Number(r.tea_area_m2),
            requiredM2: Number(r.required_m2),
            grossPrunedM2: Number(r.gross_pruned_m2),
            reusedM2: Number(r.reused_m2),
            newPrunedM2: Number(r.new_pruned_m2),
            unattributedM2: Number(r.unattributed_m2),
            unobservedM2: Number(r.unobserved_m2),
            remainingM2: Number(r.remaining_m2),
            ratio: Math.round(Number(r.ratio) * 1000) / 1000,
            autoStatus: r.auto_status,
            autoApprovedAt: r.auto_approved_at,
            decision: r.decision
                ? {
                    decision: r.decision,
                    note: r.note,
                    decidedByName: r.decided_by_name ?? '',
                    decidedAt: (r.decided_at instanceof Date ? r.decided_at : new Date(r.decided_at ?? 0)).toISOString(),
                }
                : null,
            status: r.status,
            purchaseOpen: PURCHASE_OPEN.includes(r.status),
            demo: r.demo,
        };
    }
}
