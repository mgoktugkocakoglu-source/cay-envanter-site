import { useAuthStore } from '@/stores/authStore';

const API_BASE = '/api';

interface ApiError {
    message: string;
    statusCode: number;
}

interface ApiResponse<T> {
    data?: T;
    error?: ApiError;
}

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshTokenIfNeeded(): Promise<boolean> {
    if (isRefreshing && refreshPromise) {
        return refreshPromise;
    }

    isRefreshing = true;
    refreshPromise = (async () => {
        try {
            const authStore = useAuthStore();
            const result = await authStore.refreshAccessToken();
            return !!result;
        } finally {
            isRefreshing = false;
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

async function request<T>(
    endpoint: string,
    options: RequestInit = {},
    _retryCount = 0
): Promise<ApiResponse<T>> {
    const authStore = useAuthStore();
    const token = authStore.accessToken;

    const config: RequestInit = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    };

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, config);

        // Handle 401 - try to refresh token and retry once
        if (response.status === 401 && _retryCount === 0 && authStore.refreshToken) {
            const refreshed = await refreshTokenIfNeeded();
            if (refreshed) {
                // Retry the request with new token
                return request<T>(endpoint, options, 1);
            } else {
                // Refresh failed, redirect to login
                window.location.href = '/login';
                return {
                    error: {
                        message: 'Session expired. Please login again.',
                        statusCode: 401,
                    },
                };
            }
        }

        const data = await response.json();

        if (!response.ok) {
            return {
                error: {
                    message: data.message || 'An error occurred',
                    statusCode: response.status,
                },
            };
        }

        return { data };
    } catch (error) {
        return {
            error: {
                message: 'Network error. Please check your connection.',
                statusCode: 0,
            },
        };
    }
}

// Types
export interface Field {
    id: string;
    name: string;
    province: string;
    district: string;
    neighborhood: string;
    parcelNo: string | null;
    coordinates: number[][][];
    area: number;
    areaUnit: 'donum' | 'dekar' | 'm2';
    partnerCount: number;
    notes: string | null;
    partners: FieldPartner[];
    createdAt: string;
    updatedAt: string;
}

export interface FieldPartner {
    id: string;
    partnerName: string;
    sharePercentage: number;
    isPrimaryOwner: boolean;
}

export interface Harvest {
    id: string;
    fieldId: string;
    fieldName?: string;
    harvestDate: string;
    amountKg: number;
    quality: 'shoot' | 'leaf' | 'mixed' | null;
    notes: string | null;
    soldAmountKg?: number;
    remainingKg?: number;
    status?: 'sold' | 'partial' | 'pending';
}

export interface Payment {
    id: string;
    totalAmountKg: number;
    totalPrice: number;
    pricePerKg: number;
    brokerFirm: { id: string; firmName: string } | null;
    paymentDate: string;
    paymentStatus: 'received' | 'pending';
    notes: string | null;
    harvestCount?: number;
}

export interface BrokerFirm {
    id: string;
    firmName: string;
}

export interface GeoProvince {
    id: string;
    name: string;
    bounds: number[][][];
}

export interface GeoDistrict {
    id: string;
    name: string;
    bounds: number[][][];
}

export interface GeoNeighborhood {
    id: string;
    name: string;
    bounds: number[][][];
}

export interface GeoParcel {
    id: string;
    parcelNo: string;
    polygon: number[][][];
    area: number;
}

export interface GeoParcelDetail {
    polygon: number[][][];
    properties: {
        ilAd: string;
        ilceAd: string;
        mahalleAd: string;
        parselNo: string;
        adaNo: string;
        alan: string;
        nitelik: string;
        ozet: string;
        pafta: string;
        mevkii: string;
        ilId: number;
        ilceId: number;
        mahalleId: number;
    };
}

export interface YearlySummary {
    year: number;
    totalIncome: number;
    totalHarvestKg: number;
    averagePricePerKg: number;
    activeFieldCount: number;
    harvestCount: number;
    paymentCount: number;
}

export interface MonthlyData {
    month: number;
    monthName: string;
    income: number;
    harvestKg: number;
    harvestCount: number;
}

export interface FieldProfitability {
    fieldId: string;
    fieldName: string;
    area: number;
    areaUnit: string;
    totalHarvestKg: number;
    totalIncome: number;
    harvestPerArea: number;
    incomePerArea: number;
    performanceScore: number;
}

// Forum Types
export interface ForumCategory {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    displayOrder: number;
    isActive: boolean;
    topicCount?: number;
    latestTopic?: {
        id: string;
        title: string;
        createdAt: string;
        author: { id: string; fullName: string };
    };
}

export interface ForumTopic {
    id: string;
    title: string;
    slug: string;
    content: string;
    viewCount: number;
    replyCount: number;
    isPinned: boolean;
    isLocked: boolean;
    isSolved: boolean;
    categoryId: string;
    category?: { id: string; name: string; slug: string };
    authorId: string;
    author?: { id: string; fullName: string };
    createdAt: string;
    updatedAt: string;
    latestReply?: {
        id: string;
        content: string;
        createdAt: string;
        author: { id: string; fullName: string };
    };
    reactions?: ForumReactionStats;
    isSubscribed?: boolean;
}

export interface ForumReply {
    id: string;
    content: string;
    isSolution: boolean;
    topicId: string;
    authorId: string;
    author?: { id: string; fullName: string };
    parentId: string | null;
    replies?: ForumReply[];
    createdAt: string;
    updatedAt: string;
    reactions?: ForumReactionStats;
}

export type ReactionType = 'like' | 'helpful' | 'thanks';

export interface ForumReactionStats {
    like: number;
    helpful: number;
    thanks: number;
    userReaction?: ReactionType | null;
}

export interface ForumSubscription {
    id: string;
    topicId: string;
    userId: string;
    createdAt: string;
}

export interface ForumTopicListQuery {
    page?: number;
    limit?: number;
    categoryId?: string;
    authorId?: string;
    search?: string;
    sortBy?: 'createdAt' | 'updatedAt' | 'lastActivityAt' | 'viewCount' | 'replyCount';
    isPinned?: boolean;
    isSolved?: boolean;
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export const api = {
    // Auth endpoints
    register: (data: {
        fullName: string;
        email: string;
        password: string;
        phone: string;
        province: string;
        district: string;
        farmerIdNumber?: string;
    }) => request<{ message: string; email: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    login: (data: { email: string; password: string; rememberMe?: boolean }) =>
        request<{ accessToken: string; refreshToken: string; user: { id: string; email: string; fullName: string } }>(
            '/auth/login',
            { method: 'POST', body: JSON.stringify(data) }
        ),

    verifyEmail: (token: string) =>
        request<{ message: string }>(`/auth/verify-email?token=${token}`),

    resendVerification: (email: string) =>
        request<{ message: string }>('/auth/resend-verification', {
            method: 'POST',
            body: JSON.stringify({ email }),
        }),

    forgotPassword: (email: string) =>
        request<{ message: string }>('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email }),
        }),

    validateResetToken: (token: string) =>
        request<{ valid: boolean }>(`/auth/validate-reset-token?token=${token}`),

    resetPassword: (token: string, newPassword: string) =>
        request<{ message: string }>('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, newPassword }),
        }),

    changePassword: (currentPassword: string, newPassword: string) =>
        request<{ message: string }>('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword }),
        }),

    requestDeletion: (email: string) =>
        request<{ message: string }>('/auth/request-deletion', {
            method: 'POST',
            body: JSON.stringify({ email }),
        }),

    validateDeletionToken: (token: string) =>
        request<{ valid: boolean; userData?: Record<string, unknown> }>(
            `/auth/validate-deletion-token?token=${token}`
        ),

    deleteAccount: (token: string) =>
        request<{ message: string }>('/auth/delete-account', {
            method: 'POST',
            body: JSON.stringify({ token }),
        }),

    // Geo endpoints
    getProvinces: () => request<GeoProvince[]>('/geo/provinces'),
    getDistricts: (provinceId: string) => request<GeoDistrict[]>(`/geo/districts/${provinceId}`),
    getNeighborhoods: (districtId: string) => request<GeoNeighborhood[]>(`/geo/neighborhoods/${districtId}`),
    getParcels: (neighborhoodId: string) => request<GeoParcel[]>(`/geo/parcels/${neighborhoodId}`),
    getParcelByCoordinates: (lat: number, lng: number) => request<GeoParcelDetail | null>(`/geo/parcel/${lat}/${lng}`),

    // Fields endpoints
    getFields: (params?: { province?: string; search?: string; sortBy?: string; sortOrder?: string }) => {
        const query = new URLSearchParams(params as Record<string, string>).toString();
        return request<Field[]>(`/fields${query ? `?${query}` : ''}`);
    },
    getField: (id: string) => request<Field>(`/fields/${id}`),
    createField: (data: Partial<Field> & { partners?: Partial<FieldPartner>[] }) =>
        request<Field>('/fields', { method: 'POST', body: JSON.stringify(data) }),
    updateField: (id: string, data: Partial<Field>) =>
        request<Field>(`/fields/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteField: (id: string) => request<void>(`/fields/${id}`, { method: 'DELETE' }),
    restoreField: (id: string) => request<Field>(`/fields/${id}/restore`, { method: 'POST' }),
    getFieldPartners: (fieldId: string) => request<FieldPartner[]>(`/fields/${fieldId}/partners`),
    addFieldPartner: (fieldId: string, data: Partial<FieldPartner>) =>
        request<FieldPartner>(`/fields/${fieldId}/partners`, { method: 'POST', body: JSON.stringify(data) }),
    updateFieldPartner: (fieldId: string, partnerId: string, data: Partial<FieldPartner>) =>
        request<FieldPartner>(`/fields/${fieldId}/partners/${partnerId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    removeFieldPartner: (fieldId: string, partnerId: string) =>
        request<void>(`/fields/${fieldId}/partners/${partnerId}`, { method: 'DELETE' }),

    // Harvests endpoints
    getHarvests: (params?: { fieldId?: string; year?: number; status?: string }) => {
        const query = new URLSearchParams(params as Record<string, string>).toString();
        return request<Harvest[]>(`/harvests${query ? `?${query}` : ''}`);
    },
    getHarvest: (id: string) => request<Harvest>(`/harvests/${id}`),
    getAvailableHarvests: () => request<Harvest[]>('/harvests/available'),
    createHarvest: (data: { fieldId: string; harvestDate: string; amountKg: number; quality?: string; notes?: string }) =>
        request<Harvest>('/harvests', { method: 'POST', body: JSON.stringify(data) }),
    updateHarvest: (id: string, data: Partial<Harvest>) =>
        request<Harvest>(`/harvests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteHarvest: (id: string) => request<void>(`/harvests/${id}`, { method: 'DELETE' }),
    getHarvestRemaining: (id: string) => request<{ remainingKg: number }>(`/harvests/${id}/remaining`),

    // Payments endpoints
    getPayments: (params?: { brokerFirmId?: string; year?: number; paymentStatus?: string }) => {
        const query = new URLSearchParams(params as Record<string, string>).toString();
        return request<Payment[]>(`/payments${query ? `?${query}` : ''}`);
    },
    getPayment: (id: string) => request<Payment>(`/payments/${id}`),
    createPayment: (data: {
        harvestAllocations: { harvestId: string; usedAmountKg: number }[];
        totalPrice: number;
        brokerFirmId?: string;
        paymentDate: string;
        paymentStatus: 'received' | 'pending';
        notes?: string;
    }) => request<Payment>('/payments', { method: 'POST', body: JSON.stringify(data) }),
    updatePayment: (id: string, data: Partial<Payment>) =>
        request<Payment>(`/payments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deletePayment: (id: string) => request<void>(`/payments/${id}`, { method: 'DELETE' }),

    // Broker firms endpoints
    getBrokerFirms: () => request<BrokerFirm[]>('/broker-firms'),
    createBrokerFirm: (firmName: string) =>
        request<BrokerFirm>('/broker-firms', { method: 'POST', body: JSON.stringify({ firmName }) }),

    // Reports endpoints
    getYearlySummary: (year?: number) => {
        const query = year ? `?year=${year}` : '';
        return request<YearlySummary>(`/reports/yearly-summary${query}`);
    },
    getMonthlyIncome: (year?: number) => {
        const query = year ? `?year=${year}` : '';
        return request<MonthlyData[]>(`/reports/monthly-income${query}`);
    },
    getMonthlyHarvest: (year?: number) => {
        const query = year ? `?year=${year}` : '';
        return request<MonthlyData[]>(`/reports/monthly-harvest${query}`);
    },
    getFieldProfitability: (year?: number) => {
        const query = year ? `?year=${year}` : '';
        return request<FieldProfitability[]>(`/reports/field-profitability${query}`);
    },
    getYearComparison: (years?: number[]) => {
        const query = years ? `?years=${years.join(',')}` : '';
        return request<unknown[]>(`/reports/year-comparison${query}`);
    },

    // Forum Categories
    getForumCategories: () => request<ForumCategory[]>('/forum/categories'),
    getForumCategory: (id: string) => request<ForumCategory>(`/forum/categories/${id}`),
    createForumCategory: (data: { name: string; description?: string; icon?: string; displayOrder?: number }) =>
        request<ForumCategory>('/forum/categories', { method: 'POST', body: JSON.stringify(data) }),
    updateForumCategory: (id: string, data: { name?: string; description?: string; icon?: string; displayOrder?: number; isActive?: boolean }) =>
        request<ForumCategory>(`/forum/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteForumCategory: (id: string) => request<void>(`/forum/categories/${id}`, { method: 'DELETE' }),

    // Forum Topics
    getForumTopics: (query?: ForumTopicListQuery) => {
        const params = new URLSearchParams();
        if (query?.page) params.append('page', query.page.toString());
        if (query?.limit) params.append('limit', query.limit.toString());
        if (query?.categoryId) params.append('categoryId', query.categoryId);
        if (query?.authorId) params.append('authorId', query.authorId);
        if (query?.search) params.append('search', query.search);
        if (query?.sortBy) params.append('sortBy', query.sortBy);
        if (query?.isPinned !== undefined) params.append('isPinned', query.isPinned.toString());
        if (query?.isSolved !== undefined) params.append('isSolved', query.isSolved.toString());
        const queryString = params.toString();
        return request<PaginatedResponse<ForumTopic>>(`/forum/topics${queryString ? `?${queryString}` : ''}`);
    },
    getForumTopic: (id: string) => request<ForumTopic>(`/forum/topics/${id}`),
    createForumTopic: (data: { title: string; content: string; categoryId: string }) =>
        request<ForumTopic>('/forum/topics', { method: 'POST', body: JSON.stringify(data) }),
    updateForumTopic: (id: string, data: { title?: string; content?: string }) =>
        request<ForumTopic>(`/forum/topics/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteForumTopic: (id: string) => request<void>(`/forum/topics/${id}`, { method: 'DELETE' }),
    pinForumTopic: (id: string) => request<ForumTopic>(`/forum/topics/${id}/pin`, { method: 'PATCH' }),
    lockForumTopic: (id: string) => request<ForumTopic>(`/forum/topics/${id}/lock`, { method: 'PATCH' }),
    solveForumTopic: (id: string) => request<ForumTopic>(`/forum/topics/${id}/solve`, { method: 'PATCH' }),

    // Forum Replies
    getForumReplies: (topicId: string) => request<ForumReply[]>(`/forum/topics/${topicId}/replies`),
    createForumReply: (topicId: string, data: { content: string; parentReplyId?: string }) =>
        request<ForumReply>(`/forum/topics/${topicId}/replies`, { method: 'POST', body: JSON.stringify(data) }),
    updateForumReply: (id: string, content: string) =>
        request<ForumReply>(`/forum/replies/${id}`, { method: 'PATCH', body: JSON.stringify({ content }) }),
    deleteForumReply: (id: string) => request<void>(`/forum/replies/${id}`, { method: 'DELETE' }),
    markReplyAsSolution: (id: string) =>
        request<ForumReply>(`/forum/replies/${id}/solution`, { method: 'PATCH' }),

    // Forum Reactions
    toggleForumReaction: (data: { targetType: 'topic' | 'reply'; targetId: string; reactionType: ReactionType }) =>
        request<{ success: boolean }>('/forum/reactions', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    getForumReactionStats: (targetType: 'topic' | 'reply', targetId: string) =>
        request<ForumReactionStats>(`/forum/reactions/stats?targetType=${targetType}&targetId=${targetId}`),

    // Forum Subscriptions
    subscribeToTopic: (topicId: string) =>
        request<ForumSubscription>(`/forum/topics/${topicId}/subscribe`, {
            method: 'POST',
            body: JSON.stringify({ topicId }),
        }),
    unsubscribeFromTopic: (topicId: string) =>
        request<void>(`/forum/topics/${topicId}/unsubscribe`, { method: 'POST' }),
    getUserSubscriptions: () => request<ForumSubscription[]>('/forum/subscriptions'),
};
