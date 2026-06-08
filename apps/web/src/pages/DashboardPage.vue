<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useFieldsStore } from '@/stores/fieldsStore';
import { useHarvestsStore } from '@/stores/harvestsStore';
import { usePaymentsStore } from '@/stores/paymentsStore';
import { useWeather } from '@/composables/useWeather';
import { api, type YearlySummary } from '@/services/api';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import WeatherWidget from '@/components/ui/WeatherWidget.vue';

const APPOINTMENT_DAY_LABELS: Record<string, string> = {
  monday: 'Pazartesi', tuesday: 'Salı', wednesday: 'Çarşamba', thursday: 'Perşembe',
  friday: 'Cuma', saturday: 'Cumartesi', sunday: 'Pazar',
};
const DEFAULT_QUOTA_PER_DEKAR = 30;

const authStore = useAuthStore();
const fieldsStore = useFieldsStore();
const harvestsStore = useHarvestsStore();
const paymentsStore = usePaymentsStore();
const router = useRouter();

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

const { currentWeather, hourlyForecast, dailyForecast: weatherDaily, isLoading: weatherLoading, error: weatherError, lastUpdated: weatherLastUpdated, fetchWeather } = useWeather(weatherLat, weatherLon);

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

function isCurrentMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

// Bu ayki teslimatlardan hesaplanan aylık hasat (kg) ve aylık gelir (₺).
const monthlyHarvestKg = computed(() =>
  paymentsStore.payments
    .filter(p => isCurrentMonth(p.paymentDate))
    .reduce((sum, p) => sum + Number(p.totalAmountKg || 0), 0)
);

const monthlyIncome = computed(() =>
  paymentsStore.payments
    .filter(p => p.paymentStatus === 'received' && isCurrentMonth(p.paymentDate))
    .reduce((sum, p) => sum + Number(p.totalPrice || 0), 0)
);

// ── Çaykur durumu ──
const caykurQuota = computed(() => authStore.user?.quotaPerDekarKg ?? DEFAULT_QUOTA_PER_DEKAR);
const appointmentDays = computed(() =>
  (authStore.user?.appointmentDays ?? ['wednesday', 'saturday']).map(d => APPOINTMENT_DAY_LABELS[d] ?? d)
);
const weeklyCapacityKg = computed(() =>
  Math.round(totalArea.value * caykurQuota.value * appointmentDays.value.length)
);

const formattedClock = computed(() =>
  currentTime.value.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  })
);

