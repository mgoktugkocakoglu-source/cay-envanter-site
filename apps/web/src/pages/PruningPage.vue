<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { ClipboardList, Ruler, Scissors } from '@lucide/vue';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import { useAuthStore } from '@/stores/authStore';
import { useFieldsStore } from '@/stores/fieldsStore';
import { usePruningRequestsStore } from '@/stores/pruningRequestsStore';
import { PRUNING_REQUEST_STATUS_META } from '@/services/caykur';
import type { Field, PruningRequest } from '@/services/api';
import { toneVariant } from '@/components/caykur/tone';
import { LoadingState, PageContainer, PageHeader, Spinner, StatCard } from '@/components/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const auth = useAuthStore();
const fieldsStore = useFieldsStore();
const store = usePruningRequestsStore();

type Tab = 'request' | 'record';
const tab = ref<Tab>('request');

const user = computed(() => auth.user);

const headerDescription = computed(() => {
    if (!user.value) return '';
    const location = user.value.district ? ` · ${user.value.district} / ${user.value.province}` : '';
    return `${user.value.fullName}${location}`;
});

// ── Producer context (real data) ──
function fieldToM2(f: Field): number {
    const a = Number(f.area) || 0;
    return f.areaUnit === 'm2' ? a : a * 1000;
}
const registeredAreaM2 = computed(() =>
    Math.round(fieldsStore.fields.reduce((s, f) => s + fieldToM2(f), 0)),
);
// 1/7 rotation rule.
const pruneTargetM2 = computed(() => Math.round(registeredAreaM2.value / 7));

const myRequests = computed(() => store.requests);
const records = computed(() =>
    myRequests.value.filter((r) => r.measuredAreaM2 !== null && (r.status === 'measured' || r.status === 'approved')),
);
const measuredTotalM2 = computed(() => records.value.reduce((s, r) => s + (r.measuredAreaM2 ?? 0), 0));

// ── New request form: the producer picks one of their registered fields;
// il/ilçe + ada/parsel are derived from it (never typed by hand).
const selectedFieldId = ref('');
const formError = ref('');
const submitting = ref(false);

function hasCadastralInfo(f: Field): boolean {
    return !!f.adaNo?.trim() && !!f.parcelNo?.trim();
}
const selectableFields = computed(() => fieldsStore.fields);
const selectedField = computed(() => fieldsStore.fields.find((f) => f.id === selectedFieldId.value) ?? null);
const hasFieldsMissingCadastralInfo = computed(() => selectableFields.value.some((f) => !hasCadastralInfo(f)));

function fieldOptionLabel(f: Field): string {
    const parcel = hasCadastralInfo(f) ? `Ada ${f.adaNo} / Parsel ${f.parcelNo}` : 'Ada/parsel eksik';
    return `${f.name} · ${parcel}`;
}

function resetForm(): void {
    selectedFieldId.value = '';
    formError.value = '';
}

async function submit(): Promise<void> {
    const field = selectedField.value;
    if (!field) {
        formError.value = 'Lütfen bir tarla seçin.';
        return;
    }
    if (!hasCadastralInfo(field)) {
        formError.value = 'Seçilen tarlanın ada/parsel bilgisi eksik. Önce tarla kaydını düzenleyin.';
        return;
    }
    submitting.value = true;
    const created = await store.createRequest({
        il: field.province.trim(),
        ilce: field.district.trim(),
        ada: (field.adaNo ?? '').trim(),
        parsel: (field.parcelNo ?? '').trim(),
        registeredAreaM2: Math.round(fieldToM2(field)),
        parcelGeometry: field.coordinates?.[0] ?? undefined,
    });
    submitting.value = false;
    if (created) resetForm();
    else formError.value = store.error ?? 'Talep oluşturulamadı.';
}

const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'request', label: 'Budama Talebi' },
    { id: 'record', label: 'Budama Kaydı' },
];

