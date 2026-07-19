<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useRtkReceiver } from '@/composables/useRtkReceiver';
import { useImuSensor } from '@/composables/useImuSensor';
import { fixQualityLabel, fixQualityTone } from '@/utils/nmea';
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
        fixQuality: string | null;
        method: MeasurementMethod;
    }): void;
    (e: 'cancel'): void;
}>();

type Mode = 'gps' | 'sensor' | 'map';
const mode = ref<Mode>('gps');
const points = ref<MeasurementPoint[]>([]);

// ── RTK receiver ──
const rtk = useRtkReceiver();
const receiverUrl = ref(rtk.url.value);
const showSettings = ref(false);

const fixLabel = computed(() => fixQualityLabel(rtk.fixQuality.value));
const fixTone = computed(() => fixQualityTone(rtk.fixQuality.value));
const accuracyText = computed(() => {
    const m = rtk.accuracyMeters.value;
    if (m === null) return 'Konum bekleniyor…';
    if (m < 1) return `±${(m * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} cm`;
    return `±${m.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} m`;
});
const hasLiveFix = computed(() => rtk.position.value !== null && rtk.fixQuality.value !== 'none');

// ── ESP32 laser + IMU sensor (radial survey from a tripod station) ──
interface SensorCorner {
    distance: number;
    yaw: number;
    pitch: number;
}

const DEVICE_DISPLAY_NAME = 'CayHesabim';
const imu = useImuSensor();
const corners = ref<SensorCorner[]>([]);
const distanceInput = ref('');
const calibrationMessage = ref('');
/** Map anchor chosen when the operator presses "Bitir"; null until then. */
const placedAnchor = ref<LatLngPoint | null>(null);
/** The placed sensor ring may be dragged into position on the map. */
const draggablePlacement = computed(() => mode.value === 'sensor' && placedAnchor.value !== null);

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

const areaM2 = computed(() => polygonAreaM2(points.value as LatLngPoint[]));
const canSave = computed(() => points.value.length >= 3);
const canUndo = computed(() => (mode.value === 'sensor' ? corners.value.length > 0 : points.value.length > 0));

function accuracyLevelFromFix(): AccuracyLevel | null {
    const q = rtk.fixQuality.value;
    if (q === 'rtk-fixed' || q === 'rtk-float') return 'high';
    if (q === 'dgps') return 'medium';
    if (q === 'gps' || q === 'estimated') return 'low';
    return null;
}

// ── Leaflet (kept out of reactivity) ──
const mapContainer = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
let polygon: L.Polygon | null = null;
let vertexLayer: L.LayerGroup | null = null;
let parcelOutline: L.Polygon | null = null;

const DEFAULT_CENTER: [number, number] = [41.02, 40.52]; // Rize

function parcelLatLngs(): [number, number][] {
    return (props.parcelPolygon ?? [])
        .filter((pair) => Array.isArray(pair) && pair.length >= 2)
        .map(([lng, lat]) => [lat, lng] as [number, number]);
}

function initMap(): void {
    if (!mapContainer.value || map) return;
    const ring = parcelLatLngs();
    map = L.map(mapContainer.value, { zoomControl: true, maxZoom: 20 }).setView(
        ring[0] ?? DEFAULT_CENTER,
        ring.length ? 17 : 13,
    );
    L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 20, attribution: 'Esri' },
    ).addTo(map);

    vertexLayer = L.layerGroup().addTo(map);

    if (ring.length >= 3) {
        parcelOutline = L.polygon(ring, {
            color: '#facc15',
            weight: 2,
            dashArray: '6 4',
            fill: false,
        }).addTo(map);
        map.fitBounds(parcelOutline.getBounds().pad(0.4));
    }

    map.on('click', (e: L.LeafletMouseEvent) => {
        if (mode.value !== 'map') return;
        points.value.push({ lat: e.latlng.lat, lng: e.latlng.lng, altitudeMeters: 0 });
    });
}

