import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { CalibrationLabel, CalibrationLabelValue } from '@/tea-inventory/entities/calibration-label.entity';
import { CombinedClass, CombinedGarden, CombinedHistory, CombinedSeason } from '@/tea-inventory/entities/pruning-combined.types';
import { CombinedWorklistQueryDto, SaveCalibrationLabelDto } from '@/tea-inventory/dto';
import { CombinedGardenRow, PruningCombinedService } from '@/tea-inventory/pruning-combined.service';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

/** Why a garden is on the expert's list; the web app carries the wording. */
export type WorklistReason =
    | 'repeated_ground'
    | 'followup_permanent'
    | 'followup_repeating'
    | 'probable_single_module'
    | 'probable_dates_differ'
    | 'tips_target'
    | 'fresh_cut'
    | 'confirmed_check'
    | 'light_check'
    | 'seasonal_check'
    | 'control_sample';

export interface WorklistLabel {
    id: string;
    label: CalibrationLabelValue;
    method: string;
    observedAt: string;
    prunedShare: number | null;
    note: string | null;
    labelledBy: string;
    updatedAt: string;
}
export interface WorklistRow extends CombinedGardenRow {
    priority: number;
    reasons: WorklistReason[];
    label: WorklistLabel | null;
}
export interface WorklistRate {
    hit: number;
    n: number;
}
/** What the saved ground labels say about the combined classes of this season. */
export interface WorklistFieldMetrics {
    labelled: number;
    byClass: Partial<Record<CombinedClass, Record<CalibrationLabelValue, number>>>;
    /** Share of labelled detections the ground confirmed (pruned or partial), per class; "unsure" is left out. */
    precision: Record<'confirmed' | 'probable' | 'light' | 'seasonal', WorklistRate>;
    /** Labelled "no pruning" gardens that were in fact pruned: the miss rate of the control sample. */
    missed: WorklistRate;
}
export type Worklist = Paginated<WorklistRow> & { season: string; inProgress: boolean; listed: number; pending: number; field: WorklistFieldMetrics };

const WEIGHT: Record<WorklistReason, number> = {
    repeated_ground: 40,
    followup_permanent: 35,
    followup_repeating: 30,
    probable_single_module: 60,
    probable_dates_differ: 60,
    tips_target: 25,
    fresh_cut: 20,
    confirmed_check: 45,
    light_check: 30,
    seasonal_check: 30,
    control_sample: 15,
};
/** Gardens with no detection that are visited anyway, so the miss rate can be measured. */
const CONTROL_SAMPLE = 30;
/** A cut whose bracket closed within this many days of the last image is fresh enough to be seen on the ground. */
const FRESH_DAYS = 35;
const DAY = 86_400_000;

