<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { ChevronLeft, ChevronRight, Download, ShieldCheck, TriangleAlert, Users } from '@lucide/vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EmptyState, ListToolbar, LoadingState, SearchInput, StatCard } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toneVariant } from '@/components/caykur/tone';
import ProducerProgressChart from '@/components/caykur/ProducerProgressChart.vue';
import { useToast } from '@/composables/useToast';
import { useAuthStore } from '@/stores/authStore';
import {
    api,
    type InventoryMap,
    type ProducerDetail,
    type ProducerPruningStatus,
    type ProducerRow,
    type ProducerSummary,
} from '@/services/api';
import { PRODUCER_STATUS_META, PRODUCER_STATUS_ORDER, formatM2, formatShare } from '@/services/caykur/teaInventory';
import { formatNumber } from '@/services/caykur';

/**
 * Producer-level pruning: each producer's gardens together against the 1/7 rule, re-checked
 * every scan (≤ 5 days). Very-high-confidence results open purchase automatically; everything
 * else waits for an expert, who approves (opens purchase) or rejects (closes it).
 */
const props = defineProps<{
    areaId: string;
    mapData: InventoryMap;
}>();

const ALL = 'all';
const PAGE_SIZE = 15;
const DECIDE_ROLES = ['kurum_admin', 'fabrika_sorumlusu', 'saha_personeli'];
const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const toast = useToast();
const auth = useAuthStore();

const summary = ref<ProducerSummary | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);
const view = ref<'producers' | 'purchase'>('producers');
const statusFilter = ref<ProducerPruningStatus | typeof ALL>(ALL);
const search = ref('');
const page = ref(1);
const rows = ref<ProducerRow[]>([]);
const total = ref(0);
const totalPages = ref(1);
const isLoadingRows = ref(false);
const isDownloading = ref(false);

const sheetOpen = ref(false);
const detail = ref<ProducerDetail | null>(null);
const note = ref('');
const isDeciding = ref(false);
const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;

const schedule = computed(() => summary.value?.schedule ?? null);
const canDecide = computed(() => auth.isAdmin || DECIDE_ROLES.includes(auth.caykurRole ?? ''));
const freshScans = computed(() => schedule.value?.newObservation.filter(Boolean).length ?? 0);
const scanStrip = computed(() =>
    (schedule.value?.scanDates ?? []).map((date, i) => ({
        date,
        fresh: schedule.value?.newObservation[i] ?? false,
        scenes: schedule.value?.sceneDates[i] ?? [],
    })),
);

function fmtDate(d: string | null | undefined): string {
    if (!d) return '—';
    return `${Number(d.slice(8, 10))} ${MONTHS_TR.at(Number(d.slice(5, 7)) - 1)} ${d.slice(0, 4)}`;
}
function seasonLabel(s: string | undefined): string {
    if (!s) return '';
    const [a, b] = s.split('-');
    return `${a}–20${b}`;
}

// ── Loading ──
async function loadSummary(): Promise<void> {
    const res = await api.getInventoryProducerSummary(props.areaId);
    if (res.data) summary.value = res.data;
    else error.value = res.error?.message ?? 'Müstahsil verisi alınamadı';
}

async function loadRows(): Promise<void> {
    isLoadingRows.value = true;
    const res = view.value === 'purchase'
        ? await api.getInventoryPurchaseList(props.areaId, page.value, PAGE_SIZE)
        : await api.getInventoryProducers(props.areaId, {
            page: page.value,
            limit: PAGE_SIZE,
            status: statusFilter.value === ALL ? undefined : statusFilter.value,
            search: search.value.trim() || undefined,
        });
    if (res.data) {
        rows.value = res.data.data;
        total.value = res.data.meta.total;
        totalPages.value = Math.max(1, res.data.meta.totalPages);
    }
    isLoadingRows.value = false;
}

async function openProducer(id: string): Promise<void> {
    const res = await api.getInventoryProducer(id);
    if (!res.data) {
        toast.error(res.error?.message ?? 'Müstahsil açılamadı');
        return;
    }
    detail.value = res.data;
    note.value = '';
    sheetOpen.value = true;
    await nextTick();
    // The sheet animates in; draw once its box has its final size.
    setTimeout(renderGardenMap, 250);
}

