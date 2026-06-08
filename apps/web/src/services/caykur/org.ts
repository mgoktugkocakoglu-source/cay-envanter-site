/**
 * Organisational hierarchy (Faz 8): Bölge → Fabrika → Alım Yeri, plus the
 * institutional staff assigned to them. Factories are derived from the
 * distinct factory names already carried on the producer registry so the
 * hierarchy stays consistent with producer assignments automatically.
 */

import { PRODUCERS, type Region } from '@/services/caykurData';
import { intBetween, noise, pad, pick, round } from '@/services/caykur/rng';
import { ROLE_DEFS, type CaykurRole } from '@/services/caykur/roles';

export interface RegionInfo {
    name: Region;
    code: string;
    /** Approx. centre for map placeholders. */
    lat: number;
    lng: number;
}

export const REGIONS: RegionInfo[] = [
    { name: 'Rize', code: '53', lat: 41.02, lng: 40.52 },
    { name: 'Trabzon', code: '61', lat: 40.99, lng: 39.72 },
    { name: 'Artvin', code: '08', lat: 41.18, lng: 41.82 },
    { name: 'Giresun', code: '28', lat: 40.91, lng: 38.39 },
];

export function regionInfo(name: Region): RegionInfo {
    return REGIONS.find((r) => r.name === name) ?? REGIONS[0];
}

export interface Factory {
    id: string;
    name: string;
    region: Region;
    /** Daily processing capacity (tonnes of fresh leaf). */
    dailyCapacityTon: number;
    producerCount: number;
    licensedDekar: number;
    seasonKg: number;
    manager: string;
    phone: string;
}

export interface PurchasePoint {
    id: string;
    name: string;
    factoryId: string;
    factoryName: string;
    region: Region;
    district: string;
    address: string;
    lat: number;
    lng: number;
    collectorName: string;
    collectorPhone: string;
    /** Daily intake capacity in kg. */
    dailyCapacityKg: number;
    producerCount: number;
    isActive: boolean;
}

export interface Staff {
    id: string;
    fullName: string;
    role: CaykurRole;
    title: string;
    region: Region | 'Genel';
    scope: string;
    phone: string;
    email: string;
    active: boolean;
    lastActive: string;
}

const MANAGER_NAMES = [
    'Naci Hocaoğlu', 'Vedat Karadeniz', 'Şükrü Pehlivan', 'Cemal Memişoğlu',
    'Orhan Albayrak', 'Necati Tunç', 'Bayram Çakır', 'Selim Korkmaz',
    'Kemal Aksoy', 'Recep Bıçakçı', 'Osman Güler', 'Nurettin Polat',
];

const COLLECTOR_NAMES = [
    'Erkan Kara', 'Mahir Doğan', 'Sefa Kılıç', 'Tuncay Çetin', 'Ufuk Koç',
    'Burak Kurt', 'Hakan Özdemir', 'Serkan Şimşek', 'Volkan Sarı', 'Murat Yıldız',
    'Engin Arslan', 'Kadir Çelik', 'Onur Aydın', 'Barış Demir', 'Gökhan Şahin',
];

