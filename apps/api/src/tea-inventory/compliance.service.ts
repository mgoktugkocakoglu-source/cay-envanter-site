import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { ComplianceBlock, ComplianceOverall, ComplianceParcel } from '@/tea-inventory/entities/compliance.types';
import { ComplianceQueryDto } from '@/tea-inventory/dto';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

export interface ComplianceSummary extends Omit<ComplianceBlock, 'parcels'> {
    neighborhood: string;
}

export type ComplianceMapProperties = Pick<ComplianceParcel, 'key' | 'block' | 'parcel' | 'nature' | 'areaM2' | 'overall' | 'certainty' | 'certaintyReason'> & {
    licenceSource: ComplianceBlock['licenceSource'];
    notice: string;
};
export type ComplianceMap = FeatureCollection<Polygon | MultiPolygon, ComplianceMapProperties> & {
    name: string;
    notice: string;
    generatedAt: string;
    licenceSource: ComplianceBlock['licenceSource'];
};

/** Order of the list: findings first, then reviews, then parcels without evidence, then the rest. */
const RANK: Record<ComplianceOverall, number> = { finding: 0, review: 1, no_evidence: 2, conforming: 3, out_of_scope: 4 };

/** Rule-based licence compliance report: read-only views of the engine's block. */
@Injectable()
export class ComplianceService {
    constructor(@InjectRepository(TeaInventoryArea) private readonly areaRepo: Repository<TeaInventoryArea>) { }

    async summary(areaId: string): Promise<ComplianceSummary> {
        const { block, neighborhood } = await this.load(areaId);
        const { parcels: _parcels, ...rest } = block;
        return { ...rest, neighborhood };
    }

    async parcels(areaId: string, query: ComplianceQueryDto): Promise<Paginated<ComplianceParcel>> {
        const { block } = await this.load(areaId);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        let list = block.parcels;
        if (query.overall) list = list.filter((p) => p.overall === query.overall);
        if (query.certainty) list = list.filter((p) => p.certainty === query.certainty);
        if (query.rule) list = list.filter((p) => p.open.includes(query.rule as string));
        const search = query.search?.trim().toLocaleLowerCase('tr');
        if (search) list = list.filter((p) => `${p.block}/${p.parcel}`.includes(search) || p.nature.toLocaleLowerCase('tr').includes(search) || p.locality.toLocaleLowerCase('tr').includes(search));
        const sorted = [...list].sort((a, b) => RANK[a.overall] - RANK[b.overall] || b.open.length - a.open.length || Number(a.block) - Number(b.block) || Number(a.parcel) - Number(b.parcel));
        return paginate(sorted.slice((page - 1) * limit, page * limit), sorted.length, page, limit);
    }

    async parcel(areaId: string, blockNumber: string, parcelNumber: string): Promise<ComplianceParcel> {
        const { block } = await this.load(areaId);
        const parcel = block.parcels.find((p) => p.block === blockNumber && p.parcel === parcelNumber);
        if (!parcel) throw new NotFoundException('Parcel not found');
        return parcel;
    }

    /** Join only the audit geometry, without loading unrelated JSONB modules or altering their records. */
    async map(areaId: string): Promise<ComplianceMap> {
        const { block, neighborhood } = await this.load(areaId);
        const area = await this.areaRepo.findOne({ where: { id: areaId }, select: ['id', 'licenceAudit'] });
        if (!area?.licenceAudit) throw new NotFoundException('No licence audit geometry for this area');
        const rows = new Map(block.parcels.map((p) => [p.key, p]));
        const notice = `${block.licenceSource === 'demo' ? 'DEMO ruhsat kayıtları. ' : ''}Ön değerlendirmedir, idari karar değildir. Kaynak uyumu doğruluk garantisi değildir.`;
        return {
            type: 'FeatureCollection', name: `${neighborhood} — Ruhsat haritası`, notice,
            generatedAt: block.generatedAt, licenceSource: block.licenceSource,
            features: area.licenceAudit.parcels.map((p) => {
                const row = rows.get(p.key);
                return {
                    type: 'Feature', geometry: p.geometry,
                    properties: {
                        key: p.key, block: p.block, parcel: p.parcel, nature: p.nature, areaM2: p.areaM2,
                        overall: row?.overall ?? 'no_evidence', certainty: row?.certainty ?? 'undecidable',
                        certaintyReason: row?.certaintyReason ?? 'Uygunluk değerlendirmesi yok; karar verilemedi.',
                        licenceSource: block.licenceSource, notice,
                    },
                };
            }),
        };
    }

    private async load(areaId: string): Promise<{ block: ComplianceBlock; neighborhood: string }> {
        const area = await this.areaRepo.findOne({ where: { id: areaId }, select: ['id', 'neighborhood', 'compliance'] });
        if (!area) throw new NotFoundException('Area not found');
        if (!area.compliance) throw new NotFoundException('No compliance report for this area');
        // Older locally imported bundles cannot imply agreement; keep them readable until regenerated.
        const parcels = area.compliance.parcels.map((p) => ({ ...p, certainty: p.certainty ?? 'undecidable', certaintyReason: p.certaintyReason ?? 'Kesinlik değerlendirmesi henüz üretilmedi; karar verilemedi.' }));
        const byCertainty: ComplianceBlock['summary']['byCertainty'] = { agreed: { parcels: 0, areaM2: 0 }, single_source: { parcels: 0, areaM2: 0 }, conflict: { parcels: 0, areaM2: 0 }, undecidable: { parcels: 0, areaM2: 0 } };
        for (const p of parcels) {
            byCertainty[p.certainty].parcels++;
            byCertainty[p.certainty].areaM2 += p.areaM2;
        }
        return { block: { ...area.compliance, certaintyConfig: area.compliance.certaintyConfig ?? {}, parcels, summary: { ...area.compliance.summary, byCertainty } }, neighborhood: area.neighborhood };
    }
}
