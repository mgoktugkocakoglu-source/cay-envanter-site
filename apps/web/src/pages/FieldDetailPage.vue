<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Calendar, CircleAlert, ClipboardList, FileText, LandPlot, MapPin, PenLine, Ruler, Square, Users } from '@lucide/vue';
import { useFieldsStore } from '@/stores/fieldsStore';
import { useAuthStore } from '@/stores/authStore';
import { useMeasurementRequestsStore } from '@/stores/measurementRequestsStore';
import { useToast } from '@/composables/useToast';
import { api, type LicensingApprovalStatus, type LicensingMeasurement } from '@/services/api';
import { fieldBoundaryMeta, parcelLabel } from '@/services/fieldBoundary';
import { MEASUREMENT_REQUEST_STATUS_META } from '@/services/caykur/measurementRequests';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import BoundarySketch from '@/components/map/BoundarySketch.vue';
import { ConfirmDialog, EmptyState, LoadingState, PageContainer, PageHeader, Spinner, StatCard } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Field detail. On a hisseli (shared-title) parcel the owner settles their
 * slice here: draw it on the satellite map ("Arazini Belirle") or ask Çaykur
 * staff to measure it on site. Co-owners approve from Bildirimler; once every
 * co-owner approved, the map, area and "Alan no" below are updated.
 */
const route = useRoute();
const router = useRouter();
const fieldsStore = useFieldsStore();
const authStore = useAuthStore();
const requestsStore = useMeasurementRequestsStore();
const toast = useToast();

// Map state
const mapContainer = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
let fieldLayer: L.GeoJSON | null = null;

// `query.id` lets the DEV preview route render a mocked field.
const fieldId = computed(() => String(route.params.id ?? route.query.id ?? ''));
const field = computed(() => fieldsStore.currentField);

const fieldDisplayName = computed(() => field.value?.name?.trim() || 'İsimsiz Arazi');
const isOwner = computed(() => !!field.value && field.value.userId === authStore.user?.id);
const boundaryMeta = computed(() => (field.value ? fieldBoundaryMeta(field.value) : null));

// ── Pending boundary (drawn or measured, awaiting the co-owners) ──
const pendingMeasurement = ref<LicensingMeasurement | null>(null);
async function loadPendingMeasurement(): Promise<void> {
    const id = field.value?.pendingMeasurementId;
    if (!id) {
        pendingMeasurement.value = null;
        return;
    }
    const res = await api.getLicensingMeasurement(id);
    pendingMeasurement.value = res.data ?? null;
}

// ── Open on-site measurement request ──
const openRequest = computed(() => {
    const id = field.value?.pendingRequestId;
    return id ? requestsStore.byId(id) ?? null : null;
});
async function loadOpenRequest(): Promise<void> {
    const id = field.value?.pendingRequestId;
    if (id && !requestsStore.byId(id)) await requestsStore.fetchOne(id);
}

const busy = ref(false);

// Request dialog
const showRequestDialog = ref(false);
const requestNote = ref('');
async function submitRequest(): Promise<void> {
    if (!field.value) return;
    busy.value = true;
    const created = await requestsStore.createRequest({
        fieldId: field.value.id,
        producerNote: requestNote.value.trim() || undefined,
    });
    busy.value = false;
    if (created) {
        showRequestDialog.value = false;
        requestNote.value = '';
        toast.success('Ölçüm talebiniz alındı; Çaykur personeli randevu verecek.');
        await fieldsStore.fetchField(field.value.id);
    } else {
        toast.error(requestsStore.error ?? 'Talep oluşturulamadı.');
    }
}

// Cancel request
const showCancelDialog = ref(false);
async function confirmCancelRequest(): Promise<void> {
    if (!openRequest.value || !field.value) return;
    busy.value = true;
    const updated = await requestsStore.cancel(openRequest.value.id);
    busy.value = false;
    showCancelDialog.value = false;
    if (updated) {
        toast.info('Ölçüm talebi iptal edildi.');
        await fieldsStore.fetchField(field.value.id);
    } else {
        toast.error(requestsStore.error ?? 'Talep iptal edilemedi.');
    }
}

function goDetermine(): void {
    router.push(`/tea/fields/${fieldId.value}/determine`);
}

const APPROVAL_STATUS: Record<LicensingApprovalStatus, { label: string; variant: 'muted' | 'success' | 'danger' }> = {
    pending: { label: 'Bekliyor', variant: 'muted' },
    approved: { label: 'Onayladı', variant: 'success' },
    rejected: { label: 'İtiraz etti', variant: 'danger' },
};

// Load field data
onMounted(async () => {
    await fieldsStore.fetchField(fieldId.value);
    await Promise.all([loadPendingMeasurement(), loadOpenRequest()]);
    await nextTick();
    initializeMap();
});

