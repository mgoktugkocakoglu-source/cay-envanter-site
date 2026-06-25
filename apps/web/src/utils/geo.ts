/**
 * Geometry helpers shared by the pruning measurement flows. Coordinates are
 * decimal-degree {lat,lng} points. `polygonAreaDeg` is the raw shoelace area in
 * degree² (only meaningful as a ratio between two polygons at the same
 * latitude); `polygonAreaM2` projects to local meters so a measured ring yields
 * a real-world area in m².
 */

export interface LatLngPoint {
    lat: number;
    lng: number;
}

/** Shoelace area in degree² — projection-independent, use only as a ratio. */
export function polygonAreaDeg(points: LatLngPoint[]): number {
    if (points.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        sum += a.lng * b.lat - b.lng * a.lat;
    }
    return Math.abs(sum) / 2;
}

const EARTH_RADIUS_M = 6_378_137;

/**
 * Real-world polygon area in square meters via an equirectangular projection
 * around the ring's mean latitude. Accurate enough for parcel-scale areas.
 */
export function polygonAreaM2(points: LatLngPoint[]): number {
    if (points.length < 3) return 0;
    const meanLat =
        (points.reduce((s, p) => s + p.lat, 0) / points.length) * (Math.PI / 180);
    const projected = points.map((p) => ({
        x: (p.lng * Math.PI) / 180 * Math.cos(meanLat) * EARTH_RADIUS_M,
        y: (p.lat * Math.PI) / 180 * EARTH_RADIUS_M,
    }));
    let sum = 0;
    for (let i = 0; i < projected.length; i++) {
        const a = projected[i];
        const b = projected[(i + 1) % projected.length];
        sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
}
