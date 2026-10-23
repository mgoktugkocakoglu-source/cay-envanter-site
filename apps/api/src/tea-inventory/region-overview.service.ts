import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryService, InventoryClassStat } from '@/tea-inventory/tea-inventory.service';
import { PruningFusionService } from '@/tea-inventory/pruning-fusion.service';
import { LicensingService } from '@/tea-inventory/licensing.service';
import { GardenHealthService } from '@/tea-inventory/garden-health.service';
import { InventoryClass } from '@/tea-inventory/enums/inventory-class.enum';
import type { FusionDecision } from '@/tea-inventory/entities/tea-inventory-producer.entity';
import type { FusionClass, HealthAnomalyClass } from '@/tea-inventory/entities/tea-inventory-garden.entity';
import type { HealthProducerRow } from '@/tea-inventory/entities/tea-inventory-area.entity';

type YieldFlag = HealthProducerRow['flag'];

/** One imported neighbourhood with the headline numbers of every module (null when that module has not run there yet). */
export interface RegionAreaRow {
    id: string;
    code: string;
    province: string;
    district: string;
    neighborhood: string;
    neighborhoodId: number | null;
    boundary: Record<string, unknown>;
    boundaryAreaM2: number;
    coveredRatio: number;
    demoLicenses: boolean;
    updatedAt: string;
    parcels: { total: number; flagged: number; byClass: Record<InventoryClass, number> };
    teaPatchAreaM2: number;
    detectedTeaAreaM2: number;
    model: { teaRecall?: number; teaPrecision?: number; trainingNeighborhoods?: string[] };
    licensing: { producers: number; licenses: number; gardens: number; withIssues: number; licensedAreaM2: number } | null;
    pruning: {
        season: string;
        seasons: string[];
        calibrated: boolean;
        gardens: { total: number; byClass: Record<FusionClass, number>; prunedAreaM2: number; likelyAreaM2: number };
        producers: { total: number; byDecision: Record<FusionDecision, number> };
        unassigned: { count: number; areaM2: number; prunedAreaM2: number };
    } | null;
    health: {
        season: string;
        gardens: { total: number; byAnomaly: Record<HealthAnomalyClass, number>; meanVigour: number | null; yieldKg: number };
        producers: { total: number; byFlag: Record<YieldFlag, number>; quotaKg: number };
    } | null;
}

export interface RegionTotals {
    areas: number;
    parcels: number;
    flagged: number;
    teaPatchAreaM2: number;
    producers: number;
    licenses: number;
    gardens: number;
    pruned: number;
    likely: number;
    purchaseOpen: number;
    expert: number;
    healthSuspects: number;
    yieldKg: number;
}

export interface RegionDistrict {
    province: string;
    district: string;
    totals: RegionTotals;
    areas: RegionAreaRow[];
}

export interface RegionOverview {
    generatedAt: string;
    totals: RegionTotals;
    districts: RegionDistrict[];
}

const emptyTotals = (): RegionTotals => ({
    areas: 0, parcels: 0, flagged: 0, teaPatchAreaM2: 0, producers: 0, licenses: 0, gardens: 0, pruned: 0, likely: 0, purchaseOpen: 0, expert: 0, healthSuspects: 0, yieldKg: 0,
});

function addRow(t: RegionTotals, r: RegionAreaRow): void {
    t.areas++;
    t.parcels += r.parcels.total;
    t.flagged += r.parcels.flagged;
    t.teaPatchAreaM2 += r.teaPatchAreaM2;
    t.producers += r.licensing?.producers ?? 0;
    t.licenses += r.licensing?.licenses ?? 0;
    t.gardens += r.licensing?.gardens ?? 0;
    t.pruned += r.pruning?.gardens.byClass.pruned ?? 0;
    t.likely += r.pruning?.gardens.byClass.likely ?? 0;
    t.purchaseOpen += r.pruning?.producers.byDecision.auto_open ?? 0;
    t.expert += r.pruning?.producers.byDecision.expert_anomaly ?? 0;
    t.healthSuspects += (r.health?.gardens.byAnomaly.chemical_suspect ?? 0) + (r.health?.gardens.byAnomaly.defoliation ?? 0);
    t.yieldKg += r.health?.gardens.yieldKg ?? 0;
}

/**
 * District/region roll-up of every imported neighbourhood: the entry point as the pilot grows from one
 * mahalle to a district and then the whole Black Sea tea belt. Module summaries are optional per area so a
 * neighbourhood whose parcel library is still being harvested appears with whatever it has.
 */
