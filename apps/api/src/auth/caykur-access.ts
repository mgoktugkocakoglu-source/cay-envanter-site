import { CaykurRole } from '@/auth/enums';

/**
 * Çaykur panel module-access matrix — the backend mirror of the frontend
 * ROLE_DEFS in apps/web/src/services/caykur/roles.ts. Keep the two in sync:
 * the 15 module keys and each role's allow-list must match so server-side
 * gating and client-side navigation agree.
 */
export type CaykurModuleKey =
    | 'overview'
    | 'producers'
    | 'parcels'
    | 'deliveries'
    | 'quota'
    | 'finance'
    | 'pruning'
    | 'org'
    | 'tasks'
    | 'requests'
    | 'announcements'
    | 'reports'
    | 'users'
    | 'audit'
    | 'settings';

export const CAYKUR_MODULE_ACCESS: Record<CaykurRole, CaykurModuleKey[] | 'all'> = {
    [CaykurRole.KURUM_ADMIN]: 'all',
    [CaykurRole.FABRIKA_SORUMLUSU]: [
        'overview', 'producers', 'parcels', 'deliveries', 'quota',
        'pruning', 'org', 'tasks', 'requests', 'announcements', 'reports',
    ],
    [CaykurRole.ALIM_YERI_PERSONELI]: ['overview', 'producers', 'deliveries', 'quota', 'tasks'],
    [CaykurRole.SAHA_PERSONELI]: ['overview', 'producers', 'parcels', 'pruning', 'tasks'],
    [CaykurRole.DENETCI]: [
        'overview', 'producers', 'parcels', 'deliveries', 'quota',
        'finance', 'pruning', 'reports', 'audit',
    ],
    [CaykurRole.FINANS]: ['overview', 'producers', 'finance', 'quota', 'reports', 'requests'],
};

/** Whether a Çaykur role may open a given panel module. */
export function canCaykurAccess(role: CaykurRole, moduleKey: CaykurModuleKey): boolean {
    const access = CAYKUR_MODULE_ACCESS[role];
    return access === 'all' || access.includes(moduleKey);
}

/** Human-readable Turkish labels per role (mirrors frontend ROLE_DEFS labels). */
export const CAYKUR_ROLE_LABELS: Record<CaykurRole, string> = {
    [CaykurRole.KURUM_ADMIN]: 'Kurum Yöneticisi',
    [CaykurRole.FABRIKA_SORUMLUSU]: 'Fabrika Sorumlusu',
    [CaykurRole.ALIM_YERI_PERSONELI]: 'Alım Yeri Personeli',
    [CaykurRole.SAHA_PERSONELI]: 'Saha Personeli',
    [CaykurRole.DENETCI]: 'Denetçi',
    [CaykurRole.FINANS]: 'Finans Personeli',
};
