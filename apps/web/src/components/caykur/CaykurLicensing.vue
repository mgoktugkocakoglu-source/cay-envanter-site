<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { ChevronLeft, ChevronRight, Download, FileText, MapPinned, MoreHorizontal, ScrollText, TriangleAlert, Users } from '@lucide/vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import CaykurLicensingOperations, { type OperationKind } from '@/components/caykur/CaykurLicensingOperations.vue';
import CaykurProducerDossier from '@/components/caykur/CaykurProducerDossier.vue';
import CaykurLicenceAudit from '@/components/caykur/CaykurLicenceAudit.vue';
import CaykurDroneVerification from '@/components/caykur/CaykurDroneVerification.vue';
import CaykurCompliance from '@/components/caykur/CaykurCompliance.vue';
import CaykurLandCover from '@/components/caykur/CaykurLandCover.vue';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState, ListToolbar, LoadingState, SearchInput, StatCard } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toneVariant } from '@/components/caykur/tone';
import { useToast } from '@/composables/useToast';
import { useTkgmParcelLookup } from '@/composables/useTkgmParcelLookup';
import { useAuthStore } from '@/stores/authStore';
import {
    api,
    type ApplicationDetail,
    type ApplicationRow,
    type ApplicationStatus,
    type ApplicationType,
    type GardenApprovalStatus,
    type GardenDiscrepancy,
    type InventoryMap,
    type LicenseMatchLevel,
    type LicensedGarden,
    type LicensingLayers,
    type LicensingProducerProfile,
    type LicensingProducerRow,
    type LicensingSummary,
} from '@/services/api';
import {
    APPLICATION_STATUS_META,
    APPLICATION_STATUS_ORDER,
    APPLICATION_TYPE_LABEL,
    APPROVAL_STATUS_META,
    APPROVAL_STATUS_ORDER,
    DISCREPANCY_META,
    DISCREPANCY_ORDER,
    LICENSE_STATUS_LABEL,
    MATCH_LEVEL_META,
    MATCH_LEVEL_ORDER,
    PRODUCER_STATUS_META,
    formatDekar,
    formatM2,
} from '@/services/caykur/teaInventory';
import { formatNumber } from '@/services/caykur';

/**
 * Producer-centred digital licence register: producer → licence → licensed garden sub-polygon →
 * TKGM parcel. Shows how each licence was matched to today's cadastre (exact / historical /
 * probable / unmatched), the three area measures (licence, map projection, DEM slope surface),
 * boundary proposals and conflicts in shared parcels, geometry versions and the application
 * workflow with its expert steps. Everything here is DEMO data on real parcels.
 */
const props = defineProps<{
    areaId: string;
    mapData: InventoryMap;
    teaPatches: Array<{ areaM2: number; geometry: GeoJSON.Geometry }>;
}>();

const ALL = 'all';
const PAGE_SIZE = 15;
const DECIDE_ROLES = ['kurum_admin', 'fabrika_sorumlusu', 'saha_personeli'];
const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const toast = useToast();
const auth = useAuthStore();
const tkgm = useTkgmParcelLookup();

const summary = ref<LicensingSummary | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);
const view = ref<'producers' | 'applications' | 'map' | 'audit' | 'drone' | 'compliance' | 'cover'>('producers');

// ── Producers ──
const search = ref('');
const matchFilter = ref<LicenseMatchLevel | typeof ALL>(ALL);
const approvalFilter = ref<GardenApprovalStatus | typeof ALL>(ALL);
const discrepancyFilter = ref<GardenDiscrepancy | typeof ALL>(ALL);
const issuesOnly = ref(false);
const page = ref(1);
const rows = ref<LicensingProducerRow[]>([]);
const total = ref(0);
const totalPages = ref(1);
const isLoadingRows = ref(false);
const isDownloading = ref(false);

// ── Producer profile sheet ──
const sheetOpen = ref(false);
const profile = ref<LicensingProducerProfile | null>(null);
const isLoadingProfile = ref(false);
const expandedGarden = ref<string | null>(null);
const profileMapContainer = ref<HTMLElement | null>(null);
let profileMap: L.Map | null = null;

// ── Applications ──
const appSearch = ref('');
const appStatus = ref<ApplicationStatus | typeof ALL>(ALL);
const appType = ref<ApplicationType | typeof ALL>(ALL);
const appOpenOnly = ref(true);
const appPage = ref(1);
const appRows = ref<ApplicationRow[]>([]);
const appTotal = ref(0);
const appTotalPages = ref(1);
const isLoadingApps = ref(false);

// ── Application dialog ──
const dialogOpen = ref(false);
const application = ref<ApplicationDetail | null>(null);
const isLoadingApp = ref(false);
const note = ref('');
const isDeciding = ref(false);

// ── Map view ──
const layers = ref<LicensingLayers | null>(null);
const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
const layerGroups: Record<string, L.LayerGroup> = {};
const showLayer = ref({ parcels: true, tea: false, approved: true, pending: true, proposals: true, conflicts: true, unlicensed: true });

const canDecide = computed(() => auth.isAdmin || DECIDE_ROLES.includes(auth.caykurRole ?? ''));
// ── Register operations (subdivision, split, transfer, correction, boundary) ──
const opOpen = ref(false);
const opKind = ref<OperationKind>('garden_subdivision');
const opGarden = ref<string | null>(null);
const opLicense = ref<string | null>(null);
function openOperation(kind: OperationKind, gardenCode: string | null = null, licenseCode: string | null = null): void {
    opKind.value = kind;
    opGarden.value = gardenCode;
    opLicense.value = licenseCode;
    opOpen.value = true;
}
async function onOperationCreated(app: ApplicationDetail): Promise<void> {
    await Promise.all([loadSummary(), loadApps()]);
    if (profile.value) {
        const fresh = await api.getLicensingProducer(props.areaId, profile.value.code);
        if (fresh.data) profile.value = fresh.data;
    }
    application.value = app;
    note.value = '';
    dialogOpen.value = true;
}
const CAUSE_LABEL: Record<string, string> = { inheritance: 'intikal (vefat)', sale: 'satış / devir', parcel_split: 'parsel ifrazı', family: 'aile içi paylaşım', other: 'diğer' };
interface PayloadView {
    pieces?: Array<{ label: string; holderName: string; planimetricAreaM2: number; licensedAreaM2: number | null; measuredTeaAreaM2: number; warnings: string[] }>;
    parts?: Array<{ label: string; holderName: string; gardenCodes: string[]; recordedAreaM2: number; keepsOriginal: boolean }>;
    before?: { planimetricAreaM2: number; measuredTeaAreaM2: number };
    after?: { planimetricAreaM2: number; measuredTeaAreaM2: number };
    holderName?: string;
    cause?: string;
    reason?: string;
    newLicensedAreaM2?: number;
    previousLicensedAreaM2?: number | null;
}
const payloadView = computed<PayloadView | null>(() => {
    const p = application.value?.payload as (Record<string, unknown> & { preview?: Record<string, unknown> }) | null | undefined;
    if (!p) return null;
    const preview = (p.preview ?? {}) as PayloadView;
    return { ...preview, holderName: p.holderName as string | undefined, cause: p.cause as string | undefined, reason: p.reason as string | undefined, newLicensedAreaM2: p.newLicensedAreaM2 as number | undefined, previousLicensedAreaM2: p.previousLicensedAreaM2 as number | null | undefined };
});
const effectsView = computed(() => {
    const e = application.value?.effects as Record<string, unknown> | null | undefined;
    if (!e) return [];
    const labels: Record<string, string> = { gardens: 'Yeni bahçeler', licenses: 'Yeni ruhsatlar', supersededGarden: 'Kapanan bahçe', producers: 'Güncellenen müstahsiller', conflicts: 'Açılan ihtilaflar', originalLicense: 'Ruhsat', originalStatus: 'Ruhsat durumu', license: 'Ruhsat', from: 'Eski sahip', to: 'Yeni sahip', garden: 'Bahçe', version: 'Geometri sürümü', planimetricAreaM2: 'İzdüşüm (m²)', approvalStatus: 'Sınır durumu', licensedAreaM2: 'Ruhsat alanı (m²)', previousLicensedAreaM2: 'Önceki ruhsat alanı (m²)' };
    return Object.entries(e).filter(([, v]) => v !== null && !(Array.isArray(v) && v.length === 0)).map(([k, v]) => ({ label: labels[k] ?? k, value: Array.isArray(v) ? v.join(', ') : String(v) }));
});
const hasRegistry = computed(() => !!summary.value?.generatedAt);
const discrepancyBadges = computed(() => DISCREPANCY_ORDER.filter((k) => (summary.value?.gardens.discrepancies[k] ?? 0) > 0));
const applicationBadges = computed(() => APPLICATION_STATUS_ORDER.filter((k) => (summary.value?.applications.byStatus[k] ?? 0) > 0));

function fmtDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
}
function cssVar(name: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
function gardenColor(status: GardenApprovalStatus, pending: boolean): string {
    if (status === 'boundary_conflict') return cssVar('--destructive', '#b91c1c');
    if (status === 'proposed') return cssVar('--info', '#1e3a8a');
    if (status === 'field_check_required' || pending) return cssVar('--warning', '#b45309');
    if (status === 'unresolved') return cssVar('--muted-foreground', '#64748b');
    return cssVar('--primary', '#15803d');
}
/** Surface / planimetric: how much the slope adds to the map area. */
function slopeGain(g: { surfaceAreaM2: number; planimetricAreaM2: number }): string {
    if (g.planimetricAreaM2 <= 0) return '—';
    return `+%${Math.round((g.surfaceAreaM2 / g.planimetricAreaM2 - 1) * 100)}`;
}

async function loadSummary(): Promise<void> {
    error.value = null;
    const res = await api.getLicensingSummary(props.areaId);
    if (res.data) summary.value = res.data;
    else error.value = res.error?.message ?? 'Ruhsat kaydı yüklenemedi';
}

async function loadRows(): Promise<void> {
    isLoadingRows.value = true;
    const res = await api.getLicensingProducers(props.areaId, {
        page: page.value,
        limit: PAGE_SIZE,
        search: search.value.trim() || undefined,
        matchLevel: matchFilter.value === ALL ? undefined : matchFilter.value,
        approvalStatus: approvalFilter.value === ALL ? undefined : approvalFilter.value,
        discrepancy: discrepancyFilter.value === ALL ? undefined : discrepancyFilter.value,
        issues: issuesOnly.value ? 'true' : undefined,
    });
    if (res.data) {
        rows.value = res.data.data;
        total.value = res.data.meta.total;
        totalPages.value = Math.max(1, res.data.meta.totalPages);
    } else {
        toast.error(res.error?.message ?? 'Müstahsil listesi yüklenemedi');
    }
    isLoadingRows.value = false;
}

async function loadApps(): Promise<void> {
    isLoadingApps.value = true;
    const res = await api.getLicensingApplications(props.areaId, {
        page: appPage.value,
        limit: PAGE_SIZE,
        search: appSearch.value.trim() || undefined,
        status: appStatus.value === ALL ? undefined : appStatus.value,
        type: appType.value === ALL ? undefined : appType.value,
        open: appOpenOnly.value ? 'true' : undefined,
    });
    if (res.data) {
        appRows.value = res.data.data;
        appTotal.value = res.data.meta.total;
        appTotalPages.value = Math.max(1, res.data.meta.totalPages);
    } else {
        toast.error(res.error?.message ?? 'Başvurular yüklenemedi');
    }
    isLoadingApps.value = false;
}

async function openProducer(code: string): Promise<void> {
    sheetOpen.value = true;
    isLoadingProfile.value = true;
    profile.value = null;
    expandedGarden.value = null;
    const res = await api.getLicensingProducer(props.areaId, code);
    isLoadingProfile.value = false;
    if (!res.data) {
        toast.error(res.error?.message ?? 'Müstahsil profili yüklenemedi');
        sheetOpen.value = false;
        return;
    }
    profile.value = res.data;
    await nextTick();
    renderProfileMap();
}

async function openApplication(code: string): Promise<void> {
    dialogOpen.value = true;
    isLoadingApp.value = true;
    application.value = null;
    note.value = '';
    const res = await api.getLicensingApplication(props.areaId, code);
    isLoadingApp.value = false;
    if (!res.data) {
        toast.error(res.error?.message ?? 'Başvuru yüklenemedi');
        dialogOpen.value = false;
        return;
    }
    application.value = res.data;
}

async function decide(status: ApplicationStatus): Promise<void> {
    if (!application.value) return;
    isDeciding.value = true;
    const res = await api.decideLicensingApplication(props.areaId, application.value.code, { status, note: note.value.trim() || undefined });
    isDeciding.value = false;
    if (!res.data) {
        toast.error(res.error?.message ?? 'Karar kaydedilemedi');
        return;
    }
    application.value = res.data;
    note.value = '';
    toast.success(`Başvuru "${APPLICATION_STATUS_META[status].label}" durumuna alındı (demo)`);
    await Promise.all([loadSummary(), loadApps()]);
    if (profile.value) {
        const fresh = await api.getLicensingProducer(props.areaId, profile.value.code);
        if (fresh.data) profile.value = fresh.data;
    }
}

async function downloadCsv(): Promise<void> {
    isDownloading.value = true;
    try {
        const { blob, error: message } = await api.downloadLicensingCsv(props.areaId);
        if (!blob) {
            toast.error(message ?? 'Liste indirilemedi');
            return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ruhsat-kaydi-mustahsiller.csv';
        a.click();
        URL.revokeObjectURL(url);
    } finally {
        isDownloading.value = false;
    }
}

/** The producer's gardens: current geometry by status, proposal dashed, conflicts filled red. */
function renderProfileMap(): void {
    profileMap?.remove();
    profileMap = null;
    const p = profile.value;
    if (!profileMapContainer.value || !p || p.gardens.length === 0) return;
    profileMap = L.map(profileMapContainer.value, { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20, maxNativeZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }).addTo(profileMap);
    L.control.zoom({ position: 'topright' }).addTo(profileMap);
    L.geoJSON(props.mapData, { style: { color: cssVar('--background', '#ffffff'), weight: 0.6, opacity: 0.5, fill: false }, interactive: false }).addTo(profileMap);
    const gardens = L.geoJSON(
        { type: 'FeatureCollection', features: p.gardens.map((g) => ({ type: 'Feature', geometry: g.geometry, properties: { g } })) } as GeoJSON.FeatureCollection,
        {
            style: (f) => {
                const g = (f?.properties as { g: LicensedGarden }).g;
                const color = gardenColor(g.approvalStatus, g.discrepancies.includes('lineage_unresolved'));
                return { color, weight: 2.5, fillColor: color, fillOpacity: g.approvalStatus === 'approved' ? 0.15 : 0.06, dashArray: g.approvalStatus === 'unresolved' ? '6 4' : undefined };
            },
            onEachFeature: (f, layer) => {
                const g = (f.properties as { g: LicensedGarden }).g;
                layer.bindTooltip(`${g.block}/${g.parcel} · ${APPROVAL_STATUS_META[g.approvalStatus].label} · ruhsat ${g.licensedAreaM2 === null ? '—' : formatM2(g.licensedAreaM2)} · çay ${formatM2(g.measuredTeaAreaM2)}`, { sticky: true });
            },
        },
    ).addTo(profileMap);
    const proposals = p.gardens.filter((g) => g.proposal);
    if (proposals.length) {
        L.geoJSON(
            { type: 'FeatureCollection', features: proposals.map((g) => ({ type: 'Feature', geometry: g.proposal!.geometry, properties: { g } })) } as GeoJSON.FeatureCollection,
            {
                style: { color: cssVar('--info', '#1e3a8a'), weight: 2, dashArray: '4 4', fill: false },
                onEachFeature: (f, layer) => {
                    const g = (f.properties as { g: LicensedGarden }).g;
                    layer.bindTooltip(`Sınır önerisi (${g.proposal!.proposedBy === 'producer' ? 'müstahsil' : 'personel'}, ${fmtDate(g.proposal!.proposedAt)}) · ${formatM2(g.proposal!.planimetricAreaM2)}`, { sticky: true });
                },
            },
        ).addTo(profileMap);
    }
    if (p.conflicts.length) {
        L.geoJSON(
            { type: 'FeatureCollection', features: p.conflicts.map((c) => ({ type: 'Feature', geometry: c.geometry, properties: { c } })) } as GeoJSON.FeatureCollection,
            {
                style: { color: cssVar('--destructive', '#b91c1c'), weight: 1.5, fillColor: cssVar('--destructive', '#b91c1c'), fillOpacity: 0.5 },
                onEachFeature: (f, layer) => {
                    const c = (f.properties as { c: { overlapM2: number; gardenCodes: [string, string] } }).c;
                    layer.bindTooltip(`Çakışma ${formatM2(c.overlapM2)} · ${c.gardenCodes.join(' ↔ ')}`, { sticky: true });
                },
            },
        ).addTo(profileMap);
    }
    profileMap.fitBounds(gardens.getBounds(), { padding: [32, 32], maxZoom: 18 });
}

/** Institutional map: TKGM parcels, satellite tea, licensed gardens by status, proposals, conflicts, unlicensed tea. */
async function renderMainMap(): Promise<void> {
    if (!mapContainer.value) return;
    if (!layers.value) {
        const res = await api.getLicensingLayers(props.areaId);
        if (!res.data) {
            toast.error(res.error?.message ?? 'Harita katmanları yüklenemedi');
            return;
        }
        layers.value = res.data;
    }
    const d: LicensingLayers = layers.value;
    map?.remove();
    map = L.map(mapContainer.value, { zoomControl: false, attributionControl: false });
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20, maxNativeZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    const teaColor = cssVar('--primary', '#15803d');
    layerGroups.parcels = L.layerGroup([L.geoJSON(props.mapData, { style: { color: cssVar('--background', '#ffffff'), weight: 0.7, opacity: 0.6, fill: false }, interactive: false })]);
    layerGroups.tea = L.layerGroup([
        L.geoJSON({ type: 'FeatureCollection', features: props.teaPatches.map((t) => ({ type: 'Feature', geometry: t.geometry, properties: {} })) } as GeoJSON.FeatureCollection, {
            style: { color: teaColor, weight: 0.5, fillColor: teaColor, fillOpacity: 0.25 },
            interactive: false,
        }),
    ]);
    const gardenLayer = (filter: (g: LicensingLayers['gardens']['features'][number]['properties']) => boolean) =>
        L.geoJSON({ type: 'FeatureCollection', features: d.gardens.features.filter((f) => filter(f.properties)) } as GeoJSON.FeatureCollection, {
            style: (f) => {
                const p = f?.properties as LicensingLayers['gardens']['features'][number]['properties'];
                const color = gardenColor(p.approvalStatus, p.discrepancies.includes('lineage_unresolved'));
                return { color, weight: 2, fillColor: color, fillOpacity: p.approvalStatus === 'approved' && p.licensedAreaM2 !== null ? 0.2 : 0.08, dashArray: p.approvalStatus === 'unresolved' ? '6 4' : undefined };
            },
            onEachFeature: (f, layer) => {
                const p = f.properties as LicensingLayers['gardens']['features'][number]['properties'];
                layer.bindTooltip(`${p.producerName} · ${p.block}/${p.parcel} · ${APPROVAL_STATUS_META[p.approvalStatus].label}${p.licenseCode ? ` · ${p.licenseCode}` : ' · ruhsat yok'}`, { sticky: true });
                layer.on('click', (e) => { L.DomEvent.stopPropagation(e); void openProducer(p.producerCode); });
            },
        });
    layerGroups.approved = L.layerGroup([gardenLayer((p) => p.approvalStatus === 'approved' && p.licensedAreaM2 !== null)]);
    layerGroups.pending = L.layerGroup([gardenLayer((p) => !(p.approvalStatus === 'approved' && p.licensedAreaM2 !== null))]);
    layerGroups.proposals = L.layerGroup([
        L.geoJSON(d.proposals as GeoJSON.FeatureCollection, {
            style: { color: cssVar('--info', '#1e3a8a'), weight: 2, dashArray: '4 4', fill: false },
            onEachFeature: (f, layer) => {
                const p = f.properties as LicensingLayers['proposals']['features'][number]['properties'];
                layer.bindTooltip(`Öneri · ${p.producerName} · ${p.block}/${p.parcel} · ${formatM2(p.planimetricAreaM2)}${p.overlapM2 ? ` · çakışma ${formatM2(p.overlapM2)}` : ''}`, { sticky: true });
                layer.on('click', (e) => { L.DomEvent.stopPropagation(e); void openProducer(p.producerCode); });
            },
        }),
    ]);
    layerGroups.conflicts = L.layerGroup([
        L.geoJSON(d.conflicts as GeoJSON.FeatureCollection, {
            style: { color: cssVar('--destructive', '#b91c1c'), weight: 1.5, fillColor: cssVar('--destructive', '#b91c1c'), fillOpacity: 0.55 },
            onEachFeature: (f, layer) => {
                const p = f.properties as LicensingLayers['conflicts']['features'][number]['properties'];
                layer.bindTooltip(`Sınır ihtilafı ${p.code} · ${formatM2(p.overlapM2)} · ${p.gardenCodes.join(' ↔ ')}`, { sticky: true });
            },
        }),
    ]);
    const unlicensedColor = cssVar('--warning', '#b45309');
    layerGroups.unlicensed = L.layerGroup([
        L.geoJSON(d.unlicensedTea as GeoJSON.FeatureCollection, {
            style: { color: unlicensedColor, weight: 1, fillColor: unlicensedColor, fillOpacity: 0.4 },
            onEachFeature: (f, layer) => layer.bindTooltip(`Ruhsatsız çay alanı · ${formatM2((f.properties as { areaM2: number }).areaM2)}`, { sticky: true }),
        }),
    ]);
    applyLayerToggles();
    // Anywhere not covered by a garden: live TKGM parcel lookup.
    tkgm.attach(map);
    const bounds = L.geoJSON(props.mapData).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [16, 16] });
}

