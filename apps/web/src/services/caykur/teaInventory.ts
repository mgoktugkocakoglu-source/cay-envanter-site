/**
 * Tea inventory presentation model: label, explanation, badge tone and map
 * colour for each decision-matrix class. Map colours reference theme tokens
 * (read at render time) so the layer follows light/dark mode.
 */

import type { InventoryClass, ProducerPruningStatus, SatellitePruningStatus } from '@/services/api';
import type { Tone } from '@/components/caykur/tone';

export interface InventoryClassMeta {
    label: string;
    description: string;
    tone: Tone;
    /** CSS custom property used for the parcel fill on the map. */
    colorVar: string;
    /** Licensed but empty parcels are drawn hollow with a dashed outline. */
    hollow?: boolean;
}

export const INVENTORY_CLASS_META: Record<InventoryClass, InventoryClassMeta> = {
    compliant: {
        label: 'Uyumlu',
        description: 'Ruhsatlı; uydudaki çay alanı ruhsat alanıyla uyumlu.',
        tone: 'success',
        colorVar: '--success',
    },
    over_quota: {
        label: 'Fazla kota riski',
        description: 'Ruhsat alanı, sahada görülen çay alanından belirgin biçimde büyük.',
        tone: 'warning',
        colorVar: '--warning',
    },
    ghost_license: {
        label: 'Hayalet ruhsat',
        description: 'Ruhsatlı ama parselde çay görülmüyor; boş kota kullandırma riski.',
        tone: 'danger',
        colorVar: '--destructive',
        hollow: true,
    },
    expanded: {
        label: 'Taşan çaylık',
        description: 'Çay alanı ruhsat alanını belirgin biçimde aşıyor.',
        tone: 'info',
        colorVar: '--info',
    },
    unlicensed: {
        label: 'Ruhsatsız aday',
        description: 'Özel parselde çay var ama eşleşen ruhsat yok.',
        tone: 'danger',
        colorVar: '--destructive',
    },
    public_land: {
        label: 'Kamu arazisinde çay',
        description: 'Orman, hazine veya mera niteliğindeki parselde çay görülüyor.',
        tone: 'danger',
        colorVar: '--destructive',
        // Public parcels can be hundreds of hectares; filling them would paint a whole forest as
        // the offence. The outline marks the parcel, the tea-patch layer shows where the tea is.
        hollow: true,
    },
    uncertain: {
        label: 'Belirsiz',
        description: 'Parsel 10 m uydu çözünürlüğü için çok küçük; yüksek çözünürlüklü görüntü gerekir.',
        tone: 'muted',
        colorVar: '--muted-foreground',
    },
    no_tea: {
        label: 'Çay yok',
        description: 'Ruhsat yok, çay da görülmüyor.',
        tone: 'muted',
        colorVar: '--muted-foreground',
        hollow: true,
    },
};

/** Display order: what needs an inspector first. */
export const INVENTORY_CLASS_ORDER: InventoryClass[] = [
    'ghost_license',
    'unlicensed',
    'public_land',
    'over_quota',
    'expanded',
    'compliant',
    'uncertain',
    'no_tea',
];

export const FLAGGED_INVENTORY_CLASSES: InventoryClass[] = ['ghost_license', 'unlicensed', 'public_land', 'over_quota', 'expanded'];

const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });

/** 1234 → "1.234 m²"; null → "—". */
export function formatM2(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : `${nf0.format(value)} m²`;
}

/** 693146 → "69,3 ha". */
export function formatHectare(m2: number): string {
    return `${nf1.format(m2 / 10_000)} ha`;
}

/** 0.873 → "%87". */
export function formatShare(share: number | null | undefined): string {
    return share === null || share === undefined ? '—' : `%${nf0.format(share * 100)}`;
}

// ── Pruning monitoring (satellite, uncalibrated) ──

