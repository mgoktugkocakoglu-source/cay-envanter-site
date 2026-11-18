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
import CaykurCoverLabels from '@/components/caykur/CaykurCoverLabels.vue';
import { toneVariant, type Tone } from '@/components/caykur/tone';
import { useToast } from '@/composables/useToast';
import { api, type CoverClass, type CoverDominant, type CoverFlag, type CoverParcel, type CoverTeaState, type LandCoverMap, type LandCoverSummary } from '@/services/api';
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
/** Map colours of the cover classes: tea in the product green, tree cover dark, open ground light. */
const COVER_COLOR: Record<CoverDominant, string> = { tea: '#15803d', trees: '#134e4a', open: '#eab308', built: '#64748b', mixed: '#7c3aed' };
const SHORT_LABEL: Record<CoverDominant, string> = { tea: 'Çay', trees: 'Ağaç örtüsü', open: 'Açık alan', built: 'Yapı / çıplak', mixed: 'Karışık' };
const FLAG_LABEL: Record<CoverFlag, string> = {
    tea_under_canopy: 'ağaç haritası üzerinde ağaç gösteriyor: ağaç altı çay olabilir ya da ağaçlar sonradan kesilmiş',
    evergreen_open_not_tea: 'açık ve her dem yeşil görünüyor ama model çay okumadı',
    rule_disagrees: 'fiziksel kural çay göstermiyor',
};
/** Colours of the reference-free groups: evergreen in the product green, the leaf-dropping group in brown. */
const GROUP_COLOR: Record<string, string> = { evergreen: '#15803d', evergreen_shadow: '#0f766e', semi_evergreen: '#65a30d', deciduous: '#a16207', sparse: '#eab308', built: '#64748b', bare: '#a8a29e', mixed: '#7c3aed' };
const MARKED_LABEL: Record<string, string> = { tea: 'Çay', hazelnut: 'Fındık', forest: 'Orman', grass: 'Çayır', crop: 'Ekili alan', built: 'Yapı', other: 'Çıplak zemin' };
const MONTH_LABELS = ['O', 'Ş', 'M', 'N', 'M', 'H', 'T', 'A', 'E', 'E', 'K', 'A'];
const TITLE_LABEL: Record<string, string> = { tea: 'Tapusu çay bahçesi', hazelnut: 'Tapusu fındık bahçesi', forest: 'Tapusu orman' };
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
const colourBy = ref<'tea' | 'cover' | 'group'>('tea');
const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let layer: L.GeoJSON | null = null;
let searchTimer: ReturnType<typeof setTimeout> | null = null;

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `%${Math.round(v * 100)}`);
const pct1 = (v: number) => `%${(v * 100).toFixed(1)}`;
const dominantOptions = computed(() => (Object.keys(summary.value?.summary.byDominant ?? {}) as CoverDominant[]).filter((k) => (summary.value?.summary.byDominant[k] ?? 0) > 0));
const groups = computed(() => summary.value?.unsupervised?.groups ?? []);
const groupLabel = computed(() => Object.fromEntries([...groups.value.map((g) => [g.name, g.label]), ['mixed', 'Karışık']]) as Record<string, string>);
/** Yearly curve of a group as SVG points (x = month, y = NDVI 0–1). */
const curve = (monthly: number[]) => monthly.map((v, i) => `${(i * 100) / 11},${(1 - Math.max(0, Math.min(1, v))) * 32}`).join(' ');
/** Parcels the trained model calls tea, split by what the reference-free grouping says. */
const agreement = computed(() => {
    const u = summary.value?.unsupervised;
    if (!u) return null;
    const row = u.againstTrained.present ?? {};
    const total = Object.values(row).reduce((s, v) => s + v, 0);
    return { total, evergreen: row.evergreen ?? 0, semi: (row.semi_evergreen ?? 0) + (row.evergreen_shadow ?? 0), other: total - (row.evergreen ?? 0) - (row.semi_evergreen ?? 0) - (row.evergreen_shadow ?? 0) };
});
/** Methods ordered by how well they read the reference parcels; the used one is marked. */
const comparison = computed(() => [...(summary.value?.model.comparison ?? [])].sort((a, b) => b.balanced - a.balanced).map((r) => ({ ...r, chosen: r.key === summary.value?.model.used?.key })));
const share = (part: number, whole: number) => (whole > 0 ? `%${Math.round((part / whole) * 100)}` : '—');

