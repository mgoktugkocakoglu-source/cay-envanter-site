declare module 'polygon-splitter' {
    /** Splits a (Multi)Polygon by a (Multi)LineString; returns a MultiPolygon-like geometry or a FeatureCollection. */
    export default function polygonSplitter(polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon | GeoJSON.Feature, line: GeoJSON.LineString | GeoJSON.MultiLineString | GeoJSON.Feature): GeoJSON.Geometry | GeoJSON.FeatureCollection;
}
