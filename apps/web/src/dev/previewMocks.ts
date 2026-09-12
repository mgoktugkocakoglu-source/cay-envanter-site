/**
 * DEV-ONLY. Seeds the Pinia stores with sample data and disables their
 * network fetches so authenticated pages can be rendered without a session
 * (used by /dev/preview/:page for visual verification).
 */
import type { Field, Harvest, LicensingApproval, LicensingMeasurement, MeasurementRequest, Payment, PruningRequest } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { useFieldsStore } from '@/stores/fieldsStore';
import { useHarvestsStore } from '@/stores/harvestsStore';
import { usePaymentsStore } from '@/stores/paymentsStore';
import { useNotificationsStore } from '@/stores/notificationsStore';
import { usePruningRequestsStore } from '@/stores/pruningRequestsStore';
import { useMeasurementRequestsStore } from '@/stores/measurementRequestsStore';

type StoreLike = Record<string, unknown>;

/** Replace every `fetch*`/`load*` action on a store with a resolved no-op. */
function silenceFetches(store: StoreLike) {
    for (const key of Object.keys(store)) {
        if ((key.startsWith('fetch') || key.startsWith('load')) && typeof store[key] === 'function') {
            store[key] = async () => undefined;
        }
    }
}

/** Boundary-state defaults for a field that is not on a shared parcel. */
const SINGLE_FIELD = {
    userId: 'u1', boundaryMeasurementId: null, boundaryDeterminedAt: null, shareNo: null,
    isShared: false, coOwnerCount: 1, boundaryStatus: 'undetermined' as const,
    pendingMeasurementId: null, pendingRequestId: null, coOwners: [],
};

/** Ring around Rize (lng, lat) used as a mock parcel outline. */
const MOCK_RING: number[][] = [
    [40.5211, 41.0193], [40.5227, 41.0193], [40.5227, 41.0209], [40.5211, 41.0209], [40.5211, 41.0193],
];

export const mockFields: Field[] = [
    // Shared, boundary not determined yet → red; also has an open on-site request.
    {
        ...SINGLE_FIELD,
        id: 'f1', name: 'Ergazi-64671/1', province: 'Rize', district: 'Çayeli', neighborhood: 'Ergazi', road: null,
        parcelNo: '1', adaNo: '64671', coordinates: [MOCK_RING], area: 3164, areaUnit: 'm2', partnerCount: 1, notes: null,
        partners: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
        isShared: true, coOwnerCount: 3, pendingRequestId: 'mr1',
        coOwners: [
            { userId: 'u2', fullName: 'Ayşe Karadeniz', cuzdanNo: '7654321', shareNo: null, boundaryDetermined: false },
            { userId: 'u3', fullName: 'Kemal Aydın', cuzdanNo: '1122334', shareNo: 1, boundaryDetermined: true },
        ],
    },
    // Shared and determined → green "Alan 2".
    {
        ...SINGLE_FIELD,
        id: 'f2', name: 'Evin yanı', province: 'Trabzon', district: 'Çarşıbaşı', neighborhood: 'Çallı', road: null,
        parcelNo: '26', adaNo: '1', coordinates: [MOCK_RING], area: 1918.16, areaUnit: 'm2', partnerCount: 3, notes: null,
        partners: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
        isShared: true, coOwnerCount: 2, boundaryStatus: 'determined', boundaryMeasurementId: 'lm0',
        boundaryDeterminedAt: '2026-08-02T10:00:00Z', shareNo: 2,
        coOwners: [{ userId: 'u5', fullName: 'Mustafa Öz', cuzdanNo: '9988776', shareNo: 1, boundaryDetermined: true }],
    },
    // Not shared → neutral.
    {
        ...SINGLE_FIELD,
        id: 'f3', name: '', province: 'Trabzon', district: 'Of', neighborhood: 'Ağaçseven', road: null,
        parcelNo: '150', adaNo: '111', coordinates: [], area: 5381.04, areaUnit: 'm2', partnerCount: 1, notes: null,
        partners: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
    },
    // Shared, own drawing awaiting the co-owners → yellow.
    {
        ...SINGLE_FIELD,
        id: 'f4', name: 'Dere kenarı', province: 'Rize', district: 'Pazar', neighborhood: 'Sahil', road: null,
        parcelNo: '17', adaNo: '95', coordinates: [MOCK_RING], area: 1290.75, areaUnit: 'm2', partnerCount: 1, notes: null,
        partners: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
        isShared: true, coOwnerCount: 2, boundaryStatus: 'pending_approval', pendingMeasurementId: 'lm2',
        coOwners: [{ userId: 'u6', fullName: 'Hasan Yıldız', cuzdanNo: '4455667', shareNo: null, boundaryDetermined: false }],
    },
];

