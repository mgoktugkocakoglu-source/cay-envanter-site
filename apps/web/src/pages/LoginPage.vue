<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute, RouterLink } from 'vue-router';
import { Eye, EyeOff, TriangleAlert } from '@lucide/vue';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { Spinner } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

// Form data
const form = ref({
    email: '',
    password: '',
    rememberMe: false,
});

// Form state
const errors = ref<Record<string, string>>({});
const isLoading = ref(false);
const serverError = ref('');
const needsVerification = ref(false);
const verificationEmail = ref('');
const showPassword = ref(false);

// Validation
function validateField(field: string): boolean {
    errors.value[field] = '';

    switch (field) {
        case 'email':
            if (!form.value.email) {
                errors.value[field] = 'Email adresi gereklidir';
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
                errors.value[field] = 'Geçerli bir email adresi giriniz';
            }
            break;

        case 'password':
            if (!form.value.password) {
                errors.value[field] = 'Şifre gereklidir';
            }
            break;
    }

    return !errors.value[field];
}

function validateAll(): boolean {
    return ['email', 'password'].every(validateField);
}

// Form submission
async function handleSubmit() {
    serverError.value = '';
    needsVerification.value = false;

    if (!validateAll()) return;

    isLoading.value = true;

    const result = await api.login({
        email: form.value.email,
        password: form.value.password,
        rememberMe: form.value.rememberMe,
    });

    isLoading.value = false;

    if (result.error) {
        if (result.error.message.includes('doğrulama') || result.error.message.includes('verification')) {
            needsVerification.value = true;
            verificationEmail.value = form.value.email;
        } else {
            serverError.value = result.error.message;
        }
        return;
    }

    if (result.data) {
        authStore.setAuth(result.data as Parameters<typeof authStore.setAuth>[0]);
        // Honor a saved return URL, else route by identity (producer → tea hub,
        // field officer → task queue, office/admin → Çaykur panel).
        const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null;
        router.push(redirect || authStore.homeRoute);
    }
}

// Resend verification
const resendLoading = ref(false);
const resendMessage = ref('');

async function resendVerification() {
    resendLoading.value = true;
    resendMessage.value = '';

    const result = await api.resendVerification(verificationEmail.value);

    resendLoading.value = false;

    if (result.error) {
        resendMessage.value = result.error.message;
        return;
    }

    resendMessage.value = 'Doğrulama emaili gönderildi';
}
</script>

<template>
    <AuthLayout title="Giriş Yap" description="Hesabınıza giriş yapın">
        <template #cta>
            <Button as-child variant="outline" class="h-11 md:h-9">
                <RouterLink to="/register">
                    <span class="hidden sm:inline">Hesabınız yok mu?</span>
                    <span>Kayıt Olun</span>
                </RouterLink>
            </Button>
        </template>

        <form class="space-y-5" novalidate @submit.prevent="handleSubmit">
            <Alert v-if="serverError" variant="destructive">
                <AlertDescription>{{ serverError }}</AlertDescription>
            </Alert>

            <Alert v-if="needsVerification" variant="warning">
                <TriangleAlert aria-hidden="true" />
                <AlertTitle>Email Doğrulaması Gerekli</AlertTitle>
                <AlertDescription class="space-y-2">
                    <p>Hesabınız henüz doğrulanmamış. Lütfen email adresinize gönderilen doğrulama linkine tıklayın.</p>
                    <Button type="button" variant="link" class="h-auto p-0" :disabled="resendLoading" @click="resendVerification">
                        <Spinner v-if="resendLoading" />
                        Doğrulama Emailini Tekrar Gönder
                    </Button>
                    <p v-if="resendMessage">{{ resendMessage }}</p>
                </AlertDescription>
            </Alert>

            <div class="space-y-2">
                <Label for="login-email">Email Adresi</Label>
                <Input
                    id="login-email"
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

            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <Label for="login-password">Şifre</Label>
                    <RouterLink to="/forgot-password" class="text-sm text-primary underline-offset-4 hover:underline">
                        Şifrenizi mi unuttunuz?
                    </RouterLink>
                </div>
                <div class="relative">
                    <Input
                        id="login-password"
                        v-model="form.password"
                        :type="showPassword ? 'text' : 'password'"
                        placeholder="Şifrenizi giriniz"
                        autocomplete="current-password"
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
                <p v-if="errors.password" class="text-xs text-destructive">{{ errors.password }}</p>
            </div>

            <div class="flex items-center gap-2">
                <Checkbox id="login-remember" :model-value="form.rememberMe" @update:model-value="form.rememberMe = $event === true" />
                <Label for="login-remember" class="cursor-pointer font-normal">Beni Hatırla</Label>
            </div>

            <Button type="submit" class="h-11 w-full" :disabled="isLoading">
                <Spinner v-if="isLoading" />
                {{ isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap' }}
            </Button>
        </form>

        <template #footer>
            <p>
                Hesabınız yok mu?
                <RouterLink to="/register" class="font-medium text-primary underline-offset-4 hover:underline">Kayıt Olun</RouterLink>
            </p>
        </template>
    </AuthLayout>
</template>
