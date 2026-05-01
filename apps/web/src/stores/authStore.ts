import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type UserType = 'land_owner' | 'worker' | 'self_farmer';
export type UserRole = 'user' | 'admin' | 'moderator';

interface User {
    id: string;
    email: string;
    fullName: string;
    userType: UserType;
    role: UserRole;
    phone: string;
    province: string;
    district: string;
    avatarUrl?: string | null;
}

interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user: User;
}

// Capacitor (native) build'de mutlak URL gereklidir; web'de Vite proxy '/api' yeterlidir
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const useAuthStore = defineStore('auth', () => {
    // State - access token in memory only for security
    const user = ref<User | null>(null);
    const accessToken = ref<string | null>(null);
    const refreshToken = ref<string | null>(localStorage.getItem('refresh_token'));
    const isLoading = ref(false);
    const isRefreshing = ref(false);
    let refreshPromise: Promise<AuthTokens | null> | null = null;
    let initializePromise: Promise<void> | null = null;

    // Computed
    const isAuthenticated = computed(() => !!accessToken.value);
    const hasRefreshToken = computed(() => !!refreshToken.value);
    const isAdmin = computed(() => user.value?.role === 'admin');

    // Initialize - try to get user if we have a refresh token
    // Uses a shared promise to prevent race conditions from multiple callers
    async function initialize(): Promise<void> {
        if (initializePromise) {
            return initializePromise;
        }

        if (refreshToken.value && !accessToken.value) {
            initializePromise = (async () => {
                await refreshAccessToken();
                if (accessToken.value) {
                    await fetchCurrentUser();
                }
            })();

            try {
                await initializePromise;
            } finally {
                initializePromise = null;
            }
        }
    }

    // Set auth data after login
    function setAuth(authData: AuthResponse): void {
        accessToken.value = authData.accessToken;
        refreshToken.value = authData.refreshToken;
        user.value = authData.user;
        // Store only refresh token in localStorage
        localStorage.setItem('refresh_token', authData.refreshToken);
    }

    // Get access token - will auto-refresh if needed
    async function getAccessToken(): Promise<string | null> {
        if (accessToken.value) {
            return accessToken.value;
        }

        // If we have refresh token but no access token, try to refresh
        if (refreshToken.value) {
            await refreshAccessToken();
        }

        return accessToken.value;
    }

    // Refresh access token
    async function refreshAccessToken(): Promise<AuthTokens | null> {
        if (!refreshToken.value) {
            return null;
        }

        // If already refreshing, wait for that promise
        if (isRefreshing.value && refreshPromise) {
            return refreshPromise;
        }

        isRefreshing.value = true;

        refreshPromise = (async () => {
            try {
                const response = await fetch(`${API_BASE}/auth/refresh`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ refreshToken: refreshToken.value }),
                });

                if (!response.ok) {
                    // Refresh token is invalid, logout
                    logout();
                    return null;
                }

                const data = await response.json() as AuthTokens;
                accessToken.value = data.accessToken;
                refreshToken.value = data.refreshToken;
                localStorage.setItem('refresh_token', data.refreshToken);

                return data;
            } catch (error) {
                console.error('Token refresh failed:', error);
                logout();
                return null;
            } finally {
                isRefreshing.value = false;
                refreshPromise = null;
            }
        })();

        return refreshPromise;
    }

    // Fetch current user
    async function fetchCurrentUser(): Promise<User | null> {
        const token = await getAccessToken();
        if (!token) return null;

        try {
            const response = await fetch(`${API_BASE}/auth/me`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // Try to refresh and retry once
                    const refreshed = await refreshAccessToken();
                    if (refreshed) {
                        return fetchCurrentUser();
                    }
                }
                return null;
            }

            const userData = await response.json() as User;
            user.value = userData;
            return userData;
        } catch (error) {
            console.error('Failed to fetch current user:', error);
            return null;
        }
    }

    // Login
    async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
        isLoading.value = true;

        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: data.message || 'Login failed',
                };
            }

            setAuth(data as AuthResponse);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: 'Network error. Please check your connection.',
            };
        } finally {
            isLoading.value = false;
        }
    }

    // Logout
    async function logout(): Promise<void> {
        // Call logout API if we have a token
        if (accessToken.value) {
            try {
                await fetch(`${API_BASE}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken.value}`,
                    },
                });
            } catch {
                // Ignore errors on logout
            }
        }

        // Clear state
        accessToken.value = null;
        refreshToken.value = null;
        user.value = null;
        localStorage.removeItem('refresh_token');
    }

    return {
        // State
        user,
        accessToken,
        refreshToken,
        isLoading,
        isRefreshing,
        // Computed
        isAuthenticated,
        hasRefreshToken,
        isAdmin,
        // Actions
        initialize,
        setAuth,
        getAccessToken,
        refreshAccessToken,
        fetchCurrentUser,
        login,
        logout,
    };
});
