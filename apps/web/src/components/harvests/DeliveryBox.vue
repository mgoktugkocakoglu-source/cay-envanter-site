<script setup lang="ts">
import { computed } from 'vue';
import { MapPin, Plus } from '@lucide/vue';
import type { Payment } from '@/services/api';
import { getFirmLogo, getFirmInitials } from '@/utils/tariff';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const props = defineProps<{ delivery: Payment }>();
const emit = defineEmits<{ (e: 'assign', deliveryId: string): void }>();

const firmName = computed(() => props.delivery.firm?.name ?? props.delivery.brokerFirm?.firmName ?? 'Çay Firması');
const logo = computed(() => getFirmLogo({ name: firmName.value, logoUrl: props.delivery.firm?.logoUrl ?? null }));
const isReceived = computed(() => props.delivery.paymentStatus === 'received');

function formatKg(kg: number) {
    return Number(kg).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' kg';
}

function formatPrice(price: number) {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(price);
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}
</script>

<template>
    <Card :class="cn('gap-4 py-4 transition-colors hover:border-input', !delivery.assigned && 'border-dashed border-primary')">
        <CardContent class="flex flex-col gap-4 px-4">
            <div class="flex items-center justify-between gap-3">
                <div class="flex min-w-0 items-center gap-3">
                    <span
                        class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background text-xs font-bold text-primary"
                        :aria-hidden="logo ? undefined : 'true'"
                    >
                        <img v-if="logo" :src="logo" :alt="`${firmName} logosu`" class="size-full object-contain p-1" />
                        <span v-else>{{ getFirmInitials(firmName) }}</span>
                    </span>
                    <span class="truncate text-base font-semibold text-foreground">{{ firmName }}</span>
                </div>
                <Badge :variant="isReceived ? 'success' : 'warning'">{{ isReceived ? 'Ödendi' : 'Bekliyor' }}</Badge>
            </div>

            <dl class="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border bg-muted/40 p-3 text-sm">
                <div class="min-w-0">
                    <dt class="text-xs font-medium text-muted-foreground">Miktar</dt>
                    <dd class="truncate font-semibold text-foreground tabular-nums">{{ formatKg(delivery.totalAmountKg) }}</dd>
                </div>
                <div class="min-w-0">
                    <dt class="text-xs font-medium text-muted-foreground">Tarife</dt>
                    <dd class="truncate text-foreground">{{ delivery.tariffLabel || 'Peşin Ödeme' }}</dd>
                </div>
                <div class="min-w-0">
                    <dt class="text-xs font-medium text-muted-foreground">Tutar</dt>
                    <dd class="truncate font-semibold text-foreground tabular-nums">{{ formatPrice(delivery.totalPrice) }}</dd>
                </div>
                <div class="min-w-0">
                    <dt class="text-xs font-medium text-muted-foreground">Tarih</dt>
                    <dd class="truncate text-foreground">{{ formatDate(delivery.paymentDate) }}</dd>
                </div>
            </dl>

            <div
                v-if="delivery.assigned"
                class="flex min-h-11 items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 text-sm font-medium text-success md:min-h-9"
            >
                <MapPin class="size-4 shrink-0" aria-hidden="true" />
                <span class="truncate">Arazi: {{ delivery.assignedField?.name?.trim() || 'İsimsiz Arazi' }}</span>
            </div>
            <Button v-else class="h-11 w-full md:h-9" @click="emit('assign', delivery.id)">
                <Plus aria-hidden="true" />
                Arazi ekle
            </Button>
        </CardContent>
    </Card>
</template>
