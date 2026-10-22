import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BoundaryConflict, LicensingBlock, TeaInventoryArea, TeaPatch } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { ProducerAutoStatus, TeaInventoryProducer } from '@/tea-inventory/entities/tea-inventory-producer.entity';
import {
    GardenApprovalStatus,
    GardenBoundaryProposal,
    GardenDiscrepancy,
    GardenEvent,
    GardenGeometryVersion,
    GardenRecordStatus,
    TeaInventoryGarden,
} from '@/tea-inventory/entities/tea-inventory-garden.entity';
import { LicenseEvent, LicenseMatchLevel, TeaInventoryLicense } from '@/tea-inventory/entities/tea-inventory-license.entity';
import { LicensingOperationsService } from '@/tea-inventory/licensing-operations.service';
import { ParcelLineage } from '@/tea-inventory/entities/parcel-lineage.entity';
import {
    ApplicationDocument,
    ApplicationHistoryEntry,
    ApplicationStatus,
    ApplicationType,
    LicensingApplication,
} from '@/tea-inventory/entities/licensing-application.entity';
import { LicensingDecision } from '@/tea-inventory/entities/licensing-decision.entity';
import { User } from '@/users/entities/user.entity';
import { ApplicationDecisionDto, ApplicationQueryDto, CreateApplicationDto, LicensingProducerQueryDto } from '@/tea-inventory/dto';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

/** Files in these statuses are closed; everything else is in the queue. */
const CLOSED_STATUSES: ApplicationStatus[] = ['DEMO_APPROVED', 'REJECTED', 'SUPERSEDED'];

/** Transitions a reviewer may take from each status (the workflow of the licensing design). */
const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
    DRAFT: ['DOCUMENTS_PENDING', 'UNDER_REVIEW'],
    DOCUMENTS_PENDING: ['UNDER_REVIEW', 'RETURNED_FOR_CORRECTION', 'REJECTED'],
    MATCHING_REQUIRED: ['UNDER_REVIEW', 'FIELD_CHECK_REQUIRED', 'RETURNED_FOR_CORRECTION'],
    GEOMETRY_PROPOSED: ['UNDER_REVIEW', 'RETURNED_FOR_CORRECTION'],
    BOUNDARY_CONFLICT: ['UNDER_REVIEW', 'FIELD_CHECK_REQUIRED', 'RETURNED_FOR_CORRECTION'],
    UNDER_REVIEW: ['DEMO_APPROVED', 'RETURNED_FOR_CORRECTION', 'FIELD_CHECK_REQUIRED', 'REJECTED'],
    FIELD_CHECK_REQUIRED: ['UNDER_REVIEW', 'DEMO_APPROVED', 'REJECTED'],
    RETURNED_FOR_CORRECTION: ['UNDER_REVIEW', 'REJECTED'],
    DEMO_APPROVED: ['SUPERSEDED'],
    REJECTED: ['UNDER_REVIEW'],
    SUPERSEDED: [],
};
/** Steps that need a written reason. */
const NOTE_REQUIRED: ApplicationStatus[] = ['RETURNED_FOR_CORRECTION', 'REJECTED', 'FIELD_CHECK_REQUIRED'];

const MATCH_RANK: Record<LicenseMatchLevel, number> = { exact: 0, historical: 1, probable: 2, unmatched: 3 };
const APPROVAL_RANK: Record<GardenApprovalStatus, number> = { approved: 0, field_check_required: 1, proposed: 2, unresolved: 3, boundary_conflict: 4 };

export interface LicensingSummary {
    demo: boolean;
    generatedAt: string | null;
    rules: LicensingBlock['rules'] | null;
    producers: { total: number; licensed: number; unlicensed: number; withIssues: number; deceasedHolders: number };
    licenses: { total: number; byMatchLevel: Record<LicenseMatchLevel, number>; byStatus: Record<string, number> };
    gardens: {
        total: number;
        byApprovalStatus: Record<GardenApprovalStatus, number>;
        discrepancies: Record<GardenDiscrepancy, number>;
        licensedAreaM2: number;
        planimetricAreaM2: number;
        surfaceAreaM2: number;
        measuredTeaAreaM2: number;
        meanSlopeDeg: number;
    };
    applications: { total: number; open: number; byStatus: Record<ApplicationStatus, number> };
    conflicts: { open: number; overlapM2: number };
    unlicensedTea: { count: number; areaM2: number };
    lineage: number;
}

