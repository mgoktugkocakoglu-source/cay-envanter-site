<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Component } from 'vue';
import type { AcceptableValue } from 'reka-ui';
import { RouterLink } from 'vue-router';
import { Eye, EyeOff, HardHat, LandPlot, MailCheck } from '@lucide/vue';
import { api } from '@/services/api';
import type { UserType } from '@/stores/authStore';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { Spinner } from '@/components/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Tea-producing provinces data
const provinces = [
    { name: 'Rize', plateCode: '53' },
    { name: 'Trabzon', plateCode: '61' },
    { name: 'Artvin', plateCode: '08' },
    { name: 'Giresun', plateCode: '28' },
    { name: 'Ordu', plateCode: '52' },
];

// User type definitions
const userTypes: Array<{ value: UserType; label: string; description: string; icon: Component }> = [
    {
        value: 'land_owner',
        label: 'Arazi Sahibi',
        description: 'Arazim var fakat kendim işleyemiyorum. İşçi veya yarılıkçı arıyorum.',
        icon: LandPlot,
    },
    {
        value: 'worker',
        label: 'Çay İşçisi',
        description: 'Arazim yok, başkalarının arazilerinde çay topluyorum veya yarılıkçı olarak çalışıyorum.',
        icon: HardHat,
    },
];

// Form data
const form = ref({
    userType: '' as UserType | '',
    fullName: '',
    email: '',
    phone: '',
    province: '',
    district: '',
    password: '',
    confirmPassword: '',
    farmerIdNumber: '',
    cuzdanNo: '',
    termsAccepted: false,
});

// Form state
const errors = ref<Record<string, string>>({});
const isLoading = ref(false);
const isSuccess = ref(false);
const serverError = ref('');
const registeredEmail = ref('');
const showPassword = ref(false);
const showConfirmPassword = ref(false);

// Districts (simplified - would be loaded from API in production)
const districtMap: Record<string, string[]> = {
    Rize: ['Merkez', 'Ardeşen', 'Çamlıhemşin', 'Çayeli', 'Derepazarı', 'Fındıklı', 'Güneysu', 'Hemşin', 'İkizdere', 'İyidere', 'Kalkandere', 'Pazar'],
    Trabzon: ['Merkez', 'Akçaabat', 'Araklı', 'Arsin', 'Beşikdüzü', 'Çarşıbaşı', 'Çaykara', 'Dernekpazarı', 'Düzköy', 'Hayrat', 'Köprübaşı', 'Maçka', 'Of', 'Sürmene', 'Şalpazarı', 'Tonya', 'Vakfıkebir', 'Yomra'],
    Artvin: ['Merkez', 'Ardanuç', 'Arhavi', 'Borçka', 'Hopa', 'Kemalpaşa', 'Murgul', 'Şavşat', 'Yusufeli'],
    Giresun: ['Merkez', 'Alucra', 'Bulancak', 'Çamoluk', 'Çanakçı', 'Dereli', 'Doğankent', 'Espiye', 'Eynesil', 'Görele', 'Güce', 'Keşap', 'Piraziz', 'Şebinkarahisar', 'Tirebolu', 'Yağlıdere'],
    Ordu: ['Merkez', 'Akkuş', 'Altınordu', 'Aybastı', 'Çamaş', 'Çatalpınar', 'Çaybaşı', 'Fatsa', 'Gölköy', 'Gülyalı', 'Gürgentepe', 'İkizce', 'Kabadüz', 'Kabataş', 'Korgan', 'Kumru', 'Mesudiye', 'Perşembe', 'Ulubey', 'Ünye'],
};

// Select options
const provinceOptions = computed(() => provinces.map((p) => ({ value: p.name, label: `${p.name} (${p.plateCode})` })));

const districtOptions = computed(() => {
    const districts = districtMap[form.value.province] || [];
    return districts.map((d) => ({ value: d, label: d }));
});

// Password strength calculation
const passwordStrength = computed(() => {
    const password = form.value.password;
    if (!password) return { level: 0, label: '' };

    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 2) return { level: 1, label: 'Zayıf' };
    if (score <= 3) return { level: 2, label: 'Orta' };
    return { level: 3, label: 'Güçlü' };
});

const strengthBarClass = computed(() => {
    if (passwordStrength.value.level === 3) return 'bg-success';
    if (passwordStrength.value.level === 2) return 'bg-warning';
    return 'bg-destructive';
});