function redraw(): void {
    if (!map || !vertexLayer) return;
    vertexLayer.clearLayers();
    const latlngs = points.value.map((p) => [p.lat, p.lng] as [number, number]);

    if (polygon) {
        map.removeLayer(polygon);
        polygon = null;
    }
    if (latlngs.length >= 3) {
        polygon = L.polygon(latlngs, {
            color: '#15803D',
            weight: 2,
            fillColor: '#15803D',
            fillOpacity: 0.22,
            className: draggablePlacement.value ? 'ck-drag-poly' : undefined,
        }).addTo(map);
        if (draggablePlacement.value) bindPolygonDrag();
    }
    latlngs.forEach((ll, i) => {
        L.circleMarker(ll, {
            radius: 6,
            color: '#15803D',
            weight: 2,
            fillColor: '#ffffff',
            fillOpacity: 1,
        })
            .bindTooltip(String(i + 1), { permanent: true, direction: 'center', className: 'ck-vtx-label' })
            .addTo(vertexLayer!);
    });
}

watch(points, redraw, { deep: true });
// Re-render the ring when drag eligibility flips (tab switch, finish, clear).
watch(draggablePlacement, redraw);

// ── Polygon drag (Pointer Events → same code path for mouse and touch) ──
interface PolygonDragState {
    pointerId: number;
    last: L.LatLng;
    totalLat: number;
    totalLng: number;
    moved: boolean;
}
let polygonDrag: PolygonDragState | null = null;

function bindPolygonDrag(): void {
    // The SVG renderer backs L.Polygon with an SVGPathElement.
    const el = (polygon?.getElement() ?? null) as SVGPathElement | null;
    if (!el) return;
    el.addEventListener('pointerdown', onPolygonPointerDown);
    el.addEventListener('pointermove', onPolygonPointerMove);
    el.addEventListener('pointerup', onPolygonPointerUp);
    el.addEventListener('pointercancel', onPolygonPointerUp);
}

function pointerLatLng(event: PointerEvent): L.LatLng | null {
    if (!map || !mapContainer.value) return null;
    const rect = mapContainer.value.getBoundingClientRect();
    return map.containerPointToLatLng(
        L.point(event.clientX - rect.left, event.clientY - rect.top),
    );
}

function onPolygonPointerDown(event: PointerEvent): void {
    if (!draggablePlacement.value || !map || !polygon) return;
    const at = pointerLatLng(event);
    if (!at) return;
    event.preventDefault();
    event.stopPropagation();
    try {
        (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    } catch {
        // Capture is a nicety (keeps fast drags attached); dragging still works without it.
    }
    map.dragging.disable();
    polygonDrag = { pointerId: event.pointerId, last: at, totalLat: 0, totalLng: 0, moved: false };
}

function onPolygonPointerMove(event: PointerEvent): void {
    if (!polygonDrag || event.pointerId !== polygonDrag.pointerId || !polygon) return;
    const at = pointerLatLng(event);
    if (!at) return;
    event.preventDefault();
    const dLat = at.lat - polygonDrag.last.lat;
    const dLng = at.lng - polygonDrag.last.lng;
    if (dLat === 0 && dLng === 0) return;
    polygonDrag.last = at;
    polygonDrag.totalLat += dLat;
    polygonDrag.totalLng += dLng;
    polygonDrag.moved = true;
    // Shift the visuals directly while dragging; reactivity would recreate the
    // dragged element mid-gesture. The move commits on pointer release.
    const ring = (polygon.getLatLngs() as L.LatLng[][])[0].map((ll) =>
        L.latLng(ll.lat + dLat, ll.lng + dLng),
    );
    polygon.setLatLngs([ring]);
    vertexLayer?.eachLayer((layer) => {
        const marker = layer as L.CircleMarker;
        const ll = marker.getLatLng();
        marker.setLatLng([ll.lat + dLat, ll.lng + dLng]);
    });
}

function onPolygonPointerUp(event: PointerEvent): void {
    if (!polygonDrag || event.pointerId !== polygonDrag.pointerId) return;
    const { totalLat, totalLng, moved } = polygonDrag;
    polygonDrag = null;
    map?.dragging.enable();
    if (moved && placedAnchor.value) {
        placedAnchor.value = {
            lat: placedAnchor.value.lat + totalLat,
            lng: placedAnchor.value.lng + totalLng,
        };
        syncSensorPlacement();
    }
}

// ── Actions ──
function toggleReceiver(): void {
    if (rtk.connected.value || rtk.connecting.value) rtk.disconnect();
    else rtk.connect();
}

function applyReceiverUrl(): void {
    rtk.setUrl(receiverUrl.value);
    rtk.reconnect();
    showSettings.value = false;
}

function addLivePoint(): void {
    const pos = rtk.position.value;
    if (!pos) return;
    points.value.push({
        lat: pos.lat,
        lng: pos.lng,
        altitudeMeters: rtk.altitudeMeters.value ?? 0,
    });
}

// ── Sensor actions ──
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
    if (!placedAnchor.value) return;
    if (corners.value.length < 3) {
        points.value = [];
        return;
    }
    const local = localCorners.value;
    const midX = local.reduce((sum, p) => sum + p.x, 0) / local.length;
    const midY = local.reduce((sum, p) => sum + p.y, 0) / local.length;
    points.value = local.map((p) => ({
        ...offsetLatLng(placedAnchor.value as LatLngPoint, p.x - midX, p.y - midY),
        altitudeMeters: Math.round(p.z * 100) / 100,
    }));
}

