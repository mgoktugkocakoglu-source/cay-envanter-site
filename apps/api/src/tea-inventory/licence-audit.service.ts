import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { MultiPolygon, Polygon, Position } from 'geojson';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { AUDIT_FINDINGS, AuditDecision, AuditParcel, LicenceAuditBlock } from '@/tea-inventory/entities/licence-audit.types';
import { LicenceAuditKmlQueryDto, LicenceAuditQueryDto } from '@/tea-inventory/dto';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

type Poly = Polygon | MultiPolygon;

export type LicenceAuditSummary = Omit<LicenceAuditBlock, 'parcels' | 'buildings'> & { neighborhood: string };
export type LicenceAuditRow = Omit<AuditParcel, 'geometry'>;
export interface LicenceAuditDetail extends AuditParcel {
    /** Building footprints within ~40 m of the parcel, for the map. */
    buildings: Array<{ areaM2: number; geometry: Poly }>;
}

/** Order of the table: findings first, then review, then the rest. */
const DECISION_RANK: Record<AuditDecision, number> = {
    licensing_error: 0,
    unlicensed_tea: 1,
    unlicensed_tea_titled: 2,
    licence_no_tea: 3,
    needs_review: 4,
    title_outdated: 5,
    title_only: 6,
    tea_land: 7,
    out_of_scope: 8,
};
const CONFIDENCE_RANK = { high: 0, medium: 1, low: 2 };
const NEARBY_M = 40;

function ringsOf(geometry: Poly): Position[][] {
    return geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();
}
function boundsOf(geometry: Poly): [number, number, number, number] {
    let w = Infinity;
    let s = Infinity;
    let e = -Infinity;
    let n = -Infinity;
    for (const ring of ringsOf(geometry)) {
        for (const [lng, lat] of ring) {
            w = Math.min(w, lng as number);
            e = Math.max(e, lng as number);
            s = Math.min(s, lat as number);
            n = Math.max(n, lat as number);
        }
    }
    return [w, s, e, n];
}
const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Licence audit (Arazi tespit kararı): read-only views of the engine's block plus a KML export for Google Earth. */
@Injectable()
export class LicenceAuditService {
    constructor(@InjectRepository(TeaInventoryArea) private readonly areaRepo: Repository<TeaInventoryArea>) { }

    async summary(areaId: string): Promise<LicenceAuditSummary> {
        const { block, neighborhood } = await this.load(areaId);
        const { parcels: _parcels, buildings: _buildings, ...rest } = block;
        return { ...rest, neighborhood };
    }

    async parcels(areaId: string, query: LicenceAuditQueryDto): Promise<Paginated<LicenceAuditRow>> {
        const { block } = await this.load(areaId);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        let list = block.parcels;
        if (query.decision === 'findings') list = list.filter((p) => AUDIT_FINDINGS.includes(p.decision));
        else if (query.decision === 'attention') list = list.filter((p) => AUDIT_FINDINGS.includes(p.decision) || p.decision === 'needs_review');
        else if (query.decision) list = list.filter((p) => p.decision === query.decision);
        if (query.confidence) list = list.filter((p) => p.confidence === query.confidence);
        if (query.flag) list = list.filter((p) => p.flags.includes(query.flag as AuditParcel['flags'][number]));
        const search = query.search?.trim().toLocaleLowerCase('tr');
        if (search) list = list.filter((p) => `${p.block}/${p.parcel}`.includes(search) || p.nature.toLocaleLowerCase('tr').includes(search) || p.locality.toLocaleLowerCase('tr').includes(search));
        list = [...list].sort((a, b) => DECISION_RANK[a.decision] - DECISION_RANK[b.decision] || CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence] || (b.detection.teaAreaM2 ?? 0) - (a.detection.teaAreaM2 ?? 0));
        const rows = list.slice((page - 1) * limit, page * limit).map(({ geometry: _geometry, ...row }) => row);
        return paginate(rows, list.length, page, limit);
    }

    async parcel(areaId: string, block: string, parcel: string): Promise<LicenceAuditDetail> {
        const { block: audit } = await this.load(areaId);
        const row = this.find(audit, block, parcel);
        return { ...row, buildings: this.buildingsNear(audit, row.geometry) };
    }

    /** KML for Google Earth: the TKGM outline as it is (WGS84), nearby building footprints, and optionally a shifted copy for visual alignment. */
    async kml(areaId: string, block: string, parcel: string, query: LicenceAuditKmlQueryDto): Promise<{ filename: string; body: string }> {
        const { block: audit, neighborhood } = await this.load(areaId);
        const row = this.find(audit, block, parcel);
        const east = query.east ?? 0;
        const north = query.north ?? 0;
        const name = `${neighborhood} ${row.block}/${row.parcel}`;
        const placemark = (title: string, description: string, style: string, geometry: Poly) => `<Placemark><name>${escapeXml(title)}</name><description>${escapeXml(description)}</description><styleUrl>#${style}</styleUrl>${this.polygonKml(geometry)}</Placemark>`;
        const shifted = east !== 0 || north !== 0 ? placemark(`${name} (görüntüye hizalı: ${east} m doğu, ${north} m kuzey)`, 'Yalnız görsel hizalama; kadastro geometrisi değildir.', 'shifted', this.shift(row.geometry, east, north)) : '';
        const buildings = this.buildingsNear(audit, row.geometry);
        const body = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapeXml(name)}</name>