watch(
    () => [field.value?.pendingMeasurementId, field.value?.pendingRequestId],
    () => {
        void loadPendingMeasurement();
        void loadOpenRequest();
    },
);
watch(
    () => field.value?.boundaryMeasurementId,
    () => renderFieldOnMap(),
);

onUnmounted(() => {
    if (map) {
        map.remove();
        map = null;
    }
});

function initializeMap() {
    if (!mapContainer.value) return;

    map = L.map(mapContainer.value, {
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        zoomControl: false,
        attributionControl: false,
        boxZoom: false,
        keyboard: false,
        dragging: true,
    }).setView([39.0, 35.0], 6);

    // Satellite imagery tile layer (Google Satellite — sharper, free, no API key)
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        maxNativeZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);
    renderFieldOnMap();
}

function getCssVar(name: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function renderFieldOnMap() {
    if (!map) return;
    const coordinates = field.value?.coordinates;
    if (!coordinates || coordinates.length === 0) return;

    fieldLayer?.remove();
    const geoJson: GeoJSON.Feature = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates },
    };

    fieldLayer = L.geoJSON(geoJson, {
        style: {
            color: getCssVar('--primary', '#059669'),
            weight: 3,
            fillOpacity: 0.2,
            fillColor: getCssVar('--primary', '#10b981'),
        },
    }).addTo(map);

    map.fitBounds(fieldLayer.getBounds(), { padding: [50, 50] });
}

function formatArea(area: number, unit: string) {
    const formatted = area.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
    const unitLabels: Record<string, string> = { donum: 'dönüm', dekar: 'dekar', m2: 'm²' };
    return `${formatted} ${unitLabels[unit] || unit}`;
}

function formatDate(dateString: string | null | undefined) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatNumber(n: number): string {
    return Math.round(n).toLocaleString('tr-TR');
}

function goBack() {
    router.push('/tea/fields');
}
</script>

