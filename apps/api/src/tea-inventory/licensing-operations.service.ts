import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { area as turfArea, booleanValid, feature, featureCollection, intersect, kinks, union } from '@turf/turf';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { BoundaryConflict, TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryParcel } from '@/tea-inventory/entities/tea-inventory-parcel.entity';
import { TeaInventoryProducer } from '@/tea-inventory/entities/tea-inventory-producer.entity';
import { GardenDiscrepancy, GardenGeometryVersion, TeaInventoryGarden } from '@/tea-inventory/entities/tea-inventory-garden.entity';
import { TeaInventoryLicense } from '@/tea-inventory/entities/tea-inventory-license.entity';
import { ApplicationDocument, ApplicationStatus, ApplicationType, LicensingApplication } from '@/tea-inventory/entities/licensing-application.entity';
import { User } from '@/users/entities/user.entity';
import {
    AreaCorrectionPayloadDto, BoundaryPayloadDto, CreateApplicationDto, HolderDto, LicenseSplitPayloadDto, PreviewOperationDto, SubdivisionPayloadDto, TransferPayloadDto,
} from '@/tea-inventory/dto';

type Poly = Polygon | MultiPolygon;

export interface PieceComputation {
    label: string;
    holder: HolderDto;
    holderName: string;
    planimetricAreaM2: number;
    surfaceAreaM2: number;
    measuredTeaAreaM2: number;
    licensedAreaM2: number | null;
    insideParentShare: number;
    siblingOverlapM2: number;
    overlapsGardenCodes: string[];
    pieceOverlapM2: number;
    warnings: string[];
}

export interface SubdivisionPreview {
    type: 'garden_subdivision';
    gardenCode: string;
    parent: { code: string; planimetricAreaM2: number; licensedAreaM2: number | null; measuredTeaAreaM2: number; licenseCode: string | null; producerCode: string };
    pieces: PieceComputation[];
    coveredShare: number;
    uncoveredM2: number;
    licensedTotalM2: number | null;
    warnings: string[];
    errors: string[];
    ok: boolean;
}

export interface SplitPartComputation {
    label: string;
    holder: HolderDto;
    holderName: string;
    gardenCodes: string[];
    gardensLicensedM2: number;
    recordedAreaM2: number;
    keepsOriginal: boolean;
}

export interface SplitPreview {
    type: 'license_split';
    licenseCode: string;
    license: { code: string; producerCode: string; recordedAreaM2: number; gardenCodes: string[]; status: string };
    parts: SplitPartComputation[];
    unassignedGardenCodes: string[];
    warnings: string[];
    errors: string[];
    ok: boolean;
}

export interface BoundaryPreview {
    type: 'boundary_determination';
    gardenCode: string;
    before: { planimetricAreaM2: number; surfaceAreaM2: number; measuredTeaAreaM2: number };
    after: { planimetricAreaM2: number; surfaceAreaM2: number; measuredTeaAreaM2: number };
    outsideParcelM2: number;
    siblingOverlapM2: number;
    overlapsGardenCodes: string[];
    discrepancies: GardenDiscrepancy[];
    warnings: string[];
    errors: string[];
    ok: boolean;
}

export type OperationPreview = SubdivisionPreview | SplitPreview | BoundaryPreview;

export interface GardenEditorContext {
    garden: { code: string; producerCode: string; producerName: string; parcelKey: string; block: string; parcel: string; locality: string; licenseCode: string | null; licensedAreaM2: number | null; planimetricAreaM2: number; surfaceAreaM2: number; measuredTeaAreaM2: number; meanSlopeDeg: number; approvalStatus: string; geometry: Record<string, unknown> };
    parcel: { geometry: Record<string, unknown>; nature: string; deedAreaM2: number | null } | null;
    siblings: Array<{ code: string; producerCode: string; producerName: string; approvalStatus: string; licenseCode: string | null; geometry: Record<string, unknown> }>;
    teaPatches: Array<{ areaM2: number; geometry: Record<string, unknown> }>;
    license: { code: string; recordedAreaM2: number; gardenCodes: string[]; producerCode: string; status: string } | null;
    rules: { areaTolerance: number; minLicenseM2: number; overlapToleranceM2: number };
}

const DEFAULT_RULES = { areaTolerance: 0.15, minLicenseM2: 100, overlapToleranceM2: 25 };
/** Smallest piece / boundary worth a record of its own (a licence minimum is a different, larger rule). */
const MIN_PIECE_M2 = 100;
const CAUSE_LABEL: Record<string, string> = { inheritance: 'intikal (vefat)', sale: 'satış / devir', parcel_split: 'parsel ifrazı', family: 'aile içi paylaşım', other: 'diğer' };
const DOC_NAME: Record<string, string> = {
    tapu: 'Tapu kaydı / tapu senedi',
    kroki: 'Kroki (ortofoto çizimi)',
    rtk_olcum: 'RTK-GNSS ölçüm raporu',
    muvafakat: 'Hissedar / komşu muvafakatnamesi',
    kimlik: 'Kimlik fotokopisi',
    veraset: 'Veraset ilamı / mirasçılık belgesi',
    satis_sozlesmesi: 'Satış / devir sözleşmesi',
    dilekce: 'Başvuru dilekçesi',
    olcum_raporu: 'Eksper ölçüm raporu',
    cuzdan: 'ÇAYKUR cüzdanı',
};

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

/**
 * Register operations on top of the imported demo (or, later, ÇAYKUR) register: garden
 * subdivision into pieces, licence split among holders, transfer, area correction and
 * boundary determination. Each is a licensing file with a structured payload: validated and
 * previewed on creation, applied to licences / gardens / producers when the file is approved.
 * Everything written here is marked `source = 'site'`, which the seed preserves on re-import.
 */
@Injectable()
export class LicensingOperationsService {
    constructor(
        @InjectRepository(TeaInventoryArea) private readonly areaRepo: Repository<TeaInventoryArea>,
        @InjectRepository(TeaInventoryParcel) private readonly parcelRepo: Repository<TeaInventoryParcel>,
        @InjectRepository(TeaInventoryGarden) private readonly gardenRepo: Repository<TeaInventoryGarden>,
        @InjectRepository(TeaInventoryLicense) private readonly licenseRepo: Repository<TeaInventoryLicense>,
        @InjectRepository(LicensingApplication) private readonly applicationRepo: Repository<LicensingApplication>,
        @InjectRepository(TeaInventoryProducer) private readonly producerRepo: Repository<TeaInventoryProducer>,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
    ) { }

    // ── editor context ──

    async gardenContext(areaId: string, code: string): Promise<GardenEditorContext> {
        const area = await this.findArea(areaId);
        const garden = await this.gardenRepo.findOne({ where: { areaId, code } });
        if (!garden) throw new NotFoundException('Garden not found');
        const [parcel, siblings, names, license] = await Promise.all([
            this.parcelRepo.findOne({ where: { areaId, parcelKey: garden.parcelKey } }),
            this.gardenRepo.find({ where: { areaId, parcelKey: garden.parcelKey, recordStatus: 'active' } }),
            this.producerNames(areaId),
            garden.licenseCode ? this.licenseRepo.findOne({ where: { areaId, code: garden.licenseCode } }) : Promise.resolve(null),
        ]);
        const parcelGeom = parcel ? this.asPoly(parcel.geometry) : this.asPoly(garden.geometry);
        const patches = (area.teaPatches ?? []).filter((t) => this.safeIntersectArea(this.asPoly(t.geometry), parcelGeom) > 0);
        return {
            garden: {
                code: garden.code, producerCode: garden.producerCode, producerName: names.get(garden.producerCode) ?? '', parcelKey: garden.parcelKey, block: garden.block, parcel: garden.parcel,
                locality: garden.locality, licenseCode: garden.licenseCode, licensedAreaM2: garden.licensedAreaM2, planimetricAreaM2: garden.planimetricAreaM2, surfaceAreaM2: garden.surfaceAreaM2,
                measuredTeaAreaM2: garden.measuredTeaAreaM2, meanSlopeDeg: garden.meanSlopeDeg, approvalStatus: garden.approvalStatus, geometry: garden.geometry,
            },
            parcel: parcel ? { geometry: parcel.geometry, nature: parcel.nature, deedAreaM2: parcel.deedAreaM2 } : null,
            siblings: siblings.filter((s) => s.code !== garden.code).map((s) => ({ code: s.code, producerCode: s.producerCode, producerName: names.get(s.producerCode) ?? '', approvalStatus: s.approvalStatus, licenseCode: s.licenseCode, geometry: s.geometry })),
            teaPatches: patches,
            license: license ? { code: license.code, recordedAreaM2: license.recordedAreaM2, gardenCodes: license.gardenCodes, producerCode: license.producerCode, status: license.status } : null,
            rules: this.rules(area),
        };
    }

