<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { AlertTriangle, SearchX } from '@lucide/vue';
import CaykurLayout from '@/layouts/CaykurLayout.vue';
import { EmptyState, LoadingState, PageContainer, PageHeader, Spinner } from '@/components/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toneVariant, type Tone } from '@/components/caykur/tone';
import { api, type PruningMeasurement, type PruningStatus, type PruningMethod } from '@/services/api';
import {
    BUDAMA_TARGET_PCT,
    formatNumber,
    formatPct,
    formatDateTime,
} from '@/services/caykur';

const route = useRoute();
const router = useRouter();

const STATUS_META: Record<PruningStatus, { label: string; tone: Tone }> = {
    measured: { label: 'Ölçüldü · onay bekliyor', tone: 'info' },
    producer_approved: { label: 'Müstahsil onayladı', tone: 'info' },
    staff_approved: { label: 'Personel onayladı', tone: 'success' },
    completed: { label: 'Tamamlandı', tone: 'success' },
    rejected: { label: 'Reddedildi', tone: 'danger' },
};

const METHOD_LABEL: Record<PruningMethod, string> = {
    map: 'Harita çizimi',
    gps: 'GPS',
    assisted: 'Asistan ölçüm',
    imu: 'Lazer + IMU',
};

const ACCURACY_LABEL: Record<NonNullable<PruningMeasurement['accuracyLevel']>, string> = {
    high: 'Yüksek',
    medium: 'Orta',
    low: 'Düşük',
};

const loading = ref(true);
const error = ref<string | null>(null);
const saving = ref(false);
const m = ref<PruningMeasurement | null>(null);

async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
        const res = await api.getPruningMeasurement(String(route.params.id));
        if (res.data) m.value = res.data;
        else {
            error.value = res.error?.message ?? 'Ölçüm bulunamadı';
            m.value = null;
        }
    } catch (err) {
        error.value = err instanceof Error ? err.message : 'Ölçüm bulunamadı';
        m.value = null;
    } finally {
        loading.value = false;
    }
}

onMounted(load);

const ratioHeight = computed(() => Math.min(100, (m.value?.ratioPercent ?? 0) * 4)); // visual scale ×4
const targetHeight = computed(() => Math.min(100, BUDAMA_TARGET_PCT * 4));

const infoRows = computed<Array<{ term: string; value: string }>>(() => {
    const cur = m.value;
    if (!cur) return [];
    const accuracy = cur.accuracyLevel ? ACCURACY_LABEL[cur.accuracyLevel] : '—';
    return [
        { term: 'Yöntem', value: METHOD_LABEL[cur.method] },
        { term: 'Tarih', value: formatDateTime(cur.measuredAt) },
        { term: 'Parsel alanı', value: `${formatNumber(cur.fieldAreaM2)} m²` },
        { term: 'Budanan alan', value: `${formatNumber(cur.prunedAreaM2)} m²` },
        { term: 'Doğruluk', value: cur.gpsAccuracyMeters ? `${accuracy} · ±${cur.gpsAccuracyMeters}m` : accuracy },
        { term: 'Saha kontrolü', value: cur.fieldCheckDone ? 'Yapıldı' : 'Yapılmadı' },
        { term: '1/7 hedef', value: `%${formatNumber(BUDAMA_TARGET_PCT, 1)}` },
    ];
});

async function approve(): Promise<void> {
    if (!m.value || saving.value) return;
    saving.value = true;
    error.value = null;
    try {
        const res = await api.updatePruningApproval(m.value.id, { staffApproved: true });
        if (res.data) m.value = res.data;
        else error.value = res.error?.message ?? 'Onay kaydedilemedi';
    } catch (err) {
        error.value = err instanceof Error ? err.message : 'Onay kaydedilemedi';
    } finally {
        saving.value = false;
    }
}

