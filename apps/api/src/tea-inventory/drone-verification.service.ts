import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { AuditParcel, LicenceAuditBlock } from '@/tea-inventory/entities/licence-audit.types';
import { DroneClass, DroneConfidence, DroneStatus, DroneVerificationBlock, DroneVerificationParcel } from '@/tea-inventory/entities/drone-verification.types';
import { DroneVerificationQueryDto } from '@/tea-inventory/dto';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

type Poly = Polygon | MultiPolygon;
export type DroneMapClass = DroneClass | 'not_analysed';

export interface DroneVerificationSummary extends Omit<DroneVerificationBlock, 'parcels'> {
    neighborhood: string;
    counts: { parcels: number; analysed: number; byClass: Record<DroneMapClass, number>; needsReview: number };
}
/** One row of the parcel list: the record side for every parcel, the image side when a drone source covers it. */
export interface DroneVerificationRow {
    key: string;
    block: string;
    parcel: string;
    nature: string;
    locality: string;
    areaM2: number;
    titleTea: boolean;
    licensed: boolean;
    class: DroneMapClass;
    status: DroneStatus;
    confidence: DroneConfidence | null;
    analysedAt: string | null;
    discrepancy: string | null;
}
export interface DroneVerificationDetail extends DroneVerificationRow {
    deedAreaM2: number | null;
    licence: AuditParcel['licence'];
    satellite: { tea: string; teaShare: number | null; fullPixels: number };
    geometry: Poly;
    /** Null while no drone source covers the parcel. */
    drone: (Omit<DroneVerificationParcel, 'frames' | 'outline'> & { frames: Array<DroneVerificationParcel['frames'][number] & { frameUrl: string; classesUrl: string }>; outline: DroneVerificationParcel['outline'] & { referenceUrl: string }; sourceTitle: string; clip: { url: string; start: number; end: number; width: number; height: number } | null }) | null;
}
export type DroneMapProperties = Pick<DroneVerificationRow, 'key' | 'block' | 'parcel' | 'nature' | 'class' | 'status' | 'licensed'>;

/** Order of the list: mismatches and reviews first, then the other analysed parcels, then the rest. */
const CLASS_RANK: Record<DroneMapClass, number> = { tea_not_found: 0, partial: 1, uncertain: 2, tea_present: 3, not_analysed: 4 };

/** Drone-supported land verification: read-only views of the engine's block, joined with the licence audit for the record side. */
@Injectable()
export class DroneVerificationService {
    constructor(@InjectRepository(TeaInventoryArea) private readonly areaRepo: Repository<TeaInventoryArea>) { }

    async summary(areaId: string): Promise<DroneVerificationSummary> {
        const { drone, audit, neighborhood } = await this.load(areaId);
        const { parcels, ...rest } = drone;
        const byClass: Record<DroneMapClass, number> = { tea_present: 0, tea_not_found: 0, partial: 0, uncertain: 0, not_analysed: 0 };
        for (const p of parcels) byClass[p.class]++;
        byClass.not_analysed = Math.max(audit.parcels.length - parcels.length, 0);
        return { ...rest, neighborhood, counts: { parcels: audit.parcels.length, analysed: parcels.length, byClass, needsReview: parcels.filter((p) => p.status === 'needs_review').length } };
    }

    async parcels(areaId: string, query: DroneVerificationQueryDto): Promise<Paginated<DroneVerificationRow>> {
        const { drone, audit } = await this.load(areaId);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        let list = this.rows(drone, audit);
        if (query.class === 'analysed') list = list.filter((r) => r.class !== 'not_analysed');
        else if (query.class) list = list.filter((r) => r.class === query.class);
        const search = query.search?.trim().toLocaleLowerCase('tr');
        if (search) list = list.filter((r) => `${r.block}/${r.parcel}`.includes(search) || r.nature.toLocaleLowerCase('tr').includes(search) || r.locality.toLocaleLowerCase('tr').includes(search));
        list.sort((a, b) => CLASS_RANK[a.class] - CLASS_RANK[b.class] || Number(a.block) - Number(b.block) || Number(a.parcel) - Number(b.parcel));
        return paginate(list.slice((page - 1) * limit, page * limit), list.length, page, limit);
    }

