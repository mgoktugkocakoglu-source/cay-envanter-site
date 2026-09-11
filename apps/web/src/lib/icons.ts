/**
 * Icon set configuration.
 *
 * Lucide (`@lucide/vue`) is the primary icon library: it is what shadcn-vue
 * components ship with and what every app-level icon should use.
 * Radix icons (`@radix-icons/vue`) are available as a secondary set for the
 * few glyphs Lucide lacks; import them from here rather than directly so the
 * sizing defaults stay consistent.
 *
 * Usage:
 *   import { Icons } from '@/lib/icons'
 *   <component :is="Icons.fields" :size="20" />
 */
import type { Component } from 'vue';
import {
    Bot,
    ChevronDown,
    ChevronsUpDown,
    Home,
    Layers,
    Leaf,
    LogOut,
    MapPin,
    Menu,
    Moon,
    PanelLeft,
    Scissors,
    Settings,
    ShieldCheck,
    Sun,
    User,
    Wallet,
} from '@lucide/vue';
import { DashboardIcon } from '@radix-icons/vue';

/** Default rendering props shared by every Lucide icon in the app. */
export const ICON_DEFAULTS = {
    size: 20,
    strokeWidth: 2,
    absoluteStrokeWidth: false,
} as const;

/** Semantic icon map: feature name → component. Keeps templates free of glyph names. */
export const Icons = {
    // Navigation
    dashboard: Home,
    fields: MapPin,
    harvests: Layers,
    pruning: Scissors,
    payments: Wallet,
    aiAgent: Bot,
    settings: Settings,
    admin: ShieldCheck,
    caykur: Leaf,

    // Chrome / shell
    menu: Menu,
    sidebarToggle: PanelLeft,
    chevronDown: ChevronDown,
    chevronsUpDown: ChevronsUpDown,
    user: User,
    logout: LogOut,
    sun: Sun,
    moon: Moon,

    // Radix set (secondary)
    grid: DashboardIcon,
} satisfies Record<string, Component>;

export type IconName = keyof typeof Icons;
