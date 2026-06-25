/**
 * Minimal NMEA 0183 parser for the high-precision RTK receiver feed
 * (u-blox M8P → ESP32 → WebSocket). Handles the three sentences the pruning
 * GPS flow needs: GGA (position + fix quality), GST (position error estimate)
 * and RMC (position fallback). Every other sentence is ignored. Coordinates
 * are returned as decimal degrees.
 */

export type NmeaFixQuality =
    | 'none'
    | 'gps'
    | 'dgps'
    | 'rtk-float'
    | 'rtk-fixed'
    | 'estimated';

export interface NmeaSentence {
    type: 'GGA' | 'RMC' | 'GST';
    lat: number | null;
    lng: number | null;
    fixQuality: NmeaFixQuality;
    satellites: number | null;
    hdop: number | null;
    altitudeMeters: number | null;
    /** Horizontal position error estimate in meters (GST only). */
    accuracyMeters: number | null;
}

/** GGA fix-quality code → semantic quality. */
const FIX_QUALITY_BY_CODE: Record<number, NmeaFixQuality> = {
    0: 'none',
    1: 'gps',
    2: 'dgps',
    4: 'rtk-fixed',
    5: 'rtk-float',
    6: 'estimated',
};

const FIX_QUALITY_LABEL: Record<NmeaFixQuality, string> = {
    none: 'Sinyal yok',
    gps: 'GPS (tekil)',
    dgps: 'DGPS',
    'rtk-float': 'RTK Float',
    'rtk-fixed': 'RTK Sabit',
    estimated: 'Tahmini',
};

export function fixQualityLabel(quality: NmeaFixQuality): string {
    return FIX_QUALITY_LABEL[quality] ?? FIX_QUALITY_LABEL.none;
}

/** UI tone for a fix quality, mirroring the accuracy-dot colors. */
export function fixQualityTone(quality: NmeaFixQuality): 'high' | 'medium' | 'low' | 'none' {
    if (quality === 'rtk-fixed') return 'high';
    if (quality === 'rtk-float' || quality === 'dgps') return 'medium';
    if (quality === 'gps' || quality === 'estimated') return 'low';
    return 'none';
}

/** Convert an NMEA ddmm.mmmm / dddmm.mmmm value + hemisphere to decimal degrees. */
function coordToDecimal(value: string, hemisphere: string): number | null {
    if (!value) return null;
    const raw = Number(value);
    if (!Number.isFinite(raw)) return null;
    const degrees = Math.floor(raw / 100);
    const minutes = raw - degrees * 100;
    let decimal = degrees + minutes / 60;
    if (hemisphere === 'S' || hemisphere === 'W') decimal = -decimal;
    return decimal;
}

/** XOR checksum validation. Returns true when no checksum is present. */
function checksumValid(sentence: string): boolean {
    const star = sentence.indexOf('*');
    if (star === -1) return true;
    const expected = sentence.slice(star + 1).trim().toUpperCase();
    if (expected.length < 2) return true;
    const body = sentence.slice(1, star); // drop leading '$'
    let xor = 0;
    for (let i = 0; i < body.length; i += 1) {
        xor ^= body.charCodeAt(i);
    }
    return xor.toString(16).toUpperCase().padStart(2, '0') === expected.slice(0, 2);
}

/**
 * Estimate horizontal accuracy (meters) when GST is unavailable, from the fix
 * quality and HDOP. Deliberately conservative — GST, when present, is preferred.
 */
export function estimateAccuracyMeters(quality: NmeaFixQuality, hdop: number | null): number | null {
    switch (quality) {
        case 'rtk-fixed':
            return 0.02;
        case 'rtk-float':
            return 0.5;
        case 'dgps':
            return 0.8;
        case 'gps':
            return Math.max(2.5, (hdop ?? 1) * 2.5);
        default:
            return null;
    }
}

export function parseNmeaLine(raw: string): NmeaSentence | null {
    const line = raw.trim();
    if (line.length < 6 || line[0] !== '$') return null;
    if (!checksumValid(line)) return null;

    const star = line.indexOf('*');
    const body = star === -1 ? line : line.slice(0, star);
    const fields = body.slice(1).split(','); // drop '$'
    const id = fields[0] ?? '';
    // Talker prefix is 2 chars (GP/GN/GL/…); the sentence type is the last 3.
    const type = id.length >= 5 ? id.slice(-3) : id;

    if (type === 'GGA') {
        const code = Number(fields[6]);
        return {
            type: 'GGA',
            lat: coordToDecimal(fields[2], fields[3]),
            lng: coordToDecimal(fields[4], fields[5]),
            fixQuality: FIX_QUALITY_BY_CODE[code] ?? 'none',
            satellites: fields[7] ? Number(fields[7]) : null,
            hdop: fields[8] ? Number(fields[8]) : null,
            altitudeMeters: fields[9] ? Number(fields[9]) : null,
            accuracyMeters: null,
        };
    }

    if (type === 'GST') {
        // GST fields: …,6=std latitude (m),7=std longitude (m),8=std altitude (m).
        const stdLat = Number(fields[6]);
        const stdLng = Number(fields[7]);
        const accuracyMeters =
            Number.isFinite(stdLat) && Number.isFinite(stdLng)
                ? Math.sqrt(stdLat * stdLat + stdLng * stdLng)
                : null;
        return {
            type: 'GST',
            lat: null,
            lng: null,
            fixQuality: 'none',
            satellites: null,
            hdop: null,
            altitudeMeters: null,
            accuracyMeters,
        };
    }

    if (type === 'RMC') {
        return {
            type: 'RMC',
            lat: coordToDecimal(fields[3], fields[4]),
            lng: coordToDecimal(fields[5], fields[6]),
            fixQuality: 'none',
            satellites: null,
            hdop: null,
            altitudeMeters: null,
            accuracyMeters: null,
        };
    }

    return null;
}
