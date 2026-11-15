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
let map: L.Map | null = null;
let layer: L.GeoJSON | null = null;
let observer: ResizeObserver | null = null;
let requestId = 0;
const counts = computed(() => Object.fromEntries(CERTAINTIES.map((key) => [key, data.value?.features.filter((f) => f.properties.certainty === key).length ?? 0])));
const visibleCount = computed(() => visible.value.reduce((total, key) => total + (counts.value[key] ?? 0), 0));

function dispose(): void {
    observer?.disconnect();
    observer = null;
    map?.remove();
    map = null;
    layer = null;
}
function draw(): void {
    if (!map || !data.value) return;
    layer?.remove();
    layer = L.geoJSON(data.value, {
        filter: (feature) => visible.value.includes(feature.properties.certainty),
        style: (feature) => ({ color: CERTAINTY_META[(feature?.properties.certainty ?? 'undecidable') as ComplianceCertainty].color, weight: 2, fillOpacity: 0.25 }),
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
    const result = await api.getComplianceMap(props.areaId);
    if (current !== requestId) return;
    loading.value = false;
    if (!result.data) {
        error.value = result.error?.message ?? 'Ruhsat haritası alınamadı.';
        return;
    }
    data.value = result.data;
    visible.value = [...CERTAINTIES];
    await nextTick();
    if (current !== requestId || !container.value || !data.value.features.length) return;
    map = L.map(container.value, { zoomControl: false, scrollWheelZoom: false });
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 21, maxNativeZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: 'Google · Uydu altlığı' }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    draw();
    fit();
    observer = new ResizeObserver(() => map?.invalidateSize({ animate: false }));
    observer.observe(container.value);
}
watch(visible, draw, { deep: true });
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
