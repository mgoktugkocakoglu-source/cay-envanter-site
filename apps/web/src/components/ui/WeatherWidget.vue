<script setup lang="ts">
import type { Component } from 'vue';
import {
    CalendarDays,
    Cloud,
    CloudDrizzle,
    CloudFog,
    CloudLightning,
    CloudOff,
    CloudRain,
    CloudRainWind,
    CloudSnow,
    CloudSun,
    Droplet,
    Droplets,
    MapPin,
    RefreshCw,
    Snowflake,
    Sun,
    Thermometer,
    Wind,
} from '@lucide/vue';
import type { CurrentWeather, DailyForecast, HourlyForecast } from '@/composables/useWeather';
import { EmptyState } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

withDefaults(
    defineProps<{
        current?: CurrentWeather | null;
        hourly?: HourlyForecast[];
        daily?: DailyForecast[];
        isLoading?: boolean;
        error?: string | null;
        lastUpdated?: Date | null;
        locationName?: string;
    }>(),
    {
        current: null,
        hourly: () => [],
        daily: () => [],
        isLoading: false,
        error: null,
        lastUpdated: null,
        locationName: '',
    },
);

const emit = defineEmits<{
    (e: 'retry'): void;
}>();

/** WMO weather code → Lucide glyph (replaces the emoji icons from the composable). */
const WEATHER_ICONS: Record<number, Component> = {
    0: Sun,
    1: CloudSun,
    2: CloudSun,
    3: Cloud,
    45: CloudFog,
    48: CloudFog,
    51: CloudDrizzle,
    53: CloudDrizzle,
    55: CloudDrizzle,
    61: CloudRain,
    63: CloudRain,
    65: CloudRain,
    66: CloudSnow,
    67: CloudSnow,
    71: Snowflake,
    73: Snowflake,
    75: Snowflake,
    77: CloudSnow,
    80: CloudRain,
    81: CloudRain,
    82: CloudRainWind,
    85: CloudSnow,
    86: CloudSnow,
    95: CloudLightning,
    96: CloudLightning,
    99: CloudLightning,
};

function weatherIcon(code: number): Component {
    return WEATHER_ICONS[code] ?? Cloud;
}

function formatHour(date: Date): string {
    return date.getHours().toString().padStart(2, '0') + ':00';
}

