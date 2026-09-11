<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useImuSensor } from '@/composables/useImuSensor';
import { hasGoogleMapsKey, loadGoogleMaps } from '@/services/googleMaps';
import {
    localPolygonAreaM2,
    normalizeDeltaDeg,
    offsetLatLng,
    polygonAreaM2,
    sphericalToLocal,
    type LatLngPoint,
    type LocalPoint,
} from '@/utils/geo';
import type { MeasurementPoint } from '@/services/caykur/pruningRequests';
import type { AccuracyLevel, MeasurementMethod } from '@/services/caykur/pruning';

const props = defineProps<{
    /** [lng, lat] ring to center/outline the parcel on the map. */
    parcelPolygon?: number[][];
}>();

const emit = defineEmits<{
    (e: 'complete', result: {
        measuredAreaM2: number;
        points: MeasurementPoint[];
        accuracyLevel: AccuracyLevel | null;
        method: MeasurementMethod;
    }): void;
    (e: 'cancel'): void;
}>();

type Mode = 'map' | 'sensor';
const mode = ref<Mode>('map');
/** Ring of the polygon currently shown for the active mode. */
const points = ref<MeasurementPoint[]>([]);

// ── Google Map (kept out of reactivity) ──
const mapContainer = ref<HTMLDivElement | null>(null);
const keyMissing = !hasGoogleMapsKey();
const mapReady = ref(false);
const mapError = ref('');

let map: google.maps.Map | null = null;
let mapClickListener: google.maps.MapsEventListener | null = null;
/**
 * "Harita ile": vertices are added by tapping the map; Google's native
 * editable/draggable polygon handles vertex moves, midpoint inserts and drags.
 * (The Drawing Library was removed from the Maps JavaScript API in 2026.)
 */
let drawnPolygon: google.maps.Polygon | null = null;
let drawnListeners: google.maps.MapsEventListener[] = [];
/** True while map taps append vertices; false once the operator finishes the ring. */
const drawing = ref(true);
/** "Lazer + IMU": projected ring, draggable as a whole to sit on the parcel. */
let sensorPolygon: google.maps.Polygon | null = null;
let parcelOutline: google.maps.Polygon | null = null;

const DEFAULT_CENTER: google.maps.LatLngLiteral = { lat: 41.02, lng: 40.52 }; // Rize
const POLYGON_STYLE: google.maps.PolygonOptions = {
    strokeColor: '#15803D',
    strokeOpacity: 1,
    strokeWeight: 2,
    fillColor: '#15803D',
    fillOpacity: 0.22,
    geodesic: false,
};

function parcelLatLngs(): google.maps.LatLngLiteral[] {
    return (props.parcelPolygon ?? [])
        .filter((pair) => Array.isArray(pair) && pair.length >= 2)
        .map(([lng, lat]) => ({ lat, lng }));
}

async function initMap(): Promise<void> {
    if (!mapContainer.value || map) return;
    if (keyMissing) return;
    try {
        const libs = await loadGoogleMaps();
        if (!mapContainer.value) return; // unmounted while loading
        const ring = parcelLatLngs();

        map = new libs.maps.Map(mapContainer.value, {
            center: ring[0] ?? DEFAULT_CENTER,
            zoom: ring.length ? 18 : 13,
            mapTypeId: 'hybrid',
            tilt: 0,
            mapTypeControl: true,
            mapTypeControlOptions: { mapTypeIds: ['hybrid', 'satellite', 'roadmap'] },
            streetViewControl: false,
            rotateControl: false,
            fullscreenControl: true,
            clickableIcons: false,
            gestureHandling: 'greedy',
        });

        if (ring.length >= 3) {
            parcelOutline = new libs.maps.Polygon({
                map,
                paths: ring,
                strokeColor: '#facc15',
                strokeOpacity: 1,
                strokeWeight: 2,
                fillOpacity: 0,
                clickable: false,
            });
            fitTo(ring);
        }

        mapClickListener = map.addListener('click', onMapClick);

        mapReady.value = true;
        applyMode();
    } catch (err) {
        mapError.value = err instanceof Error ? err.message : 'Harita yüklenemedi.';
    }
}

function fitTo(ring: google.maps.LatLngLiteral[]): void {
    if (!map || !ring.length) return;
    const bounds = new google.maps.LatLngBounds();
    ring.forEach((ll) => bounds.extend(ll));
    map.fitBounds(bounds, 48);
}

