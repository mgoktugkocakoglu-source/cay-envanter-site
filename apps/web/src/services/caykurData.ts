/**
 * Çaykur command-center demo dataset + compliance model.
 *
 * This is a self-contained, deterministic synthetic dataset of müstahsil
 * (tea producers) used to power the Çaykur monitoring panel demo. It also
 * serves as the spec for the real backend seed/aggregation endpoints:
 * every derived metric here (kota usage, 1/7 budama rotation compliance,
 * sürgün breakdown, quality) maps 1:1 to a column or computed value.
 *
 * Domain rules encoded:
 *  - Quota (kota): annual quota = quotaPerDekar × licensed dekar. Çaykur
 *    sets this off the ruhsatlı (licensed) area; organic gets a lower tier.
 *  - Budama rotation: the government rule prunes 1/7 of each licensed garden
 *    per year on a 7-year cycle (≈14.3% target band). Tazminat (income-loss
 *    compensation) is paid for compliant rotation.
 *  - Quality: share of standart dışı (out-of-standard / kaba) leaf.
 *
 * Numbers are illustrative but kept within realistic ranges for credibility.
 */

export type Region = 'Rize' | 'Trabzon' | 'Artvin' | 'Giresun';
export type ComplianceStatus = 'compliant' | 'partial' | 'noncompliant';

export interface Producer {
    id: string;
    fullName: string;
    ruhsatNo: string;
    cuzdanNo: string;
    region: Region;
    district: string;
    factory: string;
    licensedDekar: number;
    organic: boolean;
    /** Total fresh leaf delivered this season (kg). */
    seasonKg: number;
    /** Per-flush (sürgün) breakdown of seasonKg. */
    surgun: { s1: number; s2: number; s3: number };
    /** Annual purchase quota (kg) = quotaPerDekar × licensedDekar. */
    quotaKg: number;
    /** Total garden area (m²) ≈ licensedDekar × 1000. */
    gardenM2: number;
    /** Area pruned this year (m²); the 1/7 rule targets gardenM2 / 7. */
    prunedThisYearM2: number;
    /** Last 7 years' rotation: did the producer prune that year's slice. */
    rotationHistory: boolean[];
    /** Share of out-of-standard (standart dışı / kaba) leaf, percent. */
    outOfStandardPct: number;
}

/** The 1/7 rotation target, as a percentage of total garden area per year. */
export const BUDAMA_TARGET_PCT = 100 / 7; // ≈ 14.3%

const QUOTA_PER_DEKAR_CONVENTIONAL = 2000;
const QUOTA_PER_DEKAR_ORGANIC = 1500;

const FIRST_NAMES = [
    'Ahmet', 'Mehmet', 'Hasan', 'Hüseyin', 'Mustafa', 'İbrahim', 'Osman', 'Recep',
    'Ramazan', 'Yusuf', 'Ali', 'Salih', 'Fatma', 'Ayşe', 'Emine', 'Hatice',
    'Zeynep', 'Şükrü', 'Temel', 'Cemal', 'Kemal', 'Necati', 'Vedat', 'Bayram',
    'Selim', 'Orhan', 'Nurettin', 'Fadime', 'Gülşen', 'Yılmaz',
];
const LAST_NAMES = [
    'Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Aydın', 'Öztürk',
    'Arslan', 'Doğan', 'Kılıç', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özdemir',
    'Şimşek', 'Polat', 'Korkmaz', 'Çakır', 'Güler', 'Aksoy', 'Hocaoğlu',
    'Karadeniz', 'Pehlivan', 'Memişoğlu', 'Bıçakçı', 'Tunç', 'Albayrak', 'Sarı',
];

const DISTRICTS: Record<Region, string[]> = {
    Rize: ['Merkez', 'Çayeli', 'Pazar', 'Ardeşen', 'Fındıklı', 'İyidere', 'Kalkandere', 'Güneysu'],
    Trabzon: ['Of', 'Sürmene', 'Araklı', 'Çaykara', 'Arsin'],
    Artvin: ['Arhavi', 'Hopa', 'Kemalpaşa', 'Borçka'],
    Giresun: ['Merkez', 'Bulancak', 'Espiye', 'Tirebolu'],
};

