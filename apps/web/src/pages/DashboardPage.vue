<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { RouterLink } from 'vue-router';
import { Clock, Hourglass, Layers, MapPin, Wallet } from '@lucide/vue';
import { useAuthStore } from '@/stores/authStore';
import { useFieldsStore } from '@/stores/fieldsStore';
import { useHarvestsStore } from '@/stores/harvestsStore';
import { usePaymentsStore } from '@/stores/paymentsStore';
import { useWeather } from '@/composables/useWeather';
import { api, type YearlySummary } from '@/services/api';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import WeatherWidget from '@/components/ui/WeatherWidget.vue';
import RecentDeliveriesTable from '@/components/dashboard/RecentDeliveriesTable.vue';
import { PageContainer, PageHeader, StatCard } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const APPOINTMENT_DAY_LABELS: Record<string, string> = {
    monday: 'Pazartesi', tuesday: 'Salı', wednesday: 'Çarşamba', thursday: 'Perşembe',
    friday: 'Cuma', saturday: 'Cumartesi', sunday: 'Pazar',
};
const DEFAULT_QUOTA_PER_DEKAR = 30;

const authStore = useAuthStore();
const fieldsStore = useFieldsStore();
const harvestsStore = useHarvestsStore();
const paymentsStore = usePaymentsStore();

const isLoading = ref(true);
const yearlySummary = ref<YearlySummary | null>(null);
const currentTime = ref(new Date());
const prayerSchedule = ref<{ key: string; label: string; time: string }[]>([]);
const prayerError = ref('');
let clockTimer: ReturnType<typeof setInterval> | null = null;

const currentYear = new Date().getFullYear();

// ── Weather Widget ──
// Compute centroid from first field's polygon, fallback to Rize (tea capital)
const RIZE_LAT = 41.0208;
const RIZE_LON = 40.5219;

const weatherLat = computed(() => {
    const field = fieldsStore.fields[0];
    if (!field?.coordinates?.[0]?.length) return RIZE_LAT;
    const ring = field.coordinates[0];
    return ring.reduce((sum, coord) => sum + coord[1], 0) / ring.length;
});

const weatherLon = computed(() => {
    const field = fieldsStore.fields[0];
    if (!field?.coordinates?.[0]?.length) return RIZE_LON;
    const ring = field.coordinates[0];
    return ring.reduce((sum, coord) => sum + coord[0], 0) / ring.length;
});

const weatherLocationName = computed(() => {
    const field = fieldsStore.fields[0];
    if (!field) return 'Rize';
    return field.province || 'Konum';
});

const {
    currentWeather,
    hourlyForecast,
    dailyForecast: weatherDaily,
    isLoading: weatherLoading,
    error: weatherError,
    lastUpdated: weatherLastUpdated,
    fetchWeather,
} = useWeather(weatherLat, weatherLon);

const greetingText = computed(() => {
    const hour = new Date().getHours();
    if (hour < 6) return 'İyi geceler';
    if (hour < 12) return 'Günaydın';
    if (hour < 18) return 'İyi günler';
    return 'İyi akşamlar';
});

const firstName = computed(() => {
    if (!authStore.user?.fullName) return '';
    return authStore.user.fullName.split(' ')[0];
});

const greetingTitle = computed(() => (firstName.value ? `${greetingText.value}, ${firstName.value}` : greetingText.value));

const userTypeLabel = computed(() => {
    const typeMap: Record<string, string> = {
        land_owner: 'Arazi Sahibi',
        worker: 'Çay İşçisi',
        self_farmer: 'Kendi Isleyen',
    };
    return typeMap[authStore.user?.userType || ''] || '';
});

const totalArea = computed(() => {
    return fieldsStore.fields.reduce((sum, f) => {
        if (f.areaUnit === 'dekar') return sum + f.area;
        if (f.areaUnit === 'donum') return sum + f.area;
        return sum + f.area / 1000;
    }, 0);
});

const pendingPayments = computed(() => {
    return paymentsStore.payments.filter(p => p.paymentStatus === 'pending');
});