async function reject(): Promise<void> {
    if (!m.value || saving.value) return;
    const reason = window.prompt('Reddetme nedeni:')?.trim();
    if (!reason) return;
    saving.value = true;
    error.value = null;
    try {
        const res = await api.updatePruningApproval(m.value.id, { rejectionReason: reason });
        if (res.data) m.value = res.data;
        else error.value = res.error?.message ?? 'İşlem kaydedilemedi';
    } catch (err) {
        error.value = err instanceof Error ? err.message : 'İşlem kaydedilemedi';
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <CaykurLayout>
        <PageContainer>
            <LoadingState v-if="loading" text="Ölçüm yükleniyor…" />

            <template v-else-if="m">
                <PageHeader
                    :title="m.producerName ?? 'Müstahsil'"
                    :description="m.parcelNo ? `Budama ölçümü · ${m.parcelNo}` : 'Budama ölçümü'"
                    back-to="/caykur/pruning"
                    back-label="Budama Denetimi"
                >
                    <template #badge>
                        <Badge :variant="toneVariant(STATUS_META[m.status].tone)">{{ STATUS_META[m.status].label }}</Badge>
                    </template>
                </PageHeader>

                <Alert v-if="m.rejectionReason" variant="warning">
                    <AlertTriangle aria-hidden="true" />
                    <AlertDescription>{{ m.rejectionReason }}</AlertDescription>
                </Alert>
                <Alert v-if="error" variant="destructive">
                    <AlertDescription>{{ error }}</AlertDescription>
                </Alert>

                <div class="grid gap-6 lg:grid-cols-2">
                    <div class="flex flex-col gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Ölçüm bilgileri</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                    <div v-for="row in infoRows" :key="row.term">
                                        <dt class="text-muted-foreground">{{ row.term }}</dt>
                                        <dd class="font-medium text-foreground tabular-nums">{{ row.value }}</dd>
                                    </div>
                                </dl>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Onay durumu</CardTitle>
                            </CardHeader>
                            <CardContent class="flex flex-col gap-3">
                                <div class="flex items-center justify-between gap-3">
                                    <span class="text-sm font-medium text-muted-foreground">Üretici onayı</span>
                                    <Badge :variant="m.producerApproved ? 'success' : 'warning'">{{ m.producerApproved ? 'Onaylandı' : 'Bekliyor' }}</Badge>
                                </div>
                                <div class="flex items-center justify-between gap-3">
                                    <span class="text-sm font-medium text-muted-foreground">Personel onayı</span>
                                    <Badge :variant="m.staffApproved ? 'success' : 'warning'">{{ m.staffApproved ? 'Onaylandı' : 'Bekliyor' }}</Badge>
                                </div>
                            </CardContent>
                            <CardFooter v-if="m.status !== 'rejected' && !m.staffApproved" class="gap-2">
                                <Button variant="outline" class="h-11 flex-1 md:h-9" :disabled="saving" @click="reject">Reddet</Button>
                                <Button class="h-11 flex-1 md:h-9" :disabled="saving" @click="approve">
                                    <Spinner v-if="saving" />
                                    Denetimi onayla
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Budama oranı (1/7 kuralı)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div class="flex items-stretch gap-6">
                                <div
                                    class="relative h-56 w-32 shrink-0 overflow-hidden rounded-md border bg-muted/40"
                                    role="img"
                                    :aria-label="`Parselin ${formatPct(m.ratioPercent, 1)} kadarı budanmış; hedef %${formatNumber(BUDAMA_TARGET_PCT, 1)}`"
                                >
                                    <div
                                        class="absolute inset-x-0 bottom-0 flex items-start justify-center border-t-2 border-primary bg-primary/25 pt-1"
                                        :style="{ height: `${ratioHeight}%` }"
                                    >
                                        <span class="text-xs font-semibold text-primary">budanan</span>
                                    </div>
                                    <div class="absolute inset-x-0 h-0 border-t-2 border-dashed border-muted-foreground" :style="{ bottom: `${targetHeight}%` }">
                                        <span class="absolute -top-4 right-1 bg-card px-0.5 text-[10px] text-muted-foreground">hedef %{{ formatNumber(BUDAMA_TARGET_PCT, 1) }}</span>
                                    </div>
                                </div>
                                <div class="flex flex-col justify-center gap-1.5">
                                    <span class="text-4xl leading-none font-bold text-foreground tabular-nums">{{ formatPct(m.ratioPercent, 1) }}</span>
                                    <span class="text-sm text-muted-foreground">parselin budanan oranı</span>
                                </div>
                            </div>
                            <p class="mt-4 text-xs leading-relaxed text-muted-foreground">
                                1/7 rotasyon kuralı her yıl bahçenin yaklaşık %{{ formatNumber(BUDAMA_TARGET_PCT, 1) }}'ünün budanmasını öngörür. %11–20 bandı uyumlu sayılır.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </template>

            <EmptyState v-else :icon="SearchX" :title="error ?? 'Ölçüm bulunamadı'">
                <Button variant="outline" class="h-11 md:h-9" @click="router.push('/caykur/pruning')">Listeye dön</Button>
            </EmptyState>
        </PageContainer>
    </CaykurLayout>
</template>
