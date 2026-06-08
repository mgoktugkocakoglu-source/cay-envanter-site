/**
 * Workflow + communication layer: staff tasks (Faz 9), producer requests &
 * objections (Faz 9/12), and announcements (Faz 11). All reference the seeded
 * producers/regions so cross-links resolve.
 */

import { PRODUCERS, type Producer, type Region } from '@/services/caykurData';
import { REGIONS } from '@/services/caykur/org';
import { dateDaysAgo, intBetween, noise, pad, pick, timestampDaysAgo } from '@/services/caykur/rng';

// ── Announcements (duyuru) ───────────────────────────────────────────────────

export type AudienceKind = 'all' | 'region' | 'factory';

export interface Announcement {
    id: string;
    title: string;
    body: string;
    audienceKind: AudienceKind;
    audienceLabel: string;
    channels: Array<'sms' | 'email' | 'push'>;
    publishedAt: string;
    readPct: number;
    pinned: boolean;
}

export const ANNOUNCEMENTS: Announcement[] = [
    {
        id: 'duy-001',
        title: '2025 yaş çay alım kampanyası başladı',
        body: 'Birinci sürgün alımları tüm alım yerlerinde başlamıştır. Günlük kota ve teslimat saatlerini portalınızdan takip edebilirsiniz.',
        audienceKind: 'all',
        audienceLabel: 'Tüm müstahsiller',
        channels: ['sms', 'email', 'push'],
        publishedAt: dateDaysAgo(118),
        readPct: 92,
        pinned: true,
    },
    {
        id: 'duy-002',
        title: 'Birim fiyat açıklandı: 16,50 ₺/kg',
        body: '2025 sezonu yaş çay taban fiyatı 16,50 ₺/kg, organik ürün için 17,50 ₺/kg olarak belirlenmiştir.',
        audienceKind: 'all',
        audienceLabel: 'Tüm müstahsiller',
        channels: ['sms', 'email', 'push'],
        publishedAt: dateDaysAgo(120),
        readPct: 96,
        pinned: true,
    },
    {
        id: 'duy-003',
        title: 'Çayeli Fabrikası bakım duyurusu',
        body: '14–15 Temmuz tarihlerinde Çayeli Fabrikası planlı bakımdadır. Alımlar Pazar Fabrikasına yönlendirilecektir.',
        audienceKind: 'factory',
        audienceLabel: 'Çayeli Fab.',
        channels: ['sms', 'push'],
        publishedAt: dateDaysAgo(63),
        readPct: 81,
        pinned: false,
    },
    {
        id: 'duy-004',
        title: 'Budama desteği başvuruları',
        body: '1/7 budama rotasyon desteği başvuruları 30 Eylüle kadar uzatılmıştır. Saha personeli ölçüm randevularını planlamaktadır.',
        audienceKind: 'all',
        audienceLabel: 'Tüm müstahsiller',
        channels: ['email', 'push'],
        publishedAt: dateDaysAgo(28),
        readPct: 64,
        pinned: false,
    },
    {
        id: 'duy-005',
        title: 'Artvin bölgesi don uyarısı',
        body: 'Önümüzdeki hafta düşük sıcaklık beklenmektedir. Hasat planınızı buna göre düzenleyiniz.',
        audienceKind: 'region',
        audienceLabel: 'Artvin bölgesi',
        channels: ['sms', 'push'],
        publishedAt: dateDaysAgo(9),
        readPct: 58,
        pinned: false,
    },
    {
        id: 'duy-006',
        title: 'Üçüncü sürgün hakediş ödemeleri',
        body: 'Üçüncü sürgün hakediş ödemeleri onay sürecindedir. Cari ekstrenizi portalınızdan inceleyebilirsiniz.',
        audienceKind: 'all',
        audienceLabel: 'Tüm müstahsiller',
        channels: ['email', 'push'],
        publishedAt: dateDaysAgo(4),
        readPct: 41,
        pinned: false,
    },
    {
        id: 'duy-007',
        title: 'Organik sertifika yenileme',
        body: 'Organik üretici belgesi 2025 sonunda dolacak müstahsillerin belgelerini yenilemeleri gerekmektedir.',
        audienceKind: 'all',
        audienceLabel: 'Organik üreticiler',
        channels: ['email'],
        publishedAt: dateDaysAgo(2),
        readPct: 23,
        pinned: false,
    },
];

