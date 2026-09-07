import { ref, onUnmounted } from 'vue';
import { Capacitor } from '@capacitor/core';
import { BleClient, textToDataView, type BleDevice } from '@capacitor-community/bluetooth-le';

const DEVICE_NAME_PREFIX = 'CAYH';
const DEVICE_FALLBACK_LABEL = 'CAYH_V3';
/** Custom IMU service on the ESP32 (NUS was dropped; see hardware notes). */
const IMU_SERVICE = '12345678-1234-5678-1234-56789abcdef0';
/** Single READ | WRITE | NOTIFY characteristic: streams data, accepts commands. */
const IMU_DATA = '12345678-1234-5678-1234-56789abcdef1';

const RECONNECT_ATTEMPTS = 3;
const CALIBRATE_TIMEOUT_MS = 15_000;
const STALE_MS = 3_000;

export interface ImuReading {
    yaw: number;
    pitch: number;
    roll: number;
    still: boolean;
    calibrated: boolean;
}

interface CalibrationResult {
    ok: boolean;
    message: string;
}

/**
 * Live orientation feed from the laser-mounted ESP32 IMU box ("CAYH_V3") over
 * Bluetooth LE. Uses @capacitor-community/bluetooth-le, so the same code runs
 * natively inside the Capacitor Android/iOS app (the WebView has no Web
 * Bluetooth) and falls back to Web Bluetooth in desktop/Android Chrome.
 *
 * Protocol: the device notifies newline-terminated text lines at 10 Hz —
 * `D,<yaw>,<pitch>,<roll>,<still>,<sensorOk>,<calibrated>` — plus `S,<STATUS>`
 * lines (INFO/CAL_START/CAL_OK/CAL_FAIL/…). Commands (`INFO`, `CAL`, `ZERO`)
 * are written to the same characteristic, one at a time, `\n`-terminated.
 * The firmware drops connections that do not subscribe within 20 s, so
 * notifications are enabled immediately after connecting.
 *
 * While connected a screen Wake Lock is held so Android does not drop the link
 * when the display would sleep.
 */
