import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { TeaInventoryArea, InventoryLicense, LicensingBlock, TeaPatch, ProducerScanBlock, ProducerSeasonSchedule } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryParcel } from '@/tea-inventory/entities/tea-inventory-parcel.entity';
import { InventoryClass } from '@/tea-inventory/enums/inventory-class.enum';
import { TeaInventoryProducer, ProducerScan, ProducerAutoStatus, ProducerFusion } from '@/tea-inventory/entities/tea-inventory-producer.entity';
import { TeaInventoryGarden, GardenSeason, GardenPruningEvent, GardenFusion, RadarResult, RadarSeries } from '@/tea-inventory/entities/tea-inventory-garden.entity';
import { TeaInventoryLicense } from '@/tea-inventory/entities/tea-inventory-license.entity';
import { ParcelLineage } from '@/tea-inventory/entities/parcel-lineage.entity';
import { LicensingApplication } from '@/tea-inventory/entities/licensing-application.entity';

/** Bundles exported by the cay-envanter engine (`npm run export-site`); copied to dist by nest-cli assets. */
const SEED_DIR = join(__dirname, 'seed-data');
/** v1 inventory; v2 pruning; v3 single-season producers (no longer imported); v4 multi-season producers; v5 licence register. */
const SUPPORTED_BUNDLE_VERSIONS = [1, 2, 4, 5];
const INSERT_CHUNK = 200;

type LicenseRow = Omit<TeaInventoryLicense, 'id' | 'areaId' | 'area'>;
type LineageRow = Omit<ParcelLineage, 'id' | 'areaId' | 'area'>;
type ApplicationRow = Omit<LicensingApplication, 'id' | 'areaId' | 'area'>;
type GardenLicensingFields = Pick<
    TeaInventoryGarden,
    'code' | 'licenseCode' | 'approvalStatus' | 'licensedAreaM2' | 'planimetricAreaM2' | 'surfaceAreaM2' | 'meanSlopeDeg' | 'measuredTeaAreaM2' | 'discrepancies' | 'versions' | 'proposal'
>;

interface BundleLicensing extends LicensingBlock {
    lineage: LineageRow[];
    licenses: LicenseRow[];
    gardens: GardenLicensingFields[];
    applications: ApplicationRow[];
}

/** Optional radar block: Sentinel-1 confirmation per optical record, relative series per garden. */
interface BundleRadar {
    calibrated: boolean;
    method: string;
    rules: Record<string, unknown>;
    seasons: Array<{
        season: string;
        window: [string, string];
        passes: Array<{ pass: 'ASCENDING' | 'DESCENDING'; relativeOrbit: number; dates: string[]; cohDates?: string[] }>;
        coherence?: { cohWin: [number, number]; pairs: Record<string, number> } | null;
        series: Record<string, Array<{ pass: 'ASCENDING' | 'DESCENDING'; vhRel: Array<number | null>; ratioRel: Array<number | null>; cohRel?: Array<number | null> }>>;
        records: Array<{ recordId: string; gardenCode: string; radar: RadarResult }>;
        radarOnly: Array<{ gardenCode: string; date: string; vhDropDb: number; persistence: number; z: number }>;
    }>;
}

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
    licensing?: BundleLicensing | null;
    radar?: BundleRadar | null;
    fusion?: BundleFusion | null;
}

/** Optional fusion block: multi-sensor verdicts per garden and producer per season. */
interface BundleFusion {
    calibrated: boolean;
    method: string;
    rules: Record<string, unknown>;
    channels: Record<string, { sign: 1 | -1; minEffect: number; noiseFloor: number }>;
    seasons: Array<{
        season: string;
        everyDays: number;
        scanFrom: string;
        scanTo: string;
        sensors: { optical: { dates: string[] }; backscatter: Array<{ pass: string; relativeOrbit: number; dates: string[] }>; coherence: Array<{ pass: string; dates: string[] }> };
        gardens: Array<GardenFusion & { code: string; producerCode: string }>;
        producers: Array<ProducerFusion & { code: string }>;
    }>;
}

