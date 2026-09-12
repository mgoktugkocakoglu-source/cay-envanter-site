<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Bluetooth, BluetoothOff, X } from '@lucide/vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
    /**
     * Map drawing only (no laser+IMU mode) — used by the producer's
     * "Arazini Belirle" page. A dedicated map-only component
     * (components/map/ParcelBoundaryDrawer.vue) is the intended follow-up.
     */
    mapOnly?: boolean;
    /** Label of the primary action; defaults to "Ölçümü kaydet". */
    saveLabel?: string;
    /** What is being outlined, for the instruction copy; defaults to "Budanan alanın". */
    subject?: string;
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

/** Single-select toggle groups emit `undefined` on re-click; a mode must always stay active. */
function onModeChange(v: unknown): void {
    if (v === 'map' || v === 'sensor') mode.value = v;
}

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
type ImuTone = 'none' | 'low' | 'medium' | 'high';
const imuTone = computed<ImuTone>(() => {
    if (!imu.connected.value) return 'none';
    const reading = imu.reading.value;
    if (!reading) return 'low';
    return reading.calibrated && reading.still ? 'high' : 'medium';
});
const IMU_TONE_VARIANT: Record<ImuTone, 'muted' | 'danger' | 'warning' | 'success'> = {
    none: 'muted',
    low: 'danger',
    medium: 'warning',
    high: 'success',
};
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

