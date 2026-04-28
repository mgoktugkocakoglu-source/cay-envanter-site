<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useFirmsStore } from '@/stores/firmsStore';
import { useAuthStore } from '@/stores/authStore';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';

const firmsStore = useFirmsStore();
const authStore = useAuthStore();
const router = useRouter();
const searchQuery = ref('');

// ─── Wizard State ───
const showWizard = ref(false);
const wizardStep = ref(1); // 1: Firma Adi, 2: Tarifeler, 3: Konumlar
const isSaving = ref(false);
const formError = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const createdFirmId = ref<string | null>(null);

// Step 1: Firma Bilgileri
const firmForm = ref({
    name: '',
    description: '',
    phone: '',
    email: '',
    address: '',
});

// Step 2: Tarifeler
type PaymentTermType = 'cash' | 'weekly' | 'monthly' | 'custom';
interface TariffEntry {
    paymentTerm: PaymentTermType;
    pricePerKg: number | null;
    customPaymentDate: string;
    isSplitPayment: boolean;
    splits: Array<{
        percentage: number | null;
        paymentTerm: PaymentTermType;
        deferredMonths: number | null;
        pricePerKg: number | null;
    }>;
}

const tariffs = ref<TariffEntry[]>([]);

function addTariff() {
    tariffs.value.push({
        paymentTerm: 'cash',
        pricePerKg: null,
        customPaymentDate: '',
        isSplitPayment: false,
        splits: [],
    });
}

function removeTariff(index: number) {
    tariffs.value.splice(index, 1);
}

function toggleSplitPayment(index: number) {
    const t = tariffs.value[index];
    t.isSplitPayment = !t.isSplitPayment;
    if (t.isSplitPayment && t.splits.length === 0) {
        t.splits = [
            { percentage: 50, paymentTerm: 'cash', deferredMonths: null, pricePerKg: null },
            { percentage: 50, paymentTerm: 'monthly', deferredMonths: 2, pricePerKg: null },
        ];
    }
}

function addSplit(tariffIndex: number) {
    tariffs.value[tariffIndex].splits.push({
        percentage: null,
        paymentTerm: 'monthly',
        deferredMonths: 1,
        pricePerKg: null,
    });
}

function removeSplit(tariffIndex: number, splitIndex: number) {
    tariffs.value[tariffIndex].splits.splice(splitIndex, 1);
}

// Step 3: Konumlar
interface LocationEntry {
    name: string;
    province: string;
    district: string;
    address: string;
    description: string;
    latitude: number | null;
    longitude: number | null;
    collectorName: string;
    collectorPhone: string;
}

const locations = ref<LocationEntry[]>([]);

function addLocation() {
    locations.value.push({
        name: '',
        province: '',
        district: '',
        address: '',
        description: '',
        latitude: null,
        longitude: null,
        collectorName: '',
        collectorPhone: '',
    });
}

function removeLocation(index: number) {
    locations.value.splice(index, 1);
}

// ─── Computed ───
const filteredFirms = computed(() => {
    if (!searchQuery.value) return firmsStore.firms;
    const q = searchQuery.value.toLowerCase();
    return firmsStore.firms.filter(f =>
        f.name.toLowerCase().includes(q) ||
        (f.description && f.description.toLowerCase().includes(q))
    );
});

const paymentTermLabels: Record<string, string> = {
    'cash': 'Pesin',
    'weekly': 'Haftalik',
    'monthly': 'Aylik',
    'custom': 'Ozel Tarih',
};

const canProceedStep1 = computed(() => firmForm.value.name.trim().length > 0);
const canProceedStep2 = computed(() => {
    if (tariffs.value.length === 0) return true; // Optional
    return tariffs.value.every(t => {
        if (t.isSplitPayment) {
            return t.splits.every(s => s.pricePerKg && s.pricePerKg > 0 && s.percentage && s.percentage > 0);
        }
        return t.pricePerKg && t.pricePerKg > 0;
    });
});

// ─── Actions ───
function navigateToFirm(id: string) {
    router.push(`/firms/${id}`);
}

function getInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function openWizard() {
    firmForm.value = { name: '', description: '', phone: '', email: '', address: '' };
    tariffs.value = [];
    locations.value = [];
    wizardStep.value = 1;
    formError.value = null;
    createdFirmId.value = null;
    showWizard.value = true;
}

function closeWizard() {
    showWizard.value = false;
    formError.value = null;
}