    // ── previews ──

    async preview(areaId: string, dto: PreviewOperationDto): Promise<OperationPreview> {
        const area = await this.findArea(areaId);
        if (dto.type === 'garden_subdivision') return this.previewSubdivision(area, this.parse(SubdivisionPayloadDto, dto.payload));
        if (dto.type === 'license_split') return this.previewSplit(area, this.parse(LicenseSplitPayloadDto, dto.payload));
        return this.previewBoundary(area, this.parse(BoundaryPayloadDto, dto.payload));
    }

    private async previewSubdivision(area: TeaInventoryArea, p: SubdivisionPayloadDto): Promise<SubdivisionPreview> {
        const rules = this.rules(area);
        const parent = await this.gardenRepo.findOne({ where: { areaId: area.id, code: p.gardenCode } });
        if (!parent) throw new NotFoundException('Garden not found');
        const errors: string[] = [];
        const warnings: string[] = [];
        if (parent.recordStatus !== 'active') errors.push('Bu bahçe kaydı daha önce bölünmüş (geçersiz).');
        const parentGeom = this.asPoly(parent.geometry);
        const siblings = (await this.gardenRepo.find({ where: { areaId: area.id, parcelKey: parent.parcelKey, recordStatus: 'active' } })).filter((s) => s.code !== parent.code);
        const names = await this.producerNames(area.id);
        const slopeFactor = this.slopeFactor(parent);
        const geoms: Poly[] = [];
        const pieces: PieceComputation[] = [];
        for (const piece of p.pieces) {
            const g = this.asPoly(piece.geometry);
            const w = this.geometryWarnings(g);
            const planimetric = this.m2(g);
            const inside = planimetric > 0 ? this.safeIntersectArea(g, parentGeom) / planimetric : 0;
            if (planimetric < MIN_PIECE_M2) w.push(`Parça ${MIN_PIECE_M2} m²'den küçük (${Math.round(planimetric)} m²).`);
            if (inside < 0.97) w.push(`Parçanın %${Math.round((1 - inside) * 100)}'i bahçe sınırının dışında.`);
            const overlaps = siblings.map((s) => ({ code: s.code, m2: this.safeIntersectArea(g, this.asPoly(s.geometry)) })).filter((o) => o.m2 > rules.overlapToleranceM2);
            if (overlaps.length) w.push(`Komşu bahçeyle çakışma: ${overlaps.map((o) => `${o.code} ${Math.round(o.m2)} m²`).join(', ')}.`);
            const holderName = await this.holderName(area.id, piece.holder, names);
            if (!holderName) errors.push(`"${piece.label}" parçasının sahibi belirsiz (müstahsil kodu ya da ad gerekli).`);
            geoms.push(g);
            pieces.push({
                label: piece.label, holder: piece.holder, holderName: holderName ?? '', planimetricAreaM2: Math.round(planimetric), surfaceAreaM2: Math.round(planimetric * slopeFactor),
                measuredTeaAreaM2: Math.round(this.teaArea(area, g)), licensedAreaM2: null, insideParentShare: Math.round(inside * 1000) / 1000,
                siblingOverlapM2: Math.round(overlaps.reduce((t, o) => t + o.m2, 0)), overlapsGardenCodes: overlaps.map((o) => o.code), pieceOverlapM2: 0, warnings: w,
            });
        }
        for (let i = 0; i < geoms.length; i++) {
            for (let j = i + 1; j < geoms.length; j++) {
                const o = this.safeIntersectArea(geoms[i]!, geoms[j]!);
                if (o > rules.overlapToleranceM2) {
                    pieces[i]!.pieceOverlapM2 += o;
                    pieces[j]!.pieceOverlapM2 += o;
                    errors.push(`"${pieces[i]!.label}" ile "${pieces[j]!.label}" parçaları ${Math.round(o)} m² çakışıyor.`);
                }
            }
        }
        const unionGeom = this.unionAll(geoms);
        const covered = unionGeom ? this.safeIntersectArea(unionGeom, parentGeom) : 0;
        const coveredShare = parent.planimetricAreaM2 > 0 ? covered / parent.planimetricAreaM2 : 0;
        const uncoveredM2 = Math.max(0, Math.round(parent.planimetricAreaM2 - covered));
        if (coveredShare < 0.95) warnings.push(`Parçalar bahçenin %${Math.round(coveredShare * 100)}'ini kapsıyor; ${uncoveredM2} m² hiçbir parçada değil.`);
        // Licensed share: given or pro-rata by map area, the last piece takes the rounding remainder.
        let licensedTotal: number | null = null;
        if (parent.licensedAreaM2 != null) {
            const given = p.pieces.map((x) => x.licensedAreaM2);
            const sumPlan = pieces.reduce((t, x) => t + x.planimetricAreaM2, 0) || 1;
            let remaining = Math.round(parent.licensedAreaM2);
            pieces.forEach((x, i) => {
                const v = given[i] != null ? Math.round(given[i] as number) : i === pieces.length - 1 ? remaining : Math.round((parent.licensedAreaM2 as number) * (x.planimetricAreaM2 / sumPlan));
                x.licensedAreaM2 = Math.max(0, v);
                remaining -= x.licensedAreaM2;
            });
            licensedTotal = pieces.reduce((t, x) => t + (x.licensedAreaM2 ?? 0), 0);
            if (Math.abs(licensedTotal - parent.licensedAreaM2) > Math.max(5, parent.licensedAreaM2 * 0.01)) {
                errors.push(`Parçalara dağıtılan ruhsat alanı (${licensedTotal} m²) bahçenin ruhsat alanından (${Math.round(parent.licensedAreaM2)} m²) farklı.`);
            }
        }
        const labels = new Set(pieces.map((x) => x.label.trim()));
        if (labels.size !== pieces.length) errors.push('Parça etiketleri birbirinden farklı olmalı.');
        return {
            type: 'garden_subdivision', gardenCode: parent.code,
            parent: { code: parent.code, planimetricAreaM2: Math.round(parent.planimetricAreaM2), licensedAreaM2: parent.licensedAreaM2, measuredTeaAreaM2: Math.round(parent.measuredTeaAreaM2), licenseCode: parent.licenseCode, producerCode: parent.producerCode },
            pieces, coveredShare: Math.round(coveredShare * 1000) / 1000, uncoveredM2, licensedTotalM2: licensedTotal, warnings, errors, ok: errors.length === 0,
        };
    }