/** Stable pseudo-random order of garden codes, so the control sample does not change between requests. */
function hash(text: string): number {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/**
 * Expert worklist of the combined verdict: which gardens to look at first and why, and what the ground labels saved
 * so far say about each class. Labels are the calibration labels (one per garden and season); nothing here changes a verdict.
 */
@Injectable()
export class PruningWorklistService {
    constructor(
        private readonly combined: PruningCombinedService,
        @InjectRepository(TeaInventoryArea) private readonly areaRepo: Repository<TeaInventoryArea>,
        @InjectRepository(CalibrationLabel) private readonly labelRepo: Repository<CalibrationLabel>,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
    ) { }

    async worklist(areaId: string, query: CombinedWorklistQueryDto): Promise<Worklist> {
        const { season, history } = await this.combined.load(areaId, query.season);
        const areaCode = await this.areaCode(areaId);
        const labels = await this.labelRepo.find({ where: { areaCode, season: season.season } });
        const labelByGarden = new Map(labels.map((l) => [l.gardenCode, l]));
        const ranked = this.rank(season, history);
        const pending = ranked.filter((r) => !labelByGarden.has(r.garden.id));
        // Unlabelled gardens first, each group by priority.
        const ordered = query.pending === 'true' ? pending : [...pending, ...ranked.filter((r) => labelByGarden.has(r.garden.id))];
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const slice = ordered.slice((page - 1) * limit, page * limit);
        const rows = await this.combined.rows(areaId, season, history, slice.map((r) => r.garden));
        const data = rows.map((row, i) => {
            const l = labelByGarden.get(row.code) ?? null;
            return { ...row, priority: (slice[i] as { priority: number }).priority, reasons: (slice[i] as { reasons: WorklistReason[] }).reasons, label: l ? this.labelView(l) : null };
        });
        return { ...paginate(data, ordered.length, page, limit), season: season.season, inProgress: !!season.inProgress, listed: ranked.length, pending: pending.length, field: this.fieldMetrics(season, labels) };
    }

    async saveLabel(areaId: string, dto: SaveCalibrationLabelDto, userId: string): Promise<WorklistLabel> {
        const { season } = await this.combined.load(areaId, dto.season);
        if (season.season !== dto.season) throw new NotFoundException('No combined verdict for this season');
        const garden = season.gardens.find((g) => g.id === dto.gardenCode);
        if (!garden) throw new NotFoundException('Garden not found in this season');
        const areaCode = await this.areaCode(areaId);
        const user = await this.userRepo.findOne({ where: { id: userId } });
        const existing = await this.labelRepo.findOne({ where: { areaCode, season: season.season, gardenCode: dto.gardenCode } });
        const row = existing ?? this.labelRepo.create({ areaCode, season: season.season, gardenCode: dto.gardenCode, createdById: userId, createdByName: user?.fullName ?? 'Saha' });
        row.label = dto.label;
        row.method = dto.method ?? 'field_visit';
        row.observedAt = dto.observedAt.slice(0, 10);
        row.lat = dto.lat ?? null;
        row.lng = dto.lng ?? null;
        row.accuracyM = dto.accuracyM ?? null;
        row.prunedShare = dto.prunedShare ?? (dto.label === 'pruned' ? 1 : dto.label === 'not_pruned' ? 0 : null);
        row.note = dto.note?.trim() || null;
        // The verdict at the moment of labelling: the multi-sensor class when it exists, else the combined class.
        if (!existing) {
            row.systemClassAtLabel = season.sources.fusion ? garden.fusion.class : `combined:${garden.class}`;
            row.systemZAtLabel = garden.fusion.z;
        }
        row.createdById = userId;
        row.createdByName = user?.fullName ?? row.createdByName;
        return this.labelView(await this.labelRepo.save(row));
    }

    /** Priority = the sum of the weights of every reason that applies. */
    private rank(season: CombinedSeason, history: CombinedHistory | null): Array<{ garden: CombinedGarden; priority: number; reasons: WorklistReason[] }> {
        const past = new Map((history?.gardens ?? []).map((g) => [g.id, g]));
        const tipping = new Set(season.producers.filter((p) => p.status === 'met_with_probable').flatMap((p) => p.probableGardens));
        const through = season.dataThrough ? Date.parse(season.dataThrough) : null;
        const control = new Set(
            season.gardens
                .filter((g) => g.class === 'none')
                .sort((a, b) => hash(a.id) - hash(b.id))
                .slice(0, CONTROL_SAMPLE)
                .map((g) => g.id),
        );
        const out: Array<{ garden: CombinedGarden; priority: number; reasons: WorklistReason[] }> = [];
        for (const g of season.gardens) {
            const reasons: WorklistReason[] = [];
            if (g.class === 'probable') reasons.push(g.agreement === 'both_other_dates' ? 'probable_dates_differ' : 'probable_single_module');
            else if (g.class === 'confirmed') reasons.push('confirmed_check');
            else if (g.class === 'light') reasons.push('light_check');
            else if (g.class === 'seasonal') reasons.push('seasonal_check');
            else if (control.has(g.id)) reasons.push('control_sample');
            if (reasons.length === 0) continue;
            if (g.class !== 'none') {
                const h = past.get(g.id);
                const followUp = h?.seasons[season.season]?.followUp?.status;
                if ((h?.repeatedGround ?? []).some((r) => r.a === season.season || r.b === season.season)) reasons.push('repeated_ground');
                if (followUp === 'permanent') reasons.push('followup_permanent');
                // A seasonal detection repeats by definition: the flag would say nothing new.
                if (followUp === 'repeating' && g.class !== 'seasonal') reasons.push('followup_repeating');
                if (tipping.has(g.id)) reasons.push('tips_target');
                if (season.inProgress && through !== null && g.bracket && through - Date.parse(g.bracket.to) <= FRESH_DAYS * DAY) reasons.push('fresh_cut');
            }
            out.push({ garden: g, priority: reasons.reduce((sum, r) => sum + WEIGHT[r], 0), reasons });
        }
        return out.sort((a, b) => b.priority - a.priority || (b.garden.area?.m2 ?? 0) - (a.garden.area?.m2 ?? 0) || a.garden.id.localeCompare(b.garden.id));
    }

    private fieldMetrics(season: CombinedSeason, labels: CalibrationLabel[]): WorklistFieldMetrics {
        const classOf = new Map(season.gardens.map((g) => [g.id, g.class]));
        const byClass: WorklistFieldMetrics['byClass'] = {};
        for (const l of labels) {
            const c = classOf.get(l.gardenCode);
            if (!c) continue;
            byClass[c] ??= { pruned: 0, partial: 0, not_pruned: 0, unsure: 0 };
            (byClass[c] as Record<CalibrationLabelValue, number>)[l.label]++;
        }
        const rate = (c: CombinedClass): WorklistRate => {
            const b = byClass[c];
            return b ? { hit: b.pruned + b.partial, n: b.pruned + b.partial + b.not_pruned } : { hit: 0, n: 0 };
        };
        return {
            labelled: Object.values(byClass).reduce((sum, b) => sum + b.pruned + b.partial + b.not_pruned + b.unsure, 0),
            byClass,
            precision: { confirmed: rate('confirmed'), probable: rate('probable'), light: rate('light'), seasonal: rate('seasonal') },
            missed: rate('none'),
        };
    }

    private labelView(l: CalibrationLabel): WorklistLabel {
        return { id: l.id, label: l.label, method: l.method, observedAt: l.observedAt, prunedShare: l.prunedShare, note: l.note, labelledBy: l.createdByName, updatedAt: l.updatedAt.toISOString() };
    }

    private async areaCode(areaId: string): Promise<string> {
        const area = await this.areaRepo.findOne({ where: { id: areaId }, select: ['id', 'code'] });
        if (!area) throw new NotFoundException('Area not found');
        return area.code;
    }
}
