import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaykurProducer } from '@/caykur/entities/caykur-producer.entity';
import { generateProducers } from '@/caykur/seed/caykur-producer.seed';

/**
 * Seeds the Çaykur enterprise panel's master dataset into the database, porting
 * the former frontend deterministic generators. Gated by SEED_DEMO=true and
 * idempotent (skips a table once populated), so it is safe to leave enabled.
 * Each module's data is added here as the panel is migrated off mock data.
 */
@Injectable()
export class CaykurSeedService implements OnModuleInit {
    private readonly logger = new Logger(CaykurSeedService.name);

    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(CaykurProducer)
        private readonly producerRepo: Repository<CaykurProducer>,
    ) { }

    async onModuleInit(): Promise<void> {
        if (this.configService.get<string>('SEED_DEMO') !== 'true') {
            return;
        }
        try {
            await this.seedProducers();
            this.logger.log('Çaykur panel seed complete');
        } catch (err) {
            this.logger.error(`Çaykur panel seed failed: ${(err as Error).message}`);
        }
    }

    private async seedProducers(): Promise<void> {
        const count = await this.producerRepo.count();
        if (count > 0) {
            return;
        }
        const rows = generateProducers().map((p) => this.producerRepo.create(p));
        await this.producerRepo.save(rows);
        this.logger.log(`Seeded ${rows.length} Çaykur producers`);
    }
}
