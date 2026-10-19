import L from 'leaflet';
import { api, type GeoParcelDetail } from '@/services/api';

/**
 * Click anywhere on a Leaflet map → the TKGM parcel under the point (ada/parsel, nitelik, alan,
 * mevkii) in a popup with its outline, fetched live through the API's TKGM proxy. The proxy
 * answers repeated clicks inside a fetched parcel from memory; the public service's daily quota
 * is surfaced as a message when it runs out. Layers that handle their own clicks must stop
 * propagation so this does not fire on top of them.
 */
export function useTkgmParcelLookup() {
    let outline: L.Polygon | null = null;
    let popup: L.Popup | null = null;
    let busy = false;

    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

    function render(p: GeoParcelDetail): string {
        const q = p.properties;
        const area = Number(q.alan);
        const rows = [
            ['Ada / Parsel', `<strong>${esc(q.adaNo)} / ${esc(q.parselNo)}</strong>`],
            ['Mahalle', `${esc(q.mahalleAd)} (${esc(q.ilceAd)}, ${esc(q.ilAd)})`],
            ['Nitelik', esc(q.nitelik || '—')],
            ['Alan', Number.isFinite(area) && area > 0 ? `${area.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} m²` : esc(q.alan || '—')],
            ['Mevkii', esc(q.mevkii || '—')],
            ['Pafta', esc(q.pafta || '—')],
        ];
        return `<div style="font:13px/1.4 inherit;min-width:220px"><div style="font-weight:600;margin-bottom:4px">TKGM parseli</div><table style="border-collapse:collapse">${rows
            .map(([k, v]) => `<tr><td style="padding:1px 8px 1px 0;color:#64748b;white-space:nowrap">${k}</td><td style="padding:1px 0">${v}</td></tr>`)
            .join('')}</table><div style="margin-top:4px;color:#64748b;font-size:11px">Canlı TKGM sorgusu</div></div>`;
    }

    function clear(): void {
        outline?.remove();
        outline = null;
        popup?.remove();
        popup = null;
    }

    async function lookup(map: L.Map, latlng: L.LatLng): Promise<void> {
        if (busy) return;
        busy = true;
        clear();
        popup = L.popup({ closeButton: true, autoPan: true, maxWidth: 320 }).setLatLng(latlng).setContent('<div style="font-size:13px">TKGM parseli sorgulanıyor…</div>').openOn(map);
        try {
            const res = await api.getParcelByCoordinates(latlng.lat, latlng.lng);
            if (res.error) {
                popup.setContent(`<div style="font-size:13px;color:#b91c1c">${esc(res.error.message ?? 'Parsel sorgulanamadı')}</div>`);
                return;
            }
            const parcel = res.data ?? null;
            if (!parcel) {
                popup.setContent('<div style="font-size:13px">Bu noktada TKGM parseli yok (yol, dere ya da kadastro dışı alan).</div>');
                return;
            }
            outline = L.polygon(parcel.polygon.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number])), {
                color: '#ffffff',
                weight: 2.5,
                dashArray: '4 3',
                fill: true,
                fillColor: '#ffffff',
                fillOpacity: 0.08,
                interactive: false,
            }).addTo(map);
            popup.setContent(render(parcel));
        } finally {
            busy = false;
        }
    }

    /** Wires the map: a plain click (not consumed by a layer) looks the parcel up. */
    function attach(map: L.Map): void {
        map.on('click', (e: L.LeafletMouseEvent) => void lookup(map, e.latlng));
        map.on('remove', clear);
    }

    return { attach, clear };
}