const strengthTextClass = computed(() => {
    if (passwordStrength.value.level === 3) return 'text-success';
    if (passwordStrength.value.level === 2) return 'text-warning';
    return 'text-destructive';
});

// User type selection
function selectUserType(type: UserType) {
    form.value.userType = type;
    errors.value.userType = '';
}

function onUserTypeChange(value: AcceptableValue) {
    const match = userTypes.find((ut) => ut.value === value);
    if (match) selectUserType(match.value);
}

// Validation
function validateField(field: string): boolean {
    errors.value[field] = '';

    switch (field) {
        case 'userType':
            if (!form.value.userType) {
                errors.value[field] = 'Kullanıcı tipi seçiniz';
            }
            break;

        case 'fullName':
            if (!form.value.fullName) {
                errors.value[field] = 'Ad Soyad gereklidir';
            } else if (form.value.fullName.length < 3) {
                errors.value[field] = 'Ad Soyad en az 3 karakter olmalıdır';
            } else if (!/^[a-zA-ZğüşıöçĞÜŞİÖÇ\s]+$/.test(form.value.fullName)) {
                errors.value[field] = 'Sadece harf ve boşluk kullanabilirsiniz';
            }
            break;

        case 'email':
            if (!form.value.email) {
                errors.value[field] = 'Email adresi gereklidir';
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
                errors.value[field] = 'Geçerli bir email adresi giriniz';
            }
            break;

        case 'phone': {
            const cleanPhone = form.value.phone.replace(/\D/g, '');
            if (!cleanPhone) {
                errors.value[field] = 'Telefon numarası gereklidir';
            } else if (!/^5[0-9]{9}$/.test(cleanPhone)) {
                errors.value[field] = 'Geçerli bir telefon numarası giriniz (5XXXXXXXXX)';
            }
            break;
        }

        case 'province':
            if (!form.value.province) {
                errors.value[field] = 'Lütfen il seçiniz';
            }
            break;

        case 'district':
            if (!form.value.district) {
                errors.value[field] = 'Lütfen ilçe seçiniz';
            }
            break;

        case 'password':
            if (!form.value.password) {
                errors.value[field] = 'Şifre gereklidir';
            } else if (form.value.password.length < 8) {
                errors.value[field] = 'Şifre en az 8 karakter olmalıdır';
            } else if (!/[a-z]/.test(form.value.password)) {
                errors.value[field] = 'Şifre en az bir küçük harf içermelidir';
            } else if (!/[A-Z]/.test(form.value.password)) {
                errors.value[field] = 'Şifre en az bir büyük harf içermelidir';
            } else if (!/[0-9]/.test(form.value.password)) {
                errors.value[field] = 'Şifre en az bir rakam içermelidir';
            }
            break;

        case 'confirmPassword':
            if (!form.value.confirmPassword) {
                errors.value[field] = 'Şifre tekrarı gereklidir';
            } else if (form.value.password !== form.value.confirmPassword) {
                errors.value[field] = 'Şifreler eşleşmiyor';
            }
            break;

        case 'farmerIdNumber':
            if (!form.value.farmerIdNumber) {
                errors.value[field] = 'TC Kimlik No gereklidir';
            } else if (!/^[0-9]{11}$/.test(form.value.farmerIdNumber)) {
                errors.value[field] = 'TC Kimlik No 11 haneli olmalıdır';
            }
            break;

        case 'cuzdanNo':
            if (!form.value.cuzdanNo) {
                errors.value[field] = 'Çaykur Cüzdan No gereklidir';
            } else if (!/^[0-9]{1,20}$/.test(form.value.cuzdanNo)) {
                errors.value[field] = 'Çaykur Cüzdan No sadece rakamlardan oluşmalıdır';
            }
            break;

        case 'termsAccepted':
            if (!form.value.termsAccepted) {
                errors.value[field] = 'Kullanım koşullarını kabul etmelisiniz';
            }
            break;
    }

    return !errors.value[field];
}

function validateAll(): boolean {
    const fields = ['userType', 'fullName', 'email', 'phone', 'province', 'district', 'password', 'confirmPassword', 'farmerIdNumber', 'cuzdanNo', 'termsAccepted'];
    return fields.every(validateField);
}

// Province change handler
function onProvinceChange() {
    form.value.district = '';
    validateField('province');
}

