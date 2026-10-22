<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { Eraser, Scissors, SplitSquareHorizontal } from '@lucide/vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import { area as turfArea, feature } from '@turf/turf';
import polygonSplitter from 'polygon-splitter';
import { Button } from '@/components/ui/button';
import type { GardenEditorContext } from '@/services/api';

/**
 * Boundary editor on the satellite map: the parcel, the garden, its neighbours in the parcel and the
 * tea cover are drawn; the user cuts the garden into pieces with a line, draws pieces as polygons or
 * redraws the garden boundary. Pieces are plain GeoJSON for the registry operation forms.
 */
export interface EditorPiece {
    id: string;
    label: string;
    geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

const props = defineProps<{
    context: GardenEditorContext;
    mode: 'subdivision' | 'boundary';
    pieces?: EditorPiece[];
    geometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
}>();
const emit = defineEmits<{
    (e: 'update:pieces', pieces: EditorPiece[]): void;
    (e: 'update:geometry', geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | null): void;
}>();

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#eab308', '#ef4444', '#64748b', '#0ea5e9', '#84cc16', '#f97316'];
const LETTERS = 'ABCDEFGHJKLMNPRSTUVYZ';
const container = ref<HTMLElement | null>(null);
const hint = ref('');
let map: L.Map | null = null;
let pieceLayers = new Map<string, L.GeoJSON>();
let boundaryLayer: L.GeoJSON | null = null;
let pieces: EditorPiece[] = [...(props.pieces ?? [])];
let counter = 0;

type Poly = GeoJSON.Polygon | GeoJSON.MultiPolygon;

const gj = (g: unknown): GeoJSON.GeoJsonObject => g as GeoJSON.GeoJsonObject;

function m2(g: Poly): number {
    return turfArea(feature(g));
}
function fmt(n: number): string {
    return `${Math.round(n).toLocaleString('tr-TR')} m²`;
}
function toPolygons(out: unknown): Poly[] {
    const o = out as { type?: string; coordinates?: unknown; features?: Array<{ geometry: GeoJSON.Geometry }> };
    if (!o) return [];
    if (o.type === 'MultiPolygon') return (o.coordinates as GeoJSON.Position[][][]).map((c) => ({ type: 'Polygon', coordinates: c }));
    if (o.type === 'Polygon') return [o as GeoJSON.Polygon];
    if (o.type === 'FeatureCollection') return (o.features ?? []).flatMap((f) => toPolygons(f.geometry));
    if (o.type === 'Feature') return toPolygons((o as unknown as GeoJSON.Feature).geometry);
    return [];
}
function relabel(): void {
    pieces.forEach((p, i) => { p.label = LETTERS[i] ?? String(i + 1); });
}
function publish(): void {
    emit('update:pieces', pieces.map((p) => ({ id: p.id, label: p.label, geometry: p.geometry })));
}
function nextId(): string {
    counter++;
    return `p${Date.now().toString(36)}${counter}`;
}

function drawPiece(p: EditorPiece, index: number): void {
    if (!map) return;
    const color = COLORS[index % COLORS.length] ?? '#22c55e';
    const layer = L.geoJSON(p.geometry as GeoJSON.GeoJsonObject, { style: { color, weight: 3, fillColor: color, fillOpacity: 0.25 } }).addTo(map);
    layer.bindTooltip(`${p.label} · ${fmt(m2(p.geometry))}`, { permanent: true, direction: 'center', className: 'licensing-piece-label' });
    layer.eachLayer((l) => {
        const path = l as L.Polygon & { pm?: { enable: (o: Record<string, unknown>) => void } };
        path.pm?.enable({ allowSelfIntersection: false, snappable: true });
        path.on('pm:edit', () => {
            p.geometry = (path.toGeoJSON() as GeoJSON.Feature<Poly>).geometry;
            layer.setTooltipContent(`${p.label} · ${fmt(m2(p.geometry))}`);
            publish();
        });
        path.on('pm:remove', () => {
            pieces = pieces.filter((x) => x.id !== p.id);
            pieceLayers.delete(p.id);
            relabel();
            redraw();
            publish();
        });
    });
    pieceLayers.set(p.id, layer);
}
function redraw(): void {
    for (const l of pieceLayers.values()) l.remove();
    pieceLayers = new Map();
    pieces.forEach((p, i) => drawPiece(p, i));
}
function clearPieces(): void {
    pieces = [];
    redraw();
    publish();
    hint.value = 'Parçalar silindi. Çizgiyle bölün ya da parça çizin.';
}
function splitWith(line: GeoJSON.LineString | GeoJSON.MultiLineString): void {
    const parent = props.context.garden.geometry as unknown as Poly;
    const targets: Array<{ id: string | null; geometry: Poly }> = pieces.length ? pieces.map((p) => ({ id: p.id, geometry: p.geometry })) : [{ id: null, geometry: parent }];
    const next: EditorPiece[] = [];
    let cut = 0;
    for (const t of targets) {
        let polys: Poly[] = [];
        try {
            polys = toPolygons(polygonSplitter(t.geometry, line)).filter((g) => m2(g) > 1);
        } catch {
            polys = [];
        }
        if (polys.length > 1) {
            cut++;
            for (const g of polys) next.push({ id: nextId(), label: '', geometry: g });
        } else {
            next.push({ id: t.id ?? nextId(), label: '', geometry: t.geometry });
        }
    }
    if (cut === 0) {
        hint.value = 'Çizgi hiçbir parçayı ikiye ayırmadı; çizgi bahçeyi baştan sona kesmeli.';
        return;
    }
    pieces = next;
    relabel();
    redraw();
    publish();
    hint.value = `${pieces.length} parça. Köşeleri sürükleyerek düzeltebilir, yeni bir çizgiyle tekrar bölebilirsiniz.`;
}
function setBoundary(g: Poly): void {
    if (!map) return;
    boundaryLayer?.remove();
    boundaryLayer = L.geoJSON(g as GeoJSON.GeoJsonObject, { style: { color: '#22c55e', weight: 3, fillColor: '#22c55e', fillOpacity: 0.2 } }).addTo(map);
    boundaryLayer.bindTooltip(fmt(m2(g)), { permanent: true, direction: 'center', className: 'licensing-piece-label' });
    boundaryLayer.eachLayer((l) => {
        const path = l as L.Polygon & { pm?: { enable: (o: Record<string, unknown>) => void } };
        path.pm?.enable({ allowSelfIntersection: false, snappable: true });
        path.on('pm:edit', () => {
            const geom = (path.toGeoJSON() as GeoJSON.Feature<Poly>).geometry;
            boundaryLayer?.setTooltipContent(fmt(m2(geom)));
            emit('update:geometry', geom);
        });
    });
    emit('update:geometry', g);
}
function startDraw(shape: 'Polygon' | 'Line'): void {
    const pm = (map as unknown as { pm?: { enableDraw: (s: string, o?: Record<string, unknown>) => void } })?.pm;
    pm?.enableDraw(shape, { snappable: true, snapDistance: 12, allowSelfIntersection: false });
    hint.value = shape === 'Line' ? 'Bahçeyi baştan sona kesen bir çizgi çizin; bitirmek için son noktaya tekrar tıklayın.' : 'Parçanın köşelerine tıklayın; ilk noktaya tıklayarak kapatın.';
}

function init(): void {
    if (!container.value) return;
    map?.remove();
    map = L.map(container.value, { zoomControl: true, attributionControl: false });
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 21, maxNativeZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }).addTo(map);
    const ctx = props.context;
    for (const t of ctx.teaPatches) L.geoJSON(gj(t.geometry), { style: { color: '#86efac', weight: 1, fillColor: '#86efac', fillOpacity: 0.12, dashArray: '2 4' }, interactive: false }).addTo(map);
    if (ctx.parcel) L.geoJSON(gj(ctx.parcel.geometry), { style: { color: '#ffffff', weight: 2, dashArray: '8 6', fillOpacity: 0 }, interactive: false }).addTo(map);
    for (const s of ctx.siblings) {
        L.geoJSON(gj(s.geometry), { style: { color: s.approvalStatus === 'approved' ? '#cbd5e1' : '#f59e0b', weight: 2, fillColor: '#94a3b8', fillOpacity: 0.12 }, interactive: false })
            .bindTooltip(`${s.producerName || s.producerCode} · ${s.code}`, { permanent: false, direction: 'center' })
            .addTo(map);
    }
    const parent = L.geoJSON(gj(ctx.garden.geometry), { style: { color: '#4ade80', weight: 2, fillOpacity: 0.05, dashArray: props.mode === 'boundary' ? '4 4' : undefined }, interactive: false }).addTo(map);
    map.fitBounds(parent.getBounds().pad(0.4));
    const pm = (map as unknown as { pm: { addControls: (o: Record<string, unknown>) => void; setLang?: (l: string) => void; setGlobalOptions: (o: Record<string, unknown>) => void } }).pm;
    pm.setGlobalOptions({ snappable: true, snapDistance: 12, allowSelfIntersection: false, pathOptions: { color: '#f8fafc', weight: 3, dashArray: '6 4' } });
    pm.addControls({ position: 'topright', drawMarker: false, drawCircle: false, drawCircleMarker: false, drawRectangle: false, drawText: false, drawPolyline: false, drawPolygon: false, cutPolygon: false, rotateMode: false, dragMode: false, editMode: true, removalMode: props.mode === 'subdivision' });
    map.on('pm:create', (e: L.LeafletEvent) => {
        const ev = e as unknown as { shape: string; layer: L.Layer & { toGeoJSON: () => GeoJSON.Feature } };
        const geom = ev.layer.toGeoJSON().geometry as GeoJSON.Geometry;
        ev.layer.remove();
        if (ev.shape === 'Line') {
            if (props.mode === 'boundary') { hint.value = 'Sınır düzenlemede çizgi kullanılmaz; köşeleri sürükleyin ya da yeni poligon çizin.'; return; }
            splitWith(geom as GeoJSON.LineString);
        } else if (geom.type === 'Polygon') {
            if (props.mode === 'boundary') { setBoundary(geom); hint.value = 'Yeni sınır çizildi; köşeleri sürükleyerek düzeltebilirsiniz.'; return; }
            pieces.push({ id: nextId(), label: '', geometry: geom });
            relabel();
            redraw();
            publish();
            hint.value = `${pieces.length} parça.`;
        }
    });
    if (props.mode === 'boundary') {
        setBoundary((props.geometry as Poly | null) ?? (ctx.garden.geometry as unknown as Poly));
        hint.value = 'Yeşil sınırın köşelerini sürükleyin ya da "Yeni sınır çiz" ile baştan çizin.';
    } else {
        pieces = [...(props.pieces ?? [])];
        relabel();
        redraw();
        hint.value = pieces.length ? `${pieces.length} parça.` : 'Bahçeyi bir çizgiyle bölün ya da parçaları tek tek çizin.';
    }
}

