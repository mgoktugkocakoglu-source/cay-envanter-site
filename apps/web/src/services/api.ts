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
    licensedAreaM2: number | null;
    issuedYear: number;
    recordedParcelRef: string;
    licenseCount?: number;
    producerCount?: number;
    matchLevel?: LicenseMatchLevel | null;
    /** Licences exist on the parcel but none is tied to a garden yet (no area allocated). */
    pendingMatch?: boolean;
}

// Digital licence register (producer → licence → licensed garden sub-polygon → parcel)
export type LicenseMatchLevel = 'exact' | 'historical' | 'probable' | 'unmatched';
export type GardenApprovalStatus = 'approved' | 'proposed' | 'boundary_conflict' | 'field_check_required' | 'unresolved';
export type GardenDiscrepancy = 'area_over' | 'area_under' | 'no_tea' | 'no_license' | 'lineage_unresolved' | 'overlap' | 'outside_parcel';
export type ApplicationType = 'new_license' | 'area_correction' | 'transfer' | 'boundary_determination' | 'parcel_update' | 'garden_subdivision' | 'license_split';
export type ApplicationStatus =
    | 'DRAFT'
    | 'DOCUMENTS_PENDING'
    | 'MATCHING_REQUIRED'
    | 'GEOMETRY_PROPOSED'
    | 'BOUNDARY_CONFLICT'
    | 'UNDER_REVIEW'
    | 'FIELD_CHECK_REQUIRED'
    | 'DEMO_APPROVED'
    | 'RETURNED_FOR_CORRECTION'
    | 'REJECTED'
    | 'SUPERSEDED';

export interface LicensingSummary {
    demo: boolean;
    generatedAt: string | null;
    rules: { areaTolerance: number; minLicenseM2: number; overlapToleranceM2: number } | null;
    producers: { total: number; licensed: number; unlicensed: number; withIssues: number; deceasedHolders: number };
    licenses: { total: number; byMatchLevel: Record<LicenseMatchLevel, number>; byStatus: Record<string, number> };
    gardens: {
        total: number;
        byApprovalStatus: Record<GardenApprovalStatus, number>;
        discrepancies: Record<GardenDiscrepancy, number>;
        licensedAreaM2: number;
        planimetricAreaM2: number;
        surfaceAreaM2: number;
        measuredTeaAreaM2: number;
        meanSlopeDeg: number;
    };
    applications: { total: number; open: number; byStatus: Record<ApplicationStatus, number> };
    conflicts: { open: number; overlapM2: number };
    unlicensedTea: { count: number; areaM2: number };
    lineage: number;
}

export interface LicensingProducerRow {
    code: string;
    name: string;
    walletNo: string;
    licenseCodes: string[];
    licenseCount: number;
    holderDeceased: boolean;
    gardenCount: number;
    approvedGardens: number;
    matchLevel: LicenseMatchLevel | null;
    approvalStatus: GardenApprovalStatus;
    licensedAreaM2: number;
    planimetricAreaM2: number;
    surfaceAreaM2: number;
    measuredTeaAreaM2: number;
    discrepancies: GardenDiscrepancy[];
    openApplications: number;
    issueCount: number;
    pruningStatus: ProducerPruningStatus | null;
    pruningSeason: string | null;
}

export interface ParcelLineageView {
    code: string;
    oldRef: string;
    newParcelKey: string;
    changeType: string;
    source: string;
    changedAt: string;
}

export interface LicenseView {
    code: string;
    producerCode: string;
    walletNo: string;
    status: 'active' | 'transfer_pending' | 'inactive' | 'split' | 'transferred';
    issuedYear: number;
    recordedAreaM2: number;
    allocatedAreaM2: number;
    recordedParcelRefs: string[];
    matchLevel: LicenseMatchLevel;
    matchedParcelKeys: string[];
    lineage: ParcelLineageView[];
    candidateParcelKeys: string[];
    holderDeceased: boolean;
    validFrom: string;
    validTo: string | null;
    gardenCodes: string[];
    parentCode: string | null;
    childCodes: string[];
    history: RegistryEvent[];
    source: 'engine' | 'site';
}

export interface GardenGeometryVersion {
    version: number;
    geometry: GeoJSON.Geometry;
    planimetricAreaM2: number;
    reason: string;
    source: string;
    validFrom: string;
    validTo: string | null;
}

export interface GardenBoundaryProposal {
    geometry: GeoJSON.Geometry;
    planimetricAreaM2: number;
    proposedBy: 'producer' | 'staff';
    proposedAt: string;
    overlapM2: number;
    overlapsGardenCode: string | null;
}

export interface LicensedGarden {
    id: string;
    code: string;
    producerCode: string;
    parcelKey: string;
    block: string;
    parcel: string;
    holderIndex: number;
    holderCount: number;
    boundaryResolved: boolean;
    licenseCode: string | null;
    approvalStatus: GardenApprovalStatus;
    licensedAreaM2: number | null;
    planimetricAreaM2: number;
    surfaceAreaM2: number;
    meanSlopeDeg: number;
    measuredTeaAreaM2: number;
    discrepancies: GardenDiscrepancy[];
    versions: GardenGeometryVersion[];
    proposal: GardenBoundaryProposal | null;
    geometry: GeoJSON.Geometry;
    recordStatus: 'active' | 'superseded';
    supersededBy: string[];
    parentCode: string | null;
    events: RegistryEvent[];
    source: 'engine' | 'site';
    locality: string;
}

export interface ApplicationDocument {
    type: string;
    name: string;
    status: 'provided' | 'missing';
}

export interface ApplicationHistoryEntry {
    at: string;
    from: ApplicationStatus | null;
    to: ApplicationStatus;
    by: string;
    note: string;
}

export interface ApplicationDecisionView {
    fromStatus: ApplicationStatus;
    toStatus: ApplicationStatus;
    note: string | null;
    decidedByName: string;
    decidedAt: string;
}

export interface ApplicationRow {
    id: string;
    code: string;
    producerCode: string;
    producerName: string;
    licenseCode: string | null;
    gardenCode: string | null;
    parcelRef: string | null;
    type: ApplicationType;
    seededStatus: ApplicationStatus;
    status: ApplicationStatus;
    open: boolean;
    submittedAt: string;
    summary: string;
    missingDocuments: number;
    lastActivityAt: string;
    allowedTransitions: ApplicationStatus[];
    source: 'engine' | 'site';
    hasPayload: boolean;
    appliedAt: string | null;
    createdByName: string | null;
}

export interface ApplicationDetail extends ApplicationRow {
    documents: ApplicationDocument[];
    history: ApplicationHistoryEntry[];
    decisions: ApplicationDecisionView[];
    garden: LicensedGarden | null;
    license: LicenseView | null;
    payload: Record<string, unknown> | null;
    effects: Record<string, unknown> | null;
}

export interface BoundaryConflict {
    code: string;
    parcelKey: string;
    gardenCodes: [string, string];
    overlapM2: number;
    geometry: GeoJSON.Geometry;
    status: 'open' | 'resolved';
    openedAt: string;
}

export interface LicensingProducerProfile extends LicensingProducerRow {
    licenses: LicenseView[];
    gardens: LicensedGarden[];
    applications: ApplicationRow[];
    conflicts: BoundaryConflict[];
    pruningHistory: Array<{ season: string; status: ProducerPruningStatus; licensedAreaM2: number; requiredM2: number; newPrunedM2: number }>;
}

export interface LicensingLayers {
    gardens: GeoJSON.FeatureCollection<GeoJSON.Geometry, {
        code: string;
        producerCode: string;
        producerName: string;
        parcelKey: string;
        block: string;
        parcel: string;
        licenseCode: string | null;
        approvalStatus: GardenApprovalStatus;
        licensedAreaM2: number | null;
        planimetricAreaM2: number;
        surfaceAreaM2: number;
        measuredTeaAreaM2: number;
        discrepancies: GardenDiscrepancy[];
    }>;
    proposals: GeoJSON.FeatureCollection<GeoJSON.Geometry, {
        gardenCode: string;
        producerCode: string;
        producerName: string;
        block: string;
        parcel: string;
        planimetricAreaM2: number;
        proposedBy: 'producer' | 'staff';
        proposedAt: string;
        overlapM2: number;
        overlapsGardenCode: string | null;
    }>;
    conflicts: GeoJSON.FeatureCollection<GeoJSON.Geometry, { code: string; parcelKey: string; gardenCodes: [string, string]; overlapM2: number; status: string; openedAt: string }>;
    unlicensedTea: GeoJSON.FeatureCollection<GeoJSON.Geometry, { areaM2: number }>;
}

export type LicensingProducerSortKey = 'name' | 'licensedArea' | 'measuredTea' | 'issues';

export interface LicensingProducerQuery {
    page?: number;
    limit?: number;
    search?: string;
    matchLevel?: LicenseMatchLevel;
    approvalStatus?: GardenApprovalStatus;
    discrepancy?: GardenDiscrepancy;
    issues?: 'true' | 'false';
    sortBy?: LicensingProducerSortKey;
    sortOrder?: 'ASC' | 'DESC';
}

