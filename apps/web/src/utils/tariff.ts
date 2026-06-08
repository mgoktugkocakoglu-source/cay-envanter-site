import caykurLogo from '@/assets/images/caykur.jpg';
import ofcayLogo from '@/assets/images/ofcay.png';
import type { PaymentTerm } from '@/services/api';

export const MONTH_NAMES_TR = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

export interface TariffTermInfo {
    paymentTerm: PaymentTerm;
    paymentMonth?: number | null;
    customPaymentDate?: string | null;
}

/**
 * Human label for a payment term. Çaykur-spec wording:
 * cash → "Peşin Ödeme", weekly → "Haftalık Ödeme", monthly → "{Ay} Ayı Ödeme".
 * Legacy 'custom'/monthly rows without paymentMonth derive the month from the date.
 */
export function paymentTermLabel(t: TariffTermInfo): string {
    switch (t.paymentTerm) {
        case 'cash':
            return 'Peşin Ödeme';
        case 'weekly':
            return 'Haftalık Ödeme';
        case 'monthly':
        case 'custom': {
            const monthName = resolveMonthName(t);
            return monthName ? `${monthName} Ayı Ödeme` : 'Aylık Ödeme';
        }
        default:
            return t.paymentTerm;
    }
}

function resolveMonthName(t: TariffTermInfo): string | null {
    if (t.paymentMonth && t.paymentMonth >= 1 && t.paymentMonth <= 12) {
        return MONTH_NAMES_TR[t.paymentMonth - 1];
    }
    if (t.customPaymentDate) {
        const d = new Date(t.customPaymentDate);
        if (!Number.isNaN(d.getTime())) return MONTH_NAMES_TR[d.getMonth()];
    }
    return null;
}

export function paymentTermIcon(term: PaymentTerm): string {
    switch (term) {
        case 'cash':
            return '₺';
        case 'weekly':
            return '📅';
        default:
            return '🗓️';
    }
}

/** Resolve a firm logo: explicit logoUrl, else a bundled brand asset by name. */
export function getFirmLogo(firm: { name: string; logoUrl?: string | null }): string | null {
    if (firm.logoUrl) return firm.logoUrl;
    const n = (firm.name || '').toLowerCase();
    if (n.includes('çaykur') || n.includes('caykur')) return caykurLogo;
    if (n.includes('ofçay') || n.includes('ofcay')) return ofcayLogo;
    return null;
}

export function getFirmInitials(name: string): string {
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}
