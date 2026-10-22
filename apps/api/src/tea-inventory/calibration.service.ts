import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { FusionClass, TeaInventoryGarden } from '@/tea-inventory/entities/tea-inventory-garden.entity';
import { TeaInventoryProducer } from '@/tea-inventory/entities/tea-inventory-producer.entity';
import { CalibrationLabel, CalibrationLabelValue, CalibrationMethod } from '@/tea-inventory/entities/calibration-label.entity';
import { CalibrationQueryDto, SaveCalibrationLabelDto } from '@/tea-inventory/dto';
import { PruningFusionService } from '@/tea-inventory/pruning-fusion.service';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

export interface CalibrationLabelView {
    id: string;
    gardenCode: string;
    season: string;
    label: CalibrationLabelValue;
    method: CalibrationMethod;
    observedAt: string;
    lat: number | null;
    lng: number | null;
    accuracyM: number | null;
    prunedShare: number | null;
    note: string | null;
    hasPhoto: boolean;
    systemClassAtLabel: string | null;
    systemZAtLabel: number | null;
    createdByName: string;
    updatedAt: string;
}

/** One garden of the field plan: where to go, what the satellite said, what the field said. */
export interface CalibrationPlanRow {
    gardenId: string;
    gardenCode: string;
    block: string;
    parcel: string;
    locality: string;
    holderIndex: number;
    holderCount: number;
    producerCode: string;
    producerName: string;
    areaM2: number;
    lat: number;
    lng: number;
    systemClass: FusionClass;
    systemZ: number | null;
    changeDate: string | null;
    detectedAt: string | null;
    geometry: Record<string, unknown>;
    label: CalibrationLabelView | null;
}

export interface CalibrationMetrics {
    season: string;
    planSize: number;
    labelled: number;
    pending: number;
    byLabel: Record<CalibrationLabelValue, number>;
    bySystemClass: Record<FusionClass, number>;
    /** confusion[systemClass][label] */
    confusion: Record<FusionClass, Record<CalibrationLabelValue, number>>;
    positives: number;
    negatives: number;
    /** Policy view: pruned + likely count as "detected". */
    recall: number | null;
    falseAlarmRate: number | null;
    precision: number | null;
    /** Strict view: only "pruned" counts as detected. */
    recallStrict: number | null;
    falseAlarmRateStrict: number | null;
    sweep: Array<{ z: number; recall: number; falseAlarmRate: number; f1: number; detected: number }>;
    suggested: { zPruned: number; zLikely: number; f1: number } | null;
    currentRules: { zPruned: number; zLikely: number; zUnclear: number };
    calibrated: boolean;
    requirement: { minPositives: number; minNegatives: number };
    byLocality: Array<{ name: string; planned: number; labelled: number }>;
}

const MIN_POSITIVES = 15;
const MIN_NEGATIVES = 15;
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/**
 * The calibration campaign: a stratified field plan (which gardens to visit), ground-truth
 * labels with photo and position, and the scoring of the satellite verdicts against them —
 * recall, false-alarm rate, confusion matrix and the z threshold that best separates the
 * labels. Labels are keyed by codes so a re-import of the satellite results keeps them.
 */
@Injectable()
export class CalibrationService {
    constructor(
        @InjectRepository(CalibrationLabel) private readonly labelRepo: Repository<CalibrationLabel>,
        @InjectRepository(TeaInventoryArea) private readonly areaRepo: Repository<TeaInventoryArea>,
        @InjectRepository(TeaInventoryGarden) private readonly gardenRepo: Repository<TeaInventoryGarden>,
        @InjectRepository(TeaInventoryProducer) private readonly producerRepo: Repository<TeaInventoryProducer>,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
        private readonly fusion: PruningFusionService,
    ) { }