function applyLayerToggles(): void {
    if (!map) return;
    for (const [key, group] of Object.entries(layerGroups)) {
        const on = showLayer.value[key as keyof typeof showLayer.value];
        if (on && !map.hasLayer(group)) group.addTo(map);
        if (!on && map.hasLayer(group)) group.remove();
    }
}

watch(view, async (v) => {
    if (v === 'map') {
        await nextTick();
        await renderMainMap();
    } else if (map) {
        map.remove();
        map = null;
    }
    if (v === 'applications' && appRows.value.length === 0) void loadApps();
});
watch(showLayer, applyLayerToggles, { deep: true });
watch(sheetOpen, (open) => {
    if (!open) {
        profileMap?.remove();
        profileMap = null;
    }
});
watch([matchFilter, approvalFilter, discrepancyFilter, issuesOnly], () => {
    page.value = 1;
    void loadRows();
});
watch(page, () => void loadRows());
watch([appStatus, appType, appOpenOnly], () => {
    appPage.value = 1;
    void loadApps();
});
watch(appPage, () => void loadApps());
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        page.value = 1;
        void loadRows();
    }, 300);
});
let appDebounce: ReturnType<typeof setTimeout> | null = null;
watch(appSearch, () => {
    if (appDebounce) clearTimeout(appDebounce);
    appDebounce = setTimeout(() => {
        appPage.value = 1;
        void loadApps();
    }, 300);
});

onMounted(async () => {
    await loadSummary();
    if (hasRegistry.value) await loadRows();
    isLoading.value = false;
});
onBeforeUnmount(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (appDebounce) clearTimeout(appDebounce);
    map?.remove();
    profileMap?.remove();
});

function onView(v: unknown): void {
    if (v === 'producers' || v === 'applications' || v === 'map' || v === 'audit' || v === 'drone' || v === 'compliance' || v === 'cover') view.value = v;
}
function onMatch(v: unknown): void {
    matchFilter.value = typeof v === 'string' && v !== '' ? (v as LicenseMatchLevel | typeof ALL) : ALL;
}
function onApproval(v: unknown): void {
    approvalFilter.value = typeof v === 'string' && v !== '' ? (v as GardenApprovalStatus | typeof ALL) : ALL;
}
function onDiscrepancy(v: unknown): void {
    discrepancyFilter.value = typeof v === 'string' && v !== '' ? (v as GardenDiscrepancy | typeof ALL) : ALL;
}
function onAppStatus(v: unknown): void {
    appStatus.value = typeof v === 'string' && v !== '' ? (v as ApplicationStatus | typeof ALL) : ALL;
}
function onAppType(v: unknown): void {
    appType.value = typeof v === 'string' && v !== '' ? (v as ApplicationType | typeof ALL) : ALL;
}
function onRowKey(e: KeyboardEvent, run: () => void): void {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        run();
    }
}
function toggleGarden(code: string): void {
    expandedGarden.value = expandedGarden.value === code ? null : code;
}
</script>

