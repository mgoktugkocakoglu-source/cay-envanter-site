import type { Field } from '@/services/api';

/**
 * Boundary state of a field on a hisseli (shared-title) parcel, as shown on
 * the producer's field pages. Fields that are not shared get no badge — the
 * absence of a warning is the "green" state.
 */
export type BoundaryTone = 'danger' | 'warning' | 'success';

export interface FieldBoundaryMeta {
    tone: BoundaryTone;
    /** Full label ("Hisseli · sınır belirlenmedi"). */
    label: string;
    /** Short label for tight table cells. */
    short: string;
}

type BoundaryFields = Pick<Field, 'isShared' | 'boundaryStatus' | 'shareNo'>;
type ParcelFields = Pick<Field, 'adaNo' | 'parcelNo' | 'shareNo'>;

export function fieldBoundaryMeta(field: BoundaryFields): FieldBoundaryMeta | null {
    if (!field.isShared) return null;
    if (field.boundaryStatus === 'determined') {
        return {
            tone: 'success',
            label: field.shareNo != null ? `Sınır belirlendi · Alan ${field.shareNo}` : 'Sınır belirlendi',
            short: 'Belirlendi',
        };
    }
    if (field.boundaryStatus === 'pending_approval') {
        return { tone: 'warning', label: 'Ortak onayı bekliyor', short: 'Onay bekliyor' };
    }
    return { tone: 'danger', label: 'Hisseli · sınır belirlenmedi', short: 'Belirlenmedi' };
}

/** Shared parcel whose slice for this owner is not settled yet (red or yellow). */
export function needsBoundary(field: BoundaryFields): boolean {
    return field.isShared && field.boundaryStatus !== 'determined';
}

/** "Ada 142 / Parsel 11 / Alan 2" — cadastral identifiers plus the approved share slot. */
export function parcelLabel(field: ParcelFields): string {
    const parts: string[] = [];
    if (field.adaNo) parts.push(`Ada ${field.adaNo}`);
    if (field.parcelNo) parts.push(`Parsel ${field.parcelNo}`);
    if (field.shareNo != null) parts.push(`Alan ${field.shareNo}`);
    return parts.join(' / ');
}
