import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { User } from '@/users/entities/user.entity';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { MinistryMatchBy, MinistryRequest, MinistryRequestItem } from '@/tea-inventory/entities/ministry-request.entity';
import { CreateMinistryRequestDto, MinistryRequestLineDto } from '@/tea-inventory/dto';
import { FusionProducerRow, PruningFusionService } from '@/tea-inventory/pruning-fusion.service';
import { EvidenceService } from '@/tea-inventory/evidence.service';
import { ANOMALY_LABEL, DECISION_LABEL, PRODUCER_FUSION_LABEL, formatDateTimeTr, seasonLabel } from '@/tea-inventory/report/labels';

export interface MinistryRequestRow {
    id: string;
    areaCode: string;
    season: string;
    title: string;
    source: string;
    reference: string;
    requestedAt: string;
    note: string | null;
    itemCount: number;
    matchedCount: number;
    unmatchedCount: number;
    byDecision: Record<string, number>;
    createdByName: string;
    answeredAt: string;
    createdAt: string;
}

export interface MinistryRequestDetail extends MinistryRequestRow {
    items: MinistryRequestItem[];
}

export interface MinistryFile {
    buffer: Buffer;
    filename: string;
}

const MATCH_LABEL: Record<MinistryMatchBy, string> = { wallet_no: 'Cüzdan no', license_no: 'Ruhsat no', producer_code: 'Müstahsil no', name: 'Ad soyad', none: 'Eşleşmedi' };

/**
 * "Talep → cevap": the Ministry (or an inspector) sends a list of producers; the system matches
 * each line to the season register, snapshots the purchase decision and hands back an Excel
 * answer plus the evidence PDFs in one package. The snapshot is what was answered, so a later
 * re-run of the satellite chain does not rewrite history.
 */
@Injectable()
export class MinistryRequestService {
    constructor(
        @InjectRepository(MinistryRequest) private readonly requestRepo: Repository<MinistryRequest>,
        @InjectRepository(TeaInventoryArea) private readonly areaRepo: Repository<TeaInventoryArea>,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
        private readonly fusion: PruningFusionService,
        private readonly evidence: EvidenceService,
    ) { }

    async create(areaId: string, dto: CreateMinistryRequestDto, userId: string): Promise<MinistryRequestDetail> {
        const area = await this.findArea(areaId);
        const season = this.fusion.resolveSeason(area, dto.season);
        const lines = [...(dto.items ?? []), ...this.parseText(dto.text ?? '')];
        if (lines.length === 0) throw new BadRequestException('Liste boş: en az bir müstahsil satırı gerekli');
        if (lines.length > 2000) throw new BadRequestException('Bir talepte en fazla 2000 satır olabilir');
        const producers = await this.fusion.producerRows(areaId, season);
        const items = lines.map((l) => this.match(l, producers));
        const user = await this.userRepo.findOne({ where: { id: userId } });
        const entity = this.requestRepo.create({
            areaCode: area.code,
            season,
            title: dto.title.trim(),
            source: (dto.source ?? '').trim(),
            reference: (dto.reference ?? '').trim(),
            requestedAt: dto.requestedAt.slice(0, 10),
            note: dto.note?.trim() || null,
            items,
            matchedCount: items.filter((i) => i.matchedCode).length,
            unmatchedCount: items.filter((i) => !i.matchedCode).length,
            createdById: userId,
            createdByName: user?.fullName ?? 'Sistem',
            answeredAt: new Date(),
        });
        const saved = await this.requestRepo.save(entity);
        return this.detail(saved);
    }

    async list(areaId: string, season?: string): Promise<MinistryRequestRow[]> {
        const area = await this.findArea(areaId);
        const rows = await this.requestRepo.find({ where: season ? { areaCode: area.code, season } : { areaCode: area.code }, order: { createdAt: 'DESC' } });
        return rows.map((r) => this.row(r));
    }

    async get(areaId: string, id: string): Promise<MinistryRequestDetail> {
        return this.detail(await this.findRequest(areaId, id));
    }

