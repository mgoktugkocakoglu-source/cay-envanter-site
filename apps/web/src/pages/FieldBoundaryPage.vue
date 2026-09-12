<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CircleAlert, Ruler, Users } from '@lucide/vue';
import { useFieldsStore } from '@/stores/fieldsStore';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/composables/useToast';
import { api, type MeasurementPoint } from '@/services/api';
import { parcelLabel } from '@/services/fieldBoundary';
import { hasGoogleMapsKey } from '@/services/googleMaps';
import type { AccuracyLevel, MeasurementMethod } from '@/services/caykur/pruning';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import CaykurPruningMeasure from '@/components/caykur/CaykurPruningMeasure.vue';
import { ConfirmDialog, EmptyState, LoadingState, PageContainer, PageHeader } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * "Arazini Belirle": the owner of a field on a hisseli parcel outlines their
 * own slice on the current satellite imagery. The drawing is sent to the
 * other registrants for approval; the field is updated only once all approve.
 */
const route = useRoute();
const router = useRouter();
const fieldsStore = useFieldsStore();
const authStore = useAuthStore();
const toast = useToast();

// `query.id` lets the DEV preview route render a mocked field.
const fieldId = computed(() => String(route.params.id ?? route.query.id ?? ''));
const field = computed(() => fieldsStore.currentField);
const detailPath = computed(() => `/tea/fields/${fieldId.value}`);

const isOwner = computed(() => !!field.value && field.value.userId === authStore.user?.id);
const canDraw = computed(() => !!field.value && isOwner.value && field.value.isShared && !!field.value.adaNo && !!field.value.parcelNo);
const keyMissing = !hasGoogleMapsKey();

const registeredAreaM2 = computed(() => {
    const f = field.value;
    if (!f) return 0;
    return f.areaUnit === 'm2' ? Number(f.area) : Number(f.area) * 1000;
});

interface DrawResult {
    measuredAreaM2: number;
    points: MeasurementPoint[];
    accuracyLevel: AccuracyLevel | null;
    method: MeasurementMethod;
}

const busy = ref(false);
const pendingResult = ref<DrawResult | null>(null);
const showAreaWarning = computed({
    get: () => pendingResult.value !== null,
    set: (v: boolean) => { if (!v) pendingResult.value = null; },
});

function formatNumber(n: number): string {
    return Math.round(n).toLocaleString('tr-TR');
}

function onDrawn(result: DrawResult): void {
    // Drawing noticeably more than the registered area is usually a slip; ask first.
    if (registeredAreaM2.value > 0 && result.measuredAreaM2 > registeredAreaM2.value * 1.05) {
        pendingResult.value = result;
        return;
    }
    void submit(result);
}

async function confirmOversize(): Promise<void> {
    const result = pendingResult.value;
    pendingResult.value = null;
    if (result) await submit(result);
}

async function submit(result: DrawResult): Promise<void> {
    if (!field.value) return;
    busy.value = true;
    const res = await api.createProducerBoundary({
        fieldId: field.value.id,
        measuredAreaM2: result.measuredAreaM2,
        points: result.points,
    });
    busy.value = false;
    if (res.data) {
        const askCount = res.data.approvals?.length ?? 0;
        toast.success(
            askCount > 0
                ? `Sınırınız onaya gönderildi; ${askCount} ortak sahibe bildirim yollandı.`
                : 'Sınırınız kaydedildi.',
        );
        router.push(detailPath.value);
    } else {
        toast.error(res.error?.message ?? 'Sınır kaydedilemedi.');
    }
}

function goBack(): void {
    router.push(detailPath.value);
}

onMounted(() => {
    if (!field.value || field.value.id !== fieldId.value) void fieldsStore.fetchField(fieldId.value);
});
</script>

