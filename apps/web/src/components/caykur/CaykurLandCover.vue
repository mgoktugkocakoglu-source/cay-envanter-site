<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight, Sprout } from '@lucide/vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EmptyState, LoadingState, StatCard } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toneVariant, type Tone } from '@/components/caykur/tone';
import { useToast } from '@/composables/useToast';
import { api, type CoverClass, type CoverComparisonRow, type CoverDominant, type CoverParcel, type CoverTeaState, type LandCoverMap, type LandCoverSummary } from '@/services/api';
import { formatM2 } from '@/services/caykur/teaInventory';
import { formatNumber } from '@/services/caykur';

/**
 * Land cover (Arazi örtüsü), a separate module under licensing: for every parcel, is there tea, and what else grows
 * there. The model card shows which data source the detector was chosen from and what was measured. A preliminary
 * assessment read from 10 m satellite pixels; it measures no area and decides nothing.
 */
const props = defineProps<{ areaId: string }>();

const ALL = 'all';
const PAGE_SIZE = 20;
const TEA_META: Record<CoverTeaState, { label: string; tone: Tone; color: string }> = {
    present: { label: 'Çay var', tone: 'success', color: '#15803d' },
    partial: { label: 'Kısmen çay', tone: 'warning', color: '#d97706' },
    absent: { label: 'Çay yok', tone: 'danger', color: '#b91c1c' },
    not_assessable: { label: 'Değerlendirilemedi', tone: 'muted', color: '#94a3b8' },
};
/** Map colours of the cover classes: distinct hues, tea in the product green. */
const COVER_COLOR: Record<CoverDominant, string> = { tea: '#15803d', hazelnut: '#a16207', forest: '#134e4a', grass: '#84cc16', crop: '#eab308', built: '#64748b', other: '#a8a29e', mixed: '#7c3aed' };
const FEATURE_LABEL: Record<string, string> = {
    ndvi: 'Yalnız NDVI (yıllık dağılım, aylık ritim, her dem yeşillik)',
    top10: 'En güçlü on optik öznitelik',
    optical: 'Bütün optik (Sentinel-2)',
    radar: 'Yalnız radar (Sentinel-1)',
    top10_radar: 'On optik öznitelik + radar',
    ndvi_radar: 'NDVI + radar',
    all: 'Bütünleşik (optik + NDVI + radar)',
};
const LEARNER_LABEL: Record<string, string> = { rf: 'Rastgele orman', extra_trees: 'Ekstra ağaçlar', boosting: 'Gradyan artırma' };
const TEA_FILTERS: Array<{ value: CoverTeaState | typeof ALL; label: string }> = [
    { value: ALL, label: 'Bütün parseller' },
    { value: 'present', label: TEA_META.present.label },
    { value: 'partial', label: TEA_META.partial.label },
    { value: 'absent', label: TEA_META.absent.label },
    { value: 'not_assessable', label: TEA_META.not_assessable.label },
];
const TILES = 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';

