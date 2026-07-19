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
const METERS_PER_DEG_LAT = (EARTH_RADIUS_M * Math.PI) / 180;

/** Local station-relative coordinates in meters (x = east, y = north, z = up). */
export interface LocalPoint {
    x: number;
    y: number;
    z: number;
}

/**
 * Convert a radial laser+IMU shot (slant distance + yaw/pitch in degrees) to
 * local meters around the station at the origin. Yaw 0° maps to +Y and grows
 * clockwise; only yaw *differences* between shots matter for the polygon shape,
 * so an arbitrary gyro reference is fine.
 */
export function sphericalToLocal(distanceM: number, yawDeg: number, pitchDeg: number): LocalPoint {
    const yaw = (yawDeg * Math.PI) / 180;
    const pitch = (pitchDeg * Math.PI) / 180;
    const horizontal = distanceM * Math.cos(pitch);
    return {
        x: horizontal * Math.sin(yaw),
        y: horizontal * Math.cos(yaw),
        z: distanceM * Math.sin(pitch),
    };
}

/** Shoelace area (m²) of a ring given in local meter coordinates. */
export function localPolygonAreaM2(points: Array<Pick<LocalPoint, 'x' | 'y'>>): number {
    if (points.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
}

/**
 * Shift an anchor lat/lng by local meter offsets (equirectangular, inverse of
 * the projection `polygonAreaM2` uses, so areas survive the round trip).
 */
export function offsetLatLng(anchor: LatLngPoint, eastM: number, northM: number): LatLngPoint {
    return {
        lat: anchor.lat + northM / METERS_PER_DEG_LAT,
        lng: anchor.lng + eastM / (METERS_PER_DEG_LAT * Math.cos((anchor.lat * Math.PI) / 180)),
    };
}

/** Normalize an angle difference in degrees to the (-180, 180] range. */
export function normalizeDeltaDeg(delta: number): number {
    let d = delta % 360;
    if (d > 180) d -= 360;
    if (d <= -180) d += 360;
    return d;
}

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
