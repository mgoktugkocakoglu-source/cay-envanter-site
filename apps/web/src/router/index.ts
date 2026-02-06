import { createRouter, createWebHistory } from 'vue-router';
import { authGuard } from '@/router/guards/authGuard';

const router = createRouter({
    history: createWebHistory(),
    routes: [
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
        {
            path: '/forum',
            name: 'forum',
            component: () => import('@/pages/ForumPage.vue'),
        },
        {
            path: '/forum/category/:slug',
            name: 'forum-category',
            component: () => import('@/pages/ForumCategoryPage.vue'),
        },
        {
            path: '/forum/topic/:slug',
            name: 'forum-topic',
            component: () => import('@/pages/ForumTopicPage.vue'),
        },
        {
            path: '/forum/create',
            name: 'forum-create',
            component: () => import('@/pages/ForumCreateTopicPage.vue'),
            meta: { requiresAuth: true },
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
            path: '/admin/categories',
            name: 'admin-categories',
            component: () => import('@/pages/AdminCategoriesPage.vue'),
            meta: { requiresAuth: true },
        },
    ],
});

// Apply auth guard globally
router.beforeEach(authGuard);

export default router;