<Style id="parcel"><LineStyle><color>ff00ffff</color><width>3</width></LineStyle><PolyStyle><fill>0</fill></PolyStyle></Style>
<Style id="shifted"><LineStyle><color>ff00a5ff</color><width>2</width></LineStyle><PolyStyle><fill>0</fill></PolyStyle></Style>
<Style id="building"><LineStyle><color>ff0000ff</color><width>2</width></LineStyle><PolyStyle><color>330000ff</color></PolyStyle></Style>
<Folder><name>Parsel (TKGM)</name>${placemark(name, `Tapu niteliği: ${row.nature} · ${row.reason}`, 'parcel', row.geometry)}${shifted}</Folder>
${buildings.length ? `<Folder><name>Yapı izleri</name>${buildings.map((b, i) => placemark(`Yapı ${i + 1}`, `${audit.buildingSource} · ${b.areaM2} m²`, 'building', b.geometry)).join('')}</Folder>` : ''}
</Document></kml>
`;
        return { filename: `${row.block}-${row.parcel}.kml`, body };
    }

    private polygonKml(geometry: Poly): string {
        const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
        const ring = (r: Position[]) => r.map(([lng, lat]) => `${lng},${lat},0`).join(' ');
        const body = polygons
            .map((rings) => `<Polygon><tessellate>1</tessellate><outerBoundaryIs><LinearRing><coordinates>${ring(rings[0])}</coordinates></LinearRing></outerBoundaryIs>${rings.slice(1).map((r) => `<innerBoundaryIs><LinearRing><coordinates>${ring(r)}</coordinates></LinearRing></innerBoundaryIs>`).join('')}</Polygon>`)
            .join('');
        return polygons.length > 1 ? `<MultiGeometry>${body}</MultiGeometry>` : body;
    }

    private shift(geometry: Poly, eastM: number, northM: number): Poly {
        const move = ([lng, lat]: Position): Position => [lng + eastM / (111_320 * Math.cos((lat * Math.PI) / 180)), lat + northM / 110_540];
        return geometry.type === 'Polygon'
            ? { type: 'Polygon', coordinates: geometry.coordinates.map((ring) => ring.map(move)) }
            : { type: 'MultiPolygon', coordinates: geometry.coordinates.map((poly) => poly.map((ring) => ring.map(move))) };
    }

    /** Footprints whose bounding box comes within NEARBY_M of the parcel's bounding box (cheap, enough for a map). */
    private buildingsNear(audit: LicenceAuditBlock, geometry: Poly): LicenceAuditDetail['buildings'] {
        const [w, s, e, n] = boundsOf(geometry);
        const dLat = NEARBY_M / 110_540;
        const dLng = NEARBY_M / (111_320 * Math.cos((((s + n) / 2) * Math.PI) / 180));
        return audit.buildings.features
            .filter((f) => {
                const [bw, bs, be, bn] = boundsOf(f.geometry);
                return be >= w - dLng && bw <= e + dLng && bn >= s - dLat && bs <= n + dLat;
            })
            .map((f) => ({ areaM2: f.properties.areaM2, geometry: f.geometry }));
    }

    private find(audit: LicenceAuditBlock, block: string, parcel: string): AuditParcel {
        const row = audit.parcels.find((p) => p.block === block && p.parcel === parcel);
        if (!row) throw new NotFoundException('Parcel not found in the licence audit');
        return row;
    }

    private async load(areaId: string): Promise<{ block: LicenceAuditBlock; neighborhood: string }> {
        const area = await this.areaRepo.findOne({ where: { id: areaId }, select: ['id', 'neighborhood', 'licenceAudit'] });
        if (!area) throw new NotFoundException('Area not found');
        if (!area.licenceAudit) throw new NotFoundException('No licence audit for this area');
        return { block: area.licenceAudit, neighborhood: area.neighborhood };
    }
}
