<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import { useFieldsStore } from '@/stores/fieldsStore';
import { usePruningStore } from '@/stores/pruningStore';
import { useToast } from '@/composables/useToast';
import { api } from '@/services/api';
import type {
  Field,
  PruningMeasurement,
  PruningAccuracyLevel,
  CreatePruningMeasurementPayload,
} from '@/services/api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type MeasurementMethod = 'map' | 'gps' | 'assisted';
type BaseLayer = 'satellite' | 'street';

interface MethodOption {
  id: MeasurementMethod;
  title: string;
  description: string;
  badge: string;
}

interface ChecklistItem {
  label: string;
  status: 'done' | 'warning' | 'pending';
}

interface LatLngPoint {
  lat: number;
  lng: number;
}

interface WarningItem {
  id: string;
  text: string;
  level: 'warning' | 'danger';
}

const toast = useToast();
const fieldsStore = useFieldsStore();
const pruningStore = usePruningStore();

const selectedMethod = ref<MeasurementMethod>('map');
const selectedFieldId = ref<string | number | null>(null);
const pruningPoints = ref<LatLngPoint[]>([]);
const selectedPointIndex = ref<number | null>(null);
const drawingMessage = ref('');
const baseLayer = ref<BaseLayer>('satellite');

// ─── Measurement metadata ───
const fieldCheckDone = ref(false);
const producerApproved = ref(false);
const staffApproved = ref(false);
const measurementNotes = ref('');
const photoUrl = ref<string | null>(null);
const isUploadingPhoto = ref(false);

// ─── GPS ───
const gpsActive = ref(false);
const gpsAccuracy = ref<number | null>(null);
const gpsError = ref('');
let gpsWatchId: number | null = null;
let lastGpsPosition: LatLngPoint | null = null;
let worstGpsAccuracy = 0;

// ─── History comparison ───
const comparedMeasurementId = ref<string | null>(null);

// ─── Leaflet (kept outside reactivity on purpose) ───
const mapContainer = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
let satelliteTiles: L.TileLayer | null = null;
let streetTiles: L.TileLayer | null = null;
let fieldLayer: L.GeoJSON | null = null;
let prunePolygon: L.Polygon | null = null;
let compareLayer: L.Polygon | null = null;
let vertexMarkers: L.Marker[] = [];
let isDragging = false;

const MAP_MAX_ZOOM = 20;
const TILE_MAX_NATIVE_ZOOM = 18;
const TURKEY_CENTER: L.LatLngExpression = [39.0, 35.0];
const TURKEY_ZOOM = 6;
const OVERLAP_WARN_PERCENT = 70;
const MIN_RATIO_PERCENT = 10; // 1/10 pruning target

const methods: MethodOption[] = [
  {
    id: 'map',
    title: 'Haritadan işaretleme',
    description: 'Açık arazide budanan bölüm uydu görüntüsü üzerinden çizilir.',
    badge: 'Açık arazi',
  },
  {
    id: 'gps',
    title: 'GPS ile saha ölçümü',
    description: 'Personel alan çevresinde yürür veya köşe noktalarını işaretler.',
    badge: 'Ağaç altı',
  },
  {
    id: 'assisted',
    title: 'Kontrollü kayıt',
    description: 'Düşük doğrulukta fotoğraf, not ve ek onay zorunlu tutulur.',
    badge: 'Şüpheli ölçüm',
  },
];

// ─── Field / parcel computeds ───
const selectedField = computed<Field | null>(
  () => fieldsStore.fields.find((field) => field.id === selectedFieldId.value) ?? null,
);

const fieldOptions = computed(() =>
  fieldsStore.fields.map((field) => ({
    value: field.id,
    label: `${field.name}${field.parcelNo ? ` · ${field.parcelNo}` : ''}`,
  })),
);

const hasFields = computed(() => fieldsStore.fields.length > 0);

const selectedMethodLabel = computed(
  () => methods.find((method) => method.id === selectedMethod.value)?.title ?? '',
);

const fieldLocation = computed(() => {
  if (!selectedField.value) return 'Tarla seçilmedi';
  return [selectedField.value.province, selectedField.value.district, selectedField.value.neighborhood]
    .filter(Boolean)
    .join(' / ');
});

const producerName = computed(() => {
  const field = selectedField.value;
  if (!field) return '';
  const primary = field.partners?.find((partner) => partner.isPrimaryOwner);
  return primary?.partnerName ?? field.partners?.[0]?.partnerName ?? field.name;
});

// Parcel boundary as {lat,lng} points (stored coordinates are GeoJSON [lng,lat]).
const fieldRing = computed<LatLngPoint[]>(() =>
  (selectedField.value?.coordinates?.[0] ?? [])
    .filter((pair) => Array.isArray(pair) && pair.length >= 2)
    .map(([lng, lat]) => ({ lat, lng })),
);

const hasFieldGeometry = computed(() => fieldRing.value.length >= 3);

const selectedFieldAreaM2 = computed(() => {
  if (!selectedField.value) return 0;
  return toSquareMeters(selectedField.value.area, selectedField.value.areaUnit);
});

const targetPruningArea = computed(() => selectedFieldAreaM2.value / 10);

const pruningAreaM2 = computed(() => {
  if (!selectedFieldAreaM2.value || pruningPoints.value.length < 3 || !hasFieldGeometry.value) {
    return 0;
  }
  // Area ratio is projection-independent for two polygons at the same latitude.
  const fieldArea = polygonAreaDeg(fieldRing.value);
  const prunedArea = polygonAreaDeg(pruningPoints.value);
  if (!fieldArea) return 0;
  return selectedFieldAreaM2.value * (prunedArea / fieldArea);
});

const pruningRatio = computed(() => {
  if (!selectedFieldAreaM2.value || !pruningAreaM2.value) return 0;
  return (pruningAreaM2.value / selectedFieldAreaM2.value) * 100;
});

const pruningRatioText = computed(() =>
  pruningRatio.value.toLocaleString('tr-TR', { maximumFractionDigits: 1 }),
);

const pruningStatusText = computed(() => {
  if (!selectedField.value) return 'Ölçüm için bir tarla seçin.';
  if (!hasFieldGeometry.value) return 'Bu tarlada parsel koordinatı bulunamadı.';
  if (selectedMethod.value === 'gps' && pruningPoints.value.length === 0) {
    return 'GPS modunda köşeler "Konumu ekle" ile eklenir.';
  }
  if (pruningPoints.value.length === 0) return 'Budanan alanın köşelerine dokunarak çizmeye başlayın.';
  if (pruningPoints.value.length < 3) return 'Alan oluşturmak için en az 3 köşe işaretleyin.';
  return `${formatSquareMeters(pruningAreaM2.value)} · parselin %${pruningRatioText.value}'i`;
});

