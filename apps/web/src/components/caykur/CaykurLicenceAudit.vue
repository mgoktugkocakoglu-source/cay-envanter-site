<script setup lang="ts">
import CaykurRemoteEvidence from '@/components/caykur/CaykurRemoteEvidence.vue';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight, Download, ScanSearch } from '@lucide/vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EmptyState, LoadingState, StatCard } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toneVariant, type Tone } from '@/components/caykur/tone';
import { useToast } from '@/composables/useToast';
import {
    api,
    saveBlob,
    type AuditBuildingState,
    type AuditConfidence,
    type AuditDecision,
    type AuditDecisionFilter,
    type AuditFlag,
    type AuditTeaState,
    type LicenceAuditDetail,
    type LicenceAuditRow,
    type LicenceAuditSummary,
} from '@/services/api';
import { formatM2 } from '@/services/caykur/teaInventory';
import { formatNumber } from '@/services/caykur';

/**
 * Licence audit (Arazi ön değerlendirmesi), a separate module under licensing: per cadastral parcel the TKGM deed title,
 * ÇAYKUR's licence register and a title-independent satellite detection are set side by side and bound to one
 * decision. It reads the other modules' data and changes none of it; the decision is a flag for an expert.
 */
const props = defineProps<{ areaId: string }>();

const ALL = 'all';
const PAGE_SIZE = 15;
const DECISION_META: Record<AuditDecision, { label: string; short: string; tone: Tone; t: boolean; l: boolean; d: boolean | null; note: string }> = {
    tea_land: { label: 'ÇAY ARAZİSİ', short: 'Çay arazisi', tone: 'success', t: true, l: true, d: true, note: 'Kayıtlar ve arazi okuması uyum yönünde; doğrulanmış gerçeklik değildir.' },
    licensing_error: { label: 'RUHSAT–ARAZİ UYUMSUZLUĞU ŞÜPHESİ', short: 'Ruhsat–arazi uyumsuzluğu şüphesi', tone: 'danger', t: false, l: true, d: false, note: 'Ruhsat kaydıyla tapu ve görüntü arasında fark var; kayıt ve kanıt incelemesi gerekli.' },
    unlicensed_tea: { label: 'RUHSAT KAYDIYLA EŞLEŞMEYEN ÇAY ADAYI', short: 'Kayıtla eşleşmeyen çay adayı', tone: 'danger', t: false, l: false, d: true, note: 'Görüntü çay yönünde; tapu niteliği farklı ve mevcut ruhsat listesinde eşleşme yok.' },
    unlicensed_tea_titled: { label: 'RUHSAT KAYDIYLA EŞLEŞMEYEN ÇAY ADAYI (tapuda çay)', short: 'Kayıtla eşleşmeyen aday (tapuda çay)', tone: 'warning', t: true, l: false, d: true, note: 'Tapu ve görüntü çay yönünde; mevcut ruhsat listesinde eşleşme yok. Gerçek kayıt kontrolü gerekli.' },
    licence_no_tea: { label: 'RUHSAT VAR, ÇAY TESPİTİ DESTEKLENMİYOR', short: 'Ruhsat var, çay tespiti desteklenmiyor', tone: 'danger', t: true, l: true, d: false, note: 'Tapu ve ruhsat kaydı çay yönünde; mevcut görüntü okuması bunu desteklemiyor. Nedeni belirlenmedi.' },
    title_outdated: { label: 'RUHSAT KAYDI İLE TAPU–GÖRÜNTÜ FARKI', short: 'Tapu–görüntü farkı', tone: 'info', t: false, l: true, d: true, note: 'Tapu niteliği ile ruhsat ve görüntü arasında fark var; hangi kaynağın güncel olduğu doğrulanmalı.' },
    title_only: { label: 'YALNIZ TAPUDA ÇAY', short: 'Yalnız tapuda çay', tone: 'muted', t: true, l: false, d: false, note: 'Tapuda çay niteliği var; ruhsat eşleşmesi ve görüntü desteği bulunamadı.' },
    out_of_scope: { label: 'KAPSAM DIŞI', short: 'Kapsam dışı', tone: 'muted', t: false, l: false, d: false, note: 'Üç kaynakta da çay yok.' },
    needs_review: { label: 'İNCELEME GEREKLİ', short: 'İnceleme gerekli', tone: 'warning', t: false, l: false, d: null, note: 'Uydu tespiti kararsız, parsel çok küçük ya da kanıt bir bulgu için yetersiz.' },
};
const TABLE_ORDER: AuditDecision[] = ['tea_land', 'licensing_error', 'unlicensed_tea', 'unlicensed_tea_titled', 'licence_no_tea', 'title_outdated', 'title_only', 'out_of_scope'];
const DECISION_FILTERS: Array<{ value: AuditDecisionFilter | typeof ALL; label: string }> = [
    { value: 'attention', label: 'Bakılması gerekenler (bulgular + inceleme)' },
    { value: 'findings', label: 'Bulgular (hata, ruhsatsız çay, çaysız ruhsat)' },
    { value: ALL, label: 'Bütün parseller' },
    ...(['tea_land', 'licensing_error', 'unlicensed_tea', 'unlicensed_tea_titled', 'licence_no_tea', 'title_outdated', 'title_only', 'out_of_scope', 'needs_review'] as AuditDecision[]).map((d) => ({ value: d, label: DECISION_META[d].short })),
];
const CONFIDENCE_META: Record<AuditConfidence, { label: string; tone: Tone }> = {
    high: { label: 'güven yüksek', tone: 'success' },
    medium: { label: 'güven orta', tone: 'info' },
    low: { label: 'güven düşük', tone: 'warning' },
};
const TEA_LABEL: Record<AuditTeaState, string> = { present: 'çay var', absent: 'çay yok', inconclusive: 'kararsız', not_assessable: 'değerlendirilemiyor' };
const BUILDING_LABEL: Record<AuditBuildingState, string> = { inside: 'parselde yapı var', boundary: 'sınırda yapı var', none: 'yapı izi yok', unknown: 'yapı verisi yok' };
const FLAG_LABEL: Record<AuditFlag, string> = {
    area_over: 'Ruhsat alanı ile uydu alan tahmini arasında fark var',
    area_under: 'Sahadaki çay ruhsat alanından belirgin büyük',
    building_not_in_title: 'Parselde yapı var, tapu niteliğinde yok',
    title_building_not_seen: 'Tapuda yapı var, bina izi bulunamadı (küçük ve ağaç altındaki evler veri setinde çoğu kez yoktur)',
    public_land: 'Tapu kamu arazisi (orman / hazine / mera)',
    beyond_training: 'Parsel, modelin eğitildiği çay parsellerinden yüksekte',
    small_parcel: 'Parsel 10 m piksel ağı için küçük',
    detectors_disagree: 'Envanter tespiti ile nitelikten bağımsız tespit ayrışıyor',
    expert_confirmed: 'Saha gözlemi var (eksper teyidi ya da arazi notu)',
    licence_unverified: 'DEMO ruhsat kaydı bu parseli kapsamıyor; “ruhsat yok” gerçek ÇAYKUR listesiyle doğrulanmalı',
    large_parcel: 'Parsel çok büyük: çay cebi parsel payıyla ölçülemez, bahçe sınırıyla bakılmalı',
};
const GROUP_LABEL: Record<string, string> = { tea: 'Çay bahçesi (tapu)', forest: 'Orman (tapu)', hazelnut: 'Fındık bahçesi (tapu)', landcover: 'Çayır / tarla / yapı (arazi örtüsü haritası)' };