const pendingTotal = computed(() => pendingPayments.value.reduce((s, p) => s + p.totalPrice, 0));

function isCurrentMonth(dateStr: string): boolean {
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

// Monthly harvest (kg) and monthly income (₺) computed from this month's deliveries.
const monthlyHarvestKg = computed(() =>
    paymentsStore.payments
        .filter(p => isCurrentMonth(p.paymentDate))
        .reduce((sum, p) => sum + Number(p.totalAmountKg || 0), 0),
);

const monthlyIncome = computed(() =>
    paymentsStore.payments
        .filter(p => p.paymentStatus === 'received' && isCurrentMonth(p.paymentDate))
        .reduce((sum, p) => sum + Number(p.totalPrice || 0), 0),
);

// ── Çaykur status ──
const caykurQuota = computed(() => authStore.user?.quotaPerDekarKg ?? DEFAULT_QUOTA_PER_DEKAR);
const appointmentDays = computed(() =>
    (authStore.user?.appointmentDays ?? ['wednesday', 'saturday']).map(d => APPOINTMENT_DAY_LABELS[d] ?? d),
);
const weeklyCapacityKg = computed(() =>
    Math.round(totalArea.value * caykurQuota.value * appointmentDays.value.length),
);

const formattedClock = computed(() =>
    currentTime.value.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
    }),
);

