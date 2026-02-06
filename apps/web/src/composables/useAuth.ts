import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

interface LoginCredentials {
    email: string;
    password: string;
}

interface RegisterData {
    fullName: string;
    email: string;
    password: string;
    phone: string;
    province: string;
    district: string;
    farmerIdNumber?: string;
}

/**
 * Auth composable for handling authentication operations
 * Provides login, logout, register methods with loading/error states
 */
export function useAuth() {
    const router = useRouter();
    const authStore = useAuthStore();

    const isLoading = ref(false);
    const error = ref<string | null>(null);

    const isAuthenticated = computed(() => authStore.isAuthenticated);
    const user = computed(() => authStore.user);

    async function login(credentials: LoginCredentials): Promise<boolean> {
        isLoading.value = true;
        error.value = null;

        try {
            const result = await authStore.login(credentials.email, credentials.password);

            if (result.success) {
                router.push('/dashboard');
                return true;
            } else {
                error.value = result.error || 'Login failed';
                return false;
            }
        } catch (e) {
            error.value = 'An unexpected error occurred';
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    async function logout(): Promise<void> {
        isLoading.value = true;

        try {
            await authStore.logout();
            router.push('/login');
        } finally {
            isLoading.value = false;
        }
    }

    async function register(data: RegisterData): Promise<{ success: boolean; message?: string }> {
        isLoading.value = true;
        error.value = null;

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                error.value = result.message || 'Registration failed';
                return { success: false, message: error.value ?? undefined };
            }

            return { success: true, message: result.message };
        } catch (e) {
            error.value = 'Network error. Please check your connection.';
            return { success: false, message: error.value };
        } finally {
            isLoading.value = false;
        }
    }

    async function forgotPassword(email: string): Promise<{ success: boolean; message?: string }> {
        isLoading.value = true;
        error.value = null;

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const result = await response.json();

            if (!response.ok) {
                error.value = result.message || 'Request failed';
                return { success: false, message: error.value ?? undefined };
            }

            return { success: true, message: result.message };
        } catch (e) {
            error.value = 'Network error. Please check your connection.';
            return { success: false, message: error.value };
        } finally {
            isLoading.value = false;
        }
    }

    function clearError(): void {
        error.value = null;
    }

    return {
        // State
        isLoading,
        error,
        // Computed
        isAuthenticated,
        user,
        // Actions
        login,
        logout,
        register,
        forgotPassword,
        clearError,
    };
}
