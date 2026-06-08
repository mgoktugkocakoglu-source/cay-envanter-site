/**
 * Payments / accrual / current-account layer (Faz 6).
 *
 * Hakediş (accrual) is computed from each producer's *approved* deliveries at a
 * published unit price, less standard deductions (avans, stopaj, SGK prim).
 * The cari (current account) ledger reconciles credits (hakediş) against debits
 * (avans + ödemeler). Numbers are illustrative but internally consistent so the
 * producer cari ekstre always balances — the module's whole promise is trust.
 */

import { PRODUCERS, type Producer, type Region } from '@/services/caykurData';
import {
    DELIVERIES,
    deliveriesForProducer,
    type Delivery,
} from '@/services/caykur/deliveries';
import { dateDaysAgo, intBetween, noise, round } from '@/services/caykur/rng';

/** Published 2025 fresh-leaf base price (TL/kg) — illustrative. */
export const BASE_PRICE_PER_KG = 16.5;
export const ORGANIC_PREMIUM_PER_KG = 1.0;

export function unitPrice(p: Producer): number {
    return round(BASE_PRICE_PER_KG + (p.organic ? ORGANIC_PREMIUM_PER_KG : 0), 2);
}

export type AccrualStatus = 'paid' | 'partial' | 'pending';

export interface Deductions {
    advance: number;
    stopaj: number;
    sgkPrim: number;
    other: number;
}

export interface Accrual {
    producerId: string;
    producerName: string;
    ruhsatNo: string;
    region: Region;
    factory: string;
    organic: boolean;
    unitPrice: number;
    /** Net kg that has been approved (and is therefore accruable). */
    accruedKg: number;
    /** Net kg still pending approval (not yet accrued). */
    pendingKg: number;
    grossAmount: number;
    deductions: Deductions;
    totalDeductions: number;
    netPayable: number;
    paidAmount: number;
    balance: number;
    status: AccrualStatus;
}

function accruableDeliveries(list: Delivery[]): Delivery[] {
    return list.filter((d) => d.status === 'approved' || d.status === 'corrected');
}

function buildAccrual(p: Producer, index: number): Accrual {
    const list = deliveriesForProducer(p.id);
    const accrued = accruableDeliveries(list);
    const accruedKg = accrued.reduce((s, d) => s + d.netKg, 0);
    const pendingKg = list.filter((d) => d.status === 'pending').reduce((s, d) => s + d.netKg, 0);
    const price = unitPrice(p);
    const grossAmount = Math.round(accruedKg * price);

    const seed = index * 9 + 5;
    const tookAdvance = noise(seed) < 0.42;
    const advance = tookAdvance ? Math.round((grossAmount * (0.1 + noise(seed + 1) * 0.16)) / 100) * 100 : 0;
    const stopaj = Math.round(grossAmount * 0.02);
    const sgkPrim = Math.round(grossAmount * 0.01);
    const other = noise(seed + 2) < 0.12 ? Math.round(grossAmount * 0.005) : 0;
    const deductions: Deductions = { advance, stopaj, sgkPrim, other };
    const totalDeductions = advance + stopaj + sgkPrim + other;
    const netPayable = Math.max(0, grossAmount - totalDeductions);

    // Payment progress: 1st/2nd sürgün largely paid; 3rd sürgün still due.
    const paidRatio = 0.45 + noise(seed + 3) * 0.5; // 45%–95%
    const paidAmount = Math.min(netPayable, Math.round((netPayable * paidRatio) / 100) * 100);
    const balance = netPayable - paidAmount;
    const status: AccrualStatus = balance <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'pending';

    return {
        producerId: p.id,
        producerName: p.fullName,
        ruhsatNo: p.ruhsatNo,
        region: p.region,
        factory: p.factory,
        organic: p.organic,
        unitPrice: price,
        accruedKg,
        pendingKg,
        grossAmount,
        deductions,
        totalDeductions,
        netPayable,
        paidAmount,
        balance,
        status,
    };
}

export const ACCRUALS: Accrual[] = PRODUCERS.map(buildAccrual).sort((a, b) => b.balance - a.balance);

export function accrualForProducer(producerId: string): Accrual | undefined {
    return ACCRUALS.find((a) => a.producerId === producerId);
}

