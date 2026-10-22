import { createHash } from 'crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProducerScanBlock, TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { FusionDecision, ProducerFusion, TeaInventoryProducer } from '@/tea-inventory/entities/tea-inventory-producer.entity';
import { FusionClass, GardenFusion, TeaInventoryGarden } from '@/tea-inventory/entities/tea-inventory-garden.entity';
import { TeaInventoryLicense } from '@/tea-inventory/entities/tea-inventory-license.entity';
import { TeaInventoryParcel } from '@/tea-inventory/entities/tea-inventory-parcel.entity';
import { PruningDecision } from '@/tea-inventory/entities/pruning-decision.entity';
import { PruningFusionService } from '@/tea-inventory/pruning-fusion.service';
import {
    ANOMALY_LABEL, APPROVAL_LABEL, CHANNEL_LABEL, DECISION_LABEL, DISCREPANCY_LABEL, FUSION_CLASS_LABEL, GROUP_LABEL, MATCH_LEVEL_LABEL,
    PRODUCER_FUSION_LABEL, formatDateTimeTr, formatDateTr, formatM2, formatNum, formatPct, seasonLabel,
} from '@/tea-inventory/report/labels';
import {
    BLUE, FONT, FONT_BOLD, GREEN, INK, LINE, MUTED, ORANGE, Pdf, RED, SOFT, badge, bottomY, contentWidth, createPdf, ensureSpace, finishPdf, h1, h2, jpegSize, kvGrid,
    lineChart, para, scanStrip, table,
} from '@/tea-inventory/report/pdf';

export interface EvidenceFile {
    buffer: Buffer;
    filename: string;
}

type Scene = { date: string; file: string; teaVisible: number; teaMedianNdvi: number };
type Bounds = { west: number; south: number; east: number; north: number };
type Ring = Array<[number, number]>;

const CLASS_COLOR: Record<FusionClass, string> = { pruned: GREEN, likely: BLUE, unclear: ORANGE, not_pruned: MUTED, no_data: MUTED };
const DECISION_COLOR: Record<FusionDecision, string> = { auto_open: GREEN, auto_pending: MUTED, auto_short: ORANGE, auto_none: MUTED, expert_anomaly: ORANGE, no_license: RED, no_data: MUTED };
const FETCH_TIMEOUT_MS = 8000;

/** Fetches and memoises the Sentinel-2 scene images of a season (served by the web app's public folder). */
class SceneCache {
    private readonly cache = new Map<string, Promise<{ buf: Buffer; width: number; height: number } | null>>();
    constructor(private readonly base: string, readonly bounds: Bounds, readonly scenes: Scene[], private readonly log: Logger) { }

    get(file: string): Promise<{ buf: Buffer; width: number; height: number } | null> {
        let p = this.cache.get(file);
        if (!p) {
            p = this.fetch(file);
            this.cache.set(file, p);
        }
        return p;
    }

    private async fetch(file: string): Promise<{ buf: Buffer; width: number; height: number } | null> {
        const url = `${this.base}${file}`;
        try {
            const ctl = new AbortController();
            const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
            const res = await fetch(url, { signal: ctl.signal });
            clearTimeout(timer);
            if (!res.ok) return null;
            const buf = Buffer.from(await res.arrayBuffer());
            const size = jpegSize(buf);
            return size ? { buf, ...size } : null;
        } catch (err) {
            this.log.warn(`Scene image unavailable: ${url} (${(err as Error).message})`);
            return null;
        }
    }
}

/**
 * The evidence pack: one PDF per producer (or garden) with the licence record, the purchase
 * decision and, garden by garden, the multi-sensor proof — channel steps, z-scores, before /
 * after Sentinel-2 scenes, the scan timeline and the 7-season repeat evidence. Built from the
 * same rows the screens show, so the paper matches the screen.
 */
@Injectable()
export class EvidenceService {
    private readonly logger = new Logger(EvidenceService.name);

    constructor(
        @InjectRepository(TeaInventoryArea) private readonly areaRepo: Repository<TeaInventoryArea>,
        @InjectRepository(TeaInventoryProducer) private readonly producerRepo: Repository<TeaInventoryProducer>,
        @InjectRepository(TeaInventoryGarden) private readonly gardenRepo: Repository<TeaInventoryGarden>,
        @InjectRepository(TeaInventoryLicense) private readonly licenseRepo: Repository<TeaInventoryLicense>,
        @InjectRepository(TeaInventoryParcel) private readonly parcelRepo: Repository<TeaInventoryParcel>,
        @InjectRepository(PruningDecision) private readonly decisionRepo: Repository<PruningDecision>,
        private readonly fusion: PruningFusionService,
        private readonly config: ConfigService,
    ) { }

