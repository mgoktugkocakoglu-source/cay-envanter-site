import { createHash } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { FieldTestCase, FieldTestCluster, FieldTestConfidence, FieldTestMatch, FieldTestPass, FieldTestVerdict, FieldTestsBlock } from '@/tea-inventory/entities/field-test.types';
import { formatDateTimeTr, formatDateTr, formatM2, formatNum } from '@/tea-inventory/report/labels';
import {
    BLUE, FONT, FONT_BOLD, GREEN, INK, LINE, MUTED, ORANGE, Pdf, RED, SOFT, badge, bottomY, contentWidth, createPdf, ensureSpace, finishPdf, h2, kvGrid, lineChart, para, table,
} from '@/tea-inventory/report/pdf';

type Ring = Array<[number, number]>;

const PASS_LABEL: Record<FieldTestPass, string> = { ASCENDING: 'çıkış yörüngesi', DESCENDING: 'iniş yörüngesi' };
const CONF_LABEL: Record<FieldTestConfidence, string> = { high: 'yüksek', medium: 'orta', low: 'düşük' };
const CONF_COLOR: Record<FieldTestConfidence, string> = { high: GREEN, medium: ORANGE, low: MUTED };
const VERDICT: Record<FieldTestVerdict, [string, string]> = { detected: ['UYDU KESİMİ TESPİT ETTİ', GREEN], not_detected: ['UYDU KESİM GÖRMEDİ', RED], pending: ['GÖZLEM BEKLENİYOR', MUTED] };
const MATCH: Record<FieldTestMatch, [string, string]> = { match: ['SAHA İLE ÖRTÜŞÜYOR', GREEN], partial: ['KISMİ ÖRTÜŞME', ORANGE], miss: ['SAHA İLE ÖRTÜŞMÜYOR', RED], no_detection: ['TESPİT YOK', MUTED] };
const SIGNED = (v: number | null | undefined, digits = 3) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(digits)}`);

/** Colour of a pixel's relative NDVI change (same scale as the site). */
function deltaColor(d: number | null): string | null {
    if (d === null) return null;
    if (d <= -0.15) return '#7f1d1d';
    if (d <= -0.1) return '#b91c1c';
    if (d <= -0.05) return '#f97316';
    if (d <= -0.025) return '#fde68a';
    if (d >= 0.05) return '#60a5fa';
    return null;
}

function rings(geometry: Record<string, unknown>): Ring[] {
    const type = geometry.type as string;
    const coords = geometry.coordinates as number[][][] | number[][][][];
    if (type === 'Polygon') return [(coords as number[][][])[0] as Ring];
    if (type === 'MultiPolygon') return (coords as number[][][][]).map((p) => p[0] as Ring);
    return [];
}

/** Blind field-test report: the satellite's own delineation of a known cut, in inspector language, with the evidence behind it. */
@Injectable()
export class FieldTestReportService {
    constructor(@InjectRepository(TeaInventoryArea) private readonly areaRepo: Repository<TeaInventoryArea>) { }

    async pdf(areaId: string, caseId: string): Promise<{ buffer: Buffer; filename: string }> {
        const area = await this.areaRepo.findOne({ where: { id: areaId } });
        if (!area) throw new NotFoundException('Area not found');
        const block = area.fieldTests;
        const c = block?.cases.find((x) => x.id === caseId);
        if (!block || !c) throw new NotFoundException('Field test not found');
        const doc = createPdf({ title: `Kör saha testi ${c.block}/${c.parcel} · ${c.prunedAt}` });
        const reportId = createHash('sha1').update([area.code, c.id, block.generatedAt].join('|')).digest('hex').slice(0, 12).toUpperCase();
        this.header(doc, area, c);
        this.resultSection(doc, c);
        this.mapSection(doc, c);
        this.clusterSection(doc, c);
        this.pixelSection(doc, c);
        this.seriesSection(doc, c);
        this.groundTruthSection(doc, c);
        this.methodSection(doc, block, c);
        const buffer = await finishPdf(doc, (d, page, total) => this.footer(d, area, reportId, page, total));
        return { buffer, filename: `saha-testi-${c.block}-${c.parcel}-${c.prunedAt}.pdf` };
    }

    // ── Sections ──

    private resultSection(doc: Pdf, c: FieldTestCase): void {
        const [label, color] = VERDICT[c.detection.verdict];
        let x = doc.page.margins.left;
        const y = doc.y;
        x += badge(doc, label, color, x, y, 9) + 6;
        if (c.groundTruth) {
            const [gl, gc] = MATCH[c.groundTruth.comparison.verdict];
            badge(doc, gl, gc, x, y, 9);
        }
        doc.y = y + 24;
        doc.x = doc.page.margins.left;
        h2(doc, 'Sonuç (eksper özeti)');
        for (const line of c.detection.summary) {
            para(doc, line, { size: 10.5 });
            doc.moveDown(0.3);
        }
        const main = c.detection.mainCluster !== null ? c.clusters[c.detection.mainCluster] ?? null : null;
        const br = c.detection.dateBracket;
        const radarRows = c.series.radar.map((p) => `${PASS_LABEL[p.pass]} ${p.relativeOrbit}: ${p.dates.length} geçiş, son ${formatDateTr(p.dates[p.dates.length - 1])}`);
        const lastOptical = [...c.series.optical.dates].reverse().find((d, i) => c.series.optical.neighbours[c.series.optical.dates.length - 1 - i] !== null) ?? null;
        kvGrid(doc, [
            ['Saha tarihi', formatDateTr(c.prunedAt)],
            ['Uydu değişim aralığı', br?.lastBefore && br.firstAfter ? `${formatDateTr(br.lastBefore)} – ${formatDateTr(br.firstAfter)}` : '—'],
            ['Tespit edilen alan', c.detection.verdict === 'detected' ? `${formatM2(c.detection.prunedM2)} (${c.detection.prunedRange[0]}–${c.detection.prunedRange[1]} m²)` : '—'],
            ['Parsel payı', c.detection.verdict === 'detected' ? `%${Math.round(c.detection.shareOfParcel * 100)}` : '—'],
            ['Konum', main ? `parselin ${main.position}` : '—'],
            ['Güven', main ? CONF_LABEL[main.confidence] : '—'],
            ['Parsel alanı', `${formatM2(c.parcelAreaM2)}${c.deedAreaM2 ? ` (tapu ${formatM2(c.deedAreaM2)})` : ''}`],
            ['Veri penceresi', `${formatDateTr(c.window[0])} → ${formatDateTr(c.window[1])}`],
            ['Son temiz optik sahne', lastOptical ? formatDateTr(lastOptical) : '—'],
            ['Radar', radarRows.join(' · ') || '—'],
            ['Referans çay örtüsü', `${c.reference.pixels} piksel · ${formatM2(c.reference.areaM2)} (300 m çevre)`],
            ['Kaynak', c.source],
        ], 3, 32);
    }

    private mapSection(doc: Pdf, c: FieldTestCase): void {
        h2(doc, 'Harita: uydunun çizdiği budanan alan');
        const w = contentWidth(doc);
        const h = 320;
        ensureSpace(doc, h + 52);
        const x0 = doc.page.margins.left;
        const y0 = doc.y;
        // Local metric frame around the parcel.
        const lon0 = c.parcelCentroid[0];
        const lat0 = c.parcelCentroid[1];
        const mPerLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
        const mPerLat = 111320;
        const toM = ([lon, lat]: [number, number]): [number, number] => [(lon - lon0) * mPerLon, (lat - lat0) * mPerLat];
        const pts: Array<[number, number]> = [];
        for (const r of rings(c.parcelGeometry)) for (const p of r) pts.push(toM(p));
        for (const px of c.pixels) for (const r of rings(px.geometry)) for (const p of r) pts.push(toM(p));
        if (c.groundTruth) for (const r of rings(c.groundTruth.geometry)) for (const p of r) pts.push(toM(p));
        const pad = 12;
        const minX = Math.min(...pts.map((p) => p[0])) - pad;
        const maxX = Math.max(...pts.map((p) => p[0])) + pad;
        const minY = Math.min(...pts.map((p) => p[1])) - pad;
        const maxY = Math.max(...pts.map((p) => p[1])) + pad;
        const scale = Math.min(w / (maxX - minX), h / (maxY - minY));
        const ox = x0 + (w - (maxX - minX) * scale) / 2;
        const oy = y0 + (h - (maxY - minY) * scale) / 2;
        const X = (p: [number, number]) => ox + (toM(p)[0] - minX) * scale;
        const Y = (p: [number, number]) => oy + (maxY - toM(p)[1]) * scale;
        const path = (ring: Ring) => {
            ring.forEach((p, i) => (i === 0 ? doc.moveTo(X(p), Y(p)) : doc.lineTo(X(p), Y(p))));
            doc.closePath();
        };
        doc.save();
        doc.rect(x0, y0, w, h).fill(SOFT);
        // Pixels: every square of the lattice, coloured by its relative NDVI change; detected ones outlined.
        for (const px of c.pixels) {
            const ring = rings(px.geometry)[0];
            if (!ring) continue;
            const color = deltaColor(px.optical.ndvi.delta);
            if (color) {
                doc.fillOpacity(0.65);
                path(ring);
                doc.fill(color);
                doc.fillOpacity(1);
            }
            path(ring);
            doc.lineWidth(px.flagged ? 1.4 : 0.4).strokeColor(px.flagged ? INK : '#cbd5e1').stroke();
        }
        // Parcel.
        for (const r of rings(c.parcelGeometry)) {
            path(r);
            doc.lineWidth(1.6).strokeColor(INK).stroke();
        }
        // Ground truth, dashed.
        if (c.groundTruth) {
            doc.dash(4, { space: 3 });
            for (const r of rings(c.groundTruth.geometry)) {
                path(r);
                doc.lineWidth(1.4).strokeColor(GREEN).stroke();
            }
            doc.undash();
        }
        // Cluster labels.
        for (const k of c.clusters) {
            const cx = X(k.centroid);
            const cy = Y(k.centroid);
            doc.circle(cx, cy, 8).fillOpacity(0.92).fill(CONF_COLOR[k.confidence]).fillOpacity(1);
            doc.font(FONT_BOLD).fontSize(8).fillColor('#ffffff').text(`K${k.index + 1}`, cx - 8, cy - 4.5, { width: 16, align: 'center', lineBreak: false });
        }
        // Scale bar (20 m) and north.
        const bx = x0 + 10;
        const by = y0 + h - 14;
        doc.rect(bx, by, 20 * scale, 3).fill(INK);
        doc.font(FONT).fontSize(7).fillColor(INK).text('20 m', bx, by - 9, { lineBreak: false });
        doc.font(FONT_BOLD).fontSize(8).fillColor(INK).text('K ↑', x0 + w - 24, y0 + 6, { lineBreak: false });
        doc.restore();
        doc.rect(x0, y0, w, h).lineWidth(0.6).strokeColor(LINE).stroke();
        doc.y = y0 + h + 6;
        doc.x = x0;
        para(doc, 'Kareler Sentinel-2’nin gerçek 10 m pikselleridir; renk, kesim tarihinden önce/sonra komşu çay örtüsüne göreli NDVI değişimidir (koyu kırmızı ≤ −0,15 · kırmızı ≤ −0,10 · turuncu ≤ −0,05 · sarı ≤ −0,025 · mavi ≥ +0,05 · boyasız: değişim yok). Kalın çerçeve: uydunun budanmış saydığı pikseller; K1, K2…: kümeler. Siyah çizgi parsel (TKGM); yeşil kesikli çizgi sahada işaretlenen yer (tespite verilmedi, yalnız kıyas için).', { size: 8, color: MUTED });
    }

    private clusterSection(doc: Pdf, c: FieldTestCase): void {
        h2(doc, 'Tespit edilen kümeler');
        if (c.clusters.length === 0) {
            para(doc, 'Uydu bu tarihte parselde kesim büyüklüğünde bir değişim kümesi görmedi.', { color: MUTED });
            return;
        }
        const radarCell = (k: FieldTestCluster, pass: FieldTestPass) => {
            const t = k.radar[pass];
            return t ? `${SIGNED(t.vh.delta, 2)} dB (z ${formatNum(t.vh.z, 1)})` : '—';
        };
        table(doc, {
            fontSize: 8,
            columns: [
                { header: 'Küme', width: 36 },
                { header: 'Konum', width: 78 },
                { header: 'Piksel', width: 36, align: 'right' },
                { header: 'Tahmini alan', width: 70, align: 'right' },
                { header: 'Üst sınır', width: 46, align: 'right' },
                { header: 'NDVI Δ / z', width: 62, align: 'right' },
                { header: 'Değişim aralığı', width: 88 },
                { header: 'VH çıkış', width: 58, align: 'right' },
                { header: 'VH iniş', width: 58, align: 'right' },
                { header: 'Güven', width: 36 },
            ],
            rows: c.clusters.map((k) => [
                `K${k.index + 1}`,
                `parselin ${k.position}`,
                String(k.pixelIds.length),
                `${k.areaM2} m² (${k.areaRange[0]}–${k.areaRange[1]})`,
                `${k.areaUpperM2} m²`,
                `${k.meanDelta.toFixed(3)} / ${k.maxZ.toFixed(1)}`,
                k.dateBracket.lastBefore && k.dateBracket.firstAfter ? `${formatDateTr(k.dateBracket.lastBefore)} – ${formatDateTr(k.dateBracket.firstAfter)}${k.dateBracket.containsPrunedAt === false ? ' (saha tarihi dışında)' : ''}` : '—',
                radarCell(k, 'ASCENDING'),
                radarCell(k, 'DESCENDING'),
                { text: CONF_LABEL[k.confidence], color: CONF_COLOR[k.confidence], bold: true },
            ]),
        });
        for (const k of c.clusters) if (k.note) para(doc, `K${k.index + 1}: ${k.note}.`, { size: 8, color: MUTED });
    }

    private pixelSection(doc: Pdf, c: FieldTestCase): void {
        const flagged = c.pixels.filter((p) => p.flagged).sort((a, b) => (a.cluster ?? 0) - (b.cluster ?? 0) || (a.optical.ndvi.delta ?? 0) - (b.optical.ndvi.delta ?? 0));
        if (flagged.length === 0) return;
        h2(doc, 'Budanmış sayılan pikseller');
        const radarCell = (p: (typeof flagged)[number], pass: FieldTestPass) => {
            const t = p.radar[pass];
            return t ? `${SIGNED(t.vh.delta, 2)}` : '—';
        };
        table(doc, {
            fontSize: 8,
            columns: [
                { header: 'Piksel (UTM E / N)', width: 92 },
                { header: 'Küme', width: 34 },
                { header: 'Parsel içi', width: 50, align: 'right' },
                { header: 'NDVI önce', width: 52, align: 'right' },
                { header: 'Göreli Δ', width: 48, align: 'right' },
                { header: 'z', width: 34, align: 'right' },
                { header: 'Gözlem', width: 44, align: 'right' },
                { header: 'Pay', width: 36, align: 'right' },
                { header: 'Alan', width: 44, align: 'right' },
                { header: 'VH çıkış', width: 46, align: 'right' },
                { header: 'VH iniş', width: 46, align: 'right' },
                { header: 'Not', width: 42 },
            ],
            rows: flagged.map((p) => [
                `${p.e} / ${p.n}`,
                p.cluster === null ? '—' : `K${p.cluster + 1}`,
                `${p.insideM2} m²`,
                formatNum(p.optical.ndviBeforeAbs, 2),
                { text: SIGNED(p.optical.ndvi.delta), bold: p.strong },
                formatNum(p.optical.ndvi.z, 1),
                `${p.optical.ndvi.nBefore} / ${p.optical.ndvi.nAfter}`,
                p.fraction === null ? '—' : `%${Math.round(p.fraction * 100)}`,
                p.prunedM2 === null ? '—' : `${p.prunedM2} m²`,
                radarCell(p, 'ASCENDING'),
                radarCell(p, 'DESCENDING'),
                p.edgeNonTea ? 'sınır' : '',
            ]),
        });
        para(doc, 'Göreli Δ: kesim sonrası ortalama − kesim öncesi ortalama (piksel − komşu çay örtüsü). z: basamak / (öncesi gürültü · √(1/n_önce + 1/n_sonra)). Pay: pikselin budanmış payı = −Δ / (NDVI_önce − NDVI_budanmış). Radar: γ0 VH değişimi (dB), komşulara göreli. "sınır": parsel sınırında, dışı çay değil.', { size: 8, color: MUTED });
    }

    private seriesSection(doc: Pdf, c: FieldTestCase): void {
        h2(doc, 'Seriler (komşu çay örtüsüne göreli)');
        const o = c.series.optical;
        const main = c.detection.mainCluster;
        const series = [];
        if (main !== null && o.clusters[String(main)]) series.push({ label: `K${main + 1} (tespit)`, color: RED, dates: o.dates, values: o.clusters[String(main)] as Array<number | null> });
        series.push({ label: 'Parselin kalanı', color: MUTED, dates: o.dates, values: o.rest });
        series.push({ label: 'Parsel (bütün)', color: BLUE, dates: o.dates, values: o.parcel });
        const shade = [{ from: c.windows.after[0], to: c.windows.after[1], color: '#fee2e2' }];
        const markers = [{ date: c.prunedAt, label: 'saha tarihi', color: RED }];
        const w = contentWidth(doc);
        ensureSpace(doc, 150);
        doc.font(FONT_BOLD).fontSize(8.5).fillColor(INK).text('Sentinel-2 NDVI, göreli (piksel − komşu çay örtüsü)', doc.page.margins.left, doc.y);
        lineChart(doc, { x: doc.page.margins.left, y: doc.y + 2, width: w, height: 120, series, from: c.window[0], to: c.window[1], markers, shade, zeroLine: true });
        doc.y += 128;
        for (const p of c.series.radar) {
            ensureSpace(doc, 140);
            const rs = [];
            if (main !== null && p.clusters[String(main)]) rs.push({ label: `K${main + 1} VH`, color: RED, dates: p.dates, values: p.clusters[String(main)] as Array<number | null> });
            rs.push({ label: 'Parselin kalanı VH', color: MUTED, dates: p.dates, values: p.rest });
            doc.font(FONT_BOLD).fontSize(8.5).fillColor(INK).text(`Sentinel-1 γ0 VH (dB), göreli · ${PASS_LABEL[p.pass]} ${p.relativeOrbit}`, doc.page.margins.left, doc.y);
            lineChart(doc, { x: doc.page.margins.left, y: doc.y + 2, width: w, height: 110, series: rs, from: c.window[0], to: c.window[1], markers, shade, zeroLine: true });
            doc.y += 118;
        }
        para(doc, 'Kırmızı çizgi: saha tarihi. Pembe alan: "sonra" penceresi. Göreli değer, mevsim ve hava etkisini düşürür; yalnız o pikselde olan değişim kalır.', { size: 8, color: MUTED });
    }

    private groundTruthSection(doc: Pdf, c: FieldTestCase): void {
        h2(doc, 'Saha gerçeğiyle kıyas');
        if (!c.groundTruth) {
            para(doc, 'Bu vaka için saha işareti girilmedi; kıyas yapılamadı.', { color: MUTED });
            return;
        }
        const g = c.groundTruth;
        const [label, color] = MATCH[g.comparison.verdict];
        const y = doc.y;
        badge(doc, label, color, doc.page.margins.left, y, 9);
        doc.y = y + 22;
        doc.x = doc.page.margins.left;
        para(doc, g.comparison.text);
        kvGrid(doc, [
            ['İşaretli alan', `${formatM2(g.areaM2)}${g.approximate ? ' (yaklaşık)' : ''}`],
            ['Tespit (tam piksel)', formatM2(g.comparison.detectedM2)],
            ['Örtüşme', formatM2(g.comparison.overlapM2)],
            ['Tespitin işaret içindeki payı', `%${Math.round(g.comparison.detectedInsideShare * 100)}`],
            ['İşaretin kapsanan payı', `%${Math.round(g.comparison.groundTruthCoveredShare * 100)}`],
            ['Merkezler arası', g.comparison.centroidDistanceM === null ? '—' : `${g.comparison.centroidDistanceM} m`],
        ], 3, 32);
        if (g.note) para(doc, `Saha notu: ${g.note}`, { size: 8.5, color: MUTED });
        para(doc, 'Saha işareti tespit hesabına girmez: uydu budanan yeri yalnız parsel ve tarih bilgisiyle çizer, işaret sonradan kıyaslanır. Bu nedenle örtüşme bir doğrulama ölçüsüdür, girdinin yansıması değil.', { size: 8.5, color: MUTED });
    }

    private methodSection(doc: Pdf, block: FieldTestsBlock, c: FieldTestCase): void {
        h2(doc, 'Yöntem ve sınırlar');
        para(doc, block.method, { size: 9 });
        doc.moveDown(0.3);
        const r = block.rules;
        const lines = [
            `Pencereler: kesimden önceki ${r.beforeDays} gün taban, kesimden sonraki tüm sahneler. En az ${r.minBefore} önce / ${r.minAfter} sonra temiz gözlem.`,
            `Piksel eşiği: göreli NDVI düşüşü ≥ ${r.pixelDrop} ve z ≥ ${r.pixelZ}; ≥ ${r.pixelDropStrong} "güçlü". Gürültü tabanı ${r.noiseFloor}.`,
            `Alan: pikselin budanmış payı = düşüş / (NDVI_önce − NDVI_budanmış); NDVI_budanmış ${c.calibration ? `${c.calibration.ndviPruned} (${c.calibration.source === 'field' ? 'saha ölçümüyle kalibre' : 'varsayılan'}; aralık ${c.calibration.range.join('–')})` : r.ndviPruned}. ${c.calibration?.note ?? ''} Tam piksel üst sınırı ayrıca verilir.`,
            `Radar: Sentinel-1 γ0 VH ve VH/VV, arazi düzleştirilmiş, komşulara göreli; küme ortalamasında ≥ ${r.radarChangeDb} dB ve |z| ≥ ${r.radarZ} değişim (işaret bağımsız) zamanlama kanıtıdır.`,
            `Tarih taraması: saha tarihinin ±${r.dateSearchDays} günü içinde en büyük basamağı veren sahne çifti; "son önce" ve "ilk sonra" sahneleri aralığı verir.`,
            `Dışlanan tarihler (referans NDVI < ${r.collapseNdvi}: kar/don/gölge): ${c.excludedDates.length ? c.excludedDates.map((d) => formatDateTr(d)).join(', ') : 'yok'}.`,
            'Sınırlar: 10 m piksel, parsel sınırındaki piksellerde komşu örtü karışır; kesimden hemen sonra yerde kalan yeşil artıklar NDVI düşüşünü birkaç gün geciktirir; radar tek piksel ölçeğinde gürültülüdür, geçiş ortalaması alınır.',
            'Veri: Copernicus Sentinel-2 L2A (Cloud Score+), Sentinel-1 GRD (γ0, Copernicus DEM); TKGM MEGSİS parsel; Google Earth Engine.',
        ];
        for (const l of lines) para(doc, `• ${l}`, { size: 8.5 });
    }

    // ── Chrome ──

    private header(doc: Pdf, area: TeaInventoryArea, c: FieldTestCase): void {
        const w = doc.page.width;
        doc.save();
        doc.rect(0, 0, w, 64).fill(GREEN);
        doc.font(FONT_BOLD).fontSize(15).fillColor('#ffffff').text('KÖR SAHA TESTİ RAPORU', doc.page.margins.left, 16, { lineBreak: false });
        doc.font(FONT).fontSize(9).fillColor('#dcfce7').text(`ÇAYKUR · Çay Envanteri · ${area.province} / ${area.district} / ${area.neighborhood}`, doc.page.margins.left, 38, { lineBreak: false });
        doc.font(FONT_BOLD).fontSize(10).fillColor('#ffffff').text(`Ada ${c.block} / Parsel ${c.parcel} · saha tarihi ${formatDateTr(c.prunedAt)}`, doc.page.margins.left, 50, { width: w - doc.page.margins.left * 2, lineBreak: false, ellipsis: true });
        if (area.demoLicenses) badge(doc, 'DEMO ORTAMI', ORANGE, w - doc.page.margins.right - 90, 18, 9);
        doc.restore();
        doc.y = 80;
        doc.x = doc.page.margins.left;
        doc.font(FONT).fontSize(10).fillColor(INK);
    }

    private footer(doc: Pdf, area: TeaInventoryArea, reportId: string, page: number, total: number): void {
        const y = bottomY(doc) + 14;
        doc.font(FONT).fontSize(7).fillColor(MUTED);
        doc.text(`Rapor no ${reportId} · Oluşturulma ${formatDateTimeTr(new Date())} · Uydu analizine dayalı bağımsız saha testi${area.demoLicenses ? ' · demo ortamı' : ''} · Copernicus Sentinel-1/2, TKGM MEGSİS`, doc.page.margins.left, y, { width: contentWidth(doc) - 60, lineBreak: false, ellipsis: true });
        doc.text(`Sayfa ${page} / ${total}`, doc.page.width - doc.page.margins.right - 60, y, { width: 60, align: 'right', lineBreak: false });
    }
}