async function handleStep1Next() {
    if (!canProceedStep1.value) {
        formError.value = 'Firma adi zorunludur';
        return;
    }

    isSaving.value = true;
    formError.value = null;

    const data: Record<string, unknown> = {
        name: firmForm.value.name.trim(),
        isActive: true,
    };
    if (firmForm.value.description.trim()) data.description = firmForm.value.description.trim();
    if (firmForm.value.phone.trim()) data.phone = firmForm.value.phone.trim();
    if (firmForm.value.email.trim()) data.email = firmForm.value.email.trim();
    if (firmForm.value.address.trim()) data.address = firmForm.value.address.trim();

    const success = await firmsStore.createFirm(data);

    if (success) {
        // Get the created firm's ID
        const createdFirm = firmsStore.firms.find(f => f.name === firmForm.value.name.trim());
        if (createdFirm) {
            createdFirmId.value = createdFirm.id;
        }
        wizardStep.value = 2;
        addTariff(); // Start with one empty tariff
    } else {
        formError.value = firmsStore.error || 'Firma olusturulamadi';
    }
    isSaving.value = false;
}

async function handleStep2Next() {
    if (!createdFirmId.value) return;

    isSaving.value = true;
    formError.value = null;

    const today = new Date().toISOString().split('T')[0];

    for (const t of tariffs.value) {
        if (t.isSplitPayment) {
            const tariffData: Record<string, unknown> = {
                paymentTerm: t.splits[0]?.paymentTerm || 'cash',
                pricePerKg: t.splits[0]?.pricePerKg || 0,
                effectiveDate: today,
                isSplitPayment: true,
                splitDetails: t.splits.map(s => ({
                    percentage: s.percentage,
                    paymentTerm: s.paymentTerm,
                    deferredMonths: s.deferredMonths || undefined,
                    pricePerKg: s.pricePerKg,
                })),
            };
            await firmsStore.createTariff(createdFirmId.value, tariffData);
        } else if (t.pricePerKg && t.pricePerKg > 0) {
            const tariffData: Record<string, unknown> = {
                paymentTerm: t.paymentTerm,
                pricePerKg: t.pricePerKg,
                effectiveDate: today,
                isSplitPayment: false,
            };
            if (t.paymentTerm === 'custom' && t.customPaymentDate) {
                tariffData.customPaymentDate = t.customPaymentDate;
            }
            await firmsStore.createTariff(createdFirmId.value, tariffData);
        }
    }

    wizardStep.value = 3;
    addLocation(); // Start with one empty location
    isSaving.value = false;
}

async function handleStep3Finish() {
    if (!createdFirmId.value) return;

    isSaving.value = true;
    formError.value = null;

    for (const loc of locations.value) {
        if (!loc.name.trim() || !loc.province || !loc.district.trim()) continue;

        const data: Record<string, unknown> = {
            name: loc.name.trim(),
            province: loc.province,
            district: loc.district.trim(),
            isActive: true,
        };
        if (loc.address.trim()) data.address = loc.address.trim();
        if (loc.description.trim()) data.description = loc.description.trim();
        if (loc.latitude) data.latitude = loc.latitude;
        if (loc.longitude) data.longitude = loc.longitude;
        if (loc.collectorName.trim()) data.collectorName = loc.collectorName.trim();
        if (loc.collectorPhone.trim()) data.collectorPhone = loc.collectorPhone.trim();

        await firmsStore.createCollectionPoint(createdFirmId.value, data);
    }

    closeWizard();
    successMessage.value = 'Firma basariyla eklendi';
    setTimeout(() => { successMessage.value = null; }, 3000);
    await firmsStore.fetchFirms();
    isSaving.value = false;
}

function skipAndFinish() {
    closeWizard();
    successMessage.value = 'Firma basariyla eklendi';
    setTimeout(() => { successMessage.value = null; }, 3000);
}

const provinceOptions = [
    { value: 'Rize', label: 'Rize' },
    { value: 'Trabzon', label: 'Trabzon' },
    { value: 'Artvin', label: 'Artvin' },
    { value: 'Giresun', label: 'Giresun' },
    { value: 'Ordu', label: 'Ordu' },
];

onMounted(() => {
    firmsStore.fetchFirms();
});
</script>