const toast = useToast();
const isLoading = ref(true);
const isLoadingRows = ref(false);
const summary = ref<LandCoverSummary | null>(null);
const mapData = ref<LandCoverMap | null>(null);
const rows = ref<CoverParcel[]>([]);
const total = ref(0);
const pages = ref(1);
const page = ref(1);
const search = ref('');
const teaFilter = ref<CoverTeaState | typeof ALL>(ALL);
const dominantFilter = ref<CoverDominant | typeof ALL>(ALL);
const colourBy = ref<'tea' | 'cover'>('tea');
const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let layer: L.GeoJSON | null = null;
let searchTimer: ReturnType<typeof setTimeout> | null = null;

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `%${Math.round(v * 100)}`);
const pct1 = (v: number) => `%${(v * 100).toFixed(1)}`;
const labels = computed(() => summary.value?.labels ?? ({} as Record<CoverDominant, string>));
const dominantOptions = computed(() => (Object.keys(summary.value?.summary.byDominant ?? {}) as CoverDominant[]).filter((k) => (summary.value?.summary.byDominant[k] ?? 0) > 0));
/** One row per feature set with the reference learner, all cover classes at once: the comparison the choice rests on. */
const comparison = computed(() => {
    const m = summary.value?.model;
    if (!m) return [];
    const rowsOf = (target: CoverComparisonRow['target']) => m.comparison.filter((r) => r.target === target);
    const others = rowsOf('cover').filter((r) => r.learner !== 'rf');
    return [...rowsOf('cover').filter((r) => r.learner === 'rf'), ...others]
        .map((r) => ({ ...r, chosen: r.features === m.features && r.learner === m.learner, teaOnly: rowsOf('tea_only').find((t) => t.features === r.features && t.learner === r.learner) ?? null }))
        .sort((a, b) => b.teaF1.mean - a.teaF1.mean);
});
/** What the model calls each true class, as shares of that class's test pixels. */
const confusionRows = computed(() => {
    const m = summary.value?.model;
    if (!m) return [];
    return summary.value!.classes.map((cls, i) => {
        const row = m.confusion[i] ?? [];
        const n = row.reduce((s, v) => s + v, 0);
        return { cls, n, cells: summary.value!.classes.map((c, j) => ({ c, share: n ? (row[j] ?? 0) / n : 0 })) };
    }).filter((r) => r.n > 0);
});