const formattedToday = computed(() =>
    currentTime.value.toLocaleDateString('tr-TR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    }),
);

const nextPrayer = computed(() => {
    const now = currentTime.value;
    for (const p of prayerSchedule.value) {
        const [hour, minute] = p.time.split(':').map(Number);
        const target = new Date(now);
        target.setHours(hour, minute, 0, 0);
        if (target.getTime() > now.getTime()) return p;
    }
    return null;
});

const nextPrayerCountdown = computed(() => {
    if (prayerError.value) return '—';
    if (!prayerSchedule.value.length) return 'Yükleniyor';
    if (!nextPrayer.value) return 'Yarın İmsak';

    const [hour, minute] = nextPrayer.value.time.split(':').map(Number);
    const target = new Date(currentTime.value);
    target.setHours(hour, minute, 0, 0);

    const totalMinutes = Math.ceil((target.getTime() - currentTime.value.getTime()) / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0 && minutes > 0) return `${hours} saat ${minutes} dakika`;
    if (hours > 0) return `${hours} saat`;
    return `${minutes} dakika`;
});

const nextPrayerNote = computed(() => {
    if (prayerError.value) return prayerError.value;
    if (!nextPrayer.value) return 'Bugünün vakitleri tamamlandı';
    return `Sıradaki: ${nextPrayer.value.label} ${nextPrayer.value.time}`;
});

function formatPrayerDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

function cleanPrayerTime(value: string | undefined): string {
    return (value || '').match(/\d{2}:\d{2}/)?.[0] || '';
}

async function fetchPrayerTimes() {
    prayerError.value = '';
    try {
        const params = new URLSearchParams({
            latitude: weatherLat.value.toString(),
            longitude: weatherLon.value.toString(),
            method: '13',
        });
        const response = await fetch(`https://api.aladhan.com/v1/timings/${formatPrayerDate(currentTime.value)}?${params.toString()}`);
        if (!response.ok) throw new Error('Prayer API error');
        const data = await response.json();
        const t = data?.data?.timings ?? {};
        const schedule = [
            { key: 'Fajr', label: 'İmsak', time: cleanPrayerTime(t.Fajr) },
            { key: 'Sunrise', label: 'Güneş', time: cleanPrayerTime(t.Sunrise) },
            { key: 'Dhuhr', label: 'Öğle', time: cleanPrayerTime(t.Dhuhr) },
            { key: 'Asr', label: 'İkindi', time: cleanPrayerTime(t.Asr) },
            { key: 'Maghrib', label: 'Akşam', time: cleanPrayerTime(t.Maghrib) },
            { key: 'Isha', label: 'Yatsı', time: cleanPrayerTime(t.Isha) },
        ].filter(p => p.time);
        if (!schedule.length) throw new Error('Missing timings');
        prayerSchedule.value = schedule;
    } catch {
        prayerSchedule.value = [];
        prayerError.value = 'Vakit bilgisi alınamadı';
    }
}

function startClock() {
    currentTime.value = new Date();
    clockTimer = setInterval(() => {
        currentTime.value = new Date();
    }, 1000);
}

function stopClock() {
    if (clockTimer) {
        clearInterval(clockTimer);
        clockTimer = null;
    }
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

function formatKg(amount: number): string {
    return new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

async function loadDashboardData() {
    isLoading.value = true;
    try {
        await Promise.all([
            fieldsStore.fetchFields(),
            harvestsStore.fetchHarvests(),
            paymentsStore.fetchPayments(),
            api.getYearlySummary(currentYear).then(r => {
                if (r.data) yearlySummary.value = r.data;
            }),
        ]);
        await fetchPrayerTimes();
    } catch (e) {
        console.error('Dashboard load error:', e);
    } finally {
        isLoading.value = false;
    }
}

onMounted(() => {
    startClock();
    loadDashboardData();
});

onUnmounted(stopClock);
</script>

<template>
    <TeaBusinessLayout>
        <PageContainer>
            <!-- Loading skeleton -->
            <template v-if="isLoading">
                <div class="space-y-2" aria-busy="true" aria-label="Panel yükleniyor">
                    <Skeleton class="h-8 w-64" />
                    <Skeleton class="h-4 w-40" />
                </div>
                <div class="grid gap-4 lg:grid-cols-3">
                    <Skeleton class="h-64 rounded-lg lg:col-span-2" />
                    <Skeleton class="h-64 rounded-lg" />
                </div>
                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div v-for="i in 4" :key="i" class="flex flex-col gap-3 rounded-lg border bg-card p-4 md:p-5">
                        <div class="flex items-center justify-between">
                            <Skeleton class="h-4 w-20" />
                            <Skeleton class="size-9 rounded-md" />
                        </div>
                        <Skeleton class="h-8 w-24" />
                        <Skeleton class="h-3 w-32" />
                    </div>
                </div>
            </template>

            <!-- Dashboard content -->
            <template v-else>
                <PageHeader :title="greetingTitle" :description="`${currentYear} sezon özetiniz`">
                    <template v-if="userTypeLabel" #meta>
                        <Badge variant="secondary">{{ userTypeLabel }}</Badge>
                    </template>
                    <template #actions>
                        <Button as-child class="h-11 md:h-9">
                            <RouterLink to="/tea/fields">
                                <MapPin aria-hidden="true" />
                                Arazilerim
                            </RouterLink>
                        </Button>
                    </template>
                </PageHeader>

                <!-- Daily info: weather + clock/prayer -->
                <section class="grid gap-4 lg:grid-cols-3" aria-label="Günlük bilgiler">
                    <WeatherWidget
                        class="lg:col-span-2"
                        :current="currentWeather"
                        :hourly="hourlyForecast"
                        :daily="weatherDaily"
                        :is-loading="weatherLoading"
                        :error="weatherError"
                        :last-updated="weatherLastUpdated"
                        :location-name="weatherLocationName"
                        @retry="fetchWeather"
                    />

                    <Card class="gap-4">
                        <CardHeader>
                            <CardDescription>Bugün</CardDescription>
                            <CardTitle class="text-4xl font-bold tracking-tight tabular-nums">{{ formattedClock }}</CardTitle>
                            <CardAction>
                                <span class="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden="true">
                                    <Clock class="size-5" />
                                </span>
                            </CardAction>
                        </CardHeader>
                        <CardContent class="flex flex-1 flex-col gap-4">
                            <p class="text-sm text-muted-foreground capitalize">{{ formattedToday }}</p>

                            <div class="flex flex-col gap-1 rounded-lg border bg-muted/40 p-4">
                                <span class="text-xs font-medium text-muted-foreground">Sonraki Ezana Kalan Süre</span>
                                <strong class="text-xl font-semibold text-foreground">{{ nextPrayerCountdown }}</strong>
                                <span class="text-xs font-medium text-muted-foreground">{{ nextPrayerNote }}</span>
                            </div>

                            <dl v-if="prayerSchedule.length" class="grid grid-cols-3 gap-2">
                                <div
                                    v-for="p in prayerSchedule"
                                    :key="p.key"
                                    class="flex flex-col items-center rounded-md border px-2 py-2 text-center"
                                    :class="nextPrayer && nextPrayer.key === p.key ? 'border-primary bg-primary/10' : ''"
                                >
                                    <dt class="text-xs" :class="nextPrayer && nextPrayer.key === p.key ? 'font-semibold text-primary' : 'text-muted-foreground'">
                                        {{ p.label }}
                                    </dt>
                                    <dd class="text-sm font-semibold text-foreground tabular-nums">{{ p.time }}</dd>
                                </div>
                            </dl>
                        </CardContent>
                    </Card>
                </section>

                <!-- KPI row -->
                <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Özet göstergeler">
                    <StatCard label="Arazi" :value="fieldsStore.fieldCount" :hint="`${totalArea.toFixed(1)} dekar toplam alan`" :icon="MapPin" to="/tea/fields" />
                    <StatCard label="Aylık Hasat (kg)" :value="formatKg(monthlyHarvestKg)" hint="Bu ay teslim edilen yaş çay" :icon="Layers" to="/tea/harvests" />
                    <StatCard
                        label="Aylık Gelir"
                        :value="formatCurrency(monthlyIncome)"
                        :hint="yearlySummary ? `${yearlySummary.averagePricePerKg.toFixed(2)} TL/kg ort.` : 'Bu ay alınan ödemeler'"
                        :icon="Wallet"
                        to="/tea/payments"
                    />
                    <StatCard label="Bekleyen Ödeme" :value="pendingPayments.length" :hint="`${formatCurrency(pendingTotal)} bekliyor`" :icon="Hourglass" to="/tea/payments" />
                </section>

                <!-- Recent deliveries -->
                <RecentDeliveriesTable :payments="paymentsStore.payments" />

                <!-- Çaykur status -->
                <Card>
                    <CardHeader>
                        <CardTitle>Çaykur Durumu</CardTitle>
                        <CardDescription>Güncel kontenjan ve randevu bilgileriniz</CardDescription>
                    </CardHeader>
                    <CardContent class="flex flex-col gap-4">
                        <dl class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div class="rounded-lg border p-4">
                                <dt class="text-xs font-medium text-muted-foreground">Toplam Arazi</dt>
                                <dd class="mt-1 text-xl font-bold text-foreground tabular-nums">
                                    {{ totalArea.toFixed(1) }}<span class="text-sm font-medium text-muted-foreground"> dekar</span>
                                </dd>
                            </div>
                            <div class="rounded-lg border p-4">
                                <dt class="text-xs font-medium text-muted-foreground">Güncel Kontenjan</dt>
                                <dd class="mt-1 text-xl font-bold text-foreground tabular-nums">
                                    {{ caykurQuota }}<span class="text-sm font-medium text-muted-foreground"> kg/dekar</span>
                                </dd>
                            </div>
                            <div class="rounded-lg border bg-muted/40 p-4">
                                <dt class="text-xs font-medium text-muted-foreground">Haftalık Satış Hakkı</dt>
                                <dd class="mt-1 text-xl font-bold text-foreground tabular-nums">
                                    {{ formatKg(weeklyCapacityKg) }}<span class="text-sm font-medium text-muted-foreground"> kg</span>
                                </dd>
                            </div>
                            <div class="rounded-lg border p-4">
                                <dt class="text-xs font-medium text-muted-foreground">Randevu Günleri</dt>
                                <dd class="mt-1 text-base font-semibold text-foreground">{{ appointmentDays.join(', ') }}</dd>
                            </div>
                        </dl>
                    </CardContent>
                </Card>
            </template>
        </PageContainer>
    </TeaBusinessLayout>
</template>
