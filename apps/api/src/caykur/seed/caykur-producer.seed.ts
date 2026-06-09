/**
 * Deterministic müstahsil generator — a 1:1 port of the frontend
 * apps/web/src/services/caykurData.ts `buildProducer`. Same noise function and
 * seeds, so the database population is byte-identical to the original demo
 * dataset. This is the single source the seeder writes into caykur_producers.
 */

export interface GeneratedProducer {
    id: string;
    fullName: string;
    ruhsatNo: string;
    cuzdanNo: string;
    region: string;
    district: string;
    factory: string;
    licensedDekar: number;
    organic: boolean;
    seasonKg: number;
    surgunS1: number;
    surgunS2: number;
    surgunS3: number;
    quotaKg: number;
    gardenM2: number;
    prunedThisYearM2: number;
    rotationHistory: boolean[];
    outOfStandardPct: number;
}

type Region = 'Rize' | 'Trabzon' | 'Artvin' | 'Giresun';

export const PRODUCER_COUNT = 44;

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

const REGION_PATTERN: Region[] = [
    'Rize', 'Rize', 'Trabzon', 'Rize', 'Artvin', 'Rize', 'Trabzon',
    'Rize', 'Giresun', 'Rize', 'Trabzon', 'Rize', 'Artvin', 'Rize',
];

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

function buildProducer(i: number): GeneratedProducer {
    const region = REGION_PATTERN[i % REGION_PATTERN.length];
    const district = pick(DISTRICTS[region], i * 3 + 1);
    const factory = pick(FACTORIES[region], i * 5 + 2);
    const fullName = `${FIRST_NAMES[(i * 7 + 2) % FIRST_NAMES.length]} ${LAST_NAMES[(i * 5 + 3) % LAST_NAMES.length]}`;

    const organic = noise(i * 1.7 + 9) < 0.18;
    const licensedDekar = round(2 + noise(i * 2.3 + 4) * 22, 1);
    const quotaPerDekar = organic ? QUOTA_PER_DEKAR_ORGANIC : QUOTA_PER_DEKAR_CONVENTIONAL;
    const quotaKg = Math.round(quotaPerDekar * licensedDekar);

    const usageFactor = 0.55 + noise(i * 4.1 + 7) * 0.7;
    const seasonKg = Math.round(quotaKg * usageFactor);

    const j = (noise(i * 6.7 + 11) - 0.5) * 0.08;
    const s1 = Math.round(seasonKg * (0.42 + j));
    const s2 = Math.round(seasonKg * (0.34 - j * 0.5));
    const s3 = Math.max(0, seasonKg - s1 - s2);

    const gardenM2 = Math.round(licensedDekar * 1000);

    const profileSeed = noise(i * 3.9 + 5);
    const ratioSeed = noise(i * 8.3 + 6);
    let prunedRatio: number;
    if (profileSeed < 0.6) {
        prunedRatio = 0.12 + ratioSeed * 0.07;
    } else if (profileSeed < 0.85) {
        prunedRatio = 0.06 + ratioSeed * 0.05;
    } else {
        prunedRatio = ratioSeed * 0.05;
    }
    const prunedThisYearM2 = Math.round(gardenM2 * prunedRatio);

    const rotationHistory = Array.from({ length: 7 }, (_, y) => {
        const base = profileSeed < 0.6 ? 0.82 : profileSeed < 0.85 ? 0.55 : 0.3;
        return noise(i * 10 + y * 1.3 + 13) < base;
    });
    rotationHistory[rotationHistory.length - 1] = prunedRatio >= 0.06;

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
        surgunS1: s1,
        surgunS2: s2,
        surgunS3: s3,
        quotaKg,
        gardenM2,
        prunedThisYearM2,
        rotationHistory,
        outOfStandardPct,
    };
}

/** The deterministic 44-producer demo population. */
export function generateProducers(): GeneratedProducer[] {
    return Array.from({ length: PRODUCER_COUNT }, (_, i) => buildProducer(i));
}
