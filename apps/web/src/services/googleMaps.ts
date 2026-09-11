import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

/**
 * Google Maps JavaScript API bootstrap.
 *
 * The key is a browser-side key protected by HTTP-referrer restrictions in the
 * Google Cloud console; it is injected at build time via VITE_GOOGLE_MAPS_API_KEY.
 */
const API_KEY = ((import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? '').trim();

let configured = false;

export interface GoogleMapsLibraries {
    maps: google.maps.MapsLibrary;
    geometry: google.maps.GeometryLibrary;
}

export function hasGoogleMapsKey(): boolean {
    return API_KEY.length > 0;
}

/** Loads the maps and geometry libraries once; safe to call repeatedly. */
export async function loadGoogleMaps(): Promise<GoogleMapsLibraries> {
    if (!hasGoogleMapsKey()) {
        throw new Error('Google Maps API anahtarı tanımlı değil (VITE_GOOGLE_MAPS_API_KEY).');
    }
    if (!configured) {
        setOptions({ key: API_KEY, v: 'weekly', language: 'tr', region: 'TR' });
        configured = true;
    }
    const [maps, geometry] = await Promise.all([importLibrary('maps'), importLibrary('geometry')]);
    return { maps, geometry };
}
