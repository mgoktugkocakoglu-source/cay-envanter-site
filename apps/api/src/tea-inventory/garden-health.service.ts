import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HealthBlock, HealthProducerRow, TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { GardenHealthSeason, HealthAnomaly, HealthAnomalyClass, TeaInventoryGarden } from '@/tea-inventory/entities/tea-inventory-garden.entity';
import { TeaInventoryProducer } from '@/tea-inventory/entities/tea-inventory-producer.entity';
import { FertilisationRecord, FertiliserType } from '@/tea-inventory/entities/fertilisation-record.entity';
import { User } from '@/users/entities/user.entity';
import { CreateFertilisationDto, HealthGardenQueryDto, HealthProducerQueryDto } from '@/tea-inventory/dto';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

export type FertilisationResponseClass = 'strong' | 'weak' | 'none' | 'negative' | 'pending' | 'no_data';

export interface FertilisationView {
    id: string;
    gardenCode: string;
    producerCode: string;
    appliedAt: string;
    type: FertiliserType;
    product: string;
    amountKgPerDa: number | null;
    note: string | null;
    source: 'producer' | 'staff';
    createdByName: string;
    createdAt: string;
    /** Satellite response: neighbourhood-relative NDRE / NDVI change after the application. */
    response: { class: FertilisationResponseClass; ndreBefore: number | null; ndreAfter: number | null; ndviBefore: number | null; ndviAfter: number | null; deltaNdre: number | null; deltaNdvi: number | null; nBefore: number; nAfter: number; reason: string };
}

export interface HealthGardenRow {
    id: string;
    code: string;
    block: string;
    parcel: string;
    locality: string;
    producerCode: string;
    producerName: string;
    walletNo: string;
    licenseCode: string | null;
    teaAreaM2: number;
    licensedAreaM2: number | null;
    vigour: number | null;
    ndviMean: number | null;
    ndreMean: number | null;
    nbhdNdviMean: number | null;
    prunedShare: number;
    anomaly: HealthAnomaly;
    yieldKg: number;
    yieldFactors: GardenHealthSeason['yieldFactors'];
    observations: number;
    fertilisations: number;
    geometry: Record<string, unknown>;
}

export interface HealthGardenDetail extends HealthGardenRow {
    dates: string[];
    series: NonNullable<GardenHealthSeason['series']> | null;
    relative: { ndvi: Array<number | null>; ndre: Array<number | null> };
    neighbourhood: { ndviMedian: Array<number | null>; ndreMedian: Array<number | null> };
    radarDates: Array<{ pass: string; dates: string[] }>;
    fertilisationRecords: FertilisationView[];
}

export interface HealthProducerView extends HealthProducerRow {
    id: string;
    name: string;
    walletNo: string;
    licenseNo: string;
}

export interface HealthSummary {
    season: string;
    seasons: string[];
    calibrated: boolean;
    method: string;
    rules: Record<string, unknown>;
    window: [string, string];
    sensors: HealthBlock['seasons'][number]['sensors'];
    gardens: { total: number; byAnomaly: Record<HealthAnomalyClass, number>; meanVigour: number | null; yieldKg: number; teaAreaM2: number };
    producers: { total: number; byFlag: Record<HealthProducerRow['flag'], number>; yieldKg: number; quotaKg: number };
    localities: Array<{ name: string; gardens: number; suspects: number; meanVigour: number | null }>;
    fertilisation: { records: number; byResponse: Record<FertilisationResponseClass, number> };
    neighbourhood: { dates: string[]; ndviMedian: Array<number | null>; ndreMedian: Array<number | null> };
}

const ANOMALY_ORDER: HealthAnomalyClass[] = ['chemical_suspect', 'defoliation', 'stress', 'none', 'no_data'];
const FLAG_ORDER: HealthProducerRow['flag'][] = ['low', 'high', 'no_license', 'ok', 'no_data'];
const RESPONSE_ORDER: FertilisationResponseClass[] = ['strong', 'weak', 'none', 'negative', 'pending', 'no_data'];
const dayOf = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86400000;