    async producerPdf(areaId: string, code: string, requested?: string): Promise<EvidenceFile> {
        const area = await this.findArea(areaId);
        const season = this.fusion.resolveSeason(area, requested);
        const scenes = this.sceneCache(area, season);
        const buffer = await this.buildProducerPdf(area, season, code, scenes);
        return { buffer, filename: `kanit-${code}-${season}.pdf` };
    }

    /** Several producers with one scene cache (the Ministry package). Missing producers are skipped. */
    async producerPdfBatch(areaId: string, codes: string[], requested?: string): Promise<Map<string, Buffer>> {
        const area = await this.findArea(areaId);
        const season = this.fusion.resolveSeason(area, requested);
        const scenes = this.sceneCache(area, season);
        const out = new Map<string, Buffer>();
        for (const code of codes) {
            try {
                out.set(code, await this.buildProducerPdf(area, season, code, scenes));
            } catch (err) {
                this.logger.warn(`Evidence PDF skipped for ${code}: ${(err as Error).message}`);
            }
        }
        return out;
    }

    async gardenPdf(gardenId: string): Promise<EvidenceFile> {
        const garden = await this.gardenRepo.findOne({ where: { id: gardenId } });
        if (!garden) throw new NotFoundException('Garden not found');
        const area = await this.findArea(garden.areaId);
        const season = this.fusion.resolveSeason(area);
        const f = garden.seasons[season]?.fusion;
        if (!f) throw new NotFoundException('No fusion verdict for this garden');
        const scenes = this.sceneCache(area, season);
        const producer = await this.producerRepo.findOne({ where: { areaId: area.id, code: garden.producerCode, season } });
        const parcel = await this.parcelRepo.findOne({ where: { areaId: area.id, parcelKey: garden.parcelKey } });
        const license = garden.licenseCode ? await this.licenseRepo.findOne({ where: { areaId: area.id, code: garden.licenseCode } }) : null;
        const doc = createPdf({ title: `Bahçe kanıtı ${garden.block}/${garden.parcel} · ${seasonLabel(season)}` });
        const evidenceId = this.evidenceId([area.code, garden.code, season, f.detectedAt ?? '', f.verdict.z ?? '']);
        this.header(doc, area, season, 'BAHÇE KANIT DOSYASI', producer?.name ?? garden.producerCode);
        await this.gardenSection(doc, area, season, garden, f, parcel, license, scenes, true);
        const buffer = await finishPdf(doc, (d, page, total) => this.footer(d, area, evidenceId, page, total));
        return { buffer, filename: `kanit-bahce-${garden.block}-${garden.parcel}-${season}.pdf` };
    }

    // ── producer document ──