export const mockHarvests: Harvest[] = [
    { id: 'h1', fieldId: 'f1', fieldName: 'Ergazi-64671/1', harvestDate: '2026-05-12', amountKg: '412', quality: 'shoot', notes: null, soldAmountKg: '412', remainingKg: '0', status: 'sold' },
    { id: 'h2', fieldId: 'f2', fieldName: 'Evin yanı', harvestDate: '2026-06-02', amountKg: '265', quality: 'leaf', notes: 'Yağmurdan sonra', soldAmountKg: '100', remainingKg: '165', status: 'partial' },
    { id: 'h3', fieldId: 'f3', fieldName: 'İsimsiz Arazi', harvestDate: '2026-06-20', amountKg: '590', quality: 'mixed', notes: null, soldAmountKg: '0', remainingKg: '590', status: 'pending' },
];

export const mockPayments: Payment[] = [
    { id: 'p1', totalAmountKg: 412, totalPrice: 7416, pricePerKg: 18, brokerFirm: null, firm: { id: 'c', name: 'Çaykur', logoUrl: null, isCaykur: true }, tariffLabel: '2026 Tarife', source: 'caykur', paymentDate: '2026-05-30', paymentStatus: 'received', notes: null, harvestCount: 1, assigned: true, assignedField: { id: 'f1', name: 'Ergazi-64671/1' } },
    { id: 'p2', totalAmountKg: 100, totalPrice: 1650, pricePerKg: 16.5, brokerFirm: { id: 'b1', firmName: 'Doğu Çay' }, firm: null, source: 'manual', paymentDate: '2026-06-10', paymentStatus: 'pending', notes: 'Nakit', harvestCount: 1, assigned: false, assignedField: null },
];

/** Ruhsatlandırma ölçümü on a hisseli parcel, awaiting the other owners. */
export const mockLicensingMeasurement: LicensingMeasurement = {
    id: 'lm1', source: 'staff_pruning', pruningRequestId: 'pr1', measurementRequestId: null, fieldId: 'f9',
    il: 'Rize', ilce: 'Çayeli', ada: '64671', parsel: '1',
    ownerId: 'u2', ownerName: 'Ayşe Karadeniz', ownerCuzdanNo: '7654321',
    measuredAreaM2: 1180, measurementPoints: [
        { lat: 41.0201, lng: 40.5203, altitudeMeters: 212.4 },
        { lat: 41.0204, lng: 40.5209, altitudeMeters: 213.1 },
        { lat: 41.0199, lng: 40.5211, altitudeMeters: 211.9 },
    ],
    method: 'imu', accuracyLevel: 'high', fixQuality: null,
    measuredById: 's1', measuredByName: 'Mehmet Yılmaz', measuredAt: '2026-09-10T09:30:00Z',
    status: 'pending_approval', resolvedAt: null, notes: 'Batı sınırı taş duvar.',
    approvals: [
        { id: 'la1', measurementId: 'lm1', approverId: 'u1', approverName: 'Hüseyin ERDAL', status: 'pending', decidedAt: null, reason: null, emailSent: true, createdAt: '2026-09-10T09:31:00Z', updatedAt: '2026-09-10T09:31:00Z' },
        { id: 'la2', measurementId: 'lm1', approverId: 'u3', approverName: 'Kemal Aydın', status: 'approved', decidedAt: '2026-09-10T12:00:00Z', reason: null, emailSent: true, createdAt: '2026-09-10T09:31:00Z', updatedAt: '2026-09-10T12:00:00Z' },
    ],
    createdAt: '2026-09-10T09:31:00Z', updatedAt: '2026-09-10T09:31:00Z',
};