<template>
    <TeaBusinessLayout>
        <div class="firms-page">
            <!-- Toast -->
            <Transition name="toast">
                <div v-if="successMessage" class="toast-success">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {{ successMessage }}
                </div>
            </Transition>

            <header class="page-header">
                <div class="header-content">
                    <h1>Firmalar</h1>
                    <p class="subtitle">
                        Anlasmali {{ firmsStore.firmCount }} firma
                    </p>
                </div>
                <button v-if="authStore.isAdmin" class="btn-add" @click="openWizard">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Firma Ekle
                </button>
            </header>

            <!-- Search -->
            <div class="search-wrap">
                <div class="search-box">
                    <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Firma ara..."
                        class="search-input"
                    />
                </div>
            </div>

            <!-- Loading -->
            <div v-if="firmsStore.isLoading && !showWizard" class="loading">
                <div class="spinner"></div>
            </div>

            <!-- Empty -->
            <div v-else-if="filteredFirms.length === 0" class="empty-state">
                <div class="empty-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-text-muted)">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                </div>
                <h3>Henuz firma kaydedilmemis</h3>
                <p>Anlasmali firmalar burada listelenecektir</p>
                <button v-if="authStore.isAdmin" class="btn-add-empty" @click="openWizard">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Ilk Firmayi Ekle
                </button>
            </div>

            <!-- Firms Grid -->
            <div v-else class="firms-grid">
                <div
                    v-for="firm in filteredFirms"
                    :key="firm.id"
                    class="firm-card firm-card--simple"
                    @click="navigateToFirm(firm.id)"
                >
                    <div class="firm-card-top">
                        <div class="firm-logo-wrap" :class="{ 'firm-logo-wrap--inactive': !firm.isActive }">
                            <img v-if="firm.logoUrl" :src="firm.logoUrl" :alt="`${firm.name} logosu`" class="firm-logo" />
                            <div v-else class="firm-avatar-lg">
                                {{ getInitials(firm.name) }}
                            </div>
                        </div>
                        <span class="firm-status" :class="firm.isActive ? 'firm-status--active' : 'firm-status--inactive'">
                            {{ firm.isActive ? 'Aktif' : 'Pasif' }}
                        </span>
                    </div>
                    <div class="firm-card-body">
                        <h3 class="firm-name">{{ firm.name }}</h3>
                        <p class="firm-description">{{ firm.description || 'Firma detaylarini ve toplama noktalarini goruntuleyin.' }}</p>
                    </div>
                    <div class="firm-card-meta">
                        <span v-if="firm.phone" class="firm-meta-item">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            {{ firm.phone }}
                        </span>
                        <span v-if="firm.email" class="firm-meta-item">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            {{ firm.email }}
                        </span>
                    </div>
                    <span class="firm-location-hint">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        Firma detaylarini gor
                    </span>
                </div>
            </div>

            <!-- Error -->
            <p v-if="firmsStore.error && !showWizard" class="error-message">{{ firmsStore.error }}</p>

            <!-- ═══ FIRMA EKLEME WIZARD ═══ -->
            <Transition name="modal">
                <div v-if="showWizard" class="modal-overlay" @click.self="closeWizard">
                    <div class="wizard-container">
                        <!-- Wizard Header -->
                        <div class="wizard-header">
                            <h2>Yeni Firma Ekle</h2>
                            <button class="modal-close" @click="closeWizard" aria-label="Kapat">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"/>
                                    <line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                            </button>
                        </div>

                        <!-- Step Indicator -->
                        <div class="wizard-steps">
                            <div class="step" :class="{ 'step--active': wizardStep === 1, 'step--done': wizardStep > 1 }">
                                <div class="step-circle">
                                    <svg v-if="wizardStep > 1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    <span v-else>1</span>
                                </div>
                                <span class="step-label">Firma Adi</span>
                            </div>
                            <div class="step-line" :class="{ 'step-line--done': wizardStep > 1 }"></div>
                            <div class="step" :class="{ 'step--active': wizardStep === 2, 'step--done': wizardStep > 2 }">
                                <div class="step-circle">
                                    <svg v-if="wizardStep > 2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    <span v-else>2</span>
                                </div>
                                <span class="step-label">Tarifeler</span>
                            </div>
                            <div class="step-line" :class="{ 'step-line--done': wizardStep > 2 }"></div>
                            <div class="step" :class="{ 'step--active': wizardStep === 3 }">
                                <div class="step-circle">
                                    <span>3</span>
                                </div>
                                <span class="step-label">Konumlar</span>
                            </div>
                        </div>

                        <!-- Error -->
                        <div v-if="formError" class="form-error">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                            {{ formError }}
                        </div>

                        <!-- ─── Step 1: Firma Bilgileri ─── -->
                        <div v-if="wizardStep === 1" class="wizard-body">
                            <p class="wizard-desc">Firma bilgilerini girin.</p>

                            <div class="form-group">
                                <label>Firma Adi <span class="required">*</span></label>
                                <input
                                    v-model="firmForm.name"
                                    type="text"
                                    maxlength="150"
                                    placeholder="Ornegin: CAYKUR"
                                    class="form-input"
                                />
                            </div>

                            <div class="form-group">
                                <label>Aciklama</label>
                                <textarea
                                    v-model="firmForm.description"
                                    maxlength="2000"
                                    placeholder="Firma hakkinda kisa bilgi..."
                                    rows="2"
                                    class="form-input form-textarea"
                                ></textarea>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label>Telefon</label>
                                    <input v-model="firmForm.phone" type="tel" maxlength="20" placeholder="0532 000 00 00" class="form-input" />
                                </div>
                                <div class="form-group">
                                    <label>E-posta</label>
                                    <input v-model="firmForm.email" type="email" maxlength="255" placeholder="info@firma.com" class="form-input" />
                                </div>
                            </div>

                            <div class="form-group">
                                <label>Adres</label>
                                <input v-model="firmForm.address" type="text" maxlength="500" placeholder="Firma adresi" class="form-input" />
                            </div>

                            <div class="wizard-footer">
                                <button type="button" class="btn-cancel" @click="closeWizard">Iptal</button>
                                <button type="button" class="btn-next" :disabled="isSaving || !canProceedStep1" @click="handleStep1Next">
                                    <div v-if="isSaving" class="btn-spinner"></div>
                                    <template v-else>
                                        Devam Et
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                    </template>
                                </button>
                            </div>
                        </div>

                        <!-- ─── Step 2: Yas Cay Alim Tarifeleri ─── -->
                        <div v-if="wizardStep === 2" class="wizard-body">
                            <p class="wizard-desc">Yas cay alim tarifelerini ekleyin. Tarifeler daha sonra da guncellenebilir.</p>

                            <div v-for="(tariff, tIndex) in tariffs" :key="tIndex" class="tariff-entry">
                                <div class="tariff-entry-header">
                                    <h4>Tarife {{ tIndex + 1 }}</h4>
                                    <button type="button" class="btn-icon-sm" aria-label="Kaldır" @click="removeTariff(tIndex)" title="Kaldir">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    </button>
                                </div>

                                <!-- Split toggle -->
                                <div class="split-toggle-row">
                                    <label class="split-toggle-label">
                                        <input type="checkbox" :checked="tariff.isSplitPayment" @change="toggleSplitPayment(tIndex)" />
                                        <span>Paylasimli odeme</span>
                                    </label>
                                </div>

                                <!-- Simple tariff -->
                                <template v-if="!tariff.isSplitPayment">
                                    <div class="form-group">
                                        <label>Odeme Tarihi <span class="required">*</span></label>
                                        <div class="payment-term-options">
                                            <button
                                                v-for="term in (['cash', 'weekly', 'monthly', 'custom'] as PaymentTermType[])"
                                                :key="term"
                                                type="button"
                                                class="term-btn"
                                                :class="{ 'term-btn--active': tariff.paymentTerm === term }"
                                                @click="tariff.paymentTerm = term"
                                            >
                                                {{ paymentTermLabels[term] }}
                                            </button>
                                        </div>
                                    </div>

                                    <div v-if="tariff.paymentTerm === 'custom'" class="form-group">
                                        <label>Ozel Odeme Tarihi</label>
                                        <input type="date" v-model="tariff.customPaymentDate" class="form-input" />
                                    </div>

                                    <div class="form-group">
                                        <label>Fiyat (TL/kg) <span class="required">*</span></label>
                                        <input
                                            type="number"
                                            v-model.number="tariff.pricePerKg"
                                            min="0.01"
                                            step="0.01"
                                            placeholder="Ornegin: 21"
                                            class="form-input"
                                        />
                                    </div>
                                </template>

                                <!-- Split payment -->
                                <template v-else>
                                    <div v-for="(split, sIndex) in tariff.splits" :key="sIndex" class="split-entry">
                                        <div class="split-entry-header">
                                            <span class="split-badge">Kisim {{ sIndex + 1 }}</span>
                                            <button v-if="tariff.splits.length > 2" type="button" class="btn-icon-sm" aria-label="Kaldır" @click="removeSplit(tIndex, sIndex)" title="Kaldir">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                            </button>
                                        </div>

                                        <div class="form-row form-row--3">
                                            <div class="form-group">
                                                <label>Yuzde (%)</label>
                                                <input type="number" v-model.number="split.percentage" min="1" max="100" placeholder="50" class="form-input" />
                                            </div>
                                            <div class="form-group">
                                                <label>Odeme Turu</label>
                                                <select v-model="split.paymentTerm" class="form-input">
                                                    <option value="cash">Pesin</option>
                                                    <option value="weekly">Haftalik</option>
                                                    <option value="monthly">Aylik</option>
                                                    <option value="custom">Ozel</option>
                                                </select>
                                            </div>
                                            <div class="form-group">
                                                <label>Fiyat (TL/kg)</label>
                                                <input type="number" v-model.number="split.pricePerKg" min="0.01" step="0.01" placeholder="20" class="form-input" />
                                            </div>
                                        </div>

                                        <div v-if="split.paymentTerm !== 'cash'" class="form-group">
                                            <label>Kac Ay Sonra?</label>
                                            <input type="number" v-model.number="split.deferredMonths" min="1" max="24" placeholder="2" class="form-input" />
                                        </div>
                                    </div>

                                    <button type="button" class="btn-add-split" @click="addSplit(tIndex)">
                                        + Kisim Ekle
                                    </button>
                                </template>
                            </div>

                            <button type="button" class="btn-add-tariff" @click="addTariff">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                Tarife Ekle
                            </button>

                            <div class="wizard-footer">
                                <button type="button" class="btn-skip" @click="wizardStep = 3; addLocation()">Atla</button>
                                <button type="button" class="btn-next" :disabled="isSaving || !canProceedStep2" @click="handleStep2Next">
                                    <div v-if="isSaving" class="btn-spinner"></div>
                                    <template v-else>
                                        Devam Et
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                    </template>
                                </button>
                            </div>
                        </div>

                        <!-- ─── Step 3: Firma Cay Toplayici Konumlari ─── -->
                        <div v-if="wizardStep === 3" class="wizard-body">
                            <p class="wizard-desc">Cay toplayici konumlarini ekleyin. Birden fazla konum ekleyebilirsiniz.</p>

                            <div v-for="(loc, lIndex) in locations" :key="lIndex" class="location-entry">
                                <div class="location-entry-header">
                                    <h4>Konum {{ lIndex + 1 }}</h4>
                                    <button v-if="locations.length > 1" type="button" class="btn-icon-sm" aria-label="Kaldır" @click="removeLocation(lIndex)" title="Kaldir">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    </button>
                                </div>

                                <div class="form-group">
                                    <label>Konum Adi <span class="required">*</span></label>
                                    <input v-model="loc.name" type="text" maxlength="100" placeholder="Ornegin: Cayeli Merkez" class="form-input" />
                                </div>

                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Il <span class="required">*</span></label>
                                        <select v-model="loc.province" class="form-input">
                                            <option value="">Il Seciniz</option>
                                            <option v-for="p in provinceOptions" :key="p.value" :value="p.value">{{ p.label }}</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Ilce <span class="required">*</span></label>
                                        <input v-model="loc.district" type="text" maxlength="50" placeholder="Ilce adi" class="form-input" />
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label>Aciklama</label>
                                    <textarea
                                        v-model="loc.description"
                                        maxlength="1000"
                                        placeholder="Ornegin: Cataldere Koyu Kuran Kursu Altinda bulunuyoruz"
                                        rows="2"
                                        class="form-input form-textarea"
                                    ></textarea>
                                    <span class="form-hint">Kullanicilara konum hakkinda detayli bilgi verin</span>
                                </div>

                                <div class="form-group">
                                    <label>Adres</label>
                                    <input v-model="loc.address" type="text" maxlength="500" placeholder="Acik adres" class="form-input" />
                                </div>

                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Enlem (Latitude)</label>
                                        <input v-model.number="loc.latitude" type="number" step="0.0000001" placeholder="41.0201" class="form-input" />
                                    </div>
                                    <div class="form-group">
                                        <label>Boylam (Longitude)</label>
                                        <input v-model.number="loc.longitude" type="number" step="0.0000001" placeholder="40.5234" class="form-input" />
                                    </div>
                                </div>

                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Toplayici Adi</label>
                                        <input v-model="loc.collectorName" type="text" maxlength="100" placeholder="Ad Soyad" class="form-input" />
                                    </div>
                                    <div class="form-group">
                                        <label>Toplayici Telefonu</label>
                                        <input v-model="loc.collectorPhone" type="tel" maxlength="20" placeholder="0532 000 00 00" class="form-input" />
                                    </div>
                                </div>
                            </div>

                            <button type="button" class="btn-add-tariff" @click="addLocation">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                Konum Ekle
                            </button>

                            <div class="wizard-footer">
                                <button type="button" class="btn-skip" @click="skipAndFinish">Atla ve Bitir</button>
                                <button type="button" class="btn-next btn-finish" :disabled="isSaving" @click="handleStep3Finish">
                                    <div v-if="isSaving" class="btn-spinner"></div>
                                    <template v-else>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                        Tamamla
                                    </template>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>
        </div>
    </TeaBusinessLayout>
