<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useFocusTrap } from '@/composables/useFocusTrap';
import { useRoute, RouterLink } from 'vue-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useFirmsStore } from '@/stores/firmsStore';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/composables/useToast';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import AppEmptyState from '@/components/ui/AppEmptyState.vue';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';
import { paymentTermLabel, paymentTermIcon, getFirmLogo, getFirmInitials, MONTH_NAMES_TR } from '@/utils/tariff';
import type { PaymentTerm } from '@/services/api';

const route = useRoute();
const firmsStore = useFirmsStore();
const authStore = useAuthStore();
const toast = useToast();

const activeTab = ref<'tariffs' | 'locations'>('locations');
const provinceFilter = ref('');
const districtFilter = ref('');

const firmId = computed(() => route.params.id as string);

const DEFAULT_QUOTA_PER_DEKAR = 30;
const APPOINTMENT_DAY_LABELS: Record<string, string> = {
    monday: 'Pazartesi', tuesday: 'Salı', wednesday: 'Çarşamba', thursday: 'Perşembe',
    friday: 'Cuma', saturday: 'Cumartesi', sunday: 'Pazar',
};

const isCaykurFirm = computed(() => firmsStore.currentFirm?.isCaykur ?? false);
const caykurQuota = computed(() => authStore.user?.quotaPerDekarKg ?? DEFAULT_QUOTA_PER_DEKAR);
const appointmentDays = computed(() =>
    (authStore.user?.appointmentDays ?? ['wednesday', 'saturday']).map(d => APPOINTMENT_DAY_LABELS[d] ?? d),
);

const monthOptions = MONTH_NAMES_TR.map((name, i) => ({ value: i + 1, label: name }));

// Month-aware payment-term label for tariff cards/split rows.
function tariffLabel(t: { paymentTerm: PaymentTerm; paymentMonth?: number | null; customPaymentDate?: string | null }): string {
    return paymentTermLabel(t);
}

// ─── Tariff Modal State ───
const showTariffModal = ref(false);
const tariffModalRef = ref<HTMLElement | null>(null);
watch(showTariffModal, (v) => { if (v) nextTick(() => tariffModalRef.value?.focus()); });
useFocusTrap(showTariffModal, tariffModalRef);
type PaymentTermType = 'cash' | 'weekly' | 'monthly';
const termOptions: PaymentTermType[] = ['cash', 'weekly', 'monthly'];
const tariffForm = ref({
    paymentTerm: 'cash' as PaymentTermType,
    pricePerKg: null as number | null,
    paymentMonth: 7,
    effectiveDate: new Date().toISOString().split('T')[0],
    endDate: '',
    isSplitPayment: false,
    splits: [] as Array<{
        percentage: number | null;
        paymentTerm: PaymentTermType;
        paymentMonth: number;
        pricePerKg: number | null;
    }>,
});
const isSavingTariff = ref(false);
const showDeleteTariffConfirm = ref(false);
const deleteTariffTargetId = ref('');

// ─── Collection Point Modal State ───
const showCPModal = ref(false);
const cpModalRef = ref<HTMLElement | null>(null);
watch(showCPModal, (v) => { if (v) nextTick(() => cpModalRef.value?.focus()); });
useFocusTrap(showCPModal, cpModalRef);
const cpForm = ref({
    name: '',
    province: '',
    district: '',
    address: '',
    description: '',
    latitude: null as number | null,
    longitude: null as number | null,
    collectorName: '',
    collectorPhone: '',
});
const isSavingCP = ref(false);
const showDeleteCPConfirm = ref(false);
const deleteCPTargetId = ref('');

// ─── Map Refs ───
const mapInstances = ref<Record<string, unknown>>({});

const provinceFilterOptions = computed(() => [
    { value: '', label: 'Tüm İller' },
    { value: 'Rize', label: 'Rize' },
    { value: 'Trabzon', label: 'Trabzon' },
    { value: 'Artvin', label: 'Artvin' },
    { value: 'Giresun', label: 'Giresun' },
    { value: 'Ordu', label: 'Ordu' },
]);

const provinceFormOptions = [
    { value: '', label: 'İl Seçiniz' },
    { value: 'Rize', label: 'Rize' },
    { value: 'Trabzon', label: 'Trabzon' },
    { value: 'Artvin', label: 'Artvin' },
    { value: 'Giresun', label: 'Giresun' },
    { value: 'Ordu', label: 'Ordu' },
];

const districtOptions = computed(() => {
    const districts = new Set<string>();
    firmsStore.collectionPoints.forEach(p => {
        if (!provinceFilter.value || p.province === provinceFilter.value) {
            districts.add(p.district);
        }
    });
    return [
        { value: '', label: 'Tüm İlçeler' },
        ...Array.from(districts).sort().map(d => ({ value: d, label: d })),
    ];
});

const filteredCollectionPoints = computed(() => {
    return firmsStore.collectionPoints.filter(p => {
        if (provinceFilter.value && p.province !== provinceFilter.value) return false;
        if (districtFilter.value && p.district !== districtFilter.value) return false;
        return true;
    });
});

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

function formatPrice(price: number) {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(price);
}

function onProvinceChange() {
    districtFilter.value = '';
}

async function loadFirmData() {
    await firmsStore.fetchFirm(firmId.value);
    await Promise.all([
        firmsStore.fetchCurrentTariffs(firmId.value),
        firmsStore.fetchCollectionPoints(firmId.value),
    ]);
}

// ─── Tariff Actions ───
function openTariffModal() {
    tariffForm.value = {
        paymentTerm: 'cash',
        pricePerKg: null,
        paymentMonth: 7,
        effectiveDate: new Date().toISOString().split('T')[0],
        endDate: '',
        isSplitPayment: false,
        splits: [],
    };
    showTariffModal.value = true;
}

