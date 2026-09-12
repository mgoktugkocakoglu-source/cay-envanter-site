<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ChevronRight, ClipboardList, Ruler, Users } from '@lucide/vue';
import CaykurLayout from '@/layouts/CaykurLayout.vue';
import { EmptyState, ListToolbar, LoadingState, PageContainer, PageHeader, SearchInput, StatCard } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useMeasurementRequestsStore } from '@/stores/measurementRequestsStore';
import {
    MEASUREMENT_REQUEST_STATUS_META,
    formatNumber,
    formatDate,
    type MeasurementRequestStatus,
    type Region,
} from '@/services/caykur';

/**
 * Arazide ölçüm talepleri queue for the Kurum panel. Every row is on a
 * hisseli parcel: the producer could not make out their slice on satellite
 * imagery and asks the authorized person to measure it on site.
 */
const router = useRouter();
const store = useMeasurementRequestsStore();

type View = 'all' | MeasurementRequestStatus;
const view = ref<View>('pending');
const search = ref('');
const region = ref<'all' | Region>('all');

const summary = computed(() => store.summary);

const filtered = computed(() => {
    const q = search.value.trim().toLocaleLowerCase('tr');
    return store.requests.filter((r) => {
        if (view.value !== 'all' && r.status !== view.value) return false;
        if (region.value !== 'all' && r.il !== region.value) return false;
        if (q && !`${r.producerName} Ada ${r.ada} Parsel ${r.parsel} ${r.ilce}`.toLocaleLowerCase('tr').includes(q)) return false;
        return true;
    });
});

onMounted(() => store.fetchAll());

const viewOptions: Array<{ value: View; label: string }> = [
    { value: 'pending', label: 'Bekleyenler' },
    { value: 'scheduled', label: 'Randevulu' },
    { value: 'measured', label: 'Ölçülenler' },
    { value: 'closed', label: 'Tamamlanan' },
    { value: 'all', label: 'Tümü' },
];

const regionOptions: Array<{ value: 'all' | Region; label: string }> = [
    { value: 'all', label: 'Tüm bölgeler' },
    { value: 'Rize', label: 'Rize' },
    { value: 'Trabzon', label: 'Trabzon' },
    { value: 'Artvin', label: 'Artvin' },
    { value: 'Giresun', label: 'Giresun' },
];

function onViewChange(v: unknown): void {
    if (typeof v === 'string' && viewOptions.some((o) => o.value === v)) view.value = v as View;
}
function onRegionChange(v: unknown): void {
    if (typeof v === 'string' && regionOptions.some((o) => o.value === v)) region.value = v as 'all' | Region;
}

function openRequest(id: string): void {
    router.push(`/caykur/measurement-requests/${id}`);
}
</script>

<template>
    <CaykurLayout>
        <PageContainer size="wide">
            <PageHeader title="Ölçüm Talepleri" description="Hisseli parsellerde üreticinin sahada ölçüm istediği araziler · randevu, ölçüm ve ortak onayı akışı" />

            <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Toplam talep" :value="formatNumber(summary.total)" hint="bu sezon" :icon="ClipboardList" />
                <StatCard label="Bekleyen" :value="formatNumber(summary.pending)" hint="randevu verilecek" />
                <StatCard label="Randevulu" :value="formatNumber(summary.scheduled)" hint="sahada ölçülecek" :icon="Ruler" />
                <StatCard label="Ortak onayı bekleyen" :value="formatNumber(summary.measured)" hint="ölçüldü, onay sürüyor" :icon="Users" />
            </section>

            <ListToolbar>
                <SearchInput v-model="search" placeholder="Müstahsil, parsel veya ilçe ara" />
                <template #filters>
                    <Select :model-value="region" @update:model-value="onRegionChange">
                        <SelectTrigger class="h-11 w-44 md:h-9" aria-label="Bölge filtresi">
                            <SelectValue placeholder="Bölge" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="opt in regionOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</SelectItem>
                        </SelectContent>
                    </Select>
                </template>
            </ListToolbar>

            <ToggleGroup :model-value="view" type="single" variant="outline" aria-label="Görünüm" class="w-full md:w-fit" @update:model-value="onViewChange">
                <ToggleGroupItem v-for="opt in viewOptions" :key="opt.value" :value="opt.value" class="h-11 px-3 md:h-9">
                    {{ opt.label }}
                </ToggleGroupItem>
            </ToggleGroup>

            <LoadingState v-if="store.isLoading && !store.requests.length" text="Talepler yükleniyor..." />

            <EmptyState
                v-else-if="!filtered.length"
                :icon="Ruler"
                title="Talep yok"
                description="Bu görünüme uyan ölçüm talebi bulunmuyor."
            />

            <div v-else class="overflow-hidden rounded-lg border bg-card">
                <div class="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
                    <span>{{ formatNumber(filtered.length) }} talep</span>
                </div>
                <div class="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Müstahsil</TableHead>
                                <TableHead class="hidden md:table-cell">İl / İlçe</TableHead>
                                <TableHead>Ada / Parsel</TableHead>
                                <TableHead class="hidden lg:table-cell">Talep tarihi</TableHead>
                                <TableHead class="hidden md:table-cell">Randevu</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead class="w-8"><span class="sr-only">Detay</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow
                                v-for="r in filtered"
                                :key="r.id"
                                class="cursor-pointer"
                                tabindex="0"
                                role="link"
                                @click="openRequest(r.id)"
                                @keydown.enter="openRequest(r.id)"
                            >
                                <TableCell>
                                    <span class="block font-medium text-foreground">{{ r.producerName }}</span>
                                    <span class="block text-xs text-muted-foreground">{{ formatNumber(r.registeredAreaM2) }} m² kayıtlı</span>
                                    <span class="block text-xs text-muted-foreground md:hidden">{{ r.il }} · {{ r.ilce }}</span>
                                </TableCell>
                                <TableCell class="hidden md:table-cell">{{ r.il }} · {{ r.ilce }}</TableCell>
                                <TableCell>
                                    <span class="block">Ada {{ r.ada }} / Parsel {{ r.parsel }}</span>
                                    <Badge variant="warning" class="mt-1">
                                        <Users aria-hidden="true" />
                                        Hisseli · {{ r.coOwners?.length ?? 0 }} sahip
                                    </Badge>
                                </TableCell>
                                <TableCell class="hidden whitespace-nowrap lg:table-cell">{{ formatDate(r.createdAt) }}</TableCell>
                                <TableCell class="hidden whitespace-nowrap md:table-cell">{{ r.appointmentDate ? formatDate(r.appointmentDate) : '—' }}</TableCell>
                                <TableCell>
                                    <Badge :variant="MEASUREMENT_REQUEST_STATUS_META[r.status].tone">{{ MEASUREMENT_REQUEST_STATUS_META[r.status].label }}</Badge>
                                </TableCell>
                                <TableCell class="text-muted-foreground">
                                    <ChevronRight class="size-4" aria-hidden="true" />
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </div>
        </PageContainer>
    </CaykurLayout>
</template>