async function decide(decision: 'approved' | 'rejected'): Promise<void> {
    if (!detail.value) return;
    if (decision === 'rejected' && !note.value.trim()) {
        toast.error('Reddetmek için gerekçe yazın');
        return;
    }
    isDeciding.value = true;
    const res = await api.decideInventoryProducer(detail.value.id, { decision, note: note.value.trim() || undefined });
    isDeciding.value = false;
    if (!res.data) {
        toast.error(res.error?.message ?? 'Karar kaydedilemedi');
        return;
    }
    detail.value = res.data;
    note.value = '';
    toast.success(decision === 'approved' ? 'Budama onaylandı, alım açıldı' : 'Budama reddedildi, alım kapalı');
    await Promise.all([loadSummary(), loadRows()]);
}

async function downloadCsv(): Promise<void> {
    isDownloading.value = true;
    const res = await api.downloadInventoryPurchaseCsv(props.areaId);
    isDownloading.value = false;
    if (!res.blob) {
        toast.error(res.error ?? 'Liste indirilemedi');
        return;
    }
    const url = URL.createObjectURL(res.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `budama-onayli-mustahsiller-${schedule.value?.season ?? ''}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// ── Garden map (inside the sheet) ──
function cssVar(name: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function renderGardenMap(): void {
    map?.remove();
    map = null;
    if (!mapContainer.value || !detail.value) return;
    map = L.map(mapContainer.value, { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        maxNativeZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.geoJSON(props.mapData, {
        style: { color: cssVar('--background', '#ffffff'), weight: 0.6, opacity: 0.5, fill: false },
        interactive: false,
    }).addTo(map);
    const accent = cssVar('--primary', '#15803d');
    const gardens = L.geoJSON(
        {
            type: 'FeatureCollection',
            features: detail.value.gardens.map((g) => ({ type: 'Feature', geometry: g.geometry, properties: { label: `${g.block}/${g.parcel}`, pruned: g.prunedM2, tea: g.teaAreaM2 } })),
        } as GeoJSON.FeatureCollection,
        {
            style: { color: accent, weight: 2.5, fillColor: accent, fillOpacity: 0.3 },
            onEachFeature: (f, layer) => {
                const p = f.properties as { label: string; pruned: number; tea: number };
                layer.bindTooltip(`${p.label} · çay ${formatM2(p.tea)} · budama ${formatM2(p.pruned)}`, { sticky: true });
            },
        },
    ).addTo(map);
    map.fitBounds(gardens.getBounds(), { padding: [32, 32], maxZoom: 18 });
}

watch(sheetOpen, (open) => {
    if (!open) {
        map?.remove();
        map = null;
    }
});
watch([statusFilter, view], () => {
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
    map?.remove();
});

function onStatus(v: unknown): void {
    statusFilter.value = typeof v === 'string' && v !== '' ? (v as ProducerPruningStatus | typeof ALL) : ALL;
}
function onView(v: unknown): void {
    if (v === 'producers' || v === 'purchase') view.value = v;
}
function onRowKey(e: KeyboardEvent, id: string): void {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        void openProducer(id);
    }
}
</script>

<template>
    <LoadingState v-if="isLoading" text="Müstahsil verisi yükleniyor…" />

    <EmptyState v-else-if="error" title="Müstahsil verisi yüklenemedi" :description="error">
        <Button variant="outline" class="h-11 md:h-9" @click="loadSummary">Tekrar dene</Button>
    </EmptyState>

    <EmptyState
        v-else-if="!summary || summary.total === 0 || !schedule"
        :icon="Users"
        title="Bu alan için müstahsil taraması yok"
        description="Müstahsil–bahçe eşleşmesi ve 5 günlük taramalar içe aktarıldığında burada görünür."
    />

    <div v-else class="flex flex-col gap-6">
        <Alert variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle class="flex flex-wrap items-center gap-2">
                Kalibre edilmedi
                <Badge variant="warning">Demo müstahsil verisi</Badge>
            </AlertTitle>
            <AlertDescription>
                {{ seasonLabel(schedule.season) }} sezonunun 5 günlük taramaları geriye dönük çalıştırıldı; müstahsil–bahçe eşleşmesi örnek amaçlı üretildi.
                Otomatik onay yalnızca çok yüksek güvende verilir (hedefin %{{ Math.round(schedule.rules.autoApproval.minRatio * 100) }}'si, çayın
                %{{ Math.round(schedule.rules.autoApproval.minObservedShare * 100) }}'i gözlenmiş, art arda {{ schedule.rules.autoApproval.consecutiveScans }} tarama).
                Uydu alımı tek başına kapatamaz: "budama izi yok" sonuçları eksper kararına gider.
            </AlertDescription>
        </Alert>

        <Card class="gap-3">
            <CardHeader>
                <CardTitle>Tarama takvimi</CardTitle>
                <CardDescription>
                    {{ schedule.everyDays }} günde bir tarama · {{ schedule.scanDates.length }} tarama · {{ freshScans }} taramada yeni bulutsuz görüntü ·
                    son tarama {{ fmtDate(schedule.scanDates.at(-1)) }}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div class="flex flex-wrap items-center gap-1" role="list" aria-label="Tarama tarihleri">
                    <span
                        v-for="s in scanStrip"
                        :key="s.date"
                        role="listitem"
                        class="inline-block size-3 rounded-full border"
                        :class="s.fresh ? 'border-primary bg-primary' : 'border-muted-foreground/50 bg-transparent'"
                        :title="`${fmtDate(s.date)}: ${s.fresh ? `yeni sahne ${s.scenes.map(fmtDate).join(', ')}` : 'yeni bulutsuz sahne yok'}`"
                    />
                </div>
                <p class="mt-2 text-xs text-muted-foreground">Dolu nokta: o taramada yeni bulutsuz görüntü geldi. Boş nokta: bulut/kar nedeniyle yeni gözlem yok; sistem "budamadı" demez, bekler.</p>
            </CardContent>
        </Card>

        <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Müstahsil özeti">
            <StatCard
                label="Alım açık"
                :value="formatNumber(summary.purchaseOpen)"
                :hint="`${formatNumber(summary.counts.auto_approved)} otomatik · ${formatNumber(summary.counts.approved)} eksper onayı`"
                :icon="ShieldCheck"
            />
            <StatCard label="Eksper onayı bekliyor" :value="formatNumber(summary.counts.expert_review)" hint="hedefe yakın, güven yetersiz" />
            <StatCard
                label="Budama izi yok / kısmi"
                :value="`${formatNumber(summary.counts.no_trace)} / ${formatNumber(summary.counts.partial)}`"
                hint="eksper kontrolü gerekir"
            />
            <StatCard
                label="Gözlem bekleniyor"
                :value="formatNumber(summary.counts.awaiting_observation)"
                :hint="`${formatNumber(summary.total)} müstahsil · ${formatNumber(summary.counts.rejected)} reddedildi`"
            />
        </section>

        <ToggleGroup :model-value="view" type="single" aria-label="Görünüm" class="w-max" @update:model-value="onView">
            <ToggleGroupItem value="producers" class="h-11 px-3 md:h-9">Müstahsiller</ToggleGroupItem>
            <ToggleGroupItem value="purchase" class="h-11 px-3 md:h-9">
                Alım listesi
                <Badge variant="success" class="tabular-nums">{{ formatNumber(summary.purchaseOpen) }}</Badge>
            </ToggleGroupItem>
        </ToggleGroup>

        <template v-if="view === 'producers'">
            <div class="-mx-1 overflow-x-auto px-1 pb-1">
                <ToggleGroup :model-value="statusFilter" type="single" aria-label="Durum filtresi" class="w-max" @update:model-value="onStatus">
                    <ToggleGroupItem :value="ALL" class="h-11 px-3 md:h-9">Tümü</ToggleGroupItem>
                    <ToggleGroupItem v-for="s in PRODUCER_STATUS_ORDER" :key="s" :value="s" :title="PRODUCER_STATUS_META[s].description" class="h-11 px-3 md:h-9">
                        {{ PRODUCER_STATUS_META[s].label }}
                        <Badge :variant="toneVariant(PRODUCER_STATUS_META[s].tone)" class="tabular-nums">{{ formatNumber(summary.counts[s]) }}</Badge>
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>
            <ListToolbar>
                <SearchInput v-model="search" placeholder="Ad soyad, cüzdan no veya ruhsat no ara…" aria-label="Müstahsil ara" />
            </ListToolbar>
        </template>

        <Card class="gap-0 py-0">
            <CardHeader class="border-b py-4">
                <CardTitle>{{ view === 'purchase' ? 'Alım listesi' : 'Müstahsiller' }}</CardTitle>
                <CardDescription aria-live="polite">
                    <template v-if="view === 'purchase'">ÇAYKUR'un bu sezon yaş çay alabileceği müstahsiller (otomatik veya eksper onaylı) · {{ formatNumber(total) }} kişi</template>
                    <template v-else>{{ formatNumber(total) }} müstahsil · 1/7 hedefine oranı en düşükten başlayarak</template>
                </CardDescription>
                <CardAction v-if="view === 'purchase'">
                    <Button variant="outline" class="h-11 md:h-9" :disabled="isDownloading || total === 0" @click="downloadCsv">
                        <Download aria-hidden="true" />
                        Excel (CSV) indir
                    </Button>
                </CardAction>
            </CardHeader>
            <CardContent class="px-0">
                <div v-if="rows.length" class="overflow-x-auto" :aria-busy="isLoadingRows">
                    <Table>
                        <TableHeader>
                            <TableRow class="hover:bg-transparent">
                                <TableHead class="pl-4">Müstahsil</TableHead>
                                <TableHead class="hidden text-right md:table-cell">Bahçe</TableHead>
                                <TableHead class="hidden text-right lg:table-cell">Ruhsat alanı</TableHead>
                                <TableHead class="text-right">Görülen budama</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead class="pr-4">Alım</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow
                                v-for="r in rows"
                                :key="r.id"
                                class="cursor-pointer"
                                tabindex="0"
                                @click="openProducer(r.id)"
                                @keydown="onRowKey($event, r.id)"
                            >
                                <TableCell class="pl-4">
                                    <span class="block font-medium text-foreground">{{ r.name }}</span>
                                    <span class="block text-xs text-muted-foreground">Cüzdan {{ r.walletNo }} · Ruhsat {{ r.licenseNo }}</span>
                                </TableCell>
                                <TableCell class="hidden text-right tabular-nums md:table-cell">{{ r.gardenCount }}</TableCell>
                                <TableCell class="hidden text-right tabular-nums lg:table-cell">{{ formatM2(r.licensedAreaM2) }}</TableCell>
                                <TableCell class="text-right">
                                    <span class="block font-semibold text-foreground tabular-nums">{{ formatM2(r.prunedM2) }}</span>
                                    <span class="block text-xs text-muted-foreground tabular-nums">hedef {{ formatM2(r.requiredM2) }} · {{ formatShare(r.ratio) }}</span>
                                </TableCell>
                                <TableCell>
                                    <Badge :variant="toneVariant(PRODUCER_STATUS_META[r.status].tone)">{{ PRODUCER_STATUS_META[r.status].label }}</Badge>
                                </TableCell>
                                <TableCell class="pr-4">
                                    <Badge :variant="r.purchaseOpen ? 'success' : 'muted'">{{ r.purchaseOpen ? 'Açık' : 'Kapalı' }}</Badge>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
                <LoadingState v-else-if="isLoadingRows" text="Yükleniyor…" />
                <EmptyState v-else :icon="Users" title="Eşleşen müstahsil yok" description="Durum filtresini veya aramayı değiştirin." class="rounded-none border-0" />
                <div v-if="totalPages > 1" class="flex items-center justify-between gap-3 border-t p-4">
                    <span class="text-xs text-muted-foreground tabular-nums">Sayfa {{ page }} / {{ totalPages }}</span>
                    <div class="flex gap-1">
                        <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page === 1" aria-label="Önceki sayfa" @click="page--">
                            <ChevronLeft aria-hidden="true" />
                        </Button>
                        <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="page === totalPages" aria-label="Sonraki sayfa" @click="page++">
                            <ChevronRight aria-hidden="true" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Sheet v-model:open="sheetOpen">
            <SheetContent side="right" class="w-full gap-0 overflow-y-auto sm:max-w-2xl">
                <template v-if="detail">
                    <SheetHeader class="border-b">
                        <SheetTitle>{{ detail.name }}</SheetTitle>
                        <SheetDescription>Cüzdan {{ detail.walletNo }} · Ruhsat {{ detail.licenseNo }} · {{ seasonLabel(detail.season) }} budama sezonu</SheetDescription>
                        <div class="flex flex-wrap gap-2 pt-1">
                            <Badge :variant="toneVariant(PRODUCER_STATUS_META[detail.status].tone)">{{ PRODUCER_STATUS_META[detail.status].label }}</Badge>
                            <Badge :variant="detail.purchaseOpen ? 'success' : 'muted'">Alım {{ detail.purchaseOpen ? 'açık' : 'kapalı' }}</Badge>
                            <Badge v-if="detail.demo" variant="warning">Demo</Badge>
                        </div>
                    </SheetHeader>

                    <div class="flex flex-col gap-6 p-4">
                        <p class="text-sm text-muted-foreground">{{ PRODUCER_STATUS_META[detail.status].description }}</p>

                        <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                            <div><dt class="text-muted-foreground">Bahçe sayısı</dt><dd class="font-semibold text-foreground tabular-nums">{{ detail.gardens.length }}</dd></div>
                            <div><dt class="text-muted-foreground">Ruhsat alanı</dt><dd class="font-semibold text-foreground tabular-nums">{{ formatM2(detail.licensedAreaM2) }}</dd></div>
                            <div><dt class="text-muted-foreground">Uydu çay alanı</dt><dd class="text-foreground tabular-nums">{{ formatM2(detail.teaAreaM2) }}</dd></div>
                            <div><dt class="text-muted-foreground">1/7 hedefi</dt><dd class="font-semibold text-foreground tabular-nums">{{ formatM2(detail.requiredM2) }}</dd></div>
                            <div><dt class="text-muted-foreground">Görülen budama</dt><dd class="font-semibold text-foreground tabular-nums">{{ formatM2(detail.prunedM2) }}</dd></div>
                            <div><dt class="text-muted-foreground">Hedefe oran</dt><dd class="font-semibold text-foreground tabular-nums">{{ formatShare(detail.ratio) }}</dd></div>
                            <div v-if="detail.autoApprovedAt"><dt class="text-muted-foreground">Otomatik onay</dt><dd class="text-foreground">{{ fmtDate(detail.autoApprovedAt) }}</dd></div>
                        </dl>

                        <section class="space-y-2" aria-label="Bahçe haritası">
                            <h3 class="text-sm font-semibold text-foreground">Bahçeler</h3>
                            <div ref="mapContainer" class="h-64 w-full overflow-hidden rounded-lg border" />
                        </section>

                        <section v-if="schedule" class="space-y-2" aria-label="Sezon ilerlemesi">
                            <h3 class="text-sm font-semibold text-foreground">Sezon boyunca biriken budama</h3>
                            <ProducerProgressChart
                                :scans="detail.scans"
                                :new-observation="schedule.newObservation"
                                :required-m2="detail.requiredM2"
                                :auto-ratio="schedule.rules.autoApproval.minRatio"
                                :auto-approved-at="detail.autoApprovedAt"
                            />
                        </section>

                        <section class="space-y-2" aria-label="Bahçe listesi">
                            <div class="overflow-x-auto rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow class="hover:bg-transparent">
                                            <TableHead class="pl-3">Ada / Parsel</TableHead>
                                            <TableHead class="text-right">Çay alanı</TableHead>
                                            <TableHead class="pr-3 text-right">Görülen budama</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow v-for="g in detail.gardens" :key="g.id">
                                            <TableCell class="pl-3">
                                                <span class="block font-medium text-foreground">{{ g.block }} / {{ g.parcel }}</span>
                                                <span v-if="g.holderCount > 1" class="block text-xs text-muted-foreground">Hisseli parsel · {{ g.holderIndex }}/{{ g.holderCount }}. hissedar</span>
                                            </TableCell>
                                            <TableCell class="text-right tabular-nums">{{ formatM2(g.teaAreaM2) }}</TableCell>
                                            <TableCell class="pr-3 text-right font-semibold text-foreground tabular-nums">{{ formatM2(g.prunedM2) }}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </section>

                        <section class="space-y-3" aria-label="Eksper kararı">
                            <h3 class="text-sm font-semibold text-foreground">Eksper kararı</h3>
                            <template v-if="canDecide">
                                <div class="space-y-2">
                                    <Label for="decision-note">Not (reddetmek için zorunlu)</Label>
                                    <Textarea id="decision-note" v-model="note" rows="2" placeholder="Saha kontrolü, fotoğraf kanıtı veya gerekçe…" />
                                </div>
                                <div class="flex flex-wrap gap-2">
                                    <Button class="h-11 md:h-9" :disabled="isDeciding" @click="decide('approved')">Budamayı onayla · alımı aç</Button>
                                    <Button variant="destructive" class="h-11 md:h-9" :disabled="isDeciding" @click="decide('rejected')">Reddet · alım kapalı</Button>
                                </div>
                            </template>
                            <p v-else class="text-sm text-muted-foreground">Rolünüz karar vermeye yetkili değil (yalnızca görüntüleme).</p>

                            <ul v-if="detail.decisions.length" class="flex flex-col gap-2">
                                <li v-for="(d, i) in detail.decisions" :key="i" class="rounded-lg border p-3 text-sm">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <Badge :variant="d.decision === 'approved' ? 'success' : 'danger'">{{ d.decision === 'approved' ? 'Onaylandı' : 'Reddedildi' }}</Badge>
                                        <span class="text-muted-foreground">{{ d.decidedByName }} · {{ fmtDate(d.decidedAt.slice(0, 10)) }}</span>
                                        <Badge v-if="i === 0" variant="outline">Geçerli</Badge>
                                    </div>
                                    <p v-if="d.note" class="mt-1 text-foreground">{{ d.note }}</p>
                                </li>
                            </ul>
                        </section>
                    </div>
                </template>
            </SheetContent>
        </Sheet>
    </div>
</template>