</template>

<style scoped>
.firms-page {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
}

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
}

.header-content h1 {
    font-size: 32px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
}

.subtitle {
    color: var(--color-text-muted);
    margin: 4px 0 0 0;
}

/* ── Add Button ── */
.btn-add {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(var(--color-primary-rgb, 0, 0, 0), 0.3);
}

.btn-add:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(var(--color-primary-rgb, 0, 0, 0), 0.4);
}

.btn-add-empty {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 16px;
    padding: 10px 20px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-add-empty:hover {
    background: var(--color-primary-hover);
}

/* ── Search ── */
.search-wrap { margin-bottom: 24px; }
.search-box { position: relative; max-width: 400px; }
.search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted); pointer-events: none; }
.search-input { width: 100%; padding: 12px 12px 12px 42px; background: var(--color-bg-secondary); border: 2px solid var(--color-border); border-radius: var(--radius-lg); font-size: 14px; color: var(--color-text-primary); transition: border-color var(--transition-fast); }
.search-input:focus { outline: none; border-color: var(--color-primary); }
.search-input::placeholder { color: var(--color-text-muted); }

/* ── Grid ── */
.firms-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; }

/* ── Card (simple) ── */
.firm-card--simple {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: 18px;
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    flex-direction: column;
    align-items: stretch;
    text-align: left;
    gap: 16px;
    min-height: 220px;
}
.firm-card--simple:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-lg);
    border-color: var(--color-primary);
}
.firm-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}
.firm-logo-wrap {
    width: 76px;
    height: 76px;
    border-radius: 18px;
    background: #fff;
    border: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
}
.firm-logo-wrap--inactive {
    opacity: 0.65;
}
.firm-logo {
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: 8px;
    box-sizing: border-box;
}
.firm-avatar-lg {
    width: 100%;
    height: 100%;
    border-radius: 0;
    background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 22px;
}
.firm-status {
    display: inline-flex;
    align-items: center;
    padding: 5px 10px;
    border-radius: var(--radius-full);
    font-size: 12px;
    font-weight: 700;
}
.firm-status--active { background: rgba(34, 197, 94, 0.14); color: var(--color-success); }
.firm-status--inactive { background: rgba(245, 158, 11, 0.14); color: var(--color-warning); }
.firm-card-body { min-width: 0; }
.firm-card--simple .firm-name {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0 0 8px;
}
.firm-description {
    min-height: 40px;
    margin: 0;
    color: var(--color-text-muted);
    font-size: 13px;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.firm-card-meta {
    display: flex;
    min-height: 22px;
    flex-wrap: wrap;
    gap: 8px;
}
.firm-meta-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 100%;
    color: var(--color-text-muted);
    font-size: 12px;
}
.firm-meta-item svg {
    flex-shrink: 0;
}
.firm-location-hint {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    margin-top: auto;
    padding-top: 14px;
    border-top: 1px solid var(--color-border);
    font-size: 13px;
    font-weight: 700;
    color: var(--color-primary);
}
.firm-card--simple:hover .firm-location-hint {
    color: var(--color-primary-hover);
}