/** A co-owner drew their own slice on the satellite map (producer_map). */
export const mockProducerBoundary: LicensingMeasurement = {
    ...mockLicensingMeasurement,
    id: 'lm3', source: 'producer_map', pruningRequestId: null, fieldId: 'f11',
    ownerId: 'u2', ownerName: 'Ayşe Karadeniz', ownerCuzdanNo: '7654321',
    measuredAreaM2: 1350, method: 'map', accuracyLevel: 'medium',
    measuredById: 'u2', measuredByName: 'Ayşe Karadeniz', measuredAt: '2026-09-11T14:10:00Z',
    measurementPoints: [
        { lat: 41.0193, lng: 40.5219, altitudeMeters: 0 },
        { lat: 41.0193, lng: 40.5227, altitudeMeters: 0 },
        { lat: 41.0209, lng: 40.5227, altitudeMeters: 0 },
        { lat: 41.0209, lng: 40.5219, altitudeMeters: 0 },
    ],
    notes: 'Yol tarafındaki yarım; taş duvar sınırdır.', approvals: undefined,
};

export const mockLicensingApprovals: LicensingApproval[] = [
    { ...mockLicensingMeasurement.approvals![0], measurement: mockLicensingMeasurement },
    {
        id: 'la3', measurementId: 'lm3', approverId: 'u1', approverName: 'Hüseyin ERDAL', status: 'pending',
        decidedAt: null, reason: null, emailSent: true, createdAt: '2026-09-11T14:11:00Z', updatedAt: '2026-09-11T14:11:00Z',
        measurement: mockProducerBoundary,
    },
    {
        id: 'la0', measurementId: 'lm0', approverId: 'u1', approverName: 'Hüseyin ERDAL', status: 'approved',
        decidedAt: '2026-08-02T10:00:00Z', reason: null, emailSent: true, createdAt: '2026-08-01T09:00:00Z', updatedAt: '2026-08-02T10:00:00Z',
        measurement: { ...mockLicensingMeasurement, id: 'lm0', ownerName: 'Kemal Aydın', ownerCuzdanNo: '1122334', measuredAreaM2: 940, status: 'approved', approvals: undefined },
    },
];

/** Budama talebi on a hisseli parcel (three registered cüzdan numbers). */
export const mockPruningRequests: PruningRequest[] = [
    {
        id: 'pr1', producerId: 'u1', producerName: 'Hüseyin ERDAL', il: 'Rize', ilce: 'Çayeli', ada: '64671', parsel: '1',
        registeredAreaM2: 3164, parcelGeometry: null, status: 'scheduled', appointmentDate: '2026-09-15',
        appointedById: 's1', appointedByName: 'Mehmet Yılmaz', measuredAreaM2: null, measurementPoints: [],
        accuracyLevel: null, fixQuality: null, method: null, measuredAt: null, measuredById: null, measuredByName: null,
        approvedAt: null, approvedByName: null, notes: null, createdAt: '2026-09-08T08:00:00Z', updatedAt: '2026-09-09T08:00:00Z',
        coOwners: [
            { userId: 'u1', fullName: 'Hüseyin ERDAL', cuzdanNo: '1234567', ruhsatNo: 'R-1001', phone: null, fieldId: 'f1', fieldName: 'Ergazi-64671/1', areaM2: 3164 },
            { userId: 'u2', fullName: 'Ayşe Karadeniz', cuzdanNo: '7654321', ruhsatNo: 'R-1002', phone: null, fieldId: 'f9', fieldName: 'Ergazi bahçe', areaM2: 1200 },
            { userId: 'u3', fullName: 'Kemal Aydın', cuzdanNo: '1122334', ruhsatNo: null, phone: null, fieldId: 'f10', fieldName: 'Dede bahçesi', areaM2: 950 },
        ],
    },
    {
        id: 'pr2', producerId: 'u4', producerName: 'Fatma Şahin', il: 'Trabzon', ilce: 'Of', ada: '111', parsel: '150',
        registeredAreaM2: 5381, parcelGeometry: null, status: 'pending', appointmentDate: null,
        appointedById: null, appointedByName: null, measuredAreaM2: null, measurementPoints: [],
        accuracyLevel: null, fixQuality: null, method: null, measuredAt: null, measuredById: null, measuredByName: null,
        approvedAt: null, approvedByName: null, notes: null, createdAt: '2026-09-09T08:00:00Z', updatedAt: '2026-09-09T08:00:00Z',
        coOwners: [
            { userId: 'u4', fullName: 'Fatma Şahin', cuzdanNo: '5566778', ruhsatNo: null, phone: null, fieldId: 'f3', fieldName: '', areaM2: 5381 },
        ],
    },
];

