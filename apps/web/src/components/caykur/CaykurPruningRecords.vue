<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { ChevronLeft, ChevronRight, Download, Radar, ScanSearch, TriangleAlert } from '@lucide/vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EmptyState, ListToolbar, LoadingState, SearchInput, StatCard } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toneVariant } from '@/components/caykur/tone';
import { useToast } from '@/composables/useToast';
import { api, type InventoryMap, type PruningRecordRow, type PruningRecordSummary, type PruningRegistration } from '@/services/api';
import { PRODUCER_STATUS_META, REGISTRATION_META, REGISTRATION_ORDER, formatM2, formatShare } from '@/services/caykur/teaInventory';
import { formatNumber } from '@/services/caykur';

/**
 * Scan-centred pruning feed: the whole neighbourhood is scanned every ≤ 5 days; every pruning
 * change the satellite sees becomes a record, split by the TKGM parcel (the licence holder's
 * garden), matched to the licence register and written to the producer's 1/7 account without
 * the producer reporting anything. High-confidence records open ÇAYKUR purchase on their own;
 * the rest wait for an expert. Each record shows the two clear scenes that bracket the change.
 */
const props = defineProps<{
    areaId: string;
    mapData: InventoryMap;
}>();

const ALL = 'all';
const PAGE_SIZE = 15;
const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const toast = useToast();

const summary = ref<PruningRecordSummary | null>(null);
const season = ref('');
const isLoading = ref(true);
const error = ref<string | null>(null);
const scanDate = ref<string | typeof ALL>(ALL);
const locality = ref<string | typeof ALL>(ALL);
const registration = ref<PruningRegistration | typeof ALL>(ALL);
const search = ref('');
const page = ref(1);
const rows = ref<PruningRecordRow[]>([]);
const total = ref(0);
const totalPages = ref(1);
const isLoadingRows = ref(false);
const isDownloading = ref(false);

// ── Selected record: before / after scene pair ──
const selected = ref<PruningRecordRow | null>(null);
const beforeContainer = ref<HTMLElement | null>(null);
const afterContainer = ref<HTMLElement | null>(null);
let beforeMap: L.Map | null = null;
let afterMap: L.Map | null = null;

const scenes = computed(() => summary.value?.scenes?.items ?? []);
const scansWithRecords = computed(() => (summary.value?.byScan ?? []).filter((s) => s.records > 0));

function fmtDate(d: string | null | undefined): string {
    if (!d) return '—';
    return `${Number(d.slice(8, 10))} ${MONTHS_TR[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
}
function seasonLabel(s: string | undefined): string {
    if (!s) return '';
    const [a, b] = s.split('-');
    return `${a}–20${b}`;
}
function cssVar(name: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
/** Nearest exported clear scene on or before a date. */
function sceneFor(target: string | null): { date: string; file: string } | null {
    if (!target) return scenes.value[0] ?? null;
    return scenes.value.filter((s) => s.date <= target).at(-1) ?? scenes.value[0] ?? null;
}
const beforeScene = computed(() => (selected.value ? sceneFor(selected.value.lastNoChangeAt) : null));
const afterScene = computed(() => (selected.value ? sceneFor(selected.value.firstChangeAt) : null));

async function loadSummary(): Promise<void> {
    error.value = null;
    const res = await api.getPruningRecordSummary(props.areaId, season.value || undefined);
    if (res.data) {
        summary.value = res.data;
        season.value = res.data.season;
    } else {
        error.value = res.error?.message ?? 'Tarama kayıtları alınamadı';
    }
}

async function loadRows(): Promise<void> {
    if (!season.value) return;
    isLoadingRows.value = true;
    const res = await api.getPruningRecords(props.areaId, {
        page: page.value,
        limit: PAGE_SIZE,
        season: season.value,
        scanDate: scanDate.value === ALL ? undefined : scanDate.value,
        locality: locality.value === ALL ? undefined : locality.value,
        registration: registration.value === ALL ? undefined : registration.value,
        search: search.value.trim() || undefined,
    });
    if (res.data) {
        rows.value = res.data.data;
        total.value = res.data.meta.total;
        totalPages.value = Math.max(1, res.data.meta.totalPages);
    } else {
        toast.error(res.error?.message ?? 'Kayıtlar yüklenemedi');
    }
    isLoadingRows.value = false;
}

async function downloadCsv(): Promise<void> {
    isDownloading.value = true;
    try {
        const { blob, error: message } = await api.downloadPruningRecordsCsv(props.areaId, season.value);
        if (!blob) {
            toast.error(message ?? 'Liste indirilemedi');
            return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `uydu-budama-kayitlari-${season.value}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    } finally {
        isDownloading.value = false;
    }
}

