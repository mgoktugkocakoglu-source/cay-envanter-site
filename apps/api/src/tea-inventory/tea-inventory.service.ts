import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeaInventoryArea, InventoryLicense, TeaPatch } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryParcel } from '@/tea-inventory/entities/tea-inventory-parcel.entity';
import { InventoryClass } from '@/tea-inventory/enums/inventory-class.enum';
import { InventoryAreaQueryDto, InventoryParcelQueryDto, InventoryParcelSortKey } from '@/tea-inventory/dto';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

/** Classes an inspector should look at (everything except compliant / out of scope). */
const FLAGGED_CLASSES: InventoryClass[] = [
    InventoryClass.OVER_QUOTA,
    InventoryClass.GHOST_LICENSE,
    InventoryClass.EXPANDED,
    InventoryClass.UNLICENSED,
    InventoryClass.PUBLIC_LAND,
];

const LICENSED_AREA_SQL = "COALESCE((p.license->>'licensedAreaM2')::float, 0)";
const GAP_SQL = `ABS(COALESCE(p.tea_area_m2, 0) - ${LICENSED_AREA_SQL})`;
const SORT_SQL: Record<InventoryParcelSortKey, string> = {
    parcel: "LPAD(p.block, 6, '0') || '/' || LPAD(p.parcel, 6, '0')",
    teaArea: 'COALESCE(p.tea_area_m2, 0)',
    licensedArea: LICENSED_AREA_SQL,
    gap: GAP_SQL,
};

export interface InventoryAreaSummary {
    id: string;
    code: string;
    province: string;
    district: string;
    neighborhood: string;
    parcelCount: number;
    flaggedCount: number;
    detectedTeaAreaM2: number;
    coveredRatio: number;
    demoLicenses: boolean;
    updatedAt: Date;
}

export interface InventoryClassStat {
    count: number;
    teaAreaM2: number;
    licensedAreaM2: number;
}

export interface InventoryAreaDetail extends InventoryAreaSummary {
    neighborhoodId: number | null;
    boundary: Record<string, unknown>;
    boundaryAreaM2: number;
    period: Record<string, unknown>;
    model: Record<string, unknown>;
    teaPatches: TeaPatch[];
    teaPatchAreaM2: number;
    licensedAreaM2: number;
    unmatchedLicenses: InventoryLicense[];
    classStats: Record<InventoryClass, InventoryClassStat>;
}

export interface InventoryParcelRow {
    id: string;
    parcelKey: string;
    block: string;
    parcel: string;
    nature: string;
    locality: string;
    deedAreaM2: number | null;
    geometryAreaM2: number;
    teaShare: number | null;
    teaAreaM2: number | null;
    inventoryClass: InventoryClass;
    license: InventoryLicense | null;
}

export interface InventoryParcelDetail extends InventoryParcelRow {
    areaId: string;
    teaProbability: number | null;
    /** Per-season pruning result + NDVI curve (dates live on the area's pruning block). */
    pruning: Record<string, unknown> | null;
    geometry: Record<string, unknown>;
}

export interface PruningParcelRow {
    id: string;
    parcelKey: string;
    block: string;
    parcel: string;
    nature: string;
    /** Season → { status, teaAreaM2, requiredM2, prunedM2, … } — no NDVI curve (that is per parcel). */
    seasons: Record<string, unknown>;
}

export interface AreaPruning {
    /** Season summaries, pruned patches, NDVI date axis and neighbourhood median; null when not run. */
    summary: Record<string, unknown> | null;
    parcels: PruningParcelRow[];
}

export interface InventoryMapFeature {
    type: 'Feature';
    geometry: Record<string, unknown>;
    properties: {
        id: string;
        block: string;
        parcel: string;
        nature: string;
        teaShare: number | null;
        inventoryClass: InventoryClass;
    };
}

export interface InventoryMap {
    type: 'FeatureCollection';
    features: InventoryMapFeature[];
}

interface AreaAggregate {
    parcelCount: number;
    flaggedCount: number;
    detectedTeaAreaM2: number;
}

/**
 * Read API over the imported tea inventory: areas (neighborhood libraries),
 * their parcels and the decision-matrix classes.
 */