    private async previewSplit(area: TeaInventoryArea, p: LicenseSplitPayloadDto): Promise<SplitPreview> {
        const license = await this.licenseRepo.findOne({ where: { areaId: area.id, code: p.licenseCode } });
        if (!license) throw new NotFoundException('Licence not found');
        const errors: string[] = [];
        const warnings: string[] = [];
        if (license.status !== 'active' && license.status !== 'transfer_pending') errors.push(`Ruhsat ${license.status} durumunda; ayrılamaz.`);
        const gardens = await this.gardenRepo.find({ where: { areaId: area.id, licenseCode: license.code, recordStatus: 'active' } });
        const byCode = new Map(gardens.map((g) => [g.code, g]));
        const names = await this.producerNames(area.id);
        const seen = new Map<string, string>();
        const parts: SplitPartComputation[] = [];
        const totalLicensed = gardens.reduce((t, g) => t + (g.licensedAreaM2 ?? 0), 0) || 1;
        for (const part of p.parts) {
            for (const c of part.gardenCodes) {
                if (!byCode.has(c)) errors.push(`${c} bu ruhsatın bahçesi değil.`);
                if (seen.has(c)) errors.push(`${c} birden çok parçada: "${seen.get(c)}" ve "${part.label}".`);
                seen.set(c, part.label);
            }
            const holderName = await this.holderName(area.id, part.holder, names);
            if (!holderName) errors.push(`"${part.label}" parçasının sahibi belirsiz.`);
            const gardensLicensed = part.gardenCodes.reduce((t, c) => t + (byCode.get(c)?.licensedAreaM2 ?? 0), 0);
            parts.push({
                label: part.label, holder: part.holder, holderName: holderName ?? '', gardenCodes: part.gardenCodes, gardensLicensedM2: Math.round(gardensLicensed),
                recordedAreaM2: part.recordedAreaM2 != null ? Math.round(part.recordedAreaM2) : Math.round(license.recordedAreaM2 * (gardensLicensed / totalLicensed)),
                keepsOriginal: !!part.holder.producerCode && part.holder.producerCode === license.producerCode,
            });
        }
        const unassigned = gardens.map((g) => g.code).filter((c) => !seen.has(c));
        if (unassigned.length) errors.push(`Ruhsatın her bahçesi bir parçada olmalı; atanmamış: ${unassigned.join(', ')}.`);
        const sum = parts.reduce((t, x) => t + x.recordedAreaM2, 0);
        if (sum > license.recordedAreaM2 * 1.02 + 5) errors.push(`Parçaların toplamı (${sum} m²) ruhsatta yazan alanı (${Math.round(license.recordedAreaM2)} m²) aşıyor.`);
        if (sum < license.recordedAreaM2 * 0.9) warnings.push(`Parçaların toplamı (${sum} m²) ruhsatta yazan alanın (${Math.round(license.recordedAreaM2)} m²) altında; fark kayıt dışı kalır.`);
        if (parts.filter((x) => x.keepsOriginal).length > 1) errors.push('Ruhsatın asıl sahibi yalnızca bir parçada kalabilir.');
        const labels = new Set(parts.map((x) => x.label.trim()));
        if (labels.size !== parts.length) errors.push('Parça etiketleri birbirinden farklı olmalı.');
        return {
            type: 'license_split', licenseCode: license.code,
            license: { code: license.code, producerCode: license.producerCode, recordedAreaM2: Math.round(license.recordedAreaM2), gardenCodes: gardens.map((g) => g.code), status: license.status },
            parts, unassignedGardenCodes: unassigned, warnings, errors, ok: errors.length === 0,
        };
    }

    private async previewBoundary(area: TeaInventoryArea, p: BoundaryPayloadDto): Promise<BoundaryPreview> {
        const rules = this.rules(area);
        const garden = await this.gardenRepo.findOne({ where: { areaId: area.id, code: p.gardenCode } });
        if (!garden) throw new NotFoundException('Garden not found');
        const errors: string[] = [];
        if (garden.recordStatus !== 'active') errors.push('Bu bahçe kaydı geçersiz (bölünmüş).');
        const g = this.asPoly(p.geometry);
        const warnings = this.geometryWarnings(g);
        const planimetric = this.m2(g);
        if (planimetric < MIN_PIECE_M2) errors.push(`Yeni sınır ${MIN_PIECE_M2} m²'den küçük.`);
        const parcel = await this.parcelRepo.findOne({ where: { areaId: area.id, parcelKey: garden.parcelKey } });
        const outside = parcel ? Math.max(0, planimetric - this.safeIntersectArea(g, this.asPoly(parcel.geometry))) : 0;
        if (outside > Math.max(rules.overlapToleranceM2, planimetric * 0.03)) warnings.push(`Yeni sınırın ${Math.round(outside)} m²'si parsel dışında.`);
        const siblings = (await this.gardenRepo.find({ where: { areaId: area.id, parcelKey: garden.parcelKey, recordStatus: 'active' } })).filter((s) => s.code !== garden.code);
        const overlaps = siblings.map((s) => ({ code: s.code, m2: this.safeIntersectArea(g, this.asPoly(s.geometry)) })).filter((o) => o.m2 > rules.overlapToleranceM2);
        if (overlaps.length) warnings.push(`Komşu bahçeyle çakışma: ${overlaps.map((o) => `${o.code} ${Math.round(o.m2)} m²`).join(', ')} — onayda sınır ihtilafı açılır.`);
        const tea = this.teaArea(area, g);
        const license = garden.licenseCode ? await this.licenseRepo.findOne({ where: { areaId: area.id, code: garden.licenseCode } }) : null;
        const discrepancies = this.discrepanciesFor(garden.licensedAreaM2, tea, license, rules, overlaps.length > 0, outside > Math.max(rules.overlapToleranceM2, planimetric * 0.03));
        return {
            type: 'boundary_determination', gardenCode: garden.code,
            before: { planimetricAreaM2: Math.round(garden.planimetricAreaM2), surfaceAreaM2: Math.round(garden.surfaceAreaM2), measuredTeaAreaM2: Math.round(garden.measuredTeaAreaM2) },
            after: { planimetricAreaM2: Math.round(planimetric), surfaceAreaM2: Math.round(planimetric * this.slopeFactor(garden)), measuredTeaAreaM2: Math.round(tea) },
            outsideParcelM2: Math.round(outside), siblingOverlapM2: Math.round(overlaps.reduce((t, o) => t + o.m2, 0)), overlapsGardenCodes: overlaps.map((o) => o.code),
            discrepancies, warnings, errors, ok: errors.length === 0,
        };
    }

    // ── create a file ──

