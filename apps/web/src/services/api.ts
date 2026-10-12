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
/**
 * Where a field stands on a hisseli (shared-title) parcel — derived server-side.
 *  - undetermined:     shared, nobody settled this owner's slice yet (red)
 *  - pending_approval: a boundary was drawn/measured; co-owners must confirm (yellow)
 *  - determined:       every co-owner approved (green, "Alan N")
 */
export type FieldBoundaryStatus = 'undetermined' | 'pending_approval' | 'determined';

/** Another producer registered on the same province + ada + parsel. */
export interface FieldCoOwner {
    userId: string;
    fullName: string;
    cuzdanNo: string | null;
    shareNo: number | null;
    boundaryDetermined: boolean;
}

export interface Field {
    id: string;
    userId: string;
    name: string;
    province: string;
    district: string;
    neighborhood: string;
    road: string | null;
    parcelNo: string | null;
    adaNo: string | null;
    coordinates: number[][][];
    area: number;
    areaUnit: 'donum' | 'dekar' | 'm2';
    partnerCount: number;
    notes: string | null;
    partners: FieldPartner[];
    /** Set once every co-owner approved this field's boundary. */
    boundaryMeasurementId: string | null;
    boundaryDeterminedAt: string | null;
    /** "Alan no" — share slot on the parcel (1, 2, 3 …), assigned in approval order. */
    shareNo: number | null;
    // ── Derived by the API (FieldBoundaryService) ──
    isShared: boolean;
    coOwnerCount: number;
    boundaryStatus: FieldBoundaryStatus;
    pendingMeasurementId: string | null;
    pendingRequestId: string | null;
    coOwners: FieldCoOwner[];
    createdAt: string;
    updatedAt: string;
}

export interface FieldPartner {
    id: string;
    partnerName: string;
    partnerPhone: string | null;
    partnerIdentityNumber: string | null;
    sharePercentage: number;
    isPrimaryOwner: boolean;
    invitationStatus: 'pending' | 'accepted' | 'rejected';
}

export type PruningMethod = 'map' | 'gps' | 'assisted' | 'imu';
export type PruningAccuracyLevel = 'high' | 'medium' | 'low';

export interface PruningMeasurement {
    id: string;
    fieldId: string;
    userId: string;
    method: PruningMethod;
    geometry: number[][];
    prunedAreaM2: number;
    fieldAreaM2: number;
    ratioPercent: number;
    accuracyLevel: PruningAccuracyLevel | null;
    fieldCheckDone: boolean;
    gpsAccuracyMeters: number | null;
    photoUrl: string | null;
    producerApproved: boolean;
    staffApproved: boolean;
    status: PruningStatus;
    rejectionReason: string | null;
    producerName: string | null;
    parcelNo: string | null;
    notes: string | null;
    measuredAt: string;
    createdAt: string;
    updatedAt: string;
}

export type PruningStatus =
    | 'measured'
    | 'producer_approved'
    | 'staff_approved'
    | 'completed'
    | 'rejected';

export type PruningTaskStatus =
    | 'pending'
    | 'in_progress'
    | 'measured'
    | 'completed'
    | 'cancelled';

