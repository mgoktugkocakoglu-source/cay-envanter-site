import { ref, computed, watch, onUnmounted, type Ref } from 'vue';

/** WMO Weather interpretation codes → icon + label */
interface WeatherCodeInfo {
    icon: string;
    label: string;
}

const WMO_CODES: Record<number, WeatherCodeInfo> = {
    0: { icon: '☀️', label: 'Açık' },
    1: { icon: '🌤️', label: 'Az Bulutlu' },
    2: { icon: '⛅', label: 'Parçalı Bulutlu' },
    3: { icon: '☁️', label: 'Bulutlu' },
    45: { icon: '🌫️', label: 'Sisli' },
    48: { icon: '🌫️', label: 'Kırağılı Sis' },
    51: { icon: '🌦️', label: 'Hafif Çiseleme' },
    53: { icon: '🌦️', label: 'Çiseleme' },
    55: { icon: '🌧️', label: 'Yoğun Çiseleme' },
    61: { icon: '🌧️', label: 'Hafif Yağmur' },
    63: { icon: '🌧️', label: 'Yağmurlu' },
    65: { icon: '🌧️', label: 'Şiddetli Yağmur' },
    66: { icon: '🌨️', label: 'Dondurucu Yağmur' },
    67: { icon: '🌨️', label: 'Yoğun Dondurucu Yağmur' },
    71: { icon: '❄️', label: 'Hafif Kar' },
    73: { icon: '❄️', label: 'Kar Yağışı' },
    75: { icon: '❄️', label: 'Yoğun Kar' },
    77: { icon: '🌨️', label: 'Kar Taneleri' },
    80: { icon: '🌦️', label: 'Hafif Sağanak' },
    81: { icon: '🌧️', label: 'Sağanak Yağış' },
    82: { icon: '⛈️', label: 'Şiddetli Sağanak' },
    85: { icon: '🌨️', label: 'Hafif Kar Sağanağı' },
    86: { icon: '🌨️', label: 'Yoğun Kar Sağanağı' },
    95: { icon: '⛈️', label: 'Gök Gürültüsü' },
    96: { icon: '⛈️', label: 'Dolu ile Fırtına' },
    99: { icon: '⛈️', label: 'Şiddetli Dolu Fırtınası' },
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

export interface DailyForecast {
    date: Date;
    weatherCode: number;
    icon: string;
    label: string;
    tempMax: number;
    tempMin: number;
    precipitation: number;
    sunshineHours: number;
    avgHumidity: number;
    suitabilityScore: number;
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
    const dailyForecast = ref<DailyForecast[]>([]);
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
            daily: [
                'weather_code',
                'temperature_2m_max',
                'temperature_2m_min',
                'precipitation_sum',
                'sunshine_duration',
            ].join(','),
            forecast_days: '5',
            timezone: 'auto',
        });
        return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    }

    /** Parse the API response into structured data */
    function parseResponse(data: Record<string, unknown>): void {
        const hourly = data.hourly as Record<string, unknown>;
        const daily = data.daily as Record<string, unknown> | undefined;
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
        const currentHourIndex = allHours.findIndex((h) => h.time >= now);
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

        // Hourly forecast: next 24 hours from now
        hourlyForecast.value = allHours.slice(currentIdx, currentIdx + 24);

        if (daily) {
            dailyForecast.value = parseDailyForecast(daily, allHours);
        }

        // Generate agricultural alerts
        alerts.value = generateAlerts(allHours);
        lastUpdated.value = new Date();
    }

    function parseDailyForecast(daily: Record<string, unknown>, allHours: HourlyForecast[]): DailyForecast[] {
        const dates = daily.time as string[];
        const weatherCodes = daily.weather_code as number[];
        const tempMax = daily.temperature_2m_max as number[];
        const tempMin = daily.temperature_2m_min as number[];
        const precipitation = daily.precipitation_sum as number[];
        const sunshineDuration = daily.sunshine_duration as number[];

        if (!dates?.length) return [];

        return dates.map((dateString, index) => {
            const date = new Date(`${dateString}T00:00:00`);
            const dayHours = allHours.filter((hour) =>
                hour.time.getFullYear() === date.getFullYear() &&
                hour.time.getMonth() === date.getMonth() &&
                hour.time.getDate() === date.getDate()
            );
            const avgHumidity = dayHours.length
                ? dayHours.reduce((sum, hour) => sum + hour.humidity, 0) / dayHours.length
                : 0;
            const sunshineHours = (sunshineDuration?.[index] || 0) / 3600;
            const rainMm = precipitation?.[index] || 0;
            const score = calculateTeaPickingScore({
                sunshineHours,
                precipitation: rainMm,
                avgHumidity,
                tempMax: tempMax?.[index] || 0,
                tempMin: tempMin?.[index] || 0,
            });
            const info = getWeatherInfo(weatherCodes?.[index] || 0);

            return {
                date,
                weatherCode: weatherCodes?.[index] || 0,
                icon: info.icon,
                label: info.label,
                tempMax: tempMax?.[index] || 0,
                tempMin: tempMin?.[index] || 0,
                precipitation: rainMm,
                sunshineHours,
                avgHumidity,
                suitabilityScore: score,
            };
        });
    }

    function calculateTeaPickingScore(input: {
        sunshineHours: number;
        precipitation: number;
        avgHumidity: number;
        tempMax: number;
        tempMin: number;
    }): number {
        let score = 55;
        score += Math.min(input.sunshineHours, 8) * 4;
        score -= input.precipitation * 8;

        if (input.avgHumidity > 85) score -= (input.avgHumidity - 85) * 1.5;
        if (input.avgHumidity < 45 && input.avgHumidity > 0) score -= (45 - input.avgHumidity) * 0.8;
        if (input.tempMax > 30) score -= (input.tempMax - 30) * 2;
        if (input.tempMin < 8) score -= (8 - input.tempMin) * 2;

        return Math.round(Math.max(0, Math.min(100, score)));
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
                description: `Sıcaklık ${minTemp.toFixed(1)}°C'ye kadar düşebilir. Çay fidanlarını koruma altına alın.`,
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
                title: 'Şiddetli Yağış',
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
                title: 'Kar Yağışı',
                description: `Toplam ${totalSnow.toFixed(1)} cm kar bekleniyor. Çay bahçelerini kontrol edin.`,
                timeRange: formatTimeRange(snowHours),
            });
        }

        // If no alerts, add a positive info message
        if (result.length === 0) {
            result.push({
                id: 'all-clear',
                severity: 'info',
                icon: '✅',
                title: 'Uygun Koşullar',
                description: 'Bugün hava koşulları tarımsal faaliyetler için uygundur.',
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
                e instanceof Error ? e.message : 'Hava durumu yüklenemedi';
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
        dailyForecast,
        alerts,
        hasActiveAlerts,
        isLoading,
        error,
        lastUpdated,
        fetchWeather,
    };
}