/** Show the overlay of the active mode; park the other one off-map. */
function applyMode(): void {
    if (!map) return;
    if (mode.value === 'map') {
        sensorPolygon?.setMap(null);
        drawnPolygon?.setMap(map);
        syncPointsFromDrawn();
    } else {
        drawnPolygon?.setMap(null);
        sensorPolygon?.setMap(map);
        syncSensorPlacement();
    }
    syncMapInteraction();
}
watch(mode, applyMode);
watch(drawing, syncMapInteraction);

/** Double-click zoom fights with rapid vertex taps, so it is off while drawing. */
function syncMapInteraction(): void {
    const active = mode.value === 'map' && drawing.value;
    map?.setOptions({ disableDoubleClickZoom: active, draggableCursor: active ? 'crosshair' : undefined });
}

// ── "Harita ile": tap to add vertices, Google handles editing ──
function onMapClick(e: google.maps.MapMouseEvent): void {
    if (mode.value !== 'map' || !drawing.value || !e.latLng || !map) return;
    if (!drawnPolygon) {
        createDrawnPolygon(e.latLng);
        return;
    }
    drawnPolygon.getPath().push(e.latLng);
}

/** A polygon built with an empty `paths` has no ring at all, so seed it with the first vertex. */
function createDrawnPolygon(first: google.maps.LatLng): void {
    if (!map) return;
    removeDrawnPolygon();
    const polygon = new google.maps.Polygon({ ...POLYGON_STYLE, map, paths: [[first]], editable: true, draggable: true });
    drawnPolygon = polygon;
    const path = polygon.getPath();
    drawnListeners = [
        path.addListener('set_at', syncPointsFromDrawn),
        path.addListener('insert_at', syncPointsFromDrawn),
        path.addListener('remove_at', syncPointsFromDrawn),
        polygon.addListener('dragend', syncPointsFromDrawn),
        // Right-click (long-press on touch) a vertex to delete it.
        polygon.addListener('contextmenu', (ev: google.maps.PolyMouseEvent) => {
            if (ev.vertex !== undefined && path.getLength() > 3) path.removeAt(ev.vertex);
        }),
    ];
    syncPointsFromDrawn();
}

function removeDrawnPolygon(): void {
    drawnListeners.forEach((l) => l.remove());
    drawnListeners = [];
    drawnPolygon?.setMap(null);
    drawnPolygon = null;
}

function syncPointsFromDrawn(): void {
    if (mode.value !== 'map') return;
    points.value = drawnPolygon
        ? drawnPolygon.getPath().getArray().map((ll) => ({ lat: ll.lat(), lng: ll.lng(), altitudeMeters: 0 }))
        : [];
}

function restartDrawing(): void {
    removeDrawnPolygon();
    points.value = [];
    drawing.value = true;
}

function finishDrawing(): void {
    if (points.value.length >= 3) drawing.value = false;
}

// ── ESP32 laser + IMU sensor (radial survey from a tripod station) ──
interface SensorCorner {
    distance: number;
    yaw: number;
    pitch: number;
}

const DEVICE_DISPLAY_NAME = 'CAYH_V3';
const imu = useImuSensor();
const corners = ref<SensorCorner[]>([]);
const distanceInput = ref('');
const calibrationMessage = ref('');
/** Map anchor chosen when the operator presses "Bitir"; null until then. */
const placedAnchor = ref<LatLngPoint | null>(null);

const imuActive = computed(() => imu.connected.value || imu.connecting.value);
const imuTone = computed(() => {
    if (!imu.connected.value) return 'none';
    const reading = imu.reading.value;
    if (!reading) return 'low';
    return reading.calibrated && reading.still ? 'high' : 'medium';
});
const imuStatusLabel = computed(() => {
    if (imu.connected.value) return 'Bağlı';
    if (imu.connecting.value) return 'Bağlanıyor…';
    return 'Bağlı değil';
});
const imuStatusSub = computed(() => {
    const reading = imu.reading.value;
    if (!imu.connected.value || !reading) return `Bluetooth cihazı: ${DEVICE_DISPLAY_NAME}`;
    const name = imu.deviceLabel.value || DEVICE_DISPLAY_NAME;
    return `${name} · ${reading.still ? 'sabit' : 'hareketli'} · ${reading.calibrated ? 'kalibre edildi' : 'kalibrasyon önerilir'}`;
});