    private async buildProducerPdf(area: TeaInventoryArea, season: string, code: string, scenes: SceneCache | null): Promise<Buffer> {
        const producer = await this.producerRepo.findOne({ where: { areaId: area.id, code, season } });
        if (!producer) throw new NotFoundException('Producer not found for this season');
        const [gardens, licenses, decisions] = await Promise.all([
            this.gardenRepo.find({ where: { areaId: area.id, producerCode: code }, order: { parcelKey: 'ASC', holderIndex: 'ASC' } }),
            this.licenseRepo.find({ where: { areaId: area.id, producerCode: code }, order: { code: 'ASC' } }),
            this.decisionRepo.find({ where: { areaCode: area.code, producerCode: code, season }, order: { createdAt: 'DESC' }, take: 1 }),
        ]);
        const parcels = await this.parcelRepo.find({ where: { areaId: area.id, parcelKey: In(gardens.map((g) => g.parcelKey)) } });
        const parcelByKey = new Map(parcels.map((p) => [p.parcelKey, p]));
        const licenseByCode = new Map(licenses.map((l) => [l.code, l]));
        const fusion = producer.fusion;
        const expert = decisions[0] ?? null;
        const evidenceId = this.evidenceId([area.code, code, season, fusion?.decision ?? '', fusion?.countedM2 ?? '', expert?.id ?? '']);

        const doc = createPdf({ title: `Budama kanıt dosyası · ${producer.name} · ${seasonLabel(season)}` });
        this.header(doc, area, season, 'BUDAMA KANIT DOSYASI', producer.name);

        // Identity
        h2(doc, 'Müstahsil ve ruhsat');
        const localities = [...new Set(gardens.map((g) => g.locality).filter(Boolean))];
        kvGrid(doc, [
            ['Ad soyad', producer.name],
            ['Müstahsil no', producer.code],
            ['Cüzdan no', producer.walletNo || '—'],
            ['Ruhsat no', producer.licenseNo || (licenses[0]?.code ?? 'Ruhsat yok')],
            ['Ruhsat alanı', formatM2(producer.licensedAreaM2)],
            ['1/7 hedefi', formatM2(producer.requiredM2)],
            ['Bahçe sayısı', String(gardens.length)],
            ['Mevkii', localities.join(', ') || '—'],
            ['Uyduda ölçülen çay', formatM2(producer.teaAreaM2)],
        ]);
        if (licenses.length > 0) {
            table(doc, {
                columns: [
                    { header: 'Ruhsat', width: 70 }, { header: 'Durum', width: 44 }, { header: 'Yıl', width: 32 }, { header: 'Ruhsatta yazan', width: 84, align: 'right' },
                    { header: 'Eşleşme', width: 78 }, { header: 'Ruhsattaki parsel kaydı', width: 203 },
                ],
                rows: licenses.map((l) => [
                    l.code, l.status === 'active' ? 'Aktif' : l.status, String(l.issuedYear), formatM2(l.recordedAreaM2), MATCH_LEVEL_LABEL[l.matchLevel] ?? l.matchLevel,
                    (l.recordedParcelRefs ?? []).join('; ') + (l.holderDeceased ? ' · sahibi vefat etmiş' : ''),
                ]),
            });
        }

        // Decision
        h2(doc, 'Alım kararı');
        if (fusion) {
            this.decisionBlock(doc, fusion, expert);
        } else {
            para(doc, 'Bu sezon için çok-sensör kararı üretilmemiş.', { color: MUTED });
        }

        // Garden summary
        h2(doc, 'Bahçeler ve kararları');
        const rows = gardens.map((g) => {
            const f = g.seasons[season]?.fusion ?? null;
            return [
                `${g.block}/${g.parcel}${g.holderCount > 1 ? ` · hisse ${g.holderIndex}/${g.holderCount}` : ''}`,
                g.locality || '—',
                formatM2(g.planimetricAreaM2 || g.geometryAreaM2),
                formatM2(g.licensedAreaM2),
                f ? { text: FUSION_CLASS_LABEL[f.verdict.class], color: CLASS_COLOR[f.verdict.class], bold: true } : { text: 'Veri yok', color: MUTED },
                f?.verdict.z != null ? formatNum(f.verdict.z) : '—',
                formatDateTr(f?.verdict.changeDate ?? null),
                formatDateTr(f?.detectedAt ?? f?.likelyAt ?? null),
                f?.repeat?.reusedM2 ? formatM2(f.repeat.reusedM2) : '—',
            ];
        });
        table(doc, {
            columns: [
                { header: 'Ada/Parsel', width: 86 }, { header: 'Mevkii', width: 62 }, { header: 'Alan', width: 54, align: 'right' }, { header: 'Ruhsat', width: 54, align: 'right' },
                { header: 'Karar', width: 78 }, { header: 'z', width: 30, align: 'right' }, { header: 'Değişim', width: 54 }, { header: 'Tespit', width: 54 }, { header: 'Tekrar', width: 39, align: 'right' },
            ],
            rows,
        });
        this.methodNote(doc, area, season);

        // One section per garden
        for (const g of gardens) {
            const f = g.seasons[season]?.fusion;
            if (!f) continue;
            doc.addPage();
            await this.gardenSection(doc, area, season, g, f, parcelByKey.get(g.parcelKey) ?? null, g.licenseCode ? (licenseByCode.get(g.licenseCode) ?? null) : null, scenes, false);
        }
        return finishPdf(doc, (d, page, total) => this.footer(d, area, evidenceId, page, total));
    }

    private decisionBlock(doc: Pdf, f: ProducerFusion, expert: PruningDecision | null): void {
        const decision = f.decision ?? 'no_data';
        ensureSpace(doc, 120);
        const x0 = doc.page.margins.left;
        const y0 = doc.y;
        const w = contentWidth(doc);
        doc.roundedRect(x0, y0, w, 26, 6).fill(SOFT);
        badge(doc, DECISION_LABEL[decision], DECISION_COLOR[decision], x0 + 8, y0 + 6, 9);
        doc.font(FONT).fontSize(8.5).fillColor(MUTED).text(PRODUCER_FUSION_LABEL[f.status], x0 + 8, y0 + 34, { lineBreak: false });
        doc.y = y0 + 48;
        doc.x = x0;
        const counted = f.countedM2 ?? f.prunedAreaM2;
        kvGrid(doc, [
            ['Kesin budanan', formatM2(f.prunedAreaM2)],
            ['Olası budanan', formatM2(f.likelyAreaM2)],
            ['Tekrar (sayılmadı)', formatM2(f.reusedM2 ?? 0)],
            ['Sayılan yeni alan', formatM2(counted)],
            ['1/7 hedefi', formatM2(f.requiredM2)],
            ['Hedef oranı', f.requiredM2 > 0 ? formatPct(counted / f.requiredM2) : '—'],
            ['Eksik', formatM2(f.shortfallM2 ?? Math.max(0, f.requiredM2 - counted))],
            ['İlk kesin tespit', formatDateTr(f.firstDetectedAt)],
            ['Kesin / olası bahçe', `${f.prunedGardens.length} / ${f.likelyGardens.length}`],
        ]);
        if (f.decisionReason) para(doc, `Gerekçe: ${f.decisionReason}`);
        if (f.anomalies?.length) {
            doc.moveDown(0.3);
            let x = doc.page.margins.left;
            const y = doc.y;
            for (const a of f.anomalies) x += badge(doc, ANOMALY_LABEL[a] ?? a, ORANGE, x, y, 8) + 6;
            doc.y = y + 20;
            doc.x = doc.page.margins.left;
        }
        if (expert) {
            doc.moveDown(0.3);
            para(doc, `Eksper kararı: ${expert.decision === 'approved' ? 'ONAYLANDI' : 'REDDEDİLDİ'} · ${expert.decidedByName} · ${formatDateTimeTr(expert.createdAt)}${expert.note ? ` · ${expert.note}` : ''}`, { bold: true });
        }
        doc.moveDown(0.3);
    }