<template>
    <TeaBusinessLayout>
        <PageContainer>
            <LoadingState v-if="fieldsStore.isLoading && !field" text="Arazi bilgileri yükleniyor..." />

            <EmptyState v-else-if="fieldsStore.error && !field" :icon="CircleAlert" title="Bir hata oluştu" :description="fieldsStore.error">
                <Button variant="outline" class="h-11 md:h-9" @click="goBack">
                    <ArrowLeft aria-hidden="true" />
                    Geri Dön
                </Button>
            </EmptyState>

            <template v-else-if="field">
                <PageHeader
                    :title="fieldDisplayName"
                    :description="`${field.province}, ${field.district}`"
                    back-to="/tea/fields"
                    back-label="Araziler"
                >
                    <template #meta>
                        <Badge v-if="field.area" variant="secondary">{{ formatArea(field.area, field.areaUnit) }}</Badge>
                        <Badge v-if="parcelLabel(field)" variant="outline">{{ parcelLabel(field) }}</Badge>
                        <Badge v-if="boundaryMeta" :variant="boundaryMeta.tone">{{ boundaryMeta.label }}</Badge>
                    </template>
                </PageHeader>

                <!-- ── Ruhsatlandırma ölçümü (shared parcel, owner only) ── -->
                <template v-if="field.isShared && isOwner">
                    <Alert v-if="field.boundaryStatus === 'undetermined'" variant="destructive">
                        <Users aria-hidden="true" />
                        <AlertTitle>Ruhsatlandırma ölçümü gerekiyor</AlertTitle>
                        <AlertDescription>
                            <p>
                                Bu ada/parselde {{ field.coOwnerCount }} kayıtlı cüzdan var ve size ait sınır henüz belirlenmedi.
                                Sınırınızı güncel uydu görüntüsünde çizin; çizim diğer kayıtlı üreticilerin onayına gönderilir.
                                Uydu görüntüsünde arazi seçilemiyorsa Çaykur personelinin sahada ölçmesini isteyin.
                            </p>
                            <div class="mt-3 flex flex-col gap-2 sm:flex-row">
                                <Button class="h-11 md:h-9" :disabled="busy" @click="goDetermine">
                                    <PenLine aria-hidden="true" />
                                    Arazini Belirle
                                </Button>
                                <template v-if="openRequest">
                                    <Badge :variant="MEASUREMENT_REQUEST_STATUS_META[openRequest.status].tone" class="h-11 self-start px-3 md:h-9">
                                        <Ruler aria-hidden="true" />
                                        Ölçüm talebi · {{ MEASUREMENT_REQUEST_STATUS_META[openRequest.status].label }}
                                        <template v-if="openRequest.appointmentDate"> · {{ formatDate(openRequest.appointmentDate) }}</template>
                                    </Badge>
                                    <Button
                                        v-if="openRequest.status === 'pending' || openRequest.status === 'scheduled'"
                                        variant="ghost"
                                        class="h-11 md:h-9"
                                        :disabled="busy"
                                        @click="showCancelDialog = true"
                                    >
                                        Talebi iptal et
                                    </Button>
                                </template>
                                <Button v-else variant="outline" class="h-11 md:h-9" :disabled="busy" @click="showRequestDialog = true">
                                    <Ruler aria-hidden="true" />
                                    Arazide ölçüm talebi oluştur
                                </Button>
                            </div>
                        </AlertDescription>
                    </Alert>

                    <Alert v-else-if="field.boundaryStatus === 'pending_approval'" variant="warning">
                        <ClipboardList aria-hidden="true" />
                        <AlertTitle>Sınırınız ortak sahiplerin onayını bekliyor</AlertTitle>
                        <AlertDescription>
                            <p>
                                <template v-if="pendingMeasurement?.source === 'producer_map'">Çizdiğiniz sınır</template>
                                <template v-else>Çaykur personelinin sahada ölçtüğü sınır</template>
                                ({{ formatNumber(pendingMeasurement?.measuredAreaM2 ?? 0) }} m²) diğer kayıtlı üreticilere gönderildi.
                                Hepsi onayladığında arazi bilgileriniz güncellenir.
                            </p>
                            <div v-if="pendingMeasurement" class="mt-3 grid gap-3 sm:grid-cols-[160px_1fr]">
                                <BoundarySketch :points="pendingMeasurement.measurementPoints" class="max-w-40" />
                                <ul class="flex flex-wrap content-start gap-2">
                                    <li v-for="a in pendingMeasurement.approvals ?? []" :key="a.id">
                                        <Badge :variant="APPROVAL_STATUS[a.status].variant">{{ a.approverName }} · {{ APPROVAL_STATUS[a.status].label }}</Badge>
                                    </li>
                                </ul>
                            </div>
                            <div class="mt-3">
                                <Button variant="outline" class="h-11 md:h-9" :disabled="busy" @click="goDetermine">
                                    <PenLine aria-hidden="true" />
                                    Yeniden çiz
                                </Button>
                            </div>
                        </AlertDescription>
                    </Alert>
                </template>

                <!-- Map -->
                <Card class="gap-0 overflow-hidden py-0">
                    <div ref="mapContainer" class="relative z-0 h-70 w-full md:h-96" role="img" :aria-label="`${fieldDisplayName} arazisinin uydu haritası`"></div>
                </Card>

                <!-- Stats -->
                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Toplam Alan" :value="formatArea(field.area, field.areaUnit)" :icon="Square" />
                    <StatCard
                        v-if="field.adaNo || field.parcelNo"
                        label="Ada / Parsel No"
                        :value="`${field.adaNo || '—'} / ${field.parcelNo || '—'}`"
                        :icon="LandPlot"
                    />
                    <StatCard v-if="field.isShared" label="Alan No" :value="field.shareNo != null ? String(field.shareNo) : '—'" :icon="Users" />
                    <StatCard label="Kayıt Tarihi" :value="formatDate(field.createdAt)" :icon="Calendar" class="[&_p:first-of-type]:text-lg" />
                </div>

                <!-- Detail cards -->
                <div class="grid gap-4 md:grid-cols-2">
                    <!-- Location -->
                    <Card>
                        <CardHeader>
                            <CardTitle class="flex items-center gap-2">
                                <MapPin class="size-4 text-muted-foreground" aria-hidden="true" />
                                Konum Bilgileri
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <dl class="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                                <div>
                                    <dt class="text-muted-foreground">İl</dt>
                                    <dd class="font-medium text-foreground">{{ field.province }}</dd>
                                </div>
                                <div>
                                    <dt class="text-muted-foreground">İlçe</dt>
                                    <dd class="font-medium text-foreground">{{ field.district }}</dd>
                                </div>
                                <div>
                                    <dt class="text-muted-foreground">Mahalle</dt>
                                    <dd class="font-medium text-foreground">{{ field.neighborhood || '—' }}</dd>
                                </div>
                                <div v-if="field.road">
                                    <dt class="text-muted-foreground">Yol</dt>
                                    <dd class="font-medium text-foreground">{{ field.road }}</dd>
                                </div>
                                <div v-if="field.adaNo">
                                    <dt class="text-muted-foreground">Ada No</dt>
                                    <dd class="font-semibold text-foreground tabular-nums">{{ field.adaNo }}</dd>
                                </div>
                                <div v-if="field.parcelNo">
                                    <dt class="text-muted-foreground">Parsel No</dt>
                                    <dd class="font-semibold text-foreground tabular-nums">{{ field.parcelNo }}</dd>
                                </div>
                                <div v-if="field.shareNo != null">
                                    <dt class="text-muted-foreground">Alan No</dt>
                                    <dd class="font-semibold text-foreground tabular-nums">{{ field.shareNo }}</dd>
                                </div>
                            </dl>
                        </CardContent>
                    </Card>

                    <!-- Record metadata -->
                    <Card>
                        <CardHeader>
                            <CardTitle class="flex items-center gap-2">
                                <Calendar class="size-4 text-muted-foreground" aria-hidden="true" />
                                Kayıt Bilgileri
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <dl class="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                                <div>
                                    <dt class="text-muted-foreground">Oluşturulma</dt>
                                    <dd class="font-medium text-foreground">{{ formatDate(field.createdAt) }}</dd>
                                </div>
                                <div>
                                    <dt class="text-muted-foreground">Son Güncelleme</dt>
                                    <dd class="font-medium text-foreground">{{ formatDate(field.updatedAt) }}</dd>
                                </div>
                                <div v-if="field.boundaryDeterminedAt">
                                    <dt class="text-muted-foreground">Sınır Belirleme</dt>
                                    <dd class="font-medium text-foreground">{{ formatDate(field.boundaryDeterminedAt) }}</dd>
                                </div>
                            </dl>
                        </CardContent>
                    </Card>

                    <!-- Notes -->
                    <Card v-if="field.notes">
                        <CardHeader>
                            <CardTitle class="flex items-center gap-2">
                                <FileText class="size-4 text-muted-foreground" aria-hidden="true" />
                                Notlar
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p class="text-sm leading-relaxed whitespace-pre-line text-foreground">{{ field.notes }}</p>
                        </CardContent>
                    </Card>

                    <!-- Registrants on the same parcel (hisseli) -->
                    <Card v-if="field.isShared" class="gap-4 md:col-span-2">
                        <CardHeader>
                            <CardTitle class="flex items-center gap-2">
                                <Users class="size-4 text-muted-foreground" aria-hidden="true" />
                                Bu parselde kayıtlı üreticiler
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul class="divide-y rounded-lg border">
                                <li class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                                    <div class="min-w-0">
                                        <span class="block font-medium text-foreground">Siz</span>
                                        <span class="block text-xs text-muted-foreground">{{ fieldDisplayName }}</span>
                                    </div>
                                    <Badge v-if="boundaryMeta" :variant="boundaryMeta.tone">{{ boundaryMeta.label }}</Badge>
                                </li>
                                <li v-for="o in field.coOwners" :key="o.userId" class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                                    <div class="min-w-0">
                                        <span class="block font-medium text-foreground">{{ o.fullName }}</span>
                                        <span v-if="o.cuzdanNo" class="block text-xs text-muted-foreground">Cüzdan {{ o.cuzdanNo }}</span>
                                    </div>
                                    <Badge v-if="o.boundaryDetermined" variant="success">Sınır belirlendi<template v-if="o.shareNo != null"> · Alan {{ o.shareNo }}</template></Badge>
                                    <Badge v-else variant="muted">Sınır belirlenmedi</Badge>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </template>
            <EmptyState v-else :icon="MapPin" title="Arazi bulunamadı" description="Bu arazi silinmiş veya size ait olmayabilir.">
                <Button variant="outline" class="h-11 md:h-9" @click="goBack">Arazilerime dön</Button>
            </EmptyState>
        </PageContainer>

        <!-- On-site measurement request -->
        <Dialog v-model:open="showRequestDialog">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Arazide ölçüm talebi</DialogTitle>
                    <DialogDescription>
                        Çaykur yetkili personeli size randevu verip sınırınızı sahada ölçer. Ölçüm diğer kayıtlı üreticilerin onayına sunulur.
                    </DialogDescription>
                </DialogHeader>
                <div class="space-y-2">
                    <Label for="request-note">Not (isteğe bağlı)</Label>
                    <Textarea id="request-note" v-model="requestNote" rows="3" maxlength="1000" placeholder="Örn. uydu görüntüsünde ağaçlar sınırı kapatıyor" />
                </div>
                <DialogFooter>
                    <Button variant="outline" class="h-11 md:h-9" :disabled="busy" @click="showRequestDialog = false">Vazgeç</Button>
                    <Button class="h-11 md:h-9" :disabled="busy" @click="submitRequest">
                        <Spinner v-if="busy" />
                        {{ busy ? 'Gönderiliyor...' : 'Talep oluştur' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <ConfirmDialog
            v-model:open="showCancelDialog"
            title="Ölçüm talebini iptal et"
            description="Talebiniz kapatılır; dilerseniz daha sonra yeniden talep oluşturabilirsiniz."
            confirm-text="Evet, iptal et"
            :loading="busy"
            @confirm="confirmCancelRequest"
        />
    </TeaBusinessLayout>
</template>
