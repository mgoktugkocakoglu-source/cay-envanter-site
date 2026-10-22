import PDFDocument from 'pdfkit';
import { dejavuFonts } from '@/assets/fonts/dejavu-fonts';

/**
 * Thin drawing layer over pdfkit used by the evidence pack and the season report: fonts with
 * Turkish glyphs, headings, key/value blocks, tables with page breaks, vector line charts.
 */
export type Pdf = PDFKit.PDFDocument;

export const INK = '#0f172a';
export const MUTED = '#64748b';
export const LINE = '#e2e8f0';
export const SOFT = '#f1f5f9';
export const GREEN = '#15803d';
export const BLUE = '#1d4ed8';
export const ORANGE = '#b45309';
export const RED = '#b91c1c';
export const PURPLE = '#6d28d9';

export const FONT = 'DejaVu';
export const FONT_BOLD = 'DejaVu-Bold';

export interface PdfOptions {
    title: string;
    author?: string;
    landscape?: boolean;
}

export function createPdf(options: PdfOptions): Pdf {
    const doc = new PDFDocument({
        size: 'A4',
        layout: options.landscape ? 'landscape' : 'portrait',
        margins: { top: 46, bottom: 50, left: 42, right: 42 },
        bufferPages: true,
        // No default Helvetica: the standard-font data files are not part of a serverless bundle.
        font: null as unknown as string,
        info: { Title: options.title, Author: options.author ?? 'ÇAYKUR · Çay Envanteri', Creator: 'Çay Hesabım' },
    });
    const fonts = dejavuFonts();
    doc.registerFont(FONT, fonts.regular);
    doc.registerFont(FONT_BOLD, fonts.bold);
    doc.font(FONT).fontSize(10).fillColor(INK);
    return doc;
}

/** Draws the footer on every buffered page, ends the document and returns its bytes. */
export function finishPdf(doc: Pdf, footer: (doc: Pdf, page: number, total: number) => void): Promise<Buffer> {
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        footer(doc, i + 1, range.count);
    }
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        doc.end();
    });
}

export function contentWidth(doc: Pdf): number {
    return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

export function bottomY(doc: Pdf): number {
    return doc.page.height - doc.page.margins.bottom;
}

/** Starts a new page when fewer than `height` points remain below the cursor. */
export function ensureSpace(doc: Pdf, height: number): void {
    if (doc.y + height > bottomY(doc)) {
        doc.addPage();
    }
}

export function h1(doc: Pdf, text: string): void {
    ensureSpace(doc, 40);
    doc.font(FONT_BOLD).fontSize(17).fillColor(INK).text(text, { width: contentWidth(doc) });
    doc.moveDown(0.4);
    doc.font(FONT).fontSize(10);
}

export function h2(doc: Pdf, text: string, color = INK): void {
    ensureSpace(doc, 32);
    doc.moveDown(0.5);
    doc.font(FONT_BOLD).fontSize(12).fillColor(color).text(text, { width: contentWidth(doc) });
    const y = doc.y + 2;
    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + contentWidth(doc), y).lineWidth(0.6).strokeColor(LINE).stroke();
    doc.moveDown(0.5);
    doc.font(FONT).fontSize(10).fillColor(INK);
}

export function para(doc: Pdf, text: string, opts: { color?: string; size?: number; bold?: boolean; width?: number } = {}): void {
    doc.font(opts.bold ? FONT_BOLD : FONT).fontSize(opts.size ?? 10).fillColor(opts.color ?? INK);
    doc.text(text, { width: opts.width ?? contentWidth(doc) });
    doc.font(FONT).fontSize(10).fillColor(INK);
}

/** A coloured pill with white text at the cursor (inline). Returns its width. */
export function badge(doc: Pdf, text: string, color: string, x: number, y: number, size = 8.5): number {
    doc.font(FONT_BOLD).fontSize(size);
    const w = doc.widthOfString(text) + 12;
    const h = size + 7;
    doc.roundedRect(x, y, w, h, h / 2).fill(color);
    doc.fillColor('#ffffff').text(text, x + 6, y + 3.4, { lineBreak: false });
    doc.font(FONT).fontSize(10).fillColor(INK);
    return w;
}

/** Key/value rows laid out in `cols` columns (label small muted, value bold). */
export function kvGrid(doc: Pdf, rows: Array<[string, string]>, cols = 3, rowHeight = 30): void {
    const w = contentWidth(doc);
    const colW = w / cols;
    const lines = Math.ceil(rows.length / cols);
    ensureSpace(doc, lines * rowHeight + 6);
    const x0 = doc.page.margins.left;
    const y0 = doc.y;
    rows.forEach(([label, value], i) => {
        const x = x0 + (i % cols) * colW;
        const y = y0 + Math.floor(i / cols) * rowHeight;
        doc.font(FONT).fontSize(7.5).fillColor(MUTED).text(label.toLocaleUpperCase('tr-TR'), x, y, { width: colW - 8, lineBreak: false });
        doc.font(FONT_BOLD).fontSize(10.5).fillColor(INK).text(value, x, y + 11, { width: colW - 8, lineBreak: false, ellipsis: true });
    });
    doc.x = x0;
    doc.y = y0 + lines * rowHeight + 4;
    doc.font(FONT).fontSize(10).fillColor(INK);
}