export interface ApplicationQuery {
    page?: number;
    limit?: number;
    status?: ApplicationStatus;
    type?: ApplicationType;
    open?: 'true' | 'false';
    search?: string;
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

// Region overview: every imported neighbourhood grouped by district with module headline numbers
export interface RegionAreaRow {
    id: string;
    code: string;
    province: string;
    district: string;
    neighborhood: string;
    neighborhoodId: number | null;
    boundary: GeoJSON.Geometry;
    boundaryAreaM2: number;
    coveredRatio: number;
    demoLicenses: boolean;
    updatedAt: string;
    parcels: { total: number; flagged: number; byClass: Record<InventoryClass, number> };
    teaPatchAreaM2: number;
    detectedTeaAreaM2: number;
    model: { teaRecall?: number; teaPrecision?: number; trainingNeighborhoods?: string[] };
    licensing: { producers: number; licenses: number; gardens: number; withIssues: number; licensedAreaM2: number } | null;
    pruning: {
        season: string;
        seasons: string[];
        calibrated: boolean;
        gardens: { total: number; byClass: Record<FusionClass, number>; prunedAreaM2: number; likelyAreaM2: number };
        producers: { total: number; byDecision: Record<FusionDecision, number> };
        unassigned: { count: number; areaM2: number; prunedAreaM2: number };
    } | null;
    health: {
        season: string;
        gardens: { total: number; byAnomaly: Record<HealthAnomalyClass, number>; meanVigour: number | null; yieldKg: number };
        producers: { total: number; byFlag: Record<YieldFlag, number>; quotaKg: number };
    } | null;
}

export interface RegionTotals {
    areas: number;
    parcels: number;
    flagged: number;
    teaPatchAreaM2: number;
    producers: number;
    licenses: number;
    gardens: number;
    pruned: number;
    likely: number;
    purchaseOpen: number;
    expert: number;
    healthSuspects: number;
    yieldKg: number;
}

export interface RegionDistrict {
    province: string;
    district: string;
    note: string | null;
    hasData: boolean;
    totals: RegionTotals;
    areas: RegionAreaRow[];
}

export interface RegionProvince {
    province: string;
    totals: RegionTotals;
    districts: RegionDistrict[];
}

export interface RegionOverview {
    generatedAt: string;
    totals: RegionTotals;
    provinces: RegionProvince[];
    districts: RegionDistrict[];
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

// Producer-level pruning compliance (1/7 over all of a producer's gardens, per season)
export type ProducerPruningStatus =
    | 'auto_approved'
    | 'approved'
    | 'rejected'
    | 'expert_review'
    | 'repeat_pruning_review'
    | 'boundary_unresolved'
    | 'partial'
    | 'no_trace'
    | 'awaiting_observation'
    | 'no_license';

export interface ProducerDecision {
    decision: 'approved' | 'rejected';
    note: string | null;
    decidedByName: string;
    decidedAt: string;
}

export interface ProducerRow {
    id: string;
    code: string;
    season: string;
    name: string;
    walletNo: string;
    licenseNo: string;
    gardenCount: number;
    unresolvedGardens: number;
    licensedAreaM2: number;
    teaAreaM2: number;
    requiredM2: number;
    grossPrunedM2: number;
    reusedM2: number;
    newPrunedM2: number;
    unattributedM2: number;
    unobservedM2: number;
    remainingM2: number;
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
    grossPrunedM2: number;
    newPrunedM2: number;
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
    previousSeasons: string[];
    scanDates: string[];
    newObservation: boolean[];
    sceneDates: string[][];
}

export interface ProducerRules {
    requiredFraction: number;
    cycleSeasons: number;
    autoApproval: { minRatio: number; minObservedShare: number; consecutiveScans: number; minTeaAreaM2: number };
    expertReviewRatio: number;
    partialRatio: number;
    repeatReview: { minShareOfGross: number; minM2: number };
    boundaryMaterialShare: number;
}

/** A pruning event inside a garden: where (polygon) and when (an observation interval, never a day). */
export interface GardenPruningEvent {
    areaM2: number;
    reusedM2: number;
    lastNoChangeAt: string | null;
    firstChangeAt: string | null;
    detectedAt: string | null;
    geometry: GeoJSON.Geometry;
}

export interface GardenSeasonResult {
    teaAreaM2: number;
    observedM2: number[];
    prunedM2: number[];
    reusedM2: number[];
    eventAreaM2: number;
    eventReusedM2: number;
    lastNoChangeAt: string | null;
    firstChangeAt: string | null;
    detectedAt: string | null;
    events: GardenPruningEvent[];
}

export interface ProducerGarden {
    id: string;
    code: string;
    parcelKey: string;
    block: string;
    parcel: string;
    holderIndex: number;
    holderCount: number;
    boundaryResolved: boolean;
    geometryAreaM2: number;
    geometry: GeoJSON.Geometry;
    season: GardenSeasonResult | null;
    eventsBySeason: Record<string, GardenPruningEvent[]>;
}

export interface ProducerSeasonHistory {
    id: string;
    season: string;
    status: ProducerPruningStatus;
    newPrunedM2: number;
    grossPrunedM2: number;
    reusedM2: number;
    requiredM2: number;
    ratio: number;
    purchaseOpen: boolean;
}

export interface ProducerSceneItem {
    date: string;
    file: string;
    teaVisible: number;
    teaMedianNdvi: number;
}

export interface ProducerDetail extends ProducerRow {
    scans: ProducerScanPoint[];
    gardens: ProducerGarden[];
    history: ProducerSeasonHistory[];
    decisions: ProducerDecision[];
    schedule: ProducerScanSchedule | null;
    rules: ProducerRules | null;
    scenes: { baseUrl: string; bounds: { west: number; south: number; east: number; north: number }; items: ProducerSceneItem[] } | null;
}

export interface ProducerSummary {
    season: string;
    seasons: string[];
    total: number;
    purchaseOpen: number;
    counts: Record<ProducerPruningStatus, number>;
    schedule: ProducerScanSchedule | null;
    rules: ProducerRules | null;
}

// Scan-centred satellite pruning records (event polygon × TKGM parcel × licence holder)
export type PruningRegistration = 'auto' | 'expert' | 'pending' | 'rejected' | 'unattributed' | 'no_license';

// Radar module: Sentinel-1 verdict on an optical record (mowing-detection recipe, uncalibrated)
export type RadarClass = 'confirmed' | 'weak' | 'neutral' | 'contradicted' | 'no_data';

export interface RadarPassResult {
    pass: 'ASCENDING' | 'DESCENDING';
    beforeObs: number;
    afterObs: number;
    vhDropDb: number | null;
    ratioDropDb: number | null;
    persistence: number | null;
    noiseDb: number | null;
    zVh?: number | null;
    cohBeforeObs?: number;
    cohAfterObs?: number;
    cohRise?: number | null;
    zCoh?: number | null;
    z: number | null;
}

export interface RadarResult {
    class: RadarClass;
    score: number;
    vhDropDb: number | null;
    ratioDropDb: number | null;
    cohRise?: number | null;
    persistence: number | null;
    z: number | null;
    zCoh?: number | null;
    cohClass?: RadarClass;
    passes: RadarPassResult[];
    reason?: 'no_change_date' | 'few_observations';
    windowSource?: 'scan' | 'fusion';
}

export interface RadarSeries {
    pass: 'ASCENDING' | 'DESCENDING';
    dates: string[];
    vhRel: Array<number | null>;
    ratioRel: Array<number | null>;
    cohDates?: string[];
    cohRel?: Array<number | null>;
}

export interface PruningRecordRow {
    id: string;
    season: string;
    gardenCode: string;
    parcelKey: string;
    block: string;
    parcel: string;
    locality: string;
    holderIndex: number;
    holderCount: number;
    boundaryResolved: boolean;
    producerId: string | null;
    producerCode: string;
    producerName: string;
    walletNo: string;
    licenseCode: string | null;
    areaM2: number;
    reusedM2: number;
    newM2: number;
    lastNoChangeAt: string | null;
    firstChangeAt: string | null;
    detectedAt: string | null;
    producerStatus: ProducerPruningStatus | null;
    producerRatio: number;
    purchaseOpen: boolean;
    registration: PruningRegistration;
    geometry: GeoJSON.Geometry;
    radar: RadarResult | null;
    radarSeries: RadarSeries[] | null;
    /** Multi-sensor (fusion v2.1) verdict of the garden this season; null when fusion has not run. */
    fusion: RecordFusion | null;
}

export interface RecordFusion {
    class: FusionClass;
    kind: FusionKind | null;
    z: number | null;
    changeDate: string | null;
    review: boolean;
    unit: 'garden' | 'patch';
    unitAreaM2: number;
}

export interface PruningRecordSummary {
    season: string;
    seasons: string[];
    total: number;
    areaM2: number;
    newAreaM2: number;
    gardens: number;
    producers: number;
    byRegistration: Record<PruningRegistration, number>;
    byFusion: Record<FusionClass | 'none', number> | null;
    radar: {
        byClass: Record<RadarClass, number>;
        radarOnly: number;
        calibrated: boolean;
        method: string;
        rules: Record<string, unknown>;
        passes: Array<{ pass: string; relativeOrbit: number; dates: string[]; cohDates?: string[] }>;
        coherence: { cohWin: [number, number]; pairs: Record<string, number> } | null;
    } | null;
    byScan: Array<{ date: string; newObservation: boolean; records: number; areaM2: number }>;
    localities: Array<{ name: string; records: number }>;
    schedule: ProducerScanSchedule | null;
    scenes: { baseUrl: string; bounds: { west: number; south: number; east: number; north: number }; items: ProducerSceneItem[] } | null;
}

// Multi-sensor step-change pruning verdicts (fusion module, uncalibrated)
export type FusionClass = 'pruned' | 'likely' | 'unclear' | 'not_pruned' | 'no_data';
export type FusionChannelKey = 'ndvi' | 'nbr' | 'ndre' | 'ndii' | 'vh_asc' | 'vh_desc' | 'ratio_asc' | 'ratio_desc' | 'coh_asc' | 'coh_desc';
export type FusionGroup = 'optical' | 'backscatter' | 'coherence';

/** Observation density around a fusion verdict (v2 engine). */
export interface FusionObservability {
    opticalObs: number;
    opticalObsInWindows: number;
    before: number;
    after: number;
    late: number;
    opticalGapDays: number | null;
    radarObs: number;
    coherenceObs: number;
    underObserved: boolean;
}
export type ProducerFusionStatus = 'pruned_full' | 'pruned_partial' | 'none' | 'unclear' | 'no_license' | 'no_data';
export type FusionDecision = 'auto_open' | 'auto_pending' | 'auto_short' | 'auto_none' | 'expert_anomaly' | 'no_license' | 'no_data';
export type FusionAnomaly = 'sensors_contradict' | 'repeat_pruning' | 'boundary_conflict' | 'boundary_unresolved' | 'license_mismatch' | 'over_pruned' | 'unlicensed_pruning';

export interface FusionUnassignedPatch {
    id: string;
    areaM2: number;
    geometry: GeoJSON.Geometry;
    verdict: { class: FusionClass; z: number | null; p: number; changeDate: string | null; lastBeforeAt: string | null; firstAfterAt: string | null; agreeing: number; opticalOk?: boolean; backscatterOk?: boolean; reason: string };
    detectedAt: string | null;
    likelyAt: string | null;
}

export interface FusionChannelEvidence {
    key: FusionChannelKey;
    before: number;
    after: number;
    late: number;
    delta: number | null;
    noise: number;
    z: number | null;
    persistence: number | null;
    magnitudeOk: boolean;
}

export interface FusionGroupEvidence {
    group: FusionGroup;
    z: number | null;
    channels: FusionChannelEvidence[];
}

export type FusionKind =
    | 'deep_pruning'
    | 'light_or_transient'
    | 'gradual_loss'
    | 'level'
    | 'contradiction'
    | 'gap'
    | 'small_ndvi'
    | 'likely_optical'
    | 'radar_only'
    | 'second_sensor'
    | 'transient'
    | 'weak'
    | 'population'
    | 'bulk'
    | 'none';

export interface FusionLevels {
    ndviBefore: number | null;
    ndviAfter: number | null;
    drop: number | null;
    ndviMinAfter: number | null;
    ok: boolean | null;
}

export interface FusionShape {
    stepRss: number | null;
    trendRss: number | null;
    ratio: number | null;
    trendChange: number | null;
    preSlopePerMonth: number | null;
    gradual: boolean;
}

export interface FusionRecovery {
    autumnRel: number | null;
    summerRel: number | null;
    autumnRaw: number | null;
    summerRaw: number | null;
    delta: number | null;
    z: number | null;
    obs: [number, number];
    ok: boolean | null;
}

export interface FusionExcludedDate {
    date: string;
    sensor: string | null;
    coverage: number;
    medianNdvi: number | null;
    ok: boolean;
    reason: 'snow_or_shadow' | 'sparse' | null;
}

export interface FusionGardenRow {
    id: string;
    code: string;
    producerCode: string;
    producerName: string;
    walletNo: string;
    licenseCode: string | null;
    parcelKey: string;
    block: string;
    parcel: string;
    locality: string;
    holderIndex: number;
    holderCount: number;
    areaM2: number;
    licensedAreaM2: number | null;
    unit: 'garden' | 'patch';
    unitAreaM2: number;
    unitGeometry: GeoJSON.Geometry | null;
    repeat: { reusedM2: number; reusedShare: number; countedM2: number; evidence: Array<{ season: string; overlapM2: number; class: FusionClass }> } | null;
    class: FusionClass;
    kind?: FusionKind | null;
    z: number | null;
    p: number;
    opticalOk: boolean;
    backscatterOk: boolean;
    coherenceOk?: boolean;
    crossIndexOk?: boolean;
    radarRequired?: boolean;
    review?: boolean;
    shadeProne?: boolean;
    observability?: FusionObservability | null;
    inCalendar?: boolean | null;
    levels?: FusionLevels | null;
    shape?: FusionShape | null;
    recovery?: FusionRecovery | null;
    populationZ?: number | null;
    changeDate: string | null;
    lastBeforeAt: string | null;
    firstAfterAt: string | null;
    detectedAt: string | null;
    likelyAt: string | null;
    agreeing: number;
    reason: string;
    groups: FusionGroupEvidence[];
    geometry: GeoJSON.Geometry;
}

export interface FusionGardenDetail extends FusionGardenRow {
    season: string;
    scans: Array<{ date: string; z: number | null; class: FusionClass }>;
    series: Array<{ key: FusionChannelKey; dates: string[]; values: Array<number | null> }>;
    /** The season's exported Sentinel-2 scenes (true colour, 10 m) for the before/after comparison. */
    scenes: { baseUrl: string; bounds: { west: number; south: number; east: number; north: number }; items: ProducerSceneItem[] } | null;
}

export interface FusionProducerRow {
    id: string;
    code: string;
    name: string;
    walletNo: string;
    licenseNo: string;
    licensedAreaM2: number;
    requiredM2: number;
    prunedAreaM2: number;
    likelyAreaM2: number;
    countedM2?: number;
    reusedM2?: number;
    shortfallM2?: number;
    gardens: number;
    prunedGardens: string[];
    likelyGardens: string[];
    status: ProducerFusionStatus;
    firstDetectedAt: string | null;
    decision?: FusionDecision;
    anomalies?: FusionAnomaly[];
    decisionReason?: string;
    ratio: number;
}

export interface FusionSummary {
    season: string;
    seasons: string[];
    calibrated: boolean;
    method: string;
    rules: Record<string, unknown>;
    channels: Record<string, { sign: 1 | -1; minEffect: number; noiseFloor: number }>;
    everyDays: number;
    scanFrom: string;
    scanTo: string;
    sensors: {
        optical: { dates: string[]; sensors?: string[]; counts?: Record<string, number>; excluded?: FusionExcludedDate[] };
        backscatter: Array<{ pass: string; relativeOrbit: number; dates: string[] }>;
        coherence: Array<{ pass: string; dates: string[] }>;
    };
    gardens: { total: number; byClass: Record<FusionClass, number>; prunedAreaM2: number; likelyAreaM2: number };
    producers: { total: number; byStatus: Record<ProducerFusionStatus, number>; byDecision: Record<FusionDecision, number> };
    timeline: Array<{ date: string; pruned: number; likely: number }>;
    localities: Array<{ name: string; pruned: number; total: number }>;
    parcelCoverage: number | null;
    unassigned: { count: number; areaM2: number; byClass: Record<FusionClass, number>; prunedAreaM2: number; patches: FusionUnassignedPatch[] };
    policy: Record<string, unknown> | null;
}

export interface FusionGardenQuery {
    page?: number;
    limit?: number;
    season?: string;
    search?: string;
    class?: FusionClass;
    locality?: string;
}

export interface FusionProducerQuery {
    page?: number;
    limit?: number;
    season?: string;
    search?: string;
    status?: ProducerFusionStatus;
    decision?: FusionDecision;
}

export interface PruningRecordQuery {
    page?: number;
    limit?: number;
    season?: string;
    scanDate?: string;
    locality?: string;
    registration?: PruningRegistration;
    radar?: RadarClass;
    fusion?: FusionClass | 'none';
    search?: string;
}

export interface ProducerQuery {
    page?: number;
    limit?: number;
    season?: string;
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


// ── Evidence packs, season reports, Ministry requests and the calibration campaign (P0) ──
export type MinistryMatchBy = 'wallet_no' | 'license_no' | 'producer_code' | 'name' | 'none';

export interface MinistryRequestItem {
    walletNo: string;
    licenseNo: string;
    producerCode: string;
    name: string;
    matchBy: MinistryMatchBy;
    matchedCode: string | null;
    matchedName: string | null;
    decision: FusionDecision | null;
    decisionLabel: string;
    status: ProducerFusionStatus | null;
    licensedAreaM2: number | null;
    requiredM2: number | null;
    countedM2: number | null;
    reusedM2: number | null;
    shortfallM2: number | null;
    anomalies: string[];
    firstDetectedAt: string | null;
    gardens: number | null;
    reason: string;
}

export interface MinistryRequestRow {
    id: string;
    areaCode: string;
    season: string;
    title: string;
    source: string;
    reference: string;
    requestedAt: string;
    note: string | null;
    itemCount: number;
    matchedCount: number;
    unmatchedCount: number;
    byDecision: Record<string, number>;
    createdByName: string;
    answeredAt: string;
    createdAt: string;
}

export interface MinistryRequestDetail extends MinistryRequestRow {
    items: MinistryRequestItem[];
}

export interface CreateMinistryRequest {
    title: string;
    source?: string;
    reference?: string;
    requestedAt: string;
    season?: string;
    note?: string;
    text?: string;
    items?: Array<{ walletNo?: string; licenseNo?: string; producerCode?: string; name?: string }>;
}

export type CalibrationLabelValue = 'pruned' | 'partial' | 'not_pruned' | 'unsure';
export type CalibrationMethod = 'field_visit' | 'photo_desk' | 'producer_statement';

export interface CalibrationLabelView {
    id: string;
    gardenCode: string;
    season: string;
    label: CalibrationLabelValue;
    method: CalibrationMethod;
    observedAt: string;
    lat: number | null;
    lng: number | null;
    accuracyM: number | null;
    prunedShare: number | null;
    note: string | null;
    hasPhoto: boolean;
    systemClassAtLabel: string | null;
    systemZAtLabel: number | null;
    createdByName: string;
    updatedAt: string;
}

export interface CalibrationPlanRow {
    gardenId: string;
    gardenCode: string;
    block: string;
    parcel: string;
    locality: string;
    holderIndex: number;
    holderCount: number;
    producerCode: string;
    producerName: string;
    areaM2: number;
    lat: number;
    lng: number;
    systemClass: FusionClass;
    systemZ: number | null;
    changeDate: string | null;
    detectedAt: string | null;
    geometry: Record<string, unknown>;
    label: CalibrationLabelView | null;
}

export interface CalibrationPlan extends Paginated<CalibrationPlanRow> {
    season: string;
    planSize: number;
    localities: string[];
}

export interface CalibrationMetrics {
    season: string;
    planSize: number;
    labelled: number;
    pending: number;
    byLabel: Record<CalibrationLabelValue, number>;
    bySystemClass: Record<FusionClass, number>;
    confusion: Record<FusionClass, Record<CalibrationLabelValue, number>>;
    positives: number;
    negatives: number;
    recall: number | null;
    falseAlarmRate: number | null;
    precision: number | null;
    recallStrict: number | null;
    falseAlarmRateStrict: number | null;
    sweep: Array<{ z: number; recall: number; falseAlarmRate: number; f1: number; detected: number }>;
    suggested: { zPruned: number; zLikely: number; f1: number } | null;
    currentRules: { zPruned: number; zLikely: number; zUnclear: number };
    calibrated: boolean;
    requirement: { minPositives: number; minNegatives: number };
    byLocality: Array<{ name: string; planned: number; labelled: number }>;
}

export interface CalibrationQuery {
    season?: string;
    size?: number;
    pending?: boolean;
    locality?: string;
    page?: number;
    limit?: number;
}

export interface SaveCalibrationLabel {
    season: string;
    gardenCode: string;
    label: CalibrationLabelValue;
    method?: CalibrationMethod;
    observedAt: string;
    lat?: number;
    lng?: number;
    accuracyM?: number;
    prunedShare?: number;
    note?: string;
}

export interface DownloadedFile {
    blob?: Blob;
    filename?: string;
    error?: string;
}

/** Authenticated download of a generated file; the server's filename is read from Content-Disposition. */
async function downloadFile(endpoint: string, fallback: string): Promise<DownloadedFile> {
    const response = await authorizedFetch(endpoint);
    if (!response.ok) return { error: await readErrorMessage(response, fallback) };
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    const plain = /filename="([^"]+)"/i.exec(disposition);
    const filename = star ? decodeURIComponent(star[1]) : plain?.[1];
    return { blob: await response.blob(), filename };
}

/** Saves a downloaded blob through a temporary link (works on Capacitor WebView too). */
export function saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}