watch(() => props.context.garden.code, () => init());
onMounted(init);
onBeforeUnmount(() => { map?.remove(); map = null; });
</script>

<template>
    <div class="flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-2">
            <template v-if="mode === 'subdivision'">
                <Button variant="default" size="sm" class="h-11 md:h-9" @click="startDraw('Line')"><Scissors aria-hidden="true" />Çizgiyle böl</Button>
                <Button variant="outline" size="sm" class="h-11 md:h-9" @click="startDraw('Polygon')"><SplitSquareHorizontal aria-hidden="true" />Parça çiz</Button>
                <Button variant="ghost" size="sm" class="h-11 md:h-9" @click="clearPieces"><Eraser aria-hidden="true" />Temizle</Button>
            </template>
            <template v-else>
                <Button variant="outline" size="sm" class="h-11 md:h-9" @click="startDraw('Polygon')"><SplitSquareHorizontal aria-hidden="true" />Yeni sınır çiz</Button>
            </template>
            <span class="text-xs text-muted-foreground">{{ hint }}</span>
        </div>
        <div ref="container" class="h-[420px] w-full overflow-hidden rounded-lg border" />
        <p class="text-xs text-muted-foreground">Beyaz kesikli: TKGM parseli · açık yeşil: bahçe sınırı · gri: komşu hissedar bahçeleri · noktalı yeşil: uydu çay örtüsü. Çizim parsel/bahçe köşelerine yapışır.</p>
    </div>
</template>

<style>
.licensing-piece-label { background: rgba(15, 23, 42, 0.78); color: #fff; border: 0; border-radius: 6px; font-weight: 600; font-size: 12px; padding: 2px 6px; box-shadow: none; }
.licensing-piece-label::before { display: none; }
</style>