    async create(areaId: string, dto: CreateApplicationDto, userId: string): Promise<LicensingApplication> {
        const area = await this.findArea(areaId);
        const user = await this.userRepo.findOne({ where: { id: userId } });
        const by = user?.fullName ?? 'Sistem';
        const names = await this.producerNames(areaId);
        let producerCode = '';
        let licenseCode: string | null = null;
        let gardenCode: string | null = null;
        let summary = '';
        let docs: string[] = [];
        let status: ApplicationStatus = 'UNDER_REVIEW';
        let payload: Record<string, unknown>;
        const refOf = (g: TeaInventoryGarden) => `Ada ${g.block} / Parsel ${g.parcel}`;
        switch (dto.type) {
            case 'garden_subdivision': {
                const p = this.parse(SubdivisionPayloadDto, dto.payload);
                const preview = await this.previewSubdivision(area, p);
                if (!preview.ok) throw new BadRequestException(preview.errors.join(' '));
                const g = (await this.gardenRepo.findOne({ where: { areaId, code: p.gardenCode } })) as TeaInventoryGarden;
                producerCode = g.producerCode;
                licenseCode = g.licenseCode;
                gardenCode = g.code;
                summary = `${refOf(g)} bahçesi ${p.pieces.length} parçaya bölünüyor (${p.pieces.map((x) => `${x.label}: ${x.holder.producerCode ? names.get(x.holder.producerCode) ?? x.holder.producerCode : x.holder.name}`).join('; ')})${p.cause ? ` · ${CAUSE_LABEL[p.cause]}` : ''}`;
                docs = ['tapu', 'kroki', 'muvafakat', 'kimlik'];
                status = preview.pieces.some((x) => x.siblingOverlapM2 > 0) ? 'BOUNDARY_CONFLICT' : 'GEOMETRY_PROPOSED';
                payload = { ...p, preview: this.compactPreview(preview) };
                break;
            }
            case 'license_split': {
                const p = this.parse(LicenseSplitPayloadDto, dto.payload);
                const preview = await this.previewSplit(area, p);
                if (!preview.ok) throw new BadRequestException(preview.errors.join(' '));
                producerCode = preview.license.producerCode;
                licenseCode = p.licenseCode;
                summary = `${p.licenseCode} ruhsatı ${p.parts.length} parçaya ayrılıyor · ${CAUSE_LABEL[p.cause]} (${preview.parts.map((x) => `${x.label}: ${x.holderName} ${x.recordedAreaM2} m²`).join('; ')})`;
                docs = p.cause === 'inheritance' ? ['veraset', 'kimlik', 'tapu', 'muvafakat'] : p.cause === 'sale' ? ['satis_sozlesmesi', 'tapu', 'kimlik'] : ['dilekce', 'kimlik', 'tapu', 'muvafakat'];
                payload = { ...p, preview: this.compactPreview(preview) };
                break;
            }
            case 'transfer': {
                const p = this.parse(TransferPayloadDto, dto.payload);
                const l = await this.licenseRepo.findOne({ where: { areaId, code: p.licenseCode } });
                if (!l) throw new NotFoundException('Licence not found');
                if (l.status !== 'active' && l.status !== 'transfer_pending') throw new BadRequestException(`Ruhsat ${l.status} durumunda; devredilemez.`);
                const holderName = await this.holderName(areaId, p.holder, names);
                if (!holderName) throw new BadRequestException('Devralan belirsiz (müstahsil kodu ya da ad gerekli).');
                if (p.holder.producerCode === l.producerCode) throw new BadRequestException('Devralan, ruhsatın mevcut sahibiyle aynı.');
                producerCode = l.producerCode;
                licenseCode = l.code;
                summary = `${l.code} ruhsatı ${names.get(l.producerCode) ?? l.producerCode} → ${holderName} · ${CAUSE_LABEL[p.cause]}`;
                docs = p.cause === 'inheritance' ? ['veraset', 'kimlik', 'cuzdan'] : p.cause === 'sale' ? ['satis_sozlesmesi', 'tapu', 'kimlik'] : ['dilekce', 'kimlik'];
                payload = { ...p, holderName };
                break;
            }
            case 'area_correction': {
                const p = this.parse(AreaCorrectionPayloadDto, dto.payload);
                const g = await this.gardenRepo.findOne({ where: { areaId, code: p.gardenCode, recordStatus: 'active' } });
                if (!g) throw new NotFoundException('Garden not found');
                producerCode = g.producerCode;
                licenseCode = g.licenseCode;
                gardenCode = g.code;
                summary = `${refOf(g)} bahçesi ruhsat alanı ${g.licensedAreaM2 != null ? Math.round(g.licensedAreaM2) : '—'} → ${Math.round(p.newLicensedAreaM2)} m² · ${p.reason}`;
                docs = ['dilekce', 'olcum_raporu'];
                payload = { ...p, previousLicensedAreaM2: g.licensedAreaM2 };
                break;
            }
            case 'boundary_determination': {
                const p = this.parse(BoundaryPayloadDto, dto.payload);
                const preview = await this.previewBoundary(area, p);
                if (!preview.ok) throw new BadRequestException(preview.errors.join(' '));
                const g = (await this.gardenRepo.findOne({ where: { areaId, code: p.gardenCode } })) as TeaInventoryGarden;
                producerCode = g.producerCode;
                licenseCode = g.licenseCode;
                gardenCode = g.code;
                summary = `${refOf(g)} bahçesi için yeni sınır (${p.source === 'rtk' ? 'RTK ölçümü' : p.source === 'producer' ? 'müstahsil çizimi' : 'harita çizimi'}): ${preview.before.planimetricAreaM2} → ${preview.after.planimetricAreaM2} m²${p.reason ? ` · ${p.reason}` : ''}`;
                docs = p.source === 'rtk' ? ['rtk_olcum', 'muvafakat'] : ['kroki', 'muvafakat'];
                status = preview.siblingOverlapM2 > 0 ? 'BOUNDARY_CONFLICT' : 'GEOMETRY_PROPOSED';
                payload = { ...p, preview: this.compactPreview(preview) };
                break;
            }
            default:
                throw new BadRequestException(`${dto.type} türü için site üzerinden başvuru açılamıyor; motor kaydından gelen dosyalar kullanılır.`);
        }
        if (dto.submit === 'draft') status = 'DRAFT';
        const provided = new Set(dto.providedDocuments ?? []);
        const documents: ApplicationDocument[] = docs.map((t) => ({ type: t, name: DOC_NAME[t] ?? t, status: provided.has(t) ? 'provided' : 'missing' }));
        if (status !== 'DRAFT' && documents.some((d) => d.status === 'missing') && (dto.type === 'transfer' || dto.type === 'license_split')) status = 'DOCUMENTS_PENDING';
        const code = await this.nextCode(areaId, 'SITE-B-', 4);
        const now = today();
        const app = this.applicationRepo.create({
            areaId, code, producerCode, licenseCode, gardenCode, type: dto.type, status, submittedAt: now, summary, documents,
            history: [{ at: now, from: null, to: status, by, note: 'Site üzerinden açıldı' }],
            payload, appliedAt: null, effects: null, createdById: userId, createdByName: by, source: 'site',
        });
        return this.applicationRepo.save(app);
    }

    // ── apply on approval ──

    /** Applies the approved file to the register inside the caller's transaction; returns the effects summary. */
    async apply(manager: EntityManager, area: TeaInventoryArea, app: LicensingApplication, by: string): Promise<Record<string, unknown>> {
        if (!app.payload) return {};
        switch (app.type as ApplicationType) {
            case 'garden_subdivision': return this.applySubdivision(manager, area, app, this.parse(SubdivisionPayloadDto, app.payload), by);
            case 'license_split': return this.applySplit(manager, area, app, this.parse(LicenseSplitPayloadDto, app.payload), by);
            case 'transfer': return this.applyTransfer(manager, area, app, this.parse(TransferPayloadDto, app.payload), by);
            case 'area_correction': return this.applyAreaCorrection(manager, area, app, this.parse(AreaCorrectionPayloadDto, app.payload), by);
            case 'boundary_determination': return this.applyBoundary(manager, area, app, this.parse(BoundaryPayloadDto, app.payload), by);
            default: return {};
        }
    }

