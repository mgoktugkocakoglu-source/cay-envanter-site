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

        // ═══════ HUB SELECTOR ═══════
        {
            path: '/hub',
            name: 'hub-selector',
            component: () => import('@/pages/HubSelectorPage.vue'),
            meta: { requiresAuth: true },
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
            path: '/tea/payments',
            name: 'tea-payments',
            component: () => import('@/pages/PaymentsPage.vue'),
            meta: { requiresAuth: true, hub: 'tea' },
        },
        {
            path: '/tea/settings',
            name: 'tea-settings',
            component: () => import('@/pages/SettingsPage.vue'),
            meta: { requiresAuth: true, hub: 'tea' },
        },

        // ═══════ SOSYAL İŞ HESABI (SOCIAL BUSINESS HUB) ═══════
        {
            path: '/social/dashboard',
            name: 'social-dashboard',
            component: () => import('@/pages/SocialDashboardPage.vue'),
            meta: { requiresAuth: true, hub: 'social' },
        },
        {
            path: '/social/job-listings',
            name: 'social-job-listings',
            component: () => import('@/pages/JobListingsPage.vue'),
            meta: { requiresAuth: true, hub: 'social' },
        },
        {
            path: '/social/job-listings/worker/create',
            name: 'social-worker-listing-category',
            component: () => import('@/pages/WorkerListingCategoryPage.vue'),
            meta: { requiresAuth: true, hub: 'social' },
        },
        {
            path: '/social/job-listings/job/create',
            name: 'social-job-listing-category',
            component: () => import('@/pages/JobListingCategoryPage.vue'),
            meta: { requiresAuth: true, hub: 'social' },
        },
        {
            path: '/social/job-listings/worker/create/tea-picking',
            name: 'social-tea-picking-worker-create',
            component: () => import('@/pages/TeaPickingWorkerCreatePage.vue'),
            meta: { requiresAuth: true, hub: 'social' },
        },
        {
            path: '/social/job-listings/job/create/tea-picking',
            name: 'social-tea-picking-job-create',
            component: () => import('@/pages/TeaPickingJobCreatePage.vue'),
            meta: { requiresAuth: true, hub: 'social' },
        },
        {
            path: '/social/job-listings/worker/create/tea-transport',
            name: 'social-tea-transport-worker-create',
            component: () => import('@/pages/TeaTransportWorkerCreatePage.vue'),
            meta: { requiresAuth: true, hub: 'social' },
        },
        {
            path: '/social/job-listings/job/create/tea-transport',
            name: 'social-tea-transport-job-create',
            component: () => import('@/pages/TeaTransportJobCreatePage.vue'),
            meta: { requiresAuth: true, hub: 'social' },
        },
        {
            path: '/social/job-listings/worker/create/daily-jobs',
            name: 'social-daily-jobs-worker-create',
            component: () => import('@/pages/DailyJobsWorkerCreatePage.vue'),
            meta: { requiresAuth: true, hub: 'social' },
        },
        {
            path: '/social/job-listings/job/create/daily-jobs',
            name: 'social-daily-jobs-job-create',
            component: () => import('@/pages/DailyJobsJobCreatePage.vue'),
            meta: { requiresAuth: true, hub: 'social' },
        },
        {
            path: '/social/community',
            name: 'social-community',
            component: () => import('@/pages/CommunityFeedPage.vue'),
            meta: { requiresAuth: true, hub: 'social' },
        },
        {
            path: '/social/community/post/:id',
            name: 'social-community-post',
            component: () => import('@/pages/CommunityPostPage.vue'),
            meta: { requiresAuth: true, hub: 'social' },
        },
        {
            path: '/social/equipment',
            name: 'social-equipment',
            component: () => import('@/pages/EquipmentPage.vue'),
            meta: { requiresAuth: true, hub: 'social' },
        },
        {
            path: '/social/marketplace',
            name: 'social-marketplace',
            component: () => import('@/pages/MarketplacePage.vue'),
            meta: { requiresAuth: true, hub: 'social' },
        },
        {
            path: '/social/settings',
            name: 'social-settings',
            component: () => import('@/pages/SettingsPage.vue'),
            meta: { requiresAuth: true, hub: 'social' },
        },

        // ═══════ ADMIN ROUTES ═══════
        {
            path: '/admin',
            name: 'admin',
            component: () => import('@/pages/AdminPage.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/admin/users',
            name: 'admin-users',
            component: () => import('@/pages/AdminUsersPage.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/admin/firms',
            name: 'admin-firms',
            component: () => import('@/pages/FirmsPage.vue'),
            meta: { requiresAuth: true },
        },

        // ═══════ BACKWARD COMPATIBILITY REDIRECTS ═══════
        { path: '/dashboard', redirect: '/tea/dashboard' },
        { path: '/fields', redirect: '/tea/fields' },
        { path: '/fields/create', redirect: '/tea/fields/create' },
        { path: '/fields/:id', redirect: to => `/tea/fields/${to.params.id}` },
        { path: '/firms', redirect: '/tea/firms' },
        { path: '/firms/:id', redirect: to => `/tea/firms/${to.params.id}` },
        { path: '/harvests', redirect: '/tea/harvests' },
        { path: '/payments', redirect: '/tea/payments' },
        { path: '/settings', redirect: '/tea/settings' },
        { path: '/job-listings', redirect: '/social/job-listings' },
        { path: '/job-listings/worker/create', redirect: '/social/job-listings/worker/create' },
        { path: '/job-listings/job/create', redirect: '/social/job-listings/job/create' },
        { path: '/job-listings/worker/create/tea-picking', redirect: '/social/job-listings/worker/create/tea-picking' },
        { path: '/job-listings/job/create/tea-picking', redirect: '/social/job-listings/job/create/tea-picking' },
        { path: '/job-listings/worker/create/tea-transport', redirect: '/social/job-listings/worker/create/tea-transport' },
        { path: '/job-listings/job/create/tea-transport', redirect: '/social/job-listings/job/create/tea-transport' },
        { path: '/job-listings/worker/create/daily-jobs', redirect: '/social/job-listings/worker/create/daily-jobs' },
        { path: '/job-listings/job/create/daily-jobs', redirect: '/social/job-listings/job/create/daily-jobs' },
        { path: '/community', redirect: '/social/community' },
        { path: '/community/post/:id', redirect: to => `/social/community/post/${to.params.id}` },

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
