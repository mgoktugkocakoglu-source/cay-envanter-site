<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ExternalLink, Map as MapIcon } from '@lucide/vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EmptyState, LoadingState, StatCard } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, type RegionAreaRow, type RegionOverview } from '@/services/api';
import { formatHectare, formatShare } from '@/services/caykur/teaInventory';
import { formatNumber } from '@/services/caykur';

const props = defineProps<{ selectedAreaId: string }>();
const emit = defineEmits<{ select: [areaId: string] }>();

const overview = ref<RegionOverview | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);
const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let boundaryLayer: L.GeoJSON | null = null;

const allAreas = computed(() => overview.value?.districts.flatMap((d) => d.areas) ?? []);
const latestSeason = computed(() => {
    const seasons = allAreas.value.map((a) => a.pruning?.season).filter((s): s is string => !!s).sort();
    return seasons.at(-1) ?? null;
});

/** Harvest + module readiness of a neighbourhood, for the status column and the map colour. */
type Stage = 'parcels' | 'boundary' | 'tea' | 'pruning' | 'full';
function stageOf(a: RegionAreaRow): { stage: Stage; label: string; tone: 'muted' | 'info' | 'warning' | 'success' } {
    // A boundary-only library (TKGM harvest not yet started) is judged on free tea patches alone.
    if (a.parcels.total === 0 && a.pruning) return { stage: 'boundary', label: 'Parsel bekliyor · serbest yama', tone: 'warning' };
    if (a.pruning && a.health) return { stage: 'full', label: 'Tüm modüller', tone: 'success' };
    if (a.pruning) return { stage: 'pruning', label: 'Budama taranıyor', tone: 'info' };
    if (a.teaPatchAreaM2 > 0) return { stage: 'tea', label: 'Çay tespiti', tone: 'warning' };
    return { stage: 'parcels', label: 'Parsel toplanıyor', tone: 'muted' };
}

function prunedShare(a: RegionAreaRow): number | null {
    const g = a.pruning?.gardens;
    if (!g || g.total === 0) return null;
    return (g.byClass.pruned + g.byClass.likely) / g.total;
}