// ── Registry operations: subdivision, licence split, transfer, correction, boundary (site-created files) ──
export interface RegistryEvent {
    at: string;
    type: string;
    note: string;
    by: string;
    applicationCode: string | null;
}

export interface HolderSpec {
    producerCode?: string;
    name?: string;
    walletNo?: string;
}

export type OperationCause = 'inheritance' | 'sale' | 'parcel_split' | 'family' | 'other';

export interface SubdivisionPayload {
    gardenCode: string;
    pieces: Array<{ label: string; geometry: Record<string, unknown>; holder: HolderSpec; licensedAreaM2?: number }>;
    cause?: OperationCause;
    reason?: string;
}

export interface LicenseSplitPayload {
    licenseCode: string;
    parts: Array<{ label: string; holder: HolderSpec; gardenCodes: string[]; recordedAreaM2?: number }>;
    cause: OperationCause;
    reason?: string;
}

export interface TransferPayload {
    licenseCode: string;
    holder: HolderSpec;
    cause: 'inheritance' | 'sale' | 'family' | 'other';
    reason?: string;
}

export interface AreaCorrectionPayload {
    gardenCode: string;
    newLicensedAreaM2: number;
    reason: string;
}

export interface BoundaryPayload {
    gardenCode: string;
    geometry: Record<string, unknown>;
    source: 'map' | 'rtk' | 'producer';
    reason?: string;
}