function onDistrictChange() {
    validateField('district');
}

function onTermsChange(value: boolean | 'indeterminate') {
    form.value.termsAccepted = value === true;
    validateField('termsAccepted');
}

// Form submission
async function handleSubmit() {
    serverError.value = '';

    if (!validateAll()) return;

    isLoading.value = true;

    const cleanPhone = form.value.phone.replace(/\D/g, '');

    const result = await api.register({
        userType: form.value.userType as UserType,
        fullName: form.value.fullName,
        email: form.value.email,
        phone: cleanPhone,
        province: form.value.province,
        district: form.value.district,
        password: form.value.password,
        farmerIdNumber: form.value.farmerIdNumber,
        cuzdanNo: form.value.cuzdanNo,
    });

    isLoading.value = false;

    if (result.error) {
        serverError.value = result.error.message;
        return;
    }

    registeredEmail.value = result.data?.email || form.value.email;
    isSuccess.value = true;
}

// Resend verification
const resendCooldown = ref(0);
const resendMessage = ref('');

async function resendVerification() {
    if (resendCooldown.value > 0) return;

    const result = await api.resendVerification(registeredEmail.value);

    if (result.error) {
        resendMessage.value = result.error.message;
        return;
    }

    resendMessage.value = 'Doğrulama emaili tekrar gönderildi';
    resendCooldown.value = 60;

    const interval = setInterval(() => {
        resendCooldown.value--;
        if (resendCooldown.value <= 0) {
            clearInterval(interval);
            resendMessage.value = '';
        }
    }, 1000);
}
</script>

