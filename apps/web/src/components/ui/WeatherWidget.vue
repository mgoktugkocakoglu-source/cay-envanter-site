<script setup lang="ts">
import { type PropType } from 'vue';
import type {
  CurrentWeather,
  HourlyForecast,
  DailyForecast,
} from '@/composables/useWeather';

defineProps({
  current: {
    type: Object as PropType<CurrentWeather | null>,
    default: null,
  },
  hourly: {
    type: Array as PropType<HourlyForecast[]>,
    default: () => [],
  },
  daily: {
    type: Array as PropType<DailyForecast[]>,
    default: () => [],
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String as PropType<string | null>,
    default: null,
  },
  lastUpdated: {
    type: Object as PropType<Date | null>,
    default: null,
  },
  locationName: {
    type: String,
    default: '',
  },
});

const emit = defineEmits<{
  (e: 'retry'): void;
}>();

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
  <div class="weather-widget">
    <!-- Loading Skeleton -->
    <div v-if="isLoading && !current" class="weather-skeleton">
      <div class="skel-row">
        <div class="skel-circle"></div>
        <div class="skel-lines">
          <div class="skel-line skel-lg"></div>
          <div class="skel-line skel-sm"></div>
        </div>
      </div>
      <div class="skel-strip">
        <div v-for="i in 6" :key="i" class="skel-hour"></div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error && !current" class="weather-error">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p>{{ error }}</p>
      <button class="retry-btn" @click="emit('retry')">Tekrar Dene</button>
    </div>

    <!-- Weather Content -->
    <template v-else-if="current">
      <!-- Top Section: Current + Alerts -->
      <div class="weather-top">
        <!-- Current Weather -->
        <div class="current-section">
          <div class="current-main">
            <span class="current-icon">{{ current.icon }}</span>
            <div class="current-temp-wrap">
              <span class="current-temp">{{ Math.round(current.temperature) }}°</span>
              <span class="current-label">{{ current.label }}</span>
            </div>
          </div>
          <div class="current-details">
            <div class="detail-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>
              <span>Hissedilen {{ Math.round(current.apparentTemperature) }}°</span>
            </div>
            <div class="detail-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
              <span>%{{ current.humidity }}</span>
            </div>
            <div class="detail-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>
              <span>{{ Math.round(current.windSpeed) }} km/s</span>
            </div>
          </div>
          <div class="weather-meta">
            <span v-if="locationName" class="location-tag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {{ locationName }}
            </span>
            <span v-if="lastUpdated" class="updated-tag">{{ formatLastUpdated(lastUpdated) }}</span>
          </div>
        </div>

        <!-- 5-Day Forecast Section -->
        <div v-if="daily.length" class="daily-section">
          <div class="daily-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>5 Günlük Tahmin</span>
          </div>
          <div class="daily-list">
            <div
              v-for="(day, idx) in daily.slice(0, 5)"
              :key="idx"
              class="daily-row"
              :class="{ 'daily-row--today': idx === 0 }"
            >
              <span class="daily-day">{{ idx === 0 ? 'Bugün' : formatDayName(day.date) }}</span>
              <span class="daily-icon">{{ day.icon }}</span>
              <span class="daily-rain">
                <template v-if="day.precipitation > 0">💧 {{ day.precipitation.toFixed(0) }} mm</template>
              </span>
              <span class="daily-temps"><strong>{{ Math.round(day.tempMax) }}°</strong> / {{ Math.round(day.tempMin) }}°</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Hourly Forecast Strip -->
      <div v-if="hourly.length" class="hourly-strip">
        <div class="hourly-scroll">
          <div
            v-for="(hour, idx) in hourly"
            :key="idx"
            class="hour-card"
            :class="{ 'hour-card--now': idx === 0 }"
          >
            <span class="hour-time">{{ idx === 0 ? 'Şimdi' : formatHour(hour.time) }}</span>
            <span class="hour-icon">{{ hour.icon }}</span>
            <span class="hour-temp">{{ Math.round(hour.temperature) }}°</span>
            <span v-if="hour.rain > 0" class="hour-rain">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
              {{ hour.rain.toFixed(1) }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.weather-widget {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

/* ── Current Weather ── */
.weather-top {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: var(--color-border);
}

.current-section,
.daily-section {
  background: var(--color-bg-secondary);
  padding: var(--space-5);
}

.current-main {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.current-icon {
  font-size: 48px;
  line-height: 1;
}

.current-temp-wrap {
  display: flex;
  flex-direction: column;
}

.current-temp {
  font-size: 40px;
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  line-height: 1;
  letter-spacing: 0;
}

.current-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
  margin-top: var(--space-1);
}

.current-details {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-3);
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.detail-item svg {
  opacity: 0.6;
}

.weather-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.location-tag,
.updated-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--color-text-muted);
  background: var(--color-bg-tertiary);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

/* ── 5-Day Forecast ── */
.daily-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.daily-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.daily-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.daily-row {
  display: grid;
  grid-template-columns: 64px 28px 1fr auto;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
}

.daily-row--today {
  background: var(--color-primary-light);
  border: 1px solid rgba(21, 128, 61, 0.18);
}

.daily-day {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  text-transform: capitalize;
}

.daily-row--today .daily-day {
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}

.daily-icon {
  font-size: 18px;
  line-height: 1;
}

.daily-rain {
  font-size: 11px;
  color: var(--color-info);
  font-weight: var(--font-weight-medium);
}

.daily-temps {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-align: right;
  white-space: nowrap;
}

.daily-temps strong {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
}

/* ── Hourly Strip ── */
.hourly-strip {
  border-top: 1px solid var(--color-border);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-secondary);
}

