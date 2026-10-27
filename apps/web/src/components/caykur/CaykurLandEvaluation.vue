<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { BookOpen, ChevronLeft, ChevronRight, CloudSun, Layers, Mountain, Sprout, TriangleAlert } from '@lucide/vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EmptyState, LoadingState, SearchInput, StatCard } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { type Tone } from '@/components/caykur/tone';
import {
    api,
    type LandAkkClass,
    type LandClimate,
    type LandCropKey,
    type LandDwClass,
    type LandErosionClass,
    type LandEvidence,
    type LandFactorRule,
    type LandMismatchFlag,
    type LandObservedUse,
    type LandParcelDetail,
    type LandParcelRow,
    type LandSourceRef,
    type LandSourceType,
    type LandSummary,
    type Law5403Class,
} from '@/services/api';
import { formatHectare, formatM2 } from '@/services/caykur/teaInventory';
import { formatNumber } from '@/services/caykur';

/**
 * Land evaluation module (Toprak Koruma ve Arazi Değerlendirme, 5403): every parcel's terrain (radar
 * DEM), soil, land use (deed title vs satellite, yearly history, Landsat NDVI since 1986), erosion index,
 * capability class proxy, 5403 class suggestion and cited crop suitability, plus the neighbourhood's
 * climate record since 1991 anchored to MGM station normals. Every threshold and figure links to its
 * source (law, ministry/chamber report, paper, GI registration, data set) in the "Kaynaklar" view.
 * Desk-top pre-assessment: soil depth, stoniness and drainage still need a field survey.
 */
const props = defineProps<{ areaId: string }>();

const ALL = 'all';
const PAGE_SIZE = 15;
const AKK_ORDER: LandAkkClass[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const AKK_COLOR: Record<LandAkkClass, string> = { I: '#15803d', II: '#4d7c0f', III: '#84cc16', IV: '#eab308', V: '#0ea5e9', VI: '#f97316', VII: '#dc2626', VIII: '#7f1d1d' };
const AKK_HINT: Record<LandAkkClass, string> = { I: 'Düz, sınırlaması yok', II: 'Hafif eğim', III: 'Orta eğim', IV: 'Dik, sınırlı işleme', V: 'Düz ama ıslak / taşkın', VI: 'Çok dik, özel ürün / mera', VII: 'Sarp, özel ürün / orman', VIII: 'Tarıma elverişsiz' };
const LAW_ORDER: Law5403Class[] = ['MT', 'OT', 'DT', 'TA', 'TD'];
const LAW_META: Record<Law5403Class, { label: string; tone: Tone; color: string }> = {
    MT: { label: 'Mutlak tarım', tone: 'success', color: '#15803d' },
    OT: { label: 'Özel ürün', tone: 'info', color: '#0ea5e9' },
    DT: { label: 'Dikili tarım', tone: 'info', color: '#1d4ed8' },
    TA: { label: 'Marjinal tarım', tone: 'warning', color: '#f59e0b' },
    TD: { label: 'Tarım dışı', tone: 'muted', color: '#64748b' },
};
const USE_ORDER: LandObservedUse[] = ['tea', 'trees', 'pasture', 'field', 'shrub', 'built', 'bare', 'wet', 'water', 'unknown'];
const USE_META: Record<LandObservedUse, { label: string; color: string }> = {
    tea: { label: 'Çay', color: '#15803d' },
    trees: { label: 'Ağaçlık (orman / dikili)', color: '#166534' },
    pasture: { label: 'Çayır / mera', color: '#a3e635' },
    field: { label: 'Tarla', color: '#eab308' },
    shrub: { label: 'Çalılık', color: '#b45309' },
    built: { label: 'Yapılaşmış', color: '#64748b' },
    bare: { label: 'Çıplak', color: '#a16207' },
    wet: { label: 'Sulak', color: '#0ea5e9' },
    water: { label: 'Su', color: '#1d4ed8' },
    unknown: { label: 'Belirsiz', color: '#94a3b8' },
};
const DECLARED_LABEL: Record<string, string> = { tea: 'Çay bahçesi', hazelnut: 'Fındık', forest: 'Orman', pasture: 'Çayır / mera', field: 'Tarla', orchard: 'Bağ / meyve', built: 'Yapı / arsa', other: 'Diğer' };
const DW_LABEL: Record<LandDwClass, string> = { water: 'Su', trees: 'Ağaç', grass: 'Çayır', flooded_vegetation: 'Sulak', crops: 'Ekili', shrub_and_scrub: 'Çalı', built: 'Yapı', bare: 'Çıplak', snow_and_ice: 'Kar' };
const DW_COLOR: Record<LandDwClass, string> = { water: '#1d4ed8', trees: '#166534', grass: '#a3e635', flooded_vegetation: '#0ea5e9', crops: '#eab308', shrub_and_scrub: '#b45309', built: '#64748b', bare: '#a16207', snow_and_ice: '#cbd5e1' };
const EROSION_ORDER: LandErosionClass[] = ['very_low', 'low', 'moderate', 'high', 'very_high', 'no_data'];
const EROSION_META: Record<LandErosionClass, { label: string; tone: Tone; color: string }> = {
    very_low: { label: 'Çok hafif', tone: 'success', color: '#15803d' },
    low: { label: 'Hafif', tone: 'success', color: '#84cc16' },
    moderate: { label: 'Orta', tone: 'warning', color: '#eab308' },
    high: { label: 'Şiddetli', tone: 'danger', color: '#f97316' },
    very_high: { label: 'Çok şiddetli', tone: 'danger', color: '#dc2626' },
    no_data: { label: 'Veri yok', tone: 'muted', color: '#94a3b8' },
};
const MISMATCH_ORDER: LandMismatchFlag[] = ['agri_to_built', 'tea_title_no_tea', 'abandoned_to_trees', 'forest_cleared', 'pasture_to_crops', 'wet_or_water'];
const MISMATCH_META: Record<LandMismatchFlag, { label: string; description: string; tone: Tone }> = {
    agri_to_built: { label: 'Tarım arazisinde yapı', description: 'Tapuda tarım, uyduda ≥ %30 yapılaşma: tarım dışı kullanım izni kontrolü.', tone: 'danger' },
    tea_title_no_tea: { label: 'Tapuda çay, çay yok', description: 'Çay bahçesi nitelikli parselde çay örtüsü görülmüyor.', tone: 'warning' },
    abandoned_to_trees: { label: 'Terk edilmiş (ağaçlaşmış)', description: 'Tarla/çayır nitelikli parsel ağaç örtüsüne dönmüş.', tone: 'warning' },
    forest_cleared: { label: 'Orman açılmış', description: 'Orman nitelikli parselde tarım örtüsü.', tone: 'danger' },
    pasture_to_crops: { label: 'Mera sürülmüş', description: 'Çayır/mera nitelikli parsel ekili.', tone: 'warning' },
    wet_or_water: { label: 'Su / sulak', description: 'Parsel su ya da sulak alan altında.', tone: 'info' },
};
const CROP_LABEL: Record<LandCropKey, string> = { tea: 'Çay', hazelnut: 'Fındık', kiwi: 'Kivi', chestnut: 'Kestane', blueberry: 'Yaban mersini', pasture: 'Mera / yem', vegetable: 'Sebze / sera', forestry: 'Ağaçlandırma' };
const CROP_ORDER: LandCropKey[] = ['tea', 'hazelnut', 'kiwi', 'chestnut', 'blueberry', 'pasture', 'vegetable', 'forestry'];
const SOURCE_TYPE_META: Record<LandSourceType, { label: string; tone: Tone }> = {
    mevzuat: { label: 'Mevzuat', tone: 'danger' },
    kurum: { label: 'Bakanlık / kurum', tone: 'info' },
    istatistik: { label: 'Resmî istatistik', tone: 'info' },
    meteoroloji: { label: 'Meteoroloji (MGM)', tone: 'success' },
    akademik: { label: 'Akademik', tone: 'warning' },
    'cografi-isaret': { label: 'Coğrafi işaret', tone: 'success' },
    veri: { label: 'Veri seti', tone: 'muted' },
};
const SOURCE_TYPE_ORDER: LandSourceType[] = ['mevzuat', 'kurum', 'istatistik', 'meteoroloji', 'cografi-isaret', 'akademik', 'veri'];
const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const summary = ref<LandSummary | null>(null);
const evidence = ref<LandEvidence | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);
type View = 'summary' | 'parcels' | 'map' | 'climate' | 'sources';
const view = ref<View>('summary');

// parcels
const search = ref('');
const fAkk = ref<LandAkkClass | typeof ALL>(ALL);
const fLaw = ref<Law5403Class | typeof ALL>(ALL);
const fUse = ref<LandObservedUse | typeof ALL>(ALL);
const fErosion = ref<LandErosionClass | typeof ALL>(ALL);
const fMismatch = ref<LandMismatchFlag | typeof ALL>(ALL);
const sortCrop = ref<LandCropKey | typeof ALL>(ALL);
const page = ref(1);
const rows = ref<LandParcelRow[]>([]);
const total = ref(0);
const totalPages = ref(1);
const isLoadingRows = ref(false);
// sheet
const sheetOpen = ref(false);
const detail = ref<LandParcelDetail | null>(null);
const isLoadingDetail = ref(false);
// map
const mapBy = ref<'akk' | 'law5403' | 'observed' | 'erosion' | 'mismatch' | 'suitability'>('akk');
const mapCrop = ref<LandCropKey>('tea');
const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let layer: L.GeoJSON | null = null;
// climate
const climate = ref<LandClimate | null>(null);
const isLoadingClimate = ref(false);

