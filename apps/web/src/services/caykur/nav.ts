/**
 * Kurum panel navigation model. Each item declares the ModuleKey it needs, so
 * the layout can filter the menu by the active persona's role (Faz 1). Icons are
 * inline Lucide-style SVG inner markup rendered via v-html (static, trusted).
 */

import type { ModuleKey } from '@/services/caykur/roles';

export interface NavItem {
    label: string;
    to: string;
    module: ModuleKey;
    exact?: boolean;
    iconSvg: string;
}

export interface NavGroup {
    label: string;
    items: NavItem[];
}

const I = {
    fields: '<path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z"/><line x1="9" y1="4" x2="9" y2="17"/><line x1="15" y1="7" x2="15" y2="20"/>',
    pruning: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>',
    pruning_requests: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/>',
};

export const NAV_GROUPS: NavGroup[] = [
    {
        label: 'Kayıtlar',
        items: [
            { label: 'Araziler', to: '/caykur/fields', module: 'fields', iconSvg: I.fields },
        ],
    },
    {
        label: 'Operasyon',
        items: [
            { label: 'Budama Talepleri', to: '/caykur/pruning-requests', module: 'pruning_requests', iconSvg: I.pruning_requests },
            { label: 'Budama Denetimi', to: '/caykur/pruning', module: 'pruning', iconSvg: I.pruning },
        ],
    },
];
