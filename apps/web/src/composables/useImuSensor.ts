import { ref, onUnmounted } from 'vue';

const DEVICE_NAME_PREFIX = 'CayHesabim';
const NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
/** ESP → site stream (notify). */
const NUS_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
/** Site → ESP commands (write). */
const NUS_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

const RECONNECT_ATTEMPTS = 3;
const CALIBRATE_TIMEOUT_MS = 15_000;
const STALE_MS = 3_000;

export interface ImuReading {
    yaw: number;
    pitch: number;
    still: boolean;
    calibrated: boolean;
}

interface CalibrationResult {
    ok: boolean;
    message: string;
}

/**
 * Live orientation feed from the laser-mounted ESP32 IMU box over Web
 * Bluetooth (Nordic UART Service, device name "CayHesabim"). The device
 * notifies newline-terminated text lines: `D,<yaw>,<pitch>,<still>,<sensorOK>`
 * at 10 Hz plus `S,<STATUS>` lines (HELLO/CAL_START/CAL_OK/…). Commands are
 * written to the RX characteristic (`CAL`, `ZERO`, `INFO`), one at a time.
 *
 * Constraints inherited from Web Bluetooth: HTTPS (or localhost) only,
 * `connect()` must run inside a user gesture, and Android Chrome/Edge/Samsung
 * Internet are the supported browsers (no Firefox, no iOS Safari). While
 * connected a screen Wake Lock is held so Android does not drop the link.
 */
export function useImuSensor() {
    const supported = typeof navigator !== 'undefined' && !!navigator.bluetooth;
    const connected = ref(false);
    const connecting = ref(false);
    const calibrating = ref(false);
    const error = ref('');
    const reading = ref<ImuReading | null>(null);
    const deviceLabel = ref('');

    let device: BluetoothDevice | null = null;
    let rxChar: BluetoothRemoteGATTCharacteristic | null = null;
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
        if (status.startsWith('HELLO')) {
            const id = status.split(',')[1];
            const name = device?.name ?? DEVICE_NAME_PREFIX;
            deviceLabel.value = id ? `${name} · ${id}` : name;
            void send('INFO').catch(() => undefined);
            return;
        }
        if (status.startsWith('INFO')) {
            // S,INFO,0x68,cal=1
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
            const parts = line.split(','); // [D, yaw, pitch, still, sensorOK]
            lastDataAt = Date.now();
            if (parts[4] === '0') {
                reading.value = null;
                error.value =
                    'ESP bağlı ancak IMU sensörü yanıt vermiyor. Sensör kablolarını kontrol edin.';
                return;
            }
            error.value = '';
            reading.value = {
                yaw: Number(parts[1]),
                pitch: Number(parts[2]),
                still: parts[3] === '1',
                calibrated,
            };
            return;
        }
        if (line.startsWith('S,')) handleStatus(line.slice(2));
    }

    // BLE notifications arrive in arbitrary chunks; reassemble into lines.
    function onNotify(event: Event): void {
        const data = (event.target as BluetoothRemoteGATTCharacteristic).value;
        if (!data) return;
        lineBuffer += new TextDecoder().decode(data);
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

    async function subscribe(): Promise<void> {
        if (!device?.gatt) throw new Error('BLE device unavailable');
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(NUS_SERVICE);
        const tx = await service.getCharacteristic(NUS_TX);
        rxChar = await service.getCharacteristic(NUS_RX);
        lineBuffer = '';
        await tx.startNotifications();
        tx.addEventListener('characteristicvaluechanged', onNotify);
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
        rxChar = null;
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
            if (!device) {
                // Opens Chrome's device chooser; later reconnects reuse the grant.
                device = await navigator.bluetooth.requestDevice({
                    filters: [{ namePrefix: DEVICE_NAME_PREFIX }],
                    optionalServices: [NUS_SERVICE],
                });
                device.addEventListener('gattserverdisconnected', onDisconnected);
            }
            await subscribe();
            connected.value = true;
            connecting.value = false;
            if (!deviceLabel.value) deviceLabel.value = device.name ?? DEVICE_NAME_PREFIX;
            startStaleWatch();
            void requestWakeLock();
        } catch (err) {
            connecting.value = false;
            if (err instanceof DOMException && err.name === 'NotFoundError') {
                error.value =
                    "Cihaz seçilmedi. Listede göremiyorsanız ESP'nin açık ve başka bir telefona bağlı olmadığından emin olun.";
            } else {
                error.value =
                    'Bağlantı kurulamadı. Telefonda Bluetooth (ve gerekiyorsa Konum) servisinin açık olduğundan emin olun.';
            }
        }
    }

    function disconnect(): void {
        manualClose = true;
        settleCalibration({ ok: false, message: 'Bağlantı kapatıldı.' });
        stopStaleWatch();
        releaseWakeLock();
        if (device?.gatt?.connected) device.gatt.disconnect();
        rxChar = null;
        connected.value = false;
        connecting.value = false;
        reading.value = null;
        error.value = '';
    }

    // ── Commands (one at a time; CAL answers via S,CAL_* lines) ──
    async function send(command: string): Promise<void> {
        if (!rxChar) throw new Error('BLE not connected');
        await rxChar.writeValue(new TextEncoder().encode(`${command}\n`));
    }

    /** Trigger the on-device gyro re-reference (device must stay still, ~2 s). */
    async function calibrate(): Promise<CalibrationResult> {
        if (!connected.value || !rxChar) return { ok: false, message: 'Önce sensöre bağlanın.' };
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
