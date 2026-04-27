import { useAuthStore, UserType } from '@/stores/authStore';

// Capacitor (native) build'de mutlak URL gereklidir; web'de Vite proxy '/api' yeterlidir
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

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

        const contentType = response.headers.get('content-type');
        const data = contentType?.includes('application/json') ? await response.json() : null;

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
    amountKg: string;
    quality: 'shoot' | 'leaf' | 'mixed' | null;
    notes: string | null;
    soldAmountKg?: string;
    remainingKg?: string;
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

export interface Session {
    id: string;
    userAgent: string;
    ipAddress: string;
    deviceType: string;
    browser: string;
    os: string;
    location: string;
    isActive: boolean;
    lastActivityAt: string;
    expiresAt: string;
    createdAt: string;
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

// Firm Types
export interface Firm {
    id: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    isActive: boolean;
    tariffs?: FirmTariff[];
    collectionPoints?: FirmCollectionPoint[];
    createdAt: string;
    updatedAt: string;
}

export type PaymentTerm = 'cash' | 'weekly' | 'monthly' | 'custom';

export interface TariffSplitDetail {
    percentage: number;
    paymentTerm: PaymentTerm;
    deferredMonths?: number;
    customPaymentDate?: string;
    pricePerKg: number;
}

export interface FirmTariff {
    id: string;
    firmId: string;
    paymentTerm: PaymentTerm;
    pricePerKg: number;
    effectiveDate: string;
    endDate: string | null;
    customPaymentDate: string | null;
    isSplitPayment: boolean;
    splitDetails: TariffSplitDetail[] | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface FirmCollectionPoint {
    id: string;
    firmId: string;
    name: string;
    province: string;
    district: string;
    address: string | null;
    description: string | null;
    latitude: number | null;
    longitude: number | null;
    collectorName: string | null;
    collectorPhone: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface FirmWithCurrentTariffs {
    id: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
    isActive: boolean;
    currentTariffs: {
        paymentTerm: PaymentTerm;
        pricePerKg: number;
        effectiveDate: string;
        isSplitPayment: boolean;
        splitDetails: TariffSplitDetail[] | null;
    }[];
}

// Community Types
export type CommunityPostType = 'text' | 'photo' | 'video';
export type CommunityReactionType = 'like' | 'dislike';

export interface CommunityTag {
    id: string;
    name: string;
    displayName: string;
    usageCount: number;
    isSystem: boolean;
    createdAt: string;
}

export interface CommunityPost {
    id: string;
    userId: string;
    content: string | null;
    type: CommunityPostType;
    mediaUrls: string[];
    likeCount: number;
    dislikeCount: number;
    commentCount: number;
    user: {
        id: string;
        fullName: string;
        avatarUrl: string | null;
        userType: string;
    };
    tags: CommunityTag[];
    userReaction?: CommunityReactionType | null;
    createdAt: string;
    updatedAt: string;
}

export interface CommunityComment {
    id: string;
    postId: string;
    userId: string;
    content: string;
    likeCount: number;
    dislikeCount: number;
    user: {
        id: string;
        fullName: string;
        avatarUrl: string | null;
    };
    createdAt: string;
}

export interface CommunityFeedResponse {
    items: CommunityPost[];
    nextCursor: string | null;
    hasMore: boolean;
    userReactions: Record<string, CommunityReactionType>;
}

export interface CommunityPostQuery {
    cursor?: string;
    limit?: number;
    type?: CommunityPostType;
    tag?: string;
    userId?: string;
    search?: string;
}

export interface CreateCommunityPostData {
    content?: string;
    type: CommunityPostType;
    mediaUrls?: string[];
    tagNames?: string[];
}

export const api = {
    // Auth endpoints
    register: (data: {
        userType: UserType;
        fullName: string;
        email: string;
        password: string;
        phone: string;
        province: string;
        district: string;
        farmerIdNumber: string;
    }) => request<{ message: string; email: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    login: (data: { email: string; password: string; rememberMe?: boolean }) =>
        request<{ accessToken: string; refreshToken: string; user: { id: string; email: string; fullName: string; userType: 'land_owner' | 'worker' | 'self_farmer'; phone: string; province: string; district: string; avatarUrl: string | null } }>(
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

    // Avatar endpoints
    uploadAvatar: async (file: File): Promise<ApiResponse<{ avatarUrl: string }>> => {
        const authStore = useAuthStore();
        const token = authStore.accessToken;
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE}/auth/avatar`, {
                method: 'PATCH',
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                return { error: { message: data.message || 'Avatar yuklenemedi', statusCode: response.status } };
            }

            return { data };
        } catch {
            return { error: { message: 'Baglanti hatasi', statusCode: 0 } };
        }
    },

    removeAvatar: () =>
        request<{ message: string }>('/auth/avatar', {
            method: 'DELETE',
        }),

    // Session endpoints
    getSessions: () =>
        request<Session[]>('/auth/sessions'),

    revokeSession: (sessionId: string) =>
        request<{ message: string }>(`/auth/sessions/${sessionId}`, {
            method: 'DELETE',
        }),

    revokeAllSessions: () =>
        request<{ message: string }>('/auth/sessions', {
            method: 'DELETE',
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

    // Firms endpoints
    getFirms: (params?: { search?: string; isActive?: boolean }) => {
        const query = new URLSearchParams(params as Record<string, string>).toString();
        return request<Firm[]>(`/firms${query ? `?${query}` : ''}`);
    },
    getFirm: (id: string) => request<Firm>(`/firms/${id}`),
    getFirmsWithTariffs: () => request<FirmWithCurrentTariffs[]>('/firms/with-tariffs'),
    getFirmTariffs: (firmId: string) => request<FirmTariff[]>(`/firms/${firmId}/tariffs`),
    getFirmCurrentTariffs: (firmId: string) => request<FirmTariff[]>(`/firms/${firmId}/tariffs/current`),
    getFirmCollectionPoints: (firmId: string, params?: { province?: string; district?: string }) => {
        const query = new URLSearchParams(params as Record<string, string>).toString();
        return request<FirmCollectionPoint[]>(`/firms/${firmId}/collection-points${query ? `?${query}` : ''}`);
    },
    createFirm: (data: Partial<Firm>) =>
        request<Firm>('/firms', { method: 'POST', body: JSON.stringify(data) }),
    updateFirm: (id: string, data: Partial<Firm>) =>
        request<Firm>(`/firms/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteFirm: (id: string) => request<void>(`/firms/${id}`, { method: 'DELETE' }),
    createFirmTariff: (firmId: string, data: Partial<FirmTariff>) =>
        request<FirmTariff>(`/firms/${firmId}/tariffs`, { method: 'POST', body: JSON.stringify(data) }),
    updateFirmTariff: (firmId: string, tariffId: string, data: Partial<FirmTariff>) =>
        request<FirmTariff>(`/firms/${firmId}/tariffs/${tariffId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteFirmTariff: (firmId: string, tariffId: string) =>
        request<void>(`/firms/${firmId}/tariffs/${tariffId}`, { method: 'DELETE' }),
    createFirmCollectionPoint: (firmId: string, data: Partial<FirmCollectionPoint>) =>
        request<FirmCollectionPoint>(`/firms/${firmId}/collection-points`, { method: 'POST', body: JSON.stringify(data) }),
    updateFirmCollectionPoint: (firmId: string, pointId: string, data: Partial<FirmCollectionPoint>) =>
        request<FirmCollectionPoint>(`/firms/${firmId}/collection-points/${pointId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteFirmCollectionPoint: (firmId: string, pointId: string) =>
        request<void>(`/firms/${firmId}/collection-points/${pointId}`, { method: 'DELETE' }),

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

    // Job Listings
    getJobListings: (params?: { type?: string; category?: string; status?: string; search?: string }) => {
        const query = new URLSearchParams(params as Record<string, string>).toString();
        return request<any[]>(`/job-listings${query ? `?${query}` : ''}`);
    },
    getJobListing: (id: string) => request<any>(`/job-listings/${id}`),
    createJobListing: (data: any) =>
        request<any>('/job-listings', { method: 'POST', body: JSON.stringify(data) }),
    updateJobListing: (id: string, data: any) =>
        request<any>(`/job-listings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteJobListing: (id: string) => request<void>(`/job-listings/${id}`, { method: 'DELETE' }),

    // Users
    searchUser: (query: string, type: 'tc' | 'phone') =>
        request<{ id: string; fullName: string; userType: string }>(
            `/users/search?query=${encodeURIComponent(query)}&type=${type}`
        ),

    // Uploads
    uploadImage: async (file: File): Promise<ApiResponse<{ url: string; filename: string }>> => {
        const authStore = useAuthStore();
        const token = authStore.accessToken;
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE}/uploads/image`, {
                method: 'POST',
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: formData,
            });

            const data = await response.json();
            if (!response.ok) {
                return { error: { message: data.message || 'Dosya yuklenemedi', statusCode: response.status } };
            }
            return { data };
        } catch {
            return { error: { message: 'Dosya yuklenirken hata olustu', statusCode: 0 } };
        }
    },

    // Community Posts
    getCommunityFeed: (query?: CommunityPostQuery) => {
        const params = new URLSearchParams();
        if (query?.cursor) params.append('cursor', query.cursor);
        if (query?.limit) params.append('limit', query.limit.toString());
        if (query?.type) params.append('type', query.type);
        if (query?.tag) params.append('tag', query.tag);
        if (query?.userId) params.append('userId', query.userId);
        if (query?.search) params.append('search', query.search);
        const queryString = params.toString();
        return request<CommunityFeedResponse>(`/community/posts${queryString ? `?${queryString}` : ''}`);
    },
    getCommunityPost: (id: string) => request<CommunityPost>(`/community/posts/${id}`),
    createCommunityPost: (data: CreateCommunityPostData) =>
        request<CommunityPost>('/community/posts', { method: 'POST', body: JSON.stringify(data) }),
    deleteCommunityPost: (id: string) =>
        request<{ message: string }>(`/community/posts/${id}`, { method: 'DELETE' }),

    // Community Tags
    getCommunityTags: () => request<CommunityTag[]>('/community/tags'),
    getTrendingTags: (limit?: number) =>
        request<CommunityTag[]>(`/community/tags/trending${limit ? `?limit=${limit}` : ''}`),

    // Community Comments
    getCommunityComments: (postId: string) =>
        request<CommunityComment[]>(`/community/posts/${postId}/comments`),
    createCommunityComment: (postId: string, content: string) =>
        request<CommunityComment>(`/community/posts/${postId}/comments`, {
            method: 'POST', body: JSON.stringify({ content }),
        }),
    deleteCommunityComment: (id: string) =>
        request<{ message: string }>(`/community/comments/${id}`, { method: 'DELETE' }),

    // Community Reactions
    toggleCommunityReaction: (data: { targetType: 'post' | 'comment'; targetId: string; reactionType: CommunityReactionType }) =>
        request<{ action: string; reactionType: CommunityReactionType }>('/community/reactions', {
            method: 'POST', body: JSON.stringify(data),
        }),

    // Community Media Upload
    uploadCommunityMedia: async (file: File): Promise<ApiResponse<{ url: string; filename: string }>> => {
        const authStore = useAuthStore();
        const token = authStore.accessToken;
        const formData = new FormData();
        formData.append('file', file);

        /** Use /uploads/video for video files, /uploads/image for images */
        const isVideo = file.type.startsWith('video/');
        const endpoint = isVideo ? '/uploads/video' : '/uploads/image';

        console.log('[uploadCommunityMedia] file:', file.name, 'type:', file.type, 'size:', file.size, 'isVideo:', isVideo, 'endpoint:', endpoint);

        try {
            const url = `${API_BASE}${endpoint}`;
            console.log('[uploadCommunityMedia] Sending fetch to:', url);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: formData,
            });

            console.log('[uploadCommunityMedia] Response status:', response.status);
            const data = await response.json();
            console.log('[uploadCommunityMedia] Response data:', data);
            if (!response.ok) {
                return { error: { message: data.message || 'Media upload failed', statusCode: response.status } };
            }
            return { data };
        } catch (err) {
            console.error('[uploadCommunityMedia] Error:', err);
            return { error: { message: 'Network error during media upload', statusCode: 0 } };
        }
    },
};