function slug(name: string): string {
    return name
        .toLocaleLowerCase('tr')
        .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
        .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function phone(seed: number): string {
    return `05${pad(intBetween(30, 59, seed), 2)} ${pad(intBetween(100, 999, seed + 1), 3)} ${pad(intBetween(10, 99, seed + 2), 2)} ${pad(intBetween(10, 99, seed + 3), 2)}`;
}

// ── Factories (derived from producer.factory) ──────────────────────────────

function buildFactories(): Factory[] {
    const byName = new Map<string, { region: Region; producers: typeof PRODUCERS }>();
    for (const p of PRODUCERS) {
        const entry = byName.get(p.factory);
        if (entry) entry.producers.push(p);
        else byName.set(p.factory, { region: p.region, producers: [p] });
    }

    return Array.from(byName.entries())
        .map(([name, { region, producers }], i) => {
            const seasonKg = producers.reduce((s, p) => s + p.seasonKg, 0);
            const licensedDekar = round(producers.reduce((s, p) => s + p.licensedDekar, 0), 1);
            return {
                id: `fab-${slug(name)}`,
                name,
                region,
                dailyCapacityTon: intBetween(60, 240, i * 3 + 1),
                producerCount: producers.length,
                licensedDekar,
                seasonKg,
                manager: pick(MANAGER_NAMES, i * 7 + 2),
                phone: phone(i * 11 + 5),
            };
        })
        .sort((a, b) => b.seasonKg - a.seasonKg);
}

export const FACTORIES: Factory[] = buildFactories();

const FACTORY_BY_NAME = new Map(FACTORIES.map((f) => [f.name, f]));

export function factoryByName(name: string): Factory | undefined {
    return FACTORY_BY_NAME.get(name);
}

export function factoryById(id: string): Factory | undefined {
    return FACTORIES.find((f) => f.id === id);
}

// ── Purchase points (alım yeri): 1–3 per factory ───────────────────────────

const POINT_SUFFIX = ['Merkez Alım', 'Sahil Alım', 'Köy Alım', 'Yukarı Mah. Alım'];

function buildPurchasePoints(): PurchasePoint[] {
    const points: PurchasePoint[] = [];
    FACTORIES.forEach((f, fi) => {
        const region = regionInfo(f.region);
        const districts = Array.from(
            new Set(PRODUCERS.filter((p) => p.factory === f.name).map((p) => p.district)),
        );
        const count = Math.min(POINT_SUFFIX.length, Math.max(1, Math.min(3, Math.ceil(f.producerCount / 4))));
        for (let i = 0; i < count; i++) {
            const district = districts[i % Math.max(1, districts.length)] ?? f.region;
            const seed = fi * 17 + i * 3;
            points.push({
                id: `${f.id}-ay-${i + 1}`,
                name: `${f.name.replace(' Fab.', '')} ${POINT_SUFFIX[i]}`,
                factoryId: f.id,
                factoryName: f.name,
                region: f.region,
                district,
                address: `${district}, ${f.region}`,
                lat: round(region.lat + (noise(seed) - 0.5) * 0.18, 5),
                lng: round(region.lng + (noise(seed + 1) - 0.5) * 0.22, 5),
                collectorName: pick(COLLECTOR_NAMES, seed + 4),
                collectorPhone: phone(seed + 6),
                dailyCapacityKg: intBetween(8, 26, seed + 9) * 1000,
                producerCount: 0,
                isActive: noise(seed + 12) > 0.06,
            });
        }
    });
    return points;
}

export const PURCHASE_POINTS: PurchasePoint[] = buildPurchasePoints();

/**
 * Stable assignment of each producer to one purchase point at their factory.
 * Used by deliveries + producer detail. Returns a Map<producerId, point>.
 */
function buildProducerPointMap(): Map<string, PurchasePoint> {
    const map = new Map<string, PurchasePoint>();
    const pointsByFactory = new Map<string, PurchasePoint[]>();
    for (const pt of PURCHASE_POINTS) {
        const list = pointsByFactory.get(pt.factoryId) ?? [];
        list.push(pt);
        pointsByFactory.set(pt.factoryId, list);
    }
    PRODUCERS.forEach((p, i) => {
        const factory = factoryByName(p.factory);
        const pts = factory ? pointsByFactory.get(factory.id) ?? [] : [];
        if (pts.length > 0) {
            const pt = pts[Math.floor(noise(i * 2.7 + 4) * pts.length) % pts.length];
            pt.producerCount += 1;
            map.set(p.id, pt);
        }
    });
    return map;
}

const PRODUCER_POINT = buildProducerPointMap();

export function purchasePointForProducer(producerId: string): PurchasePoint | undefined {
    return PRODUCER_POINT.get(producerId);
}

export function purchasePointById(id: string): PurchasePoint | undefined {
    return PURCHASE_POINTS.find((pt) => pt.id === id);
}

// ── Institutional staff ────────────────────────────────────────────────────

function buildStaff(): Staff[] {
    const staff: Staff[] = [];

    // Genel müdürlük leadership (admins / finance / audit).
    const leadership: Array<{ name: string; role: CaykurRole; title: string }> = [
        { name: 'Selçuk Aydın', role: 'kurum_admin', title: 'Kurum Yöneticisi' },
        { name: 'Hülya Yıldız', role: 'finans', title: 'Finans Müdürü' },
        { name: 'Ayla Demir', role: 'denetci', title: 'Başdenetçi' },
        { name: 'Gülşen Öztürk', role: 'finans', title: 'Finans Personeli' },
    ];
    leadership.forEach((l, i) => {
        staff.push({
            id: `stf-${pad(i + 1, 3)}`,
            fullName: l.name,
            role: l.role,
            title: l.title,
            region: 'Genel',
            scope: 'Genel Müdürlük',
            phone: phone(i * 5 + 100),
            email: `${slug(l.name)}@caykur.gov.tr`,
            active: true,
            lastActive: '',
        });
    });

    // One manager per factory.
    FACTORIES.forEach((f, i) => {
        staff.push({
            id: `stf-fab-${slug(f.name)}`,
            fullName: f.manager,
            role: 'fabrika_sorumlusu',
            title: 'Fabrika Sorumlusu',
            region: f.region,
            scope: f.name,
            phone: f.phone,
            email: `${slug(f.manager)}@caykur.gov.tr`,
            active: true,
            lastActive: '',
        });
    });

    // One staffer per purchase point (alım yeri personeli) + a field officer.
    PURCHASE_POINTS.forEach((pt, i) => {
        staff.push({
            id: `stf-${pt.id}`,
            fullName: pt.collectorName,
            role: 'alim_yeri_personeli',
            title: 'Alım Yeri Personeli',
            region: pt.region,
            scope: pt.name,
            phone: pt.collectorPhone,
            email: `${slug(pt.collectorName)}.${i}@caykur.gov.tr`,
            active: pt.isActive,
            lastActive: '',
        });
    });

    const fieldOfficers = ['Davut Şahin', 'Yılmaz Çelik', 'İbrahim Kaya', 'Mustafa Yılmaz', 'Hasan Demir', 'Ali Arslan'];
    fieldOfficers.forEach((name, i) => {
        const region = REGIONS[i % REGIONS.length].name;
        staff.push({
            id: `stf-saha-${pad(i + 1, 2)}`,
            fullName: name,
            role: 'saha_personeli',
            title: 'Saha Personeli',
            region,
            scope: `${region} sahası`,
            phone: phone(i * 9 + 300),
            email: `${slug(name)}.saha@caykur.gov.tr`,
            active: true,
            lastActive: '',
        });
    });

    // Stable "last active" stamps (string set later to avoid import cycle).
    return staff.map((s, i) => ({
        ...s,
        lastActive: lastActiveStamp(i),
    }));
}

function lastActiveStamp(i: number): string {
    // Spread recent activity over the last ~10 days deterministically.
    const days = intBetween(0, 9, i * 3 + 7);
    const hour = intBetween(8, 18, i * 2 + 3);
    const d = new Date(`2025-09-15T00:00:00`);
    d.setDate(d.getDate() - days);
    d.setHours(hour, intBetween(0, 59, i + 1), 0, 0);
    return d.toISOString();
}

export const STAFF: Staff[] = buildStaff();

export function staffById(id: string): Staff | undefined {
    return STAFF.find((s) => s.id === id);
}

export const ROLE_COUNTS: Array<{ role: CaykurRole; label: string; count: number }> =
    ROLE_DEFS.map((def) => ({
        role: def.id,
        label: def.label,
        count: STAFF.filter((s) => s.role === def.id).length,
    }));