    private async applySubdivision(manager: EntityManager, area: TeaInventoryArea, app: LicensingApplication, p: SubdivisionPayloadDto, by: string): Promise<Record<string, unknown>> {
        const preview = await this.previewSubdivision(area, p);
        if (!preview.ok) throw new BadRequestException(`Dosya uygulanamadı: ${preview.errors.join(' ')}`);
        const parent = (await manager.findOne(TeaInventoryGarden, { where: { areaId: area.id, code: p.gardenCode } })) as TeaInventoryGarden;
        const parentLicense = parent.licenseCode ? await manager.findOne(TeaInventoryLicense, { where: { areaId: area.id, code: parent.licenseCode } }) : null;
        const rules = this.rules(area);
        const now = today();
        const season = this.latestSeason(area);
        const existingCodes = new Set((await manager.find(TeaInventoryGarden, { where: { areaId: area.id }, select: ['code'] })).map((g) => g.code));
        const holders = new Map<string, { code: string; name: string; walletNo: string }>();
        const newGardens: TeaInventoryGarden[] = [];
        const conflicts: BoundaryConflict[] = [];
        const existingConflicts = area.licensing?.conflicts ?? [];
        let conflictSerial = existingConflicts.filter((c) => c.code.startsWith('SITE-K-')).length;
        for (let i = 0; i < p.pieces.length; i++) {
            const piece = p.pieces[i]!;
            const comp = preview.pieces[i]!;
            const holder = await this.resolveHolder(manager, area, piece.holder, season, holders);
            const code = this.childCode(parent.code, existingCodes);
            existingCodes.add(code);
            const geometry = this.asPoly(piece.geometry);
            const overlapping = comp.overlapsGardenCodes.length > 0;
            const g = manager.create(TeaInventoryGarden, {
                areaId: area.id, code, producerCode: holder.code, parcelKey: parent.parcelKey, block: parent.block, parcel: parent.parcel, locality: parent.locality,
                holderIndex: i + 1, holderCount: p.pieces.length, boundaryResolved: true, geometryAreaM2: comp.planimetricAreaM2,
                licenseCode: null, approvalStatus: overlapping ? 'boundary_conflict' : 'approved', licensedAreaM2: comp.licensedAreaM2,
                planimetricAreaM2: comp.planimetricAreaM2, surfaceAreaM2: comp.surfaceAreaM2, meanSlopeDeg: parent.meanSlopeDeg, measuredTeaAreaM2: comp.measuredTeaAreaM2,
                discrepancies: [], versions: [{ version: 1, geometry: geometry as unknown as Record<string, unknown>, planimetricAreaM2: comp.planimetricAreaM2, reason: `Alt bölünme: ${parent.code} → parça "${piece.label}"`, source: `Başvuru ${app.code} · ${by}`, validFrom: now, validTo: null }],
                proposal: null, seasons: {}, geometry: geometry as unknown as Record<string, unknown>, recordStatus: 'active', supersededBy: [], parentCode: parent.code,
                events: [{ at: now, type: 'created_by_subdivision', note: `${parent.code} bahçesinden "${piece.label}" parçası${p.cause ? ` · ${CAUSE_LABEL[p.cause]}` : ''}`, by, applicationCode: app.code }],
                source: 'site',
            });
            for (const sib of comp.overlapsGardenCodes) {
                const sg = await manager.findOne(TeaInventoryGarden, { where: { areaId: area.id, code: sib } });
                if (!sg) continue;
                const inter = this.intersectGeom(geometry, this.asPoly(sg.geometry));
                if (!inter) continue;
                conflictSerial++;
                conflicts.push({ code: `SITE-K-${String(conflictSerial).padStart(3, '0')}`, parcelKey: parent.parcelKey, gardenCodes: [code, sib], overlapM2: Math.round(this.m2(inter)), geometry: inter as unknown as Record<string, unknown>, status: 'open', openedAt: now });
                if (sg.approvalStatus === 'approved') { sg.approvalStatus = 'boundary_conflict'; sg.source = 'site'; await manager.save(sg); }
            }
            newGardens.push(g);
        }
        // Licence allocation: pieces of the original holder keep the licence; other holders get child licences.
        const newLicenses: TeaInventoryLicense[] = [];
        const byHolder = new Map<string, TeaInventoryGarden[]>();
        for (const g of newGardens) byHolder.set(g.producerCode, [...(byHolder.get(g.producerCode) ?? []), g]);
        const licenseCodes = new Set((await manager.find(TeaInventoryLicense, { where: { areaId: area.id }, select: ['code'] })).map((l) => l.code));
        let movedArea = 0;
        for (const [holderCode, gs] of byHolder) {
            if (!parentLicense) continue;
            if (holderCode === parent.producerCode) {
                for (const g of gs) g.licenseCode = parentLicense.code;
                continue;
            }
            const holder = holders.get(holderCode) ?? { code: holderCode, name: '', walletNo: '' };
            const code = this.childCode(parentLicense.code, licenseCodes);
            licenseCodes.add(code);
            const recorded = gs.reduce((t, g) => t + (g.licensedAreaM2 ?? 0), 0);
            movedArea += recorded;
            const l = manager.create(TeaInventoryLicense, {
                areaId: area.id, code, producerCode: holderCode, walletNo: holder.walletNo, status: 'active', issuedYear: Number(now.slice(0, 4)), recordedAreaM2: recorded,
                recordedParcelRefs: [`Ada ${parent.block} / Parsel ${parent.parcel}`], matchLevel: 'exact', matchedParcelKeys: [parent.parcelKey], lineageCodes: [], candidateParcelKeys: [],
                holderDeceased: false, validFrom: now, validTo: null, gardenCodes: gs.map((g) => g.code), parentCode: parentLicense.code, childCodes: [],
                history: [{ at: now, type: 'created_by_subdivision', note: `${parentLicense.code} ruhsatından ${recorded} m² · ${parent.code} alt bölünmesi`, by, applicationCode: app.code }], source: 'site',
            });
            for (const g of gs) g.licenseCode = code;
            newLicenses.push(l);
        }
        for (const g of newGardens) {
            const lic = g.licenseCode ? (newLicenses.find((l) => l.code === g.licenseCode) ?? parentLicense) : null;
            g.discrepancies = this.discrepanciesFor(g.licensedAreaM2, g.measuredTeaAreaM2, lic, rules, g.approvalStatus === 'boundary_conflict', false);
        }
        await manager.save(newGardens);
        if (newLicenses.length) await manager.save(newLicenses);
        if (parentLicense) {
            const keep = newGardens.filter((g) => g.licenseCode === parentLicense.code).map((g) => g.code);
            parentLicense.gardenCodes = [...parentLicense.gardenCodes.filter((c) => c !== parent.code), ...keep];
            parentLicense.recordedAreaM2 = Math.max(0, Math.round(parentLicense.recordedAreaM2 - movedArea));
            parentLicense.childCodes = [...parentLicense.childCodes, ...newLicenses.map((l) => l.code)];
            parentLicense.history = [...parentLicense.history, { at: now, type: 'subdivision', note: `${parent.code} bahçesi ${p.pieces.length} parçaya bölündü${movedArea ? `; ${Math.round(movedArea)} m² yeni ruhsatlara ayrıldı` : ''}`, by, applicationCode: app.code }];
            if (parentLicense.gardenCodes.length === 0) { parentLicense.status = 'split'; parentLicense.validTo = now; }
            parentLicense.source = 'site';
            await manager.save(parentLicense);
        }
        parent.recordStatus = 'superseded';
        parent.supersededBy = newGardens.map((g) => g.code);
        parent.events = [...parent.events, { at: now, type: 'subdivided', note: `${newGardens.length} parçaya bölündü: ${newGardens.map((g) => g.code).join(', ')}`, by, applicationCode: app.code }];
        parent.source = 'site';
        await manager.save(parent);
        if (conflicts.length) await this.appendConflicts(manager, area, conflicts);
        const affected = new Set([parent.producerCode, ...newGardens.map((g) => g.producerCode)]);
        for (const code of affected) await this.refreshProducer(manager, area, code, season);
        return { gardens: newGardens.map((g) => g.code), licenses: newLicenses.map((l) => l.code), supersededGarden: parent.code, producers: [...affected], conflicts: conflicts.map((c) => c.code) };
    }

