<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '@/services/api';
import { NDVI_META, NDVI_STATUSES, type NdviMap, type NdviStatus } from '@/services/caykur/ndviAnalysis';
import { LoadingState } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const props = defineProps<{ areaId: string }>();
const emit = defineEmits<{ select: [block: string, parcel: string] }>();
const opened = ref(false);
const data = shallowRef<NdviMap | null>(null);
const loading = ref(false);
const error = ref('');
const year = ref('');
const visible = ref<NdviStatus[]>([...NDVI_STATUSES]);
const search = ref('');
const selectedKey = ref('');
const container = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
let layer: L.GeoJSON | null = null;
let observer: ResizeObserver | null = null;
let requestId = 0;
const features = computed(() => data.value?.features.filter(f => visible.value.includes(f.properties.status) && `${f.properties.block}/${f.properties.parcel}`.includes(search.value.trim())) ?? []);
const selected = computed(() => data.value?.features.find(f => f.properties.key === selectedKey.value)?.properties);
const counts = computed(() => Object.fromEntries(NDVI_STATUSES.map(s => [s, data.value?.features.filter(f => f.properties.status === s).length ?? 0])));
const fmt = (n: number | null) => n === null ? 'Gözlem yok' : n.toFixed(3);
function dispose(): void { observer?.disconnect(); observer = null; map?.remove(); map = null; layer = null; }
function choose(key: unknown): void { if (typeof key === 'string') { selectedKey.value = key; draw(); } }
function draw(): void {
    if (!map || !data.value) return;
    layer?.remove();
    const collection: NdviMap = { ...data.value, features: features.value };
    layer = L.geoJSON(collection, {
        style: f => ({ color: NDVI_META[f?.properties.status as NdviStatus].color, weight: f?.properties.key === selectedKey.value ? 4 : 1.5, fillOpacity: 0.3 }),
        onEachFeature: (f, polygon) => {
            const p = f.properties;
            const text = document.createElement('span'); text.textContent = `${p.block}/${p.parcel} · ${NDVI_META[p.status as NdviStatus].label}`;
            polygon.bindTooltip(text, { sticky: true });
            polygon.on('click', () => { choose(p.key); emit('select', p.block, p.parcel); });
        },
    }).addTo(map);
}
async function render(): Promise<void> {
    await nextTick();
    if (!opened.value || !container.value || !data.value?.features.length) return;
    dispose();
    map = L.map(container.value, { zoomControl: false, scrollWheelZoom: false, maxZoom: 21 });
    L.control.zoom({ position: 'topright' }).addTo(map);
    const bounds = L.geoJSON(data.value).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [16, 16], maxZoom: 18, animate: false });
    draw();
    observer = new ResizeObserver(() => map?.invalidateSize({ animate: false })); observer.observe(container.value);
}
async function load(requestedYear?: number): Promise<void> {
    const current = ++requestId; dispose(); loading.value = true; error.value = '';
    const result = await api.getNdviAnalysisMap(props.areaId, requestedYear);
    if (current !== requestId) return;
    loading.value = false;
    if (!result.data) { error.value = result.error?.message ?? 'NDVI analizi alınamadı.'; return; }
    data.value = result.data; year.value = String(result.data.year);
    await render();
}
function toggle(): void { opened.value = !opened.value; if (!opened.value) { requestId++; loading.value = false; dispose(); } else void load(year.value ? Number(year.value) : undefined); }
function changeYear(value: unknown): void { if (typeof value === 'string') { year.value = value; void load(Number(value)); } }
watch([visible, search], draw, { deep: true });
watch(() => props.areaId, () => { requestId++; dispose(); data.value = null; year.value = ''; selectedKey.value = ''; search.value = ''; if (opened.value) void load(); });
onBeforeUnmount(() => { requestId++; dispose(); });
</script>