async function select(r: PruningRecordRow): Promise<void> {
    selected.value = r;
    await nextTick();
    renderPair();
}

/** One small map: the dated Sentinel-2 scene at its native 10 m pixels, the garden and the change polygon. */
function renderChip(container: HTMLElement, scene: { date: string; file: string } | null, r: PruningRecordRow, highlight: boolean): L.Map {
    const map = L.map(container, { zoomControl: false, attributionControl: false, scrollWheelZoom: false, dragging: false });
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20, maxNativeZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], opacity: scene ? 0.25 : 1 }).addTo(map);
    const bounds = summary.value?.scenes?.bounds;
    if (scene && bounds) {
        L.imageOverlay(`${summary.value!.scenes!.baseUrl}${scene.file}`, [[bounds.south, bounds.west], [bounds.north, bounds.east]], {
            interactive: false,
            className: 'pixelated',
            alt: `Sentinel-2, ${scene.date}`,
        }).addTo(map);
    }
    L.geoJSON(props.mapData, { style: { color: cssVar('--background', '#ffffff'), weight: 0.8, opacity: 0.6, fill: false }, interactive: false }).addTo(map);
    const event = L.geoJSON({ type: 'Feature', geometry: r.geometry, properties: {} } as GeoJSON.Feature, {
        style: { color: highlight ? cssVar('--destructive', '#b91c1c') : cssVar('--info', '#1e3a8a'), weight: 2.5, fill: highlight, fillColor: cssVar('--destructive', '#b91c1c'), fillOpacity: 0.15, dashArray: highlight ? undefined : '5 4' },
        interactive: false,
    }).addTo(map);
    map.fitBounds(event.getBounds().pad(1.2), { maxZoom: 18 });
    return map;
}

function renderPair(): void {
    beforeMap?.remove();
    afterMap?.remove();
    beforeMap = null;
    afterMap = null;
    const r = selected.value;
    if (!r || !beforeContainer.value || !afterContainer.value) return;
    beforeMap = renderChip(beforeContainer.value, beforeScene.value, r, false);
    afterMap = renderChip(afterContainer.value, afterScene.value, r, true);
}

watch(season, async () => {
    page.value = 1;
    scanDate.value = ALL;
    selected.value = null;
    await loadSummary();
    await loadRows();
});
watch([scanDate, locality, registration], () => {
    page.value = 1;
    void loadRows();
});
watch(page, () => void loadRows());
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        page.value = 1;
        void loadRows();
    }, 300);
});

onMounted(async () => {
    await loadSummary();
    await loadRows();
    isLoading.value = false;
});
onBeforeUnmount(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    beforeMap?.remove();
    afterMap?.remove();
});

function onSeason(v: unknown): void {
    if (typeof v === 'string' && v !== '') season.value = v;
}
function onScan(v: unknown): void {
    scanDate.value = typeof v === 'string' && v !== '' ? v : ALL;
}
function onLocality(v: unknown): void {
    locality.value = typeof v === 'string' && v !== '' ? v : ALL;
}
function onRegistration(v: unknown): void {
    registration.value = typeof v === 'string' && v !== '' ? (v as PruningRegistration | typeof ALL) : ALL;
}
function onRowKey(e: KeyboardEvent, r: PruningRecordRow): void {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        void select(r);
    }
}
</script>