export interface CreateLicensingApplication {
    type: ApplicationType;
    payload: SubdivisionPayload | LicenseSplitPayload | TransferPayload | AreaCorrectionPayload | BoundaryPayload;
    providedDocuments?: string[];
    submit?: 'review' | 'draft';
}

export interface PieceComputation {
    label: string;
    holder: HolderSpec;
    holderName: string;
    planimetricAreaM2: number;
    surfaceAreaM2: number;
    measuredTeaAreaM2: number;
    licensedAreaM2: number | null;
    insideParentShare: number;
    siblingOverlapM2: number;
    overlapsGardenCodes: string[];
    pieceOverlapM2: number;
    warnings: string[];
}

export interface SubdivisionPreview {
    type: 'garden_subdivision';
    gardenCode: string;
    parent: { code: string; planimetricAreaM2: number; licensedAreaM2: number | null; measuredTeaAreaM2: number; licenseCode: string | null; producerCode: string };
    pieces: PieceComputation[];
    coveredShare: number;
    uncoveredM2: number;
    licensedTotalM2: number | null;
    warnings: string[];
    errors: string[];
    ok: boolean;
}

export interface SplitPartComputation {
    label: string;
    holder: HolderSpec;
    holderName: string;
    gardenCodes: string[];
    gardensLicensedM2: number;
    recordedAreaM2: number;
    keepsOriginal: boolean;
}

export interface SplitPreview {
    type: 'license_split';
    licenseCode: string;
    license: { code: string; producerCode: string; recordedAreaM2: number; gardenCodes: string[]; status: string };
    parts: SplitPartComputation[];
    unassignedGardenCodes: string[];
    warnings: string[];
    errors: string[];
    ok: boolean;
}

export interface BoundaryPreview {
    type: 'boundary_determination';
    gardenCode: string;
    before: { planimetricAreaM2: number; surfaceAreaM2: number; measuredTeaAreaM2: number };
    after: { planimetricAreaM2: number; surfaceAreaM2: number; measuredTeaAreaM2: number };
    outsideParcelM2: number;
    siblingOverlapM2: number;
    overlapsGardenCodes: string[];
    discrepancies: GardenDiscrepancy[];
    warnings: string[];
    errors: string[];
    ok: boolean;
}

export type OperationPreview = SubdivisionPreview | SplitPreview | BoundaryPreview;

export interface GardenEditorContext {
    garden: { code: string; producerCode: string; producerName: string; parcelKey: string; block: string; parcel: string; locality: string; licenseCode: string | null; licensedAreaM2: number | null; planimetricAreaM2: number; surfaceAreaM2: number; measuredTeaAreaM2: number; meanSlopeDeg: number; approvalStatus: GardenApprovalStatus; geometry: Record<string, unknown> };
    parcel: { geometry: Record<string, unknown>; nature: string; deedAreaM2: number | null } | null;
    siblings: Array<{ code: string; producerCode: string; producerName: string; approvalStatus: GardenApprovalStatus; licenseCode: string | null; geometry: Record<string, unknown> }>;
    teaPatches: Array<{ areaM2: number; geometry: Record<string, unknown> }>;
    license: { code: string; recordedAreaM2: number; gardenCodes: string[]; producerCode: string; status: string } | null;
    rules: { areaTolerance: number; minLicenseM2: number; overlapToleranceM2: number };
}


// Land evaluation module (Toprak Koruma ve Arazi Değerlendirme)
export type LandSlopeCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type LandAkkClass = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII' | 'VIII';
export type Law5403Class = 'MT' | 'OT' | 'DT' | 'TA' | 'TD';
export type LandDeclaredUse = 'tea' | 'hazelnut' | 'forest' | 'pasture' | 'field' | 'orchard' | 'built' | 'other';
export type LandObservedUse = 'tea' | 'trees' | 'pasture' | 'field' | 'shrub' | 'built' | 'bare' | 'water' | 'wet' | 'unknown';
export type LandMismatchFlag = 'tea_title_no_tea' | 'abandoned_to_trees' | 'agri_to_built' | 'forest_cleared' | 'pasture_to_crops' | 'wet_or_water';
export type LandErosionClass = 'very_low' | 'low' | 'moderate' | 'high' | 'very_high' | 'no_data';
export type LandCropKey = 'tea' | 'hazelnut' | 'kiwi' | 'chestnut' | 'blueberry' | 'pasture' | 'vegetable' | 'forestry';
export type LandDwClass = 'water' | 'trees' | 'grass' | 'flooded_vegetation' | 'crops' | 'shrub_and_scrub' | 'built' | 'bare' | 'snow_and_ice';
export type LandClassFractions = Partial<Record<LandDwClass, number>>;

export type LandSourceType = 'mevzuat' | 'kurum' | 'akademik' | 'istatistik' | 'meteoroloji' | 'cografi-isaret' | 'veri';

/** One entry of the evidence registry (law, ministry report, paper, GI registration, data set). */
export interface LandSourceRef {
    id: string;
    title: string;
    org: string;
    year: number | string;
    url: string;
    type: LandSourceType;
    used: string;
    caveat?: string;
}

export interface LandStationNormals {
    id: string;
    name: string;
    lat: number;
    lng: number;
    elevationM: number;
    period: string;
    tmean: number[];
    tmax: number[];
    tmin: number[];
    rainDays: number[];
    precipMm: number[];
    classes?: { erinc?: number; deMartonne?: number; aydeniz?: number; thornthwaite?: string };
    anchor?: boolean;
    sources: string[];
}

export interface LandDistrictFacts {
    province: string;
    district: string;
    landUseDa: { agriculture: number; pasture: number; forest: number; nonAgri: number; total: number; source: string } | null;
    supportedProducts: { products: string[]; source: string } | null;
    notes: Array<{ text: string; source: string }>;
}

export interface LandFactorRule {
    key: string;
    label: string;
    unit: string;
    digits: number;
    /** [lo0, lo1, hi1, hi0]; null = open end. */
    band: Array<number | null>;
    sources: string[];
    note: string;
}

export interface LandCropRule {
    key: LandCropKey;
    label: string;
    rationale: string;
    factors: LandFactorRule[];
    legal: Array<{ label: string; sources: string[]; kind: string }>;
    sources: string[];
}

export interface LandFactorResult {
    key: string;
    label: string;
    value: number | null;
    display: string;
    score: number;
    sources: string[];
    note: string;
}

export interface LandSuitability {
    crop: LandCropKey;
    score: number;
    limiting: string | null;
    factors: LandFactorResult[];
    legal: Array<{ label: string; sources: string[]; status: 'ok' | 'fail' | 'na' }>;
    supported: boolean;
}

export interface LandParcelClimate {
    offsetC: number;
    years: number[];
    tmean: number;
    tminAbs: number;
    tmaxAbs: number;
    frostDays: number;
    hotDays: number;
    precipMm: number;
    julyMean: number;
    rhSummer: number;
    chillHours: number;
    frostFreeDays: number;
    springFrostDays: number;
    bloomRainDays: number;
}

export interface LandNdviPeriod {
    period: string;
    ndvi: number | null;
    denseShare: number | null;
}

export interface LandEvidence {
    cropRules: LandCropRule[];
    sources: LandSourceRef[];
    stations: LandStationNormals[];
    district: LandDistrictFacts | null;
    rules: Record<string, unknown>;
    method: string;
    generatedAt: string;
}

