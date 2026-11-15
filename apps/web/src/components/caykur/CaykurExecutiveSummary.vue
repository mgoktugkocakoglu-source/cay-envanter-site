<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { LayoutDashboard } from '@lucide/vue';
import { EmptyState, LoadingState, StatCard } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, type ExecutiveSummary } from '@/services/api';
import { formatNumber } from '@/services/caykur';

/**
 * Executive summary (Yönetici Özeti): over every imported neighbourhood, how many parcels have been checked, by which
 * evidence, and what is still open. Numbers come from the licence audit, the compliance report and the drone
 * verification as they stand; nothing is estimated and there is no history yet, so no trend is drawn.
 */
defineProps<{ selectedAreaId: string }>();
const emit = defineEmits<{ select: [areaId: string] }>();

const isLoading = ref(true);
const data = ref<ExecutiveSummary | null>(null);

const share = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const date = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '—');
/** How far each kind of evidence reaches, over the parcels the licence audit covers. */
const coverage = computed(() => {
    const t = data.value?.totals;
    if (!t) return [];
    const human = t.droneVerified + t.fieldObserved;
    return [
        { label: 'Kayıt ve uydu ile okunan', value: t.parcels, percent: t.parcels ? 100 : 0, hint: 'tapu niteliği, ruhsat kaydı ve 10 m uydu tespiti' },
        { label: 'Drone görüntüsü ile okunan', value: t.droneAnalysed, percent: share(t.droneAnalysed, t.parcels), hint: 'parsel videoda bulundu ve kareleri okundu' },
        { label: 'İnsan tarafından doğrulanan', value: human, percent: share(human, t.parcels), hint: 'saha gözlemi ya da uzmanın onayladığı görüntü okuması' },
    ];
});
const open = computed(() => (data.value ? data.value.totals.byOverall.finding + data.value.totals.byOverall.review : 0));

onMounted(async () => {
    const res = await api.getExecutiveSummary();
    data.value = res.data ?? null;
    isLoading.value = false;
});
</script>