<template>
    <LoadingState v-if="isLoading" text="Tarama kayıtları yükleniyor…" />

    <EmptyState v-else-if="error" title="Tarama kayıtları yüklenemedi" :description="error">
        <Button variant="outline" class="h-11 md:h-9" @click="loadSummary">Tekrar dene</Button>
    </EmptyState>

    <EmptyState
        v-else-if="!summary || !summary.schedule"
        :icon="Radar"
        title="Bu alan için tarama yok"
        description="5 günlük müstahsil taramaları içe aktarıldığında kayıtlar burada görünür."
    />

    <div v-else class="flex flex-col gap-6">
        <Alert variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle class="flex flex-wrap items-center gap-2">
                Kalibre edilmedi
                <Badge variant="warning">Demo müstahsil / ruhsat verisi</Badge>
            </AlertTitle>
            <AlertDescription>
                Akış: mahallenin tamamı her ≤ {{ summary.schedule.everyDays }} günde bir taranır; referans dönemle (ekim–kasım) karşılaştırıldığında kahverengiye dönen,
                komşu çaylıklara göre belirgin NDVI düşüşü gösteren çay alanları budama olayı olarak çizilir. Olay poligonu TKGM parseline (hisseli parselde
                hissedarın bahçesine) bölünür, ruhsat kaydıyla eşleşir ve müstahsilin 1/7 hesabına yazılır — müstahsil hiçbir bildirim yapmaz.
                Çok yüksek güvende kayıt ÇAYKUR alım sistemine <strong>otomatik</strong> düşer; diğerleri eksper onayı bekler. 10 m Sentinel-2'de kahverengi dönüşü
                birkaç piksel olarak görünür; 50 cm görüntü geldiğinde aynı akış parsel içi sınırlarla çalışır.
            </AlertDescription>
        </Alert>

        <div class="flex flex-wrap items-center gap-3">
            <span class="text-sm text-muted-foreground">Budama sezonu</span>
            <ToggleGroup :model-value="season" type="single" aria-label="Budama sezonu" @update:model-value="onSeason">
                <ToggleGroupItem v-for="s in summary.seasons" :key="s" :value="s" class="h-11 px-3 md:h-9">{{ seasonLabel(s) }}</ToggleGroupItem>
            </ToggleGroup>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Budama kaydı" :value="formatNumber(summary.total)" :hint="`${summary.gardens} bahçe · ${summary.producers} müstahsil · ${scansWithRecords.length} taramada`" :icon="ScanSearch" />
            <StatCard label="Budanan alan" :value="formatM2(summary.areaM2)" :hint="`yeni alan ${formatM2(summary.newAreaM2)} (önceki sezonlarla çakışan düşüldü)`" />
            <StatCard label="ÇAYKUR sistemine düşen" :value="formatNumber(summary.byRegistration.auto + summary.byRegistration.expert)" :hint="`${summary.byRegistration.auto} otomatik · ${summary.byRegistration.expert} eksper onayıyla`" />
            <StatCard label="Eksper onayı bekleyen" :value="formatNumber(summary.byRegistration.pending)" :hint="`${summary.byRegistration.no_license} ruhsatsız/eşleşmemiş · ${summary.byRegistration.unattributed} sınırı belirsiz`" />
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Tarama zaman çizelgesi</CardTitle>
                <CardDescription>Her tarama: son {{ summary.schedule.lookbackDays }} günün bulutsuz sahneleri. Bir taramaya tıklayınca o taramada tespit edilen kayıtlar listelenir.</CardDescription>
            </CardHeader>
            <CardContent>
                <div class="-mx-1 overflow-x-auto px-1 pb-1">
                    <ToggleGroup :model-value="scanDate" type="single" aria-label="Tarama tarihi" class="w-max" @update:model-value="onScan">
                        <ToggleGroupItem :value="ALL" class="h-11 px-3 md:h-9">Tümü</ToggleGroupItem>
                        <ToggleGroupItem v-for="s in summary.byScan" :key="s.date" :value="s.date" class="h-11 flex-col gap-0 px-2 md:h-9 md:flex-row md:gap-1" :disabled="!s.newObservation" :title="s.newObservation ? `${s.records} kayıt · ${formatM2(s.areaM2)}` : 'Yeni bulutsuz sahne yok'">
                            <span>{{ fmtDate(s.date) }}</span>
                            <Badge v-if="s.records" :variant="s.records ? 'danger' : 'muted'" class="px-1.5 py-0 text-[10px]">{{ s.records }}</Badge>
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>
            </CardContent>
        </Card>

        <div class="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card>
                <CardHeader>
                    <CardTitle>Otomatik budama kayıtları</CardTitle>
                    <CardDescription>{{ formatNumber(total) }} kayıt · TKGM parseline bölünmüş, ruhsat sahibiyle eşleşmiş</CardDescription>
                    <CardAction>
                        <Button variant="outline" size="sm" class="h-11 md:h-9" :disabled="isDownloading" @click="downloadCsv"><Download aria-hidden="true" />CSV</Button>
                    </CardAction>
                </CardHeader>
                <CardContent class="flex flex-col gap-4">
                    <ListToolbar>
                        <SearchInput v-model="search" placeholder="Müstahsil, ruhsat, ada/parsel, mevki…" />
                        <template #filters>
                            <Select :model-value="locality" @update:model-value="onLocality">
                                <SelectTrigger class="h-11 w-full md:h-9 md:w-44" aria-label="Mevki"><SelectValue placeholder="Mevki" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="ALL">Tüm mevkiler</SelectItem>
                                    <SelectItem v-for="l in summary.localities" :key="l.name" :value="l.name">{{ l.name }} ({{ l.records }})</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select :model-value="registration" @update:model-value="onRegistration">
                                <SelectTrigger class="h-11 w-full md:h-9 md:w-52" aria-label="Kayıt durumu"><SelectValue placeholder="Kayıt durumu" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="ALL">Tüm kayıt durumları</SelectItem>
                                    <SelectItem v-for="k in REGISTRATION_ORDER" :key="k" :value="k">{{ REGISTRATION_META[k].label }} ({{ summary.byRegistration[k] }})</SelectItem>
                                </SelectContent>
                            </Select>
                        </template>
                    </ListToolbar>

                    <LoadingState v-if="isLoadingRows && rows.length === 0" text="Kayıtlar yükleniyor…" />
                    <EmptyState v-else-if="rows.length === 0" :icon="ScanSearch" title="Kayıt yok" description="Bu filtrede budama kaydı bulunmuyor." />
                    <div v-else class="overflow-hidden rounded-lg border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Parsel / bahçe</TableHead>
                                    <TableHead class="hidden md:table-cell">Müstahsil</TableHead>
                                    <TableHead class="text-right">Budama</TableHead>
                                    <TableHead class="hidden lg:table-cell">Gözlem aralığı</TableHead>
                                    <TableHead>ÇAYKUR kaydı</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow
                                    v-for="r in rows"
                                    :key="r.id"
                                    class="cursor-pointer"
                                    :class="selected?.id === r.id ? 'bg-muted/50' : ''"
                                    tabindex="0"
                                    role="button"
                                    :aria-label="`${r.block}/${r.parcel} kaydını aç`"
                                    @click="select(r)"
                                    @keydown="onRowKey($event, r)"
                                >
                                    <TableCell>
                                        <div class="font-medium text-foreground">{{ r.block }}/{{ r.parcel }}<span v-if="r.holderCount > 1" class="font-normal text-muted-foreground"> · hisse {{ r.holderIndex }}/{{ r.holderCount }}</span></div>
                                        <div class="text-xs text-muted-foreground">{{ r.locality }} · {{ r.gardenCode }}</div>
                                        <div class="text-xs text-muted-foreground md:hidden">{{ r.producerName }}</div>
                                    </TableCell>
                                    <TableCell class="hidden md:table-cell">
                                        <div class="text-sm">{{ r.producerName || '—' }}</div>
                                        <div class="text-xs text-muted-foreground">{{ r.licenseCode ?? 'ruhsat yok' }}</div>
                                    </TableCell>
                                    <TableCell class="text-right">
                                        <div class="font-semibold tabular-nums text-foreground">{{ formatM2(r.areaM2) }}</div>
                                        <div v-if="r.reusedM2" class="text-xs text-warning">çakışan {{ formatM2(r.reusedM2) }}</div>
                                    </TableCell>
                                    <TableCell class="hidden text-xs lg:table-cell">{{ r.lastNoChangeAt ? fmtDate(r.lastNoChangeAt) : 'sezon başı' }} → {{ fmtDate(r.firstChangeAt) }}<div class="text-muted-foreground">tarama {{ fmtDate(r.detectedAt) }}</div></TableCell>
                                    <TableCell>
                                        <Badge :variant="toneVariant(REGISTRATION_META[r.registration].tone)" :title="REGISTRATION_META[r.registration].description">{{ REGISTRATION_META[r.registration].label }}</Badge>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <div v-if="totalPages > 1" class="flex items-center justify-between gap-3">
                        <span class="text-sm text-muted-foreground">Sayfa {{ page }} / {{ totalPages }}</span>
                        <div class="flex gap-2">
                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page <= 1" aria-label="Önceki sayfa" @click="page--"><ChevronLeft aria-hidden="true" /></Button>
                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page >= totalPages" aria-label="Sonraki sayfa" @click="page++"><ChevronRight aria-hidden="true" /></Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>İki tarihli karşılaştırma</CardTitle>
                    <CardDescription v-if="selected">{{ selected.block }}/{{ selected.parcel }} · {{ selected.locality }} · {{ selected.producerName || 'müstahsil yok' }}</CardDescription>
                    <CardDescription v-else>Listeden bir kayıt seçin: budamadan önceki ve sonraki bulutsuz Sentinel-2 sahnesi, bahçe sınırı ve değişim poligonu.</CardDescription>
                </CardHeader>
                <CardContent class="flex flex-col gap-4">
                    <template v-if="selected">
                        <div class="grid gap-3 sm:grid-cols-2">
                            <div class="flex flex-col gap-1">
                                <div class="text-xs font-medium">Önce · {{ beforeScene ? fmtDate(beforeScene.date) : 'sahne yok' }}</div>
                                <div ref="beforeContainer" class="aspect-square w-full overflow-hidden rounded-lg border" />
                            </div>
                            <div class="flex flex-col gap-1">
                                <div class="text-xs font-medium">Sonra · {{ afterScene ? fmtDate(afterScene.date) : 'sahne yok' }}</div>
                                <div ref="afterContainer" class="aspect-square w-full overflow-hidden rounded-lg border" />
                            </div>
                        </div>
                        <dl class="grid gap-2 text-sm sm:grid-cols-2">
                            <div><dt class="text-xs text-muted-foreground">Budanan alan</dt><dd class="font-semibold tabular-nums text-foreground">{{ formatM2(selected.areaM2) }}<span v-if="selected.reusedM2" class="text-xs font-normal text-warning"> · çakışan {{ formatM2(selected.reusedM2) }}</span></dd></div>
                            <div><dt class="text-xs text-muted-foreground">Gözlem aralığı</dt><dd>{{ selected.lastNoChangeAt ? fmtDate(selected.lastNoChangeAt) : 'sezon başı' }} → {{ fmtDate(selected.firstChangeAt) }}</dd></div>
                            <div><dt class="text-xs text-muted-foreground">Ruhsat</dt><dd>{{ selected.licenseCode ?? 'yok / eşleşme bekliyor' }}<span v-if="selected.walletNo" class="text-muted-foreground"> · cüzdan {{ selected.walletNo }}</span></dd></div>
                            <div><dt class="text-xs text-muted-foreground">Müstahsil 1/7 durumu</dt><dd class="flex flex-wrap items-center gap-1"><Badge v-if="selected.producerStatus" :variant="toneVariant(PRODUCER_STATUS_META[selected.producerStatus].tone)">{{ PRODUCER_STATUS_META[selected.producerStatus].label }}</Badge><span class="text-xs text-muted-foreground">hedefin {{ formatShare(selected.producerRatio) }}'i</span></dd></div>
                        </dl>
                        <Alert :variant="selected.registration === 'auto' || selected.registration === 'expert' ? 'success' : selected.registration === 'pending' ? 'warning' : 'destructive'">
                            <AlertTitle>{{ REGISTRATION_META[selected.registration].label }}</AlertTitle>
                            <AlertDescription>{{ REGISTRATION_META[selected.registration].description }}</AlertDescription>
                        </Alert>
                        <p class="text-xs text-muted-foreground">Sahne görüntüleri 10 m Sentinel-2 piksellerinde, gerçek çözünürlükte gösterilir (büyütülmüş, yumuşatılmamış). Değişim poligonu sonra karesinde dolu, önce karesinde kesikli çizilir.</p>
                    </template>
                </CardContent>
            </Card>
        </div>
    </div>
</template>

<style>
/* Scene overlays are 10 m pixels: show them as pixels, not as a blur. */
.leaflet-image-layer.pixelated {
    image-rendering: pixelated;
}
</style>
