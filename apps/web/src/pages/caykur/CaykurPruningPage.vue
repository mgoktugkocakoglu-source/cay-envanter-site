<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ChevronRight, Scissors } from '@lucide/vue';
import CaykurLayout from '@/layouts/CaykurLayout.vue';
import { EmptyState, ListToolbar, LoadingState, PageContainer, PageHeader, SearchInput, StatCard } from '@/components/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PROGRESS_TONE_CLASS, toneVariant, type Tone } from '@/components/caykur/tone';
import { api, type PruningMeasurement, type PruningStatus, type PruningMethod } from '@/services/api';
import {
    BUDAMA_TARGET_PCT,
    formatNumber,
    formatPct,
    formatDate,
} from '@/services/caykur';

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

type View = 'pending' | 'all' | 'rejected';
const view = ref<View>('pending');
const search = ref('');

const viewOptions: Array<{ value: View; label: string }> = [
    { value: 'pending', label: 'Denetim bekleyenler' },
    { value: 'all', label: 'Tüm ölçümler' },
    { value: 'rejected', label: 'Reddedilenler' },
];

/** Single-select toggle groups emit `undefined` on re-click; ignore it so a view is always active. */
function onViewChange(v: unknown): void {
    if (typeof v === 'string' && viewOptions.some((o) => o.value === v)) view.value = v as View;
}

const loading = ref(true);
const error = ref<string | null>(null);
const measurements = ref<PruningMeasurement[]>([]);

async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
        const res = await api.getPruningMeasurementsPanel({ limit: 100 });
        if (res.data) measurements.value = res.data.data;
        else {
            error.value = res.error?.message ?? 'Ölçümler yüklenemedi';
            measurements.value = [];
        }
    } catch (err) {
        error.value = err instanceof Error ? err.message : 'Ölçümler yüklenemedi';
        measurements.value = [];
    } finally {
        loading.value = false;
    }
}

onMounted(load);

const summary = computed(() => {
    const rows = measurements.value;
    const pending = rows.filter((m) => m.status === 'measured' || m.status === 'producer_approved').length;
    const approved = rows.filter((m) => m.status === 'completed' || m.status === 'staff_approved').length;
    const rejected = rows.filter((m) => m.status === 'rejected').length;
    return { total: rows.length, pending, approved, rejected };
});

const filtered = computed(() => {
    const q = search.value.trim().toLocaleLowerCase('tr');
    return measurements.value.filter((m) => {
        if (view.value === 'pending' && !(m.status === 'measured' || m.status === 'producer_approved')) return false;
        if (view.value === 'rejected' && m.status !== 'rejected') return false;
        if (q) {
            const hay = `${m.producerName ?? ''} ${m.parcelNo ?? ''}`.toLocaleLowerCase('tr');
            if (!hay.includes(q)) return false;
        }
        return true;
    });
});

/** Ratio meter spans 0–25 %; the 1/10 target sits inside that range. */
const RATIO_SCALE_MAX = 25;
const targetMarkerPct = (BUDAMA_TARGET_PCT / RATIO_SCALE_MAX) * 100;

function ratioTone(pct: number): 'success' | 'warning' | 'danger' {
    if (pct >= 11 && pct <= 20) return 'success';
    if (pct >= 6) return 'warning';
    return 'danger';
}

function ratioProgress(pct: number): number {
    return Math.max(0, Math.min(100, (pct / RATIO_SCALE_MAX) * 100));
}

function openMeasurement(id: string): void {
    router.push(`/caykur/pruning/${id}`);
}
</script>

