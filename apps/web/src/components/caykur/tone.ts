import type { BadgeVariants } from '@/components/ui/badge';

/** Semantic tone used by Çaykur status metadata (`PRUNING_REQUEST_STATUS_META` etc.). */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'muted';

/** Maps a semantic tone to the matching `Badge` variant (names are 1:1 by design). */
export function toneVariant(tone?: Tone | null): NonNullable<BadgeVariants['variant']> {
    return tone ?? 'muted';
}

/** Tailwind class that recolours a `Progress` indicator for a given tone. */
export const PROGRESS_TONE_CLASS: Record<Exclude<Tone, 'muted'>, string> = {
    success: '[&>[data-slot=progress-indicator]]:bg-success',
    warning: '[&>[data-slot=progress-indicator]]:bg-warning',
    danger: '[&>[data-slot=progress-indicator]]:bg-destructive',
    info: '[&>[data-slot=progress-indicator]]:bg-info',
};