const FACTORIES: Record<Region, string[]> = {
    Rize: ['Rize 100. Yıl Fab.', 'Çayeli Fab.', 'Pazar Fab.', 'Ardeşen Fab.', 'Güneysu Fab.'],
    Trabzon: ['Of Fab.', 'Sürmene Fab.', 'Araklı Fab.'],
    Artvin: ['Arhavi Fab.', 'Hopa Fab.', 'Muratlı Fab.'],
    Giresun: ['Giresun Fab.', 'Bulancak Fab.'],
};

const REGION_CODE: Record<Region, string> = {
    Rize: '53', Trabzon: '61', Artvin: '08', Giresun: '28',
};

/** Interleaved region pattern: Rize-dominant, the rest mixed in. */
const REGION_PATTERN: Region[] = [
    'Rize', 'Rize', 'Trabzon', 'Rize', 'Artvin', 'Rize', 'Trabzon',
    'Rize', 'Giresun', 'Rize', 'Trabzon', 'Rize', 'Artvin', 'Rize',
];

/** Deterministic 0..1 pseudo-noise keyed by seed (stable across reloads). */
function noise(seed: number): number {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
}

function pick<T>(arr: T[], seed: number): T {
    return arr[Math.floor(noise(seed) * arr.length) % arr.length];
}

function round(value: number, digits = 0): number {
    const f = 10 ** digits;
    return Math.round(value * f) / f;
}

function pad(value: number, length: number): string {
    return String(value).padStart(length, '0');
}

function buildProducer(i: number): Producer {
    const region = REGION_PATTERN[i % REGION_PATTERN.length];
    const district = pick(DISTRICTS[region], i * 3 + 1);
    const factory = pick(FACTORIES[region], i * 5 + 2);
    const fullName = `${FIRST_NAMES[(i * 7 + 2) % FIRST_NAMES.length]} ${LAST_NAMES[(i * 5 + 3) % LAST_NAMES.length]}`;

    const organic = noise(i * 1.7 + 9) < 0.18;
    const licensedDekar = round(2 + noise(i * 2.3 + 4) * 22, 1);
    const quotaPerDekar = organic ? QUOTA_PER_DEKAR_ORGANIC : QUOTA_PER_DEKAR_CONVENTIONAL;
    const quotaKg = Math.round(quotaPerDekar * licensedDekar);

    // Delivery this season: 55%–125% of quota — some producers exceed the cap.
    const usageFactor = 0.55 + noise(i * 4.1 + 7) * 0.7;
    const seasonKg = Math.round(quotaKg * usageFactor);

    // Sürgün split (1./2./3. flush): roughly 42% / 34% / 24% with jitter.
    const j = (noise(i * 6.7 + 11) - 0.5) * 0.08;
    const s1 = Math.round(seasonKg * (0.42 + j));
    const s2 = Math.round(seasonKg * (0.34 - j * 0.5));
    const s3 = Math.max(0, seasonKg - s1 - s2);

    const gardenM2 = Math.round(licensedDekar * 1000);

    // Budama profile → this year's pruned ratio of the whole garden.
    const profileSeed = noise(i * 3.9 + 5);
    const ratioSeed = noise(i * 8.3 + 6);
    let prunedRatio: number;
    if (profileSeed < 0.6) {
        prunedRatio = 0.12 + ratioSeed * 0.07; // compliant band ~12–19%
    } else if (profileSeed < 0.85) {
        prunedRatio = 0.06 + ratioSeed * 0.05; // partial ~6–11%
    } else {
        prunedRatio = ratioSeed * 0.05; // noncompliant 0–5%
    }
    const prunedThisYearM2 = Math.round(gardenM2 * prunedRatio);

    // 7-year rotation history: compliant producers prune most years.
    const rotationHistory = Array.from({ length: 7 }, (_, y) => {
        const base = profileSeed < 0.6 ? 0.82 : profileSeed < 0.85 ? 0.55 : 0.3;
        return noise(i * 10 + y * 1.3 + 13) < base;
    });
    // The current year's slice must match this year's actual pruning ratio
    // (≥6% of the garden counts as pruned), so the timeline can't contradict it.
    rotationHistory[rotationHistory.length - 1] = prunedRatio >= 0.06;

    // Quality: out-of-standard share; weaker rotation correlates with more kaba leaf.
    const qualityBase = 2 + noise(i * 5.5 + 8) * 14;
    const outOfStandardPct = round(qualityBase + (profileSeed > 0.85 ? 5 : 0), 1);

    return {
        id: `mus-${pad(i + 1, 3)}`,
        fullName,
        ruhsatNo: `${REGION_CODE[region]}-${pad(Math.floor(noise(i * 2 + 1) * 9000) + 1000, 4)}-${pad(i + 1, 3)}`,
        cuzdanNo: pad(Math.floor(noise(i * 9 + 3) * 900000) + 100000, 6),
        region,
        district,
        factory,
        licensedDekar,
        organic,
        seasonKg,
        surgun: { s1, s2, s3 },
        quotaKg,
        gardenM2,
        prunedThisYearM2,
        rotationHistory,
        outOfStandardPct,
    };
}

