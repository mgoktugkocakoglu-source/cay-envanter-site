/**
 * Report builders (Faz 12). Each report compiles a {summary, columns, rows}
 * table from the shared seed layer, so the Reports Center can render any of
 * them through one generic table. Mirrors the future report-API contract.
 */

import { buildOverview, type Region } from '@/services/caykurData';
import { QUOTA_RECORDS, quotaByRegion } from '@/services/caykur/quota';
import { ACCRUALS } from '@/services/caykur/finance';
import { MEASUREMENTS } from '@/services/caykur/pruning';
import { dailyTotals } from '@/services/caykur/deliveries';
import { formatTRY, formatDate, round } from '@/services/caykur/rng';
import { formatNumber, formatKg, formatTon, formatPct } from '@/services/caykurData';

export interface ReportColumn {
    key: string;
    label: string;
    num?: boolean;
}
export interface ReportSummaryCard {
    label: string;
    value: string;
}
export interface ReportTable {
    summary: ReportSummaryCard[];
    columns: ReportColumn[];
    rows: Array<Record<string, string | number>>;
}

export interface ReportDef {
    id: string;
    title: string;
    description: string;
    group: string;
    live: boolean;
}

export const REPORT_DEFS: ReportDef[] = [
    { id: 'genel-uretim', title: 'Genel üretim raporu', description: 'Bölge bazında müstahsil, alan ve sezon üretimi', group: 'Üretim', live: true },
    { id: 'bolge-performans', title: 'Bölge performans raporu', description: 'Kota ve budama uyumuyla bölge karşılaştırması', group: 'Üretim', live: true },
    { id: 'gunluk-alim', title: 'Günlük alım raporu', description: 'Alım yeri bazında günlük yaş çay alımı', group: 'Üretim', live: true },
    { id: 'kota-kullanim', title: 'Kota kullanım raporu', description: 'Bölge bazında kota kullanım oranları', group: 'Kota', live: true },
    { id: 'kota-asimi', title: 'Kota aşımı raporu', description: 'Kotasını aşan müstahsiller', group: 'Kota', live: true },
    { id: 'hakedis', title: 'Hakediş & ödeme raporu', description: 'Bölge bazında hakediş, kesinti ve ödeme', group: 'Finans', live: true },
    { id: 'cari-bakiye', title: 'Cari bakiye raporu', description: 'En yüksek açık bakiyeye sahip müstahsiller', group: 'Finans', live: true },
    { id: 'budama-uyum', title: 'Budama uyum raporu', description: '1/7 rotasyon uyum dağılımı', group: 'Denetim', live: true },
    { id: 'mustahsil', title: 'Müstahsil raporu', description: 'Tüm müstahsil kayıt dökümü', group: 'Üretim', live: false },
    { id: 'parsel-verim', title: 'Parsel verim raporu', description: 'Parsel bazında verim geçmişi', group: 'Üretim', live: false },
    { id: 'talep-itiraz', title: 'Talep/itiraz raporu', description: 'Talep ve itiraz çözüm süreleri', group: 'Denetim', live: false },
    { id: 'belge-eksik', title: 'Belge eksikliği raporu', description: 'Eksik belgesi olan müstahsiller', group: 'Denetim', live: false },
];

const REGION_NAMES: Region[] = ['Rize', 'Trabzon', 'Artvin', 'Giresun'];