<template>
    <TeaBusinessLayout>
        <PageContainer size="wide">
            <LoadingState v-if="fieldsStore.isLoading && !field" text="Arazi bilgileri yükleniyor..." />

            <EmptyState v-else-if="!field" :icon="CircleAlert" title="Arazi bulunamadı" description="Bu arazi silinmiş veya size ait olmayabilir.">
                <Button variant="outline" class="h-11 md:h-9" @click="router.push('/tea/fields')">Arazilerime dön</Button>
            </EmptyState>

            <template v-else>
                <PageHeader
                    title="Arazini Belirle"
                    :description="`${field.name?.trim() || 'İsimsiz Arazi'} · ${parcelLabel(field) || field.district} · uydu görüntüsünde size ait sınırı çizin`"
                    :back-to="detailPath"
                    back-label="Arazi"
                >
                    <template #meta>
                        <Badge variant="secondary" class="tabular-nums">{{ formatNumber(registeredAreaM2) }} m² kayıtlı</Badge>
                        <Badge v-if="field.isShared" variant="outline">
                            <Users aria-hidden="true" />
                            {{ field.coOwnerCount }} kayıtlı üretici
                        </Badge>
                    </template>
                </PageHeader>

                <Alert v-if="!canDraw" variant="warning">
                    <CircleAlert aria-hidden="true" />
                    <AlertTitle>Bu arazi için sınır çizilemez</AlertTitle>
                    <AlertDescription>
                        <p v-if="!isOwner">Yalnızca arazinin kayıtlı sahibi sınır belirleyebilir.</p>
                        <p v-else-if="!field.adaNo || !field.parcelNo">Arazinin ada/parsel bilgisi eksik.</p>
                        <p v-else>Bu ada/parselde başka kayıtlı üretici yok; sınır belirlemeye gerek yok.</p>
                        <div class="mt-3">
                            <Button variant="outline" class="h-11 md:h-9" @click="goBack">Araziye dön</Button>
                        </div>
                    </AlertDescription>
                </Alert>

                <template v-else>
                    <Alert variant="info">
                        <Users aria-hidden="true" />
                        <AlertTitle>Çizim, diğer kayıtlı üreticilerin onayına gönderilir</AlertTitle>
                        <AlertDescription>
                            Sarı çizgi tapu parselinin sınırıdır. Parsel içinde yalnızca size ait bölümü işaretleyin; hepsi onayladığında
                            arazi bilgileriniz (alan ve Alan no) güncellenir.
                        </AlertDescription>
                    </Alert>

                    <Alert v-if="keyMissing" variant="warning">
                        <Ruler aria-hidden="true" />
                        <AlertTitle>Uydu haritası bu ortamda kullanılamıyor</AlertTitle>
                        <AlertDescription>
                            <p>Çizim yerine Çaykur personelinin sahada ölçmesini isteyebilirsiniz.</p>
                            <div class="mt-3">
                                <Button variant="outline" class="h-11 md:h-9" @click="goBack">Arazide ölçüm talebi oluştur</Button>
                            </div>
                        </AlertDescription>
                    </Alert>

                    <Card>
                        <CardContent>
                            <CaykurPruningMeasure
                                map-only
                                :parcel-polygon="field.coordinates?.[0]"
                                save-label="Onaya gönder"
                                subject="Size ait bölümün"
                                @complete="onDrawn"
                                @cancel="goBack"
                            />
                        </CardContent>
                    </Card>
                </template>
            </template>
        </PageContainer>

        <ConfirmDialog
            v-model:open="showAreaWarning"
            variant="primary"
            title="Çizilen alan kayıtlı alandan büyük"
            :description="pendingResult ? `Çizdiğiniz alan ${formatNumber(pendingResult.measuredAreaM2)} m², kayıtlı alanınız ${formatNumber(registeredAreaM2)} m². Yine de onaya göndermek istiyor musunuz?` : ''"
            confirm-text="Onaya gönder"
            :loading="busy"
            @confirm="confirmOversize"
        />
    </TeaBusinessLayout>
</template>
