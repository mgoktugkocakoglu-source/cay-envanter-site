<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppLayout from '@/layouts/AppLayout.vue';
import ListingCard, { type JobListing } from '@/components/job-listings/ListingCard.vue';
import { api } from '@/services/api';

const router = useRouter();

// ── REAL DATA FEED ──
const listings = ref<JobListing[]>([]);
const isLoading = ref(true);

// ── FILTERING STATE ──
type TabType = 'workers' | 'jobs';
type CategoryType = 'all' | 'tea-picking' | 'tea-transport' | 'daily-jobs';

const activeTab = ref<TabType>('workers');
const activeCategory = ref<CategoryType>('all');
const searchQuery = ref('');

const fetchListings = async () => {
    isLoading.value = true;
    try {
        const response = await api.getJobListings({
            type: activeTab.value === 'workers' ? 'worker' : 'job',
            ...(activeCategory.value !== 'all' ? { category: activeCategory.value } : {}),
            ...(searchQuery.value.trim() ? { search: searchQuery.value } : {})
        });
        
        if (response.data) {
            // Map backend data to frontend model with fallbacks for UI elements
            listings.value = response.data.map(item => ({
                id: item.id,
                type: item.type,
                category: item.category,
                authorName: item.author.fullName,
                authorAvatar: item.author.avatarUrl || `https://ui-avatars.com/api/?name=${item.author.fullName}`,
                location: `${item.author.province} / ${item.author.district}`,
                rating: 0, // Fallback, could be calculated in backend
                commentCount: 0,
                ...item.metadata
            }));
        }
    } catch (error) {
        console.error('Failed to fetch job listings:', error);
    } finally {
        isLoading.value = false;
    }
};

onMounted(() => {
    fetchListings();
});

// Watch for filter changes and re-fetch (debouncing might be better for search)
let searchTimeout: ReturnType<typeof setTimeout> | undefined;
watch([activeTab, activeCategory], () => fetchListings());
watch(searchQuery, () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => fetchListings(), 400);
});
</script>

<template>
  <AppLayout>
    <div class="job-listings-page">
      <header class="page-header">
        <div class="header-content">
          <h1 class="page-title">
            <span class="title-icon">💼</span>
            İş / İşçi Bul
          </h1>
          <p class="page-subtitle">İlan oluşturarak iş veya işçi bulun</p>
        </div>
      </header>

      <section class="action-cards">
        <button class="action-card action-card-worker" @click="router.push('/job-listings/worker/create')">
          <div class="action-card-icon">👷</div>
          <div class="action-card-body">
            <h2 class="action-card-title">İşçi İlanı Oluştur</h2>
            <p class="action-card-desc">İş arıyorsanız, kendinizi tanıtın ve iş bulun</p>
          </div>
          <svg class="action-card-arrow" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        <button class="action-card action-card-job" @click="router.push('/job-listings/job/create')">
          <div class="action-card-icon">🌿</div>
          <div class="action-card-body">
            <h2 class="action-card-title">İş İlanı Oluştur</h2>
            <p class="action-card-desc">İşçi arıyorsanız, aradığınız kriterlerde ilan yayınlayın</p>
          </div>
          <svg class="action-card-arrow" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </section>

      <!-- ── FILTERS ── -->
      <section class="filters-section">
        <!-- Main Tabs -->
        <div class="filter-tabs">
          <button 
            type="button" 
            class="filter-tab" 
            :class="{ active: activeTab === 'workers' }"
            @click="activeTab = 'workers'"
          >
            👷 İş Arayanlar (İşçiler)
          </button>
          <button 
            type="button" 
            class="filter-tab" 
            :class="{ active: activeTab === 'jobs' }"
            @click="activeTab = 'jobs'"
          >
            🌿 İşçi Arayanlar (İşverenler)
          </button>
        </div>

        <!-- Layout for search and categories -->
        <div class="filter-controls">
          <div class="search-box">
            <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" v-model="searchQuery" placeholder="İsim veya Konum ara..." class="search-input" />
          </div>

          <div class="category-pills">
            <button 
              class="pill" 
              :class="{ active: activeCategory === 'all' }"
              @click="activeCategory = 'all'"
            >
              Tümü
            </button>
            <button 
              class="pill" 
              :class="{ active: activeCategory === 'tea-picking' }"
              @click="activeCategory = 'tea-picking'"
            >
              🍃 Çay Toplama
            </button>
            <button 
              class="pill" 
              :class="{ active: activeCategory === 'tea-transport' }"
              @click="activeCategory = 'tea-transport'"
            >
              🚛 Taşıma/Satma
            </button>
            <button 
              class="pill" 
              :class="{ active: activeCategory === 'daily-jobs' }"
              @click="activeCategory = 'daily-jobs'"
            >
              🔨 Günlük İşler
            </button>
          </div>
        </div>
      </section>

      <!-- ── LISTINGS FEED ── -->
      <section class="listings-feed">
        <div v-if="isLoading" class="feed-empty">
          <div class="feed-empty-icon">⏳</div>
          <h3>Yükleniyor...</h3>
          <p>İlanlar getiriliyor, lütfen bekleyin.</p>
        </div>

        <div v-else-if="listings.length === 0" class="feed-empty">
          <div class="feed-empty-icon">📋</div>
          <h3>Listelenecek İlan Bulunamadı</h3>
          <p>Seçtiğiniz filtrelere uygun ilan bulunmuyor.</p>
        </div>
        
        <div v-else class="listings-grid">
          <ListingCard 
            v-for="listing in listings" 
            :key="listing.id" 
            :listing="listing" 
          />
        </div>
      </section>

    </div>
  </AppLayout>