// ─── GPS accuracy ───
function levelFromMeters(meters: number | null): PruningAccuracyLevel | null {
  if (meters === null) return null;
  if (meters <= 3) return 'high';
  if (meters <= 5) return 'medium';
  return 'low';
}

const gpsAccuracyLevel = computed<PruningAccuracyLevel | null>(() => levelFromMeters(gpsAccuracy.value));

const gpsAccuracyText = computed(() =>
  gpsAccuracy.value === null
    ? 'Konum bekleniyor…'
    : `${gpsAccuracy.value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} m`,
);

function accuracyLabel(level: PruningAccuracyLevel | null): string {
  if (level === 'high') return 'Yüksek (1-3 m)';
  if (level === 'medium') return 'Orta (3-5 m)';
  if (level === 'low') return 'Düşük (5 m+)';
  return 'Belirsiz';
}

// Accuracy level recorded with the measurement, per method.
const accuracyLevelForSave = computed<PruningAccuracyLevel>(() => {
  if (selectedMethod.value === 'gps') {
    return levelFromMeters(worstGpsAccuracy || gpsAccuracy.value) ?? 'low';
  }
  if (selectedMethod.value === 'assisted') return 'low';
  return 'medium'; // map drawing on satellite imagery
});

// ─── Save gating ───
const photoRequired = computed(() => selectedMethod.value === 'assisted');

const canSave = computed(
  () =>
    !!selectedField.value &&
    hasFieldGeometry.value &&
    pruningPoints.value.length >= 3 &&
    !(photoRequired.value && !photoUrl.value) &&
    !pruningStore.isSaving,
);

const saveHint = computed(() => {
  if (!selectedField.value) return 'Önce bir tarla seçin.';
  if (!hasFieldGeometry.value) return 'Bu tarlada parsel koordinatı yok.';
  if (pruningPoints.value.length < 3) return 'En az 3 köşe işaretleyin.';
  if (photoRequired.value && !photoUrl.value) return 'Kontrollü kayıt için fotoğraf zorunludur.';
  return '';
});

// ─── Warning engine ───
const pointsOutsideCount = computed(
  () => pruningPoints.value.filter((point) => !isInsideField(point)).length,
);

const overlapWithLatest = computed(() => {
  const latest = pruningStore.latestMeasurement;
  if (!latest || pruningPoints.value.length < 3) return 0;
  return overlapPercent(pruningPoints.value, latest.geometry);
});

const warnings = computed<WarningItem[]>(() => {
  const list: WarningItem[] = [];
  if (pruningPoints.value.length >= 3) {
    if (pruningRatio.value > 100) {
      list.push({
        id: 'over-parcel',
        level: 'danger',
        text: `Çizilen alan parsel alanını aşıyor (%${pruningRatioText.value}).`,
      });
    } else if (pruningRatio.value > 0 && pruningRatio.value < MIN_RATIO_PERCENT) {
      list.push({
        id: 'below-ratio',
        level: 'warning',
        text: `Budama oranı 1/10 (%10) hedefinin altında: %${pruningRatioText.value}.`,
      });
    }
  }
  if (pointsOutsideCount.value > 0) {
    list.push({
      id: 'outside',
      level: 'danger',
      text: `${pointsOutsideCount.value} köşe parsel sınırının dışında kalıyor.`,
    });
  }
  if (selectedMethod.value === 'gps' && gpsAccuracy.value !== null && gpsAccuracy.value > 5) {
    list.push({
      id: 'gps-low',
      level: 'danger',
      text: `GPS doğruluğu düşük (${gpsAccuracyText.value}). Ölçümü tekrarlayın.`,
    });
  }
  if (overlapWithLatest.value >= OVERLAP_WARN_PERCENT) {
    list.push({
      id: 'overlap',
      level: 'warning',
      text: `Önceki ölçümle %${Math.round(overlapWithLatest.value)} çakışma var (aynı alan tekrar budanıyor olabilir).`,
    });
  }
  return list;
});

// ─── Checklist ───
const checklist = computed<ChecklistItem[]>(() => [
  {
    label: selectedField.value ? `${selectedField.value.name} seçildi` : 'Ölçüm yapılacak tarla seçilecek',
    status: selectedField.value ? 'done' : 'pending',
  },
  {
    label: producerName.value ? `Üretici: ${producerName.value}` : 'Üretici bilgisi eksik',
    status: producerName.value ? 'done' : 'warning',
  },
  {
    label: selectedField.value?.parcelNo
      ? `Parsel: ${selectedField.value.parcelNo}`
      : 'Ada/parsel bilgisi eksik',
    status: selectedField.value?.parcelNo ? 'done' : 'warning',
  },
  {
    label:
      pruningPoints.value.length >= 3
        ? `${formatSquareMeters(pruningAreaM2.value)} budama alanı çizildi`
        : 'Budama alanı çizilecek',
    status: pruningPoints.value.length >= 3 ? 'done' : 'pending',
  },
  {
    label: producerApproved.value ? 'Üretici onayı alındı' : 'Üretici onayı bekliyor',
    status: producerApproved.value ? 'done' : 'pending',
  },
  {
    label: staffApproved.value ? 'Personel onayı verildi' : 'Personel onayı bekliyor',
    status: staffApproved.value ? 'done' : 'pending',
  },
]);

// ─── Formatting helpers ───
function toSquareMeters(area: number, unit: Field['areaUnit']): number {
  if (unit === 'm2') return Number(area);
  return Number(area) * 1000;
}

function formatArea(area: number, unit: Field['areaUnit']): string {
  const formatted = Number(area).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  const unitLabels: Record<Field['areaUnit'], string> = {
    donum: 'dönüm',
    dekar: 'dekar',
    m2: 'm²',
  };
  return `${formatted} ${unitLabels[unit]}`;
}

function formatSquareMeters(area: number): string {
  return `${area.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} m²`;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
}

function methodLabel(method: MeasurementMethod): string {
  return methods.find((m) => m.id === method)?.title ?? method;
}

// ─── Geometry helpers ───
function polygonAreaDeg(points: LatLngPoint[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.lng * b.lat - b.lng * a.lat;
  }
  return Math.abs(sum) / 2;
}

