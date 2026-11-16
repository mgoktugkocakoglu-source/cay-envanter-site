<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '@/services/api';
import type { MappingPlan } from '@/services/caykur/remotePlanning';
import { NDVI_META, type NdviMap } from '@/services/caykur/ndviAnalysis';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/shared';
const props = defineProps<{ areaId: string; mode: 'mapping' | 'changes' | 'report' }>();
const plan = shallowRef<MappingPlan | null>(null);
const timeline = shallowRef<NdviMap | null>(null);
const loading = ref(false); const error = ref(''); const year = ref(''); const search = ref(''); const scope = ref('Trabzon / Of'); const selected = ref('');
const container = ref<HTMLDivElement | null>(null); let map: L.Map | null = null; let sequence = 0;
const scopes = computed(() => [...new Set(['Trabzon / Of', 'Rize', ...(plan.value?.data.map(r => `${r.province} / ${r.district}`) ?? [])])]);
const regions = computed(() => plan.value?.data.filter(r => (scope.value === 'Rize' ? r.province === 'Rize' : `${r.province} / ${r.district}` === scope.value)) ?? []);
const rows = computed(() => timeline.value?.features.filter(f => `${f.properties.block}/${f.properties.parcel}`.includes(search.value) && (props.mode !== 'changes' || f.properties.status !== 'stable')) ?? []);
const detail = computed(() => timeline.value?.features.find(f => f.properties.key === selected.value));
const blocks = computed(() => regions.value.flatMap(r => r.blocks.map(b => ({ ...b, neighborhood: r.neighborhood }))).sort((a,b) => b.density-a.density || b.teaM2-a.teaM2));
const collection = computed<GeoJSON.FeatureCollection>(() => props.mode === 'mapping' ? { type: 'FeatureCollection', features: blocks.value.map((r, i) => ({ type: 'Feature', geometry: r.geometry, properties: { ...r, geometry: undefined, priority: i + 1, notice: plan.value?.notice } })) } : { type: 'FeatureCollection', features: rows.value });
function exportData() {
 const blob = new Blob([JSON.stringify({ ...collection.value, notice: props.mode === 'mapping' ? plan.value?.notice : timeline.value?.notice })], { type: 'application/geo+json' });
 const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${props.mode}-${year.value || 'latest'}.geojson`; a.click(); URL.revokeObjectURL(url);
}
async function draw() {
 await nextTick(); map?.remove(); map = null;
 if (!container.value || !collection.value.features.length) return;
 map = L.map(container.value, { attributionControl: false });
 const color = getComputedStyle(container.value).color;
 const layer = L.geoJSON(collection.value, { style: { color, weight: 1, fillOpacity: .2 }, onEachFeature: (f, l) => { l.on('click', () => { selected.value = String(f.properties?.key ?? ''); }); } }).addTo(map);
 map.fitBounds(layer.getBounds(), { padding: [16, 16] });
}
async function load() {
 const id = ++sequence; loading.value = true; error.value = ''; selected.value = ''; timeline.value = null;
 try {
  if (props.mode === 'mapping') { const result = await api.getRemoteMappingPlan(); if (!result.data) throw new Error('No data'); if (id === sequence) plan.value = result.data; }
  else { const result = await api.getRemoteTimeline(props.areaId, year.value ? Number(year.value) : undefined); if (!result.data) throw new Error('No data'); if (id === sequence) timeline.value = result.data; }
 } catch { if (id === sequence) error.value = 'Veri yüklenemedi. Bu mahallede ilgili analiz bulunmayabilir.'; }
 finally { if (id === sequence) { loading.value = false; await draw(); } }
}
watch(() => [props.areaId, props.mode], () => { year.value = ''; search.value = ''; void load(); }, { immediate: true });
watch([scope, search], () => { void draw(); });
onBeforeUnmount(() => { sequence++; map?.remove(); });
</script>
<template>
 <Card>
  <CardHeader><CardTitle>{{ mode === 'mapping' ? 'Bölgesel haritalama planı' : mode === 'changes' ? 'Değişim takibi' : 'Sezonluk parsel karnesi' }}</CardTitle><CardDescription>Yerel arşiv · Ön değerlendirme · İdari karar değildir.</CardDescription></CardHeader>
  <CardContent class="space-y-4">
   <div v-if="mode === 'mapping'" class="flex flex-wrap gap-2"><Button v-for="s in scopes" :key="s" class="min-h-11" :variant="scope === s ? 'default' : 'outline'" @click="scope = s">{{ s }}</Button></div>
   <div v-else class="flex flex-wrap items-center gap-2"><label>Yıl <select v-model="year" class="h-11 rounded border bg-background px-3" @change="load"><option value="">Son arşiv yılı</option><option v-for="y in timeline?.years" :key="y" :value="String(y)">{{ y }}</option></select></label><Input v-model="search" class="h-11 max-w-xs" aria-label="Ada parsel ara" placeholder="Ada/parsel ara" /></div>
   <LoadingState v-if="loading" text="Yerel veriler okunuyor" />
   <p v-else-if="error" role="alert">{{ error }} <Button variant="outline" @click="load">Tekrar dene</Button></p>
   <template v-else>
    <p class="text-sm text-muted-foreground">{{ mode === 'mapping' ? plan?.notice : timeline?.notice }}</p>
    <p v-if="mode === 'mapping'" class="text-sm">{{ regions.length }} mahalle · {{ (regions.reduce((s,r) => s+r.teaM2,0)/10000).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) }} ha çay adayı. Sıra: mahalle sınırı içindeki çay yoğunluğu, ardından çay alanı. Bu sıra ulaşım veya uçuş süresi optimizasyonu değildir.</p>
    <Button variant="outline" class="min-h-11" :disabled="!collection.features.length" @click="exportData">Görünen kapsamı GeoJSON indir</Button>
    <div v-if="collection.features.length" ref="container" class="isolate relative h-80 rounded-lg border bg-muted" aria-label="Yerel geometriler haritası" />
    <p v-else class="rounded-lg border p-6">Bu kapsamda veri yok. Eksik bölgeler sıfır çay alanı olarak kabul edilmez.</p>
    <div v-if="mode === 'mapping'" class="grid gap-3 md:grid-cols-2"><div v-for="(r,i) in regions" :key="r.id" class="rounded-lg border p-4"><strong>{{ i+1 }}. {{ r.neighborhood }}</strong><p>{{ (r.teaM2/10000).toFixed(1) }} ha çay adayı · yoğunluk {{ r.density === null ? 'bilinmiyor' : (r.density*100).toFixed(1)+'%' }}</p><p class="text-xs text-muted-foreground">Kayıt güncelleme: {{ r.sourceUpdatedAt.slice(0,10) }} · görüntü tarihi değildir.</p></div></div>
    <template v-else>
     <p class="text-sm text-muted-foreground">{{ rows.length }} parsel. {{ mode === 'changes' ? 'Düşüş, toparlanma, inceleme ve veri eksikleri gösterilir. Aynı parsel/yıl tek satırdır; otomatik bildirim gönderilmez.' : 'Takvim yılı gözlemleri gösterilir; ürün rekoltesi veya üretici başarı puanı değildir.' }}</p>
     <div class="grid gap-2 md:grid-cols-3"><Button v-for="f in rows" :key="f.properties.key" variant="outline" class="h-auto min-h-11 whitespace-normal p-3 text-left" @click="selected = f.properties.key">{{ f.properties.block }}/{{ f.properties.parcel }} · {{ NDVI_META[f.properties.status].label }}</Button></div>
     <div v-if="detail" class="space-y-3 rounded-lg border p-4"><h3 class="font-semibold">{{ detail.properties.block }}/{{ detail.properties.parcel }} · {{ timeline?.year }}</h3><p>{{ detail.properties.observedMonths }} gözlenen ay · {{ detail.properties.comparableMonths }} karşılaştırılabilir ay</p><div class="overflow-x-auto"><table class="w-full text-left text-sm"><thead><tr><th>Ay</th><th>NDVI</th><th>Geçmiş referans</th><th>Fark</th></tr></thead><tbody><tr v-for="m in detail.properties.months" :key="m.month" class="border-t"><td class="py-2">{{ m.month }}</td><td>{{ m.value?.toFixed(3) ?? 'Veri yok' }}</td><td>{{ m.baseline?.toFixed(3) ?? 'Veri yok' }}</td><td>{{ m.delta?.toFixed(3) ?? 'Veri yok' }}</td></tr></tbody></table></div><p class="text-xs text-muted-foreground">NDVI değişimin nedenini kanıtlamaz. Eksik aylar doldurulmaz. Kaynak: mevcut uydu arşivi.</p></div>
    </template>
   </template>
  </CardContent>
 </Card>
</template>