export interface LicensingProducerRow {
    code: string;
    name: string;
    walletNo: string;
    licenseCodes: string[];
    licenseCount: number;
    holderDeceased: boolean;
    gardenCount: number;
    approvedGardens: number;
    matchLevel: LicenseMatchLevel | null;
    approvalStatus: GardenApprovalStatus;
    licensedAreaM2: number;
    planimetricAreaM2: number;
    surfaceAreaM2: number;
    measuredTeaAreaM2: number;
    discrepancies: GardenDiscrepancy[];
    openApplications: number;
    issueCount: number;
    pruningStatus: ProducerAutoStatus | null;
    pruningSeason: string | null;
}

export interface LicenseView {
    code: string;
    producerCode: string;
    walletNo: string;
    status: string;
    issuedYear: number;
    recordedAreaM2: number;
    allocatedAreaM2: number;
    recordedParcelRefs: string[];
    matchLevel: LicenseMatchLevel;
    matchedParcelKeys: string[];
    lineage: ParcelLineageView[];
    candidateParcelKeys: string[];
    holderDeceased: boolean;
    validFrom: string;
    validTo: string | null;
    gardenCodes: string[];
    parentCode: string | null;
    childCodes: string[];
    history: LicenseEvent[];
    source: 'engine' | 'site';
}

export interface ParcelLineageView {
    code: string;
    oldRef: string;
    newParcelKey: string;
    changeType: string;
    source: string;
    changedAt: string;
}

export interface LicensedGardenView {
    id: string;
    code: string;
    producerCode: string;
    parcelKey: string;
    block: string;
    parcel: string;
    holderIndex: number;
    holderCount: number;
    boundaryResolved: boolean;
    licenseCode: string | null;
    approvalStatus: GardenApprovalStatus;
    licensedAreaM2: number | null;
    planimetricAreaM2: number;
    surfaceAreaM2: number;
    meanSlopeDeg: number;
    measuredTeaAreaM2: number;
    discrepancies: GardenDiscrepancy[];
    versions: GardenGeometryVersion[];
    proposal: GardenBoundaryProposal | null;
    geometry: Record<string, unknown>;
    recordStatus: GardenRecordStatus;
    supersededBy: string[];
    parentCode: string | null;
    events: GardenEvent[];
    source: 'engine' | 'site';
    locality: string;
}

export interface ApplicationDecisionView {
    fromStatus: ApplicationStatus;
    toStatus: ApplicationStatus;
    note: string | null;
    decidedByName: string;
    decidedAt: string;
}

export interface ApplicationRow {
    id: string;
    code: string;
    producerCode: string;
    producerName: string;
    licenseCode: string | null;
    gardenCode: string | null;
    parcelRef: string | null;
    type: ApplicationType;
    seededStatus: ApplicationStatus;
    status: ApplicationStatus;
    open: boolean;
    submittedAt: string;
    summary: string;
    missingDocuments: number;
    lastActivityAt: string;
    allowedTransitions: ApplicationStatus[];
    source: 'engine' | 'site';
    hasPayload: boolean;
    appliedAt: string | null;
    createdByName: string | null;
}

export interface ApplicationDetail extends ApplicationRow {
    documents: ApplicationDocument[];
    history: ApplicationHistoryEntry[];
    decisions: ApplicationDecisionView[];
    garden: LicensedGardenView | null;
    license: LicenseView | null;
    payload: Record<string, unknown> | null;
    effects: Record<string, unknown> | null;
}

export interface LicensingProducerProfile extends LicensingProducerRow {
    licenses: LicenseView[];
    gardens: LicensedGardenView[];
    applications: ApplicationRow[];
    conflicts: BoundaryConflict[];
    pruningHistory: Array<{ season: string; status: ProducerAutoStatus; licensedAreaM2: number; requiredM2: number; newPrunedM2: number }>;
}

type FeatureCollection = { type: 'FeatureCollection'; features: Array<{ type: 'Feature'; geometry: Record<string, unknown>; properties: Record<string, unknown> }> };

export interface LicensingLayers {
    gardens: FeatureCollection;
    proposals: FeatureCollection;
    conflicts: FeatureCollection;
    unlicensedTea: FeatureCollection;
}

interface ProducerIdentity {
    code: string;
    name: string;
    walletNo: string;
}

/**
 * Producer-centred digital licence register: licences → licensed garden sub-polygons → parcels,
 * with match levels, the three area measures, boundary proposals / conflicts, geometry versions
 * and the application workflow. Decisions taken here are DEMO steps on a demo register.
 */
