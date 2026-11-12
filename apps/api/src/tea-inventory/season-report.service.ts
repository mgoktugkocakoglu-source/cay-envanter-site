import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryGarden } from '@/tea-inventory/entities/tea-inventory-garden.entity';
import { FusionDecision, ProducerFusionStatus } from '@/tea-inventory/entities/tea-inventory-producer.entity';
import { FusionGardenRow, FusionProducerRow, FusionSummary, PruningFusionService } from '@/tea-inventory/pruning-fusion.service';
import {
    ANOMALY_LABEL, APPROVAL_LABEL, DECISION_LABEL, DISCREPANCY_LABEL, FUSION_CLASS_LABEL, PRODUCER_FUSION_LABEL, formatDateTimeTr, formatDateTr, formatM2, formatNum, formatPct, seasonLabel,
} from '@/tea-inventory/report/labels';
import { BLUE, FONT, FONT_BOLD, GREEN, INK, MUTED, ORANGE, Pdf, RED, badge, bottomY, contentWidth, createPdf, finishPdf, h2, kvGrid, para, table } from '@/tea-inventory/report/pdf';

export interface ReportFile {
    buffer: Buffer;
    filename: string;
}

interface ReportData {
    area: TeaInventoryArea;
    season: string;
    summary: FusionSummary;
    producers: FusionProducerRow[];
    gardens: FusionGardenRow[];
    gardenEntities: TeaInventoryGarden[];
    generatedAt: Date;
}

const DECISION_ORDER: FusionDecision[] = ['auto_open', 'auto_pending', 'auto_short', 'expert_anomaly', 'auto_none', 'no_license', 'no_data'];
const STATUS_ORDER: ProducerFusionStatus[] = ['pruned_full', 'pruned_partial', 'unclear', 'none', 'no_license', 'no_data'];
const DECISION_COLOR: Record<FusionDecision, string> = { auto_open: GREEN, auto_pending: MUTED, auto_short: ORANGE, auto_none: MUTED, expert_anomaly: ORANGE, no_license: RED, no_data: MUTED };

/**
 * The official season report of a neighbourhood: compliance by decision, by locality, the list
 * of producers who pruned, who is short, the anomalies and the free tea patches. Excel carries
 * every row; the PDF is the signed summary with the first rows of each list.
 */
@Injectable()
export class SeasonReportService {
    constructor(
        @InjectRepository(TeaInventoryArea) private readonly areaRepo: Repository<TeaInventoryArea>,
        @InjectRepository(TeaInventoryGarden) private readonly gardenRepo: Repository<TeaInventoryGarden>,
        private readonly fusion: PruningFusionService,
    ) { }

    async xlsx(areaId: string, requested?: string): Promise<ReportFile> {
        const d = await this.load(areaId, requested);
        const wb = new ExcelJS.Workbook();
        wb.creator = 'ÇAYKUR · Çay Envanteri';
        wb.created = d.generatedAt;
        this.sheetSummary(wb, d);
        this.sheetProducers(wb, d);
        this.sheetGardens(wb, d);
        this.sheetShortfalls(wb, d);
        this.sheetAnomalies(wb, d);
        this.sheetLocalities(wb, d);
        this.sheetUnassigned(wb, d);
        this.sheetLicensing(wb, d);
        const buf = await wb.xlsx.writeBuffer();
        return { buffer: Buffer.from(buf as ArrayBuffer), filename: `sezon-raporu-${d.area.code}-${d.season}.xlsx` };
    }

