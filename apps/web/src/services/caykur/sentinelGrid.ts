/**
 * Sentinel-2's real pixel lattice, drawn over a garden so the reader sees what the sensor actually
 * averaged: Level-2A tiles are gridded in UTM at 10 m, pixel edges on multiples of 10 m. We convert
 * the view to that UTM zone, lay the 10 m lines, and count the pixel centres a polygon encloses.
 * WGS84 ↔ UTM uses the Krüger series (millimetre accuracy within a zone), no external library.
 */

const A = 6378137;
const F = 1 / 298.257223563;
const K0 = 0.9996;
const E0 = 500_000;
const N = F / (2 - F);
const A_ = (A / (1 + N)) * (1 + (N * N) / 4 + N ** 4 / 64);
const ALPHA = [N / 2 - (2 * N * N) / 3 + (5 * N ** 3) / 16, (13 * N * N) / 48 - (3 * N ** 3) / 5, (61 * N ** 3) / 240];
const BETA = [N / 2 - (2 * N * N) / 3 + (37 * N ** 3) / 96, (N * N) / 48 + N ** 3 / 15, (17 * N ** 3) / 480];
const DELTA = [2 * N - (2 * N * N) / 3 - 2 * N ** 3, (7 * N * N) / 3 - (8 * N ** 3) / 5, (56 * N ** 3) / 15];
const RAD = Math.PI / 180;

/** Sentinel-2 pixel size in metres (visible / NIR bands). */
export const S2_PIXEL_M = 10;

export function utmZone(lon: number): number {
    return Math.floor((lon + 180) / 6) + 1;
}

export interface Utm {
    e: number;
    n: number;
}

/** WGS84 → UTM (northern hemisphere) in the given zone. */
export function toUtm(lat: number, lon: number, zone: number): Utm {
    const lon0 = ((zone - 1) * 6 - 180 + 3) * RAD;
    const phi = lat * RAD;
    const dl = lon * RAD - lon0;
    const k = (2 * Math.sqrt(N)) / (1 + N);
    const t = Math.sinh(Math.atanh(Math.sin(phi)) - k * Math.atanh(k * Math.sin(phi)));
    const xi = Math.atan2(t, Math.cos(dl));
    const eta = Math.atanh(Math.sin(dl) / Math.sqrt(1 + t * t));
    let e = eta;
    let n = xi;
    for (let j = 1; j <= 3; j++) {
        const a = ALPHA[j - 1] as number;
        e += a * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
        n += a * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    }
    return { e: E0 + K0 * A_ * e, n: K0 * A_ * n };
}

/** UTM (northern hemisphere) → WGS84 as [lat, lon]. */
export function fromUtm(e: number, n: number, zone: number): [number, number] {
    const lon0 = ((zone - 1) * 6 - 180 + 3) * RAD;
    const xi = n / (K0 * A_);
    const eta = (e - E0) / (K0 * A_);
    let xi2 = xi;
    let eta2 = eta;
    for (let j = 1; j <= 3; j++) {
        const b = BETA[j - 1] as number;
        xi2 -= b * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
        eta2 -= b * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
    }
    const chi = Math.asin(Math.sin(xi2) / Math.cosh(eta2));
    let phi = chi;
    for (let j = 1; j <= 3; j++) phi += (DELTA[j - 1] as number) * Math.sin(2 * j * chi);
    const lon = lon0 + Math.atan2(Math.sinh(eta2), Math.cos(xi2));
    return [phi / RAD, lon / RAD];
}

export interface LatLonBounds {
    south: number;
    west: number;
    north: number;
    east: number;
}

/**
 * The 10 m pixel edges crossing a view, as polylines of [lat, lon] pairs. Lines are two-point:
 * over a few hundred metres a UTM grid line departs from a straight lat/lon segment by millimetres.
 * Returns [] when the view would need more than `maxLines` lines per axis (zoomed too far out).
 */
export function pixelGridLines(b: LatLonBounds, zone: number, stepM = S2_PIXEL_M, maxLines = 120): Array<Array<[number, number]>> {
    const corners = [toUtm(b.south, b.west, zone), toUtm(b.south, b.east, zone), toUtm(b.north, b.west, zone), toUtm(b.north, b.east, zone)];
    const e0 = Math.floor(Math.min(...corners.map((c) => c.e)) / stepM) * stepM;
    const e1 = Math.ceil(Math.max(...corners.map((c) => c.e)) / stepM) * stepM;
    const n0 = Math.floor(Math.min(...corners.map((c) => c.n)) / stepM) * stepM;
    const n1 = Math.ceil(Math.max(...corners.map((c) => c.n)) / stepM) * stepM;
    if ((e1 - e0) / stepM > maxLines || (n1 - n0) / stepM > maxLines) return [];
    const lines: Array<Array<[number, number]>> = [];
    for (let e = e0; e <= e1; e += stepM) lines.push([fromUtm(e, n0, zone), fromUtm(e, n1, zone)]);
    for (let n = n0; n <= n1; n += stepM) lines.push([fromUtm(e0, n, zone), fromUtm(e1, n, zone)]);
    return lines;
}

type Ring = Array<[number, number]>; // UTM [e, n]

function ringsOf(geometry: GeoJSON.Geometry, zone: number): Ring[][] {
    const toRing = (coords: GeoJSON.Position[]): Ring => coords.map(([lon, lat]) => {
        const u = toUtm(lat as number, lon as number, zone);
        return [u.e, u.n];
    });
    if (geometry.type === 'Polygon') return [geometry.coordinates.map(toRing)];
    if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((poly) => poly.map(toRing));
    return [];
}

function inRing(x: number, y: number, ring: Ring): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i] as [number, number];
        const [xj, yj] = ring[j] as [number, number];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

/** Number of 10 m pixel centres that fall inside the polygon (outer ring minus holes, per part). */
export function countPixelCentres(geometry: GeoJSON.Geometry, zone: number, stepM = S2_PIXEL_M): number {
    let count = 0;
    for (const rings of ringsOf(geometry, zone)) {
        const outer = rings[0];
        if (!outer || outer.length < 3) continue;
        const e0 = Math.floor(Math.min(...outer.map((p) => p[0])) / stepM) * stepM;
        const e1 = Math.ceil(Math.max(...outer.map((p) => p[0])) / stepM) * stepM;
        const n0 = Math.floor(Math.min(...outer.map((p) => p[1])) / stepM) * stepM;
        const n1 = Math.ceil(Math.max(...outer.map((p) => p[1])) / stepM) * stepM;
        if (((e1 - e0) / stepM) * ((n1 - n0) / stepM) > 250_000) continue; // not a garden
        for (let e = e0 + stepM / 2; e < e1; e += stepM) {
            for (let n = n0 + stepM / 2; n < n1; n += stepM) {
                if (!inRing(e, n, outer)) continue;
                let inHole = false;
                for (let h = 1; h < rings.length && !inHole; h++) inHole = inRing(e, n, rings[h] as Ring);
                if (!inHole) count++;
            }
        }
    }
    return count;
}

/** Centroid longitude of a geometry's first ring, for picking the UTM zone. */
export function geometryLon(geometry: GeoJSON.Geometry): number {
    const ring = geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.type === 'MultiPolygon' ? geometry.coordinates[0]?.[0] : undefined;
    if (!ring || ring.length === 0) return 0;
    return ring.reduce((s, p) => s + (p[0] as number), 0) / ring.length;
}
