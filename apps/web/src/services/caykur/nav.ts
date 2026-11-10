/**
 * Kurum panel navigation model. Each item declares the ModuleKey it needs, so
 * the layout can filter the menu by the active persona's role (Faz 1). Items
 * extend the shared shell `NavItem` shape (Lucide icon component) so the
 * filtered groups can be handed straight to `ShellLayout`.
 */

import { ClipboardCheck, HeartPulse, History, Leaf, MapPinned, Mountain, Ruler, Scissors, ScrollText } from '@lucide/vue';
import type { NavGroup, NavItem } from '@/config/navigation';
import { Icons } from '@/lib/icons';
import type { ModuleKey } from '@/services/caykur/roles';

export interface CaykurNavItem extends NavItem {
    module: ModuleKey;
}

/** Tab keys of the tea-inventory page; the sidebar deep-links to them with `?tab=`. */
export type TeaInventoryTab = 'region' | 'inventory' | 'pruning' | 'licensing' | 'health' | 'land' | 'age';
export const TEA_INVENTORY_PATH = '/caykur/tea-inventory';
export const TEA_INVENTORY_TABS: Array<{ key: TeaInventoryTab; label: string; icon: NavItem['icon'] }> = [
    { key: 'region', label: 'Bölge', icon: MapPinned },
    { key: 'pruning', label: 'Budama Takibi', icon: Scissors },
    { key: 'inventory', label: 'Bahçe Kayıtları', icon: Leaf },
    { key: 'licensing', label: 'Ruhsat İşlemleri', icon: ScrollText },
    { key: 'health', label: 'Bahçe Sağlığı', icon: HeartPulse },
    { key: 'land', label: 'Arazi Değerlendirme', icon: Mountain },
    { key: 'age', label: 'Bahçe Yaşı', icon: History },
];
const tabItem = (key: TeaInventoryTab): CaykurNavItem => {
    const tab = TEA_INVENTORY_TABS.find((t) => t.key === key)!;
    return { label: tab.label, to: `${TEA_INVENTORY_PATH}?tab=${key}`, module: 'tea_inventory', icon: tab.icon };
};

export interface CaykurNavGroup extends NavGroup {
    label: string;
    items: CaykurNavItem[];
}

export const NAV_GROUPS: CaykurNavGroup[] = [
    {
        label: 'Kayıtlar',
        items: [{ label: 'Araziler', to: '/caykur/fields', module: 'fields', icon: Icons.fields }],
    },
    // The tea-inventory page keeps its own tab strip; these entries deep-link to its tabs.
    { label: 'Budama', items: [tabItem('region'), tabItem('pruning')] },
    { label: 'Ruhsatlandırma', items: [tabItem('inventory'), tabItem('licensing')] },
    { label: 'Zirai Analizler', items: [tabItem('health'), tabItem('land'), tabItem('age')] },
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
            {
                label: 'Ölçüm Talepleri',
                to: '/caykur/measurement-requests',
                module: 'measurement_requests',
                icon: Ruler,
            },
        ],
    },
];
