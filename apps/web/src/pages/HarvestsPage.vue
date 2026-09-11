<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Banknote, BarChart3, Layers, Leaf, TrendingDown, TrendingUp, Wallet } from '@lucide/vue';
import { useHarvestsStore } from '@/stores/harvestsStore';
import { useFieldsStore } from '@/stores/fieldsStore';
import { usePaymentsStore } from '@/stores/paymentsStore';
import { useToast } from '@/composables/useToast';
import { api, type Harvest } from '@/services/api';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import DeliveryBox from '@/components/harvests/DeliveryBox.vue';
import { EmptyState, ListToolbar, LoadingState, PageContainer, PageHeader, Spinner } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type MainTab = 'harvests' | 'analysis' | 'payments';

const harvestsStore = useHarvestsStore();
const fieldsStore = useFieldsStore();
const paymentsStore = usePaymentsStore();
const toast = useToast();

// ─── Main Tab State ───
const activeMainTab = ref<MainTab>('harvests');

// ─── Arazi ekle (land assignment) modal ───
const showFieldPicker = ref(false);
const pickerDeliveryId = ref('');
const pickerFieldId = ref('');
const isAssigning = ref(false);

// ─── Shared filter / analysis state ───
// Select cannot represent an empty-string value, so "all" sentinels stand in for "no filter".
const ALL_FIELDS = 'all';
const ALL_STATUSES = 'all';
const fieldFilter = ref(ALL_FIELDS);
const yearFilter = ref(new Date().getFullYear());
const statusFilter = ref(ALL_STATUSES);
const analysisHarvests = ref<Harvest[]>([]);
const isLoadingAnalysis = ref(false);

const selectedFieldId = computed(() => (fieldFilter.value === ALL_FIELDS ? '' : fieldFilter.value));

// Year is a number in the store calls; the Select works with string values.
const yearSelectValue = computed({
    get: () => String(yearFilter.value),
    set: (value: string) => {
        yearFilter.value = Number(value);
    },
});

const monthNames = [
    'Ocak',
    'Subat',
    'Mart',
    'Nisan',
    'Mayis',
    'Haziran',
    'Temmuz',
    'Agustos',
    'Eylul',
    'Ekim',
    'Kasim',
    'Aralik',
];

const years = computed(() => {
    const current = new Date().getFullYear();
    return [current, current - 1, current - 2, current - 3, current - 4];
});

// ─── Computed Options ───
const yearOptions = computed(() =>
    years.value.map(y => ({ value: String(y), label: String(y) }))
);

const fieldFilterOptions = computed(() => [
    { value: ALL_FIELDS, label: 'Tüm Araziler' },
    ...fieldsStore.fields.map(f => ({ value: f.id, label: f.name?.trim() || 'İsimsiz Arazi' }))
]);

const statusOptions = [
    { value: ALL_STATUSES, label: 'Tüm Durumlar' },
    { value: 'received', label: 'Ödendi' },
    { value: 'pending', label: 'Bekliyor' },
];

const fieldPickerOptions = computed(() =>
    fieldsStore.fields.map(f => ({
        value: f.id,
        label: f.name?.trim() || `İsimsiz Arazi (Parsel ${f.parcelNo ?? '—'})`,
    })),
);