    async pdf(areaId: string, requested?: string): Promise<ReportFile> {
        const d = await this.load(areaId, requested);
        const doc = createPdf({ title: `Budama sezon raporu · ${d.area.neighborhood} · ${seasonLabel(d.season)}` });
        this.pdfCover(doc, d);
        this.pdfLists(doc, d);
        const buffer = await finishPdf(doc, (pdf, page, total) => {
            const y = bottomY(pdf) + 14;
            pdf.font(FONT).fontSize(7).fillColor(MUTED);
            pdf.text(`Sezon raporu · ${d.area.province} / ${d.area.district} / ${d.area.neighborhood} · ${seasonLabel(d.season)} · Oluşturulma ${formatDateTimeTr(d.generatedAt)}${d.area.demoLicenses ? ' · ruhsat verileri DEMO' : ''}`, pdf.page.margins.left, y, { width: contentWidth(pdf) - 60, lineBreak: false, ellipsis: true });
            pdf.text(`Sayfa ${page} / ${total}`, pdf.page.width - pdf.page.margins.right - 60, y, { width: 60, align: 'right', lineBreak: false });
        });
        return { buffer, filename: `sezon-raporu-${d.area.code}-${d.season}.pdf` };
    }

    // ── data ──

    private async load(areaId: string, requested?: string): Promise<ReportData> {
        const area = await this.areaRepo.findOne({ where: { id: areaId } });
        if (!area) throw new NotFoundException('Inventory area not found');
        const season = this.fusion.resolveSeason(area, requested);
        const [summary, producers, gardensRes, gardenEntities] = await Promise.all([
            this.fusion.summary(areaId, season),
            this.fusion.producerRows(areaId, season),
            this.fusion.gardenRows(areaId, season),
            this.gardenRepo.find({ where: { areaId }, order: { parcelKey: 'ASC', holderIndex: 'ASC' } }),
        ]);
        return { area, season, summary, producers, gardens: gardensRes.rows, gardenEntities, generatedAt: new Date() };
    }

    private byLocality(d: ReportData): Array<{ name: string; total: number; pruned: number; likely: number; unclear: number; notPruned: number; prunedM2: number; producers: number }> {
        const map = new Map<string, { name: string; total: number; pruned: number; likely: number; unclear: number; notPruned: number; prunedM2: number; producerSet: Set<string> }>();
        for (const g of d.gardens) {
            const name = g.locality || '—';
            let row = map.get(name);
            if (!row) {
                row = { name, total: 0, pruned: 0, likely: 0, unclear: 0, notPruned: 0, prunedM2: 0, producerSet: new Set() };
                map.set(name, row);
            }
            row.total++;
            if (g.class === 'pruned') { row.pruned++; row.prunedM2 += g.unitAreaM2; }
            else if (g.class === 'likely') { row.likely++; row.prunedM2 += g.unitAreaM2; }
            else if (g.class === 'unclear') row.unclear++;
            else row.notPruned++;
            row.producerSet.add(g.producerCode);
        }
        return [...map.values()].map(({ producerSet, ...r }) => ({ ...r, producers: producerSet.size })).sort((a, b) => b.total - a.total);
    }

    private shortfalls(d: ReportData): FusionProducerRow[] {
        return d.producers.filter((p) => p.requiredM2 > 0 && (p.shortfallM2 ?? Math.max(0, p.requiredM2 - (p.countedM2 ?? p.prunedAreaM2))) > 0 && p.decision !== 'no_license')
            .sort((a, b) => (b.shortfallM2 ?? 0) - (a.shortfallM2 ?? 0));
    }

    // ── Excel ──