<template>
    <Card class="gap-0 py-0">
        <CardHeader class="space-y-2 py-4">
            <CardTitle class="flex flex-wrap gap-2">Uydu zaman analizi <Badge variant="outline">Drone gerektirmez</Badge><Badge variant="warning">Ön değerlendirme</Badge><Badge v-if="data?.licenceSource === 'demo'" variant="warning">DEMO ruhsat kayıtları</Badge></CardTitle>
            <CardDescription>Parselin NDVI değerlerini geçmiş yılların aynı aylarıyla karşılaştırır. Çay varlığı, ruhsat ihlali veya kesin alan ölçümü değildir; mevcut uygunluk sınıflarını değiştirmez.</CardDescription>
            <Button variant="outline" class="min-h-11 w-fit" :aria-expanded="opened" @click="toggle">{{ opened ? 'Uydu analizini kapat' : 'Uydu analizini aç' }}</Button>
        </CardHeader>
        <CardContent v-if="opened" class="space-y-4 pb-4">
            <LoadingState v-if="loading" text="Kayıtlı NDVI serileri karşılaştırılıyor…" />
            <div v-else-if="error" role="alert"><p>{{ error }}</p><Button variant="outline" class="min-h-11" @click="load(year ? Number(year) : undefined)">Yeniden dene</Button></div>
            <template v-else-if="data">
                <p class="text-sm">{{ data.notice }}</p>
                <p v-if="data.sourceGeneratedAt" class="text-xs text-muted-foreground">Kaynak seri paketinin hazırlanma tarihi: {{ new Date(data.sourceGeneratedAt).toLocaleDateString('tr-TR') }}. Canlı uydu verisi değildir.</p>
                <p class="text-xs text-muted-foreground">Nisan–ekim arşivi. Kış ayları ve eksik gözlemler doldurulmaz. Aylık temiz görüntü sayısı arşivde yoktur; gözlem bulunan ay sayısı kalite veya doğruluk yüzdesi değildir. Seriler seçilmiş çay adayı parselleri kapsar; seri yokluğu bitki örtüsü yokluğu değildir.</p>
                <div class="grid gap-3 sm:grid-cols-2">
                    <div class="space-y-2"><Label for="ndvi-year">Analiz yılı</Label><Select :model-value="year" @update:model-value="changeYear"><SelectTrigger id="ndvi-year" class="min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="y in data.years" :key="y" :value="String(y)">{{ y }}</SelectItem></SelectContent></Select></div>
                    <div class="space-y-2"><Label for="ndvi-search">Ada/parsel ara</Label><Input id="ndvi-search" v-model="search" class="min-h-11" placeholder="106/1" /></div>
                </div>
                <ToggleGroup v-model="visible" type="multiple" class="flex flex-wrap justify-start gap-2 overflow-visible" aria-label="NDVI değişim sınıfları"><ToggleGroupItem v-for="status in NDVI_STATUSES" :key="status" :value="status" class="min-h-11 grow-0 rounded-md border"><span class="size-3 rounded-sm" :style="{ backgroundColor: NDVI_META[status].color }" aria-hidden="true" />{{ NDVI_META[status].label }} · {{ counts[status] }}</ToggleGroupItem></ToggleGroup>
                <p class="text-sm" aria-live="polite">{{ features.length }} / {{ data.features.length }} parsel görünür. Harita renkleri seçilen yılın NDVI taramasıdır.</p>
                <div v-if="data.features.length" ref="container" class="ndvi-map isolate h-[24rem] overflow-hidden rounded-lg border sm:h-[32rem]" role="region" aria-label="NDVI değişim haritası; klavye için aşağıdaki parsel seçimini kullanın" />
                <p v-if="!features.length" class="text-sm">Bu seçimde parsel yok. Aramayı veya sınıf filtrelerini değiştirebilirsiniz.</p>
                <div class="space-y-2"><Label for="ndvi-parcel">Parselin NDVI kanıtını incele</Label><Select :model-value="selectedKey || undefined" @update:model-value="choose"><SelectTrigger id="ndvi-parcel" class="min-h-11"><SelectValue placeholder="Parsel seçin" /></SelectTrigger><SelectContent><SelectItem v-for="f in features" :key="f.properties.key" :value="f.properties.key">{{ f.properties.block }}/{{ f.properties.parcel }} · {{ NDVI_META[f.properties.status].label }}</SelectItem></SelectContent></Select></div>
                <section v-if="selected" class="space-y-3 rounded-lg border p-3" aria-label="NDVI karşılaştırma kanıtı">
                    <h3 class="font-medium">{{ selected.block }}/{{ selected.parcel }} · {{ NDVI_META[selected.status].label }}</h3>
                    <p class="text-sm">{{ data.year }} · {{ selected.observedMonths }} gözlem bulunan ay · {{ selected.comparableMonths }} karşılaştırılabilir ay · {{ selected.fullPixels }} tam uydu pikseli. Son kayıtlı ay: {{ selected.months.filter(m => m.value !== null).slice(-1)[0]?.month ?? 'yok' }}.</p>
                    <p v-if="selected.status === 'insufficient'" class="text-sm text-warning">Seri, geçmiş referans veya parselin piksel desteği yetersiz. Bu parsel için sonuç çıkarılmadı.</p>
                    <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><div v-for="m in selected.months" :key="m.month" class="space-y-1 rounded border p-3 text-sm"><strong>{{ m.month }}. ay</strong><p>NDVI: {{ fmt(m.value) }}</p><p>Geçmiş aynı ay: {{ fmt(m.baseline) }}</p><p>Parsel farkı: {{ fmt(m.delta) }}</p><p>Diğer kayıtlı parsellerin ortanca farkı: {{ fmt(m.peerDelta) }}</p></div></div>
                    <p v-if="!selected.months.length" class="text-sm">Bu parselde aylık NDVI serisi kayıtlı değil.</p>
                    <Button variant="outline" class="min-h-11" @click="emit('select', selected.block, selected.parcel)">Ruhsat ayrıntısını ve zaman grafiğini aç</Button>
                </section>
                <details class="text-sm"><summary class="min-h-11 cursor-pointer py-3">Yöntem ve sınırlar</summary><p>Önceki {{ data.rules.baselineYears }} yılın aynı aylarından en az {{ data.rules.minBaselineYears }} gözlemin ortancası referanstır. En az {{ data.rules.minPixels }} tam piksel ve {{ data.rules.minMonths }} karşılaştırılabilir ay gerekir. NDVI farkının en az {{ data.rules.drop }} düşmesi iki ardışık takvim ayında görülürse düşüş izlenir; ardından iki ardışık ay eşik üstüne çıkarsa toparlanma gösterilir. Tekil düşüş inceleme olarak ayrılır. Eksik aylar ardışıklığı keser. Eşikler kalibre edilmemiş tarama tercihleridir; budama, gölge ve görüntü koşulları ayrıştırılmış değildir. Mahalle karşılaştırması en az {{ data.rules.minPeers }} diğer yeterli piksel desteği olan parselden gelir ve sınıfı değiştirmez. Belirgin düşüş görülmemesi ruhsatın uygun olduğu anlamına gelmez. Aynı uydunun tekrarları bağımsız kaynak sayılmaz.</p></details>
            </template>
        </CardContent>
    </Card>
</template>

<style scoped>
.ndvi-map :deep(.leaflet-control-zoom a) { width: 44px; height: 44px; line-height: 44px; }
</style>
