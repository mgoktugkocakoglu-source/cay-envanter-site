import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { area as turfArea, kinks, polygon } from '@turf/turf';
import type { FeatureCollection, Polygon } from 'geojson';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { CoverLabel } from '@/tea-inventory/entities/cover-label.entity';
import { COVER_LABEL_CLASSES, CoverLabelClass } from '@/tea-inventory/entities/land-cover.types';
import { CreateCoverLabelDto } from '@/tea-inventory/dto';

/** A 10 m pixel must fit inside with room to spare; smaller areas give the model no clean pixel. */
export const COVER_LABEL_RULES = { minAreaM2: 400, maxAreaM2: 200_000, usefulPerClass: 30 };

export interface CoverLabelRow {
    id: string;
    coverClass: CoverLabelClass;
    geometry: Polygon;
    areaM2: number;
    note: string | null;
    createdAt: string;
}
export interface CoverLabelList {
    rules: typeof COVER_LABEL_RULES;
    counts: Record<CoverLabelClass, { areas: number; areaM2: number }>;
    labels: CoverLabelRow[];
}
export type CoverLabelExport = FeatureCollection<Polygon, { id: string; cls: CoverLabelClass; areaM2: number; note: string | null; createdAt: string }>;

/** Ground reference areas for the land-cover module: drawn on the site, read by the engine as a GeoJSON export. */
@Injectable()
export class CoverLabelService {
    constructor(
        @InjectRepository(TeaInventoryArea) private readonly areaRepo: Repository<TeaInventoryArea>,
        @InjectRepository(CoverLabel) private readonly labelRepo: Repository<CoverLabel>,
    ) { }

    async list(areaId: string): Promise<CoverLabelList> {
        const rows = await this.labelRepo.find({ where: { areaCode: await this.codeOf(areaId) }, order: { createdAt: 'DESC' } });
        const counts = Object.fromEntries(COVER_LABEL_CLASSES.map((c) => [c, { areas: 0, areaM2: 0 }])) as CoverLabelList['counts'];
        for (const r of rows) {
            counts[r.coverClass].areas++;
            counts[r.coverClass].areaM2 += Math.round(r.areaM2);
        }
        return { rules: COVER_LABEL_RULES, counts, labels: rows.map((r) => this.toRow(r)) };
    }

    async create(areaId: string, dto: CreateCoverLabelDto, userId: string): Promise<CoverLabelRow> {
        const areaCode = await this.codeOf(areaId);
        const geometry = this.toPolygon(dto.ring);
        const areaM2 = turfArea(geometry);
        if (areaM2 < COVER_LABEL_RULES.minAreaM2) throw new BadRequestException(`Alan çok küçük (${Math.round(areaM2)} m²): en az ${COVER_LABEL_RULES.minAreaM2} m² olmalı, yoksa içine temiz bir uydu pikseli sığmaz.`);
        if (areaM2 > COVER_LABEL_RULES.maxAreaM2) throw new BadRequestException('Alan çok büyük: tek tür örtünün kesin olduğu daha küçük bir alan çizin.');
        const saved = await this.labelRepo.save(this.labelRepo.create({ areaCode, coverClass: dto.coverClass, geometry, areaM2, note: dto.note?.trim() || null, createdBy: userId }));
        return this.toRow(saved);
    }

    async remove(areaId: string, labelId: string): Promise<void> {
        const result = await this.labelRepo.delete({ id: labelId, areaCode: await this.codeOf(areaId) });
        if (!result.affected) throw new NotFoundException('Label not found');
    }

    /** The file the engine reads (`land-cover/field-labels.geojson`). */
    async export(areaId: string): Promise<CoverLabelExport> {
        const rows = await this.labelRepo.find({ where: { areaCode: await this.codeOf(areaId) }, order: { createdAt: 'ASC' } });
        return { type: 'FeatureCollection', features: rows.map((r) => ({ type: 'Feature', geometry: r.geometry, properties: { id: r.id, cls: r.coverClass, areaM2: Math.round(r.areaM2), note: r.note, createdAt: r.createdAt.toISOString() } })) };
    }

    private toPolygon(ring: number[][]): Polygon {
        const points = ring.map((p) => {
            const [lon, lat] = p;
            if (typeof lon !== 'number' || typeof lat !== 'number' || !Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) throw new BadRequestException('Geçersiz koordinat.');
            return [Math.round(lon * 1e7) / 1e7, Math.round(lat * 1e7) / 1e7];
        });
        const first = points[0] as number[];
        const last = points[points.length - 1] as number[];
        if (first[0] !== last[0] || first[1] !== last[1]) points.push([...first]);
        if (points.length < 4) throw new BadRequestException('Alan en az üç köşeli olmalı.');
        const geometry = polygon([points]).geometry;
        if (kinks(geometry).features.length) throw new BadRequestException('Çizilen alanın kenarları birbirini kesiyor.');
        return geometry;
    }

    private toRow(r: CoverLabel): CoverLabelRow {
        return { id: r.id, coverClass: r.coverClass, geometry: r.geometry, areaM2: Math.round(r.areaM2), note: r.note, createdAt: r.createdAt.toISOString() };
    }

    private async codeOf(areaId: string): Promise<string> {
        const area = await this.areaRepo.findOne({ where: { id: areaId }, select: ['id', 'code'] });
        if (!area) throw new NotFoundException('Area not found');
        return area.code;
    }
}