    private methodNote(doc: Pdf, area: TeaInventoryArea, season: string): void {
        const block = area.producerScan?.fusion;
        const s = block?.seasons.find((x) => x.season === season);
        const rules = (block?.rules ?? {}) as Record<string, number>;
        const bits = [
            `Yöntem: ${block?.method ?? 'multi-sensor-step-change'} — her bahçe NDVI/NBR (Sentinel-2), VH geri saçılım (Sentinel-1, iki yörünge) ve varsa koherans kanallarında, kendi gürültüsü cinsinden bir basamak değişimi için yargılanır; sensörler Stouffer yöntemiyle birleştirilir.`,
            s ? `Tarama: ${formatDateTr(s.scanFrom)} – ${formatDateTr(s.scanTo)} arasında her ${s.everyDays} günde bir; optik ${s.sensors.optical.dates.length} tarih, radar ${s.sensors.backscatter.map((p) => `${p.pass === 'ASCENDING' ? 'çıkış' : 'iniş'} ${p.dates.length}`).join(' / ')} tarih.` : '',
            `Eşikler: budandı z ≥ ${rules.zPruned ?? 3.5} (optik ve radar birlikte, kalıcı); olası z ≥ ${rules.zLikely ?? 2.8}; belirsiz z ≥ ${rules.zUnclear ?? 1.5}; kalıcılık ≥ ${formatPct(rules.persistenceMin ?? 0.5)}.`,
            `Kalibrasyon: ${block?.calibrated ? 'saha etiketleriyle kalibre edildi' : 'HENÜZ KALİBRE EDİLMEDİ — eşikler sentetik testlerle belirlendi; saha doğrulaması tamamlanana kadar karar idari ön değerlendirme niteliğindedir'}.`,
            area.demoLicenses ? 'Ruhsat ve müstahsil kayıtları DEMO amaçlı üretilmiştir; ÇAYKUR kayıtları yüklenince gerçek değerlerle değişir.' : '',
        ].filter(Boolean);
        h2(doc, 'Yöntem ve sınırlar');
        for (const b of bits) para(doc, b, { size: 8.5, color: MUTED });
    }

    // ── garden section ──