function toggleSplitPayment() {
    tariffForm.value.isSplitPayment = !tariffForm.value.isSplitPayment;
    if (tariffForm.value.isSplitPayment && tariffForm.value.splits.length === 0) {
        tariffForm.value.splits = [
            { percentage: 50, paymentTerm: 'cash', paymentMonth: 7, pricePerKg: null },
            { percentage: 50, paymentTerm: 'monthly', paymentMonth: 10, pricePerKg: null },
        ];
    }
}

function addSplit() {
    tariffForm.value.splits.push({
        percentage: null,
        paymentTerm: 'monthly',
        paymentMonth: 10,
        pricePerKg: null,
    });
}

function removeSplit(index: number) {
    tariffForm.value.splits.splice(index, 1);
}

async function saveTariff() {
    isSavingTariff.value = true;

    if (tariffForm.value.isSplitPayment) {
        const data: Record<string, unknown> = {
            paymentTerm: tariffForm.value.splits[0]?.paymentTerm || 'cash',
            pricePerKg: tariffForm.value.splits[0]?.pricePerKg || 0,
            effectiveDate: tariffForm.value.effectiveDate,
            isSplitPayment: true,
            splitDetails: tariffForm.value.splits.map(s => ({
                percentage: s.percentage,
                paymentTerm: s.paymentTerm,
                paymentMonth: s.paymentTerm === 'monthly' ? s.paymentMonth : undefined,
                pricePerKg: s.pricePerKg,
            })),
            isActive: true,
        };
        if (tariffForm.value.endDate) data.endDate = tariffForm.value.endDate;
        const success = await firmsStore.createTariff(firmId.value, data);
        if (success) {
            toast.success('Tarife başarıyla eklendi');
            showTariffModal.value = false;
        } else {
            toast.error(firmsStore.error || 'Tarife eklenirken hata oluştu');
        }
    } else {
        if (!tariffForm.value.pricePerKg) {
            isSavingTariff.value = false;
            return;
        }
        const data: Record<string, unknown> = {
            paymentTerm: tariffForm.value.paymentTerm,
            pricePerKg: tariffForm.value.pricePerKg,
            effectiveDate: tariffForm.value.effectiveDate,
            isSplitPayment: false,
            isActive: true,
        };
        if (tariffForm.value.endDate) data.endDate = tariffForm.value.endDate;
        if (tariffForm.value.paymentTerm === 'monthly') {
            data.paymentMonth = tariffForm.value.paymentMonth;
        }
        const success = await firmsStore.createTariff(firmId.value, data);
        if (success) {
            toast.success('Tarife başarıyla eklendi');
            showTariffModal.value = false;
        } else {
            toast.error(firmsStore.error || 'Tarife eklenirken hata oluştu');
        }
    }

    isSavingTariff.value = false;
}

function confirmDeleteTariff(tariffId: string) {
    deleteTariffTargetId.value = tariffId;
    showDeleteTariffConfirm.value = true;
}

async function handleDeleteTariff() {
    const success = await firmsStore.deleteTariff(firmId.value, deleteTariffTargetId.value);
    if (success) {
        toast.success('Tarife silindi');
    } else {
        toast.error('Tarife silinirken hata oluştu');
    }
}

// ─── Collection Point Actions ───
function openCPModal() {
    cpForm.value = {
        name: '',
        province: '',
        district: '',
        address: '',
        description: '',
        latitude: null,
        longitude: null,
        collectorName: '',
        collectorPhone: '',
    };
    showCPModal.value = true;
}

async function saveCollectionPoint() {
    if (!cpForm.value.name.trim() || !cpForm.value.province || !cpForm.value.district.trim()) return;
    isSavingCP.value = true;
    const data: Record<string, unknown> = {
        name: cpForm.value.name.trim(),
        province: cpForm.value.province,
        district: cpForm.value.district.trim(),
        isActive: true,
    };
    if (cpForm.value.address.trim()) data.address = cpForm.value.address.trim();
    if (cpForm.value.description.trim()) data.description = cpForm.value.description.trim();
    if (cpForm.value.latitude) data.latitude = cpForm.value.latitude;
    if (cpForm.value.longitude) data.longitude = cpForm.value.longitude;
    if (cpForm.value.collectorName.trim()) data.collectorName = cpForm.value.collectorName.trim();
    if (cpForm.value.collectorPhone.trim()) data.collectorPhone = cpForm.value.collectorPhone.trim();

    const success = await firmsStore.createCollectionPoint(firmId.value, data);
    if (success) {
        toast.success('Toplama noktası başarıyla eklendi');
        showCPModal.value = false;
    } else {
        toast.error(firmsStore.error || 'Toplama noktası eklenirken hata oluştu');
    }
    isSavingCP.value = false;
}

function confirmDeleteCP(pointId: string) {
    deleteCPTargetId.value = pointId;
    showDeleteCPConfirm.value = true;
}

async function handleDeleteCP() {
    const success = await firmsStore.deleteCollectionPoint(firmId.value, deleteCPTargetId.value);
    if (success) {
        toast.success('Toplama noktası silindi');
    } else {
        toast.error('Toplama noktası silinirken hata oluştu');
    }
}

// ─── Satellite Map ───
async function initMap(containerId: string, lat: number, lng: number) {
    await nextTick();

    const container = document.getElementById(containerId);
    if (!container) return;

    // Destroy existing map if any
    if (mapInstances.value[containerId]) {
        (mapInstances.value[containerId] as any).remove();
    }

    const map = L.map(container, {
        attributionControl: false,
    }).setView([lat, lng], 15);

    // Satellite tile layer (Google Satellite — sharper, free, no API key)
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        maxNativeZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(map);

    // Add marker
    L.marker([lat, lng]).addTo(map);

    mapInstances.value[containerId] = map;

    // Force tile recomputation once container size is finalized
    requestAnimationFrame(() => map.invalidateSize());
}

// Watch for location tab activation to init maps
watch(activeTab, async (newTab: 'tariffs' | 'locations') => {
    if (newTab === 'locations') {
        await nextTick();
        filteredCollectionPoints.value.forEach(point => {
            if (point.latitude && point.longitude) {
                const containerId = `map-${point.id}`;
                setTimeout(() => initMap(containerId, point.latitude!, point.longitude!), 100);
            }
        });
    }
});

