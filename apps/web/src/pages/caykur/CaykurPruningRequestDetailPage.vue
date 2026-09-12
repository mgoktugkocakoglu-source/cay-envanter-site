<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CalendarDays, Check, ClipboardList, Ruler, Users, X } from '@lucide/vue';
import CaykurLayout from '@/layouts/CaykurLayout.vue';
import CaykurPruningMeasure from '@/components/caykur/CaykurPruningMeasure.vue';
import CaykurLicensingMeasure from '@/components/caykur/CaykurLicensingMeasure.vue';
import { EmptyState, PageContainer, PageHeader } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePruningRequestsStore } from '@/stores/pruningRequestsStore';
import { useToast } from '@/composables/useToast';
import { PRUNING_REQUEST_STATUS_META, formatNumber, formatDate, formatDateTime } from '@/services/caykur';
import {
    api,
    type LicensingApprovalStatus,
    type LicensingMeasurement,
    type LicensingMeasurementStatus,
    type MeasurementPoint,
} from '@/services/api';
import type { AccuracyLevel, MeasurementMethod } from '@/services/caykur/pruning';

/**
 * Budama talebi detail: appointment → on-site measurement → decision. When the
 * parcel is hisseli (registered by more than one producer) the page warns and
 * offers the ruhsatlandırma flow: measure one owner's slice, then the other
 * owners confirm it from their Bildirimler page.
 */
const route = useRoute();
const router = useRouter();
const store = usePruningRequestsStore();
const toast = useToast();

// `query.id` lets the DEV preview route render a mocked request.
const id = computed(() => String(route.params.id ?? route.query.id ?? ''));
const req = computed(() => store.byId(id.value));
const busy = ref(false);

type Panel = 'none' | 'measure' | 'licensing';
const panel = ref<Panel>('none');

// ── Hisseli (shared-title) parcel ──
const coOwners = computed(() => req.value?.coOwners ?? []);
const isShared = computed(() => coOwners.value.length > 1);

// ── Licensing measurements on this request ──
const licensing = ref<LicensingMeasurement[]>([]);
const licensingLoading = ref(false);
const measuredOwnerIds = computed(() => licensing.value.map((m) => m.ownerId));

async function loadLicensing(): Promise<void> {
    if (!req.value) return;
    licensingLoading.value = true;
    const res = await api.getLicensingMeasurements({ pruningRequestId: req.value.id, limit: 100 });
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
        pruningRequestId: req.value.id,
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
        licensing.value = [res.data, ...licensing.value];
        const askCount = res.data.approvals?.length ?? 0;
        toast.success(
            askCount > 0
                ? `Ruhsatlandırma ölçümü kaydedildi; ${askCount} ortak sahibe onay talebi gönderildi.`
                : 'Ruhsatlandırma ölçümü kaydedildi.',
        );
    } else {
        toast.error(res.error?.message ?? 'Ruhsatlandırma ölçümü kaydedilemedi.');
    }
}

// ── Appointment ──
const appointmentInput = ref('');
async function submitAppointment(): Promise<void> {
    if (!req.value || !appointmentInput.value) return;
    busy.value = true;
    await store.setAppointment(req.value.id, appointmentInput.value);
    busy.value = false;
}

// ── Pruning measurement ──
async function onMeasured(result: {
    measuredAreaM2: number;
    points: MeasurementPoint[];
    accuracyLevel: AccuracyLevel | null;
    method: MeasurementMethod;
}): Promise<void> {
    if (!req.value) return;
    busy.value = true;
    await store.saveMeasurement(req.value.id, {
        measuredAreaM2: result.measuredAreaM2,
        points: result.points,
        method: result.method,
        accuracyLevel: result.accuracyLevel ?? undefined,
    });
    busy.value = false;
    panel.value = 'none';
}

// ── Decision ──
async function approve(): Promise<void> {
    if (!req.value) return;
    busy.value = true;
    await store.approve(req.value.id);
    busy.value = false;
}
async function reject(): Promise<void> {
    if (!req.value) return;
    busy.value = true;
    await store.reject(req.value.id, 'Ölçüm uygun bulunmadı; yeniden randevu gerekli.');
    busy.value = false;
}

