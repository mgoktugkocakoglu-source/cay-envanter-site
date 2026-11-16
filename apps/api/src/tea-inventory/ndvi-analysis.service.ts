import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryParcel } from '@/tea-inventory/entities/tea-inventory-parcel.entity';
import { classifyNdvi, median, monthlyEvidence, NDVI_RULES } from '@/tea-inventory/ndvi-analysis.model';

@Injectable()
export class NdviAnalysisService {
    constructor(
        @InjectRepository(TeaInventoryArea) private readonly areas: Repository<TeaInventoryArea>,
        @InjectRepository(TeaInventoryParcel) private readonly parcels: Repository<TeaInventoryParcel>,
    ) { }
    async map(id: string, requestedYear?: number) {
        const area = await this.areas.findOne({ where: { id }, select: ['id', 'licenceAudit', 'age'] });
        if (!area?.licenceAudit) throw new NotFoundException('Licence audit geometry unavailable');
        const rows = await this.parcels.find({ where: { areaId: id }, select: ['block', 'parcel', 'age'] });
        const byParcel = new Map(rows.map(r => [`${r.block}/${r.parcel}`, r.age?.s2 ?? null]));
        const years = [...new Set(rows.flatMap(r => r.age?.s2?.years ?? []))].sort((a, b) => a - b);
        const year = requestedYear ?? years[years.length - 1] ?? new Date().getFullYear();
        const evidence = area.licenceAudit.parcels.map(p => ({ p, months: monthlyEvidence(byParcel.get(`${p.block}/${p.parcel}`) ?? null, year) }));
        const features = evidence.map(({ p, months }) => {
            for (const m of months) {
                const peers = evidence.filter(e => e.p.key !== p.key && e.p.detection.fullPixels >= NDVI_RULES.minPixels)
                    .map(e => e.months.find(n => n.month === m.month)?.delta).filter((v): v is number => v != null);
                m.peerDelta = peers.length >= NDVI_RULES.minPeers ? median(peers) : null;
            }
            return { type: 'Feature' as const, geometry: p.geometry, properties: {
                key: p.key, block: p.block, parcel: p.parcel, fullPixels: p.detection.fullPixels,
                status: classifyNdvi(months, p.detection.fullPixels), months,
                observedMonths: months.filter(m => m.value !== null).length,
                comparableMonths: months.filter(m => m.delta !== null).length,
            } };
        });
        return { type: 'FeatureCollection' as const, year, years, rules: NDVI_RULES, features,
            licenceSource: area.licenceAudit.licenceSource, sourceGeneratedAt: area.age?.generatedAt ?? null,
            notice: `${area.licenceAudit.licenceSource === 'demo' ? 'DEMO ruhsat kayıtları. ' : ''}NDVI çayı veya ihlali kanıtlamaz. Tarama eşiği ayna ve sentetik düşüş testiyle sınandı (saha verisiyle değil); ön değerlendirmedir, idari karar değildir. Referans yalnız arşivdeki seçilmiş parsellerdir; tüm mahalleyi temsil etmez.`,
        };
    }
}
