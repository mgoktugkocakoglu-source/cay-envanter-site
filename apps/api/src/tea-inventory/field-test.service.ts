import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { FieldTestsBlock } from '@/tea-inventory/entities/field-test.types';

/** Independent field tests (Saha testi): ground truth from the field against a separate satellite step test. */
@Injectable()
export class FieldTestService {
    constructor(@InjectRepository(TeaInventoryArea) private readonly areaRepo: Repository<TeaInventoryArea>) { }

    async block(areaId: string): Promise<FieldTestsBlock> {
        const area = await this.areaRepo.findOne({ where: { id: areaId }, select: ['id', 'fieldTests'] });
        if (!area) throw new NotFoundException('Area not found');
        if (!area.fieldTests) throw new NotFoundException('No field tests for this area');
        return area.fieldTests;
    }
}
