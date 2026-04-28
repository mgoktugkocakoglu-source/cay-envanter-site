import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

/**
 * Navigation guard for protected routes
 * Checks authentication status and redirects to login if not authenticated
 */
export async function authGuard(
    to: RouteLocationNormalized,
    _from: RouteLocationNormalized,
    next: NavigationGuardNext
): Promise<void> {
    const authStore = useAuthStore();

    // If we have a refresh token but no access token, ensure initialization completes first
    if (authStore.hasRefreshToken && !authStore.isAuthenticated) {
        await authStore.initialize();
    }

    // Check if route requires auth
    if (to.meta.requiresAuth) {
        if (!authStore.isAuthenticated) {
            // Redirect to login with return URL
            next({
                path: '/login',
                query: { redirect: to.fullPath },
            });
            return;
        }
    }

    // Check admin-only routes after authentication has been established
    if (to.meta.requiresAdmin) {
        if (!authStore.user) {
            await authStore.fetchCurrentUser();
        }

        if (!authStore.isAdmin) {
            next({ path: '/hub' });
            return;
        }
    }

    // Check if route is for guests only (login, register)
    if (to.meta.guest && authStore.isAuthenticated) {
        next({ path: '/hub' });
        return;
    }

    next();
}