// Also init maps when collection points change
watch(() => filteredCollectionPoints.value, async () => {
    if (activeTab.value === 'locations') {
        await nextTick();
        filteredCollectionPoints.value.forEach(point => {
            if (point.latitude && point.longitude) {
                const containerId = `map-${point.id}`;
                setTimeout(() => initMap(containerId, point.latitude!, point.longitude!), 100);
            }
        });
    }
}, { deep: true });

onMounted(loadFirmData);
</script>

<template>
    <TeaBusinessLayout>
        <div class="firm-detail-page">
            <!-- Loading -->
            <div v-if="firmsStore.isLoading && !firmsStore.currentFirm" class="loading">
                <div class="spinner"></div>
            </div>

            <template v-else-if="firmsStore.currentFirm">
                <!-- Breadcrumb -->
                <nav class="breadcrumb">
                    <RouterLink to="/tea/firms" class="breadcrumb-link">Firmalar</RouterLink>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                    <span class="breadcrumb-current">{{ firmsStore.currentFirm.name }}</span>
                </nav>

                <!-- Firm Header -->
                <header class="firm-header">
                    <div class="firm-header-left">
                        <div class="firm-logo-panel" :class="{ 'firm-logo-panel--inactive': !firmsStore.currentFirm.isActive }">
                            <img
                                v-if="getFirmLogo(firmsStore.currentFirm)"
                                :src="getFirmLogo(firmsStore.currentFirm) || ''"
                                :alt="`${firmsStore.currentFirm.name} logosu`"
                                class="firm-logo-img"
                            />
                            <div v-else class="firm-avatar-lg">
                                {{ getFirmInitials(firmsStore.currentFirm.name) }}
                            </div>
                        </div>
                        <div class="firm-header-info">
                            <div class="firm-title-row">
                                <h1>{{ firmsStore.currentFirm.name }}</h1>
                                <span class="status-badge" :class="firmsStore.currentFirm.isActive ? 'status-active' : 'status-inactive'">
                                    {{ firmsStore.currentFirm.isActive ? 'Aktif' : 'Pasif' }}
                                </span>
                            </div>
                            <p v-if="firmsStore.currentFirm.description" class="firm-description">
                                {{ firmsStore.currentFirm.description }}
                            </p>
                            <div class="firm-contact-row">
                                <span v-if="firmsStore.currentFirm.phone" class="contact-item">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                    {{ firmsStore.currentFirm.phone }}
                                </span>
                                <span v-if="firmsStore.currentFirm.email" class="contact-item">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                    {{ firmsStore.currentFirm.email }}
                                </span>
                                <span v-if="firmsStore.currentFirm.address" class="contact-item">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                    {{ firmsStore.currentFirm.address }}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="firm-metrics">
                        <div class="metric-card">
                            <span class="metric-value">{{ firmsStore.currentTariffs.length }}</span>
                            <span class="metric-label">Aktif tarife</span>
                        </div>
                        <div class="metric-card">
                            <span class="metric-value">{{ firmsStore.collectionPoints.length }}</span>
                            <span class="metric-label">Toplama noktası</span>
                        </div>
                    </div>
                </header>

                <!-- Çaykur Kontenjan Panel (fixed price + quota instead of tariffs) -->
                <section v-if="isCaykurFirm" class="kontenjan-panel">
                    <div class="kontenjan-head">
                        <h2>Kontenjan ve Alım Bilgileri</h2>
                        <p>Çaykur sabit fiyatla alım yapar; tarife yerine dekar başına kontenjan uygulanır.</p>
                    </div>
                    <div class="kontenjan-grid">
                        <div class="kontenjan-stat">
                            <span class="kontenjan-label">Güncel Kontenjan</span>
                            <span class="kontenjan-value">{{ caykurQuota }} kg<small>/dekar</small></span>
                        </div>
                        <div class="kontenjan-stat">
                            <span class="kontenjan-label">Randevu Günleri</span>
                            <span class="kontenjan-value kontenjan-value--sm">{{ appointmentDays.join(', ') }}</span>
                        </div>
                        <div class="kontenjan-stat">
                            <span class="kontenjan-label">Yaş Çay Brüt Fiyatı</span>
                            <span class="kontenjan-value">₺35,00<small>/kg</small></span>
                        </div>
                    </div>
                    <div class="kontenjan-note">
                        <strong>Brüt → Net:</strong> 35,00 ₺ brüt fiyatın 34,23 ₺'si net olarak aylık ödenir, kalan 0,77 ₺ ise
                        bir sonraki yılın Nisan–Mayıs döneminde destekleme olarak ödenir. (100 kg yaş çay → 3.423 ₺ aylık + 77 ₺ destekleme.)
                    </div>
                </section>

                <!-- Tabs -->
                <div class="tabs app-tabs">
                    <button
                        v-if="authStore.isAdmin"
                        class="tab-btn app-tab-btn"
                        :class="{ 'tab-btn--active app-tab-btn--active': activeTab === 'tariffs' }"
                        @click="activeTab = 'tariffs'"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        Yaş Çay Alım Tarifeleri
                        <span class="tab-count">{{ firmsStore.currentTariffs.length }}</span>
                    </button>
                    <button
                        class="tab-btn app-tab-btn"
                        :class="{ 'tab-btn--active app-tab-btn--active': activeTab === 'locations' }"
                        @click="activeTab = 'locations'"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        Çay Toplayıcı Konumları
                        <span class="tab-count">{{ firmsStore.collectionPoints.length }}</span>
                    </button>
                </div>

                <!-- ─── Tariffs Tab (Admin Only) ─── -->
                <div v-if="activeTab === 'tariffs' && authStore.isAdmin" class="tab-content">
                    <!-- Add Tariff Button (Admin Only) -->
                    <div v-if="authStore.isAdmin" class="tab-actions">
                        <button class="btn-add" @click="openTariffModal">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Tarife Ekle
                        </button>
                    </div>

                    <AppEmptyState
                        v-if="firmsStore.currentTariffs.length === 0"
                        icon="payment"
                        title="Guncel tarife bulunamadi"
                        description="Bu firmanin aktif tarifeleri henuz belirlenmemis."
                    />

                    <div v-else class="tariffs-grid">
                        <div
                            v-for="tariff in firmsStore.currentTariffs"
                            :key="tariff.id"
                            class="tariff-card"
                        >
                            <!-- Admin Delete Button -->
                            <button v-if="authStore.isAdmin" class="tariff-delete-btn" aria-label="Tarifeyi sil" @click.stop="confirmDeleteTariff(tariff.id)" title="Tarifeyi sil">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>

                            <!-- Simple Tariff -->
                            <template v-if="!tariff.isSplitPayment">
                                <div class="tariff-header">
                                    <span class="tariff-term-icon">{{ paymentTermIcon(tariff.paymentTerm) }}</span>
                                    <span class="tariff-term">{{ tariffLabel(tariff) }}</span>
                                </div>
                                <div class="tariff-price">
                                    {{ formatPrice(tariff.pricePerKg) }}
                                    <span class="tariff-unit">/kg</span>
                                    <span v-if="!isCaykurFirm" class="tariff-gross">Brüt</span>
                                </div>
                                <div class="tariff-dates">
                                    <span>{{ formatDate(tariff.effectiveDate) }}</span>
                                    <span v-if="tariff.endDate"> - {{ formatDate(tariff.endDate) }}</span>
                                    <span v-else class="tariff-ongoing"> (Devam ediyor)</span>
                                </div>
                            </template>

                            <!-- Split Payment Tariff -->
                            <template v-else>
                                <div class="tariff-header">
                                    <span class="tariff-term-icon">🔀</span>
                                    <span class="tariff-term">Paylaşımlı Ödeme</span>
                                </div>
                                <div v-if="tariff.splitDetails" class="split-details">
                                    <div v-for="(split, si) in tariff.splitDetails" :key="si" class="split-row">
                                        <span class="split-percent">%{{ split.percentage }}</span>
                                        <span class="split-term">{{ tariffLabel(split) }}</span>
                                        <span class="split-price">{{ formatPrice(split.pricePerKg) }}/kg</span>
                                    </div>
                                </div>
                                <div class="tariff-dates">
                                    <span>{{ formatDate(tariff.effectiveDate) }}</span>
                                    <span v-if="tariff.endDate"> - {{ formatDate(tariff.endDate) }}</span>
                                    <span v-else class="tariff-ongoing"> (Devam ediyor)</span>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>

                <!-- ─── Locations Tab ─── -->
                <div v-if="activeTab === 'locations'" class="tab-content">
                    <!-- Add Collection Point Button + Filters -->
                    <div class="location-header">
                        <div class="location-filters">
                            <AppSelect
                                v-model="provinceFilter"
                                :options="provinceFilterOptions"
                                placeholder="İl Seçin"
                                @update:model-value="onProvinceChange"
                            />
                            <AppSelect
                                v-model="districtFilter"
                                :options="districtOptions"
                                placeholder="İlçe Seçin"
                            />
                            <span class="filter-count">{{ filteredCollectionPoints.length }} nokta</span>
                        </div>
                        <button v-if="authStore.isAdmin" class="btn-add" @click="openCPModal">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Konum Ekle
                        </button>
                    </div>

                    <AppEmptyState
                        v-if="filteredCollectionPoints.length === 0"
                        icon="firm"
                        title="Toplama noktası bulunamadı"
                        :description="provinceFilter || districtFilter ? 'Filtre kriterlerinize uygun sonuç yok. Filtreleri temizleyin.' : 'Bu firmanın henüz kayıtlı toplama noktası yok.'"
                    />

                    <!-- Collection Points List -->
                    <div v-else class="collection-points-list">
                        <div
                            v-for="point in filteredCollectionPoints"
                            :key="point.id"
                            class="cp-card"
                        >
                            <div class="cp-card-header">
                                <div class="cp-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                </div>
                                <div class="cp-info">
                                    <h4 class="cp-name">{{ point.name }}</h4>
                                    <span class="cp-location">{{ point.province }} / {{ point.district }}</span>
                                </div>
                                <button v-if="authStore.isAdmin" class="btn-icon-delete" aria-label="Sil" @click="confirmDeleteCP(point.id)" title="Sil">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                            </div>

                            <!-- Description -->
                            <div v-if="point.description" class="cp-description">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                <span>{{ point.description }}</span>
                            </div>

                            <!-- Satellite Map -->
                            <div v-if="point.latitude && point.longitude" class="cp-map-container">
                                <div :id="`map-${point.id}`" class="cp-map"></div>
                            </div>

                            <div class="cp-card-body">
                                <div v-if="point.address" class="cp-detail">
                                    <span class="cp-label">Adres</span>
                                    <span class="cp-value">{{ point.address }}</span>
                                </div>
                                <div v-if="point.collectorName" class="cp-detail">
                                    <span class="cp-label">Toplayıcı</span>
                                    <span class="cp-value">{{ point.collectorName }}</span>
                                </div>
                                <div v-if="point.collectorPhone" class="cp-detail">
                                    <span class="cp-label">Telefon</span>
                                    <span class="cp-value">{{ point.collectorPhone }}</span>
                                </div>
                                <div v-if="point.latitude && point.longitude" class="cp-detail">
                                    <span class="cp-label">Koordinat</span>
                                    <span class="cp-value">{{ point.latitude }}, {{ point.longitude }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </template>

            <!-- Error -->
            <div v-else-if="firmsStore.error" class="error-state">
                <p class="error-message">{{ firmsStore.error }}</p>
                <RouterLink to="/tea/firms" class="back-link">Firmalara Dön</RouterLink>
            </div>

            <!-- ═══ Add Tariff Modal ═══ -->
            <div v-if="showTariffModal" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="tariff-modal-title" @click.self="showTariffModal = false" @keydown.esc="showTariffModal = false">
                <div class="modal-content" ref="tariffModalRef" tabindex="-1">
                    <div class="modal-header-row">
                        <h2 id="tariff-modal-title">Yeni Tarife Ekle</h2>
                        <button class="modal-close" aria-label="Kapat" @click="showTariffModal = false">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                    <p class="modal-subtitle">{{ firmsStore.currentFirm?.name }} icin yeni satis tarifesi ekleyin.</p>

                    <form @submit.prevent="saveTariff" class="modal-form">
                        <!-- Split Payment Toggle -->
                        <div class="split-toggle-row">
                            <label class="split-toggle-label">
                                <input type="checkbox" :checked="tariffForm.isSplitPayment" @change="toggleSplitPayment" />
                                <span>Paylaşımlı ödeme (Örneğin: %50 peşin, %50 vadeli)</span>
                            </label>
                        </div>

                        <!-- Simple Tariff -->
                        <template v-if="!tariffForm.isSplitPayment">
                            <div class="form-group">
                                <label class="form-label">Ödeme Şekli <span class="required">*</span></label>
                                <div class="payment-term-options">
                                    <button
                                        v-for="term in termOptions"
                                        :key="term"
                                        type="button"
                                        class="term-btn"
                                        :class="{ 'term-btn--active': tariffForm.paymentTerm === term }"
                                        @click="tariffForm.paymentTerm = term"
                                    >
                                        {{ tariffLabel({ paymentTerm: term }) }}
                                    </button>
                                </div>
                            </div>

                            <div v-if="tariffForm.paymentTerm === 'monthly'" class="form-group">
                                <label class="form-label">Ödeme Ayı <span class="required">*</span></label>
                                <select v-model.number="tariffForm.paymentMonth" class="form-input">
                                    <option v-for="m in monthOptions" :key="m.value" :value="m.value">{{ m.label }} Ayı Ödeme</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Fiyat (TL/kg, Brüt) <span class="required">*</span></label>
                                <input
                                    type="number"
                                    v-model.number="tariffForm.pricePerKg"
                                    min="0.01"
                                    step="0.01"
                                    placeholder="Örneğin: 35"
                                    class="form-input"
                                    required
                                />
                            </div>
                        </template>

                        <!-- Split Payment -->
                        <template v-else>
                            <div v-for="(split, sIndex) in tariffForm.splits" :key="sIndex" class="split-entry">
                                <div class="split-entry-header">
                                    <span class="split-badge">Kisim {{ sIndex + 1 }}</span>
                                    <button v-if="tariffForm.splits.length > 2" type="button" class="btn-icon-sm" aria-label="Kaldır" @click="removeSplit(sIndex)">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    </button>
                                </div>
                                <div class="form-row form-row--3">
                                    <div class="form-group">
                                        <label class="form-label">Yuzde (%)</label>
                                        <input type="number" v-model.number="split.percentage" min="1" max="100" placeholder="50" class="form-input" />
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Ödeme Şekli</label>
                                        <select v-model="split.paymentTerm" class="form-input">
                                            <option value="cash">Peşin Ödeme</option>
                                            <option value="weekly">Haftalık Ödeme</option>
                                            <option value="monthly">Aylık Ödeme</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Fiyat (TL/kg)</label>
                                        <input type="number" v-model.number="split.pricePerKg" min="0.01" step="0.01" placeholder="20" class="form-input" />
                                    </div>
                                </div>
                                <div v-if="split.paymentTerm === 'monthly'" class="form-group">
                                    <label class="form-label">Ödeme Ayı</label>
                                    <select v-model.number="split.paymentMonth" class="form-input">
                                        <option v-for="m in monthOptions" :key="m.value" :value="m.value">{{ m.label }} Ayı Ödeme</option>
                                    </select>
                                </div>
                            </div>

                            <button type="button" class="btn-add-split" @click="addSplit">
                                + Kisim Ekle
                            </button>
                        </template>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Gecerlilik Baslangici <span class="required">*</span></label>
                                <input type="date" v-model="tariffForm.effectiveDate" class="form-input" required />
                            </div>
                            <div class="form-group">
                                <label class="form-label">Bitis Tarihi</label>
                                <input type="date" v-model="tariffForm.endDate" class="form-input" :min="tariffForm.effectiveDate" />
                                <span class="form-hint">Bos birakirsaniz "Devam ediyor" olarak kabul edilir</span>
                            </div>
                        </div>

                        <div class="modal-actions">
                            <button type="button" class="btn-secondary" @click="showTariffModal = false">İptal</button>
                            <button type="submit" class="btn-primary" :disabled="isSavingTariff">
                                {{ isSavingTariff ? 'Kaydediliyor...' : 'Tarife Ekle' }}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- ═══ Add Collection Point Modal ═══ -->
            <div v-if="showCPModal" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cp-modal-title" @click.self="showCPModal = false" @keydown.esc="showCPModal = false">
                <div class="modal-content" ref="cpModalRef" tabindex="-1">
                    <div class="modal-header-row">
                        <h2 id="cp-modal-title">Konum Ekle</h2>
                        <button class="modal-close" aria-label="Kapat" @click="showCPModal = false">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                    <p class="modal-subtitle">{{ firmsStore.currentFirm?.name }} için yeni çay toplayıcı konumu ekleyin.</p>

                    <form @submit.prevent="saveCollectionPoint" class="modal-form">
                        <div class="form-group">
                            <label class="form-label">Konum Adı <span class="required">*</span></label>
                            <input type="text" v-model="cpForm.name" placeholder="Örneğin: Çayeli Merkez" class="form-input" required />
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">İl <span class="required">*</span></label>
                                <AppSelect v-model="cpForm.province" :options="provinceFormOptions" placeholder="İl seçiniz..." variant="light" />
                            </div>
                            <div class="form-group">
                                <label class="form-label">İlçe <span class="required">*</span></label>
                                <input type="text" v-model="cpForm.district" placeholder="İlçe adı" class="form-input" required />
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Açıklama</label>
                            <textarea
                                v-model="cpForm.description"
                                maxlength="1000"
                                placeholder="Örneğin: Çataldere Köyü Kuran Kursu altında bulunuyoruz"
                                rows="2"
                                class="form-input form-textarea"
                            ></textarea>
                            <span class="form-hint">Kullanıcılara konum hakkında detaylı bilgi verin</span>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Adres</label>
                            <input type="text" v-model="cpForm.address" placeholder="Açık adres" class="form-input" />
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Enlem (Latitude)</label>
                                <input type="number" v-model.number="cpForm.latitude" step="0.0000001" placeholder="41.0201" class="form-input" />
                            </div>
                            <div class="form-group">
                                <label class="form-label">Boylam (Longitude)</label>
                                <input type="number" v-model.number="cpForm.longitude" step="0.0000001" placeholder="40.5234" class="form-input" />
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Toplayıcı Adı</label>
                                <input type="text" v-model="cpForm.collectorName" placeholder="Ad Soyad" class="form-input" />
                            </div>
                            <div class="form-group">
                                <label class="form-label">Toplayıcı Telefonu</label>
                                <input type="tel" v-model="cpForm.collectorPhone" placeholder="0532 000 00 00" class="form-input" />
                            </div>
                        </div>

                        <div class="modal-actions">
                            <button type="button" class="btn-secondary" @click="showCPModal = false">İptal</button>
                            <button type="submit" class="btn-primary" :disabled="isSavingCP || !cpForm.name.trim() || !cpForm.province || !cpForm.district.trim()">
                                {{ isSavingCP ? 'Kaydediliyor...' : 'Konum Ekle' }}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Delete Tariff Confirm -->
            <ConfirmModal
                v-model="showDeleteTariffConfirm"
                title="Tarifeyi Sil"
                message="Bu tarifeyi silmek istediginize emin misiniz?"
                confirm-text="Sil"
                cancel-text="Vazgec"
                variant="danger"
                @confirm="handleDeleteTariff"
            />

            <!-- Delete Collection Point Confirm -->
            <ConfirmModal
                v-model="showDeleteCPConfirm"
                title="Konumu Sil"
                message="Bu toplama noktasını silmek istediğinize emin misiniz?"
                confirm-text="Sil"
                cancel-text="Vazgec"
                variant="danger"
                @confirm="handleDeleteCP"
            />
        </div>
    </TeaBusinessLayout>
</template>

<style scoped>
.firm-detail-page {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
}

/* ── Breadcrumb ── */
.breadcrumb { display: flex; align-items: center; gap: 8px; margin-bottom: 24px; font-size: 14px; }
.breadcrumb-link { color: var(--color-primary); text-decoration: none; font-weight: 500; }
.breadcrumb-link:hover { text-decoration: underline; }
.breadcrumb svg { color: var(--color-text-muted); }
.breadcrumb-current { color: var(--color-text-secondary); }

/* ── Firm Header ── */
.firm-header { display: flex; justify-content: space-between; gap: 24px; background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 24px; margin-bottom: 24px; }
.firm-header-left { display: flex; gap: 20px; align-items: flex-start; min-width: 0; }
.firm-logo-panel { width: 88px; height: 88px; border-radius: 20px; background: #fff; border: 1px solid var(--color-border); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
.firm-logo-panel--inactive { opacity: 0.65; }
.firm-logo-img { width: 100%; height: 100%; object-fit: contain; padding: 10px; box-sizing: border-box; }
.firm-avatar-lg { width: 100%; height: 100%; background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover)); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 26px; }
.firm-header-info { flex: 1; min-width: 0; }
.firm-title-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.firm-title-row h1 { font-size: 30px; font-weight: 800; color: var(--color-text-primary); margin: 0; }
.firm-description { font-size: 14px; color: var(--color-text-secondary); margin: 0 0 12px; line-height: 1.5; }
.firm-contact-row { display: flex; flex-wrap: wrap; gap: 16px; }
.contact-item { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-text-muted); }
.contact-item svg { flex-shrink: 0; }
.firm-metrics { display: grid; grid-template-columns: repeat(2, minmax(120px, 1fr)); gap: 12px; align-self: stretch; min-width: 260px; }
.metric-card { display: flex; flex-direction: column; justify-content: center; gap: 4px; padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-bg-primary); }
.metric-value { color: var(--color-primary); font-size: 28px; font-weight: 800; line-height: 1; }
.metric-label { color: var(--color-text-muted); font-size: 12px; font-weight: 600; }