/** The demo producer registry (deterministic, stable across reloads). */
export const PRODUCERS: Producer[] = Array.from({ length: 44 }, (_, i) => buildProducer(i));

/** Current campaign/season label shown in the panel header — dynamic per year. */
export const SEASON_LABEL = `${new Date().getFullYear()} Sezonu`;

// ─────────────────────────────────────────────────────────────────────────
// Derived metrics (pure — mirror the backend aggregation contract)
// ─────────────────────────────────────────────────────────────────────────

export type Tone = 'success' | 'warning' | 'danger';

/** Meter tone for a kota-usage percentage (over cap = danger). */
export function kotaTone(pct: number): Tone {
    if (pct > 100) return 'danger';
    if (pct >= 90) return 'warning';
    return 'success';
}

/** Meter/badge tone for a compliance status. */
export function statusTone(status: ComplianceStatus): Tone {
    if (status === 'compliant') return 'success';
    if (status === 'partial') return 'warning';
    return 'danger';
}

export function kotaUsagePct(p: Producer): number {
    return p.quotaKg > 0 ? (p.seasonKg / p.quotaKg) * 100 : 0;
}

export function budamaRatioPct(p: Producer): number {
    return p.gardenM2 > 0 ? (p.prunedThisYearM2 / p.gardenM2) * 100 : 0;
}

export function budamaStatus(p: Producer): ComplianceStatus {
    const ratio = budamaRatioPct(p);
    if (ratio >= 11 && ratio <= 20) return 'compliant';
    if (ratio >= 6) return 'partial';
    return 'noncompliant';
}

export function qualityStatus(p: Producer): ComplianceStatus {
    if (p.outOfStandardPct <= 6) return 'compliant';
    if (p.outOfStandardPct <= 12) return 'partial';
    return 'noncompliant';
}

export interface ProducerFlag {
    kind: 'kota_over' | 'kota_critical' | 'budama_missing' | 'quality';
    severity: 'danger' | 'warning';
    label: string;
}

/** Issues that should surface a producer in "Dikkat gerektirenler". */
export function producerFlags(p: Producer): ProducerFlag[] {
    const flags: ProducerFlag[] = [];
    const usage = kotaUsagePct(p);
    if (usage > 100) {
        flags.push({ kind: 'kota_over', severity: 'danger', label: `Kota aşıldı (%${Math.round(usage)})` });
    } else if (usage >= 90) {
        flags.push({ kind: 'kota_critical', severity: 'warning', label: `Kota kritik (%${Math.round(usage)})` });
    }
    if (budamaStatus(p) === 'noncompliant') {
        flags.push({ kind: 'budama_missing', severity: 'danger', label: 'Budama yapılmadı' });
    }
    if (qualityStatus(p) === 'noncompliant') {
        flags.push({ kind: 'quality', severity: 'warning', label: `Standart dışı %${Math.round(p.outOfStandardPct)}` });
    }
    return flags;
}

export interface RegionRollup {
    region: Region;
    producerCount: number;
    totalDekar: number;
    seasonKg: number;
    kotaUsagePct: number;
    budamaCompliancePct: number;
}