export const ACCRUAL_STATUS_META: Record<AccrualStatus, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
    paid: { label: 'Ödendi', tone: 'success' },
    partial: { label: 'Kısmi ödendi', tone: 'warning' },
    pending: { label: 'Ödeme bekliyor', tone: 'danger' },
};

// ── Current account (cari) ledger ───────────────────────────────────────────

export type LedgerKind = 'delivery' | 'advance' | 'payment' | 'deduction';

export interface LedgerEntry {
    date: string;
    kind: LedgerKind;
    description: string;
    /** Credit increases producer receivable (hakediş). */
    credit: number;
    /** Debit reduces it (payments, advances, deductions). */
    debit: number;
    balance: number;
}

/**
 * Reconciled cari ekstre for one producer: delivery credits, then advance +
 * deduction + payment debits, sorted by date with a running balance that ends
 * at the accrual balance.
 */
export function cariStatement(producerId: string): { entries: LedgerEntry[]; balance: number } {
    const accrual = accrualForProducer(producerId);
    if (!accrual) return { entries: [], balance: 0 };

    const raw: Array<Omit<LedgerEntry, 'balance'>> = [];

    for (const d of accruableDeliveries(deliveriesForProducer(producerId))) {
        raw.push({
            date: d.date,
            kind: 'delivery',
            description: `Teslimat hakedişi · ${d.netKg.toLocaleString('tr-TR')} kg (${d.grade})`,
            credit: Math.round(d.netKg * accrual.unitPrice),
            debit: 0,
        });
    }

    if (accrual.deductions.advance > 0) {
        raw.push({
            date: dateDaysAgo(70),
            kind: 'advance',
            description: 'Avans ödemesi',
            credit: 0,
            debit: accrual.deductions.advance,
        });
    }
    if (accrual.deductions.stopaj > 0) {
        raw.push({ date: dateDaysAgo(20), kind: 'deduction', description: 'Stopaj kesintisi (%2)', credit: 0, debit: accrual.deductions.stopaj });
    }
    if (accrual.deductions.sgkPrim > 0) {
        raw.push({ date: dateDaysAgo(20), kind: 'deduction', description: 'SGK prim kesintisi', credit: 0, debit: accrual.deductions.sgkPrim });
    }
    if (accrual.deductions.other > 0) {
        raw.push({ date: dateDaysAgo(18), kind: 'deduction', description: 'Diğer kesinti', credit: 0, debit: accrual.deductions.other });
    }
    if (accrual.paidAmount > 0) {
        // Split the paid amount into 1–2 instalments for realism.
        const half = Math.round(accrual.paidAmount / 2 / 100) * 100;
        if (half > 0 && accrual.paidAmount - half > 0) {
            raw.push({ date: dateDaysAgo(40), kind: 'payment', description: 'Banka ödemesi (1. taksit)', credit: 0, debit: half });
            raw.push({ date: dateDaysAgo(12), kind: 'payment', description: 'Banka ödemesi (2. taksit)', credit: 0, debit: accrual.paidAmount - half });
        } else {
            raw.push({ date: dateDaysAgo(12), kind: 'payment', description: 'Banka ödemesi', credit: 0, debit: accrual.paidAmount });
        }
    }

    raw.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    let balance = 0;
    const entries: LedgerEntry[] = raw.map((e) => {
        balance += e.credit - e.debit;
        return { ...e, balance };
    });

    return { entries, balance };
}

// ── Payment batches (ödeme listesi) + finance approval flow ─────────────────

export type PaymentBatchStatus = 'paid' | 'approved' | 'pending_approval';

export interface PaymentBatch {
    id: string;
    title: string;
    region: Region;
    factory: string;
    producerCount: number;
    amount: number;
    createdAt: string;
    status: PaymentBatchStatus;
    approvedBy: string | null;
}

export const PAYMENT_BATCH_META: Record<PaymentBatchStatus, { label: string; tone: 'success' | 'info' | 'warning' }> = {
    paid: { label: 'Ödendi', tone: 'success' },
    approved: { label: 'Onaylandı', tone: 'info' },
    pending_approval: { label: 'Onay bekliyor', tone: 'warning' },
};

