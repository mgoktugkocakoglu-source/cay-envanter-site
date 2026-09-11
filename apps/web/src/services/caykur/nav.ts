/**
 * Kurum panel navigation model. Each item declares the ModuleKey it needs, so
 * the layout can filter the menu by the active persona's role (Faz 1). Items
 * extend the shared shell `NavItem` shape (Lucide icon component) so the
 * filtered groups can be handed straight to `ShellLayout`.
 */

import { ClipboardCheck } from '@lucide/vue';
import type { NavGroup, NavItem } from '@/config/navigation';
import { Icons } from '@/lib/icons';
import type { ModuleKey } from '@/services/caykur/roles';

export interface CaykurNavItem extends NavItem {
    module: ModuleKey;
}

export interface CaykurNavGroup extends NavGroup {
    label: string;
    items: CaykurNavItem[];
}

export const NAV_GROUPS: CaykurNavGroup[] = [
    {
        label: 'Kayıtlar',
        items: [
            { label: 'Araziler', to: '/caykur/fields', module: 'fields', icon: Icons.fields },
        ],
    },
    {
        label: 'Operasyon',
        items: [
            {
                label: 'Budama Talepleri',
                to: '/caykur/pruning-requests',
                module: 'pruning_requests',
                icon: ClipboardCheck,
            },
            { label: 'Budama Denetimi', to: '/caykur/pruning', module: 'pruning', icon: Icons.pruning },
        ],
    },
];
