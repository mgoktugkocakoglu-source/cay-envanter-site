/**
 * Tea inventory presentation model: label, explanation, badge tone and map
 * colour for each decision-matrix class. Map colours reference theme tokens
 * (read at render time) so the layer follows light/dark mode.
 */

import type {
    ApplicationStatus,
    ApplicationType,
    GardenApprovalStatus,
    GardenDiscrepancy,
    InventoryClass,
    LicenseMatchLevel,
    LicenseView,
    ProducerPruningStatus,
    PruningRegistration,
    RadarClass,
    SatellitePruningStatus,
} from '@/services/api';
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
    no_license: {
        label: 'Ruhsat yok',
        description: 'Müstahsile bağlı ruhsatlı alan yok (ruhsat yok ya da parsel eşleşmesi tamamlanmadı); 1/7 hesabı yapılamaz, alım kapalı.',
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
    'no_license',
    'auto_approved',
    'approved',
    'rejected',
];

// ── Satellite pruning records: how a record reached ÇAYKUR's purchase system ──

export const REGISTRATION_META: Record<PruningRegistration, ProducerStatusMeta> = {
    auto: { label: 'Otomatik düştü', description: 'Uydu çok yüksek güvenle 1/7 hedefini gördü; kayıt müstahsil haber vermeden ÇAYKUR alım sistemine düştü.', tone: 'success' },
    expert: { label: 'Eksper onayıyla düştü', description: 'Kayıt eksper onayından sonra alım sistemine düştü.', tone: 'success' },
    pending: { label: 'Eksper onayı bekliyor', description: 'Budama tespit edildi ve müstahsile yazıldı; alımı açmak için eksper onayı gerekiyor.', tone: 'warning' },
    rejected: { label: 'Eksper reddetti', description: 'Eksper bu sezon budamayı yetersiz buldu.', tone: 'danger' },
    unattributed: { label: 'Müstahsile atanamadı', description: 'Hisseli parselde bu bahçenin sınırı ölçülmedi; budama hangi hissedarın, bilinmiyor.', tone: 'muted' },
    no_license: { label: 'Ruhsat yok / eşleşme bekliyor', description: 'Budama görüldü ama bahçeye bağlı ruhsat yok ya da ruhsat–parsel eşleşmesi tamamlanmadı.', tone: 'danger' },
};
export const REGISTRATION_ORDER: PruningRegistration[] = ['auto', 'expert', 'pending', 'no_license', 'unattributed', 'rejected'];

// ── Radar module: Sentinel-1 verdict on an optical record ──

export const RADAR_META: Record<RadarClass, ProducerStatusMeta> = {
    confirmed: { label: 'Radar teyit etti', description: 'Komşuluğa göreli VH geri saçılımı değişim penceresinden sonra anlamlı (z ≥ 2,5) ve kalıcı şekilde düştü: örtü kalkmış.', tone: 'success' },
    weak: { label: 'Zayıf radar sinyali', description: 'Düşüş var ama bahçenin kendi benek gürültüsüne göre kesin değil (z 1,5–2,5).', tone: 'info' },
    neutral: { label: 'Radar nötr', description: 'Radar belirgin bir değişim görmedi; 10 m GRD küçük bahçede her budamayı göremez.', tone: 'muted' },
    contradicted: { label: 'Radar çelişiyor', description: 'Geri saçılım anlamlı şekilde YÜKSELDİ; optik düşüş kar/gölge olabilir, eksper baksın.', tone: 'danger' },
    no_data: { label: 'Radar verisi yetersiz', description: 'Değişim penceresinin iki yanında yeterli Sentinel-1 geçişi yok.', tone: 'muted' },
};
export const RADAR_ORDER: RadarClass[] = ['confirmed', 'weak', 'neutral', 'contradicted', 'no_data'];

// ── Digital licence register ──

export const MATCH_LEVEL_META: Record<LicenseMatchLevel, ProducerStatusMeta> = {
    exact: { label: 'Kesin eşleşme', description: 'Ruhsattaki ada/parsel güncel TKGM kaydıyla birebir eşleşti.', tone: 'success' },
    historical: { label: 'Tarihsel eşleşme', description: 'Eski pafta/parsel kaydı, eski–yeni parsel tablosu (22-a yenileme, ifraz, tevhit) üzerinden güncel parsele bağlandı.', tone: 'info' },
    probable: { label: 'Olası eşleşme', description: 'Ruhsatta yalnızca mevki/zilyetlik tarifi var; aday parseller üretildi, eksper teyidi bekliyor.', tone: 'warning' },
    unmatched: { label: 'Eşleşmeyen', description: 'Ruhsattaki parsel kaydı güncel kadastroda bulunamadı; alan tahsis edilemiyor.', tone: 'danger' },
};
export const MATCH_LEVEL_ORDER: LicenseMatchLevel[] = ['exact', 'historical', 'probable', 'unmatched'];

