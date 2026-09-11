/**
 * Çaykur enterprise role & permission model (Faz 1).
 *
 * Two surfaces share one identity layer: the Kurum (institution) panel for
 * Çaykur staff, and the Müstahsil (producer) portal. Each institutional role
 * sees a different slice of the panel. The demo exposes a persona switcher so
 * a pitch can walk through "what the field officer sees" vs "what finance sees"
 * without re-authenticating.
 */

/** Every navigable area of the Kurum panel — the unit of access control. */
export type ModuleKey = 'fields' | 'pruning' | 'pruning_requests';

export type CaykurRole =
    | 'kurum_admin'
    | 'fabrika_sorumlusu'
    | 'alim_yeri_personeli'
    | 'saha_personeli'
    | 'denetci'
    | 'finans';

export interface RoleDef {
    id: CaykurRole;
    label: string;
    short: string;
    description: string;
    /** Module access: 'all' or an explicit allow-list. */
    access: ModuleKey[] | 'all';
}

export const ROLE_DEFS: RoleDef[] = [
    {
        id: 'kurum_admin',
        label: 'Kurum Yöneticisi',
        short: 'Yönetici',
        description: 'Tüm modüllere ve sistem ayarlarına tam erişim.',
        access: 'all',
    },
    {
        id: 'fabrika_sorumlusu',
        label: 'Fabrika Sorumlusu',
        short: 'Fabrika',
        description: 'Bağlı fabrika ve alım yerlerinin operasyonunu yönetir.',
        access: ['fields', 'pruning', 'pruning_requests'],
    },
    {
        id: 'alim_yeri_personeli',
        label: 'Alım Yeri Personeli',
        short: 'Alım yeri',
        description: 'Günlük yaş çay alımını kaydeder, kota durumunu izler.',
        access: ['fields'],
    },
    {
        id: 'saha_personeli',
        label: 'Saha Personeli',
        short: 'Saha',
        description: 'Parsel doğrulama ve budama ölçüm görevlerini yürütür.',
        access: ['fields', 'pruning', 'pruning_requests'],
    },
    {
        id: 'denetci',
        label: 'Denetçi',
        short: 'Denetçi',
        description: 'Uygunluk, ödeme ve işlem kayıtlarını denetler (salt-izleme).',
        access: ['fields', 'pruning'],
    },
    {
        id: 'finans',
        label: 'Finans Personeli',
        short: 'Finans',
        description: 'Hakediş, kesinti, avans ve ödeme onay akışını yönetir.',
        access: ['fields'],
    },
];

export const MODULE_LABELS: Record<ModuleKey, string> = {
    fields: 'Araziler',
    pruning: 'Budama Denetimi',
    pruning_requests: 'Budama Talepleri',
};

export const ALL_MODULES: ModuleKey[] = Object.keys(MODULE_LABELS) as ModuleKey[];

const ROLE_BY_ID = new Map(ROLE_DEFS.map((r) => [r.id, r]));

export function roleDef(id: CaykurRole): RoleDef {
    return ROLE_BY_ID.get(id) ?? ROLE_DEFS[0];
}

export function roleLabel(id: CaykurRole): string {
    return roleDef(id).label;
}

/** Whether a role may open a given module. */
export function canAccess(role: CaykurRole, moduleKey: ModuleKey): boolean {
    const def = roleDef(role);
    return def.access === 'all' || def.access.includes(moduleKey);
}

/**
 * Demo personas for the in-panel role switcher. Each maps to a real seeded
 * staff member (see the seeded staff registry) so scoping reads as authentic.
 */
export interface Persona {
    role: CaykurRole;
    name: string;
    title: string;
    /** Org scope shown under the name, e.g. "Çayeli Fab." */
    scope: string;
}

export const PERSONAS: Persona[] = [
    { role: 'kurum_admin', name: 'Selçuk Aydın', title: 'Kurum Yöneticisi', scope: 'Genel Müdürlük' },
    { role: 'fabrika_sorumlusu', name: 'Naci Hocaoğlu', title: 'Fabrika Sorumlusu', scope: 'Çayeli Fab.' },
    { role: 'alim_yeri_personeli', name: 'Erkan Kara', title: 'Alım Yeri Personeli', scope: 'Çayeli Merkez Alım' },
    { role: 'saha_personeli', name: 'Davut Şahin', title: 'Saha Personeli', scope: 'Rize / Çayeli' },
    { role: 'denetci', name: 'Ayla Demir', title: 'Denetçi', scope: 'Bölge Denetim' },
    { role: 'finans', name: 'Hülya Yıldız', title: 'Finans Personeli', scope: 'Mali İşler' },
];

export function personaForRole(role: CaykurRole): Persona {
    return PERSONAS.find((p) => p.role === role) ?? PERSONAS[0];
}