export interface TableColumn {
    header: string;
    width: number;
    align?: 'left' | 'right' | 'center';
}

export interface TableOptions {
    columns: TableColumn[];
    rows: Array<Array<string | { text: string; color?: string; bold?: boolean }>>;
    fontSize?: number;
    zebra?: boolean;
    emptyText?: string;
}

/** A simple grid table that repeats its header after a page break. */
export function table(doc: Pdf, opts: TableOptions): void {
    const size = opts.fontSize ?? 8.5;
    const x0 = doc.page.margins.left;
    const pad = 4;
    const lineH = size + 4;
    const drawHeader = () => {
        const y = doc.y;
        doc.rect(x0, y, opts.columns.reduce((t, c) => t + c.width, 0), lineH + 4).fill(SOFT);
        let x = x0;
        doc.font(FONT_BOLD).fontSize(size).fillColor(INK);
        for (const c of opts.columns) {
            doc.text(c.header, x + pad, y + 3, { width: c.width - pad * 2, align: c.align ?? 'left', lineBreak: false, ellipsis: true });
            x += c.width;
        }
        doc.y = y + lineH + 4;
        doc.x = x0;
    };
    ensureSpace(doc, lineH * 3);
    drawHeader();
    if (opts.rows.length === 0) {
        doc.font(FONT).fontSize(size).fillColor(MUTED).text(opts.emptyText ?? 'Kayıt yok', x0 + pad, doc.y + 3);
        doc.moveDown(0.6);
        doc.x = x0;
        doc.font(FONT).fontSize(10).fillColor(INK);
        return;
    }
    opts.rows.forEach((row, ri) => {
        // Height of the tallest wrapped cell.
        doc.font(FONT).fontSize(size);
        const heights = row.map((cell, ci) => {
            const text = typeof cell === 'string' ? cell : cell.text;
            return doc.heightOfString(text || ' ', { width: opts.columns[ci].width - pad * 2 });
        });
        const rowH = Math.max(lineH, Math.max(...heights) + 5);
        if (doc.y + rowH > bottomY(doc)) {
            doc.addPage();
            drawHeader();
        }
        const y = doc.y;
        if (opts.zebra !== false && ri % 2 === 1) {
            doc.rect(x0, y, opts.columns.reduce((t, c) => t + c.width, 0), rowH).fill('#f8fafc');
        }
        let x = x0;
        row.forEach((cell, ci) => {
            const c = opts.columns[ci];
            const text = typeof cell === 'string' ? cell : cell.text;
            const color = typeof cell === 'string' ? INK : (cell.color ?? INK);
            const bold = typeof cell === 'string' ? false : !!cell.bold;
            doc.font(bold ? FONT_BOLD : FONT).fontSize(size).fillColor(color).text(text, x + pad, y + 2.5, { width: c.width - pad * 2, align: c.align ?? 'left' });
            x += c.width;
        });
        doc.moveTo(x0, y + rowH).lineTo(x0 + opts.columns.reduce((t, c) => t + c.width, 0), y + rowH).lineWidth(0.4).strokeColor(LINE).stroke();
        doc.y = y + rowH;
        doc.x = x0;
    });
    doc.moveDown(0.6);
    doc.font(FONT).fontSize(10).fillColor(INK);
}

export interface ChartSeries {
    label: string;
    color: string;
    dates: string[];
    values: Array<number | null>;
}

export interface ChartMarker {
    date: string;
    label: string;
    color: string;
}

export interface LineChartOptions {
    x: number;
    y: number;
    width: number;
    height: number;
    series: ChartSeries[];
    from: string;
    to: string;
    yLabel?: string;
    yDomain?: [number, number];
    markers?: ChartMarker[];
    shade?: Array<{ from: string; to: string; color: string; label?: string }>;
    zeroLine?: boolean;
}

const dayOf = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86400000;

