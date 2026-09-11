<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Clock, Hourglass, Trash2, Wallet } from '@lucide/vue';
import { usePaymentsStore } from '@/stores/paymentsStore';
import { useHarvestsStore } from '@/stores/harvestsStore';
import { useToast } from '@/composables/useToast';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import { ConfirmDialog, EmptyState, ListToolbar, LoadingState, PageContainer, PageHeader } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const paymentsStore = usePaymentsStore();
const harvestsStore = useHarvestsStore();
const toast = useToast();

/** Sentinel for "all statuses" — the Select cannot hold an empty-string value. */
const ALL_STATUSES = 'all';

const yearFilter = ref(new Date().getFullYear());
const statusFilter = ref(ALL_STATUSES);
const showCreateModal = ref(false);
const showDeleteConfirm = ref(false);
const deleteTargetId = ref('');
const isDeleting = ref(false);
const currentStep = ref(1);

// Create form
const selectedHarvests = ref<{ harvestId: string; usedAmountKg: number; fieldName: string; remaining: number }[]>([]);
const createForm = ref({
    totalPrice: 0,
    brokerFirmId: '',
    newBrokerFirm: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentStatus: 'received' as 'received' | 'pending',
    notes: '',
});

const years = computed(() => {
    const current = new Date().getFullYear();
    return [current, current - 1, current - 2, current - 3, current - 4];
});

// Options for the filter selects (Select values are strings)
const yearOptions = computed(() => years.value.map((y) => ({ value: String(y), label: String(y) })));

/** String adapter so the Select can drive the numeric year filter. */
const yearSelectValue = computed({
    get: () => String(yearFilter.value),
    set: (value: string) => {
        yearFilter.value = Number(value);
    },
});

const statusOptions = [
    { value: ALL_STATUSES, label: 'Tüm Durumlar' },
    { value: 'received', label: 'Alındı' },
    { value: 'pending', label: 'Bekliyor' },
];

const brokerFirmOptions = computed(() => [
    { value: '', label: 'Seçiniz veya yeni ekleyin' },
    ...paymentsStore.brokerFirms.map((firm) => ({ value: firm.id, label: firm.firmName })),
]);

const paymentStatusOptions = [
    { value: 'received', label: 'Alındı' },
    { value: 'pending', label: 'Bekliyor' },
];

const totalSelectedKg = computed(() => selectedHarvests.value.reduce((sum, h) => sum + h.usedAmountKg, 0));

const pricePerKg = computed(() => (totalSelectedKg.value > 0 ? createForm.value.totalPrice / totalSelectedKg.value : 0));

onMounted(() => {
    paymentsStore.fetchPayments({ year: yearFilter.value });
    paymentsStore.fetchBrokerFirms();
});