const analysisMonthRows = computed(() => {
    const selectedYear = Number(yearFilter.value);
    const selectedField = selectedFieldId.value;
    const totals = new Map<string, { fieldId: string; fieldName: string; month: number; kg: number }>();

    analysisHarvests.value.forEach((harvest) => {
        const date = new Date(harvest.harvestDate);
        if (date.getFullYear() !== selectedYear) return;
        if (selectedField && harvest.fieldId !== selectedField) return;

        const month = date.getMonth();
        const key = `${harvest.fieldId}-${month}`;
        const current = totals.get(key) || {
            fieldId: harvest.fieldId,
            fieldName: harvest.fieldName || fieldsStore.fields.find(f => f.id === harvest.fieldId)?.name || 'Arazi',
            month,
            kg: 0,
        };
        current.kg += harvestAmount(harvest);
        totals.set(key, current);
    });

    const grouped = new Map<string, Array<{ fieldId: string; fieldName: string; month: number; kg: number }>>();
    Array.from(totals.values()).forEach((row) => {
        const fieldRows = grouped.get(row.fieldId) || [];
        fieldRows.push(row);
        grouped.set(row.fieldId, fieldRows);
    });

    return Array.from(grouped.values()).flatMap((rows) => {
        const sorted = rows.sort((a, b) => a.month - b.month);
        return sorted.map((row, index) => {
            const previous = sorted[index - 1] || null;
            const changePercent = previous && previous.kg > 0
                ? ((row.kg - previous.kg) / previous.kg) * 100
                : null;

            return {
                ...row,
                monthName: monthNames[row.month],
                previousMonthName: previous ? monthNames[previous.month] : null,
                previousKg: previous?.kg ?? null,
                changePercent,
            };
        });
    });
});

const analysisYearRows = computed(() => {
    const selectedYear = Number(yearFilter.value);
    const selectedField = selectedFieldId.value;
    const totals = new Map<string, { fieldId: string; fieldName: string; currentKg: number; previousKg: number }>();

    analysisHarvests.value.forEach((harvest) => {
        if (selectedField && harvest.fieldId !== selectedField) return;

        const date = new Date(harvest.harvestDate);
        const year = date.getFullYear();
        if (year !== selectedYear && year !== selectedYear - 1) return;

        const current = totals.get(harvest.fieldId) || {
            fieldId: harvest.fieldId,
            fieldName: harvest.fieldName || fieldsStore.fields.find(f => f.id === harvest.fieldId)?.name || 'Arazi',
            currentKg: 0,
            previousKg: 0,
        };

        if (year === selectedYear) current.currentKg += harvestAmount(harvest);
        if (year === selectedYear - 1) current.previousKg += harvestAmount(harvest);
        totals.set(harvest.fieldId, current);
    });

    return Array.from(totals.values())
        .filter(row => row.currentKg > 0 || row.previousKg > 0)
        .map((row) => ({
            ...row,
            changePercent: row.previousKg > 0
                ? ((row.currentKg - row.previousKg) / row.previousKg) * 100
                : null,
        }));
});

const analysisNotifications = computed(() =>
    analysisMonthRows.value
        .filter(row => row.changePercent !== null && Math.abs(row.changePercent) >= 10)
        .slice(0, 4)
);

// ─── Deliveries (auto-dropped Çaykur sales) ───
const deliveries = computed(() => paymentsStore.payments);
const unassignedCount = computed(() => paymentsStore.unassignedDeliveries.length);

// Payments tab list honours the status filter (year is applied server-side).
const filteredPayments = computed(() => {
    if (statusFilter.value === ALL_STATUSES) return paymentsStore.payments;
    return paymentsStore.payments.filter(p => p.paymentStatus === statusFilter.value);
});

// ─── Lifecycle ───
onMounted(() => {
    fieldsStore.fetchFields();
    harvestsStore.fetchHarvests({ year: yearFilter.value });
    paymentsStore.fetchPayments({ year: yearFilter.value });
    loadAnalysisData();
});

// ─── Arazi ekle (assign land to a delivery) ───
function openFieldPicker(deliveryId: string) {
    pickerDeliveryId.value = deliveryId;
    pickerFieldId.value = '';
    showFieldPicker.value = true;
}

async function confirmAssignField() {
    if (!pickerFieldId.value) {
        toast.error('Lütfen bir arazi seçin');
        return;
    }
    isAssigning.value = true;
    const ok = await paymentsStore.assignField(pickerDeliveryId.value, pickerFieldId.value);
    isAssigning.value = false;
    if (ok) {
        toast.success('Teslimat araziye atandı');
        showFieldPicker.value = false;
        // Refresh harvest-backed analysis now that a new harvest exists.
        harvestsStore.fetchHarvests({ year: yearFilter.value });
        loadAnalysisData();
    } else {
        toast.error(paymentsStore.error || 'Arazi atanırken hata oluştu');
    }
}

