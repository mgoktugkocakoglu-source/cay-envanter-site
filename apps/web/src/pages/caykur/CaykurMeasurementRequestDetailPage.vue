<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CalendarDays, Check, ClipboardList, Ruler, Users, X } from '@lucide/vue';
import CaykurLayout from '@/layouts/CaykurLayout.vue';
import CaykurLicensingMeasure from '@/components/caykur/CaykurLicensingMeasure.vue';
import BoundarySketch from '@/components/map/BoundarySketch.vue';
import { EmptyState, PageContainer, PageHeader } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMeasurementRequestsStore } from '@/stores/measurementRequestsStore';
import { useToast } from '@/composables/useToast';
import { MEASUREMENT_REQUEST_STATUS_META, formatNumber, formatDate, formatDateTime } from '@/services/caykur';
import {
    api,
    type LicensingApprovalStatus,
    type LicensingMeasurement,
    type LicensingMeasurementStatus,
    type MeasurementPoint,
} from '@/services/api';
import type { AccuracyLevel, MeasurementMethod } from '@/services/caykur/pruning';

/**
 * Ölçüm talebi detail: appointment → on-site boundary measurement (licensing
 * flow, requester preselected) → the co-owners confirm from Bildirimler. The
 * request closes by itself once the requester's slice is approved.
 */
const route = useRoute();
const router = useRouter();
const store = useMeasurementRequestsStore();
const toast = useToast();

// `query.id` lets the DEV preview route render a mocked request.
const id = computed(() => String(route.params.id ?? route.query.id ?? ''));
const req = computed(() => store.byId(id.value));
const busy = ref(false);

type Panel = 'none' | 'licensing';
const panel = ref<Panel>('none');

const coOwners = computed(() => req.value?.coOwners ?? []);
const isOpen = computed(() => !!req.value && ['pending', 'scheduled', 'measured'].includes(req.value.status));

// ── Licensing measurements on this request ──
const licensing = ref<LicensingMeasurement[]>([]);
const licensingLoading = ref(false);
const measuredOwnerIds = computed(() => licensing.value.map((m) => m.ownerId));

async function loadLicensing(): Promise<void> {
    if (!req.value) return;
    licensingLoading.value = true;
    const res = await api.getLicensingMeasurements({ measurementRequestId: req.value.id, limit: 100 });
    if (res.data) licensing.value = res.data.data;
    licensingLoading.value = false;
}

async function onLicensingMeasured(result: {
    ownerId: string;
    notes?: string;
    measuredAreaM2: number;
    points: MeasurementPoint[];
    accuracyLevel: AccuracyLevel | null;
    method: MeasurementMethod;
}): Promise<void> {
    if (!req.value) return;
    busy.value = true;
    const res = await api.createLicensingMeasurement({
        measurementRequestId: req.value.id,
        ownerId: result.ownerId,
        notes: result.notes,
        measuredAreaM2: result.measuredAreaM2,
        points: result.points,
        method: result.method,
        accuracyLevel: result.accuracyLevel ?? undefined,
    });
    busy.value = false;
    if (res.data) {
        panel.value = 'none';
        licensing.value = [res.data, ...licensing.value.filter((m) => m.id !== res.data?.id)];
        const askCount = res.data.approvals?.length ?? 0;
        toast.success(
            askCount > 0
                ? `Ölçüm kaydedildi; ${askCount} ortak sahibe onay talebi gönderildi.`
                : 'Ölçüm kaydedildi ve sınır belirlendi.',
        );
        await store.fetchOne(req.value.id);
    } else {
        toast.error(res.error?.message ?? 'Ölçüm kaydedilemedi.');
    }
}

// ── Appointment ──
const appointmentInput = ref('');
async function submitAppointment(): Promise<void> {
    if (!req.value || !appointmentInput.value) return;
    busy.value = true;
    const updated = await store.setAppointment(req.value.id, appointmentInput.value);
    busy.value = false;
    if (updated) toast.success('Randevu tarihi kaydedildi.');
    else toast.error(store.error ?? 'Randevu kaydedilemedi.');
}

