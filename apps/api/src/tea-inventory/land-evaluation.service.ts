import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryParcel } from '@/tea-inventory/entities/tea-inventory-parcel.entity';
import { ClimateSummary, CropKey, LandBlock, LandSummaryCounts, ParcelLand } from '@/tea-inventory/entities/land-evaluation.types';
import { LandLayerQueryDto, LandParcelQueryDto } from '@/tea-inventory/dto';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

export interface LandSummary extends Omit<LandBlock, 'neighbourhood'> {
    boundaryAreaM2: number;
    /** Neighbourhood-wide land cover per year (Dynamic World) and WorldCover 2021. */
    landUse: LandBlock['neighbourhood']['landUse'];
    climate: Pick<ClimateSummary, 'source' | 'from' | 'to' | 'baselineYears' | 'recentYears' | 'anomaly' | 'trend'> & { years: number };
}

export interface LandParcelRow {
    id: string;
    key: string;
    block: string;
    parcel: string;
    nature: string;
    locality: string;
    areaM2: number;
    elevationM: number | null;
    slopePct: number | null;
    slopeLabel: string;
    aspectLabel: string | null;
    ph: number | null;
    textureLabel: string | null;
    declared: ParcelLand['landUse']['declared'];
    observed: ParcelLand['landUse']['observed'];
    mismatches: ParcelLand['landUse']['mismatches'];
    change: ParcelLand['landUse']['change'];
    erosionClass: ParcelLand['erosion']['class'];
    erosionIndex: number | null;
    akk: ParcelLand['capability']['akk'];
    law5403: ParcelLand['capability']['law5403'];
    law5403Label: string;
    limitations: string[];
    best: ParcelLand['suitability'][number] | null;
    suitability: ParcelLand['suitability'];
    recommendations: number;
}

export interface LandParcelDetail extends LandParcelRow {
    geometry: Record<string, unknown>;
    land: ParcelLand;
}

/** Land evaluation module: read access to the engine's per-parcel evaluation and the neighbourhood climate record. */
@Injectable()
export class LandEvaluationService {
    constructor(
        @InjectRepository(TeaInventoryArea)
        private readonly areaRepo: Repository<TeaInventoryArea>,
        @InjectRepository(TeaInventoryParcel)
        private readonly parcelRepo: Repository<TeaInventoryParcel>,
    ) { }

    private async findArea(areaId: string): Promise<TeaInventoryArea & { land: LandBlock }> {
        const area = await this.areaRepo.findOne({ where: { id: areaId } });
        if (!area) throw new NotFoundException('Area not found');
        if (!area.land) throw new NotFoundException('No land evaluation for this area');
        return area as TeaInventoryArea & { land: LandBlock };
    }

    async summary(areaId: string): Promise<LandSummary> {
        const area = await this.findArea(areaId);
        const { neighbourhood, ...rest } = area.land;
        const c = neighbourhood.climate;
        return {
            ...rest,
            boundaryAreaM2: neighbourhood.boundaryAreaM2,
            landUse: neighbourhood.landUse,
            climate: { source: c.source, from: c.from, to: c.to, baselineYears: c.baselineYears, recentYears: c.recentYears, anomaly: c.anomaly, trend: c.trend, years: c.yearly.length },
        };
    }

    async climate(areaId: string): Promise<ClimateSummary> {
        const area = await this.findArea(areaId);
        return area.land.neighbourhood.climate;
    }

