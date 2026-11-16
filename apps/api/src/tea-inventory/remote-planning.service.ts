import { area as geometryArea, bbox, featureCollection, intersect, squareGrid } from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { NdviAnalysisService } from '@/tea-inventory/ndvi-analysis.service';

// Logistics grid only; does not set aircraft route spacing or camera footprint.
const MAPPING_BLOCK_KM = 0.5;

@Injectable()
export class RemotePlanningService {
    constructor(@InjectRepository(TeaInventoryArea) private readonly areas: Repository<TeaInventoryArea>, private readonly ndvi: NdviAnalysisService) {}
    async regions() {
        const areas = await this.areas.find({ select: ['id', 'province', 'district', 'neighborhood', 'boundary', 'boundaryAreaM2', 'teaPatches', 'updatedAt', 'period'] });
        const data = areas.map(a => {
            const teaM2 = (a.teaPatches ?? []).reduce((s, p) => s + p.areaM2, 0);
            const blocks: Array<{ id: string; geometry: Polygon | MultiPolygon; teaM2: number; areaM2: number; density: number }> = [];
            const boundary = { type: 'Feature', properties: {}, geometry: a.boundary } as unknown as Feature<Polygon | MultiPolygon>;
            // 500 m cells are logistics work packages, not camera footprints or flight missions.
            for (const cell of squareGrid(bbox(boundary), MAPPING_BLOCK_KM, { units: 'kilometers' }).features) {
                const clipped = intersect(featureCollection([cell, boundary]));
                if (!clipped) continue;
                const cellBounds = bbox(clipped);
                let tea = 0;
                for (const patch of a.teaPatches ?? []) {
                    const f = { type: 'Feature', properties: {}, geometry: patch.geometry } as unknown as Feature<Polygon | MultiPolygon>;
                    const b = bbox(f);
                    if (b[0] > cellBounds[2] || b[2] < cellBounds[0] || b[1] > cellBounds[3] || b[3] < cellBounds[1]) continue;
                    const overlap = intersect(featureCollection([clipped, f]));
                    if (overlap) tea += geometryArea(overlap);
                }
                if (tea <= 0) continue;
                const size = geometryArea(clipped);
                blocks.push({ id: `${a.id}:${blocks.length + 1}`, geometry: clipped.geometry, teaM2: Math.round(tea), areaM2: Math.round(size), density: tea / size });
            }
            blocks.sort((a, b) => b.density - a.density || b.teaM2 - a.teaM2);
            return { id: a.id, blocks, period: a.period, province: a.province, district: a.district, neighborhood: a.neighborhood, geometry: a.boundary, teaM2, areaM2: a.boundaryAreaM2, density: a.boundaryAreaM2 > 0 ? teaM2 / a.boundaryAreaM2 : null, sourceUpdatedAt: a.updatedAt };
        }).sort((a, b) => (b.density ?? -1) - (a.density ?? -1) || b.teaM2 - a.teaM2);
        return { data, notice: 'Yalnız içeri aktarılmış mahalleler. İlçe tamamı veya uçuş rotası değildir. Çay yoğunluğu uydu aday alanıdır; izin, arazi, kamera ve uçuş kapasitesi ayrıca değerlendirilir.' };
    }
    async timeline(id: string, year?: number) {
        const current = await this.ndvi.map(id, year);
        return { ...current, features: current.features.map(f => ({ ...f, properties: { ...f.properties, eventId: `${id}:${f.properties.key}:${current.year}`, lastObservedMonth: f.properties.months.filter(m => m.value !== null).at(-1)?.month ?? null } })) };
    }
}