@Injectable()
export class LicensingService {
    constructor(
        @InjectRepository(TeaInventoryArea)
        private readonly areaRepo: Repository<TeaInventoryArea>,
        @InjectRepository(TeaInventoryProducer)
        private readonly producerRepo: Repository<TeaInventoryProducer>,
        @InjectRepository(TeaInventoryGarden)
        private readonly gardenRepo: Repository<TeaInventoryGarden>,
        @InjectRepository(TeaInventoryLicense)
        private readonly licenseRepo: Repository<TeaInventoryLicense>,
        @InjectRepository(ParcelLineage)
        private readonly lineageRepo: Repository<ParcelLineage>,
        @InjectRepository(LicensingApplication)
        private readonly applicationRepo: Repository<LicensingApplication>,
        @InjectRepository(LicensingDecision)
        private readonly decisionRepo: Repository<LicensingDecision>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly operations: LicensingOperationsService,
        private readonly dataSource: DataSource,
    ) { }

    async summary(areaId: string): Promise<LicensingSummary> {
        const area = await this.findArea(areaId);
        const [licenses, gardens, applications, lineageCount, producers] = await Promise.all([
            this.licenseRepo.find({ where: { areaId } }),
            this.gardenRepo.find({ where: { areaId, recordStatus: 'active' }, select: ['code', 'producerCode', 'approvalStatus', 'licensedAreaM2', 'planimetricAreaM2', 'surfaceAreaM2', 'measuredTeaAreaM2', 'meanSlopeDeg', 'discrepancies'] }),
            this.applicationRepo.find({ where: { areaId } }),
            this.lineageRepo.count({ where: { areaId } }),
            this.producerIdentities(areaId),
        ]);
        const effective = await this.effectiveStatuses(area.code, applications);
        const count = <K extends string>(keys: readonly K[], items: K[]): Record<K, number> => {
            const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
            for (const k of items) out[k] = (out[k] ?? 0) + 1;
            return out;
        };
        const licensedProducers = new Set(licenses.map((l) => l.producerCode));
        const issueProducers = new Set<string>();
        for (const g of gardens) {
            if (g.discrepancies.length > 0 || g.approvalStatus !== 'approved') issueProducers.add(g.producerCode);
        }
        for (const a of applications) {
            if (!CLOSED_STATUSES.includes(effective.get(a.code) ?? a.status)) issueProducers.add(a.producerCode);
        }
        const conflicts = (area.licensing?.conflicts ?? []).filter((c) => c.status === 'open');
        const unlicensed = area.licensing?.unlicensedTea ?? [];
        const slopes = gardens.map((g) => g.meanSlopeDeg);
        return {
            demo: area.licensing?.demo ?? area.demoLicenses,
            generatedAt: area.licensing?.generatedAt ?? null,
            rules: area.licensing?.rules ?? null,
            producers: {
                total: producers.length,
                licensed: producers.filter((p) => licensedProducers.has(p.code)).length,
                unlicensed: producers.filter((p) => !licensedProducers.has(p.code)).length,
                withIssues: issueProducers.size,
                deceasedHolders: licenses.filter((l) => l.holderDeceased).length,
            },
            licenses: {
                total: licenses.length,
                byMatchLevel: count(['exact', 'historical', 'probable', 'unmatched'] as const, licenses.map((l) => l.matchLevel)),
                byStatus: count(['active', 'transfer_pending', 'inactive'] as const, licenses.map((l) => l.status)),
            },
            gardens: {
                total: gardens.length,
                byApprovalStatus: count(['approved', 'proposed', 'boundary_conflict', 'field_check_required', 'unresolved'] as const, gardens.map((g) => g.approvalStatus)),
                discrepancies: count(
                    ['area_over', 'area_under', 'no_tea', 'no_license', 'lineage_unresolved', 'overlap', 'outside_parcel'] as const,
                    gardens.flatMap((g) => g.discrepancies),
                ),
                licensedAreaM2: Math.round(gardens.reduce((s, g) => s + (g.licensedAreaM2 ?? 0), 0)),
                planimetricAreaM2: Math.round(gardens.reduce((s, g) => s + g.planimetricAreaM2, 0)),
                surfaceAreaM2: Math.round(gardens.reduce((s, g) => s + g.surfaceAreaM2, 0)),
                measuredTeaAreaM2: Math.round(gardens.reduce((s, g) => s + g.measuredTeaAreaM2, 0)),
                meanSlopeDeg: slopes.length ? Math.round((slopes.reduce((a, b) => a + b, 0) / slopes.length) * 10) / 10 : 0,
            },
            applications: {
                total: applications.length,
                open: applications.filter((a) => !CLOSED_STATUSES.includes(effective.get(a.code) ?? a.status)).length,
                byStatus: count(
                    ['DRAFT', 'DOCUMENTS_PENDING', 'MATCHING_REQUIRED', 'GEOMETRY_PROPOSED', 'BOUNDARY_CONFLICT', 'UNDER_REVIEW', 'FIELD_CHECK_REQUIRED', 'DEMO_APPROVED', 'RETURNED_FOR_CORRECTION', 'REJECTED', 'SUPERSEDED'] as const,
                    applications.map((a) => effective.get(a.code) ?? a.status),
                ),
            },
            conflicts: { open: conflicts.length, overlapM2: Math.round(conflicts.reduce((s, c) => s + c.overlapM2, 0)) },
            unlicensedTea: { count: unlicensed.length, areaM2: Math.round(unlicensed.reduce((s, u) => s + u.areaM2, 0)) },
            lineage: lineageCount,
        };
    }