/**
 * Garden-health module (P3): growing-season vigour, anomaly verdicts (herbicide / chemical
 * suspicion, defoliation, stress), yield estimates against the licence quota, and the
 * satellite response to fertilisation records entered on the site. Reads the engine's
 * scan-health results stored on gardens and the area; stays apart from the pruning modules.
 */
@Injectable()
export class GardenHealthService {
    constructor(
        @InjectRepository(TeaInventoryArea) private readonly areaRepo: Repository<TeaInventoryArea>,
        @InjectRepository(TeaInventoryGarden) private readonly gardenRepo: Repository<TeaInventoryGarden>,
        @InjectRepository(TeaInventoryProducer) private readonly producerRepo: Repository<TeaInventoryProducer>,
        @InjectRepository(FertilisationRecord) private readonly fertRepo: Repository<FertilisationRecord>,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
    ) { }

    async summary(areaId: string, requested?: string): Promise<HealthSummary> {
        const area = await this.findArea(areaId);
        const { season, block } = this.resolveSeason(area, requested);
        const gardens = await this.gardenRepo.find({ where: { areaId, recordStatus: 'active' }, select: ['code', 'locality', 'health'] });
        const rows = gardens.map((g) => ({ g, h: g.health?.[season] })).filter((x): x is { g: TeaInventoryGarden; h: GardenHealthSeason } => !!x.h);
        const byAnomaly = Object.fromEntries(ANOMALY_ORDER.map((k) => [k, 0])) as Record<HealthAnomalyClass, number>;
        for (const r of rows) byAnomaly[r.h.anomaly.class]++;
        const vig = rows.map((r) => r.h.vigour).filter((v): v is number => v != null);
        const byFlag = Object.fromEntries(FLAG_ORDER.map((k) => [k, 0])) as Record<HealthProducerRow['flag'], number>;
        for (const p of block.producers) byFlag[p.flag]++;
        const locMap = new Map<string, { gardens: number; suspects: number; vig: number[] }>();
        for (const r of rows) {
            const name = r.g.locality || '—';
            const e = locMap.get(name) ?? { gardens: 0, suspects: 0, vig: [] };
            e.gardens++;
            if (r.h.anomaly.class === 'chemical_suspect' || r.h.anomaly.class === 'defoliation') e.suspects++;
            if (r.h.vigour != null) e.vig.push(r.h.vigour);
            locMap.set(name, e);
        }
        const records = await this.fertRepo.find({ where: { areaCode: area.code } });
        const byResponse = Object.fromEntries(RESPONSE_ORDER.map((k) => [k, 0])) as Record<FertilisationResponseClass, number>;
        const gardensByCode = new Map(gardens.map((g) => [g.code, g]));
        for (const rec of records) {
            const h = gardensByCode.get(rec.gardenCode)?.health?.[season];
            byResponse[this.response(rec, h ?? null, block).class]++;
        }
        return {
            season,
            seasons: (area.health?.seasons ?? []).map((s) => s.season).sort(),
            calibrated: area.health?.calibrated ?? false,
            method: area.health?.method ?? '',
            rules: area.health?.rules ?? {},
            window: block.window,
            sensors: block.sensors,
            gardens: {
                total: rows.length, byAnomaly,
                meanVigour: vig.length ? Math.round((vig.reduce((a, b) => a + b, 0) / vig.length) * 1000) / 1000 : null,
                yieldKg: rows.reduce((t, r) => t + r.h.yieldKg, 0), teaAreaM2: Math.round(rows.reduce((t, r) => t + r.h.teaAreaM2, 0)),
            },
            producers: { total: block.producers.length, byFlag, yieldKg: block.producers.reduce((t, p) => t + p.yieldKg, 0), quotaKg: block.producers.reduce((t, p) => t + p.quotaKg, 0) },
            localities: [...locMap.entries()].map(([name, e]) => ({ name, gardens: e.gardens, suspects: e.suspects, meanVigour: e.vig.length ? Math.round((e.vig.reduce((a, b) => a + b, 0) / e.vig.length) * 1000) / 1000 : null })).sort((a, b) => b.suspects - a.suspects || b.gardens - a.gardens),
            fertilisation: { records: records.length, byResponse },
            neighbourhood: block.neighbourhood,
        };
    }

