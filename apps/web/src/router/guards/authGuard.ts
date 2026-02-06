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

    // Check if route requires auth
    if (to.meta.requiresAuth) {
        // If we have a refresh token but no access token, try to initialize
        if (authStore.refreshToken && !authStore.accessToken) {
            await authStore.initialize();
        }

        // Now check if authenticated
        if (!authStore.isAuthenticated) {
            // Redirect to login with return URL
            next({
                path: '/login',
                query: { redirect: to.fullPath },
            });
            return;
        }
    }

    // Check if route is for guests only (login, register)
    if (to.meta.guest && authStore.isAuthenticated) {
        next({ path: '/dashboard' });
        return;
    }

    next();
}
