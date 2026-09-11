/**
 * DEV-ONLY. Seeds the Pinia stores with sample data and disables their
 * network fetches so authenticated pages can be rendered without a session
 * (used by /dev/preview/:page for visual verification).
 */
import type { Field, Harvest, LicensingApproval, LicensingMeasurement, Payment, PruningRequest } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { useFieldsStore } from '@/stores/fieldsStore';
import { useHarvestsStore } from '@/stores/harvestsStore';
import { usePaymentsStore } from '@/stores/paymentsStore';
import { useNotificationsStore } from '@/stores/notificationsStore';
import { usePruningRequestsStore } from '@/stores/pruningRequestsStore';

type StoreLike = Record<string, unknown>;

/** Replace every `fetch*`/`load*` action on a store with a resolved no-op. */
function silenceFetches(store: StoreLike) {
    for (const key of Object.keys(store)) {
        if ((key.startsWith('fetch') || key.startsWith('load')) && typeof store[key] === 'function') {
            store[key] = async () => undefined;
        }
    }
}

export const mockFields: Field[] = [
    {
        id: 'f1', name: 'Ergazi-64671/1', province: 'Rize', district: 'Çayeli', neighborhood: 'Ergazi', road: null,
        parcelNo: '1', adaNo: '64671', coordinates: [], area: 3164, areaUnit: 'm2', partnerCount: 1, notes: null,
        partners: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
    },
    {
        id: 'f2', name: 'Evin yanı', province: 'Trabzon', district: 'Çarşıbaşı', neighborhood: 'Çallı', road: null,
        parcelNo: '26', adaNo: '1', coordinates: [], area: 1918.16, areaUnit: 'm2', partnerCount: 3, notes: null,
        partners: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
    },
    {
        id: 'f3', name: '', province: 'Trabzon', district: 'Of', neighborhood: 'Ağaçseven', road: null,
        parcelNo: '150', adaNo: '111', coordinates: [], area: 5381.04, areaUnit: 'm2', partnerCount: 1, notes: null,
        partners: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
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
    id: 'lm1', pruningRequestId: 'pr1', il: 'Rize', ilce: 'Çayeli', ada: '64671', parsel: '1',
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

export const mockLicensingApprovals: LicensingApproval[] = [
    { ...mockLicensingMeasurement.approvals![0], measurement: mockLicensingMeasurement },
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

export function installPreviewMocks() {
    const authStore = useAuthStore();
    const fieldsStore = useFieldsStore();
    const harvestsStore = useHarvestsStore();
    const paymentsStore = usePaymentsStore();
    const notificationsStore = useNotificationsStore();
    const pruningRequestsStore = usePruningRequestsStore();

    authStore.$patch({
        accessToken: 'preview-token',
        user: {
            id: 'u1', email: 'huseyin@example.com', fullName: 'Hüseyin ERDAL', userType: 'land_owner', role: 'admin',
            phone: '', province: 'Rize', district: 'Çayeli', avatarUrl: null, cuzdanNo: '1234567',
            quotaPerDekarKg: 300, appointmentDays: ['Pazartesi', 'Perşembe'],
        },
    });
    [fieldsStore, harvestsStore, paymentsStore, notificationsStore, pruningRequestsStore].forEach((store) =>
        silenceFetches(store as unknown as StoreLike),
    );
    notificationsStore.$patch({ approvals: mockLicensingApprovals, pendingCount: 1, isLoading: false, error: null });
    pruningRequestsStore.$patch({ requests: mockPruningRequests, isLoading: false, error: null });
    fieldsStore.$patch({ fields: mockFields, currentField: mockFields[0], isLoading: false, error: null });
    harvestsStore.$patch({ harvests: mockHarvests, availableHarvests: mockHarvests, isLoading: false, error: null });
    paymentsStore.$patch({ payments: mockPayments, isLoading: false, error: null });
}
