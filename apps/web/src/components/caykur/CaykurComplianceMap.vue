<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Map, Download } from '@lucide/vue';
import { EmptyState, LoadingState } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RemoteEvidenceTimeline } from '@/services/api';
import { api, type ComplianceCertainty, type ComplianceMapCollection } from '@/services/api';
import { CERTAINTIES, CERTAINTY_META, downloadComplianceMap } from '@/services/caykur/complianceMap';
import { formatNumber } from '@/services/caykur';

const props = defineProps<{ areaId: string }>();
const emit = defineEmits<{ select: [block: string, parcel: string] }>();
const container = ref<HTMLDivElement | null>(null);
const data = shallowRef<ComplianceMapCollection | null>(null);
const loading = ref(false);
const error = ref('');
const visible = ref<ComplianceCertainty[]>([...CERTAINTIES]);
const timeline = shallowRef<RemoteEvidenceTimeline | null>(null);
const sceneDate = ref('none');
const droneOnly = ref(false);
const imageryError = ref('');
let imageLayer: L.ImageOverlay | null = null;
const droneKeys = computed(() => new Set(timeline.value?.drone?.parcelKeys ?? []));
const scene = computed(() => timeline.value?.imagery?.items.find((s) => s.date === sceneDate.value));
let map: L.Map | null = null;
let layer: L.GeoJSON | null = null;
let observer: ResizeObserver | null = null;
let requestId = 0;
const counts = computed(() => Object.fromEntries(CERTAINTIES.map((key) => [key, data.value?.features.filter((f) => f.properties.certainty === key).length ?? 0])));
const visibleCount = computed(() => data.value?.features.filter((f) => visible.value.includes(f.properties.certainty) && (!droneOnly.value || droneKeys.value.has(f.properties.key))).length ?? 0);

function dispose(): void {
    observer?.disconnect();
    observer = null;
    map?.remove();
    map = null;
    layer = null;
    imageLayer = null;
}
function showScene(): void {
    imageLayer?.remove();
    imageLayer = null;
    imageryError.value = '';
    const imagery = timeline.value?.imagery;
    if (!map || !imagery || !scene.value) return;
    const b = imagery.bounds;
    const url = imagery.baseUrl + scene.value.file;
    // Only locally published evidence files; no remote imagery requests from the timeline.
    if (!url.startsWith('/inventory-imagery/') || url.includes('..')) return;
    const overlay = L.imageOverlay(url, [[b.south, b.west], [b.north, b.east]], { opacity: 1, interactive: false });
    imageLayer = overlay;
    overlay.on('error', () => { if (imageLayer === overlay) imageryError.value = 'Bu tarihin görüntüsü diskte bulunamadı; başka tarih seçin.'; });
    overlay.addTo(map);
}
function draw(): void {
    if (!map || !data.value) return;
    layer?.remove();
    layer = L.geoJSON(data.value, {
        filter: (feature) => visible.value.includes(feature.properties.certainty) && (!droneOnly.value || droneKeys.value.has(feature.properties.key)),
        style: (feature) => ({ color: CERTAINTY_META[(feature?.properties.certainty ?? 'undecidable') as ComplianceCertainty].color, weight: droneKeys.value.has(feature?.properties.key) ? 3 : 1, dashArray: droneKeys.value.has(feature?.properties.key) ? undefined : '4 4', fillOpacity: scene.value ? 0.06 : 0.25 }),
        onEachFeature: (feature, polygon) => {
            const p = feature.properties;
            // Use textContent: deed descriptions are data, never tooltip HTML.
            const tooltip = document.createElement('span');
            tooltip.textContent = `${p.block}/${p.parcel} · ${CERTAINTY_META[p.certainty as ComplianceCertainty].label}`;
            polygon.bindTooltip(tooltip, { sticky: true });
            polygon.on('click', () => emit('select', p.block, p.parcel));
        },
    }).addTo(map);
}
function fit(): void {
    if (!map || !data.value?.features.length) return;
    const bounds = L.geoJSON(data.value).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 18, animate: false });
}
async function load(): Promise<void> {
    const current = ++requestId;
    dispose();
    data.value = null;
    error.value = '';
    loading.value = true;
    timeline.value = null;
    sceneDate.value = 'none';
    droneOnly.value = false;
    const [result, evidence] = await Promise.all([api.getComplianceMap(props.areaId), api.getRemoteEvidenceTimeline(props.areaId)]);
    if (current !== requestId) return;
    loading.value = false;
    if (!result.data) {
        error.value = result.error?.message ?? 'Ruhsat haritası alınamadı.';
        return;
    }
    data.value = result.data;
    timeline.value = evidence.data ?? null;
    if (!evidence.data) imageryError.value = 'Zaman serisi alınamadı. Haritayı yeniden yükleyin.';
    visible.value = [...CERTAINTIES];
    await nextTick();
    if (current !== requestId || !container.value || !data.value.features.length) return;
    map = L.map(container.value, { zoomControl: false, scrollWheelZoom: false });
    // Offline-first: the existing local scenes supply the basemap, without fetching external tiles.
    map.setMaxZoom(21);
    if (timeline.value?.imagery?.items.length) sceneDate.value = timeline.value.imagery.items[0].date;
    L.control.zoom({ position: 'topright' }).addTo(map);
    draw();
    fit();
    showScene();
    observer = new ResizeObserver(() => map?.invalidateSize({ animate: false }));
    observer.observe(container.value);
}
watch(visible, draw, { deep: true });
watch(droneOnly, draw);
watch(sceneDate, () => { showScene(); draw(); });
watch(() => props.areaId, () => void load(), { immediate: true });
onBeforeUnmount(() => { requestId++; dispose(); });
</script>

