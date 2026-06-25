<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useRtkReceiver } from '@/composables/useRtkReceiver';
import { fixQualityLabel, fixQualityTone } from '@/utils/nmea';
import { polygonAreaM2, type LatLngPoint } from '@/utils/geo';
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

type Mode = 'gps' | 'map';
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

const areaM2 = computed(() => polygonAreaM2(points.value as LatLngPoint[]));
const canSave = computed(() => points.value.length >= 3);

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
        }).addTo(map);
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

function undo(): void {
    points.value.pop();
}

function clearAll(): void {
    points.value = [];
}

function save(): void {
    if (!canSave.value) return;
    emit('complete', {
        measuredAreaM2: Math.round(areaM2.value),
        points: [...points.value],
        accuracyLevel: mode.value === 'gps' ? accuracyLevelFromFix() : 'medium',
        fixQuality: mode.value === 'gps' ? rtk.fixQuality.value : null,
        method: mode.value === 'gps' ? 'gps' : 'map',
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

                <section v-else class="ms-panel">
                    <header class="ms-head"><span class="ms-title">Harita ile köşe ekle</span></header>
                    <p class="ms-hint">Budanan alanın köşelerini haritaya dokunarak işaretleyin. RTK alıcı yoksa kullanın.</p>
                </section>

                <div class="ms-actions">
                    <button type="button" class="ck-btn ck-btn-sm" :disabled="!points.length" @click="undo">Geri al</button>
                    <button type="button" class="ck-btn ck-btn-sm" :disabled="!points.length" @click="clearAll">Temizle</button>
                </div>

                <div class="ms-save">
                    <button type="button" class="ck-btn" @click="emit('cancel')">Vazgeç</button>
                    <button type="button" class="ck-btn ck-btn-primary" :disabled="!canSave" @click="save">Ölçümü kaydet</button>
                </div>
                <p v-if="!canSave" class="ms-hint">Alan oluşturmak için en az 3 köşe işaretleyin.</p>
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
</style>

<style>
.ck-vtx-label { background: transparent; border: none; box-shadow: none; color: #fff; font-weight: 700; font-size: 11px; }
</style>