    /** Every parcel of the area with its image class, for the coloured map (green / red / yellow / grey). */
    async map(areaId: string): Promise<FeatureCollection<Poly, DroneMapProperties>> {
        const { drone, audit } = await this.load(areaId);
        const rows = new Map(this.rows(drone, audit).map((r) => [r.key, r]));
        const features: Array<Feature<Poly, DroneMapProperties>> = audit.parcels.map((p) => {
            const r = rows.get(p.key) as DroneVerificationRow;
            return { type: 'Feature', geometry: p.geometry, properties: { key: r.key, block: r.block, parcel: r.parcel, nature: r.nature, class: r.class, status: r.status, licensed: r.licensed } };
        });
        return { type: 'FeatureCollection', features };
    }

    async parcel(areaId: string, block: string, parcel: string): Promise<DroneVerificationDetail> {
        const { drone, audit } = await this.load(areaId);
        const record = audit.parcels.find((p) => p.block === block && p.parcel === parcel);
        if (!record) throw new NotFoundException('Parcel not found');
        const analysed = drone.parcels.find((p) => p.key === record.key) ?? null;
        const base = drone.imageryBaseUrl;
        return {
            ...this.row(record, analysed),
            deedAreaM2: record.deedAreaM2,
            licence: record.licence,
            satellite: { tea: record.detection.tea, teaShare: record.detection.teaShare, fullPixels: record.detection.fullPixels },
            geometry: record.geometry,
            drone: analysed
                ? {
                      ...analysed,
                      frames: analysed.frames.map((f) => ({ ...f, frameUrl: base + f.frame, classesUrl: base + f.classes })),
                      outline: { ...analysed.outline, referenceUrl: base + analysed.outline.reference },
                      sourceTitle: drone.sources.find((s) => s.id === analysed.sourceId)?.title ?? analysed.sourceId,
                      track: analysed.track ?? [],
                      clip: drone.clip ? { url: base + drone.clip.file, start: drone.clip.start, end: drone.clip.end, width: drone.clip.width, height: drone.clip.height } : null,
                  }
                : null,
        };
    }

    private rows(drone: DroneVerificationBlock, audit: LicenceAuditBlock): DroneVerificationRow[] {
        const analysed = new Map(drone.parcels.map((p) => [p.key, p]));
        return audit.parcels.map((p) => this.row(p, analysed.get(p.key) ?? null));
    }

    private row(record: AuditParcel, analysed: DroneVerificationParcel | null): DroneVerificationRow {
        return {
            key: record.key,
            block: record.block,
            parcel: record.parcel,
            nature: record.nature,
            locality: record.locality,
            areaM2: record.areaM2,
            titleTea: record.title.tea,
            licensed: record.licence.licensed,
            class: analysed?.class ?? 'not_analysed',
            status: analysed?.status ?? 'not_analysed',
            confidence: analysed?.confidence ?? null,
            analysedAt: analysed?.analysedAt ?? null,
            discrepancy: analysed?.discrepancy ?? null,
        };
    }

    private async load(areaId: string): Promise<{ drone: DroneVerificationBlock; audit: LicenceAuditBlock; neighborhood: string }> {
        const area = await this.areaRepo.findOne({ where: { id: areaId }, select: ['id', 'neighborhood', 'droneVerification', 'licenceAudit'] });
        if (!area) throw new NotFoundException('Area not found');
        if (!area.droneVerification || !area.licenceAudit) throw new NotFoundException('No drone verification for this area');
        return { drone: area.droneVerification, audit: area.licenceAudit, neighborhood: area.neighborhood };
    }
}