<template>
    <Card class="gap-0 py-0">
        <CardHeader class="gap-3 py-4">
            <CardTitle class="flex flex-wrap items-center gap-2"><Map class="size-5" aria-hidden="true" />Ruhsat haritası <Badge variant="warning">Ön değerlendirme</Badge><Badge v-if="data?.licenceSource === 'demo'" variant="warning">DEMO ruhsat kayıtları</Badge></CardTitle>
            <CardDescription>Renkler bağımsız kaynakların uyumunu gösterir. Yalnız “Kaynaklar uyumlu” grubu değerlendirme için yeterli kaynak uyumuna sahiptir; diğerlerinde karar verilemedi. Hiçbir sonuç idari karar veya doğruluk garantisi değildir.</CardDescription>
            <div class="flex flex-wrap gap-2">
                <Button variant="outline" class="min-h-11" :disabled="!data?.features.length" @click="data && downloadComplianceMap(data, 'geojson')"><Download aria-hidden="true" />GeoJSON indir</Button>
                <Button variant="outline" class="min-h-11" :disabled="!data?.features.length" @click="data && downloadComplianceMap(data, 'kml')"><Download aria-hidden="true" />KML indir</Button>
                <Button variant="outline" class="min-h-11" :disabled="!data?.features.length" @click="fit">Tüm parsellere git</Button>
            </div>
        </CardHeader>
        <CardContent class="space-y-3 pb-4">
            <LoadingState v-if="loading" text="Ruhsat haritası yükleniyor…" />
            <div v-else-if="error" role="alert" class="space-y-2 text-sm"><p>{{ error }}</p><Button variant="outline" class="min-h-11" @click="load">Yeniden dene</Button></div>
            <EmptyState v-else-if="!data?.features.length" :icon="Map" title="Haritalanacak parsel yok" description="Diskten aktarılan uygunluk raporu ve kadastro geometrileri bu mahalle için bulunamadı." />
            <template v-else>
                <div class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                    <div class="space-y-2">
                        <Label for="remote-scene">Kayıtlı uydu görüntüsü · Sentinel-2, 10 m</Label>
                        <Select v-model="sceneDate"><SelectTrigger id="remote-scene" class="min-h-11 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Yalnız parsel sınırları</SelectItem><SelectItem v-for="item in timeline?.imagery?.items ?? []" :key="item.date" :value="item.date">{{ item.date }}</SelectItem></SelectContent></Select>
                        <div class="flex gap-2"><Button variant="outline" class="min-h-11" :disabled="!scene || (timeline?.imagery?.items.findIndex(s => s.date === sceneDate) ?? 0) <= 0" @click="sceneDate = timeline!.imagery!.items[timeline!.imagery!.items.findIndex(s => s.date === sceneDate) - 1].date">Önceki tarih</Button><Button variant="outline" class="min-h-11" :disabled="!scene || (timeline?.imagery?.items.findIndex(s => s.date === sceneDate) ?? 0) >= (timeline?.imagery?.items.length ?? 0) - 1" @click="sceneDate = timeline!.imagery!.items[timeline!.imagery!.items.findIndex(s => s.date === sceneDate) + 1].date">Sonraki tarih</Button></div>
                    </div>
                    <div class="space-y-2 text-sm">
                        <Button variant="outline" class="min-h-11" :aria-pressed="droneOnly" :disabled="!timeline?.drone" @click="droneOnly = !droneOnly">{{ droneOnly ? 'Bütün parselleri göster' : 'Yalnız drone okuması olanlar' }}</Button>
                        <p>Kalın düz sınır: drone okuması var. Kesikli sınır: drone okuması yok. Bu, uçuşun kesin ayak izi değildir.</p>
                        <p v-for="source in timeline?.drone?.sources ?? []" :key="source.title">{{ source.title }} · {{ source.capturedAtNote }}</p>
                    </div>
                </div>
                <p v-if="imageryError" role="alert" class="text-sm text-destructive">{{ imageryError }}</p>
                <p class="text-xs text-muted-foreground">Tarih değişimi kayıtlı görüntüyü değiştirir; ruhsat sınıfları yeniden hesaplanmaz. Aynı uydunun farklı tarihleri bağımsız kaynak sayılmaz. Drone bindirmesi yaklaşık olup alan ölçümü değildir.</p>
                <ToggleGroup v-model="visible" type="multiple" class="flex w-full flex-wrap justify-start gap-2 overflow-visible" aria-label="Haritada gösterilen kesinlik sınıfları">
                    <ToggleGroupItem v-for="key in CERTAINTIES" :key="key" :value="key" class="min-h-11 grow-0 rounded-md border px-3" :title="CERTAINTY_META[key].note">
                        <span class="size-3 shrink-0 rounded-sm" :style="{ backgroundColor: CERTAINTY_META[key].color }" aria-hidden="true" />{{ CERTAINTY_META[key].label }} · {{ formatNumber(counts[key] ?? 0) }}
                    </ToggleGroupItem>
                </ToggleGroup>
                <p class="text-sm text-muted-foreground" aria-live="polite">{{ formatNumber(visibleCount) }} / {{ formatNumber(data.features.length) }} parsel görünür. Sınıfları açıp kapatabilirsiniz; indirmeler tüm parselleri içerir.</p>
                <!-- Isolate Leaflet panes so they never cover the parcel detail sheet. -->
                <div ref="container" class="compliance-map isolate h-[24rem] w-full overflow-hidden rounded-lg border sm:h-[32rem]" role="region" aria-label="Kesinlik sınıflarına göre ruhsat haritası; ayrıntılar aşağıdaki parsel listesinden de açılabilir" />
                <p v-if="!visibleCount" class="text-sm">Görünür parsel yok. En az bir dolu sınıfı açın.</p>
                <p class="text-xs text-muted-foreground">{{ data.notice }} Görüntü altlığı analiz kanıtı değildir. Rapor: {{ new Date(data.generatedAt).toLocaleDateString('tr-TR') }}.</p>
            </template>
        </CardContent>
    </Card>
</template>

<style scoped>
.compliance-map :deep(.leaflet-control-zoom a) { width: 44px; height: 44px; line-height: 44px; }
</style>