export const APPROVAL_STATUS_META: Record<GardenApprovalStatus, ProducerStatusMeta> = {
    approved: { label: 'Onaylı sınır', description: 'Bahçe sınırı kayda alınmış; müstahsilin dijital ruhsat geometrisi.', tone: 'success' },
    proposed: { label: 'Öneri', description: 'Hisseli parselde müstahsil ya da personel sınır önerdi; eksper onayı bekliyor.', tone: 'info' },
    boundary_conflict: { label: 'Sınır ihtilafı', description: 'Sınır önerisi komşu hissedarın alanıyla çakışıyor; uzlaşma veya saha ölçümü gerekir.', tone: 'danger' },
    field_check_required: { label: 'Saha kontrolü', description: 'Ortofoto yeterli değil; sahada GNSS ölçümü istendi.', tone: 'warning' },
    unresolved: { label: 'Belirsiz', description: 'Hisseli parselde bu hissedarın payı henüz çizilmedi.', tone: 'muted' },
};
export const APPROVAL_STATUS_ORDER: GardenApprovalStatus[] = ['boundary_conflict', 'unresolved', 'proposed', 'field_check_required', 'approved'];

export const DISCREPANCY_META: Record<GardenDiscrepancy, ProducerStatusMeta> = {
    area_over: { label: 'Ruhsat alanı fazla', description: 'Ruhsattaki alan, çizilen sınırın veya ölçülen çaylığın %15’ten fazla üzerinde.', tone: 'warning' },
    area_under: { label: 'Ruhsat alanı eksik', description: 'Ölçülen çaylık ruhsattaki alandan %15’ten fazla büyük (genişleme olabilir).', tone: 'warning' },
    no_tea: { label: 'Çay yok', description: 'Ruhsatlı alanda uydu çay görmüyor (hayalet ruhsat ya da sökülmüş bahçe).', tone: 'danger' },
    no_license: { label: 'Ruhsat yok', description: 'Fiili çay bahçesi var, bağlı ruhsat yok.', tone: 'danger' },
    lineage_unresolved: { label: 'Eşleşme bekliyor', description: 'Ruhsat var ama parsel kaydı bu bahçeye bağlanamadı; alan tahsis edilmedi.', tone: 'warning' },
    overlap: { label: 'Çakışma', description: 'Sınır komşu hissedarın alanıyla çakışıyor.', tone: 'danger' },
    outside_parcel: { label: 'Parsel dışı', description: 'Çizilen sınır TKGM parselinin dışına taşıyor.', tone: 'danger' },
};
export const DISCREPANCY_ORDER: GardenDiscrepancy[] = ['no_license', 'no_tea', 'overlap', 'outside_parcel', 'lineage_unresolved', 'area_over', 'area_under'];

export const APPLICATION_STATUS_META: Record<ApplicationStatus, ProducerStatusMeta> = {
    DRAFT: { label: 'Taslak', description: 'Müstahsil başvuruyu oluşturdu, henüz göndermedi.', tone: 'muted' },
    DOCUMENTS_PENDING: { label: 'Belge bekliyor', description: 'Zorunlu belgeler eksik.', tone: 'warning' },
    MATCHING_REQUIRED: { label: 'Eşleştirme gerekli', description: 'Eski parsel kaydı güncel kadastroya bağlanmalı.', tone: 'warning' },
    GEOMETRY_PROPOSED: { label: 'Sınır önerildi', description: 'Sınır çizildi; otomatik kontroller ve eksper incelemesi bekliyor.', tone: 'info' },
    BOUNDARY_CONFLICT: { label: 'Sınır ihtilafı', description: 'Öneri komşu hissedarla çakışıyor.', tone: 'danger' },
    UNDER_REVIEW: { label: 'İncelemede', description: 'Eksper dosyayı inceliyor.', tone: 'info' },
    FIELD_CHECK_REQUIRED: { label: 'Saha kontrolü', description: 'Sahada ölçüm/doğrulama istendi.', tone: 'warning' },
    DEMO_APPROVED: { label: 'Demo onay', description: 'Demo ortamında onaylandı; resmî ÇAYKUR onayı değildir.', tone: 'success' },
    RETURNED_FOR_CORRECTION: { label: 'Düzeltmeye iade', description: 'Müstahsilden düzeltme istendi.', tone: 'warning' },
    REJECTED: { label: 'Reddedildi', description: 'Başvuru reddedildi; itiraz yolu açık.', tone: 'danger' },
    SUPERSEDED: { label: 'Yenisiyle değişti', description: 'Daha yeni bir sürüm bu dosyanın yerini aldı.', tone: 'muted' },
};
export const APPLICATION_STATUS_ORDER: ApplicationStatus[] = [
    'BOUNDARY_CONFLICT',
    'MATCHING_REQUIRED',
    'UNDER_REVIEW',
    'FIELD_CHECK_REQUIRED',
    'GEOMETRY_PROPOSED',
    'DOCUMENTS_PENDING',
    'RETURNED_FOR_CORRECTION',
    'DRAFT',
    'DEMO_APPROVED',
    'REJECTED',
    'SUPERSEDED',
];

export const APPLICATION_TYPE_LABEL: Record<ApplicationType, string> = {
    new_license: 'Yeni ruhsat',
    area_correction: 'Alan düzeltme',
    transfer: 'İntikal / devir',
    boundary_determination: 'Sınır belirleme',
    parcel_update: 'Parsel güncelleme',
};

export const LICENSE_STATUS_LABEL: Record<LicenseView['status'], string> = {
    active: 'Aktif',
    transfer_pending: 'İntikal bekliyor',
    inactive: 'Pasif',
};
