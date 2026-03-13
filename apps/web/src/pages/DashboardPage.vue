<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useFieldsStore } from '@/stores/fieldsStore';
import { useHarvestsStore } from '@/stores/harvestsStore';
import { usePaymentsStore } from '@/stores/paymentsStore';
import { useWeather } from '@/composables/useWeather';
import { api, type YearlySummary, type MonthlyData, type FieldProfitability } from '@/services/api';
import AppLayout from '@/layouts/AppLayout.vue';
import WeatherWidget from '@/components/ui/WeatherWidget.vue';

const authStore = useAuthStore();
const fieldsStore = useFieldsStore();
const harvestsStore = useHarvestsStore();
const paymentsStore = usePaymentsStore();
const router = useRouter();

const isLoading = ref(true);
const yearlySummary = ref<YearlySummary | null>(null);
const monthlyData = ref<MonthlyData[]>([]);
const fieldProfitability = ref<FieldProfitability[]>([]);

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

const { currentWeather, hourlyForecast, alerts: weatherAlerts, isLoading: weatherLoading, error: weatherError, lastUpdated: weatherLastUpdated, fetchWeather } = useWeather(weatherLat, weatherLon);

const greetingText = computed(() => {
  const hour = new Date().getHours();
  if (hour < 6) return 'Iyi geceler';
  if (hour < 12) return 'Gunaydin';
  if (hour < 18) return 'Iyi gunler';
  return 'Iyi aksamlar';
});

const firstName = computed(() => {
  if (!authStore.user?.fullName) return '';
  return authStore.user.fullName.split(' ')[0];
});

const userTypeLabel = computed(() => {
  const typeMap: Record<string, string> = {
    land_owner: 'Arazi Sahibi',
    worker: 'Cay Iscisi',
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

const recentHarvests = computed(() => {
  return [...harvestsStore.harvests]
    .sort((a, b) => new Date(b.harvestDate).getTime() - new Date(a.harvestDate).getTime())
    .slice(0, 5);
});

const recentPayments = computed(() => {
  return [...paymentsStore.payments]
    .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
    .slice(0, 5);
});

const maxMonthlyIncome = computed(() => {
  if (!monthlyData.value.length) return 1;
  return Math.max(...monthlyData.value.map(m => m.income), 1);
});

const maxMonthlyHarvest = computed(() => {
  if (!monthlyData.value.length) return 1;
  return Math.max(...monthlyData.value.map(m => m.harvestKg), 1);
});



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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
  });
}

function getQualityLabel(quality: string | null): string {
  switch (quality) {
    case 'shoot': return 'Surus';
    case 'leaf': return 'Yaprak';
    case 'mixed': return 'Karisik';
    default: return '-';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'received': return 'Alindi';
    case 'pending': return 'Bekliyor';
    default: return status;
  }
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
      api.getMonthlyIncome(currentYear).then(r => {
        if (r.data) monthlyData.value = r.data;
      }),
      api.getFieldProfitability(currentYear).then(r => {
        if (r.data) fieldProfitability.value = r.data;
      }),
    ]);
  } catch (e) {
    console.error('Dashboard load error:', e);
  } finally {
    isLoading.value = false;
  }
}

onMounted(loadDashboardData);
</script>