const toast = useToast();
const summary = ref<LicenceAuditSummary | null>(null);
const isLoading = ref(true);
const rows = ref<LicenceAuditRow[]>([]);
const total = ref(0);
const page = ref(1);
const pages = ref(1);
const isLoadingRows = ref(false);
const decisionFilter = ref<AuditDecisionFilter | typeof ALL>('attention');
const search = ref('');
let searchTimer: ReturnType<typeof setTimeout> | null = null;

const detail = ref<LicenceAuditDetail | null>(null);
const isLoadingDetail = ref(false);
const shiftEast = ref(0);
const shiftNorth = ref(0);
const isDownloading = ref(false);
const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let shiftedLayer: L.GeoJSON | null = null;
const sheetOpen = computed({
    get: () => detail.value !== null || isLoadingDetail.value,
    set: (open: boolean) => {
        if (!open) {
            detail.value = null;
            map?.remove();
            map = null;
        }
    },
});

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `%${Math.round(v * 100)}`);
const num = (v: number | null | undefined, digits = 2) => (v === null || v === undefined ? '—' : v.toFixed(digits));
const unlicensed = computed(() => (summary.value ? summary.value.summary.byDecision.unlicensed_tea + summary.value.summary.byDecision.unlicensed_tea_titled : 0));

function cssVar(name: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
/** Moves an outline by metres east / north: for looking at it against the imagery, never for the record. */
function shifted(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon, eastM: number, northM: number): GeoJSON.Polygon | GeoJSON.MultiPolygon {
    const move = ([lng, lat]: GeoJSON.Position): GeoJSON.Position => [lng + eastM / (111_320 * Math.cos((lat * Math.PI) / 180)), lat + northM / 110_540];
    return geometry.type === 'Polygon' ? { type: 'Polygon', coordinates: geometry.coordinates.map((ring) => ring.map(move)) } : { type: 'MultiPolygon', coordinates: geometry.coordinates.map((poly) => poly.map((ring) => ring.map(move))) };
}

async function loadSummary(): Promise<void> {
    isLoading.value = true;
    const res = await api.getLicenceAuditSummary(props.areaId);
    isLoading.value = false;
    summary.value = res.data ?? null;
    if (res.data) await loadRows();
}
async function loadRows(): Promise<void> {
    isLoadingRows.value = true;
    const res = await api.getLicenceAuditParcels(props.areaId, { page: page.value, limit: PAGE_SIZE, decision: decisionFilter.value === ALL ? undefined : decisionFilter.value, search: search.value.trim() || undefined });
    isLoadingRows.value = false;
    if (!res.data) {
        toast.error(res.error?.message ?? 'Parsel listesi alınamadı');
        return;
    }
    rows.value = res.data.data;
    total.value = res.data.meta.total;
    pages.value = Math.max(1, res.data.meta.totalPages);
}
async function open(row: LicenceAuditRow): Promise<void> {
    isLoadingDetail.value = true;
    shiftEast.value = 0;
    shiftNorth.value = 0;
    const res = await api.getLicenceAuditParcel(props.areaId, row.block, row.parcel);
    isLoadingDetail.value = false;
    if (!res.data) {
        toast.error(res.error?.message ?? 'Parsel alınamadı');
        return;
    }
    detail.value = res.data;
    await nextTick();
    // The sheet animates in: Leaflet needs the container at its final size.
    setTimeout(renderMap, 250);
}
function renderMap(): void {
    map?.remove();
    map = null;
    shiftedLayer = null;
    const d = detail.value;
    if (!mapContainer.value || !d) return;
    map = L.map(mapContainer.value, { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 21, maxNativeZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    if (d.buildings.length) {
        const red = cssVar('--destructive', '#b91c1c');
        L.geoJSON({ type: 'FeatureCollection', features: d.buildings.map((b) => ({ type: 'Feature', geometry: b.geometry, properties: {} })) } as GeoJSON.FeatureCollection, { style: { color: red, weight: 1.5, fillColor: red, fillOpacity: 0.25 } })
            .bindTooltip('Yapı izi (Microsoft bina izleri)', { sticky: true })
            .addTo(map);
    }
    const parcel = L.geoJSON({ type: 'Feature', geometry: d.geometry, properties: {} } as GeoJSON.Feature, { style: { color: '#facc15', weight: 3, fill: false } }).addTo(map);
    map.fitBounds(parcel.getBounds(), { padding: [40, 40], maxZoom: 19 });
    renderShift();
}
function renderShift(): void {
    if (!map || !detail.value) return;
    shiftedLayer?.remove();
    shiftedLayer = null;
    if (shiftEast.value === 0 && shiftNorth.value === 0) return;
    shiftedLayer = L.geoJSON({ type: 'Feature', geometry: shifted(detail.value.geometry, shiftEast.value, shiftNorth.value), properties: {} } as GeoJSON.Feature, { style: { color: '#fb923c', weight: 2, dashArray: '6 4', fill: false } }).addTo(map);
}
function nudge(east: number, north: number): void {
    shiftEast.value = Math.max(-50, Math.min(50, shiftEast.value + east));
    shiftNorth.value = Math.max(-50, Math.min(50, shiftNorth.value + north));
    renderShift();
}
function resetShift(): void {
    shiftEast.value = 0;
    shiftNorth.value = 0;
    renderShift();
}
async function downloadKml(): Promise<void> {
    if (!detail.value) return;
    isDownloading.value = true;
    const res = await api.downloadLicenceAuditKml(props.areaId, detail.value.block, detail.value.parcel, shiftEast.value, shiftNorth.value);
    isDownloading.value = false;
    if (!res.blob) {
        toast.error(res.error ?? 'KML üretilemedi');
        return;
    }
    saveBlob(res.blob, res.filename ?? `${detail.value.block}-${detail.value.parcel}.kml`);
}
function onDecision(v: unknown): void {
    if (typeof v === 'string' && DECISION_FILTERS.some((f) => f.value === v)) decisionFilter.value = v as AuditDecisionFilter | typeof ALL;
}
watch(decisionFilter, () => {
    page.value = 1;
    void loadRows();
});
watch(search, () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        page.value = 1;
        void loadRows();
    }, 300);
});
watch(page, () => void loadRows());
watch(() => props.areaId, () => void loadSummary(), { immediate: true });
onBeforeUnmount(() => {
    if (searchTimer) clearTimeout(searchTimer);
    map?.remove();
});
</script>