export interface ParcelLand {
    key: string;
    block: string;
    parcel: string;
    nature: string;
    areaM2: number;
    terrain: {
        elevationM: number | null;
        slopePct: number | null;
        slopeMaxPct: number | null;
        aspectDeg: number | null;
        tpiM: number | null;
        handM: number | null;
        upstreamKm2: number | null;
        streamDistM: number | null;
        waterOccurrence: number | null;
        slopeClass: LandSlopeCode;
        slopeLabel: string;
        aspectLabel: string | null;
    };
    soil: {
        clayPct: number | null;
        sandPct: number | null;
        siltPct: number | null;
        ph: number | null;
        socPct: number | null;
        cec: number | null;
        bulkDensity: number | null;
        textureCode: number | null;
        textureLabel: string | null;
        phLabel: string | null;
    };
    landUse: {
        declared: LandDeclaredUse;
        observed: LandObservedUse;
        teaShare: number | null;
        latestYear: number | null;
        latest: LandClassFractions;
        history: Array<{ year: number; dominant: LandDwClass | null; fractions: LandClassFractions }>;
        worldcover: Record<string, number>;
        mismatches: LandMismatchFlag[];
        change: { from: LandDwClass; to: LandDwClass; fromYear: number; toYear: number } | null;
        ndviHistory?: LandNdviPeriod[];
    };
    erosion: { index: number | null; class: LandErosionClass; factors: { R: number | null; K: number | null; LS: number | null; C: number | null }; sources?: string[] };
    capability: { akk: LandAkkClass | null; limitations: string[]; law5403: Law5403Class | null; law5403Label: string; reasoning?: string; sources?: string[] };
    climate?: LandParcelClimate | null;
    suitability: LandSuitability[];
    recommendations: Array<{ text: string; sources: string[] }>;
}

export interface LandClimatePeriod {
    period: string;
    days: number;
    tmean: number;
    tmaxMean: number;
    tminMean: number;
    tminAbs: number;
    tmaxAbs: number;
    rhMean: number;
    precipMm: number;
    rainDays: number;
    frostDays: number;
    hotDays: number;
    gdd10: number;
    drySpellMax: number;
}

type LandWindowAgg = Pick<LandClimatePeriod, 'tmean' | 'precipMm' | 'rainDays' | 'frostDays' | 'hotDays'> & { rhMean?: number };

export interface LandClimateWindow {
    key: string;
    label: string;
    from: string;
    to: string;
    why: string;
    sources?: string[];
    years: Array<{ year: number } & Omit<LandClimatePeriod, 'period'>>;
    baseline: LandWindowAgg;
    recent: LandWindowAgg;
}

export interface LandStationAnchor {
    stations: Array<{ id: string; name: string; distanceKm: number; weight: number; elevationM: number; period: string }>;
    normal: { tmean: number[]; tmax: number[]; tmin: number[]; precipMm: number[]; rainDays: number[]; annualPrecipMm: number; annualTmean: number };
    model: { tmean: number[]; precipEra: number[]; precipChirps: number[]; years: number[] };
    monthlyOffsetC: number[];
    monthlyPrecipRatio: number[];
}

export interface LandClimateIndices {
    erinc: { value: number; class: string };
    deMartonne: { value: number; class: string };
    koppen: { code: string; label: string };
    reference: Array<{ station: string; erinc: number | null; deMartonne: number | null; thornthwaite: string | null }>;
}

export interface LandClimate {
    source: string;
    from: string;
    to: string;
    lapse: { neighbourhoodElevationM: number; cellElevationM: number; correctionC: number };
    /** Station anchoring, decades, indices and seasons exist on bundles produced by the cited model (2026-10-28 →). */
    anchor?: LandStationAnchor;
    monthly: LandClimatePeriod[];
    yearly: LandClimatePeriod[];
    decades?: Array<{ label: string; years: number[] } & Omit<LandClimatePeriod, 'period' | 'days'>>;
    climatology: Array<{ month: number; tmean: number; tmin: number; tmax: number; precipMm: number; rainDays: number; rhMean: number }>;
    baselineYears: number[];
    recentYears: number[];
    anomaly: { tmean: number; precipMm: number; frostDays: number; hotDays: number; rainDays: number; drySpellMax: number; rhMean: number };
    trend: { tmeanPerDecade: number; precipPerDecade: number; hotDaysPerDecade: number; frostDaysPerDecade: number };
    indices?: LandClimateIndices;
    seasons?: Array<{ year: number; lastSpringFrost: string | null; firstAutumnFrost: string | null; frostFreeDays: number; chillHours: number }>;
    windows: LandClimateWindow[];
}

export interface LandSummaryCounts {
    parcels: number;
    evaluatedAreaM2: number;
    byAkk: Record<LandAkkClass, number>;
    byLaw5403: Record<Law5403Class, number>;
    byObserved: Record<LandObservedUse, number>;
    byErosion: Record<LandErosionClass, number>;
    mismatches: Record<LandMismatchFlag, number>;
    suitabilityMean: Record<LandCropKey, number>;
    conversionCandidates: number;
}

export interface LandSummary {
    calibrated: boolean;
    method: string;
    generatedAt: string;
    rules: Record<string, unknown>;
    crops: Array<{ key: LandCropKey; label: string }>;
    district: LandDistrictFacts | null;
    summary: LandSummaryCounts;
    boundaryAreaM2: number;
    landUse: { years: number[]; boundary: Record<number, LandClassFractions>; worldcover: Record<string, number> };
    ndviHistory: LandNdviPeriod[];
    ndviPeriods: Array<{ period: string; from: number; to: number; scenes: number }>;
    climate: Pick<LandClimate, 'source' | 'from' | 'to' | 'baselineYears' | 'recentYears' | 'anomaly' | 'trend' | 'indices' | 'anchor'> & { years: number };
}

export interface LandParcelRow {
    id: string;
    key: string;
    block: string;
    parcel: string;
    nature: string;
    locality: string;
    areaM2: number;
    elevationM: number | null;
    slopePct: number | null;
    slopeLabel: string;
    aspectLabel: string | null;
    ph: number | null;
    textureLabel: string | null;
    declared: LandDeclaredUse;
    observed: LandObservedUse;
    mismatches: LandMismatchFlag[];
    change: ParcelLand['landUse']['change'];
    erosionClass: LandErosionClass;
    erosionIndex: number | null;
    akk: LandAkkClass | null;
    law5403: Law5403Class | null;
    law5403Label: string;
    limitations: string[];
    best: LandSuitability | null;
    suitability: LandSuitability[];
    recommendations: number;
}

export interface LandParcelDetail extends LandParcelRow {
    geometry: GeoJSON.Geometry;
    land: ParcelLand;
}

export interface LandParcelQuery {
    page?: number;
    limit?: number;
    search?: string;
    akk?: LandAkkClass;
    law5403?: Law5403Class;
    observed?: LandObservedUse;
    erosion?: LandErosionClass;
    mismatch?: LandMismatchFlag;
    crop?: LandCropKey;
}

// ── Garden age / renewal module: Landsat establishment year, renewals, vigour, activity, abandonment, priority ──
export type GardenAgeClass = 'under_10' | 'y10_25' | 'y25_40' | 'over_40' | 'not_tea' | 'unknown';
export type GardenActivityClass = 'harvested' | 'low' | 'none' | 'no_data';
export type GardenAbandonClass = 'active' | 'weak' | 'likely_abandoned' | 'not_tea';
export type GardenPriorityClass = 'high' | 'medium' | 'low' | 'not_applicable';

export interface ParcelAge {
    key: string;
    block: string;
    parcel: string;
    nature: string;
    areaM2: number;
    teaShare: number | null;
    series: { years: number[]; ndvi: Array<number | null>; smooth: Array<number | null>; obs: Array<number | null> };
    s2: { years: number[]; months: number[]; ndvi: Record<number, Array<number | null>>; dips: Record<number, number>; amplitude: Record<number, number | null> };
    establishment: { year: number | null; preRecord: boolean; confidence: 'high' | 'medium' | 'low'; note: string };
    ageYears: number | null;
    ageClass: GardenAgeClass;
    renewals: Array<{ year: number; drop: number; recoveredIn: number }>;
    lastRenewalYear: number | null;
    vigour: { trendPerDecade: number | null; recentMean: number | null; peakMean: number | null; peakYears: string | null; declinePct: number | null };
    activity: { dipsPerYear: number | null; amplitude: number | null; class: GardenActivityClass };
    abandonment: { score: number; class: GardenAbandonClass; reasons: string[] };
    priority: { score: number; class: GardenPriorityClass; reasons: string[] };
}

// ── Pixel scan (Piksel taraması) ──
export type PixelKind = 'deep' | 'light' | 'transient' | 'pending';
export type PixelConfidence = 'high' | 'medium' | 'low';
export type PixelVerdict = 'deep' | 'light' | 'pending' | 'transient' | 'weak' | 'none' | 'no_data';
export type PixelVerdictFilter = 'found' | 'counted' | PixelVerdict;
export interface PixelCluster {
    index: number;
    pixels: number;
    corePixels: number;
    edgePixels: number;
    areaM2: number;
    areaLowM2: number;
    areaUpperM2: number;
    centroid: [number, number];
    meanDelta: number;
    maxZ: number;
    nbrDelta: number | null;
    crossIndexOk: boolean;
    kind: PixelKind;
    depth: number | null;
    recoveryDays: number | null;
    summerRecovery: number | null;
    lastObsDays: number;
    confidence: PixelConfidence;
    note: string;
}
export interface PixelGardenRow {
    id: string;
    code: string;
    block: string;
    parcel: string;
    locality: string;
    producerCode: string;
    producerName: string;
    areaM2: number;
    pixels: number;
    evaluatedPixels: number;
    verdict: PixelVerdict;
    fusionClass: string | null;
    fusionKind: string | null;
    best: { date: string; lastBefore: string | null; score: number } | null;
    candidates: Array<{ date: string; lastBefore: string | null; pixels: number; score: number }>;
    prunedM2: number;
    prunedLowM2: number;
    prunedUpperM2: number;
    mainCluster: number | null;
    clusters: PixelCluster[];
}
export interface PixelGardenDetail extends PixelGardenRow {
    season: string;
    epsg: string;
    /** [e, n, insideM2, delta, z, flag (0 none · 1 grown · 2 core), cluster (−1 none), edge (0/1)]. */
    px: Array<[number, number, number, number | null, number | null, number, number, number]>;
    series: { dates: string[]; cluster: Array<number | null>; rest: Array<number | null> } | null;
    geometry: GeoJSON.Geometry;
}
export interface PixelScanSummary {
    season: string;
    seasons: string[];
    generatedAt: string;
    method: string;
    rules: Record<string, number | string | number[] | string[]>;
    epsg: string;
    window: [string, string];
    scan: { from: string; to: string; candidates: number };
    dates: number;
    excludedDates: string[];
    summary: {
        gardens: number;
        pixels: number;
        flaggedPixels: number;
        byVerdict: Record<PixelVerdict, number>;
        areaM2: { deep: number; light: number; pending: number };
        vsFusion: Record<string, Partial<Record<PixelVerdict, number>>>;
        newFinds: number;
    };
}
export interface PixelScanGardenQuery {
    page?: number;
    limit?: number;
    season?: string;
    verdict?: PixelVerdictFilter;
    newOnly?: 'true';
}