const formattedToday = computed(() =>
  currentTime.value.toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
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
    <div class="dashboard-page">
      <!-- Loading Skeleton -->
      <div v-if="isLoading" class="dashboard-content">
        <div class="skeleton-greeting">
          <div class="skeleton-line skeleton-lg"></div>
          <div class="skeleton-line skeleton-sm"></div>
        </div>
        <div class="stats-grid">
          <div v-for="i in 4" :key="i" class="stat-card skeleton-card">
            <div class="skeleton-circle"></div>
            <div class="skeleton-line skeleton-md"></div>
            <div class="skeleton-line skeleton-sm"></div>
          </div>
        </div>
      </div>

      <!-- Dashboard Content -->
      <div v-else class="dashboard-content">
        <!-- Greeting -->
        <header class="greeting-section">
          <div class="greeting-text">
            <h1>{{ greetingText }}<span v-if="firstName">, {{ firstName }}</span></h1>
            <div class="greeting-meta">
              <span v-if="userTypeLabel" class="user-type-badge">{{ userTypeLabel }}</span>
              <p>{{ currentYear }} sezon özetiniz</p>
            </div>
          </div>
          <div class="greeting-actions">
            <RouterLink to="/tea/fields" class="action-btn action-btn--primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              Arazilerim
            </RouterLink>
          </div>
        </header>

        <!-- Daily Info -->
        <section class="daily-info-grid">
          <WeatherWidget
            :current="currentWeather"
            :hourly="hourlyForecast"
            :daily="weatherDaily"
            :is-loading="weatherLoading"
            :error="weatherError"
            :last-updated="weatherLastUpdated"
            :location-name="weatherLocationName"
            @retry="fetchWeather"
          />
          <div class="time-card">
            <div class="time-card-header">
              <div>
                <span class="time-eyebrow">Bugün</span>
                <h2>{{ formattedClock }}</h2>
              </div>
              <div class="time-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
            </div>
            <p class="time-date">{{ formattedToday }}</p>
            <div class="prayer-countdown">
              <span class="prayer-label">Sonraki Ezana Kalan Süre</span>
              <strong>{{ nextPrayerCountdown }}</strong>
              <span class="prayer-note">{{ nextPrayerNote }}</span>
            </div>
            <div v-if="prayerSchedule.length" class="prayer-times">
              <div
                v-for="p in prayerSchedule"
                :key="p.key"
                class="prayer-time"
                :class="{ 'prayer-time--next': nextPrayer && nextPrayer.key === p.key }"
              >
                <span class="prayer-time-label">{{ p.label }}</span>
                <span class="prayer-time-value">{{ p.time }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Stats Cards -->
        <section class="stats-grid">
          <div class="stat-card" role="link" tabindex="0" @click="router.push('/fields')" @keydown.enter="router.push('/fields')">
            <div class="stat-icon stat-icon--fields">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ fieldsStore.fieldCount }}</span>
              <span class="stat-label">Arazi</span>
            </div>
            <div class="stat-sub">{{ totalArea.toFixed(1) }} dekar toplam alan</div>
          </div>

          <div class="stat-card" role="link" tabindex="0" @click="router.push('/harvests')" @keydown.enter="router.push('/harvests')">
            <div class="stat-icon stat-icon--harvests">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ formatKg(monthlyHarvestKg) }}</span>
              <span class="stat-label">Aylık Hasat (kg)</span>
            </div>
            <div class="stat-sub">Bu ay teslim edilen yaş çay</div>
          </div>

          <div class="stat-card" role="link" tabindex="0" @click="router.push('/payments')" @keydown.enter="router.push('/payments')">
            <div class="stat-icon stat-icon--income">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ formatCurrency(monthlyIncome) }}</span>
              <span class="stat-label">Aylık Gelir</span>
            </div>
            <div class="stat-sub">
              <span v-if="yearlySummary">{{ yearlySummary.averagePricePerKg.toFixed(2) }} TL/kg ort.</span>
              <span v-else>Bu ay alınan ödemeler</span>
            </div>
          </div>

          <div class="stat-card" role="link" tabindex="0" @click="router.push('/payments')" @keydown.enter="router.push('/payments')">
            <div class="stat-icon stat-icon--pending">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ pendingPayments.length }}</span>
              <span class="stat-label">Bekleyen Ödeme</span>
            </div>
            <div class="stat-sub">
              {{ formatCurrency(pendingPayments.reduce((s, p) => s + p.totalPrice, 0)) }} bekliyor
            </div>
          </div>
        </section>

        <!-- Çaykur Durumu -->
        <section class="caykur-status">
          <div class="caykur-status-head">
            <h3>Çaykur Durumu</h3>
            <span class="caykur-status-sub">Güncel kontenjan ve randevu bilgileriniz</span>
          </div>
          <div class="caykur-status-grid">
            <div class="caykur-tile">
              <span class="caykur-tile-label">Toplam Arazi</span>
              <span class="caykur-tile-value">{{ totalArea.toFixed(1) }}<small> dekar</small></span>
            </div>
            <div class="caykur-tile">
              <span class="caykur-tile-label">Güncel Kontenjan</span>
              <span class="caykur-tile-value">{{ caykurQuota }}<small> kg/dekar</small></span>
            </div>
            <div class="caykur-tile caykur-tile--accent">
              <span class="caykur-tile-label">Haftalık Satış Hakkı</span>
              <span class="caykur-tile-value">{{ formatKg(weeklyCapacityKg) }}<small> kg</small></span>
            </div>
            <div class="caykur-tile">
              <span class="caykur-tile-label">Randevu Günleri</span>
              <span class="caykur-tile-value caykur-tile-value--days">{{ appointmentDays.join(', ') }}</span>
            </div>
          </div>
          <p class="caykur-status-note">
            {{ totalArea.toFixed(1) }} dekar × {{ caykurQuota }} kg kontenjan × {{ appointmentDays.length }} randevu günü =
            haftalık <strong>{{ formatKg(weeklyCapacityKg) }} kg</strong> satış hakkı.
          </p>
        </section>

        <!-- Quick Links -->
        <section class="quick-links">
          <RouterLink to="/tea/settings" class="quick-link-card">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span>Ayarlar</span>
          </RouterLink>
          <RouterLink to="/tea/fields" class="quick-link-card">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span>Arazilerim</span>
          </RouterLink>
        </section>
      </div>
    </div>
  </TeaBusinessLayout>
