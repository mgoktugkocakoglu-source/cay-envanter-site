import type { Component } from 'vue';
import { Building2, LayoutDashboard, Users } from '@lucide/vue';
import { Icons } from '@/lib/icons';

export interface NavItem {
    /** Turkish label shown to the user. */
    label: string;
    /** Short label for the mobile tab bar; falls back to `label`. */
    shortLabel?: string;
    to: string;
    icon: Component;
    /** Only match the exact path (used by the dashboard root). */
    exact?: boolean;
}

export interface NavGroup {
    label?: string;
    items: NavItem[];
}

/** Primary navigation of the Tea Business hub (/tea/*). */
export const teaNavigation: NavGroup[] = [
    {
        items: [
            { label: 'Ana Sayfa', to: '/tea/dashboard', icon: Icons.dashboard, exact: true },
            { label: 'Arazilerim', shortLabel: 'Araziler', to: '/tea/fields', icon: Icons.fields },
            { label: 'Hasatlarım', shortLabel: 'Hasatlar', to: '/tea/harvests', icon: Icons.harvests },
            { label: 'Budama', to: '/tea/pruning', icon: Icons.pruning },
            { label: 'Ödemeler', to: '/tea/payments', icon: Icons.payments },
            { label: 'AI Agent', shortLabel: 'AI', to: '/tea/ai-agent', icon: Icons.aiAgent },
        ],
    },
    {
        label: 'Hesap',
        items: [{ label: 'Ayarlar', to: '/tea/settings', icon: Icons.settings }],
    },
];

/** Items surfaced in the mobile bottom tab bar (max 5 for thumb reach). */
export const teaMobileTabs: NavItem[] = teaNavigation[0].items.filter(
    (item) => item.to !== '/tea/payments',
);

/** Navigation of the admin panel (/admin/*). */
export const adminNavigation: NavGroup[] = [
    {
        items: [
            { label: 'Genel Bakış', to: '/admin', icon: LayoutDashboard, exact: true },
            { label: 'Kullanıcılar', to: '/admin/users', icon: Users },
            { label: 'Firmalar', to: '/admin/firms', icon: Building2 },
        ],
    },
    {
        label: 'Uygulama',
        items: [{ label: 'Uygulamaya Dön', to: '/tea/dashboard', icon: Icons.dashboard, exact: true }],
    },
];