export const PRUNING_STATUS_META: Record<SatellitePruningStatus, InventoryClassMeta> = {
    pruned: {
        label: '1/7 karşılanıyor',
        description: 'Uydu, çay alanının yaklaşık yedide biri kadar budama izi gördü.',
        tone: 'success',
        colorVar: '--success',
    },
    partial: {
        label: 'Kısmi budama',
        description: 'Budama izi var ama 1/7 hedefinin belirgin biçimde altında.',
        tone: 'warning',
        colorVar: '--warning',
    },
    no_trace: {
        label: 'Budama izi yok',
        description: 'Çay iyi gözlendi ama bu sezon budamaya özgü düşüş görülmedi.',
        tone: 'danger',
        colorVar: '--destructive',
    },
    insufficient_observation: {
        label: 'Gözlem yetersiz',
        description: 'Bulut veya kar çayın yarısından fazlasını gizledi; karar verilemez.',
        tone: 'muted',
        colorVar: '--muted-foreground',
        hollow: true,
    },
    too_small: {
        label: '10 m için küçük',
        description: 'Çay alanının 1/7\'si tek bir 10 m pikselden küçük; parsel bazında karar için yüksek çözünürlük gerekir.',
        tone: 'muted',
        colorVar: '--muted-foreground',
        hollow: true,
    },
};

export const PRUNING_STATUS_ORDER: SatellitePruningStatus[] = ['no_trace', 'partial', 'pruned', 'insufficient_observation', 'too_small'];

/** 12345 m² → "12,3 da". */
export function formatDekar(m2: number | null | undefined): string {
    return m2 === null || m2 === undefined ? '—' : `${nf1.format(m2 / 1000)} da`;
}

// ── Producer-level pruning (1/7 over all of a producer's gardens) ──

export interface ProducerStatusMeta {
    label: string;
    description: string;
    tone: Tone;
}

export const PRODUCER_STATUS_META: Record<ProducerPruningStatus, ProducerStatusMeta> = {
    auto_approved: {
        label: 'Otomatik onay',
        description: 'Uydu, çok yüksek güvenle 1/7 hedefinin üzerinde budama gördü; alım eksper beklemeden açıldı.',
        tone: 'success',
    },
    approved: {
        label: 'Eksper onayı',
        description: 'Eksper budamayı onayladı; alım açık.',
        tone: 'success',
    },
    rejected: {
        label: 'Reddedildi',
        description: 'Eksper budamayı yetersiz buldu; bu sezon alım kapalı.',
        tone: 'danger',
    },
    repeat_pruning_review: {
        label: 'Tekrar budama kontrolü',
        description: 'Görülen budamanın önemli kısmı, aynı 7 yıllık döngüde daha önce hesaba alınmış alanla çakışıyor; eksper kontrolü gerekir.',
        tone: 'warning',
    },
    boundary_unresolved: {
        label: 'Sınır belirsiz',
        description: 'Hisseli parseldeki bahçe sınırı ölçülmemiş; buradaki budama müstahsile atanamaz. Önce sınır belirleme (ruhsatlandırma ölçümü) gerekir.',
        tone: 'muted',
    },
    expert_review: {
        label: 'Eksper onayı bekliyor',
        description: 'Budama hedefe yakın ya da üzerinde görünüyor ama otomatik onay için güven yeterli değil.',
        tone: 'warning',
    },
    partial: {
        label: 'Kısmi budama',
        description: 'Budama izi var ama 1/7 hedefinin belirgin biçimde altında.',
        tone: 'warning',
    },
    no_trace: {
        label: 'Budama izi yok',
        description: 'Bahçeler iyi gözlendi ama budamaya özgü düşüş görülmedi. Alımı kapatmak için eksper kontrolü gerekir.',
        tone: 'danger',
    },
    awaiting_observation: {
        label: 'Gözlem bekleniyor',
        description: 'Bulut veya kar bahçelerin yarısından fazlasını gizledi; yeni temiz görüntü bekleniyor.',
        tone: 'muted',
    },
};

export const PRODUCER_STATUS_ORDER: ProducerPruningStatus[] = [
    'expert_review',
    'repeat_pruning_review',
    'boundary_unresolved',
    'no_trace',
    'partial',
    'awaiting_observation',
    'auto_approved',
    'approved',
    'rejected',
];