    private async gardenSection(
        doc: Pdf, area: TeaInventoryArea, season: string, g: TeaInventoryGarden, f: GardenFusion, parcel: TeaInventoryParcel | null,
        license: TeaInventoryLicense | null, scenes: SceneCache | null, standalone: boolean,
    ): Promise<void> {
        const v = f.verdict;
        h1(doc, `Bahçe ${g.block}/${g.parcel}${g.holderCount > 1 ? ` · hisse ${g.holderIndex}/${g.holderCount}` : ''} · ${g.locality || 'mevkii yok'}`);
        const x0 = doc.page.margins.left;
        let y = doc.y;
        let x = x0;
        x += badge(doc, FUSION_CLASS_LABEL[v.class], CLASS_COLOR[v.class], x, y, 9) + 6;
        x += badge(doc, v.opticalOk ? 'Optik ✓' : 'Optik —', v.opticalOk ? GREEN : MUTED, x, y, 8) + 4;
        x += badge(doc, v.backscatterOk ? 'Radar ✓' : 'Radar —', v.backscatterOk ? GREEN : MUTED, x, y, 8) + 4;
        if (f.unit === 'patch') x += badge(doc, `Optik yama · ${formatM2(f.unitAreaM2)}`, BLUE, x, y, 8) + 4;
        doc.y = y + 22;
        doc.x = x0;
        kvGrid(doc, [
            ['Bahçe kodu', g.code],
            ['Ruhsat', g.licenseCode ?? 'Ruhsat yok'],
            ['Sınır durumu', APPROVAL_LABEL[g.approvalStatus] ?? g.approvalStatus],
            ['Ruhsatta yazan', formatM2(g.licensedAreaM2)],
            ['TKGM izdüşümü', formatM2(g.planimetricAreaM2 || g.geometryAreaM2)],
            ['Eğimli yüzey (DEM)', `${formatM2(g.surfaceAreaM2)} · ${formatNum(g.meanSlopeDeg, 1)}°`],
            ['Uyduda ölçülen çay', formatM2(g.measuredTeaAreaM2)],
            ['Parsel niteliği', parcel?.nature ?? '—'],
            ['Tapu alanı', formatM2(parcel?.deedAreaM2 ?? null)],
        ]);
        if (g.discrepancies.length > 0 || (license && license.matchLevel !== 'exact')) {
            const notes = [
                ...g.discrepancies.map((d) => DISCREPANCY_LABEL[d] ?? d),
                ...(license && license.matchLevel !== 'exact' ? [`Ruhsat eşleşmesi: ${MATCH_LEVEL_LABEL[license.matchLevel]}`] : []),
            ];
            para(doc, `Uyuşmazlık notları: ${notes.join(' · ')}`, { color: ORANGE, size: 9 });
        }

        // Verdict
        h2(doc, 'Karar ve kanıt');
        kvGrid(doc, [
            ['Birleşik z', v.z != null ? formatNum(v.z, 2) : '—'],
            ['Olasılık (p)', formatPct(v.p)],
            ['Değişim tarihi', formatDateTr(v.changeDate)],
            ['Son değişimsiz gözlem', formatDateTr(v.lastBeforeAt)],
            ['İlk değişimli gözlem', formatDateTr(v.firstAfterAt)],
            ['Kesin tespit', formatDateTr(f.detectedAt)],
            ['Olası tespit', formatDateTr(f.likelyAt)],
            ['Uyuşan sensör', String(v.agreeing)],
            ['Karar birimi', f.unit === 'patch' ? 'optik değişim yaması' : 'bahçenin tamamı'],
        ]);
        para(doc, v.reason, { size: 9 });
        doc.moveDown(0.3);
        table(doc, {
            columns: [
                { header: 'Kanal', width: 118 }, { header: 'Önce / sonra / geç', width: 88, align: 'center' }, { header: 'Basamak', width: 62, align: 'right' },
                { header: 'Gürültü', width: 58, align: 'right' }, { header: 'z', width: 48, align: 'right' }, { header: 'Kalıcılık', width: 62, align: 'right' }, { header: 'Büyüklük', width: 75, align: 'center' },
            ],
            rows: v.groups.flatMap((grp) => [
                [{ text: `${GROUP_LABEL[grp.group]} (grup z ${grp.z != null ? formatNum(grp.z, 2) : '—'})`, bold: true }, '', '', '', '', '', ''],
                ...grp.channels.map((c) => {
                    const db = c.key.startsWith('vh');
                    return [
                        CHANNEL_LABEL[c.key] ?? c.key,
                        `${c.before} / ${c.after} / ${c.late}`,
                        c.delta != null ? `${formatNum(c.delta, db ? 2 : 3)}${db ? ' dB' : ''}` : '—',
                        `±${formatNum(c.noise, db ? 2 : 3)}`,
                        c.z != null ? { text: formatNum(c.z, 2), color: (c.z ?? 0) >= 2.8 ? GREEN : (c.z ?? 0) <= -1.5 ? RED : INK, bold: true } : '—',
                        c.persistence != null ? formatPct(c.persistence) : 'bekleniyor',
                        c.magnitudeOk ? 'eşik üstü' : 'eşik altı',
                    ];
                }),
            ]),
        });
        para(doc, 'Basamak: sonra – önce ortalaması, budama yönünde pozitif (NDVI/NBR/VH düşer, koherans yükselir). z = basamak / (gürültü · √(1/n_önce + 1/n_sonra)); kalıcılık, geç gözlemlerde kalan pay.', { size: 7.5, color: MUTED });

        // Charts
        const block = area.producerScan?.fusion;
        const s = block?.seasons.find((x) => x.season === season);
        const rules = (block?.rules ?? {}) as Record<string, number>;
        const from = s ? this.shiftDate(s.scanFrom, -70) : (f.series[0]?.dates[0] ?? '2025-09-01');
        const to = s?.scanTo ?? f.series[0]?.dates.at(-1) ?? '2026-04-30';
        const markers = v.changeDate ? [{ date: v.changeDate, label: 'değişim', color: RED }] : [];
        const shade = v.changeDate
            ? [
                { from: this.shiftDate(v.changeDate, -(rules.beforeDays ?? 60)), to: v.changeDate, color: '#f1f5f9', label: 'önce' },
                { from: v.changeDate, to: this.shiftDate(v.changeDate, rules.afterDays ?? 75), color: '#eff6ff', label: 'sonra' },
            ]
            : [];
        const seriesOf = (keys: string[], labels: Record<string, string>, colors: Record<string, string>) =>
            f.series.filter((sr) => keys.includes(sr.key)).map((sr) => ({ label: labels[sr.key], color: colors[sr.key], dates: sr.dates, values: sr.values }));
        const optical = seriesOf(['ndvi', 'nbr'], { ndvi: 'NDVI', nbr: 'NBR' }, { ndvi: GREEN, nbr: '#0f766e' });
        const radar = seriesOf(['vh_asc', 'vh_desc'], { vh_asc: 'VH çıkış', vh_desc: 'VH iniş' }, { vh_asc: BLUE, vh_desc: '#7c3aed' });
        const coh = seriesOf(['coh_asc', 'coh_desc'], { coh_asc: 'Koherans çıkış', coh_desc: 'Koherans iniş' }, { coh_asc: '#be185d', coh_desc: '#db2777' });
        const charts = [
            optical.length ? { title: 'Optik · Sentinel-2 (komşuluğa göre)', series: optical } : null,
            radar.length ? { title: 'Radar geri saçılım · Sentinel-1 VH (dB, komşuluğa göre)', series: radar } : null,
            coh.length ? { title: 'Koherans · Sentinel-1 (komşuluğa göre)', series: coh } : null,
        ].filter((c): c is { title: string; series: typeof optical } => !!c);
        h2(doc, 'Sezon boyunca sensör serileri');
        const w = contentWidth(doc);
        for (const c of charts) {
            ensureSpace(doc, 120);
            doc.font(FONT_BOLD).fontSize(8.5).fillColor(INK).text(c.title, x0, doc.y);
            const cy = doc.y + 2;
            lineChart(doc, { x: x0, y: cy, width: w, height: 100, series: c.series, from, to, markers, shade, zeroLine: true });
            doc.y = cy + 104;
            doc.x = x0;
        }
        // Scan strip
        if (s && f.scans.length > 0) {
            ensureSpace(doc, 40);
            doc.font(FONT_BOLD).fontSize(8.5).fillColor(INK).text(`Tarama zaman çizelgesi (her ${s.everyDays} gün · ${f.scans.length} tarama)`, x0, doc.y);
            const sy = doc.y + 2;
            scanStrip(doc, { x: x0, y: sy, width: w, height: 12, from: s.scanFrom, to: s.scanTo, scans: f.scans.map((sc) => ({ date: sc.date, color: CLASS_COLOR[sc.class] })) });
            doc.font(FONT).fontSize(6.5).fillColor(MUTED).text(formatDateTr(s.scanFrom), x0, sy + 14, { lineBreak: false });
            doc.text(formatDateTr(s.scanTo), x0 + w - 60, sy + 14, { width: 60, align: 'right', lineBreak: false });
            let lx = x0 + 130;
            for (const k of ['pruned', 'likely', 'unclear', 'not_pruned'] as FusionClass[]) {
                doc.rect(lx, sy + 15, 6, 6).fill(CLASS_COLOR[k]);
                doc.font(FONT).fontSize(6.5).fillColor(MUTED).text(FUSION_CLASS_LABEL[k], lx + 8, sy + 14, { lineBreak: false });
                lx += 8 + doc.widthOfString(FUSION_CLASS_LABEL[k]) + 10;
            }
            doc.y = sy + 28;
            doc.x = x0;
        }

        // Before / after scenes
        if (scenes) {
            await this.sceneRow(doc, scenes, g, f, v.lastBeforeAt, v.firstAfterAt);
        }

        // Repeat (7-season) evidence
        const cycle = Number(block?.policy?.cycleSeasons ?? 7);
        const previous = Object.keys(g.seasons).filter((k) => k !== season).sort();
        if ((f.repeat && f.repeat.reusedM2 > 0) || previous.length > 0) {
            h2(doc, `Tekrar budama kontrolü (${cycle} sezon kuralı)`);
            if (f.repeat && f.repeat.reusedM2 > 0) {
                para(doc, `Bu sezon budanan alanın ${formatM2(f.repeat.reusedM2)} (%${Math.round(f.repeat.reusedShare * 100)}) kadarı, önceki sezonlarda budanmış zeminle çakışıyor ve 1/7 hesabına SAYILMADI; sayılan yeni alan ${formatM2(f.repeat.countedM2)}.`, { color: ORANGE, bold: true, size: 9 });
            } else if (f.repeat) {
                para(doc, 'Önceki sezonların budama poligonlarıyla çakışma yok; alanın tamamı sayıldı.', { color: GREEN, size: 9 });
            }
            table(doc, {
                columns: [{ header: 'Sezon', width: 70 }, { header: 'Karar', width: 110 }, { header: 'Değişim', width: 80 }, { header: 'Tespit', width: 80 }, { header: 'Bu sezonla çakışma', width: 171, align: 'right' }],
                rows: [
                    ...previous.map((ps) => {
                        const pf = g.seasons[ps]?.fusion;
                        const ev = f.repeat?.evidence.find((e) => e.season === ps);
                        return [
                            seasonLabel(ps),
                            pf ? { text: FUSION_CLASS_LABEL[pf.verdict.class], color: CLASS_COLOR[pf.verdict.class] } : { text: 'Çok-sensör sonucu yok', color: MUTED },
                            formatDateTr(pf?.verdict.changeDate ?? null),
                            formatDateTr(pf?.detectedAt ?? pf?.likelyAt ?? null),
                            ev ? { text: formatM2(ev.overlapM2), color: ORANGE, bold: true } : '—',
                        ];
                    }),
                    ...(f.repeat?.evidence ?? []).filter((e) => !previous.includes(e.season)).map((e) => [seasonLabel(e.season), { text: FUSION_CLASS_LABEL[e.class], color: CLASS_COLOR[e.class] }, '—', '—', { text: formatM2(e.overlapM2), color: ORANGE, bold: true }]),
                ],
                emptyText: 'Önceki sezon kaydı yok',
            });
        }
        if (standalone) this.methodNote(doc, area, season);
    }