function applyFilters() {
    const params: Record<string, unknown> = {};
    if (yearFilter.value) params.year = yearFilter.value;
    if (statusFilter.value !== ALL_STATUSES) params.paymentStatus = statusFilter.value;
    paymentsStore.fetchPayments(params as { year?: number; paymentStatus?: string });
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function formatCurrency(amount: number) {
    return amount?.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
}

function formatKg(kg: number) {
    return kg.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' kg';
}

function statusLabel(status: 'received' | 'pending') {
    return status === 'received' ? 'Alındı' : 'Bekliyor';
}

function statusVariant(status: 'received' | 'pending') {
    return status === 'received' ? 'success' : 'warning';
}

function openCreateModal() {
    harvestsStore.fetchAvailableHarvests();
    selectedHarvests.value = [];
    createForm.value = {
        totalPrice: 0,
        brokerFirmId: '',
        newBrokerFirm: '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentStatus: 'received',
        notes: '',
    };
    currentStep.value = 1;
    showCreateModal.value = true;
}

function toggleHarvest(harvest: { id: string; fieldId?: string; fieldName?: string; remainingKg?: number | string }) {
    const index = selectedHarvests.value.findIndex((h) => h.harvestId === harvest.id);
    if (index === -1) {
        const remaining = typeof harvest.remainingKg === 'string' ? parseFloat(harvest.remainingKg) : harvest.remainingKg || 0;
        selectedHarvests.value.push({
            harvestId: harvest.id,
            usedAmountKg: remaining,
            fieldName: harvest.fieldName || '',
            remaining: remaining,
        });
    } else {
        selectedHarvests.value.splice(index, 1);
    }
}

function isHarvestSelected(harvestId: string) {
    return selectedHarvests.value.some((h) => h.harvestId === harvestId);
}

function nextStep() {
    if (currentStep.value === 1 && selectedHarvests.value.length > 0) {
        currentStep.value = 2;
    }
}

function prevStep() {
    if (currentStep.value > 1) {
        currentStep.value--;
    }
}

async function createPayment() {
    if (selectedHarvests.value.length === 0 || createForm.value.totalPrice <= 0) return;

    let brokerFirmId = createForm.value.brokerFirmId;

    // Create new broker firm if specified
    if (createForm.value.newBrokerFirm && !brokerFirmId) {
        const newFirm = await paymentsStore.createBrokerFirm(createForm.value.newBrokerFirm);
        if (newFirm) {
            brokerFirmId = newFirm.id;
        }
    }

    const result = await paymentsStore.createPayment({
        harvestAllocations: selectedHarvests.value.map((h) => ({
            harvestId: h.harvestId,
            usedAmountKg: h.usedAmountKg,
        })),
        totalPrice: createForm.value.totalPrice,
        brokerFirmId: brokerFirmId || undefined,
        paymentDate: createForm.value.paymentDate,
        paymentStatus: createForm.value.paymentStatus,
        notes: createForm.value.notes || undefined,
    });

    if (result) {
        toast.success('Ödeme başarıyla kaydedildi');
        showCreateModal.value = false;
    } else {
        toast.error('Ödeme kaydedilirken bir hata oluştu');
    }
}

function deletePayment(id: string) {
    deleteTargetId.value = id;
    showDeleteConfirm.value = true;
}

async function confirmDeletePayment() {
    isDeleting.value = true;
    try {
        const success = await paymentsStore.deletePayment(deleteTargetId.value);
        if (success) {
            toast.success('Ödeme başarıyla silindi');
        } else {
            toast.error('Ödeme silinirken bir hata oluştu');
        }
    } finally {
        isDeleting.value = false;
        showDeleteConfirm.value = false;
    }
}
</script>

<template>
    <TeaBusinessLayout>
        <PageContainer>
            <PageHeader title="Ödemeler">
                <template #meta>
                    <p class="text-sm text-muted-foreground">
                        Bu Yılın Geliri:
                        <span class="font-semibold text-foreground tabular-nums">{{ formatCurrency(paymentsStore.totalIncome) }}</span>
                    </p>
                </template>
            </PageHeader>

            <ListToolbar>
                <p class="text-sm text-muted-foreground">{{ paymentsStore.payments.length }} ödeme kaydı</p>
                <template #filters>
                    <Select v-model="yearSelectValue" @update:model-value="applyFilters">
                        <SelectTrigger class="w-32" aria-label="Yıl filtresi">
                            <SelectValue placeholder="Yıl" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="option in yearOptions" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select v-model="statusFilter" @update:model-value="applyFilters">
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
                v-else-if="paymentsStore.payments.length === 0"
                :icon="Wallet"
                title="Henüz ödeme kaydı yok"
                description="İlk ödemenizi ekleyerek başlayın"
            />

            <template v-else>
                <!-- Desktop table -->
                <div class="hidden overflow-hidden rounded-lg border bg-card md:block">
                    <Table>
                        <TableHeader>
                            <TableRow class="hover:bg-transparent">
                                <TableHead class="pl-4">Tarih</TableHead>
                                <TableHead>Aracı Firma</TableHead>
                                <TableHead class="text-right">Miktar</TableHead>
                                <TableHead class="text-right">Tutar</TableHead>
                                <TableHead class="text-right">Kg Fiyatı</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead class="pr-4 text-right"><span class="sr-only">İşlemler</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow v-for="payment in paymentsStore.payments" :key="payment.id">
                                <TableCell class="pl-4 text-muted-foreground">{{ formatDate(payment.paymentDate) }}</TableCell>
                                <TableCell class="font-medium text-foreground">{{ payment.brokerFirm?.firmName || '-' }}</TableCell>
                                <TableCell class="text-right text-foreground tabular-nums">{{ formatKg(payment.totalAmountKg) }}</TableCell>
                                <TableCell class="text-right font-semibold text-foreground tabular-nums">{{ formatCurrency(payment.totalPrice) }}</TableCell>
                                <TableCell class="text-right text-muted-foreground tabular-nums">{{ formatCurrency(payment.pricePerKg) }}/kg</TableCell>
                                <TableCell>
                                    <Badge :variant="statusVariant(payment.paymentStatus)">{{ statusLabel(payment.paymentStatus) }}</Badge>
                                </TableCell>
                                <TableCell class="pr-4 text-right">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        class="size-9 text-muted-foreground hover:text-destructive"
                                        aria-label="Ödemeyi sil"
                                        @click="deletePayment(payment.id)"
                                    >
                                        <Trash2 aria-hidden="true" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>

                <!-- Mobile card list -->
                <div class="flex flex-col gap-3 md:hidden">
                    <Card v-for="payment in paymentsStore.payments" :key="'card-' + payment.id" class="gap-0 py-0">
                        <CardContent class="px-0">
                            <div class="flex items-center justify-between gap-3 border-b px-4 py-3">
                                <div class="min-w-0">
                                    <p class="text-lg font-bold text-foreground tabular-nums">{{ formatCurrency(payment.totalPrice) }}</p>
                                    <p class="text-xs text-muted-foreground">{{ formatDate(payment.paymentDate) }}</p>
                                </div>
                                <Badge :variant="statusVariant(payment.paymentStatus)">{{ statusLabel(payment.paymentStatus) }}</Badge>
                            </div>
                            <dl class="divide-y px-4 text-sm">
                                <div class="flex items-center justify-between gap-3 py-2">
                                    <dt class="text-muted-foreground">Aracı Firma</dt>
                                    <dd class="truncate font-medium text-foreground">{{ payment.brokerFirm?.firmName || '-' }}</dd>
                                </div>
                                <div class="flex items-center justify-between gap-3 py-2">
                                    <dt class="text-muted-foreground">Miktar</dt>
                                    <dd class="font-semibold text-foreground tabular-nums">{{ formatKg(payment.totalAmountKg) }}</dd>
                                </div>
                                <div class="flex items-center justify-between gap-3 py-2">
                                    <dt class="text-muted-foreground">Kg Fiyatı</dt>
                                    <dd class="text-foreground tabular-nums">{{ formatCurrency(payment.pricePerKg) }}/kg</dd>
                                </div>
                            </dl>
                            <div class="flex justify-end border-t px-2 py-1">
                                <Button variant="ghost" class="h-11 text-muted-foreground hover:text-destructive" @click="deletePayment(payment.id)">
                                    <Trash2 aria-hidden="true" />
                                    Sil
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </template>

            <!-- Yaklaşan Ödemelerim -->
            <section v-if="paymentsStore.pendingPayments.length > 0" class="flex flex-col gap-4" aria-labelledby="upcoming-payments-title">
                <div class="flex items-center gap-2">
                    <Clock class="size-4 text-muted-foreground" aria-hidden="true" />
                    <h2 id="upcoming-payments-title" class="text-base font-semibold text-foreground">Yaklaşan Ödemelerim</h2>
                    <Badge variant="warning">{{ paymentsStore.pendingPayments.length }}</Badge>
                </div>
                <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <Card v-for="payment in paymentsStore.pendingPayments" :key="'up-' + payment.id" class="gap-4 py-4">
                        <CardContent class="flex flex-col gap-4 px-4">
                            <div class="flex items-start gap-3">
                                <span class="flex size-10 shrink-0 items-center justify-center rounded-md bg-warning/10 text-warning" aria-hidden="true">
                                    <Hourglass class="size-5" />
                                </span>
                                <div class="min-w-0 flex-1">
                                    <p class="text-base font-bold text-foreground tabular-nums">{{ formatCurrency(payment.totalPrice) }}</p>
                                    <p class="truncate text-sm text-muted-foreground">{{ payment.brokerFirm?.firmName || '—' }}</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    class="-mt-1 -mr-2 size-11 text-muted-foreground hover:text-destructive md:size-9"
                                    aria-label="Ödemeyi sil"
                                    @click="deletePayment(payment.id)"
                                >
                                    <Trash2 aria-hidden="true" />
                                </Button>
                            </div>
                            <div class="flex items-center justify-between gap-3 border-t pt-3">
                                <span class="text-sm font-semibold text-foreground tabular-nums">{{ formatKg(payment.totalAmountKg) }}</span>
                                <Badge variant="warning">{{ formatDate(payment.paymentDate) }}</Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>
        </PageContainer>

        <ConfirmDialog
            v-model:open="showDeleteConfirm"
            title="Ödemeyi Sil"
            description="Bu ödemeyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
            confirm-text="Sil"
            cancel-text="Vazgec"
            variant="danger"
            :loading="isDeleting"
            @confirm="confirmDeletePayment"
        />
    </TeaBusinessLayout>
</template>
