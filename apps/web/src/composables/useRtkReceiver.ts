import { ref, onUnmounted } from 'vue';
import {
    estimateAccuracyMeters,
    parseNmeaLine,
    type NmeaFixQuality,
} from '@/utils/nmea';

const STORAGE_KEY = 'rtk_receiver_url';
const DEFAULT_URL = 'ws://caygps.local:81';
const RECONNECT_MS = 2500;
const STALE_MS = 6000;

export interface RtkPosition {
    lat: number;
    lng: number;
}

/**
 * Live high-precision position feed from the external RTK receiver bridge
 * (u-blox M8P → ESP32 WiFi → WebSocket streaming NMEA). Parses GGA/GST/RMC and
 * exposes a normalized reactive reading the pruning GPS flow consumes in place
 * of navigator.geolocation. The receiver URL is user-configurable and persisted
 * to localStorage. The socket auto-reconnects while a session is active.
 */
export function useRtkReceiver() {
    const url = ref(localStorage.getItem(STORAGE_KEY) ?? DEFAULT_URL);
    const connected = ref(false);
    const connecting = ref(false);
    const error = ref('');
    const position = ref<RtkPosition | null>(null);
    const accuracyMeters = ref<number | null>(null);
    const altitudeMeters = ref<number | null>(null);
    const fixQuality = ref<NmeaFixQuality>('none');
    const satellites = ref<number | null>(null);
    const hdop = ref<number | null>(null);
    const lastUpdate = ref(0);

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let staleTimer: ReturnType<typeof setInterval> | null = null;
    let manualClose = false;
    let buffer = '';
    // GST (when emitted) carries a real error estimate; cache it to refine the
    // accuracy reported alongside the next GGA position.
    let gstAccuracy: number | null = null;

    function setUrl(next: string): void {
        url.value = next.trim();
        localStorage.setItem(STORAGE_KEY, url.value);
    }

    function handleLine(line: string): void {
        const sentence = parseNmeaLine(line);
        if (!sentence) return;

        if (sentence.type === 'GST') {
            if (sentence.accuracyMeters !== null) {
                gstAccuracy = sentence.accuracyMeters;
                accuracyMeters.value = sentence.accuracyMeters;
            }
            return;
        }

        if (sentence.type === 'GGA') {
            if (sentence.lat !== null && sentence.lng !== null) {
                position.value = { lat: sentence.lat, lng: sentence.lng };
            }
            fixQuality.value = sentence.fixQuality;
            satellites.value = sentence.satellites;
            hdop.value = sentence.hdop;
            if (sentence.altitudeMeters !== null) altitudeMeters.value = sentence.altitudeMeters;
            accuracyMeters.value =
                gstAccuracy ?? estimateAccuracyMeters(sentence.fixQuality, sentence.hdop);
            lastUpdate.value = Date.now();
            return;
        }

        // RMC only fills in a position before the first GGA arrives.
        if (sentence.type === 'RMC' && position.value === null) {
            if (sentence.lat !== null && sentence.lng !== null) {
                position.value = { lat: sentence.lat, lng: sentence.lng };
                lastUpdate.value = Date.now();
            }
        }
    }

    function ingest(data: string): void {
        buffer += data;
        let newline = buffer.indexOf('\n');
        while (newline !== -1) {
            const line = buffer.slice(0, newline);
            buffer = buffer.slice(newline + 1);
            if (line.trim()) handleLine(line);
            newline = buffer.indexOf('\n');
        }
        // Guard against an unbounded buffer if newlines never arrive.
        if (buffer.length > 4096) buffer = buffer.slice(-1024);
    }

    function scheduleReconnect(): void {
        if (manualClose || reconnectTimer) return;
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
        }, RECONNECT_MS);
    }

    function connect(): void {
        if (
            socket &&
            (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
        ) {
            return;
        }
        manualClose = false;
        connecting.value = true;
        error.value = '';

        try {
            socket = new WebSocket(url.value);
        } catch {
            connecting.value = false;
            error.value = 'Alıcı adresi geçersiz.';
            return;
        }

        socket.onopen = () => {
            connected.value = true;
            connecting.value = false;
            error.value = '';
        };
        socket.onmessage = (event) => {
            const data = event.data;
            if (typeof data === 'string') {
                ingest(data);
            } else if (data instanceof ArrayBuffer) {
                ingest(new TextDecoder().decode(data));
            } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
                data.text().then(ingest).catch(() => undefined);
            }
        };
        socket.onerror = () => {
            error.value = 'Alıcıya bağlanılamadı. WiFi ve adresi kontrol edin.';
        };
        socket.onclose = () => {
            connected.value = false;
            connecting.value = false;
            socket = null;
            if (!manualClose) scheduleReconnect();
        };

        if (!staleTimer) {
            staleTimer = setInterval(() => {
                if (connected.value && lastUpdate.value && Date.now() - lastUpdate.value > STALE_MS) {
                    fixQuality.value = 'none';
                }
            }, 2000);
        }
    }

    function disconnect(): void {
        manualClose = true;
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (staleTimer) {
            clearInterval(staleTimer);
            staleTimer = null;
        }
        if (socket) {
            socket.onclose = null;
            socket.close();
            socket = null;
        }
        connected.value = false;
        connecting.value = false;
    }

    function reconnect(): void {
        disconnect();
        connect();
    }

    onUnmounted(disconnect);

    return {
        url,
        connected,
        connecting,
        error,
        position,
        accuracyMeters,
        altitudeMeters,
        fixQuality,
        satellites,
        hdop,
        lastUpdate,
        setUrl,
        connect,
        disconnect,
        reconnect,
    };
}