export interface PruningTask {
    id: string;
    fieldId: string;
    producerId: string;
    assignedTo: string;
    assignedBy: string;
    status: PruningTaskStatus;
    measurementId: string | null;
    parcelNo: string | null;
    producerName: string | null;
    dueDate: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface AssignPruningTaskPayload {
    fieldId: string;
    assignedTo: string;
    dueDate?: string;
    notes?: string;
}

// ── Budama talepleri (pruning requests) ──
export type PruningRequestStatus = 'pending' | 'scheduled' | 'measured' | 'approved' | 'rejected';

export interface MeasurementPoint {
    lat: number;
    lng: number;
    altitudeMeters: number;
}

export interface PruningRequest {
    id: string;
    producerId: string;
    producerName: string;
    il: string;
    ilce: string;
    ada: string;
    parsel: string;
    registeredAreaM2: number;
    /** Cadastral parcel outline as a [lng, lat] ring, if known. */
    parcelGeometry: number[][] | null;
    status: PruningRequestStatus;
    appointmentDate: string | null;
    appointedById: string | null;
    appointedByName: string | null;
    measuredAreaM2: number | null;
    measurementPoints: MeasurementPoint[];
    accuracyLevel: PruningAccuracyLevel | null;
    fixQuality: string | null;
    method: PruningMethod | null;
    measuredAt: string | null;
    measuredById: string | null;
    measuredByName: string | null;
    approvedAt: string | null;
    approvedByName: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    /**
     * Every registered owner of the same il + ada + parsel (the requester
     * included). More than one entry ⇒ hisseli parcel: the panel warns and a
     * ruhsatlandırma measurement per owner is expected.
     */
    coOwners: PruningCoOwner[];
}

/** A user holding an active field registration on the request's parcel. */
export interface PruningCoOwner {
    userId: string;
    fullName: string;
    cuzdanNo: string | null;
    ruhsatNo: string | null;
    phone: string | null;
    fieldId: string;
    fieldName: string;
    areaM2: number;
    shareNo?: number | null;
    boundaryDetermined?: boolean;
}

export interface CreatePruningRequestPayload {
    il: string;
    ilce: string;
    ada: string;
    parsel: string;
    registeredAreaM2?: number;
    parcelGeometry?: number[][];
}

export interface SavePruningMeasurementResultPayload {
    measuredAreaM2: number;
    points: MeasurementPoint[];
    method: PruningMethod;
    accuracyLevel?: PruningAccuracyLevel;
    fixQuality?: string;
}

// ── Ruhsatlandırma (licensing) — one owner's slice on a hisseli parcel ──
export type LicensingMeasurementStatus = 'pending_approval' | 'approved' | 'rejected' | 'superseded';
export type LicensingApprovalStatus = 'pending' | 'approved' | 'rejected';
/** staff_pruning / staff_request: measured on site by Çaykur staff; producer_map: drawn by the owner. */
export type LicensingMeasurementSource = 'staff_pruning' | 'staff_request' | 'producer_map';

export interface LicensingApproval {
    id: string;
    measurementId: string;
    approverId: string;
    approverName: string;
    status: LicensingApprovalStatus;
    decidedAt: string | null;
    reason: string | null;
    emailSent: boolean;
    createdAt: string;
    updatedAt: string;
    /** Present on the producer's approval list (joined server-side). */
    measurement?: LicensingMeasurement;
}

export interface LicensingMeasurement {
    id: string;
    source: LicensingMeasurementSource;
    pruningRequestId: string | null;
    measurementRequestId: string | null;
    /** The measured owner's field record (null on legacy rows). */
    fieldId: string | null;
    il: string;
    ilce: string;
    ada: string;
    parsel: string;
    ownerId: string;
    ownerName: string;
    ownerCuzdanNo: string | null;
    measuredAreaM2: number;
    measurementPoints: MeasurementPoint[];
    method: PruningMethod;
    accuracyLevel: PruningAccuracyLevel | null;
    fixQuality: string | null;
    measuredById: string;
    measuredByName: string;
    measuredAt: string;
    status: LicensingMeasurementStatus;
    resolvedAt: string | null;
    notes: string | null;
    /** Present on staff reads (one row per co-owner asked to confirm). */
    approvals?: LicensingApproval[];
    createdAt: string;
    updatedAt: string;
}

export interface CreateLicensingMeasurementPayload extends SavePruningMeasurementResultPayload {
    /** Exactly one of the two request ids. */
    pruningRequestId?: string;
    measurementRequestId?: string;
    ownerId: string;
    notes?: string;
}

/** Producer draws their own slice on the satellite map ("Arazini Belirle"). */
export interface CreateProducerBoundaryPayload {
    fieldId: string;
    measuredAreaM2: number;
    points: MeasurementPoint[];
    notes?: string;
}

// ── Arazide ölçüm talepleri (on-site measurement requests) ──
export type MeasurementRequestStatus = 'pending' | 'scheduled' | 'measured' | 'closed' | 'rejected' | 'cancelled';

export interface MeasurementRequest {
    id: string;
    producerId: string;
    producerName: string;
    fieldId: string;
    il: string;
    ilce: string;
    ada: string;
    parsel: string;
    registeredAreaM2: number;
    parcelGeometry: number[][] | null;
    status: MeasurementRequestStatus;
    appointmentDate: string | null;
    appointedById: string | null;
    appointedByName: string | null;
    producerNote: string | null;
    notes: string | null;
    closedAt: string | null;
    createdAt: string;
    updatedAt: string;
    /** Every registered owner of the parcel (the requester included). */
    coOwners: PruningCoOwner[];
}

export interface CreateMeasurementRequestPayload {
    fieldId: string;
    producerNote?: string;
}

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface Paginated<T> {
    data: T[];
    meta: PaginationMeta;
}

export type CaykurStaffRole =
    | 'kurum_admin'
    | 'fabrika_sorumlusu'
    | 'alim_yeri_personeli'
    | 'saha_personeli'
    | 'denetci'
    | 'finans';

export interface CaykurStaff {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    province: string;
    district: string;
    caykurRole: CaykurStaffRole;
    caykurScope: string | null;
    title: string;
    active: boolean;
    createdAt: string;
}

export interface CreateCaykurStaffPayload {
    fullName: string;
    email: string;
    phone: string;
    province: string;
    district: string;
    caykurRole: CaykurStaffRole;
    caykurScope?: string;
}

// Çaykur panel field (parcel) registry — every producer's fields, DB-backed.
export type CaykurFieldOwnership = 'all' | 'shared' | 'partnered' | 'single';
export type CaykurFieldSortKey = 'createdAt' | 'name' | 'area' | 'province' | 'owner' | 'parcel';

export interface CaykurFieldPerson {
    name: string;
    role: 'owner' | 'partner';
    userId: string | null;
    phone: string | null;
    sharePercentage: number | null;
    invitationStatus: 'pending' | 'accepted' | 'rejected' | null;
}

export interface CaykurFieldSharedRegistrant {
    fieldId: string;
    fieldName: string;
    userId: string;
    fullName: string;
}

export interface CaykurFieldRow {
    id: string;
    name: string;
    province: string;
    district: string;
    neighborhood: string;
    road: string | null;
    adaNo: string | null;
    parcelNo: string | null;
    area: number;
    areaUnit: 'donum' | 'dekar' | 'm2';
    areaDekar: number;
    partnerCount: number;
    notes: string | null;
    hasGeometry: boolean;
    owner: {
        id: string;
        fullName: string;
        phone: string | null;
        ruhsatNo: string | null;
        cuzdanNo: string | null;
    };
    people: CaykurFieldPerson[];
    /** Another user registered the same province + ada + parcel (hisseli). */
    shared: boolean;
    sharedWith: CaykurFieldSharedRegistrant[];
    createdAt: string;
    updatedAt: string;
}

export interface CaykurFieldsOverview {
    total: number;
    shared: number;
    withPartners: number;
    totalAreaDekar: number;
    provinces: Array<{ province: string; count: number }>;
    districts: Array<{ province: string; district: string; count: number }>;
}

export interface CaykurFieldsQuery {
    page?: number;
    limit?: number;
    search?: string;
    province?: string;
    district?: string;
    neighborhood?: string;
    adaNo?: string;
    parcelNo?: string;
    ownership?: CaykurFieldOwnership;
    minAreaDekar?: number;
    maxAreaDekar?: number;
    createdFrom?: string;
    createdTo?: string;
    sortBy?: CaykurFieldSortKey;
    sortOrder?: 'ASC' | 'DESC';
}

// Çaykur tea inventory (TKGM parcels × satellite tea detection × license register)
export type InventoryClass =
    | 'compliant'
    | 'over_quota'
    | 'ghost_license'
    | 'expanded'
    | 'unlicensed'
    | 'public_land'
    | 'uncertain'
    | 'no_tea';

export interface InventoryLicense {
    licenseNo: string;
    walletNo: string;
    holderName: string;
    holderDeceased: boolean;
    licensedAreaM2: number;
    issuedYear: number;
    recordedParcelRef: string;
}

export interface InventoryAreaSummary {
    id: string;
    code: string;
    province: string;
    district: string;
    neighborhood: string;
    parcelCount: number;
    flaggedCount: number;
    detectedTeaAreaM2: number;
    coveredRatio: number;
    demoLicenses: boolean;
    updatedAt: string;
}

export interface InventoryClassStat {
    count: number;
    teaAreaM2: number;
    licensedAreaM2: number;
}

export interface InventoryModelReport {
    type?: string;
    heldOutAccuracy?: number;
    kappa?: number;
    teaRecall?: number;
    teaPrecision?: number;
    threshold?: number;
}

export interface InventoryAreaDetail extends InventoryAreaSummary {
    neighborhoodId: number | null;
    boundary: GeoJSON.Geometry;
    boundaryAreaM2: number;
    period: { start?: string; end?: string };
    model: InventoryModelReport;
    teaPatches: Array<{ areaM2: number; geometry: GeoJSON.Geometry }>;
    teaPatchAreaM2: number;
    licensedAreaM2: number;
    unmatchedLicenses: InventoryLicense[];
    classStats: Record<InventoryClass, InventoryClassStat>;
}

export interface InventoryParcelRow {
    id: string;
    parcelKey: string;
    block: string;
    parcel: string;
    nature: string;
    locality: string;
    deedAreaM2: number | null;
    geometryAreaM2: number;
    teaShare: number | null;
    teaAreaM2: number | null;
    inventoryClass: InventoryClass;
    license: InventoryLicense | null;
}

export interface InventoryParcelDetail extends InventoryParcelRow {
    areaId: string;
    teaProbability: number | null;
    pruning: ParcelPruning | null;
    geometry: GeoJSON.Geometry;
}

// Pruning monitoring (Sentinel-2 same-season comparison; uncalibrated until field labels exist)
export type SatellitePruningStatus = 'pruned' | 'partial' | 'no_trace' | 'insufficient_observation' | 'too_small';

export interface PruningSeasonResult {
    teaAreaM2: number;
    observedTeaAreaM2: number;
    requiredM2: number;
    winterPrunedM2: number;
    springPrunedM2: number;
    prunedM2: number;
    vhChangeDb: number | null;
    status: SatellitePruningStatus;
}

export interface ParcelPruning {
    seasons: Record<string, PruningSeasonResult>;
    /** NDVI of the parcel's tea pixels on each date of the area's series (null = not observed). */
    ndvi: Array<number | null>;
}

export interface PruningWindows {
    season: string;
    reference: [string, string];
    winter: [string, string];
    spring: [string, string];
}

export interface PruningSeasonSummary {
    season: string;
    windows: PruningWindows;
    teaAreaM2: number;
    observedShare: number;
    winterPrunedM2: number;
    springPrunedM2: number;
    prunedM2: number;
    prunedShareOfTea: number;
    expectedShare: number;
    statusCounts: Record<SatellitePruningStatus, number>;
    patches: Array<{ areaM2: number; geometry: GeoJSON.Geometry }>;
}

export interface AreaPruningSummary {
    calibrated: boolean;
    method: string;
    requiredFraction: number;
    minSceneTeaMedian: number;
    seasons: PruningSeasonSummary[];
    series: { dates: string[]; neighborhoodMedian: number[]; validTeaShare: number[] } | null;
    /** Sentinel-2 overlays per season window (static PNGs under baseUrl). */
    imagery: PruningImagery | null;
}

// Producer-level pruning compliance (1/7 over all of a producer's gardens)
export type ProducerPruningStatus =
    | 'auto_approved'
    | 'approved'
    | 'rejected'
    | 'expert_review'
    | 'partial'
    | 'no_trace'
    | 'awaiting_observation';

export interface ProducerDecision {
    decision: 'approved' | 'rejected';
    note: string | null;
    decidedByName: string;
    decidedAt: string;
}

export interface ProducerRow {
    id: string;
    code: string;
    name: string;
    walletNo: string;
    licenseNo: string;
    gardenCount: number;
    licensedAreaM2: number;
    teaAreaM2: number;
    requiredM2: number;
    prunedM2: number;
    ratio: number;
    autoStatus: Exclude<ProducerPruningStatus, 'approved' | 'rejected'>;
    autoApprovedAt: string | null;
    decision: ProducerDecision | null;
    status: ProducerPruningStatus;
    purchaseOpen: boolean;
    demo: boolean;
}

export interface ProducerScanPoint {
    date: string;
    prunedM2: number;
    observedShare: number;
    ratio: number;
    status: ProducerPruningStatus;
}

export interface ProducerScanSchedule {
    season: string;
    calibrated: boolean;
    demo: boolean;
    everyDays: number;
    lookbackDays: number;
    reference: [string, string];
    scanDates: string[];
    newObservation: boolean[];
    sceneDates: string[][];
    rules: {
        requiredFraction: number;
        autoApproval: { minRatio: number; minObservedShare: number; consecutiveScans: number; minTeaAreaM2: number };
        expertReviewRatio: number;
        partialRatio: number;
    };
}

export interface ProducerGarden {
    id: string;
    code: string;
    parcelKey: string;
    block: string;
    parcel: string;
    holderIndex: number;
    holderCount: number;
    geometryAreaM2: number;
    teaAreaM2: number;
    prunedM2: number;
    prunedSeries: number[];
    geometry: GeoJSON.Geometry;
}

export interface ProducerDetail extends ProducerRow {
    season: string;
    scans: ProducerScanPoint[];
    gardens: ProducerGarden[];
    decisions: ProducerDecision[];
    schedule: ProducerScanSchedule | null;
}

export interface ProducerSummary {
    total: number;
    purchaseOpen: number;
    counts: Record<ProducerPruningStatus, number>;
    schedule: ProducerScanSchedule | null;
}

export interface ProducerQuery {
    page?: number;
    limit?: number;
    status?: ProducerPruningStatus;
    search?: string;
    sortBy?: 'ratio' | 'name' | 'teaArea' | 'gardens';
    sortOrder?: 'ASC' | 'DESC';
}

export type PruningImageryLayer = 'reference' | 'winter' | 'spring' | 'change';

export interface PruningImagery {
    baseUrl: string;
    bounds: { west: number; south: number; east: number; north: number };
    seasons: Record<string, Partial<Record<PruningImageryLayer, { file: string; scenes?: number; window?: [string, string]; sceneDate?: string; teaVisible?: number }>>>;
}

export interface AreaPruning {
    summary: AreaPruningSummary | null;
    parcels: Array<{ id: string; parcelKey: string; block: string; parcel: string; nature: string; seasons: Record<string, PruningSeasonResult> }>;
}

export type InventoryMap = GeoJSON.FeatureCollection<
    GeoJSON.Geometry,
    { id: string; block: string; parcel: string; nature: string; teaShare: number | null; inventoryClass: InventoryClass }
>;

export type InventoryParcelSortKey = 'parcel' | 'teaArea' | 'licensedArea' | 'gap';

export interface InventoryParcelQuery {
    page?: number;
    limit?: number;
    inventoryClass?: InventoryClass;
    search?: string;
    sortBy?: InventoryParcelSortKey;
    sortOrder?: 'ASC' | 'DESC';
}

// Çaykur panel master dataset (müstahsil registry) — DB-backed.
export interface CaykurPanelProducer {
    id: string;
    fullName: string;
    ruhsatNo: string;
    cuzdanNo: string;
    region: string;
    district: string;
    factory: string;
    licensedDekar: number;
    organic: boolean;
    seasonKg: number;
    surgun: { s1: number; s2: number; s3: number };
    quotaKg: number;
    gardenM2: number;
    prunedThisYearM2: number;
    rotationHistory: boolean[];
    outOfStandardPct: number;
}

export interface CreatePruningMeasurementPayload {
    fieldId: string;
    method: PruningMethod;
    geometry: number[][];
    prunedAreaM2: number;
    fieldAreaM2: number;
    ratioPercent: number;
    accuracyLevel?: PruningAccuracyLevel;
    fieldCheckDone?: boolean;
    gpsAccuracyMeters?: number | null;
    photoUrl?: string | null;
    producerApproved?: boolean;
    staffApproved?: boolean;
    producerName?: string | null;
    parcelNo?: string | null;
    notes?: string | null;
    measuredAt?: string;
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
    firm?: { id: string; name: string; logoUrl: string | null; isCaykur: boolean } | null;
    tariffLabel?: string | null;
    source?: 'caykur' | 'manual';
    paymentDate: string;
    paymentStatus: 'received' | 'pending';
    notes: string | null;
    harvestCount?: number;
    assigned?: boolean;
    assignedField?: { id: string; name: string } | null;
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

export interface GeoRoad {
    id: string;
    name: string;
    geometry: number[][][];
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
    isCaykur?: boolean;
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
    paymentMonth?: number;
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
    paymentMonth: number | null;
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
    isCaykur: boolean;
    currentTariffs: {
        paymentTerm: PaymentTerm;
        pricePerKg: number;
        paymentMonth: number | null;
        effectiveDate: string;
        isSplitPayment: boolean;
        splitDetails: TariffSplitDetail[] | null;
    }[];
}

export interface AdminUser {
    id: string;
    fullName: string;
    email: string;
    role: 'user' | 'moderator' | 'admin';
    isActive: boolean;
    isBanned: boolean;
    createdAt: string;
}

// Knowledge / AI Agent Types
export type KnowledgeDocumentStatus = 'processing' | 'ready' | 'failed';

export interface KnowledgeDocument {
    id: string;
    title: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    status: KnowledgeDocumentStatus;
    charCount: number;
    chunkCount: number;
    embeddedChunkCount: number;
    pageCount: number;
    /** Whether the original file is stored and can be opened/downloaded. */
    hasFile: boolean;
    suggestedQuestions: string[];
    errorMessage: string | null;
    createdAt: string;
}

/** One cited passage; `index` matches the `[n]` markers in the answer. */
export interface KnowledgeChatSource {
    index: number;
    chunkId: string;
    documentId: string;
    title: string;
    fileName: string;
    pageNumber: number | null;
    snippet: string;
    score: number;
}

export type KnowledgeRetrievalMode = 'hybrid' | 'keyword' | 'none';

export interface KnowledgeChatHistoryMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface KnowledgeChatResponse {
    answer: string;
    sources: KnowledgeChatSource[];
    usedAi: boolean;
    retrievalMode: KnowledgeRetrievalMode;
    followUps: string[];
}

export type KnowledgeChatStreamEvent =
    | { type: 'meta'; sources: KnowledgeChatSource[]; retrievalMode: KnowledgeRetrievalMode; usedAi: boolean }
    | { type: 'delta'; text: string }
    | { type: 'done'; answer: string; followUps: string[] }
    | { type: 'error'; message: string };

export interface KnowledgeStatus {
    aiConfigured: boolean;
    model: string;
    embeddingModel: string;
    fileStorage: 'r2' | 'database';
    documentCount: number;
    readyDocumentCount: number;
    chunkCount: number;
    embeddedChunkCount: number;
    pageCount: number;
}

/**
 * Raw authenticated fetch for endpoints whose body is not JSON (SSE streams,
 * file downloads). Mirrors `request()`: attaches the Bearer token and retries
 * once after a token refresh on 401.
 */
async function authorizedFetch(endpoint: string, options: RequestInit = {}, _retry = 0): Promise<Response> {
    const authStore = useAuthStore();
    const token = authStore.accessToken;
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    if (response.status === 401 && _retry === 0 && authStore.refreshToken) {
        const refreshed = await refreshTokenIfNeeded();
        if (refreshed) {
            return authorizedFetch(endpoint, options, 1);
        }
        window.location.href = '/login';
    }
    return response;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
    try {
        const data = await response.json();
        return typeof data?.message === 'string' ? data.message : fallback;
    } catch {
        return fallback;
    }
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
        cuzdanNo: string;
    }) => request<{ message: string; email: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    login: (data: { email: string; password: string; rememberMe?: boolean }) =>
        request<{ accessToken: string; refreshToken: string; user: { id: string; email: string; fullName: string; userType: 'land_owner' | 'worker' | 'self_farmer'; phone: string; province: string; district: string; avatarUrl: string | null; role?: string; caykurRole?: string | null; caykurScope?: string | null } }>(
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

    /**
     * Permanent in-app account deletion (Google Play Data Deletion).
     * Requires the current password as a security check; on success the
     * user row and all cascaded user-owned data is removed from the DB.
     */
    deleteOwnAccount: (password: string) =>
        request<{ message: string }>('/users/me', {
            method: 'DELETE',
            body: JSON.stringify({ password }),
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
                return { error: { message: data.message || 'Avatar yüklenemedi', statusCode: response.status } };
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
    getRoads: (neighborhoodId: string) => request<GeoRoad[]>(`/geo/roads/${neighborhoodId}`),
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
    acceptFieldPartner: (fieldId: string, partnerId: string) =>
        request<FieldPartner>(`/fields/${fieldId}/partners/${partnerId}/accept`, { method: 'POST' }),
    rejectFieldPartner: (fieldId: string, partnerId: string) =>
        request<FieldPartner>(`/fields/${fieldId}/partners/${partnerId}/reject`, { method: 'POST' }),
    removeFieldPartner: (fieldId: string, partnerId: string) =>
        request<void>(`/fields/${fieldId}/partners/${partnerId}`, { method: 'DELETE' }),

    // Pruning measurement endpoints
    createPruningMeasurement: (data: CreatePruningMeasurementPayload & { taskId?: string }) =>
        request<PruningMeasurement>('/pruning', { method: 'POST', body: JSON.stringify(data) }),
    getPruningMeasurements: (fieldId: string) =>
        request<PruningMeasurement[]>(`/pruning/field/${fieldId}`),
    getPruningMeasurementsPanel: (params?: { search?: string; page?: number; limit?: number }) => {
        const query = new URLSearchParams(params as Record<string, string>).toString();
        return request<Paginated<PruningMeasurement>>(`/pruning/measurements${query ? `?${query}` : ''}`);
    },
    getPruningMeasurement: (id: string) =>
        request<PruningMeasurement>(`/pruning/${id}`),
    updatePruningApproval: (
        id: string,
        data: { producerApproved?: boolean; staffApproved?: boolean; rejectionReason?: string },
    ) => request<PruningMeasurement>(`/pruning/${id}/approve`, { method: 'PATCH', body: JSON.stringify(data) }),
    deletePruningMeasurement: (id: string) =>
        request<void>(`/pruning/${id}`, { method: 'DELETE' }),

    // Pruning task (saha queue / assignment) endpoints
    getPruningTasks: (params?: { status?: PruningTaskStatus; assignedTo?: string; fieldId?: string; page?: number; limit?: number }) => {
        const query = new URLSearchParams(params as Record<string, string>).toString();
        return request<Paginated<PruningTask>>(`/pruning/tasks${query ? `?${query}` : ''}`);
    },
    getPruningTask: (id: string) => request<PruningTask>(`/pruning/tasks/${id}`),
    assignPruningTask: (data: AssignPruningTaskPayload) =>
        request<PruningTask>('/pruning/tasks', { method: 'POST', body: JSON.stringify(data) }),

    // Budama talepleri (pruning requests) — producer ↔ Çaykur panel, DB-backed
    getPruningRequests: (params?: { status?: PruningRequestStatus; search?: string; page?: number; limit?: number }) => {
        const query = new URLSearchParams(params as Record<string, string>).toString();
        return request<Paginated<PruningRequest>>(`/pruning/requests${query ? `?${query}` : ''}`);
    },
    getPruningRequest: (id: string) => request<PruningRequest>(`/pruning/requests/${id}`),
    createPruningRequest: (data: CreatePruningRequestPayload) =>
        request<PruningRequest>('/pruning/requests', { method: 'POST', body: JSON.stringify(data) }),
    setPruningAppointment: (id: string, appointmentDate: string) =>
        request<PruningRequest>(`/pruning/requests/${id}/appointment`, { method: 'PATCH', body: JSON.stringify({ appointmentDate }) }),
    savePruningRequestMeasurement: (id: string, data: SavePruningMeasurementResultPayload) =>
        request<PruningRequest>(`/pruning/requests/${id}/measurement`, { method: 'PATCH', body: JSON.stringify(data) }),
    approvePruningRequest: (id: string) =>
        request<PruningRequest>(`/pruning/requests/${id}/approve`, { method: 'PATCH', body: JSON.stringify({}) }),
    rejectPruningRequest: (id: string, reason?: string) =>
        request<PruningRequest>(`/pruning/requests/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),

    // Ruhsatlandırma (licensing) — staff capture + co-owner approvals
    createLicensingMeasurement: (data: CreateLicensingMeasurementPayload) =>
        request<LicensingMeasurement>('/licensing', { method: 'POST', body: JSON.stringify(data) }),
    createProducerBoundary: (data: CreateProducerBoundaryPayload) =>
        request<LicensingMeasurement>('/licensing/boundary', { method: 'POST', body: JSON.stringify(data) }),
    getLicensingMeasurements: (params?: { pruningRequestId?: string; measurementRequestId?: string; fieldId?: string; status?: LicensingMeasurementStatus; page?: number; limit?: number }) => {
        const query = new URLSearchParams(params as Record<string, string>).toString();
        return request<Paginated<LicensingMeasurement>>(`/licensing${query ? `?${query}` : ''}`);
    },
    getLicensingMeasurement: (id: string) => request<LicensingMeasurement>(`/licensing/${id}`),
    getMyLicensingApprovals: (params?: { status?: LicensingApprovalStatus; page?: number; limit?: number }) => {
        const query = new URLSearchParams(params as Record<string, string>).toString();
        return request<Paginated<LicensingApproval>>(`/licensing/approvals${query ? `?${query}` : ''}`);
    },
    getPendingLicensingApprovalCount: () => request<{ count: number }>('/licensing/approvals/pending-count'),
    decideLicensingApproval: (id: string, decision: 'approved' | 'rejected', reason?: string) =>
        request<LicensingApproval>(`/licensing/approvals/${id}/decision`, { method: 'PATCH', body: JSON.stringify({ decision, reason }) }),

    // Arazide ölçüm talepleri (on-site measurement requests)
    getMeasurementRequests: (params?: { status?: MeasurementRequestStatus; search?: string; page?: number; limit?: number }) => {
        const query = new URLSearchParams(params as Record<string, string>).toString();
        return request<Paginated<MeasurementRequest>>(`/measurement-requests${query ? `?${query}` : ''}`);
    },
    getMeasurementRequest: (id: string) => request<MeasurementRequest>(`/measurement-requests/${id}`),
    createMeasurementRequest: (data: CreateMeasurementRequestPayload) =>
        request<MeasurementRequest>('/measurement-requests', { method: 'POST', body: JSON.stringify(data) }),
    cancelMeasurementRequest: (id: string) =>
        request<MeasurementRequest>(`/measurement-requests/${id}/cancel`, { method: 'PATCH', body: JSON.stringify({}) }),
    setMeasurementRequestAppointment: (id: string, appointmentDate: string) =>
        request<MeasurementRequest>(`/measurement-requests/${id}/appointment`, { method: 'PATCH', body: JSON.stringify({ appointmentDate }) }),
    rejectMeasurementRequest: (id: string, reason?: string) =>
        request<MeasurementRequest>(`/measurement-requests/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),

    // Çaykur staff (management onboarding) endpoints
    getCaykurStaff: (params?: { page?: number; limit?: number; search?: string; caykurRole?: CaykurStaffRole; status?: 'active' | 'suspended' }) => {
        const query = new URLSearchParams(params as Record<string, string>).toString();
        return request<Paginated<CaykurStaff>>(`/caykur/staff${query ? `?${query}` : ''}`);
    },
    getCaykurStaffMember: (id: string) => request<CaykurStaff>(`/caykur/staff/${id}`),
    createCaykurStaff: (data: CreateCaykurStaffPayload) =>
        request<CaykurStaff & { tempPassword: string }>('/caykur/staff', { method: 'POST', body: JSON.stringify(data) }),
    updateCaykurStaff: (id: string, data: Partial<CreateCaykurStaffPayload> & { active?: boolean }) =>
        request<CaykurStaff>(`/caykur/staff/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    suspendCaykurStaff: (id: string) =>
        request<CaykurStaff>(`/caykur/staff/${id}`, { method: 'DELETE' }),

    // Çaykur panel data (DB-backed; replaces the frontend mock seam)
    getCaykurPanelProducers: () =>
        request<CaykurPanelProducer[]>('/caykur/producers'),
    getCaykurPanelProducer: (id: string) =>
        request<CaykurPanelProducer>(`/caykur/producers/${id}`),

    // Çaykur panel field registry (every producer, DB-backed)
    getCaykurFields: (params?: CaykurFieldsQuery) => {
        const entries = Object.entries(params ?? {}).filter(
            ([, v]) => v !== undefined && v !== null && v !== '',
        ) as Array<[string, string | number]>;
        const query = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
        return request<Paginated<CaykurFieldRow>>(`/caykur/fields${query ? `?${query}` : ''}`);
    },
    getCaykurFieldsOverview: () => request<CaykurFieldsOverview>('/caykur/fields/overview'),

    // Çaykur tea inventory
    getInventoryAreas: () => request<Paginated<InventoryAreaSummary>>('/caykur/tea-inventory/areas?limit=100'),
    getInventoryArea: (id: string) => request<InventoryAreaDetail>(`/caykur/tea-inventory/areas/${id}`),
    getInventoryAreaMap: (id: string) => request<InventoryMap>(`/caykur/tea-inventory/areas/${id}/map`),
    getInventoryParcels: (areaId: string, params?: InventoryParcelQuery) => {
        const entries = Object.entries(params ?? {}).filter(
            ([, v]) => v !== undefined && v !== null && v !== '',
        ) as Array<[string, string | number]>;
        const query = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
        return request<Paginated<InventoryParcelRow>>(`/caykur/tea-inventory/areas/${areaId}/parcels${query ? `?${query}` : ''}`);
    },
    getInventoryParcel: (id: string) => request<InventoryParcelDetail>(`/caykur/tea-inventory/parcels/${id}`),
    getInventoryPruning: (areaId: string) => request<AreaPruning>(`/caykur/tea-inventory/areas/${areaId}/pruning`),
    getInventoryProducers: (areaId: string, params?: ProducerQuery) => {
        const entries = Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '') as Array<[string, string | number]>;
        const query = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
        return request<Paginated<ProducerRow>>(`/caykur/tea-inventory/areas/${areaId}/producers${query ? `?${query}` : ''}`);
    },
    getInventoryProducerSummary: (areaId: string) => request<ProducerSummary>(`/caykur/tea-inventory/areas/${areaId}/producers/summary`),
    getInventoryPurchaseList: (areaId: string, page = 1, limit = 20) =>
        request<Paginated<ProducerRow>>(`/caykur/tea-inventory/areas/${areaId}/purchase-list?page=${page}&limit=${limit}`),
    getInventoryProducer: (id: string) => request<ProducerDetail>(`/caykur/tea-inventory/producers/${id}`),
    decideInventoryProducer: (id: string, body: { decision: 'approved' | 'rejected'; note?: string }) =>
        request<ProducerDetail>(`/caykur/tea-inventory/producers/${id}/decision`, { method: 'POST', body: JSON.stringify(body) }),
    /** Purchase list as a CSV blob (Excel-compatible), or an error message. */
    downloadInventoryPurchaseCsv: async (areaId: string): Promise<{ blob?: Blob; error?: string }> => {
        const response = await authorizedFetch(`/caykur/tea-inventory/areas/${areaId}/purchase-list.csv`);
        if (!response.ok) return { error: await readErrorMessage(response, 'Liste indirilemedi') };
        return { blob: await response.blob() };
    },

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
    getPayments: (params?: { brokerFirmId?: string; year?: number; paymentStatus?: string; source?: string }) => {
        const query = new URLSearchParams(params as Record<string, string>).toString();
        return request<Payment[]>(`/payments${query ? `?${query}` : ''}`);
    },
    getPayment: (id: string) => request<Payment>(`/payments/${id}`),
    assignDeliveryField: (id: string, fieldId: string) =>
        request<Payment>(`/payments/${id}/assign-field`, { method: 'POST', body: JSON.stringify({ fieldId }) }),
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

    // Users
    searchUser: (query: string, type: 'tc' | 'phone') =>
        request<{ id: string; fullName: string; userType: string }>(
            `/users/search?query=${encodeURIComponent(query)}&type=${type}`
        ),

    // Admin: users
    listAdminUsers: (params?: { search?: string; role?: string; status?: string }) => {
        const query = new URLSearchParams();
        if (params?.search) query.append('search', params.search);
        if (params?.role && params.role !== 'all') query.append('role', params.role);
        if (params?.status && params.status !== 'all') query.append('status', params.status);
        const qs = query.toString();
        return request<AdminUser[]>(`/users/admin/list${qs ? `?${qs}` : ''}`);
    },
    setAdminUserBan: (id: string, banned: boolean) =>
        request<AdminUser>(`/users/admin/${id}/ban`, {
            method: 'PATCH',
            body: JSON.stringify({ banned }),
        }),
    setAdminUserRole: (id: string, role: 'user' | 'moderator' | 'admin') =>
        request<AdminUser>(`/users/admin/${id}/role`, {
            method: 'PATCH',
            body: JSON.stringify({ role }),
        }),

    // Uploads
    uploadImage: async (file: File): Promise<ApiResponse<{ url: string; filename: string; key?: string }>> => {
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
                return { error: { message: data.message || 'Dosya yüklenemedi', statusCode: response.status } };
            }
            return { data };
        } catch {
            return { error: { message: 'Dosya yüklenirken hata oluştu', statusCode: 0 } };
        }
    },

    // Knowledge / AI Agent
    getKnowledgeStatus: () => request<KnowledgeStatus>('/knowledge/status'),
    getKnowledgeDocuments: () => request<KnowledgeDocument[]>('/knowledge/documents'),
    knowledgeChat: (message: string, history?: KnowledgeChatHistoryMessage[]) =>
        request<KnowledgeChatResponse>('/knowledge/chat', {
            method: 'POST',
            body: JSON.stringify({ message, history }),
        }),
    /**
     * Streams an answer over server-sent events. `onEvent` receives `meta`,
     * `delta`, `done` and `error` events in order. Resolves when the stream
     * closes; rejects on network/HTTP failure (not on an `error` event).
     */
    streamKnowledgeChat: async (
        message: string,
        history: KnowledgeChatHistoryMessage[],
        onEvent: (event: KnowledgeChatStreamEvent) => void,
        signal?: AbortSignal,
    ): Promise<void> => {
        const response = await authorizedFetch('/knowledge/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
            body: JSON.stringify({ message, history }),
            signal,
        });

        if (!response.ok || !response.body) {
            throw new Error(await readErrorMessage(response, 'Yanıt alınamadı.'));
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const dispatch = (block: string): void => {
            const dataLines = block
                .split('\n')
                .filter((line) => line.startsWith('data:'))
                .map((line) => line.slice(5).trim());
            if (!dataLines.length) return;
            try {
                onEvent(JSON.parse(dataLines.join('\n')) as KnowledgeChatStreamEvent);
            } catch {
                // Ignore malformed frames; the stream continues.
            }
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let boundary = buffer.indexOf('\n\n');
            while (boundary !== -1) {
                dispatch(buffer.slice(0, boundary));
                buffer = buffer.slice(boundary + 2);
                boundary = buffer.indexOf('\n\n');
            }
        }
        if (buffer.trim()) dispatch(buffer);
    },
    /** Fetches the original document as a Blob (for in-app viewing or saving). */
    getKnowledgeDocumentFile: async (id: string, download = false): Promise<ApiResponse<Blob>> => {
        try {
            const response = await authorizedFetch(`/knowledge/documents/${id}/file${download ? '?download=true' : ''}`);
            if (!response.ok) {
                return {
                    error: { message: await readErrorMessage(response, 'Dosya alınamadı.'), statusCode: response.status },
                };
            }
            return { data: await response.blob() };
        } catch {
            return { error: { message: 'Dosya indirilirken bağlantı hatası oluştu.', statusCode: 0 } };
        }
    },
    reindexKnowledgeDocument: (id: string) =>
        request<KnowledgeDocument>(`/knowledge/documents/${id}/reindex`, { method: 'POST' }),
    reindexKnowledge: () => request<{ queued: number }>('/knowledge/reindex', { method: 'POST' }),
    deleteKnowledgeDocument: (id: string) =>
        request<void>(`/knowledge/documents/${id}`, { method: 'DELETE' }),
    uploadKnowledgeDocument: async (
        file: File,
        title?: string,
    ): Promise<ApiResponse<KnowledgeDocument>> => {
        const authStore = useAuthStore();
        const token = authStore.accessToken;
        const formData = new FormData();
        formData.append('file', file);
        if (title) {
            formData.append('title', title);
        }

        try {
            const response = await fetch(`${API_BASE}/knowledge/documents`, {
                method: 'POST',
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: formData,
            });

            const data = await response.json();
            if (!response.ok) {
                return { error: { message: data.message || 'Belge yüklenemedi', statusCode: response.status } };
            }
            return { data };
        } catch {
            return { error: { message: 'Belge yüklenirken hata oluştu', statusCode: 0 } };
        }
    },
};
