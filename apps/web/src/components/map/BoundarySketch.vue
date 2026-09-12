<script setup lang="ts">
import { computed } from 'vue';
import type { HTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';
import type { MeasurementPoint } from '@/services/api';

/**
 * Schematic outline of a measured/drawn ring — no map tiles, no API key.
 * Points are projected equirectangularly (longitude scaled by cos(mean lat))
 * so the shape keeps its proportions, then fitted into the viewBox.
 */
const props = defineProps<{
    /** Ring as {lat, lng} points or [lng, lat] pairs. */
    points: MeasurementPoint[] | number[][];
    label?: string;
    class?: HTMLAttributes['class'];
}>();

const WIDTH = 160;
const HEIGHT = 100;
const PAD = 10;

interface XY {
    x: number;
    y: number;
}

const ring = computed<XY[]>(() => {
    const latLngs = props.points
        .map((p) => (Array.isArray(p) ? { lat: p[1], lng: p[0] } : { lat: p.lat, lng: p.lng }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (latLngs.length < 3) return [];

    const meanLat = latLngs.reduce((sum, p) => sum + p.lat, 0) / latLngs.length;
    const k = Math.cos((meanLat * Math.PI) / 180);
    const local = latLngs.map((p) => ({ x: p.lng * k, y: p.lat }));

    const minX = Math.min(...local.map((p) => p.x));
    const maxX = Math.max(...local.map((p) => p.x));
    const minY = Math.min(...local.map((p) => p.y));
    const maxY = Math.max(...local.map((p) => p.y));
    const scale = Math.min(
        (WIDTH - 2 * PAD) / Math.max(maxX - minX, 1e-9),
        (HEIGHT - 2 * PAD) / Math.max(maxY - minY, 1e-9),
    );
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    return local.map((p) => ({
        x: WIDTH / 2 + (p.x - midX) * scale,
        y: HEIGHT / 2 - (p.y - midY) * scale,
    }));
});

const polygonPoints = computed(() => ring.value.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
</script>

<template>
    <svg
        v-if="ring.length"
        :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
        :class="cn('h-auto w-full rounded-md border bg-muted', props.class)"
        role="img"
        :aria-label="props.label ?? 'Çizilen sınır krokisi'"
    >
        <polygon :points="polygonPoints" class="fill-primary/20 stroke-primary [stroke-width:1.5]" />
        <circle v-for="(p, i) in ring" :key="i" :cx="p.x" :cy="p.y" r="2.5" class="fill-card stroke-primary [stroke-width:1.5]" />
    </svg>
</template>