<template>
  <AppLayout>
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
              <p>{{ currentYear }} sezon ozetiniz</p>
            </div>
          </div>
          <div class="greeting-actions">
            <!-- Arazi Sahibi icin -->
            <template v-if="authStore.user?.userType === 'land_owner'">
              <RouterLink to="/fields" class="action-btn action-btn--primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                Arazilerim
              </RouterLink>
              <RouterLink to="/forum" class="action-btn action-btn--secondary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Isci Ara
              </RouterLink>
            </template>
            <!-- Cay Iscisi icin -->
            <template v-else-if="authStore.user?.userType === 'worker'">
              <RouterLink to="/forum" class="action-btn action-btn--primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                Is Ara
              </RouterLink>
              <RouterLink to="/fields" class="action-btn action-btn--secondary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                Calistigim Araziler
              </RouterLink>
            </template>
            <!-- Kendi Isleyen icin (varsayilan) -->
            <template v-else>
              <RouterLink to="/fields/create" class="action-btn action-btn--primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Tarla Ekle
              </RouterLink>
              <RouterLink to="/harvests" class="action-btn action-btn--secondary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                Hasat Kaydet
              </RouterLink>
            </template>
          </div>
        </header>

        <!-- Weather Widget -->
        <section class="weather-section">
          <WeatherWidget
            :current="currentWeather"
            :hourly="hourlyForecast"
            :alerts="weatherAlerts"
            :is-loading="weatherLoading"
            :error="weatherError"
            :last-updated="weatherLastUpdated"
            :location-name="weatherLocationName"
            @retry="fetchWeather"
          />
        </section>

        <!-- Stats Cards -->
        <section class="stats-grid">
          <div class="stat-card" @click="router.push('/fields')">
            <div class="stat-icon stat-icon--fields">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ fieldsStore.fieldCount }}</span>
              <span class="stat-label">Tarla</span>
            </div>
            <div class="stat-sub">{{ totalArea.toFixed(1) }} dekar toplam alan</div>
          </div>

          <div class="stat-card" @click="router.push('/harvests')">
            <div class="stat-icon stat-icon--harvests">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ formatKg(harvestsStore.totalHarvestKg) }}</span>
              <span class="stat-label">kg Hasat</span>
            </div>
            <div class="stat-sub">{{ harvestsStore.harvestCount }} hasat kaydi</div>
          </div>

          <div class="stat-card" @click="router.push('/payments')">
            <div class="stat-icon stat-icon--income">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ formatCurrency(paymentsStore.totalIncome) }}</span>
              <span class="stat-label">Toplam Gelir</span>
            </div>
            <div class="stat-sub">
              <span v-if="yearlySummary">{{ yearlySummary.averagePricePerKg.toFixed(2) }} TL/kg ort.</span>
              <span v-else>-</span>
            </div>
          </div>

          <div class="stat-card" @click="router.push('/payments')">
            <div class="stat-icon stat-icon--pending">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ pendingPayments.length }}</span>
              <span class="stat-label">Bekleyen Odeme</span>
            </div>
            <div class="stat-sub">
              {{ formatCurrency(pendingPayments.reduce((s, p) => s + p.totalPrice, 0)) }} bekliyor
            </div>
          </div>
        </section>

        <!-- Charts Row -->
        <section class="charts-row" v-if="monthlyData.length">
          <!-- Monthly Income Chart -->
          <div class="chart-card">
            <div class="chart-header">
              <h3>Aylik Gelir</h3>
              <span class="chart-year">{{ currentYear }}</span>
            </div>
            <div class="bar-chart">
              <div
                v-for="month in monthlyData"
                :key="month.month"
                class="bar-col"
              >
                <div class="bar-tooltip">{{ formatCurrency(month.income) }}</div>
                <div class="bar-track">
                  <div
                    class="bar-fill bar-fill--income"
                    :style="{ height: (month.income / maxMonthlyIncome * 100) + '%' }"
                  ></div>
                </div>
                <span class="bar-label">{{ month.monthName.slice(0, 3) }}</span>
              </div>
            </div>
          </div>

          <!-- Monthly Harvest Chart -->
          <div class="chart-card">
            <div class="chart-header">
              <h3>Aylik Hasat (kg)</h3>
              <span class="chart-year">{{ currentYear }}</span>
            </div>
            <div class="bar-chart">
              <div
                v-for="month in monthlyData"
                :key="month.month"
                class="bar-col"
              >
                <div class="bar-tooltip">{{ formatKg(month.harvestKg) }} kg</div>
                <div class="bar-track">
                  <div
                    class="bar-fill bar-fill--harvest"
                    :style="{ height: (month.harvestKg / maxMonthlyHarvest * 100) + '%' }"
                  ></div>
                </div>
                <span class="bar-label">{{ month.monthName.slice(0, 3) }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Content Grid -->
        <section class="content-grid">
          <!-- Recent Harvests -->
          <div class="content-card">
            <div class="content-card-header">
              <h3>Son Hasatlar</h3>
              <RouterLink to="/harvests" class="view-all">
                Tumunu Gor
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </RouterLink>
            </div>
            <div v-if="recentHarvests.length" class="activity-list">
              <div
                v-for="harvest in recentHarvests"
                :key="harvest.id"
                class="activity-item"
              >
                <div class="activity-dot activity-dot--harvest"></div>
                <div class="activity-info">
                  <span class="activity-title">{{ harvest.fieldName || 'Tarla' }}</span>
                  <span class="activity-meta">{{ formatDate(harvest.harvestDate) }} &middot; {{ getQualityLabel(harvest.quality) }}</span>
                </div>
                <div class="activity-value">{{ harvest.amountKg }} kg</div>
              </div>
            </div>
            <div v-else class="empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              <p>Henuz hasat kaydi yok</p>
              <RouterLink to="/harvests" class="empty-action">Hasat Kaydet</RouterLink>
            </div>
          </div>

          <!-- Recent Payments -->
          <div class="content-card">
            <div class="content-card-header">
              <h3>Son Odemeler</h3>
              <RouterLink to="/payments" class="view-all">
                Tumunu Gor
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </RouterLink>
            </div>
            <div v-if="recentPayments.length" class="activity-list">
              <div
                v-for="payment in recentPayments"
                :key="payment.id"
                class="activity-item"
              >
                <div class="activity-dot" :class="payment.paymentStatus === 'received' ? 'activity-dot--success' : 'activity-dot--pending'"></div>
                <div class="activity-info">
                  <span class="activity-title">{{ formatCurrency(payment.totalPrice) }}</span>
                  <span class="activity-meta">{{ formatDate(payment.paymentDate) }} &middot; {{ payment.totalAmountKg }} kg</span>
                </div>
                <div class="activity-badge" :class="payment.paymentStatus === 'received' ? 'badge--success' : 'badge--warning'">
                  {{ getStatusLabel(payment.paymentStatus) }}
                </div>
              </div>
            </div>
            <div v-else class="empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              <p>Henuz odeme kaydi yok</p>
              <RouterLink to="/payments" class="empty-action">Odeme Ekle</RouterLink>
            </div>
          </div>

          <!-- Top Performing Field -->
          <div class="content-card">
            <div class="content-card-header">
              <h3>Tarla Performansi</h3>
              <RouterLink to="/fields" class="view-all">
                Tumunu Gor
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </RouterLink>
            </div>
            <div v-if="fieldProfitability.length" class="field-perf-list">
              <div
                v-for="field in fieldProfitability.slice(0, 4)"
                :key="field.fieldId"
                class="field-perf-item"
              >
                <div class="field-perf-info">
                  <span class="field-perf-name">{{ field.fieldName }}</span>
                  <span class="field-perf-meta">{{ field.area }} {{ field.areaUnit }} &middot; {{ formatKg(field.totalHarvestKg) }} kg</span>
                </div>
                <div class="field-perf-bar-wrap">
                  <div class="field-perf-bar">
                    <div
                      class="field-perf-bar-fill"
                      :style="{ width: Math.min(field.performanceScore, 100) + '%' }"
                    ></div>
                  </div>
                  <span class="field-perf-score">{{ field.performanceScore.toFixed(0) }}</span>
                </div>
              </div>
            </div>
            <div v-else class="empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <p>Henuz tarla kaydi yok</p>
              <RouterLink to="/fields/create" class="empty-action">Tarla Ekle</RouterLink>
            </div>
          </div>
        </section>

        <!-- Quick Links -->
        <section class="quick-links">
          <RouterLink to="/community" class="quick-link-card">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>Topluluk</span>
          </RouterLink>
          <RouterLink to="/settings" class="quick-link-card">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span>Ayarlar</span>
          </RouterLink>
          <RouterLink to="/fields" class="quick-link-card">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span>Tarlalarim</span>
          </RouterLink>
        </section>
      </div>
    </div>
  </AppLayout>
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
.weather-section {
  margin-bottom: var(--space-6);
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
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.action-btn--secondary {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.action-btn--secondary:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-text-muted);
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
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: transparent;
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
  background: rgba(16, 185, 129, 0.12);
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
  font-size: var(--font-size-sm);
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
  background: linear-gradient(180deg, var(--color-primary), rgba(16, 185, 129, 0.4));
}

.bar-fill--harvest {
  background: linear-gradient(180deg, var(--color-secondary), rgba(99, 102, 241, 0.4));
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
  border-bottom: 1px solid rgba(51, 65, 85, 0.4);
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
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .content-grid {
    grid-template-columns: 1fr 1fr;
  }

  .content-grid > :last-child {
    grid-column: 1 / -1;
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

  .content-grid {
    grid-template-columns: 1fr;
  }

  .content-grid > :last-child {
    grid-column: auto;
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
}
</style>