function formatLastUpdated(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatDayName(date: Date): string {
    return date.toLocaleDateString('tr-TR', { weekday: 'short' });
}
</script>

<template>
    <Card class="gap-0 overflow-hidden py-0">
        <!-- Loading skeleton -->
        <div v-if="isLoading && !current" class="flex flex-col gap-5 p-4 md:p-5" aria-busy="true">
            <div class="flex items-center gap-3">
                <Skeleton class="size-14 rounded-lg" />
                <div class="space-y-2">
                    <Skeleton class="h-7 w-28" />
                    <Skeleton class="h-4 w-20" />
                </div>
            </div>
            <div class="flex gap-2 overflow-hidden">
                <Skeleton v-for="i in 6" :key="i" class="h-20 w-14 shrink-0 rounded-lg" />
            </div>
        </div>

        <!-- Error state -->
        <EmptyState
            v-else-if="error && !current"
            :icon="CloudOff"
            title="Hava durumu alınamadı"
            :description="error"
            class="min-h-48 rounded-none border-0"
        >
            <Button variant="outline" class="h-11 md:h-9" @click="emit('retry')">
                <RefreshCw aria-hidden="true" />
                Tekrar Dene
            </Button>
        </EmptyState>

        <!-- Weather content -->
        <template v-else-if="current">
            <div class="grid md:grid-cols-2 md:divide-x">
                <!-- Current conditions -->
                <div class="flex flex-col gap-4 p-4 md:p-5">
                    <div class="flex items-center gap-3">
                        <span class="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground" aria-hidden="true">
                            <component :is="weatherIcon(current.weatherCode)" class="size-8" />
                        </span>
                        <div class="min-w-0">
                            <p class="text-4xl leading-none font-bold tracking-tight text-foreground tabular-nums">{{ Math.round(current.temperature) }}°</p>
                            <p class="mt-1 text-sm font-medium text-muted-foreground">{{ current.label }}</p>
                        </div>
                    </div>

                    <ul class="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                        <li class="flex items-center gap-1">
                            <Thermometer class="size-3.5" aria-hidden="true" />
                            <span>Hissedilen {{ Math.round(current.apparentTemperature) }}°</span>
                        </li>
                        <li class="flex items-center gap-1">
                            <Droplets class="size-3.5" aria-hidden="true" />
                            <span>%{{ current.humidity }}</span>
                        </li>
                        <li class="flex items-center gap-1">
                            <Wind class="size-3.5" aria-hidden="true" />
                            <span>{{ Math.round(current.windSpeed) }} km/s</span>
                        </li>
                    </ul>

                    <div v-if="locationName || lastUpdated" class="flex flex-wrap items-center gap-2">
                        <Badge v-if="locationName" variant="muted">
                            <MapPin aria-hidden="true" />
                            {{ locationName }}
                        </Badge>
                        <Badge v-if="lastUpdated" variant="muted">{{ formatLastUpdated(lastUpdated) }}</Badge>
                    </div>
                </div>

                <!-- 5-day forecast -->
                <div v-if="daily.length" class="flex flex-col gap-3 border-t p-4 md:border-t-0 md:p-5">
                    <p class="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        <CalendarDays class="size-3.5" aria-hidden="true" />
                        5 Günlük Tahmin
                    </p>
                    <ul class="flex flex-col gap-1">
                        <li
                            v-for="(day, idx) in daily.slice(0, 5)"
                            :key="idx"
                            class="grid grid-cols-[4rem_1.75rem_1fr_auto] items-center gap-2 rounded-md px-3 py-2 text-xs"
                            :class="idx === 0 ? 'bg-primary/10' : ''"
                        >
                            <span class="font-medium capitalize" :class="idx === 0 ? 'font-semibold text-primary' : 'text-muted-foreground'">
                                {{ idx === 0 ? 'Bugün' : formatDayName(day.date) }}
                            </span>
                            <component :is="weatherIcon(day.weatherCode)" class="size-4 text-foreground" aria-hidden="true" />
                            <span class="font-medium text-info">
                                <template v-if="day.precipitation > 0">
                                    <Droplet class="mr-0.5 inline size-3" aria-hidden="true" />{{ day.precipitation.toFixed(0) }} mm
                                </template>
                            </span>
                            <span class="text-right whitespace-nowrap text-muted-foreground tabular-nums">
                                <strong class="font-semibold text-foreground">{{ Math.round(day.tempMax) }}°</strong> / {{ Math.round(day.tempMin) }}°
                            </span>
                        </li>
                    </ul>
                </div>
            </div>

            <!-- Hourly strip -->
            <div v-if="hourly.length" class="border-t px-4 py-3">
                <div class="flex snap-x snap-mandatory gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div
                        v-for="(hour, idx) in hourly"
                        :key="idx"
                        class="flex min-w-14 shrink-0 snap-start flex-col items-center gap-1 rounded-md px-2 py-2 transition-colors"
                        :class="idx === 0 ? 'bg-primary/10' : 'hover:bg-muted'"
                    >
                        <span class="text-xs font-medium whitespace-nowrap" :class="idx === 0 ? 'font-semibold text-primary' : 'text-muted-foreground'">
                            {{ idx === 0 ? 'Şimdi' : formatHour(hour.time) }}
                        </span>
                        <component :is="weatherIcon(hour.weatherCode)" class="size-5 text-foreground" aria-hidden="true" />
                        <span class="text-xs font-semibold text-foreground tabular-nums">{{ Math.round(hour.temperature) }}°</span>
                        <span v-if="hour.rain > 0" class="flex items-center gap-0.5 text-[10px] font-medium text-info">
                            <Droplet class="size-2.5" aria-hidden="true" />
                            {{ hour.rain.toFixed(1) }}
                        </span>
                    </div>
                </div>
            </div>
        </template>
    </Card>
</template>