// ── Labels ──
function methodLabel(method: string | null): string {
    if (method === 'gps') return 'GPS';
    if (method === 'map') return 'Harita';
    if (method === 'imu') return 'Lazer + IMU';
    if (method === 'assisted') return 'Destekli';
    return '—';
}
function accuracyLabel(level: string | null): string {
    if (level === 'high') return 'Yüksek';
    if (level === 'medium') return 'Orta';
    if (level === 'low') return 'Düşük';
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
                    :description="`Budama talebi · Ada ${req.ada} / Parsel ${req.parsel} · ${req.il} / ${req.ilce}`"
                    back-to="/caykur/pruning-requests"
                    back-label="Budama Talepleri"
                >
                    <template #meta>
                        <Badge :variant="PRUNING_REQUEST_STATUS_META[req.status].tone">
                            {{ PRUNING_REQUEST_STATUS_META[req.status].label }}
                        </Badge>
                        <Badge v-if="isShared" variant="warning">
                            <Users aria-hidden="true" />
                            Hisseli · {{ coOwners.length }} sahip
                        </Badge>
                    </template>
                </PageHeader>

                <!-- Hisseli parcel warning + ruhsatlandırma entry point -->
                <Alert v-if="isShared && panel !== 'licensing'" variant="warning">
                    <Users aria-hidden="true" />
                    <AlertTitle>Bu ada/parselde birden fazla kayıtlı cüzdan var</AlertTitle>
                    <AlertDescription>
                        <p>
                            Aynı arazi {{ coOwners.length }} farklı üretici tarafından kaydedilmiş. Sahada, ölçümü yapılan cüzdan
                            sahibinin payını ayrıca ölçüp kaydedin; kayıt diğer sahiplerin onayına sunulur.
                        </p>
                        <ul class="mt-2 flex flex-wrap gap-2">
                            <li v-for="o in coOwners" :key="o.userId">
                                <Badge variant="outline" class="gap-1.5">
                                    <span class="font-medium">{{ o.fullName }}</span>
                                    <span v-if="o.cuzdanNo" class="text-muted-foreground">· Cüzdan {{ o.cuzdanNo }}</span>
                                    <Check v-if="measuredOwnerIds.includes(o.userId)" class="text-success" aria-label="ölçüldü" />
                                </Badge>
                            </li>
                        </ul>
                        <div class="mt-3">
                            <Button class="h-11 md:h-9" :disabled="busy" @click="panel = 'licensing'">
                                <Ruler aria-hidden="true" />
                                Ruhsatlandırma ölçümü yap
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>

                <!-- Ruhsatlandırma capture -->
                <Card v-if="panel === 'licensing'">
                    <CardHeader>
                        <CardTitle>Ruhsatlandırma ölçümü</CardTitle>
                        <CardDescription>
                            Ölçülen cüzdan sahibini seçin, payını haritada ya da lazer + IMU ile ölçün. Kayıt, arazideki diğer
                            sahiplerin onayına gönderilir; onay gelene kadar kesinleşmez.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <CaykurLicensingMeasure
                            :owners="coOwners"
                            :parcel-polygon="req.parcelGeometry ?? undefined"
                            :measured-owner-ids="measuredOwnerIds"
                            :busy="busy"
                            @complete="onLicensingMeasured"
                            @cancel="panel = 'none'"
                        />
                    </CardContent>
                </Card>

                <!-- Pruning measurement capture -->
                <Card v-else-if="panel === 'measure'">
                    <CardHeader>
                        <CardTitle>Hassas ölçüm (3B)</CardTitle>
                        <CardDescription>Budanan alanı haritada işaretleyin ya da lazer + IMU ile ölçün.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <CaykurPruningMeasure :parcel-polygon="req.parcelGeometry ?? undefined" @complete="onMeasured" @cancel="panel = 'none'" />
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
                                </dl>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>İşlem</CardTitle>
                            </CardHeader>
                            <CardContent class="flex flex-col gap-3">
                                <template v-if="req.status === 'pending'">
                                    <p class="text-sm text-muted-foreground">Talebi değerlendirin ve ölçüm için bir randevu tarihi belirleyin.</p>
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
                                        Sahada hassas sensörlerle ölçümü yapın.
                                    </p>
                                    <Button class="h-11 self-start md:h-9" :disabled="busy" @click="panel = 'measure'">
                                        <Ruler aria-hidden="true" />
                                        Ölçümü başlat
                                    </Button>
                                </template>

                                <template v-else-if="req.status === 'measured'">
                                    <p class="text-sm text-muted-foreground">Ölçüm tamamlandı. Kayıt için onaylayın ya da reddedin.</p>
                                    <div class="flex gap-2">
                                        <Button variant="outline" class="h-11 flex-1 md:h-9" :disabled="busy" @click="reject">
                                            <X aria-hidden="true" />
                                            Reddet
                                        </Button>
                                        <Button class="h-11 flex-1 md:h-9" :disabled="busy" @click="approve">
                                            <Check aria-hidden="true" />
                                            Onayla
                                        </Button>
                                    </div>
                                    <Button variant="ghost" size="sm" class="h-11 self-start md:h-9" :disabled="busy" @click="panel = 'measure'">Yeniden ölç</Button>
                                </template>

                                <template v-else-if="req.status === 'approved'">
                                    <p class="text-sm font-semibold text-success">
                                        ✓ Talep onaylandı ve kayıt tamamlandı.<template v-if="req.approvedByName"> ({{ req.approvedByName }})</template>
                                    </p>
                                </template>

                                <template v-else>
                                    <p class="text-sm font-semibold text-destructive">Talep reddedildi.</p>
                                    <p v-if="req.notes" class="text-sm text-muted-foreground">{{ req.notes }}</p>
                                    <Button variant="outline" size="sm" class="h-11 self-start md:h-9" :disabled="busy" @click="panel = 'measure'">Yeniden ölç</Button>
                                </template>
                            </CardContent>
                        </Card>
                    </div>

                    <div class="flex flex-col gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Ölçüm sonucu (3B)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <template v-if="req.measuredAreaM2 !== null">
                                    <div class="mb-3 flex flex-col">
                                        <span class="text-3xl font-bold leading-none text-foreground tabular-nums">{{ formatNumber(req.measuredAreaM2) }} m²</span>
                                        <span class="mt-1 text-sm text-muted-foreground">otomatik hesaplanan budama alanı</span>
                                    </div>
                                    <dl class="grid gap-3 text-sm sm:grid-cols-2">
                                        <div><dt class="text-xs text-muted-foreground">Yöntem</dt><dd class="text-foreground">{{ methodLabel(req.method) }}</dd></div>
                                        <div><dt class="text-xs text-muted-foreground">Doğruluk</dt><dd class="text-foreground">{{ accuracyLabel(req.accuracyLevel) }}</dd></div>
                                        <div><dt class="text-xs text-muted-foreground">Köşe sayısı</dt><dd class="text-foreground tabular-nums">{{ formatNumber(req.measurementPoints.length) }}</dd></div>
                                        <div><dt class="text-xs text-muted-foreground">Ölçen</dt><dd class="text-foreground">{{ req.measuredByName ?? '—' }}</dd></div>
                                        <div v-if="req.measuredAt"><dt class="text-xs text-muted-foreground">Ölçüm tarihi</dt><dd class="text-foreground">{{ formatDateTime(req.measuredAt) }}</dd></div>
                                    </dl>

                                    <div v-if="req.measurementPoints.length" class="mt-4">
                                        <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Enlem · Boylam · Yükseklik</p>
                                        <ol class="mt-2 flex flex-col gap-1 text-xs text-muted-foreground tabular-nums">
                                            <li v-for="(p, i) in req.measurementPoints" :key="i" class="flex items-center gap-2">
                                                <span class="flex size-5 shrink-0 items-center justify-center rounded-full border bg-muted text-[10px] font-semibold">{{ i + 1 }}</span>
                                                <span>{{ p.lat.toFixed(6) }}, {{ p.lng.toFixed(6) }}</span>
                                                <span class="ml-auto">{{ p.altitudeMeters.toFixed(1) }} m</span>
                                            </li>
                                        </ol>
                                    </div>
                                </template>
                                <EmptyState v-else :icon="Ruler" title="Henüz ölçüm yapılmadı" class="min-h-40" />
                            </CardContent>
                        </Card>

                        <!-- Ruhsatlandırma records (shared parcels only) -->
                        <Card v-if="isShared || licensing.length">
                            <CardHeader>
                                <CardTitle>Ruhsatlandırma ölçümleri</CardTitle>
                                <CardDescription>Her cüzdan sahibi için ölçülen pay ve diğer sahiplerin onay durumu.</CardDescription>
                                <CardAction>
                                    <Badge variant="secondary" class="tabular-nums">{{ licensing.length }} kayıt</Badge>
                                </CardAction>
                            </CardHeader>
                            <CardContent class="flex flex-col gap-3">
                                <p v-if="licensingLoading && !licensing.length" class="text-sm text-muted-foreground">Yükleniyor…</p>
                                <EmptyState
                                    v-else-if="!licensing.length"
                                    :icon="ClipboardList"
                                    title="Henüz ruhsatlandırma ölçümü yok"
                                    description="Sahada her cüzdan sahibinin payını ayrı ayrı ölçüp kaydedin."
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
                                    <ul v-if="m.approvals?.length" class="mt-2 flex flex-wrap gap-2">
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
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </template>

            <EmptyState v-else :icon="ClipboardList" title="Talep bulunamadı">
                <Button variant="outline" class="h-11 md:h-9" @click="router.push('/caykur/pruning-requests')">Listeye dön</Button>
            </EmptyState>
        </PageContainer>
    </CaykurLayout>
</template>