// ── Reject ──
const rejectReason = ref('');
const showReject = ref(false);
async function submitReject(): Promise<void> {
    if (!req.value) return;
    busy.value = true;
    const updated = await store.reject(req.value.id, rejectReason.value.trim() || undefined);
    busy.value = false;
    showReject.value = false;
    if (updated) toast.info('Talep reddedildi.');
    else toast.error(store.error ?? 'Talep reddedilemedi.');
}

// ── Labels ──
function methodLabel(method: string | null): string {
    if (method === 'gps') return 'GPS';
    if (method === 'map') return 'Harita';
    if (method === 'imu') return 'Lazer + IMU';
    if (method === 'assisted') return 'Destekli';
    return '—';
}
const LICENSING_STATUS: Record<LicensingMeasurementStatus, { label: string; variant: 'warning' | 'success' | 'danger' | 'muted' }> = {
    pending_approval: { label: 'Ortak onayı bekliyor', variant: 'warning' },
    approved: { label: 'Ortaklar onayladı', variant: 'success' },
    rejected: { label: 'İtiraz edildi', variant: 'danger' },
    superseded: { label: 'Yenilendi', variant: 'muted' },
};
const APPROVAL_STATUS: Record<LicensingApprovalStatus, { label: string; variant: 'muted' | 'success' | 'danger' }> = {
    pending: { label: 'Bekliyor', variant: 'muted' },
    approved: { label: 'Onayladı', variant: 'success' },
    rejected: { label: 'İtiraz etti', variant: 'danger' },
};

onMounted(async () => {
    await store.fetchOne(id.value);
    await loadLicensing();
});
watch(id, async (next) => {
    panel.value = 'none';
    await store.fetchOne(next);
    await loadLicensing();
});
</script>