function pointInRing(point: LatLngPoint, ring: LatLngPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const current = ring[i];
    const previous = ring[j];
    const intersects =
      current.lat > point.lat !== previous.lat > point.lat &&
      point.lng <
        ((previous.lng - current.lng) * (point.lat - current.lat)) /
          (previous.lat - current.lat) +
          current.lng;
    if (intersects) inside = !inside;
  }
  return inside;
}

function isInsideField(point: LatLngPoint): boolean {
  return pointInRing(point, fieldRing.value);
}

// Approximate overlap of `current` with a previous geometry ([lng,lat] ring),
// by grid-sampling the current polygon's bounding box.
function overlapPercent(current: LatLngPoint[], previousGeom: number[][]): number {
  if (current.length < 3 || !previousGeom || previousGeom.length < 3) return 0;
  const prev = previousGeom
    .filter((pair) => Array.isArray(pair) && pair.length >= 2)
    .map(([lng, lat]) => ({ lat, lng }));
  if (prev.length < 3) return 0;

  const lats = current.map((p) => p.lat);
  const lngs = current.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const N = 40;
  let inCurrent = 0;
  let inBoth = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const pt = {
        lat: minLat + ((i + 0.5) / N) * (maxLat - minLat),
        lng: minLng + ((j + 0.5) / N) * (maxLng - minLng),
      };
      if (pointInRing(pt, current)) {
        inCurrent++;
        if (pointInRing(pt, prev)) inBoth++;
      }
    }
  }
  return inCurrent ? (inBoth / inCurrent) * 100 : 0;
}

function getCssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

// ─── Map setup ───
function initMap(): void {
  if (!mapContainer.value || map) return;

  map = L.map(mapContainer.value, {
    zoomControl: false,
    attributionControl: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    maxZoom: MAP_MAX_ZOOM,
  }).setView(TURKEY_CENTER, TURKEY_ZOOM);

  L.control.zoom({ position: 'topright' }).addTo(map);

  satelliteTiles = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: MAP_MAX_ZOOM, maxNativeZoom: TILE_MAX_NATIVE_ZOOM },
  );
  streetTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: MAP_MAX_ZOOM,
    maxNativeZoom: 19,
  });

  applyBaseLayer();
  map.on('click', handleMapClick);
}

function applyBaseLayer(): void {
  if (!map || !satelliteTiles || !streetTiles) return;
  const active = baseLayer.value === 'satellite' ? satelliteTiles : streetTiles;
  const inactive = baseLayer.value === 'satellite' ? streetTiles : satelliteTiles;
  if (map.hasLayer(inactive)) map.removeLayer(inactive);
  if (!map.hasLayer(active)) active.addTo(map);
}

function drawField(): void {
  if (!map) return;
  if (fieldLayer) {
    map.removeLayer(fieldLayer);
    fieldLayer = null;
  }
  if (!hasFieldGeometry.value || !selectedField.value) return;

  const primary = getCssVar('--color-primary', '#15803D');
  const geoJson: GeoJSON.Feature = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: selectedField.value.coordinates },
  };

  // interactive:false lets clicks fall through to the map so points can be added over the fill.
  fieldLayer = L.geoJSON(geoJson, {
    interactive: false,
    style: { color: primary, weight: 2, fillColor: primary, fillOpacity: 0.12 },
  }).addTo(map);

  fitFieldBounds();
}

function fitFieldBounds(): void {
  if (!map || !fieldLayer) return;
  const bounds = fieldLayer.getBounds();
  if (!bounds.isValid()) return;
  const apply = () => {
    if (!map) return;
    map.invalidateSize();
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
  };
  apply();
  requestAnimationFrame(apply);
}

// ─── Pruning polygon + draggable vertices ───
function redrawPrunePolygon(latlngs?: L.LatLngExpression[]): void {
  if (!map) return;
  const pts = latlngs ?? pruningPoints.value.map((p) => [p.lat, p.lng] as L.LatLngExpression);

  if (pts.length < 2) {
    if (prunePolygon) {
      map.removeLayer(prunePolygon);
      prunePolygon = null;
    }
    return;
  }

  const color = getCssVar('--color-warning', '#B45309');
  if (!prunePolygon) {
    prunePolygon = L.polygon(pts, {
      interactive: false,
      color,
      weight: 2,
      fillColor: color,
      fillOpacity: 0.3,
    }).addTo(map);
  } else {
    prunePolygon.setLatLngs(pts);
  }
}