// ── Blind field tests (Saha testi) ──
export type FieldTestVerdict = 'detected' | 'not_detected' | 'pending';
export type FieldTestConfidence = 'high' | 'medium' | 'low';
export type FieldTestPass = 'ASCENDING' | 'DESCENDING';
export type FieldTestMatch = 'match' | 'partial' | 'miss' | 'no_detection';
export interface FieldStepTest {
    nBefore: number;
    nAfter: number;
    meanBefore: number | null;
    meanAfter: number | null;
    sdBefore: number | null;
    delta: number | null;
    z: number | null;
}
export interface FieldTestPixel {
    id: string;
    e: number;
    n: number;
    geometry: GeoJSON.Polygon;
    insideM2: number;
    insideShare: number;
    edgeNonTea: boolean;
    optical: { ndvi: FieldStepTest; nbr: FieldStepTest; ndviBeforeAbs: number | null; clearShare: number };
    radar: Partial<Record<FieldTestPass, { vh: FieldStepTest; ratio: FieldStepTest }>>;
    flagged: boolean;
    strong: boolean;
    fraction: number | null;
    prunedM2: number | null;
    cluster: number | null;
}
export interface FieldTestDateBracket {
    lastBefore: string | null;
    firstAfter: string | null;
    bestSplit: string | null;
    bestDelta: number | null;
    containsPrunedAt: boolean | null;
}
export interface FieldTestCluster {
    index: number;
    pixelIds: string[];
    areaM2: number;
    areaRange: [number, number];
    areaUpperM2: number;
    shareOfParcel: number;
    centroid: [number, number];
    position: string;
    edgeShare: number;
    meanDelta: number;
    maxZ: number;
    dateBracket: FieldTestDateBracket;
    radar: Partial<Record<FieldTestPass, { vh: FieldStepTest; ratio: FieldStepTest }>>;
    radarChange: boolean;
    confidence: FieldTestConfidence;
    note: string;
}
export interface FieldTestGroundTruthComparison {
    detectedM2: number;
    overlapM2: number;
    detectedInsideShare: number;
    groundTruthCoveredShare: number;
    centroidDistanceM: number | null;
    mainClusterInside: boolean;
    verdict: FieldTestMatch;
    text: string;
}
export interface FieldTestUndated {
    scan: { from: string; to: string; candidates: number; zThreshold: number };
    verdict: 'detected' | 'not_detected';
    bestDate: string | null;
    dateBracket: { lastBefore: string | null; firstAfter: string | null };
    candidates: Array<{ date: string; lastBefore: string | null; flagged: number; clusterPixels: number; score: number }>;
    pixels: Array<{ id: string; delta: number | null; z: number | null; nBefore: number; nAfter: number; flagged: boolean; strong: boolean; fraction: number | null; prunedM2: number | null; cluster: number | null }>;
    clusters: Array<{
        index: number;
        pixelIds: string[];
        areaM2: number;
        areaUpperM2: number;
        centroid: [number, number];
        position: string;
        meanDelta: number;
        maxZ: number;
        edgeShare: number;
        confidence: FieldTestConfidence;
        radar: Partial<Record<FieldTestPass, FieldStepTest>>;
        radarChange: boolean;
    }>;
    prunedM2: number;
    shareOfParcel: number;
    mainCluster: number | null;
    summary: string[];
    evaluation: { dateHit: boolean | null; dateErrorDays: number | null; location: FieldTestGroundTruthComparison | null; text: string } | null;
}
export interface FieldTestCase {
    id: string;
    block: string;
    parcel: string;
    prunedAt: string;
    reportedAt: string | null;
    source: string;
    note: string | null;
    parcelGeometry: GeoJSON.Geometry;
    deedAreaM2: number | null;
    parcelAreaM2: number;
    parcelCentroid: [number, number];
    epsg: string;
    window: [string, string];
    windows: { before: [string, string]; after: [string, string] };
    reference: { pixels: number; areaM2: number };
    excludedDates: string[];
    pixels: FieldTestPixel[];
    clusters: FieldTestCluster[];
    detection: {
        verdict: FieldTestVerdict;
        prunedM2: number;
        prunedRange: [number, number];
        shareOfParcel: number;
        mainCluster: number | null;
        dateBracket: FieldTestDateBracket | null;
        summary: string[];
    };
    series: {
        optical: { dates: string[]; clusters: Record<string, Array<number | null>>; rest: Array<number | null>; parcel: Array<number | null>; neighbours: Array<number | null> };
        radar: Array<{ pass: FieldTestPass; relativeOrbit: number; dates: string[]; clusters: Record<string, Array<number | null>>; rest: Array<number | null> }>;
    };
    groundTruth: { geometry: GeoJSON.Geometry; areaM2: number; approximate: boolean; note: string | null; measuredAreaM2?: number | null; comparison: FieldTestGroundTruthComparison } | null;
    calibration?: { ndviPruned: number; range: [number, number]; source: 'default' | 'field'; measuredAreaM2: number | null; note: string };
    /** The same parcel judged without the field date (season scan). */
    undated?: FieldTestUndated;
}
export interface FieldTestsBlock {
    generatedAt: string;
    method: string;
    rules: Record<string, number | number[]>;
    cases: FieldTestCase[];
}

export interface GardenAgeSummary {
    calibrated: boolean;
    method: string;
    generatedAt: string;
    rules: Record<string, unknown>;
    sources: Array<{ id: string; title: string; org: string; year: number | string; url: string; used: string }>;
    summary: {
        parcels: number;
        teaAreaM2: number;
        byAgeClass: Record<GardenAgeClass, number>;
        byActivity: Record<GardenActivityClass, number>;
        byAbandonment: Record<GardenAbandonClass, number>;
        byPriority: Record<GardenPriorityClass, number>;
        establishmentByDecade: Record<string, number>;
        renewalsByYear: Record<number, number>;
        meanAgeYears: number | null;
        medianEstablishmentYear: number | null;
        highPriorityAreaM2: number;
        likelyAbandonedAreaM2: number;
    };
}

export interface GardenAgeParcelRow {
    id: string;
    key: string;
    block: string;
    parcel: string;
    nature: string;
    locality: string;
    areaM2: number;
    teaShare: number | null;
    establishmentYear: number | null;
    preRecord: boolean;
    confidence: 'high' | 'medium' | 'low';
    ageYears: number | null;
    ageClass: GardenAgeClass;
    renewals: number;
    lastRenewalYear: number | null;
    trendPerDecade: number | null;
    recentMean: number | null;
    declinePct: number | null;
    activity: GardenActivityClass;
    dipsPerYear: number | null;
    abandonment: GardenAbandonClass;
    abandonmentScore: number;
    priority: GardenPriorityClass;
    priorityScore: number;
    priorityReasons: string[];
}

export interface GardenAgeParcelDetail extends GardenAgeParcelRow {
    geometry: GeoJSON.Geometry;
    age: ParcelAge;
}

export interface GardenAgeParcelQuery {
    page?: number;
    limit?: number;
    search?: string;
    ageClass?: GardenAgeClass;
    activity?: GardenActivityClass;
    abandonment?: GardenAbandonClass;
    priority?: GardenPriorityClass;
    sort?: 'priority' | 'age' | 'abandonment' | 'parcel';
}

// ── Garden-health module (P3): growing-season anomalies, vigour, yield vs quota, fertilisation feedback ──
export type HealthAnomalyClass = 'chemical_suspect' | 'defoliation' | 'stress' | 'none' | 'no_data';
export type YieldFlag = 'ok' | 'low' | 'high' | 'no_license' | 'no_data';
export type FertiliserType = 'nitrogen' | 'compound' | 'organic' | 'foliar' | 'other';
export type FertilisationResponseClass = 'strong' | 'weak' | 'none' | 'negative' | 'pending' | 'no_data';

export interface HealthAnomaly {
    class: HealthAnomalyClass;
    date: string | null;
    dropNdvi: number | null;
    dropNdre: number | null;
    z: number | null;
    radarDb: number | null;
    radarStructural: boolean | null;
    recovery: number | null;
    nBefore: number;
    nAfter: number;
    reason: string;
}

export interface HealthGardenRow {
    id: string;
    code: string;
    block: string;
    parcel: string;
    locality: string;
    producerCode: string;
    producerName: string;
    walletNo: string;
    licenseCode: string | null;
    teaAreaM2: number;
    licensedAreaM2: number | null;
    vigour: number | null;
    ndviMean: number | null;
    ndreMean: number | null;
    nbhdNdviMean: number | null;
    prunedShare: number;
    anomaly: HealthAnomaly;
    yieldKg: number;
    yieldFactors: { vigour: number; pruning: number; anomaly: number };
    observations: number;
    fertilisations: number;
    geometry: Record<string, unknown>;
}

export interface FertilisationView {
    id: string;
    gardenCode: string;
    producerCode: string;
    appliedAt: string;
    type: FertiliserType;
    product: string;
    amountKgPerDa: number | null;
    note: string | null;
    source: 'producer' | 'staff';
    createdByName: string;
    createdAt: string;
    response: { class: FertilisationResponseClass; ndreBefore: number | null; ndreAfter: number | null; ndviBefore: number | null; ndviAfter: number | null; deltaNdre: number | null; deltaNdvi: number | null; nBefore: number; nAfter: number; reason: string };
}