<template>
    <div class="flex flex-col gap-6">
        <LoadingState v-if="isLoading" text="Arazi ön değerlendirmesi yükleniyor…" />
        <EmptyState v-else-if="!summary" :icon="ScanSearch" title="Bu mahalle için arazi tespit kararı yok" description="Motor tarafında audit-licensing çalıştırıldığında burada görünür: her parsel için tapu niteliği, ÇAYKUR ruhsat kaydı ve uydu tespiti yan yana konur." />
        <template v-else>
            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle class="flex flex-wrap items-center gap-2">
                        Arazi ön değerlendirmesi
                        <Badge v-if="summary.licenceSource === 'demo'" variant="warning">DEMO ruhsat kaydı</Badge>
                        <Badge variant="outline">Eksper için işaret, hukuki karar değil</Badge>
                    </CardTitle>
                    <CardDescription>
                        Her parsel için üç bağımsız kaynak yan yana konur: <strong>TKGM tapu niteliği</strong>, <strong>ÇAYKUR ruhsat kaydı</strong> ve <strong>uydu tespiti</strong> (çay ve yapı).
                        Uydu tespiti tapu niteliğinden bağımsızdır: denetlenen nitelikler (çayır, tarla, karma) eğitimde kullanılmaz, rakım ve eğim modele girmez, kar maskelenir.
                        Kural tek yönlü katıdır: birinin aleyhine olan bir bulgu (ruhsatlandırma hatası, ruhsatsız çay) ancak kanıt açıksa verilir; kararsız, küçük ya da zayıf kanıtlı parsel “inceleme gerekli” olur ve hangi karara yakın olduğu yazılır.
                        <template v-if="summary.licenceSource === 'demo'">
                            Gerçek ÇAYKUR ruhsat listesi henüz verilmediği için ruhsat sütunu DEMO kayıttan gelir; ruhsata dayanan kararlar da o yüzden gösterim amaçlıdır.
                            <template v-if="summary.demoLicences">{{ summary.demoLicences.note }}</template>
                        </template>
                    </CardDescription>
                </CardHeader>
            </Card>

            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Çay arazisi" :value="formatNumber(summary.summary.byDecision.tea_land)" :hint="`${formatNumber(summary.summary.parcels)} parselden · kayıtlar ve arazi okuması uyum yönünde`" :icon="ScanSearch" />
                <StatCard label="Ruhsat–arazi uyumsuzluğu şüphesi" :value="formatNumber(summary.summary.byDecision.licensing_error)" :hint="`ayrıca ${summary.summary.byDecision.licence_no_tea} parselde ruhsat var, çay yok`" />
                <StatCard label="Ruhsat kaydıyla eşleşmeyen çay adayı" :value="formatNumber(unlicensed)" :hint="`${summary.summary.byDecision.unlicensed_tea} tapuda çay yok · ${summary.summary.byDecision.unlicensed_tea_titled} tapuda çay var · ≈ ${formatM2(summary.summary.areaM2.unlicensedTea)}`" />
                <StatCard label="İnceleme gerekli" :value="formatNumber(summary.summary.byDecision.needs_review)" hint="kararsız, küçük ya da zayıf kanıtlı parsel; ek görüntü veya kayıt incelemesi gerekli" />
            </div>

            <div class="grid gap-4 lg:grid-cols-2">
                <Card class="gap-0 py-0">
                    <CardHeader class="py-4">
                        <CardTitle>Karar tablosu</CardTitle>
                        <CardDescription>Üç kaynağın sekiz birleşimi ve her birine verilen karar. İlk üç satır modülün asıl kararlarıdır; diğerleri hiçbir parsel açıkta kalmasın diye adlandırılmıştır.</CardDescription>
                    </CardHeader>
                    <CardContent class="border-t px-0 pb-0">
                        <div class="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tapu</TableHead>
                                        <TableHead>Ruhsat</TableHead>
                                        <TableHead>Saha</TableHead>
                                        <TableHead>Ön değerlendirme</TableHead>
                                        <TableHead class="text-right">Parsel</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow v-for="d in TABLE_ORDER" :key="d">
                                        <TableCell class="text-sm">{{ DECISION_META[d].t ? 'çay' : '—' }}</TableCell>
                                        <TableCell class="text-sm">{{ DECISION_META[d].l ? 'var' : '—' }}</TableCell>
                                        <TableCell class="text-sm">{{ DECISION_META[d].d ? 'çay' : '—' }}</TableCell>
                                        <TableCell>
                                            <Badge :variant="toneVariant(DECISION_META[d].tone)">{{ DECISION_META[d].short }}</Badge>
                                            <div class="mt-1 text-xs text-muted-foreground">{{ DECISION_META[d].note }}</div>
                                        </TableCell>
                                        <TableCell class="text-right font-semibold tabular-nums">{{ summary.summary.byDecision[d] }}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell colspan="3" class="text-sm text-muted-foreground">arazi okuması belirsiz</TableCell>
                                        <TableCell>
                                            <Badge variant="warning">İnceleme gerekli</Badge>
                                            <div class="mt-1 text-xs text-muted-foreground">{{ DECISION_META.needs_review.note }}</div>
                                        </TableCell>
                                        <TableCell class="text-right font-semibold tabular-nums">{{ summary.summary.byDecision.needs_review }}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <Card class="gap-0 py-0">
                    <CardHeader class="py-4">
                        <CardTitle>Uydu tespiti ne kadar güvenilir</CardTitle>
                        <CardDescription>
                            Ayrılmış test parsellerinde doğruluk {{ pct(summary.model.heldOut.accuracy) }}; çay parsellerinin {{ pct(summary.model.heldOut.teaRecall) }} kadarı yakalanıyor, “çay” denen piksellerin {{ pct(summary.model.heldOut.teaPrecision) }} kadarı gerçekten çay tapulu.
                            Bu sayılar tapu niteliği temiz olan sınıflarla uyumu ölçer; saha doğrulaması değildir.
                            Eğitimdeki en yüksek çay parseli {{ summary.model.maxTrainingTeaElevationM ?? '—' }} m: bunun üstündeki parsellerde uydu sonucu tek başına bulgu sayılmaz.
                            <template v-if="summary.fieldCheck && summary.fieldCheck.teaNoted">
                                Arazi notlarıyla karşılaştırma: sahada “çay var” denen {{ summary.fieldCheck.teaNoted }} parselin {{ summary.fieldCheck.teaNotedDetected }} tanesinde uydu da çay görüyor, {{ summary.fieldCheck.teaNotedInconclusive }} tanesinde kararsız, {{ summary.fieldCheck.teaNotedMissed }} tanesinde görmüyor.
                            </template>
                        </CardDescription>
                    </CardHeader>
                    <CardContent class="flex flex-col gap-3 border-t pt-4 pb-4">
                        <div class="overflow-x-auto rounded-lg border bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Test grubu</TableHead>
                                        <TableHead class="text-right">Piksel</TableHead>
                                        <TableHead class="text-right">“Çay” denen pay</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow v-for="g in summary.model.byGroup" :key="g.group">
                                        <TableCell class="text-sm">{{ GROUP_LABEL[g.group] ?? g.group }}</TableCell>
                                        <TableCell class="text-right text-sm tabular-nums">{{ g.pixels }}</TableCell>
                                        <TableCell class="text-right text-sm tabular-nums">{{ pct(g.calledTea['0.5']) }}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                        <div class="overflow-x-auto rounded-lg border bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Rakım</TableHead>
                                        <TableHead class="text-right">Çay / çay değil piksel</TableHead>
                                        <TableHead class="text-right">Çay yakalama</TableHead>
                                        <TableHead class="text-right">Doğruluk</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow v-for="b in summary.model.byElevation" :key="b.band">
                                        <TableCell class="text-sm">{{ b.band }}</TableCell>
                                        <TableCell class="text-right text-sm tabular-nums">{{ b.pixels.tea }} / {{ b.pixels.nonTea }}</TableCell>
                                        <TableCell class="text-right text-sm tabular-nums">{{ b.pixels.tea ? pct(b.teaRecall) : 'çay örneği yok' }}</TableCell>
                                        <TableCell class="text-right text-sm tabular-nums">{{ pct(b.accuracy) }}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                        <p class="text-sm">
                            Tapu × arazi okuması ({{ summary.summary.parcels - summary.summary.titleVsGround.unknown }} değerlendirilebilen parsel): ikisinde de çay {{ summary.summary.titleVsGround.titleTeaGroundTea }}, tapuda çay, arazi okumasında destek yok {{ summary.summary.titleVsGround.titleTeaGroundNone }},
                            <strong>tapuda farklı nitelik, arazi okumasında çay adayı {{ summary.summary.titleVsGround.titleOtherGroundTea }}</strong>, ikisinde de yok {{ summary.summary.titleVsGround.titleOtherGroundNone }}.
                        </p>
                        <p class="text-xs text-muted-foreground">Yapı tespiti: {{ summary.buildingSource }}. Küçük ve ağaç altındaki evler bu veri setinde çoğu kez yoktur; bina izinin olmaması yapı olmadığını göstermez, bu yüzden yapı bilgisi kararı değiştirmez, yalnızca işaret olarak gösterilir.</p>
                    </CardContent>
                </Card>
            </div>

            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Parseller</CardTitle>
                    <CardDescription>{{ formatNumber(total) }} parsel · satıra tıklayınca parselin Google uydu görüntüsü üzerindeki çizimi, üç kaynağın ayrıntısı ve Google Earth (KML) çıktısı</CardDescription>
                    <div class="flex flex-wrap items-end gap-3 pt-2">
                        <Select :model-value="decisionFilter" @update:model-value="onDecision">
                            <SelectTrigger class="h-11 w-full sm:w-96 md:h-9" aria-label="Karar filtresi"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="f in DECISION_FILTERS" :key="f.value" :value="f.value">{{ f.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Input v-model="search" type="search" class="h-11 w-full sm:w-64 md:h-9" placeholder="Ada/parsel (227/5), nitelik, mevkii" aria-label="Parsel ara" />
                    </div>
                </CardHeader>
                <CardContent class="border-t px-0 pb-0">
                    <LoadingState v-if="isLoadingRows && rows.length === 0" text="Parseller yükleniyor…" class="p-6" />
                    <p v-else-if="rows.length === 0" class="p-6 text-sm text-muted-foreground">Bu filtreye uyan parsel yok.</p>
                    <div v-else class="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Parsel</TableHead>
                                    <TableHead>TKGM tapu niteliği</TableHead>
                                    <TableHead>ÇAYKUR ruhsatı</TableHead>
                                    <TableHead>Uydu tespiti</TableHead>
                                    <TableHead>Ön değerlendirme</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="r in rows" :key="r.key" class="cursor-pointer" tabindex="0" role="button" :aria-label="`${r.block}/${r.parcel} parselinin ayrıntısını aç`" @click="open(r)" @keydown.enter="open(r)">
                                    <TableCell>
                                        <div class="font-medium">{{ r.block }}/{{ r.parcel }}</div>
                                        <div class="text-xs text-muted-foreground">{{ r.locality || 'mevkii yok' }} · {{ formatM2(r.areaM2) }}</div>
                                    </TableCell>
                                    <TableCell class="text-sm">
                                        {{ r.nature }}
                                        <div class="text-xs text-muted-foreground">{{ r.title.tea ? 'çay var' : 'çay yok' }}{{ r.title.building ? ' · yapı var' : '' }}</div>
                                    </TableCell>
                                    <TableCell class="text-sm">
                                        <template v-if="r.licence.licensed">{{ r.licence.areaM2 === null ? 'ruhsatlı' : formatM2(r.licence.areaM2) }}<div class="text-xs text-muted-foreground">{{ r.licence.codes.join(', ') }}</div></template>
                                        <span v-else class="text-muted-foreground">kayıt yok</span>
                                    </TableCell>
                                    <TableCell class="text-sm">
                                        {{ TEA_LABEL[r.detection.tea] }}
                                        <div v-if="r.confirmation" class="text-xs text-muted-foreground">Ayrı geçmiş gözlem kaydı var; ayrıntıda gösterilir.</div>
                                        <span v-if="r.detection.teaShare !== null" class="tabular-nums"> · {{ pct(r.detection.teaShare) }}</span>
                                        <div class="text-xs text-muted-foreground">{{ r.detection.teaAreaM2 === null ? '' : `≈ ${formatM2(r.detection.teaAreaM2)} çay · ` }}{{ BUILDING_LABEL[r.building.state] }}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge :variant="toneVariant(DECISION_META[r.decision].tone)">{{ DECISION_META[r.decision].short }}</Badge>
                                        <div class="mt-1 text-xs text-muted-foreground">
                                            {{ CONFIDENCE_META[r.confidence].label }}<template v-if="r.decision === 'needs_review'"> · eğilim: {{ DECISION_META[r.leaning].short }}</template>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <div v-if="pages > 1" class="flex items-center justify-between border-t p-4">
                        <span class="text-sm text-muted-foreground">Sayfa {{ page }} / {{ pages }}</span>
                        <div class="flex gap-2">
                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page <= 1" aria-label="Önceki sayfa" @click="page--"><ChevronLeft aria-hidden="true" /></Button>
                            <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page >= pages" aria-label="Sonraki sayfa" @click="page++"><ChevronRight aria-hidden="true" /></Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </template>

        <Sheet v-model:open="sheetOpen">
            <SheetContent class="w-full overflow-y-auto sm:max-w-2xl">
                <LoadingState v-if="isLoadingDetail" text="Parsel yükleniyor…" class="p-6" />
                <template v-else-if="detail">
                    <SheetHeader class="border-b">
                        <SheetTitle>{{ summary?.neighborhood }} {{ detail.block }}/{{ detail.parcel }}</SheetTitle>
                        <SheetDescription>{{ detail.locality || 'mevkii yok' }} · tapu alanı {{ detail.deedAreaM2 === null ? '—' : formatM2(detail.deedAreaM2) }} · geometri {{ formatM2(detail.areaM2) }}</SheetDescription>
                        <div class="flex flex-wrap items-center gap-2">
                            <Badge :variant="toneVariant(DECISION_META[detail.decision].tone)">{{ DECISION_META[detail.decision].label }}</Badge>
                            <Badge :variant="toneVariant(CONFIDENCE_META[detail.confidence].tone)">{{ CONFIDENCE_META[detail.confidence].label }}</Badge>
                            <Badge v-if="detail.decision === 'needs_review'" variant="outline">eğilim: {{ DECISION_META[detail.leaning].short }}</Badge>
                        </div>
                    </SheetHeader>
                    <div class="flex flex-col gap-4 p-4 text-sm">
                        <details class="text-sm"><summary class="min-h-11 cursor-pointer py-3">Arşiv raporunun özgün açıklaması</summary><p>Eski model ifadesidir; idari karar veya güncel doğrulama değildir.</p><p>{{ detail.reason }}</p></details>

                        <div class="flex flex-col gap-2">
                            <div ref="mapContainer" class="h-80 w-full overflow-hidden rounded-lg border" />
                            <p class="text-xs text-muted-foreground">
                                Sarı çizgi: TKGM parsel sınırı (WGS84, olduğu gibi). Kırmızı: bina izleri. Görüntü: Google uydu.
                                Dik arazide uydu görüntüsü birkaç metre kayık olabilir; aşağıdaki düğmeler yalnızca turuncu kesikli kopyayı görüntüye hizalar, kadastro kaydı değişmez.
                            </p>
                            <div class="flex flex-wrap items-center gap-2">
                                <Label class="text-xs text-muted-foreground">Görsel hizalama</Label>
                                <Button variant="outline" class="h-11 px-3 md:h-9" aria-label="1 metre batıya kaydır" @click="nudge(-1, 0)">← Batı</Button>
                                <Button variant="outline" class="h-11 px-3 md:h-9" aria-label="1 metre doğuya kaydır" @click="nudge(1, 0)">Doğu →</Button>
                                <Button variant="outline" class="h-11 px-3 md:h-9" aria-label="1 metre kuzeye kaydır" @click="nudge(0, 1)">↑ Kuzey</Button>
                                <Button variant="outline" class="h-11 px-3 md:h-9" aria-label="1 metre güneye kaydır" @click="nudge(0, -1)">↓ Güney</Button>
                                <Button variant="ghost" class="h-11 px-3 md:h-9" :disabled="shiftEast === 0 && shiftNorth === 0" @click="resetShift">Sıfırla</Button>
                                <span class="text-xs tabular-nums text-muted-foreground">{{ shiftEast }} m doğu · {{ shiftNorth }} m kuzey</span>
                            </div>
                            <Button variant="outline" class="h-11 self-start md:h-9" :disabled="isDownloading" @click="downloadKml"><Download aria-hidden="true" />{{ isDownloading ? 'Hazırlanıyor…' : 'Google Earth için indir (KML)' }}</Button>
                        </div>

                        <div class="overflow-x-auto rounded-lg border bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Kaynak</TableHead>
                                        <TableHead>Çay</TableHead>
                                        <TableHead>Yapı</TableHead>
                                        <TableHead>Ayrıntı</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow>
                                        <TableCell class="font-medium">TKGM tapu niteliği</TableCell>
                                        <TableCell>{{ detail.title.tea ? 'var' : 'yok' }}</TableCell>
                                        <TableCell>{{ detail.title.building ? 'var' : 'yok' }}</TableCell>
                                        <TableCell class="text-xs text-muted-foreground">{{ detail.nature }}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell class="font-medium">ÇAYKUR ruhsat kaydı</TableCell>
                                        <TableCell>{{ detail.licence.licensed ? 'ruhsatlı' : 'kayıt yok' }}</TableCell>
                                        <TableCell>—</TableCell>
                                        <TableCell class="text-xs text-muted-foreground">{{ detail.licence.licensed ? `${detail.licence.codes.join(', ')}${detail.licence.areaM2 === null ? '' : ` · ${formatM2(detail.licence.areaM2)}`}` : '' }}{{ detail.licence.source === 'demo' ? ' DEMO kayıt' : '' }}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell class="font-medium">Uydu tespiti</TableCell>
                                        <TableCell>{{ TEA_LABEL[detail.detection.tea] }}</TableCell>
                                        <TableCell>{{ BUILDING_LABEL[detail.building.state] }}</TableCell>
                                        <TableCell class="text-xs text-muted-foreground">parselin {{ pct(detail.detection.teaShare) }} kadarı çay{{ detail.detection.teaAreaM2 === null ? '' : ` (≈ ${formatM2(detail.detection.teaAreaM2)})` }} · {{ detail.building.count }} bina izi{{ detail.building.insideM2 ? `, ${formatM2(detail.building.insideM2)} parsel içinde` : '' }}</TableCell>
                                    </TableRow>
                                    <TableRow v-if="detail.confirmation">
                                        <TableCell class="font-medium">Geçmiş gözlem kaydı</TableCell>
                                        <TableCell>{{ detail.confirmation.tea === null ? '—' : detail.confirmation.tea ? (detail.confirmation.sparse ? 'var, seyrek' : 'var') : 'yok' }}</TableCell>
                                        <TableCell>{{ detail.confirmation.building === null ? '—' : detail.confirmation.building ? 'var' : 'yok' }}</TableCell>
                                        <TableCell class="text-xs text-muted-foreground">{{ detail.confirmation.source }} · {{ detail.confirmation.date }}<template v-if="detail.confirmation.note"> · {{ detail.confirmation.note }}</template></TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>

                        <div class="rounded-lg border bg-muted/40 p-3">
                            <div class="font-medium">Uydu kanıtı</div>
                            <div class="grid gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground sm:grid-cols-2">
                                <span>Çay olasılığı (ortalama): {{ num(detail.detection.teaProbability) }}</span>
                                <span>Yaz NDVI: {{ num(detail.detection.ndviSummer) }}</span>
                                <span>Yaprak dökümü dönemi NDVI (karsız): {{ num(detail.detection.ndviLeafOff) }}</span>
                                <span>Herdem yeşillik oranı: {{ num(detail.detection.evergreen) }} (çay ≈ 0,85–1)</span>
                                <span>Radar VH (yaz): {{ num(detail.detection.vhSummer, 1) }} dB</span>
                                <span>Rakım: {{ detail.detection.elevationM ?? '—' }} m</span>
                                <span>Karsız kış gözlemi: {{ detail.detection.leafOffObs ?? '—' }}</span>
                                <span>Yaklaşık piksel eşdeğeri (parsel alanı / 100 m²): {{ detail.detection.fullPixels }}</span>
                                <span>Envanter tespiti (karşılaştırma): {{ pct(detail.detection.inventoryShare) }}</span>
                            </div>
                        </div>

                        <p class="text-xs text-muted-foreground">Piksel eşdeğeri, parsel alanından hesaplanır; parsel içine bütünüyle düşen gerçek uydu piksellerinin sayısı değildir. Dar ve parçalı parsellerde komşu örtü etkisini ölçmez. Tapu niteliği arazi gözlemi değildir. Geçmiş gözlem, uydu okumasından ayrı bir kaynaktır. Sonuç ön değerlendirmedir, idari karar değildir.</p>
                        <CaykurRemoteEvidence :area-id="areaId" :block="detail.block" :parcel="detail.parcel" />
                        <div v-if="detail.flags.length" class="rounded-lg border p-3">
                            <div class="font-medium">İşaretler</div>
                            <ul class="list-disc pl-4 pt-1 text-xs text-muted-foreground">
                                <li v-for="f in detail.flags" :key="f">{{ FLAG_LABEL[f] }}</li>
                            </ul>
                        </div>
                    </div>
                </template>
            </SheetContent>
        </Sheet>
    </div>
</template>
