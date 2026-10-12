import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryProducer, ProducerAutoStatus, ProducerScan } from '@/tea-inventory/entities/tea-inventory-producer.entity';
import { TeaInventoryGarden } from '@/tea-inventory/entities/tea-inventory-garden.entity';
import { PruningDecision, PruningDecisionValue } from '@/tea-inventory/entities/pruning-decision.entity';
import { User } from '@/users/entities/user.entity';
import { PRODUCER_STATUSES, ProducerQueryDto, ProducerSortKey, ProducerStatus, PruningDecisionDto, PurchaseListQueryDto } from '@/tea-inventory/dto';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

/** Statuses under which ÇAYKUR may buy green leaf from the producer this season. */
const PURCHASE_OPEN: ProducerStatus[] = ['auto_approved', 'approved'];

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
const RATIO_SQL = 'CASE WHEN p.required_m2 > 0 THEN p.pruned_m2 / p.required_m2 ELSE 0 END';
const SORT_SQL: Record<ProducerSortKey, string> = {
    ratio: RATIO_SQL,
    name: 'p.name',
    teaArea: 'p.tea_area_m2',
    gardens: 'p.garden_count',
};

export interface ProducerDecisionView {
    decision: PruningDecisionValue;
    note: string | null;
    decidedByName: string;
    decidedAt: string;
}

export interface ProducerRow {
    id: string;
    code: string;
    name: string;
    walletNo: string;
    licenseNo: string;
    gardenCount: number;
    licensedAreaM2: number;
    teaAreaM2: number;
    requiredM2: number;
    prunedM2: number;
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
    geometryAreaM2: number;
    teaAreaM2: number;
    prunedM2: number;
    prunedSeries: number[];
    geometry: Record<string, unknown>;
}

export interface ProducerDetail extends ProducerRow {
    season: string;
    scans: ProducerScan[];
    gardens: ProducerGardenView[];
    decisions: ProducerDecisionView[];
    schedule: Record<string, unknown> | null;
}

export interface ProducerSummary {
    total: number;
    purchaseOpen: number;
    counts: Record<ProducerStatus, number>;
    schedule: Record<string, unknown> | null;
}

