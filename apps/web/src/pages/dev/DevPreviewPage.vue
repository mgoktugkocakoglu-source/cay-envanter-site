<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import { installPreviewMocks } from '@/dev/previewMocks';

/** DEV-ONLY: renders an authenticated page with mocked stores. */
const PAGES: Record<string, ReturnType<typeof defineAsyncComponent>> = {
    fields: defineAsyncComponent(() => import('@/pages/FieldsPage.vue')),
    dashboard: defineAsyncComponent(() => import('@/pages/DashboardPage.vue')),
    harvests: defineAsyncComponent(() => import('@/pages/HarvestsPage.vue')),
    payments: defineAsyncComponent(() => import('@/pages/PaymentsPage.vue')),
    pruning: defineAsyncComponent(() => import('@/pages/PruningPage.vue')),
    settings: defineAsyncComponent(() => import('@/pages/SettingsPage.vue')),
    'ai-agent': defineAsyncComponent(() => import('@/pages/TeaAiAgentPage.vue')),
    'field-detail': defineAsyncComponent(() => import('@/pages/FieldDetailPage.vue')),
    'fields-create': defineAsyncComponent(() => import('@/pages/FieldsCreatePage.vue')),
    admin: defineAsyncComponent(() => import('@/pages/AdminPage.vue')),
    'admin-users': defineAsyncComponent(() => import('@/pages/AdminUsersPage.vue')),
    'admin-firms': defineAsyncComponent(() => import('@/pages/AdminFirmsPage.vue')),
    'caykur-fields': defineAsyncComponent(() => import('@/pages/caykur/CaykurFieldsPage.vue')),
    'caykur-pruning': defineAsyncComponent(() => import('@/pages/caykur/CaykurPruningPage.vue')),
    'caykur-requests': defineAsyncComponent(() => import('@/pages/caykur/CaykurPruningRequestsPage.vue')),
    'caykur-request-detail': defineAsyncComponent(() => import('@/pages/caykur/CaykurPruningRequestDetailPage.vue')),
    notifications: defineAsyncComponent(() => import('@/pages/NotificationsPage.vue')),
};

installPreviewMocks();

const route = useRoute();
const page = computed(() => PAGES[String(route.params.page)]);
</script>

<template>
    <component :is="page" v-if="page" />
    <p v-else class="p-6 text-sm text-muted-foreground">Bilinmeyen önizleme sayfası.</p>
</template>