function styleOf(f?: { properties: { tea?: CoverTeaState; dominant?: CoverDominant | null; group?: string | null } | null }): L.PathOptions {
    const p = f?.properties;
    const none = TEA_META.not_assessable.color;
    const color = colourBy.value === 'tea' ? TEA_META[p?.tea ?? 'not_assessable'].color : colourBy.value === 'cover' ? (p?.dominant ? COVER_COLOR[p.dominant] : none) : (p?.group ? (GROUP_COLOR[p.group] ?? none) : none);
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
            l.bindTooltip(`${p.block}/${p.parcel} · ${p.nature} · ${TEA_META[p.tea].label}${p.teaShare === null ? '' : ` (${pct(p.teaShare)})`}${p.dominant ? ` · ${SHORT_LABEL[p.dominant] ?? p.dominant}` : ''}`, { sticky: true });
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
                        Arazi örtüsü: çay var mı, başka ne var
                        <Badge variant="warning">Ön değerlendirme</Badge>
                        <Badge variant="outline">Tapudan bağımsız</Badge>
                    </CardTitle>
                    <CardDescription>{{ summary.method }}</CardDescription>
                </CardHeader>
            </Card>

            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Çay var" :value="formatNumber(summary.summary.byTea.present)" :hint="`tahmini çaylık ≈ ${formatM2(summary.summary.teaAreaM2)} (piksel payından)`" :icon="Sprout" />
                <StatCard label="Kısmen çay" :value="formatNumber(summary.summary.byTea.partial)" :hint="`parselin %${Math.round(summary.rules.teaAbsentShare * 100)}–%${Math.round(summary.rules.teaPresentShare * 100)} kadarı çay`" />
                <StatCard label="Çay yok" :value="formatNumber(summary.summary.byTea.absent)" :hint="`tapusu çay bahçesi olanlardan ${summary.summary.titleTea.absent} tanesi`" />
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
                        <Button v-if="summary.unsupervised" :variant="colourBy === 'group' ? 'default' : 'outline'" class="min-h-11 md:min-h-9" :aria-pressed="colourBy === 'group'" @click="colourBy = 'group'">Kıyassız gruplama</Button>
                    </div>
                    <div ref="mapContainer" class="isolate h-[28rem] w-full overflow-hidden rounded-lg border" />
                    <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                        <template v-if="colourBy === 'tea'">
                            <span v-for="(m, k) in TEA_META" :key="k" class="flex items-center gap-1.5"><span class="size-3 rounded-sm" :style="{ background: m.color }" />{{ m.label }}</span>
                        </template>
                        <template v-else-if="colourBy === 'cover'">
                            <span v-for="k in dominantOptions" :key="k" class="flex items-center gap-1.5"><span class="size-3 rounded-sm" :style="{ background: COVER_COLOR[k] }" />{{ SHORT_LABEL[k] }} ({{ summary.summary.byDominant[k] }})</span>
                        </template>
                        <template v-else>
                            <span v-for="g in groups" :key="g.name" class="flex items-center gap-1.5"><span class="size-3 rounded-sm" :style="{ background: GROUP_COLOR[g.name] }" />{{ g.label }} ({{ summary.unsupervised?.byGroup[g.name] ?? 0 }})</span>
                            <span class="flex items-center gap-1.5"><span class="size-3 rounded-sm" :style="{ background: GROUP_COLOR.mixed }" />Karışık ({{ summary.unsupervised?.byGroup.mixed ?? 0 }})</span>
                        </template>
                    </div>
                </CardContent>
            </Card>

            <Card v-if="summary.unsupervised" class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle class="flex flex-wrap items-center gap-2">
                        Kıyassız gruplama
                        <Badge variant="outline">Tapu ve etiket kullanılmaz</Badge>
                        <Badge variant="warning">Doğruluk ölçülemez</Badge>
                    </CardTitle>
                    <CardDescription>{{ summary.unsupervised.method }}</CardDescription>
                </CardHeader>
                <CardContent class="px-0 pb-0">
                    <div class="overflow-x-auto border-t">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Grup</TableHead>
                                    <TableHead>Yıl içinde yeşillik (Ocak → Aralık)</TableHead>
                                    <TableHead class="text-right">Kış / yaz</TableHead>
                                    <TableHead class="text-right">Piksel payı</TableHead>
                                    <TableHead class="text-right">Parsel</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="g in groups" :key="g.name">
                                    <TableCell class="min-w-64 whitespace-normal">
                                        <span class="mr-1.5 inline-block size-3 rounded-sm align-middle" :style="{ background: GROUP_COLOR[g.name] }" /><span class="font-medium">{{ g.label }}</span>
                                        <div class="text-xs text-muted-foreground">{{ g.note }}</div>
                                    </TableCell>
                                    <TableCell>
                                        <svg viewBox="0 -2 100 36" class="h-10 w-40" role="img" :aria-label="`${g.label}: aylık yeşillik, kışın ${g.centre.winter.toFixed(2)}, yazın ${g.centre.summer.toFixed(2)}`">
                                            <polyline :points="curve(g.monthly)" fill="none" :stroke="GROUP_COLOR[g.name]" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
                                        </svg>
                                        <div class="flex w-40 justify-between text-[10px] text-muted-foreground" aria-hidden="true"><span v-for="(m, i) in MONTH_LABELS" :key="i">{{ m }}</span></div>
                                    </TableCell>
                                    <TableCell class="text-right tabular-nums">{{ pct(g.centre.ratio) }}</TableCell>
                                    <TableCell class="text-right tabular-nums">{{ pct1(g.share) }}</TableCell>
                                    <TableCell class="text-right tabular-nums">{{ formatNumber(summary.unsupervised.byGroup[g.name] ?? 0) }}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <div class="flex flex-col gap-2 border-t p-4 text-sm">
                        <p v-if="agreement">
                            <span class="font-medium">İki bağımsız yöntem:</span>
                            eğitimli modelin “çay var” dediği {{ formatNumber(agreement.total) }} parselin {{ formatNumber(agreement.evergreen) }} tanesini bu yöntem de “her dem yeşil” buluyor;
                            {{ formatNumber(agreement.semi) }} tanesi kısmen yeşil ya da gölgede, {{ formatNumber(agreement.other) }} tanesi başka grupta.
                            İkisinin de çay gösterdiği parseller en güvenilir olanlardır.
                        </p>
                        <p v-if="summary.unsupervised.titleConsistency" class="text-xs text-muted-foreground">
                            Tutarlılık notu (doğruluk değildir):
                            <template v-for="(t, key) in summary.unsupervised.titleConsistency" :key="key">
                                {{ TITLE_LABEL[key] ?? key }} olan piksellerin {{ pct(t.shares.evergreen ?? 0) }} kadarı “her dem yeşil”, {{ pct(t.shares.deciduous ?? 0) }} kadarı “yaprak döken” grupta.
                            </template>
                            Kıştan kışa yeşil kalan orman altı örtü ve çayırlar yüzünden “yaprak döken” grup bu bölgede beklenenden küçük çıkar.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <CaykurCoverLabels :area-id="areaId" :parcels="mapData" />

            <Card v-if="summary.model.fieldValidation" class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle class="flex flex-wrap items-center gap-2">
                        İşaretli alanlara göre doğruluk
                        <Badge variant="success">Gerçek kıyas noktası</Badge>
                    </CardTitle>
                    <CardDescription>
                        {{ formatNumber(summary.model.fieldValidation.areas) }} işaretli alan, {{ formatNumber(summary.model.fieldValidation.pixels) }} piksel
                        ({{ Object.entries(summary.model.fieldValidation.byClass).map(([c, v]) => `${MARKED_LABEL[c] ?? c} ${v.areas}`).join(' · ') }}).
                        Bu sayılar tapuya değil, sizin işaretlediğiniz alanlara göre ölçülmüştür.
                        <template v-if="summary.model.fieldValidation.note"> {{ summary.model.fieldValidation.note }}</template>
                    </CardDescription>
                </CardHeader>
                <CardContent v-if="summary.model.fieldValidation.asIs" class="px-0 pb-0">
                    <div class="overflow-x-auto border-t">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Model</TableHead>
                                    <TableHead class="text-right">Alan düzeyinde doğruluk</TableHead>
                                    <TableHead class="text-right">Çay var/yok (piksel)</TableHead>
                                    <TableHead class="text-right">Çay yakalama</TableHead>
                                    <TableHead class="text-right">Çay kesinliği</TableHead>
                                    <TableHead class="text-right">Bütün sınıflar</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="row in [{ label: 'İşaretli alanlar eğitime katılmadan (bugünkü modelin gerçek sınaması)', s: summary.model.fieldValidation.asIs }, { label: 'İşaretli alanlarla kalibre edilen (alanlar birbirine karşı sınandı)', s: summary.model.fieldValidation.calibrated }].filter((x) => x.s)" :key="row.label">
                                    <TableCell class="min-w-64 whitespace-normal">{{ row.label }}</TableCell>
                                    <TableCell class="text-right tabular-nums">{{ pct1(row.s!.areaAccuracy) }}</TableCell>
                                    <TableCell class="text-right tabular-nums">{{ pct1(row.s!.teaAccuracy) }}</TableCell>
                                    <TableCell class="text-right tabular-nums">{{ pct1(row.s!.teaRecall) }}</TableCell>
                                    <TableCell class="text-right tabular-nums">{{ pct1(row.s!.teaPrecision) }}</TableCell>
                                    <TableCell class="text-right tabular-nums">{{ pct1(row.s!.coverAccuracy) }}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle class="flex flex-wrap items-center gap-2">
                        Yöntem ne kadar isabetli
                        <Badge variant="outline">Tapuya göre değil, bakılan parsellere göre</Badge>
                    </CardTitle>
                    <CardDescription>
                        Her yöntem, bir kişinin baktığı {{ summary.model.reference.parcels }} parselde sınandı: drone videosunda gözle okunan {{ summary.model.reference.drone }} parsel ve {{ summary.model.reference.field }} saha gözlemi
                        ({{ summary.model.reference.tea }} çay, {{ summary.model.reference.noTea }} çay yok). Bu parsellerin hiçbiri eğitimde kullanılmadı.
                    </CardDescription>
                </CardHeader>
                <CardContent class="px-0 pb-0">
                    <div v-if="summary.model.used" class="grid gap-4 border-t p-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard label="Çay parsellerini bulma" :value="share(summary.model.used.teaFound, summary.model.used.teaTotal)" :hint="`${summary.model.used.teaFound} / ${summary.model.used.teaTotal} parsel`" />
                        <StatCard label="Çay olmayanı ayırma" :value="share(summary.model.used.noTeaRight, summary.model.used.noTeaTotal)" :hint="`${summary.model.used.noTeaRight} / ${summary.model.used.noTeaTotal} parsel`" />
                        <StatCard label="Dengeli doğruluk" :value="pct1(summary.model.used.balanced)" hint="iki oranın ortalaması" />
                        <StatCard label="Tartışmalı okumalar hariç" :value="pct1(summary.model.used.undisputed.balanced)" :hint="`${summary.model.reference.disputed.length} “çay yok” okuması tartışmalı`" />
                    </div>
                    <div class="overflow-x-auto border-t">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Yöntem</TableHead>
                                    <TableHead class="text-right">Çay bulunan</TableHead>
                                    <TableHead class="text-right">Çay yok doğru</TableHead>
                                    <TableHead class="text-right">Dengeli doğruluk</TableHead>
                                    <TableHead class="text-right">Tartışmalılar hariç</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="r in comparison" :key="r.key" :class="{ 'bg-muted/50 font-medium': r.chosen }">
                                    <TableCell class="min-w-72 whitespace-normal">
                                        {{ r.label }} <Badge v-if="r.chosen" variant="success" class="ml-1">kullanılan</Badge>
                                        <div class="text-xs font-normal text-muted-foreground">{{ r.description }}</div>
                                    </TableCell>
                                    <TableCell class="text-right tabular-nums">{{ r.teaFound }} / {{ r.teaTotal }}</TableCell>
                                    <TableCell class="text-right tabular-nums">{{ r.noTeaRight }} / {{ r.noTeaTotal }}</TableCell>
                                    <TableCell class="text-right tabular-nums">{{ pct1(r.balanced) }}</TableCell>
                                    <TableCell class="text-right tabular-nums">{{ pct1(r.undisputed.balanced) }}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <div class="flex flex-col gap-2 border-t p-4 text-sm">
                        <p>
                            <span class="font-medium">Neden tapu etiketi işe yaramıyor:</span>
                            ağaçla kaplanmış eski çay bahçelerinin tapusunda hâlâ “çay bahçesi” yazar. Tapuyla eğitilen model ağaç örtüsünü çay diye öğrenir; hangi veri eklenirse eklensin yarı yarıya yanılır.
                            <template v-if="summary.model.titleStudy">Aynı model tapuya karşı sınandığında {{ pct1(summary.model.titleStudy.teaAccuracy) }} doğru görünüyordu; o sayı arazideki durumu değil, tapuyla uyumu ölçüyordu.</template>
                        </p>
                        <p>
                            <span class="font-medium">Kullanılan yöntem:</span>
                            etiketler, ağaç yüksekliği ile kış yeşilliğinin açıkça uzlaştığı {{ formatNumber(Object.values(summary.model.trainingPixels).reduce((a, b) => a + b, 0)) }} pikselden gelir
                            (çay {{ formatNumber(summary.model.trainingPixels.tea) }}, ağaç örtüsü {{ formatNumber(summary.model.trainingPixels.trees) }}, açık alan {{ formatNumber(summary.model.trainingPixels.open) }}, yapı {{ formatNumber(summary.model.trainingPixels.built) }});
                            uzlaşmayan {{ formatNumber(summary.model.unlabelledPixels) }} pikseli güncel Sentinel-2 verisiyle eğitilen sınıflandırıcı okur.
                        </p>
                        <p class="text-xs text-muted-foreground">
                            {{ summary.model.reference.note }}
                            <template v-if="summary.model.reference.disputed.length">Tartışmalı parseller: {{ summary.model.reference.disputed.join(', ') }}.</template>
                            {{ summary.model.validationNote }}
                        </p>
                        <ul class="text-xs text-muted-foreground">
                            <li v-for="src in summary.model.sources" :key="src.name"><span class="font-medium">{{ src.name }}:</span> {{ src.role }}</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>

            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Parseller</CardTitle>
                    <CardDescription>Paylar, merkezi parselin içine düşen 10 m piksellerin sayımıdır; alan ölçümü değildir. Tapu niteliği yalnız karşılaştırma için gösterilir, modele verilmez. Ağaç yüksekliği birkaç yıl öncesinin haritasındandır; sınıfı güncel uydu verisi belirler.</CardDescription>
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
                                    <SelectItem v-for="k in dominantOptions" :key="k" :value="k">{{ SHORT_LABEL[k] }}</SelectItem>
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
                                        <div v-if="r.evidence" class="text-xs text-muted-foreground">ağaç yüksekliği {{ r.evidence.canopyHeightM.toFixed(1) }} m · ağaç payı {{ pct(r.evidence.tallShare) }} · kış/yaz yeşilliği {{ pct(r.evidence.winterRatio) }}</div>
                                        <div v-for="f in r.flags ?? []" :key="f" class="text-xs text-warning">{{ FLAG_LABEL[f] }}</div>
                                        <div v-if="r.group" class="text-xs text-muted-foreground">kıyassız: {{ groupLabel[r.group] ?? r.group }}</div>
                                    </TableCell>
                                    <TableCell class="text-sm">{{ r.dominant ? SHORT_LABEL[r.dominant] : '—' }}<span v-if="r.dominantShare !== null && r.dominant !== 'mixed'" class="text-muted-foreground"> · {{ pct(r.dominantShare) }}</span></TableCell>
                                    <TableCell class="min-w-56">
                                        <template v-if="r.shares">
                                            <div class="flex h-3 w-full overflow-hidden rounded-sm border" role="img" :aria-label="summary.classes.filter((c) => (r.shares?.[c] ?? 0) > 0).map((c) => `${SHORT_LABEL[c]} ${pct(r.shares?.[c])}`).join(', ')">
                                                <span v-for="c in summary.classes" :key="c" :style="{ width: `${(r.shares[c as CoverClass] ?? 0) * 100}%`, background: COVER_COLOR[c] }" />
                                            </div>
                                            <div class="mt-1 text-xs text-muted-foreground">{{ summary.classes.filter((c) => (r.shares?.[c] ?? 0) >= 0.1).map((c) => `${SHORT_LABEL[c]} ${pct(r.shares?.[c])}`).join(' · ') }}</div>
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
