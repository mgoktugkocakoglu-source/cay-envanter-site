/**
 * Deterministic pseudo-random helpers + season anchors for the Çaykur
 * enterprise demo dataset. Every generator keys off these so the whole
 * platform shows the same numbers on every reload — essential for a
 * screenshot-stable pitch demo. Mirrors the noise() used in caykurData.ts.
 */

/** Deterministic 0..1 pseudo-noise keyed by seed (stable across reloads). */
export function noise(seed: number): number {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
}

/** Pick a deterministic element from an array. */
export function pick<T>(arr: T[], seed: number): T {
    return arr[Math.floor(noise(seed) * arr.length) % arr.length];
}

/** Deterministic integer in [min, max]. */
export function intBetween(min: number, max: number, seed: number): number {
    return Math.floor(min + noise(seed) * (max - min + 1));
}

/** Deterministic float in [min, max]. */
export function floatBetween(min: number, max: number, seed: number): number {
    return min + noise(seed) * (max - min);
}

export function round(value: number, digits = 0): number {
    const f = 10 ** digits;
    return Math.round(value * f) / f;
}

export function pad(value: number | string, length: number): string {
    return String(value).padStart(length, '0');
}

/** Stable boolean with the given probability. */
export function chance(probability: number, seed: number): boolean {
    return noise(seed) < probability;
}

// ─────────────────────────────────────────────────────────────────────────
// Season / date anchors — fixed so the demo is reproducible.
// ─────────────────────────────────────────────────────────────────────────

export const SEASON_YEAR = 2025;
/** The "current day" the demo is frozen at (mid-campaign). */
export const DEMO_TODAY = new Date(`${SEASON_YEAR}-09-15T09:00:00`);

const MS_PER_DAY = 86_400_000;

/** ISO `YYYY-MM-DD` for a date `daysAgo` before the frozen demo day. */
export function dateDaysAgo(daysAgo: number): string {
    return new Date(DEMO_TODAY.getTime() - daysAgo * MS_PER_DAY).toISOString().slice(0, 10);
}

/** ISO `YYYY-MM-DD` for an arbitrary day in the season year. */
export function seasonDate(month1to12: number, day: number): string {
    return `${SEASON_YEAR}-${pad(month1to12, 2)}-${pad(day, 2)}`;
}

/** Full ISO timestamp `daysAgo` before the frozen demo day, with hour/min. */
export function timestampDaysAgo(daysAgo: number, hour = 10, minute = 0): string {
    const d = new Date(DEMO_TODAY.getTime() - daysAgo * MS_PER_DAY);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
}

/** Human `gg.aa.yyyy` (tr-TR) from an ISO date/timestamp string. */
export function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Human `gg.aa.yyyy HH:MM` (tr-TR) from an ISO timestamp string. */
export function formatDateTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** "3 gün önce" style relative label from an ISO timestamp. */
export function relativeFromNow(iso: string): string {
    const d = new Date(iso);
    const diffDays = Math.round((DEMO_TODAY.getTime() - d.getTime()) / MS_PER_DAY);
    if (diffDays <= 0) return 'bugün';
    if (diffDays === 1) return 'dün';
    if (diffDays < 7) return `${diffDays} gün önce`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} hafta önce`;
    return `${Math.floor(diffDays / 30)} ay önce`;
}

/** Turkish money formatting (₺). */
export function formatTRY(value: number, digits = 0): string {
    return `${value.toLocaleString('tr-TR', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
    })} ₺`;
}

/** Compact money for large sums: 1.2 mn ₺ / 850 b ₺. */
export function formatTRYCompact(value: number): string {
    if (Math.abs(value) >= 1_000_000) {
        return `${(value / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} mn ₺`;
    }
    if (Math.abs(value) >= 1_000) {
        return `${(value / 1_000).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} b ₺`;
    }
    return formatTRY(value);
}
