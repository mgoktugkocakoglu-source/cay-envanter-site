<script setup lang="ts">
import type { Component } from 'vue';
import { RouterLink } from 'vue-router';
import { Layers, MapPin, Wallet } from '@lucide/vue';
import { useAuthStore } from '@/stores/authStore';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const authStore = useAuthStore();

const features: Array<{ title: string; description: string; icon: Component }> = [
    {
        title: 'Tarla Yönetimi',
        description: 'Çaykur cüzdanınıza kayıtlı arazileriniz otomatik listelenir; parsel ve alan bilgileri tek yerde.',
        icon: MapPin,
    },
    {
        title: 'Hasat Takibi',
        description: 'Her hasadı kilo, fiyat ve firma bilgisiyle kaydedin; sezon toplamlarınızı anında görün.',
        icon: Layers,
    },
    {
        title: 'Ödeme Kontrolü',
        description: 'Alacaklarınızı ve yapılan ödemeleri takip edin, hangi firmadan ne kadar bekliyorsunuz bilin.',
        icon: Wallet,
    },
];
</script>

<template>
    <AuthLayout variant="page">
        <template #cta>
            <Button v-if="authStore.isAuthenticated" as-child class="h-11 md:h-9">
                <RouterLink to="/tea/dashboard">Panele Git</RouterLink>
            </Button>
            <template v-else>
                <Button as-child variant="outline" class="h-11 md:h-9">
                    <RouterLink to="/login">Giriş Yap</RouterLink>
                </Button>
                <Button as-child class="h-11 md:h-9">
                    <RouterLink to="/register">Kayıt Ol</RouterLink>
                </Button>
            </template>
        </template>

        <div class="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-12 md:gap-16 md:px-6 md:py-20">
            <!-- Hero -->
            <section class="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
                <h1 class="text-3xl font-bold tracking-tight text-foreground md:text-5xl">
                    <span class="text-primary">Çay Üreticileri</span> için Dijital Platform
                </h1>
                <p class="text-base text-muted-foreground md:text-lg">
                    Tarlalarınızı yönetin, hasatlarınızı takip edin, ödemelerinizi kolayca kontrol edin.
                </p>
                <div class="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                    <Button v-if="authStore.isAuthenticated" as-child size="lg" class="h-11">
                        <RouterLink to="/tea/dashboard">Panele Git</RouterLink>
                    </Button>
                    <template v-else>
                        <Button as-child size="lg" class="h-11">
                            <RouterLink to="/register">Hemen Başla</RouterLink>
                        </Button>
                        <Button as-child variant="outline" size="lg" class="h-11">
                            <RouterLink to="/login">Giriş Yap</RouterLink>
                        </Button>
                    </template>
                </div>
            </section>

            <!-- Features -->
            <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Özellikler">
                <Card v-for="feature in features" :key="feature.title">
                    <CardHeader>
                        <span class="mb-2 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden="true">
                            <component :is="feature.icon" class="size-5" />
                        </span>
                        <CardTitle>{{ feature.title }}</CardTitle>
                        <CardDescription>{{ feature.description }}</CardDescription>
                    </CardHeader>
                </Card>
            </section>
        </div>
    </AuthLayout>
</template>