    async plan(areaId: string, query: CalibrationQueryDto): Promise<Paginated<CalibrationPlanRow> & { season: string; planSize: number; localities: string[] }> {
        const { area, season, rows } = await this.planRows(areaId, query.season, query.size);
        void area;
        const localities = [...new Set(rows.map((r) => r.locality))].sort((a, b) => a.localeCompare(b, 'tr-TR'));
        const filtered = rows.filter((r) => (query.pending !== 'true' || !r.label) && (!query.locality || r.locality === query.locality));
        const page = query.page ?? 1;
        const limit = query.limit ?? 50;
        return { ...paginate(filtered.slice((page - 1) * limit, page * limit), filtered.length, page, limit), season, planSize: rows.length, localities };
    }

    async labels(areaId: string, query: CalibrationQueryDto): Promise<Paginated<CalibrationPlanRow>> {
        const area = await this.findArea(areaId);
        const season = this.fusion.resolveSeason(area, query.season);
        const [labels, gardens, producers] = await Promise.all([
            this.labelRepo.find({ where: { areaCode: area.code, season }, order: { updatedAt: 'DESC' } }),
            this.gardenRepo.find({ where: { areaId, recordStatus: 'active' } }),
            this.producerRepo.find({ where: { areaId, season } }),
        ]);
        const gardenByCode = new Map(gardens.map((g) => [g.code, g]));
        const producerByCode = new Map(producers.map((p) => [p.code, p]));
        const rows = labels
            .map((l) => {
                const g = gardenByCode.get(l.gardenCode);
                return g ? this.planRow(g, season, producerByCode.get(g.producerCode) ?? null, l) : null;
            })
            .filter((r): r is CalibrationPlanRow => !!r)
            .filter((r) => !query.locality || r.locality === query.locality);
        const page = query.page ?? 1;
        const limit = query.limit ?? 50;
        return paginate(rows.slice((page - 1) * limit, page * limit), rows.length, page, limit);
    }

    async save(areaId: string, dto: SaveCalibrationLabelDto, userId: string): Promise<CalibrationLabelView> {
        const area = await this.findArea(areaId);
        const season = this.fusion.resolveSeason(area, dto.season);
        const garden = await this.gardenRepo.findOne({ where: { areaId, code: dto.gardenCode } });
        if (!garden) throw new NotFoundException('Garden not found in this area');
        const f = garden.seasons[season]?.fusion ?? null;
        const user = await this.userRepo.findOne({ where: { id: userId } });
        const existing = await this.labelRepo.findOne({ where: { areaCode: area.code, season, gardenCode: dto.gardenCode } });
        const row = existing ?? this.labelRepo.create({ areaCode: area.code, season, gardenCode: dto.gardenCode, createdById: userId, createdByName: user?.fullName ?? 'Saha' });
        row.label = dto.label;
        row.method = dto.method ?? 'field_visit';
        row.observedAt = dto.observedAt.slice(0, 10);
        row.lat = dto.lat ?? null;
        row.lng = dto.lng ?? null;
        row.accuracyM = dto.accuracyM ?? null;
        row.prunedShare = dto.prunedShare ?? (dto.label === 'pruned' ? 1 : dto.label === 'not_pruned' ? 0 : null);
        row.note = dto.note?.trim() || null;
        row.systemClassAtLabel = f?.verdict.class ?? null;
        row.systemZAtLabel = f?.verdict.z ?? null;
        row.createdById = userId;
        row.createdByName = user?.fullName ?? row.createdByName;
        const saved = await this.labelRepo.save(row);
        return this.labelView(saved);
    }

