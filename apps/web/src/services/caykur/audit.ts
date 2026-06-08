/**
 * Audit log (işlem geçmişi, Faz 1). A deterministic stream of institutional
 * actions across the platform — every critical data change is recorded with
 * actor, role, module, action and a human summary. Feeds both the global audit
 * viewer and per-producer activity timelines.
 */

import { PRODUCERS } from '@/services/caykurData';
import { STAFF } from '@/services/caykur/org';
import { type ModuleKey } from '@/services/caykur/roles';
import { type CaykurRole } from '@/services/caykur/roles';
import { intBetween, noise, pad, pick, timestampDaysAgo } from '@/services/caykur/rng';

export type AuditAction = 'create' | 'update' | 'approve' | 'reject' | 'delete' | 'login' | 'export';

export interface AuditEntry {
    id: string;
    at: string;
    actorName: string;
    actorRole: CaykurRole;
    action: AuditAction;
    module: ModuleKey;
    entityLabel: string;
    summary: string;
    /** Optional linked producer for the per-producer timeline. */
    producerId: string | null;
}

export const AUDIT_ACTION_META: Record<AuditAction, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' | 'muted' }> = {
    create: { label: 'Oluşturma', tone: 'success' },
    update: { label: 'Güncelleme', tone: 'info' },
    approve: { label: 'Onay', tone: 'success' },
    reject: { label: 'Ret', tone: 'danger' },
    delete: { label: 'Silme', tone: 'danger' },
    login: { label: 'Giriş', tone: 'muted' },
    export: { label: 'Dışa aktarma', tone: 'warning' },
};

interface Template {
    module: ModuleKey;
    action: AuditAction;
    entity: string;
    summary: (producerName: string) => string;
    roles: CaykurRole[];
    usesProducer: boolean;
}

const TEMPLATES: Template[] = [
    { module: 'deliveries', action: 'create', entity: 'Alım fişi', summary: (n) => `${n} için yaş çay alım fişi oluşturuldu`, roles: ['alim_yeri_personeli'], usesProducer: true },
    { module: 'deliveries', action: 'approve', entity: 'Alım fişi', summary: (n) => `${n} alımı onaylandı`, roles: ['fabrika_sorumlusu'], usesProducer: true },
    { module: 'deliveries', action: 'reject', entity: 'Alım fişi', summary: (n) => `${n} alımı reddedildi (fire itirazı)`, roles: ['fabrika_sorumlusu'], usesProducer: true },
    { module: 'parcels', action: 'approve', entity: 'Parsel', summary: (n) => `${n} parseli doğrulandı`, roles: ['saha_personeli'], usesProducer: true },
    { module: 'parcels', action: 'update', entity: 'Parsel', summary: (n) => `${n} parsel alanı güncellendi`, roles: ['saha_personeli'], usesProducer: true },
    { module: 'pruning', action: 'approve', entity: 'Budama ölçümü', summary: (n) => `${n} budama ölçümü onaylandı`, roles: ['denetci'], usesProducer: true },
    { module: 'pruning', action: 'reject', entity: 'Budama ölçümü', summary: (n) => `${n} budama ölçümü reddedildi`, roles: ['denetci'], usesProducer: true },
    { module: 'quota', action: 'update', entity: 'Kota', summary: (n) => `${n} kota revizyonu işlendi`, roles: ['kurum_admin', 'finans'], usesProducer: true },
    { module: 'finance', action: 'approve', entity: 'Ödeme', summary: (n) => `Hakediş ödeme partisi onaylandı`, roles: ['finans'], usesProducer: false },
    { module: 'finance', action: 'export', entity: 'Banka dosyası', summary: () => `Banka ödeme dosyası dışa aktarıldı`, roles: ['finans'], usesProducer: false },
    { module: 'announcements', action: 'create', entity: 'Duyuru', summary: () => `Yeni duyuru yayınlandı`, roles: ['kurum_admin'], usesProducer: false },
    { module: 'requests', action: 'update', entity: 'Talep', summary: (n) => `${n} talebi yanıtlandı`, roles: ['fabrika_sorumlusu', 'finans'], usesProducer: true },
    { module: 'users', action: 'update', entity: 'Kullanıcı', summary: () => `Personel rolü güncellendi`, roles: ['kurum_admin'], usesProducer: false },
    { module: 'producers', action: 'create', entity: 'Müstahsil', summary: (n) => `${n} müstahsil kaydı oluşturuldu`, roles: ['fabrika_sorumlusu'], usesProducer: true },
    { module: 'settings', action: 'login', entity: 'Oturum', summary: () => `Panele giriş yapıldı`, roles: ['kurum_admin', 'denetci', 'finans', 'fabrika_sorumlusu'], usesProducer: false },
];

function buildAuditLog(count = 48): AuditEntry[] {
    const entries: AuditEntry[] = [];
    for (let i = 0; i < count; i++) {
        const seed = i * 3 + 1;
        const t = TEMPLATES[Math.floor(noise(seed) * TEMPLATES.length) % TEMPLATES.length];
        const role = pick(t.roles, seed + 1);
        const candidates = STAFF.filter((s) => s.role === role);
        const actor = candidates.length ? candidates[Math.floor(noise(seed + 2) * candidates.length) % candidates.length] : STAFF[0];
        const producer = t.usesProducer ? PRODUCERS[Math.floor(noise(seed + 3) * PRODUCERS.length) % PRODUCERS.length] : null;
        entries.push({
            id: `aud-${pad(i + 1, 4)}`,
            at: timestampDaysAgo(intBetween(0, 45, seed + 4), intBetween(8, 18, seed + 5), intBetween(0, 59, seed + 6)),
            actorName: actor.fullName,
            actorRole: role,
            action: t.action,
            module: t.module,
            entityLabel: t.entity,
            summary: t.summary(producer?.fullName ?? ''),
            producerId: producer?.id ?? null,
        });
    }
    return entries.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export const AUDIT_LOG: AuditEntry[] = buildAuditLog();

export function auditForProducer(producerId: string): AuditEntry[] {
    return AUDIT_LOG.filter((e) => e.producerId === producerId);
}