    private async applySplit(manager: EntityManager, area: TeaInventoryArea, app: LicensingApplication, p: LicenseSplitPayloadDto, by: string): Promise<Record<string, unknown>> {
        const preview = await this.previewSplit(area, p);
        if (!preview.ok) throw new BadRequestException(`Dosya uygulanamadı: ${preview.errors.join(' ')}`);
        const license = (await manager.findOne(TeaInventoryLicense, { where: { areaId: area.id, code: p.licenseCode } })) as TeaInventoryLicense;
        const gardens = await manager.find(TeaInventoryGarden, { where: { areaId: area.id, licenseCode: license.code, recordStatus: 'active' } });
        const byCode = new Map(gardens.map((g) => [g.code, g]));
        const now = today();
        const season = this.latestSeason(area);
        const holders = new Map<string, { code: string; name: string; walletNo: string }>();
        const licenseCodes = new Set((await manager.find(TeaInventoryLicense, { where: { areaId: area.id }, select: ['code'] })).map((l) => l.code));
        const newLicenses: TeaInventoryLicense[] = [];
        const rules = this.rules(area);
        let keptPart: SplitPartComputation | null = null;
        for (let i = 0; i < p.parts.length; i++) {
            const part = p.parts[i]!;
            const comp = preview.parts[i]!;
            const holder = await this.resolveHolder(manager, area, part.holder, season, holders);
            const gs = part.gardenCodes.map((c) => byCode.get(c)).filter((g): g is TeaInventoryGarden => !!g);
            if (holder.code === license.producerCode) {
                keptPart = comp;
                continue;
            }
            const code = this.childCode(license.code, licenseCodes);
            licenseCodes.add(code);
            const l = manager.create(TeaInventoryLicense, {
                areaId: area.id, code, producerCode: holder.code, walletNo: holder.walletNo, status: 'active', issuedYear: Number(now.slice(0, 4)), recordedAreaM2: comp.recordedAreaM2,
                recordedParcelRefs: [...new Set(gs.map((g) => `Ada ${g.block} / Parsel ${g.parcel}`))], matchLevel: 'exact', matchedParcelKeys: [...new Set(gs.map((g) => g.parcelKey))], lineageCodes: [], candidateParcelKeys: [],
                holderDeceased: false, validFrom: now, validTo: null, gardenCodes: gs.map((g) => g.code), parentCode: license.code, childCodes: [],
                history: [{ at: now, type: 'created_by_split', note: `${license.code} ruhsatından ayrıldı · ${CAUSE_LABEL[p.cause]} · ${comp.recordedAreaM2} m²`, by, applicationCode: app.code }], source: 'site',
            });
            newLicenses.push(l);
            for (const g of gs) {
                g.producerCode = holder.code;
                g.licenseCode = code;
                g.discrepancies = this.discrepanciesFor(g.licensedAreaM2, g.measuredTeaAreaM2, l, rules, g.approvalStatus === 'boundary_conflict', g.discrepancies.includes('outside_parcel'));
                g.events = [...g.events, { at: now, type: 'moved_by_split', note: `${license.code} → ${code} (${holder.name})`, by, applicationCode: app.code }];
                g.source = 'site';
            }
            await manager.save(gs);
        }
        if (newLicenses.length) await manager.save(newLicenses);
        const previousHolder = license.producerCode;
        if (keptPart) {
            license.gardenCodes = keptPart.gardenCodes;
            license.recordedAreaM2 = keptPart.recordedAreaM2;
            license.history = [...license.history, { at: now, type: 'split', note: `${CAUSE_LABEL[p.cause]} · ${newLicenses.length} yeni ruhsat ayrıldı (${newLicenses.map((l) => l.code).join(', ')}); ${keptPart.recordedAreaM2} m² sahibinde kaldı`, by, applicationCode: app.code }];
        } else {
            license.status = 'split';
            license.validTo = now;
            license.gardenCodes = [];
            license.history = [...license.history, { at: now, type: 'split', note: `${CAUSE_LABEL[p.cause]} · ruhsat ${newLicenses.length} parçaya ayrıldı: ${newLicenses.map((l) => l.code).join(', ')}`, by, applicationCode: app.code }];
        }
        license.holderDeceased = false;
        license.childCodes = [...license.childCodes, ...newLicenses.map((l) => l.code)];
        license.source = 'site';
        await manager.save(license);
        const affected = new Set([previousHolder, ...newLicenses.map((l) => l.producerCode)]);
        for (const code of affected) await this.refreshProducer(manager, area, code, season);
        return { licenses: newLicenses.map((l) => l.code), originalLicense: license.code, originalStatus: license.status, producers: [...affected] };
    }

    private async applyTransfer(manager: EntityManager, area: TeaInventoryArea, app: LicensingApplication, p: TransferPayloadDto, by: string): Promise<Record<string, unknown>> {
        const license = await manager.findOne(TeaInventoryLicense, { where: { areaId: area.id, code: p.licenseCode } });
        if (!license) throw new NotFoundException('Licence not found');
        const now = today();
        const season = this.latestSeason(area);
        const holders = new Map<string, { code: string; name: string; walletNo: string }>();
        const holder = await this.resolveHolder(manager, area, p.holder, season, holders);
        const previousHolder = license.producerCode;
        const gardens = await manager.find(TeaInventoryGarden, { where: { areaId: area.id, licenseCode: license.code, recordStatus: 'active' } });
        for (const g of gardens) {
            g.producerCode = holder.code;
            g.events = [...g.events, { at: now, type: 'transferred', note: `${previousHolder} → ${holder.code} (${holder.name}) · ${CAUSE_LABEL[p.cause]}`, by, applicationCode: app.code }];
            g.source = 'site';
        }
        await manager.save(gardens);
        license.producerCode = holder.code;
        license.walletNo = holder.walletNo || license.walletNo;
        license.status = 'active';
        license.holderDeceased = false;
        license.history = [...license.history, { at: now, type: 'transfer', note: `${previousHolder} → ${holder.code} (${holder.name}) · ${CAUSE_LABEL[p.cause]}${p.reason ? ` · ${p.reason}` : ''}`, by, applicationCode: app.code }];
        license.source = 'site';
        await manager.save(license);
        for (const code of [previousHolder, holder.code]) await this.refreshProducer(manager, area, code, season);
        return { license: license.code, from: previousHolder, to: holder.code, gardens: gardens.map((g) => g.code) };
    }

    private async applyAreaCorrection(manager: EntityManager, area: TeaInventoryArea, app: LicensingApplication, p: AreaCorrectionPayloadDto, by: string): Promise<Record<string, unknown>> {
        const g = await manager.findOne(TeaInventoryGarden, { where: { areaId: area.id, code: p.gardenCode, recordStatus: 'active' } });
        if (!g) throw new NotFoundException('Garden not found');
        const now = today();
        const previous = g.licensedAreaM2 ?? 0;
        const delta = Math.round(p.newLicensedAreaM2 - previous);
        const license = g.licenseCode ? await manager.findOne(TeaInventoryLicense, { where: { areaId: area.id, code: g.licenseCode } }) : null;
        g.licensedAreaM2 = Math.round(p.newLicensedAreaM2);
        g.discrepancies = this.discrepanciesFor(g.licensedAreaM2, g.measuredTeaAreaM2, license, this.rules(area), g.approvalStatus === 'boundary_conflict', g.discrepancies.includes('outside_parcel'));
        g.events = [...g.events, { at: now, type: 'area_correction', note: `Ruhsat alanı ${Math.round(previous)} → ${g.licensedAreaM2} m² · ${p.reason}`, by, applicationCode: app.code }];
        g.source = 'site';
        await manager.save(g);
        if (license) {
            license.recordedAreaM2 = Math.max(0, Math.round(license.recordedAreaM2 + delta));
            license.history = [...license.history, { at: now, type: 'area_correction', note: `${g.code}: ${Math.round(previous)} → ${g.licensedAreaM2} m² (${delta >= 0 ? '+' : ''}${delta} m²) · ${p.reason}`, by, applicationCode: app.code }];
            license.source = 'site';
            await manager.save(license);
        }
        await this.refreshProducer(manager, area, g.producerCode, this.latestSeason(area));
        return { garden: g.code, previousLicensedAreaM2: previous, licensedAreaM2: g.licensedAreaM2, license: license?.code ?? null };
    }