/** Arazide ölçüm talepleri: one just opened, one measured and awaiting the co-owner. */
export const mockMeasurementRequests: MeasurementRequest[] = [
    {
        id: 'mr1', producerId: 'u1', producerName: 'Hüseyin ERDAL', fieldId: 'f1', il: 'Rize', ilce: 'Çayeli', ada: '64671', parsel: '1',
        registeredAreaM2: 3164, parcelGeometry: MOCK_RING, status: 'pending', appointmentDate: null, appointedById: null, appointedByName: null,
        producerNote: 'Uydu görüntüsünde sınır seçilemiyor; ağaçlar kapatıyor.', notes: null, closedAt: null,
        createdAt: '2026-09-10T08:00:00Z', updatedAt: '2026-09-10T08:00:00Z',
        coOwners: mockPruningRequests[0].coOwners,
    },
    {
        id: 'mr2', producerId: 'u2', producerName: 'Ayşe Karadeniz', fieldId: 'f9', il: 'Rize', ilce: 'Çayeli', ada: '64671', parsel: '1',
        registeredAreaM2: 1200, parcelGeometry: MOCK_RING, status: 'measured', appointmentDate: '2026-09-09', appointedById: 's1', appointedByName: 'Mehmet Yılmaz',
        producerNote: null, notes: null, closedAt: null,
        createdAt: '2026-09-06T08:00:00Z', updatedAt: '2026-09-10T09:31:00Z',
        coOwners: mockPruningRequests[0].coOwners,
    },
];

export function installPreviewMocks() {
    const authStore = useAuthStore();
    const fieldsStore = useFieldsStore();
    const harvestsStore = useHarvestsStore();
    const paymentsStore = usePaymentsStore();
    const notificationsStore = useNotificationsStore();
    const pruningRequestsStore = usePruningRequestsStore();
    const measurementRequestsStore = useMeasurementRequestsStore();

    authStore.$patch({
        accessToken: 'preview-token',
        user: {
            id: 'u1', email: 'huseyin@example.com', fullName: 'Hüseyin ERDAL', userType: 'land_owner', role: 'admin',
            phone: '', province: 'Rize', district: 'Çayeli', avatarUrl: null, cuzdanNo: '1234567',
            quotaPerDekarKg: 300, appointmentDays: ['Pazartesi', 'Perşembe'],
        },
    });
    [fieldsStore, harvestsStore, paymentsStore, notificationsStore, pruningRequestsStore, measurementRequestsStore].forEach((store) =>
        silenceFetches(store as unknown as StoreLike),
    );
    notificationsStore.$patch({ approvals: mockLicensingApprovals, pendingCount: 2, isLoading: false, error: null });
    pruningRequestsStore.$patch({ requests: mockPruningRequests, isLoading: false, error: null });
    measurementRequestsStore.$patch({ requests: mockMeasurementRequests, isLoading: false, error: null });
    fieldsStore.$patch({ fields: mockFields, currentField: mockFields[0], isLoading: false, error: null });
    harvestsStore.$patch({ harvests: mockHarvests, availableHarvests: mockHarvests, isLoading: false, error: null });
    paymentsStore.$patch({ payments: mockPayments, isLoading: false, error: null });
}