    async gardens(areaId: string, query: HealthGardenQueryDto): Promise<Paginated<HealthGardenRow>> {
        const { rows } = await this.gardenRows(areaId, query.season);
        const search = query.search?.trim().toLocaleLowerCase('tr-TR');
        const order: Record<HealthAnomalyClass, number> = { chemical_suspect: 0, defoliation: 1, stress: 2, none: 3, no_data: 4 };
        const filtered = rows
            .filter((r) => {
                if (query.anomaly && r.anomaly.class !== query.anomaly) return false;
                if (query.locality && r.locality !== query.locality) return false;
                if (search && ![r.producerName, r.producerCode, r.walletNo, r.code, `${r.block}/${r.parcel}`, r.locality].join(' ').toLocaleLowerCase('tr-TR').includes(search)) return false;
                return true;
            })
            .sort((a, b) => order[a.anomaly.class] - order[b.anomaly.class] || (b.anomaly.z ?? 0) - (a.anomaly.z ?? 0) || (a.vigour ?? 9) - (b.vigour ?? 9));
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        return paginate(filtered.slice((page - 1) * limit, page * limit), filtered.length, page, limit);
    }

    async garden(areaId: string, code: string, requested?: string): Promise<HealthGardenDetail> {
        const area = await this.findArea(areaId);
        const { season, block } = this.resolveSeason(area, requested);
        const g = await this.gardenRepo.findOne({ where: { areaId, code } });
        if (!g) throw new NotFoundException('Garden not found');
        const h = g.health?.[season];
        if (!h) throw new NotFoundException('No health result for this garden and season');
        const names = await this.producerIdentities(areaId);
        const records = await this.fertRepo.find({ where: { areaCode: area.code, gardenCode: code }, order: { appliedAt: 'DESC' } });
        const row = this.toRow(g, h, names.get(g.producerCode) ?? null, records.length);
        const rel = (vals: Array<number | null> | undefined, med: Array<number | null>) => (vals ?? []).map((v, i) => (v != null && med[i] != null ? Math.round((v - (med[i] as number)) * 1000) / 1000 : null));
        return {
            ...row,
            dates: block.neighbourhood.dates,
            series: h.series,
            relative: { ndvi: rel(h.series?.ndvi, block.neighbourhood.ndviMedian), ndre: rel(h.series?.ndre, block.neighbourhood.ndreMedian) },
            neighbourhood: { ndviMedian: block.neighbourhood.ndviMedian, ndreMedian: block.neighbourhood.ndreMedian },
            radarDates: block.sensors.backscatter.map((b) => ({ pass: b.pass, dates: b.dates })),
            fertilisationRecords: records.map((r) => this.fertView(r, h, block)),
        };
    }

    async producers(areaId: string, query: HealthProducerQueryDto): Promise<Paginated<HealthProducerView>> {
        const area = await this.findArea(areaId);
        const { block } = this.resolveSeason(area, query.season);
        const identities = await this.producerIdentities(areaId, true);
        const search = query.search?.trim().toLocaleLowerCase('tr-TR');
        const order: Record<HealthProducerRow['flag'], number> = { low: 0, high: 1, no_license: 2, ok: 3, no_data: 4 };
        const rows = block.producers
            .map((p) => {
                const who = identities.get(p.code);
                return { ...p, id: who?.id ?? p.code, name: who?.name ?? p.code, walletNo: who?.walletNo ?? '', licenseNo: who?.licenseNo ?? '' };
            })
            .filter((r) => {
                if (query.flag && r.flag !== query.flag) return false;
                if (search && ![r.name, r.code, r.walletNo, r.licenseNo].join(' ').toLocaleLowerCase('tr-TR').includes(search)) return false;
                return true;
            })
            .sort((a, b) => order[a.flag] - order[b.flag] || Math.abs((b.ratio ?? 1) - 1) - Math.abs((a.ratio ?? 1) - 1) || a.name.localeCompare(b.name, 'tr-TR'));
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        return paginate(rows.slice((page - 1) * limit, page * limit), rows.length, page, limit);
    }

