import { createRouter, createWebHistory } from 'vue-router';
import { authGuard } from '@/router/guards/authGuard';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        // ═══════ AUTH & PUBLIC ROUTES ═══════
        {
            path: '/',
            name: 'home',
            component: () => import('@/pages/HomePage.vue'),
        },
        {
            path: '/register',
            name: 'register',
            component: () => import('@/pages/RegisterPage.vue'),
            meta: { guest: true },
        },
        {
            path: '/login',
            name: 'login',
            component: () => import('@/pages/LoginPage.vue'),
            meta: { guest: true },
        },
        {
            path: '/verify-email',
            name: 'verify-email',
            component: () => import('@/pages/VerifyEmailPage.vue'),
        },
        {
            path: '/forgot-password',
            name: 'forgot-password',
            component: () => import('@/pages/ForgotPasswordPage.vue'),
            meta: { guest: true },
        },
        {
            path: '/reset-password',
            name: 'reset-password',
            component: () => import('@/pages/ResetPasswordPage.vue'),
        },
        {
            path: '/confirm-deletion',
            name: 'confirm-deletion',
            component: () => import('@/pages/ConfirmDeletionPage.vue'),
        },
        {
            path: '/privacy-policy',
            name: 'privacy-policy',
            component: () => import('@/pages/PrivacyPolicyPage.vue'),
        },
        {
            path: '/gizlilik-politikasi',
            redirect: '/privacy-policy',
        },
        {
            path: '/delete-account',
            name: 'delete-account',
            component: () => import('@/pages/DeleteAccountPage.vue'),
        },
        {
            path: '/hesap-sil',
            redirect: '/delete-account',
        },

        // ═══════ HUB SELECTOR ═══════
        {
            path: '/hub',
            redirect: '/tea/dashboard',
        },

        // ═══════ ÇAY İŞLERİ HESABI (TEA BUSINESS HUB) ═══════
        {
            path: '/tea/dashboard',
            name: 'tea-dashboard',
            component: () => import('@/pages/DashboardPage.vue'),
            meta: { requiresAuth: true, hub: 'tea' },
        },
        {
            path: '/tea/fields',
            name: 'tea-fields',
            component: () => import('@/pages/FieldsPage.vue'),
            meta: { requiresAuth: true, hub: 'tea' },
        },
        {
            path: '/tea/fields/create',
            name: 'tea-fields-create',
            component: () => import('@/pages/FieldsCreatePage.vue'),
            meta: { requiresAuth: true, hub: 'tea' },
        },
        {
            path: '/tea/fields/:id/edit',
            name: 'tea-fields-edit',
            component: () => import('@/pages/FieldsCreatePage.vue'),
            meta: { requiresAuth: true, hub: 'tea' },
        },
        {
            path: '/tea/fields/:id',
            name: 'tea-field-detail',
            component: () => import('@/pages/FieldDetailPage.vue'),
            meta: { requiresAuth: true, hub: 'tea' },
        },
        {
            path: '/tea/firms',
            name: 'tea-firms',
            component: () => import('@/pages/FirmsPage.vue'),
            meta: { requiresAuth: true, hub: 'tea' },
        },
        {
            path: '/tea/firms/:id',
            name: 'tea-firm-detail',
            component: () => import('@/pages/FirmDetailPage.vue'),
            meta: { requiresAuth: true, hub: 'tea' },
        },
        {
            path: '/tea/harvests',
            name: 'tea-harvests',
            component: () => import('@/pages/HarvestsPage.vue'),
            meta: { requiresAuth: true, hub: 'tea' },
        },
        {
            path: '/tea/pruning',
            name: 'tea-pruning',
            component: () => import('@/pages/PruningPage.vue'),
            meta: { requiresAuth: true, hub: 'tea' },
        },
        {
            path: '/tea/payments',
            name: 'tea-payments',
            component: () => import('@/pages/PaymentsPage.vue'),
            meta: { requiresAuth: true, hub: 'tea' },
        },
        {
            path: '/tea/ai-agent',
            name: 'tea-ai-agent',
            component: () => import('@/pages/TeaAiAgentPage.vue'),
            meta: { requiresAuth: true, hub: 'tea' },
        },
        {
            path: '/tea/settings',
            name: 'tea-settings',
            component: () => import('@/pages/SettingsPage.vue'),
            meta: { requiresAuth: true, hub: 'tea' },
        },

        // ═══════ ADMIN ROUTES ═══════
        {
            path: '/admin',
            name: 'admin',
            component: () => import('@/pages/AdminPage.vue'),
            meta: { requiresAuth: true, requiresAdmin: true },
        },
        {
            path: '/admin/users',
            name: 'admin-users',
            component: () => import('@/pages/AdminUsersPage.vue'),
            meta: { requiresAuth: true, requiresAdmin: true },
        },
        {
            path: '/admin/firms',
            name: 'admin-firms',
            component: () => import('@/pages/AdminFirmsPage.vue'),
            meta: { requiresAuth: true, requiresAdmin: true },
        },

        // ═══════ ÇAYKUR COMMAND CENTER (MÜSTAHSİL İZLEME) ═══════
        {
            path: '/caykur',
            name: 'caykur-overview',
            component: () => import('@/pages/caykur/CaykurOverviewPage.vue'),
            meta: { requiresAuth: true, requiresAdmin: true },
        },
        {
            path: '/caykur/producers',
            name: 'caykur-producers',
            component: () => import('@/pages/caykur/CaykurProducersPage.vue'),
            meta: { requiresAuth: true, requiresAdmin: true },
        },
        {
            path: '/caykur/producers/:id',
            name: 'caykur-producer-detail',
            component: () => import('@/pages/caykur/CaykurProducerDetailPage.vue'),
            meta: { requiresAuth: true, requiresAdmin: true },
        },

        // ═══════ BACKWARD COMPATIBILITY REDIRECTS ═══════
        { path: '/dashboard', redirect: '/tea/dashboard' },
        { path: '/fields', redirect: '/tea/fields' },
        { path: '/fields/create', redirect: '/tea/fields/create' },
        { path: '/fields/:id/edit', redirect: to => `/tea/fields/${to.params.id}/edit` },
        { path: '/fields/:id', redirect: to => `/tea/fields/${to.params.id}` },
        { path: '/firms', redirect: '/tea/firms' },
        { path: '/firms/:id', redirect: to => `/tea/firms/${to.params.id}` },
        { path: '/harvests', redirect: '/tea/harvests' },
        { path: '/pruning', redirect: '/tea/pruning' },
        { path: '/payments', redirect: '/tea/payments' },
        { path: '/ai-agent', redirect: '/tea/ai-agent' },
        { path: '/settings', redirect: '/tea/settings' },

        // ═══════ 404 CATCH-ALL ═══════
        {
            path: '/:pathMatch(.*)*',
            name: 'not-found',
            component: () => import('@/pages/NotFoundPage.vue'),
        },
    ],
});

// Apply auth guard globally
router.beforeEach(authGuard);

export default router;
