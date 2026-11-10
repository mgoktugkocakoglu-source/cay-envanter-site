import { FusionAnomaly, FusionDecision, ProducerAutoStatus, ProducerFusionStatus } from '@/tea-inventory/entities/tea-inventory-producer.entity';
import { FusionChannelKey, FusionClass, FusionGroup, GardenApprovalStatus, GardenDiscrepancy } from '@/tea-inventory/entities/tea-inventory-garden.entity';
import { LicenseMatchLevel } from '@/tea-inventory/entities/tea-inventory-license.entity';

/** Turkish labels shared by the PDF / Excel reports (the web app has its own copy for the UI). */
export const FUSION_CLASS_LABEL: Record<FusionClass, string> = {
    pruned: 'Budandı (kesin)',
    likely: 'Olası budama',
    unclear: 'Belirsiz',
    not_pruned: 'Budama yok',
    no_data: 'Veri yok',
};

export const PRODUCER_FUSION_LABEL: Record<ProducerFusionStatus, string> = {
    pruned_full: '1/7 tamam',
    pruned_partial: 'Kısmen budadı',
    none: 'Budama görülmedi',
    unclear: 'Belirsiz',
    no_license: 'Ruhsat yok',
    no_data: 'Veri yok',
};

export const DECISION_LABEL: Record<FusionDecision, string> = {
    auto_open: 'Otomatik açık · çay satabilir',
    auto_pending: 'Bekliyor · hedef dolmadı',
    auto_short: 'Eksik · tamamlanmalı',
    auto_none: 'Budama görülmedi',
    expert_anomaly: 'Eksper incelemesi (anomali)',
    no_license: 'Ruhsat yok',
    no_data: 'Veri yok',
};

export const ANOMALY_LABEL: Record<FusionAnomaly, string> = {
    sensors_contradict: 'Sensörler çelişiyor',
    repeat_pruning: 'Tekrar budama (7 yıl içinde)',
    boundary_conflict: 'Sınır ihtilafı',
    boundary_unresolved: 'Sınır çözümlenmedi',
    license_mismatch: 'Ruhsat uyuşmazlığı',
    over_pruned: 'Aşırı budama (1/7\'nin 3 katı)',
    unlicensed_pruning: 'Ruhsatsız alanda budama',
};

export const AUTO_STATUS_LABEL: Record<ProducerAutoStatus, string> = {
    auto_approved: 'Otomatik onaylı',
    expert_review: 'Eksper incelemesi',
    repeat_pruning_review: 'Tekrar budama kontrolü',
    boundary_unresolved: 'Sınır çözümlenmedi',
    partial: 'Kısmen',
    no_trace: 'İz yok',
    awaiting_observation: 'Gözlem bekliyor',
    no_license: 'Ruhsat yok',
};

export const CHANNEL_LABEL: Record<FusionChannelKey, string> = {
    ndvi: 'NDVI (S2 + Landsat)',
    nbr: 'NBR (NIR–SWIR2)',
    ndre: 'NDRE (kırmızı kenar, S2)',
    ndii: 'NDII (NIR–SWIR1)',
    vh_asc: 'VH γ0 çıkış (S1)',
    vh_desc: 'VH γ0 iniş (S1)',
    ratio_asc: 'VH/VV çıkış (S1)',
    ratio_desc: 'VH/VV iniş (S1)',
    coh_asc: 'Koherans çıkış (S1)',
    coh_desc: 'Koherans iniş (S1)',
};

export const GROUP_LABEL: Record<FusionGroup, string> = {
    optical: 'Optik',
    backscatter: 'Radar geri saçılım',
    coherence: 'Koherans',
};

export const APPROVAL_LABEL: Record<GardenApprovalStatus, string> = {
    approved: 'Onaylı sınır',
    proposed: 'Öneri',
    boundary_conflict: 'Sınır ihtilafı',
    field_check_required: 'Saha kontrolü',
    unresolved: 'Çözümlenmedi',
};

export const DISCREPANCY_LABEL: Record<GardenDiscrepancy, string> = {
    area_over: 'Ruhsat alanı fazla',
    area_under: 'Ruhsat alanı eksik',
    no_tea: 'Çay yok',
    no_license: 'Ruhsat yok',
    lineage_unresolved: 'Eski–yeni parsel eşleşmedi',
    overlap: 'Çakışma',
    outside_parcel: 'Parsel dışı',
};

export const MATCH_LEVEL_LABEL: Record<LicenseMatchLevel, string> = {
    exact: 'Kesin eşleşme',
    historical: 'Eski pafta/parsel',
    probable: 'Olası eşleşme',
    unmatched: 'Eşleşmedi',
};

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/** "2026-02-15" → "15 Şub 2026". */
export function formatDateTr(d: string | null | undefined): string {
    if (!d) return '—';
    const iso = d.slice(0, 10);
    const m = Number(iso.slice(5, 7));
    if (!m) return d;
    return `${Number(iso.slice(8, 10))} ${MONTHS_TR[m - 1]} ${iso.slice(0, 4)}`;
}

export function formatDateTimeTr(d: Date): string {
    const iso = d.toISOString();
    return `${formatDateTr(iso)} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
}

export function formatM2(v: number | null | undefined): string {
    if (v == null || Number.isNaN(v)) return '—';
    return `${Math.round(v).toLocaleString('tr-TR')} m²`;
}

export function formatNum(v: number | null | undefined, digits = 1): string {
    if (v == null || Number.isNaN(v)) return '—';
    return v.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatPct(share: number | null | undefined): string {
    if (share == null || Number.isNaN(share)) return '—';
    return `%${Math.round(share * 100)}`;
}

/** "2025-26" → "2025–2026". */
export function seasonLabel(s: string): string {
    const [a, b] = s.split('-');
    return b ? `${a}–20${b}` : s;
}