const parsedDistance = computed(() => {
    const value = parseFloat(distanceInput.value.replace(',', '.'));
    return Number.isFinite(value) && value > 0 ? value : null;
});
const canCapture = computed(() => imu.reading.value !== null && parsedDistance.value !== null);

const localCorners = computed<LocalPoint[]>(() =>
    corners.value.map((c) => sphericalToLocal(c.distance, c.yaw, c.pitch)),
);
const sensorAreaM2 = computed(() => localPolygonAreaM2(localCorners.value));
const liveYawDelta = computed(() => {
    const reading = imu.reading.value;
    const last = corners.value[corners.value.length - 1];
    if (!reading || !last) return null;
    return normalizeDeltaDeg(reading.yaw - last.yaw);
});

const SKETCH_W = 260;
const SKETCH_H = 156;
const SKETCH_PAD = 18;

const sketch = computed(() => {
    if (!corners.value.length) return null;
    const station = { x: 0, y: 0 };
    const all = [station, ...localCorners.value];
    const minX = Math.min(...all.map((p) => p.x));
    const maxX = Math.max(...all.map((p) => p.x));
    const minY = Math.min(...all.map((p) => p.y));
    const maxY = Math.max(...all.map((p) => p.y));
    const scale = Math.min(
        (SKETCH_W - 2 * SKETCH_PAD) / Math.max(maxX - minX, 1),
        (SKETCH_H - 2 * SKETCH_PAD) / Math.max(maxY - minY, 1),
    );
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const tx = (p: { x: number; y: number }) => SKETCH_W / 2 + (p.x - midX) * scale;
    const ty = (p: { x: number; y: number }) => SKETCH_H / 2 - (p.y - midY) * scale;
    const nodes = localCorners.value.map((p, i) => ({ x: tx(p), y: ty(p), label: cornerLabel(i) }));
    return {
        station: { x: tx(station), y: ty(station) },
        nodes,
        ring: nodes.map((n) => `${n.x.toFixed(1)},${n.y.toFixed(1)}`).join(' '),
    };
});