export interface HealthGardenDetail extends HealthGardenRow {
    dates: string[];
    series: { ndvi: Array<number | null>; ndre: Array<number | null>; nbr: Array<number | null>; vhAsc: Array<number | null> | null; vhDesc: Array<number | null> | null } | null;
    relative: { ndvi: Array<number | null>; ndre: Array<number | null> };
    neighbourhood: { ndviMedian: Array<number | null>; ndreMedian: Array<number | null> };
    radarDates: Array<{ pass: string; dates: string[] }>;
    fertilisationRecords: FertilisationView[];
}

export interface HealthProducerView {
    id: string;
    code: string;
    name: string;
    walletNo: string;
    licenseNo: string;
    gardens: number;
    teaAreaM2: number;
    licensedAreaM2: number;
    yieldKg: number;
    quotaKg: number;
    ratio: number | null;
    flag: YieldFlag;
    anomalies: Record<string, number>;
    meanVigour: number | null;
    reason: string;
}

export interface HealthSummary {
    season: string;
    seasons: string[];
    calibrated: boolean;
    method: string;
    rules: Record<string, unknown>;
    window: [string, string];
    sensors: { optical: { dates: string[]; sensors?: string[]; counts?: Record<string, number> }; backscatter: Array<{ pass: string; relativeOrbit: number; dates: string[] }> };
    gardens: { total: number; byAnomaly: Record<HealthAnomalyClass, number>; meanVigour: number | null; yieldKg: number; teaAreaM2: number };
    producers: { total: number; byFlag: Record<YieldFlag, number>; yieldKg: number; quotaKg: number };
    localities: Array<{ name: string; gardens: number; suspects: number; meanVigour: number | null }>;
    fertilisation: { records: number; byResponse: Record<FertilisationResponseClass, number> };
    neighbourhood: { dates: string[]; ndviMedian: Array<number | null>; ndreMedian: Array<number | null> };
}

export interface HealthGardenQuery {
    page?: number;
    limit?: number;
    season?: string;
    search?: string;
    anomaly?: HealthAnomalyClass;
    locality?: string;
}

export interface HealthProducerQuery {
    page?: number;
    limit?: number;
    season?: string;
    search?: string;
    flag?: YieldFlag;
}

export interface CreateFertilisation {
    gardenCode: string;
    appliedAt: string;
    type: FertiliserType;
    product?: string;
    amountKgPerDa?: number;
    note?: string;
    source?: 'producer' | 'staff';
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
    getInventoryOverview: () => request<RegionOverview>('/caykur/tea-inventory/overview'),
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
    getInventoryProducerSummary: (areaId: string, season?: string) =>
        request<ProducerSummary>(`/caykur/tea-inventory/areas/${areaId}/producers/summary${season ? `?season=${encodeURIComponent(season)}` : ''}`),
    getInventoryPurchaseList: (areaId: string, season: string, page = 1, limit = 20) =>
        request<Paginated<ProducerRow>>(`/caykur/tea-inventory/areas/${areaId}/purchase-list?season=${encodeURIComponent(season)}&page=${page}&limit=${limit}`),
    getInventoryProducer: (id: string) => request<ProducerDetail>(`/caykur/tea-inventory/producers/${id}`),
    decideInventoryProducer: (id: string, body: { decision: 'approved' | 'rejected'; note?: string }) =>
        request<ProducerDetail>(`/caykur/tea-inventory/producers/${id}/decision`, { method: 'POST', body: JSON.stringify(body) }),
    /** Purchase list as a CSV blob (Excel-compatible), or an error message. */
    downloadInventoryPurchaseCsv: async (areaId: string, season: string): Promise<{ blob?: Blob; error?: string }> => {
        const response = await authorizedFetch(`/caykur/tea-inventory/areas/${areaId}/purchase-list.csv?season=${encodeURIComponent(season)}`);
        if (!response.ok) return { error: await readErrorMessage(response, 'Liste indirilemedi') };
        return { blob: await response.blob() };
    },