</template>

<style scoped>
.job-listings-page {
  max-width: 900px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4) var(--space-8);
}

.page-header {
  margin-bottom: var(--space-6);
  text-align: center;
}

.page-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.title-icon { font-size: 32px; }

.page-subtitle {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
}

/* ── Action Cards ── */
.action-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

.action-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  cursor: pointer;
  transition: all var(--transition-normal);
  text-align: left;
}

.action-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.action-card-worker:hover { border-color: var(--color-primary); background: linear-gradient(135deg, var(--color-bg-secondary) 0%, rgba(16, 185, 129, 0.05) 100%); }
.action-card-job:hover { border-color: var(--color-info); background: linear-gradient(135deg, var(--color-bg-secondary) 0%, rgba(59, 130, 246, 0.05) 100%); }

.action-card-icon {
  font-size: 32px;
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-lg);
}

.action-card-body {
  flex: 1;
  min-width: 0;
}

.action-card-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: 2px;
}

.action-card-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-normal);
}

.action-card-arrow {
  color: var(--color-text-muted);
  flex-shrink: 0;
  transition: transform var(--transition-fast);
}

.action-card:hover .action-card-arrow {
  transform: translateX(4px);
  color: var(--color-text-secondary);
}

/* ── Filters ── */
.filters-section {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
  margin-bottom: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.filter-tabs {
  display: flex;
  background: var(--color-bg-tertiary);
  padding: 4px;
  border-radius: var(--radius-lg);
}

.filter-tab {
  flex: 1;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.filter-tab.active {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
  box-shadow: var(--shadow-sm);
}

.filter-controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  align-items: center;
  justify-content: space-between;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 200px;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
}

.search-input {
  width: 100%;
  padding: 10px 14px 10px 40px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-lg);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.category-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pill {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.pill:hover {
  border-color: var(--color-text-muted);
}

.pill.active {
  background: var(--color-text-primary);
  color: var(--color-bg-primary);
  border-color: var(--color-text-primary);
}


/* ── Listings Feed ── */
.listings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: var(--space-6);
  justify-items: center;
}

.feed-empty {
  text-align: center;
  padding: var(--space-12) var(--space-6);
  background: var(--color-bg-secondary);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-xl);
}

.feed-empty-icon {
  font-size: 48px;
  margin-bottom: var(--space-4);
}

.feed-empty h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-2);
}

.feed-empty p {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

@media (max-width: 768px) {
  .action-cards {
    grid-template-columns: 1fr;
  }
  
  .filter-controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .action-card {
    padding: var(--space-4);
  }

  .action-card-icon {
    width: 48px;
    height: 48px;
    font-size: 28px;
  }
  
  .listings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