    async producers(areaId: string, query: LicensingProducerQueryDto): Promise<Paginated<LicensingProducerRow>> {
        const rows = await this.producerRows(areaId);
        const search = query.search?.trim().toLocaleLowerCase('tr-TR');
        const gardensByProducer = search ? await this.gardenSearchIndex(areaId) : null;
        let filtered = rows.filter((r) => {
            if (query.matchLevel && r.matchLevel !== query.matchLevel) return false;
            if (query.approvalStatus && r.approvalStatus !== query.approvalStatus) return false;
            if (query.discrepancy && !r.discrepancies.includes(query.discrepancy)) return false;
            if (query.issues === 'true' && r.issueCount === 0) return false;
            if (query.issues === 'false' && r.issueCount > 0) return false;
            if (search) {
                const haystack = [r.name, r.code, r.walletNo, ...r.licenseCodes, ...(gardensByProducer?.get(r.code) ?? [])].join(' ').toLocaleLowerCase('tr-TR');
                if (!haystack.includes(search)) return false;
            }
            return true;
        });
        const dir = query.sortOrder === 'ASC' ? 1 : -1;
        const key = query.sortBy ?? 'issues';
        filtered = filtered.sort((a, b) => {
            if (key === 'name') return a.name.localeCompare(b.name, 'tr-TR') * dir;
            if (key === 'licensedArea') return (a.licensedAreaM2 - b.licensedAreaM2) * dir;
            if (key === 'measuredTea') return (a.measuredTeaAreaM2 - b.measuredTeaAreaM2) * dir;
            return (a.issueCount - b.issueCount) * dir || a.name.localeCompare(b.name, 'tr-TR');
        });
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        return paginate(filtered.slice((page - 1) * limit, page * limit), filtered.length, page, limit);
    }

    /** Excel-friendly CSV (UTF-8 BOM, semicolons) of every producer's register line. */
    async producersCsv(areaId: string): Promise<string> {
        const rows = await this.producerRows(areaId);
        const header = ['Müstahsil No', 'Ad Soyad', 'Cüzdan No', 'Ruhsat No', 'Ruhsat Eşleşme', 'Bahçe', 'Onaylı Bahçe', 'Sınır Durumu', 'Ruhsat Alanı (m²)', 'İzdüşüm Alanı (m²)', 'Eğimli Yüzey (m²)', 'Ölçülen Çaylık (m²)', 'Uyuşmazlıklar', 'Açık Başvuru', 'Not'];
        const cell = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lines = rows.map((r) =>
            [
                r.code, r.name, r.walletNo, r.licenseCodes.join(', '), r.matchLevel ?? '', r.gardenCount, r.approvedGardens, r.approvalStatus,
                r.licensedAreaM2, r.planimetricAreaM2, r.surfaceAreaM2, r.measuredTeaAreaM2, r.discrepancies.join(', '), r.openApplications, 'DEMO kayıt',
            ].map(cell).join(';'),
        );
        return `﻿${header.map(cell).join(';')}\n${lines.join('\n')}\n`;
    }

    async producerProfile(areaId: string, code: string): Promise<LicensingProducerProfile> {
        const area = await this.findArea(areaId);
        const row = (await this.producerRows(areaId)).find((r) => r.code === code);
        if (!row) throw new NotFoundException('Producer not found');
        const [licenses, gardens, applications, lineage, seasons] = await Promise.all([
            this.licenseRepo.find({ where: { areaId, producerCode: code }, order: { status: 'ASC', code: 'ASC' } }),
            this.gardenRepo.find({ where: { areaId, producerCode: code }, order: { recordStatus: 'ASC', code: 'ASC' } }),
            this.applicationRepo.find({ where: { areaId, producerCode: code }, order: { submittedAt: 'DESC' } }),
            this.lineageRepo.find({ where: { areaId } }),
            this.producerRepo.find({ where: { areaId, code }, order: { season: 'ASC' } }),
        ]);
        const effective = await this.effectiveStatuses(area.code, applications);
        const lineageByCode = new Map(lineage.map((l) => [l.code, l]));
        const gardenCodes = new Set(gardens.map((g) => g.code));
        const names = new Map([[code, row.name]]);
        return {
            ...row,
            licenses: licenses.map((l) => this.licenseView(l, gardens, lineageByCode)),
            gardens: gardens.map((g) => this.gardenView(g)),
            applications: applications.map((a) => this.applicationRow(a, effective.get(a.code) ?? a.status, names, gardens)),
            conflicts: (area.licensing?.conflicts ?? []).filter((c) => c.gardenCodes.some((gc) => gardenCodes.has(gc))),
            pruningHistory: seasons.map((s) => ({
                season: s.season,
                status: s.autoStatus,
                licensedAreaM2: s.licensedAreaM2,
                requiredM2: s.requiredM2,
                newPrunedM2: s.newPrunedM2,
            })),
        };
    }