export function announcementById(id: string): Announcement | undefined {
    return ANNOUNCEMENTS.find((a) => a.id === id);
}

// ── Producer requests / objections (talep / itiraz) ──────────────────────────

export type RequestType = 'parsel' | 'kota' | 'odeme' | 'belge' | 'genel';
export type RequestStatus = 'open' | 'in_progress' | 'answered' | 'closed';
export type RequestPriority = 'low' | 'normal' | 'high';

export interface RequestEvent {
    at: string;
    status: RequestStatus;
    by: string;
    note: string;
}

export interface ProducerRequest {
    id: string;
    type: RequestType;
    subject: string;
    producerId: string;
    producerName: string;
    region: Region;
    status: RequestStatus;
    priority: RequestPriority;
    createdAt: string;
    updatedAt: string;
    assignee: string | null;
    history: RequestEvent[];
}

export const REQUEST_TYPE_META: Record<RequestType, { label: string }> = {
    parsel: { label: 'Parsel düzeltme' },
    kota: { label: 'Kota itirazı' },
    odeme: { label: 'Ödeme itirazı' },
    belge: { label: 'Belge talebi' },
    genel: { label: 'Genel talep' },
};

export const REQUEST_STATUS_META: Record<RequestStatus, { label: string; tone: 'warning' | 'info' | 'success' | 'muted' }> = {
    open: { label: 'Açık', tone: 'warning' },
    in_progress: { label: 'İşlemde', tone: 'info' },
    answered: { label: 'Yanıtlandı', tone: 'success' },
    closed: { label: 'Kapandı', tone: 'muted' },
};

export const PRIORITY_META: Record<RequestPriority, { label: string; tone: 'muted' | 'info' | 'danger' }> = {
    low: { label: 'Düşük', tone: 'muted' },
    normal: { label: 'Normal', tone: 'info' },
    high: { label: 'Yüksek', tone: 'danger' },
};

const REQUEST_SUBJECTS: Record<RequestType, string[]> = {
    parsel: ['Ada/parsel bilgisi hatalı', 'Parsel alanı eksik görünüyor', 'Yeni parsel ekleme talebi'],
    kota: ['Kota düşük belirlenmiş', 'Kota artırım talebi', 'Kota hesabı hatalı'],
    odeme: ['Ödeme gecikti', 'Fire oranı itirazı', 'Eksik hakediş'],
    belge: ['Müstahsil belgesi talebi', 'Cari ekstre talebi', 'Organik sertifika kopyası'],
    genel: ['Alım yeri değişiklik talebi', 'İletişim bilgisi güncelleme', 'Genel bilgi talebi'],
};

const STAFF_RESPONDERS = ['Erkan Kara', 'Naci Hocaoğlu', 'Hülya Yıldız', 'Davut Şahin', 'Ayla Demir'];
const TYPES: RequestType[] = ['parsel', 'kota', 'odeme', 'belge', 'genel'];

function buildRequests(): ProducerRequest[] {
    const sample: Producer[] = Array.from({ length: 16 }, (_, i) => PRODUCERS[(i * 3 + 2) % PRODUCERS.length]);
    return sample.map((p, i) => {
        const seed = i * 5 + 1;
        const type = TYPES[i % TYPES.length];
        const subject = pick(REQUEST_SUBJECTS[type], seed);
        const r = noise(seed + 1);
        const status: RequestStatus = r < 0.3 ? 'open' : r < 0.55 ? 'in_progress' : r < 0.85 ? 'answered' : 'closed';
        const priority: RequestPriority = noise(seed + 2) < 0.2 ? 'high' : noise(seed + 2) < 0.6 ? 'normal' : 'low';
        const createdAgo = intBetween(2, 50, seed + 3);
        const assignee = status === 'open' ? null : pick(STAFF_RESPONDERS, seed + 4);

        const history: RequestEvent[] = [
            { at: timestampDaysAgo(createdAgo, 9), status: 'open', by: p.fullName, note: 'Talep oluşturuldu.' },
        ];
        if (status !== 'open') {
            history.push({ at: timestampDaysAgo(Math.max(1, createdAgo - 1), 11), status: 'in_progress', by: assignee ?? 'Personel', note: 'Talep incelemeye alındı.' });
        }
        if (status === 'answered' || status === 'closed') {
            history.push({ at: timestampDaysAgo(Math.max(1, createdAgo - 3), 14), status: 'answered', by: assignee ?? 'Personel', note: 'Talep yanıtlandı.' });
        }
        if (status === 'closed') {
            history.push({ at: timestampDaysAgo(Math.max(1, createdAgo - 5), 16), status: 'closed', by: assignee ?? 'Personel', note: 'Talep kapatıldı.' });
        }

        return {
            id: `tlp-${pad(i + 1, 3)}`,
            type,
            subject,
            producerId: p.id,
            producerName: p.fullName,
            region: p.region,
            status,
            priority,
            createdAt: timestampDaysAgo(createdAgo, 9),
            updatedAt: history[history.length - 1].at,
            assignee,
            history,
        };
    });
}