interface RawProducerRow {
    id: string;
    code: string;
    name: string;
    wallet_no: string;
    license_no: string;
    garden_count: number;
    licensed_area_m2: number;
    tea_area_m2: number;
    required_m2: number;
    pruned_m2: number;
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
 * Producer-level pruning compliance: every producer's gardens together against the 1/7 rule,
 * the satellite scan history, expert decisions and the resulting ÇAYKUR purchase list.
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
        await this.findArea(areaId);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const params: unknown[] = [areaId];
        const where = ['p.area_id = $1'];
        if (query.status) {
            params.push(query.status);
            where.push(`${EFFECTIVE_STATUS_SQL} = $${params.length}`);
        }
        const search = query.search?.trim();
        if (search) {
            params.push(`%${search}%`);
            where.push(`(p.name ILIKE $${params.length} OR p.wallet_no ILIKE $${params.length} OR p.license_no ILIKE $${params.length})`);
        }
        const order = `${SORT_SQL[query.sortBy ?? 'ratio']} ${query.sortOrder === 'DESC' ? 'DESC' : 'ASC'}, p.code ASC`;
        params.push(limit, (page - 1) * limit);
        const rows = await this.rawRows(`WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        const total = Number(rows[0]?.total_count ?? 0);
        return paginate(rows.map((r) => this.toRow(r)), total, page, limit);
    }

    async summary(areaId: string): Promise<ProducerSummary> {
        const area = await this.findArea(areaId);
        const raw: Array<{ status: ProducerStatus; count: string }> = await this.producerRepo.query(
            `SELECT ${EFFECTIVE_STATUS_SQL} AS status, COUNT(*) AS count
             FROM tea_inventory_producers p JOIN tea_inventory_areas a ON a.id = p.area_id ${LATEST_DECISION_JOIN}
             WHERE p.area_id = $1 GROUP BY 1`,
            [areaId],
        );
        const counts = Object.fromEntries(PRODUCER_STATUSES.map((s) => [s, 0])) as Record<ProducerStatus, number>;
        for (const r of raw) counts[r.status] = Number(r.count);
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        return {
            total,
            purchaseOpen: PURCHASE_OPEN.reduce((sum, s) => sum + counts[s], 0),
            counts,
            schedule: area.producerScan,
        };
    }

    async purchaseList(areaId: string, query: PurchaseListQueryDto): Promise<Paginated<ProducerRow>> {
        await this.findArea(areaId);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const rows = await this.rawRows(
            `WHERE p.area_id = $1 AND ${EFFECTIVE_STATUS_SQL} IN ('auto_approved', 'approved') ORDER BY p.name ASC, p.code ASC LIMIT $2 OFFSET $3`,
            [areaId, limit, (page - 1) * limit],
        );
        return paginate(rows.map((r) => this.toRow(r)), Number(rows[0]?.total_count ?? 0), page, limit);
    }

    /** The full purchase list as CSV (UTF-8 with BOM so Excel opens Turkish characters correctly). */
    async purchaseListCsv(areaId: string): Promise<string> {
        const area = await this.findArea(areaId);
        const rows = await this.rawRows(
            `WHERE p.area_id = $1 AND ${EFFECTIVE_STATUS_SQL} IN ('auto_approved', 'approved') ORDER BY p.name ASC, p.code ASC`,
            [areaId],
        );
        const header = ['Cüzdan no', 'Ruhsat no', 'Ad soyad', 'Bahçe sayısı', 'Ruhsat alanı (m²)', '1/7 hedefi (m²)', 'Görülen budama (m²)', 'Onay türü', 'Onay tarihi', 'Onaylayan', 'Demo kayıt'];
        const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
        const lines = rows.map((r) => {
            const row = this.toRow(r);
            const byExpert = row.status === 'approved';
            return [
                row.walletNo,
                row.licenseNo,
                row.name,
                row.gardenCount,
                Math.round(row.licensedAreaM2),
                Math.round(row.requiredM2),
                Math.round(row.prunedM2),
                byExpert ? 'Eksper onayı' : 'Otomatik (uydu, yüksek güven)',
                byExpert ? (row.decision?.decidedAt.slice(0, 10) ?? '') : (row.autoApprovedAt ?? ''),
                byExpert ? (row.decision?.decidedByName ?? '') : 'Sistem',
                row.demo ? 'Evet' : 'Hayır',
            ].map(cell).join(';');
        });
        const title = `${area.province} / ${area.district} / ${area.neighborhood}`;
        return `﻿${cell(`Budama onaylı müstahsiller — ${title}`)}\n${header.map(cell).join(';')}\n${lines.join('\n')}\n`;
    }

    async detail(id: string): Promise<ProducerDetail> {
        const producer = await this.producerRepo.findOne({ where: { id } });
        if (!producer) throw new NotFoundException('Producer not found');
        const area = await this.findArea(producer.areaId);
        const [row] = await this.rawRows('WHERE p.id = $1', [id]);
        const gardens = await this.gardenRepo.find({ where: { producerId: id }, order: { parcelKey: 'ASC', holderIndex: 'ASC' } });
        const decisions = await this.decisionRepo.find({
            where: { areaCode: area.code, producerCode: producer.code, season: producer.season },
            order: { createdAt: 'DESC' },
        });
        return {
            ...this.toRow(row as RawProducerRow),
            season: producer.season,
            scans: producer.scans,
            schedule: area.producerScan,
            gardens: gardens.map((g) => ({
                id: g.id,
                code: g.code,
                parcelKey: g.parcelKey,
                block: g.block,
                parcel: g.parcel,
                holderIndex: g.holderIndex,
                holderCount: g.holderCount,
                geometryAreaM2: g.geometryAreaM2,
                teaAreaM2: g.teaAreaM2,
                prunedM2: g.prunedSeries.at(-1) ?? 0,
                prunedSeries: g.prunedSeries,
                geometry: g.geometry,
            })),
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

    private async findArea(id: string): Promise<TeaInventoryArea> {
        const area = await this.areaRepo.findOne({ where: { id } });
        if (!area) throw new NotFoundException('Inventory area not found');
        return area;
    }

    private rawRows(tail: string, params: unknown[]): Promise<RawProducerRow[]> {
        return this.producerRepo.query(
            `SELECT p.id, p.code, p.name, p.wallet_no, p.license_no, p.garden_count, p.licensed_area_m2, p.tea_area_m2,
                    p.required_m2, p.pruned_m2, ${RATIO_SQL} AS ratio, p.auto_status, p.auto_approved_at, p.demo,
                    ld.decision, ld.note, ld.decided_by_name, ld.decided_at,
                    ${EFFECTIVE_STATUS_SQL} AS status, COUNT(*) OVER() AS total_count
             FROM tea_inventory_producers p JOIN tea_inventory_areas a ON a.id = p.area_id ${LATEST_DECISION_JOIN}
             ${tail}`,
            params,
        );
    }

    private toRow(r: RawProducerRow): ProducerRow {
        return {
            id: r.id,
            code: r.code,
            name: r.name,
            walletNo: r.wallet_no,
            licenseNo: r.license_no,
            gardenCount: Number(r.garden_count),
            licensedAreaM2: Number(r.licensed_area_m2),
            teaAreaM2: Number(r.tea_area_m2),
            requiredM2: Number(r.required_m2),
            prunedM2: Number(r.pruned_m2),
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