    async producersCsv(areaId: string, requested?: string): Promise<string> {
        const rows = (await this.producers(areaId, { season: requested, page: 1, limit: 200 })).data;
        const cell = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const FLAG: Record<HealthProducerRow['flag'], string> = { ok: 'Uyumlu', low: 'Tahmin düşük', high: 'Tahmin yüksek', no_license: 'Ruhsat yok', no_data: 'Veri yok' };
        const header = ['Müstahsil no', 'Ad soyad', 'Cüzdan no', 'Ruhsat no', 'Bahçe', 'Çay alanı (m²)', 'Ruhsat alanı (m²)', 'Rekolte tahmini (kg)', 'Kota (kg)', 'Oran', 'Bayrak', 'Ort. canlılık', 'Kimyasal şüphesi', 'Yaprak kaybı', 'Stres', 'Not', 'Demo'];
        const lines = rows.map((r) => [r.code, r.name, r.walletNo, r.licenseNo, r.gardens, r.teaAreaM2, r.licensedAreaM2, r.yieldKg, r.quotaKg, r.ratio ?? '', FLAG[r.flag], r.meanVigour ?? '', r.anomalies.chemical_suspect ?? 0, r.anomalies.defoliation ?? 0, r.anomalies.stress ?? 0, r.reason, 'Evet · kalibre edilmedi'].map(cell).join(';'));
        return `﻿${header.map(cell).join(';')}\n${lines.join('\n')}\n`;
    }

    async layers(areaId: string, requested?: string): Promise<{ type: 'FeatureCollection'; features: Array<{ type: 'Feature'; geometry: Record<string, unknown>; properties: Record<string, unknown> }> }> {
        const { rows } = await this.gardenRows(areaId, requested);
        return {
            type: 'FeatureCollection',
            features: rows.map((r) => ({
                type: 'Feature',
                geometry: r.geometry,
                properties: { code: r.code, block: r.block, parcel: r.parcel, producerName: r.producerName, producerCode: r.producerCode, anomaly: r.anomaly.class, date: r.anomaly.date, z: r.anomaly.z, vigour: r.vigour, yieldKg: r.yieldKg, teaAreaM2: r.teaAreaM2 },
            })),
        };
    }

    // ── fertilisation ──

    async fertilisations(areaId: string, gardenCode?: string, requested?: string): Promise<FertilisationView[]> {
        const area = await this.findArea(areaId);
        const { season, block } = this.resolveSeason(area, requested);
        const records = await this.fertRepo.find({ where: gardenCode ? { areaCode: area.code, gardenCode } : { areaCode: area.code }, order: { appliedAt: 'DESC' } });
        const codes = [...new Set(records.map((r) => r.gardenCode))];
        const gardens = codes.length ? await this.gardenRepo.find({ where: { areaId }, select: ['code', 'health'] }) : [];
        const byCode = new Map(gardens.map((g) => [g.code, g]));
        return records.map((r) => this.fertView(r, byCode.get(r.gardenCode)?.health?.[season] ?? null, block));
    }

    async addFertilisation(areaId: string, dto: CreateFertilisationDto, userId: string): Promise<FertilisationView> {
        const area = await this.findArea(areaId);
        const g = await this.gardenRepo.findOne({ where: { areaId, code: dto.gardenCode } });
        if (!g) throw new NotFoundException('Garden not found');
        if (g.recordStatus !== 'active') throw new BadRequestException('Bölünmüş bahçe kaydına girdi yazılamaz');
        const user = await this.userRepo.findOne({ where: { id: userId } });
        const rec = await this.fertRepo.save(this.fertRepo.create({
            areaCode: area.code, gardenCode: g.code, producerCode: g.producerCode, appliedAt: dto.appliedAt.slice(0, 10), type: dto.type, product: dto.product?.trim() ?? '',
            amountKgPerDa: dto.amountKgPerDa ?? null, note: dto.note?.trim() || null, source: dto.source ?? 'staff', createdById: userId, createdByName: user?.fullName ?? 'Sistem',
        }));
        const seasons = (area.health?.seasons ?? []).map((s) => s.season).sort();
        const year = rec.appliedAt.slice(0, 4);
        const season = seasons.includes(year) ? year : seasons.at(-1);
        const block = area.health?.seasons.find((s) => s.season === season) ?? null;
        return this.fertView(rec, season ? (g.health?.[season] ?? null) : null, block);
    }