export function buildReport(id: string): ReportTable {
    switch (id) {
        case 'genel-uretim': {
            const o = buildOverview();
            return {
                summary: [
                    { label: 'Müstahsil', value: formatNumber(o.producerCount) },
                    { label: 'Ruhsatlı alan', value: `${formatNumber(o.totalDekar, 1)} da` },
                    { label: 'Sezon üretimi', value: formatTon(o.seasonKg) },
                    { label: 'Kota', value: formatTon(o.quotaKg) },
                ],
                columns: [
                    { key: 'region', label: 'Bölge' },
                    { key: 'producers', label: 'Müstahsil', num: true },
                    { key: 'dekar', label: 'Ruhsatlı alan', num: true },
                    { key: 'season', label: 'Sezon', num: true },
                ],
                rows: o.regions.map((r) => ({
                    region: r.region,
                    producers: formatNumber(r.producerCount),
                    dekar: `${formatNumber(r.totalDekar, 1)} da`,
                    season: formatTon(r.seasonKg),
                })),
            };
        }
        case 'bolge-performans': {
            const o = buildOverview();
            return {
                summary: [
                    { label: 'Bölge', value: formatNumber(o.regions.length) },
                    { label: 'Kota kullanımı', value: formatPct(o.kotaUsagePct) },
                    { label: 'Budama uyumu', value: formatPct(o.budamaCompliancePct) },
                ],
                columns: [
                    { key: 'region', label: 'Bölge' },
                    { key: 'producers', label: 'Müstahsil', num: true },
                    { key: 'season', label: 'Sezon', num: true },
                    { key: 'kota', label: 'Kota kullanımı', num: true },
                    { key: 'budama', label: 'Budama uyumu', num: true },
                ],
                rows: o.regions.map((r) => ({
                    region: r.region,
                    producers: formatNumber(r.producerCount),
                    season: formatTon(r.seasonKg),
                    kota: formatPct(r.kotaUsagePct),
                    budama: formatPct(r.budamaCompliancePct),
                })),
            };
        }
        case 'gunluk-alim': {
            const daily = dailyTotals().slice(0, 40);
            const totalKg = daily.reduce((s, d) => s + d.netKg, 0);
            return {
                summary: [
                    { label: 'Kayıt', value: formatNumber(daily.length) },
                    { label: 'Toplam net', value: formatTon(totalKg) },
                ],
                columns: [
                    { key: 'date', label: 'Tarih' },
                    { key: 'point', label: 'Alım yeri' },
                    { key: 'region', label: 'Bölge' },
                    { key: 'slips', label: 'Fiş', num: true },
                    { key: 'net', label: 'Net', num: true },
                ],
                rows: daily.map((d) => ({
                    date: formatDate(d.date),
                    point: d.pointName,
                    region: d.region,
                    slips: formatNumber(d.slips),
                    net: formatKg(d.netKg),
                })),
            };
        }
        case 'kota-kullanim': {
            const regions = quotaByRegion();
            return {
                summary: [
                    { label: 'Toplam kota', value: formatTon(regions.reduce((s, r) => s + r.quotaKg, 0)) },
                    { label: 'Kullanılan', value: formatTon(regions.reduce((s, r) => s + r.usedKg, 0)) },
                ],
                columns: [
                    { key: 'region', label: 'Bölge' },
                    { key: 'quota', label: 'Kota', num: true },
                    { key: 'used', label: 'Kullanılan', num: true },
                    { key: 'usage', label: 'Kullanım', num: true },
                    { key: 'over', label: 'Aşan', num: true },
                ],
                rows: regions.map((r) => ({
                    region: r.region,
                    quota: formatTon(r.quotaKg),
                    used: formatTon(r.usedKg),
                    usage: formatPct(r.usagePct),
                    over: formatNumber(r.overCount),
                })),
            };
        }
        case 'kota-asimi': {
            const over = QUOTA_RECORDS.filter((q) => q.status === 'over');
            return {
                summary: [
                    { label: 'Kota aşan', value: formatNumber(over.length) },
                    { label: 'Aşım toplamı', value: formatTon(over.reduce((s, q) => s + Math.max(0, -q.remainingKg), 0)) },
                ],
                columns: [
                    { key: 'producer', label: 'Müstahsil' },
                    { key: 'region', label: 'Bölge' },
                    { key: 'quota', label: 'Kota', num: true },
                    { key: 'used', label: 'Kullanılan', num: true },
                    { key: 'usage', label: 'Kullanım', num: true },
                ],
                rows: over.map((q) => ({
                    producer: q.producerName,
                    region: q.region,
                    quota: formatKg(q.quotaKg),
                    used: formatKg(q.usedKg),
                    usage: formatPct(q.usagePct),
                })),
            };
        }
        case 'hakedis': {
            const byRegion = REGION_NAMES.map((region) => {
                const rl = ACCRUALS.filter((a) => a.region === region);
                return {
                    region,
                    gross: rl.reduce((s, a) => s + a.grossAmount, 0),
                    ded: rl.reduce((s, a) => s + a.totalDeductions, 0),
                    net: rl.reduce((s, a) => s + a.netPayable, 0),
                    paid: rl.reduce((s, a) => s + a.paidAmount, 0),
                    out: rl.reduce((s, a) => s + a.balance, 0),
                };
            }).filter((r) => r.gross > 0);
            return {
                summary: [
                    { label: 'Brüt hakediş', value: formatTRY(byRegion.reduce((s, r) => s + r.gross, 0)) },
                    { label: 'Net hakediş', value: formatTRY(byRegion.reduce((s, r) => s + r.net, 0)) },
                    { label: 'Bakiye', value: formatTRY(byRegion.reduce((s, r) => s + r.out, 0)) },
                ],
                columns: [
                    { key: 'region', label: 'Bölge' },
                    { key: 'gross', label: 'Brüt', num: true },
                    { key: 'ded', label: 'Kesinti', num: true },
                    { key: 'net', label: 'Net', num: true },
                    { key: 'paid', label: 'Ödenen', num: true },
                    { key: 'out', label: 'Bakiye', num: true },
                ],
                rows: byRegion.map((r) => ({
                    region: r.region,
                    gross: formatTRY(r.gross),
                    ded: formatTRY(r.ded),
                    net: formatTRY(r.net),
                    paid: formatTRY(r.paid),
                    out: formatTRY(r.out),
                })),
            };
        }
        case 'cari-bakiye': {
            const top = [...ACCRUALS].filter((a) => a.balance > 0).slice(0, 20);
            return {
                summary: [
                    { label: 'Açık bakiyeli', value: formatNumber(ACCRUALS.filter((a) => a.balance > 0).length) },
                    { label: 'Toplam bakiye', value: formatTRY(ACCRUALS.reduce((s, a) => s + a.balance, 0)) },
                ],
                columns: [
                    { key: 'producer', label: 'Müstahsil' },
                    { key: 'region', label: 'Bölge' },
                    { key: 'net', label: 'Net hakediş', num: true },
                    { key: 'paid', label: 'Ödenen', num: true },
                    { key: 'balance', label: 'Bakiye', num: true },
                ],
                rows: top.map((a) => ({
                    producer: a.producerName,
                    region: a.region,
                    net: formatTRY(a.netPayable),
                    paid: formatTRY(a.paidAmount),
                    balance: formatTRY(a.balance),
                })),
            };
        }
        case 'budama-uyum': {
            const byRegion = REGION_NAMES.map((region) => {
                const rl = MEASUREMENTS.filter((m) => m.region === region);
                return {
                    region,
                    total: rl.length,
                    compliant: rl.filter((m) => m.status === 'compliant').length,
                    partial: rl.filter((m) => m.status === 'partial').length,
                    noncompliant: rl.filter((m) => m.status === 'noncompliant').length,
                };
            }).filter((r) => r.total > 0);
            return {
                summary: [
                    { label: 'Ölçüm', value: formatNumber(MEASUREMENTS.length) },
                    { label: 'Uyumlu', value: formatNumber(MEASUREMENTS.filter((m) => m.status === 'compliant').length) },
                    { label: 'Uyumsuz', value: formatNumber(MEASUREMENTS.filter((m) => m.status === 'noncompliant').length) },
                ],
                columns: [
                    { key: 'region', label: 'Bölge' },
                    { key: 'total', label: 'Ölçüm', num: true },
                    { key: 'compliant', label: 'Uyumlu', num: true },
                    { key: 'partial', label: 'Kısmi', num: true },
                    { key: 'noncompliant', label: 'Uyumsuz', num: true },
                    { key: 'rate', label: 'Uyum oranı', num: true },
                ],
                rows: byRegion.map((r) => ({
                    region: r.region,
                    total: formatNumber(r.total),
                    compliant: formatNumber(r.compliant),
                    partial: formatNumber(r.partial),
                    noncompliant: formatNumber(r.noncompliant),
                    rate: formatPct(round((r.compliant / r.total) * 100, 0)),
                })),
            };
        }
        default:
            return { summary: [], columns: [], rows: [] };
    }
}