/* ── Status Badge ── */
.status-badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: var(--radius-full); font-size: 11px; font-weight: 600; white-space: nowrap; }
.status-active { background: rgba(34, 197, 94, 0.15); color: var(--color-success); }
.status-inactive { background: rgba(245, 158, 11, 0.15); color: var(--color-warning); }

/* ── Tabs ── */
.tabs { display: flex; gap: var(--space-1); margin-bottom: 24px; background: var(--color-subtle-bg); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-1); box-shadow: var(--shadow-sm); }
.tab-btn { position: relative; display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 var(--space-5); border: 1px solid transparent; border-radius: calc(var(--radius-md) - 1px); background: transparent; color: var(--color-text-secondary); font-weight: 600; font-size: 14px; cursor: pointer; transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast); flex: 1; justify-content: center; }
.tab-btn:hover { color: var(--color-text-primary); background: var(--color-bg-secondary); border-color: var(--color-border); }
.tab-btn--active { background: var(--color-bg-secondary); border-color: var(--color-border-strong); color: var(--color-primary); box-shadow: var(--shadow-md); }
.tab-btn--active::before { content: ''; position: absolute; left: 14px; right: 14px; bottom: 5px; height: 2px; border-radius: var(--radius-full); background: var(--color-primary); }
.tab-btn--active:hover { background: var(--color-bg-secondary); color: var(--color-primary); }
.tab-count { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; padding: 0 6px; border-radius: var(--radius-full); font-size: 11px; font-weight: 700; background: rgba(255, 255, 255, 0.2); }
.tab-btn:not(.tab-btn--active) .tab-count { background: var(--color-bg-tertiary); color: var(--color-text-muted); }
.tab-btn--active .tab-count { background: var(--color-primary-light); color: var(--color-primary); }