    private async applyBoundary(manager: EntityManager, area: TeaInventoryArea, app: LicensingApplication, p: BoundaryPayloadDto, by: string): Promise<Record<string, unknown>> {
        const preview = await this.previewBoundary(area, p);
        if (!preview.ok) throw new BadRequestException(`Dosya uygulanamadı: ${preview.errors.join(' ')}`);
        const g = (await manager.findOne(TeaInventoryGarden, { where: { areaId: area.id, code: p.gardenCode } })) as TeaInventoryGarden;
        const now = today();
        const geometry = this.asPoly(p.geometry);
        const version = g.versions.length + 1;
        g.versions = [...g.versions.map((v, i) => (i === g.versions.length - 1 && !v.validTo ? { ...v, validTo: now } : v)), {
            version, geometry: geometry as unknown as Record<string, unknown>, planimetricAreaM2: preview.after.planimetricAreaM2,
            reason: p.reason || (p.source === 'rtk' ? 'Saha RTK-GNSS ölçümü' : p.source === 'producer' ? 'Müstahsil çizimi' : 'Harita üzerinde düzeltme'),
            source: `Başvuru ${app.code} · ${by}`, validFrom: now, validTo: null,
        } as GardenGeometryVersion];
        g.geometry = geometry as unknown as Record<string, unknown>;
        g.planimetricAreaM2 = preview.after.planimetricAreaM2;
        g.geometryAreaM2 = preview.after.planimetricAreaM2;
        g.surfaceAreaM2 = preview.after.surfaceAreaM2;
        g.measuredTeaAreaM2 = preview.after.measuredTeaAreaM2;
        g.proposal = null;
        g.boundaryResolved = true;
        const conflicts: BoundaryConflict[] = [];
        if (preview.overlapsGardenCodes.length) {
            let serial = (area.licensing?.conflicts ?? []).filter((c) => c.code.startsWith('SITE-K-')).length;
            for (const sib of preview.overlapsGardenCodes) {
                const sg = await manager.findOne(TeaInventoryGarden, { where: { areaId: area.id, code: sib } });
                if (!sg) continue;
                const inter = this.intersectGeom(geometry, this.asPoly(sg.geometry));
                if (!inter) continue;
                serial++;
                conflicts.push({ code: `SITE-K-${String(serial).padStart(3, '0')}`, parcelKey: g.parcelKey, gardenCodes: [g.code, sib], overlapM2: Math.round(this.m2(inter)), geometry: inter as unknown as Record<string, unknown>, status: 'open', openedAt: now });
                if (sg.approvalStatus === 'approved') { sg.approvalStatus = 'boundary_conflict'; sg.source = 'site'; await manager.save(sg); }
            }
        }
        g.approvalStatus = conflicts.length ? 'boundary_conflict' : 'approved';
        g.discrepancies = preview.discrepancies;
        g.events = [...g.events, { at: now, type: 'boundary_determined', note: `Sürüm ${version}: ${preview.before.planimetricAreaM2} → ${preview.after.planimetricAreaM2} m² (${p.source})`, by, applicationCode: app.code }];
        g.source = 'site';
        await manager.save(g);
        if (conflicts.length) await this.appendConflicts(manager, area, conflicts);
        await this.refreshProducer(manager, area, g.producerCode, this.latestSeason(area));
        return { garden: g.code, version, planimetricAreaM2: g.planimetricAreaM2, approvalStatus: g.approvalStatus, conflicts: conflicts.map((c) => c.code) };
    }

    // ── holders and producers ──

    private async resolveHolder(manager: EntityManager, area: TeaInventoryArea, h: HolderDto, season: string, cache: Map<string, { code: string; name: string; walletNo: string }>): Promise<{ code: string; name: string; walletNo: string }> {
        if (h.producerCode) {
            const cached = cache.get(h.producerCode);
            if (cached) return cached;
            const row = await manager.findOne(TeaInventoryProducer, { where: { areaId: area.id, code: h.producerCode }, order: { season: 'DESC' } });
            if (!row) throw new BadRequestException(`Müstahsil bulunamadı: ${h.producerCode}`);
            const out = { code: row.code, name: row.name, walletNo: row.walletNo };
            cache.set(out.code, out);
            return out;
        }
        const name = (h.name ?? '').trim();
        if (!name) throw new BadRequestException('Yeni sahip için ad soyad gerekli');
        const key = `new:${name.toLocaleUpperCase('tr-TR')}`;
        const cached = cache.get(key);
        if (cached) return cached;
        const code = await this.nextCode(area.id, 'SITE-M-', 4, manager);
        const walletNo = (h.walletNo ?? '').trim() || `SITE-C-${code.slice(-4)}`;
        const row = manager.create(TeaInventoryProducer, {
            areaId: area.id, code, season, name, walletNo, licenseNo: '', licensedAreaM2: 0, teaAreaM2: 0, requiredM2: 0, grossPrunedM2: 0, reusedM2: 0, newPrunedM2: 0,
            unattributedM2: 0, unobservedM2: 0, remainingM2: 0, gardenCount: 0, unresolvedGardens: 0, autoStatus: 'awaiting_observation', autoApprovedAt: null, scans: [], fusion: null, demo: true, source: 'site',
        });
        await manager.save(row);
        const out = { code, name, walletNo };
        cache.set(key, out);
        cache.set(code, out);
        return out;
    }

    /** Brings the holder's latest-season row in line with the register (licensed area, 1/7 target, gardens). */
    private async refreshProducer(manager: EntityManager, area: TeaInventoryArea, code: string, season: string): Promise<void> {
        const row = await manager.findOne(TeaInventoryProducer, { where: { areaId: area.id, code, season } }) ?? (await manager.findOne(TeaInventoryProducer, { where: { areaId: area.id, code }, order: { season: 'DESC' } }));
        if (!row) return;
        const [gardens, licenses] = await Promise.all([
            manager.find(TeaInventoryGarden, { where: { areaId: area.id, producerCode: code, recordStatus: 'active' } }),
            manager.find(TeaInventoryLicense, { where: { areaId: area.id, producerCode: code } }),
        ]);
        const active = licenses.filter((l) => l.status === 'active' || l.status === 'transfer_pending');
        row.licensedAreaM2 = Math.round(gardens.reduce((t, g) => t + (g.licensedAreaM2 ?? 0), 0));
        row.teaAreaM2 = Math.round(gardens.reduce((t, g) => t + g.measuredTeaAreaM2, 0));
        row.requiredM2 = Math.round(row.licensedAreaM2 / 7);
        row.remainingM2 = Math.max(0, row.requiredM2 - row.newPrunedM2);
        row.gardenCount = gardens.length;
        row.licenseNo = active[0]?.code ?? licenses[0]?.code ?? '';
        if (row.fusion) row.fusion = { ...row.fusion, licensedAreaM2: row.licensedAreaM2, requiredM2: row.requiredM2, gardens: gardens.length };
        row.source = row.source === 'site' ? 'site' : row.source;
        await manager.save(row);
    }

    private async appendConflicts(manager: EntityManager, area: TeaInventoryArea, conflicts: BoundaryConflict[]): Promise<void> {
        const fresh = await manager.findOne(TeaInventoryArea, { where: { id: area.id } });
        if (!fresh) return;
        const block = fresh.licensing ?? { demo: true, generatedAt: today(), rules: DEFAULT_RULES, conflicts: [], unlicensedTea: [] };
        fresh.licensing = { ...block, conflicts: [...block.conflicts, ...conflicts] };
        await manager.save(fresh);
        area.licensing = fresh.licensing;
    }