function cornerLabel(index: number): string {
    return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

function yawDeltaFromPrev(index: number): number {
    return normalizeDeltaDeg(corners.value[index].yaw - corners.value[index - 1].yaw);
}

function toggleImu(): void {
    if (imuActive.value) imu.disconnect();
    else void imu.connect(); // stays inside the click gesture — Web Bluetooth requires it
}

async function runCalibration(): Promise<void> {
    calibrationMessage.value = 'Kalibre ediliyor… cihazı sabit tutun (~2 sn).';
    const result = await imu.calibrate();
    calibrationMessage.value = result.message;
}

function captureCorner(): void {
    const reading = imu.reading.value;
    const distance = parsedDistance.value;
    if (!reading || distance === null) return;
    corners.value.push({ distance, yaw: reading.yaw, pitch: reading.pitch });
    distanceInput.value = '';
    syncSensorPlacement();
}

function updateCornerDistance(index: number, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return;
    corners.value[index].distance = value;
    syncSensorPlacement();
}

function removeCorner(index: number): void {
    corners.value.splice(index, 1);
    syncSensorPlacement();
}

/**
 * Re-project the captured ring onto the map once an anchor exists. The station
 * has no GPS, so the ring centroid lands on the anchor; position and north
 * orientation are representative while shape/area come from the laser+IMU.
 */
function syncSensorPlacement(): void {
    if (mode.value !== 'sensor') return;
    if (!placedAnchor.value || corners.value.length < 3) {
        points.value = [];
        renderSensorPolygon();
        return;
    }
    const local = localCorners.value;
    const midX = local.reduce((sum, p) => sum + p.x, 0) / local.length;
    const midY = local.reduce((sum, p) => sum + p.y, 0) / local.length;
    points.value = local.map((p) => ({
        ...offsetLatLng(placedAnchor.value as LatLngPoint, p.x - midX, p.y - midY),
        altitudeMeters: Math.round(p.z * 100) / 100,
    }));
    renderSensorPolygon();
}

function renderSensorPolygon(): void {
    if (!map) return;
    const path = points.value.map((p) => ({ lat: p.lat, lng: p.lng }));
    if (path.length < 3) {
        sensorPolygon?.setMap(null);
        sensorPolygon = null;
        return;
    }
    if (!sensorPolygon) {
        sensorPolygon = new google.maps.Polygon({ ...POLYGON_STYLE, paths: path, draggable: true, editable: false });
        sensorPolygon.addListener('dragend', onSensorDragEnd);
    } else {
        sensorPolygon.setPath(path);
    }
    sensorPolygon.setMap(map);
}

/** The ring was dragged as a whole: its new centroid becomes the anchor. */
function onSensorDragEnd(): void {
    if (!sensorPolygon) return;
    const ring = sensorPolygon.getPath().getArray();
    if (!ring.length) return;
    placedAnchor.value = {
        lat: ring.reduce((s, ll) => s + ll.lat(), 0) / ring.length,
        lng: ring.reduce((s, ll) => s + ll.lng(), 0) / ring.length,
    };
    syncSensorPlacement();
}

function finishSensorMeasurement(): void {
    if (corners.value.length < 3) return;
    if (!placedAnchor.value && map) {
        const center = map.getCenter();
        if (center) placedAnchor.value = { lat: center.lat(), lng: center.lng() };
    }
    syncSensorPlacement();
    if (points.value.length >= 3) fitTo(points.value.map((p) => ({ lat: p.lat, lng: p.lng })));
}

// ── Shared readout & actions ──
function ringAreaM2(ring: MeasurementPoint[]): number {
    if (ring.length < 3) return 0;
    if (typeof google !== 'undefined' && google.maps?.geometry?.spherical) {
        return google.maps.geometry.spherical.computeArea(ring.map((p) => ({ lat: p.lat, lng: p.lng })));
    }
    return polygonAreaM2(ring as LatLngPoint[]);
}

const areaM2 = computed(() => ringAreaM2(points.value));
const perimeterM = computed(() => {
    if (points.value.length < 3 || typeof google === 'undefined' || !google.maps?.geometry?.spherical) return 0;
    const path = points.value.map((p) => ({ lat: p.lat, lng: p.lng }));
    return google.maps.geometry.spherical.computeLength([...path, path[0]]);
});
const canSave = computed(() => points.value.length >= 3);
const canUndo = computed(() => (mode.value === 'sensor' ? corners.value.length > 0 : points.value.length > 0));

function undo(): void {
    if (mode.value === 'sensor') {
        corners.value.pop();
        syncSensorPlacement();
        return;
    }
    if (!drawnPolygon) return;
    const path = drawnPolygon.getPath();
    if (path.getLength() > 3) path.removeAt(path.getLength() - 1);
    else restartDrawing();
}

function clearAll(): void {
    if (mode.value === 'sensor') {
        corners.value = [];
        placedAnchor.value = null;
        syncSensorPlacement();
        return;
    }
    restartDrawing();
}

function save(): void {
    if (!canSave.value) return;
    emit('complete', {
        measuredAreaM2: Math.round(areaM2.value),
        points: [...points.value],
        accuracyLevel: 'medium',
        method: mode.value === 'sensor' ? 'imu' : 'map',
    });
}

function formatMeters(value: number): string {
    return value.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
}

onMounted(() => {
    void initMap();
});
onUnmounted(() => {
    removeDrawnPolygon();
    sensorPolygon?.setMap(null);
    parcelOutline?.setMap(null);
    mapClickListener?.remove();
    if (map) google.maps.event.clearInstanceListeners(map);
    map = null;
});
</script>

<template>
    <div class="measure">
        <div class="measure-modes ck-seg" role="group" aria-label="Ölçüm yöntemi">
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': mode === 'map' }" @click="mode = 'map'">Harita ile</button>
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': mode === 'sensor' }" @click="mode = 'sensor'">Lazer + IMU</button>
        </div>

        <div class="measure-grid">
            <div class="measure-map">
                <div ref="mapContainer" class="measure-canvas"></div>
                <div v-if="keyMissing || mapError || !mapReady" class="measure-placeholder" role="status">
                    <template v-if="keyMissing">
                        <b>Google Haritalar anahtarı tanımlı değil.</b>
                        <span><code>VITE_GOOGLE_MAPS_API_KEY</code> değişkenini ayarlayıp uygulamayı yeniden derleyin.</span>
                    </template>
                    <template v-else-if="mapError">
                        <b>Harita yüklenemedi.</b>
                        <span>{{ mapError }}</span>
                    </template>
                    <span v-else>Google uydu görüntüsü yükleniyor…</span>
                </div>
                <div v-else class="measure-readout">
                    <span class="ro-area">{{ formatMeters(areaM2) }} m²</span>
                    <span class="ro-sub">{{ points.length }} köşe<template v-if="perimeterM"> · çevre {{ formatMeters(perimeterM) }} m</template></span>
                </div>
            </div>

            <aside class="measure-side">
                <section v-if="mode === 'map'" class="ms-panel">
                    <header class="ms-head">
                        <span class="ms-title">Google uydu görüntüsünde çiz</span>
                        <button v-if="drawing" type="button" class="ck-btn ck-btn-sm ck-btn-primary" :disabled="points.length < 3" @click="finishDrawing">Çizimi bitir</button>
                        <button v-else type="button" class="ck-btn ck-btn-sm" @click="restartDrawing">Yeni çizim</button>
                    </header>

                    <ol class="ms-steps">
                        <li>Budanan alanın köşelerine sırayla dokunun; her dokunuş bir köşe ekler.</li>
                        <li>Tüm köşeler işaretlenince <b>Çizimi bitir</b>'e basın.</li>
                        <li>Köşeleri sürükleyerek düzeltin; kenar ortasındaki açık noktalar yeni köşe ekler. Bir köşeyi silmek için üzerine sağ tıklayın (telefonda basılı tutun). Alanı bütün olarak da sürükleyebilirsiniz.</li>
                    </ol>

                    <dl class="ms-coords">
                        <div><span>Köşe</span><b>{{ points.length }}</b></div>
                        <div><span>Alan</span><b>{{ formatMeters(areaM2) }} m²</b></div>
                        <div><span>Çevre</span><b>{{ perimeterM ? `${formatMeters(perimeterM)} m` : '—' }}</b></div>
                    </dl>

                    <p class="ms-hint">Alan ve çevre Google'ın küresel geometri hesabıyla otomatik bulunur. Sarı çizgi tapu parselinin sınırıdır.</p>
                </section>

                <section v-else class="ms-panel">
                    <header class="ms-head">
                        <span class="ms-title">ESP32 Sensör (Bluetooth)</span>
                    </header>

                    <p v-if="!imu.supported" class="ms-error">Bu tarayıcı Bluetooth desteklemiyor. Çay Hesabım mobil uygulamasını veya Android'de Chrome'u kullanın.</p>

                    <div class="ms-fix">
                        <span class="ms-dot" :data-tone="imuTone"></span>
                        <div class="ms-fix-main">
                            <span class="ms-fix-label">{{ imuStatusLabel }}</span>
                            <span class="ms-fix-sub">{{ imuStatusSub }}</span>
                        </div>
                        <button type="button" class="ck-btn ck-btn-sm" :disabled="!imu.supported" @click="toggleImu">{{ imuActive ? 'Durdur' : 'Sensöre bağlan' }}</button>
                    </div>

                    <dl class="ms-coords">
                        <div><span>Yaw (yön)</span><b>{{ imu.reading.value ? `${imu.reading.value.yaw.toFixed(1)}°` : '—' }}</b></div>
                        <div><span>Pitch (eğim)</span><b>{{ imu.reading.value ? `${imu.reading.value.pitch.toFixed(1)}°` : '—' }}</b></div>
                        <div><span>Δ son köşe</span><b>{{ liveYawDelta !== null ? `${liveYawDelta >= 0 ? '+' : ''}${liveYawDelta.toFixed(1)}°` : '—' }}</b></div>
                    </dl>

                    <p v-if="imu.error.value" class="ms-error">{{ imu.error.value }}</p>

                    <button type="button" class="ck-btn" :disabled="!imu.connected.value || imu.calibrating.value" @click="runCalibration">
                        {{ imu.calibrating.value ? 'Kalibre ediliyor…' : 'Kalibre et (referansı sıfırla)' }}
                    </button>
                    <p v-if="calibrationMessage" class="ms-hint">{{ calibrationMessage }}</p>

                    <div class="sensor-add">
                        <input
                            v-model="distanceInput"
                            type="text"
                            inputmode="decimal"
                            class="ck-search-input"
                            placeholder="Lazer mesafesi (m)"
                            style="padding-left:12px"
                            @keyup.enter="captureCorner"
                        />
                        <button type="button" class="ck-btn ck-btn-primary" :disabled="!canCapture" @click="captureCorner">Köşe ekle</button>
                    </div>
                    <p class="ms-hint">Lazeri köşedeki hedefe çevirin, ölçülen mesafeyi yazıp <b>Köşe ekle</b>'ye basın; o anki yön/eğim açısı köşeyle birlikte kaydedilir.</p>

                    <ul v-if="corners.length" class="sensor-corners">
                        <li v-for="(c, i) in corners" :key="i">
                            <span class="sc-no">{{ cornerLabel(i) }}</span>
                            <input class="sc-dist" type="number" step="0.01" min="0.01" :value="c.distance" @change="updateCornerDistance(i, $event)" />
                            <span class="sc-unit">m</span>
                            <span class="sc-yaw">{{ c.yaw.toFixed(1) }}°<template v-if="i > 0"> · Δ{{ yawDeltaFromPrev(i) >= 0 ? '+' : '' }}{{ yawDeltaFromPrev(i).toFixed(1) }}°</template></span>
                            <button type="button" class="sc-del" :aria-label="`${cornerLabel(i)} köşesini sil`" @click="removeCorner(i)">✕</button>
                        </li>
                    </ul>

                    <template v-if="sketch">
                        <svg class="sensor-sketch" :viewBox="`0 0 ${SKETCH_W} ${SKETCH_H}`" role="img" aria-label="Ölçüm ön izleme krokisi">
                            <polygon v-if="corners.length >= 3" :points="sketch.ring" class="sk-poly" />
                            <line v-for="(n, i) in sketch.nodes" :key="`ray-${i}`" :x1="sketch.station.x" :y1="sketch.station.y" :x2="n.x" :y2="n.y" class="sk-ray" />
                            <circle v-for="(n, i) in sketch.nodes" :key="`node-${i}`" :cx="n.x" :cy="n.y" r="4" class="sk-node" />
                            <text v-for="(n, i) in sketch.nodes" :key="`label-${i}`" :x="n.x + 6" :y="n.y - 6" class="sk-label">{{ n.label }}</text>
                            <circle :cx="sketch.station.x" :cy="sketch.station.y" r="5" class="sk-station" />
                        </svg>
                        <p class="ms-hint">Ön izleme alanı: <b>{{ sensorAreaM2 ? Math.round(sensorAreaM2).toLocaleString('tr-TR') : '0' }} m²</b> · yeşil nokta = tripod istasyonu</p>
                    </template>

                    <button type="button" class="ck-btn ck-btn-primary" :disabled="corners.length < 3 || !mapReady" @click="finishSensorMeasurement">
                        {{ placedAnchor ? 'Poligonu haritada güncelle' : 'Bitir · poligonu haritaya yerleştir' }}
                    </button>
                    <p v-if="placedAnchor" class="ms-hint">Poligon haritaya yerleştirildi. <b>Sürükleyerek</b> (bilgisayarda fare, telefonda parmakla) parselin üzerine taşıyın; sarı çizgi tapu parselidir. Şekil ve alan lazer+IMU ölçümlerinden gelir — yerleşim bitince <b>Ölçümü kaydet</b>'e basın.</p>
                </section>

                <div class="ms-actions">
                    <button type="button" class="ck-btn ck-btn-sm" :disabled="!canUndo" @click="undo">Geri al</button>
                    <button type="button" class="ck-btn ck-btn-sm" :disabled="!canUndo" @click="clearAll">Temizle</button>
                </div>

                <div class="ms-save">
                    <button type="button" class="ck-btn" @click="emit('cancel')">Vazgeç</button>
                    <button type="button" class="ck-btn ck-btn-primary" :disabled="!canSave" @click="save">Ölçümü kaydet</button>
                </div>
                <p v-if="!canSave" class="ms-hint">{{ mode === 'sensor' && corners.length >= 3 ? "Önce Bitir'e basarak poligonu haritaya yerleştirin." : 'Alan oluşturmak için en az 3 köşe işaretleyin.' }}</p>
            </aside>
        </div>
    </div>
</template>

<style scoped>
.measure { display: flex; flex-direction: column; gap: var(--space-3); }
.measure-modes { align-self: flex-start; }
.measure-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.6fr); gap: var(--space-4); }
@media (max-width: 880px) { .measure-grid { grid-template-columns: 1fr; } }