.hourly-scroll {
  display: flex;
  gap: var(--space-1);
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 2px;
}

.hourly-scroll::-webkit-scrollbar {
  display: none;
}

.hour-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 56px;
  padding: var(--space-2) var(--space-2);
  border-radius: var(--radius-lg);
  scroll-snap-align: start;
  transition: background var(--transition-fast);
  cursor: default;
}

.hour-card:hover {
  background: var(--color-bg-tertiary);
}

.hour-card--now {
  background: var(--color-primary-light);
  border: 1px solid rgba(21, 128, 61, 0.2);
}

.hour-time {
  font-size: 10px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.hour-card--now .hour-time {
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}

.hour-icon {
  font-size: 20px;
  line-height: 1;
}

.hour-temp {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.hour-rain {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 9px;
  color: var(--color-info);
  font-weight: var(--font-weight-medium);
}

/* ── Skeleton ── */
.weather-skeleton {
  padding: var(--space-5);
}

.skel-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.skel-circle {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-lg);
  background: linear-gradient(90deg, var(--color-bg-tertiary) 25%, var(--color-border) 50%, var(--color-bg-tertiary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skel-lines {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.skel-line {
  border-radius: var(--radius-md);
  background: linear-gradient(90deg, var(--color-bg-tertiary) 25%, var(--color-border) 50%, var(--color-bg-tertiary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skel-lg { width: 120px; height: 28px; }
.skel-sm { width: 80px; height: 16px; }

.skel-strip {
  display: flex;
  gap: var(--space-2);
}

.skel-hour {
  width: 56px;
  height: 80px;
  border-radius: var(--radius-lg);
  background: linear-gradient(90deg, var(--color-bg-tertiary) 25%, var(--color-border) 50%, var(--color-bg-tertiary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Error State ── */
.weather-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-6);
  color: var(--color-text-muted);
}

.weather-error p {
  font-size: var(--font-size-sm);
}

.retry-btn {
  padding: var(--space-2) var(--space-4);
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-lg);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.retry-btn:hover {
  background: var(--color-primary-hover);
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .weather-top {
    grid-template-columns: 1fr;
  }

  .current-icon {
    font-size: 36px;
  }

  .current-temp {
    font-size: 32px;
  }
}

@media (max-width: 480px) {
  .current-details {
    flex-wrap: wrap;
    gap: var(--space-2);
  }
}
</style>