@Injectable()
export class RegionOverviewService {
    constructor(
        @InjectRepository(TeaInventoryArea)
        private readonly areaRepo: Repository<TeaInventoryArea>,
        private readonly inventoryService: TeaInventoryService,
        private readonly fusionService: PruningFusionService,
        private readonly licensingService: LicensingService,
        private readonly healthService: GardenHealthService,
    ) { }

    async overview(): Promise<RegionOverview> {
        const areas = await this.areaRepo.find({ order: { province: 'ASC', district: 'ASC', neighborhood: 'ASC' } });
        const rows: RegionAreaRow[] = [];
        for (const area of areas) rows.push(await this.areaRow(area));

        const districts = new Map<string, RegionDistrict>();
        const totals = emptyTotals();
        for (const row of rows) {
            const key = `${row.province}|${row.district}`;
            const district = districts.get(key) ?? { province: row.province, district: row.district, totals: emptyTotals(), areas: [] };
            district.areas.push(row);
            addRow(district.totals, row);
            addRow(totals, row);
            districts.set(key, district);
        }
        return { generatedAt: new Date().toISOString(), totals, districts: [...districts.values()] };
    }

    private async areaRow(area: TeaInventoryArea): Promise<RegionAreaRow> {
        const detail = await this.inventoryService.getArea(area.id);
        const byClass = Object.fromEntries(
            Object.entries(detail.classStats).map(([cls, stat]) => [cls, (stat as InventoryClassStat).count]),
        ) as Record<InventoryClass, number>;
        const [fusion, licensing, health] = await Promise.all([
            this.optional(() => this.fusionService.summary(area.id)),
            this.optional(() => this.licensingService.summary(area.id)),
            this.optional(() => this.healthService.summary(area.id)),
        ]);
        const model = (area.model ?? {}) as Record<string, unknown>;
        return {
            id: area.id,
            code: area.code,
            province: area.province,
            district: area.district,
            neighborhood: area.neighborhood,
            neighborhoodId: area.neighborhoodId,
            boundary: area.boundary,
            boundaryAreaM2: area.boundaryAreaM2,
            coveredRatio: area.coveredRatio,
            demoLicenses: area.demoLicenses,
            updatedAt: new Date(detail.updatedAt).toISOString(),
            parcels: { total: detail.parcelCount, flagged: detail.flaggedCount, byClass },
            teaPatchAreaM2: detail.teaPatchAreaM2,
            detectedTeaAreaM2: detail.detectedTeaAreaM2,
            model: {
                teaRecall: typeof model.teaRecall === 'number' ? model.teaRecall : undefined,
                teaPrecision: typeof model.teaPrecision === 'number' ? model.teaPrecision : undefined,
                trainingNeighborhoods: Array.isArray(model.trainingNeighborhoods) ? (model.trainingNeighborhoods as string[]) : undefined,
            },
            licensing: licensing
                ? {
                    producers: licensing.producers.total,
                    licenses: licensing.licenses.total,
                    gardens: licensing.gardens.total,
                    withIssues: licensing.producers.withIssues,
                    licensedAreaM2: licensing.gardens.licensedAreaM2,
                }
                : null,
            pruning: fusion
                ? {
                    season: fusion.season,
                    seasons: fusion.seasons,
                    calibrated: fusion.calibrated,
                    gardens: fusion.gardens,
                    producers: { total: fusion.producers.total, byDecision: fusion.producers.byDecision },
                    unassigned: { count: fusion.unassigned.count, areaM2: fusion.unassigned.areaM2, prunedAreaM2: fusion.unassigned.prunedAreaM2 },
                }
                : null,
            health: health
                ? {
                    season: health.season,
                    gardens: { total: health.gardens.total, byAnomaly: health.gardens.byAnomaly, meanVigour: health.gardens.meanVigour, yieldKg: health.gardens.yieldKg },
                    producers: { total: health.producers.total, byFlag: health.producers.byFlag, quotaKg: health.producers.quotaKg },
                }
                : null,
        };
    }

    /** A module that has not run for an area answers 404; the overview shows the area without it. */
    private async optional<T>(load: () => Promise<T>): Promise<T | null> {
        try {
            return await load();
        } catch (error) {
            if (error instanceof NotFoundException) return null;
            throw error;
        }
    }
}
