import { createRouter, createWebHistory } from 'vue-router';
import { authGuard } from '@/router/guards/authGuard';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            name: 'home',
            redirect: '/dashboard',
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
            path: '/dashboard',
            name: 'dashboard',
            component: () => import('@/pages/DashboardPage.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/settings',
            name: 'settings',
            component: () => import('@/pages/SettingsPage.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/fields',
            name: 'fields',
            component: () => import('@/pages/FieldsPage.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/fields/create',
            name: 'fields-create',
            component: () => import('@/pages/FieldsCreatePage.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/fields/:id',
            name: 'field-detail',
            component: () => import('@/pages/FieldDetailPage.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/firms',
            name: 'firms',
            component: () => import('@/pages/FirmsPage.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/firms/:id',
            name: 'firm-detail',
            component: () => import('@/pages/FirmDetailPage.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/harvests',
            name: 'harvests',
            component: () => import('@/pages/HarvestsPage.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/payments',
            name: 'payments',
            component: () => import('@/pages/PaymentsPage.vue'),
            meta: { requiresAuth: true },
        },
        // Job Listings Routes
        {
            path: '/job-listings',
            name: 'job-listings',
            component: () => import('@/pages/JobListingsPage.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/job-listings/worker/create',
            name: 'worker-listing-category',
            component: () => import('@/pages/WorkerListingCategoryPage.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/job-listings/job/create',
            name: 'job-listing-category',
            component: () => import('@/pages/JobListingCategoryPage.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/job-listings/worker/create/tea-picking',
            name: 'tea-picking-worker-create',
            component: () => import('@/pages/TeaPickingWorkerCreatePage.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/job-listings/job/create/tea-picking',
            name: 'tea-picking-job-create',
            component: () => import('@/pages/TeaPickingJobCreatePage.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/job-listings/worker/create/tea-transport',
            name: 'tea-transport-worker-create',
            component: () => import('@/pages/TeaTransportWorkerCreatePage.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/job-listings/job/create/tea-transport',
            name: 'tea-transport-job-create',
            component: () => import('@/pages/TeaTransportJobCreatePage.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/job-listings/worker/create/daily-jobs',
            name: 'daily-jobs-worker-create',
            component: () => import('@/pages/DailyJobsWorkerCreatePage.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/job-listings/job/create/daily-jobs',
            name: 'daily-jobs-job-create',
            component: () => import('@/pages/DailyJobsJobCreatePage.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/community',
            name: 'community',
            component: () => import('@/pages/CommunityFeedPage.vue'),
        },
        {
            path: '/community/post/:id',
            name: 'community-post',
            component: () => import('@/pages/CommunityPostPage.vue'),
        },
        // Admin Routes
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
        // 404 catch-all route
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