<template>
    <CaykurLayout>
        <PageContainer size="wide">
            <PageHeader title="Budama Denetimi" :description="`1/10 rotasyon kuralı · hedef %${formatNumber(BUDAMA_TARGET_PCT, 0)}`" />

            <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Özet">
                <StatCard label="Toplam ölçüm" :value="formatNumber(summary.total)" hint="kayıtlı" />
                <StatCard label="Denetim bekleyen" :value="formatNumber(summary.pending)" hint="onay sırasında" />
                <StatCard label="Onaylanan" :value="formatNumber(summary.approved)" hint="personel onaylı" />
                <StatCard label="Reddedilen" :value="formatNumber(summary.rejected)" hint="bu sezon" />
            </section>

            <ListToolbar>
                <SearchInput v-model="search" placeholder="Müstahsil veya parsel ara…" aria-label="Ölçüm ara" />
                <template #filters>
                    <ToggleGroup :model-value="view" type="single" aria-label="Görünüm" class="h-11 md:h-9" @update:model-value="onViewChange">
                        <ToggleGroupItem v-for="opt in viewOptions" :key="opt.value" :value="opt.value" class="h-full px-3">
                            {{ opt.label }}
                        </ToggleGroupItem>
                    </ToggleGroup>
                </template>
            </ListToolbar>

            <Card class="gap-0 py-0">
                <CardHeader class="border-b py-4">
                    <CardTitle>Ölçümler</CardTitle>
                    <CardDescription aria-live="polite">{{ formatNumber(filtered.length) }} ölçüm</CardDescription>
                </CardHeader>

                <CardContent class="px-0">
                    <LoadingState v-if="loading" text="Ölçümler yükleniyor…" />

                    <Alert v-else-if="error" variant="destructive" class="m-4 w-auto">
                        <AlertDescription class="flex flex-wrap items-center justify-between gap-3">
                            <span>{{ error }}</span>
                            <Button variant="outline" size="sm" class="h-9" @click="load">Tekrar dene</Button>
                        </AlertDescription>
                    </Alert>

                    <div v-else-if="filtered.length" class="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow class="hover:bg-transparent">
                                    <TableHead class="pl-4">Müstahsil</TableHead>
                                    <TableHead class="hidden md:table-cell">Parsel</TableHead>
                                    <TableHead class="hidden lg:table-cell">Yöntem</TableHead>
                                    <TableHead class="min-w-44">Budama oranı</TableHead>
                                    <TableHead>Durum</TableHead>
                                    <TableHead class="hidden md:table-cell">Tarih</TableHead>
                                    <TableHead class="w-10 pr-4"><span class="sr-only">Detay</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow
                                    v-for="m in filtered"
                                    :key="m.id"
                                    class="cursor-pointer"
                                    tabindex="0"
                                    @click="openMeasurement(m.id)"
                                    @keydown.enter="openMeasurement(m.id)"
                                >
                                    <TableCell class="pl-4">
                                        <span class="block font-medium text-foreground">{{ m.producerName ?? 'Müstahsil' }}</span>
                                        <span class="block text-xs text-muted-foreground tabular-nums">{{ formatNumber(m.prunedAreaM2) }} / {{ formatNumber(m.fieldAreaM2) }} m²</span>
                                        <span class="block text-xs text-muted-foreground md:hidden">{{ m.parcelNo ?? '—' }} · {{ formatDate(m.measuredAt) }}</span>
                                    </TableCell>
                                    <TableCell class="hidden text-foreground md:table-cell">{{ m.parcelNo ?? '—' }}</TableCell>
                                    <TableCell class="hidden text-muted-foreground lg:table-cell">{{ METHOD_LABEL[m.method] }}</TableCell>
                                    <TableCell>
                                        <div class="flex items-center gap-3">
                                            <div class="relative w-full min-w-24">
                                                <Progress
                                                    :model-value="ratioProgress(m.ratioPercent)"
                                                    class="h-1.5 bg-muted"
                                                    :class="PROGRESS_TONE_CLASS[ratioTone(m.ratioPercent)]"
                                                    :aria-label="`Budama oranı ${formatPct(m.ratioPercent, 1)}`"
                                                />
                                                <span
                                                    class="pointer-events-none absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/50"
                                                    :style="{ left: `${targetMarkerPct}%` }"
                                                    aria-hidden="true"
                                                />
                                            </div>
                                            <span class="shrink-0 text-sm font-semibold text-foreground tabular-nums">{{ formatPct(m.ratioPercent, 1) }}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge :variant="toneVariant(STATUS_META[m.status].tone)">{{ STATUS_META[m.status].label }}</Badge>
                                    </TableCell>
                                    <TableCell class="hidden whitespace-nowrap text-muted-foreground md:table-cell">{{ formatDate(m.measuredAt) }}</TableCell>
                                    <TableCell class="pr-4 text-right">
                                        <ChevronRight class="size-4 text-muted-foreground" aria-hidden="true" />
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>

                    <EmptyState
                        v-else
                        :icon="Scissors"
                        title="Kayıt yok"
                        description="Budama ölçümleri saha personeli tarafından kaydedildikçe burada görünür."
                        class="rounded-none border-0"
                    >
                        <Button v-if="search || view !== 'all'" variant="outline" class="h-11 md:h-9" @click="search = ''; view = 'all'">
                            Filtreleri temizle
                        </Button>
                    </EmptyState>
                </CardContent>
            </Card>
        </PageContainer>
    </CaykurLayout>
</template>