.measure-map { position: relative; }
.measure-canvas {
    height: 420px; width: 100%;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--color-bg-primary);
}
.measure-placeholder {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
    padding: var(--space-4); text-align: center;
    border-radius: var(--radius-md);
    background: var(--color-subtle-bg);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    pointer-events: none;
}
.measure-placeholder b { color: var(--color-text-primary); }
.measure-placeholder code { font-size: var(--font-size-xs); }
.measure-readout {
    position: absolute; left: 12px; bottom: 28px; z-index: 5;
    background: var(--color-card-bg);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    padding: 8px 12px;
    display: flex; flex-direction: column;
    box-shadow: var(--shadow-md);
    pointer-events: none;
}
.ro-area { font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); color: var(--color-text-primary); font-variant-numeric: tabular-nums; }
.ro-sub { font-size: var(--font-size-xs); color: var(--color-text-muted); }

.measure-side { display: flex; flex-direction: column; gap: var(--space-3); }
.ms-panel {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-card-bg);
    padding: var(--space-4);
    display: flex; flex-direction: column; gap: var(--space-3);
}
.ms-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.ms-title { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }

.ms-steps {
    margin: 0; padding-left: 18px;
    display: flex; flex-direction: column; gap: 4px;
    font-size: var(--font-size-xs); color: var(--color-text-secondary); line-height: 1.5;
}