export interface Overview {
    season: string;
    producerCount: number;
    totalDekar: number;
    seasonKg: number;
    quotaKg: number;
    kotaUsagePct: number;
    budamaCompliancePct: number;
    qualityFlagCount: number;
    organicCount: number;
    surgun: { s1: number; s2: number; s3: number };
    regions: RegionRollup[];
}

function complianceRate(list: Producer[]): number {
    if (list.length === 0) return 0;
    const ok = list.filter((p) => budamaStatus(p) === 'compliant').length;
    return (ok / list.length) * 100;
}

function sumBy(list: Producer[], fn: (p: Producer) => number): number {
    return list.reduce((acc, p) => acc + fn(p), 0);
}

export function buildOverview(list: Producer[] = PRODUCERS): Overview {
    const seasonKg = sumBy(list, (p) => p.seasonKg);
    const quotaKg = sumBy(list, (p) => p.quotaKg);
    const regionNames: Region[] = ['Rize', 'Trabzon', 'Artvin', 'Giresun'];

    const regions: RegionRollup[] = regionNames
        .map((region) => {
            const rl = list.filter((p) => p.region === region);
            const rSeason = sumBy(rl, (p) => p.seasonKg);
            const rQuota = sumBy(rl, (p) => p.quotaKg);
            return {
                region,
                producerCount: rl.length,
                totalDekar: round(sumBy(rl, (p) => p.licensedDekar), 1),
                seasonKg: rSeason,
                kotaUsagePct: rQuota > 0 ? (rSeason / rQuota) * 100 : 0,
                budamaCompliancePct: complianceRate(rl),
            };
        })
        .filter((r) => r.producerCount > 0);

    return {
        season: SEASON_LABEL,
        producerCount: list.length,
        totalDekar: round(sumBy(list, (p) => p.licensedDekar), 1),
        seasonKg,
        quotaKg,
        kotaUsagePct: quotaKg > 0 ? (seasonKg / quotaKg) * 100 : 0,
        budamaCompliancePct: complianceRate(list),
        qualityFlagCount: list.filter((p) => qualityStatus(p) === 'noncompliant').length,
        organicCount: list.filter((p) => p.organic).length,
        surgun: {
            s1: sumBy(list, (p) => p.surgun.s1),
            s2: sumBy(list, (p) => p.surgun.s2),
            s3: sumBy(list, (p) => p.surgun.s3),
        },
        regions,
    };
}

const SEVERITY_ORDER: Record<ProducerFlag['severity'], number> = { danger: 0, warning: 1 };

/** Flagged producers, most severe first — feeds "Dikkat gerektirenler". */
export function flaggedProducers(list: Producer[] = PRODUCERS): Array<{ producer: Producer; flags: ProducerFlag[] }> {
    return list
        .map((producer) => ({ producer, flags: producerFlags(producer) }))
        .filter((row) => row.flags.length > 0)
        .sort((a, b) => {
            const sa = Math.min(...a.flags.map((f) => SEVERITY_ORDER[f.severity]));
            const sb = Math.min(...b.flags.map((f) => SEVERITY_ORDER[f.severity]));
            if (sa !== sb) return sa - sb;
            return b.flags.length - a.flags.length;
        });
}

export function getProducer(id: string): Producer | undefined {
    return PRODUCERS.find((p) => p.id === id);
}

// ─────────────────────────────────────────────────────────────────────────
// Formatters (tr-TR) — numbers carry the product's promise: full, not muted.
// ─────────────────────────────────────────────────────────────────────────

export function formatNumber(value: number, digits = 0): string {
    return value.toLocaleString('tr-TR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function formatKg(kg: number): string {
    return `${formatNumber(kg)} kg`;
}

/** Large leaf totals read better in tonnes. */
export function formatTon(kg: number): string {
    return `${formatNumber(kg / 1000, 1)} ton`;
}

export function formatDekar(dekar: number): string {
    return `${formatNumber(dekar, 1)} da`;
}

export function formatPct(value: number, digits = 0): string {
    return `%${formatNumber(value, digits)}`;
}