/** A dated line chart drawn with vector paths (no raster): axis ticks by month, markers, shaded windows. */
export function lineChart(doc: Pdf, o: LineChartOptions): void {
    const padL = 34, padB = 16, padT = 6, padR = 6;
    const x0 = o.x + padL, y0 = o.y + padT, w = o.width - padL - padR, h = o.height - padT - padB;
    const d0 = dayOf(o.from), d1 = dayOf(o.to);
    const X = (d: string) => x0 + ((dayOf(d) - d0) / Math.max(1, d1 - d0)) * w;
    let lo = o.yDomain?.[0] ?? Infinity, hi = o.yDomain?.[1] ?? -Infinity;
    if (!o.yDomain) {
        for (const s of o.series) for (const v of s.values) if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
        if (!Number.isFinite(lo)) { lo = -1; hi = 1; }
        const pad = (hi - lo) * 0.12 || 0.5;
        lo -= pad; hi += pad;
    }
    const Y = (v: number) => y0 + h - ((v - lo) / (hi - lo)) * h;
    // frame
    doc.save();
    doc.rect(x0, y0, w, h).lineWidth(0.5).strokeColor(LINE).stroke();
    for (const s of o.shade ?? []) {
        const a = Math.max(x0, X(s.from)), b = Math.min(x0 + w, X(s.to));
        if (b > a) {
            doc.rect(a, y0, b - a, h).fill(s.color);
            if (s.label) doc.font(FONT).fontSize(6.5).fillColor(MUTED).text(s.label, a + 2, y0 + 2, { lineBreak: false });
        }
    }
    // month ticks
    const start = new Date(`${o.from.slice(0, 7)}-01T00:00:00Z`);
    for (let m = new Date(start); dayOf(m.toISOString()) <= d1; m.setUTCMonth(m.getUTCMonth() + 1)) {
        const iso = m.toISOString().slice(0, 10);
        if (dayOf(iso) < d0) continue;
        const x = X(iso);
        doc.moveTo(x, y0).lineTo(x, y0 + h).lineWidth(0.3).strokeColor(LINE).stroke();
        const label = `${['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'][m.getUTCMonth()]} ${String(m.getUTCFullYear()).slice(2)}`;
        doc.font(FONT).fontSize(6.5).fillColor(MUTED).text(label, x - 14, y0 + h + 3, { width: 28, align: 'center', lineBreak: false });
    }
    // y ticks
    for (const v of [lo, (lo + hi) / 2, hi]) {
        doc.font(FONT).fontSize(6.5).fillColor(MUTED).text(v.toFixed(Math.abs(hi - lo) < 2 ? 2 : 1), o.x, Y(v) - 4, { width: padL - 4, align: 'right', lineBreak: false });
    }
    if (o.zeroLine && lo < 0 && hi > 0) {
        doc.moveTo(x0, Y(0)).lineTo(x0 + w, Y(0)).lineWidth(0.4).strokeColor('#cbd5e1').dash(2, { space: 2 }).stroke().undash();
    }
    if (o.yLabel) doc.font(FONT).fontSize(6.5).fillColor(MUTED).text(o.yLabel, x0 + 3, y0 + 2, { lineBreak: false });
    // series
    doc.rect(x0, y0, w, h).clip();
    for (const s of o.series) {
        const pts = s.dates.map((d, i) => [d, s.values[i]] as const).filter((p): p is readonly [string, number] => p[1] != null && dayOf(p[0]) >= d0 && dayOf(p[0]) <= d1);
        if (pts.length === 0) continue;
        doc.lineWidth(1.1).strokeColor(s.color);
        pts.forEach(([d, v], i) => (i === 0 ? doc.moveTo(X(d), Y(v)) : doc.lineTo(X(d), Y(v))));
        doc.stroke();
        for (const [d, v] of pts) doc.circle(X(d), Y(v), 1.3).fill(s.color);
    }
    doc.restore();
    doc.save();
    for (const m of o.markers ?? []) {
        const x = X(m.date);
        if (x < x0 || x > x0 + w) continue;
        doc.moveTo(x, y0).lineTo(x, y0 + h).lineWidth(0.8).strokeColor(m.color).dash(3, { space: 2 }).stroke().undash();
        doc.font(FONT_BOLD).fontSize(6.5).fillColor(m.color).text(m.label, x + 2, y0 + h - 9, { lineBreak: false });
    }
    // legend: top-right inside the plot, away from the axis labels
    doc.font(FONT).fontSize(6.5);
    const legendW = o.series.reduce((t, s) => t + 11 + doc.widthOfString(s.label) + 10, 0);
    let lx = x0 + w - legendW - 2;
    const ly = y0 + 9;
    doc.save(); doc.fillOpacity(0.8); doc.rect(lx - 3, ly - 7, legendW + 4, 10).fill('#ffffff'); doc.restore();
    for (const s of o.series) {
        doc.rect(lx, ly - 4, 8, 3).fill(s.color);
        doc.fillColor(MUTED).text(s.label, lx + 11, ly - 6, { lineBreak: false });
        lx += 11 + doc.widthOfString(s.label) + 10;
    }
    doc.restore();
    doc.font(FONT).fontSize(10).fillColor(INK);
}

/** Coloured ticks on a date axis (the emulated scan timeline). */
export function scanStrip(doc: Pdf, o: { x: number; y: number; width: number; height: number; from: string; to: string; scans: Array<{ date: string; color: string }> }): void {
    const d0 = dayOf(o.from), d1 = dayOf(o.to);
    doc.save();
    doc.rect(o.x, o.y, o.width, o.height).fill(SOFT);
    for (const s of o.scans) {
        const x = o.x + ((dayOf(s.date) - d0) / Math.max(1, d1 - d0)) * o.width;
        if (x < o.x || x > o.x + o.width) continue;
        doc.rect(x - 1.2, o.y + 1, 2.4, o.height - 2).fill(s.color);
    }
    doc.restore();
}

/** Minimal JPEG size reader (SOF markers) so a scene can be placed without an image library. */
export function jpegSize(buf: Buffer): { width: number; height: number } | null {
    if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
    let i = 2;
    while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
        const len = buf.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + len;
    }
    return null;
}