/* ── Old card styles (still needed for other references) ── */
.firm-card { background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-xl); overflow: hidden; cursor: pointer; transition: all var(--transition-fast); }
.firm-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); border-color: var(--color-primary); }
.firm-avatar { width: 44px; height: 44px; border-radius: var(--radius-lg); background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover)); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }
.firm-avatar--inactive { background: var(--color-bg-tertiary) !important; color: var(--color-text-muted) !important; }
.firm-name { font-size: 16px; font-weight: 700; color: var(--color-text-primary); margin: 0 0 4px 0; }

/* ── Toast ── */
.toast-success { position: fixed; top: 24px; right: 24px; z-index: 1001; display: flex; align-items: center; gap: 8px; padding: 14px 20px; background: var(--color-success); color: white; border-radius: var(--radius-lg); font-weight: 600; font-size: 14px; box-shadow: 0 8px 24px rgba(34, 197, 94, 0.4); }
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from { opacity: 0; transform: translateX(40px); }
.toast-leave-to { opacity: 0; transform: translateY(-20px); }

/* ── Modal/Wizard ── */
.modal-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 24px; }
.wizard-container { background: var(--color-bg-secondary); border-radius: var(--radius-xl); width: 100%; max-width: 640px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2); border: 1px solid var(--color-border); }
.wizard-header { display: flex; align-items: center; justify-content: space-between; padding: 24px 24px 0; }
.wizard-header h2 { font-size: 20px; font-weight: 700; color: var(--color-text-primary); margin: 0; }
.modal-close { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: var(--color-bg-tertiary); border: 1px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-text-secondary); cursor: pointer; transition: all 0.2s; }
.modal-close:hover { background: rgba(239, 68, 68, 0.1); color: var(--color-danger); border-color: var(--color-danger); }

