<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { CircleCheck, CircleX, Eye, EyeOff } from '@lucide/vue';
import { api } from '@/services/api';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { LoadingState, Spinner } from '@/components/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const route = useRoute();
const router = useRouter();

const status = ref<'loading' | 'valid' | 'invalid' | 'success'>('loading');
const errorMessage = ref('');

// Form
const password = ref('');
const confirmPassword = ref('');
const errors = ref<Record<string, string>>({});
const isLoading = ref(false);
const showPassword = ref(false);
const showConfirmPassword = ref(false);

// Password strength
const passwordStrength = computed(() => {
    const pwd = password.value;
    if (!pwd) return { level: 0, label: '' };

    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

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

onMounted(async () => {
    const token = route.query.token as string;

    if (!token) {
        status.value = 'invalid';
        errorMessage.value = 'Geçersiz link';
        return;
    }

    const result = await api.validateResetToken(token);

    if (result.error || !result.data?.valid) {
        status.value = 'invalid';
        errorMessage.value = 'Şifre sıfırlama linkinin süresi dolmuş veya geçersiz';
        return;
    }

    status.value = 'valid';
});

function validateField(field: string): boolean {
    errors.value[field] = '';

    switch (field) {
        case 'password':
            if (!password.value) {
                errors.value[field] = 'Şifre gereklidir';
            } else if (password.value.length < 8) {
                errors.value[field] = 'Şifre en az 8 karakter olmalıdır';
            } else if (!/[a-z]/.test(password.value)) {
                errors.value[field] = 'Şifre en az bir küçük harf içermelidir';
            } else if (!/[A-Z]/.test(password.value)) {
                errors.value[field] = 'Şifre en az bir büyük harf içermelidir';
            } else if (!/[0-9]/.test(password.value)) {
                errors.value[field] = 'Şifre en az bir rakam içermelidir';
            }
            break;

        case 'confirmPassword':
            if (!confirmPassword.value) {
                errors.value[field] = 'Şifre tekrarı gereklidir';
            } else if (password.value !== confirmPassword.value) {
                errors.value[field] = 'Şifreler eşleşmiyor';
            }
            break;
    }

    return !errors.value[field];
}

async function handleSubmit() {
    if (!validateField('password') || !validateField('confirmPassword')) {
        return;
    }

    const token = route.query.token as string;
    isLoading.value = true;

    const result = await api.resetPassword(token, password.value);

    isLoading.value = false;

    if (result.error) {
        errorMessage.value = result.error.message;
        return;
    }

    status.value = 'success';

    setTimeout(() => {
        router.push('/login');
    }, 3000);
}
</script>

<template>
    <!-- Loading -->
    <AuthLayout v-if="status === 'loading'">
        <LoadingState text="Link doğrulanıyor..." class="min-h-40" />
    </AuthLayout>

    <!-- Invalid token -->
    <AuthLayout v-else-if="status === 'invalid'" title="Link Süresi Dolmuş" :description="errorMessage" align="center">
        <template #icon>
            <span class="mb-2 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive" aria-hidden="true">
                <CircleX class="size-7" />
            </span>
        </template>
        <Button as-child class="h-11 w-full">
            <RouterLink to="/forgot-password">Yeni Link Talep Et</RouterLink>
        </Button>
    </AuthLayout>

    <!-- Success -->
    <AuthLayout v-else-if="status === 'success'" title="Şifre Değiştirildi" align="center">
        <template #icon>
            <span class="mb-2 flex size-14 items-center justify-center rounded-full bg-success/10 text-success" aria-hidden="true">
                <CircleCheck class="size-7" />
            </span>
        </template>
        <div class="space-y-4 text-sm">
            <div class="space-y-1 text-muted-foreground">
                <p>Şifreniz başarıyla değiştirildi.</p>
                <p>Güvenlik nedeniyle tüm cihazlardan çıkış yapıldı.</p>
            </div>
            <Button as-child class="h-11 w-full">
                <RouterLink to="/login">Giriş Yap</RouterLink>
            </Button>
            <p class="text-xs text-muted-foreground" aria-live="polite">3 saniye içinde yönlendirileceksiniz...</p>
        </div>
    </AuthLayout>

    <!-- Reset form -->
    <AuthLayout v-else title="Yeni Şifre Oluştur" description="Hesabınız için yeni bir şifre belirleyin">
        <form class="space-y-5" novalidate @submit.prevent="handleSubmit">
            <Alert v-if="errorMessage" variant="destructive">
                <AlertDescription>{{ errorMessage }}</AlertDescription>
            </Alert>

            <!-- New password -->
            <div class="space-y-2">
                <Label for="reset-password">Yeni Şifre</Label>
                <div class="relative">
                    <Input
                        id="reset-password"
                        v-model="password"
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
                <div v-if="password" class="space-y-1" aria-live="polite">
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
                <Label for="reset-confirm-password">Şifre Tekrarı</Label>
                <div class="relative">
                    <Input
                        id="reset-confirm-password"
                        v-model="confirmPassword"
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

            <Button type="submit" class="h-11 w-full" :disabled="isLoading">
                <Spinner v-if="isLoading" />
                {{ isLoading ? 'Şifre değiştiriliyor...' : 'Şifremi Değiştir' }}
            </Button>
        </form>
    </AuthLayout>
</template>