    // Çaykur satellite pruning records (scan-centred feed)
    getPruningRecords: (areaId: string, params?: PruningRecordQuery) => {
        const entries = Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '') as Array<[string, string | number]>;
        const query = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
        return request<Paginated<PruningRecordRow>>(`/caykur/tea-inventory/areas/${areaId}/pruning-records${query ? `?${query}` : ''}`);
    },
    getPruningRecordSummary: (areaId: string, season?: string) =>
        request<PruningRecordSummary>(`/caykur/tea-inventory/areas/${areaId}/pruning-records/summary${season ? `?season=${encodeURIComponent(season)}` : ''}`),
    /** Pruning records as a CSV blob (Excel-compatible), or an error message. */
    downloadPruningRecordsCsv: async (areaId: string, season: string): Promise<{ blob?: Blob; error?: string }> => {
        const response = await authorizedFetch(`/caykur/tea-inventory/areas/${areaId}/pruning-records.csv?season=${encodeURIComponent(season)}`);
        if (!response.ok) return { error: await readErrorMessage(response, 'Liste indirilemedi') };
        return { blob: await response.blob() };
    },

    // Çaykur multi-sensor pruning verdicts (fusion module)
    getFusionSummary: (areaId: string, season?: string) =>
        request<FusionSummary>(`/caykur/tea-inventory/areas/${areaId}/pruning-fusion/summary${season ? `?season=${encodeURIComponent(season)}` : ''}`),
    getFusionGardens: (areaId: string, params?: FusionGardenQuery) => {
        const entries = Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '') as Array<[string, string | number]>;
        const query = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
        return request<Paginated<FusionGardenRow>>(`/caykur/tea-inventory/areas/${areaId}/pruning-fusion/gardens${query ? `?${query}` : ''}`);
    },
    getFusionGarden: (id: string, season?: string) => request<FusionGardenDetail>(`/caykur/tea-inventory/pruning-fusion/gardens/${id}${season ? `?season=${encodeURIComponent(season)}` : ''}`),
    getFusionProducers: (areaId: string, params?: FusionProducerQuery) => {
        const entries = Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '') as Array<[string, string | number]>;
        const query = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
        return request<Paginated<FusionProducerRow>>(`/caykur/tea-inventory/areas/${areaId}/pruning-fusion/producers${query ? `?${query}` : ''}`);
    },
    /** "Who pruned" as a CSV blob (Excel-compatible), or an error message. */
    downloadFusionProducersCsv: async (areaId: string, season: string): Promise<{ blob?: Blob; error?: string }> => {
        const response = await authorizedFetch(`/caykur/tea-inventory/areas/${areaId}/pruning-fusion/producers.csv?season=${encodeURIComponent(season)}`);
        if (!response.ok) return { error: await readErrorMessage(response, 'Liste indirilemedi') };
        return { blob: await response.blob() };
    },

    // Çaykur digital licence register
    getLicensingSummary: (areaId: string) => request<LicensingSummary>(`/caykur/tea-inventory/areas/${areaId}/licensing/summary`),
    getLicensingProducers: (areaId: string, params?: LicensingProducerQuery) => {
        const entries = Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '') as Array<[string, string | number]>;
        const query = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
        return request<Paginated<LicensingProducerRow>>(`/caykur/tea-inventory/areas/${areaId}/licensing/producers${query ? `?${query}` : ''}`);
    },
    getLicensingProducer: (areaId: string, code: string) =>
        request<LicensingProducerProfile>(`/caykur/tea-inventory/areas/${areaId}/licensing/producers/${encodeURIComponent(code)}`),
    getLicensingApplications: (areaId: string, params?: ApplicationQuery) => {
        const entries = Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '') as Array<[string, string | number]>;
        const query = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
        return request<Paginated<ApplicationRow>>(`/caykur/tea-inventory/areas/${areaId}/licensing/applications${query ? `?${query}` : ''}`);
    },
    getLicensingApplication: (areaId: string, code: string) =>
        request<ApplicationDetail>(`/caykur/tea-inventory/areas/${areaId}/licensing/applications/${encodeURIComponent(code)}`),
    decideLicensingApplication: (areaId: string, code: string, body: { status: ApplicationStatus; note?: string }) =>
        request<ApplicationDetail>(`/caykur/tea-inventory/areas/${areaId}/licensing/applications/${encodeURIComponent(code)}/decision`, { method: 'POST', body: JSON.stringify(body) }),
    getLicensingLayers: (areaId: string) => request<LicensingLayers>(`/caykur/tea-inventory/areas/${areaId}/licensing/layers`),
    /** Producer register as a CSV blob (Excel-compatible), or an error message. */
    downloadLicensingCsv: async (areaId: string): Promise<{ blob?: Blob; error?: string }> => {
        const response = await authorizedFetch(`/caykur/tea-inventory/areas/${areaId}/licensing/producers.csv`);
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

    // ── Evidence packs, season reports, Ministry requests, calibration ──
    downloadProducerEvidencePdf: (areaId: string, code: string, season?: string) =>
        downloadFile(`/caykur/tea-inventory/areas/${areaId}/pruning-fusion/producers/${encodeURIComponent(code)}/evidence.pdf${season ? `?season=${encodeURIComponent(season)}` : ''}`, 'Kanıt dosyası üretilemedi'),
    downloadGardenEvidencePdf: (gardenId: string) =>
        downloadFile(`/caykur/tea-inventory/pruning-fusion/gardens/${gardenId}/evidence.pdf`, 'Kanıt dosyası üretilemedi'),
    downloadSeasonReport: (areaId: string, format: 'xlsx' | 'pdf', season?: string) =>
        downloadFile(`/caykur/tea-inventory/areas/${areaId}/reports/season.${format}${season ? `?season=${encodeURIComponent(season)}` : ''}`, 'Rapor üretilemedi'),
    getMinistryRequests: (areaId: string, season?: string) =>
        request<MinistryRequestRow[]>(`/caykur/tea-inventory/areas/${areaId}/ministry-requests${season ? `?season=${encodeURIComponent(season)}` : ''}`),
    createMinistryRequest: (areaId: string, body: CreateMinistryRequest) =>
        request<MinistryRequestDetail>(`/caykur/tea-inventory/areas/${areaId}/ministry-requests`, { method: 'POST', body: JSON.stringify(body) }),
    getMinistryRequest: (areaId: string, id: string) => request<MinistryRequestDetail>(`/caykur/tea-inventory/areas/${areaId}/ministry-requests/${id}`),
    deleteMinistryRequest: async (areaId: string, id: string): Promise<{ error?: string }> => {
        const response = await authorizedFetch(`/caykur/tea-inventory/areas/${areaId}/ministry-requests/${id}`, { method: 'DELETE' });
        return response.ok ? {} : { error: await readErrorMessage(response, 'Talep silinemedi') };
    },
    downloadMinistryAnswer: (areaId: string, id: string) =>
        downloadFile(`/caykur/tea-inventory/areas/${areaId}/ministry-requests/${id}/answer.xlsx`, 'Cevap listesi üretilemedi'),
    downloadMinistryEvidenceZip: (areaId: string, id: string) =>
        downloadFile(`/caykur/tea-inventory/areas/${areaId}/ministry-requests/${id}/evidence.zip`, 'Kanıt paketi üretilemedi'),
    getCalibrationPlan: (areaId: string, params?: CalibrationQuery) => {
        const entries = Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false) as Array<[string, string | number | boolean]>;
        const query = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
        return request<CalibrationPlan>(`/caykur/tea-inventory/areas/${areaId}/calibration/plan${query ? `?${query}` : ''}`);
    },
    getCalibrationLabels: (areaId: string, params?: CalibrationQuery) => {
        const entries = Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false) as Array<[string, string | number | boolean]>;
        const query = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
        return request<Paginated<CalibrationPlanRow>>(`/caykur/tea-inventory/areas/${areaId}/calibration/labels${query ? `?${query}` : ''}`);
    },
    getCalibrationMetrics: (areaId: string, season?: string) =>
        request<CalibrationMetrics>(`/caykur/tea-inventory/areas/${areaId}/calibration/metrics${season ? `?season=${encodeURIComponent(season)}` : ''}`),
    saveCalibrationLabel: (areaId: string, body: SaveCalibrationLabel) =>
        request<CalibrationLabelView>(`/caykur/tea-inventory/areas/${areaId}/calibration/labels`, { method: 'POST', body: JSON.stringify(body) }),
    uploadCalibrationPhoto: async (areaId: string, labelId: string, file: Blob, name = 'photo.jpg'): Promise<ApiResponse<CalibrationLabelView>> => {
        const formData = new FormData();
        formData.append('file', file, name);
        const response = await authorizedFetch(`/caykur/tea-inventory/areas/${areaId}/calibration/labels/${labelId}/photo`, { method: 'POST', body: formData });
        if (!response.ok) return { error: { message: await readErrorMessage(response, 'Fotoğraf yüklenemedi'), statusCode: response.status } };
        return { data: (await response.json()) as CalibrationLabelView };
    },
    getCalibrationPhoto: async (areaId: string, labelId: string): Promise<Blob | null> => {
        const response = await authorizedFetch(`/caykur/tea-inventory/areas/${areaId}/calibration/labels/${labelId}/photo`);
        return response.ok ? response.blob() : null;
    },
    deleteCalibrationLabel: async (areaId: string, labelId: string): Promise<{ error?: string }> => {
        const response = await authorizedFetch(`/caykur/tea-inventory/areas/${areaId}/calibration/labels/${labelId}`, { method: 'DELETE' });
        return response.ok ? {} : { error: await readErrorMessage(response, 'Etiket silinemedi') };
    },
    downloadCalibrationCsv: (areaId: string, season?: string) =>
        downloadFile(`/caykur/tea-inventory/areas/${areaId}/calibration/labels.csv${season ? `?season=${encodeURIComponent(season)}` : ''}`, 'Etiketler indirilemedi'),

    // ── Registry operations (site-created licensing files) ──
    createLicensingApplication: (areaId: string, body: CreateLicensingApplication) =>
        request<ApplicationDetail>(`/caykur/tea-inventory/areas/${areaId}/licensing/applications`, { method: 'POST', body: JSON.stringify(body) }),
    previewLicensingOperation: (areaId: string, body: { type: 'garden_subdivision' | 'license_split' | 'boundary_determination'; payload: SubdivisionPayload | LicenseSplitPayload | BoundaryPayload }) =>
        request<OperationPreview>(`/caykur/tea-inventory/areas/${areaId}/licensing/preview`, { method: 'POST', body: JSON.stringify(body) }),
    getLicensingGardenContext: (areaId: string, code: string) =>
        request<GardenEditorContext>(`/caykur/tea-inventory/areas/${areaId}/licensing/gardens/${encodeURIComponent(code)}/context`),

    // ── Garden-health module ──
    // Land evaluation module
    getLandSummary: (areaId: string) => request<LandSummary>(`/caykur/tea-inventory/areas/${areaId}/land/summary`),
    getLandClimate: (areaId: string) => request<LandClimate>(`/caykur/tea-inventory/areas/${areaId}/land/climate`),
    getLandEvidence: (areaId: string) => request<LandEvidence>(`/caykur/tea-inventory/areas/${areaId}/land/evidence`),
    getLandParcels: (areaId: string, params: LandParcelQuery = {}) => {
        const query = Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
        return request<Paginated<LandParcelRow>>(`/caykur/tea-inventory/areas/${areaId}/land/parcels${query ? `?${query}` : ''}`);
    },
    getLandParcel: (areaId: string, parcelId: string) => request<LandParcelDetail>(`/caykur/tea-inventory/areas/${areaId}/land/parcels/${parcelId}`),
    getLandLayers: (areaId: string, by: string, crop?: LandCropKey) =>
        request<GeoJSON.FeatureCollection>(`/caykur/tea-inventory/areas/${areaId}/land/layers?by=${by}${crop ? `&crop=${crop}` : ''}`),
    getGardenAgeSummary: (areaId: string) => request<GardenAgeSummary>(`/caykur/tea-inventory/areas/${areaId}/age/summary`),
    getFieldTests: (areaId: string) => request<FieldTestsBlock>(`/caykur/tea-inventory/areas/${areaId}/field-tests`),
    getPixelScanSummary: (areaId: string, season?: string) =>
        request<PixelScanSummary>(`/caykur/tea-inventory/areas/${areaId}/pixel-scan/summary${season ? `?season=${encodeURIComponent(season)}` : ''}`),
    getPixelScanGardens: (areaId: string, params?: PixelScanGardenQuery) => {
        const entries = Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '') as Array<[string, string | number]>;
        const query = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
        return request<Paginated<PixelGardenRow>>(`/caykur/tea-inventory/areas/${areaId}/pixel-scan/gardens${query ? `?${query}` : ''}`);
    },
    getPixelScanGarden: (areaId: string, code: string, season?: string) =>
        request<PixelGardenDetail>(`/caykur/tea-inventory/areas/${areaId}/pixel-scan/gardens/${encodeURIComponent(code)}${season ? `?season=${encodeURIComponent(season)}` : ''}`),
    downloadFieldTestReport: (areaId: string, caseId: string) =>
        downloadFile(`/caykur/tea-inventory/areas/${areaId}/field-tests/${encodeURIComponent(caseId)}/report.pdf`, 'Rapor üretilemedi'),
    getGardenAgeParcels: (areaId: string, params: GardenAgeParcelQuery = {}) => {
        const query = Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
        return request<Paginated<GardenAgeParcelRow>>(`/caykur/tea-inventory/areas/${areaId}/age/parcels${query ? `?${query}` : ''}`);
    },
    getGardenAgeParcel: (areaId: string, parcelId: string) => request<GardenAgeParcelDetail>(`/caykur/tea-inventory/areas/${areaId}/age/parcels/${parcelId}`),
    getGardenAgeLayers: (areaId: string, by: string) => request<GeoJSON.FeatureCollection>(`/caykur/tea-inventory/areas/${areaId}/age/layers?by=${by}`),
    getHealthSummary: (areaId: string, season?: string) =>
        request<HealthSummary>(`/caykur/tea-inventory/areas/${areaId}/health/summary${season ? `?season=${encodeURIComponent(season)}` : ''}`),
    getHealthGardens: (areaId: string, params?: HealthGardenQuery) => {
        const entries = Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '') as Array<[string, string | number]>;
        const query = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
        return request<Paginated<HealthGardenRow>>(`/caykur/tea-inventory/areas/${areaId}/health/gardens${query ? `?${query}` : ''}`);
    },
    getHealthGarden: (areaId: string, code: string, season?: string) =>
        request<HealthGardenDetail>(`/caykur/tea-inventory/areas/${areaId}/health/gardens/${encodeURIComponent(code)}${season ? `?season=${encodeURIComponent(season)}` : ''}`),
    getHealthProducers: (areaId: string, params?: HealthProducerQuery) => {
        const entries = Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '') as Array<[string, string | number]>;
        const query = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
        return request<Paginated<HealthProducerView>>(`/caykur/tea-inventory/areas/${areaId}/health/producers${query ? `?${query}` : ''}`);
    },
    getHealthLayers: (areaId: string, season?: string) =>
        request<GeoJSON.FeatureCollection>(`/caykur/tea-inventory/areas/${areaId}/health/layers${season ? `?season=${encodeURIComponent(season)}` : ''}`),
    downloadHealthProducersCsv: (areaId: string, season?: string) =>
        downloadFile(`/caykur/tea-inventory/areas/${areaId}/health/producers.csv${season ? `?season=${encodeURIComponent(season)}` : ''}`, 'Liste indirilemedi'),
    getFertilisations: (areaId: string, gardenCode?: string, season?: string) => {
        const q = new URLSearchParams();
        if (gardenCode) q.set('gardenCode', gardenCode);
        if (season) q.set('season', season);
        const query = q.toString();
        return request<FertilisationView[]>(`/caykur/tea-inventory/areas/${areaId}/health/fertilisation${query ? `?${query}` : ''}`);
    },
    addFertilisation: (areaId: string, body: CreateFertilisation) =>
        request<FertilisationView>(`/caykur/tea-inventory/areas/${areaId}/health/fertilisation`, { method: 'POST', body: JSON.stringify(body) }),
    deleteFertilisation: async (areaId: string, id: string): Promise<{ error?: string }> => {
        const response = await authorizedFetch(`/caykur/tea-inventory/areas/${areaId}/health/fertilisation/${id}`, { method: 'DELETE' });
        return response.ok ? {} : { error: await readErrorMessage(response, 'Kayıt silinemedi') };
    },
};
