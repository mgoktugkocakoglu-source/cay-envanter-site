<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { CircleCheck, CircleX, Info } from '@lucide/vue';
import { api } from '@/services/api';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { LoadingState, Spinner } from '@/components/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const route = useRoute();
const router = useRouter();

const status = ref<'loading' | 'success' | 'error' | 'already-verified' | 'token-missing'>('loading');
const errorMessage = ref('');
const resendEmail = ref('');
const showResendForm = ref(false);
const resendLoading = ref(false);
const resendMessage = ref('');
const resendFailed = ref(false);

onMounted(async () => {
    const token = route.query.token as string;

    if (!token) {
        status.value = 'token-missing';
        return;
    }

    const result = await api.verifyEmail(token);

    if (result.error) {
        if (result.error.message.includes('zaten doğrulanmış')) {
            status.value = 'already-verified';
        } else {
            status.value = 'error';
            errorMessage.value = result.error.message;
        }
        return;
    }

    status.value = 'success';

    // Auto-redirect after 3 seconds
    setTimeout(() => {
        router.push('/login');
    }, 3000);
});

async function handleResend() {
    if (!resendEmail.value) {
        resendFailed.value = true;
        resendMessage.value = 'Lütfen email adresinizi giriniz';
        return;
    }

    resendLoading.value = true;
    resendMessage.value = '';
    resendFailed.value = false;

    const result = await api.resendVerification(resendEmail.value);

    resendLoading.value = false;

    if (result.error) {
        resendFailed.value = true;
        resendMessage.value = result.error.message;
        return;
    }

    resendMessage.value = 'Eğer email kayıtlıysa, yeni link gönderildi';
}
</script>

<template>
    <!-- Loading -->
    <AuthLayout v-if="status === 'loading'" title="Email Doğrulanıyor..." description="Lütfen bekleyin" align="center">
        <LoadingState class="min-h-24" text="Doğrulama yapılıyor" />
    </AuthLayout>

    <!-- Success -->
    <AuthLayout v-else-if="status === 'success'" title="Email Doğrulandı!" align="center">
        <template #icon>
            <span class="mb-2 flex size-14 items-center justify-center rounded-full bg-success/10 text-success" aria-hidden="true">
                <CircleCheck class="size-7" />
            </span>
        </template>
        <div class="space-y-4 text-sm">
            <div class="space-y-1 text-muted-foreground">
                <p>Email adresiniz başarıyla doğrulandı.</p>
                <p>Artık platformu kullanmaya başlayabilirsiniz.</p>
            </div>
            <Button as-child class="h-11 w-full">
                <RouterLink to="/login">Giriş Yap</RouterLink>
            </Button>
            <p class="text-xs text-muted-foreground" aria-live="polite">3 saniye içinde yönlendirileceksiniz...</p>
        </div>
    </AuthLayout>

    <!-- Already verified -->
    <AuthLayout v-else-if="status === 'already-verified'" title="Email Zaten Doğrulandı" description="Bu email adresi daha önce doğrulanmış." align="center">
        <template #icon>
            <span class="mb-2 flex size-14 items-center justify-center rounded-full bg-info/10 text-info" aria-hidden="true">
                <Info class="size-7" />
            </span>
        </template>
        <Button as-child class="h-11 w-full">
            <RouterLink to="/login">Giriş Yap</RouterLink>
        </Button>
    </AuthLayout>

    <!-- Error -->
    <AuthLayout
        v-else-if="status === 'error'"
        title="Doğrulama Başarısız"
        :description="errorMessage || 'Doğrulama linki geçersiz veya süresi dolmuş.'"
        align="center"
    >
        <template #icon>
            <span class="mb-2 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive" aria-hidden="true">
                <CircleX class="size-7" />
            </span>
        </template>

        <Button v-if="!showResendForm" type="button" class="h-11 w-full" @click="showResendForm = true">
            Yeni Doğrulama Linki Gönder
        </Button>

        <form v-else class="space-y-4 text-left" novalidate @submit.prevent="handleResend">
            <div class="space-y-2">
                <Label for="resend-email">Email Adresiniz</Label>
                <Input
                    id="resend-email"
                    v-model="resendEmail"
                    type="email"
                    placeholder="ahmet@example.com"
                    autocomplete="email"
                    class="h-11 md:h-9"
                    :aria-invalid="resendFailed"
                />
            </div>
            <Button type="submit" class="h-11 w-full" :disabled="resendLoading">
                <Spinner v-if="resendLoading" />
                {{ resendLoading ? 'Gönderiliyor...' : 'Gönder' }}
            </Button>
            <Alert v-if="resendMessage" :variant="resendFailed ? 'destructive' : 'success'">
                <AlertDescription>{{ resendMessage }}</AlertDescription>
            </Alert>
        </form>
    </AuthLayout>

    <!-- Token missing -->
    <AuthLayout v-else title="Geçersiz Link" description="Doğrulama linki bulunamadı." align="center">
        <template #icon>
            <span class="mb-2 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive" aria-hidden="true">
                <CircleX class="size-7" />
            </span>
        </template>
        <Button as-child class="h-11 w-full">
            <RouterLink to="/">Ana Sayfaya Dön</RouterLink>
        </Button>
    </AuthLayout>
</template>