<template>
    <LoadingState v-if="isLoading" text="Ruhsat kaydı yükleniyor…" />

    <EmptyState v-else-if="error" title="Ruhsat kaydı yüklenemedi" :description="error">
        <Button variant="outline" class="h-11 md:h-9" @click="loadSummary">Tekrar dene</Button>
    </EmptyState>

    <EmptyState
        v-else-if="!summary || !hasRegistry"
        :icon="ScrollText"
        title="Bu alan için dijital ruhsat kaydı yok"
        description="Müstahsil → ruhsat → çaylık alt-poligonu kaydı (bundle v5) içe aktarıldığında burada görünür."
    />

    <div v-else class="flex flex-col gap-6">
        <Alert variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle class="flex flex-wrap items-center gap-2">
                Demo ruhsat kaydı
                <Badge variant="warning">ÇAYKUR verisi değil</Badge>
            </AlertTitle>
            <AlertDescription>
                Gerçek TKGM parselleri ve uydu çay tespiti üzerine, ÇAYKUR kayıtlarındaki bilinen sorunları (eski pafta/parsel kayıtları, 22-a yenilemesi,
                hisseli parsellerde sınır önerileri ve çakışmalar, ruhsat–ölçüm alan farkları, vefat eden ruhsat sahipleri) içeren örnek bir kayıt üretildi.
                Sistem parseli değil müstahsili merkeze alır: her ruhsat, parsel içindeki koordinatlı çaylık alt-poligonlarına bağlanır. Üç alan ayrı tutulur —
                ruhsattaki alan, haritadaki izdüşüm alanı ve DEM'den hesaplanan eğimli yüzey alanı (teknik tahmin, hukuki alan değildir).
                Buradaki onaylar "demo onay"dır; resmî ÇAYKUR kararı yerine geçmez.
            </AlertDescription>
        </Alert>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
                label="Müstahsil"
                :value="formatNumber(summary.producers.total)"
                :hint="`${summary.producers.licensed} ruhsatlı · ${summary.producers.unlicensed} ruhsatsız · ${summary.producers.deceasedHolders} intikal bekliyor`"
                :icon="Users"
            />
            <StatCard
                label="Ruhsat"
                :value="formatNumber(summary.licenses.total)"
                :hint="`ada/parsel birebir ${summary.licenses.byMatchLevel.exact} · tarihsel ${summary.licenses.byMatchLevel.historical} · olası ${summary.licenses.byMatchLevel.probable} · eşleşmeyen ${summary.licenses.byMatchLevel.unmatched}`"
                :icon="ScrollText"
            />
            <StatCard
                label="Çaylık alt-poligonu"
                :value="formatNumber(summary.gardens.total)"
                :hint="`${summary.gardens.byApprovalStatus.approved} onaylı sınır · ${summary.gardens.byApprovalStatus.proposed} öneri · ${summary.gardens.byApprovalStatus.boundary_conflict} ihtilaf · ${summary.gardens.byApprovalStatus.field_check_required + summary.gardens.byApprovalStatus.unresolved} saha/belirsiz`"
                :icon="MapPinned"
            />
            <StatCard
                label="Ruhsatsız çay (mekânsal fark)"
                :value="formatDekar(summary.unlicensedTea.areaM2)"
                :hint="`${summary.unlicensedTea.count} alan · uydu çayından onaylı ruhsatlı alt-poligonlar çıkarıldı`"
                :icon="TriangleAlert"
            />
        </div>

        <div class="grid gap-4 lg:grid-cols-3">
            <Card>
                <CardHeader>
                    <CardTitle>Üç alan ölçüsü</CardTitle>
                    <CardDescription>Aynı bahçeler, üç farklı soru</CardDescription>
                </CardHeader>
                <CardContent class="grid gap-3 text-sm">
                    <div class="flex items-center justify-between gap-3">
                        <span class="text-muted-foreground">Ruhsatta yazan (tahsis edilen)</span>
                        <span class="font-semibold tabular-nums text-foreground">{{ formatDekar(summary.gardens.licensedAreaM2) }}</span>
                    </div>
                    <div class="flex items-center justify-between gap-3">
                        <span class="text-muted-foreground">Harita izdüşümü (sınır)</span>
                        <span class="font-semibold tabular-nums text-foreground">{{ formatDekar(summary.gardens.planimetricAreaM2) }}</span>
                    </div>
                    <div class="flex items-center justify-between gap-3">
                        <span class="text-muted-foreground">Eğimli yüzey (DEM, ort. {{ summary.gardens.meanSlopeDeg }}°)</span>
                        <span class="font-semibold tabular-nums text-foreground">{{ formatDekar(summary.gardens.surfaceAreaM2) }}</span>
                    </div>
                    <div class="flex items-center justify-between gap-3">
                        <span class="text-muted-foreground">Uyduda ölçülen çaylık</span>
                        <span class="font-semibold tabular-nums text-foreground">{{ formatDekar(summary.gardens.measuredTeaAreaM2) }}</span>
                    </div>
                    <p class="text-xs text-muted-foreground">
                        Sınır izdüşümü hisse payının tamamını kapsar; çaylık alanı bunun içindeki çay örtüsüdür. Eğimli yüzey Copernicus DEM (30 m) ile hesaplanır.
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Uyuşmazlıklar</CardTitle>
                    <CardDescription>Ruhsat, sınır ve uydu arasında</CardDescription>
                </CardHeader>
                <CardContent class="flex flex-wrap gap-2">
                    <Badge v-for="d in discrepancyBadges" :key="d" :variant="toneVariant(DISCREPANCY_META[d].tone)" :title="DISCREPANCY_META[d].description">
                        {{ DISCREPANCY_META[d].label }} · {{ summary.gardens.discrepancies[d] }}
                    </Badge>
                    <span v-if="discrepancyBadges.length === 0" class="text-sm text-muted-foreground">Uyuşmazlık yok</span>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Başvurular</CardTitle>
                    <CardDescription>{{ summary.applications.open }} açık dosya · {{ summary.conflicts.open }} sınır ihtilafı · {{ summary.lineage }} eski–yeni parsel kaydı</CardDescription>
                    <CardAction>
                        <Button variant="outline" size="sm" class="h-11 md:h-9" @click="view = 'applications'">Kuyruğu aç</Button>
                    </CardAction>
                </CardHeader>
                <CardContent class="flex flex-wrap gap-2">
                    <Badge v-for="s in applicationBadges" :key="s" :variant="toneVariant(APPLICATION_STATUS_META[s].tone)" :title="APPLICATION_STATUS_META[s].description">
                        {{ APPLICATION_STATUS_META[s].label }} · {{ summary.applications.byStatus[s] }}
                    </Badge>
                </CardContent>
            </Card>
        </div>

        <div class="flex flex-wrap items-center gap-3">
            <span class="text-sm text-muted-foreground">Görünüm</span>
            <ToggleGroup :model-value="view" type="single" aria-label="Ruhsatlandırma görünümü" @update:model-value="onView">
                <ToggleGroupItem value="producers" class="h-11 px-3 md:h-9">Müstahsiller</ToggleGroupItem>
                <ToggleGroupItem value="applications" class="h-11 px-3 md:h-9">Başvuru kuyruğu</ToggleGroupItem>
                <ToggleGroupItem value="map" class="h-11 px-3 md:h-9">Kurum haritası</ToggleGroupItem>
                <ToggleGroupItem value="audit" class="h-11 px-3 md:h-9">Arazi ön değerlendirmesi</ToggleGroupItem>
                <ToggleGroupItem value="drone" class="h-11 px-3 md:h-9">Drone doğrulama</ToggleGroupItem>
                <ToggleGroupItem value="compliance" class="h-11 px-3 md:h-9">Uygunluk raporu</ToggleGroupItem>
                <ToggleGroupItem value="cover" class="h-11 px-3 md:h-9">Arazi örtüsü</ToggleGroupItem>
            </ToggleGroup>
        </div>

        <!-- ── Licence audit: deed title × licence register × satellite detection (separate module) ── -->
        <CaykurLicenceAudit v-if="view === 'audit'" :area-id="areaId" />

        <!-- ── Drone-supported land verification: record × drone imagery (separate module) ── -->
        <CaykurDroneVerification v-if="view === 'drone'" :area-id="areaId" />

        <!-- ── Rule-based licence compliance report: every parcel against a written rule set (separate module) ── -->
        <CaykurCompliance v-if="view === 'compliance'" :area-id="areaId" />

        <!-- ── Land cover: tea or not, and what else grows on the parcel (separate module) ── -->
        <CaykurLandCover v-if="view === 'cover'" :area-id="areaId" />

        <!-- ── Producers ── -->
        <Card v-if="view === 'producers'">
            <CardHeader>
                <CardTitle>Müstahsil bazlı ruhsat kaydı</CardTitle>
                <CardDescription>{{ formatNumber(total) }} müstahsil · ruhsat eşleşmesi, sınır durumu, üç alan ve uyuşmazlıklar</CardDescription>
                <CardAction>
                    <Button variant="outline" size="sm" class="h-11 md:h-9" :disabled="isDownloading" @click="downloadCsv">
                        <Download aria-hidden="true" />CSV
                    </Button>
                </CardAction>
            </CardHeader>
            <CardContent class="flex flex-col gap-4">
                <ListToolbar>
                    <SearchInput v-model="search" placeholder="Ad, müstahsil / cüzdan / ruhsat no, ada/parsel…" />
                    <template #filters>
                        <Select :model-value="matchFilter" @update:model-value="onMatch">
                            <SelectTrigger class="h-11 w-full md:h-9 md:w-44" aria-label="Ruhsat eşleşmesi"><SelectValue placeholder="Eşleşme" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="ALL">Tüm eşleşmeler</SelectItem>
                                <SelectItem v-for="m in MATCH_LEVEL_ORDER" :key="m" :value="m">{{ MATCH_LEVEL_META[m].label }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select :model-value="approvalFilter" @update:model-value="onApproval">
                            <SelectTrigger class="h-11 w-full md:h-9 md:w-44" aria-label="Sınır durumu"><SelectValue placeholder="Sınır durumu" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="ALL">Tüm sınır durumları</SelectItem>
                                <SelectItem v-for="s in APPROVAL_STATUS_ORDER" :key="s" :value="s">{{ APPROVAL_STATUS_META[s].label }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select :model-value="discrepancyFilter" @update:model-value="onDiscrepancy">
                            <SelectTrigger class="h-11 w-full md:h-9 md:w-44" aria-label="Uyuşmazlık"><SelectValue placeholder="Uyuşmazlık" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="ALL">Tüm uyuşmazlıklar</SelectItem>
                                <SelectItem v-for="d in DISCREPANCY_ORDER" :key="d" :value="d">{{ DISCREPANCY_META[d].label }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <div class="flex items-center gap-2">
                            <Switch id="issues-only" v-model="issuesOnly" />
                            <Label for="issues-only" class="text-sm">Yalnızca sorunlular</Label>
                        </div>
                    </template>
                </ListToolbar>

                <LoadingState v-if="isLoadingRows && rows.length === 0" text="Müstahsiller yükleniyor…" />
                <EmptyState v-else-if="rows.length === 0" :icon="Users" title="Eşleşen müstahsil yok" description="Filtreleri gevşetmeyi deneyin." />
                <div v-else class="overflow-hidden rounded-lg border bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Müstahsil</TableHead>
                                <TableHead class="hidden md:table-cell">Ruhsat</TableHead>
                                <TableHead class="hidden lg:table-cell">Bahçe sınırı</TableHead>
                                <TableHead class="text-right">Ruhsat alanı</TableHead>
                                <TableHead class="hidden text-right xl:table-cell">İzdüşüm</TableHead>
                                <TableHead class="hidden text-right xl:table-cell">Eğimli yüzey</TableHead>
                                <TableHead class="hidden text-right md:table-cell">Ölçülen çay</TableHead>
                                <TableHead class="hidden lg:table-cell">Uyuşmazlık</TableHead>
                                <TableHead class="hidden text-right md:table-cell">Açık dosya</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow
                                v-for="r in rows"
                                :key="r.code"
                                class="cursor-pointer"
                                tabindex="0"
                                role="button"
                                :aria-label="`${r.name} profilini aç`"
                                @click="openProducer(r.code)"
                                @keydown="onRowKey($event, () => openProducer(r.code))"
                            >
                                <TableCell>
                                    <div class="font-medium text-foreground">{{ r.name }}</div>
                                    <div class="text-xs text-muted-foreground">{{ r.code }} · cüzdan {{ r.walletNo }} · {{ r.gardenCount }} bahçe</div>
                                    <div class="mt-1 flex flex-wrap gap-1 md:hidden">
                                        <Badge v-if="r.matchLevel" :variant="toneVariant(MATCH_LEVEL_META[r.matchLevel].tone)">{{ MATCH_LEVEL_META[r.matchLevel].label }}</Badge>
                                        <Badge v-else variant="danger">Ruhsat yok</Badge>
                                        <Badge :variant="toneVariant(APPROVAL_STATUS_META[r.approvalStatus].tone)">{{ APPROVAL_STATUS_META[r.approvalStatus].label }}</Badge>
                                    </div>
                                </TableCell>
                                <TableCell class="hidden md:table-cell">
                                    <div class="text-sm">{{ r.licenseCodes.join(', ') || '—' }}</div>
                                    <Badge v-if="r.matchLevel" :variant="toneVariant(MATCH_LEVEL_META[r.matchLevel].tone)" :title="MATCH_LEVEL_META[r.matchLevel].description">{{ MATCH_LEVEL_META[r.matchLevel].label }}</Badge>
                                    <Badge v-else variant="danger">Ruhsat yok</Badge>
                                    <Badge v-if="r.holderDeceased" variant="muted" class="ml-1">İntikal</Badge>
                                </TableCell>
                                <TableCell class="hidden lg:table-cell">
                                    <div class="text-sm">{{ r.approvedGardens }}/{{ r.gardenCount }} onaylı</div>
                                    <Badge :variant="toneVariant(APPROVAL_STATUS_META[r.approvalStatus].tone)" :title="APPROVAL_STATUS_META[r.approvalStatus].description">{{ APPROVAL_STATUS_META[r.approvalStatus].label }}</Badge>
                                </TableCell>
                                <TableCell class="text-right font-semibold tabular-nums text-foreground">{{ r.licensedAreaM2 > 0 ? formatM2(r.licensedAreaM2) : '—' }}</TableCell>
                                <TableCell class="hidden text-right tabular-nums xl:table-cell">{{ formatM2(r.planimetricAreaM2) }}</TableCell>
                                <TableCell class="hidden text-right tabular-nums xl:table-cell">{{ formatM2(r.surfaceAreaM2) }} <span class="text-xs text-muted-foreground">{{ slopeGain(r) }}</span></TableCell>
                                <TableCell class="hidden text-right tabular-nums md:table-cell">{{ formatM2(r.measuredTeaAreaM2) }}</TableCell>
                                <TableCell class="hidden lg:table-cell">
                                    <div class="flex flex-wrap gap-1">
                                        <Badge v-for="d in r.discrepancies" :key="d" :variant="toneVariant(DISCREPANCY_META[d].tone)" :title="DISCREPANCY_META[d].description">{{ DISCREPANCY_META[d].label }}</Badge>
                                        <span v-if="r.discrepancies.length === 0" class="text-xs text-muted-foreground">—</span>
                                    </div>
                                </TableCell>
                                <TableCell class="hidden text-right tabular-nums md:table-cell">{{ r.openApplications || '—' }}</TableCell>
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

        <!-- ── Applications ── -->
        <Card v-if="view === 'applications'">
            <CardHeader>
                <CardTitle>Başvuru kuyruğu</CardTitle>
                <CardDescription>{{ formatNumber(appTotal) }} dosya · yeni ruhsat, alan düzeltme, intikal, sınır belirleme, parsel güncelleme</CardDescription>
            </CardHeader>
            <CardContent class="flex flex-col gap-4">
                <ListToolbar>
                    <SearchInput v-model="appSearch" placeholder="Dosya no, müstahsil, ruhsat, ada/parsel…" />
                    <template #filters>
                        <Select :model-value="appStatus" @update:model-value="onAppStatus">
                            <SelectTrigger class="h-11 w-full md:h-9 md:w-48" aria-label="Durum"><SelectValue placeholder="Durum" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="ALL">Tüm durumlar</SelectItem>
                                <SelectItem v-for="s in APPLICATION_STATUS_ORDER" :key="s" :value="s">{{ APPLICATION_STATUS_META[s].label }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select :model-value="appType" @update:model-value="onAppType">
                            <SelectTrigger class="h-11 w-full md:h-9 md:w-44" aria-label="Tür"><SelectValue placeholder="Tür" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="ALL">Tüm türler</SelectItem>
                                <SelectItem v-for="(label, t) in APPLICATION_TYPE_LABEL" :key="t" :value="t">{{ label }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <div class="flex items-center gap-2">
                            <Switch id="open-only" v-model="appOpenOnly" />
                            <Label for="open-only" class="text-sm">Yalnızca açık dosyalar</Label>
                        </div>
                    </template>
                </ListToolbar>

                <LoadingState v-if="isLoadingApps && appRows.length === 0" text="Başvurular yükleniyor…" />
                <EmptyState v-else-if="appRows.length === 0" :icon="FileText" title="Eşleşen başvuru yok" description="Filtreleri gevşetmeyi deneyin." />
                <div v-else class="overflow-hidden rounded-lg border bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Dosya</TableHead>
                                <TableHead class="hidden md:table-cell">Müstahsil</TableHead>
                                <TableHead class="hidden lg:table-cell">Tür</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead class="hidden md:table-cell">Ada/Parsel</TableHead>
                                <TableHead class="hidden text-right lg:table-cell">Eksik belge</TableHead>
                                <TableHead class="hidden text-right md:table-cell">Son işlem</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow
                                v-for="a in appRows"
                                :key="a.code"
                                class="cursor-pointer"
                                tabindex="0"
                                role="button"
                                :aria-label="`${a.code} dosyasını aç`"
                                @click="openApplication(a.code)"
                                @keydown="onRowKey($event, () => openApplication(a.code))"
                            >
                                <TableCell>
                                    <div class="font-medium text-foreground">{{ a.code }}</div>
                                    <div class="line-clamp-2 text-xs text-muted-foreground">{{ a.summary }}</div>
                                    <div class="text-xs text-muted-foreground md:hidden">{{ a.producerName }} · {{ APPLICATION_TYPE_LABEL[a.type] }}</div>
                                </TableCell>
                                <TableCell class="hidden md:table-cell">{{ a.producerName }}<div class="text-xs text-muted-foreground">{{ a.producerCode }}</div></TableCell>
                                <TableCell class="hidden lg:table-cell">{{ APPLICATION_TYPE_LABEL[a.type] }}</TableCell>
                                <TableCell><Badge :variant="toneVariant(APPLICATION_STATUS_META[a.status].tone)" :title="APPLICATION_STATUS_META[a.status].description">{{ APPLICATION_STATUS_META[a.status].label }}</Badge></TableCell>
                                <TableCell class="hidden md:table-cell">{{ a.parcelRef ?? '—' }}</TableCell>
                                <TableCell class="hidden text-right tabular-nums lg:table-cell">{{ a.missingDocuments || '—' }}</TableCell>
                                <TableCell class="hidden text-right md:table-cell">{{ fmtDate(a.lastActivityAt) }}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
                <div v-if="appTotalPages > 1" class="flex items-center justify-between gap-3">
                    <span class="text-sm text-muted-foreground">Sayfa {{ appPage }} / {{ appTotalPages }}</span>
                    <div class="flex gap-2">
                        <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="appPage <= 1" aria-label="Önceki sayfa" @click="appPage--"><ChevronLeft aria-hidden="true" /></Button>
                        <Button variant="outline" size="icon" class="size-11 md:size-9" :disabled="appPage >= appTotalPages" aria-label="Sonraki sayfa" @click="appPage++"><ChevronRight aria-hidden="true" /></Button>
                    </div>
                </div>
            </CardContent>
        </Card>

        <!-- ── Institutional map ── -->
        <Card v-if="view === 'map'">
            <CardHeader>
                <CardTitle>Kurum haritası</CardTitle>
                <CardDescription>TKGM parselleri · uydu çayı · onaylı ruhsatlı çaylık · bekleyen/ihtilaflı sınırlar · ruhsatsız çay. Bir bahçeye tıklayınca müstahsil profili açılır.</CardDescription>
            </CardHeader>
            <CardContent class="flex flex-col gap-4">
                <div class="flex flex-wrap gap-x-5 gap-y-2">
                    <div class="flex items-center gap-2"><Switch id="ly-parcels" v-model="showLayer.parcels" /><Label for="ly-parcels" class="text-sm">TKGM parselleri</Label></div>
                    <div class="flex items-center gap-2"><Switch id="ly-tea" v-model="showLayer.tea" /><Label for="ly-tea" class="text-sm">Uydu çay örtüsü</Label></div>
                    <div class="flex items-center gap-2"><Switch id="ly-approved" v-model="showLayer.approved" /><Label for="ly-approved" class="text-sm">Onaylı ruhsatlı çaylık</Label></div>
                    <div class="flex items-center gap-2"><Switch id="ly-pending" v-model="showLayer.pending" /><Label for="ly-pending" class="text-sm">Bekleyen / ihtilaflı / ruhsatsız bahçe</Label></div>
                    <div class="flex items-center gap-2"><Switch id="ly-proposals" v-model="showLayer.proposals" /><Label for="ly-proposals" class="text-sm">Sınır önerileri</Label></div>
                    <div class="flex items-center gap-2"><Switch id="ly-conflicts" v-model="showLayer.conflicts" /><Label for="ly-conflicts" class="text-sm">Çakışmalar</Label></div>
                    <div class="flex items-center gap-2"><Switch id="ly-unlicensed" v-model="showLayer.unlicensed" /><Label for="ly-unlicensed" class="text-sm">Ruhsatsız çay (fark)</Label></div>
                </div>
                <div ref="mapContainer" class="h-[60vh] min-h-80 w-full overflow-hidden rounded-lg border" />
                <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span><span class="inline-block size-3 rounded-sm bg-primary/70 align-middle" /> onaylı sınır</span>
                    <span><span class="inline-block size-3 rounded-sm bg-info/70 align-middle" /> öneri</span>
                    <span><span class="inline-block size-3 rounded-sm bg-warning/70 align-middle" /> saha kontrolü / eşleşme bekliyor</span>
                    <span><span class="inline-block size-3 rounded-sm bg-destructive/70 align-middle" /> sınır ihtilafı (çakışma)</span>
                    <span><span class="inline-block size-3 rounded-sm border border-dashed border-muted-foreground align-middle" /> hisse sınırı belirsiz</span>
                    <span><span class="inline-block size-3 rounded-sm bg-warning/50 align-middle" /> ruhsatsız çay</span>
                </div>
            </CardContent>
        </Card>

        <!-- ── Producer profile ── -->
        <Sheet v-model:open="sheetOpen">
            <SheetContent side="right" class="w-full gap-0 overflow-y-auto sm:max-w-3xl">
                <LoadingState v-if="isLoadingProfile || !profile" text="Profil yükleniyor…" class="p-6" />
                <template v-else>
                    <SheetHeader class="border-b">
                        <SheetTitle>{{ profile.name }}</SheetTitle>
                        <SheetDescription>{{ profile.code }} · Cüzdan {{ profile.walletNo }} · {{ profile.licenseCodes.join(', ') || 'Ruhsat yok' }}</SheetDescription>
                        <div class="flex flex-wrap gap-1">
                            <Badge v-if="profile.matchLevel" :variant="toneVariant(MATCH_LEVEL_META[profile.matchLevel].tone)">{{ MATCH_LEVEL_META[profile.matchLevel].label }}</Badge>
                            <Badge v-else variant="danger">Ruhsat yok</Badge>
                            <Badge :variant="toneVariant(APPROVAL_STATUS_META[profile.approvalStatus].tone)">{{ APPROVAL_STATUS_META[profile.approvalStatus].label }}</Badge>
                            <Badge v-for="d in profile.discrepancies" :key="d" :variant="toneVariant(DISCREPANCY_META[d].tone)">{{ DISCREPANCY_META[d].label }}</Badge>
                            <Badge v-if="profile.pruningStatus" variant="outline">Budama {{ profile.pruningSeason }}: {{ PRODUCER_STATUS_META[profile.pruningStatus].label }}</Badge>
                        </div>
                    </SheetHeader>

                    <div class="flex flex-col gap-6 p-4 md:p-6">
                        <CaykurProducerDossier :area-id="areaId" :profile="profile" :generated-at="summary?.generatedAt ?? null" />
                        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div class="rounded-lg border bg-card p-3">
                                <div class="text-xs text-muted-foreground">Ruhsat alanı (tahsis)</div>
                                <div class="font-semibold tabular-nums text-foreground">{{ profile.licensedAreaM2 > 0 ? formatM2(profile.licensedAreaM2) : '—' }}</div>
                            </div>
                            <div class="rounded-lg border bg-card p-3">
                                <div class="text-xs text-muted-foreground">Sınır izdüşümü</div>
                                <div class="font-semibold tabular-nums text-foreground">{{ formatM2(profile.planimetricAreaM2) }}</div>
                            </div>
                            <div class="rounded-lg border bg-card p-3">
                                <div class="text-xs text-muted-foreground">Eğimli yüzey (DEM)</div>
                                <div class="font-semibold tabular-nums text-foreground">{{ formatM2(profile.surfaceAreaM2) }} <span class="text-xs font-normal text-muted-foreground">{{ slopeGain(profile) }}</span></div>
                            </div>
                            <div class="rounded-lg border bg-card p-3">
                                <div class="text-xs text-muted-foreground">Uyduda ölçülen çay</div>
                                <div class="font-semibold tabular-nums text-foreground">{{ formatM2(profile.measuredTeaAreaM2) }}</div>
                            </div>
                        </div>

                        <div ref="profileMapContainer" class="h-72 w-full overflow-hidden rounded-lg border" />

                        <section class="flex flex-col gap-3">
                            <h3 class="text-base font-semibold">Ruhsatlar</h3>
                            <p v-if="profile.licenses.length === 0" class="text-sm text-muted-foreground">Bu müstahsile bağlı ruhsat yok. Fiili çaylığı varsa yeni ruhsat başvurusu açılmalıdır.</p>
                            <div v-for="l in profile.licenses" :key="l.code" class="rounded-lg border bg-card p-4 text-sm">
                                <div class="flex flex-wrap items-center justify-between gap-2">
                                    <div class="font-medium text-foreground">{{ l.code }} <span class="font-normal text-muted-foreground">· {{ l.issuedYear }} · {{ LICENSE_STATUS_LABEL[l.status] }}</span></div>
                                    <div class="flex gap-1">
                                        <Badge :variant="toneVariant(MATCH_LEVEL_META[l.matchLevel].tone)" :title="MATCH_LEVEL_META[l.matchLevel].description">{{ MATCH_LEVEL_META[l.matchLevel].label }}</Badge>
                                        <Badge v-if="l.holderDeceased" variant="muted">Sahibi vefat etti</Badge>
                                    </div>
                                </div>
                                <div class="mt-2 grid gap-2 sm:grid-cols-2">
                                    <div><span class="text-muted-foreground">Ruhsatta yazan alan:</span> <span class="font-semibold tabular-nums text-foreground">{{ formatM2(l.recordedAreaM2) }}</span></div>
                                    <div><span class="text-muted-foreground">Bahçelere tahsis edilen:</span> <span class="font-semibold tabular-nums text-foreground">{{ l.allocatedAreaM2 > 0 ? formatM2(l.allocatedAreaM2) : '— (eşleşme bekliyor)' }}</span></div>
                                    <div class="sm:col-span-2"><span class="text-muted-foreground">Ruhsattaki parsel kaydı:</span> {{ l.recordedParcelRefs.join('; ') }}</div>
                                    <div v-if="l.lineage.length" class="sm:col-span-2 rounded-md bg-muted/40 p-2 text-xs">
                                        <div class="font-medium">Eski → yeni parsel bağlantısı</div>
                                        <div v-for="x in l.lineage" :key="x.code">{{ x.oldRef }} → {{ x.newParcelKey.split('/').slice(1).join('/') }} ({{ x.changeType }}, {{ fmtDate(x.changedAt) }}) · {{ x.source }}</div>
                                    </div>
                                    <div v-if="l.candidateParcelKeys.length" class="sm:col-span-2 text-xs text-muted-foreground">
                                        Aday parseller: {{ l.candidateParcelKeys.map((k) => k.split('/').slice(1).join('/')).join(', ') }} — eksper teyidi bekliyor
                                    </div>
                                    <div v-if="l.parentCode || l.childCodes.length" class="sm:col-span-2 text-xs text-muted-foreground">
                                        <span v-if="l.parentCode">{{ l.parentCode }} ruhsatından ayrıldı</span><span v-if="l.parentCode && l.childCodes.length"> · </span><span v-if="l.childCodes.length">ayrılan ruhsatlar: {{ l.childCodes.join(', ') }}</span>
                                    </div>
                                    <div v-if="l.history.length" class="sm:col-span-2 rounded-md bg-muted/40 p-2 text-xs">
                                        <div class="font-medium">Ruhsat geçmişi</div>
                                        <div v-for="(h, i) in l.history" :key="i">{{ fmtDate(h.at) }} · {{ h.note }} <span class="text-muted-foreground">· {{ h.by }}<template v-if="h.applicationCode"> · {{ h.applicationCode }}</template></span></div>
                                    </div>
                                </div>
                                <div v-if="canDecide && (l.status === 'active' || l.status === 'transfer_pending')" class="mt-3 flex flex-wrap gap-2">
                                    <Button variant="outline" size="sm" class="h-11 md:h-9" @click="openOperation('license_split', null, l.code)">Ruhsatı ayır</Button>
                                    <Button variant="outline" size="sm" class="h-11 md:h-9" @click="openOperation('transfer', null, l.code)">Devir / intikal</Button>
                                </div>
                            </div>
                        </section>

                        <section class="flex flex-col gap-3">
                            <h3 class="text-base font-semibold">Çaylık alt-poligonları</h3>
                            <div class="overflow-hidden rounded-lg border bg-card">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Bahçe</TableHead>
                                            <TableHead>Sınır</TableHead>
                                            <TableHead class="text-right">Ruhsat</TableHead>
                                            <TableHead class="hidden text-right sm:table-cell">İzdüşüm</TableHead>
                                            <TableHead class="hidden text-right sm:table-cell">Eğimli</TableHead>
                                            <TableHead class="text-right">Çay</TableHead>
                                            <TableHead v-if="canDecide" class="w-12 text-right"><span class="sr-only">İşlem</span></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <template v-for="g in profile.gardens" :key="g.code">
                                            <TableRow class="cursor-pointer" :class="g.recordStatus === 'superseded' ? 'opacity-60' : ''" tabindex="0" role="button" :aria-expanded="expandedGarden === g.code" @click="toggleGarden(g.code)" @keydown="onRowKey($event, () => toggleGarden(g.code))">
                                                <TableCell>
                                                    <div class="font-medium text-foreground">{{ g.block }}/{{ g.parcel }}</div>
                                                    <div class="text-xs text-muted-foreground">{{ g.code }}<template v-if="g.holderCount > 1"> · hisse {{ g.holderIndex }}/{{ g.holderCount }}</template> · {{ g.licenseCode ?? 'ruhsat yok' }} · sürüm {{ g.versions.length }}<template v-if="g.parentCode"> · {{ g.parentCode }} bahçesinden</template></div>
                                                    <div class="mt-1 flex flex-wrap gap-1">
                                                        <Badge v-if="g.recordStatus === 'superseded'" variant="muted">Bölündü → {{ g.supersededBy.join(', ') }}</Badge>
                                                        <Badge v-if="g.source === 'site' && g.recordStatus === 'active'" variant="outline">Site kaydı</Badge>
                                                        <Badge v-for="d in g.discrepancies" :key="d" :variant="toneVariant(DISCREPANCY_META[d].tone)">{{ DISCREPANCY_META[d].label }}</Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell><Badge :variant="toneVariant(APPROVAL_STATUS_META[g.approvalStatus].tone)" :title="APPROVAL_STATUS_META[g.approvalStatus].description">{{ APPROVAL_STATUS_META[g.approvalStatus].label }}</Badge></TableCell>
                                                <TableCell class="text-right font-semibold tabular-nums text-foreground">{{ g.licensedAreaM2 === null ? '—' : formatM2(g.licensedAreaM2) }}</TableCell>
                                                <TableCell class="hidden text-right tabular-nums sm:table-cell">{{ formatM2(g.planimetricAreaM2) }}</TableCell>
                                                <TableCell class="hidden text-right tabular-nums sm:table-cell">{{ formatM2(g.surfaceAreaM2) }} <span class="text-xs text-muted-foreground">{{ g.meanSlopeDeg }}°</span></TableCell>
                                                <TableCell class="text-right tabular-nums">{{ formatM2(g.measuredTeaAreaM2) }}</TableCell>
                                                <TableCell v-if="canDecide" class="text-right" @click.stop>
                                                    <DropdownMenu v-if="g.recordStatus === 'active'">
                                                        <DropdownMenuTrigger as-child>
                                                            <Button variant="ghost" size="icon" class="size-11 md:size-9" aria-label="Bahçe işlemleri"><MoreHorizontal aria-hidden="true" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem @select="openOperation('garden_subdivision', g.code, g.licenseCode)">Alt bölünme (parçalara ayır)</DropdownMenuItem>
                                                            <DropdownMenuItem @select="openOperation('boundary_determination', g.code, g.licenseCode)">Sınır tespiti / düzeltme</DropdownMenuItem>
                                                            <DropdownMenuItem @select="openOperation('area_correction', g.code, g.licenseCode)">Ruhsat alanı düzeltme</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                            <TableRow v-if="expandedGarden === g.code">
                                                <TableCell :colspan="canDecide ? 7 : 6" class="bg-muted/30">
                                                    <div class="flex flex-col gap-2 text-xs">
                                                        <div v-if="g.events.length" class="rounded-md border p-2">
                                                            <div class="font-medium">Kayıt geçmişi</div>
                                                            <div v-for="(ev, i) in g.events" :key="i">{{ fmtDate(ev.at) }} · {{ ev.note }} <span class="text-muted-foreground">· {{ ev.by }}<template v-if="ev.applicationCode"> · {{ ev.applicationCode }}</template></span></div>
                                                        </div>
                                                        <div class="font-medium">Geometri sürümleri</div>
                                                        <div v-for="v in g.versions" :key="v.version" class="flex flex-wrap gap-x-3">
                                                            <span class="font-medium">v{{ v.version }}</span>
                                                            <span>{{ formatM2(v.planimetricAreaM2) }}</span>
                                                            <span>{{ v.reason }}</span>
                                                            <span class="text-muted-foreground">{{ v.source }} · {{ fmtDate(v.validFrom) }} → {{ v.validTo ? fmtDate(v.validTo) : 'güncel' }}</span>
                                                        </div>
                                                        <div v-if="g.proposal" class="mt-1 rounded-md border border-info/40 p-2">
                                                            <span class="font-medium">Sınır önerisi</span> · {{ g.proposal.proposedBy === 'producer' ? 'müstahsil' : 'personel' }} · {{ fmtDate(g.proposal.proposedAt) }} · {{ formatM2(g.proposal.planimetricAreaM2) }}
                                                            <span v-if="g.proposal.overlapM2 > 0" class="text-destructive"> · {{ g.proposal.overlapsGardenCode }} ile {{ formatM2(g.proposal.overlapM2) }} çakışma</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        </template>
                                    </TableBody>
                                </Table>
                            </div>
                        </section>

                        <section class="flex flex-col gap-3">
                            <h3 class="text-base font-semibold">Başvurular</h3>
                            <p v-if="profile.applications.length === 0" class="text-sm text-muted-foreground">Açık ya da kapalı başvuru yok.</p>
                            <div v-for="a in profile.applications" :key="a.code" class="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm">
                                <div>
                                    <div class="font-medium text-foreground">{{ a.code }} · {{ APPLICATION_TYPE_LABEL[a.type] }}</div>
                                    <div class="text-xs text-muted-foreground">{{ a.summary }}</div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <Badge :variant="toneVariant(APPLICATION_STATUS_META[a.status].tone)">{{ APPLICATION_STATUS_META[a.status].label }}</Badge>
                                    <Button variant="outline" size="sm" class="h-11 md:h-9" @click="openApplication(a.code)">Dosyayı aç</Button>
                                </div>
                            </div>
                        </section>

                        <section v-if="profile.pruningHistory.length" class="flex flex-col gap-2">
                            <h3 class="text-base font-semibold">Budama geçmişi (1/7, ruhsat alanı üzerinden)</h3>
                            <div class="flex flex-wrap gap-2">
                                <div v-for="h in profile.pruningHistory" :key="h.season" class="rounded-lg border bg-card px-3 py-2 text-sm">
                                    <div class="font-medium">{{ h.season }}</div>
                                    <Badge :variant="toneVariant(PRODUCER_STATUS_META[h.status].tone)">{{ PRODUCER_STATUS_META[h.status].label }}</Badge>
                                    <div class="text-xs text-muted-foreground">hedef {{ formatM2(h.requiredM2) }} · yeni budama {{ formatM2(h.newPrunedM2) }}</div>
                                </div>
                            </div>
                        </section>
                    </div>
                </template>
            </SheetContent>
        </Sheet>

        <!-- ── Application file ── -->
        <Dialog v-model:open="dialogOpen">
            <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <LoadingState v-if="isLoadingApp || !application" text="Dosya yükleniyor…" />
                <template v-else>
                    <DialogHeader>
                        <DialogTitle>{{ application.code }} · {{ APPLICATION_TYPE_LABEL[application.type] }}</DialogTitle>
                        <DialogDescription>{{ application.producerName }} ({{ application.producerCode }}) · {{ application.licenseCode ?? 'ruhsat yok' }}<template v-if="application.parcelRef"> · {{ application.parcelRef }}</template> · {{ fmtDate(application.submittedAt) }}</DialogDescription>
                    </DialogHeader>
                    <div class="flex flex-col gap-4 text-sm">
                        <div class="flex flex-wrap items-center gap-2">
                            <Badge :variant="toneVariant(APPLICATION_STATUS_META[application.status].tone)">{{ APPLICATION_STATUS_META[application.status].label }}</Badge>
                            <span class="text-muted-foreground">{{ APPLICATION_STATUS_META[application.status].description }}</span>
                        </div>
                        <p>{{ application.summary }}</p>
                        <p v-if="application.source === 'site'" class="text-xs text-muted-foreground">Site üzerinden açıldı · {{ application.createdByName }}<template v-if="application.appliedAt"> · onayla birlikte {{ fmtDate(application.appliedAt) }} tarihinde sicile işlendi</template></p>

                        <div v-if="payloadView" class="rounded-md border p-3">
                            <div class="mb-2 font-medium">Talep içeriği</div>
                            <div v-if="payloadView.pieces" class="overflow-hidden rounded-md border">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Parça</TableHead><TableHead>Sahip</TableHead><TableHead class="text-right">İzdüşüm</TableHead><TableHead class="text-right">Ruhsat payı</TableHead><TableHead class="text-right">Çay</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        <TableRow v-for="pc in payloadView.pieces" :key="pc.label">
                                            <TableCell class="font-medium">{{ pc.label }}</TableCell>
                                            <TableCell>{{ pc.holderName }}</TableCell>
                                            <TableCell class="text-right tabular-nums">{{ formatM2(pc.planimetricAreaM2) }}</TableCell>
                                            <TableCell class="text-right tabular-nums">{{ pc.licensedAreaM2 == null ? '—' : formatM2(pc.licensedAreaM2) }}</TableCell>
                                            <TableCell class="text-right tabular-nums">{{ formatM2(pc.measuredTeaAreaM2) }}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                            <div v-else-if="payloadView.parts" class="flex flex-col gap-1 text-xs">
                                <div v-for="pt in payloadView.parts" :key="pt.label"><span class="font-medium">{{ pt.label }}</span> · {{ pt.holderName }} · {{ pt.gardenCodes.join(', ') }} · ruhsatta {{ formatM2(pt.recordedAreaM2) }} · {{ pt.keepsOriginal ? 'mevcut ruhsat kalır' : 'yeni ruhsat' }}</div>
                            </div>
                            <div v-else-if="payloadView.before && payloadView.after" class="text-xs">İzdüşüm {{ formatM2(payloadView.before.planimetricAreaM2) }} → {{ formatM2(payloadView.after.planimetricAreaM2) }} · çay {{ formatM2(payloadView.before.measuredTeaAreaM2) }} → {{ formatM2(payloadView.after.measuredTeaAreaM2) }}</div>
                            <div v-else-if="payloadView.holderName" class="text-xs">Devralan: <span class="font-medium">{{ payloadView.holderName }}</span></div>
                            <div v-else-if="payloadView.newLicensedAreaM2 != null" class="text-xs">Ruhsat alanı {{ payloadView.previousLicensedAreaM2 == null ? '—' : formatM2(payloadView.previousLicensedAreaM2) }} → {{ formatM2(payloadView.newLicensedAreaM2) }}</div>
                            <div v-if="payloadView.cause || payloadView.reason" class="mt-1 text-xs text-muted-foreground"><template v-if="payloadView.cause">{{ CAUSE_LABEL[payloadView.cause] ?? payloadView.cause }}</template><template v-if="payloadView.cause && payloadView.reason"> · </template>{{ payloadView.reason }}</div>
                        </div>
                        <div v-if="effectsView.length" class="rounded-md border border-success/40 bg-success/5 p-3 text-xs">
                            <div class="mb-1 text-sm font-medium">Sicile işlenen değişiklik</div>
                            <div v-for="e in effectsView" :key="e.label"><span class="text-muted-foreground">{{ e.label }}:</span> {{ e.value }}</div>
                        </div>

                        <div>
                            <div class="mb-1 font-medium">Belgeler</div>
                            <ul class="flex flex-col gap-1">
                                <li v-for="d in application.documents" :key="d.type" class="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                                    <span>{{ d.name }}</span>
                                    <Badge :variant="d.status === 'provided' ? 'success' : 'warning'">{{ d.status === 'provided' ? 'Var' : 'Eksik' }}</Badge>
                                </li>
                            </ul>
                        </div>

                        <div v-if="application.garden" class="rounded-md border p-3">
                            <div class="mb-1 font-medium">İlgili bahçe {{ application.garden.block }}/{{ application.garden.parcel }}</div>
                            <div class="grid gap-1 text-xs sm:grid-cols-2">
                                <span>Sınır: {{ APPROVAL_STATUS_META[application.garden.approvalStatus].label }}</span>
                                <span>Ruhsat alanı: {{ application.garden.licensedAreaM2 === null ? '—' : formatM2(application.garden.licensedAreaM2) }}</span>
                                <span>İzdüşüm: {{ formatM2(application.garden.planimetricAreaM2) }}</span>
                                <span>Eğimli yüzey: {{ formatM2(application.garden.surfaceAreaM2) }} ({{ application.garden.meanSlopeDeg }}°)</span>
                                <span>Ölçülen çay: {{ formatM2(application.garden.measuredTeaAreaM2) }}</span>
                                <span>Sürüm: {{ application.garden.versions.length }}</span>
                            </div>
                        </div>
                        <div v-if="application.license" class="rounded-md border p-3 text-xs">
                            <div class="mb-1 text-sm font-medium">Ruhsat {{ application.license.code }}</div>
                            {{ application.license.issuedYear }} · {{ MATCH_LEVEL_META[application.license.matchLevel].label }} · ruhsatta {{ formatM2(application.license.recordedAreaM2) }} · kayıt: {{ application.license.recordedParcelRefs.join('; ') }}
                        </div>

                        <div>
                            <div class="mb-1 font-medium">Dosya geçmişi</div>
                            <ol class="flex flex-col gap-1 border-l pl-3">
                                <li v-for="(h, i) in application.history" :key="i" class="text-xs">
                                    <span class="text-muted-foreground">{{ fmtDate(h.at) }}</span> ·
                                    <template v-if="h.from">{{ APPLICATION_STATUS_META[h.from].label }} → </template>
                                    <span class="font-medium">{{ APPLICATION_STATUS_META[h.to].label }}</span> · {{ h.by }} — {{ h.note }}
                                </li>
                                <li v-for="d in application.decisions" :key="d.decidedAt" class="text-xs">
                                    <span class="text-muted-foreground">{{ fmtDate(d.decidedAt) }}</span> ·
                                    {{ APPLICATION_STATUS_META[d.fromStatus].label }} → <span class="font-medium">{{ APPLICATION_STATUS_META[d.toStatus].label }}</span> · {{ d.decidedByName }} (demo)<template v-if="d.note"> — {{ d.note }}</template>
                                </li>
                            </ol>
                        </div>

                        <div v-if="canDecide && application.allowedTransitions.length" class="flex flex-col gap-2">
                            <Label for="decision-note">Eksper notu</Label>
                            <Textarea id="decision-note" v-model="note" rows="2" placeholder="Gerekçe / saha notu (iade, ret ve saha kontrolü için zorunlu)" />
                        </div>
                    </div>
                    <DialogFooter v-if="canDecide && application.allowedTransitions.length" class="flex-wrap gap-2">
                        <Button
                            v-for="s in application.allowedTransitions"
                            :key="s"
                            :variant="s === 'DEMO_APPROVED' ? 'default' : s === 'REJECTED' ? 'destructive' : 'outline'"
                            class="h-11 md:h-9"
                            :disabled="isDeciding"
                            @click="decide(s)"
                        >
                            {{ APPLICATION_STATUS_META[s].label }}
                        </Button>
                    </DialogFooter>
                    <p v-else-if="!canDecide" class="text-xs text-muted-foreground">Bu rol dosyayı yalnızca görüntüleyebilir.</p>
                </template>
            </DialogContent>
        </Dialog>

        <CaykurLicensingOperations
            v-if="profile"
            v-model:open="opOpen"
            :area-id="areaId"
            :kind="opKind"
            :profile="profile"
            :garden-code="opGarden"
            :license-code="opLicense"
            @created="onOperationCreated"
        />
    </div>
</template>
