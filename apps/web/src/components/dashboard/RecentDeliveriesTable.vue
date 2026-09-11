<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { ArrowRight, ChevronDown, Filter, Search, X } from '@lucide/vue';
import type { Payment } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Table,
    TableBody,
    TableCell,
    TableEmpty,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

type StatusFilter = 'all' | Payment['paymentStatus'];
type PeriodFilter = 'all' | 'month' | 'year';

const props = withDefaults(
    defineProps<{
        payments: Payment[];
        /** Maximum rows rendered on the dashboard; the full list lives on the payments page. */
        limit?: number;
    }>(),
    { limit: 8 },
);

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Tüm durumlar' },
    { value: 'received', label: 'Alındı' },
    { value: 'pending', label: 'Bekliyor' },
];

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
    { value: 'all', label: 'Tüm zamanlar' },
    { value: 'month', label: 'Bu ay' },
    { value: 'year', label: 'Bu yıl' },
];

const search = ref('');
const statusFilter = ref<StatusFilter>('all');
const periodFilter = ref<PeriodFilter>('all');
const selectedPayment = ref<Payment | null>(null);

const isDialogOpen = computed({
    get: () => selectedPayment.value !== null,
    set: (open: boolean) => {
        if (!open) selectedPayment.value = null;
    },
});

const hasActiveFilters = computed(
    () => search.value.trim() !== '' || statusFilter.value !== 'all' || periodFilter.value !== 'all',
);

const statusLabel = computed(
    () => STATUS_OPTIONS.find(o => o.value === statusFilter.value)?.label ?? '',
);
const periodLabel = computed(
    () => PERIOD_OPTIONS.find(o => o.value === periodFilter.value)?.label ?? '',
);

function firmName(payment: Payment): string {
    return payment.firm?.name ?? payment.brokerFirm?.firmName ?? '';
}

function matchesPeriod(dateStr: string): boolean {
    if (periodFilter.value === 'all') return true;
    const date = new Date(dateStr);
    const now = new Date();
    if (date.getFullYear() !== now.getFullYear()) return false;
    return periodFilter.value === 'year' || date.getMonth() === now.getMonth();
}

function matchesSearch(payment: Payment): boolean {
    const term = search.value.trim().toLocaleLowerCase('tr-TR');
    if (!term) return true;
    const haystack = [firmName(payment), payment.notes ?? '', payment.assignedField?.name ?? '']
        .join(' ')
        .toLocaleLowerCase('tr-TR');
    return haystack.includes(term);
}

const filteredPayments = computed(() =>
    [...props.payments]
        .filter(
            p =>
                (statusFilter.value === 'all' || p.paymentStatus === statusFilter.value) &&
                matchesPeriod(p.paymentDate) &&
                matchesSearch(p),
        )
        .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()),
);

const visiblePayments = computed(() => filteredPayments.value.slice(0, props.limit));
const hiddenCount = computed(() => Math.max(filteredPayments.value.length - props.limit, 0));

function clearFilters() {
    search.value = '';
    statusFilter.value = 'all';
    periodFilter.value = 'all';
}

function openDetail(payment: Payment) {
    selectedPayment.value = payment;
}

function statusLabelOf(payment: Payment): string {
    return payment.paymentStatus === 'received' ? 'Alındı' : 'Bekliyor';
}

function statusClassOf(payment: Payment): string {
    return payment.paymentStatus === 'received'
        ? 'border-success/30 bg-success/10 text-success'
        : 'border-warning/30 bg-warning/10 text-warning';
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
}