<template>
    <!-- Success state -->
    <AuthLayout v-if="isSuccess" title="Kayıt Başarılı!" align="center">
        <template #cta>
            <Button as-child variant="outline" class="h-11 md:h-9">
                <RouterLink to="/login">Giriş Yapın</RouterLink>
            </Button>
        </template>
        <template #icon>
            <span class="mb-2 flex size-14 items-center justify-center rounded-full bg-success/10 text-success" aria-hidden="true">
                <MailCheck class="size-7" />
            </span>
        </template>

        <div class="space-y-2 text-sm">
            <p class="text-foreground">
                <strong>{{ registeredEmail }}</strong> adresine bir doğrulama e-postası gönderdik.
            </p>
            <p class="text-muted-foreground">Hesabınızı aktifleştirmek için lütfen e-postanızdaki linke tıklayın.</p>
        </div>

        <template #footer>
            <p>E-postayı almadınız mı?</p>
            <Button type="button" variant="link" class="h-auto p-0" :disabled="resendCooldown > 0" @click="resendVerification">
                {{ resendCooldown > 0 ? `Tekrar Gönder (${resendCooldown}s)` : 'Tekrar Gönder' }}
            </Button>
            <p v-if="resendMessage" class="text-success">{{ resendMessage }}</p>
        </template>
    </AuthLayout>

    <!-- Registration form -->
    <AuthLayout v-else title="Hesap Oluştur" description="Çay üreticisi platformuna hoş geldiniz" size="lg">
        <template #cta>
            <Button as-child variant="outline" class="h-11 md:h-9">
                <RouterLink to="/login">
                    <span class="hidden sm:inline">Zaten hesabınız var mı?</span>
                    <span>Giriş Yapın</span>
                </RouterLink>
            </Button>
        </template>

        <form class="space-y-5" novalidate @submit.prevent="handleSubmit">
            <Alert v-if="serverError" variant="destructive">
                <AlertDescription>{{ serverError }}</AlertDescription>
            </Alert>

            <!-- User type -->
            <fieldset class="space-y-2">
                <legend class="text-sm font-medium">Kullanıcı Tipi *</legend>
                <RadioGroup :model-value="form.userType" class="grid gap-3 sm:grid-cols-2" @update:model-value="onUserTypeChange">
                    <Label
                        v-for="ut in userTypes"
                        :key="ut.value"
                        :for="`user-type-${ut.value}`"
                        class="relative flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:border-input has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                    >
                        <RadioGroupItem :id="`user-type-${ut.value}`" :value="ut.value" class="mt-0.5" />
                        <span class="flex min-w-0 flex-col gap-1">
                            <span class="flex items-center gap-2 text-sm font-semibold text-foreground">
                                <component :is="ut.icon" class="size-4 text-muted-foreground" aria-hidden="true" />
                                {{ ut.label }}
                            </span>
                            <span class="text-xs leading-relaxed font-normal text-muted-foreground">{{ ut.description }}</span>
                        </span>
                    </Label>
                </RadioGroup>
                <p v-if="errors.userType" class="text-xs text-destructive">{{ errors.userType }}</p>
            </fieldset>

            <!-- TC Kimlik No -->
            <div class="space-y-2">
                <Label for="farmerIdNumber">TC Kimlik No *</Label>
                <Input
                    id="farmerIdNumber"
                    v-model="form.farmerIdNumber"
                    type="text"
                    inputmode="numeric"
                    placeholder="11 haneli TC kimlik numaranız"
                    maxlength="11"
                    class="h-11 md:h-9"
                    :aria-invalid="!!errors.farmerIdNumber"
                    @blur="validateField('farmerIdNumber')"
                />
                <p class="text-xs text-muted-foreground">TC kimlik numaranız, diger kullanıcılarla baglantı kurmak icin kullanılacaktır.</p>
                <p v-if="errors.farmerIdNumber" class="text-xs text-destructive">{{ errors.farmerIdNumber }}</p>
            </div>

            <!-- Çaykur Cüzdan No -->
            <div class="space-y-2">
                <Label for="cuzdanNo">Çaykur Cüzdan No *</Label>
                <Input
                    id="cuzdanNo"
                    v-model="form.cuzdanNo"
                    type="text"
                    inputmode="numeric"
                    placeholder="Çaykur üretici cüzdan numaranız"
                    maxlength="20"
                    class="h-11 md:h-9"
                    :aria-invalid="!!errors.cuzdanNo"
                    @blur="validateField('cuzdanNo')"
                />
                <p class="text-xs text-muted-foreground">Çaykur üretici cüzdan numaranız; arazileriniz ve çay satışlarınız bu numara üzerinden eşleştirilir.</p>
                <p v-if="errors.cuzdanNo" class="text-xs text-destructive">{{ errors.cuzdanNo }}</p>
            </div>

            <!-- Full name -->
            <div class="space-y-2">
                <Label for="fullName">Ad Soyad *</Label>
                <Input
                    id="fullName"
                    v-model="form.fullName"
                    type="text"
                    placeholder="Ahmet Yılmaz"
                    autocomplete="name"
                    class="h-11 md:h-9"
                    :aria-invalid="!!errors.fullName"
                    @blur="validateField('fullName')"
                />
                <p v-if="errors.fullName" class="text-xs text-destructive">{{ errors.fullName }}</p>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
                <!-- Email -->
                <div class="space-y-2">
                    <Label for="email">Email Adresi *</Label>
                    <Input
                        id="email"
                        v-model="form.email"
                        type="email"
                        placeholder="ahmet@example.com"
                        autocomplete="email"
                        class="h-11 md:h-9"
                        :aria-invalid="!!errors.email"
                        @blur="validateField('email')"
                    />
                    <p v-if="errors.email" class="text-xs text-destructive">{{ errors.email }}</p>
                </div>

                <!-- Phone -->
                <div class="space-y-2">
                    <Label for="phone">Telefon Numarası *</Label>
                    <Input
                        id="phone"
                        v-model="form.phone"
                        type="tel"
                        placeholder="5XX XXX XX XX"
                        autocomplete="tel"
                        class="h-11 md:h-9"
                        :aria-invalid="!!errors.phone"
                        @blur="validateField('phone')"
                    />
                    <p v-if="errors.phone" class="text-xs text-destructive">{{ errors.phone }}</p>
                </div>
            </div>

            <!-- Province & district -->
            <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-2">
                    <Label for="province">İl *</Label>
                    <Select v-model="form.province" @update:model-value="onProvinceChange">
                        <SelectTrigger id="province" class="w-full" :aria-invalid="!!errors.province">
                            <SelectValue placeholder="İl Seçiniz" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="option in provinceOptions" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
                        </SelectContent>
                    </Select>
                    <p v-if="errors.province" class="text-xs text-destructive">{{ errors.province }}</p>
                </div>

                <div class="space-y-2">
                    <Label for="district">İlçe *</Label>
                    <Select v-model="form.district" :disabled="!form.province" @update:model-value="onDistrictChange">
                        <SelectTrigger id="district" class="w-full" :aria-invalid="!!errors.district">
                            <SelectValue placeholder="İlçe Seçiniz" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="option in districtOptions" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
                        </SelectContent>
                    </Select>
                    <p v-if="errors.district" class="text-xs text-destructive">{{ errors.district }}</p>
                </div>
            </div>

            <!-- Password -->
            <div class="space-y-2">
                <Label for="password">Şifre *</Label>
                <div class="relative">
                    <Input
                        id="password"
                        v-model="form.password"
                        :type="showPassword ? 'text' : 'password'"
                        placeholder="En az 8 karakter"
                        autocomplete="new-password"
                        class="h-11 pr-11 md:h-9"
                        :aria-invalid="!!errors.password"
                        @blur="validateField('password')"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="absolute top-1/2 right-0.5 size-10 -translate-y-1/2 text-muted-foreground md:size-8"
                        :aria-label="showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'"
                        @click="showPassword = !showPassword"
                    >
                        <EyeOff v-if="showPassword" aria-hidden="true" />
                        <Eye v-else aria-hidden="true" />
                    </Button>
                </div>
                <div v-if="form.password" class="space-y-1" aria-live="polite">
                    <div class="grid grid-cols-3 gap-1" aria-hidden="true">
                        <span
                            v-for="segment in 3"
                            :key="segment"
                            class="h-1.5 rounded-full"
                            :class="segment <= passwordStrength.level ? strengthBarClass : 'bg-muted'"
                        />
                    </div>
                    <p v-if="passwordStrength.label" class="text-xs font-medium" :class="strengthTextClass">
                        Şifre gücü: {{ passwordStrength.label }}
                    </p>
                </div>
                <p v-if="errors.password" class="text-xs text-destructive">{{ errors.password }}</p>
            </div>

            <!-- Confirm password -->
            <div class="space-y-2">
                <Label for="confirmPassword">Şifre Tekrarı *</Label>
                <div class="relative">
                    <Input
                        id="confirmPassword"
                        v-model="form.confirmPassword"
                        :type="showConfirmPassword ? 'text' : 'password'"
                        placeholder="Şifrenizi tekrar giriniz"
                        autocomplete="new-password"
                        class="h-11 pr-11 md:h-9"
                        :aria-invalid="!!errors.confirmPassword"
                        @blur="validateField('confirmPassword')"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="absolute top-1/2 right-0.5 size-10 -translate-y-1/2 text-muted-foreground md:size-8"
                        :aria-label="showConfirmPassword ? 'Şifreyi gizle' : 'Şifreyi göster'"
                        @click="showConfirmPassword = !showConfirmPassword"
                    >
                        <EyeOff v-if="showConfirmPassword" aria-hidden="true" />
                        <Eye v-else aria-hidden="true" />
                    </Button>
                </div>
                <p v-if="errors.confirmPassword" class="text-xs text-destructive">{{ errors.confirmPassword }}</p>
            </div>

            <!-- Terms -->
            <div class="space-y-2">
                <div class="flex items-start gap-2">
                    <Checkbox id="termsAccepted" :model-value="form.termsAccepted" class="mt-0.5" :aria-invalid="!!errors.termsAccepted" @update:model-value="onTermsChange" />
                    <Label for="termsAccepted" class="inline cursor-pointer text-sm leading-relaxed font-normal text-muted-foreground">
                        <a href="/terms" target="_blank" class="text-primary underline-offset-4 hover:underline">Kullanım Koşullarını</a> ve
                        <a href="/privacy" target="_blank" class="text-primary underline-offset-4 hover:underline">Gizlilik Politikasını</a>
                        okudum, kabul ediyorum.
                    </Label>
                </div>
                <p v-if="errors.termsAccepted" class="text-xs text-destructive">{{ errors.termsAccepted }}</p>
            </div>

            <Button type="submit" class="h-11 w-full" :disabled="isLoading">
                <Spinner v-if="isLoading" />
                {{ isLoading ? 'Kaydediliyor...' : 'Hesap Oluştur' }}
            </Button>
        </form>

        <template #footer>
            <p>
                Zaten hesabınız var mı?
                <RouterLink to="/login" class="font-medium text-primary underline-offset-4 hover:underline">Giriş Yapın</RouterLink>
            </p>
        </template>
    </AuthLayout>
</template>