</template>

<style scoped>
.dashboard-page {
  min-height: 100vh;
  background: var(--color-bg-primary);
}

.dashboard-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-6) var(--space-12);
}

/* ── Weather ── */
.daily-info-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 0.9fr);
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.time-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 100%;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
}

.time-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-3);
}

.time-eyebrow {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--space-1);
}

.time-card h2 {
  font-size: 42px;
  line-height: 1;
  color: var(--color-text-primary);
  font-weight: var(--font-weight-bold);
}

.time-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--color-warning);
  background: rgba(245, 158, 11, 0.12);
  border-radius: var(--radius-lg);
}

.time-date {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  text-transform: capitalize;
  margin-bottom: var(--space-5);
}

.prayer-countdown {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.prayer-label {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.prayer-countdown strong {
  color: var(--color-text-primary);
  font-size: var(--font-size-xl);
  line-height: 1.15;
}

.prayer-note {
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

/* ── Prayer schedule (all daily times) ── */
.prayer-times {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.prayer-time {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: var(--space-2);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.prayer-time--next {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
}

.prayer-time-label {
  font-size: 11px;
  color: var(--color-text-muted);
  font-weight: var(--font-weight-medium);
}

.prayer-time--next .prayer-time-label {
  color: var(--color-primary);
}

.prayer-time-value {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

/* ── Çaykur Durumu ── */
.caykur-status {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
}

.caykur-status-head {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.caykur-status-head h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0;
}

.caykur-status-sub {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.caykur-status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.caykur-tile {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.caykur-tile--accent {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
}

.caykur-tile-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-weight: var(--font-weight-medium);
}

.caykur-tile-value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  line-height: 1.1;
}

.caykur-tile--accent .caykur-tile-value {
  color: var(--color-primary);
}

.caykur-tile-value small {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

.caykur-tile-value--days {
  font-size: var(--font-size-base);
}

.caykur-status-note {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  margin: 0;
}

.caykur-status-note strong {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-bold);
}

/* ── Greeting ── */
.greeting-section {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-6);
  margin-bottom: var(--space-8);
}

.greeting-text h1 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-1);
}

.greeting-text p {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.greeting-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.user-type-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.greeting-actions {
  display: flex;
  gap: var(--space-3);
  flex-shrink: 0;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  transition: all var(--transition-fast);
}

.action-btn--primary {
  background: var(--color-primary);
  color: var(--color-text-inverse);
}

.action-btn--primary:hover {
  background: var(--color-primary-hover);
}

.action-btn--secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.action-btn--secondary:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-strong);
}

/* ── Stats Grid ── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.stat-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.stat-card:hover {
  background: var(--color-card-bg-hover);
  border-color: var(--color-card-border-hover);
}

.stat-card:hover::before {
  opacity: 1;
}

.stat-card:nth-child(1)::before { background: var(--color-primary); }
.stat-card:nth-child(2)::before { background: var(--color-secondary); }
.stat-card:nth-child(3)::before { background: var(--color-success); }
.stat-card:nth-child(4)::before { background: var(--color-warning); }

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-3);
}

.stat-icon--fields {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.stat-icon--harvests {
  background: rgba(99, 102, 241, 0.12);
  color: var(--color-secondary);
}

.stat-icon--income {
  background: rgba(34, 197, 94, 0.12);
  color: var(--color-success);
}

.stat-icon--pending {
  background: rgba(245, 158, 11, 0.12);
  color: var(--color-warning);
}

.stat-info {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.stat-value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  line-height: 1;
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.stat-sub {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* ── Charts ── */
.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.chart-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-5);
}

