<script setup lang="ts">
import { computed } from 'vue';
import type { PruningWindows } from '@/services/api';

/**
 * Pruning curve of one parcel: NDVI of its tea pixels on every usable Sentinel-2 date
 * against the neighbourhood median, with the selected season's three compared windows
 * shaded. Pruning shows as the parcel line dropping away from the median after the
 * reference window. Scenes the detector discards (neighbourhood-wide collapse: thin snow,
 * frost or winter terrain shadow) are drawn hollow and grey.
 */
const props = defineProps<{
    dates: string[];
    values: Array<number | null>;
    median: number[];
    windows: PruningWindows;
    minSceneTeaMedian: number;
}>();

const W = 640;
const H = 230;
const left = 40;
const right = 12;
const padTop = 24;
const bottom = 30;
const yMin = 0.2;
const yMax = 1.0;
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const times = computed(() => props.dates.map((d) => Date.parse(d)));
const t0 = computed(() => Math.min(...times.value));
const t1 = computed(() => Math.max(...times.value));
const x = (t: number) => left + ((t - t0.value) / Math.max(t1.value - t0.value, 1)) * (W - left - right);
const y = (v: number) => padTop + (1 - (Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * (H - padTop - bottom);

/** Polyline segments, broken where the parcel was not observed or the scene was discarded. */
function segments(values: Array<number | null>, keep: (i: number) => boolean): string[] {
    const out: string[] = [];
    let current: string[] = [];
    values.forEach((v, i) => {
        if (v === null || !keep(i)) {
            if (current.length > 1) out.push(current.join(' '));
            current = [];
            return;
        }
        current.push(`${x(times.value[i] as number).toFixed(1)},${y(v).toFixed(1)}`);
    });
    if (current.length > 1) out.push(current.join(' '));
    return out;
}

const discarded = (i: number) => (props.median[i] ?? 1) < props.minSceneTeaMedian;
const parcelLines = computed(() => segments(props.values, (i) => !discarded(i)));
const medianLines = computed(() => segments(props.median, (i) => !discarded(i)));
const points = computed(() =>
    props.values
        .map((v, i) => ({ v, i }))
        .filter((p): p is { v: number; i: number } => p.v !== null)
        .map(({ v, i }) => ({ cx: x(times.value[i] as number), cy: y(v), date: props.dates[i] as string, v, dropped: discarded(i) })),
);

const bands = computed(() => {
    const w = props.windows;
    return [
        { key: 'ref', label: 'Referans', range: w.reference, cls: 'fill-muted' },
        { key: 'win', label: 'Kış', range: w.winter, cls: 'fill-info/15' },
        { key: 'spr', label: 'Mart', range: w.spring, cls: 'fill-warning/15' },
    ]
        .map((b) => ({ ...b, x0: x(Date.parse(b.range[0])), x1: x(Date.parse(b.range[1])) }))
        .filter((b) => b.x1 > left && b.x0 < W - right);
});

/** January and July of every year in range. */
const ticks = computed(() => {
    const out: Array<{ x: number; label: string }> = [];
    const start = new Date(t0.value);
    for (let yr = start.getUTCFullYear(); yr <= new Date(t1.value).getUTCFullYear(); yr++) {
        for (const m of [0, 6]) {
            const t = Date.UTC(yr, m, 1);
            if (t >= t0.value && t <= t1.value) out.push({ x: x(t), label: `${MONTHS.at(m)} ${yr}` });
        }
    }
    return out;
});
const yTicks = [0.4, 0.6, 0.8, 1.0];
const fmt = (d: string) => `${Number(d.slice(8))} ${MONTHS.at(Number(d.slice(5, 7)) - 1)} ${d.slice(0, 4)}`;
</script>

<template>
    <figure class="space-y-2">
        <svg :viewBox="`0 0 ${W} ${H}`" class="h-auto w-full" role="img" aria-label="Parselin NDVI budama eğrisi ve mahalle ortancası" font-size="11">
            <g>
                <rect
                    v-for="b in bands"
                    :key="b.key"
                    :x="Math.max(b.x0, left)"
                    :y="padTop"
                    :width="Math.min(b.x1, W - right) - Math.max(b.x0, left)"
                    :height="H - padTop - bottom"
                    :class="b.cls"
                />
                <text
                    v-for="b in bands"
                    :key="`${b.key}-l`"
                    :x="(Math.max(b.x0, left) + Math.min(b.x1, W - right)) / 2"
                    :y="padTop - 8"
                    text-anchor="middle"
                    class="fill-muted-foreground"
                >{{ b.label }}</text>
            </g>
            <g>
                <line v-for="v in yTicks" :key="v" :x1="left" :x2="W - right" :y1="y(v)" :y2="y(v)" class="stroke-border" />
                <text v-for="v in yTicks" :key="`yl-${v}`" :x="left - 6" :y="y(v) + 4" text-anchor="end" class="fill-muted-foreground">{{ v.toFixed(1) }}</text>
                <g v-for="tk in ticks" :key="tk.label">
                    <line :x1="tk.x" :x2="tk.x" :y1="H - bottom" :y2="H - bottom + 4" class="stroke-muted-foreground" />
                    <text :x="tk.x" :y="H - 8" text-anchor="middle" class="fill-muted-foreground">{{ tk.label }}</text>
                </g>
            </g>
            <polyline v-for="(pts, i) in medianLines" :key="`m-${i}`" :points="pts" fill="none" class="stroke-muted-foreground" stroke-width="1.25" stroke-dasharray="4 3" />
            <polyline v-for="(pts, i) in parcelLines" :key="`p-${i}`" :points="pts" fill="none" class="stroke-primary" stroke-width="1.75" />
            <circle
                v-for="p in points"
                :key="p.date"
                :cx="p.cx"
                :cy="p.cy"
                r="2.5"
                :class="p.dropped ? 'fill-background stroke-muted-foreground' : 'fill-primary'"
            >
                <title>{{ fmt(p.date) }}: NDVI {{ p.v.toFixed(2) }}{{ p.dropped ? ' (sahne dışarıda: mahalle geneli düşüş)' : '' }}</title>
            </circle>
        </svg>
        <figcaption class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span class="flex items-center gap-1.5"><span class="inline-block h-0.5 w-4 bg-primary" aria-hidden="true" />Parselin çayı</span>
            <span class="flex items-center gap-1.5"><span class="inline-block h-0 w-4 border-t border-dashed border-muted-foreground" aria-hidden="true" />Mahalle ortancası</span>
            <span class="flex items-center gap-1.5"><span class="inline-block size-2 rounded-full border border-muted-foreground" aria-hidden="true" />Dışarıda bırakılan sahne</span>
        </figcaption>
    </figure>
</template>