    private sheetSummary(wb: ExcelJS.Workbook, d: ReportData): void {
        const ws = wb.addWorksheet('Özet');
        ws.columns = [{ width: 44 }, { width: 28 }];
        const rows: Array<[string, string | number]> = [
            ['Rapor', `Budama sezon raporu · ${seasonLabel(d.season)}`],
            ['Bölge', `${d.area.province} / ${d.area.district} / ${d.area.neighborhood}`],
            ['Oluşturulma', formatDateTimeTr(d.generatedAt)],
            ['Yöntem', d.summary.method],
            ['Kalibrasyon', d.summary.calibrated ? 'Saha etiketleriyle kalibre edildi' : 'Henüz kalibre edilmedi (idari ön değerlendirme)'],
            ['Ruhsat verisi', d.area.demoLicenses ? 'DEMO' : 'ÇAYKUR kaydı'],
            ['Tarama', `${formatDateTr(d.summary.scanFrom)} – ${formatDateTr(d.summary.scanTo)}, her ${d.summary.everyDays} gün (${d.summary.timeline.length} tarama)`],
            ['TKGM parsel kapsaması', d.summary.parcelCoverage != null ? formatPct(d.summary.parcelCoverage) : '—'],
            ['', ''],
            ['Bahçe sayısı', d.summary.gardens.total],
            ...(['pruned', 'likely', 'unclear', 'not_pruned', 'no_data'] as const).map((k) => [`Bahçe · ${FUSION_CLASS_LABEL[k]}`, d.summary.gardens.byClass[k] ?? 0] as [string, number]),
            ['Kesin budanan alan (m²)', Math.round(d.summary.gardens.prunedAreaM2)],
            ['Olası budanan alan (m²)', Math.round(d.summary.gardens.likelyAreaM2)],
            ['', ''],
            ['Müstahsil sayısı', d.summary.producers.total],
            ...DECISION_ORDER.map((k) => [`Alım kararı · ${DECISION_LABEL[k]}`, d.summary.producers.byDecision[k] ?? 0] as [string, number]),
            ...STATUS_ORDER.map((k) => [`Durum · ${PRODUCER_FUSION_LABEL[k]}`, d.summary.producers.byStatus[k] ?? 0] as [string, number]),
            ['', ''],
            ['Parsel dışı serbest çay yaması', d.summary.unassigned.count],
            ['Serbest yamada kesin budanan alan (m²)', Math.round(d.summary.unassigned.prunedAreaM2)],
        ];
        for (const r of rows) ws.addRow(r);
        ws.getColumn(1).font = { bold: true };
    }

    private sheetProducers(wb: ExcelJS.Workbook, d: ReportData): void {
        const ws = wb.addWorksheet('Müstahsiller');
        ws.columns = [
            { header: 'Müstahsil no', key: 'code', width: 14 }, { header: 'Ad soyad', key: 'name', width: 24 }, { header: 'Cüzdan no', key: 'walletNo', width: 14 },
            { header: 'Ruhsat no', key: 'licenseNo', width: 14 }, { header: 'Bahçe', key: 'gardens', width: 8 }, { header: 'Ruhsat alanı (m²)', key: 'licensedAreaM2', width: 16 },
            { header: '1/7 hedefi (m²)', key: 'requiredM2', width: 14 }, { header: 'Kesin budanan (m²)', key: 'prunedAreaM2', width: 16 }, { header: 'Olası budanan (m²)', key: 'likelyAreaM2', width: 16 },
            { header: 'Tekrar, sayılmadı (m²)', key: 'reusedM2', width: 18 }, { header: 'Sayılan yeni alan (m²)', key: 'countedM2', width: 18 }, { header: 'Eksik (m²)', key: 'shortfallM2', width: 12 },
            { header: 'Hedef oranı', key: 'ratio', width: 12 }, { header: 'Durum', key: 'status', width: 20 }, { header: 'Alım kararı', key: 'decision', width: 30 },
            { header: 'Anomaliler', key: 'anomalies', width: 32 }, { header: 'Gerekçe', key: 'reason', width: 50 }, { header: 'İlk kesin tespit', key: 'firstDetectedAt', width: 14 },
            { header: 'Kesin bahçeler', key: 'prunedGardens', width: 24 }, { header: 'Olası bahçeler', key: 'likelyGardens', width: 24 },
        ];
        for (const p of d.producers) {
            ws.addRow({
                code: p.code, name: p.name, walletNo: p.walletNo, licenseNo: p.licenseNo, gardens: p.gardens, licensedAreaM2: Math.round(p.licensedAreaM2), requiredM2: Math.round(p.requiredM2),
                prunedAreaM2: Math.round(p.prunedAreaM2), likelyAreaM2: Math.round(p.likelyAreaM2), reusedM2: Math.round(p.reusedM2 ?? 0), countedM2: Math.round(p.countedM2 ?? p.prunedAreaM2),
                shortfallM2: Math.round(p.shortfallM2 ?? 0), ratio: p.ratio, status: PRODUCER_FUSION_LABEL[p.status], decision: DECISION_LABEL[p.decision ?? 'no_data'],
                anomalies: (p.anomalies ?? []).map((a) => ANOMALY_LABEL[a] ?? a).join(', '), reason: p.decisionReason ?? '', firstDetectedAt: p.firstDetectedAt ?? '',
                prunedGardens: p.prunedGardens.join(' '), likelyGardens: p.likelyGardens.join(' '),
            });
        }
        this.styleHeader(ws);
        ws.autoFilter = { from: 'A1', to: `${ws.getColumn(ws.columnCount).letter}1` };
    }