    async removeFertilisation(areaId: string, id: string): Promise<void> {
        const area = await this.findArea(areaId);
        const res = await this.fertRepo.delete({ id, areaCode: area.code });
        if (!res.affected) throw new NotFoundException('Record not found');
    }

    /** NDRE / NDVI against the neighbourhood before (20 days) and after (10–35 days) the application. */
    private response(rec: FertilisationRecord, h: GardenHealthSeason | null, block: HealthBlock['seasons'][number] | null): FertilisationView['response'] {
        const empty = (cls: FertilisationResponseClass, reason: string): FertilisationView['response'] => ({ class: cls, ndreBefore: null, ndreAfter: null, ndviBefore: null, ndviAfter: null, deltaNdre: null, deltaNdvi: null, nBefore: 0, nAfter: 0, reason });
        if (!h?.series || !block) return empty('no_data', 'Bu sezon için uydu serisi yok');
        const dates = block.neighbourhood.dates;
        const d = dayOf(rec.appliedAt);
        const rel = (vals: Array<number | null>, med: Array<number | null>, from: number, to: number): number[] => {
            const out: number[] = [];
            dates.forEach((dt, i) => { const t = dayOf(dt); const v = vals[i]; const m = med[i]; if (v != null && m != null && t >= from && t <= to) out.push(v - m); });
            return out;
        };
        const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
        const ndreB = rel(h.series.ndre, block.neighbourhood.ndreMedian, d - 20, d - 1);
        const ndreA = rel(h.series.ndre, block.neighbourhood.ndreMedian, d + 10, d + 35);
        const ndviB = rel(h.series.ndvi, block.neighbourhood.ndviMedian, d - 20, d - 1);
        const ndviA = rel(h.series.ndvi, block.neighbourhood.ndviMedian, d + 10, d + 35);
        const r3 = (v: number | null) => (v == null ? null : Math.round(v * 1000) / 1000);
        const base = { ndreBefore: r3(mean(ndreB)), ndreAfter: r3(mean(ndreA)), ndviBefore: r3(mean(ndviB)), ndviAfter: r3(mean(ndviA)), nBefore: ndreB.length, nAfter: ndreA.length };
        const lastDate = dates.at(-1);
        if (ndreB.length < 1 || ndreA.length < 1) {
            const pending = lastDate != null && dayOf(lastDate) < d + 35;
            return { ...base, class: pending ? 'pending' : 'no_data', deltaNdre: null, deltaNdvi: null, reason: pending ? 'Uygulama sonrası 10–35 gün penceresi henüz dolmadı' : 'Uygulama öncesi/sonrası bulutsuz gözlem yok' };
        }
        const deltaNdre = (base.ndreAfter as number) - (base.ndreBefore as number);
        const deltaNdvi = (base.ndviAfter as number) - (base.ndviBefore as number);
        let cls: FertilisationResponseClass = 'none';
        if (deltaNdre >= 0.03) cls = 'strong';
        else if (deltaNdre >= 0.012) cls = 'weak';
        else if (deltaNdre <= -0.02) cls = 'negative';
        const label: Record<FertilisationResponseClass, string> = { strong: 'belirgin yeşillenme (komşulara göre)', weak: 'hafif tepki', none: 'ölçülebilir tepki yok', negative: 'komşulara göre geriledi (yanık / aşırı doz / yanlış kayıt?)', pending: '', no_data: '' };
        return { ...base, class: cls, deltaNdre: r3(deltaNdre), deltaNdvi: r3(deltaNdvi), reason: `NDRE ${r3(base.ndreBefore)} → ${r3(base.ndreAfter)} (${deltaNdre >= 0 ? '+' : ''}${r3(deltaNdre)}), NDVI ${deltaNdvi >= 0 ? '+' : ''}${r3(deltaNdvi)}: ${label[cls]}` };
    }