// ─── Filters ───
function applyFilters() {
    const params: Record<string, unknown> = {};
    if (selectedFieldId.value) params.fieldId = selectedFieldId.value;
    if (yearFilter.value) params.year = yearFilter.value;
    harvestsStore.fetchHarvests(params as { fieldId?: string; year?: number });
    paymentsStore.fetchPayments({ year: yearFilter.value });
    loadAnalysisData();
}

async function loadAnalysisData() {
    isLoadingAnalysis.value = true;
    const selectedYear = Number(yearFilter.value);

    try {
        const [currentYear, previousYear] = await Promise.all([
            api.getHarvests({ year: selectedYear }),
            api.getHarvests({ year: selectedYear - 1 }),
        ]);

        analysisHarvests.value = [
            ...(currentYear.data || []),
            ...(previousYear.data || []),
        ];
    } finally {
        isLoadingAnalysis.value = false;
    }
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

function formatKg(kg?: number | string) {
    if (kg === undefined || kg === null) return '-';
    const num = typeof kg === 'string' ? parseFloat(kg) : kg;
    return num.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' kg';
}

function harvestAmount(harvest: Harvest) {
    return Number.parseFloat(String(harvest.amountKg || 0)) || 0;
}

function formatPercent(value: number | null) {
    if (value === null) return 'Karşılaştırma yok';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}%`;
}

function getTrendLabel(value: number | null) {
    if (value === null) return 'Onceki veri yok';
    if (value > 0) return 'Verim artisi';
    if (value < 0) return 'Verim dususu';
    return 'Degisim yok';
}

function trendVariant(value: number | null): 'success' | 'warning' | 'muted' {
    if (value === null) return 'muted';
    return value < 0 ? 'warning' : 'success';
}

function formatPrice(price: number) {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(price);
}

function statusLabel(status: string) {
    return status === 'received' ? 'Ödendi' : 'Bekliyor';
}
</script>

<template>
    <TeaBusinessLayout>
        <PageContainer>
            <PageHeader
                title="Hasatlarım"
                description="Çaykur teslimatlarınızı görüntüleyin, arazilerinize atayın ve ödemelerinizi takip edin"
            >
                <template #meta>
                    <Badge variant="secondary">{{ deliveries.length }} teslimat</Badge>
                    <Badge v-if="unassignedCount > 0" variant="warning">{{ unassignedCount }} arazi bekliyor</Badge>
                </template>
            </PageHeader>

            <Tabs v-model="activeMainTab">
                <TabsList variant="line" class="w-full">
                    <TabsTrigger value="harvests">
                        <Layers aria-hidden="true" />
                        Hasat Verilerim
                        <Badge v-if="unassignedCount > 0" variant="secondary">{{ unassignedCount }}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="analysis">
                        <BarChart3 aria-hidden="true" />
                        Arazi Verim Analizi
                    </TabsTrigger>
                    <TabsTrigger value="payments">
                        <Banknote aria-hidden="true" />
                        Ödemeler
                        <Badge v-if="filteredPayments.length > 0" variant="secondary">{{ filteredPayments.length }}</Badge>
                    </TabsTrigger>
                </TabsList>

                <!-- ═══════════════ TAB: Hasat Verilerim (Çaykur teslimatları) ═══════════════ -->
                <TabsContent value="harvests" class="flex flex-col gap-4">
                    <ListToolbar>
                        <p class="text-sm text-muted-foreground">
                            Çaykur veritabanından gelen çay satışlarınız. Her teslimatı, çayı topladığınız araziye atayın.
                        </p>
                        <template #filters>
                            <Select v-model="yearSelectValue" @update:model-value="applyFilters">
                                <SelectTrigger class="w-28" aria-label="Yıl filtresi">
                                    <SelectValue placeholder="Yıl" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="option in yearOptions" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
                                </SelectContent>
                            </Select>
                        </template>
                    </ListToolbar>

                    <LoadingState v-if="paymentsStore.isLoading" text="Teslimatlar yükleniyor..." />

                    <EmptyState
                        v-else-if="deliveries.length === 0"
                        :icon="Leaf"
                        title="Henüz teslimat yok"
                        description="Çaykur'a sattığınız çaylar bu alana otomatik olarak düşer."
                    />

                    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        <DeliveryBox
                            v-for="delivery in deliveries"
                            :key="delivery.id"
                            :delivery="delivery"
                            @assign="openFieldPicker"
                        />
                    </div>
                </TabsContent>

                <!-- ═══════════════ TAB: Arazi Verim Analizi ═══════════════ -->
                <TabsContent value="analysis" class="flex flex-col gap-4">
                    <ListToolbar>
                        <p class="text-sm text-muted-foreground">Arazilerinizin aylık ve yıllık yaş çay verimini karşılaştırın.</p>
                        <template #filters>
                            <Select v-model="yearSelectValue" @update:model-value="applyFilters">
                                <SelectTrigger class="w-28" aria-label="Yıl filtresi">
                                    <SelectValue placeholder="Yıl" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="option in yearOptions" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select v-model="fieldFilter" @update:model-value="applyFilters">
                                <SelectTrigger class="w-44" aria-label="Arazi filtresi">
                                    <SelectValue placeholder="Arazi" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="option in fieldFilterOptions" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
                                </SelectContent>
                            </Select>
                        </template>
                    </ListToolbar>

                    <LoadingState v-if="isLoadingAnalysis" text="Analiz hazırlanıyor..." />

                    <EmptyState
                        v-else-if="analysisMonthRows.length === 0 && analysisYearRows.length === 0"
                        :icon="BarChart3"
                        title="Analiz icin hasat verisi yok"
                        description="Hasat Verilerim sekmesinden teslimatlarınızı bir araziye atadığınızda verim değişimleri burada görünür."
                    />

                    <template v-else>
                        <div v-if="analysisNotifications.length > 0" class="grid gap-3 md:grid-cols-2">
                            <Alert
                                v-for="item in analysisNotifications"
                                :key="`${item.fieldId}-${item.month}`"
                                :variant="item.changePercent !== null && item.changePercent < 0 ? 'warning' : 'success'"
                            >
                                <TrendingDown v-if="item.changePercent !== null && item.changePercent < 0" aria-hidden="true" />
                                <TrendingUp v-else aria-hidden="true" />
                                <AlertTitle>{{ item.fieldName }}</AlertTitle>
                                <AlertDescription>
                                    {{ item.previousMonthName }} ayina gore {{ item.monthName }} ayinda
                                    {{ formatPercent(item.changePercent) }} {{ item.changePercent !== null && item.changePercent >= 0 ? 'verim artisi' : 'verim dususu' }} gozlemlendi.
                                </AlertDescription>
                            </Alert>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Aylık Karşılaştırma</CardTitle>
                                <CardDescription>Ayni arazide bir onceki hasat ayina gore degisim.</CardDescription>
                            </CardHeader>
                            <CardContent class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                <article
                                    v-for="row in analysisMonthRows"
                                    :key="`${row.fieldId}-${row.month}`"
                                    class="flex flex-col gap-3 rounded-lg border p-4"
                                >
                                    <div class="flex items-start justify-between gap-3">
                                        <div class="min-w-0">
                                            <p class="truncate text-xs text-muted-foreground">{{ row.fieldName }}</p>
                                            <p class="text-base font-semibold text-foreground">{{ row.monthName }}</p>
                                        </div>
                                        <Badge :variant="trendVariant(row.changePercent)">{{ formatPercent(row.changePercent) }}</Badge>
                                    </div>
                                    <div class="flex items-baseline justify-between gap-3 text-sm">
                                        <span class="text-muted-foreground">Toplanan</span>
                                        <span class="font-semibold text-foreground tabular-nums">{{ formatKg(row.kg) }}</span>
                                    </div>
                                    <p class="text-xs text-muted-foreground">
                                        <template v-if="row.previousKg !== null">
                                            {{ row.previousMonthName }}: {{ formatKg(row.previousKg) }} - {{ getTrendLabel(row.changePercent) }}
                                        </template>
                                        <template v-else>
                                            Bu yil icin ilk hasat ayi.
                                        </template>
                                    </p>
                                </article>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Yıllık Karşılaştırma</CardTitle>
                                <CardDescription>{{ Number(yearFilter) - 1 }} yilina gore {{ yearFilter }} toplam verim degisimi.</CardDescription>
                            </CardHeader>
                            <CardContent class="flex flex-col gap-3">
                                <div class="hidden overflow-hidden rounded-lg border md:block">
                                    <Table>
                                        <TableHeader>
                                            <TableRow class="hover:bg-transparent">
                                                <TableHead class="pl-4">Arazi</TableHead>
                                                <TableHead class="text-right">{{ Number(yearFilter) - 1 }}</TableHead>
                                                <TableHead class="text-right">{{ yearFilter }}</TableHead>
                                                <TableHead class="pr-4 text-right">Degisim</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            <TableRow v-for="row in analysisYearRows" :key="row.fieldId">
                                                <TableCell class="pl-4 font-medium text-foreground">{{ row.fieldName }}</TableCell>
                                                <TableCell class="text-right text-muted-foreground tabular-nums">{{ formatKg(row.previousKg) }}</TableCell>
                                                <TableCell class="text-right font-semibold text-foreground tabular-nums">{{ formatKg(row.currentKg) }}</TableCell>
                                                <TableCell class="pr-4 text-right">
                                                    <Badge :variant="trendVariant(row.changePercent)">{{ formatPercent(row.changePercent) }}</Badge>
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>

                                <div class="flex flex-col gap-3 md:hidden">
                                    <div v-for="row in analysisYearRows" :key="`m-${row.fieldId}`" class="flex flex-col gap-3 rounded-lg border p-4">
                                        <div class="flex items-center justify-between gap-3">
                                            <span class="truncate font-medium text-foreground">{{ row.fieldName }}</span>
                                            <Badge :variant="trendVariant(row.changePercent)">{{ formatPercent(row.changePercent) }}</Badge>
                                        </div>
                                        <dl class="grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <dt class="text-xs text-muted-foreground">{{ Number(yearFilter) - 1 }}</dt>
                                                <dd class="text-foreground tabular-nums">{{ formatKg(row.previousKg) }}</dd>
                                            </div>
                                            <div>
                                                <dt class="text-xs text-muted-foreground">{{ yearFilter }}</dt>
                                                <dd class="font-semibold text-foreground tabular-nums">{{ formatKg(row.currentKg) }}</dd>
                                            </div>
                                        </dl>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </template>
                </TabsContent>

                <!-- ═══════════════ TAB: Ödemeler ═══════════════ -->
                <TabsContent value="payments" class="flex flex-col gap-4">
                    <ListToolbar>
                        <p class="text-sm text-muted-foreground">
                            Toplam gelir:
                            <span class="font-semibold text-foreground tabular-nums">{{ formatPrice(paymentsStore.totalIncome) }}</span>
                        </p>
                        <template #filters>
                            <Select v-model="yearSelectValue" @update:model-value="applyFilters">
                                <SelectTrigger class="w-28" aria-label="Yıl filtresi">
                                    <SelectValue placeholder="Yıl" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="option in yearOptions" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select v-model="statusFilter">
                                <SelectTrigger class="w-40" aria-label="Durum filtresi">
                                    <SelectValue placeholder="Durum" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="option in statusOptions" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
                                </SelectContent>
                            </Select>
                        </template>
                    </ListToolbar>

                    <LoadingState v-if="paymentsStore.isLoading" text="Ödemeler yükleniyor..." />

                    <EmptyState
                        v-else-if="filteredPayments.length === 0"
                        :icon="Wallet"
                        title="Ödeme kaydı yok"
                        description="Çaykur teslimatlarınızın ödemeleri burada listelenir."
                    />

                    <template v-else>
                        <div class="hidden overflow-hidden rounded-lg border bg-card md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow class="hover:bg-transparent">
                                        <TableHead class="pl-4">Tarih</TableHead>
                                        <TableHead>Firma</TableHead>
                                        <TableHead class="text-right">Miktar</TableHead>
                                        <TableHead class="text-right">Tutar</TableHead>
                                        <TableHead class="pr-4">Durum</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow v-for="p in filteredPayments" :key="p.id">
                                        <TableCell class="pl-4 text-muted-foreground">{{ formatDate(p.paymentDate) }}</TableCell>
                                        <TableCell class="font-medium text-foreground">{{ p.firm?.name || p.brokerFirm?.firmName || '—' }}</TableCell>
                                        <TableCell class="text-right text-foreground tabular-nums">{{ formatKg(p.totalAmountKg) }}</TableCell>
                                        <TableCell class="text-right font-semibold text-foreground tabular-nums">{{ formatPrice(p.totalPrice) }}</TableCell>
                                        <TableCell class="pr-4">
                                            <Badge :variant="p.paymentStatus === 'received' ? 'success' : 'warning'">{{ statusLabel(p.paymentStatus) }}</Badge>
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>

                        <div class="flex flex-col gap-3 md:hidden">
                            <Card v-for="p in filteredPayments" :key="'pay-' + p.id" class="gap-3 py-4">
                                <CardContent class="flex flex-col gap-3 px-4">
                                    <div class="flex items-center justify-between gap-3">
                                        <span class="truncate font-semibold text-foreground">{{ p.firm?.name || p.brokerFirm?.firmName || '—' }}</span>
                                        <span class="shrink-0 text-xs text-muted-foreground">{{ formatDate(p.paymentDate) }}</span>
                                    </div>
                                    <dl class="flex flex-col gap-2 text-sm">
                                        <div class="flex items-center justify-between gap-3">
                                            <dt class="text-muted-foreground">Miktar</dt>
                                            <dd class="text-foreground tabular-nums">{{ formatKg(p.totalAmountKg) }}</dd>
                                        </div>
                                        <div class="flex items-center justify-between gap-3">
                                            <dt class="text-muted-foreground">Tutar</dt>
                                            <dd class="font-semibold text-foreground tabular-nums">{{ formatPrice(p.totalPrice) }}</dd>
                                        </div>
                                        <div class="flex items-center justify-between gap-3">
                                            <dt class="text-muted-foreground">Durum</dt>
                                            <dd>
                                                <Badge :variant="p.paymentStatus === 'received' ? 'success' : 'warning'">{{ statusLabel(p.paymentStatus) }}</Badge>
                                            </dd>
                                        </div>
                                    </dl>
                                </CardContent>
                            </Card>
                        </div>
                    </template>
                </TabsContent>
            </Tabs>
        </PageContainer>

        <!-- ═══ Arazi ekle (land assignment) dialog ═══ -->
        <Dialog v-model:open="showFieldPicker">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Arazi ekle</DialogTitle>
                    <DialogDescription>Bu çay teslimatını hangi arazinizden topladınız?</DialogDescription>
                </DialogHeader>
                <div class="space-y-2">
                    <Label for="picker-field">Arazi</Label>
                    <Select v-model="pickerFieldId">
                        <SelectTrigger id="picker-field" class="w-full">
                            <SelectValue placeholder="Arazi seçiniz..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="option in fieldPickerOptions" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" class="h-11 md:h-9" :disabled="isAssigning" @click="showFieldPicker = false">İptal</Button>
                    <Button class="h-11 md:h-9" :disabled="isAssigning || !pickerFieldId" @click="confirmAssignField">
                        <Spinner v-if="isAssigning" />
                        {{ isAssigning ? 'Kaydediliyor...' : 'Araziyi Ata' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </TeaBusinessLayout>
</template>