    private sheetGardens(wb: ExcelJS.Workbook, d: ReportData): void {
        const ws = wb.addWorksheet('Bahçeler');
        ws.columns = [
            { header: 'Bahçe kodu', key: 'code', width: 14 }, { header: 'Ada/Parsel', key: 'parcel', width: 12 }, { header: 'Mevkii', key: 'locality', width: 16 }, { header: 'Hisse', key: 'share', width: 8 },
            { header: 'Müstahsil', key: 'producer', width: 24 }, { header: 'Müstahsil no', key: 'producerCode', width: 14 }, { header: 'Ruhsat', key: 'license', width: 14 },
            { header: 'Alan (m²)', key: 'areaM2', width: 10 }, { header: 'Ruhsat alanı (m²)', key: 'licensedAreaM2', width: 14 }, { header: 'Karar birimi', key: 'unit', width: 12 }, { header: 'Birim alanı (m²)', key: 'unitAreaM2', width: 14 }, { header: 'Budanan alan (m²)', key: 'prunedM2', width: 14 }, { header: 'Alt sınır (m²)', key: 'prunedLowM2', width: 12 }, { header: 'Üst sınır (m²)', key: 'prunedHighM2', width: 12 }, { header: 'Alan yöntemi', key: 'prunedMethod', width: 18 },
            { header: 'Karar', key: 'class', width: 16 }, { header: 'z', key: 'z', width: 8 }, { header: 'p', key: 'p', width: 8 }, { header: 'Optik', key: 'optical', width: 8 }, { header: 'Radar', key: 'radar', width: 8 },
            { header: 'Değişim', key: 'changeDate', width: 12 }, { header: 'Kesin tespit', key: 'detectedAt', width: 12 }, { header: 'Olası tespit', key: 'likelyAt', width: 12 },
            { header: 'Tekrar (m²)', key: 'reusedM2', width: 12 }, { header: 'Sayılan (m²)', key: 'countedM2', width: 12 }, { header: 'Gerekçe', key: 'reason', width: 60 },
        ];
        for (const g of d.gardens) {
            ws.addRow({
                code: g.code, parcel: `${g.block}/${g.parcel}`, locality: g.locality, share: g.holderCount > 1 ? `${g.holderIndex}/${g.holderCount}` : '', producer: g.producerName, producerCode: g.producerCode,
                license: g.licenseCode ?? '', areaM2: g.areaM2, licensedAreaM2: g.licensedAreaM2 != null ? Math.round(g.licensedAreaM2) : '', unit: g.unit === 'patch' ? 'optik yama' : 'bahçe', unitAreaM2: Math.round(g.unitAreaM2), prunedM2: g.prunedArea?.m2 ?? '', prunedLowM2: g.prunedArea?.lowM2 ?? '', prunedHighM2: g.prunedArea?.highM2 ?? '', prunedMethod: g.prunedArea ? ({ pixel_scan: 'piksel taraması', change_patch: 'optik yama', ndvi_fraction: 'NDVI payı' }[g.prunedArea.method]) : '',
                class: FUSION_CLASS_LABEL[g.class], z: g.z != null ? Math.round(g.z * 100) / 100 : '', p: Math.round(g.p * 1000) / 1000, optical: g.opticalOk ? 'Evet' : 'Hayır', radar: g.backscatterOk ? 'Evet' : 'Hayır',
                changeDate: g.changeDate ?? '', detectedAt: g.detectedAt ?? '', likelyAt: g.likelyAt ?? '', reusedM2: g.repeat ? Math.round(g.repeat.reusedM2) : 0, countedM2: g.repeat ? Math.round(g.repeat.countedM2) : Math.round(g.unitAreaM2), reason: g.reason,
            });
        }
        this.styleHeader(ws);
        ws.autoFilter = { from: 'A1', to: `${ws.getColumn(ws.columnCount).letter}1` };
    }