.ms-fix { display: flex; align-items: center; gap: var(--space-2); }
.ms-fix-main { display: flex; flex-direction: column; flex: 1; }
.ms-fix-label { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.ms-fix-sub { font-size: var(--font-size-xs); color: var(--color-text-muted); }
.ms-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; background: var(--color-text-muted); }
.ms-dot[data-tone='high'] { background: var(--color-success); }
.ms-dot[data-tone='medium'] { background: var(--color-warning); }
.ms-dot[data-tone='low'] { background: var(--color-danger); }
.ms-dot[data-tone='none'] { background: var(--color-text-muted); }

.ms-coords { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-2); margin: 0; }
.ms-coords div { display: flex; flex-direction: column; }
.ms-coords span { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-muted); }
.ms-coords b { font-size: var(--font-size-xs); color: var(--color-text-primary); font-variant-numeric: tabular-nums; }

.ms-error { margin: 0; font-size: var(--font-size-xs); color: var(--color-danger); }
.ms-hint { margin: 0; font-size: var(--font-size-xs); color: var(--color-text-muted); line-height: 1.5; }
.ms-actions { display: flex; gap: var(--space-2); }
.ms-actions .ck-btn { flex: 1; }
.ms-save { display: flex; gap: var(--space-2); }
.ms-save .ck-btn { flex: 1; }

