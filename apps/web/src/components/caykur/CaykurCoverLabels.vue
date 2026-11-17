<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { Download, PencilLine, Trash2 } from '@lucide/vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import { LoadingState } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/composables/useToast';
import { api, type CoverClass, type CoverLabelList, type LandCoverMap } from '@/services/api';
import { formatM2 } from '@/services/caykur/teaInventory';
import { formatNumber } from '@/services/caykur';

/**
 * Reference areas (İşaretleme): a person who knows the ground draws an area and says what grows there. These areas are
 * the reference the land-cover model is calibrated and scored against; until enough exist, every accuracy figure of
 * the module is agreement with deed titles only.
 */
const props = defineProps<{ areaId: string; parcels: LandCoverMap | null; labels: Record<string, string>; colors: Record<string, string> }>();

const CLASSES: CoverClass[] = ['tea', 'hazelnut', 'forest', 'grass', 'crop', 'built', 'other'];
const TILES = 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
type Pm = { enableDraw: (shape: string, options?: Record<string, unknown>) => void; disableDraw: () => void; setGlobalOptions: (o: Record<string, unknown>) => void };

const toast = useToast();
const isLoading = ref(true);
const isSaving = ref(false);
const data = ref<CoverLabelList | null>(null);
const coverClass = ref<CoverClass>('tea');
const note = ref('');
const drawing = ref(false);
/** The ring just drawn, waiting to be saved. */
const pending = ref<Array<[number, number]> | null>(null);
const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let saved: L.LayerGroup | null = null;
let draft: L.Layer | null = null;

const total = computed(() => data.value?.labels.length ?? 0);
const enough = computed(() => (data.value ? CLASSES.filter((c) => data.value!.counts[c].areas >= data.value!.rules.usefulPerClass).length : 0));

