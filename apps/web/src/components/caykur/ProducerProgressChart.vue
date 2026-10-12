<script setup lang="ts">
import { computed } from 'vue';
import type { ProducerScanPoint } from '@/services/api';

/**
 * A producer's season: cumulative pruned area across all gardens at every scan, against the
 * 1/7 target and the auto-approval line. Filled dots = a new clear scene reached that scan;
 * hollow = no new observation (cloud / snow). A marker shows when purchase opened automatically.
 */
const props = defineProps<{
    scans: ProducerScanPoint[];
    newObservation: boolean[];
    requiredM2: number;
    autoRatio: number;
    autoApprovedAt: string | null;
}>();

const W = 640;
const H = 220;
const left = 52;
const right = 16;
const padTop = 20;
const bottom = 30;
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const times = computed(() => props.scans.map((s) => Date.parse(s.date)));
const t0 = computed(() => Math.min(...times.value));
const t1 = computed(() => Math.max(...times.value));
const yMax = computed(() => Math.max(props.requiredM2 * props.autoRatio * 1.25, ...props.scans.map((s) => s.grossPrunedM2), 1));
const x = (t: number) => left + ((t - t0.value) / Math.max(t1.value - t0.value, 1)) * (W - left - right);
const y = (v: number) => padTop + (1 - v / yMax.value) * (H - padTop - bottom);

const line = computed(() => props.scans.map((s, i) => `${x(times.value[i] as number).toFixed(1)},${y(s.newPrunedM2).toFixed(1)}`).join(' '));
/** Gross (before removing ground already credited in the cycle); drawn faint when it differs. */
const grossLine = computed(() => props.scans.map((s, i) => `${x(times.value[i] as number).toFixed(1)},${y(s.grossPrunedM2).toFixed(1)}`).join(' '));
const hasReuse = computed(() => props.scans.some((s) => s.grossPrunedM2 - s.newPrunedM2 >= 1));
const points = computed(() =>
    props.scans.map((s, i) => ({ s, cx: x(times.value[i] as number), cy: y(s.newPrunedM2), fresh: props.newObservation[i] ?? false })),
);
const autoX = computed(() => (props.autoApprovedAt ? x(Date.parse(props.autoApprovedAt)) : null));
const monthTicks = computed(() => {
    const out: Array<{ x: number; label: string }> = [];
    const d = new Date(t0.value);
    for (let m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).getTime(); m <= t1.value; ) {
        const md = new Date(m);
        out.push({ x: x(m), label: `${MONTHS.at(md.getUTCMonth())}` });
        m = Date.UTC(md.getUTCFullYear(), md.getUTCMonth() + 1, 1);
    }
    return out;
});
const fmtM2 = (v: number) => `${Math.round(v).toLocaleString('tr-TR')} m²`;
const fmtDate = (d: string) => `${Number(d.slice(8))} ${MONTHS.at(Number(d.slice(5, 7)) - 1)}`;
</script>

<template>
    <figure class="space-y-2">
        <svg :viewBox="`0 0 ${W} ${H}`" class="h-auto w-full" role="img" aria-label="Müstahsilin sezon boyunca biriken budama alanı ve 1/7 hedefi" font-size="11">
            <g>
                <line :x1="left" :x2="W - right" :y1="H - bottom" :y2="H - bottom" class="stroke-border" />
                <g v-for="tk in monthTicks" :key="tk.label + tk.x">
                    <line :x1="tk.x" :x2="tk.x" :y1="padTop" :y2="H - bottom" class="stroke-border" stroke-dasharray="2 4" />
                    <text :x="tk.x" :y="H - 10" text-anchor="middle" class="fill-muted-foreground">{{ tk.label }}</text>
                </g>
            </g>
            <g>
                <line :x1="left" :x2="W - right" :y1="y(requiredM2)" :y2="y(requiredM2)" class="stroke-foreground" stroke-width="1.25" stroke-dasharray="6 4" />
                <text :x="left - 6" :y="y(requiredM2) + 4" text-anchor="end" class="fill-foreground" font-weight="600">1/7</text>
                <line :x1="left" :x2="W - right" :y1="y(requiredM2 * autoRatio)" :y2="y(requiredM2 * autoRatio)" class="stroke-success" stroke-width="1" stroke-dasharray="2 3" />
                <text :x="left - 6" :y="y(requiredM2 * autoRatio) + 4" text-anchor="end" class="fill-success">oto</text>
                <text :x="left - 6" :y="H - bottom + 4" text-anchor="end" class="fill-muted-foreground">0</text>
            </g>
            <g v-if="autoX !== null">
                <line :x1="autoX" :x2="autoX" :y1="padTop" :y2="H - bottom" class="stroke-success" stroke-width="1.5" />
                <text :x="autoX + 4" :y="padTop + 10" class="fill-success" font-weight="600">alım açıldı</text>
            </g>
            <polyline v-if="hasReuse" :points="grossLine" fill="none" class="stroke-warning" stroke-width="1.25" stroke-dasharray="3 3" />
            <polyline :points="line" fill="none" class="stroke-primary" stroke-width="2" />
            <circle
                v-for="p in points"
                :key="p.s.date"
                :cx="p.cx"
                :cy="p.cy"
                r="3"
                :class="p.fresh ? 'fill-primary' : 'fill-background stroke-muted-foreground'"
            >
                <title>{{ fmtDate(p.s.date) }}: yeni budama {{ fmtM2(p.s.newPrunedM2) }} (brüt {{ fmtM2(p.s.grossPrunedM2) }}) · çayın %{{ Math.round(p.s.observedShare * 100) }}'i gözlendi{{ p.fresh ? '' : ' · yeni bulutsuz sahne yok' }}</title>
            </circle>
        </svg>
        <figcaption class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span class="flex items-center gap-1.5"><span class="inline-block h-0.5 w-4 bg-primary" aria-hidden="true" />Yeni budama ({{ fmtM2(scans.at(-1)?.newPrunedM2 ?? 0) }})</span>
            <span v-if="hasReuse" class="flex items-center gap-1.5"><span class="inline-block w-4 border-t border-dotted border-warning" aria-hidden="true" />Brüt, çakışan dahil ({{ fmtM2(scans.at(-1)?.grossPrunedM2 ?? 0) }})</span>
            <span class="flex items-center gap-1.5"><span class="inline-block w-4 border-t border-dashed border-foreground" aria-hidden="true" />1/7 hedefi ({{ fmtM2(requiredM2) }})</span>
            <span class="flex items-center gap-1.5"><span class="inline-block w-4 border-t border-dotted border-success" aria-hidden="true" />Otomatik onay eşiği (×{{ autoRatio.toLocaleString('tr-TR') }})</span>
            <span class="flex items-center gap-1.5"><span class="inline-block size-2 rounded-full border border-muted-foreground" aria-hidden="true" />Yeni gözlem yok</span>
        </figcaption>
    </figure>
</template>