    private sheetShortfalls(wb: ExcelJS.Workbook, d: ReportData): void {
        const ws = wb.addWorksheet('Eksik budama');
        ws.columns = [
            { header: 'Müstahsil no', key: 'code', width: 14 }, { header: 'Ad soyad', key: 'name', width: 24 }, { header: 'Cüzdan no', key: 'walletNo', width: 14 },
            { header: '1/7 hedefi (m²)', key: 'requiredM2', width: 14 }, { header: 'Sayılan (m²)', key: 'countedM2', width: 12 }, { header: 'Eksik (m²)', key: 'shortfallM2', width: 12 },
            { header: 'Tekrar, sayılmadı (m²)', key: 'reusedM2', width: 18 }, { header: 'Alım kararı', key: 'decision', width: 30 }, { header: 'Gerekçe', key: 'reason', width: 50 },
        ];
        for (const p of this.shortfalls(d)) {
            ws.addRow({ code: p.code, name: p.name, walletNo: p.walletNo, requiredM2: Math.round(p.requiredM2), countedM2: Math.round(p.countedM2 ?? p.prunedAreaM2), shortfallM2: Math.round(p.shortfallM2 ?? 0), reusedM2: Math.round(p.reusedM2 ?? 0), decision: DECISION_LABEL[p.decision ?? 'no_data'], reason: p.decisionReason ?? '' });
        }
        this.styleHeader(ws);
    }

    private sheetAnomalies(wb: ExcelJS.Workbook, d: ReportData): void {
        const ws = wb.addWorksheet('Anomaliler (eksper)');
        ws.columns = [
            { header: 'Müstahsil no', key: 'code', width: 14 }, { header: 'Ad soyad', key: 'name', width: 24 }, { header: 'Cüzdan no', key: 'walletNo', width: 14 },
            { header: 'Anomaliler', key: 'anomalies', width: 40 }, { header: 'Sayılan (m²)', key: 'countedM2', width: 12 }, { header: '1/7 hedefi (m²)', key: 'requiredM2', width: 14 },
            { header: 'Gerekçe', key: 'reason', width: 60 },
        ];
        for (const p of d.producers.filter((x) => x.decision === 'expert_anomaly')) {
            ws.addRow({ code: p.code, name: p.name, walletNo: p.walletNo, anomalies: (p.anomalies ?? []).map((a) => ANOMALY_LABEL[a] ?? a).join(', '), countedM2: Math.round(p.countedM2 ?? p.prunedAreaM2), requiredM2: Math.round(p.requiredM2), reason: p.decisionReason ?? '' });
        }
        this.styleHeader(ws);
    }

    private sheetLocalities(wb: ExcelJS.Workbook, d: ReportData): void {
        const ws = wb.addWorksheet('Mevkii özeti');
        ws.columns = [
            { header: 'Mevkii', key: 'name', width: 20 }, { header: 'Bahçe', key: 'total', width: 8 }, { header: 'Müstahsil', key: 'producers', width: 10 },
            { header: 'Budandı', key: 'pruned', width: 10 }, { header: 'Olası', key: 'likely', width: 8 }, { header: 'Belirsiz', key: 'unclear', width: 10 }, { header: 'Budama yok', key: 'notPruned', width: 12 },
            { header: 'Budanan alan (m²)', key: 'prunedM2', width: 16 }, { header: 'Budanan bahçe payı', key: 'share', width: 18 },
        ];
        for (const r of this.byLocality(d)) ws.addRow({ ...r, prunedM2: Math.round(r.prunedM2), share: r.total ? Math.round(((r.pruned + r.likely) / r.total) * 100) / 100 : 0 });
        this.styleHeader(ws);
    }