function finishSensorMeasurement(): void {
    if (corners.value.length < 3) return;
    if (!placedAnchor.value && map) {
        const center = map.getCenter();
        placedAnchor.value = { lat: center.lat, lng: center.lng };
    }
    syncSensorPlacement();
    if (map && points.value.length >= 3) {
        map.fitBounds(
            L.latLngBounds(points.value.map((p) => [p.lat, p.lng] as [number, number])).pad(0.4),
        );
    }
}

function undo(): void {
    if (mode.value === 'sensor') {
        corners.value.pop();
        syncSensorPlacement();
        return;
    }
    points.value.pop();
}

function clearAll(): void {
    if (mode.value === 'sensor') {
        corners.value = [];
        placedAnchor.value = null;
    }
    points.value = [];
}

function save(): void {
    if (!canSave.value) return;
    emit('complete', {
        measuredAreaM2: Math.round(areaM2.value),
        points: [...points.value],
        accuracyLevel: mode.value === 'gps' ? accuracyLevelFromFix() : 'medium',
        fixQuality: mode.value === 'gps' ? rtk.fixQuality.value : null,
        method: mode.value === 'gps' ? 'gps' : mode.value === 'sensor' ? 'imu' : 'map',
    });
}

onMounted(initMap);
onUnmounted(() => {
    if (map) {
        map.remove();
        map = null;
    }
});
</script>

