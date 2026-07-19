import { ref, onUnmounted } from 'vue';

const STORAGE_KEY = 'imu_sensor_url';
const DEFAULT_URL = 'http://192.168.4.1';
const POLL_MS = 300;
const POLL_TIMEOUT_MS = 2500;
const CALIBRATE_TIMEOUT_MS = 10_000;
const MAX_SILENT_FAILURES = 3;

export interface ImuReading {
    yaw: number;
    pitch: number;
    roll: number;
    still: boolean;
    calibrated: boolean;
}

interface ImuResponse {
    ok?: boolean;
    whoami?: string;
    yaw?: number;
    pitch?: number;
    roll?: number;
    still?: boolean;
    calibrated?: boolean;
    err?: string;
}

/**
 * Live orientation feed from the laser-mounted ESP32 IMU box. The ESP32 runs
 * its own WiFi hotspot and serves two plain GET endpoints: `/imu` (current
 * yaw/pitch/roll plus stillness/calibration flags) and `/calibrate` (blocking
 * gyro re-reference, ~2 s). This composable polls `/imu` while a session is
 * active and exposes a normalized reactive reading the pruning laser+IMU flow
 * consumes. The device URL is user-configurable and persisted to localStorage.
 */
export function useImuSensor() {
    const url = ref(localStorage.getItem(STORAGE_KEY) ?? DEFAULT_URL);
    const connected = ref(false);
    const connecting = ref(false);
    const calibrating = ref(false);
    const error = ref('');
    const reading = ref<ImuReading | null>(null);

    let active = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;

    function setUrl(next: string): void {
        url.value = next.trim();
        localStorage.setItem(STORAGE_KEY, url.value);
    }

    function baseUrl(): string {
        const raw = url.value.trim().replace(/\/+$/, '');
        if (!raw) return DEFAULT_URL;
        return /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    }

    async function getJson(path: string, timeoutMs: number): Promise<ImuResponse> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(`${baseUrl()}${path}`, {
                cache: 'no-store',
                signal: controller.signal,
            });
            return (await res.json()) as ImuResponse;
        } finally {
            clearTimeout(timeout);
        }
    }

    function schedule(): void {
        if (!active || pollTimer) return;
        pollTimer = setTimeout(() => {
            pollTimer = null;
            void poll();
        }, POLL_MS);
    }

    async function poll(): Promise<void> {
        if (!active) return;
        // The ESP blocks while /calibrate runs; don't pile requests onto it.
        if (calibrating.value) {
            schedule();
            return;
        }
        try {
            const body = await getJson('/imu', POLL_TIMEOUT_MS);
            if (!active) return;
            connecting.value = false;
            failures = 0;
            if (body.ok === false) {
                // ESP reachable but the IMU chip did not answer on the I²C bus.
                connected.value = true;
                reading.value = null;
                error.value = `ESP32'ye ulaşıldı ancak IMU sensörü yanıt vermiyor${body.whoami ? ` (WHO_AM_I: ${body.whoami})` : ''}. Sensör kablolarını kontrol edin.`;
            } else {
                connected.value = true;
                error.value = '';
                reading.value = {
                    yaw: Number(body.yaw ?? 0),
                    pitch: Number(body.pitch ?? 0),
                    roll: Number(body.roll ?? 0),
                    still: body.still === true,
                    calibrated: body.calibrated === true,
                };
            }
        } catch {
            if (!active) return;
            failures += 1;
            if (failures >= MAX_SILENT_FAILURES || !connected.value) {
                connected.value = false;
                connecting.value = true; // the loop keeps retrying until disconnect()
                reading.value = null;
                error.value =
                    "Sensöre ulaşılamadı. Telefonun ESP32'nin WiFi ağına bağlı olduğundan emin olun.";
            }
        }
        schedule();
    }

    function connect(): void {
        if (active) return;
        active = true;
        connecting.value = true;
        error.value = '';
        failures = 0;
        void poll();
    }

    function disconnect(): void {
        active = false;
        if (pollTimer) {
            clearTimeout(pollTimer);
            pollTimer = null;
        }
        connected.value = false;
        connecting.value = false;
        reading.value = null;
        error.value = '';
    }

    function reconnect(): void {
        disconnect();
        connect();
    }

    /** Trigger the blocking gyro re-reference on the ESP (device must stay still). */
    async function calibrate(): Promise<{ ok: boolean; message: string }> {
        if (calibrating.value) return { ok: false, message: 'Kalibrasyon zaten sürüyor.' };
        calibrating.value = true;
        try {
            const body = await getJson('/calibrate', CALIBRATE_TIMEOUT_MS);
            if (body.ok === false) {
                return { ok: false, message: `Kalibrasyon başarısız: ${body.err ?? 'bilinmeyen hata'}` };
            }
            return { ok: true, message: 'Kalibrasyon tamam. Referans sıfırlandı, ölçüme başlayabilirsiniz.' };
        } catch {
            return { ok: false, message: 'Kalibrasyon isteği gönderilemedi. Sensör bağlantısını kontrol edin.' };
        } finally {
            calibrating.value = false;
        }
    }

    onUnmounted(disconnect);

    return {
        url,
        connected,
        connecting,
        calibrating,
        error,
        reading,
        setUrl,
        connect,
        disconnect,
        reconnect,
        calibrate,
    };
}
