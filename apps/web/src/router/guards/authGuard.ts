import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { canAccess, type CaykurRole, type ModuleKey } from '@/services/caykur/roles';

/**
 * Navigation guard for protected routes.
 *
 * Gates by three signals on route meta:
 *  - requiresAuth: must be logged in
 *  - requiresAdmin: platform admin only (e.g. /admin/*)
 *  - module: a Çaykur panel module — allowed for admins or staff whose
 *    caykurRole grants that module (mirrors the backend CaykurRolesGuard)
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

    // Ensure the user object is loaded before any role-based decision.
    if ((to.meta.requiresAdmin || to.meta.module) && !authStore.user) {
        await authStore.fetchCurrentUser();
    }

    // Platform-admin-only routes (no module → e.g. /admin/*).
    if (to.meta.requiresAdmin && !to.meta.module) {
        if (!authStore.isAdmin) {
            next({ path: authStore.homeRoute });
            return;
        }
    }

    // Çaykur panel module routes: admin or a caykurRole that grants the module.
    if (to.meta.module) {
        const user = authStore.user;
        const moduleKey = to.meta.module as ModuleKey;
        const allowed =
            !!user &&
            (user.role === 'admin' ||
                (!!user.caykurRole && canAccess(user.caykurRole as CaykurRole, moduleKey)));
        if (!allowed) {
            next({ path: authStore.homeRoute });
            return;
        }
    }

    // Check if route is for guests only (login, register)
    if (to.meta.guest && authStore.isAuthenticated) {
        next({ path: authStore.homeRoute });
        return;
    }

    next();
}