interface BundleProducers {
    rules: Record<string, unknown>;
    producers: Array<{ code: string; name: string; walletNo: string; licenseNo: string; gardenCodes: string[] }>;
    gardens: Array<{
        code: string;
        producerCode: string;
        parcelKey: string;
        block: string;
        parcel: string;
        locality?: string;
        holderIndex: number;
        holderCount: number;
        boundaryResolved: boolean;
        geometryAreaM2: number;
        geometry: Record<string, unknown>;
    }>;
    seasons: Array<
        ProducerSeasonSchedule & {
            producers: Array<{
                code: string;
                licensedAreaM2: number;
                teaAreaM2: number;
                requiredM2: number;
                grossPrunedM2: number;
                reusedM2: number;
                newPrunedM2: number;
                unattributedM2: number;
                unobservedM2: number;
                remainingM2: number;
                unresolvedGardens: number;
                status: ProducerAutoStatus;
                autoApprovedAt: string | null;
                scans: ProducerScan[];
            }>;
            gardens: Array<Omit<GardenSeason, 'events'> & { code: string }>;
            events: Array<GardenPruningEvent & { gardenCode: string }>;
        }
    >;
    scenes: ProducerScanBlock['scenes'];
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
                    producerScan: bundle.producers
                        ? {
                            rules: bundle.producers.rules,
                            seasons: bundle.producers.seasons.map(({ producers: _p, gardens: _g, events: _e, ...schedule }) => schedule),
                            scenes: bundle.producers.scenes,
                            radar: bundle.radar
                                ? {
                                    calibrated: bundle.radar.calibrated,
                                    method: bundle.radar.method,
                                    rules: bundle.radar.rules,
                                    seasons: bundle.radar.seasons.map((s) => ({ season: s.season, window: s.window, passes: s.passes, coherence: s.coherence ?? null })),
                                }
                                : null,
                            fusion: bundle.fusion
                                ? {
                                    calibrated: bundle.fusion.calibrated,
                                    method: bundle.fusion.method,
                                    rules: bundle.fusion.rules,
                                    channels: bundle.fusion.channels,
                                    seasons: bundle.fusion.seasons.map((s) => ({ season: s.season, everyDays: s.everyDays, scanFrom: s.scanFrom, scanTo: s.scanTo, sensors: s.sensors })),
                                }
                                : null,
                        }
                        : null,
                    licensing: bundle.licensing
                        ? {
                            demo: bundle.licensing.demo,
                            generatedAt: bundle.licensing.generatedAt,
                            rules: bundle.licensing.rules,
                            conflicts: bundle.licensing.conflicts,
                            unlicensedTea: bundle.licensing.unlicensedTea,
                        }
                        : null,
                    bundleGeneratedAt: generatedAt,
                }),
            );
            const parcels = bundle.parcels.map(({ key, ...parcel }) =>
                manager.create(TeaInventoryParcel, { ...parcel, pruning: parcel.pruning ?? null, parcelKey: key, areaId: area.id }),
            );
            await manager.save(parcels, { chunk: INSERT_CHUNK });
            if (bundle.producers) {
                await this.importProducers(manager, area.id, bundle.producers, bundle.licensing ?? null, bundle.radar ?? null, bundle.fusion ?? null);
            }
            if (bundle.licensing) {
                await this.importLicensing(manager, area.id, bundle.licensing);
            }
            this.logger.log(`Imported tea inventory ${bundle.area.code}: ${parcels.length} parcels`);
        });
    }

    /** Licences, old→new parcel links and application files of the register. */
    private async importLicensing(manager: EntityManager, areaId: string, block: BundleLicensing): Promise<void> {
        await manager.save(block.licenses.map((l) => manager.create(TeaInventoryLicense, { ...l, areaId })), { chunk: INSERT_CHUNK });
        await manager.save(block.lineage.map((l) => manager.create(ParcelLineage, { ...l, areaId })), { chunk: INSERT_CHUNK });
        await manager.save(block.applications.map((a) => manager.create(LicensingApplication, { ...a, areaId })), { chunk: INSERT_CHUNK });
        this.logger.log(`Imported ${block.licenses.length} licences, ${block.lineage.length} lineage records, ${block.applications.length} applications`);
    }

    /**
     * One producer row per scanned season (same code across seasons); one garden row per
     * ground record with its per-season results and event polygons (and, from bundle v5, its
     * licence register fields).
     */
    private async importProducers(
        manager: EntityManager,
        areaId: string,
        block: BundleProducers,
        licensing: BundleLicensing | null,
        radar: BundleRadar | null,
        fusion: BundleFusion | null,
    ): Promise<void> {
        const licensingByGarden = new Map((licensing?.gardens ?? []).map((g) => [g.code, g]));
        // Fusion verdicts keyed by "<garden>:<season>" and "<producer>:<season>".
        const fusionByGarden = new Map<string, GardenFusion>();
        const fusionByProducer = new Map<string, ProducerFusion>();
        for (const s of fusion?.seasons ?? []) {
            for (const { code, producerCode: _p, ...rest } of s.gardens) fusionByGarden.set(`${code}:${s.season}`, rest);
            for (const { code, ...rest } of s.producers) fusionByProducer.set(`${code}:${s.season}`, rest);
        }
        // Radar verdicts keyed by "<garden>:<season>:<n>" and relative series per garden+season.
        const radarByRecord = new Map<string, RadarResult>();
        const radarSeries = new Map<string, RadarSeries[]>();
        const radarOnly = new Map<string, { date: string; vhDropDb: number; persistence: number; z: number }>();
        for (const s of radar?.seasons ?? []) {
            for (const r of s.records) radarByRecord.set(r.recordId, r.radar);
            for (const [code, passes] of Object.entries(s.series)) {
                radarSeries.set(
                    `${code}:${s.season}`,
                    passes.map((p) => {
                        const header = s.passes.find((x) => x.pass === p.pass);
                        return { pass: p.pass, dates: header?.dates ?? [], vhRel: p.vhRel, ratioRel: p.ratioRel, cohDates: header?.cohDates, cohRel: p.cohRel };
                    }),
                );
            }
            for (const c of s.radarOnly) radarOnly.set(`${c.gardenCode}:${s.season}`, { date: c.date, vhDropDb: c.vhDropDb, persistence: c.persistence, z: c.z });
        }
        const names = new Map(block.producers.map((p) => [p.code, p]));
        const gardenCount = new Map<string, number>();
        for (const g of block.gardens) gardenCount.set(g.producerCode, (gardenCount.get(g.producerCode) ?? 0) + 1);

        const rows: TeaInventoryProducer[] = [];
        for (const season of block.seasons) {
            for (const p of season.producers) {
                const who = names.get(p.code);
                if (!who) continue;
                rows.push(
                    manager.create(TeaInventoryProducer, {
                        areaId,
                        code: p.code,
                        season: season.season,
                        name: who.name,
                        walletNo: who.walletNo,
                        licenseNo: who.licenseNo,
                        licensedAreaM2: p.licensedAreaM2,
                        teaAreaM2: p.teaAreaM2,
                        requiredM2: p.requiredM2,
                        grossPrunedM2: p.grossPrunedM2,
                        reusedM2: p.reusedM2,
                        newPrunedM2: p.newPrunedM2,
                        unattributedM2: p.unattributedM2,
                        unobservedM2: p.unobservedM2,
                        remainingM2: p.remainingM2,
                        gardenCount: gardenCount.get(p.code) ?? 0,
                        unresolvedGardens: p.unresolvedGardens,
                        autoStatus: p.status,
                        autoApprovedAt: p.autoApprovedAt,
                        scans: p.scans,
                        fusion: fusionByProducer.get(`${p.code}:${season.season}`) ?? null,
                        demo: true,
                    }),
                );
            }
        }
        await manager.save(rows, { chunk: INSERT_CHUNK });

        const seasonsByGarden = new Map<string, Record<string, GardenSeason>>();
        for (const season of block.seasons) {
            const events = new Map<string, GardenPruningEvent[]>();
            for (const { gardenCode, ...event } of season.events) {
                events.set(gardenCode, [...(events.get(gardenCode) ?? []), event]);
            }
            for (const { code, ...rest } of season.gardens) {
                const entry = seasonsByGarden.get(code) ?? {};
                const key = `${code}:${season.season}`;
                entry[season.season] = {
                    ...rest,
                    events: (events.get(code) ?? []).map((e, i) => ({ ...e, radar: radarByRecord.get(`${key}:${i + 1}`) ?? null })),
                    radarSeries: radarSeries.get(key),
                    radarOnly: radarOnly.get(key) ?? null,
                    fusion: fusionByGarden.get(key) ?? null,
                };
                seasonsByGarden.set(code, entry);
            }
        }
        const gardens = block.gardens.map((g) => {
            const { code: _c, ...licensingFields } = licensingByGarden.get(g.code) ?? { code: g.code };
            return manager.create(TeaInventoryGarden, { ...g, locality: g.locality ?? '', ...licensingFields, areaId, seasons: seasonsByGarden.get(g.code) ?? {} });
        });
        await manager.save(gardens, { chunk: INSERT_CHUNK });
        this.logger.log(`Imported ${block.producers.length} producers × ${block.seasons.length} seasons and ${gardens.length} gardens`);
    }
}
