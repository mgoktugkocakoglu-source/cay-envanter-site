export type NdviStatus = 'stable' | 'decline' | 'recovery' | 'review' | 'insufficient';
export const NDVI_META: Record<NdviStatus, { label: string; color: string }> = {
    stable: { label: 'Belirgin düşüş görülmedi', color: 'var(--info)' },
    decline: { label: 'Örtü düşüşü izleniyor', color: 'var(--warning)' },
    recovery: { label: 'Toparlanma görülüyor', color: 'var(--primary)' },
    review: { label: 'Düşüş · inceleme', color: 'var(--warning)' },
    insufficient: { label: 'Veri yetersiz', color: 'var(--muted-foreground)' },
};
export const NDVI_STATUSES = Object.keys(NDVI_META) as NdviStatus[];
export interface NdviMonth { month: number; value: number | null; baseline: number | null; delta: number | null; peerDelta: number | null }
export interface NdviProperties {
    key: string; block: string; parcel: string; fullPixels: number; status: NdviStatus;
    months: NdviMonth[]; observedMonths: number; comparableMonths: number;
}
export interface NdviMap extends GeoJSON.FeatureCollection<GeoJSON.Geometry, NdviProperties> {
    year: number; years: number[]; notice: string; licenceSource: string; sourceGeneratedAt: string | null;
    rules: { minPixels: number; baselineYears: number; minBaselineYears: number; minMonths: number; drop: number; minPeers: number };
}