    async applications(areaId: string, query: ApplicationQueryDto): Promise<Paginated<ApplicationRow>> {
        const area = await this.findArea(areaId);
        const [applications, producers, gardens] = await Promise.all([
            this.applicationRepo.find({ where: { areaId }, order: { submittedAt: 'DESC', code: 'ASC' } }),
            this.producerIdentities(areaId),
            this.gardenRepo.find({ where: { areaId }, select: ['code', 'block', 'parcel'] }),
        ]);
        const effective = await this.effectiveStatuses(area.code, applications);
        const names = new Map(producers.map((p) => [p.code, p.name]));
        const search = query.search?.trim().toLocaleLowerCase('tr-TR');
        const rows = applications
            .map((a) => this.applicationRow(a, effective.get(a.code) ?? a.status, names, gardens))
            .filter((r) => {
                if (query.status && r.status !== query.status) return false;
                if (query.type && r.type !== query.type) return false;
                if (query.open === 'true' && !r.open) return false;
                if (query.open === 'false' && r.open) return false;
                if (search) {
                    const haystack = [r.code, r.producerName, r.producerCode, r.licenseCode ?? '', r.gardenCode ?? '', r.parcelRef ?? '', r.summary].join(' ').toLocaleLowerCase('tr-TR');
                    if (!haystack.includes(search)) return false;
                }
                return true;
            });
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        return paginate(rows.slice((page - 1) * limit, page * limit), rows.length, page, limit);
    }

    async application(areaId: string, code: string): Promise<ApplicationDetail> {
        const area = await this.findArea(areaId);
        const application = await this.applicationRepo.findOne({ where: { areaId, code } });
        if (!application) throw new NotFoundException('Application not found');
        const [decisions, producers, garden, license, lineage] = await Promise.all([
            this.decisionRepo.find({ where: { areaCode: area.code, applicationCode: code }, order: { createdAt: 'ASC' } }),
            this.producerIdentities(areaId),
            application.gardenCode ? this.gardenRepo.findOne({ where: { areaId, code: application.gardenCode } }) : Promise.resolve(null),
            application.licenseCode ? this.licenseRepo.findOne({ where: { areaId, code: application.licenseCode } }) : Promise.resolve(null),
            this.lineageRepo.find({ where: { areaId } }),
        ]);
        const names = new Map(producers.map((p) => [p.code, p.name]));
        const status = decisions.at(-1)?.toStatus ?? application.status;
        const licenseGardens = license ? await this.gardenRepo.find({ where: { areaId, licenseCode: license.code } }) : [];
        return {
            ...this.applicationRow(application, status, names, garden ? [garden] : []),
            documents: application.documents,
            history: application.history,
            decisions: decisions.map((d) => ({
                fromStatus: d.fromStatus,
                toStatus: d.toStatus,
                note: d.note,
                decidedByName: d.decidedByName,
                decidedAt: d.createdAt.toISOString(),
            })),
            garden: garden ? this.gardenView(garden) : null,
            license: license ? this.licenseView(license, licenseGardens, new Map(lineage.map((l) => [l.code, l]))) : null,
            payload: application.payload ?? null,
            effects: application.effects ?? null,
        };
    }

    /** A site-created file (subdivision, split, transfer, correction, boundary) with a validated payload. */
    async createApplication(areaId: string, dto: CreateApplicationDto, userId: string): Promise<ApplicationDetail> {
        const saved = await this.operations.create(areaId, dto, userId);
        return this.application(areaId, saved.code);
    }