function formatKg(amount: number): string {
    return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(amount)} kg`;
}
</script>

<template>
    <section class="rounded-lg border bg-card" aria-labelledby="recent-deliveries-title">
        <header class="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
            <div class="min-w-0">
                <h3 id="recent-deliveries-title" class="text-base font-semibold text-foreground">
                    Son Teslimatlar
                </h3>
                <p class="text-sm text-muted-foreground">
                    {{ filteredPayments.length }} kayıt
                    <span v-if="hasActiveFilters">(filtrelenmiş)</span>
                </p>
            </div>

            <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <div class="relative sm:w-56">
                    <Search
                        class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <Input
                        v-model="search"
                        type="search"
                        placeholder="Firma veya not ara"
                        aria-label="Teslimatlarda ara"
                        class="h-11 pl-9 md:h-9"
                    />
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                        <Button variant="outline" class="h-11 justify-between md:h-9" aria-label="Duruma göre filtrele">
                            <span class="flex items-center gap-2">
                                <Filter class="size-4" aria-hidden="true" />
                                {{ statusLabel }}
                            </span>
                            <ChevronDown class="size-4 text-muted-foreground" aria-hidden="true" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-48">
                        <DropdownMenuLabel>Ödeme durumu</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup v-model="statusFilter">
                            <DropdownMenuRadioItem
                                v-for="option in STATUS_OPTIONS"
                                :key="option.value"
                                :value="option.value"
                                class="min-h-11 md:min-h-9"
                            >
                                {{ option.label }}
                            </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                        <Button variant="outline" class="h-11 justify-between md:h-9" aria-label="Döneme göre filtrele">
                            <span>{{ periodLabel }}</span>
                            <ChevronDown class="size-4 text-muted-foreground" aria-hidden="true" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-48">
                        <DropdownMenuLabel>Dönem</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup v-model="periodFilter">
                            <DropdownMenuRadioItem
                                v-for="option in PERIOD_OPTIONS"
                                :key="option.value"
                                :value="option.value"
                                class="min-h-11 md:min-h-9"
                            >
                                {{ option.label }}
                            </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>

                <Button
                    v-if="hasActiveFilters"
                    variant="ghost"
                    class="h-11 md:h-9"
                    @click="clearFilters"
                >
                    <X class="size-4" aria-hidden="true" />
                    Temizle
                </Button>
            </div>
        </header>

        <Table class="border-collapse">
            <TableHeader>
                <TableRow class="hover:bg-transparent">
                    <TableHead class="hidden pl-4 md:table-cell">Tarih</TableHead>
                    <TableHead class="pl-4 md:pl-2">Firma</TableHead>
                    <TableHead class="text-right">Miktar</TableHead>
                    <TableHead class="hidden text-right md:table-cell">Kg Fiyatı</TableHead>
                    <TableHead class="pr-4 text-right md:pr-2">Tutar</TableHead>
                    <TableHead class="hidden md:table-cell">Durum</TableHead>
                    <TableHead class="hidden pr-4 text-right md:table-cell">
                        <span class="sr-only">İşlem</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableEmpty v-if="visiblePayments.length === 0" :colspan="7">
                    <div class="flex flex-col items-center gap-3 text-center">
                        <p class="text-sm text-muted-foreground">
                            {{ hasActiveFilters ? 'Filtreye uyan teslimat bulunamadı.' : 'Henüz teslimat kaydı yok.' }}
                        </p>
                        <Button v-if="hasActiveFilters" variant="outline" size="sm" @click="clearFilters">
                            Filtreleri temizle
                        </Button>
                    </div>
                </TableEmpty>
                <TableRow
                    v-for="payment in visiblePayments"
                    v-else
                    :key="payment.id"
                    class="cursor-pointer"
                    tabindex="0"
                    @click="openDetail(payment)"
                    @keydown.enter="openDetail(payment)"
                >
                    <TableCell class="hidden pl-4 text-muted-foreground md:table-cell">{{ formatDate(payment.paymentDate) }}</TableCell>
                    <TableCell class="max-w-40 pl-4 md:max-w-48 md:pl-2">
                        <span class="block truncate font-medium text-foreground">{{ firmName(payment) || '—' }}</span>
                        <span class="block text-xs text-muted-foreground md:hidden">{{ formatDate(payment.paymentDate) }}</span>
                    </TableCell>
                    <TableCell class="text-right tabular-nums text-foreground">
                        {{ formatKg(payment.totalAmountKg) }}
                    </TableCell>
                    <TableCell class="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                        {{ formatCurrency(payment.pricePerKg) }}
                    </TableCell>
                    <TableCell class="pr-4 text-right md:pr-2">
                        <span class="block font-semibold tabular-nums text-foreground">{{ formatCurrency(payment.totalPrice) }}</span>
                        <Badge variant="outline" :class="[statusClassOf(payment), 'mt-0.5 md:hidden']">
                            {{ statusLabelOf(payment) }}
                        </Badge>
                    </TableCell>
                    <TableCell class="hidden md:table-cell">
                        <Badge variant="outline" :class="statusClassOf(payment)">{{ statusLabelOf(payment) }}</Badge>
                    </TableCell>
                    <TableCell class="hidden pr-4 text-right md:table-cell">
                        <Button
                            variant="ghost"
                            size="sm"
                            class="h-11 md:h-8"
                            :aria-label="`${firmName(payment) || 'Teslimat'} detayını gör`"
                            @click.stop="openDetail(payment)"
                        >
                            Detay
                        </Button>
                    </TableCell>
                </TableRow>
            </TableBody>
        </Table>

        <footer class="flex items-center justify-between gap-3 border-t p-3 pl-4">
            <span class="text-xs text-muted-foreground">
                <template v-if="hiddenCount > 0">{{ hiddenCount }} kayıt daha</template>
            </span>
            <Button as-child variant="link" class="h-11 px-2 md:h-9">
                <RouterLink to="/tea/payments">
                    Tüm ödemeler
                    <ArrowRight class="size-4" aria-hidden="true" />
                </RouterLink>
            </Button>
        </footer>

        <Dialog v-model:open="isDialogOpen">
            <DialogContent v-if="selectedPayment">
                <DialogHeader>
                    <DialogTitle>{{ firmName(selectedPayment) || 'Teslimat detayı' }}</DialogTitle>
                    <DialogDescription>{{ formatDate(selectedPayment.paymentDate) }} tarihli teslimat</DialogDescription>
                </DialogHeader>

                <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                        <dt class="text-muted-foreground">Miktar</dt>
                        <dd class="font-semibold tabular-nums text-foreground">
                            {{ formatKg(selectedPayment.totalAmountKg) }}
                        </dd>
                    </div>
                    <div>
                        <dt class="text-muted-foreground">Kg fiyatı</dt>
                        <dd class="font-semibold tabular-nums text-foreground">
                            {{ formatCurrency(selectedPayment.pricePerKg) }}
                        </dd>
                    </div>
                    <div>
                        <dt class="text-muted-foreground">Toplam tutar</dt>
                        <dd class="text-lg font-bold tabular-nums text-foreground">
                            {{ formatCurrency(selectedPayment.totalPrice) }}
                        </dd>
                    </div>
                    <div>
                        <dt class="text-muted-foreground">Durum</dt>
                        <dd>
                            <Badge variant="outline" :class="statusClassOf(selectedPayment)">
                                {{ statusLabelOf(selectedPayment) }}
                            </Badge>
                        </dd>
                    </div>
                    <div v-if="selectedPayment.tariffLabel">
                        <dt class="text-muted-foreground">Tarife</dt>
                        <dd class="text-foreground">{{ selectedPayment.tariffLabel }}</dd>
                    </div>
                    <div v-if="selectedPayment.assignedField">
                        <dt class="text-muted-foreground">Arazi</dt>
                        <dd class="text-foreground">{{ selectedPayment.assignedField.name }}</dd>
                    </div>
                    <div v-if="selectedPayment.harvestCount">
                        <dt class="text-muted-foreground">Hasat sayısı</dt>
                        <dd class="text-foreground">{{ selectedPayment.harvestCount }}</dd>
                    </div>
                    <div v-if="selectedPayment.notes" class="col-span-2">
                        <dt class="text-muted-foreground">Not</dt>
                        <dd class="whitespace-pre-line text-foreground">{{ selectedPayment.notes }}</dd>
                    </div>
                </dl>

                <DialogFooter>
                    <Button variant="outline" class="h-11 md:h-9" @click="isDialogOpen = false">Kapat</Button>
                    <Button as-child class="h-11 md:h-9">
                        <RouterLink to="/tea/payments">Ödemelere git</RouterLink>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </section>
</template>