function buildPaymentBatches(): PaymentBatch[] {
    const byRegionFactory = new Map<string, Accrual[]>();
    for (const a of ACCRUALS) {
        const key = `${a.region}__${a.factory}`;
        const list = byRegionFactory.get(key) ?? [];
        list.push(a);
        byRegionFactory.set(key, list);
    }
    const periods = ['1. Sürgün hakediş', '2. Sürgün hakediş', '3. Sürgün hakediş'];
    let i = 0;
    const batches: PaymentBatch[] = [];
    for (const [key, list] of byRegionFactory.entries()) {
        const [region, factory] = key.split('__');
        const periodIdx = i % 3;
        const seed = i * 7 + 2;
        const amount = Math.round(list.reduce((s, a) => s + a.netPayable, 0) / 3);
        const status: PaymentBatchStatus =
            periodIdx === 2 ? (noise(seed) < 0.5 ? 'pending_approval' : 'approved') : 'paid';
        batches.push({
            id: `pmt-${String(i + 1).padStart(3, '0')}`,
            title: `${factory} · ${periods[periodIdx]}`,
            region: region as Region,
            factory,
            producerCount: list.length,
            amount,
            createdAt: dateDaysAgo(intBetween(3, 65, seed + 1)),
            status,
            approvedBy: status === 'pending_approval' ? null : 'Hülya Yıldız',
        });
        i++;
    }
    return batches.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export const PAYMENT_BATCHES: PaymentBatch[] = buildPaymentBatches();

// ── Payment objections (ödeme itirazları) ───────────────────────────────────

export type ObjectionStatus = 'open' | 'resolved' | 'rejected';

export interface PaymentObjection {
    id: string;
    producerId: string;
    producerName: string;
    region: Region;
    subject: string;
    amountDisputed: number;
    status: ObjectionStatus;
    createdAt: string;
}

const OBJECTION_SUBJECTS = [
    'Fire oranı yüksek hesaplandı',
    'Eksik teslimat kaydı',
    'Birim fiyat itirazı',
    'Avans iki kez düşülmüş',
    'Kesinti tutarı hatalı',
];

export const OBJECTION_STATUS_META: Record<ObjectionStatus, { label: string; tone: 'warning' | 'success' | 'danger' }> = {
    open: { label: 'Açık', tone: 'warning' },
    resolved: { label: 'Çözüldü', tone: 'success' },
    rejected: { label: 'Reddedildi', tone: 'danger' },
};

function buildObjections(): PaymentObjection[] {
    const sample = ACCRUALS.filter((a) => a.balance > 0).slice(0, 9);
    return sample.map((a, i) => {
        const seed = i * 4 + 1;
        const r = noise(seed);
        const status: ObjectionStatus = r < 0.5 ? 'open' : r < 0.8 ? 'resolved' : 'rejected';
        return {
            id: `obj-${String(i + 1).padStart(3, '0')}`,
            producerId: a.producerId,
            producerName: a.producerName,
            region: a.region,
            subject: OBJECTION_SUBJECTS[i % OBJECTION_SUBJECTS.length],
            amountDisputed: Math.round((a.grossAmount * (0.02 + noise(seed + 1) * 0.08)) / 50) * 50,
            status,
            createdAt: dateDaysAgo(intBetween(2, 45, seed + 2)),
        };
    });
}

export const PAYMENT_OBJECTIONS: PaymentObjection[] = buildObjections();

// ── Summary ─────────────────────────────────────────────────────────────────

export interface FinanceSummary {
    grossAmount: number;
    totalDeductions: number;
    netPayable: number;
    paidAmount: number;
    outstanding: number;
    pendingApprovalCount: number;
    openObjections: number;
}

export function financeSummary(list: Accrual[] = ACCRUALS): FinanceSummary {
    return {
        grossAmount: list.reduce((s, a) => s + a.grossAmount, 0),
        totalDeductions: list.reduce((s, a) => s + a.totalDeductions, 0),
        netPayable: list.reduce((s, a) => s + a.netPayable, 0),
        paidAmount: list.reduce((s, a) => s + a.paidAmount, 0),
        outstanding: list.reduce((s, a) => s + a.balance, 0),
        pendingApprovalCount: PAYMENT_BATCHES.filter((b) => b.status === 'pending_approval').length,
        openObjections: PAYMENT_OBJECTIONS.filter((o) => o.status === 'open').length,
    };
}

export { DELIVERIES };