function onTabChange(value: string | number): void {
    if (value === 'request' || value === 'record') tab.value = value;
}

function formatNumber(n: number): string {
    return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
}
function formatDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function methodLabel(r: PruningRequest): string {
    if (r.method === 'gps') return 'GPS';
    if (r.method === 'map') return 'Harita';
    if (r.method === 'imu') return 'Lazer + IMU';
    return '—';
}

function firstPointLabel(r: PruningRequest): string {
    const p = r.measurementPoints[0];
    if (!p) return '—';
    return `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}, ${p.altitudeMeters.toFixed(1)} m`;
}

onMounted(() => {
    resetForm();
    fieldsStore.fetchFields();
    store.fetchAll();
});
</script>

<template>
    <TeaBusinessLayout>
        <PageContainer>
            <PageHeader title="Budama" :description="headerDescription" />

            <Tabs :model-value="tab" @update:model-value="onTabChange">
                <TabsList variant="line" aria-label="Budama bölümleri">
                    <TabsTrigger v-for="t in tabs" :key="t.id" :value="t.id">{{ t.label }}</TabsTrigger>
                </TabsList>

                <!-- Budama Talebi -->
                <TabsContent value="request" class="flex flex-col gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Yeni budama talebi</CardTitle>
                            <CardDescription>
                                Budadığınız tarlayı kayıtlı tarlalarınız arasından seçin; il/ilçe ve ada/parsel bilgisi tarla kaydından alınır.
                                Çaykur yetkili personeli talebinizi değerlendirip bir
                                <strong class="font-semibold text-foreground">randevu tarihi</strong> belirler; randevuda budanan çay hassas sensörlerle ölçülüp kaydedilir.
                            </CardDescription>
                        </CardHeader>
                        <CardContent class="flex flex-col gap-4">
                            <LoadingState v-if="fieldsStore.isLoading && !selectableFields.length" text="Tarlalar yükleniyor..." class="min-h-24" />

                            <p v-else-if="!selectableFields.length" class="text-sm text-muted-foreground">
                                Henüz kayıtlı tarlanız yok. Talep açmak için önce
                                <RouterLink to="/tea/fields/create" class="font-semibold text-primary underline underline-offset-4">tarla ekleyin</RouterLink>.
                            </p>

                            <div v-else class="grid gap-4 md:grid-cols-2">
                                <div class="space-y-2 md:col-span-2">
                                    <Label for="pruning-field-select">Tarla</Label>
                                    <Select v-model="selectedFieldId">
                                        <SelectTrigger id="pruning-field-select" class="w-full">
                                            <SelectValue placeholder="Tarla seçin" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem v-for="f in selectableFields" :key="f.id" :value="f.id" :disabled="!hasCadastralInfo(f)">
                                                {{ fieldOptionLabel(f) }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <template v-if="selectedField">
                                    <div class="space-y-2">
                                        <span class="text-sm font-medium">İl / İlçe</span>
                                        <p class="flex min-h-11 items-center rounded-md border bg-muted px-3 text-sm font-semibold text-foreground md:min-h-9">
                                            {{ selectedField.province }} / {{ selectedField.district }}
                                        </p>
                                    </div>
                                    <div class="space-y-2">
                                        <span class="text-sm font-medium">Ada / Parsel</span>
                                        <p class="flex min-h-11 items-center rounded-md border bg-muted px-3 text-sm font-semibold text-foreground md:min-h-9">
                                            Ada {{ selectedField.adaNo }} / Parsel {{ selectedField.parcelNo }}
                                        </p>
                                    </div>
                                    <div class="space-y-2">
                                        <span class="text-sm font-medium">Mahalle</span>
                                        <p class="flex min-h-11 items-center rounded-md border bg-muted px-3 text-sm font-semibold text-foreground md:min-h-9">
                                            {{ selectedField.neighborhood || '—' }}
                                        </p>
                                    </div>
                                    <div class="space-y-2">
                                        <span class="text-sm font-medium">Alan</span>
                                        <p class="flex min-h-11 items-center rounded-md border bg-muted px-3 text-sm font-semibold text-foreground tabular-nums md:min-h-9">
                                            {{ formatNumber(fieldToM2(selectedField)) }} m²
                                        </p>
                                    </div>
                                </template>

                                <p v-if="hasFieldsMissingCadastralInfo" class="text-xs text-muted-foreground md:col-span-2">
                                    Ada/parsel bilgisi eksik tarlalar seçilemez.
                                    <RouterLink to="/tea/fields" class="font-semibold text-primary underline underline-offset-4">Tarla kaydını düzenleyin</RouterLink>.
                                </p>
                            </div>

                            <Alert v-if="formError" variant="destructive">
                                <AlertDescription>{{ formError }}</AlertDescription>
                            </Alert>
                        </CardContent>
                        <CardFooter class="justify-end">
                            <Button class="h-11 md:h-9" :disabled="submitting" @click="submit">
                                <Spinner v-if="submitting" />
                                <Scissors v-else aria-hidden="true" />
                                {{ submitting ? 'Gönderiliyor…' : 'Talep oluştur' }}
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card class="gap-4 overflow-hidden pb-0">
                        <CardHeader>
                            <CardTitle>Taleplerim</CardTitle>
                            <CardAction>
                                <Badge variant="secondary">{{ formatNumber(myRequests.length) }} talep</Badge>
                            </CardAction>
                        </CardHeader>
                        <div class="border-t">
                            <Table>
                                <TableHeader>
                                    <TableRow class="hover:bg-transparent">
                                        <TableHead class="pl-5">Ada / Parsel</TableHead>
                                        <TableHead class="hidden md:table-cell">İl / İlçe</TableHead>
                                        <TableHead class="hidden md:table-cell">Talep tarihi</TableHead>
                                        <TableHead class="hidden md:table-cell">Randevu</TableHead>
                                        <TableHead class="pr-5 text-right md:text-left">Durum</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableEmpty v-if="!myRequests.length" :colspan="5">
                                        <div class="flex flex-col items-center gap-2 text-center">
                                            <ClipboardList class="size-6 text-muted-foreground" aria-hidden="true" />
                                            <p class="text-sm font-medium text-foreground">Henüz talebiniz yok</p>
                                        </div>
                                    </TableEmpty>
                                    <TableRow v-for="r in myRequests" v-else :key="r.id">
                                        <TableCell class="pl-5">
                                            <span class="block font-medium text-foreground">Ada {{ r.ada }} / Parsel {{ r.parsel }}</span>
                                            <span class="block text-xs text-muted-foreground md:hidden">{{ r.il }} · {{ r.ilce }}</span>
                                            <span class="block text-xs text-muted-foreground md:hidden">
                                                Talep {{ formatDate(r.createdAt) }} · Randevu {{ formatDate(r.appointmentDate) }}
                                            </span>
                                        </TableCell>
                                        <TableCell class="hidden text-muted-foreground md:table-cell">{{ r.il }} · {{ r.ilce }}</TableCell>
                                        <TableCell class="hidden whitespace-nowrap text-muted-foreground md:table-cell">{{ formatDate(r.createdAt) }}</TableCell>
                                        <TableCell class="hidden whitespace-nowrap text-muted-foreground md:table-cell">{{ formatDate(r.appointmentDate) }}</TableCell>
                                        <TableCell class="pr-5 text-right md:text-left">
                                            <Badge :variant="toneVariant(PRUNING_REQUEST_STATUS_META[r.status].tone)">
                                                {{ PRUNING_REQUEST_STATUS_META[r.status].label }}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </TabsContent>

                <!-- Budama Kaydı -->
                <TabsContent value="record" class="flex flex-col gap-4">
                    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Budama özeti">
                        <StatCard label="Toplam kayıtlı arazi" :value="`${formatNumber(registeredAreaM2)} m²`" hint="ruhsatlı bahçeniz" :icon="Scissors" />
                        <StatCard label="Budanacak miktar" :value="`${formatNumber(pruneTargetM2)} m²`" hint="1/7 hedef · %14,3" :icon="Ruler" />
                        <StatCard
                            label="Ölçülen / onaylanan"
                            :value="`${formatNumber(measuredTotalM2)} m²`"
                            :hint="`${formatNumber(records.length)} kayıt`"
                            :icon="ClipboardList"
                        />
                    </section>

                    <Card class="gap-4 overflow-hidden pb-0">
                        <CardHeader>
                            <CardTitle>Budama kayıtları</CardTitle>
                            <CardAction>
                                <Badge variant="secondary">{{ formatNumber(records.length) }} ölçüm</Badge>
                            </CardAction>
                        </CardHeader>
                        <div class="border-t">
                            <Table>
                                <TableHeader>
                                    <TableRow class="hover:bg-transparent">
                                        <TableHead class="pl-5">Ada / Parsel</TableHead>
                                        <TableHead class="pr-5 text-right md:pr-2">Ölçülen alan</TableHead>
                                        <TableHead class="hidden md:table-cell">Konum (enlem, boylam, yükseklik)</TableHead>
                                        <TableHead class="hidden md:table-cell">Yöntem</TableHead>
                                        <TableHead class="hidden md:table-cell">Durum</TableHead>
                                        <TableHead class="hidden pr-5 md:table-cell">Tarih</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableEmpty v-if="!records.length" :colspan="6">
                                        <div class="flex flex-col items-center gap-2 text-center">
                                            <Ruler class="size-6 text-muted-foreground" aria-hidden="true" />
                                            <p class="text-sm font-medium text-foreground">Henüz budama kaydı yok</p>
                                            <p class="max-w-sm text-xs whitespace-normal text-muted-foreground">
                                                Ölçüm, randevu tarihinde Çaykur yetkili personeli tarafından sahada yapılır.
                                            </p>
                                        </div>
                                    </TableEmpty>
                                    <TableRow v-for="r in records" v-else :key="r.id">
                                        <TableCell class="pl-5">
                                            <span class="block font-medium text-foreground">Ada {{ r.ada }} / Parsel {{ r.parsel }}</span>
                                            <span class="block text-xs text-muted-foreground md:hidden">{{ methodLabel(r) }} · {{ formatDate(r.measuredAt) }}</span>
                                            <Badge :variant="toneVariant(PRUNING_REQUEST_STATUS_META[r.status].tone)" class="mt-1 md:hidden">
                                                {{ PRUNING_REQUEST_STATUS_META[r.status].label }}
                                            </Badge>
                                        </TableCell>
                                        <TableCell class="pr-5 text-right font-semibold text-foreground tabular-nums md:pr-2">
                                            {{ formatNumber(r.measuredAreaM2 ?? 0) }} m²
                                        </TableCell>
                                        <TableCell class="hidden text-muted-foreground tabular-nums md:table-cell">
                                            {{ firstPointLabel(r) }}
                                            <span v-if="r.measurementPoints.length" class="ml-1 text-xs">+{{ r.measurementPoints.length - 1 }} köşe</span>
                                        </TableCell>
                                        <TableCell class="hidden text-muted-foreground md:table-cell">{{ methodLabel(r) }}</TableCell>
                                        <TableCell class="hidden md:table-cell">
                                            <Badge :variant="toneVariant(PRUNING_REQUEST_STATUS_META[r.status].tone)">
                                                {{ PRUNING_REQUEST_STATUS_META[r.status].label }}
                                            </Badge>
                                        </TableCell>
                                        <TableCell class="hidden pr-5 whitespace-nowrap text-muted-foreground md:table-cell">{{ formatDate(r.measuredAt) }}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>
        </PageContainer>
    </TeaBusinessLayout>
</template>
