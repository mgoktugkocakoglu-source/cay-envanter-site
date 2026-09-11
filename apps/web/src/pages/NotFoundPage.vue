<script setup lang="ts">
import { useRouter } from 'vue-router';
import { SearchX } from '@lucide/vue';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';

const router = useRouter();
</script>

<template>
    <AuthLayout variant="page">
        <div class="flex flex-1 items-center justify-center p-4 md:p-6">
            <EmptyState
                :icon="SearchX"
                title="404 · Sayfa Bulunamadı"
                description="Aradığınız sayfa mevcut değil veya taşınmış olabilir."
                class="w-full max-w-md"
            >
                <Button class="h-11 md:h-9" @click="router.push('/')">Ana Sayfaya Dön</Button>
                <Button variant="outline" class="h-11 md:h-9" @click="router.back()">Geri Git</Button>
            </EmptyState>
        </div>
    </AuthLayout>
</template>