    private async sceneRow(doc: Pdf, scenes: SceneCache, g: TeaInventoryGarden, f: GardenFusion, lastBefore: string | null, firstAfter: string | null): Promise<void> {
        const list = [...scenes.scenes].sort((a, b) => a.date.localeCompare(b.date));
        if (list.length === 0) return;
        const clear = list.filter((s) => s.teaVisible >= 0.8);
        const pick = (candidates: Scene[], fallback: Scene | undefined) => candidates[0] ?? fallback;
        const before = lastBefore
            ? pick([...clear].reverse().filter((s) => s.date <= lastBefore), [...list].reverse().find((s) => s.date <= lastBefore))
            : pick(clear, list[0]);
        const after = firstAfter
            ? pick(clear.filter((s) => s.date >= firstAfter), list.find((s) => s.date >= firstAfter))
            : pick([...clear].reverse(), list.at(-1));
        if (!before || !after) return;
        const [imgA, imgB] = await Promise.all([scenes.get(before.file), scenes.get(after.file)]);
        h2(doc, 'Önce / sonra · Sentinel-2 gerçek sahne (10 m piksel)');
        if (!imgA || !imgB) {
            para(doc, 'Sahne görüntüsü alınamadı (görüntü sunucusuna ulaşılamadı); seriler ve z-skorları yukarıda.', { color: MUTED, size: 9 });
            return;
        }
        const boxW = (contentWidth(doc) - 16) / 2;
        const boxH = Math.round(boxW * 0.66);
        ensureSpace(doc, boxH + 36);
        const x0 = doc.page.margins.left;
        const y0 = doc.y + 12;
        const rings = this.rings(f.unitGeometry ?? g.geometry);
        const centre = this.centroid(rings);
        this.drawCrop(doc, imgA, scenes.bounds, centre, rings, x0, y0, boxW, boxH);
        this.drawCrop(doc, imgB, scenes.bounds, centre, rings, x0 + boxW + 16, y0, boxW, boxH);
        doc.font(FONT_BOLD).fontSize(8.5).fillColor(INK).text(`ÖNCE · ${formatDateTr(before.date)}`, x0, y0 - 11, { lineBreak: false });
        doc.text(`SONRA · ${formatDateTr(after.date)}`, x0 + boxW + 16, y0 - 11, { lineBreak: false });
        const ndvi = f.series.find((s) => s.key === 'ndvi');
        const at = (d: string) => { const i = ndvi?.dates.indexOf(d) ?? -1; return i >= 0 ? ndvi?.values[i] ?? null : null; };
        const na = at(before.date), nb = at(after.date);
        doc.font(FONT).fontSize(7.5).fillColor(MUTED).text(
            `Yeşil çizgi: karar birimi sınırı. Pencere ≈ 240 × 160 m. Komşuluğa göre NDVI: önce ${na != null ? formatNum(na, 2) : '—'}, sonra ${nb != null ? formatNum(nb, 2) : '—'}. Kaynak: Copernicus Sentinel-2, bulut maskeli bileşik.`,
            x0, y0 + boxH + 4, { width: contentWidth(doc) },
        );
        doc.y = y0 + boxH + 20;
        doc.x = x0;
        doc.font(FONT).fontSize(10).fillColor(INK);
    }