    async remove(areaId: string, id: string): Promise<void> {
        const r = await this.findRequest(areaId, id);
        await this.requestRepo.delete({ id: r.id });
    }

    async answerXlsx(areaId: string, id: string): Promise<MinistryFile> {
        const r = await this.findRequest(areaId, id);
        const wb = await this.workbook(r);
        const buf = await wb.xlsx.writeBuffer();
        return { buffer: Buffer.from(buf as ArrayBuffer), filename: `bakanlik-cevap-${this.slug(r.title)}-${r.season}.xlsx` };
    }

    /** Answer sheet + one evidence PDF per matched producer, zipped. */
    async evidenceZip(areaId: string, id: string): Promise<MinistryFile> {
        const r = await this.findRequest(areaId, id);
        const zip = new JSZip();
        const wb = await this.workbook(r);
        zip.file('cevap-listesi.xlsx', Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer));
        const codes = [...new Set(r.items.map((i) => i.matchedCode).filter((c): c is string => !!c))];
        const pdfs = await this.evidence.producerPdfBatch(areaId, codes, r.season);
        const folder = zip.folder('kanit-dosyalari');
        for (const [code, buf] of pdfs) folder?.file(`kanit-${code}-${r.season}.pdf`, buf);
        const missing = codes.filter((c) => !pdfs.has(c));
        zip.file('OKUBENI.txt', [
            `Talep: ${r.title}`,
            `Kaynak: ${r.source || '—'} · Referans: ${r.reference || '—'} · Talep tarihi: ${r.requestedAt}`,
            `Sezon: ${seasonLabel(r.season)} · Cevaplandı: ${formatDateTimeTr(r.answeredAt)} · Hazırlayan: ${r.createdByName}`,
            `Satır: ${r.items.length} · Eşleşen: ${r.matchedCount} · Eşleşmeyen: ${r.unmatchedCount}`,
            '',
            'cevap-listesi.xlsx: her satır için eşleşme ve alım kararı; kanit-dosyalari/: eşleşen her müstahsil için kanıt PDF\'i.',
            missing.length ? `Kanıt dosyası üretilemeyen müstahsiller: ${missing.join(', ')}` : '',
            'Kararlar uydu tabanlı çok-sensör değerlendirmesine dayanır; kalibrasyon tamamlanana kadar idari ön değerlendirme niteliğindedir.',
        ].filter((l) => l !== '').join('\n'));
        const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        return { buffer, filename: `bakanlik-paketi-${this.slug(r.title)}-${r.season}.zip` };
    }

    // ── matching ──

    /** One producer per line; fields split on ; , or tab, in any order. */
    private parseText(text: string): MinistryRequestLineDto[] {
        return text
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l && !/^(cüzdan|cuzdan|ruhsat|müstahsil|mustahsil|ad\b|adı|isim)/i.test(l))
            .map((l) => {
                const tokens = l.split(/[;,\t|]/).map((t) => t.trim()).filter(Boolean);
                const line: MinistryRequestLineDto = {};
                const names: string[] = [];
                for (const t of tokens) {
                    if (/^DEMO-C-|^C-?\d{3,}$|^\d{5,}$/i.test(t) && !line.walletNo) line.walletNo = t;
                    else if (/^DEMO-R-|^R-?\d{3,}$/i.test(t) && !line.licenseNo) line.licenseNo = t;
                    else if (/^DEMO-M-|^M-?\d{3,}$/i.test(t) && !line.producerCode) line.producerCode = t;
                    else if (/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(t)) names.push(t);
                    else if (!line.walletNo) line.walletNo = t;
                }
                if (names.length) line.name = names.join(' ');
                return line;
            })
            .filter((l) => l.walletNo || l.licenseNo || l.producerCode || l.name);
    }

    private match(line: MinistryRequestLineDto, producers: FusionProducerRow[]): MinistryRequestItem {
        const norm = (s: string | undefined) => (s ?? '').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ');
        const key = (s: string | undefined) => norm(s).replace(/[^A-Z0-9ÇĞİÖŞÜ]/g, '');
        let found: FusionProducerRow | undefined;
        let matchBy: MinistryMatchBy = 'none';
        if (line.walletNo) { found = producers.find((p) => key(p.walletNo) === key(line.walletNo)); if (found) matchBy = 'wallet_no'; }
        if (!found && line.licenseNo) { found = producers.find((p) => key(p.licenseNo) === key(line.licenseNo)); if (found) matchBy = 'license_no'; }
        if (!found && line.producerCode) { found = producers.find((p) => key(p.code) === key(line.producerCode)); if (found) matchBy = 'producer_code'; }
        if (!found && line.name) {
            const candidates = producers.filter((p) => norm(p.name) === norm(line.name));
            if (candidates.length === 1) { found = candidates[0]; matchBy = 'name'; }
        }
        const base: MinistryRequestItem = {
            walletNo: line.walletNo ?? '', licenseNo: line.licenseNo ?? '', producerCode: line.producerCode ?? '', name: line.name ?? '',
            matchBy, matchedCode: null, matchedName: null, decision: null, decisionLabel: 'Kayıt bulunamadı', status: null,
            licensedAreaM2: null, requiredM2: null, countedM2: null, reusedM2: null, shortfallM2: null, anomalies: [], firstDetectedAt: null, gardens: null,
            reason: line.name && producers.filter((p) => norm(p.name) === norm(line.name)).length > 1 ? 'Aynı ada sahip birden çok müstahsil; cüzdan veya ruhsat no gerekli' : 'Sezon kütüğünde eşleşen kayıt yok',
        };
        if (!found) return base;
        return {
            ...base,
            matchedCode: found.code,
            matchedName: found.name,
            decision: found.decision ?? 'no_data',
            decisionLabel: DECISION_LABEL[found.decision ?? 'no_data'],
            status: found.status,
            licensedAreaM2: Math.round(found.licensedAreaM2),
            requiredM2: Math.round(found.requiredM2),
            countedM2: Math.round(found.countedM2 ?? found.prunedAreaM2),
            reusedM2: Math.round(found.reusedM2 ?? 0),
            shortfallM2: Math.round(found.shortfallM2 ?? 0),
            anomalies: (found.anomalies ?? []).map((a) => ANOMALY_LABEL[a] ?? a),
            firstDetectedAt: found.firstDetectedAt,
            gardens: found.gardens,
            reason: found.decisionReason ?? PRODUCER_FUSION_LABEL[found.status],
        };
    }

    // ── output ──

    private async workbook(r: MinistryRequest): Promise<ExcelJS.Workbook> {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'ÇAYKUR · Çay Envanteri';
        const ws = wb.addWorksheet('Cevap');
        ws.columns = [
            { header: '#', key: 'n', width: 5 }, { header: 'Talepteki cüzdan no', key: 'walletNo', width: 16 }, { header: 'Talepteki ruhsat no', key: 'licenseNo', width: 16 },
            { header: 'Talepteki müstahsil no', key: 'producerCode', width: 16 }, { header: 'Talepteki ad', key: 'name', width: 24 }, { header: 'Eşleşme', key: 'matchBy', width: 14 },
            { header: 'Kütükteki müstahsil', key: 'matchedName', width: 24 }, { header: 'Müstahsil no', key: 'matchedCode', width: 14 }, { header: 'Alım kararı', key: 'decisionLabel', width: 30 },
            { header: 'Durum', key: 'status', width: 18 }, { header: 'Ruhsat alanı (m²)', key: 'licensedAreaM2', width: 16 }, { header: '1/7 hedefi (m²)', key: 'requiredM2', width: 14 },
            { header: 'Sayılan (m²)', key: 'countedM2', width: 12 }, { header: 'Tekrar, sayılmadı (m²)', key: 'reusedM2', width: 18 }, { header: 'Eksik (m²)', key: 'shortfallM2', width: 12 },
            { header: 'Anomaliler', key: 'anomalies', width: 32 }, { header: 'İlk kesin tespit', key: 'firstDetectedAt', width: 14 }, { header: 'Gerekçe', key: 'reason', width: 60 },
            { header: 'Kanıt dosyası', key: 'evidence', width: 30 },
        ];
        r.items.forEach((i, n) => {
            ws.addRow({
                n: n + 1, walletNo: i.walletNo, licenseNo: i.licenseNo, producerCode: i.producerCode, name: i.name, matchBy: MATCH_LABEL[i.matchBy], matchedName: i.matchedName ?? '', matchedCode: i.matchedCode ?? '',
                decisionLabel: i.decisionLabel, status: i.status ? (PRODUCER_FUSION_LABEL[i.status as keyof typeof PRODUCER_FUSION_LABEL] ?? i.status) : '', licensedAreaM2: i.licensedAreaM2 ?? '', requiredM2: i.requiredM2 ?? '',
                countedM2: i.countedM2 ?? '', reusedM2: i.reusedM2 ?? '', shortfallM2: i.shortfallM2 ?? '', anomalies: i.anomalies.join(', '), firstDetectedAt: i.firstDetectedAt ?? '', reason: i.reason,
                evidence: i.matchedCode ? `kanit-dosyalari/kanit-${i.matchedCode}-${r.season}.pdf` : '',
            });
        });
        ws.getRow(1).font = { bold: true };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        ws.views = [{ state: 'frozen', ySplit: 1 }];
        ws.autoFilter = { from: 'A1', to: `${ws.getColumn(ws.columnCount).letter}1` };
        const meta = wb.addWorksheet('Talep');
        meta.columns = [{ width: 24 }, { width: 60 }];
        for (const row of [
            ['Talep', r.title], ['Kaynak', r.source || '—'], ['Referans', r.reference || '—'], ['Talep tarihi', r.requestedAt], ['Sezon', seasonLabel(r.season)],
            ['Cevaplandı', formatDateTimeTr(r.answeredAt)], ['Hazırlayan', r.createdByName], ['Satır', r.items.length], ['Eşleşen', r.matchedCount], ['Eşleşmeyen', r.unmatchedCount], ['Not', r.note ?? ''],
            ['Uyarı', 'Kararlar uydu tabanlı çok-sensör değerlendirmesine dayanır; kalibrasyon tamamlanana kadar idari ön değerlendirmedir.'],
        ]) meta.addRow(row);
        meta.getColumn(1).font = { bold: true };
        return wb;
    }

    private row(r: MinistryRequest): MinistryRequestRow {
        const byDecision: Record<string, number> = {};
        for (const i of r.items) {
            const k = i.decision ?? 'unmatched';
            byDecision[k] = (byDecision[k] ?? 0) + 1;
        }
        return {
            id: r.id, areaCode: r.areaCode, season: r.season, title: r.title, source: r.source, reference: r.reference, requestedAt: r.requestedAt, note: r.note,
            itemCount: r.items.length, matchedCount: r.matchedCount, unmatchedCount: r.unmatchedCount, byDecision, createdByName: r.createdByName,
            answeredAt: r.answeredAt.toISOString(), createdAt: r.createdAt.toISOString(),
        };
    }

    private detail(r: MinistryRequest): MinistryRequestDetail {
        return { ...this.row(r), items: r.items };
    }

    private async findArea(id: string): Promise<TeaInventoryArea> {
        const area = await this.areaRepo.findOne({ where: { id } });
        if (!area) throw new NotFoundException('Inventory area not found');
        return area;
    }

    private async findRequest(areaId: string, id: string): Promise<MinistryRequest> {
        const area = await this.findArea(areaId);
        const r = await this.requestRepo.findOne({ where: { id, areaCode: area.code } });
        if (!r) throw new NotFoundException('Request not found');
        return r;
    }

    private slug(s: string): string {
        return s.toLocaleLowerCase('tr-TR').replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c] ?? c).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'talep';
    }
}
