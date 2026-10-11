import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { TeaInventoryArea, InventoryLicense, TeaPatch } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryParcel } from '@/tea-inventory/entities/tea-inventory-parcel.entity';
import { InventoryClass } from '@/tea-inventory/enums/inventory-class.enum';

/** Bundles exported by the cay-envanter engine (`npm run export-site`); copied to dist by nest-cli assets. */
const SEED_DIR = join(__dirname, 'seed-data');
const BUNDLE_VERSION = 1;
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
        geometry: Record<string, unknown>;
    }>;
    teaPatches: TeaPatch[];
    unmatchedLicenses: InventoryLicense[];
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
        if (bundle.version !== BUNDLE_VERSION) {
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
                    bundleGeneratedAt: generatedAt,
                }),
            );
            const parcels = bundle.parcels.map(({ key, ...parcel }) =>
                manager.create(TeaInventoryParcel, { ...parcel, parcelKey: key, areaId: area.id }),
            );
            await manager.save(parcels, { chunk: INSERT_CHUNK });
            this.logger.log(`Imported tea inventory ${bundle.area.code}: ${parcels.length} parcels`);
        });
    }
}
