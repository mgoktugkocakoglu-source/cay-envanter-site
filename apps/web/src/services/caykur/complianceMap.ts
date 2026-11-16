import type { ComplianceCertainty, ComplianceMapCollection } from '@/services/api';
import type { Tone } from '@/components/caykur/tone';

export const CERTAINTY_META: Record<ComplianceCertainty, { label: string; tone: Tone; color: string; note: string }> = {
    agreed: { label: 'Kaynaklar uyumlu', tone: 'success', color: 'var(--success)', note: 'En az iki bağımsız kaynak (uydu, drone, saha gözlemi) aynı yönde ve tapu niteliğiyle tutarlı.' },
    single_source: { label: 'Tek kaynak', tone: 'warning', color: 'var(--warning)', note: 'Tek kaynak net okunuyor ve tapu niteliğiyle çelişmiyor; ikinci bağımsız kaynak yok.' },
    conflict: { label: 'Çelişki', tone: 'danger', color: 'var(--destructive)', note: 'Kaynaklar birbiriyle ya da tapu niteliğiyle çelişiyor. DEMO ruhsat kaydı çelişki sayılmaz.' },
    undecidable: { label: 'Belirsiz', tone: 'muted', color: 'var(--muted-foreground)', note: 'Net okuma veren kaynak yok (küçük parsel, kararsız uydu, drone yok ya da belirsiz).' },
};
export const CERTAINTIES = Object.keys(CERTAINTY_META) as ComplianceCertainty[];

const xml = (value: unknown): string => String(value ?? '').replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[character] ?? character));

function polygonKml(rings: GeoJSON.Position[][]): string {
    const boundaries = rings.map((ring, index) => {
        const tag = index === 0 ? 'outerBoundaryIs' : 'innerBoundaryIs';
        // KML uses WGS84 longitude,latitude,altitude and requires a closed ring, including holes.
        const first = ring[0];
        const last = ring[ring.length - 1];
        const closed = first && last && (first[0] !== last[0] || first[1] !== last[1]) ? [...ring, first] : ring;
        return `<${tag}><LinearRing><coordinates>${closed.map((p) => `${p[0]},${p[1]},0`).join(' ')}</coordinates></LinearRing></${tag}>`;
    }).join('');
    return `<Polygon><altitudeMode>clampToGround</altitudeMode>${boundaries}</Polygon>`;
}

/** Export every API feature, independently of the display toggles; preserve holes and multi-part parcels. */
export function complianceMapKml(collection: ComplianceMapCollection): string {
    const placemarks = collection.features.map((feature) => {
        const p = feature.properties;
        const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
        const geometry = polygons.map(polygonKml).join('');
        const properties = { ...p, certaintyLabel: CERTAINTY_META[p.certainty].label, generatedAt: collection.generatedAt };
        const data = Object.entries(properties).map(([key, value]) => `<Data name="${xml(key)}"><value>${xml(value)}</value></Data>`).join('');
        return `<Placemark><name>${xml(`${p.block}/${p.parcel} · ${CERTAINTY_META[p.certainty].label}`)}</name><description>${xml(`${p.notice} ${p.certaintyReason}`)}</description><ExtendedData>${data}</ExtendedData>${polygons.length > 1 ? `<MultiGeometry>${geometry}</MultiGeometry>` : geometry}</Placemark>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xml(collection.name)}${collection.licenceSource === 'demo' ? ' — DEMO' : ''}</name><description>${xml(collection.notice)}</description>${placemarks}</Document></kml>`;
}

export function downloadComplianceMap(collection: ComplianceMapCollection, format: 'geojson' | 'kml'): void {
    const content = format === 'geojson' ? JSON.stringify(collection, null, 2) : complianceMapKml(collection);
    const blob = new Blob([content], { type: format === 'geojson' ? 'application/geo+json;charset=utf-8' : 'application/vnd.google-earth.kml+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ruhsat-haritasi-${collection.licenceSource}-${collection.generatedAt.slice(0, 10)}.${format}`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