/* ── Wizard Steps ── */
.wizard-steps { display: flex; align-items: center; justify-content: center; gap: 0; padding: 24px; }
.step { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.step-circle { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; border: 2px solid var(--color-border); color: var(--color-text-muted); background: var(--color-bg-primary); transition: all 0.3s; }
.step--active .step-circle { border-color: var(--color-primary); background: var(--color-primary); color: white; }
.step--done .step-circle { border-color: var(--color-success); background: var(--color-success); color: white; }
.step-label { font-size: 12px; font-weight: 600; color: var(--color-text-muted); white-space: nowrap; }
.step--active .step-label { color: var(--color-primary); }
.step--done .step-label { color: var(--color-success); }
.step-line { width: 48px; height: 2px; background: var(--color-border); margin: 0 8px; margin-bottom: 20px; transition: background 0.3s; }
.step-line--done { background: var(--color-success); }

/* ── Wizard Body ── */
.wizard-body { padding: 0 24px 24px; }
.wizard-desc { color: var(--color-text-muted); font-size: 14px; margin: 0 0 20px 0; }
.wizard-footer { display: flex; gap: 12px; justify-content: flex-end; padding-top: 20px; border-top: 1px solid var(--color-border); margin-top: 20px; }

/* ── Form ── */
.form-error { display: flex; align-items: center; gap: 8px; padding: 12px; background: rgba(239, 68, 68, 0.1); color: var(--color-danger); border-radius: var(--radius-md); font-size: 14px; font-weight: 500; margin: 0 24px 16px; }
.form-group { margin-bottom: 14px; }
.form-group label { display: block; font-size: 13px; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 6px; }
.required { color: var(--color-danger); }
.form-input { width: 100%; padding: 11px 14px; background: var(--color-bg-primary); border: 2px solid var(--color-border); border-radius: var(--radius-md); font-size: 14px; color: var(--color-text-primary); transition: border-color 0.2s; box-sizing: border-box; font-family: inherit; }
.form-input:focus { outline: none; border-color: var(--color-primary); }
.form-input::placeholder { color: var(--color-text-muted); }
.form-textarea { resize: vertical; min-height: 60px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-row--3 { grid-template-columns: 1fr 1fr 1fr; }
.form-hint { font-size: 12px; color: var(--color-text-muted); margin-top: 4px; }

/* ── Tariff Entry ── */
.tariff-entry { background: var(--color-bg-tertiary); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 12px; }
.tariff-entry-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.tariff-entry-header h4 { margin: 0; font-size: 14px; font-weight: 600; color: var(--color-text-primary); }
.btn-icon-sm { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px solid transparent; border-radius: var(--radius-sm); color: var(--color-text-muted); cursor: pointer; transition: all 0.2s; }
.btn-icon-sm:hover { color: var(--color-danger); background: rgba(239, 68, 68, 0.1); }

/* ── Payment Term Buttons ── */
.payment-term-options { display: flex; gap: 8px; flex-wrap: wrap; }
.term-btn { padding: 8px 16px; border: 2px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-primary); color: var(--color-text-secondary); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.term-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.term-btn--active { border-color: var(--color-primary); background: var(--color-primary); color: white; }

/* ── Split Payment ── */
.split-toggle-row { margin-bottom: 12px; }
.split-toggle-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text-secondary); cursor: pointer; }
.split-toggle-label input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: var(--color-primary); }
.split-entry { background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 12px; margin-bottom: 8px; }
.split-entry-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.split-badge { font-size: 11px; font-weight: 700; color: var(--color-primary); background: var(--color-primary-light); padding: 2px 8px; border-radius: var(--radius-sm); }
.btn-add-split { width: 100%; padding: 8px; background: transparent; border: 1px dashed var(--color-border); border-radius: var(--radius-md); color: var(--color-text-muted); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
.btn-add-split:hover { border-color: var(--color-primary); color: var(--color-primary); }

/* ── Location Entry ── */
.location-entry { background: var(--color-bg-tertiary); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 12px; }
.location-entry-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.location-entry-header h4 { margin: 0; font-size: 14px; font-weight: 600; color: var(--color-text-primary); }

/* ── Add Buttons ── */
.btn-add-tariff { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 12px; background: transparent; border: 2px dashed var(--color-border); border-radius: var(--radius-lg); color: var(--color-text-muted); font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; margin-bottom: 8px; }
.btn-add-tariff:hover { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-primary-light); }