    private sheetUnassigned(wb: ExcelJS.Workbook, d: ReportData): void {
        const ws = wb.addWorksheet('Serbest yamalar');
        ws.columns = [
            { header: 'Yama', key: 'id', width: 12 }, { header: 'Alan (m²)', key: 'areaM2', width: 10 }, { header: 'Karar', key: 'class', width: 16 }, { header: 'z', key: 'z', width: 8 },
            { header: 'Değişim', key: 'changeDate', width: 12 }, { header: 'Kesin tespit', key: 'detectedAt', width: 12 }, { header: 'Not', key: 'note', width: 60 },
        ];
        for (const u of d.summary.unassigned.patches) {
            ws.addRow({ id: u.id, areaM2: Math.round((u as unknown as { areaM2: number }).areaM2 ?? 0), class: FUSION_CLASS_LABEL[(u.verdict.class as keyof typeof FUSION_CLASS_LABEL) ?? 'no_data'] ?? u.verdict.class, z: u.verdict.z != null ? Math.round(u.verdict.z * 100) / 100 : '', changeDate: u.verdict.changeDate ?? '', detectedAt: u.detectedAt ?? '', note: 'TKGM parseli henüz çekilmemiş çaylık; parseli gelince sahibine bağlanacak' });
        }
        this.styleHeader(ws);
    }

    private sheetLicensing(wb: ExcelJS.Workbook, d: ReportData): void {
        const ws = wb.addWorksheet('Ruhsat uyuşmazlıkları');
        ws.columns = [
            { header: 'Bahçe kodu', key: 'code', width: 14 }, { header: 'Ada/Parsel', key: 'parcel', width: 12 }, { header: 'Mevkii', key: 'locality', width: 16 }, { header: 'Müstahsil no', key: 'producerCode', width: 14 },
            { header: 'Ruhsat', key: 'license', width: 14 }, { header: 'Sınır durumu', key: 'approval', width: 18 }, { header: 'Ruhsatta yazan (m²)', key: 'licensedAreaM2', width: 16 },
            { header: 'İzdüşüm (m²)', key: 'planimetricAreaM2', width: 12 }, { header: 'Uyduda çay (m²)', key: 'teaM2', width: 14 }, { header: 'Uyuşmazlıklar', key: 'discrepancies', width: 40 },
        ];
        for (const g of d.gardenEntities.filter((x) => x.discrepancies.length > 0 || x.approvalStatus !== 'approved')) {
            ws.addRow({
                code: g.code, parcel: `${g.block}/${g.parcel}`, locality: g.locality, producerCode: g.producerCode, license: g.licenseCode ?? '', approval: APPROVAL_LABEL[g.approvalStatus] ?? g.approvalStatus,
                licensedAreaM2: g.licensedAreaM2 != null ? Math.round(g.licensedAreaM2) : '', planimetricAreaM2: Math.round(g.planimetricAreaM2), teaM2: Math.round(g.measuredTeaAreaM2),
                discrepancies: g.discrepancies.map((x) => DISCREPANCY_LABEL[x] ?? x).join(', '),
            });
        }
        this.styleHeader(ws);
    }

    private styleHeader(ws: ExcelJS.Worksheet): void {
        ws.getRow(1).font = { bold: true };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        ws.views = [{ state: 'frozen', ySplit: 1 }];
    }

    // ── PDF ──