function vertexIcon(index: number): L.DivIcon {
  const selected = selectedPointIndex.value === index;
  return L.divIcon({
    className: 'prune-vertex-wrap',
    html: `<span class="prune-vertex${selected ? ' is-selected' : ''}">${index + 1}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function refreshMarkerIcons(): void {
  vertexMarkers.forEach((marker, index) => marker.setIcon(vertexIcon(index)));
}

// Full rebuild on structural changes (add/remove); drag updates in place to stay smooth.
function rebuildMarkers(): void {
  if (!map) return;
  vertexMarkers.forEach((marker) => map?.removeLayer(marker));
  vertexMarkers = [];

  pruningPoints.value.forEach((point, index) => {
    const marker = L.marker([point.lat, point.lng], {
      draggable: true,
      keyboard: false,
      icon: vertexIcon(index),
    }).addTo(map as L.Map);

    marker.on('click', () => selectPoint(index));
    marker.on('dragstart', () => {
      isDragging = true;
      selectedPointIndex.value = index;
      drawingMessage.value = '';
    });
    marker.on('drag', () => {
      redrawPrunePolygon(vertexMarkers.map((m) => m.getLatLng()));
    });
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng();
      pruningPoints.value.splice(index, 1, { lat, lng });
      isDragging = false;
      refreshMarkerIcons();
    });

    vertexMarkers.push(marker);
  });
}

function selectPoint(index: number): void {
  selectedPointIndex.value = selectedPointIndex.value === index ? null : index;
  refreshMarkerIcons();
}

function addVertex(point: LatLngPoint): void {
  pruningPoints.value.push(point);
  rebuildMarkers();
  redrawPrunePolygon();
}

function handleMapClick(event: L.LeafletMouseEvent): void {
  if (isDragging) return;
  if (!selectedField.value) {
    drawingMessage.value = 'Önce bir tarla seçin.';
    return;
  }
  if (!hasFieldGeometry.value) {
    drawingMessage.value = 'Bu tarlada parsel koordinatı bulunamadı.';
    return;
  }
  if (selectedMethod.value === 'gps') {
    drawingMessage.value = 'GPS modunda köşeler "Konumu ekle" düğmesiyle eklenir.';
    return;
  }

  const point: LatLngPoint = { lat: event.latlng.lat, lng: event.latlng.lng };
  if (!isInsideField(point)) {
    drawingMessage.value = 'Köşe parsel sınırının dışında kaldı.';
    return;
  }

  drawingMessage.value = '';
  addVertex(point);
}

function undoPruningPoint(): void {
  pruningPoints.value.pop();
  selectedPointIndex.value = null;
  drawingMessage.value = '';
  rebuildMarkers();
  redrawPrunePolygon();
}

function removeSelectedPoint(): void {
  if (selectedPointIndex.value === null) return;
  pruningPoints.value.splice(selectedPointIndex.value, 1);
  selectedPointIndex.value = null;
  drawingMessage.value = '';
  rebuildMarkers();
  redrawPrunePolygon();
}

function clearPruningPoints(): void {
  pruningPoints.value = [];
  selectedPointIndex.value = null;
  drawingMessage.value = '';
  rebuildMarkers();
  redrawPrunePolygon();
}

function resetMeasurementMeta(): void {
  fieldCheckDone.value = false;
  producerApproved.value = false;
  staffApproved.value = false;
  measurementNotes.value = '';
  photoUrl.value = null;
  worstGpsAccuracy = 0;
}

function startNewMeasurement(): void {
  clearPruningPoints();
  resetMeasurementMeta();
  clearCompareLayer();
  comparedMeasurementId.value = null;
  fitFieldBounds();
}

// ─── GPS capture ───
function startGps(): void {
  if (!('geolocation' in navigator)) {
    gpsError.value = 'Cihaz konum servisini desteklemiyor.';
    return;
  }
  if (gpsWatchId !== null) return;
  gpsError.value = '';
  gpsActive.value = true;
  gpsWatchId = navigator.geolocation.watchPosition(
    (position) => {
      lastGpsPosition = { lat: position.coords.latitude, lng: position.coords.longitude };
      gpsAccuracy.value = position.coords.accuracy;
      gpsError.value = '';
    },
    (error) => {
      gpsActive.value = false;
      gpsError.value =
        error.code === error.PERMISSION_DENIED
          ? 'Konum izni reddedildi. Tarayıcı/uygulama ayarlarından izin verin.'
          : 'Konum alınamadı. Açık alanda tekrar deneyin.';
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
  );
}

function stopGps(): void {
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }
  gpsActive.value = false;
}

function addGpsPoint(): void {
  if (!selectedField.value || !hasFieldGeometry.value) {
    drawingMessage.value = 'Önce parselli bir tarla seçin.';
    return;
  }
  if (!lastGpsPosition) {
    drawingMessage.value = 'Henüz konum alınamadı, bekleyin.';
    return;
  }
  if (!isInsideField(lastGpsPosition)) {
    drawingMessage.value = 'Konum parsel sınırının dışında.';
    return;
  }
  drawingMessage.value = '';
  if (gpsAccuracy.value !== null) {
    worstGpsAccuracy = Math.max(worstGpsAccuracy, gpsAccuracy.value);
  }
  addVertex({ ...lastGpsPosition });
}

// ─── Photo upload ───
async function onPhotoChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    toast.error('Lütfen bir görsel dosyası seçin.');
    input.value = '';
    return;
  }
  isUploadingPhoto.value = true;
  try {
    const response = await api.uploadImage(file);
    if (response.data?.url) {
      photoUrl.value = response.data.url;
      toast.success('Fotoğraf yüklendi.');
    } else {
      toast.error(response.error?.message ?? 'Fotoğraf yüklenemedi.');
    }
  } finally {
    isUploadingPhoto.value = false;
    input.value = '';
  }
}

function removePhoto(): void {
  photoUrl.value = null;
}

// ─── Save ───
async function saveMeasurement(): Promise<void> {
  if (!selectedField.value || !canSave.value) {
    if (saveHint.value) toast.error(saveHint.value);
    return;
  }

  const payload: CreatePruningMeasurementPayload = {
    fieldId: String(selectedField.value.id),
    method: selectedMethod.value,
    geometry: pruningPoints.value.map((p) => [p.lng, p.lat]),
    prunedAreaM2: Math.round(pruningAreaM2.value),
    fieldAreaM2: Math.round(selectedFieldAreaM2.value),
    ratioPercent: Number(pruningRatio.value.toFixed(2)),
    accuracyLevel: accuracyLevelForSave.value,
    fieldCheckDone: fieldCheckDone.value,
    gpsAccuracyMeters:
      selectedMethod.value === 'gps' ? worstGpsAccuracy || gpsAccuracy.value : null,
    photoUrl: photoUrl.value,
    producerApproved: producerApproved.value,
    staffApproved: staffApproved.value,
    producerName: producerName.value || null,
    parcelNo: selectedField.value.parcelNo ?? null,
    notes: measurementNotes.value.trim() || null,
    measuredAt: new Date().toISOString(),
  };

  const result = await pruningStore.create(payload);
  if (result) {
    toast.success('Budama ölçümü kaydedildi.');
    clearPruningPoints();
    resetMeasurementMeta();
  } else {
    toast.error(pruningStore.error ?? 'Kayıt oluşturulamadı.');
  }
}

// ─── History comparison overlay ───
function clearCompareLayer(): void {
  if (map && compareLayer) {
    map.removeLayer(compareLayer);
  }
  compareLayer = null;
}

function toggleCompare(measurement: PruningMeasurement): void {
  if (comparedMeasurementId.value === measurement.id) {
    comparedMeasurementId.value = null;
    clearCompareLayer();
    return;
  }
  comparedMeasurementId.value = measurement.id;
  clearCompareLayer();
  if (!map || !measurement.geometry?.length) return;
  const latlngs = measurement.geometry
    .filter((pair) => Array.isArray(pair) && pair.length >= 2)
    .map(([lng, lat]) => [lat, lng] as L.LatLngExpression);
  if (latlngs.length < 3) return;
  compareLayer = L.polygon(latlngs, {
    interactive: false,
    color: '#0EA5E9',
    weight: 2,
    dashArray: '6 4',
    fillColor: '#0EA5E9',
    fillOpacity: 0.15,
  }).addTo(map);
}

function selectFirstFieldIfNeeded(): void {
  if (!selectedFieldId.value && fieldsStore.fields[0]) {
    selectedFieldId.value = fieldsStore.fields[0].id;
  }
}

// ─── Lifecycle ───
onMounted(async () => {
  initMap();
  await fieldsStore.fetchFields();
  selectFirstFieldIfNeeded();
  nextTick(() => requestAnimationFrame(() => map?.invalidateSize()));
});

onUnmounted(() => {
  stopGps();
  if (map) {
    map.remove();
    map = null;
  }
  satelliteTiles = null;
  streetTiles = null;
  fieldLayer = null;
  prunePolygon = null;
  compareLayer = null;
  vertexMarkers = [];
});

watch(
  () => fieldsStore.fields,
  () => {
    const stillExists = fieldsStore.fields.some((field) => field.id === selectedFieldId.value);
    if (!stillExists) {
      selectedFieldId.value = null;
      selectFirstFieldIfNeeded();
    }
  },
);

watch(selectedFieldId, (id) => {
  clearPruningPoints();
  resetMeasurementMeta();
  clearCompareLayer();
  comparedMeasurementId.value = null;
  drawField();
  if (id) {
    pruningStore.fetchByField(String(id));
  } else {
    pruningStore.reset();
  }
});

watch(baseLayer, applyBaseLayer);

watch(selectedMethod, (method) => {
  drawingMessage.value = '';
  if (method === 'gps') {
    startGps();
  } else {
    stopGps();
  }
});
</script>

<template>
  <TeaBusinessLayout>
    <div class="pruning-page">
      <header class="page-header">
        <div>
          <p class="page-kicker">Çay İşleri</p>
          <h1>Budama ölçümü</h1>
          <p class="page-intro">
            Budanan alanı ada/parsel içinde konumuyla kaydet, ölçüm yöntemini belirt
            ve onay sürecini tek ekranda tamamla.
          </p>
        </div>
        <button
          class="primary-action"
          type="button"
          :disabled="!selectedField || !hasFieldGeometry"
          @click="startNewMeasurement"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          Yeni ölçüm başlat
        </button>
      </header>

      <section class="summary-strip" aria-label="Budama kaydı özeti">
        <div class="summary-item">
          <span>Üretici</span>
          <strong>{{ producerName || 'Seçilmedi' }}</strong>
        </div>
        <div class="summary-item">
          <span>Parsel</span>
          <strong>{{ selectedField?.parcelNo ?? 'Eksik' }}</strong>
        </div>
        <div class="summary-item">
          <span>Toplam alan</span>
          <strong>{{ selectedField ? formatArea(selectedField.area, selectedField.areaUnit) : '-' }}</strong>
        </div>
        <div class="summary-item">
          <span>Budanan alan</span>
          <strong>{{ pruningAreaM2 ? formatSquareMeters(pruningAreaM2) : '-' }}</strong>
        </div>
        <div class="summary-item">
          <span>1/10 hedef</span>
          <strong>{{ selectedField ? formatSquareMeters(targetPruningArea) : '-' }}</strong>
        </div>
      </section>

      <section class="field-selector" aria-label="Ölçüm yapılacak tarla seçimi">
        <AppSelect
          v-model="selectedFieldId"
          :options="fieldOptions"
          label="Üretici / ada-parsel seçin"
          placeholder="Tarla seçin"
          :searchable="true"
          :disabled="fieldsStore.isLoading || !hasFields"
          :helper-text="selectedField ? fieldLocation : 'Budama ölçümü için önce kayıtlı bir tarla seçin.'"
        />
        <div class="selector-state">
          <span v-if="fieldsStore.isLoading">Tarlalar yükleniyor...</span>
          <span v-else-if="fieldsStore.error">{{ fieldsStore.error }}</span>
          <span v-else-if="!hasFields">Kayıtlı tarla bulunamadı. Önce Tarlalarım ekranından tarla ekleyin.</span>
          <span v-else>{{ fieldsStore.fields.length }} kayıtlı tarla arasından seçim yapılıyor.</span>
        </div>
      </section>

      <div class="workbench">
        <section class="map-panel" aria-label="Parsel üzerinde budama alanı">
          <div class="map-toolbar">
            <div>
              <h2>{{ selectedField?.name ?? 'Tarla konumu' }}</h2>
              <p>{{ selectedField ? fieldLocation : 'Tarla seçildiğinde parsel uydu görüntüsü üzerinde açılır.' }}</p>
            </div>
            <div class="toolbar-controls">
              <div class="layer-switch" role="group" aria-label="Harita görünümü">
                <button
                  type="button"
                  :class="{ 'is-active': baseLayer === 'satellite' }"
                  :aria-pressed="baseLayer === 'satellite'"
                  @click="baseLayer = 'satellite'"
                >
                  Uydu
                </button>
                <button
                  type="button"
                  :class="{ 'is-active': baseLayer === 'street' }"
                  :aria-pressed="baseLayer === 'street'"
                  @click="baseLayer = 'street'"
                >
                  Harita
                </button>
              </div>
              <span class="method-pill">{{ selectedMethodLabel }}</span>
            </div>
          </div>
          <div class="drawing-toolbar" aria-label="Budama alanı çizim kontrolleri">
            <span class="drawing-status">{{ pruningStatusText }}</span>
            <div class="drawing-actions">
              <button
                v-if="selectedPointIndex !== null"
                type="button"
                class="is-danger"
                @click="removeSelectedPoint"
              >
                Seçili noktayı sil
              </button>
              <button type="button" :disabled="pruningPoints.length === 0" @click="undoPruningPoint">
                Geri al
              </button>
              <button type="button" :disabled="pruningPoints.length === 0" @click="clearPruningPoints">
                Temizle
              </button>
            </div>
          </div>

          <div class="map-shell">
            <div ref="mapContainer" class="map-canvas" aria-label="Seçilen tarla uydu haritası"></div>

            <div v-if="drawingMessage" class="map-message is-warning" role="alert">
              {{ drawingMessage }}
            </div>
            <div v-else-if="!selectedField" class="map-message">
              Ölçüm için bir tarla seçin.
            </div>
            <div v-else-if="!hasFieldGeometry" class="map-message">
              Bu tarlada parsel koordinatı bulunamadı. GPS yöntemini kullanabilirsiniz.
            </div>
            <div
              v-else-if="pruningPoints.length === 0 && selectedMethod !== 'gps'"
              class="map-hint"
            >
              Budanan alanın köşelerine dokunun · noktaları sürükleyerek düzeltin
            </div>
            <div
              v-else-if="pruningPoints.length === 0 && selectedMethod === 'gps'"
              class="map-hint"
            >
              Sahada köşelere gidip "Konumu ekle" ile işaretleyin
            </div>

            <div v-if="selectedField && hasFieldGeometry" class="map-readout" aria-live="polite">
              <span>Budanan alan</span>
              <strong>{{ pruningPoints.length >= 3 ? formatSquareMeters(pruningAreaM2) : '—' }}</strong>
              <small v-if="pruningPoints.length >= 3">parselin %{{ pruningRatioText }}'i</small>
              <small v-else>en az 3 köşe işaretleyin</small>
            </div>

            <div v-if="comparedMeasurementId" class="map-legend" aria-hidden="true">
              <span class="legend-dot legend-current"></span> Bu ölçüm
              <span class="legend-dot legend-compare"></span> Önceki ölçüm
            </div>
          </div>
        </section>

        <aside class="side-panel" aria-label="Ölçüm seçenekleri">
          <section class="panel-section">
            <h2>Ölçüm yöntemi</h2>
            <div class="method-list">
              <button
                v-for="method in methods"
                :key="method.id"
                class="method-option"
                :class="{ 'is-selected': selectedMethod === method.id }"
                type="button"
                @click="selectedMethod = method.id"
              >
                <span class="method-badge">{{ method.badge }}</span>
                <strong>{{ method.title }}</strong>
                <span>{{ method.description }}</span>
              </button>
            </div>
          </section>

          <section v-if="selectedMethod === 'gps'" class="panel-section">
            <h2>GPS ile saha ölçümü</h2>
            <div class="gps-panel">
              <div class="gps-accuracy" :class="`is-${gpsAccuracyLevel ?? 'none'}`">
                <span class="gps-dot" aria-hidden="true"></span>
                <div>
                  <strong>{{ gpsAccuracyText }}</strong>
                  <small>{{ accuracyLabel(gpsAccuracyLevel) }}</small>
                </div>
              </div>
              <p v-if="gpsError" class="gps-error">{{ gpsError }}</p>
              <div class="gps-actions">
                <button
                  type="button"
                  class="gps-add"
                  :disabled="!gpsActive || !lastGpsPosition"
                  @click="addGpsPoint"
                >
                  Konumu ekle
                </button>
                <button v-if="!gpsActive" type="button" class="gps-toggle" @click="startGps">
                  Konumu başlat
                </button>
                <button v-else type="button" class="gps-toggle" @click="stopGps">
                  Durdur
                </button>
              </div>
              <p class="gps-help">Köşelere gidip her köşede "Konumu ekle" deyin. Noktaları sonradan sürükleyerek düzeltebilirsiniz.</p>
            </div>
          </section>

          <section class="panel-section">
            <h2>Ölçüm detayları</h2>
            <div class="detail-fields">
              <div class="detail-row">
                <span>Ölçüm tipi</span>
                <strong>{{ selectedMethodLabel }}</strong>
              </div>
              <div class="detail-row">
                <span>Doğruluk seviyesi</span>
                <strong>{{ accuracyLabel(accuracyLevelForSave) }}</strong>
              </div>

              <label class="check-row">
                <input v-model="fieldCheckDone" type="checkbox" />
                <span>Saha kontrolü yapıldı</span>
              </label>

              <div class="photo-field">
                <span class="field-label">
                  Fotoğraf / saha görseli
                  <em v-if="photoRequired">(zorunlu)</em>
                </span>
                <div v-if="photoUrl" class="photo-preview">
                  <img :src="photoUrl" alt="Saha görseli" />
                  <button type="button" class="photo-remove" @click="removePhoto">Kaldır</button>
                </div>
                <label v-else class="photo-upload" :class="{ 'is-loading': isUploadingPhoto }">
                  <input type="file" accept="image/*" capture="environment" :disabled="isUploadingPhoto" @change="onPhotoChange" />
                  <span>{{ isUploadingPhoto ? 'Yükleniyor…' : 'Fotoğraf ekle' }}</span>
                </label>
              </div>

              <label class="field-label" for="pruning-notes">Not</label>
              <textarea
                id="pruning-notes"
                v-model="measurementNotes"
                class="notes-input"
                rows="2"
                maxlength="1000"
                placeholder="Ölçümle ilgili açıklama (opsiyonel)"
              ></textarea>

              <div class="approvals">
                <label class="check-row">
                  <input v-model="producerApproved" type="checkbox" />
                  <span>Üretici onayı</span>
                </label>
                <label class="check-row">
                  <input v-model="staffApproved" type="checkbox" />
                  <span>Personel onayı</span>
                </label>
              </div>
            </div>
          </section>

          <section v-if="warnings.length" class="panel-section">
            <h2>Uyarılar</h2>
            <ul class="warning-list">
              <li v-for="warning in warnings" :key="warning.id" :class="`is-${warning.level}`">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>{{ warning.text }}</span>
              </li>
            </ul>
          </section>

          <section class="panel-section save-section">
            <button class="save-action" type="button" :disabled="!canSave" @click="saveMeasurement">
              <svg v-if="!pruningStore.isSaving" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              {{ pruningStore.isSaving ? 'Kaydediliyor…' : 'Ölçümü kaydet' }}
            </button>
            <p v-if="saveHint" class="save-hint">{{ saveHint }}</p>
          </section>

          <section class="panel-section">
            <h2>Kayıt kontrolü</h2>
            <ul class="checklist">
              <li v-for="item in checklist" :key="item.label" :class="`is-${item.status}`">
                <span class="status-dot" aria-hidden="true"></span>
                <span>{{ item.label }}</span>
              </li>
            </ul>
          </section>
        </aside>
      </div>

      <section class="history-section" aria-label="Önceki budama kayıtları">
        <div class="history-header">
          <h2>Budama geçmişi</h2>
          <span v-if="selectedField" class="history-count">{{ pruningStore.measurements.length }} kayıt</span>
        </div>

        <p v-if="!selectedField" class="history-empty">Geçmişi görmek için bir tarla seçin.</p>
        <p v-else-if="pruningStore.isLoading" class="history-empty">Kayıtlar yükleniyor…</p>
        <p v-else-if="pruningStore.measurements.length === 0" class="history-empty">
          Bu parsel için henüz budama kaydı yok. İlk ölçümü yukarıdan oluşturun.
        </p>
        <ul v-else class="history-list">
          <li
            v-for="measurement in pruningStore.measurements"
            :key="measurement.id"
            class="history-item"
            :class="{ 'is-compared': comparedMeasurementId === measurement.id }"
          >
            <div class="history-main">
              <div class="history-top">
                <strong>{{ formatSquareMeters(measurement.prunedAreaM2) }}</strong>
                <span class="history-ratio">parselin %{{ measurement.ratioPercent.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) }}'i</span>
                <span class="history-method">{{ methodLabel(measurement.method) }}</span>
              </div>
              <div class="history-meta">
                <span>{{ formatDateTime(measurement.measuredAt) }}</span>
                <span v-if="measurement.gpsAccuracyMeters">GPS ±{{ measurement.gpsAccuracyMeters.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) }} m</span>
                <span class="history-approval" :class="{ ok: measurement.producerApproved }">Üretici {{ measurement.producerApproved ? '✓' : '—' }}</span>
                <span class="history-approval" :class="{ ok: measurement.staffApproved }">Personel {{ measurement.staffApproved ? '✓' : '—' }}</span>
              </div>
            </div>
            <div class="history-side">
              <a v-if="measurement.photoUrl" :href="measurement.photoUrl" target="_blank" rel="noopener" class="history-photo">
                <img :src="measurement.photoUrl" alt="Saha görseli" />
              </a>
              <button
                type="button"
                class="history-compare"
                :class="{ 'is-active': comparedMeasurementId === measurement.id }"
                @click="toggleCompare(measurement)"
              >
                {{ comparedMeasurementId === measurement.id ? 'Gizle' : 'Haritada göster' }}
              </button>
            </div>
          </li>
        </ul>
      </section>

      <section class="process-section" aria-label="Personel işlem akışı">
        <h2>Personel işlem akışı</h2>
        <div class="process-list">
          <div class="process-item">
            <span>1</span>
            <p>Personel girişi yapılır, üretici ve ada/parsel seçilir.</p>
          </div>
          <div class="process-item">
            <span>2</span>
            <p>Parsel haritada açılır, açık arazi veya ağaç altı yöntemi belirlenir.</p>
          </div>
          <div class="process-item">
            <span>3</span>
            <p>Budanan alan çizilir ya da GPS noktalarıyla oluşturulur.</p>
          </div>
          <div class="process-item">
            <span>4</span>
            <p>Alan, oran, doğruluk ve önceki kayıt çakışmaları kontrol edilir.</p>
          </div>
          <div class="process-item">
            <span>5</span>
            <p>Fotoğraf, üretici onayı ve personel onayıyla kayıt tamamlanır.</p>
          </div>
        </div>
      </section>
    </div>
  </TeaBusinessLayout>
</template>

<style scoped>
.pruning-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  width: min(1180px, 100%);
  margin: 0 auto;
  padding: var(--space-8);
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-6);
}

.page-kicker {
  margin-bottom: var(--space-2);
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.page-header h1 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--font-size-3xl);
  line-height: var(--line-height-tight);
  text-wrap: balance;
}

.page-intro {
  max-width: 68ch;
  margin-top: var(--space-3);
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
}

.primary-action {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 0 var(--space-5);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.primary-action:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.primary-action:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-3);
}

.summary-item {
  min-width: 0;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-secondary);
}

.summary-item span {
  display: block;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.summary-item strong {
  display: block;
  margin-top: var(--space-1);
  color: var(--color-text-primary);
  font-size: var(--font-size-xl);
  line-height: var(--line-height-tight);
  overflow-wrap: anywhere;
}

.field-selector {
  display: grid;
  grid-template-columns: minmax(280px, 460px) minmax(0, 1fr);
  gap: var(--space-4);
  align-items: end;
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-secondary);
}

.selector-state {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.workbench {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
  gap: var(--space-5);
  align-items: start;
}

.map-panel,
.side-panel,
.process-section,
.history-section {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-secondary);
}

.map-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.map-toolbar h2,
.panel-section h2,
.process-section h2,
.history-header h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--font-size-lg);
  line-height: var(--line-height-tight);
}

.map-toolbar p {
  margin-top: var(--space-1);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.toolbar-controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.layer-switch {
  display: inline-flex;
  padding: 2px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-bg-tertiary);
}

.layer-switch button {
  min-height: 32px;
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.layer-switch button.is-active {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-sm);
}

.drawing-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.drawing-status {
  min-width: 0;
  overflow-wrap: anywhere;
}

.drawing-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.drawing-actions button {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.drawing-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.drawing-actions button:not(:disabled):hover {
  border-color: var(--color-border-strong);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.drawing-actions button.is-danger {
  border-color: color-mix(in srgb, var(--color-warning) 40%, var(--color-border));
  background: color-mix(in srgb, var(--color-warning) 14%, var(--color-bg-secondary));
  color: var(--color-warning);
}

.drawing-actions button.is-danger:hover {
  border-color: var(--color-warning);
  background: color-mix(in srgb, var(--color-warning) 22%, var(--color-bg-secondary));
  color: var(--color-warning);
}

.method-pill,
.method-badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.map-shell {
  position: relative;
}

.map-canvas {
  height: 460px;
  width: 100%;
  overflow: hidden;
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  background: var(--color-bg-tertiary);
}

.map-message {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 1100;
  max-width: min(340px, calc(100% - 48px));
  transform: translate(-50%, -50%);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-bg-secondary) 94%, transparent);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-align: center;
  box-shadow: var(--shadow-sm);
  pointer-events: none;
}

.map-message.is-warning {
  border-color: color-mix(in srgb, var(--color-warning) 34%, var(--color-border));
  background: color-mix(in srgb, var(--color-warning) 12%, var(--color-bg-secondary));
  color: var(--color-warning);
}

.map-hint {
  position: absolute;
  left: 50%;
  top: var(--space-4);
  z-index: 1100;
  max-width: calc(100% - 96px);
  transform: translateX(-50%);
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-bg-secondary) 92%, transparent);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-align: center;
  box-shadow: var(--shadow-sm);
  pointer-events: none;
}

.map-readout {
  position: absolute;
  left: var(--space-4);
  bottom: var(--space-4);
  z-index: 1100;
  display: flex;
  flex-direction: column;
  min-width: 150px;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-bg-secondary) 94%, transparent);
  box-shadow: var(--shadow-sm);
  pointer-events: none;
}

.map-readout span {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.map-readout strong {
  margin-top: 2px;
  color: var(--color-text-primary);
  font-size: var(--font-size-xl);
  line-height: var(--line-height-tight);
}

.map-readout small {
  margin-top: 2px;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.map-legend {
  position: absolute;
  right: var(--space-4);
  bottom: var(--space-4);
  z-index: 1100;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-bg-secondary) 94%, transparent);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  box-shadow: var(--shadow-sm);
  pointer-events: none;
}

.legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.legend-dot.legend-current {
  background: var(--color-warning);
}

.legend-dot.legend-compare {
  background: #0ea5e9;
}

/* Leaflet injects its own DOM, so reach it through :deep() from the scoped container. */
.map-canvas :deep(.prune-vertex-wrap) {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 0;
}

.map-canvas :deep(.prune-vertex) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #ffffff;
  background: var(--color-warning);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  box-shadow: 0 1px 5px rgba(15, 23, 42, 0.45);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.map-canvas :deep(.prune-vertex.is-selected) {
  transform: scale(1.15);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-warning) 45%, transparent);
}

.map-canvas :deep(.leaflet-marker-icon) {
  cursor: grab;
}

.map-canvas :deep(.leaflet-dragging .leaflet-marker-draggable) {
  cursor: grabbing;
}

.map-canvas :deep(.leaflet-bar) {
  border-color: var(--color-border);
  box-shadow: var(--shadow-sm);
}

.map-canvas :deep(.leaflet-bar a) {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border-bottom-color: var(--color-border);
}

.map-canvas :deep(.leaflet-bar a:hover) {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.side-panel {
  display: flex;
  flex-direction: column;
}

.panel-section {
  padding: var(--space-5);
}

.panel-section + .panel-section {
  border-top: 1px solid var(--color-border);
}

.method-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.method-option {
  display: flex;
  min-height: 116px;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.method-option:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-strong);
}

.method-option.is-selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.method-option strong {
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
}

.method-option span:last-child {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

/* GPS panel */
.gps-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.gps-accuracy {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
}

.gps-accuracy .gps-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-text-muted);
  flex: 0 0 auto;
}

.gps-accuracy.is-high .gps-dot {
  background: var(--color-success);
}

.gps-accuracy.is-medium .gps-dot {
  background: var(--color-warning);
}

.gps-accuracy.is-low .gps-dot {
  background: var(--color-danger, #dc2626);
}

.gps-accuracy strong {
  display: block;
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
}

.gps-accuracy small {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.gps-error {
  color: var(--color-danger, #dc2626);
  font-size: var(--font-size-sm);
}

.gps-actions {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-2);
}

.gps-add,
.gps-toggle {
  min-height: 40px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.gps-add {
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.gps-add:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.gps-toggle {
  border: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

.gps-help {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

/* Detail fields */
.detail-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.detail-row strong {
  color: var(--color-text-primary);
}

.field-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.field-label em {
  font-style: normal;
  color: var(--color-warning);
}

.check-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 36px;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  cursor: pointer;
}

.check-row input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
}

.photo-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.photo-upload {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.photo-upload.is-loading {
  opacity: 0.7;
  cursor: progress;
}

.photo-upload input {
  display: none;
}

.photo-preview {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.photo-preview img {
  display: block;
  width: 100%;
  max-height: 180px;
  object-fit: cover;
}

.photo-remove {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  min-height: 30px;
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-sm);
  background: rgba(15, 23, 42, 0.72);
  color: #fff;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.notes-input {
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  font: inherit;
  font-size: var(--font-size-sm);
  resize: vertical;
}

.notes-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.approvals {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

/* Warnings */
.warning-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.warning-list li {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.warning-list li svg {
  flex: 0 0 auto;
  margin-top: 1px;
}

.warning-list li.is-warning {
  border-color: color-mix(in srgb, var(--color-warning) 34%, var(--color-border));
  background: color-mix(in srgb, var(--color-warning) 10%, var(--color-bg-secondary));
  color: var(--color-warning);
}

.warning-list li.is-danger {
  border-color: color-mix(in srgb, var(--color-danger, #dc2626) 38%, var(--color-border));
  background: color-mix(in srgb, var(--color-danger, #dc2626) 10%, var(--color-bg-secondary));
  color: var(--color-danger, #dc2626);
}

/* Save */
.save-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.save-action {
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.save-action:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.save-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.save-hint {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  text-align: center;
}

/* Checklist */
.checklist {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.checklist li {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.status-dot {
  width: 10px;
  height: 10px;
  margin-top: 5px;
  border-radius: 50%;
  background: var(--color-text-muted);
  flex: 0 0 auto;
}

.checklist li.is-done .status-dot {
  background: var(--color-success);
}

.checklist li.is-warning .status-dot {
  background: var(--color-warning);
}

.checklist li.is-pending .status-dot {
  background: var(--color-border-strong);
}

/* History */
.history-section {
  padding: var(--space-5);
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.history-count {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.history-empty {
  margin-top: var(--space-4);
  padding: var(--space-5);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  text-align: center;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.history-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-tertiary);
}

.history-item.is-compared {
  border-color: #0ea5e9;
}

.history-main {
  min-width: 0;
}

.history-top {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
}

.history-top strong {
  color: var(--color-text-primary);
  font-size: var(--font-size-lg);
}

.history-ratio {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.history-method {
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.history-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  margin-top: var(--space-2);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.history-approval.ok {
  color: var(--color-success);
  font-weight: var(--font-weight-semibold);
}

.history-side {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.history-photo img {
  display: block;
  width: 52px;
  height: 52px;
  object-fit: cover;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.history-compare {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
}

.history-compare.is-active {
  border-color: #0ea5e9;
  color: #0ea5e9;
}

/* Process */
.process-section {
  padding: var(--space-5);
}

.process-list {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.process-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-height: 150px;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-tertiary);
}

.process-item span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-full);
  background: var(--color-bg-secondary);
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.process-item p {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

@media (max-width: 1180px) {
  .process-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .workbench {
    grid-template-columns: 1fr;
  }

  .field-selector {
    grid-template-columns: 1fr;
  }

  .map-canvas {
    height: 420px;
  }
}

@media (max-width: 768px) {
  .pruning-page {
    padding: var(--space-5) var(--space-4);
  }

  .page-header {
    flex-direction: column;
  }

  .primary-action {
    width: 100%;
  }

  .summary-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .map-toolbar {
    flex-direction: column;
  }

  .toolbar-controls {
    justify-content: space-between;
    width: 100%;
  }

  .drawing-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .drawing-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .map-canvas {
    height: 360px;
  }

  .history-item {
    flex-direction: column;
  }

  .history-side {
    width: 100%;
    justify-content: space-between;
  }

  .process-list {
    grid-template-columns: 1fr;
  }

  .process-item {
    min-height: auto;
  }
}

@media (max-width: 420px) {
  .summary-strip {
    grid-template-columns: 1fr;
  }
}
</style>