export const REQUESTS: ProducerRequest[] = buildRequests().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

export function requestById(id: string): ProducerRequest | undefined {
    return REQUESTS.find((r) => r.id === id);
}

export function requestsForProducer(producerId: string): ProducerRequest[] {
    return REQUESTS.filter((r) => r.producerId === producerId);
}

// ── Staff tasks (görev) ──────────────────────────────────────────────────────

export type TaskType = 'mustahsil_dogrulama' | 'parsel_kontrol' | 'budama_olcum' | 'odeme_inceleme' | 'belge_kontrol';
export type WorkTaskStatus = 'open' | 'in_progress' | 'done' | 'overdue';

export interface WorkTask {
    id: string;
    type: TaskType;
    title: string;
    assignee: string;
    region: Region;
    relatedProducerId: string | null;
    relatedProducerName: string | null;
    dueDate: string;
    status: WorkTaskStatus;
    priority: RequestPriority;
    createdAt: string;
}

export const TASK_TYPE_META: Record<TaskType, { label: string }> = {
    mustahsil_dogrulama: { label: 'Müstahsil doğrulama' },
    parsel_kontrol: { label: 'Parsel kontrolü' },
    budama_olcum: { label: 'Budama ölçümü' },
    odeme_inceleme: { label: 'Ödeme incelemesi' },
    belge_kontrol: { label: 'Belge kontrolü' },
};

export const TASK_STATUS_META: Record<WorkTaskStatus, { label: string; tone: 'warning' | 'info' | 'success' | 'danger' }> = {
    open: { label: 'Açık', tone: 'warning' },
    in_progress: { label: 'Devam ediyor', tone: 'info' },
    done: { label: 'Tamamlandı', tone: 'success' },
    overdue: { label: 'Gecikti', tone: 'danger' },
};

const TASK_TYPES: TaskType[] = ['mustahsil_dogrulama', 'parsel_kontrol', 'budama_olcum', 'odeme_inceleme', 'belge_kontrol'];
const TASK_ASSIGNEES = ['Davut Şahin', 'Yılmaz Çelik', 'İbrahim Kaya', 'Erkan Kara', 'Ayla Demir', 'Hülya Yıldız'];

function buildTasks(): WorkTask[] {
    return Array.from({ length: 14 }, (_, i) => {
        const seed = i * 4 + 2;
        const type = TASK_TYPES[i % TASK_TYPES.length];
        const p = PRODUCERS[(i * 5 + 1) % PRODUCERS.length];
        const r = noise(seed);
        const dueAgo = intBetween(-12, 14, seed + 1); // negative = future due date
        let status: WorkTaskStatus = r < 0.25 ? 'open' : r < 0.5 ? 'in_progress' : r < 0.82 ? 'done' : 'open';
        if (status !== 'done' && dueAgo > 2) status = 'overdue';
        return {
            id: `grv-${pad(i + 1, 3)}`,
            type,
            title: `${TASK_TYPE_META[type].label} — ${p.fullName}`,
            assignee: pick(TASK_ASSIGNEES, seed + 2),
            region: p.region,
            relatedProducerId: p.id,
            relatedProducerName: p.fullName,
            dueDate: dateDaysAgo(dueAgo),
            status,
            priority: (noise(seed + 3) < 0.25 ? 'high' : noise(seed + 3) < 0.65 ? 'normal' : 'low') as RequestPriority,
            createdAt: dateDaysAgo(dueAgo + intBetween(3, 12, seed + 4)),
        };
    }).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
}

export const WORK_TASKS: WorkTask[] = buildTasks();

export function taskById(id: string): WorkTask | undefined {
    return WORK_TASKS.find((t) => t.id === id);
}

export const REGION_NAMES: Region[] = REGIONS.map((r) => r.name);