@Injectable()
export class TeaInventoryService {
    constructor(
        @InjectRepository(TeaInventoryArea)
        private readonly areaRepo: Repository<TeaInventoryArea>,
        @InjectRepository(TeaInventoryParcel)
        private readonly parcelRepo: Repository<TeaInventoryParcel>,
    ) { }

    async listAreas(query: InventoryAreaQueryDto): Promise<Paginated<InventoryAreaSummary>> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const [areas, total] = await this.areaRepo.findAndCount({
            order: { province: 'ASC', district: 'ASC', neighborhood: 'ASC' },
            skip: (page - 1) * limit,
            take: limit,
        });
        const aggregates = await this.aggregateByArea(areas.map((a) => a.id));
        const rows = areas.map((area) => this.toSummary(area, aggregates.get(area.id)));
        return paginate(rows, total, page, limit);
    }

    async getArea(id: string): Promise<InventoryAreaDetail> {
        const area = await this.findArea(id);
        const raw = await this.parcelRepo
            .createQueryBuilder('p')
            .select('p.inventory_class', 'cls')
            .addSelect('COUNT(*)::int', 'count')
            .addSelect('COALESCE(SUM(p.tea_area_m2), 0)::float', 'teaArea')
            .addSelect(`COALESCE(SUM(${LICENSED_AREA_SQL}), 0)::float`, 'licensedArea')
            .where('p.area_id = :id', { id })
            .groupBy('p.inventory_class')
            .getRawMany<{ cls: InventoryClass; count: number; teaArea: number; licensedArea: number }>();

        const classStats = Object.fromEntries(
            Object.values(InventoryClass).map((cls) => [cls, { count: 0, teaAreaM2: 0, licensedAreaM2: 0 }]),
        ) as Record<InventoryClass, InventoryClassStat>;
        for (const row of raw) {
            classStats[row.cls] = { count: row.count, teaAreaM2: Math.round(row.teaArea), licensedAreaM2: Math.round(row.licensedArea) };
        }
        const stats = Object.values(classStats);
        const aggregate: AreaAggregate = {
            parcelCount: stats.reduce((sum, s) => sum + s.count, 0),
            flaggedCount: FLAGGED_CLASSES.reduce((sum, cls) => sum + classStats[cls].count, 0),
            detectedTeaAreaM2: stats.reduce((sum, s) => sum + s.teaAreaM2, 0),
        };
        return {
            ...this.toSummary(area, aggregate),
            neighborhoodId: area.neighborhoodId,
            boundary: area.boundary,
            boundaryAreaM2: area.boundaryAreaM2,
            period: area.period,
            model: area.model,
            teaPatches: area.teaPatches,
            teaPatchAreaM2: area.teaPatches.reduce((sum, patch) => sum + patch.areaM2, 0),
            licensedAreaM2: stats.reduce((sum, s) => sum + s.licensedAreaM2, 0),
            unmatchedLicenses: area.unmatchedLicenses,
            classStats,
        };
    }

    /** Every parcel of an area as a light GeoJSON layer for the map (not paginated by design). */
    async getAreaMap(id: string): Promise<InventoryMap> {
        await this.findArea(id);
        const parcels = await this.parcelRepo.find({
            where: { areaId: id },
            select: ['id', 'block', 'parcel', 'nature', 'teaShare', 'inventoryClass', 'geometry'],
        });
        return {
            type: 'FeatureCollection',
            features: parcels.map((p) => ({
                type: 'Feature',
                geometry: p.geometry,
                properties: {
                    id: p.id,
                    block: p.block,
                    parcel: p.parcel,
                    nature: p.nature,
                    teaShare: p.teaShare,
                    inventoryClass: p.inventoryClass,
                },
            })),
        };
    }

    async listParcels(id: string, query: InventoryParcelQueryDto): Promise<Paginated<InventoryParcelRow>> {
        await this.findArea(id);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const qb = this.parcelRepo
            .createQueryBuilder('p')
            .select([
                'p.id', 'p.parcelKey', 'p.block', 'p.parcel', 'p.nature', 'p.locality', 'p.deedAreaM2',
                'p.geometryAreaM2', 'p.teaShare', 'p.teaAreaM2', 'p.inventoryClass', 'p.license',
            ])
            .addSelect(SORT_SQL[query.sortBy ?? 'gap'], 'sort_value')
            .where('p.area_id = :id', { id });
        if (query.inventoryClass) {
            qb.andWhere('p.inventory_class = :cls', { cls: query.inventoryClass });
        }
        const search = query.search?.trim();
        if (search) {
            qb.andWhere(
                `(p.block || '/' || p.parcel ILIKE :q OR p.nature ILIKE :q OR p.license->>'licenseNo' ILIKE :q ` +
                    `OR p.license->>'holderName' ILIKE :q OR p.license->>'walletNo' ILIKE :q)`,
                { q: `%${search}%` },
            );
        }
        const [parcels, total] = await qb
            .orderBy('sort_value', query.sortOrder ?? 'DESC')
            .addOrderBy('p.parcel_key', 'ASC')
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();
        return paginate(parcels.map((p) => this.toRow(p)), total, page, limit);
    }

    async getParcel(id: string): Promise<InventoryParcelDetail> {
        const parcel = await this.parcelRepo.findOne({ where: { id } });
        if (!parcel) {
            throw new NotFoundException('Parcel not found');
        }
        return {
            ...this.toRow(parcel),
            areaId: parcel.areaId,
            teaProbability: parcel.teaProbability,
            pruning: parcel.pruning,
            geometry: parcel.geometry,
        };
    }

    /** Pruning monitoring of an area: the season summaries + every parcel's per-season status (not paginated: a map layer). */
    async getAreaPruning(id: string): Promise<AreaPruning> {
        const area = await this.findArea(id);
        const parcels = await this.parcelRepo.find({
            where: { areaId: id },
            select: ['id', 'parcelKey', 'block', 'parcel', 'nature', 'pruning'],
        });
        return {
            summary: area.pruning,
            parcels: parcels
                .filter((p) => p.pruning)
                .map((p) => ({
                    id: p.id,
                    parcelKey: p.parcelKey,
                    block: p.block,
                    parcel: p.parcel,
                    nature: p.nature,
                    seasons: (p.pruning?.seasons as Record<string, unknown>) ?? {},
                })),
        };
    }

    private async findArea(id: string): Promise<TeaInventoryArea> {
        const area = await this.areaRepo.findOne({ where: { id } });
        if (!area) {
            throw new NotFoundException('Inventory area not found');
        }
        return area;
    }

    private async aggregateByArea(areaIds: string[]): Promise<Map<string, AreaAggregate>> {
        if (areaIds.length === 0) {
            return new Map();
        }
        const raw = await this.parcelRepo
            .createQueryBuilder('p')
            .select('p.area_id', 'areaId')
            .addSelect('COUNT(*)::int', 'parcelCount')
            .addSelect('COUNT(*) FILTER (WHERE p.inventory_class IN (:...flagged))::int', 'flaggedCount')
            .addSelect('COALESCE(SUM(p.tea_area_m2), 0)::float', 'detectedTeaAreaM2')
            .where('p.area_id IN (:...areaIds)', { areaIds, flagged: FLAGGED_CLASSES })
            .groupBy('p.area_id')
            .getRawMany<AreaAggregate & { areaId: string }>();
        return new Map(raw.map((r) => [r.areaId, r]));
    }

    private toSummary(area: TeaInventoryArea, aggregate?: AreaAggregate): InventoryAreaSummary {
        return {
            id: area.id,
            code: area.code,
            province: area.province,
            district: area.district,
            neighborhood: area.neighborhood,
            parcelCount: aggregate?.parcelCount ?? 0,
            flaggedCount: aggregate?.flaggedCount ?? 0,
            detectedTeaAreaM2: Math.round(aggregate?.detectedTeaAreaM2 ?? 0),
            coveredRatio: area.coveredRatio,
            demoLicenses: area.demoLicenses,
            updatedAt: area.updatedAt,
        };
    }

    private toRow(p: TeaInventoryParcel): InventoryParcelRow {
        return {
            id: p.id,
            parcelKey: p.parcelKey,
            block: p.block,
            parcel: p.parcel,
            nature: p.nature,
            locality: p.locality,
            deedAreaM2: p.deedAreaM2,
            geometryAreaM2: p.geometryAreaM2,
            teaShare: p.teaShare,
            teaAreaM2: p.teaAreaM2,
            inventoryClass: p.inventoryClass,
            license: p.license,
        };
    }
}