    async decide(areaId: string, code: string, dto: ApplicationDecisionDto, userId: string): Promise<ApplicationDetail> {
        const current = await this.application(areaId, code);
        if (!current.allowedTransitions.includes(dto.status)) {
            throw new BadRequestException(`Transition ${current.status} → ${dto.status} is not allowed`);
        }
        if (NOTE_REQUIRED.includes(dto.status) && !dto.note?.trim()) {
            throw new BadRequestException('This step needs a written reason');
        }
        const area = await this.findArea(areaId);
        const user = await this.userRepo.findOne({ where: { id: userId } });
        const by = user?.fullName ?? 'Bilinmeyen kullanıcı';
        await this.dataSource.transaction(async (manager) => {
            await manager.save(
                manager.create(LicensingDecision, {
                    areaCode: area.code,
                    applicationCode: code,
                    fromStatus: current.status,
                    toStatus: dto.status,
                    note: dto.note?.trim() || null,
                    decidedById: userId,
                    decidedByName: by,
                }),
            );
            // Approval of a site-created file changes the register (pieces, new licences, holders…), once.
            if (dto.status === 'DEMO_APPROVED') {
                const app = await manager.findOne(LicensingApplication, { where: { areaId, code } });
                if (app?.payload && !app.appliedAt) {
                    const effects = await this.operations.apply(manager, area, app, by);
                    app.appliedAt = new Date();
                    app.effects = effects;
                    app.history = [...app.history, { at: new Date().toISOString().slice(0, 10), from: current.status, to: 'DEMO_APPROVED', by, note: 'Onaylandı ve sicile işlendi' }];
                    await manager.save(app);
                }
            }
        });
        return this.application(areaId, code);
    }

    /** Map layers: licensed gardens (by status), proposals, conflicts and the unlicensed-tea difference. */
    async layers(areaId: string): Promise<LicensingLayers> {
        const area = await this.findArea(areaId);
        const [gardens, producers] = await Promise.all([this.gardenRepo.find({ where: { areaId, recordStatus: 'active' } }), this.producerIdentities(areaId)]);
        const names = new Map(producers.map((p) => [p.code, p.name]));
        const fc = (features: FeatureCollection['features']): FeatureCollection => ({ type: 'FeatureCollection', features });
        return {
            gardens: fc(
                gardens.map((g) => ({
                    type: 'Feature',
                    geometry: g.geometry,
                    properties: {
                        code: g.code,
                        producerCode: g.producerCode,
                        producerName: names.get(g.producerCode) ?? '',
                        parcelKey: g.parcelKey,
                        block: g.block,
                        parcel: g.parcel,
                        licenseCode: g.licenseCode,
                        approvalStatus: g.approvalStatus,
                        licensedAreaM2: g.licensedAreaM2,
                        planimetricAreaM2: g.planimetricAreaM2,
                        surfaceAreaM2: g.surfaceAreaM2,
                        measuredTeaAreaM2: g.measuredTeaAreaM2,
                        discrepancies: g.discrepancies,
                    },
                })),
            ),
            proposals: fc(
                gardens
                    .filter((g) => g.proposal)
                    .map((g) => ({
                        type: 'Feature',
                        geometry: (g.proposal as GardenBoundaryProposal).geometry,
                        properties: {
                            gardenCode: g.code,
                            producerCode: g.producerCode,
                            producerName: names.get(g.producerCode) ?? '',
                            block: g.block,
                            parcel: g.parcel,
                            planimetricAreaM2: (g.proposal as GardenBoundaryProposal).planimetricAreaM2,
                            proposedBy: (g.proposal as GardenBoundaryProposal).proposedBy,
                            proposedAt: (g.proposal as GardenBoundaryProposal).proposedAt,
                            overlapM2: (g.proposal as GardenBoundaryProposal).overlapM2,
                            overlapsGardenCode: (g.proposal as GardenBoundaryProposal).overlapsGardenCode,
                        },
                    })),
            ),
            conflicts: fc(
                (area.licensing?.conflicts ?? []).map((c) => ({
                    type: 'Feature',
                    geometry: c.geometry,
                    properties: { code: c.code, parcelKey: c.parcelKey, gardenCodes: c.gardenCodes, overlapM2: c.overlapM2, status: c.status, openedAt: c.openedAt },
                })),
            ),
            unlicensedTea: fc((area.licensing?.unlicensedTea ?? []).map((u: TeaPatch) => ({ type: 'Feature', geometry: u.geometry, properties: { areaM2: u.areaM2 } }))),
        };
    }

    // ── helpers ──

    private async findArea(id: string): Promise<TeaInventoryArea> {
        const area = await this.areaRepo.findOne({ where: { id } });
        if (!area) throw new NotFoundException('Inventory area not found');
        return area;
    }