function cssVar(name: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function boundaryStyle(a: RegionAreaRow): L.PathOptions {
    const selected = a.id === props.selectedAreaId;
    const share = prunedShare(a);
    const colour = share === null ? cssVar('--muted-foreground', '#94a3b8') : share >= 0.2 ? cssVar('--chart-5', '#22c55e') : share >= 0.08 ? cssVar('--warning', '#f59e0b') : cssVar('--info', '#3b82f6');
    return { color: selected ? cssVar('--background', '#ffffff') : colour, weight: selected ? 3 : 2, fillColor: colour, fillOpacity: share === null ? 0.08 : 0.22, dashArray: share === null ? '6 4' : undefined };
}

function initMap(): void {
    if (map || !mapContainer.value) return;
    map = L.map(mapContainer.value, { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20, maxNativeZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
}

function renderMap(): void {
    initMap();
    if (!map || allAreas.value.length === 0) return;
    boundaryLayer?.remove();
    boundaryLayer = L.geoJSON(
        { type: 'FeatureCollection', features: allAreas.value.map((a) => ({ type: 'Feature', geometry: a.boundary, properties: { id: a.id } })) } as GeoJSON.FeatureCollection,
        {
            style: (feature) => boundaryStyle(allAreas.value.find((a) => a.id === feature?.properties.id) as RegionAreaRow),
            onEachFeature: (feature, layer) => {
                const a = allAreas.value.find((x) => x.id === feature.properties.id);
                if (!a) return;
                const share = prunedShare(a);
                layer.bindTooltip(
                    `<b>${a.district} / ${a.neighborhood}</b><br>${formatNumber(a.parcels.total)} parsel (%${Math.round(a.coveredRatio * 100)}) · ${formatHectare(a.teaPatchAreaM2)} çay` +
                        (a.pruning ? `<br>${a.pruning.season}: ${a.pruning.gardens.byClass.pruned} budandı, ${a.pruning.gardens.byClass.likely} olası${share !== null ? ` (%${Math.round(share * 100)})` : ''}` : '<br>budama taraması henüz yok'),
                    { sticky: true },
                );
                layer.on('click', () => emit('select', a.id));
            },
        },
    ).addTo(map);
    map.fitBounds(boundaryLayer.getBounds(), { padding: [24, 24] });
}

async function load(): Promise<void> {
    isLoading.value = true;
    error.value = null;
    const res = await api.getInventoryOverview();
    if (res.data) overview.value = res.data;
    else error.value = res.error?.message ?? 'Bölge özeti alınamadı';
    isLoading.value = false;
    await nextTick();
    renderMap();
}

watch(() => props.selectedAreaId, () => boundaryLayer?.setStyle((f) => boundaryStyle(allAreas.value.find((a) => a.id === f?.properties.id) as RegionAreaRow)));
onMounted(load);
onBeforeUnmount(() => { map?.remove(); map = null; });
defineExpose({ refresh: load, invalidate: () => map?.invalidateSize() });
</script>

<template>
    <div class="flex flex-col gap-6">
        <LoadingState v-if="isLoading" text="Bölge özeti yükleniyor…" />
        <EmptyState v-else-if="error || !overview" title="Bölge özeti yüklenemedi" :description="error ?? ''">
            <Button variant="outline" class="h-11 md:h-9" @click="load">Tekrar dene</Button>
        </EmptyState>
        <template v-else>
            <Alert variant="info">
                <MapIcon aria-hidden="true" />
                <AlertTitle>Bölge adım adım genişliyor</AlertTitle>
                <AlertDescription>
                    Her mahalle TKGM günlük kotasıyla parsel parsel toplanır; uydu çay tespiti ve budama taraması mahalle sınırının tamamında çalışır, parseli henüz çekilmemiş çaylıklar "serbest yama" olarak izlenir ve parsel gelince sahibine bağlanır. Ruhsat kayıtları demodur.
                </AlertDescription>
            </Alert>

            <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Bölge özeti">
                <StatCard label="Mahalle" :value="formatNumber(overview.totals.areas)" :hint="`${overview.districts.length} ilçe`" />
                <StatCard label="TKGM parseli" :value="formatNumber(overview.totals.parcels)" :hint="`${formatNumber(overview.totals.flagged)} denetim gerektiren`" />
                <StatCard label="Uyduda çay" :value="formatHectare(overview.totals.teaPatchAreaM2)" hint="mahalle sınırları içinde" />
                <StatCard label="Müstahsil / bahçe" :value="`${formatNumber(overview.totals.producers)} / ${formatNumber(overview.totals.gardens)}`" :hint="`${formatNumber(overview.totals.licenses)} demo ruhsat`" />
                <StatCard :label="`Budandı / olası${latestSeason ? ` · ${latestSeason}` : ''}`" :value="`${formatNumber(overview.totals.pruned)} / ${formatNumber(overview.totals.likely)}`" hint="bahçe, çok-sensör karar" />
                <StatCard label="Alım otomatik açık" :value="formatNumber(overview.totals.purchaseOpen)" :hint="`${formatNumber(overview.totals.expert)} eksper kuyruğunda`" />
                <StatCard label="Sağlık şüphesi" :value="formatNumber(overview.totals.healthSuspects)" hint="kimyasal + yaprak kaybı" />
                <StatCard label="Rekolte tahmini" :value="`${formatNumber(Math.round(overview.totals.yieldKg / 1000))} t`" hint="demo verim normu" />
            </section>

            <Card>
                <CardHeader>
                    <CardTitle>Mahalle sınırları</CardTitle>
                    <CardDescription>Renk: son sezonda budanan + olası bahçe payı (yeşil ≥ %20, turuncu ≥ %8, mavi daha az); kesikli gri: budama taraması henüz yok. Tıklayınca mahalle açılır.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div ref="mapContainer" class="h-[360px] w-full overflow-hidden rounded-md border bg-muted md:h-[440px]" role="application" aria-label="Bölge haritası" />
                </CardContent>
            </Card>

            <Card v-for="d in overview.districts" :key="`${d.province}/${d.district}`">
                <CardHeader>
                    <CardTitle>{{ d.province }} / {{ d.district }}</CardTitle>
                    <CardDescription>
                        {{ d.totals.areas }} mahalle · {{ formatNumber(d.totals.parcels) }} parsel · {{ formatHectare(d.totals.teaPatchAreaM2) }} çay · {{ formatNumber(d.totals.producers) }} müstahsil · {{ formatNumber(d.totals.pruned) }} budandı / {{ formatNumber(d.totals.likely) }} olası · {{ formatNumber(d.totals.purchaseOpen) }} alım açık
                    </CardDescription>
                </CardHeader>
                <CardContent class="px-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Mahalle</TableHead>
                                <TableHead class="text-right">Parsel · kapsama</TableHead>
                                <TableHead class="text-right">Uyduda çay</TableHead>
                                <TableHead class="text-right">Müstahsil / bahçe</TableHead>
                                <TableHead>Budama (sezon)</TableHead>
                                <TableHead>Alım kararı</TableHead>
                                <TableHead class="text-right">Sağlık</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead class="w-20"><span class="sr-only">Aç</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow
                                v-for="a in d.areas"
                                :key="a.id"
                                :data-state="a.id === selectedAreaId ? 'selected' : undefined"
                                class="cursor-pointer"
                                @click="emit('select', a.id)"
                            >
                                <TableCell class="font-medium">
                                    {{ a.neighborhood }}
                                    <div v-if="a.model.trainingNeighborhoods && a.model.trainingNeighborhoods.length > 1" class="text-xs font-normal text-muted-foreground">sınıflandırıcı {{ a.model.trainingNeighborhoods.length }} mahalleden eğitildi</div>
                                </TableCell>
                                <TableCell class="text-right tabular-nums">{{ formatNumber(a.parcels.total) }} <span class="text-muted-foreground">· {{ formatShare(a.coveredRatio) }}</span></TableCell>
                                <TableCell class="text-right tabular-nums">{{ formatHectare(a.teaPatchAreaM2) }}</TableCell>
                                <TableCell class="text-right tabular-nums">{{ a.licensing ? `${formatNumber(a.licensing.producers)} / ${formatNumber(a.licensing.gardens)}` : '—' }}</TableCell>
                                <TableCell>
                                    <template v-if="a.pruning">
                                        <div class="flex flex-wrap items-center gap-1">
                                            <Badge variant="success">{{ a.pruning.gardens.byClass.pruned }} budandı</Badge>
                                            <Badge variant="info">{{ a.pruning.gardens.byClass.likely }} olası</Badge>
                                            <Badge variant="muted">{{ a.pruning.gardens.byClass.unclear }} belirsiz</Badge>
                                            <span v-if="a.pruning.unassigned.count" class="text-xs text-muted-foreground">+ {{ a.pruning.unassigned.count }} serbest yama</span>
                                        </div>
                                        <div class="mt-0.5 text-xs text-muted-foreground">{{ a.pruning.season }}{{ a.pruning.calibrated ? '' : ' · kalibre edilmedi' }}</div>
                                    </template>
                                    <span v-else class="text-muted-foreground">—</span>
                                </TableCell>
                                <TableCell>
                                    <div v-if="a.pruning" class="flex flex-wrap items-center gap-1">
                                        <Badge variant="success">{{ a.pruning.producers.byDecision.auto_open }} açık</Badge>
                                        <Badge variant="warning">{{ a.pruning.producers.byDecision.auto_pending + a.pruning.producers.byDecision.auto_short }} bekliyor</Badge>
                                        <Badge variant="danger">{{ a.pruning.producers.byDecision.expert_anomaly }} eksper</Badge>
                                    </div>
                                    <span v-else class="text-muted-foreground">—</span>
                                </TableCell>
                                <TableCell class="text-right tabular-nums">
                                    <template v-if="a.health">{{ a.health.gardens.byAnomaly.chemical_suspect + a.health.gardens.byAnomaly.defoliation }} şüphe <span class="text-muted-foreground">· {{ a.health.gardens.byAnomaly.stress }} stres</span></template>
                                    <span v-else class="text-muted-foreground">—</span>
                                </TableCell>
                                <TableCell><Badge :variant="stageOf(a).tone">{{ stageOf(a).label }}</Badge></TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="sm" class="h-9" @click.stop="emit('select', a.id)">
                                        <ExternalLink aria-hidden="true" />Aç
                                    </Button>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </template>
    </div>
</template>
