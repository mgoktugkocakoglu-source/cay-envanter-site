/**
 * Arazide ölçüm talepleri — UI metadata only. Data flows through the real API
 * (services/api `/measurement-requests`) + the shared store
 * (stores/measurementRequestsStore). This module carries the status labels
 * and tones used by both the producer surface and the Kurum panel.
 */

import type { MeasurementRequest, MeasurementRequestStatus } from '@/services/api';

export type { MeasurementRequest, MeasurementRequestStatus };

export const MEASUREMENT_REQUEST_STATUS_META: Record<
    MeasurementRequestStatus,
    { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'muted' }
> = {
    pending: { label: 'Talep alındı', tone: 'warning' },
    scheduled: { label: 'Randevu verildi', tone: 'info' },
    measured: { label: 'Ölçüldü · ortak onayı bekliyor', tone: 'info' },
    closed: { label: 'Sınır belirlendi', tone: 'success' },
    rejected: { label: 'Reddedildi', tone: 'danger' },
    cancelled: { label: 'İptal edildi', tone: 'muted' },
};

/** Statuses in which the request still occupies the field. */
export const OPEN_MEASUREMENT_REQUEST_STATUSES: MeasurementRequestStatus[] = ['pending', 'scheduled', 'measured'];

export function isOpenMeasurementRequest(request: Pick<MeasurementRequest, 'status'>): boolean {
    return OPEN_MEASUREMENT_REQUEST_STATUSES.includes(request.status);
}
