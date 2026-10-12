import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { TeaInventoryArea, InventoryLicense, TeaPatch } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryParcel } from '@/tea-inventory/entities/tea-inventory-parcel.entity';
import { InventoryClass } from '@/tea-inventory/enums/inventory-class.enum';
import { TeaInventoryProducer, ProducerScan, ProducerAutoStatus } from '@/tea-inventory/entities/tea-inventory-producer.entity';
import { TeaInventoryGarden } from '@/tea-inventory/entities/tea-inventory-garden.entity';

/** Bundles exported by the cay-envanter engine (`npm run export-site`); copied to dist by nest-cli assets. */
const SEED_DIR = join(__dirname, 'seed-data');
/** v1 = inventory; v2 adds the pruning block; v3 adds producers + gardens with 5-day scans. */
const SUPPORTED_BUNDLE_VERSIONS = [1, 2, 3];
const INSERT_CHUNK = 200;

interface InventoryBundle {
    version: number;
    generatedAt: string;
    demoLicenses: boolean;
    area: {
        code: string;
        province: string;
        district: string;
        neighborhood: string;
        neighborhoodId: number | null;
        boundary: Record<string, unknown>;
        boundaryAreaM2: number;
        coveredRatio: number;
        period: Record<string, unknown>;
        model: Record<string, unknown>;
    };
    parcels: Array<{
        key: string;
        block: string;
        parcel: string;
        nature: string;
        locality: string;
        deedAreaM2: number | null;
        geometryAreaM2: number;
        teaProbability: number | null;
        teaShare: number | null;
        teaAreaM2: number | null;
        inventoryClass: InventoryClass;
        license: InventoryLicense | null;
        pruning?: Record<string, unknown> | null;
        geometry: Record<string, unknown>;
    }>;
    teaPatches: TeaPatch[];
    unmatchedLicenses: InventoryLicense[];
    pruning?: Record<string, unknown> | null;
    producers?: BundleProducers | null;
}

interface BundleProducers {
    schedule: Record<string, unknown> & { season: string };
    producers: Array<{
        code: string;
        name: string;
        walletNo: string;
        licenseNo: string;
        licensedAreaM2: number;
        teaAreaM2: number;
        requiredM2: number;
        prunedM2: number;
        status: ProducerAutoStatus;
        autoApprovedAt: string | null;
        scans: ProducerScan[];
    }>;
    gardens: Array<{
        code: string;
        producerCode: string;
        parcelKey: string;
        block: string;
        parcel: string;
        holderIndex: number;
        holderCount: number;
        geometryAreaM2: number;
        teaAreaM2: number;
        prunedSeries: number[];
        geometry: Record<string, unknown>;
    }>;
}

/**
 * Imports tea-inventory bundles into the database. Gated by SEED_DEMO=true like
 * the other demo seeds; an area is replaced only when its bundle timestamp
 * changed, so restarts are cheap and a new export simply supersedes the old one.
 */
@Injectable()
export class TeaInventorySeedService implements OnModuleInit {
    private readonly logger = new Logger(TeaInventorySeedService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly dataSource: DataSource,
    ) { }

    async onModuleInit(): Promise<void> {
        if (this.configService.get<string>('SEED_DEMO') !== 'true' || !existsSync(SEED_DIR)) {
            return;
        }
        for (const file of readdirSync(SEED_DIR).filter((name) => name.endsWith('.json'))) {
            try {
                const bundle = JSON.parse(readFileSync(join(SEED_DIR, file), 'utf8')) as InventoryBundle;
                await this.importBundle(bundle);
            } catch (err) {
                this.logger.error(`Tea inventory import failed for ${file}: ${(err as Error).message}`);
            }
        }
    }

    private async importBundle(bundle: InventoryBundle): Promise<void> {
        if (!SUPPORTED_BUNDLE_VERSIONS.includes(bundle.version)) {
            throw new Error(`unsupported bundle version ${bundle.version}`);
        }
        const generatedAt = new Date(bundle.generatedAt);
        await this.dataSource.transaction(async (manager) => {
            const existing = await manager.findOne(TeaInventoryArea, { where: { code: bundle.area.code } });
            if (existing && existing.bundleGeneratedAt.getTime() === generatedAt.getTime()) {
                return;
            }
            if (existing) {
                await manager.delete(TeaInventoryArea, { id: existing.id });
            }
            const area = await manager.save(
                manager.create(TeaInventoryArea, {
                    ...bundle.area,
                    demoLicenses: bundle.demoLicenses,
                    teaPatches: bundle.teaPatches,
                    unmatchedLicenses: bundle.unmatchedLicenses,
                    pruning: bundle.pruning ?? null,
                    producerScan: bundle.producers?.schedule ?? null,
                    bundleGeneratedAt: generatedAt,
                }),
            );
            const parcels = bundle.parcels.map(({ key, ...parcel }) =>
                manager.create(TeaInventoryParcel, { ...parcel, pruning: parcel.pruning ?? null, parcelKey: key, areaId: area.id }),
            );
            await manager.save(parcels, { chunk: INSERT_CHUNK });
            if (bundle.producers) {
                await this.importProducers(manager, area.id, bundle.producers);
            }
            this.logger.log(`Imported tea inventory ${bundle.area.code}: ${parcels.length} parcels`);
        });
    }

    /** Producers first (they own the gardens), then gardens linked by the producer's new id. */
    private async importProducers(manager: EntityManager, areaId: string, block: BundleProducers): Promise<void> {
        const counts = new Map<string, number>();
        for (const g of block.gardens) counts.set(g.producerCode, (counts.get(g.producerCode) ?? 0) + 1);
        const producers = await manager.save(
            block.producers.map((p) =>
                manager.create(TeaInventoryProducer, {
                    areaId,
                    code: p.code,
                    name: p.name,
                    walletNo: p.walletNo,
                    licenseNo: p.licenseNo,
                    licensedAreaM2: p.licensedAreaM2,
                    teaAreaM2: p.teaAreaM2,
                    requiredM2: p.requiredM2,
                    prunedM2: p.prunedM2,
                    gardenCount: counts.get(p.code) ?? 0,
                    season: block.schedule.season,
                    autoStatus: p.status,
                    autoApprovedAt: p.autoApprovedAt,
                    scans: p.scans,
                    demo: true,
                }),
            ),
            { chunk: INSERT_CHUNK },
        );
        const idByCode = new Map(producers.map((p) => [p.code, p.id]));
        const gardens = block.gardens
            .filter((g) => idByCode.has(g.producerCode))
            .map(({ producerCode, ...g }) => manager.create(TeaInventoryGarden, { ...g, areaId, producerId: idByCode.get(producerCode) as string }));
        await manager.save(gardens, { chunk: INSERT_CHUNK });
        this.logger.log(`Imported ${producers.length} producers and ${gardens.length} gardens`);
    }
}
