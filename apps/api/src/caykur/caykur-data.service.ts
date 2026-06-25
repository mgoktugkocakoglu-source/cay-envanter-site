import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaykurProducer } from '@/caykur/entities/caykur-producer.entity';

/** Producer shape returned to the panel (mirrors the frontend `Producer`). */
export interface ProducerDto {
    id: string;
    fullName: string;
    ruhsatNo: string;
    cuzdanNo: string;
    region: string;
    district: string;
    factory: string;
    licensedDekar: number;
    organic: boolean;
    seasonKg: number;
    surgun: { s1: number; s2: number; s3: number };
    quotaKg: number;
    gardenM2: number;
    prunedThisYearM2: number;
    rotationHistory: boolean[];
    outOfStandardPct: number;
}

function toProducerDto(p: CaykurProducer): ProducerDto {
    return {
        id: p.id,
        fullName: p.fullName,
        ruhsatNo: p.ruhsatNo,
        cuzdanNo: p.cuzdanNo,
        region: p.region,
        district: p.district,
        factory: p.factory,
        licensedDekar: p.licensedDekar,
        organic: p.organic,
        seasonKg: p.seasonKg,
        surgun: { s1: p.surgunS1, s2: p.surgunS2, s3: p.surgunS3 },
        quotaKg: p.quotaKg,
        gardenM2: p.gardenM2,
        prunedThisYearM2: p.prunedThisYearM2,
        rotationHistory: p.rotationHistory,
        outOfStandardPct: p.outOfStandardPct,
    };
}

@Injectable()
export class CaykurDataService {
    constructor(
        @InjectRepository(CaykurProducer)
        private readonly producerRepo: Repository<CaykurProducer>,
    ) { }

    async getProducers(): Promise<ProducerDto[]> {
        const rows = await this.producerRepo.find({ order: { id: 'ASC' } });
        return rows.map(toProducerDto);
    }

    async getProducer(id: string): Promise<ProducerDto> {
        const row = await this.producerRepo.findOne({ where: { id } });
        if (!row) {
            throw new NotFoundException('Müstahsil bulunamadı');
        }
        return toProducerDto(row);
    }
}