export function useImuSensor() {
    const supported =
        Capacitor.isNativePlatform() || (typeof navigator !== 'undefined' && !!navigator.bluetooth);
    const connected = ref(false);
    const connecting = ref(false);
    const calibrating = ref(false);
    const error = ref('');
    const reading = ref<ImuReading | null>(null);
    const deviceLabel = ref('');

    let device: BleDevice | null = null;
    let bleReady = false;
    let lineBuffer = '';
    let manualClose = false;
    let calibrated = false;
    let lastDataAt = 0;
    let staleTimer: ReturnType<typeof setInterval> | null = null;
    let calWaiter: {
        resolve: (result: CalibrationResult) => void;
        timer: ReturnType<typeof setTimeout>;
    } | null = null;
    let wakeLock: WakeLockSentinel | null = null;

    // ── Wake Lock (Android drops BLE when the screen sleeps) ──
    async function requestWakeLock(): Promise<void> {
        try {
            if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
        } catch {
            // Wake Lock is a nicety; measurement still works while the screen is on.
        }
    }

    function releaseWakeLock(): void {
        void wakeLock?.release().catch(() => undefined);
        wakeLock = null;
    }

    function onVisibilityChange(): void {
        if (document.visibilityState === 'visible' && connected.value) void requestWakeLock();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    // ── Incoming lines ──
    function settleCalibration(result: CalibrationResult): void {
        if (!calWaiter) return;
        clearTimeout(calWaiter.timer);
        const { resolve } = calWaiter;
        calWaiter = null;
        calibrating.value = false;
        resolve(result);
    }

    function handleStatus(status: string): void {
        if (status.startsWith('INFO')) {
            // S,INFO,imu=1,cal=0
            calibrated = status.includes('cal=1');
            if (reading.value) reading.value = { ...reading.value, calibrated };
            return;
        }
        if (status === 'CAL_START') return; // ~2 s of silence follows — expected
        if (status === 'CAL_OK') {
            calibrated = true;
            if (reading.value) reading.value = { ...reading.value, calibrated: true };
            settleCalibration({
                ok: true,
                message: 'Kalibrasyon tamam. Referans sıfırlandı, ölçüme başlayabilirsiniz.',
            });
            return;
        }
        if (status === 'CAL_FAIL') {
            settleCalibration({
                ok: false,
                message: 'Kalibrasyon başarısız. Cihazı sabit tutup tekrar deneyin.',
            });
            return;
        }
        if (status === 'NOSENSOR') {
            settleCalibration({ ok: false, message: 'Sensör bulunamadı; kalibrasyon yapılamadı.' });
        }
        // ZERO_OK / UNKNOWN_CMD need no UI reaction.
    }

    function handleLine(line: string): void {
        if (line.startsWith('D,')) {
            const parts = line.split(','); // [D, yaw, pitch, roll, still, sensorOk, calibrated]
            if (parts.length < 7) return;
            lastDataAt = Date.now();
            if (parts[5] === '0') {
                reading.value = null;
                error.value =
                    'ESP bağlı ancak IMU sensörü yanıt vermiyor. Sensör kablolarını kontrol edin.';
                return;
            }
            error.value = '';
            calibrated = parts[6] === '1' || calibrated;
            reading.value = {
                yaw: Number(parts[1]),
                pitch: Number(parts[2]),
                roll: Number(parts[3]),
                still: parts[4] === '1',
                calibrated,
            };
            return;
        }
        if (line.startsWith('S,')) handleStatus(line.slice(2));
    }

    // BLE notifications arrive in arbitrary chunks; reassemble into lines.
    function onNotifyValue(value: DataView): void {
        lineBuffer += new TextDecoder().decode(value);
        let newline = lineBuffer.indexOf('\n');
        while (newline !== -1) {
            const line = lineBuffer.slice(0, newline).trim();
            lineBuffer = lineBuffer.slice(newline + 1);
            if (line) handleLine(line);
            newline = lineBuffer.indexOf('\n');
        }
        if (lineBuffer.length > 1024) lineBuffer = lineBuffer.slice(-256);
    }

    // ── Connection lifecycle ──
    function startStaleWatch(): void {
        lastDataAt = Date.now();
        if (staleTimer) return;
        staleTimer = setInterval(() => {
            if (!connected.value || calibrating.value) return;
            if (lastDataAt && Date.now() - lastDataAt > STALE_MS) {
                error.value = 'Cihazdan veri gelmiyor. Cihazın açık ve menzilde olduğundan emin olun.';
            }
        }, 1000);
    }

    function stopStaleWatch(): void {
        if (staleTimer) {
            clearInterval(staleTimer);
            staleTimer = null;
        }
    }

    async function ensureInitialized(): Promise<void> {
        if (bleReady) return;
        await BleClient.initialize({ androidNeverForLocation: true });
        bleReady = true;
    }

    async function subscribe(): Promise<void> {
        if (!device) throw new Error('BLE device unavailable');
        await BleClient.connect(device.deviceId, () => onDisconnected());
        lineBuffer = '';
        // Subscribe right away: the firmware kicks silent connections after 20 s.
        await BleClient.startNotifications(device.deviceId, IMU_SERVICE, IMU_DATA, onNotifyValue);
        await send('INFO').catch(() => undefined);
    }

    async function reconnectLoop(): Promise<void> {
        connecting.value = true;
        error.value = 'Bağlantı koptu, yeniden bağlanılıyor…';
        for (let attempt = 1; attempt <= RECONNECT_ATTEMPTS; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
            if (manualClose || !device) break;
            try {
                await subscribe();
                connected.value = true;
                connecting.value = false;
                error.value = '';
                startStaleWatch();
                void requestWakeLock();
                return;
            } catch {
                // next attempt
            }
        }
        connecting.value = false;
        error.value =
            "Bağlantı koptu. Cihazın açık olduğundan emin olup Sensöre bağlan'a tekrar basın.";
    }

    function onDisconnected(): void {
        connected.value = false;
        reading.value = null;
        stopStaleWatch();
        releaseWakeLock();
        if (!manualClose) void reconnectLoop();
    }

    /** Must be called from a user gesture (button click) — Web Bluetooth rule. */
    async function connect(): Promise<void> {
        if (!supported) {
            error.value = 'Bu tarayıcı Bluetooth desteklemiyor. Android telefonda Chrome ile açın.';
            return;
        }
        if (connected.value || connecting.value) return;
        manualClose = false;
        connecting.value = true;
        error.value = '';
        try {
            await ensureInitialized();
            if (!device) {
                // Native: plugin scan dialog. Web: Chrome device chooser.
                device = await BleClient.requestDevice({
                    namePrefix: DEVICE_NAME_PREFIX,
                    optionalServices: [IMU_SERVICE],
                });
            }
            await subscribe();
            connected.value = true;
            connecting.value = false;
            deviceLabel.value = device.name ?? DEVICE_FALLBACK_LABEL;
            startStaleWatch();
            void requestWakeLock();
        } catch (err) {
            connecting.value = false;
            const message = err instanceof Error ? err.message : String(err);
            const cancelled =
                (err instanceof DOMException && err.name === 'NotFoundError') ||
                /cancel/i.test(message);
            if (cancelled) {
                device = null;
                error.value =
                    "Cihaz seçilmedi. Listede göremiyorsanız cihazın açık ve başka bir telefona bağlı olmadığından emin olun (cihaz adı: CAYH_V3).";
            } else if (/disabled|turned off|not enabled/i.test(message)) {
                error.value = 'Bluetooth kapalı. Telefonun Bluetooth ayarını açıp tekrar deneyin.';
            } else {
                device = null;
                error.value =
                    'Bağlantı kurulamadı. Bluetooth izinlerini onayladığınızdan ve cihazın menzilde olduğundan emin olun.';
            }
        }
    }

    function disconnect(): void {
        manualClose = true;
        settleCalibration({ ok: false, message: 'Bağlantı kapatıldı.' });
        stopStaleWatch();
        releaseWakeLock();
        const id = device?.deviceId;
        if (id) {
            void BleClient.stopNotifications(id, IMU_SERVICE, IMU_DATA).catch(() => undefined);
            void BleClient.disconnect(id).catch(() => undefined);
        }
        connected.value = false;
        connecting.value = false;
        reading.value = null;
        error.value = '';
    }

    // ── Commands (one at a time; CAL answers via S,CAL_* lines) ──
    async function send(command: string): Promise<void> {
        if (!device) throw new Error('BLE not connected');
        await BleClient.write(device.deviceId, IMU_SERVICE, IMU_DATA, textToDataView(`${command}\n`));
    }

    /** Trigger the on-device gyro re-reference (device must stay still, ~2 s). */
    async function calibrate(): Promise<CalibrationResult> {
        if (!connected.value || !device) return { ok: false, message: 'Önce sensöre bağlanın.' };
        if (calibrating.value) return { ok: false, message: 'Kalibrasyon zaten sürüyor.' };
        calibrating.value = true;
        try {
            await send('CAL');
        } catch {
            calibrating.value = false;
            return { ok: false, message: 'Komut gönderilemedi. Bağlantıyı kontrol edin.' };
        }
        return new Promise<CalibrationResult>((resolve) => {
            const timer = setTimeout(() => {
                calWaiter = null;
                calibrating.value = false;
                resolve({ ok: false, message: 'Kalibrasyon zaman aşımına uğradı. Tekrar deneyin.' });
            }, CALIBRATE_TIMEOUT_MS);
            calWaiter = { resolve, timer };
        });
    }

    onUnmounted(() => {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        disconnect();
    });

    return {
        supported,
        connected,
        connecting,
        calibrating,
        error,
        reading,
        deviceLabel,
        connect,
        disconnect,
        calibrate,
    };
}