/* ── Tab Content ── */
.tab-content { animation: fadeIn 0.2s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
.tab-actions { display: flex; justify-content: flex-end; margin-bottom: 16px; }

/* ── Btn Add ── */
.btn-add { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover)); color: white; border: none; border-radius: var(--radius-md); font-weight: 600; font-size: 14px; cursor: pointer; transition: all var(--transition-fast); white-space: nowrap; flex-shrink: 0; }
.btn-add:hover { opacity: 0.9; box-shadow: var(--shadow-md); }

/* ── Tariffs Grid ── */
.tariffs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.tariff-card { background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 24px; text-align: center; transition: all var(--transition-fast); position: relative; }
.tariff-card:hover { border-color: var(--color-primary); box-shadow: var(--shadow-md); }
.tariff-delete-btn { position: absolute; top: 12px; right: 12px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px solid transparent; border-radius: var(--radius-sm); color: var(--color-text-muted); cursor: pointer; transition: all var(--transition-fast); opacity: 0; }
.tariff-card:hover .tariff-delete-btn { opacity: 1; }
.tariff-delete-btn:hover { color: var(--color-danger); background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); }

.tariff-header { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 12px; }
.tariff-term-icon { font-size: 24px; }
.tariff-term { font-size: 16px; font-weight: 600; color: var(--color-text-primary); }
.tariff-price { font-size: 28px; font-weight: 700; color: var(--color-primary); margin-bottom: 8px; }
.tariff-unit { font-size: 14px; font-weight: 500; color: var(--color-text-muted); }
.tariff-dates { font-size: 12px; color: var(--color-text-muted); }
.tariff-ongoing { color: var(--color-success); font-weight: 500; }
.tariff-gross { font-size: 12px; font-weight: 600; color: var(--color-text-muted); margin-left: 6px; }