    private pdfCover(doc: Pdf, d: ReportData): void {
        const w = doc.page.width;
        doc.save();
        doc.rect(0, 0, w, 64).fill(GREEN);
        doc.font(FONT_BOLD).fontSize(15).fillColor('#ffffff').text('BUDAMA SEZON RAPORU', doc.page.margins.left, 16, { lineBreak: false });
        doc.font(FONT).fontSize(9).fillColor('#dcfce7').text(`ÇAYKUR · Çay Envanteri · ${d.area.province} / ${d.area.district} / ${d.area.neighborhood} · Sezon ${seasonLabel(d.season)}`, doc.page.margins.left, 38, { lineBreak: false });
        doc.font(FONT).fontSize(8.5).fillColor('#ffffff').text(`Oluşturulma ${formatDateTimeTr(d.generatedAt)}`, doc.page.margins.left, 50, { lineBreak: false });
        if (d.area.demoLicenses) badge(doc, 'DEMO VERİSİ', ORANGE, w - doc.page.margins.right - 84, 18, 9);
        doc.restore();
        doc.y = 80;
        doc.x = doc.page.margins.left;
        h2(doc, 'Kapsam ve yöntem');
        kvGrid(doc, [
            ['Tarama dönemi', `${formatDateTr(d.summary.scanFrom)} – ${formatDateTr(d.summary.scanTo)}`],
            ['Tarama sıklığı', `her ${d.summary.everyDays} gün · ${d.summary.timeline.length} tarama`],
            ['TKGM parsel kapsaması', d.summary.parcelCoverage != null ? formatPct(d.summary.parcelCoverage) : '—'],
            ['Sensörler', `S2 optik ${d.summary.sensors.optical.dates.length} tarih · S1 radar ${d.summary.sensors.backscatter.reduce((t, p) => t + p.dates.length, 0)} tarih`],
            ['Kalibrasyon', d.summary.calibrated ? 'Saha etiketli' : 'Henüz yok'],
            ['Ruhsat verisi', d.area.demoLicenses ? 'DEMO' : 'ÇAYKUR kaydı'],
        ]);
        h2(doc, 'Bahçeler');
        kvGrid(doc, [
            ['Bahçe', String(d.summary.gardens.total)],
            ['Budandı (kesin)', String(d.summary.gardens.byClass.pruned ?? 0)],
            ['Olası budama', String(d.summary.gardens.byClass.likely ?? 0)],
            ['Belirsiz', String(d.summary.gardens.byClass.unclear ?? 0)],
            ['Budama yok', String(d.summary.gardens.byClass.not_pruned ?? 0)],
            ['Kesin + olası alan', formatM2(d.summary.gardens.prunedAreaM2 + d.summary.gardens.likelyAreaM2)],
        ]);
        h2(doc, 'Müstahsiller ve alım kararı');
        const x0 = doc.page.margins.left;
        let y = doc.y;
        for (const k of DECISION_ORDER) {
            const n = d.summary.producers.byDecision[k] ?? 0;
            if (!n) continue;
            const bw = badge(doc, `${DECISION_LABEL[k]}: ${n}`, DECISION_COLOR[k], x0, y, 8.5);
            void bw;
            y += 20;
        }
        doc.y = y + 4;
        doc.x = x0;
        para(doc, `${d.summary.producers.total} müstahsil değerlendirildi. Karar politikası: kanıt temizse sistem kendi karar verir (olası budama da kabul edilir); eksper yalnızca çelişki, tekrar, sınır ve ruhsat anomalilerini görür.`, { size: 9, color: MUTED });
        h2(doc, 'Mevkii bazında');
        table(doc, {
            columns: [{ header: 'Mevkii', width: 120 }, { header: 'Bahçe', width: 50, align: 'right' }, { header: 'Müstahsil', width: 60, align: 'right' }, { header: 'Budandı', width: 55, align: 'right' }, { header: 'Olası', width: 50, align: 'right' }, { header: 'Belirsiz', width: 55, align: 'right' }, { header: 'Yok', width: 45, align: 'right' }, { header: 'Budanan bahçe payı', width: 76, align: 'right' }],
            rows: this.byLocality(d).map((r) => [r.name, String(r.total), String(r.producers), String(r.pruned), String(r.likely), String(r.unclear), String(r.notPruned), formatPct(r.total ? (r.pruned + r.likely) / r.total : 0)]),
        });
    }

