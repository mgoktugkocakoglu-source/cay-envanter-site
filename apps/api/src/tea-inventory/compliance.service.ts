import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { ComplianceBlock, ComplianceOverall, ComplianceParcel } from '@/tea-inventory/entities/compliance.types';
import { ComplianceQueryDto } from '@/tea-inventory/dto';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

export interface ComplianceSummary extends Omit<ComplianceBlock, 'parcels'> {
    neighborhood: string;
}

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
        if (query.rule) list = list.filter((p) => p.open.includes(query.rule as string));
        const search = query.search?.trim().toLocaleLowerCase('tr');
        if (search) list = list.filter((p) => `${p.block}/${p.parcel}`.includes(search) || p.nature.toLocaleLowerCase('tr').includes(search) || p.locality.toLocaleLowerCase('tr').includes(search));
        const sorted = [...list].sort((a, b) => RANK[a.overall] - RANK[b.overall] || b.open.length - a.open.length || Number(a.block) - Number(b.block) || Number(a.parcel) - Number(b.parcel));
        return paginate(sorted.slice((page - 1) * limit, page * limit), sorted.length, page, limit);
    }

    private async load(areaId: string): Promise<{ block: ComplianceBlock; neighborhood: string }> {
        const area = await this.areaRepo.findOne({ where: { id: areaId }, select: ['id', 'neighborhood', 'compliance'] });
        if (!area) throw new NotFoundException('Area not found');
        if (!area.compliance) throw new NotFoundException('No compliance report for this area');
        return { block: area.compliance, neighborhood: area.neighborhood };
    }
}