/* ── Çaykur Kontenjan Panel ── */
.kontenjan-panel { background: var(--color-bg-secondary); border: 1px solid var(--color-primary); border-radius: var(--radius-xl); padding: 24px; margin-bottom: 24px; }
.kontenjan-head h2 { font-size: 18px; font-weight: 700; color: var(--color-text-primary); margin: 0 0 4px; }
.kontenjan-head p { font-size: 13px; color: var(--color-text-muted); margin: 0 0 16px; }
.kontenjan-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }
.kontenjan-stat { display: flex; flex-direction: column; gap: 4px; padding: 16px; background: var(--color-bg-primary); border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
.kontenjan-label { font-size: 12px; font-weight: 600; color: var(--color-text-muted); }
.kontenjan-value { font-size: 24px; font-weight: 800; color: var(--color-text-primary); line-height: 1.1; }
.kontenjan-value small { font-size: 13px; font-weight: 600; color: var(--color-text-muted); margin-left: 2px; }
.kontenjan-value--sm { font-size: 16px; font-weight: 700; }
.kontenjan-note { font-size: 13px; line-height: 1.6; color: var(--color-text-secondary); background: var(--color-primary-light); border-radius: var(--radius-md); padding: 12px 14px; }
.kontenjan-note strong { color: var(--color-primary); }

/* ── Split Details ── */
.split-details { margin-bottom: 12px; }
.split-row { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 6px 0; font-size: 14px; flex-wrap: wrap; }
.split-row + .split-row { border-top: 1px solid var(--color-border); }
.split-percent { font-weight: 700; color: var(--color-primary); background: var(--color-primary-light); padding: 2px 8px; border-radius: var(--radius-sm); font-size: 13px; }
.split-term { color: var(--color-text-secondary); font-weight: 500; }
.split-deferred { color: var(--color-text-muted); font-size: 12px; }
.split-price { font-weight: 700; color: var(--color-text-primary); }

/* ── Location Header ── */
.location-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
.location-filters { display: flex; gap: 16px; align-items: center; flex: 1; }
.location-filters :deep(.app-select-wrapper) { min-width: 160px; }
.filter-count { font-size: 13px; color: var(--color-text-muted); font-weight: 500; white-space: nowrap; }

/* ── Collection Points ── */
.collection-points-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 16px; }
.cp-card { background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-xl); overflow: hidden; transition: all var(--transition-fast); }
.cp-card:hover { border-color: var(--color-primary); box-shadow: var(--shadow-md); }
.cp-card-header { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--color-border); }
.cp-icon { width: 36px; height: 36px; border-radius: var(--radius-md); background: var(--color-primary-light); color: var(--color-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.cp-info { flex: 1; min-width: 0; }
.cp-name { font-size: 15px; font-weight: 600; color: var(--color-text-primary); margin: 0; }
.cp-location { font-size: 12px; color: var(--color-text-muted); font-weight: 500; }

/* ── Description ── */
.cp-description { display: flex; align-items: flex-start; gap: 8px; padding: 12px 20px; background: var(--color-primary-light); font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; }
.cp-description svg { flex-shrink: 0; color: var(--color-primary); margin-top: 1px; }

/* ── Satellite Map ── */
.cp-map-container { padding: 0; }
.cp-map { width: 100%; height: 200px; }

.cp-card-body { padding: 12px 20px 16px; }
.cp-detail { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; }
.cp-detail + .cp-detail { border-top: 1px solid var(--color-border); }
.cp-label { font-size: 13px; color: var(--color-text-muted); font-weight: 500; }
.cp-value { font-size: 13px; color: var(--color-text-primary); font-weight: 500; text-align: right; }

/* ── Delete Button ── */
.btn-icon-delete { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: transparent; border: 1px solid transparent; border-radius: var(--radius-sm); color: var(--color-text-muted); cursor: pointer; transition: all var(--transition-fast); flex-shrink: 0; }
.btn-icon-delete:hover { color: var(--color-danger); background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); }

/* ── Modal ── */
.modal-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 24px; }
.modal-content { background: var(--color-bg-secondary); border-radius: var(--radius-xl); padding: 28px; max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto; border: 1px solid var(--color-border); box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2); }
.modal-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.modal-header-row h2 { font-size: 20px; font-weight: 700; color: var(--color-text-primary); margin: 0; }
.modal-close { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: var(--color-bg-tertiary); border: 1px solid var(--color-border); border-radius: var(--radius-sm); color: var(--color-text-secondary); cursor: pointer; transition: all var(--transition-fast); }
.modal-close:hover { color: var(--color-danger); background: rgba(239, 68, 68, 0.1); border-color: var(--color-danger); }
.modal-subtitle { color: var(--color-text-muted); font-size: 14px; margin: 0 0 24px 0; }
.modal-form { display: flex; flex-direction: column; gap: 16px; }
.modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; padding-top: 16px; border-top: 1px solid var(--color-border); }

