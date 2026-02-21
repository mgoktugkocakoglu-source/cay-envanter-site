import { ref, computed, watch, onUnmounted, type Ref } from 'vue';

/** WMO Weather interpretation codes → icon + label */
interface WeatherCodeInfo {
    icon: string;
    label: string;
}

const WMO_CODES: Record<number, WeatherCodeInfo> = {
    0: { icon: '☀️', label: 'Acik' },
    1: { icon: '🌤️', label: 'Az Bulutlu' },
    2: { icon: '⛅', label: 'Parcali Bulutlu' },
    3: { icon: '☁️', label: 'Bulutlu' },
    45: { icon: '🌫️', label: 'Sisli' },
    48: { icon: '🌫️', label: 'Kiragili Sis' },
    51: { icon: '🌦️', label: 'Hafif Ciseleme' },
    53: { icon: '🌦️', label: 'Ciseleme' },
    55: { icon: '🌧️', label: 'Yogun Ciseleme' },
    61: { icon: '🌧️', label: 'Hafif Yagmur' },
    63: { icon: '🌧️', label: 'Yagmurlu' },
    65: { icon: '🌧️', label: 'Siddetli Yagmur' },
    66: { icon: '🌨️', label: 'Dondurucu Yagmur' },
    67: { icon: '🌨️', label: 'Yogun Dondurucu Yagmur' },
    71: { icon: '❄️', label: 'Hafif Kar' },
    73: { icon: '❄️', label: 'Kar Yagisi' },
    75: { icon: '❄️', label: 'Yogun Kar' },
    77: { icon: '🌨️', label: 'Kar Taneleri' },
    80: { icon: '🌦️', label: 'Hafif Saganak' },
    81: { icon: '🌧️', label: 'Saganak Yagis' },
    82: { icon: '⛈️', label: 'Siddetli Saganak' },
    85: { icon: '🌨️', label: 'Hafif Kar Saganagi' },
    86: { icon: '🌨️', label: 'Yogun Kar Saganagi' },
    95: { icon: '⛈️', label: 'Gok Gurultusu' },
    96: { icon: '⛈️', label: 'Dolu ile Firtina' },
    99: { icon: '⛈️', label: 'Siddetli Dolu Firtinasi' },
};

export interface HourlyForecast {
    time: Date;
    temperature: number;
    apparentTemperature: number;
    humidity: number;
    rain: number;
    showers: number;
    snowfall: number;
    weatherCode: number;
    windSpeed: number;
    cloudCover: number;
    icon: string;
    label: string;
}

export interface CurrentWeather {
    temperature: number;
    apparentTemperature: number;
    humidity: number;
    windSpeed: number;
    cloudCover: number;
    rain: number;
    weatherCode: number;
    icon: string;
    label: string;
}

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AgriculturalAlert {
    id: string;
    severity: AlertSeverity;
    icon: string;
    title: string;
    description: string;
    timeRange: string;
}

function getWeatherInfo(code: number): WeatherCodeInfo {
    return WMO_CODES[code] ?? { icon: '🌡️', label: 'Bilinmiyor' };
}

/**
 * Composable for fetching weather data from Open-Meteo API.
 * Uses the user's field coordinates or Rize (tea capital) as fallback.
 */