    private fertView(r: FertilisationRecord, h: GardenHealthSeason | null, block: HealthBlock['seasons'][number] | null): FertilisationView {
        return {
            id: r.id, gardenCode: r.gardenCode, producerCode: r.producerCode, appliedAt: r.appliedAt, type: r.type, product: r.product, amountKgPerDa: r.amountKgPerDa, note: r.note,
            source: r.source, createdByName: r.createdByName, createdAt: r.createdAt.toISOString(), response: this.response(r, h, block),
        };
    }

    // ── helpers ──

    private async gardenRows(areaId: string, requested?: string): Promise<{ season: string; rows: HealthGardenRow[] }> {
        const area = await this.findArea(areaId);
        const { season } = this.resolveSeason(area, requested);
        const [gardens, names, records] = await Promise.all([
            this.gardenRepo.find({ where: { areaId, recordStatus: 'active' } }),
            this.producerIdentities(areaId),
            this.fertRepo.find({ where: { areaCode: area.code }, select: ['gardenCode'] }),
        ]);
        const fertCount = new Map<string, number>();
        for (const r of records) fertCount.set(r.gardenCode, (fertCount.get(r.gardenCode) ?? 0) + 1);
        const rows = gardens
            .map((g) => { const h = g.health?.[season]; return h ? this.toRow(g, h, names.get(g.producerCode) ?? null, fertCount.get(g.code) ?? 0) : null; })
            .filter((r): r is HealthGardenRow => !!r);
        return { season, rows };
    }

    private toRow(g: TeaInventoryGarden, h: GardenHealthSeason, who: { name: string; walletNo: string } | null, fertilisations: number): HealthGardenRow {
        return {
            id: g.id, code: g.code, block: g.block, parcel: g.parcel, locality: g.locality || '—', producerCode: g.producerCode, producerName: who?.name ?? '', walletNo: who?.walletNo ?? '',
            licenseCode: g.licenseCode, teaAreaM2: h.teaAreaM2, licensedAreaM2: h.licensedAreaM2, vigour: h.vigour, ndviMean: h.ndviMean, ndreMean: h.ndreMean, nbhdNdviMean: h.nbhdNdviMean,
            prunedShare: h.prunedShare, anomaly: h.anomaly, yieldKg: h.yieldKg, yieldFactors: h.yieldFactors, observations: h.observations, fertilisations, geometry: g.geometry,
        };
    }

    private resolveSeason(area: TeaInventoryArea, requested?: string): { season: string; block: HealthBlock['seasons'][number] } {
        const seasons = area.health?.seasons ?? [];
        if (seasons.length === 0) throw new NotFoundException('No garden-health results for this area yet (run scan-health)');
        const sorted = [...seasons].sort((a, b) => a.season.localeCompare(b.season));
        const block = (requested && sorted.find((s) => s.season === requested)) || (sorted.at(-1) as HealthBlock['seasons'][number]);
        return { season: block.season, block };
    }

    private async producerIdentities(areaId: string, withId = false): Promise<Map<string, { id: string; name: string; walletNo: string; licenseNo: string }>> {
        void withId;
        const rows = await this.producerRepo
            .createQueryBuilder('p')
            .select(['p.id AS id', 'p.code AS code', 'p.name AS name', 'p.wallet_no AS "walletNo"', 'p.license_no AS "licenseNo"'])
            .distinctOn(['p.code'])
            .where('p.area_id = :areaId', { areaId })
            .orderBy('p.code', 'ASC')
            .addOrderBy('p.season', 'DESC')
            .getRawMany<{ id: string; code: string; name: string; walletNo: string; licenseNo: string }>();
        return new Map(rows.map((r) => [r.code, r]));
    }

    private async findArea(id: string): Promise<TeaInventoryArea> {
        const area = await this.areaRepo.findOne({ where: { id } });
        if (!area) throw new NotFoundException('Inventory area not found');
        return area;
    }
}
