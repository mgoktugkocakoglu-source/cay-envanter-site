<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { api, type ComplianceMapCollection, type RemoteTerrain } from '@/services/api';
import { CERTAINTIES, CERTAINTY_META } from '@/services/caykur/complianceMap';
import { intersectsTerrainBounds } from '@/services/caykur/terrainGeometry';
import { LoadingState } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
const TerrainView = defineAsyncComponent(() => import('@/components/caykur/CaykurLicenceTerrain.vue'));
const props = defineProps<{ areaId: string }>();
const emit = defineEmits<{ select: [block: string, parcel: string] }>();
const terrain = shallowRef<RemoteTerrain | null>(null);
const map = shallowRef<ComplianceMapCollection | null>(null);
const opened = ref(false);
const loading = ref(false);
const error = ref('');
const visible = ref([...CERTAINTIES]);
const selectedKey = ref<string | null>(null);
const search = ref('');
let requestId = 0;
const covered = computed(() => map.value?.features.filter((f) => terrain.value && intersectsTerrainBounds(f.geometry, terrain.value.bounds)) ?? []);
const filtered = computed(() => covered.value.filter((f) => visible.value.includes(f.properties.certainty)));
const choices = computed(() => filtered.value.filter((f) => `${f.properties.block}/${f.properties.parcel}`.includes(search.value.trim())));
const collection = computed(() => map.value ? { ...map.value, features: filtered.value } : null);
async function load(): Promise<void> {
    const current = ++requestId; loading.value = true; error.value = '';
    const [surface, parcels] = await Promise.all([api.getRemoteTerrain(props.areaId), api.getComplianceMap(props.areaId)]);
    if (current !== requestId) return;
    loading.value = false;
    if (surface.error || !parcels.data) { error.value = surface.error?.message ?? parcels.error?.message ?? '3B verileri alınamadı'; return; }
    terrain.value = surface.data ?? null; map.value = parcels.data;
}
function select(block: string, parcel: string): void {
    selectedKey.value = covered.value.find((f) => f.properties.block === block && f.properties.parcel === parcel)?.properties.key ?? null;
    emit('select', block, parcel);
}
function choose(value: unknown): void {
    const p = filtered.value.find((f) => f.properties.key === value)?.properties;
    if (p) select(p.block, p.parcel);
}
function toggle(): void { opened.value = !opened.value; if (opened.value && !map.value) void load(); }
watch(() => props.areaId, () => { requestId++; map.value = null; terrain.value = null; selectedKey.value = null; search.value = ''; visible.value = [...CERTAINTIES]; if (opened.value) void load(); });
onBeforeUnmount(() => requestId++);
</script>

<template>
    <Card class="gap-0 py-0">
        <CardHeader class="space-y-2 py-4">
            <CardTitle class="flex flex-wrap gap-2">3B ruhsat incelemesi <Badge variant="warning">Yaklaşık yüzey</Badge><Badge variant="outline">İdari karar değildir</Badge><Badge v-if="map?.licenceSource === 'demo'" variant="warning">DEMO ruhsat kayıtları</Badge></CardTitle>
            <CardDescription>Parsel sınırlarını kaynak uyumuna göre renklendirir. Nötr yüzey, mevcut videodan hesaplanan göreli yüksekliklerdir; fotoğraf veya hassas ölçüm modeli değildir. Drone kareleri parsel seçildiğinde ayrı kanıt olarak açılır.</CardDescription>
            <Button variant="outline" class="min-h-11 w-fit" :aria-expanded="opened" @click="toggle">{{ opened ? '3B incelemeyi kapat' : '3B incelemeyi aç' }}</Button>
        </CardHeader>
        <CardContent v-if="opened" class="space-y-3 pb-4">
            <LoadingState v-if="loading" text="Yerel yüzey ve ruhsat parselleri yükleniyor…" />
            <div v-else-if="error" role="alert"><p>{{ error }}</p><Button variant="outline" class="min-h-11" @click="load">Yeniden dene</Button></div>
            <p v-else-if="!terrain || !collection" class="text-sm text-muted-foreground">Bu mahalle için kayıtlı 3B yükseklik modeli yok. Yüzey uydurulmadı; 2B harita ve kanıt panelini kullanabilirsiniz.</p>
            <template v-else>
                <p class="text-sm">{{ terrain.capturedAtNote }} {{ terrain.note }} Referans eşleşme farkı: {{ terrain.georefRmsM }} m RMS; en büyük {{ terrain.georefMaxResidualM }} m. Bu değerler bağımsız ölçüm doğruluğu değildir.</p>
                <ToggleGroup v-model="visible" type="multiple" class="flex w-full flex-wrap justify-start gap-2 overflow-visible" aria-label="3B kesinlik sınıfları"><ToggleGroupItem v-for="key in CERTAINTIES" :key="key" :value="key" class="min-h-11 grow-0 rounded-md border"><span class="size-3 rounded-sm" :style="{ backgroundColor: CERTAINTY_META[key].color }" aria-hidden="true" />{{ CERTAINTY_META[key].label }}</ToggleGroupItem></ToggleGroup>
                <p class="text-xs text-muted-foreground">{{ filtered.length }} / {{ covered.length }} parselin sınır kutusu model alanıyla kesişiyor. Model alanı dışında kalan parsel bölümleri gösterilmez; yüzeyin sınırı drone tarafından doğrulanmış çay alanı değildir.</p>
                <TerrainView :key="areaId" :terrain="terrain" :parcels="collection" :selected-key="selectedKey" @select="select" />
                <div class="grid gap-3 sm:grid-cols-2">
                    <div class="space-y-2"><Label for="terrain-search">Ada/parsel ara</Label><Input id="terrain-search" v-model="search" class="min-h-11" placeholder="106/1" /></div>
                    <div class="space-y-2"><Label for="terrain-parcel">Klavye ile parsel kanıtını aç</Label><Select :model-value="selectedKey ?? undefined" @update:model-value="choose"><SelectTrigger id="terrain-parcel" class="min-h-11"><SelectValue placeholder="Parsel seçin" /></SelectTrigger><SelectContent><SelectItem v-for="f in choices" :key="f.properties.key" :value="f.properties.key">{{ f.properties.block }}/{{ f.properties.parcel }} · {{ CERTAINTY_META[f.properties.certainty].label }}</SelectItem></SelectContent></Select></div>
                </div>
                <p v-if="!choices.length" class="text-sm">Seçilen sınıf veya aramaya uyan parsel yok.</p>
            </template>
        </CardContent>
    </Card>
</template>