<template>
    <div class="measure">
        <div class="measure-modes ck-seg" role="group" aria-label="Ölçüm yöntemi">
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': mode === 'gps' }" @click="mode = 'gps'">RTK Alıcı</button>
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': mode === 'sensor' }" @click="mode = 'sensor'">Lazer + IMU</button>
            <button type="button" class="ck-seg-btn" :class="{ 'is-active': mode === 'map' }" @click="mode = 'map'">Harita ile</button>
        </div>

        <div class="measure-grid">
            <div class="measure-map">
                <div ref="mapContainer" class="measure-canvas"></div>
                <div class="measure-readout">
                    <span class="ro-area">{{ areaM2 ? Math.round(areaM2).toLocaleString('tr-TR') : '0' }} m²</span>
                    <span class="ro-sub">{{ points.length }} köşe · otomatik hesaplanan alan</span>
                </div>
            </div>

            <aside class="measure-side">
                <section v-if="mode === 'gps'" class="ms-panel">
                    <header class="ms-head">
                        <span class="ms-title">RTK Alıcı (3B sensör)</span>
                        <button type="button" class="ck-btn ck-btn-sm" @click="showSettings = !showSettings">Ayar</button>
                    </header>

                    <div v-if="showSettings" class="ms-settings">
                        <input v-model="receiverUrl" type="text" class="ck-search-input" placeholder="ws://caygps.local:81" style="padding-left:12px" />
                        <button type="button" class="ck-btn ck-btn-sm ck-btn-primary" @click="applyReceiverUrl">Bağlan</button>
                    </div>

                    <div class="ms-fix">
                        <span class="ms-dot" :data-tone="fixTone"></span>
                        <div class="ms-fix-main">
                            <span class="ms-fix-label">{{ rtk.connected.value ? fixLabel : rtk.connecting.value ? 'Bağlanıyor…' : 'Bağlı değil' }}</span>
                            <span class="ms-fix-sub">{{ accuracyText }}<template v-if="rtk.satellites.value"> · {{ rtk.satellites.value }} uydu</template></span>
                        </div>
                        <button type="button" class="ck-btn ck-btn-sm" @click="toggleReceiver">{{ rtk.connected.value || rtk.connecting.value ? 'Durdur' : 'Başlat' }}</button>
                    </div>

                    <dl class="ms-coords">
                        <div><span>Enlem</span><b>{{ rtk.position.value ? rtk.position.value.lat.toFixed(7) : '—' }}</b></div>
                        <div><span>Boylam</span><b>{{ rtk.position.value ? rtk.position.value.lng.toFixed(7) : '—' }}</b></div>
                        <div><span>Yükseklik</span><b>{{ rtk.altitudeMeters.value !== null ? `${rtk.altitudeMeters.value.toFixed(1)} m` : '—' }}</b></div>
                    </dl>

                    <p v-if="rtk.error.value" class="ms-error">{{ rtk.error.value }}</p>

                    <button type="button" class="ck-btn ck-btn-primary ms-add" :disabled="!hasLiveFix" @click="addLivePoint">Konumu ekle (köşe)</button>
                </section>

                <section v-else-if="mode === 'sensor'" class="ms-panel">
                    <header class="ms-head">
                        <span class="ms-title">ESP32 Sensör (Bluetooth)</span>
                    </header>

                    <p v-if="!imu.supported" class="ms-error">Bu tarayıcı Bluetooth desteklemiyor. Android telefonda Chrome (veya Edge / Samsung Internet) ile açın.</p>

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

                    <button type="button" class="ck-btn ck-btn-primary" :disabled="corners.length < 3" @click="finishSensorMeasurement">
                        {{ placedAnchor ? 'Poligonu haritada güncelle' : 'Bitir · poligonu haritaya yerleştir' }}
                    </button>
                    <p v-if="placedAnchor" class="ms-hint">Poligon haritaya yerleştirildi. <b>Sürükleyerek</b> (bilgisayarda fare, telefonda parmakla) parselin üzerine taşıyın; sarı kesikli çizgi tapu parselidir. Şekil ve alan lazer+IMU ölçümlerinden gelir — yerleşim bitince <b>Ölçümü kaydet</b>'e basın.</p>
                </section>

                <section v-else class="ms-panel">
                    <header class="ms-head"><span class="ms-title">Harita ile köşe ekle</span></header>
                    <p class="ms-hint">Budanan alanın köşelerini haritaya dokunarak işaretleyin. RTK alıcı yoksa kullanın.</p>
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
.measure-readout {
    position: absolute; left: 12px; bottom: 12px; z-index: 500;
    background: var(--color-card-bg);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    padding: 8px 12px;
    display: flex; flex-direction: column;
    box-shadow: var(--shadow-md);
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
.ms-settings { display: flex; gap: var(--space-2); }
.ms-settings .ck-search-input { flex: 1; }

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
.ms-add { width: 100%; }
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

<style>
.ck-vtx-label { background: transparent; border: none; box-shadow: none; color: #fff; font-weight: 700; font-size: 11px; }
.ck-drag-poly { cursor: grab; touch-action: none; }
.ck-drag-poly:active { cursor: grabbing; }
</style>
