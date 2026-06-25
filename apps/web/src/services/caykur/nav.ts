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
    overview: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
    producers: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    parcels: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
    deliveries: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    quota: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
    finance: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
    pruning: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>',
    pruning_requests: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/>',
    org: '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M7 18h.01"/><path d="M12 18h.01"/><path d="M17 18h.01"/>',
    tasks: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    requests: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    announcements: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    reports: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
    users: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    audit: '<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
};

export const NAV_GROUPS: NavGroup[] = [
    {
        label: '',
        items: [
            { label: 'Genel Bakış', to: '/caykur', module: 'overview', exact: true, iconSvg: I.overview },
        ],
    },
    {
        label: 'Müstahsil & Arazi',
        items: [
            { label: 'Müstahsiller', to: '/caykur/producers', module: 'producers', iconSvg: I.producers },
            { label: 'Parseller', to: '/caykur/parcels', module: 'parcels', iconSvg: I.parcels },
        ],
    },
    {
        label: 'Operasyon',
        items: [
            { label: 'Yaş Çay Alımı', to: '/caykur/deliveries', module: 'deliveries', iconSvg: I.deliveries },
            { label: 'Kota Yönetimi', to: '/caykur/quota', module: 'quota', iconSvg: I.quota },
            { label: 'Budama Talepleri', to: '/caykur/pruning-requests', module: 'pruning_requests', iconSvg: I.pruning_requests },
            { label: 'Budama Denetimi', to: '/caykur/pruning', module: 'pruning', iconSvg: I.pruning },
        ],
    },
    {
        label: 'Finans',
        items: [
            { label: 'Ödeme & Cari', to: '/caykur/finance', module: 'finance', iconSvg: I.finance },
        ],
    },
    {
        label: 'Organizasyon',
        items: [
            { label: 'Fabrika & Alım Yeri', to: '/caykur/org', module: 'org', iconSvg: I.org },
        ],
    },
    {
        label: 'İş Akışı',
        items: [
            { label: 'Görevler', to: '/caykur/tasks', module: 'tasks', iconSvg: I.tasks },
            { label: 'Talepler', to: '/caykur/requests', module: 'requests', iconSvg: I.requests },
            { label: 'Duyurular', to: '/caykur/announcements', module: 'announcements', iconSvg: I.announcements },
        ],
    },
    {
        label: 'Analiz',
        items: [
            { label: 'Raporlar', to: '/caykur/reports', module: 'reports', iconSvg: I.reports },
        ],
    },
    {
        label: 'Yönetim',
        items: [
            { label: 'Kullanıcılar & Roller', to: '/caykur/users', module: 'users', iconSvg: I.users },
            { label: 'İşlem Geçmişi', to: '/caykur/audit', module: 'audit', iconSvg: I.audit },
            { label: 'Sistem Ayarları', to: '/caykur/settings', module: 'settings', iconSvg: I.settings },
        ],
    },
];