<template>
    <CaykurLayout>
        <PageContainer size="wide">
            <template v-if="req">
                <PageHeader
                    :title="req.producerName"
                    :description="`Ölçüm talebi · Ada ${req.ada} / Parsel ${req.parsel} · ${req.il} / ${req.ilce}`"
                    back-to="/caykur/measurement-requests"
                    back-label="Ölçüm Talepleri"
                >
                    <template #meta>
                        <Badge :variant="MEASUREMENT_REQUEST_STATUS_META[req.status].tone">
                            {{ MEASUREMENT_REQUEST_STATUS_META[req.status].label }}
                        </Badge>
                        <Badge variant="warning">
                            <Users aria-hidden="true" />
                            Hisseli · {{ coOwners.length }} sahip
                        </Badge>
                    </template>
                </PageHeader>

                <!-- Ruhsatlandırma capture -->
                <Card v-if="panel === 'licensing'">
                    <CardHeader>
                        <CardTitle>Arazide ölçüm</CardTitle>
                        <CardDescription>
                            Talebi açan üretici seçili gelir; payını haritada ya da lazer + IMU ile ölçün. Kayıt, arazideki diğer
                            sahiplerin onayına gönderilir; hepsi onaylayınca üreticinin arazisi güncellenir ve talep kapanır.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <CaykurLicensingMeasure
                            :owners="coOwners"
                            :default-owner-id="req.producerId"
                            :parcel-polygon="req.parcelGeometry ?? undefined"
                            :measured-owner-ids="measuredOwnerIds"
                            :busy="busy"
                            @complete="onLicensingMeasured"
                            @cancel="panel = 'none'"
                        />
                    </CardContent>
                </Card>

                <div v-else class="grid gap-4 lg:grid-cols-2">
                    <div class="flex flex-col gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Talep bilgileri</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <dl class="grid gap-3 text-sm sm:grid-cols-2">
                                    <div><dt class="text-xs text-muted-foreground">Müstahsil</dt><dd class="font-medium text-foreground">{{ req.producerName }}</dd></div>
                                    <div><dt class="text-xs text-muted-foreground">İl / İlçe</dt><dd class="text-foreground">{{ req.il }} / {{ req.ilce }}</dd></div>
                                    <div><dt class="text-xs text-muted-foreground">Ada / Parsel</dt><dd class="text-foreground">Ada {{ req.ada }} / Parsel {{ req.parsel }}</dd></div>
                                    <div><dt class="text-xs text-muted-foreground">Kayıtlı arazi</dt><dd class="font-semibold text-foreground tabular-nums">{{ formatNumber(req.registeredAreaM2) }} m²</dd></div>
                                    <div><dt class="text-xs text-muted-foreground">Talep tarihi</dt><dd class="text-foreground">{{ formatDateTime(req.createdAt) }}</dd></div>
                                    <div v-if="req.appointmentDate">
                                        <dt class="text-xs text-muted-foreground">Randevu tarihi</dt>
                                        <dd class="text-foreground">{{ formatDate(req.appointmentDate) }}<template v-if="req.appointedByName"> · {{ req.appointedByName }}</template></dd>
                                    </div>
                                    <div v-if="req.producerNote" class="sm:col-span-2">
                                        <dt class="text-xs text-muted-foreground">Üreticinin notu</dt>
                                        <dd class="text-foreground">{{ req.producerNote }}</dd>
                                    </div>
                                </dl>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle class="flex items-center gap-2">
                                    <Users class="size-4 text-muted-foreground" aria-hidden="true" />
                                    Parselde kayıtlı sahipler
                                </CardTitle>
                                <CardDescription>Ölçülen sahibin işareti yeşildir; diğerleri ölçümü Bildirimler'den onaylar.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ul class="flex flex-wrap gap-2">
                                    <li v-for="o in coOwners" :key="o.userId">
                                        <Badge variant="outline" class="gap-1.5">
                                            <span class="font-medium">{{ o.fullName }}</span>
                                            <span v-if="o.cuzdanNo" class="text-muted-foreground">· Cüzdan {{ o.cuzdanNo }}</span>
                                            <span v-if="o.userId === req.producerId" class="text-muted-foreground">· talep sahibi</span>
                                            <Check v-if="measuredOwnerIds.includes(o.userId)" class="text-success" aria-label="ölçüldü" />
                                        </Badge>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>İşlem</CardTitle>
                            </CardHeader>
                            <CardContent class="flex flex-col gap-3">
                                <template v-if="req.status === 'pending'">
                                    <p class="text-sm text-muted-foreground">Talebi değerlendirin ve saha ölçümü için bir randevu tarihi belirleyin.</p>
                                    <div class="flex flex-col gap-2 sm:flex-row">
                                        <div class="flex-1 space-y-2">
                                            <Label for="appointment-date" class="sr-only">Randevu tarihi</Label>
                                            <Input id="appointment-date" v-model="appointmentInput" type="date" class="h-11 md:h-9" />
                                        </div>
                                        <Button class="h-11 md:h-9" :disabled="!appointmentInput || busy" @click="submitAppointment">
                                            <CalendarDays aria-hidden="true" />
                                            Randevu ver
                                        </Button>
                                    </div>
                                </template>

                                <template v-else-if="req.status === 'scheduled'">
                                    <p class="text-sm text-muted-foreground">
                                        Randevu tarihi: <strong class="text-foreground">{{ req.appointmentDate ? formatDate(req.appointmentDate) : '—' }}</strong>.
                                        Sahada üreticinin payını ölçüp kaydedin.
                                    </p>
                                </template>

                                <template v-else-if="req.status === 'measured'">
                                    <p class="text-sm text-muted-foreground">Ölçüm kaydedildi; diğer sahiplerin onayı bekleniyor. Gerekirse yeniden ölçebilirsiniz.</p>
                                </template>

                                <template v-else-if="req.status === 'closed'">
                                    <p class="text-sm font-semibold text-success">✓ Sınır belirlendi; üreticinin arazisi güncellendi.</p>
                                </template>

                                <template v-else-if="req.status === 'rejected'">
                                    <p class="text-sm font-semibold text-destructive">Talep reddedildi.</p>
                                    <p v-if="req.notes" class="text-sm text-muted-foreground">{{ req.notes }}</p>
                                </template>

                                <template v-else>
                                    <p class="text-sm text-muted-foreground">Üretici talebi iptal etti.</p>
                                </template>

                                <div v-if="req.status === 'scheduled' || req.status === 'measured'" class="flex flex-col gap-2 sm:flex-row">
                                    <Button class="h-11 md:h-9" :disabled="busy" @click="panel = 'licensing'">
                                        <Ruler aria-hidden="true" />
                                        {{ req.status === 'measured' ? 'Yeniden ölç' : 'Ölçümü başlat' }}
                                    </Button>
                                </div>

                                <template v-if="isOpen">
                                    <Alert v-if="showReject" variant="warning">
                                        <AlertTitle>Talebi reddet</AlertTitle>
                                        <AlertDescription>
                                            <div class="mt-2 space-y-2">
                                                <Label for="reject-reason">Gerekçe</Label>
                                                <Textarea id="reject-reason" v-model="rejectReason" rows="3" placeholder="Örn. parsel kaydı Çaykur sisteminde bulunamadı" />
                                            </div>
                                            <div class="mt-3 flex gap-2">
                                                <Button variant="outline" class="h-11 flex-1 md:h-9" :disabled="busy" @click="showReject = false">Vazgeç</Button>
                                                <Button variant="destructive" class="h-11 flex-1 md:h-9" :disabled="busy" @click="submitReject">Reddet</Button>
                                            </div>
                                        </AlertDescription>
                                    </Alert>
                                    <Button v-else variant="ghost" size="sm" class="h-11 self-start text-muted-foreground hover:text-destructive md:h-9" :disabled="busy" @click="showReject = true">
                                        <X aria-hidden="true" />
                                        Talebi reddet
                                    </Button>
                                </template>
                            </CardContent>
                        </Card>
                    </div>

                    <div class="flex flex-col gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Ölçümler</CardTitle>
                                <CardDescription>Bu talep üzerinde kaydedilen ölçümler ve ortak onay durumu.</CardDescription>
                                <CardAction>
                                    <Badge variant="secondary" class="tabular-nums">{{ licensing.length }} kayıt</Badge>
                                </CardAction>
                            </CardHeader>
                            <CardContent class="flex flex-col gap-3">
                                <p v-if="licensingLoading && !licensing.length" class="text-sm text-muted-foreground">Yükleniyor…</p>
                                <EmptyState
                                    v-else-if="!licensing.length"
                                    :icon="ClipboardList"
                                    title="Henüz ölçüm yok"
                                    description="Randevu gününde üreticinin payını ölçüp kaydedin."
                                    class="min-h-40"
                                />
                                <div v-for="m in licensing" :key="m.id" class="rounded-lg border p-3">
                                    <div class="flex flex-wrap items-start justify-between gap-2">
                                        <div class="min-w-0">
                                            <p class="font-medium text-foreground">
                                                {{ m.ownerName }}
                                                <span v-if="m.ownerCuzdanNo" class="text-xs font-normal text-muted-foreground">· Cüzdan {{ m.ownerCuzdanNo }}</span>
                                            </p>
                                            <p class="text-xs text-muted-foreground">
                                                {{ methodLabel(m.method) }} · {{ formatDateTime(m.measuredAt) }} · {{ m.measuredByName }}
                                            </p>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <span class="font-semibold text-foreground tabular-nums">{{ formatNumber(m.measuredAreaM2) }} m²</span>
                                            <Badge :variant="LICENSING_STATUS[m.status].variant">{{ LICENSING_STATUS[m.status].label }}</Badge>
                                        </div>
                                    </div>
                                    <div class="mt-3 grid gap-3 sm:grid-cols-[140px_1fr]">
                                        <BoundarySketch v-if="m.measurementPoints.length >= 3" :points="m.measurementPoints" class="max-w-35" />
                                        <div>
                                            <ul v-if="m.approvals?.length" class="flex flex-wrap gap-2">
                                                <li v-for="a in m.approvals" :key="a.id">
                                                    <Badge :variant="APPROVAL_STATUS[a.status].variant" class="gap-1">
                                                        {{ a.approverName }} · {{ APPROVAL_STATUS[a.status].label }}
                                                    </Badge>
                                                </li>
                                            </ul>
                                            <p v-for="a in (m.approvals ?? []).filter((x) => x.reason)" :key="`${a.id}-reason`" class="mt-1 text-xs text-muted-foreground">
                                                {{ a.approverName }}: {{ a.reason }}
                                            </p>
                                            <p v-if="m.notes" class="mt-1 text-xs text-muted-foreground">Not: {{ m.notes }}</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </template>

            <EmptyState v-else :icon="ClipboardList" title="Talep bulunamadı">
                <Button variant="outline" class="h-11 md:h-9" @click="router.push('/caykur/measurement-requests')">Listeye dön</Button>
            </EmptyState>
        </PageContainer>
    </CaykurLayout>
</template>