function fmtDate(d: string | null | undefined): string {
    if (!d) return '—';
    return `${Number(d.slice(8, 10))} ${MONTHS_TR[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
}
const signed = (v: number, unit = '', digits = 1) => `${v > 0 ? '+' : ''}${v.toFixed(digits)}${unit}`;
const pct = (v: number | undefined | null) => `${Math.round((v ?? 0) * 100)} %`;
const num = (v: number | null | undefined, digits = 0) => (v === null || v === undefined || Number.isNaN(v) ? '—' : v.toFixed(digits));
function scoreTone(s: number): Tone {
    return s >= 80 ? 'success' : s >= 50 ? 'info' : s >= 25 ? 'warning' : 'danger';
}
function scoreColor(s: number): string {
    return s >= 80 ? '#15803d' : s >= 50 ? '#84cc16' : s >= 25 ? '#f59e0b' : '#dc2626';
}

// ── sources ──
const sourceById = computed(() => new Map((evidence.value?.sources ?? []).map((s) => [s.id, s])));
function refsOf(ids: string[] | undefined): LandSourceRef[] {
    return (ids ?? []).map((id) => sourceById.value.get(id)).filter((s): s is LandSourceRef => !!s);
}
const ID_SHORT: Record<string, string> = { 'kanun-5403': 'Kanun 5403', 'kanun-2844': 'Kanun 2844', 'rg-2026-33214': 'RG 04.04.2026', 'karar-6243': 'CB Kararı 2022', 'usda-akk': 'USDA / Teknik Talimat', 'kestane-yukselti': 'Tez / Cİ kayıtları' };
const ORG_SHORT: Array<[RegExp, string]> = [
    [/Meteoroloji/, 'MGM'], [/TEPGE/, 'TEPGE'], [/TAGEM/, 'TAGEM'], [/Karadeniz Tarımsal/, 'KTAE'], [/TÜRKPATENT/, 'Coğrafi işaret'], [/Ziraat Odaları/, 'TZOB'],
    [/Ticaret Borsası/, 'RTB'], [/^TBMM/, 'Kanun'], [/Cumhurbaşkanlığı/, 'CB Kararı'], [/USDA/, 'USDA'], [/Resmî|Tarım ve Orman Bakanlığı$/, 'TOB'], [/İl Tarım/, 'İl Tarım'], [/Büyükşehir/, 'Trabzon BŞB'],
    [/ÇEM/, 'ÇEM'], [/EUFORGEN/, 'EUFORGEN'], [/ESA/, 'ESA'], [/ECMWF/, 'ERA5'], [/USGS/, 'Landsat'], [/JRC/, 'JRC'], [/OpenGeoHub/, 'OpenLandMap'], [/Yamazaki/, 'MERIT'],
    [/UCSB/, 'CHIRPS'], [/Google/, 'Dynamic World'], [/Yalova/, 'Yalova BKAE'], [/Ankara Üniversitesi/, 'AÜ Açık Ders'], [/YÖK/, 'YÖK Tez'], [/OMÜ/, 'OMÜ'], [/KTÜ/, 'KTÜ'], [/Bartın/, 'Bartın Ü.'],
    [/Kastamonu/, 'Kastamonu Ü.'], [/Atatürk/, 'Atatürk Ü.'], [/De Martonne/, 'De Martonne'], [/Annals/, 'Annals of GIS'], [/TR Dizin/, 'TR Dizin'], [/Tez/, 'Tez'],
];
function shortRef(s: LandSourceRef): string {
    const byId = ID_SHORT[s.id];
    if (byId) return byId;
    const hit = ORG_SHORT.find(([re]) => re.test(s.org));
    const org = hit ? hit[1] : s.org.split(/[(/]/)[0]!.trim().split(' ').slice(0, 2).join(' ');
    return `${org} ${s.year}`;
}
const sourcesByType = computed(() =>
    SOURCE_TYPE_ORDER.map((t) => ({ type: t, items: (evidence.value?.sources ?? []).filter((s) => s.type === t) })).filter((g) => g.items.length > 0),
);
/** Bundles from the first model version carried plain-string recommendations. */
function recText(r: { text: string } | string): string {
    return typeof r === 'string' ? r : r.text;
}
function recSources(r: { sources?: string[] } | string): string[] {
    return typeof r === 'string' ? [] : (r.sources ?? []);
}
function bandText(f: LandFactorRule): string {
    if (f.key === 'erosion') return f.label.includes('yüksek') ? 'Şiddetli / çok şiddetli erozyon sınıfı tam puan; çok hafif–orta 0–30' : 'Çok hafif–orta sınıf tam puan; şiddetli 60, çok şiddetli 30';
    if (f.key === 'drainage') return 'Taşkın / taban suyu riski yoksa tam puan, varsa 0';
    const [lo0, lo1, hi1, hi0] = f.band;
    const u = f.unit.trim();
    const v = (x: number | null) => (x === null ? null : `${x.toFixed(f.digits)}${u ? ` ${u}` : ''}`);
    const ideal = lo1 !== null && hi1 !== null ? `${v(lo1)} – ${v(hi1)}` : lo1 !== null ? `≥ ${v(lo1)}` : hi1 !== null ? `≤ ${v(hi1)}` : 'her değer';
    const zero = [lo0 !== null ? `≤ ${v(lo0)}` : null, hi0 !== null ? `≥ ${v(hi0)}` : null].filter(Boolean).join(' / ');
    return zero ? `${ideal} (0 puan: ${zero})` : ideal;
}

const boundaryYears = computed(() => summary.value?.landUse.years ?? []);
const boundaryRows = computed(() => boundaryYears.value.map((y) => ({ year: y, f: summary.value?.landUse.boundary[y] ?? {} })));
const topCrops = computed(() => {
    const m = summary.value?.summary.suitabilityMean;
    return m ? CROP_ORDER.map((c) => ({ crop: c, score: m[c] })).sort((a, b) => b.score - a.score) : [];
});
const supportedCrops = computed(() => new Set((summary.value?.district?.supportedProducts?.products ?? []).map((p) => ({ 'Yaş çay': 'tea', 'Fındık': 'hazelnut', 'Yem bitkileri': 'pasture', 'Mısır (dane)': 'vegetable' })[p]).filter(Boolean)));
const districtLand = computed(() => {
    const d = summary.value?.district?.landUseDa;
    if (!d) return [];
    return [
        { label: 'Tarım alanı', da: d.agriculture, color: '#15803d' },
        { label: 'Çayır–mera', da: d.pasture, color: '#a3e635' },
        { label: 'Orman', da: d.forest, color: '#166534' },
        { label: 'Tarım dışı', da: d.nonAgri, color: '#64748b' },
    ].map((r) => ({ ...r, share: d.total ? r.da / d.total : 0 }));
});
const baselineLabel = computed(() => (summary.value ? `${summary.value.climate.baselineYears[0]}–${summary.value.climate.baselineYears.at(-1)}` : ''));
const recentLabel = computed(() => (summary.value ? `${summary.value.climate.recentYears[0]}–${summary.value.climate.recentYears.at(-1)}` : ''));
const anchorText = computed(() => (summary.value?.climate.anchor?.stations ?? []).map((s) => `${s.name} %${Math.round(s.weight * 100)} (${s.distanceKm} km)`).join(', '));
const stationRows = computed(() => {
    const st = evidence.value?.stations ?? [];
    return MONTHS_TR.map((m, i) => ({ month: m, cells: st.map((s) => ({ id: s.id, t: s.tmean[i] ?? null, p: s.precipMm[i] ?? null })) }));
});

async function loadSummary(): Promise<void> {
    isLoading.value = true;
    error.value = null;
    const res = await api.getLandSummary(props.areaId);
    if (res.data) summary.value = res.data;
    else error.value = res.error?.message ?? 'Arazi değerlendirmesi alınamadı';
    isLoading.value = false;
    if (summary.value) {
        void loadRows();
        void loadEvidence();
    }
}
async function loadEvidence(): Promise<void> {
    const res = await api.getLandEvidence(props.areaId);
    if (res.data) evidence.value = res.data;
}

async function loadRows(): Promise<void> {
    isLoadingRows.value = true;
    const res = await api.getLandParcels(props.areaId, {
        page: page.value,
        limit: PAGE_SIZE,
        search: search.value || undefined,
        akk: fAkk.value === ALL ? undefined : fAkk.value,
        law5403: fLaw.value === ALL ? undefined : fLaw.value,
        observed: fUse.value === ALL ? undefined : fUse.value,
        erosion: fErosion.value === ALL ? undefined : fErosion.value,
        mismatch: fMismatch.value === ALL ? undefined : fMismatch.value,
        crop: sortCrop.value === ALL ? undefined : sortCrop.value,
    });
    if (res.data) {
        rows.value = res.data.data;
        total.value = res.data.meta.total;
        totalPages.value = res.data.meta.totalPages;
    }
    isLoadingRows.value = false;
}
watch([search, fAkk, fLaw, fUse, fErosion, fMismatch, sortCrop], () => { page.value = 1; void loadRows(); });
watch(page, () => void loadRows());

async function openParcel(id: string): Promise<void> {
    sheetOpen.value = true;
    isLoadingDetail.value = true;
    detail.value = null;
    const res = await api.getLandParcel(props.areaId, id);
    if (res.data) detail.value = res.data;
    isLoadingDetail.value = false;
}

function cssVar(name: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
function colourOf(p: Record<string, unknown>): string {
    switch (mapBy.value) {
        case 'akk': return AKK_COLOR[p.akk as LandAkkClass] ?? '#94a3b8';
        case 'law5403': return LAW_META[p.law5403 as Law5403Class]?.color ?? '#94a3b8';
        case 'observed': return USE_META[p.observed as LandObservedUse]?.color ?? '#94a3b8';
        case 'erosion': return EROSION_META[p.erosion as LandErosionClass]?.color ?? '#94a3b8';
        case 'mismatch': return p.mismatch ? '#dc2626' : '#15803d';
        case 'suitability': return scoreColor((p.suitability as number | null) ?? 0);
    }
    return '#94a3b8';
}
function labelOf(p: Record<string, unknown>): string {
    switch (mapBy.value) {
        case 'akk': return `AKK ${p.akk ?? '—'} · ${AKK_HINT[p.akk as LandAkkClass] ?? ''}`;
        case 'law5403': return LAW_META[p.law5403 as Law5403Class]?.label ?? '—';
        case 'observed': return `${USE_META[p.observed as LandObservedUse]?.label ?? '—'} (tapu: ${DECLARED_LABEL[String(p.declared)] ?? p.declared})`;
        case 'erosion': return `Erozyon ${EROSION_META[p.erosion as LandErosionClass]?.label ?? '—'}`;
        case 'mismatch': return p.mismatch ? MISMATCH_META[p.mismatch as LandMismatchFlag]?.label ?? String(p.mismatch) : 'Tapu ile uyumlu';
        case 'suitability': return `${CROP_LABEL[mapCrop.value]} uygunluğu ${p.suitability ?? '—'}/100`;
    }
    return '';
}
const legend = computed(() => {
    switch (mapBy.value) {
        case 'akk': return AKK_ORDER.map((k) => ({ label: `AKK ${k}`, color: AKK_COLOR[k] }));
        case 'law5403': return LAW_ORDER.map((k) => ({ label: LAW_META[k].label, color: LAW_META[k].color }));
        case 'observed': return USE_ORDER.map((k) => ({ label: USE_META[k].label, color: USE_META[k].color }));
        case 'erosion': return EROSION_ORDER.map((k) => ({ label: EROSION_META[k].label, color: EROSION_META[k].color }));
        case 'mismatch': return [{ label: 'Uyumsuzluk var', color: '#dc2626' }, { label: 'Tapu ile uyumlu', color: '#15803d' }];
        case 'suitability': return [{ label: '≥ 80 çok uygun', color: '#15803d' }, { label: '50–79 uygun', color: '#84cc16' }, { label: '25–49 sınırlı', color: '#f59e0b' }, { label: '< 25 uygun değil', color: '#dc2626' }];
    }
    return [];
});
async function renderMap(): Promise<void> {
    await nextTick();
    if (!mapContainer.value) return;
    if (!map) {
        map = L.map(mapContainer.value, { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
        L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20, maxNativeZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }).addTo(map);
        L.control.zoom({ position: 'topright' }).addTo(map);
    }
    const res = await api.getLandLayers(props.areaId, mapBy.value, mapBy.value === 'suitability' ? mapCrop.value : undefined);
    if (!res.data || !map) return;
    layer?.remove();
    layer = L.geoJSON(res.data, {
        style: (f) => ({ color: cssVar('--background', '#ffffff'), weight: 0.6, fillColor: colourOf(f?.properties ?? {}), fillOpacity: 0.65 }),
        onEachFeature: (f, l) => {
            const p = f.properties as Record<string, unknown>;
            l.bindTooltip(`${p.block}/${p.parcel} · eğim %${p.slopePct ?? '—'} · ${labelOf(p)}`, { sticky: true });
            l.on('click', () => void openParcel(String(p.id)));
        },
    }).addTo(map);
    const b = layer.getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [16, 16] });
    map.invalidateSize();
}
watch(view, (v) => { if (v === 'map') void renderMap(); if (v === 'climate' && !climate.value) void loadClimate(); });
watch([mapBy, mapCrop], () => { if (view.value === 'map') void renderMap(); });
async function loadClimate(): Promise<void> {
    isLoadingClimate.value = true;
    const res = await api.getLandClimate(props.areaId);
    if (res.data) climate.value = res.data;
    isLoadingClimate.value = false;
}
function onView(v: unknown): void { if (v === 'summary' || v === 'parcels' || v === 'map' || v === 'climate' || v === 'sources') view.value = v; }
function pick<T extends string>(v: unknown): T | typeof ALL { return typeof v === 'string' && v !== '' ? (v as T) : ALL; }

watch(() => props.areaId, () => { summary.value = null; evidence.value = null; climate.value = null; layer?.remove(); layer = null; void loadSummary(); }, { immediate: true });
onBeforeUnmount(() => { map?.remove(); map = null; });
</script>

<template>
    <div class="flex flex-col gap-6">
        <LoadingState v-if="isLoading && !summary" text="Arazi değerlendirmesi yükleniyor…" />
        <EmptyState v-else-if="error || !summary" :icon="Mountain" title="Bu mahalle için arazi değerlendirmesi yok" :description="error ?? 'Motor tarafında evaluate-land çalıştırıldığında burada görünür.'">
            <Button variant="outline" class="h-11 md:h-9" @click="loadSummary">Tekrar dene</Button>
        </EmptyState>
        <template v-else>
            <Alert variant="warning">
                <AlertTitle class="flex flex-wrap items-center gap-2">Ayrı modül · Toprak Koruma ve Arazi Değerlendirme (5403) <Badge variant="warning">Masa başı ön değerlendirme</Badge><Badge variant="outline">{{ evidence?.sources.length ?? '…' }} kaynak</Badge></AlertTitle>
                <AlertDescription>
                    Her parsel için radar kaynaklı DEM (Copernicus GLO-30) ile eğim, bakı ve dere kotu; OpenLandMap 250 m toprak; Dynamic World 10 m yıllık arazi örtüsü ({{ summary.landUse.years[0] }}–{{ summary.landUse.years.at(-1) }}) ve 1986'dan bugüne Landsat NDVI tarihi tapu niteliğiyle karşılaştırılır; Trabzon havza çalışmalarıyla ölçeklenen RUSLE erozyon indeksi, arazi kabiliyet sınıfı (AKK) yaklaşımı, 5403 ve 04.04.2026 Yönetmeliği'ne göre sınıf önerisi ve TAGEM / KTAE / üniversite / coğrafi işaret eşiklerine dayanan ürün uygunluk puanları hesaplanır. İklim: ERA5-Land + CHIRPS günlük kayıt {{ summary.climate.from.slice(0, 4) }}–{{ summary.climate.to.slice(0, 4) }}, MGM istasyon normallerine bağlı ({{ anchorText }}). Her eşik ve rakamın dayanağı "Kaynaklar" görünümünde. Toprak derinliği, taşlılık ve drenaj saha etüdü ister; sınıflar resmî arazi sınıflaması değildir.
                </AlertDescription>
            </Alert>

            <div class="-mx-1 overflow-x-auto px-1 pb-1">
                <ToggleGroup :model-value="view" type="single" aria-label="Arazi görünümü" class="w-max" @update:model-value="onView">
                    <ToggleGroupItem value="summary" class="h-11 px-3 md:h-9">Özet</ToggleGroupItem>
                    <ToggleGroupItem value="parcels" class="h-11 px-3 md:h-9">Parseller ({{ summary.summary.parcels }})</ToggleGroupItem>
                    <ToggleGroupItem value="map" class="h-11 px-3 md:h-9">Harita</ToggleGroupItem>
                    <ToggleGroupItem value="climate" class="h-11 px-3 md:h-9">İklim ({{ summary.climate.years }} yıl)</ToggleGroupItem>
                    <ToggleGroupItem value="sources" class="h-11 px-3 md:h-9">Kaynaklar ve kurallar</ToggleGroupItem>
                </ToggleGroup>
            </div>

            <!-- ───────── Özet ───────── -->
            <template v-if="view === 'summary'">
                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Değerlendirilen parsel" :value="formatNumber(summary.summary.parcels)" :hint="`${formatHectare(summary.summary.evaluatedAreaM2)} · mahalle ${formatHectare(summary.boundaryAreaM2)}`" :icon="Layers" />
                    <StatCard label="Mutlak + özel ürün + dikili" :value="formatNumber(summary.summary.byLaw5403.MT + summary.summary.byLaw5403.OT + summary.summary.byLaw5403.DT)" :hint="`mutlak ${summary.summary.byLaw5403.MT} · özel ürün ${summary.summary.byLaw5403.OT} · marjinal ${summary.summary.byLaw5403.TA} · tarım dışı ${summary.summary.byLaw5403.TD}`" :icon="Sprout" />
                    <StatCard label="Tapu–uydu uyumsuzluğu" :value="formatNumber(Object.values(summary.summary.mismatches).reduce((a, b) => a + b, 0))" :hint="`yapı ${summary.summary.mismatches.agri_to_built} · çay yok ${summary.summary.mismatches.tea_title_no_tea} · terk ${summary.summary.mismatches.abandoned_to_trees}`" :icon="TriangleAlert" />
                    <StatCard :label="`İklim: ${recentLabel} − ${baselineLabel} normali`" :value="signed(summary.climate.anomaly.tmean, ' °C')" :hint="`yağış ${signed(summary.climate.anomaly.precipMm, ' mm', 0)} · don günü ${signed(summary.climate.anomaly.frostDays, '', 0)}${summary.climate.indices ? ` · Erinç ${summary.climate.indices.erinc.value} ${summary.climate.indices.erinc.class.toLocaleLowerCase('tr')} · ${summary.climate.indices.koppen.code}` : ''}`" :icon="CloudSun" />
                </div>

                <div class="grid gap-4 lg:grid-cols-2">
                    <Card v-if="summary.district">
                        <CardHeader><CardTitle>{{ summary.district.province }} / {{ summary.district.district }} · resmî ilçe verileri</CardTitle><CardDescription>İl Tarım ve Orman Müdürlüğü arazi dağılımı ve Tarım Havzaları modelinde bu ilçe için desteklenen ürünler; model sonuçlarının yanında referans.</CardDescription></CardHeader>
                        <CardContent class="flex flex-col gap-3">
                            <template v-if="districtLand.length">
                                <div v-for="r in districtLand" :key="r.label" class="flex items-center gap-3 text-sm">
                                    <span class="w-24">{{ r.label }}</span>
                                    <div class="h-3 flex-1 overflow-hidden rounded bg-muted"><div class="h-full" :style="{ width: `${r.share * 100}%`, background: r.color }" /></div>
                                    <span class="w-28 text-right tabular-nums">{{ formatNumber(r.da) }} da</span>
                                    <span class="w-10 text-right text-xs text-muted-foreground">{{ pct(r.share) }}</span>
                                </div>
                                <p class="text-xs text-muted-foreground">Toplam {{ formatNumber(summary.district.landUseDa!.total) }} da · <a v-for="s in refsOf([summary.district.landUseDa!.source])" :key="s.id" :href="s.url" target="_blank" rel="noopener" class="underline">{{ shortRef(s) }}</a></p>
                            </template>
                            <div v-if="summary.district.supportedProducts" class="flex flex-wrap items-center gap-1.5 text-sm">
                                <span class="mr-1 text-xs text-muted-foreground">Desteklenen ürünler:</span>
                                <Badge v-for="p in summary.district.supportedProducts.products" :key="p" variant="success">{{ p }}</Badge>
                                <a v-for="s in refsOf([summary.district.supportedProducts.source])" :key="s.id" :href="s.url" target="_blank" rel="noopener" class="text-xs text-muted-foreground underline">{{ shortRef(s) }}</a>
                            </div>
                            <ul v-if="summary.district.notes.length" class="list-disc pl-5 text-xs text-muted-foreground">
                                <li v-for="(n, i) in summary.district.notes" :key="i">{{ n.text }} <a v-for="s in refsOf([n.source])" :key="s.id" :href="s.url" target="_blank" rel="noopener" class="underline">{{ shortRef(s) }}</a></li>
                            </ul>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Bitki örtüsü yoğunluğu 1986'dan bugüne (Landsat NDVI)</CardTitle><CardDescription>Beş dönemin yaz (Haz–Eyl) medyan NDVI'si, mahalle sınırının tamamı; "yoğun" = NDVI ≥ 0,60 payı. Artış, terk edilen tarla ve çayırların ağaçlaşması ile çaylıkların sıklaşmasını birlikte yansıtır.</CardDescription></CardHeader>
                        <CardContent class="flex flex-col gap-2">
                            <div v-for="(h, i) in summary.ndviHistory" :key="h.period" class="flex items-center gap-3 text-sm">
                                <span class="w-24 tabular-nums">{{ h.period }}</span>
                                <div class="h-3 flex-1 overflow-hidden rounded bg-muted"><div class="h-full bg-[#166534]" :style="{ width: `${(h.ndvi ?? 0) * 100}%` }" /></div>
                                <span class="w-12 text-right tabular-nums">{{ num(h.ndvi, 2) }}</span>
                                <span class="hidden w-40 text-xs text-muted-foreground sm:block">yoğun {{ pct(h.denseShare) }} · {{ summary.ndviPeriods[i]?.scenes ?? 0 }} sahne</span>
                            </div>
                            <p v-if="summary.ndviHistory.length >= 2" class="text-xs text-muted-foreground">{{ summary.ndviHistory[0]!.period }} → {{ summary.ndviHistory.at(-1)!.period }}: NDVI {{ num(summary.ndviHistory[0]!.ndvi, 2) }} → {{ num(summary.ndviHistory.at(-1)!.ndvi, 2) }}. Parsel düzeyinde aynı seri parsel panelinde.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Arazi kabiliyet sınıfı (AKK yaklaşımı)</CardTitle><CardDescription>Eğim sınıfları (A–F), taşkın riski (w), erozyon (e) ve toprak bünyesi (s) sınırlamalarına göre I (en iyi) – VIII (tarıma elverişsiz); USDA/Teknik Talimat şeması.</CardDescription></CardHeader>
                        <CardContent class="flex flex-col gap-2">
                            <div v-for="k in AKK_ORDER" :key="k" class="flex items-center gap-3 text-sm">
                                <span class="w-12 font-semibold">AKK {{ k }}</span>
                                <div class="h-3 flex-1 overflow-hidden rounded bg-muted"><div class="h-full" :style="{ width: `${(summary.summary.byAkk[k] / Math.max(1, summary.summary.parcels)) * 100}%`, background: AKK_COLOR[k] }" /></div>
                                <span class="w-10 text-right tabular-nums">{{ summary.summary.byAkk[k] }}</span>
                                <span class="hidden w-44 text-xs text-muted-foreground sm:block">{{ AKK_HINT[k] }}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>5403 sayılı Kanun sınıf önerisi</CardTitle><CardDescription>04.04.2026 Yönetmeliği: I–IV mutlak tarım adayı, V ıslah gerektiren, VI–VII entansif ve korumalı tekniklerle özel ürün (çay/fındık), VIII tarım dışı; uygulamada çaylıklar dikili tarım arazisi olarak da vasıflandırılır (her ikisi de md. 13 ile korunur).</CardDescription></CardHeader>
                        <CardContent class="flex flex-col gap-2">
                            <div v-for="k in LAW_ORDER" :key="k" class="flex items-center gap-3 text-sm">
                                <span class="w-32"><Badge :variant="LAW_META[k].tone">{{ LAW_META[k].label }}</Badge></span>
                                <div class="h-3 flex-1 overflow-hidden rounded bg-muted"><div class="h-full" :style="{ width: `${(summary.summary.byLaw5403[k] / Math.max(1, summary.summary.parcels)) * 100}%`, background: LAW_META[k].color }" /></div>
                                <span class="w-10 text-right tabular-nums">{{ summary.summary.byLaw5403[k] }}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Mevcut kullanım (uydu) ve tapu uyumsuzlukları</CardTitle><CardDescription>Dynamic World {{ summary.landUse.years.at(-1) }} + çay maskesi; tapu niteliğiyle karşılaştırma.</CardDescription></CardHeader>
                        <CardContent class="flex flex-col gap-3">
                            <div class="flex flex-wrap gap-1.5">
                                <Badge v-for="u in USE_ORDER.filter((x) => summary!.summary.byObserved[x] > 0)" :key="u" variant="outline"><span class="mr-1 inline-block size-2 rounded-sm" :style="{ background: USE_META[u].color }" />{{ USE_META[u].label }} {{ summary.summary.byObserved[u] }}</Badge>
                            </div>
                            <div class="flex flex-col gap-1.5">
                                <div v-for="m in MISMATCH_ORDER" :key="m" class="flex items-center justify-between gap-2 text-sm">
                                    <span class="flex items-center gap-2"><Badge :variant="MISMATCH_META[m].tone">{{ MISMATCH_META[m].label }}</Badge><span class="hidden text-xs text-muted-foreground md:inline">{{ MISMATCH_META[m].description }}</span></span>
                                    <Button variant="ghost" size="sm" class="h-8 tabular-nums" @click="fMismatch = m; view = 'parcels'">{{ summary.summary.mismatches[m] }} parsel</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Erozyon riski ve ürün uygunluğu</CardTitle><CardDescription>RUSLE indeksi (t/ha/yıl): R = 38,5 + 0,35·P (Trabzon Çatak/Fol havza çalışmalarıyla uyumlu ölçek) × K × LS × C. Uygunluk: kaynaklı eşiklerle en düşük faktör; mahalle ortalaması 0–100.</CardDescription></CardHeader>
                        <CardContent class="flex flex-col gap-3">
                            <div class="flex flex-wrap gap-1.5">
                                <Badge v-for="e in EROSION_ORDER.filter((x) => summary!.summary.byErosion[x] > 0)" :key="e" :variant="EROSION_META[e].tone">{{ EROSION_META[e].label }} {{ summary.summary.byErosion[e] }}</Badge>
                            </div>
                            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                                <div v-for="c in topCrops" :key="c.crop" class="flex items-center justify-between gap-2"><span>{{ CROP_LABEL[c.crop] }}<span v-if="supportedCrops.has(c.crop)" class="ml-1 text-[10px] text-muted-foreground" title="Tarım Havzaları destek listesinde">★</span></span><Badge :variant="scoreTone(c.score)">{{ c.score }}</Badge></div>
                            </div>
                            <p class="text-xs text-muted-foreground">★ ilçe destek listesinde. Mevcut kullanımı zayıf puanlanan, başka bir ürünün ≥ 80 puan aldığı parsel: <b>{{ summary.summary.conversionCandidates }}</b>. Kestane ve ağaçlandırma dik yamaçlarda doğal olarak yüksek puan alır; kestane balı için çiçeklenme iklimi "İklim" görünümünde.</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader><CardTitle>Mahalle arazi örtüsü yıllara göre</CardTitle><CardDescription>Dynamic World 10 m, Mayıs–Eylül mod etiketi, mahalle sınırının tamamı. Çay bahçeleri bu üründe "ağaç" sınıfına düşer; çay ayrımı çay maskesiyle parsel düzeyinde yapılır.</CardDescription></CardHeader>
                    <CardContent class="flex flex-col gap-1.5">
                        <div v-for="r in boundaryRows" :key="r.year" class="flex items-center gap-3 text-sm">
                            <span class="w-10 tabular-nums">{{ r.year }}</span>
                            <div class="flex h-4 flex-1 overflow-hidden rounded bg-muted">
                                <div v-for="(v, k) in r.f" :key="k" class="h-full" :style="{ width: `${(v ?? 0) * 100}%`, background: DW_COLOR[k as LandDwClass] }" :title="`${DW_LABEL[k as LandDwClass]} ${pct(v)}`" />
                            </div>
                            <span class="hidden w-56 truncate text-xs text-muted-foreground sm:block">{{ Object.entries(r.f).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 3).map(([k, v]) => `${DW_LABEL[k as LandDwClass]} ${pct(v)}`).join(' · ') }}</span>
                        </div>
                        <div class="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground"><span v-for="k in (Object.keys(DW_LABEL) as LandDwClass[])" :key="k" class="flex items-center gap-1"><span class="inline-block size-2 rounded-sm" :style="{ background: DW_COLOR[k] }" />{{ DW_LABEL[k] }}</span></div>
                    </CardContent>
                </Card>
            </template>

            <!-- ───────── Parseller ───────── -->
            <Card v-else-if="view === 'parcels'">
                <CardHeader>
                    <CardTitle>Parsel değerlendirmeleri</CardTitle>
                    <CardDescription>{{ total }} parsel · satıra tıklayınca topografya, toprak, kullanım geçmişi, parsel iklimi, faktör faktör uygunluk ve kaynaklı öneriler açılır.</CardDescription>
                </CardHeader>
                <CardContent class="flex flex-col gap-3 px-0">
                    <div class="flex flex-wrap items-center gap-2 px-6">
                        <SearchInput v-model="search" placeholder="Ada/parsel, nitelik, mevkii…" class="w-full sm:w-64" />
                        <Select :model-value="fAkk" @update:model-value="(v) => (fAkk = pick<LandAkkClass>(v))"><SelectTrigger class="h-11 w-32 md:h-9" aria-label="AKK"><SelectValue placeholder="AKK" /></SelectTrigger><SelectContent><SelectItem :value="ALL">Tüm AKK</SelectItem><SelectItem v-for="k in AKK_ORDER" :key="k" :value="k">AKK {{ k }} ({{ summary.summary.byAkk[k] }})</SelectItem></SelectContent></Select>
                        <Select :model-value="fLaw" @update:model-value="(v) => (fLaw = pick<Law5403Class>(v))"><SelectTrigger class="h-11 w-40 md:h-9" aria-label="5403 sınıfı"><SelectValue placeholder="5403" /></SelectTrigger><SelectContent><SelectItem :value="ALL">Tüm 5403 sınıfları</SelectItem><SelectItem v-for="k in LAW_ORDER" :key="k" :value="k">{{ LAW_META[k].label }} ({{ summary.summary.byLaw5403[k] }})</SelectItem></SelectContent></Select>
                        <Select :model-value="fUse" @update:model-value="(v) => (fUse = pick<LandObservedUse>(v))"><SelectTrigger class="h-11 w-44 md:h-9" aria-label="Kullanım"><SelectValue placeholder="Kullanım" /></SelectTrigger><SelectContent><SelectItem :value="ALL">Tüm kullanımlar</SelectItem><SelectItem v-for="k in USE_ORDER" :key="k" :value="k">{{ USE_META[k].label }} ({{ summary.summary.byObserved[k] }})</SelectItem></SelectContent></Select>
                        <Select :model-value="fErosion" @update:model-value="(v) => (fErosion = pick<LandErosionClass>(v))"><SelectTrigger class="h-11 w-40 md:h-9" aria-label="Erozyon"><SelectValue placeholder="Erozyon" /></SelectTrigger><SelectContent><SelectItem :value="ALL">Tüm erozyon sınıfları</SelectItem><SelectItem v-for="k in EROSION_ORDER" :key="k" :value="k">{{ EROSION_META[k].label }} ({{ summary.summary.byErosion[k] }})</SelectItem></SelectContent></Select>
                        <Select :model-value="fMismatch" @update:model-value="(v) => (fMismatch = pick<LandMismatchFlag>(v))"><SelectTrigger class="h-11 w-48 md:h-9" aria-label="Uyumsuzluk"><SelectValue placeholder="Uyumsuzluk" /></SelectTrigger><SelectContent><SelectItem :value="ALL">Uyumsuzluk: hepsi</SelectItem><SelectItem v-for="k in MISMATCH_ORDER" :key="k" :value="k">{{ MISMATCH_META[k].label }} ({{ summary.summary.mismatches[k] }})</SelectItem></SelectContent></Select>
                        <Select :model-value="sortCrop" @update:model-value="(v) => (sortCrop = pick<LandCropKey>(v))"><SelectTrigger class="h-11 w-44 md:h-9" aria-label="Ürün sırala"><SelectValue placeholder="Ürüne göre sırala" /></SelectTrigger><SelectContent><SelectItem :value="ALL">Ada/parsel sırası</SelectItem><SelectItem v-for="c in CROP_ORDER" :key="c" :value="c">{{ CROP_LABEL[c] }} uygunluğuna göre</SelectItem></SelectContent></Select>
                    </div>
                    <LoadingState v-if="isLoadingRows && rows.length === 0" text="Parseller yükleniyor…" />
                    <Table v-else>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Parsel · tapu niteliği</TableHead>
                                <TableHead class="text-right">Alan</TableHead>
                                <TableHead class="text-right">Eğim · yükselti</TableHead>
                                <TableHead>Toprak</TableHead>
                                <TableHead>Uydu kullanımı</TableHead>
                                <TableHead>AKK · 5403</TableHead>
                                <TableHead>Erozyon</TableHead>
                                <TableHead>En uygun ürün</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow v-for="r in rows" :key="r.id" class="cursor-pointer" @click="openParcel(r.id)">
                                <TableCell>
                                    <div class="font-medium">{{ r.block }}/{{ r.parcel }}</div>
                                    <div class="text-xs text-muted-foreground">{{ r.nature }}<template v-if="r.locality"> · {{ r.locality }}</template></div>
                                    <div v-if="r.mismatches.length" class="mt-1 flex flex-wrap gap-1"><Badge v-for="m in r.mismatches" :key="m" :variant="MISMATCH_META[m].tone" class="text-[10px]">{{ MISMATCH_META[m].label }}</Badge></div>
                                </TableCell>
                                <TableCell class="text-right tabular-nums">{{ formatM2(r.areaM2) }}</TableCell>
                                <TableCell class="text-right tabular-nums">%{{ r.slopePct ?? '—' }} <span class="text-xs text-muted-foreground">{{ r.slopeLabel }}</span><div class="text-xs text-muted-foreground">{{ r.elevationM ?? '—' }} m · {{ r.aspectLabel ?? '—' }}</div></TableCell>
                                <TableCell><div>{{ r.textureLabel ?? '—' }}</div><div class="text-xs text-muted-foreground">pH {{ r.ph ?? '—' }}</div></TableCell>
                                <TableCell><Badge variant="outline"><span class="mr-1 inline-block size-2 rounded-sm" :style="{ background: USE_META[r.observed].color }" />{{ USE_META[r.observed].label }}</Badge><div v-if="r.change" class="mt-1 text-xs text-muted-foreground">{{ r.change.fromYear }} {{ DW_LABEL[r.change.from] }} → {{ r.change.toYear }} {{ DW_LABEL[r.change.to] }}</div></TableCell>
                                <TableCell><span class="font-semibold" :style="{ color: r.akk ? AKK_COLOR[r.akk] : undefined }">{{ r.akk ?? '—' }}</span> <Badge v-if="r.law5403" :variant="LAW_META[r.law5403].tone" class="ml-1">{{ LAW_META[r.law5403].label }}</Badge><div v-if="r.limitations.length" class="mt-1 text-xs text-muted-foreground">{{ r.limitations.join(' · ') }}</div></TableCell>
                                <TableCell><Badge :variant="EROSION_META[r.erosionClass].tone">{{ EROSION_META[r.erosionClass].label }}</Badge><div v-if="r.erosionIndex !== null" class="text-xs text-muted-foreground">{{ r.erosionIndex }} t/ha/yıl</div></TableCell>
                                <TableCell>
                                    <template v-if="sortCrop !== ALL"><Badge :variant="scoreTone(r.suitability.find((s) => s.crop === sortCrop)?.score ?? 0)">{{ CROP_LABEL[sortCrop] }} {{ r.suitability.find((s) => s.crop === sortCrop)?.score ?? '—' }}</Badge><div class="text-xs text-muted-foreground">{{ r.suitability.find((s) => s.crop === sortCrop)?.limiting ?? 'sınırlama yok' }}</div></template>
                                    <template v-else-if="r.best"><Badge :variant="scoreTone(r.best.score)">{{ CROP_LABEL[r.best.crop] }} {{ r.best.score }}</Badge><div class="text-xs text-muted-foreground">{{ r.suitability.slice(1, 3).map((s) => `${CROP_LABEL[s.crop]} ${s.score}`).join(' · ') }}</div></template>
                                </TableCell>
                            </TableRow>
                            <TableRow v-if="rows.length === 0"><TableCell colspan="8" class="py-10 text-center text-muted-foreground">Filtreye uyan parsel yok.</TableCell></TableRow>
                        </TableBody>
                    </Table>
                    <div v-if="totalPages > 1" class="flex items-center justify-end gap-2 px-6 text-sm">
                        <span class="text-muted-foreground">{{ page }} / {{ totalPages }}</span>
                        <Button variant="outline" size="icon" class="size-9" :disabled="page <= 1" aria-label="Önceki" @click="page--"><ChevronLeft /></Button>
                        <Button variant="outline" size="icon" class="size-9" :disabled="page >= totalPages" aria-label="Sonraki" @click="page++"><ChevronRight /></Button>
                    </div>
                </CardContent>
            </Card>

            <!-- ───────── Harita ───────── -->
            <Card v-else-if="view === 'map'">
                <CardHeader>
                    <CardTitle>Arazi haritası</CardTitle>
                    <CardDescription>Parseller seçilen ölçüte göre renkli; tıklayınca değerlendirme açılır.</CardDescription>
                </CardHeader>
                <CardContent class="flex flex-col gap-3">
                    <div class="flex flex-wrap items-center gap-2">
                        <ToggleGroup :model-value="mapBy" type="single" aria-label="Harita ölçütü" class="w-max" @update:model-value="(v) => { if (typeof v === 'string' && v) mapBy = v as typeof mapBy; }">
                            <ToggleGroupItem value="akk" class="h-9 px-3">AKK</ToggleGroupItem>
                            <ToggleGroupItem value="law5403" class="h-9 px-3">5403</ToggleGroupItem>
                            <ToggleGroupItem value="observed" class="h-9 px-3">Kullanım</ToggleGroupItem>
                            <ToggleGroupItem value="erosion" class="h-9 px-3">Erozyon</ToggleGroupItem>
                            <ToggleGroupItem value="mismatch" class="h-9 px-3">Uyumsuzluk</ToggleGroupItem>
                            <ToggleGroupItem value="suitability" class="h-9 px-3">Ürün uygunluğu</ToggleGroupItem>
                        </ToggleGroup>
                        <Select v-if="mapBy === 'suitability'" :model-value="mapCrop" @update:model-value="(v) => { if (typeof v === 'string' && v) mapCrop = v as LandCropKey; }"><SelectTrigger class="h-9 w-44" aria-label="Ürün"><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="c in CROP_ORDER" :key="c" :value="c">{{ CROP_LABEL[c] }}</SelectItem></SelectContent></Select>
                    </div>
                    <div ref="mapContainer" class="h-[420px] w-full overflow-hidden rounded-md border bg-muted md:h-[520px]" role="application" aria-label="Arazi haritası" />
                    <div class="flex flex-wrap gap-3 text-xs text-muted-foreground"><span v-for="l in legend" :key="l.label" class="flex items-center gap-1"><span class="inline-block size-2.5 rounded-sm" :style="{ background: l.color }" />{{ l.label }}</span></div>
                </CardContent>
            </Card>

            <!-- ───────── İklim ───────── -->
            <template v-else-if="view === 'climate'">
                <LoadingState v-if="isLoadingClimate || !climate" text="İklim kaydı yükleniyor…" />
                <template v-else>
                    <Alert variant="info">
                        <AlertTitle>Mahalle iklim kaydı {{ fmtDate(climate.from) }} – {{ fmtDate(climate.to) }}</AlertTitle>
                        <AlertDescription>{{ climate.source }}. Sıcaklıklar {{ climate.lapse.cellElevationM }} m'lik model hücresinden {{ climate.lapse.neighbourhoodElevationM }} m'lik tarım alanı yükseltisine {{ signed(climate.lapse.correctionC, ' °C', 2) }} ile düzeltildi<template v-if="climate.anchor">; ardından MGM istasyon normalleri ({{ climate.anchor.stations.map((s) => `${s.name} %${Math.round(s.weight * 100)}, ${s.distanceKm} km, ${s.period}`).join(' · ') }}) aynı yükseltiye taşınarak aylık sıcaklık farkları ve yağış oranları seriye uygulandı: mahalle normali {{ climate.anchor.normal.annualTmean }} °C, {{ formatNumber(climate.anchor.normal.annualPrecipMm) }} mm</template>. Referans dönem {{ climate.baselineYears[0] }}–{{ climate.baselineYears.at(-1) }}, son dönem {{ climate.recentYears[0] }}–{{ climate.recentYears.at(-1) }}.</AlertDescription>
                    </Alert>
                    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard label="Yıllık ortalama sıcaklık" :value="signed(climate.anomaly.tmean, ' °C')" :hint="`eğilim ${signed(climate.trend.tmeanPerDecade, ' °C')} / 10 yıl${climate.decades?.length ? ` · ${climate.decades[0]?.label} ${num(climate.decades[0]?.tmean, 1)} → ${climate.decades.at(-1)?.label} ${num(climate.decades.at(-1)?.tmean, 1)} °C` : ''}`" />
                        <StatCard label="Yıllık yağış" :value="signed(climate.anomaly.precipMm, ' mm', 0)" :hint="`eğilim ${signed(climate.trend.precipPerDecade, ' mm', 0)} / 10 yıl · yağışlı gün ${signed(climate.anomaly.rainDays, '', 0)} · nem ${signed(climate.anomaly.rhMean, ' %', 0)}`" />
                        <StatCard label="Don günü / yıl" :value="signed(climate.anomaly.frostDays, '', 0)" :hint="`eğilim ${signed(climate.trend.frostDaysPerDecade, '', 0)} / 10 yıl · 30 °C üstü ${signed(climate.anomaly.hotDays, '', 0)} · kurak dönem ${signed(climate.anomaly.drySpellMax, ' gün', 0)}`" />
                        <StatCard v-if="climate.indices" label="İklim sınıfı (model)" :value="`${climate.indices.koppen.code} · Erinç ${climate.indices.erinc.value}`" :hint="`${climate.indices.erinc.class} · De Martonne ${climate.indices.deMartonne.value} ${climate.indices.deMartonne.class.toLocaleLowerCase('tr')} · MGM: ${climate.indices.reference.map((r) => `${r.station} Erinç ${r.erinc ?? '—'}`).join(', ')}`" />
                    </div>
                    <div class="grid gap-4 lg:grid-cols-2">
                        <Card v-if="climate.decades">
                            <CardHeader><CardTitle>On yıllık dönemler</CardTitle><CardDescription>Tam yılların dönem ortalamaları: ısınma, don günü azalması ve yağış değişimi bir bakışta.</CardDescription></CardHeader>
                            <CardContent class="px-0">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Dönem</TableHead><TableHead class="text-right">Ort. °C</TableHead><TableHead class="text-right">Min / Maks</TableHead><TableHead class="text-right">Yağış mm</TableHead><TableHead class="text-right">Yağışlı gün</TableHead><TableHead class="text-right">Don günü</TableHead><TableHead class="text-right">30 °C+</TableHead><TableHead class="text-right">Nem %</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        <TableRow v-for="d in climate.decades" :key="d.label">
                                            <TableCell class="font-medium">{{ d.label }} <span class="text-xs text-muted-foreground">({{ d.years.length }} yıl)</span></TableCell>
                                            <TableCell class="text-right tabular-nums">{{ d.tmean.toFixed(1) }}</TableCell>
                                            <TableCell class="text-right tabular-nums">{{ d.tminAbs.toFixed(0) }} / {{ d.tmaxAbs.toFixed(0) }}</TableCell>
                                            <TableCell class="text-right tabular-nums">{{ formatNumber(d.precipMm) }}</TableCell>
                                            <TableCell class="text-right tabular-nums">{{ d.rainDays }}</TableCell>
                                            <TableCell class="text-right tabular-nums">{{ d.frostDays }}</TableCell>
                                            <TableCell class="text-right tabular-nums">{{ d.hotDays }}</TableCell>
                                            <TableCell class="text-right tabular-nums">{{ d.rhMean.toFixed(0) }}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                        <Card v-if="climate.indices">
                            <CardHeader><CardTitle>İklim indisleri ve MGM sınıflandırması</CardTitle><CardDescription>Erinç Im = P / Tom (&lt; 8 tam kurak … &gt; 55 çok nemli); De Martonne I = P / (T + 10) (&gt; 35 ıslak); Köppen harf kodu. MGM il merkez istasyonlarının 1991–2020 değerleri karşılaştırma için.</CardDescription></CardHeader>
                            <CardContent class="px-0">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Yer</TableHead><TableHead class="text-right">Erinç</TableHead><TableHead>Sınıf</TableHead><TableHead class="text-right">De Martonne</TableHead><TableHead>Thornthwaite</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        <TableRow class="bg-muted/40"><TableCell class="font-medium">Bu mahalle (model, {{ climate.lapse.neighbourhoodElevationM }} m)</TableCell><TableCell class="text-right tabular-nums">{{ climate.indices.erinc.value }}</TableCell><TableCell>{{ climate.indices.erinc.class }}</TableCell><TableCell class="text-right tabular-nums">{{ climate.indices.deMartonne.value }} · {{ climate.indices.deMartonne.class }}</TableCell><TableCell>{{ climate.indices.koppen.code }} {{ climate.indices.koppen.label }}</TableCell></TableRow>
                                        <TableRow v-for="r in climate.indices.reference" :key="r.station"><TableCell class="font-medium">MGM {{ r.station }}</TableCell><TableCell class="text-right tabular-nums">{{ r.erinc ?? '—' }}</TableCell><TableCell>{{ r.erinc === null ? '—' : r.erinc < 8 ? 'Tam kurak' : r.erinc < 15 ? 'Kurak' : r.erinc < 23 ? 'Yarı kurak' : r.erinc < 40 ? 'Yarı nemli' : r.erinc < 55 ? 'Nemli' : 'Çok nemli' }}</TableCell><TableCell class="text-right tabular-nums">{{ r.deMartonne ?? '—' }}</TableCell><TableCell>{{ r.thornthwaite ?? '—' }}</TableCell></TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                    <Card v-if="climate.anchor">
                        <CardHeader><CardTitle>Model ↔ MGM istasyon normali bağlama tablosu</CardTitle><CardDescription>Aylık: istasyon normali (lapse ile {{ climate.lapse.neighbourhoodElevationM }} m'ye taşınmış, ağırlıklı), ERA5-Land model iklimi ({{ climate.anchor.model.years[0] }}–{{ climate.anchor.model.years.at(-1) }}), uygulanan sıcaklık farkı ve yağış oranı; CHIRPS karşılaştırma için.</CardDescription></CardHeader>
                        <CardContent class="px-0">
                            <Table>
                                <TableHeader><TableRow><TableHead>Ay</TableHead><TableHead class="text-right">MGM normal °C</TableHead><TableHead class="text-right">Model °C</TableHead><TableHead class="text-right">Fark</TableHead><TableHead class="text-right">MGM yağış</TableHead><TableHead class="text-right">ERA5</TableHead><TableHead class="text-right">CHIRPS</TableHead><TableHead class="text-right">Oran</TableHead><TableHead class="text-right">MGM yağışlı gün</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    <TableRow v-for="(m, i) in MONTHS_TR" :key="m">
                                        <TableCell class="font-medium">{{ m }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ num(climate.anchor.normal.tmean[i], 1) }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ num(climate.anchor.model.tmean[i], 1) }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ signed(climate.anchor.monthlyOffsetC[i] ?? 0, '', 1) }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ num(climate.anchor.normal.precipMm[i]) }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ num(climate.anchor.model.precipEra[i]) }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ num(climate.anchor.model.precipChirps[i]) }}</TableCell>
                                        <TableCell class="text-right tabular-nums">×{{ num(climate.anchor.monthlyPrecipRatio[i], 2) }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ num(climate.anchor.normal.rainDays[i], 1) }}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Yıllık değerler</CardTitle><CardDescription>Tam yıllar; sıcaklık °C, yağış mm, GDD (10 °C tabanlı büyüme derece-gün), kurak dönem = ardışık &lt; 1 mm gün. Son dönem satırları vurgulu.</CardDescription></CardHeader>
                        <CardContent class="px-0">
                            <Table>
                                <TableHeader><TableRow><TableHead>Yıl</TableHead><TableHead class="text-right">Ort.</TableHead><TableHead class="text-right">Min / Maks</TableHead><TableHead class="text-right">Nem %</TableHead><TableHead class="text-right">Yağış</TableHead><TableHead class="text-right">Yağışlı gün</TableHead><TableHead class="text-right">Don günü</TableHead><TableHead class="text-right">30 °C+ gün</TableHead><TableHead class="text-right">GDD</TableHead><TableHead class="text-right">Kurak dönem</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    <TableRow v-for="y in climate.yearly" :key="y.period" :class="climate.recentYears.includes(Number(y.period)) ? 'bg-muted/40' : ''">
                                        <TableCell class="font-medium">{{ y.period }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ y.tmean.toFixed(1) }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ y.tminAbs.toFixed(0) }} / {{ y.tmaxAbs.toFixed(0) }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ y.rhMean.toFixed(0) }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ formatNumber(y.precipMm) }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ y.rainDays }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ y.frostDays }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ y.hotDays }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ formatNumber(y.gdd10) }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ y.drySpellMax }} gün</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                    <div class="grid gap-4 lg:grid-cols-2">
                        <Card>
                            <CardHeader><CardTitle>Aylık normal ({{ climate.baselineYears[0] }}–{{ climate.baselineYears.at(-1) }})</CardTitle><CardDescription>Referans dönem aylık ortalamaları, tarım alanı yükseltisinde.</CardDescription></CardHeader>
                            <CardContent class="px-0">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Ay</TableHead><TableHead class="text-right">Ort. °C</TableHead><TableHead class="text-right">Min °C</TableHead><TableHead class="text-right">Maks °C</TableHead><TableHead class="text-right">Yağış mm</TableHead><TableHead class="text-right">Yağışlı gün</TableHead><TableHead class="text-right">Nem %</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        <TableRow v-for="m in climate.climatology" :key="m.month">
                                            <TableCell class="font-medium">{{ MONTHS_TR[m.month - 1] }}</TableCell>
                                            <TableCell class="text-right tabular-nums">{{ m.tmean.toFixed(1) }}</TableCell>
                                            <TableCell class="text-right tabular-nums">{{ m.tmin.toFixed(1) }}</TableCell>
                                            <TableCell class="text-right tabular-nums">{{ m.tmax.toFixed(1) }}</TableCell>
                                            <TableCell class="text-right tabular-nums">{{ m.precipMm }}</TableCell>
                                            <TableCell class="text-right tabular-nums">{{ m.rainDays.toFixed(0) }}</TableCell>
                                            <TableCell class="text-right tabular-nums">{{ m.rhMean.toFixed(0) }}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                        <Card v-if="climate.seasons">
                            <CardHeader><CardTitle>Don takvimi ve soğuklama</CardTitle><CardDescription>Son ilkbahar donu, ilk sonbahar donu, donsuz dönem ve 7,2 °C altı soğuklama saati (Kas–Mar); kivi 400–600 saat, maviyemiş &gt; 600–1000 saat ister.</CardDescription></CardHeader>
                            <CardContent class="px-0">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Yıl</TableHead><TableHead>Son ilkbahar donu</TableHead><TableHead>İlk sonbahar donu</TableHead><TableHead class="text-right">Donsuz gün</TableHead><TableHead class="text-right">Soğuklama saat</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        <TableRow v-for="s in climate.seasons" :key="s.year" :class="climate.recentYears.includes(s.year) ? 'bg-muted/40' : ''">
                                            <TableCell class="font-medium">{{ s.year }}</TableCell>
                                            <TableCell>{{ fmtDate(s.lastSpringFrost) }}</TableCell>
                                            <TableCell>{{ fmtDate(s.firstAutumnFrost) }}</TableCell>
                                            <TableCell class="text-right tabular-nums">{{ s.frostFreeDays }}</TableCell>
                                            <TableCell class="text-right tabular-nums">{{ formatNumber(s.chillHours) }}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                    <Card v-for="w in climate.windows" :key="w.key">
                        <CardHeader>
                            <CardTitle class="flex flex-wrap items-center gap-2">{{ w.label }} <span class="text-sm font-normal text-muted-foreground">{{ w.from.replace('-', '.') }} – {{ w.to.replace('-', '.') }}</span><a v-for="s in refsOf(w.sources)" :key="s.id" :href="s.url" target="_blank" rel="noopener" class="rounded border px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground hover:text-foreground" :title="s.title">{{ shortRef(s) }}</a></CardTitle>
                            <CardDescription>{{ w.why }} Referans → son dönem: sıcaklık {{ w.baseline.tmean }} → {{ w.recent.tmean }} °C · yağış {{ w.baseline.precipMm }} → {{ w.recent.precipMm }} mm · yağışlı gün {{ w.baseline.rainDays }} → {{ w.recent.rainDays }} · don günü {{ w.baseline.frostDays }} → {{ w.recent.frostDays }}<template v-if="w.baseline.rhMean !== undefined"> · nem %{{ num(w.baseline.rhMean, 0) }} → %{{ num(w.recent.rhMean, 0) }}</template>.</CardDescription>
                        </CardHeader>
                        <CardContent class="px-0">
                            <Table>
                                <TableHeader><TableRow><TableHead>Yıl</TableHead><TableHead class="text-right">Ort. °C</TableHead><TableHead class="text-right">Min °C</TableHead><TableHead class="text-right">Yağış mm</TableHead><TableHead class="text-right">Yağışlı gün</TableHead><TableHead class="text-right">Nem %</TableHead><TableHead class="text-right">Don günü</TableHead><TableHead class="text-right">30 °C+</TableHead><TableHead class="text-right">Kurak dönem</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    <TableRow v-for="y in w.years" :key="y.year" :class="climate.recentYears.includes(y.year) ? 'bg-muted/40' : ''">
                                        <TableCell class="font-medium">{{ y.year }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ y.tmean.toFixed(1) }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ y.tminAbs.toFixed(1) }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ y.precipMm }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ y.rainDays }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ y.rhMean.toFixed(0) }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ y.frostDays }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ y.hotDays }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ y.drySpellMax }} gün</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </template>
            </template>

            <!-- ───────── Kaynaklar ve kurallar ───────── -->
            <template v-else-if="view === 'sources'">
                <LoadingState v-if="!evidence" text="Kaynaklar yükleniyor…" />
                <template v-else>
                    <Alert variant="info">
                        <AlertTitle class="flex items-center gap-2"><BookOpen class="size-4" /> Dayanak: {{ evidence.sources.length }} kaynak, {{ evidence.cropRules.length }} ürün kuralı, {{ evidence.stations.length }} MGM istasyonu</AlertTitle>
                        <AlertDescription>{{ evidence.method }}. Üretim: {{ fmtDate(evidence.generatedAt.slice(0, 10)) }}. Her ürün faktörü 100 puanı ideal aralıkta alır, aralığın dışında doğrusal olarak 0'a iner; ürün puanı en düşük faktördür (Liebig minimum yasası, FAO arazi uygunluğu yaklaşımı). Eksik veri 60 (nötr) sayılır.</AlertDescription>
                    </Alert>
                    <Card v-for="rule in evidence.cropRules" :key="rule.key">
                        <CardHeader>
                            <CardTitle class="flex flex-wrap items-center gap-2">{{ rule.label }} <Badge v-if="supportedCrops.has(rule.key)" variant="success">İlçe destek listesinde</Badge><Badge variant="outline">ortalama {{ summary.summary.suitabilityMean[rule.key] }}</Badge></CardTitle>
                            <CardDescription>{{ rule.rationale }} <a v-for="s in refsOf(rule.sources)" :key="s.id" :href="s.url" target="_blank" rel="noopener" class="ml-1 underline">{{ shortRef(s) }}</a></CardDescription>
                        </CardHeader>
                        <CardContent class="px-0">
                            <Table>
                                <TableHeader><TableRow><TableHead>Faktör</TableHead><TableHead>İdeal aralık (0 puan sınırı)</TableHead><TableHead>Not</TableHead><TableHead>Kaynak</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    <TableRow v-for="f in rule.factors" :key="f.key">
                                        <TableCell class="font-medium">{{ f.label }}</TableCell>
                                        <TableCell class="tabular-nums">{{ bandText(f) }}</TableCell>
                                        <TableCell class="text-xs text-muted-foreground">{{ f.note }}</TableCell>
                                        <TableCell><div class="flex flex-wrap gap-1"><a v-for="s in refsOf(f.sources)" :key="s.id" :href="s.url" target="_blank" rel="noopener" class="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground" :title="s.title">{{ shortRef(s) }}</a></div></TableCell>
                                    </TableRow>
                                    <TableRow v-for="l in rule.legal" :key="l.label" class="bg-muted/40">
                                        <TableCell class="font-medium">Yasal şart</TableCell>
                                        <TableCell colspan="2">{{ l.label }}</TableCell>
                                        <TableCell><div class="flex flex-wrap gap-1"><a v-for="s in refsOf(l.sources)" :key="s.id" :href="s.url" target="_blank" rel="noopener" class="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground" :title="s.title">{{ shortRef(s) }}</a></div></TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>MGM il istasyonu normalleri (aylık ortalama sıcaklık °C / yağış mm)</CardTitle><CardDescription>Resmî İklim İstatistikleri; model serisi mahalleye en yakın kıyı istasyonlarına bağlanır. Artvin (597 m, iç vadi) yalnız karşılaştırma içindir.</CardDescription></CardHeader>
                        <CardContent class="px-0">
                            <Table>
                                <TableHeader><TableRow><TableHead>Ay</TableHead><TableHead v-for="s in evidence.stations" :key="s.id" class="text-right">{{ s.name }} <span class="text-xs font-normal text-muted-foreground">({{ s.elevationM }} m, {{ s.period }})</span></TableHead></TableRow></TableHeader>
                                <TableBody>
                                    <TableRow v-for="r in stationRows" :key="r.month">
                                        <TableCell class="font-medium">{{ r.month }}</TableCell>
                                        <TableCell v-for="c in r.cells" :key="c.id" class="text-right tabular-nums">{{ num(c.t, 1) }} / {{ num(c.p, 1) }}</TableCell>
                                    </TableRow>
                                    <TableRow class="bg-muted/40">
                                        <TableCell class="font-medium">Yıllık</TableCell>
                                        <TableCell v-for="s in evidence.stations" :key="s.id" class="text-right tabular-nums">{{ (s.tmean.reduce((a, b) => a + b, 0) / 12).toFixed(1) }} / {{ formatNumber(Math.round(s.precipMm.reduce((a, b) => a + b, 0))) }}<div v-if="s.classes" class="text-xs font-normal text-muted-foreground">Erinç {{ s.classes.erinc ?? '—' }} · De Martonne {{ s.classes.deMartonne ?? '—' }}<template v-if="s.classes.thornthwaite"> · {{ s.classes.thornthwaite }}</template></div></TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                    <Card v-for="g in sourcesByType" :key="g.type">
                        <CardHeader><CardTitle class="flex items-center gap-2"><Badge :variant="SOURCE_TYPE_META[g.type].tone">{{ SOURCE_TYPE_META[g.type].label }}</Badge><span class="text-sm font-normal text-muted-foreground">{{ g.items.length }} kaynak</span></CardTitle></CardHeader>
                        <CardContent class="px-0">
                            <Table>
                                <TableHeader><TableRow><TableHead>Kaynak</TableHead><TableHead>Modülde kullanımı</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    <TableRow v-for="s in g.items" :key="s.id">
                                        <TableCell class="align-top"><a :href="s.url" target="_blank" rel="noopener" class="font-medium underline">{{ s.title }}</a><div class="text-xs text-muted-foreground">{{ s.org }} · {{ s.year }}</div></TableCell>
                                        <TableCell class="align-top text-sm">{{ s.used }}<div v-if="s.caveat" class="mt-1 text-xs text-amber-700 dark:text-amber-400">⚠ {{ s.caveat }}</div></TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </template>
            </template>
        </template>

        <!-- ───────── Parsel paneli ───────── -->
        <Sheet v-model:open="sheetOpen">
            <SheetContent side="right" class="w-full gap-0 overflow-y-auto sm:max-w-3xl">
                <LoadingState v-if="isLoadingDetail || !detail" text="Parsel yükleniyor…" class="p-6" />
                <template v-else>
                    <SheetHeader class="border-b">
                        <SheetTitle>{{ detail.block }}/{{ detail.parcel }} · {{ detail.nature }}</SheetTitle>
                        <SheetDescription>{{ formatM2(detail.areaM2) }}<template v-if="detail.locality"> · {{ detail.locality }}</template> · AKK {{ detail.akk ?? '—' }} · {{ detail.law5403Label }}</SheetDescription>
                    </SheetHeader>
                    <div class="flex flex-col gap-5 p-6">
                        <div v-if="detail.land.recommendations.length" class="flex flex-col gap-2">
                            <Alert v-for="(r, i) in detail.land.recommendations" :key="i" variant="warning"><AlertDescription>{{ recText(r) }} <a v-for="s in refsOf(recSources(r))" :key="s.id" :href="s.url" target="_blank" rel="noopener" class="ml-1 rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground" :title="s.title">{{ shortRef(s) }}</a></AlertDescription></Alert>
                        </div>
                        <section>
                            <h3 class="mb-2 text-sm font-semibold">Topografya ve su</h3>
                            <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                                <div><dt class="text-xs text-muted-foreground">Eğim (ort. / en dik)</dt><dd>%{{ detail.land.terrain.slopePct?.toFixed(0) ?? '—' }} / %{{ detail.land.terrain.slopeMaxPct?.toFixed(0) ?? '—' }} · {{ detail.land.terrain.slopeLabel }}</dd></div>
                                <div><dt class="text-xs text-muted-foreground">Yükselti</dt><dd>{{ detail.land.terrain.elevationM?.toFixed(0) ?? '—' }} m</dd></div>
                                <div><dt class="text-xs text-muted-foreground">Bakı</dt><dd>{{ detail.land.terrain.aspectLabel ?? '—' }} ({{ detail.land.terrain.aspectDeg ?? '—' }}°)</dd></div>
                                <div><dt class="text-xs text-muted-foreground">Konum (TPI)</dt><dd>{{ detail.land.terrain.tpiM === null ? '—' : detail.land.terrain.tpiM < -5 ? 'Vadi tabanı' : detail.land.terrain.tpiM > 5 ? 'Sırt' : 'Yamaç' }} ({{ detail.land.terrain.tpiM?.toFixed(0) ?? '—' }} m)</dd></div>
                                <div><dt class="text-xs text-muted-foreground">Dere kotu üstü (HAND)</dt><dd>{{ detail.land.terrain.handM?.toFixed(1) ?? '—' }} m</dd></div>
                                <div><dt class="text-xs text-muted-foreground">En yakın dere</dt><dd>{{ detail.land.terrain.streamDistM?.toFixed(0) ?? '—' }} m · havza {{ detail.land.terrain.upstreamKm2?.toFixed(1) ?? '—' }} km²</dd></div>
                            </dl>
                        </section>
                        <section>
                            <h3 class="mb-2 text-sm font-semibold">Toprak (0–30 cm, OpenLandMap 250 m)</h3>
                            <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                                <div><dt class="text-xs text-muted-foreground">Bünye</dt><dd>{{ detail.land.soil.textureLabel ?? '—' }}</dd></div>
                                <div><dt class="text-xs text-muted-foreground">Kil / silt / kum</dt><dd>%{{ detail.land.soil.clayPct?.toFixed(0) ?? '—' }} / %{{ detail.land.soil.siltPct?.toFixed(0) ?? '—' }} / %{{ detail.land.soil.sandPct?.toFixed(0) ?? '—' }}</dd></div>
                                <div><dt class="text-xs text-muted-foreground">pH</dt><dd>{{ detail.land.soil.ph?.toFixed(1) ?? '—' }} · {{ detail.land.soil.phLabel ?? '—' }}</dd></div>
                                <div><dt class="text-xs text-muted-foreground">Organik karbon</dt><dd>%{{ detail.land.soil.socPct?.toFixed(1) ?? '—' }}</dd></div>
                                <div><dt class="text-xs text-muted-foreground">Hacim ağırlığı</dt><dd>{{ detail.land.soil.bulkDensity?.toFixed(2) ?? '—' }} g/cm³</dd></div>
                            </dl>
                        </section>
                        <section v-if="detail.land.climate">
                            <h3 class="mb-2 text-sm font-semibold">Parsel iklimi ({{ detail.land.climate.years[0] }}–{{ detail.land.climate.years.at(-1) }}, {{ detail.land.terrain.elevationM?.toFixed(0) ?? '—' }} m'ye {{ signed(detail.land.climate.offsetC, ' °C', 2) }} lapse)</h3>
                            <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                                <div><dt class="text-xs text-muted-foreground">Yıllık ortalama</dt><dd>{{ detail.land.climate.tmean.toFixed(1) }} °C</dd></div>
                                <div><dt class="text-xs text-muted-foreground">En düşük / en yüksek</dt><dd>{{ detail.land.climate.tminAbs.toFixed(1) }} / {{ detail.land.climate.tmaxAbs.toFixed(1) }} °C</dd></div>
                                <div><dt class="text-xs text-muted-foreground">Yağış</dt><dd>{{ formatNumber(detail.land.climate.precipMm) }} mm/yıl</dd></div>
                                <div><dt class="text-xs text-muted-foreground">Don günü / 30 °C+</dt><dd>{{ detail.land.climate.frostDays }} / {{ detail.land.climate.hotDays }} gün</dd></div>
                                <div><dt class="text-xs text-muted-foreground">Donsuz dönem</dt><dd>{{ detail.land.climate.frostFreeDays }} gün</dd></div>
                                <div><dt class="text-xs text-muted-foreground">Soğuklama (&lt; 7,2 °C)</dt><dd>{{ formatNumber(detail.land.climate.chillHours) }} saat</dd></div>
                                <div><dt class="text-xs text-muted-foreground">İlkbahar geç donu (15 Mar–30 Nis)</dt><dd>{{ detail.land.climate.springFrostDays }} gün</dd></div>
                                <div><dt class="text-xs text-muted-foreground">Haz–Tem nem · çiçeklenme yağışlı gün</dt><dd>%{{ num(detail.land.climate.rhSummer, 0) }} · {{ detail.land.climate.bloomRainDays }}</dd></div>
                            </dl>
                        </section>
                        <section>
                            <h3 class="mb-2 text-sm font-semibold">Kullanım: tapu ↔ uydu</h3>
                            <div class="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant="outline">Tapu: {{ DECLARED_LABEL[detail.land.landUse.declared] }}</Badge>
                                <Badge variant="outline"><span class="mr-1 inline-block size-2 rounded-sm" :style="{ background: USE_META[detail.land.landUse.observed].color }" />Uydu {{ detail.land.landUse.latestYear }}: {{ USE_META[detail.land.landUse.observed].label }}</Badge>
                                <span v-if="detail.land.landUse.teaShare !== null" class="text-xs text-muted-foreground">çay payı {{ pct(detail.land.landUse.teaShare) }}</span>
                                <Badge v-for="m in detail.land.landUse.mismatches" :key="m" :variant="MISMATCH_META[m].tone">{{ MISMATCH_META[m].label }}</Badge>
                            </div>
                            <div class="mt-3 flex flex-col gap-1">
                                <div v-for="h in detail.land.landUse.history" :key="h.year" class="flex items-center gap-2 text-xs">
                                    <span class="w-10 tabular-nums">{{ h.year }}</span>
                                    <div class="flex h-3 flex-1 overflow-hidden rounded bg-muted"><div v-for="(v, k) in h.fractions" :key="k" class="h-full" :style="{ width: `${(v ?? 0) * 100}%`, background: DW_COLOR[k as LandDwClass] }" :title="`${DW_LABEL[k as LandDwClass]} ${pct(v)}`" /></div>
                                    <span class="w-24 text-muted-foreground">{{ h.dominant ? DW_LABEL[h.dominant] : '—' }}</span>
                                </div>
                            </div>
                            <p v-if="detail.land.landUse.change" class="mt-2 text-xs text-muted-foreground">Baskın sınıf değişti: {{ detail.land.landUse.change.fromYear }} {{ DW_LABEL[detail.land.landUse.change.from] }} → {{ detail.land.landUse.change.toYear }} {{ DW_LABEL[detail.land.landUse.change.to] }}.</p>
                            <div v-if="detail.land.landUse.ndviHistory?.length" class="mt-3">
                                <div class="mb-1 text-xs text-muted-foreground">Landsat yaz NDVI tarihi (bitki örtüsü yoğunluğu; yoğun = ≥ 0,60 payı)</div>
                                <div v-for="h in detail.land.landUse.ndviHistory" :key="h.period" class="flex items-center gap-2 text-xs">
                                    <span class="w-20 tabular-nums">{{ h.period }}</span>
                                    <div class="h-2.5 flex-1 overflow-hidden rounded bg-muted"><div class="h-full bg-[#166534]" :style="{ width: `${(h.ndvi ?? 0) * 100}%` }" /></div>
                                    <span class="w-10 text-right tabular-nums">{{ num(h.ndvi, 2) }}</span>
                                    <span class="w-20 text-muted-foreground">yoğun {{ pct(h.denseShare) }}</span>
                                </div>
                            </div>
                        </section>
                        <section>
                            <h3 class="mb-2 text-sm font-semibold">Erozyon ve kabiliyet</h3>
                            <div class="flex flex-wrap items-center gap-2 text-sm">
                                <Badge :variant="EROSION_META[detail.land.erosion.class].tone">Erozyon {{ EROSION_META[detail.land.erosion.class].label }}</Badge>
                                <span v-if="detail.land.erosion.index !== null" class="text-xs text-muted-foreground">{{ detail.land.erosion.index }} t/ha/yıl · R {{ detail.land.erosion.factors.R }} · K {{ detail.land.erosion.factors.K }} · LS {{ detail.land.erosion.factors.LS }} · C {{ detail.land.erosion.factors.C }}</span>
                                <a v-for="s in refsOf(detail.land.erosion.sources)" :key="s.id" :href="s.url" target="_blank" rel="noopener" class="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground" :title="s.title">{{ shortRef(s) }}</a>
                            </div>
                            <div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
                                <span class="font-semibold" :style="{ color: detail.land.capability.akk ? AKK_COLOR[detail.land.capability.akk] : undefined }">AKK {{ detail.land.capability.akk ?? '—' }}</span>
                                <span class="text-xs text-muted-foreground">{{ detail.land.capability.akk ? AKK_HINT[detail.land.capability.akk] : '' }}</span>
                                <Badge v-if="detail.land.capability.law5403" :variant="LAW_META[detail.land.capability.law5403].tone">{{ detail.land.capability.law5403Label }}</Badge>
                                <a v-for="s in refsOf(detail.land.capability.sources)" :key="s.id" :href="s.url" target="_blank" rel="noopener" class="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground" :title="s.title">{{ shortRef(s) }}</a>
                            </div>
                            <p v-if="detail.land.capability.reasoning" class="mt-1 text-xs text-muted-foreground">{{ detail.land.capability.reasoning }}</p>
                            <ul v-if="detail.land.capability.limitations.length" class="mt-1 list-disc pl-5 text-xs text-muted-foreground"><li v-for="l in detail.land.capability.limitations" :key="l">{{ l }}</li></ul>
                        </section>
                        <section>
                            <h3 class="mb-2 text-sm font-semibold">Ürün uygunluğu (0–100, en düşük faktör belirler · ★ ilçe destek listesinde)</h3>
                            <div class="flex flex-col gap-1.5">
                                <details v-for="s in detail.land.suitability" :key="s.crop" class="group rounded-md border">
                                    <summary class="flex cursor-pointer list-none items-center gap-3 px-3 py-2 text-sm">
                                        <span class="w-32">{{ CROP_LABEL[s.crop] }}<span v-if="s.supported" class="ml-1 text-[10px] text-muted-foreground">★</span></span>
                                        <div class="h-3 flex-1 overflow-hidden rounded bg-muted"><div class="h-full" :style="{ width: `${s.score}%`, background: scoreColor(s.score) }" /></div>
                                        <span class="w-8 text-right tabular-nums">{{ s.score }}</span>
                                        <span class="hidden w-44 truncate text-xs text-muted-foreground sm:block">{{ s.limiting ?? 'sınırlama yok' }}</span>
                                    </summary>
                                    <div class="border-t px-3 py-2">
                                        <table class="w-full text-xs">
                                            <tbody>
                                                <tr v-for="f in s.factors" :key="f.key" class="border-b last:border-0">
                                                    <td class="py-1 pr-2">{{ f.label }}</td>
                                                    <td class="py-1 pr-2 text-right tabular-nums">{{ f.display }}</td>
                                                    <td class="py-1 pr-2 text-right"><Badge :variant="scoreTone(f.score)" class="text-[10px]">{{ f.score }}</Badge></td>
                                                    <td class="py-1 text-muted-foreground"><span v-if="f.note">{{ f.note }} </span><a v-for="src in refsOf(f.sources)" :key="src.id" :href="src.url" target="_blank" rel="noopener" class="mr-1 rounded border px-1 py-0.5 text-[10px] hover:text-foreground" :title="src.title">{{ shortRef(src) }}</a></td>
                                                </tr>
                                                <tr v-for="l in s.legal" :key="l.label" class="bg-muted/40">
                                                    <td class="py-1 pr-2" colspan="2">{{ l.label }}</td>
                                                    <td class="py-1 pr-2 text-right"><Badge :variant="l.status === 'ok' ? 'success' : l.status === 'fail' ? 'danger' : 'muted'" class="text-[10px]">{{ l.status === 'ok' ? 'sağlanıyor' : l.status === 'fail' ? 'sağlanmıyor' : '—' }}</Badge></td>
                                                    <td class="py-1 text-muted-foreground"><a v-for="src in refsOf(l.sources)" :key="src.id" :href="src.url" target="_blank" rel="noopener" class="mr-1 rounded border px-1 py-0.5 text-[10px] hover:text-foreground" :title="src.title">{{ shortRef(src) }}</a></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </details>
                            </div>
                        </section>
                    </div>
                </template>
            </SheetContent>
        </Sheet>
    </div>
</template>