/* ── Form ── */
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 13px; font-weight: 600; color: var(--color-text-secondary); }
.required { color: var(--color-danger); }
.form-input { width: 100%; height: var(--control-height); padding: 0 14px; background: var(--color-bg-elevated, var(--color-bg-secondary)); border: 2px solid var(--color-border); border-radius: var(--radius-md); font-size: 14px; color: var(--color-text-primary); transition: border-color var(--transition-fast); font-family: inherit; box-sizing: border-box; }
.form-input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-light); }
.form-input::placeholder { color: var(--color-text-muted); }
.form-textarea { resize: vertical; min-height: 60px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-row--3 { grid-template-columns: 1fr 1fr 1fr; }
.form-hint { font-size: 12px; color: var(--color-text-muted); margin-top: 2px; }

/* ── Payment Term Buttons ── */
.payment-term-options { display: flex; gap: 8px; flex-wrap: wrap; }
.term-btn { padding: 8px 16px; border: 2px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-primary); color: var(--color-text-secondary); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.term-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.term-btn--active { border-color: var(--color-primary); background: var(--color-primary); color: white; }

/* ── Split ── */
.split-toggle-row { margin-bottom: 4px; }
.split-toggle-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text-secondary); cursor: pointer; }
.split-toggle-label input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: var(--color-primary); }
.split-entry { background: var(--color-bg-tertiary); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 12px; margin-bottom: 8px; }
.split-entry-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.split-badge { font-size: 11px; font-weight: 700; color: var(--color-primary); background: var(--color-primary-light); padding: 2px 8px; border-radius: var(--radius-sm); }
.btn-icon-sm { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; transition: all 0.2s; border-radius: var(--radius-sm); }
.btn-icon-sm:hover { color: var(--color-danger); background: rgba(239, 68, 68, 0.1); }
.btn-add-split { width: 100%; padding: 8px; background: transparent; border: 1px dashed var(--color-border); border-radius: var(--radius-md); color: var(--color-text-muted); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
.btn-add-split:hover { border-color: var(--color-primary); color: var(--color-primary); }

/* ── Buttons ── */
.btn-primary { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%); color: white; border: none; padding: 10px 24px; border-radius: var(--radius-md); font-weight: 600; font-size: 14px; cursor: pointer; transition: all var(--transition-fast); }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary { display: inline-flex; align-items: center; gap: 8px; background: var(--color-bg-tertiary); color: var(--color-text-secondary); border: 1px solid var(--color-border); padding: 10px 24px; border-radius: var(--radius-md); font-weight: 600; font-size: 14px; cursor: pointer; transition: all var(--transition-fast); }
.btn-secondary:hover { background: var(--color-bg-secondary); border-color: var(--color-text-muted); }