function formatYawDelta(delta: number): string {
    return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}°`;
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
    <div class="flex flex-col gap-4">
        <ToggleGroup v-if="!props.mapOnly" :model-value="mode" type="single" aria-label="Ölçüm yöntemi" class="h-11 md:h-9" @update:model-value="onModeChange">
            <ToggleGroupItem value="map" class="h-full px-3">Harita ile</ToggleGroupItem>
            <ToggleGroupItem value="sensor" class="h-full px-3">Lazer + IMU</ToggleGroupItem>
        </ToggleGroup>

        <div class="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
            <!-- Map canvas: Google Maps mounts into this element and needs an explicit height. -->
            <div class="relative">
                <div ref="mapContainer" class="h-105 w-full overflow-hidden rounded-md border bg-muted"></div>
                <div
                    v-if="keyMissing || mapError || !mapReady"
                    class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-md bg-muted p-4 text-center text-sm text-muted-foreground"
                    role="status"
                >
                    <template v-if="keyMissing">
                        <b class="text-foreground">Google Haritalar anahtarı tanımlı değil.</b>
                        <span><code class="text-xs">VITE_GOOGLE_MAPS_API_KEY</code> değişkenini ayarlayıp uygulamayı yeniden derleyin.</span>
                    </template>
                    <template v-else-if="mapError">
                        <b class="text-foreground">Harita yüklenemedi.</b>
                        <span>{{ mapError }}</span>
                    </template>
                    <span v-else>Google uydu görüntüsü yükleniyor…</span>
                </div>
                <div v-else class="pointer-events-none absolute bottom-7 left-3 z-5 flex flex-col rounded-md border bg-card px-3 py-2 shadow-md" aria-live="polite">
                    <span class="text-lg font-bold text-foreground tabular-nums">{{ formatMeters(areaM2) }} m²</span>
                    <span class="text-xs text-muted-foreground">{{ points.length }} köşe<template v-if="perimeterM"> · çevre {{ formatMeters(perimeterM) }} m</template></span>
                </div>
            </div>

            <aside class="flex flex-col gap-4">
                <Card v-if="mode === 'map'" class="gap-4 py-4">
                    <CardHeader class="flex flex-row items-center justify-between gap-2 px-4">
                        <CardTitle class="text-sm">Google uydu görüntüsünde çiz</CardTitle>
                        <Button v-if="drawing" size="sm" class="h-9 md:h-8" :disabled="points.length < 3" @click="finishDrawing">Çizimi bitir</Button>
                        <Button v-else variant="outline" size="sm" class="h-9 md:h-8" @click="restartDrawing">Yeni çizim</Button>
                    </CardHeader>
                    <CardContent class="flex flex-col gap-4 px-4">
                        <ol class="flex list-decimal flex-col gap-1 pl-5 text-xs leading-relaxed text-muted-foreground">
                            <li>{{ props.subject ?? 'Budanan alanın' }} köşelerine sırayla dokunun; her dokunuş bir köşe ekler.</li>
                            <li>Tüm köşeler işaretlenince <b class="text-foreground">Çizimi bitir</b>'e basın.</li>
                            <li>Köşeleri sürükleyerek düzeltin; kenar ortasındaki açık noktalar yeni köşe ekler. Bir köşeyi silmek için üzerine sağ tıklayın (telefonda basılı tutun). Alanı bütün olarak da sürükleyebilirsiniz.</li>
                        </ol>

                        <dl class="grid grid-cols-3 gap-2">
                            <div class="flex flex-col">
                                <dt class="text-[10px] tracking-wide text-muted-foreground uppercase">Köşe</dt>
                                <dd class="text-xs font-semibold text-foreground tabular-nums">{{ points.length }}</dd>
                            </div>
                            <div class="flex flex-col">
                                <dt class="text-[10px] tracking-wide text-muted-foreground uppercase">Alan</dt>
                                <dd class="text-xs font-semibold text-foreground tabular-nums">{{ formatMeters(areaM2) }} m²</dd>
                            </div>
                            <div class="flex flex-col">
                                <dt class="text-[10px] tracking-wide text-muted-foreground uppercase">Çevre</dt>
                                <dd class="text-xs font-semibold text-foreground tabular-nums">{{ perimeterM ? `${formatMeters(perimeterM)} m` : '—' }}</dd>
                            </div>
                        </dl>

                        <p class="text-xs leading-relaxed text-muted-foreground">Alan ve çevre Google'ın küresel geometri hesabıyla otomatik bulunur. Sarı çizgi tapu parselinin sınırıdır.</p>
                    </CardContent>
                </Card>

                <Card v-else class="gap-4 py-4">
                    <CardHeader class="px-4">
                        <CardTitle class="text-sm">ESP32 Sensör (Bluetooth)</CardTitle>
                    </CardHeader>
                    <CardContent class="flex flex-col gap-4 px-4">
                        <p v-if="!imu.supported" class="text-xs text-destructive">Bu tarayıcı Bluetooth desteklemiyor. Çay Hesabım mobil uygulamasını veya Android'de Chrome'u kullanın.</p>

                        <div class="flex items-center gap-3">
                            <Badge :variant="IMU_TONE_VARIANT[imuTone]">{{ imuStatusLabel }}</Badge>
                            <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground" :title="imuStatusSub">{{ imuStatusSub }}</span>
                            <Button variant="outline" size="sm" class="h-9 shrink-0 md:h-8" :disabled="!imu.supported" @click="toggleImu">
                                <BluetoothOff v-if="imuActive" aria-hidden="true" />
                                <Bluetooth v-else aria-hidden="true" />
                                {{ imuActive ? 'Durdur' : 'Sensöre bağlan' }}
                            </Button>
                        </div>

                        <dl class="grid grid-cols-3 gap-2">
                            <div class="flex flex-col">
                                <dt class="text-[10px] tracking-wide text-muted-foreground uppercase">Yaw (yön)</dt>
                                <dd class="text-xs font-semibold text-foreground tabular-nums">{{ imu.reading.value ? `${imu.reading.value.yaw.toFixed(1)}°` : '—' }}</dd>
                            </div>
                            <div class="flex flex-col">
                                <dt class="text-[10px] tracking-wide text-muted-foreground uppercase">Pitch (eğim)</dt>
                                <dd class="text-xs font-semibold text-foreground tabular-nums">{{ imu.reading.value ? `${imu.reading.value.pitch.toFixed(1)}°` : '—' }}</dd>
                            </div>
                            <div class="flex flex-col">
                                <dt class="text-[10px] tracking-wide text-muted-foreground uppercase">Δ son köşe</dt>
                                <dd class="text-xs font-semibold text-foreground tabular-nums">{{ liveYawDelta !== null ? formatYawDelta(liveYawDelta) : '—' }}</dd>
                            </div>
                        </dl>

                        <p v-if="imu.error.value" class="text-xs text-destructive">{{ imu.error.value }}</p>

                        <Button variant="outline" class="h-11 md:h-9" :disabled="!imu.connected.value || imu.calibrating.value" @click="runCalibration">
                            {{ imu.calibrating.value ? 'Kalibre ediliyor…' : 'Kalibre et (referansı sıfırla)' }}
                        </Button>
                        <p v-if="calibrationMessage" class="text-xs leading-relaxed text-muted-foreground">{{ calibrationMessage }}</p>

                        <div class="space-y-2">
                            <Label for="measure-laser-distance">Lazer mesafesi (m)</Label>
                            <div class="flex gap-2">
                                <Input
                                    id="measure-laser-distance"
                                    v-model="distanceInput"
                                    type="text"
                                    inputmode="decimal"
                                    placeholder="Örn: 12,40"
                                    class="h-11 min-w-0 flex-1 md:h-9"
                                    @keyup.enter="captureCorner"
                                />
                                <Button class="h-11 md:h-9" :disabled="!canCapture" @click="captureCorner">Köşe ekle</Button>
                            </div>
                            <p class="text-xs leading-relaxed text-muted-foreground">Lazeri köşedeki hedefe çevirin, ölçülen mesafeyi yazıp <b class="text-foreground">Köşe ekle</b>'ye basın; o anki yön/eğim açısı köşeyle birlikte kaydedilir.</p>
                        </div>

                        <div v-if="corners.length" class="max-h-52 overflow-y-auto rounded-lg border bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow class="hover:bg-transparent">
                                        <TableHead class="w-10 pl-3">Köşe</TableHead>
                                        <TableHead>Mesafe</TableHead>
                                        <TableHead class="text-right">Yön</TableHead>
                                        <TableHead class="w-10 pr-2"><span class="sr-only">Sil</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow v-for="(c, i) in corners" :key="i" class="hover:bg-transparent">
                                        <TableCell class="pl-3 font-semibold text-foreground">{{ cornerLabel(i) }}</TableCell>
                                        <TableCell>
                                            <div class="flex items-center gap-1">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0.01"
                                                    :model-value="c.distance"
                                                    :aria-label="`${cornerLabel(i)} köşesi mesafesi (m)`"
                                                    class="h-9 w-20 tabular-nums md:h-8"
                                                    @change="updateCornerDistance(i, $event)"
                                                />
                                                <span class="text-xs text-muted-foreground">m</span>
                                            </div>
                                        </TableCell>
                                        <TableCell class="text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                                            {{ c.yaw.toFixed(1) }}°<template v-if="i > 0"> · Δ{{ formatYawDelta(yawDeltaFromPrev(i)) }}</template>
                                        </TableCell>
                                        <TableCell class="pr-2 text-right">
                                            <Button variant="ghost" size="icon" class="size-9 text-muted-foreground hover:text-destructive md:size-8" :aria-label="`${cornerLabel(i)} köşesini sil`" @click="removeCorner(i)">
                                                <X aria-hidden="true" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>

                        <template v-if="sketch">
                            <svg class="h-auto w-full rounded-md border bg-muted" :viewBox="`0 0 ${SKETCH_W} ${SKETCH_H}`" role="img" aria-label="Ölçüm ön izleme krokisi">
                                <polygon v-if="corners.length >= 3" :points="sketch.ring" class="fill-primary/20 stroke-primary [stroke-width:1.5]" />
                                <line
                                    v-for="(n, i) in sketch.nodes"
                                    :key="`ray-${i}`"
                                    :x1="sketch.station.x"
                                    :y1="sketch.station.y"
                                    :x2="n.x"
                                    :y2="n.y"
                                    class="stroke-warning/55 stroke-1 [stroke-dasharray:4_3]"
                                />
                                <circle v-for="(n, i) in sketch.nodes" :key="`node-${i}`" :cx="n.x" :cy="n.y" r="4" class="fill-card stroke-primary stroke-2" />
                                <text v-for="(n, i) in sketch.nodes" :key="`label-${i}`" :x="n.x + 6" :y="n.y - 6" class="fill-muted-foreground text-[10px] font-semibold">{{ n.label }}</text>
                                <circle :cx="sketch.station.x" :cy="sketch.station.y" r="5" class="fill-success" />
                            </svg>
                            <p class="text-xs leading-relaxed text-muted-foreground">
                                Ön izleme alanı: <b class="text-foreground tabular-nums">{{ sensorAreaM2 ? Math.round(sensorAreaM2).toLocaleString('tr-TR') : '0' }} m²</b> · yeşil nokta = tripod istasyonu
                            </p>
                        </template>

                        <Button class="h-11 md:h-9" :disabled="corners.length < 3 || !mapReady" @click="finishSensorMeasurement">
                            {{ placedAnchor ? 'Poligonu haritada güncelle' : 'Bitir · poligonu haritaya yerleştir' }}
                        </Button>
                        <p v-if="placedAnchor" class="text-xs leading-relaxed text-muted-foreground">
                            Poligon haritaya yerleştirildi. <b class="text-foreground">Sürükleyerek</b> (bilgisayarda fare, telefonda parmakla) parselin üzerine taşıyın; sarı çizgi tapu parselidir. Şekil ve alan lazer+IMU ölçümlerinden gelir — yerleşim bitince <b class="text-foreground">Ölçümü kaydet</b>'e basın.
                        </p>
                    </CardContent>
                </Card>

                <div class="flex gap-2">
                    <Button variant="outline" size="sm" class="h-11 flex-1 md:h-8" :disabled="!canUndo" @click="undo">Geri al</Button>
                    <Button variant="outline" size="sm" class="h-11 flex-1 md:h-8" :disabled="!canUndo" @click="clearAll">Temizle</Button>
                </div>

                <div class="flex gap-2">
                    <Button variant="outline" class="h-11 flex-1 md:h-9" @click="emit('cancel')">Vazgeç</Button>
                    <Button class="h-11 flex-1 md:h-9" :disabled="!canSave" @click="save">{{ props.saveLabel ?? 'Ölçümü kaydet' }}</Button>
                </div>
                <p v-if="!canSave" class="text-xs leading-relaxed text-muted-foreground">
                    {{ mode === 'sensor' && corners.length >= 3 ? "Önce Bitir'e basarak poligonu haritaya yerleştirin." : 'Alan oluşturmak için en az 3 köşe işaretleyin.' }}
                </p>
            </aside>
        </div>
    </div>
</template>