    private toRow(p: TeaInventoryParcel, l: ParcelLand): LandParcelRow {
        return {
            id: p.id,
            key: l.key,
            block: l.block,
            parcel: l.parcel,
            nature: l.nature,
            locality: p.locality ?? '',
            areaM2: l.areaM2,
            elevationM: l.terrain.elevationM === null ? null : Math.round(l.terrain.elevationM),
            slopePct: l.terrain.slopePct === null ? null : Math.round(l.terrain.slopePct),
            slopeLabel: l.terrain.slopeLabel,
            aspectLabel: l.terrain.aspectLabel,
            ph: l.soil.ph === null ? null : Math.round(l.soil.ph * 10) / 10,
            textureLabel: l.soil.textureLabel,
            declared: l.landUse.declared,
            observed: l.landUse.observed,
            mismatches: l.landUse.mismatches,
            change: l.landUse.change,
            erosionClass: l.erosion.class,
            erosionIndex: l.erosion.index,
            akk: l.capability.akk,
            law5403: l.capability.law5403,
            law5403Label: l.capability.law5403Label,
            limitations: l.capability.limitations,
            best: l.suitability[0] ?? null,
            suitability: l.suitability,
            recommendations: l.recommendations.length,
        };
    }

    async parcels(areaId: string, query: LandParcelQueryDto): Promise<Paginated<LandParcelRow>> {
        await this.findArea(areaId);
        const all = await this.parcelRepo.find({ where: { areaId }, select: ['id', 'locality', 'land'] });
        const search = query.search?.trim().toLocaleLowerCase('tr-TR');
        let rows = all.filter((p): p is TeaInventoryParcel & { land: ParcelLand } => !!p.land).map((p) => this.toRow(p, p.land));
        rows = rows.filter((r) => {
            if (query.akk && r.akk !== query.akk) return false;
            if (query.law5403 && r.law5403 !== query.law5403) return false;
            if (query.observed && r.observed !== query.observed) return false;
            if (query.erosion && r.erosionClass !== query.erosion) return false;
            if (query.mismatch && !r.mismatches.includes(query.mismatch as never)) return false;
            if (search && !`${r.block}/${r.parcel} ${r.nature} ${r.locality}`.toLocaleLowerCase('tr-TR').includes(search)) return false;
            return true;
        });
        if (query.crop) {
            const crop = query.crop as CropKey;
            rows.sort((a, b) => (b.suitability.find((s) => s.crop === crop)?.score ?? 0) - (a.suitability.find((s) => s.crop === crop)?.score ?? 0));
        } else {
            rows.sort((a, b) => Number(a.block) - Number(b.block) || Number(a.parcel) - Number(b.parcel));
        }
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        return paginate(rows.slice((page - 1) * limit, page * limit), rows.length, page, limit);
    }

    async parcel(areaId: string, parcelId: string): Promise<LandParcelDetail> {
        await this.findArea(areaId);
        const p = await this.parcelRepo.findOne({ where: { id: parcelId, areaId } });
        if (!p?.land) throw new NotFoundException('Parcel has no land evaluation');
        return { ...this.toRow(p, p.land), geometry: p.geometry, land: p.land };
    }

    /** Map layer: every evaluated parcel with the field the client colours by. */
    async layers(areaId: string, query: LandLayerQueryDto): Promise<unknown> {
        await this.findArea(areaId);
        const all = await this.parcelRepo.find({ where: { areaId }, select: ['id', 'geometry', 'land'] });
        const crop = (query.crop ?? 'tea') as CropKey;
        return {
            type: 'FeatureCollection',
            features: all
                .filter((p): p is TeaInventoryParcel & { land: ParcelLand } => !!p.land)
                .map((p) => ({
                    type: 'Feature',
                    geometry: p.geometry,
                    properties: {
                        id: p.id,
                        block: p.land.block,
                        parcel: p.land.parcel,
                        akk: p.land.capability.akk,
                        law5403: p.land.capability.law5403,
                        observed: p.land.landUse.observed,
                        declared: p.land.landUse.declared,
                        erosion: p.land.erosion.class,
                        mismatch: p.land.landUse.mismatches[0] ?? null,
                        slopePct: p.land.terrain.slopePct === null ? null : Math.round(p.land.terrain.slopePct),
                        suitability: p.land.suitability.find((s) => s.crop === crop)?.score ?? null,
                        best: p.land.suitability[0]?.crop ?? null,
                    },
                })),
        };
    }

    /** Summary counts recomputed from the parcel rows (used by the overview when the block is present). */
    countsOf(block: LandBlock): LandSummaryCounts {
        return block.summary;
    }
}