    private pdfLists(doc: Pdf, d: ReportData): void {
        const LIMIT = 45;
        const note = (n: number) => (n > LIMIT ? `İlk ${LIMIT} satır; tam liste Excel raporunda (${n} kayıt).` : `${n} kayıt.`);
        const pcols = [{ header: 'Müstahsil', width: 150 }, { header: 'Cüzdan', width: 70 }, { header: 'Hedef', width: 60, align: 'right' as const }, { header: 'Sayılan', width: 60, align: 'right' as const }, { header: 'Eksik', width: 55, align: 'right' as const }, { header: 'Not', width: 116 }];
        doc.addPage();
        const open = d.producers.filter((p) => p.decision === 'auto_open');
        h2(doc, `Çay satabilir · otomatik açık (${open.length})`, GREEN);
        para(doc, note(open.length), { size: 8, color: MUTED });
        table(doc, { columns: pcols, rows: open.slice(0, LIMIT).map((p) => [`${p.name} · ${p.code}`, p.walletNo, formatM2(p.requiredM2), formatM2(p.countedM2 ?? p.prunedAreaM2), '—', p.reusedM2 ? `tekrar ${formatM2(p.reusedM2)} sayılmadı` : (p.likelyAreaM2 && !p.prunedAreaM2 ? 'olası budama ile' : '')]) });
        const short = this.shortfalls(d);
        h2(doc, `Hedefi dolmayanlar (${short.length})`, ORANGE);
        para(doc, note(short.length), { size: 8, color: MUTED });
        table(doc, { columns: pcols, rows: short.slice(0, LIMIT).map((p) => [`${p.name} · ${p.code}`, p.walletNo, formatM2(p.requiredM2), formatM2(p.countedM2 ?? p.prunedAreaM2), { text: formatM2(p.shortfallM2 ?? 0), color: RED, bold: true }, DECISION_LABEL[p.decision ?? 'no_data']]) });
        const anomalies = d.producers.filter((p) => p.decision === 'expert_anomaly');
        h2(doc, `Eksper kuyruğu · anomaliler (${anomalies.length})`, ORANGE);
        para(doc, note(anomalies.length), { size: 8, color: MUTED });
        table(doc, { columns: [{ header: 'Müstahsil', width: 150 }, { header: 'Cüzdan', width: 70 }, { header: 'Anomaliler', width: 140 }, { header: 'Gerekçe', width: 151 }], rows: anomalies.slice(0, LIMIT).map((p) => [`${p.name} · ${p.code}`, p.walletNo, (p.anomalies ?? []).map((a) => ANOMALY_LABEL[a] ?? a).join(', '), p.decisionReason ?? '']) });
        const noLicense = d.producers.filter((p) => p.decision === 'no_license');
        if (noLicense.length) {
            h2(doc, `Ruhsatı olmayanlar (${noLicense.length})`, RED);
            table(doc, { columns: [{ header: 'Müstahsil', width: 200 }, { header: 'Cüzdan', width: 100 }, { header: 'Bahçe', width: 60, align: 'right' }, { header: 'Budanan', width: 151, align: 'right' }], rows: noLicense.slice(0, LIMIT).map((p) => [`${p.name} · ${p.code}`, p.walletNo, String(p.gardens), formatM2(p.prunedAreaM2 + p.likelyAreaM2)]) });
        }
        if (d.summary.unassigned.count) {
            h2(doc, `Parsel dışı serbest çay yamaları (${d.summary.unassigned.count})`, BLUE);
            para(doc, `TKGM parseli henüz çekilmemiş ${formatM2(d.summary.unassigned.areaM2)} çaylık; ${d.summary.unassigned.byClass.pruned ?? 0} yama kesin budandı, ${d.summary.unassigned.byClass.likely ?? 0} olası. Parsel gelince sahibine bağlanır.`, { size: 9 });
        }
        para(doc, `Bu rapor ${d.gardens.length} bahçe ve ${d.producers.length} müstahsilin uydu tabanlı çok-sensör değerlendirmesini özetler; bahçe bazlı kanıtlar müstahsil kanıt dosyalarındadır.`, { size: 8, color: MUTED });
        void INK;
        void formatNum;
    }
}