/* ── Buttons ── */
.btn-cancel { padding: 10px 20px; background: var(--color-bg-tertiary); color: var(--color-text-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-md); font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s; }
.btn-cancel:hover { background: var(--color-bg-primary); color: var(--color-text-primary); }
.btn-next { display: inline-flex; align-items: center; gap: 8px; padding: 10px 24px; background: var(--color-primary); color: white; border: none; border-radius: var(--radius-md); font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s; min-width: 120px; justify-content: center; }
.btn-next:hover:not(:disabled) { background: var(--color-primary-hover); }
.btn-next:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-finish { background: var(--color-success); }
.btn-finish:hover:not(:disabled) { background: #16a34a; }
.btn-skip { padding: 10px 20px; background: transparent; color: var(--color-text-muted); border: none; border-radius: var(--radius-md); font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s; }
.btn-skip:hover { color: var(--color-text-primary); }
.btn-spinner { width: 18px; height: 18px; border: 2px solid rgba(255, 255, 255, 0.3); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }

/* ── Modal Transition ── */
.modal-enter-active, .modal-leave-active { transition: opacity 0.25s ease; }
.modal-enter-active .wizard-container, .modal-leave-active .wizard-container { transition: transform 0.25s ease; }
.modal-enter-from { opacity: 0; }
.modal-enter-from .wizard-container { transform: scale(0.95) translateY(10px); }
.modal-leave-to { opacity: 0; }
.modal-leave-to .wizard-container { transform: scale(0.95) translateY(10px); }

/* ── Loading & Empty ── */
.loading { text-align: center; padding: 60px; }
.spinner { width: 40px; height: 40px; border: 3px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto; }
@keyframes spin { to { transform: rotate(360deg); } }
.empty-state { text-align: center; padding: 60px; background: var(--color-bg-tertiary); border-radius: 16px; }
.empty-state h3 { color: var(--color-text-primary); margin: 16px 0 8px; }
.empty-state p { color: var(--color-text-muted); font-size: 14px; }
.error-message { background: rgba(239, 68, 68, 0.1); color: var(--color-danger); padding: 12px; border-radius: 8px; margin-top: 16px; font-size: 14px; }

/* ── Responsive ── */
@media (max-width: 768px) {
    .firms-page { padding: 16px; }
    .page-header { flex-direction: column; align-items: flex-start; gap: 16px; }
    .btn-add { width: 100%; justify-content: center; }
    .header-content h1 { font-size: 24px; }
    .firms-grid { grid-template-columns: 1fr; }
    .search-box { max-width: 100%; }
    .form-row, .form-row--3 { grid-template-columns: 1fr; }
    .modal-overlay { padding: 16px; align-items: flex-end; }
    .wizard-container { max-height: 85vh; }
    .payment-term-options { flex-direction: column; }
    .term-btn { text-align: center; }
    .wizard-steps { gap: 0; }
    .step-line { width: 24px; }
    .wizard-footer { flex-direction: column-reverse; }
    .wizard-footer button { width: 100%; justify-content: center; }
}
</style>
