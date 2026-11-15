import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryParcel } from '@/tea-inventory/entities/tea-inventory-parcel.entity';

/** Read existing observations without reclassifying licences or changing neighbouring modules. */
@Injectable()
export class RemoteEvidenceService {
    constructor(
        @InjectRepository(TeaInventoryArea) private readonly areas: Repository<TeaInventoryArea>,
        @InjectRepository(TeaInventoryParcel) private readonly parcels: Repository<TeaInventoryParcel>,
    ) { }

    async timeline(id: string) {
        const area = await this.areas.findOne({ where: { id }, select: ['id', 'producerScan', 'droneVerification'] });
        if (!area) throw new NotFoundException('Area not found');
        const scenes = area.producerScan?.scenes;
        const items = Object.values(scenes?.seasons ?? {}).flat();
        return {
            imagery: scenes ? { baseUrl: scenes.baseUrl, bounds: scenes.bounds, items: [...new Map(items.map((s) => [s.date, s])).values()].sort((a, b) => a.date.localeCompare(b.date)) } : null,
            drone: area.droneVerification ? {
                sources: area.droneVerification.sources,
                parcelKeys: area.droneVerification.parcels.map((p) => p.key),
                shot: area.droneVerification.capture.shot,
                durationS: area.droneVerification.capture.durationS,
            } : null,
        };
    }

    async parcel(id: string, block: string, parcel: string) {
        const area = await this.areas.findOne({ where: { id }, select: ['id', 'licenceAudit', 'droneVerification'] });
        if (!area) throw new NotFoundException('Area not found');
        const record = area.licenceAudit?.parcels.find((p) => p.block === block && p.parcel === parcel);
        if (!record) throw new NotFoundException('Parcel not found');
        const row = await this.parcels.findOne({ where: { areaId: id, block, parcel }, select: ['id', 'age'] });
        const drone = area.droneVerification?.parcels.find((p) => p.key === record.key);
        const source = area.droneVerification?.sources.find((s) => s.id === drone?.sourceId);
        return {
            key: record.key, monthly: row?.age?.s2 ?? null, annual: row?.age?.series ?? null,
            drone: drone && source ? { capturedAt: source.capturedAt, capturedAtNote: source.capturedAtNote, class: drone.class, verified: drone.review?.verified ?? false } : null,
            fullPixels: record.detection.fullPixels,
        };
    }
}