.sensor-add { display: flex; gap: var(--space-2); }
.sensor-add .ck-search-input { flex: 1; min-width: 0; }
.sensor-corners {
    list-style: none; margin: 0; padding: 0;
    display: flex; flex-direction: column; gap: 4px;
    max-height: 200px; overflow-y: auto;
}
.sensor-corners li {
    display: flex; align-items: center; gap: var(--space-2);
    font-size: var(--font-size-xs); color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
}
.sc-no {
    display: inline-flex; align-items: center; justify-content: center;
    width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
    background: var(--color-subtle-bg); border: 1px solid var(--color-border);
    font-weight: 600; color: var(--color-text-primary);
}
.sc-dist {
    width: 76px; padding: 4px 6px;
    border: 1px solid var(--color-border); border-radius: var(--radius-sm, 6px);
    background: var(--color-bg-primary); color: var(--color-text-primary);
    font-size: var(--font-size-xs); font-variant-numeric: tabular-nums;
}
.sc-unit { color: var(--color-text-muted); }
.sc-yaw { margin-left: auto; color: var(--color-text-muted); white-space: nowrap; }
.sc-del { border: none; background: none; color: var(--color-danger); font-weight: 700; cursor: pointer; padding: 2px 4px; }

.sensor-sketch {
    width: 100%; height: auto;
    border: 1px solid var(--color-border); border-radius: var(--radius-md);
    background: var(--color-bg-primary);
}
.sk-poly { fill: rgb(21 128 61 / 0.2); stroke: #15803d; stroke-width: 1.5; }
.sk-ray { stroke: var(--color-warning); stroke-opacity: 0.55; stroke-width: 1; stroke-dasharray: 4 3; }
.sk-node { fill: #fff; stroke: #15803d; stroke-width: 2; }
.sk-label { fill: var(--color-text-secondary); font-size: 10px; font-weight: 600; }
.sk-station { fill: var(--color-success); }
</style>