    /** Draws a ~240×160 m window of the scene around `centre` into the box, with the unit outline. */
    private drawCrop(doc: Pdf, img: { buf: Buffer; width: number; height: number }, b: Bounds, centre: [number, number], rings: Ring[], x: number, y: number, w: number, h: number): void {
        const pxPerLon = img.width / (b.east - b.west);
        const pxPerLat = img.height / (b.north - b.south);
        const mPerLon = 111320 * Math.cos((centre[1] * Math.PI) / 180);
        const winW = (240 / mPerLon) * pxPerLon;
        const winH = (160 / 111320) * pxPerLat;
        const cx = (centre[0] - b.west) * pxPerLon;
        const cy = (b.north - centre[1]) * pxPerLat;
        const scale = Math.min(w / winW, h / winH);
        const ox = cx - w / scale / 2;
        const oy = cy - h / scale / 2;
        doc.save();
        doc.rect(x, y, w, h).clip();
        doc.rect(x, y, w, h).fill('#0b1220');
        doc.image(img.buf, x - ox * scale, y - oy * scale, { width: img.width * scale, height: img.height * scale });
        doc.lineWidth(1.4).strokeColor('#4ade80');
        for (const ring of rings) {
            ring.forEach(([lon, lat], i) => {
                const px = x + ((lon - b.west) * pxPerLon - ox) * scale;
                const py = y + ((b.north - lat) * pxPerLat - oy) * scale;
                i === 0 ? doc.moveTo(px, py) : doc.lineTo(px, py);
            });
            doc.closePath().stroke();
        }
        doc.restore();
        doc.rect(x, y, w, h).lineWidth(0.6).strokeColor(LINE).stroke();
    }