    /** One identity per producer code (the producer table holds one row per scanned season). */
    private async producerIdentities(areaId: string): Promise<ProducerIdentity[]> {
        const rows = await this.producerRepo
            .createQueryBuilder('p')
            .select(['p.code AS code', 'p.name AS name', 'p.wallet_no AS "walletNo"'])
            .distinctOn(['p.code'])
            .where('p.area_id = :areaId', { areaId })
            .orderBy('p.code', 'ASC')
            .getRawMany<ProducerIdentity>();
        return rows;
    }

    /** Latest effective status per application code (seeded status unless a decision was taken). */
    private async effectiveStatuses(areaCode: string, applications: LicensingApplication[]): Promise<Map<string, ApplicationStatus>> {
        const decisions = await this.decisionRepo.find({ where: { areaCode }, order: { createdAt: 'ASC' } });
        const out = new Map<string, ApplicationStatus>(applications.map((a) => [a.code, a.status]));
        for (const d of decisions) {
            if (out.has(d.applicationCode)) out.set(d.applicationCode, d.toStatus);
        }
        return out;
    }

    private async producerRows(areaId: string): Promise<LicensingProducerRow[]> {
        const area = await this.findArea(areaId);
        const [producers, licenses, gardens, applications, latestSeasons] = await Promise.all([
            this.producerIdentities(areaId),
            this.licenseRepo.find({ where: { areaId } }),
            this.gardenRepo.find({
                where: { areaId, recordStatus: 'active' },
                select: ['code', 'producerCode', 'approvalStatus', 'licensedAreaM2', 'planimetricAreaM2', 'surfaceAreaM2', 'measuredTeaAreaM2', 'discrepancies'],
            }),
            this.applicationRepo.find({ where: { areaId }, select: ['code', 'producerCode', 'status'] }),
            this.producerRepo
                .createQueryBuilder('p')
                .select(['p.code AS code', 'p.season AS season', 'p.auto_status AS status'])
                .distinctOn(['p.code'])
                .where('p.area_id = :areaId', { areaId })
                .orderBy('p.code', 'ASC')
                .addOrderBy('p.season', 'DESC')
                .getRawMany<{ code: string; season: string; status: ProducerAutoStatus }>(),
        ]);
        const effective = await this.effectiveStatuses(area.code, applications);
        const licensesBy = new Map<string, TeaInventoryLicense[]>();
        for (const l of licenses) licensesBy.set(l.producerCode, [...(licensesBy.get(l.producerCode) ?? []), l]);
        const gardensBy = new Map<string, TeaInventoryGarden[]>();
        for (const g of gardens) gardensBy.set(g.producerCode, [...(gardensBy.get(g.producerCode) ?? []), g]);
        const openBy = new Map<string, number>();
        for (const a of applications) {
            if (!CLOSED_STATUSES.includes(effective.get(a.code) ?? a.status)) openBy.set(a.producerCode, (openBy.get(a.producerCode) ?? 0) + 1);
        }
        const pruningBy = new Map(latestSeasons.map((s) => [s.code, s]));

        return producers.map((p) => {
            const own = licensesBy.get(p.code) ?? [];
            const mine = gardensBy.get(p.code) ?? [];
            const discrepancies = [...new Set(mine.flatMap((g) => g.discrepancies))];
            const approvalStatus = mine.map((g) => g.approvalStatus).sort((a, b) => APPROVAL_RANK[b] - APPROVAL_RANK[a])[0] ?? 'approved';
            const matchLevel = own.map((l) => l.matchLevel).sort((a, b) => MATCH_RANK[b] - MATCH_RANK[a])[0] ?? null;
            const openApplications = openBy.get(p.code) ?? 0;
            const pruning = pruningBy.get(p.code);
            return {
                code: p.code,
                name: p.name,
                walletNo: p.walletNo,
                licenseCodes: own.map((l) => l.code),
                licenseCount: own.length,
                holderDeceased: own.some((l) => l.holderDeceased),
                gardenCount: mine.length,
                approvedGardens: mine.filter((g) => g.approvalStatus === 'approved').length,
                matchLevel,
                approvalStatus,
                licensedAreaM2: Math.round(mine.reduce((s, g) => s + (g.licensedAreaM2 ?? 0), 0)),
                planimetricAreaM2: Math.round(mine.reduce((s, g) => s + g.planimetricAreaM2, 0)),
                surfaceAreaM2: Math.round(mine.reduce((s, g) => s + g.surfaceAreaM2, 0)),
                measuredTeaAreaM2: Math.round(mine.reduce((s, g) => s + g.measuredTeaAreaM2, 0)),
                discrepancies,
                openApplications,
                issueCount: discrepancies.length + mine.filter((g) => g.approvalStatus !== 'approved').length + openApplications,
                pruningStatus: pruning?.status ?? null,
                pruningSeason: pruning?.season ?? null,
            };
        });
    }