function pm(): Pm {
    return (map as unknown as { pm: Pm }).pm;
}
function drawSaved(): void {
    if (!map) return;
    saved?.remove();
    saved = L.layerGroup().addTo(map);
    for (const l of data.value?.labels ?? []) {
        const color = props.colors[l.coverClass] ?? '#0f172a';
        L.geoJSON({ type: 'Feature', geometry: l.geometry, properties: {} } as GeoJSON.Feature, { style: { color: '#ffffff', weight: 3, fillColor: color, fillOpacity: 0.55 } })
            .bindTooltip(`${props.labels[l.coverClass] ?? l.coverClass} · ${formatM2(l.areaM2)}${l.note ? ` · ${l.note}` : ''}`, { sticky: true })
            .addTo(saved);
    }
}
function renderMap(): void {
    map?.remove();
    map = null;
    if (!mapContainer.value) return;
    map = L.map(mapContainer.value, { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
    L.tileLayer(TILES, { maxZoom: 20 }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    // Parcel outlines for orientation only; they take no clicks, so drawing over them works.
    const outlines = props.parcels ? L.geoJSON(props.parcels, { style: { color: '#f8fafc', weight: 1, opacity: 0.7, fill: false }, interactive: false }).addTo(map) : null;
    const bounds = outlines?.getBounds();
    if (bounds?.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
    else map.setView([40.82, 40.29], 15);
    pm().setGlobalOptions({ snappable: false, allowSelfIntersection: false, pathOptions: { color: '#facc15', weight: 3 } });
    map.on('pm:create', (e: L.LeafletEvent) => {
        const ev = e as unknown as { layer: L.Layer & { toGeoJSON: () => GeoJSON.Feature<GeoJSON.Polygon> } };
        draft?.remove();
        draft = ev.layer;
        pending.value = (ev.layer.toGeoJSON().geometry.coordinates[0] ?? []).map((c) => [c[0] as number, c[1] as number]);
        drawing.value = false;
    });
    drawSaved();
}
function startDrawing(): void {
    if (!map) return;
    draft?.remove();
    draft = null;
    pending.value = null;
    drawing.value = true;
    pm().enableDraw('Polygon');
}
function cancel(): void {
    if (map) pm().disableDraw();
    draft?.remove();
    draft = null;
    pending.value = null;
    drawing.value = false;
}
async function load(): Promise<void> {
    isLoading.value = true;
    const res = await api.getCoverLabels(props.areaId);
    isLoading.value = false;
    data.value = res.data ?? null;
    await nextTick();
    renderMap();
}
async function save(): Promise<void> {
    if (!pending.value) return;
    isSaving.value = true;
    const res = await api.createCoverLabel(props.areaId, { coverClass: coverClass.value, ring: pending.value, note: note.value.trim() || undefined });
    isSaving.value = false;
    if (!res.data) {
        toast.error(res.error?.message ?? 'Alan kaydedilemedi');
        return;
    }
    toast.success(`${props.labels[coverClass.value] ?? coverClass.value} alanı kaydedildi`);
    note.value = '';
    cancel();
    const list = await api.getCoverLabels(props.areaId);
    if (list.data) data.value = list.data;
    drawSaved();
}
async function remove(id: string): Promise<void> {
    const res = await api.deleteCoverLabel(props.areaId, id);
    if (res.error) {
        toast.error(res.error.message ?? 'Alan silinemedi');
        return;
    }
    const list = await api.getCoverLabels(props.areaId);
    if (list.data) data.value = list.data;
    drawSaved();
}
async function download(): Promise<void> {
    const res = await api.exportCoverLabels(props.areaId);
    if (!res.data) {
        toast.error(res.error?.message ?? 'Dosya hazırlanamadı');
        return;
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(res.data)], { type: 'application/geo+json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'field-labels.geojson';
    a.click();
    URL.revokeObjectURL(url);
}
function onClass(v: unknown): void {
    if (typeof v === 'string' && (CLASSES as string[]).includes(v)) coverClass.value = v as CoverClass;
}
watch(() => props.areaId, () => void load(), { immediate: true });
onBeforeUnmount(() => map?.remove());
</script>

<template>
    <Card class="gap-0 py-0">
        <CardHeader class="py-4">
            <CardTitle class="flex flex-wrap items-center gap-2">
                İşaretleme: kesin bildiğiniz alanlar
                <Badge variant="outline">{{ formatNumber(total) }} alan</Badge>
            </CardTitle>
            <CardDescription>
                Ne yetiştiğini kesin bildiğiniz bir alanı haritada çizip türünü seçin. Bu alanlar modelin gerçek kıyas noktası olur: model bunlarla yeniden eğitilir ve doğruluğu tapuya değil bunlara göre ölçülür.
                Yalnız çayı değil, çay olmayanları da (özellikle fındık) işaretleyin.
            </CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-4 border-t py-4">
            <LoadingState v-if="isLoading" text="İşaretli alanlar yükleniyor…" />
            <template v-else>
                <ul class="grid gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
                    <li>Alan en az {{ data?.rules.minAreaM2 ?? 400 }} m² olmalı (yaklaşık 20 × 20 m); daha küçüğüne uydu pikseli sığmaz.</li>
                    <li>Yalnız tek tür örtünün olduğu temiz alanları çizin; yarısı çay yarısı ağaç olan yer modeli yanıltır.</li>
                    <li>Kenarlardan birkaç metre içeride kalın: sınır pikselleri komşu örtüyle karışır.</li>
                    <li>Tür başına {{ data?.rules.usefulPerClass ?? 30 }} alan iyi bir başlangıçtır; farklı yamaç ve yüksekliklerden seçin.</li>
                </ul>

                <div class="flex flex-col gap-3 md:flex-row md:items-end">
                    <div class="flex flex-col gap-1.5 md:w-56">
                        <Label for="label-class">Bu alanda ne var</Label>
                        <Select :model-value="coverClass" @update:model-value="onClass">
                            <SelectTrigger id="label-class" class="h-11 w-full md:h-9"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem v-for="c in CLASSES" :key="c" :value="c">{{ labels[c] ?? c }}</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <div class="flex flex-1 flex-col gap-1.5">
                        <Label for="label-note">Not (isteğe bağlı)</Label>
                        <Input id="label-note" v-model="note" maxlength="300" placeholder="örn. kendi bahçem, Ekim 2026'da gördüm" class="h-11 md:h-9" />
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <Button v-if="!drawing && !pending" class="min-h-11 md:min-h-9" @click="startDrawing"><PencilLine aria-hidden="true" />Alan çiz</Button>
                        <Button v-if="pending" class="min-h-11 md:min-h-9" :disabled="isSaving" @click="save">{{ isSaving ? 'Kaydediliyor…' : 'Kaydet' }}</Button>
                        <Button v-if="drawing || pending" variant="outline" class="min-h-11 md:min-h-9" @click="cancel">Vazgeç</Button>
                    </div>
                </div>
                <p v-if="drawing" class="text-sm">Haritada köşeleri tek tek tıklayın; ilk köşeye yeniden tıklayınca alan kapanır.</p>
                <p v-else-if="pending" class="text-sm">Alan çizildi. Türü kontrol edip “Kaydet”e basın.</p>

                <div ref="mapContainer" class="isolate h-[30rem] w-full overflow-hidden rounded-lg border" />

                <div class="flex flex-wrap gap-2">
                    <Badge v-for="c in CLASSES" :key="c" :variant="(data?.counts[c].areas ?? 0) >= (data?.rules.usefulPerClass ?? 30) ? 'success' : 'outline'">
                        <span class="mr-1 inline-block size-2.5 rounded-sm" :style="{ background: colors[c] }" />{{ labels[c] ?? c }}: {{ data?.counts[c].areas ?? 0 }} alan
                    </Badge>
                </div>
                <p class="text-xs text-muted-foreground">
                    {{ enough }} türde yeterli sayıya ulaşıldı. Alanlar kaydedildikçe burada birikir; kalibrasyon için dosyayı indirip analiz motoruna verin
                    (<code>land-cover/field-labels.geojson</code>) ya da geliştiriciye “işaretlemeleri kullan” deyin.
                </p>

                <div v-if="data?.labels.length" class="flex flex-col gap-2">
                    <div class="flex items-center justify-between gap-2">
                        <h4 class="text-sm font-medium">Kaydedilen alanlar</h4>
                        <Button variant="outline" class="min-h-11 md:min-h-9" @click="download"><Download aria-hidden="true" />GeoJSON indir</Button>
                    </div>
                    <ul class="flex flex-col divide-y rounded-lg border">
                        <li v-for="l in data.labels" :key="l.id" class="flex items-center justify-between gap-3 p-3 text-sm">
                            <span>
                                <span class="mr-1.5 inline-block size-2.5 rounded-sm" :style="{ background: colors[l.coverClass] }" />
                                <span class="font-medium">{{ labels[l.coverClass] ?? l.coverClass }}</span> · {{ formatM2(l.areaM2) }} · {{ l.createdAt.slice(0, 10) }}
                                <span v-if="l.note" class="text-muted-foreground"> · {{ l.note }}</span>
                            </span>
                            <Button variant="outline" size="icon" class="size-11 shrink-0 md:size-9" :aria-label="`${labels[l.coverClass] ?? l.coverClass} alanını sil`" @click="remove(l.id)"><Trash2 aria-hidden="true" /></Button>
                        </li>
                    </ul>
                </div>
            </template>
        </CardContent>
    </Card>
</template>