function styleOf(f?: { properties: { tea?: CoverTeaState; dominant?: CoverDominant | null } | null }): L.PathOptions {
    const p = f?.properties;
    const color = colourBy.value === 'tea' ? TEA_META[p?.tea ?? 'not_assessable'].color : p?.dominant ? COVER_COLOR[p.dominant] : TEA_META.not_assessable.color;
    return { color, weight: 1.5, fillColor: color, fillOpacity: p?.tea === 'not_assessable' ? 0.08 : 0.4 };
}
function renderMap(): void {
    map?.remove();
    map = null;
    if (!mapContainer.value || !mapData.value) return;
    map = L.map(mapContainer.value, { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
    L.tileLayer(TILES, { maxZoom: 20 }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    layer = L.geoJSON(mapData.value, {
        style: (f) => styleOf(f),
        onEachFeature: (f, l) => {
            const p = f.properties as LandCoverMap['features'][number]['properties'];
            l.bindTooltip(`${p.block}/${p.parcel} · ${p.nature} · ${TEA_META[p.tea].label}${p.teaShare === null ? '' : ` (${pct(p.teaShare)})`}${p.dominant ? ` · ${labels.value[p.dominant] ?? p.dominant}` : ''}`, { sticky: true });
            l.on('click', () => {
                search.value = `${p.block}/${p.parcel}`;
            });
        },
    }).addTo(map);
    const bounds = layer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
}
async function load(): Promise<void> {
    isLoading.value = true;
    const [s, m] = await Promise.all([api.getLandCoverSummary(props.areaId), api.getLandCoverMap(props.areaId)]);
    isLoading.value = false;
    summary.value = s.data ?? null;
    mapData.value = m.data ?? null;
    if (!s.data) return;
    await loadRows();
    await nextTick();
    renderMap();
}
async function loadRows(): Promise<void> {
    isLoadingRows.value = true;
    const res = await api.getLandCoverParcels(props.areaId, {
        page: page.value,
        limit: PAGE_SIZE,
        tea: teaFilter.value === ALL ? undefined : teaFilter.value,
        dominant: dominantFilter.value === ALL ? undefined : dominantFilter.value,
        search: search.value.trim() || undefined,
    });
    isLoadingRows.value = false;
    if (!res.data) {
        toast.error(res.error?.message ?? 'Parsel listesi alınamadı');
        return;
    }
    rows.value = res.data.data;
    total.value = res.data.meta.total;
    pages.value = Math.max(1, res.data.meta.totalPages);
}
function reload(): void {
    if (page.value === 1) void loadRows();
    else page.value = 1;
}
function onTea(v: unknown): void {
    if (typeof v === 'string') teaFilter.value = v as CoverTeaState | typeof ALL;
}
function onDominant(v: unknown): void {
    if (typeof v === 'string') dominantFilter.value = v as CoverDominant | typeof ALL;
}
watch(colourBy, () => layer?.setStyle((f) => styleOf(f)));
watch([teaFilter, dominantFilter], reload);
watch(search, () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(reload, 300);
});
watch(page, () => void loadRows());
watch(() => props.areaId, () => void load(), { immediate: true });
onBeforeUnmount(() => {
    if (searchTimer) clearTimeout(searchTimer);
    map?.remove();
});
</script>

<template>
    <div class="flex flex-col gap-4">
        <LoadingState v-if="isLoading" text="Arazi örtüsü yükleniyor…" />
        <EmptyState v-else-if="!summary" :icon="Sprout" title="Bu mahalle için arazi örtüsü sonucu yok" description="Uydu öznitelikleri örneklenip sınıflandırma çalıştırıldığında burada görünür." />
        <template v-else>
            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle class="flex flex-wrap items-center gap-2">
                        Arazi örtüsü: çay var mı, başka ne yetişiyor
                        <Badge variant="warning">Ön değerlendirme</Badge>
                        <Badge variant="outline">Saha verisiyle sınanmadı</Badge>
                    </CardTitle>
                    <CardDescription>{{ summary.method }}</CardDescription>
                </CardHeader>
            </Card>

            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Çay var" :value="formatNumber(summary.summary.byTea.present)" :hint="`tahmini çaylık ≈ ${formatM2(summary.summary.teaAreaM2)} (piksel payından)`" :icon="Sprout" />
                <StatCard label="Kısmen çay" :value="formatNumber(summary.summary.byTea.partial)" :hint="`parselin %${Math.round(summary.rules.teaAbsentShare * 100)}–%${Math.round(summary.rules.teaPresentShare * 100)} kadarı çay`" />
                <StatCard label="Çay yok" :value="formatNumber(summary.summary.byTea.absent)" hint="başka bir örtü baskın" />
                <StatCard label="Değerlendirilemedi" :value="formatNumber(summary.summary.byTea.not_assessable)" :hint="`${summary.rules.minPixels} pikselden küçük parseller`" />
            </div>

            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Parsel haritası</CardTitle>
                    <CardDescription>Sınırlar TKGM kadastro geometrisidir. Bir parsele tıklayınca aşağıdaki listede o parsel gösterilir.</CardDescription>
                </CardHeader>
                <CardContent class="flex flex-col gap-3 pb-4">
                    <div class="flex flex-wrap gap-2" role="group" aria-label="Harita renklendirmesi">
                        <Button :variant="colourBy === 'tea' ? 'default' : 'outline'" class="min-h-11 md:min-h-9" :aria-pressed="colourBy === 'tea'" @click="colourBy = 'tea'">Çay durumu</Button>
                        <Button :variant="colourBy === 'cover' ? 'default' : 'outline'" class="min-h-11 md:min-h-9" :aria-pressed="colourBy === 'cover'" @click="colourBy = 'cover'">Baskın örtü</Button>
                    </div>
                    <div ref="mapContainer" class="isolate h-[28rem] w-full overflow-hidden rounded-lg border" />
                    <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                        <template v-if="colourBy === 'tea'">
                            <span v-for="(m, k) in TEA_META" :key="k" class="flex items-center gap-1.5"><span class="size-3 rounded-sm" :style="{ background: m.color }" />{{ m.label }}</span>
                        </template>
                        <template v-else>
                            <span v-for="k in dominantOptions" :key="k" class="flex items-center gap-1.5"><span class="size-3 rounded-sm" :style="{ background: COVER_COLOR[k] }" />{{ labels[k] }} ({{ summary.summary.byDominant[k] }})</span>
                        </template>
                    </div>
                </CardContent>
            </Card>

            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Hangi veri çayı en iyi buluyor</CardTitle>
                    <CardDescription>
                        Aynı etiketli piksellerde, {{ summary.model.folds }} katlı parsel bazlı çapraz sınama: model hiç görmediği parsellerde sınanır.
                        {{ formatNumber(Object.values(summary.model.trainingPixels).reduce((s, v) => s + v, 0)) }} piksel, {{ formatNumber(summary.model.trainingGroups) }} parsel/blok.
                        Kullanılan model: <strong>{{ FEATURE_LABEL[summary.model.features] ?? summary.model.features }}</strong> · {{ LEARNER_LABEL[summary.model.learner] ?? summary.model.learner }} · {{ summary.model.bands }} öznitelik.
                        {{ summary.model.validationNote }}
                    </CardDescription>
                </CardHeader>
                <CardContent class="px-0 pb-0">
                    <div class="grid gap-4 border-t p-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard label="Çay yakalama" :value="pct1(summary.model.crossValidation.teaRecall.mean)" :hint="`gerçek çay piksellerinin bulunan payı · ± ${pct1(summary.model.crossValidation.teaRecall.sd)}`" />
                        <StatCard label="Çay kesinliği" :value="pct1(summary.model.crossValidation.teaPrecision.mean)" :hint="`“çay” denen piksellerin gerçekten çay olan payı · ± ${pct1(summary.model.crossValidation.teaPrecision.sd)}`" />
                        <StatCard label="Çay var / yok doğruluğu" :value="pct1(summary.model.crossValidation.teaAccuracy.mean)" :hint="`çay ile çay olmayanı ayırma · ± ${pct1(summary.model.crossValidation.teaAccuracy.sd)}`" />
                        <StatCard label="Bütün sınıflarda doğruluk" :value="pct1(summary.model.crossValidation.accuracy.mean)" :hint="`örtü türünü de doğru bilme · ± ${pct1(summary.model.crossValidation.accuracy.sd)}`" />
                    </div>
                    <div v-if="summary.model.parcelLevel" class="flex flex-col gap-2 border-t p-4 text-sm">
                        <p>
                            <span class="font-medium">Parsel düzeyinde:</span>
                            tapuda çay bahçesi olan {{ formatNumber(summary.model.parcelLevel.teaParcels) }} sınama parselinin {{ formatNumber(summary.model.parcelLevel.teaFound) }} tanesinde çay bulundu ({{ pct1(summary.model.parcelLevel.teaRecall) }});
                            “çay var” denen parsellerin {{ pct1(summary.model.parcelLevel.teaPrecision) }} kadarının tapusu da çay bahçesi.
                            Tapusu fındık ya da orman olan {{ formatNumber(summary.model.parcelLevel.otherParcels) }} parselin {{ formatNumber(summary.model.parcelLevel.otherCalledTea) }} tanesi çay olarak okundu.
                        </p>
                        <p class="text-xs text-muted-foreground">
                            Bu son sayı modelin en zayıf yeridir ve iki açıklaması olabilir: model fındığı çaydan ayıramıyor, ya da bu parsellerde tapu güncel değil ve gerçekten çay var. Saha verisi olmadan ikisi ayrılamaz.
                            Piksel ölçümleri aşağıdaki tablodadır; parsel okuması birçok pikselin ortak sonucu olduğu için çay parsellerinde pikselden daha isabetlidir.
                        </p>
                    </div>
                    <div class="overflow-x-auto border-t">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Veri kaynağı</TableHead>
                                    <TableHead>Öğrenici</TableHead>
                                    <TableHead class="text-right">Öznitelik</TableHead>
                                    <TableHead class="text-right">Çay yakalama</TableHead>
                                    <TableHead class="text-right">Çay kesinliği</TableHead>
                                    <TableHead class="text-right">Çay F1</TableHead>
                                    <TableHead class="text-right">Çay var/yok doğruluğu</TableHead>
                                    <TableHead class="text-right">Bütün sınıflar</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="r in comparison" :key="r.features + r.learner" :class="{ 'bg-muted/50 font-medium': r.chosen }">
                                    <TableCell class="min-w-56 whitespace-normal">{{ FEATURE_LABEL[r.features] ?? r.features }} <Badge v-if="r.chosen" variant="success" class="ml-1">kullanılan</Badge></TableCell>
                                    <TableCell class="text-sm">{{ LEARNER_LABEL[r.learner] ?? r.learner }}</TableCell>
                                    <TableCell class="text-right tabular-nums">{{ r.bands }}</TableCell>
                                    <TableCell class="text-right tabular-nums">{{ pct1(r.teaRecall.mean) }}</TableCell>
                                    <TableCell class="text-right tabular-nums">{{ pct1(r.teaPrecision.mean) }}</TableCell>
                                    <TableCell class="text-right tabular-nums">{{ pct1(r.teaF1.mean) }} <span class="text-xs text-muted-foreground">± {{ pct1(r.teaF1.sd) }}</span></TableCell>
                                    <TableCell class="text-right tabular-nums">{{ pct1(r.teaAccuracy.mean) }}</TableCell>
                                    <TableCell class="text-right tabular-nums">{{ pct1(r.accuracy.mean) }}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <p class="border-t p-4 text-xs text-muted-foreground">
                        F1, yakalama ile kesinliğin dengeli ortalamasıdır; ± değeri katlar arasındaki yayılımdır. Birbirine bu yayılımdan daha yakın iki satır arasındaki fark anlamlı değildir.
                        Etiketler tapu niteliği (çay, fındık, orman) ve küresel arazi örtüsü haritasıdır (çayır, ekili alan, yapı): sayılar bunlarla uyumu ölçer, arazideki gerçeği değil.
                    </p>
                </CardContent>
            </Card>

            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Model neyi neyle karıştırıyor</CardTitle>
                    <CardDescription>Satır gerçek sınıf, sütun modelin verdiği sınıf; hücre o gerçek sınıfın piksellerinin payıdır. “Çay” sütunu, o örtünün ne sıklıkta çay sanıldığını gösterir.</CardDescription>
                </CardHeader>
                <CardContent class="px-0 pb-0">
                    <div class="overflow-x-auto border-t">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Gerçek sınıf</TableHead>
                                    <TableHead class="text-right">Piksel</TableHead>
                                    <TableHead v-for="c in summary.classes" :key="c" class="text-right">{{ labels[c] }}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="r in confusionRows" :key="r.cls">
                                    <TableCell class="font-medium">{{ labels[r.cls] }}</TableCell>
                                    <TableCell class="text-right tabular-nums">{{ formatNumber(r.n) }}</TableCell>
                                    <TableCell v-for="cell in r.cells" :key="cell.c" class="text-right tabular-nums" :class="{ 'font-semibold': cell.c === r.cls, 'text-muted-foreground': cell.share < 0.005 }">{{ cell.share < 0.005 ? '—' : pct(cell.share) }}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Parseller</CardTitle>
                    <CardDescription>Paylar, merkezi parselin içine düşen 10 m piksellerin sayımıdır; alan ölçümü değildir. Tapu niteliği yalnız karşılaştırma için gösterilir, modele verilmez.</CardDescription>
                </CardHeader>
                <CardContent class="px-0 pb-0">
                    <div class="flex flex-col gap-3 border-t p-4 md:flex-row md:items-end">
                        <div class="flex flex-1 flex-col gap-1.5">
                            <Label for="cover-search">Ada/parsel, nitelik ya da mevkii</Label>
                            <Input id="cover-search" v-model="search" placeholder="örn. 106/23" class="h-11 md:h-9" />
                        </div>
                        <div class="flex flex-col gap-1.5 md:w-56">
                            <Label for="cover-tea">Çay durumu</Label>
                            <Select :model-value="teaFilter" @update:model-value="onTea">
                                <SelectTrigger id="cover-tea" class="h-11 w-full md:h-9"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem v-for="f in TEA_FILTERS" :key="f.value" :value="f.value">{{ f.label }}</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div class="flex flex-col gap-1.5 md:w-56">
                            <Label for="cover-dominant">Baskın örtü</Label>
                            <Select :model-value="dominantFilter" @update:model-value="onDominant">
                                <SelectTrigger id="cover-dominant" class="h-11 w-full md:h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="ALL">Bütün örtüler</SelectItem>
                                    <SelectItem v-for="k in dominantOptions" :key="k" :value="k">{{ labels[k] }}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <LoadingState v-if="isLoadingRows" text="Parseller yükleniyor…" class="border-t p-6" />
                    <p v-else-if="!rows.length" class="border-t p-6 text-sm text-muted-foreground">Bu filtreye uyan parsel yok.</p>
                    <div v-else class="overflow-x-auto border-t">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ada/Parsel</TableHead>
                                    <TableHead>Tapu niteliği</TableHead>
                                    <TableHead>Çay durumu</TableHead>
                                    <TableHead>Baskın örtü</TableHead>
                                    <TableHead>Örtü payları</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="r in rows" :key="r.key">
                                    <TableCell class="font-medium">
                                        {{ r.block }}/{{ r.parcel }}
                                        <div class="text-xs text-muted-foreground">{{ r.locality || '—' }} · {{ formatM2(r.areaM2) }} · {{ r.pixels }} piksel</div>
                                    </TableCell>
                                    <TableCell class="text-sm">{{ r.nature }}</TableCell>
                                    <TableCell>
                                        <Badge :variant="toneVariant(TEA_META[r.tea].tone)">{{ TEA_META[r.tea].label }}</Badge>
                                        <div v-if="r.teaShare !== null" class="mt-1 text-xs text-muted-foreground">çay payı {{ pct(r.teaShare) }} · güven {{ r.confidence === 'high' ? 'yüksek' : r.confidence === 'medium' ? 'orta' : 'düşük' }}</div>
                                        <div v-if="r.beyondTraining" class="text-xs text-warning">eğitimdeki en yüksek çaydan yukarıda</div>
                                    </TableCell>
                                    <TableCell class="text-sm">{{ r.dominant ? labels[r.dominant] : '—' }}<span v-if="r.dominantShare !== null && r.dominant !== 'mixed'" class="text-muted-foreground"> · {{ pct(r.dominantShare) }}</span></TableCell>
                                    <TableCell class="min-w-56">
                                        <template v-if="r.shares">
                                            <div class="flex h-3 w-full overflow-hidden rounded-sm border" role="img" :aria-label="summary.classes.filter((c) => (r.shares?.[c] ?? 0) > 0).map((c) => `${labels[c]} ${pct(r.shares?.[c])}`).join(', ')">
                                                <span v-for="c in summary.classes" :key="c" :style="{ width: `${(r.shares[c as CoverClass] ?? 0) * 100}%`, background: COVER_COLOR[c] }" />
                                            </div>
                                            <div class="mt-1 text-xs text-muted-foreground">{{ summary.classes.filter((c) => (r.shares?.[c] ?? 0) >= 0.1).map((c) => `${labels[c]} ${pct(r.shares?.[c])}`).join(' · ') }}</div>
                                        </template>
                                        <span v-else class="text-sm text-muted-foreground">parsel 10 m ızgara için küçük</span>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <div v-if="pages > 1" class="flex items-center justify-between border-t p-4">
                        <span class="text-sm text-muted-foreground">Sayfa {{ page }} / {{ pages }} · {{ formatNumber(total) }} parsel</span>
                        <div class="flex gap-2">
                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page <= 1" aria-label="Önceki sayfa" @click="page--"><ChevronLeft aria-hidden="true" /></Button>
                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page >= pages" aria-label="Sonraki sayfa" @click="page++"><ChevronRight aria-hidden="true" /></Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </template>
    </div>
</template>