    // ── geometry ──

    private asPoly(g: unknown): Poly {
        const geom = g as { type?: string; coordinates?: unknown };
        if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') || !Array.isArray(geom.coordinates)) {
            throw new BadRequestException('Geometri Polygon ya da MultiPolygon olmalı (WGS84)');
        }
        return geom as Poly;
    }

    private m2(g: Poly | null): number {
        return g ? turfArea(feature(g)) : 0;
    }

    private intersectGeom(a: Poly, b: Poly): Poly | null {
        try {
            const r = intersect(featureCollection([feature(a), feature(b)]));
            return r ? (r.geometry as Poly) : null;
        } catch {
            return null;
        }
    }

    private safeIntersectArea(a: Poly, b: Poly): number {
        return this.m2(this.intersectGeom(a, b));
    }

    private unionAll(gs: Poly[]): Poly | null {
        if (gs.length === 0) return null;
        if (gs.length === 1) return gs[0]!;
        try {
            const r = union(featureCollection(gs.map((g) => feature(g))) as Parameters<typeof union>[0]);
            return r ? (r.geometry as Poly) : null;
        } catch {
            return null;
        }
    }

    private geometryWarnings(g: Poly): string[] {
        const out: string[] = [];
        const f = feature(g) as Feature<Poly>;
        try {
            if (!booleanValid(f)) out.push('Geometri geçersiz (kendini kesiyor ya da halka kapanmıyor).');
            if (g.type === 'Polygon' && kinks(f as Feature<Polygon>).features.length > 0) out.push('Sınır kendini kesiyor.');
        } catch {
            out.push('Geometri doğrulanamadı.');
        }
        return out;
    }

    private teaArea(area: TeaInventoryArea, g: Poly): number {
        let total = 0;
        for (const t of area.teaPatches ?? []) {
            try {
                total += this.safeIntersectArea(g, this.asPoly(t.geometry));
            } catch {
                // a malformed patch must not block the operation
            }
        }
        return total;
    }

    private slopeFactor(g: TeaInventoryGarden): number {
        if (g.planimetricAreaM2 > 0 && g.surfaceAreaM2 > 0) return Math.max(1, g.surfaceAreaM2 / g.planimetricAreaM2);
        const rad = ((g.meanSlopeDeg || 0) * Math.PI) / 180;
        return Math.cos(rad) > 0 ? 1 / Math.cos(rad) : 1;
    }

    private discrepanciesFor(licensed: number | null, tea: number, license: TeaInventoryLicense | null, rules: { areaTolerance: number }, overlap: boolean, outside: boolean): GardenDiscrepancy[] {
        const out: GardenDiscrepancy[] = [];
        if (!license) out.push('no_license');
        else if (license.matchLevel === 'probable' || license.matchLevel === 'unmatched') out.push('lineage_unresolved');
        if (tea < 50) out.push('no_tea');
        else if (licensed != null && licensed > 0) {
            if (licensed > tea * (1 + rules.areaTolerance)) out.push('area_over');
            else if (licensed < tea * (1 - rules.areaTolerance)) out.push('area_under');
        }
        if (overlap) out.push('overlap');
        if (outside) out.push('outside_parcel');
        return out;
    }

    // ── misc ──

    private rules(area: TeaInventoryArea): { areaTolerance: number; minLicenseM2: number; overlapToleranceM2: number } {
        return { ...DEFAULT_RULES, ...(area.licensing?.rules ?? {}) };
    }

    private latestSeason(area: TeaInventoryArea): string {
        const seasons = (area.producerScan?.seasons ?? []).map((s) => s.season).sort();
        return seasons.at(-1) ?? `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(2)}`;
    }

    private parse<T extends object>(cls: new () => T, payload: Record<string, unknown>): T {
        const instance = plainToInstance(cls, payload);
        const errors = validateSync(instance as object, { whitelist: true });
        if (errors.length) {
            const messages = errors.flatMap((e) => this.flattenErrors(e));
            throw new BadRequestException(messages.join('; ') || 'Geçersiz başvuru içeriği');
        }
        return instance;
    }

    private flattenErrors(e: { property: string; constraints?: Record<string, string>; children?: Array<{ property: string; constraints?: Record<string, string>; children?: unknown[] }> }, prefix = ''): string[] {
        const here = Object.values(e.constraints ?? {}).map((m) => `${prefix}${e.property}: ${m}`);
        const nested = (e.children ?? []).flatMap((c) => this.flattenErrors(c as typeof e, `${prefix}${e.property}.`));
        return [...here, ...nested];
    }

    private childCode(parent: string, existing: Set<string>): string {
        const letters = 'ABCDEFGHJKLMNPRSTUVYZ';
        for (const ch of letters) {
            const c = `${parent}-${ch}`;
            if (!existing.has(c)) return c;
        }
        for (let i = 1; i < 1000; i++) {
            const c = `${parent}-${i}`;
            if (!existing.has(c)) return c;
        }
        throw new BadRequestException('Alt kod üretilemedi');
    }

    private async nextCode(areaId: string, prefix: string, width: number, manager?: EntityManager): Promise<string> {
        const repo = prefix.startsWith('SITE-B') ? (manager ? manager.getRepository(LicensingApplication) : this.applicationRepo) : (manager ? manager.getRepository(TeaInventoryProducer) : this.producerRepo);
        const rows = await (repo as Repository<{ code: string; areaId: string }>).createQueryBuilder('r').select('r.code', 'code').where('r.area_id = :areaId AND r.code LIKE :p', { areaId, p: `${prefix}%` }).getRawMany<{ code: string }>();
        const max = rows.reduce((m, r) => Math.max(m, Number(r.code.slice(prefix.length)) || 0), 0);
        return `${prefix}${String(max + 1).padStart(width, '0')}`;
    }

    private async producerNames(areaId: string): Promise<Map<string, string>> {
        const rows = await this.producerRepo.createQueryBuilder('p').select(['p.code AS code', 'p.name AS name']).distinctOn(['p.code']).where('p.area_id = :areaId', { areaId }).orderBy('p.code').getRawMany<{ code: string; name: string }>();
        return new Map(rows.map((r) => [r.code, r.name]));
    }

    private async holderName(areaId: string, h: HolderDto, names: Map<string, string>): Promise<string | null> {
        void areaId;
        if (h.producerCode) return names.get(h.producerCode) ?? null;
        const n = (h.name ?? '').trim();
        return n ? `${n} (yeni)` : null;
    }

    private compactPreview(p: OperationPreview): Record<string, unknown> {
        if (p.type === 'garden_subdivision') return { pieces: p.pieces.map(({ holder: _h, ...rest }) => rest), coveredShare: p.coveredShare, uncoveredM2: p.uncoveredM2, licensedTotalM2: p.licensedTotalM2, warnings: p.warnings, parent: p.parent };
        if (p.type === 'license_split') return { parts: p.parts.map(({ holder: _h, ...rest }) => rest), license: p.license, warnings: p.warnings };
        return { before: p.before, after: p.after, outsideParcelM2: p.outsideParcelM2, siblingOverlapM2: p.siblingOverlapM2, overlapsGardenCodes: p.overlapsGardenCodes, discrepancies: p.discrepancies, warnings: p.warnings };
    }

    private async findArea(id: string): Promise<TeaInventoryArea> {
        const area = await this.areaRepo.findOne({ where: { id } });
        if (!area) throw new NotFoundException('Inventory area not found');
        return area;
    }
}