.chart-header h3 {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.chart-year {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  background: var(--color-bg-tertiary);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 140px;
}

.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  position: relative;
}

.bar-col:hover .bar-tooltip {
  opacity: 1;
  transform: translateX(-50%) translateY(-4px);
}

.bar-tooltip {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  font-size: 10px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  opacity: 0;
  transition: all var(--transition-fast);
  pointer-events: none;
  z-index: 2;
}

.bar-track {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 2px;
}

.bar-fill {
  width: 100%;
  max-width: 32px;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  min-height: 2px;
  transition: height 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.bar-fill--income {
  background: var(--color-primary);
}

.bar-fill--harvest {
  background: var(--color-secondary);
}

.bar-label {
  font-size: 10px;
  color: var(--color-text-muted);
  margin-top: var(--space-1);
  text-transform: capitalize;
}

/* ── Content Grid ── */
.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.content-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
}

.content-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.content-card-header h3 {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.view-all {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  text-decoration: none;
  font-weight: var(--font-weight-medium);
  transition: color var(--transition-fast);
}

.view-all:hover {
  color: var(--color-primary-hover);
}

/* ── Activity List ── */
.activity-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.activity-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-divider);
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.activity-dot--harvest { background: var(--color-secondary); }
.activity-dot--success { background: var(--color-success); }
.activity-dot--pending { background: var(--color-warning); }

.activity-info {
  flex: 1;
  min-width: 0;
}

.activity-title {
  display: block;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.activity-value {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  white-space: nowrap;
}

.activity-badge {
  font-size: 11px;
  font-weight: var(--font-weight-medium);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.badge--success {
  background: rgba(34, 197, 94, 0.12);
  color: var(--color-success);
}

.badge--warning {
  background: rgba(245, 158, 11, 0.12);
  color: var(--color-warning);
}

/* ── Field Performance ── */
.field-perf-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.field-perf-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-perf-info {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.field-perf-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.field-perf-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.field-perf-bar-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.field-perf-bar {
  flex: 1;
  height: 6px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.field-perf-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));
  border-radius: var(--radius-full);
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.field-perf-score {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  min-width: 24px;
  text-align: right;
}

/* ── Empty State ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8) var(--space-4);
  gap: var(--space-3);
}

.empty-state p {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.empty-action {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  text-decoration: none;
  font-weight: var(--font-weight-medium);
}

.empty-action:hover {
  text-decoration: underline;
}

/* ── Quick Links ── */
.quick-links {
  display: flex;
  gap: var(--space-3);
}

.quick-link-card {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: all var(--transition-fast);
}

.quick-link-card:hover {
  color: var(--color-text-primary);
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

/* ── Skeleton Loading ── */
.skeleton-greeting {
  margin-bottom: var(--space-8);
}

.skeleton-line {
  background: linear-gradient(90deg, var(--color-bg-secondary) 25%, var(--color-bg-tertiary) 50%, var(--color-bg-secondary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
}

.skeleton-lg { width: 280px; height: 32px; }
.skeleton-md { width: 160px; height: 20px; }
.skeleton-sm { width: 200px; height: 16px; }

.skeleton-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
}

.skeleton-circle {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-lg);
  background: linear-gradient(90deg, var(--color-bg-tertiary) 25%, var(--color-border) 50%, var(--color-bg-tertiary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Responsive ── */
@media (max-width: 1024px) {
  .daily-info-grid {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .dashboard-content {
    padding: var(--space-4);
  }

  .greeting-section {
    flex-direction: column;
    gap: var(--space-4);
  }

  .greeting-actions {
    width: 100%;
  }

  .greeting-actions .action-btn {
    flex: 1;
    justify-content: center;
  }

  .stats-grid {
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .stat-card {
    padding: var(--space-4);
  }

  .stat-value {
    font-size: var(--font-size-xl);
  }

  .charts-row {
    grid-template-columns: 1fr;
  }

  .quick-links {
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .greeting-text h1 {
    font-size: var(--font-size-xl);
  }

  .time-card h2 {
    font-size: 34px;
  }
}
</style>