    /** Searchable garden tokens per producer: codes and "ada/parsel". */
    private async gardenSearchIndex(areaId: string): Promise<Map<string, string[]>> {
        const gardens = await this.gardenRepo.find({ where: { areaId, recordStatus: 'active' }, select: ['code', 'producerCode', 'block', 'parcel'] });
        const out = new Map<string, string[]>();
        for (const g of gardens) out.set(g.producerCode, [...(out.get(g.producerCode) ?? []), g.code, `${g.block}/${g.parcel}`, `ada ${g.block} parsel ${g.parcel}`]);
        return out;
    }

    private licenseView(l: TeaInventoryLicense, gardens: TeaInventoryGarden[], lineageByCode: Map<string, ParcelLineage>): LicenseView {
        return {
            code: l.code,
            producerCode: l.producerCode,
            walletNo: l.walletNo,
            status: l.status,
            issuedYear: l.issuedYear,
            recordedAreaM2: l.recordedAreaM2,
            allocatedAreaM2: Math.round(gardens.filter((g) => g.licenseCode === l.code).reduce((s, g) => s + (g.licensedAreaM2 ?? 0), 0)),
            recordedParcelRefs: l.recordedParcelRefs,
            matchLevel: l.matchLevel,
            matchedParcelKeys: l.matchedParcelKeys,
            lineage: l.lineageCodes
                .map((c) => lineageByCode.get(c))
                .filter((x): x is ParcelLineage => !!x)
                .map((x) => ({ code: x.code, oldRef: x.oldRef, newParcelKey: x.newParcelKey, changeType: x.changeType, source: x.source, changedAt: x.changedAt })),
            candidateParcelKeys: l.candidateParcelKeys,
            holderDeceased: l.holderDeceased,
            validFrom: l.validFrom,
            validTo: l.validTo,
            gardenCodes: l.gardenCodes,
            parentCode: l.parentCode ?? null,
            childCodes: l.childCodes ?? [],
            history: l.history ?? [],
            source: l.source ?? 'engine',
        };
    }

    private gardenView(g: TeaInventoryGarden): LicensedGardenView {
        return {
            id: g.id,
            code: g.code,
            producerCode: g.producerCode,
            parcelKey: g.parcelKey,
            block: g.block,
            parcel: g.parcel,
            holderIndex: g.holderIndex,
            holderCount: g.holderCount,
            boundaryResolved: g.boundaryResolved,
            licenseCode: g.licenseCode,
            approvalStatus: g.approvalStatus,
            licensedAreaM2: g.licensedAreaM2,
            planimetricAreaM2: g.planimetricAreaM2,
            surfaceAreaM2: g.surfaceAreaM2,
            meanSlopeDeg: g.meanSlopeDeg,
            measuredTeaAreaM2: g.measuredTeaAreaM2,
            discrepancies: g.discrepancies,
            versions: g.versions,
            proposal: g.proposal,
            geometry: g.geometry,
            recordStatus: g.recordStatus ?? 'active',
            supersededBy: g.supersededBy ?? [],
            parentCode: g.parentCode ?? null,
            events: g.events ?? [],
            source: g.source ?? 'engine',
            locality: g.locality,
        };
    }

    private applicationRow(a: LicensingApplication, status: ApplicationStatus, names: Map<string, string>, gardens: Array<Pick<TeaInventoryGarden, 'code' | 'block' | 'parcel'>>): ApplicationRow {
        const garden = a.gardenCode ? gardens.find((g) => g.code === a.gardenCode) : null;
        const lastHistory = a.history.at(-1)?.at ?? a.submittedAt;
        return {
            id: a.id,
            code: a.code,
            producerCode: a.producerCode,
            producerName: names.get(a.producerCode) ?? '',
            licenseCode: a.licenseCode,
            gardenCode: a.gardenCode,
            parcelRef: garden ? `${garden.block}/${garden.parcel}` : null,
            type: a.type,
            seededStatus: a.status,
            status,
            open: !CLOSED_STATUSES.includes(status),
            submittedAt: a.submittedAt,
            summary: a.summary,
            missingDocuments: a.documents.filter((d) => d.status === 'missing').length,
            lastActivityAt: lastHistory,
            allowedTransitions: ALLOWED_TRANSITIONS[status],
            source: a.source ?? 'engine',
            hasPayload: !!a.payload,
            appliedAt: a.appliedAt ? new Date(a.appliedAt).toISOString() : null,
            createdByName: a.createdByName ?? null,
        };
    }
}