/* ── Loading & Empty & Error ── */
.loading { text-align: center; padding: 60px; }
.spinner { width: 40px; height: 40px; border: 3px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto; }
@keyframes spin { to { transform: rotate(360deg); } }
.empty-state { text-align: center; padding: 48px 24px; background: var(--color-bg-tertiary); border-radius: var(--radius-xl); }
.empty-state h3 { color: var(--color-text-primary); margin: 16px 0 8px; font-size: 16px; }
.empty-state p { color: var(--color-text-muted); font-size: 14px; margin: 0; }
.error-state { text-align: center; padding: 60px; }
.error-message { background: rgba(239, 68, 68, 0.1); color: var(--color-danger); padding: 12px; border-radius: 8px; font-size: 14px; display: inline-block; }
.back-link { display: inline-block; margin-top: 16px; color: var(--color-primary); text-decoration: none; font-weight: 600; }
.back-link:hover { text-decoration: underline; }

/* ── Responsive ── */
@media (max-width: 768px) {
    .firm-detail-page { padding: 16px; }
    .firm-header { flex-direction: column; }
    .firm-header-left { flex-direction: column; align-items: center; text-align: center; }
    .firm-metrics { grid-template-columns: 1fr 1fr; min-width: 0; }
    .firm-title-row { flex-direction: column; gap: 8px; }
    .firm-title-row h1 { font-size: 20px; }
    .firm-contact-row { justify-content: center; }
    .tabs { flex-direction: column; }
    .tariffs-grid { grid-template-columns: 1fr; }
    .location-header { flex-direction: column; }
    .location-filters { flex-direction: column; align-items: stretch; }
    .collection-points-list { grid-template-columns: 1fr; }
    .form-row, .form-row--3 { grid-template-columns: 1fr; }
    .modal-actions { flex-direction: column-reverse; }
    .modal-actions .btn-primary, .modal-actions .btn-secondary { width: 100%; justify-content: center; }
    .tariff-delete-btn { opacity: 1; }
    .payment-term-options { flex-direction: column; }
    .term-btn { text-align: center; }
    .split-row { flex-direction: column; gap: 4px; }
}
</style>