    async savePhoto(areaId: string, labelId: string, file: Express.Multer.File): Promise<CalibrationLabelView> {
        const area = await this.findArea(areaId);
        const row = await this.labelRepo.findOne({ where: { id: labelId, areaCode: area.code } });
        if (!row) throw new NotFoundException('Label not found');
        if (!file?.buffer?.length) throw new BadRequestException('Fotoğraf boş');
        if (file.size > PHOTO_MAX_BYTES) throw new BadRequestException('Fotoğraf 2 MB\'ı aşamaz; uygulama küçültülmüş kopya göndermeli');
        if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) throw new BadRequestException('Yalnız JPEG, PNG veya WebP');
        await this.labelRepo.update({ id: row.id }, { photo: file.buffer, photoMime: file.mimetype, photoBytes: file.size });
        const fresh = await this.labelRepo.findOne({ where: { id: row.id } });
        return this.labelView(fresh as CalibrationLabel);
    }

    async photo(areaId: string, labelId: string): Promise<{ buffer: Buffer; mime: string }> {
        const area = await this.findArea(areaId);
        const row = await this.labelRepo.createQueryBuilder('l').addSelect('l.photo').where('l.id = :id AND l.area_code = :code', { id: labelId, code: area.code }).getOne();
        if (!row?.photo) throw new NotFoundException('Photo not found');
        return { buffer: row.photo, mime: row.photoMime ?? 'image/jpeg' };
    }

    async remove(areaId: string, labelId: string): Promise<void> {
        const area = await this.findArea(areaId);
        const res = await this.labelRepo.delete({ id: labelId, areaCode: area.code });
        if (!res.affected) throw new NotFoundException('Label not found');
    }

    async metrics(areaId: string, requested?: string, size?: number): Promise<CalibrationMetrics> {
        const { area, season, rows } = await this.planRows(areaId, requested, size);
        const labels = await this.labelRepo.find({ where: { areaCode: area.code, season } });
        const gardens = await this.gardenRepo.find({ where: { areaId, recordStatus: 'active' } });
        const gardenByCode = new Map(gardens.map((g) => [g.code, g]));
        const classes: FusionClass[] = ['pruned', 'likely', 'unclear', 'not_pruned', 'no_data'];
        const values: CalibrationLabelValue[] = ['pruned', 'partial', 'not_pruned', 'unsure'];
        const confusion = Object.fromEntries(classes.map((c) => [c, Object.fromEntries(values.map((v) => [v, 0]))])) as CalibrationMetrics['confusion'];
        const byLabel = Object.fromEntries(values.map((v) => [v, 0])) as Record<CalibrationLabelValue, number>;
        const bySystemClass = Object.fromEntries(classes.map((c) => [c, 0])) as Record<FusionClass, number>;
        const scored: Array<{ truth: boolean; cls: FusionClass; z: number }> = [];
        for (const l of labels) {
            const f = gardenByCode.get(l.gardenCode)?.seasons[season]?.fusion;
            const cls: FusionClass = f?.verdict.class ?? 'no_data';
            confusion[cls][l.label]++;
            byLabel[l.label]++;
            bySystemClass[cls]++;
            if (l.label === 'unsure' || cls === 'no_data') continue;
            scored.push({ truth: l.label !== 'not_pruned', cls, z: f?.verdict.z ?? 0 });
        }
        const positives = scored.filter((s) => s.truth).length;
        const negatives = scored.length - positives;
        const rate = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 1000 : null);
        const detectedPolicy = (s: { cls: FusionClass }) => s.cls === 'pruned' || s.cls === 'likely';
        const detectedStrict = (s: { cls: FusionClass }) => s.cls === 'pruned';
        const tpP = scored.filter((s) => s.truth && detectedPolicy(s)).length;
        const fpP = scored.filter((s) => !s.truth && detectedPolicy(s)).length;
        const tpS = scored.filter((s) => s.truth && detectedStrict(s)).length;
        const fpS = scored.filter((s) => !s.truth && detectedStrict(s)).length;
        const sweep: CalibrationMetrics['sweep'] = [];
        for (let z = 1; z <= 8.0001; z += 0.25) {
            const det = scored.filter((s) => s.z >= z);
            const tp = det.filter((s) => s.truth).length;
            const fp = det.length - tp;
            const recall = positives ? tp / positives : 0;
            const far = negatives ? fp / negatives : 0;
            const precision = det.length ? tp / det.length : 0;
            const f1 = recall + precision ? (2 * recall * precision) / (recall + precision) : 0;
            sweep.push({ z: Math.round(z * 100) / 100, recall: Math.round(recall * 1000) / 1000, falseAlarmRate: Math.round(far * 1000) / 1000, f1: Math.round(f1 * 1000) / 1000, detected: det.length });
        }
        const enough = positives >= MIN_POSITIVES && negatives >= MIN_NEGATIVES;
        let suggested: CalibrationMetrics['suggested'] = null;
        if (enough) {
            const best = sweep.reduce((b, s) => (s.f1 > b.f1 || (s.f1 === b.f1 && s.z > b.z) ? s : b), sweep[0]);
            // "likely" sits where recall is still ≥ 0.85, never below the noise floor of the candidate-date search.
            const likely = [...sweep].reverse().find((s) => s.recall >= 0.85 && s.z < best.z)?.z ?? Math.max(1.5, best.z - 0.7);
            suggested = { zPruned: best.z, zLikely: Math.round(Math.min(likely, best.z) * 100) / 100, f1: best.f1 };
        }
        const rules = (area.producerScan?.fusion?.rules ?? {}) as Record<string, number>;
        const planned = new Map<string, { planned: number; labelled: number }>();
        for (const r of rows) {
            const e = planned.get(r.locality) ?? { planned: 0, labelled: 0 };
            e.planned++;
            if (r.label) e.labelled++;
            planned.set(r.locality, e);
        }
        return {
            season,
            planSize: rows.length,
            labelled: labels.length,
            pending: rows.filter((r) => !r.label).length,
            byLabel,
            bySystemClass,
            confusion,
            positives,
            negatives,
            recall: rate(tpP, positives),
            falseAlarmRate: rate(fpP, negatives),
            precision: rate(tpP, tpP + fpP),
            recallStrict: rate(tpS, positives),
            falseAlarmRateStrict: rate(fpS, negatives),
            sweep,
            suggested,
            currentRules: { zPruned: rules.zPruned ?? 3.5, zLikely: rules.zLikely ?? 2.8, zUnclear: rules.zUnclear ?? 1.5 },
            calibrated: enough,
            requirement: { minPositives: MIN_POSITIVES, minNegatives: MIN_NEGATIVES },
            byLocality: [...planned.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.planned - a.planned),
        };
    }

    /** Labels as CSV for the engine's calibrate-fusion step (UTF-8 BOM, Excel-compatible). */
    async labelsCsv(areaId: string, requested?: string): Promise<string> {
        const area = await this.findArea(areaId);
        const season = this.fusion.resolveSeason(area, requested);
        const labels = await this.labelRepo.find({ where: { areaCode: area.code, season }, order: { gardenCode: 'ASC' } });
        const cell = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const header = ['area', 'season', 'garden', 'label', 'method', 'observedAt', 'prunedShare', 'lat', 'lng', 'accuracyM', 'systemClassAtLabel', 'systemZAtLabel', 'note', 'labelledBy', 'updatedAt'];
        const lines = labels.map((l) => [area.code, season, l.gardenCode, l.label, l.method, l.observedAt, l.prunedShare, l.lat, l.lng, l.accuracyM, l.systemClassAtLabel, l.systemZAtLabel, l.note, l.createdByName, l.updatedAt.toISOString()].map(cell).join(';'));
        return `﻿${header.map(cell).join(';')}\n${lines.join('\n')}\n`;
    }

    // ── plan ──

    private async planRows(areaId: string, requested?: string, size = 240): Promise<{ area: TeaInventoryArea; season: string; rows: CalibrationPlanRow[] }> {
        const area = await this.findArea(areaId);
        const season = this.fusion.resolveSeason(area, requested);
        const [gardens, producers, labels] = await Promise.all([
            this.gardenRepo.find({ where: { areaId, recordStatus: 'active' } }),
            this.producerRepo.find({ where: { areaId, season } }),
            this.labelRepo.find({ where: { areaCode: area.code, season } }),
        ]);
        const producerByCode = new Map(producers.map((p) => [p.code, p]));
        const labelByGarden = new Map(labels.map((l) => [l.gardenCode, l]));
        const withVerdict = gardens.filter((g) => g.seasons[season]?.fusion);
        // Deterministic shuffle: the same plan every day for the field team.
        const ordered = [...withVerdict].sort((a, b) => this.hash(`${area.code}|${a.code}`) - this.hash(`${area.code}|${b.code}`));
        const byClass = new Map<FusionClass, TeaInventoryGarden[]>();
        for (const g of ordered) {
            const c = g.seasons[season].fusion?.verdict.class ?? 'no_data';
            byClass.set(c, [...(byClass.get(c) ?? []), g]);
        }
        const quota: Array<[FusionClass, number]> = [
            ['pruned', Infinity],
            ['likely', Math.round(size * 0.3)],
            ['not_pruned', Math.round(size * 0.25)],
            ['unclear', Math.round(size * 0.45)],
        ];
        const chosen: TeaInventoryGarden[] = [];
        const taken = new Set<string>();
        for (const [cls, n] of quota) {
            for (const g of (byClass.get(cls) ?? []).slice(0, n)) { chosen.push(g); taken.add(g.code); }
        }
        // Fill the remaining budget from any class, and always include every labelled garden.
        for (const g of ordered) {
            if (chosen.length >= size) break;
            if (!taken.has(g.code)) { chosen.push(g); taken.add(g.code); }
        }
        for (const g of withVerdict) if (labelByGarden.has(g.code) && !taken.has(g.code)) { chosen.push(g); taken.add(g.code); }
        const rows = chosen
            .map((g) => this.planRow(g, season, producerByCode.get(g.producerCode) ?? null, labelByGarden.get(g.code) ?? null))
            .sort((a, b) => a.locality.localeCompare(b.locality, 'tr-TR') || a.block.localeCompare(b.block, undefined, { numeric: true }) || a.parcel.localeCompare(b.parcel, undefined, { numeric: true }));
        return { area, season, rows };
    }

    private planRow(g: TeaInventoryGarden, season: string, producer: TeaInventoryProducer | null, label: CalibrationLabel | null): CalibrationPlanRow {
        const f = g.seasons[season]?.fusion ?? null;
        const [lng, lat] = this.centroid(g.geometry);
        return {
            gardenId: g.id,
            gardenCode: g.code,
            block: g.block,
            parcel: g.parcel,
            locality: g.locality || '—',
            holderIndex: g.holderIndex,
            holderCount: g.holderCount,
            producerCode: g.producerCode,
            producerName: producer?.name ?? '',
            areaM2: Math.round(g.planimetricAreaM2 || g.geometryAreaM2),
            lat,
            lng,
            systemClass: f?.verdict.class ?? 'no_data',
            systemZ: f?.verdict.z ?? null,
            changeDate: f?.verdict.changeDate ?? null,
            detectedAt: f?.detectedAt ?? f?.likelyAt ?? null,
            geometry: g.geometry,
            label: label ? this.labelView(label) : null,
        };
    }

    private labelView(l: CalibrationLabel): CalibrationLabelView {
        return {
            id: l.id, gardenCode: l.gardenCode, season: l.season, label: l.label, method: l.method, observedAt: l.observedAt, lat: l.lat, lng: l.lng, accuracyM: l.accuracyM,
            prunedShare: l.prunedShare, note: l.note, hasPhoto: l.photoBytes > 0, systemClassAtLabel: l.systemClassAtLabel, systemZAtLabel: l.systemZAtLabel,
            createdByName: l.createdByName, updatedAt: l.updatedAt.toISOString(),
        };
    }

    private centroid(geometry: Record<string, unknown>): [number, number] {
        const coords = geometry.coordinates as unknown;
        const rings: number[][][] = geometry.type === 'Polygon' ? [(coords as number[][][])[0]] : geometry.type === 'MultiPolygon' ? (coords as number[][][][]).map((p) => p[0]) : [];
        const pts = rings.flat();
        if (pts.length === 0) return [0, 0];
        return [pts.reduce((t, p) => t + p[0], 0) / pts.length, pts.reduce((t, p) => t + p[1], 0) / pts.length];
    }

    /** FNV-1a: small, stable, dependency-free. */
    private hash(s: string): number {
        let h = 0x811c9dc5;
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 0x01000193) >>> 0;
        }
        return h;
    }

    private async findArea(id: string): Promise<TeaInventoryArea> {
        const area = await this.areaRepo.findOne({ where: { id } });
        if (!area) throw new NotFoundException('Inventory area not found');
        return area;
    }
}