<template>
    <div class="flex flex-col gap-4">
        <LoadingState v-if="isLoading" text="Yönetici özeti yükleniyor…" />
        <EmptyState v-else-if="!data" :icon="LayoutDashboard" title="Özet alınamadı" description="Mahalle verileri okunamadı; sayfayı yenileyip yeniden deneyin." />
        <template v-else>
            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle class="flex flex-wrap items-center gap-2">
                        Yönetici özeti
                        <Badge variant="warning">Ön değerlendirme</Badge>
                        <Badge v-if="data.totals.demoAreas" variant="warning">{{ data.totals.demoAreas }} mahallede DEMO ruhsat kaydı</Badge>
                    </CardTitle>
                    <CardDescription>
                        {{ data.totals.areas }} mahallenin {{ data.totals.areasAudited }} tanesinde ruhsat denetimi, {{ data.totals.areasWithCompliance }} tanesinde kural tabanlı uygunluk raporu, {{ data.totals.areasWithDrone }} tanesinde drone doğrulaması var.
                        Sayılar modüllerin bugünkü çıktısıdır; bulgu yerinde kontrol önerir, idari karar üretmez.
                    </CardDescription>
                </CardHeader>
            </Card>

            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Denetlenen parsel" :value="formatNumber(data.totals.parcels)" :hint="`${data.totals.areasAudited} mahallede`" :icon="LayoutDashboard" />
                <StatCard label="Açık iş" :value="formatNumber(open)" :hint="`${formatNumber(data.totals.byOverall.finding)} bulgu · ${formatNumber(data.totals.byOverall.review)} inceleme`" />
                <StatCard label="Uygun" :value="formatNumber(data.totals.byOverall.conforming)" hint="kurallara göre açık nokta yok" />
                <StatCard label="Kanıt yetersiz" :value="formatNumber(data.totals.byOverall.no_evidence)" hint="drone ya da saha kontrolü bekliyor" />
            </div>

            <div class="grid gap-6 lg:grid-cols-2">
                <Card class="gap-0 py-0">
                    <CardHeader class="py-4">
                        <CardTitle>Kanıt kapsamı</CardTitle>
                        <CardDescription>Bir sonucun ne kadar güçlü olduğunu dayandığı kanıt belirler. Uydu her parseli okur ama kabadır; bulguyu kesinleştiren insan doğrulamasıdır.</CardDescription>
                    </CardHeader>
                    <CardContent class="flex flex-col gap-4 border-t py-4">
                        <div v-for="c in coverage" :key="c.label" class="flex flex-col gap-1.5">
                            <div class="flex items-baseline justify-between gap-2 text-sm">
                                <span class="font-medium">{{ c.label }}</span>
                                <span class="tabular-nums">{{ formatNumber(c.value) }} parsel · %{{ c.percent }}</span>
                            </div>
                            <Progress :model-value="c.percent" :aria-label="c.label" />
                            <span class="text-xs text-muted-foreground">{{ c.hint }}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card class="gap-0 py-0">
                    <CardHeader class="py-4">
                        <CardTitle>En çok açık kalan kurallar</CardTitle>
                        <CardDescription>Uygunluk raporu olan mahallelerin toplamı. Ayrıntı için mahalleyi açıp Ruhsat İşlemleri → Uygunluk raporu sekmesine gidin.</CardDescription>
                    </CardHeader>
                    <CardContent class="px-0 pb-0">
                        <p v-if="!data.openRules.length" class="border-t p-4 text-sm text-muted-foreground">Açık kural yok ya da henüz uygunluk raporu üretilmedi.</p>
                        <div v-else class="overflow-x-auto border-t">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Kural</TableHead>
                                        <TableHead class="text-right">Aykırı</TableHead>
                                        <TableHead class="text-right">İnceleme</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow v-for="r in data.openRules" :key="r.id">
                                        <TableCell class="whitespace-normal"><span class="font-medium">{{ r.id }}</span> · {{ r.title }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ formatNumber(r.fail) }}</TableCell>
                                        <TableCell class="text-right tabular-nums">{{ formatNumber(r.review) }}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card class="gap-0 py-0">
                <CardHeader class="py-4">
                    <CardTitle>Mahalleler</CardTitle>
                    <CardDescription>Her mahallede hangi denetimin yapıldığı ve ne kadarının açık olduğu. Bir satıra tıklayınca o mahalle açılır.</CardDescription>
                </CardHeader>
                <CardContent class="px-0 pb-0">
                    <div class="overflow-x-auto border-t">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Mahalle</TableHead>
                                    <TableHead class="text-right">Parsel</TableHead>
                                    <TableHead>Uygunluk raporu</TableHead>
                                    <TableHead>Drone</TableHead>
                                    <TableHead class="text-right">Saha gözlemi</TableHead>
                                    <TableHead>Son denetim</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="a in data.areas" :key="a.id" class="cursor-pointer" :class="{ 'bg-muted/50': a.id === selectedAreaId }" tabindex="0" @click="emit('select', a.id)" @keydown.enter="emit('select', a.id)">
                                    <TableCell class="font-medium">
                                        {{ a.neighborhood }}
                                        <div class="text-xs text-muted-foreground">{{ a.district }} / {{ a.province }}<template v-if="a.licenceSource === 'demo'"> · DEMO ruhsat</template></div>
                                    </TableCell>
                                    <TableCell class="text-right tabular-nums">{{ a.parcels ? formatNumber(a.parcels) : '—' }}</TableCell>
                                    <TableCell>
                                        <div v-if="a.compliance" class="flex flex-wrap gap-1">
                                            <Badge variant="danger">{{ a.compliance.byOverall.finding }} bulgu</Badge>
                                            <Badge variant="warning">{{ a.compliance.byOverall.review }} inceleme</Badge>
                                            <Badge variant="success">{{ a.compliance.byOverall.conforming }} uygun</Badge>
                                        </div>
                                        <span v-else class="text-sm text-muted-foreground">{{ a.audit ? 'rapor üretilmedi' : 'denetim yapılmadı' }}</span>
                                    </TableCell>
                                    <TableCell class="text-sm">
                                        <template v-if="a.drone">
                                            {{ formatNumber(a.drone.analysed) }} parsel<template v-if="a.drone.rmsM !== null"> · ±{{ a.drone.rmsM }} m</template>
                                            <div class="text-xs text-muted-foreground">{{ a.drone.needsReview }} inceleme · {{ a.drone.verified }} doğrulanmış</div>
                                        </template>
                                        <span v-else class="text-muted-foreground">—</span>
                                    </TableCell>
                                    <TableCell class="text-right tabular-nums">{{ a.fieldObserved || '—' }}</TableCell>
                                    <TableCell class="text-sm tabular-nums">{{ date(a.compliance?.generatedAt ?? a.audit?.generatedAt) }}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <p class="text-xs text-muted-foreground">
                Zaman içindeki eğilim gösterilmiyor: denetim sonuçlarının geçmişi henüz tutulmuyor. Atama ve saha kontrolü kayıtları eklendiğinde “bekleyen / kapanan iş” ve aylık eğilim bu sayfaya gelir.
            </p>
        </template>
    </div>
</template>
