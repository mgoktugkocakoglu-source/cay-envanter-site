<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { CircleCheck, CircleX, TriangleAlert } from '@lucide/vue';
import { api } from '@/services/api';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { LoadingState, Spinner } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const route = useRoute();
const router = useRouter();

const status = ref<'loading' | 'valid' | 'invalid' | 'success'>('loading');
const userData = ref<Record<string, unknown> | null>(null);
const isDeleting = ref(false);

onMounted(async () => {
    const token = route.query.token as string;

    if (!token) {
        status.value = 'invalid';
        return;
    }

    const result = await api.validateDeletionToken(token);

    if (result.error || !result.data?.valid) {
        status.value = 'invalid';
        return;
    }

    userData.value = result.data.userData || null;
    status.value = 'valid';
});

async function confirmDeletion() {
    const token = route.query.token as string;
    isDeleting.value = true;

    const result = await api.deleteAccount(token);

    isDeleting.value = false;

    if (result.error) {
        status.value = 'invalid';
        return;
    }

    status.value = 'success';

    localStorage.removeItem('auth_token');

    setTimeout(() => {
        router.push('/');
    }, 5000);
}

function formatRegistrationDate(value: unknown): string {
    if (typeof value !== 'string') return '—';
    return new Date(value).toLocaleDateString('tr-TR');
}
</script>

<template>
    <!-- Loading -->
    <AuthLayout v-if="status === 'loading'">
        <LoadingState text="Link doğrulanıyor..." class="min-h-40" />
    </AuthLayout>

    <!-- Invalid -->
    <AuthLayout v-else-if="status === 'invalid'" title="Link Süresi Dolmuş" description="Hesap silme linkinizin süresi dolmuş." align="center">
        <template #icon>
            <span class="mb-2 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive" aria-hidden="true">
                <CircleX class="size-7" />
            </span>
        </template>
        <Button as-child class="h-11 w-full">
            <RouterLink to="/tea/settings">Hesap Ayarlarına Dön</RouterLink>
        </Button>
    </AuthLayout>

    <!-- Success -->
    <AuthLayout v-else-if="status === 'success'" title="Hesap Silindi" description="Hesabınız başarıyla silindi." align="center">
        <template #icon>
            <span class="mb-2 flex size-14 items-center justify-center rounded-full bg-success/10 text-success" aria-hidden="true">
                <CircleCheck class="size-7" />
            </span>
        </template>
        <div class="space-y-4 text-sm">
            <p class="text-muted-foreground">Platformumuzu kullandığınız için teşekkür ederiz.</p>
            <Button as-child class="h-11 w-full">
                <RouterLink to="/">Ana Sayfaya Dön</RouterLink>
            </Button>
            <p class="text-xs text-muted-foreground" aria-live="polite">5 saniye içinde yönlendirileceksiniz...</p>
        </div>
    </AuthLayout>

    <!-- Confirmation -->
    <AuthLayout v-else title="SON UYARI" description="Hesabınızı silmek üzeresiniz." align="center">
        <template #icon>
            <span class="mb-2 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive" aria-hidden="true">
                <TriangleAlert class="size-7" />
            </span>
        </template>

        <div class="space-y-4 text-left">
            <dl v-if="userData" class="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
                <div class="flex justify-between gap-4">
                    <dt class="text-muted-foreground">Kullanıcı</dt>
                    <dd class="font-medium text-foreground">{{ userData.fullName }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                    <dt class="text-muted-foreground">Email</dt>
                    <dd class="truncate font-medium text-foreground">{{ userData.email }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                    <dt class="text-muted-foreground">Kayıt Tarihi</dt>
                    <dd class="font-medium text-foreground tabular-nums">{{ formatRegistrationDate(userData.createdAt) }}</dd>
                </div>
            </dl>

            <Alert variant="destructive">
                <TriangleAlert aria-hidden="true" />
                <AlertTitle>Bu işlem GERİ ALINAMAZ!</AlertTitle>
                <AlertDescription>Tüm verileriniz kalıcı olarak silinecektir.</AlertDescription>
            </Alert>

            <div class="grid gap-2 sm:grid-cols-2">
                <Button as-child variant="outline" class="h-11">
                    <RouterLink to="/tea/dashboard">Hayır, Vazgeç</RouterLink>
                </Button>
                <Button type="button" variant="destructive" class="h-11" :disabled="isDeleting" @click="confirmDeletion">
                    <Spinner v-if="isDeleting" />
                    {{ isDeleting ? 'Siliniyor...' : 'Evet, Hesabımı Sil' }}
                </Button>
            </div>
        </div>
    </AuthLayout>
</template>