    // ── shared pieces ──

    private header(doc: Pdf, area: TeaInventoryArea, season: string, title: string, subject: string): void {
        const w = doc.page.width;
        doc.save();
        doc.rect(0, 0, w, 64).fill(GREEN);
        doc.font(FONT_BOLD).fontSize(15).fillColor('#ffffff').text(title, doc.page.margins.left, 16, { lineBreak: false });
        doc.font(FONT).fontSize(9).fillColor('#dcfce7').text(`ÇAYKUR · Çay Envanteri · ${area.province} / ${area.district} / ${area.neighborhood} · Sezon ${seasonLabel(season)}`, doc.page.margins.left, 38, { lineBreak: false });
        doc.font(FONT_BOLD).fontSize(10).fillColor('#ffffff').text(subject, doc.page.margins.left, 50, { width: w - doc.page.margins.left * 2, lineBreak: false, ellipsis: true });
        if (area.demoLicenses) badge(doc, 'DEMO VERİSİ', ORANGE, w - doc.page.margins.right - 84, 18, 9);
        doc.restore();
        doc.y = 80;
        doc.x = doc.page.margins.left;
        doc.font(FONT).fontSize(10).fillColor(INK);
    }

    private footer(doc: Pdf, area: TeaInventoryArea, evidenceId: string, page: number, total: number): void {
        const y = bottomY(doc) + 14;
        doc.font(FONT).fontSize(7).fillColor(MUTED);
        doc.text(`Kanıt no ${evidenceId} · Oluşturulma ${formatDateTimeTr(new Date())} · Uydu analizine dayalı idari ön değerlendirme${area.demoLicenses ? ' · ruhsat verileri DEMO' : ''} · Copernicus Sentinel-1/2, TKGM MEGSİS`, doc.page.margins.left, y, { width: contentWidth(doc) - 60, lineBreak: false, ellipsis: true });
        doc.text(`Sayfa ${page} / ${total}`, doc.page.width - doc.page.margins.right - 60, y, { width: 60, align: 'right', lineBreak: false });
    }

    private evidenceId(parts: Array<string | number>): string {
        return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 12).toUpperCase();
    }

    private sceneCache(area: TeaInventoryArea, season: string): SceneCache | null {
        const scenes = (area.producerScan as ProducerScanBlock | null)?.scenes;
        const list = scenes?.seasons?.[season];
        if (!scenes || !list?.length) return null;
        const appUrl = (this.config.get<string>('APP_URL') ?? '').replace(/\/$/, '');
        const base = scenes.baseUrl.startsWith('http') ? scenes.baseUrl : `${appUrl}${scenes.baseUrl}`;
        return new SceneCache(base, scenes.bounds, list, this.logger);
    }

    private async findArea(id: string): Promise<TeaInventoryArea> {
        const area = await this.areaRepo.findOne({ where: { id } });
        if (!area) throw new NotFoundException('Inventory area not found');
        return area;
    }

    private rings(geometry: Record<string, unknown>): Ring[] {
        const type = geometry.type;
        const coords = geometry.coordinates as unknown;
        if (type === 'Polygon') return [(coords as number[][][])[0].map(([lon, lat]) => [lon, lat])];
        if (type === 'MultiPolygon') return (coords as number[][][][]).map((poly) => poly[0].map(([lon, lat]) => [lon, lat] as [number, number]));
        return [];
    }

    private centroid(rings: Ring[]): [number, number] {
        const pts = rings.flat();
        if (pts.length === 0) return [0, 0];
        return [pts.reduce((t, p) => t + p[0], 0) / pts.length, pts.reduce((t, p) => t + p[1], 0) / pts.length];
    }

    private shiftDate(iso: string, days: number): string {
        const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + days);
        return d.toISOString().slice(0, 10);
    }
}
