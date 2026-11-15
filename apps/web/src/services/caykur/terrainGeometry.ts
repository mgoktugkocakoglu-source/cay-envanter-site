type PolygonGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;
export const polygonRings = (geometry: PolygonGeometry): GeoJSON.Position[][][] => geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

function inRing(ring: GeoJSON.Position[], x: number, y: number): boolean {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
}

/** Holes do not belong to a parcel, including in multi-part geometries. */
export function containsTerrainPoint(geometry: PolygonGeometry, lon: number, lat: number): boolean {
    return polygonRings(geometry).some((rings) => !!rings[0]?.length && inRing(rings[0], lon, lat) && !rings.slice(1).some((ring) => inRing(ring, lon, lat)));
}

export function intersectsTerrainBounds(geometry: PolygonGeometry, bounds: { southWest: [number, number]; northEast: [number, number] }): boolean {
    const coordinates = polygonRings(geometry).flat(2);
    return coordinates.some((p) => p[0] >= bounds.southWest[0]) && coordinates.some((p) => p[0] <= bounds.northEast[0]) && coordinates.some((p) => p[1] >= bounds.southWest[1]) && coordinates.some((p) => p[1] <= bounds.northEast[1]);
}
