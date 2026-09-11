<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { MailCheck } from '@lucide/vue';
import { api } from '@/services/api';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { Spinner } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const email = ref('');
const isLoading = ref(false);
const isSuccess = ref(false);
const error = ref('');

async function handleSubmit() {
    if (!email.value) {
        error.value = 'Email adresi gereklidir';
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
        error.value = 'Geçerli bir email adresi giriniz';
        return;
    }

    error.value = '';
    isLoading.value = true;

    const result = await api.forgotPassword(email.value);

    isLoading.value = false;

    if (result.error) {
        error.value = result.error.message;
        return;
    }

    isSuccess.value = true;
}
</script>

<template>
    <!-- Success state -->
    <AuthLayout v-if="isSuccess" title="Email Gönderildi" align="center">
        <template #cta>
            <Button as-child variant="outline" class="h-11 md:h-9">
                <RouterLink to="/login">Giriş Sayfasına Dön</RouterLink>
            </Button>
        </template>
        <template #icon>
            <span class="mb-2 flex size-14 items-center justify-center rounded-full bg-success/10 text-success" aria-hidden="true">
                <MailCheck class="size-7" />
            </span>
        </template>

        <div class="space-y-4 text-sm">
            <p class="text-foreground">
                Eğer <strong>{{ email }}</strong> adresi kayıtlı ise, şifre sıfırlama linki gönderildi.
            </p>
            <div class="space-y-1 text-muted-foreground">
                <p>Lütfen email kutunuzu kontrol edin.</p>
                <p>Link 1 saat geçerlidir.</p>
            </div>
            <Button as-child class="h-11 w-full">
                <RouterLink to="/login">Giriş Sayfasına Dön</RouterLink>
            </Button>
        </div>
    </AuthLayout>

    <!-- Request form -->
    <AuthLayout v-else title="Şifre Sıfırlama" description="Kayıtlı email adresinizi girin, size şifre sıfırlama linki gönderelim.">
        <template #cta>
            <Button as-child variant="outline" class="h-11 md:h-9">
                <RouterLink to="/login">Giriş Sayfasına Dön</RouterLink>
            </Button>
        </template>

        <form class="space-y-5" novalidate @submit.prevent="handleSubmit">
            <div class="space-y-2">
                <Label for="forgot-email">Email Adresi</Label>
                <Input
                    id="forgot-email"
                    v-model="email"
                    type="email"
                    placeholder="ahmet@example.com"
                    autocomplete="email"
                    class="h-11 md:h-9"
                    :aria-invalid="!!error"
                />
                <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
            </div>

            <Button type="submit" class="h-11 w-full" :disabled="isLoading">
                <Spinner v-if="isLoading" />
                {{ isLoading ? 'Gönderiliyor...' : 'Sıfırlama Linki Gönder' }}
            </Button>
        </form>

        <template #footer>
            <p>
                Şifrenizi hatırladınız mı?
                <RouterLink to="/login" class="font-medium text-primary underline-offset-4 hover:underline">Giriş Yapın</RouterLink>
            </p>
        </template>
    </AuthLayout>
</template>