export function useWeather(latitude: Ref<number>, longitude: Ref<number>) {
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const currentWeather = ref<CurrentWeather | null>(null);
    const hourlyForecast = ref<HourlyForecast[]>([]);
    const alerts = ref<AgriculturalAlert[]>([]);
    const lastUpdated = ref<Date | null>(null);

    let refreshTimer: ReturnType<typeof setInterval> | null = null;

    /** Build the Open-Meteo API URL with required parameters */
    function buildApiUrl(lat: number, lon: number): string {
        const params = new URLSearchParams({
            latitude: lat.toString(),
            longitude: lon.toString(),
            hourly: [
                'temperature_2m',
                'relative_humidity_2m',
                'apparent_temperature',
                'rain',
                'showers',
                'snowfall',
                'weather_code',
                'wind_speed_10m',
                'cloud_cover',
            ].join(','),
            forecast_days: '1',
            timezone: 'auto',
        });
        return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    }

    /** Parse the API response into structured data */
    function parseResponse(data: Record<string, unknown>): void {
        const hourly = data.hourly as Record<string, unknown>;
        if (!hourly) return;

        const times = hourly.time as string[];
        const temperatures = hourly.temperature_2m as number[];
        const humidities = hourly.relative_humidity_2m as number[];
        const apparentTemps = hourly.apparent_temperature as number[];
        const rains = hourly.rain as number[];
        const showers = hourly.showers as number[];
        const snowfalls = hourly.snowfall as number[];
        const weatherCodes = hourly.weather_code as number[];
        const windSpeeds = hourly.wind_speed_10m as number[];
        const cloudCovers = hourly.cloud_cover as number[];

        // Parse all hourly data
        const allHours: HourlyForecast[] = times.map((time, i) => {
            const info = getWeatherInfo(weatherCodes[i]);
            return {
                time: new Date(time),
                temperature: temperatures[i],
                apparentTemperature: apparentTemps[i],
                humidity: humidities[i],
                rain: rains[i],
                showers: showers[i],
                snowfall: snowfalls[i],
                weatherCode: weatherCodes[i],
                windSpeed: windSpeeds[i],
                cloudCover: cloudCovers[i],
                icon: info.icon,
                label: info.label,
            };
        });

        // Find the current hour
        const now = new Date();
        const currentHourIndex = allHours.findIndex(
            (h) => h.time.getHours() === now.getHours()
        );
        const currentIdx = currentHourIndex >= 0 ? currentHourIndex : 0;

        // Set current weather from the matching hour
        const current = allHours[currentIdx];
        currentWeather.value = {
            temperature: current.temperature,
            apparentTemperature: current.apparentTemperature,
            humidity: current.humidity,
            windSpeed: current.windSpeed,
            cloudCover: current.cloudCover,
            rain: current.rain,
            weatherCode: current.weatherCode,
            icon: current.icon,
            label: current.label,
        };

        // Hourly forecast: next 12 hours from now
        hourlyForecast.value = allHours.slice(currentIdx, currentIdx + 12);

        // Generate agricultural alerts
        alerts.value = generateAlerts(allHours);
        lastUpdated.value = new Date();
    }

    /** Analyze hourly data and generate agricultural alerts for tea farming */
    function generateAlerts(hours: HourlyForecast[]): AgriculturalAlert[] {
        const result: AgriculturalAlert[] = [];

        // Check for frost risk (temp ≤ 2°C)
        const frostHours = hours.filter((h) => h.temperature <= 2);
        if (frostHours.length > 0) {
            const minTemp = Math.min(...frostHours.map((h) => h.temperature));
            result.push({
                id: 'frost',
                severity: minTemp <= 0 ? 'critical' : 'warning',
                icon: '🥶',
                title: 'Don Riski',
                description: `Sicaklik ${minTemp.toFixed(1)}°C'ye kadar dusebilir. Cay fidanlarini koruma altina alin.`,
                timeRange: formatTimeRange(frostHours),
            });
        }

        // Check for heavy rain (> 10mm/h)
        const heavyRainHours = hours.filter((h) => h.rain + h.showers > 10);
        if (heavyRainHours.length > 0) {
            const maxRain = Math.max(
                ...heavyRainHours.map((h) => h.rain + h.showers)
            );
            result.push({
                id: 'heavy-rain',
                severity: maxRain > 20 ? 'critical' : 'warning',
                icon: '🌧️',
                title: 'Siddetli Yagis',
                description: `Saatte ${maxRain.toFixed(1)} mm'ye varan yagis bekleniyor. Hasat planlarinizi erteleyin.`,
                timeRange: formatTimeRange(heavyRainHours),
            });
        }

        // Check for extreme heat (≥ 35°C)
        const heatHours = hours.filter((h) => h.temperature >= 35);
        if (heatHours.length > 0) {
            const maxTemp = Math.max(...heatHours.map((h) => h.temperature));
            result.push({
                id: 'extreme-heat',
                severity: 'warning',
                icon: '🌡️',
                title: 'Asiri Sicak',
                description: `Sicaklik ${maxTemp.toFixed(1)}°C'ye ulasabilir. Sulama ve golgeleme onlemleri alin.`,
                timeRange: formatTimeRange(heatHours),
            });
        }

        // Check for strong wind (> 50 km/h)
        const windHours = hours.filter((h) => h.windSpeed > 50);
        if (windHours.length > 0) {
            const maxWind = Math.max(...windHours.map((h) => h.windSpeed));
            result.push({
                id: 'strong-wind',
                severity: 'warning',
                icon: '💨',
                title: 'Kuvvetli Ruzgar',
                description: `Ruzgar hizi ${maxWind.toFixed(0)} km/s'e ulasabilir. Ilaclama yapmayin.`,
                timeRange: formatTimeRange(windHours),
            });
        }

        // Check for snowfall
        const snowHours = hours.filter((h) => h.snowfall > 0);
        if (snowHours.length > 0) {
            const totalSnow = snowHours.reduce((sum, h) => sum + h.snowfall, 0);
            result.push({
                id: 'snowfall',
                severity: totalSnow > 5 ? 'critical' : 'info',
                icon: '❄️',
                title: 'Kar Yagisi',
                description: `Toplam ${totalSnow.toFixed(1)} cm kar bekleniyor. Cay bahcelerini kontrol edin.`,
                timeRange: formatTimeRange(snowHours),
            });
        }

        // If no alerts, add a positive info message
        if (result.length === 0) {
            result.push({
                id: 'all-clear',
                severity: 'info',
                icon: '✅',
                title: 'Uygun Kosullar',
                description: 'Bugün hava kosullari tarimsal faaliyetler icin uygundur.',
                timeRange: '',
            });
        }

        return result;
    }

    /** Format a time range string from affected hours */
    function formatTimeRange(hours: HourlyForecast[]): string {
        if (hours.length === 0) return '';
        const first = hours[0].time;
        const last = hours[hours.length - 1].time;
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${pad(first.getHours())}:00 - ${pad(last.getHours() + 1)}:00`;
    }

    /** Fetch weather data from Open-Meteo */
    async function fetchWeather(): Promise<void> {
        if (!latitude.value || !longitude.value) return;

        isLoading.value = true;
        error.value = null;

        try {
            const url = buildApiUrl(latitude.value, longitude.value);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            parseResponse(data);
        } catch (e) {
            error.value =
                e instanceof Error ? e.message : 'Hava durumu yuklenemedi';
        } finally {
            isLoading.value = false;
        }
    }

    /** Start auto-refresh timer (every 30 minutes) */
    function startAutoRefresh(): void {
        stopAutoRefresh();
        refreshTimer = setInterval(fetchWeather, 30 * 60 * 1000);
    }

    /** Stop auto-refresh timer */
    function stopAutoRefresh(): void {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
    }

    // Watch for coordinate changes and re-fetch
    watch(
        [latitude, longitude],
        () => {
            if (latitude.value && longitude.value) {
                fetchWeather();
            }
        },
        { immediate: true }
    );

    // Start auto-refresh
    startAutoRefresh();

    // Cleanup on unmount
    onUnmounted(stopAutoRefresh);

    /** Computed: whether an alert banner should be visible */
    const hasActiveAlerts = computed(
        () =>
            alerts.value.length > 0 &&
            alerts.value.some((a) => a.id !== 'all-clear')
    );

    return {
        currentWeather,
        hourlyForecast,
        alerts,
        hasActiveAlerts,
        isLoading,
        error,
        lastUpdated,
        fetchWeather,
    };
}
